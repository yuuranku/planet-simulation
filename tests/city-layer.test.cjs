/* 无缝地图城市层：模块契约与 LOD 配置测试。
 * 浏览器渲染部分由 e2e 截图验证；这里测可在 Node 侧验证的契约，防止接口漂移。 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const src = fs.readFileSync(path.join(__dirname, '../site/app/city-layer.js'), 'utf8');
// 最小 window stub：模块体只定义函数，不立即触碰 DOM
const win = { devicePixelRatio: 1, innerWidth: 1440, matchMedia: () => ({ matches: false }) };
const ctx = { window: win, document: {}, performance: { now: () => 0 }, requestAnimationFrame: () => 0, console };
ctx.globalThis = ctx; vm.createContext(ctx); vm.runInContext(src, ctx);

test('CityLayer 模块正确导出构造函数与全局上限函数', () => {
  assert.equal(typeof win.CityLayer, 'function');
  assert.equal(typeof win.cityMaxRel, 'function');
  assert.ok(win.cityMaxRel() >= 400, '桌面端缩放上限应明显超过原版 48');
});

test('CityLayer 实例具备完整能力接口', () => {
  const inst = new win.CityLayer();
  for (const m of ['attach', 'detach', 'setEnabled', 'maxRel', 'requestUrban', 'requestCity', 'visibleCities', 'draw', 'worldRadius', 'urbanPaths', 'drawUrbanLayer', 'drawCityLayer']) {
    assert.equal(typeof inst[m], 'function', '缺少方法 ' + m);
  }
  assert.equal(inst.enabled, true);
  inst.setEnabled(false); assert.equal(inst.enabled, false);
  inst.setEnabled(true);
});

test('关闭城市层时缩放上限回退到原版 48', () => {
  const inst = new win.CityLayer();
  win.CityLayer._i = inst;
  inst.setEnabled(false);
  assert.equal(win.cityMaxRel(), 48);
  inst.setEnabled(true);
  assert.ok(win.cityMaxRel() > 48);
  win.CityLayer._i = null;
});

test('构造与卸载不抛异常，缓存可清空', () => {
  const inst = new win.CityLayer();
  inst.cache.set(1, {}); inst.urban.set(1, {});
  inst.detach();
  assert.equal(inst.cache.size, 0);
  assert.equal(inst.urban.size, 0);
});
