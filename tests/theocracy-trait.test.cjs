const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const G={}; G.self=G; vm.createContext(G);
for(const file of ['human-rules','religions','history/date','history/territory','history/polity']) vm.runInContext(fs.readFileSync(path.join(__dirname,'../site/core/'+file+'.js'),'utf8'),G);
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-12,`${a} != ${b}`);
test('地上天国 can be selected in a custom religion and remains distinct from holy war',()=>{
 const trait=G.HumanRules.TRAITS.find(t=>t.id==='earthly_kingdom');assert.ok(trait);assert.equal(trait.scope,'religion');
 const custom={...G.RELIGION_LIBRARIES[0],id:'custom-earth',label:'自定义信仰',traits:[{id:'earthly_kingdom',strength:1}]};
 assert.equal(G.HumanRules.validateLibrary(custom,'religion'),custom);
 assert.equal(G.HumanRules.effects(custom).theocracyChance,1);assert.equal(G.HumanRules.effects(custom).holyWar,0);
 const peaceful={...custom,traits:[...custom.traits,{id:'pacifism',strength:1}]};assert.equal(G.HumanRules.validateLibrary(peaceful,'religion'),peaceful);assert.equal(G.HumanRules.effects(peaceful).theocracyChance,1);
});
test('the real holy-city theocracy roll doubles without guaranteeing a theocracy',()=>{
 const base={type:'polytheist',traits:[]}, selected={...base,traits:[{id:'earthly_kingdom',strength:1}]};
 near(G.HistoryPolity.theocracyProbability(base,'monarchy'),0.03);
 near(G.HistoryPolity.theocracyProbability(selected,'monarchy'),0.06);
 near(G.HistoryPolity.theocracyProbability(selected,'temple'),0.12);
 const chance=G.HistoryPolity.theocracyProbability(selected,'monarchy');assert.ok(0.05<chance && 0.05>=G.HistoryPolity.theocracyProbability(base,'monarchy'));
 assert.ok(chance<1);
});

test('same threshold actually creates a theocracy only with the selected trait',()=>{
 const base={type:'polytheist',traits:[]}, selected={...base,traits:[{id:'earthly_kingdom',strength:1}]};
 const ordinary={}, religious={};
 assert.equal(G.HistoryPolity.attemptTheocracy(ordinary,3,base,200,'monarchy',0.05),false);
 assert.equal(Object.hasOwn(ordinary,'theo'),false);
 assert.equal(G.HistoryPolity.attemptTheocracy(religious,3,selected,200,'monarchy',0.05),true);
 assert.equal(religious.theo,200);assert.equal(religious.theoRel,3);
 const defeated={};assert.equal(G.HistoryPolity.attemptTheocracy(defeated,3,selected,200,'monarchy',0.9),false);
 assert.equal(Object.hasOwn(defeated,'theo'),false);
});
