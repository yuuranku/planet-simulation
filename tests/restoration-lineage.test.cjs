const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const G = {}; G.self = G; vm.createContext(G);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../site/core/history/polity.js'), 'utf8'), G);
const polity = (id, born, died = null, parents = []) => ({ id, born, died, parents, children: [], restored: false });
const restore = (p, child, target, year, owner = Int32Array.from([-1, child]), minShare = 0) => { if (p[target] && !p[target].coreAtDeath) p[target].coreAtDeath = [1]; return G.HistoryPolity.linkRestoration(p, child, target, year, owner, minShare); };

test('an older state cannot restore its later split descendant after conquering it', () => {
  const p = [polity(0, 3480), polity(1, 4240, 4510, [{id:0, kind:'split'}])];
  p[0].children.push({id:1, kind:'split'});
  assert.equal(restore(p, 0, 1, 4580), false);
  assert.equal(p[0].restoreOf, undefined);
  assert.equal(p[1].restored, false);
  assert.equal(p[1].children.length, 0);
});

test('restore target must have died before the new state was born, and be unclaimed', () => {
  for (const target of [polity(0, 10), polity(0, 10, 100), polity(0, 10, 120), {...polity(0, 10, 90), restored:true}]) {
    const p = [target, polity(1, 100)];
    assert.equal(restore(p, 1, 0, 200), false);
    assert.equal(p[1].parents.length, 0);
  }
});

test('ancestry cycles are rejected even for otherwise valid dates', () => {
  const p = [polity(0, 10, 80, [{id:1, kind:'split'}]), polity(1, 100)];
  assert.equal(restore(p, 1, 0, 200), false);
  assert.equal(p[0].children.length, 0);
});

test('legitimate revival adds both links once using IDs, irrespective of names', () => {
  const p = [polity(0, 10, 80), polity(1, 100)]; p[0].short=p[1].short='定';
  assert.equal(restore(p, 1, 0, 200), true);
  assert.equal(p[1].restoreOf, 0);
  assert.equal(p[1].parents[0].id, 0); assert.equal(p[1].parents[0].kind, 'restore');
  assert.equal(p[0].children[0].id, 1); assert.equal(p[0].children[0].kind, 'restore');
  assert.equal(restore(p, 1, 0, 200), false);
  assert.equal(p[1].parents.length, 1); assert.equal(p[0].children.length, 1);
});

test('invalid or no-longer-living restoring polity and unknown IDs never mutate lineage', () => {
  const p = [polity(0, 10, 80), polity(1, 100, 150)];
  for (const [child, target, year] of [[1,0,200],[1,1,120],[1,7,120],[7,0,120],[1,0,99]]) assert.equal(restore(p, child, target, year), false);
  assert.equal(p[0].restored, false); assert.equal(p[1].parents.length, 0);
});

test('same-name states far from the old heartland are not a restoration', () => {
  const p=[polity(0,0,80),polity(1,100)];p[0].short=p[1].short='汉';p[0].coreAtDeath=[1,2,3,4];
  const owner=Int32Array.from([-1,9,9,9,9,1]);
  assert.equal(restore(p,1,0,200,owner,0.75),false);
  assert.equal(p[1].restoreOf,undefined);
});
test('real reconquest of the former heartland can establish restoration', () => {
  const p=[polity(0,0,80),polity(1,100)];p[0].coreAtDeath=[1,2,3,4];
  const owner=Int32Array.from([-1,1,1,1,9]);
  assert.equal(restore(p,1,0,200,owner,0.75),true);
});
test('contemporary namesakes cannot be restoration even with overlapping claim', () => {
  const p=[polity(0,0),polity(1,100)];p[0].coreAtDeath=[1];
  assert.equal(restore(p,1,0,200,Int32Array.from([-1,1]),0),false);
});

test('name does not inherit a restoration title before its actual year', () => {
 const old={...polity(0,0,80),civ:0,names:[[0,'汉','汉']]}; const child={...polity(1,100),civ:0,restoreYear:200,parents:[{id:0,kind:'restore'}]};
 const name=y=>G.HistoryPolity.inheritedStateName(child,[old,child],y,()=> 'lib',[0,1],[0,0],100,new Set());
 assert.equal(name(100),null); assert.equal(name(200).short,'后汉');
});
test('ordinary generated state names cannot manufacture restoration prefixes', () => {
 const lib={id:'custom',c:{roots:['汉'],prefixes:['后'],suffixes:['阳']},n:{states:[]}}; let seen;
 G.NameGen={make:(l)=>{seen=l.c.prefixes;return '汉阳'}};
 assert.equal(G.HistoryPolity.drawRulingName(lib,'state',new Set(),()=>0),'汉阳');assert.deepEqual(Array.from(seen),[]);
 const fixed={...lib,n:{states:['后汉']}};assert.equal(G.HistoryPolity.drawRulingName(fixed,'state',new Set(),()=>0),'后汉');
});

test('old-state core excludes regions held only by other branches of the lineage',()=>{const core=Int32Array.from([-1,5,5,5,6]);const held=new Set([1,4]);assert.deepEqual(Array.from(G.HistoryPolity.historicalCores(held,core,5)),[1]);});
