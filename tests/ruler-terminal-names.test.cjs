'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const G={};G.self=G;vm.createContext(G);
for(const name of ['culture-ext','history/date','history/territory','history/polity'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../site/core',name+'.js'),'utf8'),G);
const lib={id:'terminal-fixture',x:{family:'sinitic',people:{surnames:['刘'],given:['昭'],twoChar:0}}};
function rulers(kind,end,{conquer=true,dead=true}={}){
 const q={id:0,born:0,died:dead?end:null,rulingCulture:[[0,0]],houses:[[0,'刘','刘氏',0,undefined,0,false]],lin:0,children:conquer?[{kind:'conquer'}]:[]};
 G.HistoryPolity.buildDynastyRulers(q,{CE:G.CultureExt,libAt:()=>lib,rnd:()=>0,end,govKey:()=>kind,formAt:()=> 'kingdom',religions:[],regCount:new Map(),firstOf:new Map()});return q.rulers;
}
test('terminal style preserves the personal name after the temple-name list is exhausted',()=>{
 const rows=rulers('king',210),last=rows.at(-1);assert(rows.length>G.CultureExt.TEMPLE.length);assert.equal(last[5],'昭');assert.equal(last[1],'末帝 刘昭');
});
test('a defeated rebel leader keeps the original full name without receiving an imperial temple title',()=>{
 const last=rulers('rebel',60).at(-1);assert.equal(last[1],'刘昭');assert.equal(last[5],'昭');
});
test('a republican ruler keeps the original full name without receiving an imperial temple title',()=>{
 const last=rulers('republic',16).at(-1);assert.equal(last[1],'刘昭');assert.equal(last[5],'昭');
});
test('a terminal temple title replaces only the title when that title exists',()=>{
 assert.equal(rulers('king',12).at(-1)[1],'末帝 刘昭');
});
test('a continuing or unconquered dynasty does not acquire a terminal title',()=>{
 assert.equal(rulers('king',210,{dead:false}).at(-1)[1],'刘昭');assert.equal(rulers('king',210,{conquer:false}).at(-1)[1],'刘昭');
});
