const assert = require('node:assert/strict');
globalThis.self=globalThis;globalThis.HistoryDate={ceil:x=>Math.ceil(x*12)/12};
require('../site/core/history/polity.js');
const CE={NUM:['','一世','二世'],TEMPLE:[],ext:()=>({people:{surnames:['甲']},regnal:'simple',gov:{org:{king:'君主',rebel:'义军',republic:'共和'},style:'central'},ruler:{king:'王',rebel:'将',republic:'执政官',empire:'皇帝'},family:'',house:'{s}氏'}),personName:()=>({surname:'甲',given:'明'})};
function run({start='founder',kind='king',roll=()=>1,houses=[[100,'甲','甲氏',0],[140,'乙','乙氏',1]],end=190}={}) {
  const q={id:1,born:100,died:end,parents:start==='dynasty'||start==='coup'||start==='revolution'?[{kind:'dynasty',id:0}]:[],foundingHow:start,houses,rulingCulture:[[100,0]],lin:1,children:[]};
  HistoryPolity.buildDynastyRulers(q,{CE,libAt:()=>({id:'a'}),rnd:()=>.5,accessionRnd:roll,end,govKey:()=>kind,formAt:()=> 'kingdom',religions:[],regCount:new Map(),firstOf:new Map()});
  return q;
}
let q=run();assert.equal(q.rulers[0][6],'founder');assert.ok(q.rulers.some(r=>r[6]==='inherit'));let coup=q.rulers.find(r=>r[3]===1);assert.equal(coup[0],140);assert.equal(coup[6],'coup');
q=run({start:'coup'});assert.equal(q.rulers[0][6],'coup');
q=run({start:'revolution',kind:'republic'});assert.equal(q.rulers[0][6],'revolution');assert.ok(q.rulers.slice(1).filter(r=>r[3]===0).every(r=>r[6]==='office'));
q=run({kind:'rebel'});assert.equal(q.rulers[0][6],'revolt');assert.ok(q.rulers.slice(1).filter(r=>r[3]===0).every(r=>r[6]==='rebelSuccession'));
q=run({roll:()=>0,houses:[[100,'甲','甲氏',0]]});const i=q.rulers.findIndex(r=>r[6]==='regicide');assert.ok(i>0);assert.equal(q.rulers[i-1][7],'murdered');assert.ok(q.rulers[i][0]>q.rulers[i-1][0]);
console.log('开国、顺位继承、王朝政变、革命、起义和弑君交接通过；弑君与前任结局成对。');
q=run({roll:()=>.05,houses:[[100,'甲','甲氏',0]]});const j=q.rulers.findIndex(r=>r[6]==='usurp');assert.ok(j>0);assert.equal(q.rulers[j-1][7],'deposed');
console.log('篡位与前任被废黜配对通过。');
