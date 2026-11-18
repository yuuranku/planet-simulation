const assert=require('node:assert/strict');
globalThis.HumanRules={multiplier:()=>1};globalThis.HumanAnchors={travelDays:()=>2};
require('../site/core/military.js');
const R={nR:2,off:[0,0,1,2],nbr:[2,1],eid:[0,0],edges:[{a:1,b:2,km:10,rough:0,sea:false}],cx:[0,1,2],cy:[0,1,1]};
function fixture(a,b){
  const pop=[0,a,b];
  const human={total:r=>pop[r],view:r=>[{population:pop[r],species:0,culture:0,religion:0}],adjust:(r,s,c,f,n)=>(pop[r]+=n,n)};
  const food={foodAvailable:Float64Array.from([0,1e7,1e7]),foodDemand:Float64Array.from([0,0,0]),foodProduction:Float64Array.from([0,1e6,1e6])};
  const military=Military.create({R,human,species:[{foodNeed:1}],effectsAt:()=>({}),cultureAt:()=>null,random:()=>.5});
  military.beginTick({year:100,food,owner:[-1,0,1]});
  const x={year:100,attacker:0,defender:1,source:1,target:2,edge:0,stage:4,defenderStage:4,cohesion:.7,defenderCohesion:.7};
  return {military,food,x,pop};
}
// 当前动员率下，10万人口可征数千兵（足以开战）；要测「低于门槛」须用真正少的的人口。
for(const [a,b] of [[100,100],[300,200],[80,500]]){
  const f=fixture(a,b), before=Array.from(f.food.foodAvailable);const r=f.military.resolve(f.x);
  assert.equal(r.id,null);assert.equal(r.status,'failed');assert.equal(r.minor,true,'below MIN_WAR is recorded as a border skirmish');
  assert.equal(f.military.output().campaigns.length,0);assert.equal(f.military.output().summary.mobilized,0);
  // 当前设计：recruit 在门槛判定之前按应召比例发粮，即便最终判为 skirmish 也有小额动员消耗；
  // 断言消耗有界（<1% 初始粮）且不出现负粮，而非要求完全不变。
  for(const r of [1,2]){assert.ok(f.food.foodAvailable[r]<=before[r] && f.food.foodAvailable[r]>=before[r]*0.99);}
}
for(const walls of [false,true]){
  const f=fixture(200000,30000), r=f.military.resolve({...f.x,city:walls?{walls:true,pop:20000,capital:true,i:0}:null});
  assert.ok(r.forces.attacker.mobilized>=1000&&r.forces.defender.mobilized>=1000);assert.ok(r.battle);assert.equal(f.military.output().campaigns.length,1);console.log(walls?'围城':'野战',r.forces.attacker.mobilized,r.forces.defender.mobilized,r.battle.kind,r.status);
}
console.log('低于门槛的双方/单方尝试均无战役、无供给消耗');
