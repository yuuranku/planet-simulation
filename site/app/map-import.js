/* 普通图片先自动转换为高度图；原图和推演输入分别保存。 */
(function (G) {
  'use strict';
  const drafts = new WeakMap();
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const seaPercent = m => m.seaGray * 100 / (2 ** m.bitDepth - 1);
  const meters = value => `${Math.round(value).toLocaleString('zh-CN')} 米`;
  function landCount(d, m) {
    if (!d.gray) return null;
    if (d.histogramGray !== d.gray) {
      const histogram = new Uint32Array(2 ** m.bitDepth + 1);
      for (const value of d.gray) histogram[value + 1]++;
      for (let i = 1; i < histogram.length; i++) histogram[i] += histogram[i - 1];
      d.histogram = histogram; d.histogramGray = d.gray;
    }
    return m.invert ? d.histogram[Math.ceil(m.seaGray)] : d.gray.length - d.histogram[Math.floor(m.seaGray) + 1];
  }
  function state(st) {
    let d = drafts.get(st);
    if (!d) { d = { input: st.terrainInput || null, gray: null, pending: false, failed: false, message: '', serial: 0 }; drafts.set(st, d); }
    return d;
  }
  function level(value) {
    if (value === 0) return '保留图纸：按调整后的海陆与高程生成。';
    if (value <= 25) return '轻度修整：细修岸线，平滑地形，补充小范围起伏。';
    if (value <= 50) return '地理补全：逐步加入造山与盆地。';
    if (value < 100) return '强化自然过程：明显重塑山脉、盆地，加入侵蚀。';
    return '深度重塑山脉与盆地，消除岸线的像素台阶；保留大陆轮廓、小岛与水道，也可形成新湖。';
  }
  function html(st) {
    const d = state(st), m = d.input, accept = 'image/png,image/jpeg,image/webp,image/bmp,.png,.jpg,.jpeg,.webp,.bmp';
    const slider = (key, label, min, max, step, value, out, note, outAttr) => `<div class="mi-slider"><label><span>${label}</span><input data-map-key="${key}" type="range" min="${min}" max="${max}" step="${step}" value="${value}"><b ${outAttr}>${out}</b></label><small${key === 'intervention' ? ' data-map-level' : ''}>${note}</small></div>`;
    return `<div class="q mi-wrap" data-map-import aria-busy="${d.pending}">
      <label class="mi-drop${m ? ' has' : ''}${d.pending ? ' busy' : ''}"><input data-map-file type="file" accept="${accept}" aria-label="${m || d.pending ? '更换世界地图图片' : '上传世界地图图片'}">
        <svg viewBox="0 0 48 48"><rect x="6" y="10" width="36" height="28" rx="4"/><path d="M6 32l10-10 8 7 6-5 12 9"/><circle cx="33" cy="18" r="3"/></svg>
        <span><b>${d.pending ? '正在处理图片…' : m ? '更换图片' : '选择或拖入一张世界地图'}</b><small>PNG、JPG、WebP、BMP · 彩色地图或灰度高度图都可以 · 宽幅（2:1）效果最好</small></span>
      </label>
      <p data-map-message role="status" aria-live="polite" class="mi-msg${d.failed ? ' bad' : ''}">${esc(d.message || (m ? '已处理：可以继续设置世界。' : ''))}</p>
      ${m ? `<div data-map-ready>
        <p class="mi-file">${esc((m.source?.asset || m.asset).name)}</p>
        <div class="mi-previews"><figure><canvas data-map-preview width="512" height="256"></canvas><figcaption>地形预览</figcaption></figure><figure><canvas data-map-gray-preview width="512" height="256"></canvas><figcaption>自动高度图 · 越亮越高</figcaption></figure></div>
        <p data-map-coverage role="status" aria-live="polite" class="mi-cov">正在更新地形预览…</p>
        <div class="mi-group"><h6>海陆与高程</h6>
        ${slider('seaGray', '海平面', 0, 100, 0.1, seaPercent(m).toFixed(1), seaPercent(m).toFixed(1) + '%', '调高会淹没低地、扩大海与湖；调低会露出陆地。', 'data-map-sea-value')}
        ${slider('maxElevation', '地形起伏', 500, 12000, 100, m.maxElevation, meters(m.maxElevation), '图纸高程的最高值，海底同比调整；算法介入后仍可能继续造山。', 'data-map-height-value')}</div>
        <div class="mi-group"><h6>算法介入</h6>
        ${slider('intervention', '介入程度', 0, 100, 1, m.intervention, m.intervention, level(m.intervention), 'data-map-value')}</div>
        <p class="mi-foot">彩色图的高程由画面估算。原图完整保留，非宽幅图片会保持比例补齐海域。</p>
        <button class="btn ghost mi-alt" data-map-remove type="button">不用图纸，改为程序生成</button></div>` : `<button class="btn ghost mi-alt" data-map-remove type="button">不用图纸，改为程序生成</button>`}</div>`;
  }
  function processFile(file, grid, { signal, onProgress = () => {} } = {}) {
    if (!(file instanceof Blob) || !file.size || file.size > 128 * 1024 * 1024) return Promise.reject(new Error('请选择 128 MB 以内的图片。'));
    return new Promise((resolve, reject) => {
      const worker = new Worker('app/image-import-worker.js');
      let finished = false;
      const done = (error, value) => { if (finished) return; finished = true; worker.terminate(); signal?.removeEventListener('abort', abort); error ? reject(error) : resolve(value); };
      const abort = () => done(new DOMException('图片处理已取消', 'AbortError'));
      signal?.addEventListener('abort', abort, { once: true });
      if (signal?.aborted) { abort(); return; }
      worker.onerror = event => { event.preventDefault(); done(new Error('图片处理失败，请重新选择图片。')); };
      worker.onmessage = async ({ data }) => {
        if (data.type === 'progress') { onProgress(data.message); return; }
        if (data.type === 'error') { done(new Error(data.message)); return; }
        if (data.type !== 'ready') return;
        try {
          onProgress('正在保存原图与高度图…');
          const original = new File([file], file.name || '世界地图', { type: data.mime });
          const heightmap = new File([data.bytes], '自动高度图.png', { type: 'image/png' });
          const [sourceAsset, asset] = await Promise.all([G.WorldAssets.put(original), G.WorldAssets.put(heightmap)]);
          if (finished) return;
          const input = G.TerrainImport.validateInput({ version: 1, kind: 'heightmap-png', bitDepth: 16, asset,
            source: { asset: sourceAsset, width: data.sourceWidth, height: data.sourceHeight },
            processing: { method: data.method, sourceRect: data.sourceRect },
            width: data.width, height: data.height, projection: 'equirectangular', seaGray: data.seaGray,
            minElevation: data.minElevation, maxElevation: data.maxElevation, invert: false,
            intervention: 0, protectCoast: true, protectIslands: true, protectLakes: true, regions: [] });
          done(null, { input, gray: data.gray, landFraction: data.landFraction });
        } catch (error) { done(error); }
      };
      worker.postMessage({ file, grid: { W: grid.W, H: grid.H } });
    });
  }
  async function read(blob) {
    const bytes = new Uint8Array(await blob.arrayBuffer()), header = G.TerrainImport.inspectPNG(bytes), decoded = G.PngDecoder.rgba(bytes);
    if (decoded.width !== header.width || decoded.height !== header.height || decoded.bitDepth !== header.bitDepth) throw new Error('高度图样本与文件头不一致。');
    return decoded;
  }
  async function prepare(input) {
    const m = G.TerrainImport.validateInput(input), blob = await G.WorldAssets.get(m.asset.hash);
    if (blob.size !== m.asset.byteLength) throw new Error('高度图文件长度与清单不一致。');
    const decoded = await read(blob);
    if (decoded.width !== m.width || decoded.height !== m.height || decoded.bitDepth !== m.bitDepth) throw new Error('高度图样本与清单不一致。');
    return G.TerrainImport.decodePixels(decoded.data, m);
  }
  async function paint(st, root) {
    const d = state(st), m = d.input;
    if (!m) return;
    try {
      const gray = d.gray || (await prepare(m)).gray;
      if (!root.isConnected || d.input !== m) return;
      d.gray = gray;
      const land = landCount(d, m);
      for (const selector of ['[data-map-preview]', '[data-map-gray-preview]']) {
        const canvas = root.querySelector(selector); if (!canvas) continue;
        if (selector === '[data-map-gray-preview]' && d.grayCanvas === canvas && d.grayPainted === gray) continue;
        const ctx = canvas.getContext('2d'), image = ctx.createImageData(canvas.width, canvas.height);
        for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
          const i = Math.min(m.height - 1, Math.floor((y + .5) * m.height / canvas.height)) * m.width + Math.min(m.width - 1, Math.floor((x + .5) * m.width / canvas.width)), k = (y * canvas.width + x) * 4;
          if (selector === '[data-map-gray-preview]') image.data[k] = image.data[k + 1] = image.data[k + 2] = Math.round(gray[i] * 255 / (2 ** m.bitDepth - 1));
          else {
            const h = G.TerrainImport.grayElevation(gray[i], m);
            if (h <= 0) { const depth = Math.min(1, -h / 6000); image.data[k] = 120 - 65 * depth; image.data[k + 1] = 182 - 65 * depth; image.data[k + 2] = 201 - 45 * depth; }
            else { const t = Math.min(1, h / 6000); image.data[k] = 133 + 108 * t; image.data[k + 1] = 167 + 69 * t; image.data[k + 2] = 110 + 112 * t; }
          }
          image.data[k + 3] = 255;
        }
        ctx.putImageData(image, 0, 0);
        if (selector === '[data-map-gray-preview]') { d.grayCanvas = canvas; d.grayPainted = gray; }
        else {
          const coverage = root.querySelector('[data-map-coverage]'), fraction = land / gray.length;
          if (coverage) coverage.textContent = `预览陆地约 ${(fraction * 100).toFixed(1)}% · 水域约 ${((1 - fraction) * 100).toFixed(1)}% · 高程 ${meters(m.minElevation)} 至 ${meters(m.maxElevation)}`;
        }
      }
    } catch (error) { if (root.isConnected && d.input === m) { d.failed = true; message(st, error.message); } }
  }
  function schedulePaint(st, root) {
    const d = state(st); if (d.frame) return;
    d.frame = requestAnimationFrame(() => { d.frame = null; if (root.isConnected) paint(st, root); });
  }
  function message(st, text) {
    const d = state(st); d.message = text;
    const el = d.container?.querySelector('[data-map-message]'); if (el) el.textContent = text;
  }
  function redraw(st) {
    const d = state(st), root = d.container?.querySelector('[data-map-import]'); if (!root) return;
    const holder = document.createElement('div'); holder.innerHTML = html(st); root.replaceWith(holder.firstElementChild); bind(d.container, st);
  }
  function cancel(st) { if (!st) return; const d = drafts.get(st); if (!d) return; d.serial++; d.controller?.abort(); d.controller = null; if (d.frame) { cancelAnimationFrame(d.frame); d.frame = null; } if (d.pending) { d.pending = false; d.failed = true; d.message = '处理已取消，请重新上传图片。'; } }
  function bind(container, st) {
    const root = container.querySelector('[data-map-import]'); if (!root) return;
    const d = state(st); d.container = container;
    root.addEventListener('change', async event => {
      const t = event.target;
      if (!t.matches('[data-map-file]')) return;
      const file = t.files?.[0]; if (!file) return;
      cancel(st); const serial = d.serial, controller = new AbortController(); d.controller = controller;
      d.input = null; d.gray = null; d.pending = true; d.failed = false; delete st.terrainInput;
      d.message = '正在读取图片…'; redraw(st);
      try {
        const result = await processFile(file, G.Config.gridOf(st), { signal: controller.signal, onProgress: text => { if (serial === d.serial) message(st, text); } });
        if (serial !== d.serial) return;
        st.terrainInput = d.input = result.input; d.gray = result.gray; d.pending = false;
        d.message = '已处理：海陆与高度图已生成，可以继续设置世界。'; redraw(st);
      } catch (error) {
        if (serial !== d.serial) return;
        d.pending = false; d.failed = true; d.message = error.message; redraw(st);
      } finally { if (serial === d.serial) d.controller = null; }
    });
    root.addEventListener('input', event => {
      const t = event.target, key = t.dataset.mapKey, value = Number(t.value); if (!d.input || !Number.isFinite(value)) return;
      if (key === 'intervention') {
        d.input.intervention = clamp(value, 0, 100);
        root.querySelector('[data-map-value]').textContent = d.input.intervention;
        root.querySelector('[data-map-level]').textContent = level(d.input.intervention);
      } else if (key === 'seaGray') {
        const maximum = 2 ** d.input.bitDepth - 1;
        d.input.seaGray = clamp(Math.round(value * maximum / 100), 1, maximum - 1);
        root.querySelector('[data-map-sea-value]').textContent = `${seaPercent(d.input).toFixed(1)}%`;
        const land = landCount(d, d.input);
        if (land !== null) message(st, land === 0 ? '当前海平面使地图全部成为水域，请调低海平面。' : land === d.gray.length ? '当前海平面使地图全部成为陆地，请调高海平面。' : '已处理：海陆与高程已按当前设置更新。');
        schedulePaint(st, root);
      } else if (key === 'maxElevation') {
        const height = clamp(value, 500, 12000);
        d.input.minElevation = clamp(d.input.minElevation * height / d.input.maxElevation, -30000, -0.01);
        d.input.maxElevation = height;
        root.querySelector('[data-map-height-value]').textContent = meters(height);
        schedulePaint(st, root);
      } else return;
      st.terrainInput = d.input;
    });
    root.addEventListener('click', event => {
      if (!event.target.closest('[data-map-remove]')) return;
      cancel(st); delete st.terrainInput; d.input = null; d.gray = null; d.failed = false; d.message = '';
      container.dispatchEvent(new CustomEvent('mapinputchanged', { detail: { source: 'procedural' } }));
    });
    paint(st, root);
  }
  async function ensureGrid(st) {
    const m = st.terrainInput, grid = G.Config.gridOf(st);
    if (!m?.source || (m.width === grid.W && m.height === grid.H)) return;
    const d = state(st), controller = new AbortController(), serial = ++d.serial;
    d.controller?.abort(); d.controller = controller; d.pending = true;
    try {
      message(st, '正在按世界设置适配高度图…');
      const blob = await G.WorldAssets.get(m.source.asset.hash);
      const result = await processFile(new File([blob], m.source.asset.name, { type: m.source.asset.mime }), grid, { signal: controller.signal, onProgress: text => { if (serial === d.serial) message(st, text); } });
      if (serial !== d.serial) throw new DOMException('图片处理已取消', 'AbortError');
      const input = G.TerrainImport.validateInput({ ...result.input,
        seaGray: Math.round(seaPercent(m) * (2 ** result.input.bitDepth - 1) / 100), minElevation: m.minElevation, maxElevation: m.maxElevation, invert: m.invert,
        intervention: m.intervention, protectCoast: m.protectCoast, protectIslands: m.protectIslands, protectLakes: m.protectLakes, regions: m.regions });
      st.terrainInput = d.input = input; d.gray = result.gray; d.failed = false; d.message = '已处理：高度图已适配世界设置。';
    } finally { if (serial === d.serial) { d.pending = false; d.controller = null; } }
  }
  function validateForGenerate(st, container) {
    const d = state(st);
    if (!d.pending && !d.failed) {
      const land = d.input ? landCount(d, d.input) : null;
      if (land === null || (land > 0 && land < d.gray.length)) return true;
      d.container = container;
      message(st, land === 0 ? '当前海平面使地图全部成为水域，请调低海平面。' : '当前海平面使地图全部成为陆地，请调高海平面。');
      container.querySelector('[data-map-import]')?.scrollIntoView({ block: 'center' }); return false;
    }
    d.container = container; message(st, d.pending ? '正在处理图片，完成后即可继续。' : '请重新上传有效图片，或选择“改用新建世界”。');
    container.querySelector('[data-map-import]')?.scrollIntoView({ block: 'center' }); return false;
  }
  G.MapImport = { html, bind, processFile, prepare, ensureGrid, cancel, validateForGenerate };
})(window);
