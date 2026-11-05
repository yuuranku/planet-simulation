// Image interpretation is deliberately independent of the world simulation.
// It estimates a height field; colours in a drawing are not measured elevation.
(function (G) {
  'use strict';
  const SEA = 32768, MAX = 65535;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const blue = (r, g, b) => b > r + 13 && b >= g * .91 && g > r * .85 && b > 55;

  function validate(image, target) {
    const { width, height, bitDepth, data } = image || {}, { W, H } = target || {};
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 2 || height < 2 || width * height > 67108864 || ![8, 16].includes(bitDepth) || !data || data.length !== width * height * 4 || !(bitDepth === 16 ? data instanceof Uint16Array : data instanceof Uint8Array || data instanceof Uint8ClampedArray)) throw new Error('图片像素数据无效。');
    if (!Number.isInteger(W) || !Number.isInteger(H) || W !== H * 2 || H < 2 || W > 8192) throw new Error('世界高程网格无效。');
  }

  function describe(image) {
    const { width: w, height: h, data, bitDepth } = image, unit = bitDepth === 16 ? 257 : 1;
    let opaque = 0, gray = 0, white = 0, dark = 0, seas = 0, edgeBlue = 0, lo = MAX, hi = 0, alphaLo = MAX, alphaHi = 0;
    const edge = [], tones = new Uint8Array(256);
    let firstColor = null, varied = false;
    for (let i = 0; i < w * h; i++) {
      const k = i * 4, a = data[k + 3] / unit;
      alphaLo = Math.min(alphaLo, a); alphaHi = Math.max(alphaHi, a);
      if (a < 128) continue;
      const r = data[k] / unit, g = data[k + 1] / unit, b = data[k + 2] / unit;
      if (!firstColor) firstColor = [r, g, b];
      else if (r !== firstColor[0] || g !== firstColor[1] || b !== firstColor[2]) varied = true;
      opaque++; if (r === g && g === b) { gray++; tones[Math.round(r)] = 1; }
      lo = Math.min(lo, r, g, b); hi = Math.max(hi, r, g, b);
      if (Math.min(r, g, b) > 235) white++;
      if (Math.max(r, g, b) < 90) dark++;
      const water = blue(r, g, b); if (water) seas++;
      const x = i % w, y = (i / w) | 0;
      if (x === 0 || x === w - 1 || y === 0 || y === h - 1) {
        if (water) edgeBlue++;
        if (Math.max(r, g, b) - Math.min(r, g, b) < 65) edge.push([r, g, b]);
      }
    }
    if (!opaque || (!varied && alphaHi - alphaLo < 1)) throw new Error('这张图片没有可辨认的海陆或高低变化，请换一张有地图内容的图片。');
    let toneCount = 0; for (const used of tones) toneCount += used;
    const lineArt = bitDepth === 8 && (hi === lo || (toneCount <= 4 && opaque > 16) || (white > opaque * .70 && dark > opaque * .002 && dark < opaque * .22));
    const method = gray === opaque && !lineArt ? 'grayscale' : 'color-map';
    // Only infer paper as the sea when there is no clear coloured ocean at the edge.
    let paper = null;
    if (method === 'color-map' && alphaLo >= 128 && edge.length > (w + h) * .30 && edgeBlue < (w + h) * .02) {
      const channel = n => edge.map(c => c[n]).sort((a, b) => a - b)[edge.length >> 1];
      paper = [channel(0), channel(1), channel(2)];
    }
    return { method, paper, hasBlue: seas > opaque * .001, unit };
  }

  function sourceFields(image, description) {
    const { width: w, height: h, data } = image, { method, paper, hasBlue, unit } = description;
    const N = w * h, land = new Uint8Array(N), value = new Uint16Array(N);
    for (let i = 0; i < N; i++) {
      const k = i * 4, r = data[k] / unit, g = data[k + 1] / unit, b = data[k + 2] / unit;
      if (method === 'grayscale') {
        value[i] = data[k + 3] / unit < 128 ? 4096 : unit === 257 ? data[k] : data[k] * 257;
        land[i] = value[i] > SEA ? 1 : 0;
      } else {
        land[i] = data[k + 3] / unit >= 128 && !blue(r, g, b) ? 1 : 0;
        const low = Math.min(r, g, b), high = Math.max(r, g, b);
        let hint = .24;
        if (g > r + 8 && g > b) hint = .10 + .12 * (1 - g / 255);
        else if (r > g + 8 && g > b) hint = .28 + .42 * (r - b) / 255;
        else if (low > 200 && high - low < 24) hint = .72;
        else if (high - low < 35 && low > 85) hint = .27 + .24 * (low / 255);
        value[i] = Math.round(hint * MAX);
      }
    }
    if (paper) {
      // Flood only the exterior paper. Closed white outlines remain land.
      const visited = new Uint8Array(N), queue = new Uint32Array(N);
      let first = 0, last = 0;
      function visit(i) {
        if (visited[i]) return;
        visited[i] = 1;
        const k = i * 4;
        if (data[k + 3] / unit >= 128 && (Math.abs(data[k] / unit - paper[0]) > 28 || Math.abs(data[k + 1] / unit - paper[1]) > 28 || Math.abs(data[k + 2] / unit - paper[2]) > 28)) return;
        land[i] = 0; queue[last++] = i;
      }
      for (let x = 0; x < w; x++) { visit(x); visit((h - 1) * w + x); }
      for (let y = 1; y < h - 1; y++) { visit(y * w); visit(y * w + w - 1); }
      while (first < last) {
        const i = queue[first++], x = i % w;
        if (x) visit(i - 1); if (x + 1 < w) visit(i + 1);
        if (i >= w) visit(i - w); if (i + w < N) visit(i + w);
      }
    } else if (method === 'color-map' && hasBlue) {
      // Dark lettering over blue water is not an archipelago. Classify it from
      // the surrounding coloured pixels; dark text on land stays on land.
      for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        const i = y * w + x, k = i * 4;
        if (!land[i] || Math.max(data[k], data[k + 1], data[k + 2]) / unit > 75) continue;
        let water = 0, terrain = 0;
        for (let yy = Math.max(0, y - 2); yy <= Math.min(h - 1, y + 2); yy++) for (let xx = Math.max(0, x - 2); xx <= Math.min(w - 1, x + 2); xx++) {
          const s = (yy * w + xx) * 4, r = data[s] / unit, g = data[s + 1] / unit, b = data[s + 2] / unit;
          if (blue(r, g, b)) water++; else if (Math.max(r, g, b) > 100) terrain++;
        }
        if (water > 0 && water > terrain * 2) land[i] = 0;
      }
    }
    return { land, value };
  }

  function fit(image, target, source) {
    const { width: w, height: h } = image, { W, H } = target, scale = Math.min(W / w, H / h);
    const rw = Math.max(1, Math.round(w * scale)), rh = Math.max(1, Math.round(h * scale));
    const x0 = Math.floor((W - rw) / 2), y0 = Math.floor((H - rh) / 2);
    const land = new Uint8Array(W * H), value = new Uint16Array(W * H).fill(4096);
    const upscale = scale >= 1;
    for (let y = 0; y < rh; y++) for (let x = 0; x < rw; x++) {
      const d = (y + y0) * W + x + x0;
      if (upscale) {
        const sx = Math.min(w - 1, Math.floor((x + .5) * w / rw)), sy = Math.min(h - 1, Math.floor((y + .5) * h / rh)), s = sy * w + sx;
        land[d] = source.land[s]; value[d] = source.value[s];
      } else {
        const left = x * w / rw, right = (x + 1) * w / rw, top = y * h / rh, bottom = (y + 1) * h / rh;
        let on = 0, off = 0, onValue = 0, offValue = 0, isolatedLand = -1, isolatedWater = -1;
        for (let sy = Math.floor(top); sy < Math.ceil(bottom); sy++) for (let sx = Math.floor(left); sx < Math.ceil(right); sx++) {
          const s = sy * w + sx, weight = (Math.min(right, sx + 1) - Math.max(left, sx)) * (Math.min(bottom, sy + 1) - Math.max(top, sy));
          if (source.land[s]) { on += weight; onValue += source.value[s] * weight; } else { off += weight; offValue += source.value[s] * weight; }
          // A source-pixel island or lake must not disappear in an averaging box.
          if (sx && sx + 1 < w && sy && sy + 1 < h && source.land[s - 1] !== source.land[s] && source.land[s + 1] !== source.land[s] && source.land[s - w] !== source.land[s] && source.land[s + w] !== source.land[s]) {
            if (source.land[s]) isolatedLand = source.value[s]; else isolatedWater = source.value[s];
          }
        }
        let selected = on >= off;
        if (isolatedLand >= 0 && isolatedWater < 0) selected = true;
        else if (isolatedWater >= 0 && isolatedLand < 0) selected = false;
        land[d] = selected ? 1 : 0;
        value[d] = Math.round(selected ? onValue / on : offValue / off);
      }
    }
    return { land, value, sourceRect: { x0: x0 / W, y0: y0 / H, x1: (x0 + rw) / W, y1: (y0 + rh) / H } };
  }

  function distances(mask, W, H, category) {
    // 可分离的欧氏距离变换。四邻域步数会把斜岸的坡面与海底扩成菱形台阶。
    // 每个像素只参与两次线性扫描；保留完整网格，不用降低分辨率换取平滑。
    const d = new Float32Array(mask.length), size = Math.max(W, H), far = W * W + H * H;
    const f = new Float64Array(size), v = new Int32Array(size), z = new Float64Array(size + 1);
    function line(n, offset, stride, root) {
      let k = 0; v[0] = 0; z[0] = -Infinity; z[1] = Infinity;
      for (let q = 1; q < n; q++) {
        let s;
        do {
          const p = v[k]; s = ((f[q] + q * q) - (f[p] + p * p)) / (2 * (q - p));
          if (s > z[k]) break;
          k--;
        } while (k >= 0);
        v[++k] = q; z[k] = s; z[k + 1] = Infinity;
      }
      k = 0;
      for (let q = 0; q < n; q++) {
        while (z[k + 1] < q) k++;
        const delta = q - v[k], squared = delta * delta + f[v[k]];
        d[offset + q * stride] = root ? Math.sqrt(squared) : squared;
      }
    }
    for (let x = 0; x < W; x++) {
      for (let y = 0; y < H; y++) f[y] = mask[y * W + x] === category ? far : 0;
      line(H, x, W, false);
    }
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) f[x] = d[y * W + x];
      line(W, y * W, 1, true);
    }
    return d;
  }

  function smoothHints(value, land, W, H) {
    const radius = Math.max(1, Math.round(H / 180)), sums = new Float32Array(value.length), weights = new Uint16Array(value.length);
    for (let y = 0; y < H; y++) {
      let sum = 0, count = 0;
      for (let x = -radius; x < W; x++) {
        const add = x + radius, remove = x - radius - 1;
        if (add < W) { const i = y * W + add; if (land[i]) { sum += value[i]; count++; } }
        if (remove >= 0) { const i = y * W + remove; if (land[i]) { sum -= value[i]; count--; } }
        if (x >= 0) { sums[y * W + x] = sum; weights[y * W + x] = count; }
      }
    }
    for (let x = 0; x < W; x++) {
      let sum = 0, count = 0;
      for (let y = -radius; y < H; y++) {
        const add = y + radius, remove = y - radius - 1;
        if (add < H) { const i = add * W + x; sum += sums[i]; count += weights[i]; }
        if (remove >= 0) { const i = remove * W + x; sum -= sums[i]; count -= weights[i]; }
        if (y >= 0 && land[y * W + x]) value[y * W + x] = Math.round(sum / Math.max(1, count));
      }
    }
  }

  function convert(image, target) {
    validate(image, target);
    const description = describe(image), source = sourceFields(image, description), { W, H } = target;
    const { land, value, sourceRect } = fit(image, target, source);
    let count = 0; for (const on of land) count += on;
    if (!count || count === W * H) throw new Error('未能从图片中区分海陆，请使用海陆轮廓清楚的地图图片。');
    const gray = description.method === 'grayscale' ? value : new Uint16Array(W * H);
    if (description.method === 'color-map') {
      smoothHints(value, land, W, H);
      const inland = distances(land, W, H, 1), offshore = distances(land, W, H, 0);
      for (let i = 0; i < gray.length; i++) {
        if (land[i]) {
          const coast = 1 - Math.exp(-inland[i] / Math.max(1, H * .018)), interior = 1 - Math.exp(-inland[i] / Math.max(1, H * .085));
          const elevation = 25 + coast * (140 + 2500 * interior + 2700 * (value[i] / MAX) ** 1.6);
          gray[i] = SEA + Math.round(clamp(elevation / 6000, 1 / 32767, 1) * 32767);
        } else {
          const depth = 120 + 5200 * (1 - Math.exp(-offshore[i] / Math.max(1, H * .07)));
          gray[i] = SEA - Math.round(depth / 6000 * SEA);
        }
      }
    }
    return { width: W, height: H, gray, seaGray: SEA, minElevation: -6000, maxElevation: 6000, method: description.method, landFraction: count / (W * H), sourceRect };
  }
  G.ImageHeightmap = { convert };
})(typeof self !== 'undefined' ? self : globalThis);
