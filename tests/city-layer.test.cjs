/* 无缝地图城市层：模块契约与 LOD 配置测试。
 * 浏览器渲染部分由 e2e 截图验证；这里测可在 Node 侧验证的契约，防止接口漂移。 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const src = fs.readFileSync(path.join(__dirname, '../site/app/city-layer.js'), 'utf8');
// wgs.js 是 city-layer 的硬依赖（与 index.html 加载顺序一致），用真实源码注入同一上下文。
const wgsSrc = fs.readFileSync(path.join(__dirname, '../site/core/wgs.js'), 'utf8');
// 最小 window stub：模块体只定义函数，不立即触碰 DOM
const win = { devicePixelRatio: 1, innerWidth: 1440, matchMedia: () => ({ matches: false }) };
const Path2DStub = class { moveTo() {} lineTo() {} closePath() {} addPath() {} };
const ctx = { window: win, document: {}, performance: { now: () => 0 }, requestAnimationFrame: () => 0, console, Path2D: Path2DStub };
ctx.globalThis = ctx; ctx.self = ctx; vm.createContext(ctx);
vm.runInContext(wgsSrc, ctx);          // 先建立 win.WGS（wgs.js 挂到 self，即 ctx；window=win 需桥接）
win.WGS = ctx.WGS;
vm.runInContext(src, ctx);

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

// ---- P0 统一坐标层：确认 city-layer 真的调用 G.WGS，不再内联 2πR/W ----
test('worldRadius 的 cellKm 走 G.WGS 统一坐标层而非内联公式', () => {
  const inst = new win.CityLayer();
  const map = { W: 720, H: 360, d: { cfg: { radius: 6371 }, stats: { era: 'agricultural' } } };
  const ct = { tier: 'city', pop: 50000 };
  const real = win.WGS.recipeSpace;
  let calls = 0;
  win.WGS.recipeSpace = function (city, world) { calls++; return real(city, world); };
  try {
    const r = inst.worldRadius(map, ct);
    assert.equal(calls, 1, 'worldRadius 必须调用一次 G.WGS.recipeSpace（统一接入点）');
    const expect = Math.sqrt(Math.max(0.12, 50000 / (3200 * 0.98)) / Math.PI) / win.WGS.colKmRaw(720, 6371) * 4.5;
    assert.ok(Math.abs(r - expect) < 1e-9, '结果与统一坐标层公式一致');
  } finally { win.WGS.recipeSpace = real; }
});

test('urbanPaths 的 cellKm 走 G.WGS.recipeSpace 而非内联公式', () => {
  const inst = new win.CityLayer();
  const map = { W: 1440, H: 720, d: { cfg: { radius: 6371 } } };
  inst.app = { map };
  const real = win.WGS.recipeSpace;
  let calls = 0;
  win.WGS.recipeSpace = function (city, world) { calls++; return real(city, world); };
  try {
    const out = inst.urbanPaths({ rings: [], minor: [], arterials: [] });
    assert.equal(calls, 1, 'urbanPaths 必须调用一次 G.WGS.recipeSpace（统一接入点）');
    assert.ok(Math.abs(out.cellKm - win.WGS.colKmRaw(1440, 6371)) < 1e-9, 'cellKm 与统一坐标层一致');
  } finally { win.WGS.recipeSpace = real; }
});

test('缺少 G.WGS 时模块加载快速失败（统一坐标层为硬依赖）', () => {
  const src2 = fs.readFileSync(path.join(__dirname, '../site/app/city-layer.js'), 'utf8');
  const win2 = { devicePixelRatio: 1, innerWidth: 1440, matchMedia: () => ({ matches: false }) };
  const ctx2 = { window: win2, document: {}, performance: { now: () => 0 }, requestAnimationFrame: () => 0, console };
  ctx2.globalThis = ctx2; vm.createContext(ctx2);
  assert.throws(() => vm.runInContext(src2, ctx2), /G\.WGS/, '未加载 wgs.js 时应明确抛错而非静默回退');
});
