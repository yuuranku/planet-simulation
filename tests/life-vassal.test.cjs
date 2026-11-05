'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const g={console};g.self=g;vm.createContext(g);
for(const file of ['noise.js','hydro.js','human-rules.js','culture-ext.js','history/date.js','history/query.js','navigation-overland.js','navigation.js','life-story.js','life-paths.js','life.js','life-text.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../site/core',file),'utf8'),g,{filename:file});
const copy=x=>JSON.parse(JSON.stringify(x));
function generate(h,cfg,request,wrapRoute=route=>route){
  const W=h.FW,H=h.FH,world={P:{W,H,elev:new Float32Array(W*H).fill(100)},Cl:{biome:new Uint8Array(W*H).fill(3)},Hy:{lake:new Uint8Array(W*H)},cfg:{...cfg,radius:h.Rkm},history:h};
  return g.Life.generate(h,cfg,request,wrapRoute(g.Navigation.historyRouter(world)));
}
function fixture(){
  const h={E:120,nR:3,W:180,H:90,FW:360,FH:180,Rkm:6371,cx:[0,30,31,100],cy:[0,90,90,80],Y:Array(36).fill(0),pasture:[0,0,0,0],
    civs:[{name:'旧家文化',libId:'old'},{name:'新统治文化',libId:'new'}],ancient:[],religions:[{name:'旧信仰',founded:0,traits:[]},{name:'新信仰',founded:100,traits:[]}],
    cities:[{idx:0,r:1,x:30,y:90,founded:0,ruined:null,names:[[0,'旧城'],[70,'新城']]},{idx:1,r:2,x:31,y:90,founded:20,ruined:null,names:[[20,'商镇']]},{idx:2,r:3,x:100,y:80,founded:0,ruined:null,names:[[0,'远城']]}],
    provinces:[{created:0,abolished:null,names:[[0,'旧省'],[70,'新省']]}],
    own:{off:[0,0,2,3,4],year:[0,40,0,0],owner:[0,1,0,0]},provLog:{off:[0,0,1,2,3],year:[0,0,0],val:[0,0,-1]},cultLog:{off:[0,0,2,3,4],year:[0,40,0,0],val:[0,1,0,0]},relLog:{off:[0,0,1,2,3],year:[0,0,0],val:[0,0,0]},
    polities:[{born:0,died:40,names:[[0,'甲国']],gov:[[0,'旧制']],rulingCulture:[[0,0]]},{born:40,died:null,names:[[40,'乙国']],gov:[[40,'新制']],rulingCulture:[[40,1]]}],
    roads:[{id:'road-0',sa:0,sb:1,year:30,lines:[[30,90,31,90]],ferries:[]}],events:[],military:{effects:[],campaigns:[]}};
  const species=copy(g.HumanRules.SPECIES.slice(0,2));species[0].life={maturity:18,oldAge:80,maximum:160,infantMortality:0,adultMortality:0,oldAgeMortality:0};
  const sample=(year,groups)=>({year,calculatedThroughYear:year,offsets:[0,0,groups.length,groups.length+1,groups.length+2],species:[...groups.map(x=>x[0]),0,0],culture:[...groups.map(x=>x[1]),0,0],religion:[...groups.map(x=>x[2]),0,0],population:[...groups.map(x=>x[3]),800,200]});
  h.human={species,snapshots:[sample(0,[[0,0,0,1000],[1,1,-1,100]]),sample(100,[[1,1,1,500]])]};
  const lib=(id,surname,given)=>({id,label:id,cat:'agrarian',mode:'custom',n:{states:['国']},traits:[],x:{family:'sinitic',people:{surnames:[surname],given:[given],twoChar:0}}});
  const cfg={yearDays:365.25,day:24,customLibraries:[lib('old','旧','名'),lib('new','新','字')]};
  const req={id:'person-one',worldKey:'world-fixture',seed:'fixed-seed',mode:'birth',year:20,birthYear:20,birthDay:1,place:{kind:'city',id:0},species:0,culture:0,religion:0,familyClass:'craft'};
  return{h,cfg,req};
}

function politicalFixture(p, q, path='official') {
  const {h,cfg,req}=fixture();
  h.E=56; h.own.owner[1]=0; h.own.owner[3]=1;
  h.polities[0].died=null; h.polities[0].caps=[[0,0,1]];
  h.polities[1].born=0; h.polities[1].names=[[0,'乙国']]; h.polities[1].caps=[[0,2,3]];
  h.cities[2].x=32; h.cities[2].y=90; h.cx[3]=32; h.cy[3]=90;
  h.events=[{kind:'vassal',year:55,time:55+10/12,month:11,p,q,r:3,text:p===0?'乙国臣服于甲国，成为附庸':'甲国臣服于乙国，成为附庸'}];
  return {h,cfg,req:{...req,year:0,birthYear:0,familyClass:'learned',path,sex:'女'}};
}

test('the suzerain official regards another state submitting as an accepted vassal, not national humiliation',()=>{
  const {h,cfg,req}=politicalFixture(0,1);
  const p=generate(h,cfg,{...req,seed:'vassal-0'});
  const e=p.events.find(x=>x.result?.world?.kind==='vassal');
  assert.ok(e,'the historical event must reach the official');
  assert.equal(e.result.title,'接纳附庸');
  assert.match(e.result.text,/乙国臣服于甲国/);
  assert.doesNotMatch(e.result.text,/国耻|出使宗主国/);
});

test('the subordinate official can regard their own state submitting as humiliation',()=>{
  const {h,cfg,req}=politicalFixture(1,0);
  const p=generate(h,cfg,{...req,seed:'vassal-0'});
  const e=p.events.find(x=>x.result?.world?.kind==='vassal');
  assert.ok(e,'the historical event must reach the official');
  assert.equal(e.result.title,'称臣纳贡');
  assert.match(e.result.text,/甲国臣服于乙国/);
  assert.match(e.result.text,/国耻/);
});

test('a subordinate envoy is sent to the actual suzerain capital',()=>{
  const {h,cfg,req}=politicalFixture(1,0,'envoy');
  let witness;
  for(let i=0;i<60&&!witness;i++){
    const p=generate(h,cfg,{...req,seed:'vassal-envoy-'+i});
    const submission=p.events.find(x=>x.result?.world?.kind==='vassal');
    const trip=p.events.find(x=>x.kind==='migration'&&x.result?.purpose?.includes('奉命出使宗主国'));
    if(submission&&trip)witness={p,submission,trip};
  }
  assert.ok(witness,'a real envoy should undertake the event-specific diplomatic journey');
  assert.match(witness.trip.result.purpose,/宗主国乙国/);
  assert.equal(witness.trip.place.id,2);
});

test('a suzerain envoy does not treat a new vassal as their own suzerain',()=>{
  const {h,cfg,req}=politicalFixture(0,1,'envoy');
  for(let i=0;i<8;i++){
    const p=generate(h,cfg,{...req,seed:'vassal-master-envoy-'+i});
    const e=p.events.find(x=>x.result?.world?.kind==='vassal');
    if(!e)continue;
    assert.equal(e.result.title,'接纳附庸');
    assert.doesNotMatch(e.result.text,/国耻/);
    assert.ok(!p.events.some(x=>x.result?.purpose?.includes('奉命出使宗主国')));
    return;
  }
  assert.fail('the suzerain envoy must actually witness the historical event');
});
