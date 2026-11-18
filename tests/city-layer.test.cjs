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
  for (const m of ['attach', 'detach', 'setEnabled', 'maxRel', 'requestUrban', 'requestCity', 'pumpQueue', 'doCityRequest', 'evictCache', 'evictUrban', 'startFade', 'visibleCities', 'draw', 'worldRadius', 'urbanPaths', 'drawUrbanLayer', 'drawCityLayer']) {
    assert.equal(typeof inst[m], 'function', '缺少方法 ' + m);
  }
  // B7：可观测统计与有界队列状态
  assert.ok(inst.stats && typeof inst.stats.requests === 'number');
  assert.ok(Array.isArray(inst.queue) && typeof inst.inflight === 'number');
  assert.equal(inst.gen, 0);
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

test('B2: 换世界后丢弃在飞的旧城市请求，不按 idx 错配进新缓存', async () => {
  const inst = new win.CityLayer();
  let resolveCall;
  inst.app = {
    call: () => new Promise(r => { resolveCall = r; }),
    map: { draw() {} }
  };
  inst.requestCity(7);              // 发起请求（进入队列→inflight）
  assert.equal(inst.inflight, 1, '请求应进入飞行队列');
  const oldGen = inst.gen;
  inst.detach();                    // 换世界：gen++，缓存/队列清空
  assert.ok(inst.gen > oldGen);
  resolveCall({ data: { urban: {}, w: 4, h: 4 } });  // 旧世界的响应姗姗来迟
  await new Promise(r => setImmediate(r));
  await new Promise(r => setImmediate(r));
  assert.equal(inst.cache.size, 0, '旧代际响应必须被丢弃');
  assert.ok(inst.stats.discarded >= 1, '应记录丢弃计数');
});

test('B4: 并发上限生效，入队请求排队而非一次性打满', () => {
  const inst = new win.CityLayer();
  inst.app = { call: () => new Promise(() => {}), map: { draw() {} } }; // 永不 resolve
  for (let i = 0; i < 10; i++) inst.requestCity(i, 10 - i);            // 优先级递减
  assert.equal(inst.inflight, 2, '同时在飞不超过 MAX_CONCURRENCY=2');
  assert.equal(inst.queue.length, 8, '其余 8 个排队');
  // 优先级高的先出队：队首应是 priority 最大的（idx=2，因 0、1 已在飞）
  assert.equal(inst.queue[0].idx, 2);
});
