/* 灰度高程输入 → 米制地形；普通图片先自动估算为高度图。 */
(function (G) {
  'use strict';
  const VERSION = 1;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const fail = message => { throw new Error(message); };
  function number(v, name, lo, hi) {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < lo || v > hi) fail(`${name}须在 ${lo}–${hi} 之间。`);
    return v;
  }
  function asset(value, original = false) {
    const mimes = original ? ['image/png', 'image/jpeg', 'image/webp', 'image/bmp'] : ['image/png'];
    if (!value || !/^[a-f0-9]{64}$/.test(value.hash) || !mimes.includes(value.mime) || !Number.isInteger(value.byteLength) || value.byteLength < (original ? 1 : 33) || value.byteLength > 134217728) fail('地图图片资源清单无效。');
    return { hash: value.hash, name: String(value.name || 'map.png').slice(0, 240), mime: value.mime, byteLength: value.byteLength };
  }
  function rectangle(value, name) {
    if (!value || typeof value !== 'object') fail(`${name}无效。`);
    const out = {}; for (const key of ['x0', 'y0', 'x1', 'y1']) out[key] = number(value[key], `${name}坐标`, 0, 1);
    if (out.x0 >= out.x1 || out.y0 >= out.y1) fail(`${name}的终点必须位于起点右下方。`);
    return out;
  }
  function validateInput(value) {
    if (!value || value.version !== VERSION) fail('地图输入版本无效。');
    if (value.kind !== 'heightmap-png') fail('地图生成需要处理完成的灰度高度图。');
    const a = asset(value.asset);
    const width = number(value.width, '图片宽度', 4, 8192), height = number(value.height, '图片高度', 2, 4096);
    if (!Number.isInteger(width) || !Number.isInteger(height) || width !== height * 2 || value.projection !== 'equirectangular') fail('全球地图必须是等距圆柱投影、宽高比 2:1；请先明确裁切或补图，不能拉伸。');
    if (![8, 16].includes(value.bitDepth)) fail('高度图支持 8/16 位原样本。');
    const out = { version: VERSION, kind: value.kind, bitDepth: value.bitDepth, asset: a, width, height, projection: 'equirectangular', intervention: number(value.intervention, '介入程度', 0, 100) };
    if (value.source !== undefined || value.processing !== undefined) {
      const source = value.source, processing = value.processing;
      if (!source || !processing || !['grayscale', 'color-map'].includes(processing.method)) fail('原图和高程处理记录须同时保存。');
      const sw = number(source.width, '原图宽度', 1, 32768), sh = number(source.height, '原图高度', 1, 32768);
      if (!Number.isInteger(sw) || !Number.isInteger(sh) || sw * sh > 134217728) fail('原图尺寸或像素数量无效。');
      out.source = { asset: asset(source.asset, true), width: sw, height: sh };
      out.processing = { method: processing.method, sourceRect: rectangle(processing.sourceRect, '原图范围') };
    }
    for (const key of ['protectCoast', 'protectIslands', 'protectLakes']) { if (typeof value[key] !== 'boolean') fail('请确认海岸、岛屿及湖泊的保护设置。'); out[key] = value[key]; }
    const regions = value.regions || [];
    if (!Array.isArray(regions) || regions.length > 64) fail('保护区域最多为 64 个。');
    out.regions = regions.map(r => rectangle(r, '保护区域'));
    out.seaGray = number(value.seaGray, '海平面灰值', 1, 2 ** out.bitDepth - 2);
    out.minElevation = number(value.minElevation, '最低高程', -30000, -0.01);
    out.maxElevation = number(value.maxElevation, '最高高程', 0.01, 30000);
    if (typeof value.invert !== 'boolean') fail('高度图亮暗与高低的关系无效。');
    out.invert = value.invert;
    return out;
  }

  // 只检查 PNG 容器信息；像素解码交给保留原样本的 fast-png。
  function inspectPNG(bytes) {
    if (!(bytes instanceof Uint8Array) || bytes.length < 33) fail('PNG 文件不完整。');
    const sig = [137,80,78,71,13,10,26,10];
    if (!sig.every((b, i) => bytes[i] === b)) fail('请选择 PNG 图片。');
    const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (v.getUint32(8) !== 13 || String.fromCharCode(...bytes.subarray(12, 16)) !== 'IHDR') fail('PNG 图片头无效。');
    const width = v.getUint32(16), height = v.getUint32(20), bitDepth = bytes[24], colorType = bytes[25];
    if (![8,16].includes(bitDepth) || ![0,2,3,4,6].includes(colorType)) fail('此入口接受 8 位或 16 位 PNG；请显式转换低位深索引图。');
    if (width < 4 || height < 2 || width > 8192 || height > 4096 || width !== height * 2) fail('全球图须为 2:1 等距圆柱图（最大 8192×4096）；请明确裁切或补图后重试，不会自动拉伸。');
    const profiles = [];
    let offset = 8, ended = false;
    while (offset + 12 <= bytes.length) {
      const size = v.getUint32(offset), type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
      if (size > bytes.length - offset - 12) fail('PNG 数据块不完整。');
      if (['iCCP', 'cHRM', 'gAMA', 'cICP', 'mDCV', 'cLLI'].includes(type)) profiles.push(type);
      if (type === 'acTL') fail('请使用静态 PNG；动画帧不能作为唯一地形输入。');
      offset += size + 12;
      if (type === 'IEND') { ended = true; break; }
    }
    if (!ended) fail('PNG 缺少文件结束标记。');
    return { width, height, bitDepth, colorType, profiles };
  }

  function decodePixels(rgba, input) {
    const m = validateInput(input), N = m.width * m.height;
    if (!rgba || rgba.length !== N * 4) fail('图片像素数量与资源清单不一致。');
    const data = m.bitDepth === 16 ? new Uint16Array(N) : new Uint8Array(N), max = 2 ** m.bitDepth - 1;
    for (let i = 0; i < N; i++) {
      const k = i * 4, r = rgba[k], g = rgba[k + 1], b = rgba[k + 2], pos = `(${i % m.width + 1}, ${Math.floor(i / m.width) + 1})`;
      if (rgba[k + 3] !== max) fail(`高程像素 ${pos} 含透明度，图片处理结果无效。`);
      if (r !== g || g !== b) fail(`像素 ${pos} 不是灰度，请先完成图片高程处理。`);
      data[i] = r;
    }
    return { width: m.width, height: m.height, gray: data };
  }
  function grayElevation(gray, m) {
    const max = 2 ** m.bitDepth - 1, value = m.invert ? max - gray : gray, sea = m.invert ? max - m.seaGray : m.seaGray;
    if (value === sea) return 0;
    return value <= sea ? m.minElevation * (sea - value) / sea : m.maxElevation * (value - sea) / (max - sea);
  }
  function neighbors(i, W, H, visit) {
    const y = Math.floor(i / W), x = i % W;
    visit(y * W + (x + 1) % W); visit(y * W + (x + W - 1) % W);
    if (y) visit(i - W); if (y < H - 1) visit(i + W);
  }
  function components(elev, W, H, land, visit) {
    const seen = new Uint8Array(elev.length), queue = new Int32Array(elev.length);
    for (let s = 0; s < elev.length; s++) {
      if (seen[s] || (elev[s] > 0) !== land) continue;
      let end = 1; queue[0] = s; seen[s] = 1;
      for (let head = 0; head < end; head++) neighbors(queue[head], W, H, j => { if (!seen[j] && (elev[j] > 0) === land) { seen[j] = 1; queue[end++] = j; } });
      visit(queue.subarray(0, end));
    }
  }
  function prepareGrid(cfg, raster) {
    const m = validateInput(cfg.terrainInput), { W, H } = cfg;
    if (!raster || raster.width !== m.width || raster.height !== m.height) fail('缺少地图原始像素，或像素尺寸与清单不符。');
    if (!Number.isInteger(W) || !Number.isInteger(H) || W !== H * 2) fail('推演网格必须为 2:1。');
    if (m.width > W || m.height > H) fail(`源图 ${m.width}×${m.height} 超过当前物理网格 ${W}×${H}；请选择更大的星球网格或自行明确降采样，系统不会静默丢弃小岛细节。`);
    const pixels = raster.gray;
    if (!(pixels instanceof (m.bitDepth === 16 ? Uint16Array : Uint8Array)) || pixels.length !== m.width * m.height) fail('地图像素格式或原样本位深无效。');
    const elev = new Float32Array(W * H), lock = new Uint8Array(W * H), lakes = new Uint8Array(W * H);
    // 像素足迹重采样，保持海陆类别和小岛；不宣称恢复输入中没有的高程细节。
    let landCells = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const v = pixels[Math.min(m.height - 1, Math.floor((y + 0.5) * m.height / H)) * m.width + Math.min(m.width - 1, Math.floor((x + 0.5) * m.width / W))];
      elev[y * W + x] = grayElevation(v, m);
      if (elev[y * W + x] > 0) landCells++;
    }
    if (!landCells) fail('当前海平面淹没了全部陆地，请降低海平面后再生成。');
    if (landCells === elev.length) fail('当前海平面使地图全是陆地，请提高海平面后再生成。');
    // 用户明确画出的保护区固定原高程；自动海岸保护锁定的是重建后的连续岸坡。
    for (const r of m.regions) for (let y = Math.floor(r.y0 * H); y < Math.ceil(r.y1 * H); y++) for (let x = Math.floor(r.x0 * W); x < Math.ceil(r.x1 * W); x++) lock[y * W + x] = 1;
    const coast = G.TerrainCoast.reconstruct(elev, W, H, m, lock, cfg.seed);
    if (m.intervention === 0) lock.fill(1);
    if (m.protectCoast) for (let i = 0; i < elev.length; i++) neighbors(i, W, H, j => { if ((elev[i] > 0) !== (elev[j] > 0)) { lock[i] = 1; lock[j] = 1; } });
    if (m.protectIslands) components(elev, W, H, true, cells => { if (cells.length <= Math.max(8, elev.length * 0.0012)) for (const i of cells) lock[i] = 1; });
    let mainSea = -1, seaSize = 0;
    components(elev, W, H, false, cells => { if (cells.length > seaSize) { mainSea = cells[0]; seaSize = cells.length; } });
    components(elev, W, H, false, cells => {
      if (cells[0] === mainSea) return;
      for (const i of cells) { lakes[i] = 1; if (m.protectLakes) { lock[i] = 1; neighbors(i, W, H, j => { lock[j] = 1; }); } }
    });
    return { manifest: m, elev, lock, lakes, coast };
  }
  function bind(P) { if (P.terrainImport) G.Noise.bindTerrain(P.elev, P.terrainImport); }
  function build(cfg, raster, progress = () => {}) {
    progress('校准图纸地形', 0.02);
    const base = prepareGrid(cfg, raster), m = base.manifest, { W, H } = cfg, F = G.Planet.grid(W, H), cW = Math.min(W, 544), cH = cW / 2, C = G.Planet.grid(cW, cH);
    const elev = Float32Array.from(base.elev), strength = m.intervention / 100;
    let tectonic = null;
    // 轻修仍直接使用图纸；构造从 25% 起连续增强，避免半程之前几乎没有变化。
    const geology = Math.max(0, (strength - 0.25) / 0.75);
    if (geology > 0) tectonic = G.Planet.hypotheticalTectonics(cfg, base.elev, progress);
    if (strength > 0) {
      progress('图纸地势重塑', 0.32);
      const reshape = strength ** 2.5, limit = 80 * strength + 11000 * reshape;
      // 保护边缘逐步过渡到重塑地形，不能沿保护矩形或旧海岸切出一圈峭壁。
      const band = Math.max(2, Math.ceil(W / 272)), distance = new Uint8Array(elev.length).fill(255), queue = new Int32Array(elev.length);
      let end = 0;
      for (let i = 0; i < elev.length; i++) if (base.lock[i]) { distance[i] = 0; queue[end++] = i; }
      for (let head = 0; head < end; head++) {
        const i = queue[head]; if (distance[i] >= band) continue;
        neighbors(i, W, H, j => { if (distance[j] === 255) { distance[j] = distance[i] + 1; queue[end++] = j; } });
      }
      const influence = i => { const t = Math.min(1, distance[i] / band); return t * t * (3 - 2 * t); };
      const passes = Math.ceil(strength * 4);
      for (let pass = 0; pass < passes; pass++) {
        const smoothing = 0.22 * strength * Math.min(1, strength * 4 - pass);
        const next = Float32Array.from(elev);
        for (let i = 0; i < elev.length; i++) {
          if (base.lock[i]) continue;
          let sum = 0, n = 0; neighbors(i, W, H, j => { sum += elev[j]; n++; });
          const reach = influence(i);
          next[i] = clamp(elev[i] + (sum / n - elev[i]) * smoothing * reach, base.elev[i] - limit * reach, base.elev[i] + limit * reach);
        }
        elev.set(next);
      }
      // 图纸给出陆块与原有高低关系，板块给出山带和裂谷；高档同时释放低地，
      // 而不是在原图的整片高原上继续堆高。全程不混入另一张随机大陆图。
      const uplift = tectonic && G.Planet.upsample(tectonic.uplift, cW, cH, W, H);
      const noise = G.Noise.simplex3(cfg.seed ^ 0x4892e3), ridge = G.Noise.simplex3(cfg.seed + 21), basin = G.Noise.simplex3(cfg.seed + 17);
      const plateGain = 1.6 * geology ** 1.25;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x; if (base.lock[i]) continue;
        const px = F.cosLat[y] * F.cosLon[x], py = F.cosLat[y] * F.sinLon[x], pz = F.sinLat[y], reach = influence(i);
        let delta = 0;
        if (base.elev[i] > 0) {
          const broad = G.Noise.fbm3(basin, px * 3.2, py * 3.2, pz * 3.2, 3);
          const lowland = 70 + base.elev[i] * 0.18 + 500 * broad;
          delta += (lowland - base.elev[i]) * reshape;
        }
        if (uplift) {
          const u = uplift[i], relief = Math.min(1, Math.abs(u) / 1800);
          const detail = relief > 0.0005 ? G.Noise.ridged3(ridge, px * 7, py * 7, pz * 7, 4) : 0.5;
          delta += u * plateGain * (1 + (detail - 0.5) * 1.05 * relief);
        }
        delta += (120 * strength ** 2 + 300 * reshape) * G.Noise.fbm3(noise, px * 24, py * 24, pz * 24, 4);
        elev[i] = clamp(elev[i] + delta * reach, base.elev[i] - limit * reach, base.elev[i] + limit * reach);
      }
      if (geology > 0) G.Planet.erodeConstrained(elev, W, H, Math.floor(Math.min(560000, W * H * 0.17) * geology), G.Noise.mulberry32(cfg.seed + 99), f => progress('受约束水力侵蚀', 0.4 + f * 0.12), base.lock);
      for (let i = 0; i < elev.length; i++) {
        const reach = influence(i), lo = base.elev[i] - limit * reach, hi = base.elev[i] + limit * reach;
        // 极端图纸值也渐进收敛；低档不能因绝对限高突然削掉原有高山。
        const bounded = clamp(elev[i], -14000, 12000);
        elev[i] = base.lock[i] ? base.elev[i] : clamp(elev[i] + (bounded - elev[i]) * reshape * reach, lo, hi);
      }
    }
    let maxE = -Infinity, minE = Infinity;
    for (const v of elev) { maxE = Math.max(maxE, v); minE = Math.min(minE, v); }
    // 未保护区域的隆升可能改变水域连通关系；后续水文读取最终地形的水域类别。
    if (strength > 0) {
      let mainSea = -1, largest = 0;
      components(elev, W, H, false, cells => { if (cells.length > largest) { mainSea = cells[0]; largest = cells.length; } });
      base.lakes.fill(0);
      components(elev, W, H, false, cells => { if (cells[0] !== mainSea) for (const i of cells) base.lakes[i] = 1; });
    }
    const P = { W, H, F, C, cW, cH, elev, maxE, minE, plate: tectonic ? tectonic.plate : new Int16Array(cW * cH).fill(-1), crust: tectonic ? tectonic.crust : new Float32Array(cW * cH), coreOf: new Uint8Array(cW * cH), cores: [], plates: tectonic ? tectonic.plates : [], polar: { N: 'imported', S: 'imported' }, newWorld: false, bSegs: tectonic ? tectonic.bSegs : [new Float32Array(), new Float32Array(), new Float32Array()], bMarks: tectonic ? tectonic.bMarks : new Float32Array(), volcanoes: [], upsample: G.Planet.upsample, downsample: G.Planet.downsample,
      terrainImport: { version: VERSION, sourceHash: m.source ? m.source.asset.hash : m.asset.hash, heightmapHash: m.asset.hash, intervention: m.intervention, geology: tectonic ? 'hypothetical' : 'not-generated', elevationSource: m.processing ? `estimated-${m.processing.method}` : `calibrated-${m.bitDepth}bit`, lock: base.lock, lakes: base.lakes, coast: base.coast, protectLakes: m.protectLakes, faithful: m.intervention === 0 } };
    bind(P);
    progress('图纸地形完成', 0.52);
    return P;
  }
  G.TerrainImport = { VERSION, validateInput, inspectPNG, decodePixels, grayElevation, prepareGrid, build, bind };
})(typeof self !== 'undefined' ? self : this);
