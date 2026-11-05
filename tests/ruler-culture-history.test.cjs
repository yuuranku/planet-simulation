const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const G={};G.self=G;vm.createContext(G);
for(const f of ['culture-ext','history/date','history/territory','history/polity'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../site/core',f+'.js'),'utf8'),G,{filename:f});
const french={id:'fixture-french',x:{family:'romance',house:'{s}王朝',people:{surnames:['卡佩','瓦卢瓦'],given:['路易','腓力']},ruler:{king:'国王'},gov:{org:{king:'王廷与伯爵'}}}};
const japanese={id:'fixture-japanese',x:{family:'japanese',house:'{s}氏',people:{surnames:['源','平'],given:['赖朝','义经']},ruler:{king:'大王'},gov:{org:{king:'氏姓制度与大王'}}}};
const libs=[french,japanese],libAt=(q,y)=>libs[G.HistoryPolity.rulingCultureAt(q,y)],random=()=>.1;
const polity=()=>({id:0,born:0,died:300,civ:0,initialCiv:0,settled:150,settledCiv:1,rulingCulture:[[0,0],[150,1]],dyn:[200,0],lin:0,parents:[],children:[],republic:false});
test('house creation uses its actual cultural era, retaining an existing family across the culture change',()=>{
 const q=polity();G.HistoryPolity.buildDynastyHouses(q,[q],libAt,random,G.CultureExt);
 assert.equal(q.houses.length,2);assert.equal(q.houses[0][1],'卡佩');assert.equal(q.houses[0][2],'卡佩王朝');
 assert.equal(q.houses[1][0],200);assert.equal(q.houses[1][1],'源');assert.equal(q.houses[1][2],'源氏');
});
test('new rulers and governance use the culture at their recorded year, never the final culture',()=>{
 const q=polity();G.HistoryPolity.buildDynastyHouses(q,[q],libAt,random,G.CultureExt);
 G.HistoryPolity.buildDynastyRulers(q,{CE:G.CultureExt,libAt,rnd:random,end:300,govKey:()=> 'king',formAt:()=> 'kingdom',religions:[],regCount:new Map(),firstOf:new Map()});
 const before=q.rulers.filter(x=>x[0]<150),middle=q.rulers.filter(x=>x[0]>=150&&x[0]<200),after=q.rulers.filter(x=>x[0]>=200);
 assert.ok(before.length&&middle.length&&after.length);
 assert.ok(before.every(x=>x[1].includes('路易')&&x[2]==='国王'&&x[4]===0));
 assert.ok(middle.every(x=>x[1].includes('卡佩')&&x[1].includes('赖朝')&&x[2]==='大王'&&x[4]===1));
 assert.ok(after.every(x=>x[1].includes('源')&&x[1].includes('赖朝')&&x[4]===1));
 assert.equal(q.gov.find(x=>x[0]===150)[1],'氏姓制度与大王');assert.equal(q.gov[0][1],'王廷与伯爵');
});
test('new families in a different culture do not inherit a future or foreign family name',()=>{
 const old=polity();old.civ=0;old.settled=undefined;old.settledCiv=undefined;old.rulingCulture=[[0,0]];old.died=100;old.dyn=[];G.HistoryPolity.buildDynastyHouses(old,[old],libAt,random,G.CultureExt);
 const child={...polity(),id:1,born:110,initialCiv:1,civ:1,settled:undefined,settledCiv:undefined,rulingCulture:[[110,1]],parents:[{id:0,kind:'restore'}],dyn:[]};
 G.HistoryPolity.buildDynastyHouses(child,[old,child],libAt,random,G.CultureExt);
 assert.equal(child.houses[0][1],'源'); assert.equal(child.houses[0][2],'源氏');
});
test('same-culture restoration inherits the most recent family known at restoration, not a future family',()=>{
 const old=polity();old.civ=0;old.settled=undefined;old.settledCiv=undefined;old.rulingCulture=[[0,0]];old.died=100;old.houses=[[0,'卡佩','卡佩王朝',0,undefined,0,false],[200,'瓦卢瓦','瓦卢瓦王朝',0,undefined,0,false]];old.house='瓦卢瓦';
 const child={...polity(),id:1,born:110,restoreYear:110,initialCiv:0,civ:0,settled:undefined,settledCiv:undefined,rulingCulture:[[110,0]],parents:[{id:0,kind:'restore'}],dyn:[]};
 G.HistoryPolity.buildDynastyHouses(child,[old,child],libAt,random,G.CultureExt);
 assert.equal(child.houses[0][1],'卡佩');assert.equal(child.houses[0][6],true);
});
test('an inherited older foreign house preserves its original family culture and display',()=>{
 const old=polity();old.died=200;old.houses=[[0,'卡佩','卡佩王朝',0,undefined,0,false]];old.house='卡佩';
 const child={...polity(),id:1,born:220,restoreYear:220,initialCiv:1,civ:1,settled:undefined,settledCiv:undefined,rulingCulture:[[220,1]],parents:[{id:0,kind:'restore'}],dyn:[]};
 G.HistoryPolity.buildDynastyHouses(child,[old,child],libAt,random,G.CultureExt);
 assert.equal(child.houses[0][1],'卡佩');assert.equal(child.houses[0][2],'卡佩王朝');assert.equal(child.houses[0][5],0);assert.equal(child.houses[0][6],true);
});
test('government style changes at settlement even when the culture itself stays the same',()=>{
 const q={...polity(),civ:0,initialCiv:0,settled:undefined,settledCiv:undefined,rulingCulture:[[0,0]],settled:155,settledCiv:0,dyn:[]};
 G.HistoryPolity.buildDynastyHouses(q,[q],libAt,random,G.CultureExt);
 G.HistoryPolity.buildDynastyRulers(q,{CE:G.CultureExt,libAt,rnd:random,end:300,govKey:()=> 'king',governmentStyle:(_q,y)=>y>=155?'feudal':'tribal',formAt:()=> 'kingdom',religions:[],regCount:new Map(),firstOf:new Map()});
 assert.equal(q.gov[0][3],'tribal');assert.equal(q.gov.find(x=>x[0]===155)[3],'feudal');
});
test('regnal numbering never combines identical given names from different culture libraries',()=>{
 const a={id:'number-a',x:{family:'romance',people:{surnames:['甲'],given:['同名']}}},b={id:'number-b',x:{family:'germanic',people:{surnames:['乙'],given:['同名']}}};
 const q={...polity(),born:0,died:12,initialCiv:0,civ:0,settled:6,settledCiv:1,rulingCulture:[[0,0],[6,1]],dyn:[]};const lookup=(p,y)=>[a,b][G.HistoryPolity.rulingCultureAt(p,y)];
 G.HistoryPolity.buildDynastyHouses(q,[q],lookup,()=>0,G.CultureExt);
 G.HistoryPolity.buildDynastyRulers(q,{CE:G.CultureExt,libAt:lookup,rnd:()=>0,end:12,govKey:()=> 'king',formAt:()=> 'kingdom',religions:[],regCount:new Map(),firstOf:new Map()});
 assert.equal(q.rulers[0][1],'同名');assert.equal(q.rulers[1][1],'同名');
});
test('jitter cannot move a ruler or government record across its original culture boundary',()=>{
 const old=[[0,0],[100,1]],refined=[[0,0],[93,1]],map=G.HistoryPolity.alignCultureYear;
 assert.equal(map(old,refined,99,99),92);assert.equal(map(old,refined,100,90),93);assert.equal(map(old,refined,140,137),137);
});
test('real history output keeps ruler, house and government provenance aligned to its refined culture timeline',()=>{
 for(const f of ['noise','society','human-rules','human-anchors','human-population','human-economy','human-fortifications','holy-war','military','history/regions','history/administration','history/cities'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../site/core',f+'.js'),'utf8'),G,{filename:f});
 const nn=3,R={nR:2,center:new Int32Array(nn),cx:Float64Array.from([0,1,2]),cy:Float64Array.from([0,1,1]),weight:Float64Array.from([0,.5,.5]),pot:Float64Array.from([0,1,1]),T:Float64Array.from([0,20,20]),pasture:new Float32Array(nn),arid:new Float32Array(nn),semiArid:new Float32Array(nn),river:new Uint8Array(nn),coast:new Uint8Array(nn),newW:new Float32Array(nn),landComp:new Int32Array(nn),zoneOfRegion:new Int32Array(nn),country:new Int16Array(nn).fill(-1),prov:new Int16Array(nn).fill(-1),civ:Int16Array.from([-1,0,0]),rel:new Int16Array(nn).fill(-1),off:Uint32Array.from([0,0,1,2]),nbr:Int32Array.from([2,1]),eid:Int32Array.from([0,0]),edges:[{a:1,b:2,km:24,rough:0,river:0,sea:0}],regionOf:Int32Array.from([1])};
 const Y=new Float64Array(nn*9).fill(1e9);for(let s=1;s<=3;s++)for(let r=1;r<=2;r++)Y[s*nn+r]=0;
 const D={NN:nn,E:500,Y,cradles:[],ancient:[],ancientOf:new Int16Array(nn).fill(-1),ancientEnd:new Float64Array(nn),civArr:new Float64Array(nn).fill(200),civType:['agrarian'],relFounded:[],relOrigin:[],IDEAS:[],ideaA:new Float64Array(),NAV:-1,usedNames:new Set()};
 const lib={...french,cat:'agrarian',n:{states:['法'],cities:['法城'],provinces:['法省']},c:{roots:['法'],prefixes:['新'],suffixes:['地']},traits:[]};
 const h={seed:1,W:10,H:5,R:6400,popTotal:10000,civLib:[lib],speciesLibraries:[G.HumanRules.SPECIES[0]],settlements:[{cell:0,pop:1000,name:'城'}]},C={cities:[{r:1,idx:0,name:'城',founded:0,final:1000}],pop:Float32Array.from([1000,1000]),popN:2,popStep:500,roads:[],plagues:[],events:[]};
 require('./military-fixture-terrain.cjs')(G,R,h);
 const out=G.HistoryPolity.run(h,R,D,C,{targetCountries:80,provinces:[],religions:[],cultureNames:['法文明'],routes:[],admin:{response:80,road:90,sea:160}}), q=out.polities.find(p=>p.rulingCulture[0][1]===0);
 assert.ok(out.polities.every(p=>p.born>=200&&p.rulingCulture.every(x=>x[1]!==-1)));
 assert.ok(q);assert.ok(q.houses.length&&q.rulers.length&&q.gov.length);
 for(const r of q.rulers){const c=G.HistoryPolity.datedName(q.rulingCulture,r[0])[1];assert.equal(r[4],c);assert.ok(r[3]>=0&&r[3]<q.houses.length);if(c===-1)assert.equal(r[1],'姓名未详');else assert.ok(french.x.people.given.includes(r[5]));}
 for(const house of q.houses)assert.equal(house[3],G.HistoryPolity.datedName(q.rulingCulture,house[0])[1]);
 for(const gov of q.gov){const c=G.HistoryPolity.datedName(q.rulingCulture,gov[0])[1];if(c===-1)assert.equal(gov[1],'制度未详');else assert.equal(gov[3],'feudal');}
});

test('rebellion leaders use the current cultural name pool instead of an inherited foreign house',()=>{
 const q={...polity(),dyn:[]}; G.HistoryPolity.buildDynastyHouses(q,[q],libAt,random,G.CultureExt);
 G.HistoryPolity.buildDynastyRulers(q,{CE:G.CultureExt,libAt,rnd:random,end:300,govKey:()=> 'rebel',formAt:()=> 'kingdom',religions:[],regCount:new Map(),firstOf:new Map()});
 const later=q.rulers.filter(x=>x[0]>=150);assert.ok(later.length);assert.ok(later.every(x=>x[1].includes('源')&&!x[1].includes('卡佩')));
});
test('refined settlement boundary retains pre-settlement government before the style change',()=>{
 const old=[[89,0],[110,0]],refined=[[89,0],[101,0]],map=G.HistoryPolity.alignCultureYear;
 assert.equal(map(old,refined,109,109),100);assert.equal(map(old,refined,110,101),101);
});

 test('a later restoration does not rewrite the founding dynasty',()=>{ const old=polity();old.died=80;old.houses=[[0,'卡佩','卡佩王朝',0,undefined,0,false]];old.rulingCulture=[[0,0]];old.initialCiv=old.civ=0;old.settled=undefined;old.settledCiv=undefined; const child={...polity(),id:1,born:100,restoreYear:200,initialCiv:0,civ:0,settled:undefined,settledCiv:undefined,rulingCulture:[[100,0]],parents:[{id:0,kind:'restore'}],dyn:[]}; G.HistoryPolity.buildDynastyHouses(child,[old,child],libAt,random,G.CultureExt);assert.equal(child.houses[0][6],false); });
