const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const G = {};
G.self = G;
vm.createContext(G);
for (const file of ['human-rules', 'libraries']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../site/core', file + '.js'), 'utf8'), G);
}

function copiedCulture(titles) {
  const source = JSON.parse(JSON.stringify(G.CULTURE_LIBRARIES[0]));
  return { ...source, id: 'custom-test', mode: 'custom', t: { ...source.t, ...titles } };
}

test('culture libraries accept the three loose-polity title fields, including empty editor fields', () => {
  for (const titles of [
    { tribal: [], primitive: [], clan: [] },
    { tribal: ['部落联盟'], primitive: ['诸部'], clan: ['氏族'] },
  ]) {
    const library = copiedCulture(titles);
    assert.equal(G.HumanRules.validateLibrary(library, 'culture'), library);
    const imported = JSON.parse(JSON.stringify(library));
    assert.equal(G.HumanRules.validateLibrary(imported, 'culture'), imported);
    assert.deepEqual(imported.t.tribal, titles.tribal);
    assert.deepEqual(imported.t.primitive, titles.primitive);
    assert.deepEqual(imported.t.clan, titles.clan);
  }
});

test('loose-polity titles still require nonblank string lists and unknown fields are rejected', () => {
  for (const key of ['tribal', 'primitive', 'clan']) {
    for (const bad of ['部落', [42], ['']]) {
      assert.throws(() => G.HumanRules.validateLibrary(copiedCulture({ [key]: bad }), 'culture'), /必须为非空文本组成的列表/);
    }
  }
  assert.throws(() => G.HumanRules.validateLibrary(copiedCulture({ unknown: [] }), 'culture'), /包含未知字段：unknown/);
});
