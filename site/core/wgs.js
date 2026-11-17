/* 统一世界坐标层 WGS（World Grid Space）——无缝地图 P0。
 *
 * 职责：把散落在 urban.js（局部线性投影）与 citysite.js（球面投影）里的
 * 「世界网格 ↔ 公里 ↔ 纬度」换算收敛为一个权威、纯函数、可测试的模块。
 *
 * 设计红线：
 *   - 数值必须与现有两套公式逐位等价（下方两个 profile 精确复现原公式）；
 *   - 不改动任何生成算法、不改变存档格式、不改变现有调用结果；
 *   - 纯函数、无副作用，可同时在主线程 / Worker / Node(vm) 中运行。
 *
 * 两个 profile：
 *   - 'local'  ：urban.js 用的局部线性投影，cos 下限钳制 0.15（防高纬过度拉伸）。
 *   - 'sphere' ：citysite.js 用的球面投影，cos 下限钳制 1e-12（球面精确）。
 *
 * 城市配方本身已是 world-grid-cells 坐标，recipeSpace() 提供 P1 统一渲染的接入点。
 */
(function (G) {
  'use strict';
  const M = Math, PI = M.PI, EPS = 1e-12;

  // 纬度：网格 y -> 纬度。y=0 为北极(+π/2)，y=H 为南极(-π/2)。
  // 与 urban.js 的 (90 - y/H*180)*π/180、citysite.js 的 π/2 - y*latStep 完全等价。
  function latRad(y, H) { return PI / 2 - y * PI / H; }
  function latDeg(y, H) { return 90 - y * 180 / H; }

  // 经度环绕：把网格 x 归一到 [0, W)。
  function wrapX(x, W) { return ((x % W) + W) % W; }

  // 网格步长（弧度）。
  function latStep(H) { return PI / H; }
  function lonStep(W) { return 2 * PI / W; }

  // 每网格单元对应的球面公里数（未钳制）。
  function rowKm(H, R) { return latStep(H) * R; }        // citysite.js: rowKm
  function colKmRaw(W, R) { return lonStep(W) * R; }     // urban.js: cellKm；citysite.js: lonStep*R

  // cos(纬度) 的钳制值：两个 profile 与原实现一一对应。
  function cosClamped(y, H, profile) {
    const c = M.cos(latRad(y, H));
    return profile === 'sphere' ? M.max(c, EPS) : M.max(c, 0.15);
  }

  // 每网格单元的公里尺度（指定 profile）。
  // local 等价于 urban.js 的 {kx, ky}；sphere 等价于 citysite.js 的 {colKm, rowKm}。
  function metrics(W, H, R, y, profile) {
    const lat = latRad(y, H), c = cosClamped(y, H, profile);
    return {
      latRad: lat,
      latDeg: latDeg(y, H),
      cosLat: M.cos(lat),
      rowKm: rowKm(H, R),
      colKm: lonStep(W) * R * c,
      cellKm: colKmRaw(W, R)
    };
  }

  // urban.js 局部投影尺度：kx = cellKm*max(0.15,cos(lat))，ky = cellKm。
  function localScale(W, H, R, y) {
    const cellKm = colKmRaw(W, R);
    return { kx: cellKm * M.max(0.15, M.cos(latRad(y, H))), ky: cellKm, cellKm };
  }

  // 网格 <-> 城市局部公里（urban profile，与 urban.js 的 toW 互逆）。
  function gridToLocalKm(x, y, cx, cy, W, H, R) {
    const s = localScale(W, H, R, cy);
    return { kmX: (x - cx) * s.kx, kmY: (y - cy) * s.ky };
  }
  function localKmToGrid(kmX, kmY, cx, cy, W, H, R) {
    const s = localScale(W, H, R, cy);
    return { x: cx + kmX / s.kx, y: cy + kmY / s.ky };
  }

  // 球面半径(公里) -> 网格范围，精确复现 citysite.js 的 geom()。
  function radiusExtent(radiusKm, y, W, H, R) {
    const lat = latRad(y, H), ang = radiusKm / R, ry = ang / latStep(H);
    const la = M.abs(lat) + ang >= PI / 2 ? PI : M.asin(M.min(1, M.sin(ang) / M.cos(lat)));
    const rx = M.min(W / 2, la / lonStep(W));
    return { ry, rx, rowKm: rowKm(H, R), colKm: lonStep(W) * R * M.max(M.cos(lat), EPS) };
  }

  // 城市配方空间适配器：P1 把城市细节绘入主画布时的统一接入点。
  // city: {x, y} 世界网格中心；world: {W, H, R}（R 亦可取 world.cfg.radius）。
  function recipeSpace(city, world) {
    const W = world.W, H = world.H, R = world.R || (world.cfg && world.cfg.radius);
    const cx = city.x, cy = city.y, s = localScale(W, H, R, cy);
    return {
      center: { x: cx, y: cy },
      kx: s.kx, ky: s.ky, cellKm: s.cellKm,
      latitudeDegrees: latDeg(cy, H),
      toWorld(kmX, kmY) { return { x: cx + kmX / s.kx, y: cy + kmY / s.ky }; },
      toLocal(x, y) { return { kmX: (x - cx) * s.kx, kmY: (y - cy) * s.ky }; },
      wrapX(x) { return wrapX(x, W); },
      radiusExtent(radiusKm) { return radiusExtent(radiusKm, cy, W, H, R); }
    };
  }

  G.WGS = {
    EPS,
    latRad, latDeg, wrapX, latStep, lonStep, rowKm, colKmRaw,
    cosClamped, metrics, localScale,
    gridToLocalKm, localKmToGrid, radiusExtent, recipeSpace
  };
})(typeof self !== 'undefined' ? self : this);
