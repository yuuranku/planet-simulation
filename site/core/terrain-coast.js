/* 导入图的海岸重建：改实际高程，所有水文、道路、等高线共用同一岸线。 */
(function (G) {
  'use strict';
  function adjacent(i, W, H, visit) {
    const x = i % W, y = (i / W) | 0;
    visit(y * W + (x + W - 1) % W); visit(y * W + (x + 1) % W);
    if (y) visit(i - W); if (y + 1 < H) visit(i + W);
  }
  function components(mask, W, H) {
    const labels = new Int32Array(mask.length).fill(-1), queue = new Int32Array(mask.length), areas = [];
    for (let s = 0; s < mask.length; s++) {
      if (labels[s] >= 0) continue;
      const id = areas.length; let end = 1; queue[0] = s; labels[s] = id;
      for (let head = 0; head < end; head++) adjacent(queue[head], W, H, j => { if (labels[j] < 0 && mask[j] === mask[s]) { labels[j] = id; queue[end++] = j; } });
      areas.push(end);
    }
    return { labels, areas };
  }
  // 八邻域岸距只用于原像素附近的窄带；经度环绕，不使用曼哈顿菱形距离。
  function distance(mask, W, H, category) {
    const out = new Float32Array(mask.length);
    for (let i = 0; i < out.length; i++) out[i] = mask[i] === category ? 0 : 1e8;
    for (let pass = 0; pass < 2; pass++) for (let row = 0; row < H; row++) {
      const y = pass ? H - 1 - row : row, yy = y + (pass ? 1 : -1), r = y * W;
      if (yy >= 0 && yy < H) for (let x = 0; x < W; x++) {
        const q = yy * W, left = (x + W - 1) % W, right = (x + 1) % W;
        out[r + x] = Math.min(out[r + x], out[q + x] + 1, out[q + left] + Math.SQRT2, out[q + right] + Math.SQRT2);
      }
      for (let col = 1; col < W * 2; col++) { const x = col % W, prev = (col - 1) % W; out[r + x] = Math.min(out[r + x], out[r + prev] + 1); }
      for (let col = W * 2 - 2; col >= 0; col--) { const x = col % W, next = (col + 1) % W; out[r + x] = Math.min(out[r + x], out[r + next] + 1); }
    }
    return out;
  }
  function blur(field, W, H, radius) {
    const horizontal = new Float32Array(field.length), out = new Float32Array(field.length), span = radius * 2 + 1;
    for (let y = 0; y < H; y++) {
      const row = y * W; let sum = 0;
      for (let x = -radius; x <= radius; x++) sum += field[row + (x + W) % W];
      for (let x = 0; x < W; x++) { horizontal[row + x] = sum / span; sum += field[row + (x + radius + 1) % W] - field[row + (x - radius + W) % W]; }
    }
    for (let x = 0; x < W; x++) {
      let sum = 0; for (let y = -radius; y <= radius; y++) sum += horizontal[Math.max(0, Math.min(H - 1, y)) * W + x];
      for (let y = 0; y < H; y++) { out[y * W + x] = sum / span; sum += horizontal[Math.min(H - 1, y + radius + 1) * W + x] - horizontal[Math.max(0, y - radius) * W + x]; }
    }
    return out;
  }
  // 只翻转数字拓扑的“简单点”：陆和水的局部四邻域都必须仍为单连通。
  // 它允许沿阶梯拐角削补，但不消掉孤岛、不切地峡、不封海峡或湖口。
  function simple(mask, i, W, H, visited, queue) {
    const x = i % W, y = (i / W) | 0;
    if (y === 0 || y === H - 1) return false;
    for (const category of [0, 1]) {
      visited.fill(0); let groups = 0;
      for (let p = 0; p < 9; p++) {
        if (p === 4 || visited[p]) continue;
        const cell = (y - 1 + ((p / 3) | 0)) * W + (x - 1 + p % 3 + W) % W;
        if (mask[cell] !== category) continue;
        if (++groups > 1) return false;
        let end = 1; queue[0] = p; visited[p] = 1;
        for (let head = 0; head < end; head++) {
          const a = queue[head], ax = a % 3, ay = (a / 3) | 0;
          for (const b of [ax ? a - 1 : -1, ax < 2 ? a + 1 : -1, ay ? a - 3 : -1, ay < 2 ? a + 3 : -1]) {
            if (b < 0 || b === 4 || visited[b]) continue;
            const j = (y - 1 + ((b / 3) | 0)) * W + (x - 1 + b % 3 + W) % W;
            if (mask[j] === category) { visited[b] = 1; queue[end++] = b; }
          }
        }
      }
      if (groups !== 1) return false;
    }
    return true;
  }
  function reconstruct(elev, W, H, manifest, hardLock, seed = 0) {
    if (manifest.intervention === 0) return { changedCells: 0, maxShift: 0 };
    let footprint = Math.max(W / manifest.width, H / manifest.height);
    if (manifest.source && manifest.processing) {
      const rect = manifest.processing.sourceRect;
      footprint = Math.max(footprint, (rect.x1 - rect.x0) * W / manifest.source.width, (rect.y1 - rect.y0) * H / manifest.source.height);
    }
    const strength = manifest.intervention / 100, radius = Math.max(1, Math.min(64, Math.ceil(footprint * .65)));
    const maxShift = Math.max(.45, footprint * .45) * strength, band = radius * 3 + 1;
    const mask = Uint8Array.from(elev, value => value > 0 ? 1 : 0), water = distance(mask, W, H, 0), land = distance(mask, W, H, 1);
    const signed = Float32Array.from(mask, (value, i) => value ? water[i] - .5 : -(land[i] - .5));
    const smoothed = blur(blur(signed, W, H, radius), W, H, radius), target = new Float32Array(elev.length), candidates = [];
    const { labels, areas: originalAreas } = components(mask, W, H), areas = originalAreas.slice();
    const noise = G.Noise.simplex3((seed >>> 0) ^ 0x73b91c), scale = W / (2 * Math.PI * footprint), amplitude = footprint * .12 * strength ** 2;
    const cx = new Float32Array(W), sx = new Float32Array(W), cy = new Float32Array(H), sy = new Float32Array(H);
    for (let x = 0; x < W; x++) { const a = (x + .5) / W * Math.PI * 2; cx[x] = Math.cos(a); sx[x] = Math.sin(a); }
    for (let y = 0; y < H; y++) { const a = (.5 - (y + .5) / H) * Math.PI; cy[y] = Math.cos(a); sy[y] = Math.sin(a); }
    for (let i = 0; i < elev.length; i++) {
      const d = signed[i]; target[i] = d;
      if (hardLock[i] || Math.abs(d) >= band) continue;
      const fade = Math.max(0, 1 - Math.abs(d) / band), x = i % W, y = (i / W) | 0;
      const px = cy[y] * cx[x] * scale, py = cy[y] * sx[x] * scale, pz = sy[y] * scale;
      // 长直像素岸加入低幅、连续的小湾岬；波长以原图像素为尺度，球面无接缝。
      const cape = amplitude * (noise(px * .2, py * .2, pz * .2) * .85 + noise(px * .6 + 17, py * .6, pz * .6) * .15);
      const shift = Math.max(-maxShift, Math.min(maxShift, ((smoothed[i] - d) * strength + cape) * fade));
      target[i] = d + shift;
      if (!hardLock[i] && (target[i] > 0) !== !!mask[i]) candidates.push(i);
    }
    candidates.sort((a, b) => Math.abs(target[b]) - Math.abs(target[a]) || a - b);
    const visited = new Uint8Array(9), queue = new Int8Array(9); let changedCells = 0;
    // 先处理更确定的岸角，再给相邻岸格一次机会；不迭代到轮廓无限收缩。
    for (let pass = 0; pass < 2; pass++) for (const i of candidates) {
      const wanted = target[i] > 0 ? 1 : 0;
      if (mask[i] === wanted || !simple(mask, i, W, H, visited, queue)) continue;
      const old = labels[i]; let next = -1;
      adjacent(i, W, H, j => { if (mask[j] === wanted) next = labels[j]; });
      if (next < 0 || areas[old] <= Math.ceil(originalAreas[old] * .8)) continue;
      areas[old]--; areas[next]++; labels[i] = next; mask[i] = wanted; changedCells++;
    }
    for (let i = 0; i < elev.length; i++) {
      if (hardLock[i] || Math.abs(signed[i]) >= band || target[i] === signed[i]) continue;
      const d = target[i];
      if ((d > 0) !== !!mask[i]) continue; // 被拓扑拒绝的细水道/地峡保留原岸坡宽度。
      const originalMagnitude = Math.max(.5, Math.abs(elev[i]));
      const magnitude = Math.max(.01, Math.min(originalMagnitude, originalMagnitude * Math.abs(d / signed[i])));
      elev[i] = mask[i] ? magnitude : -magnitude;
    }
    return { changedCells, maxShift, sourcePixelFootprint: footprint };
  }
  G.TerrainCoast = { reconstruct };
})(typeof self !== 'undefined' ? self : this);
