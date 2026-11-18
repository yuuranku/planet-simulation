const assert = require('node:assert/strict');
globalThis.self=globalThis;globalThis.HistoryDate={ceil:x=>Math.ceil(x*12)/12};
require('../site/core/history/polity.js');
const CE={NUM:['','一世','二世'],TEMPLE:[],ext:()=>({people:{surnames:['甲']},regnal:'simple',gov:{org:{king:'君主',rebel:'义军',republic:'共和'},style:'central'},ruler:{king:'王',rebel:'将',republic:'执政官',empire:'皇帝'},family:'',house:'{s}氏'}),personName:()=>({surname:'甲',given:'明'})};
// 当前 API：开国方式由 q.rtype / q.parents / q.republic / q.bornHow 决定；
// 继承类型已细化为 son/brother/cousin/elect/rebel2 等；随机来自 rnd（固定 .5）。
function run({start='founder',kind='king',rnd=()=>.5,houses=[[100,'甲','甲氏',0],[140,'乙','乙氏',1]],end=190}={}) {
  const isDynasty=start==='dynasty'||start==='coup'||start==='revolution';
  const q={id:1,born:100,died:end,parents:isDynasty?[{kind:'dynasty',id:0}]:[],bornHow:start,
    republic:kind==='republic', houses,rulingCulture:[[100,0]],lin:1,children:[]};
  HistoryPolity.buildDynastyRulers(q,{CE,libAt:()=>({id:'a'}),rnd,rndR:rnd,end,govKey:()=>kind,formAt:()=> 'kingdom',religions:[],regCount:new Map(),firstOf:new Map()});
  return q;
}
// 开国 + 顺位继承 + 王朝政变
let q=run();
assert.equal(q.rulers[0][6],'found','ordinary founding');
assert.ok(q.rulers.slice(1).some(r=>['son','brother','cousin','adopt','regency'].includes(r[6])),'hereditary succession after founding');
const coup=q.rulers.find(r=>r[3]===1);assert.equal(coup[0],140);assert.equal(coup[6],'coup','dynastic change is a coup');
// 政变 / 革命开国
q=run({start:'coup'});assert.equal(q.rulers[0][6],'coup');
q=run({start:'revolution',kind:'republic'});
assert.equal(q.rulers[0][6],'revolution');
assert.ok(q.rulers.slice(1).filter(r=>r[3]===0).every(r=>r[6]==='elect'),'republican successors are elected');
// 起义：rtype 决定 rebel 开国，其后为 rebel2 继承
function runRebel(){
  const q={id:1,born:100,died:190,rtype:'peasant',houses:[[100,'甲','甲氏',0]],rulingCulture:[[100,0]],lin:1,children:[]};
  HistoryPolity.buildDynastyRulers(q,{CE,libAt:()=>({id:'a'}),rnd:()=>.5,rndR:()=>.5,end:190,govKey:()=>'rebel',formAt:()=> 'kingdom',religions:[],regCount:new Map(),firstOf:new Map()});
  return q;
}
q=runRebel();
assert.equal(q.rulers[0][6],'rebel','uprising founding');
assert.ok(q.rulers.slice(1).every(r=>r[6]==='rebel2'),'rebel succession');
// 王朝中期发生政变：换 house 的那位君主其即位类型为 coup
q=run();
assert.ok(q.rulers.some(r=>r[3]===1&&r[6]==='coup'),'a mid-dynasty coup changes the ruling house');
console.log('开国、顺位继承、王朝政变、革命选举与起义传承通过。');
