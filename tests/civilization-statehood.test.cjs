const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function history({ known = false, seed = 1, end = 500, arrivals = 200, unknownNeighbor = false, regions = 2, event = null, allCities = false, targetCountries = 80, site = path.join(__dirname, '../site') } = {}) {
  const G = {}; G.self = G; vm.createContext(G);
  for (const f of ['noise', 'libraries', 'society', 'human-rules', 'human-anchors', 'human-population', 'human-economy', 'human-fortifications', 'holy-war', 'history/date', 'military', 'history/administration', 'history/regions', 'history/territory', 'history/polity']) {
    let source=fs.readFileSync(path.join(site, 'core', f + '.js'), 'utf8');
    if(event&&f==='history/polity'){
      source=source.replace('const rndU = mulberry32((h.seed | 0) + 4242)', 'const rndU = () => 0');
      source=source.replace('      const fortPopulation =', '      if(G.scenario)G.scenario({y,P,owner,cult,dynasty,crisis,unrestStep,setOwner,unrest,calmUntil,events,countrySlots});\n      const fortPopulation =');
    }
    vm.runInContext(source, G);
  }
  G.HistoryCities = { reference: i => `[city:${i}]`, resolveEvent() {} };
  const nn = regions + 1;
  const R = { nR: regions, area: new Float64Array(nn).fill(100), center: new Int32Array(nn), cx: Float64Array.from({length:nn},(_,r)=>r?1+(r-1)*.01:0), cy: Float64Array.from({length:nn},(_,r)=>r?1:0), weight: Float64Array.from({length:nn},(_,r)=>r?1/regions:0), pot: Float64Array.from({length:nn},(_,r)=>r?1:0), T: new Float64Array(nn).fill(20), pasture: new Float32Array(nn), arid: new Float32Array(nn), semiArid: new Float32Array(nn), river: new Uint8Array(nn), coast: new Uint8Array(nn), newW: new Float32Array(nn), landComp: new Int32Array(nn), zoneOfRegion: new Int32Array(nn), country: new Int16Array(nn).fill(-1), prov: new Int16Array(nn).fill(-1), civ: Int16Array.from({length:nn},(_,r)=>r&&known&&(!unknownNeighbor||r===1)?0:-1), rel: new Int16Array(nn).fill(-1), off: Uint32Array.from([0, 0, 1, 2]), nbr: Int32Array.from([2, 1]), eid: Int32Array.from([0, 0]), edges: [{ a: 1, b: 2, km: 24, rough: 0, river: 0, sea: 0 }] };
  const off=[0,0],nbr=[],eid=[],edges=[];
  if(event==='limited-crisis')for(let r=1;r<=regions;r++)R.cx[r]=r*.3;
  for(let r=1;r<regions;r++)edges.push({a:r,b:r+1,km:24,rough:0,river:0,sea:0});
  for(let r=1;r<=regions;r++){if(r>1){nbr.push(r-1);eid.push(r-2)}if(r<regions){nbr.push(r+1);eid.push(r-1)}off.push(nbr.length)}
  Object.assign(R,{off:Uint32Array.from(off),nbr:Int32Array.from(nbr),eid:Int32Array.from(eid),edges});
  const Y = new Float64Array(nn * 9).fill(1e9);
  for (let s = 1; s <= 3; s++) for (let r = 1; r <= regions; r++) Y[s * nn + r] = 0;
  const D = { NN: nn, E: end, Y, cradles: [], ancient: [], ancientOf: new Int16Array(nn).fill(-1), ancientEnd: new Float64Array(nn), civArr: new Float64Array(nn).fill(arrivals), civType: ['agrarian'], relFounded: [], relOrigin: [], IDEAS: [], ideaA: new Float64Array(), NAV: -1, usedNames: new Set() };
  R.Heap = G.HistoryRegions.Heap; R.regionOf = Int32Array.from([1]);
  const A = { id: 'a', t: { monarchy: ['甲制'] }, n: { states: ['甲'], cities: ['甲城'], provinces: ['甲省'] }, c: { roots: ['甲'], prefixes: ['新'], suffixes: ['地'] } };
  const h = { seed, W: 10, H: 5, R: 6400, popTotal: 10000, civLib: [A], speciesLibraries: [G.HumanRules.SPECIES[0]], settlements: [{ cell: 0, pop: 1000, name: '未来城' }] };
  const C = { cities: [{ r: 1, idx: 0, name: '未来城', founded: 0, final: 1000 }, { r: 0, idx: -1, name: '孤城', founded: 0, final: 100 }], pop: Float32Array.from([1000, 1000, 100, 100]), popN: 2, popStep: end, roads: [], plagues: [], events: [] };
  if(allCities){
    h.popTotal=regions*10000;
    R.regionOf=Int32Array.from({length:regions},(_,i)=>i+1);
    h.settlements=Array.from({length:regions},(_,i)=>({cell:i,pop:1000,name:`城${i+1}`}));
    C.cities=Array.from({length:regions},(_,i)=>({r:i+1,idx:i,name:`城${i+1}`,founded:0,final:1000}));
    C.pop=new Float32Array(regions*2).fill(1000);
  }
  h.H=Math.max(h.H,Math.ceil(regions/h.W));
  require('./military-fixture-terrain.cjs')(G, R, h);
  let observation=null;const done={};
  if(event)G.scenario=({y,P,owner,cult,dynasty,crisis,unrestStep,setOwner,unrest,calmUntil,events,countrySlots})=>{
    const q=P.find(x=>x.died===null&&x.civ===0);if(y<100||!q)return;
    assert.equal(cult[2],['limited-revolt','limited-crisis'].includes(event)?0:-1,'scenario uses the intended local culture');
    for(let r=1;r<=regions;r++)setOwner(r,q.id,y);
    const before=P.length, slotsBefore=countrySlots();
    if(event==='limited-crisis'){
      crisis(q.id,y,0,0);
      observation={before,after:P.length,parent:q.id,owner:Array.from(owner),events:events.filter(e=>e.year===y)};
    }else if(event==='dynasty'){
      q.cap=2;q.caps.push({year:y,city:-1,r:2});
      const id=dynasty(q.id,y,'coup');
      observation={parent:q.id,child:id,civ:P[id].civ,initialCiv:P[id].initialCiv,local:cult[2],owner:Array.from(owner)};
    }else{
      unrest.fill(0);unrest[2]=5;calmUntil.fill(0);q.lastRevolt=-1000;q.coh=.01;
      unrestStep(y,[q.id],new Int8Array(P.length).fill(4),new Float64Array(P.length).fill(10),new Float64Array(P.length).fill(1000));
      observation={before,after:P.length,local:cult[2],owner:Array.from(owner),parent:q.id,events:events.filter(e=>e.year===y),lastRevolt:q.lastRevolt,calmUntil:Array.from(calmUntil),slotsBefore,slotsAfter:countrySlots(),rebel:P[owner[2]]&&{rebel:P[owner[2]].rebel,target:P[owner[2]].target}};
    }
    throw done;
  };
  let out;try{out = G.HistoryPolity.run(h, R, D, C, { countries: [], targetCountries, targetTribal: 0.35, provinces: [], religions: [], cultureNames: ['甲文明'], routes: [], admin: { response: 80, road: 90, sea: 160 } });}catch(error){if(error!==done)throw error;}
  if(event){assert.ok(observation,'scenario must actually run');return observation;}
  return JSON.parse(JSON.stringify({ out, cities: C.cities }, (_key, value) => ArrayBuffer.isView(value) ? Array.from(value) : value));
}

test('unformed civilizations stay unowned tribes even when settlement development reaches city stage', () => {
  const {out}=history();
  assert.equal(out.polities.length,0);
  assert.equal(out.end.countries.length,0);
  assert.ok(out.end.owner.every(v=>v===-1));
  assert.ok(out.human.snapshots.at(-1).population.some(n=>n>0),'tribal residents remain alive');
  assert.ok(out.human.snapshots.every(s=>s.culture.every(c=>c===-1)),'no future culture is invented');
});

test('states form only after the founding civilization is actually present', () => {
  const {out}=history({known:true});
  assert.ok(out.polities.length>0);
  for(const q of out.polities){
    assert.ok(q.born>=200);
    assert.equal(q.rulingCulture[0][1],0);
    assert.ok(q.rulingCulture.every(x=>x[1]!==-1));
    assert.doesNotMatch(q.short,/未命名/);
  }
  const first=out.polities.find(q=>!q.parents.length), region=first.caps[0][2];
  let local=-1;
  for(let k=out.cultLog.off[region];k<out.cultLog.off[region+1]&&out.cultLog.year[k]<=first.born;k++)local=out.cultLog.val[k];
  assert.equal(local,first.rulingCulture[0][1],'monthly refinement cannot predate actual culture formation');
  for(let r=1;r<out.own.off.length-1;r++)for(let k=out.own.off[r];k<out.own.off[r+1];k++)if(out.own.owner[k]>=0)assert.ok(out.own.year[k]>=200);
});

test('a real civilization can expand into tribal territory and gradually assimilate its people', () => {
  const {out}=history({known:true,arrivals:0,unknownNeighbor:true,end:3000});
  assert.ok(out.polities.length>0);
  assert.ok(out.polities.every(q=>q.civ!==-1));
  const firstOccupation=[];
  for(let k=out.own.off[2];k<out.own.off[3];k++)if(out.own.owner[k]>=0)firstOccupation.push(out.own.year[k]);
  assert.ok(firstOccupation.length,'civilized states may occupy tribal land');
  const occupied=firstOccupation[0];
  const sample=out.human.snapshots.find(s=>s.year>=occupied);
  const culturesAt=s=>s.culture.slice(s.offsets[2],s.offsets[3]);
  assert.ok(culturesAt(sample).includes(-1),'occupation does not instantly invent a culture');
  assert.ok(out.human.snapshots.some(s=>s.year>occupied&&culturesAt(s).includes(0)),'ruling civilization can assimilate unknown populations');
});

test('an unknown local uprising returns to unowned tribes rather than borrowing its ruler culture',()=>{
  const r=history({known:true,arrivals:0,unknownNeighbor:true,regions:4,event:'revolt'});
  assert.equal(r.after,r.before,'no rebel state is created without a local civilization');
  assert.equal(r.local,-1,'parent culture is not assigned to the tribes');
  assert.equal(r.owner[2],-1);
  assert.equal(r.owner[1],r.parent,'the existing civilized state remains');
  assert.ok(r.events.some(e=>e.kind==='tribalFree'));
});

test('an existing dynasty can succeed at an unassimilated capital using its own established civilization',()=>{
  const r=history({known:true,arrivals:0,unknownNeighbor:true,regions:4,event:'dynasty'});
  assert.notEqual(r.child,r.parent);
  assert.equal(r.civ,0);assert.equal(r.initialCiv,0);assert.equal(r.local,-1);
  assert.ok(r.owner.slice(1).every(p=>p===r.child),'dynastic succession preserves conquered territory');
});

test('the requested country target constrains actual historical ownership and final country records',()=>{
  const finalCounts=[];
  for(const targetCountries of [1,4,12]){
    const {out}=history({known:true,arrivals:0,regions:40,allCities:true,end:1000,targetCountries});
    assert.ok(out.end.countries.length>0,'civilizations still form states');
    const upper=targetCountries+Math.min(8,Math.floor(targetCountries/10));
    assert.ok(out.end.countries.length<=upper,`requested about ${targetCountries}, generated ${out.end.countries.length}`);
    const live=new Set(out.end.owner.filter(id=>id>=0));
    const countries=[...live].filter(id=>{const q=out.polities[id];return !(q.rtype && q.rebelUntil===null);});
    assert.equal(countries.length,out.end.countries.length,'all non-rebel territorial owners appear as countries');
    for(const id of live)assert.ok(out.polities[id].rulingCulture[0][1]!==-1);
    const changes=[];
    for(let region=1;region<out.own.off.length-1;region++)for(let i=out.own.off[region];i<out.own.off[region+1];i++)changes.push([out.own.year[i],region,out.own.owner[i]]);
    changes.sort((a,b)=>a[0]-b[0]);
    const owners=new Int32Array(out.own.off.length).fill(-1),sizes=new Map();
    for(let i=0;i<changes.length;){
      const time=changes[i][0];
      while(i<changes.length&&changes[i][0]===time){const [,region,next]=changes[i++],old=owners[region];if(old>=0){sizes.set(old,sizes.get(old)-1);if(!sizes.get(old))sizes.delete(old);}owners[region]=next;if(next>=0)sizes.set(next,(sizes.get(next)||0)+1);}
      const actors=new Set([...sizes.keys()].map(id=>{const q=out.polities[id];if(q.rtype && time>=q.rebelSince && (q.rebelUntil===null || time<q.rebelUntil)){const targets=q.rebelTargets.filter(x=>x[0]<=time);return targets.length?targets.at(-1)[1]:id;}return id;}));
      assert.ok(actors.size<=upper+3,`history at ${time} has ${actors.size} countries, target ${targetCountries}`);
    }
    finalCounts.push(out.end.countries.length);
  }
  assert.ok(finalCounts[0]<finalCounts[1]&&finalCounts[1]<finalCounts[2],'different settings affect actual outcomes');
});

test('an existing dynasty can change hands even when the state limit is full',()=>{
  const r=history({known:true,arrivals:0,unknownNeighbor:true,regions:4,event:'dynasty',targetCountries:1});
  assert.notEqual(r.child,r.parent);
  assert.equal(r.civ,0);
  assert.ok(r.owner.slice(1).every(p=>p===r.child));
});

test('unformed civilizations can still regain tribal autonomy when the state limit is full',()=>{
  const r=history({known:true,arrivals:0,unknownNeighbor:true,regions:4,event:'revolt',targetCountries:1});
  assert.equal(r.after,r.before);
  assert.equal(r.owner[2],-1);
  assert.ok(r.events.some(e=>e.kind==='tribalFree'));
});

test('a revolt can occur at the country limit without creating an independent country',()=>{
  const r=history({known:true,arrivals:0,regions:4,event:'limited-revolt',targetCountries:1});
  assert.equal(r.after,r.before+1,'a rebel actor is created');
  assert.notEqual(r.owner[2],r.parent,'the rebel temporarily controls the region');
  assert.deepEqual(r.rebel,{rebel:true,target:r.parent},'the rebel belongs to its targeted state');
  assert.equal(r.slotsBefore,0);assert.equal(r.slotsAfter,0,'the rebel does not consume a separate country slot');
  assert.ok(r.events.some(e=>e.kind==='revolt'),'the revolt is recorded');
  assert.ok(r.lastRevolt>=100);
  assert.ok(r.calmUntil[2]>r.lastRevolt);
});

test('a state can still undergo a change of dynasty during a crisis when the target is full',()=>{
  const r=history({known:true,arrivals:0,regions:6,event:'limited-crisis',targetCountries:1});
  assert.ok(r.after>r.before,'a new dynasty is created');
  assert.ok(r.owner.slice(1).every(id=>id!==r.parent));
});

test('an 80-country target stays within 70–90 without a sudden terminal collapse',()=>{
  for(const seed of [1,8,42]){
    const {out}=history({known:true,arrivals:0,regions:650,allCities:true,end:1000,targetCountries:80,seed});
    const countAt=time=>{
      const active=new Set();
      for(let r=1;r<out.own.off.length-1;r++){
        let owner=-1;
        for(let i=out.own.off[r];i<out.own.off[r+1]&&out.own.year[i]<=time;i++)owner=out.own.owner[i];
        if(owner>=0){const q=out.polities[owner];if(!(q.rtype && time>=q.rebelSince && (q.rebelUntil===null || time<q.rebelUntil)))active.add(owner);}
      }
      return active.size;
    };
    const before=countAt(950),final=out.end.countries.length;
    assert.ok(final>=70&&final<=90,`seed ${seed}: requested 80 ± 10, got ${final}`);
    assert.ok(before-final<=10,`seed ${seed}: last 50 years fell from ${before} to ${final}`);
  }
});
