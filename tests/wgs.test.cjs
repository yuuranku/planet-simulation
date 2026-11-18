/* 统一坐标层 WGS 的等价性与往返测试。
 * oracle 直接内联 urban.js / citysite.js 的原公式，确保 WGS 与旧实现逐点一致
 * ——这是「不改变现有视觉 / 不改生成结果」的可验证证据。 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../site/core/wgs.js'), 'utf8');
const G = {}; G.self = G; vm.createContext(G); vm.runInContext(source, G);
const W = G.WGS;
const M = Math, PI = M.PI;
const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b)), `期望 ${a} ≈ ${b}`);

// ---- oracle：urban.js 原公式（局部线性投影） ----
function urbanOracle(Wd, H, R, y) {
  const cellKm = 2 * PI * R / Wd, lat = (90 - y / H * 180) * PI / 180;
  return { kx: cellKm * M.max(0.15, M.cos(lat)), ky: cellKm, lat };
}
// ---- oracle：citysite.js 原 geom()（球面投影） ----
function geomOracle(radiusKm, y, Wd, H, R) {
  const latStep = PI / H, lonStep = 2 * PI / Wd;
  const lat = PI / 2 - y * latStep, ang = radiusKm / R, ry = ang / latStep;
  const la = M.abs(lat) + ang >= PI / 2 ? PI : M.asin(M.min(1, M.sin(ang) / M.cos(lat)));
  const rx = M.min(Wd / 2, la / lonStep);
  return { ry, rx, rowKm: latStep * R, colKm: lonStep * R * M.max(M.cos(lat), 1e-12) };
}

const SAMPLES = [
  { Wd: 720, H: 360, R: 6371 },
  { Wd: 1440, H: 720, R: 6371 },
  { Wd: 512, H: 256, R: 3390 }
];
const YS = [0, 1, 45, 90, 180, 270, 359];

test('latRad / latDeg 与两套原公式等价', () => {
  for (const s of SAMPLES) for (const y of YS) {
    close(W.latRad(y, s.H), PI / 2 - y * PI / s.H);
    close(W.latRad(y, s.H), (90 - y / s.H * 180) * PI / 180); // urban 写法
    close(W.latDeg(y, s.H), 90 - y * 180 / s.H);
  }
});

test('localScale 与 urban.js 的 kx/ky 逐点一致', () => {
  for (const s of SAMPLES) for (const y of YS) {
    const o = urbanOracle(s.Wd, s.H, s.R, y), got = W.localScale(s.Wd, s.H, s.R, y);
    close(got.kx, o.kx); close(got.ky, o.ky); close(got.cellKm, 2 * PI * s.R / s.Wd);
  }
});

test('radiusExtent 与 citysite.js 的 geom() 逐点一致', () => {
  for (const s of SAMPLES) for (const y of [1, 45, 90, 180, 270, 359]) for (const radiusKm of [0.5, 5, 50, 500]) {
    const o = geomOracle(radiusKm, y, s.Wd, s.H, s.R), got = W.radiusExtent(radiusKm, y, s.Wd, s.H, s.R);
    close(got.ry, o.ry); close(got.rx, o.rx); close(got.rowKm, o.rowKm); close(got.colKm, o.colKm);
  }
});

test('网格 ↔ 局部公里 双向映射往返一致', () => {
  const s = SAMPLES[0], cx = 123.4, cy = 100;
  for (const [kmX, kmY] of [[0, 0], [12.5, -8.2], [-300, 450], [0.001, -0.001]]) {
    const g = W.localKmToGrid(kmX, kmY, cx, cy, s.Wd, s.H, s.R);
    const back = W.gridToLocalKm(g.x, g.y, cx, cy, s.Wd, s.H, s.R);
    close(back.kmX, kmX); close(back.kmY, kmY);
  }
});

test('recipeSpace 的 toWorld/toLocal 往返一致且中心锚定', () => {
  const s = SAMPLES[1], city = { x: 500, y: 250 };
  const sp = W.recipeSpace(city, { W: s.Wd, H: s.H, R: s.R });
  close(sp.center.x, 500); close(sp.center.y, 250);
  const w = sp.toWorld(30, -20), back = sp.toLocal(w.x, w.y);
  close(back.kmX, 30); close(back.kmY, -20);
  close(sp.radiusExtent(10).rowKm, PI / s.H * s.R);
  assert.equal(sp.wrapX(s.Wd + 3), 3);
});

test('wrapX 处理负数与超界经度', () => {
  assert.equal(W.wrapX(-1, 720), 719);
  assert.equal(W.wrapX(720, 720), 0);
  assert.equal(W.wrapX(721, 720), 1);
  assert.equal(W.wrapX(5, 720), 5);
});

test('cosClamped 两个 profile 的分歧点符合原实现', () => {
  // 高纬处 cos 很小：local 钳到 0.15，sphere 钳到 1e-12。
  const yNearPole = 0.2, H = 360;
  const local = W.cosClamped(yNearPole, H, 'local');
  const sphere = W.cosClamped(yNearPole, H, 'sphere');
  assert.ok(local >= 0.15 - 1e-12, 'local 下限应为 0.15');
  assert.ok(sphere > 0 && sphere < local, 'sphere 保留更小的 cos 值');
});
