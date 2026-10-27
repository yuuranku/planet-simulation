(() => {
  'use strict';
  const byId = id => document.getElementById(id);
  const select = byId('city-select'), status = byId('app-status');
  const payloads = new Map(), sources = new Map();
  const eraSelect = byId('era-select'), cultureSelect = byId('culture-select');
  // Building cultures follow the generator's own architecture families; each
  // borrows its naming library from the example that carries that culture.
  const CULTURES = [
    {id: 'han', label: '华夏 · 合院', source: 'settlement-0001'},
    {id: 'dynastic', label: '东方王朝 · 合院', source: 'settlement-0006'},
    {id: 'japan', label: '日本 · 木构', source: 'border-site-001',
      layout: {prototype: 'planned_ward_capital', architecture: 'timber-frame', monumentTradition: 'east-asian', materials: {wall: 'timber', roof: 'tile'}}},
    {id: 'latin', label: '古典地中海 · 柱廊', source: 'settlement-0015'},
    {id: 'arab', label: '西亚 · 院落', source: 'settlement-0005'},
    {id: 'mesopotamian', label: '两河 · 泥砖台地', source: 'settlement-0005',
      layout: {prototype: 'organic_sacred_market_city', architecture: 'walled-compound', monumentTradition: 'mesopotamian', materials: {wall: 'earth', roof: 'lime'}}},
    {id: 'german', label: '西日耳曼 · 木构', source: 'settlement-0017'},
    {id: 'stone', label: '欧陆 · 石砌', source: 'settlement-0017',
      layout: {prototype: 'organic_sacred_market_city', architecture: 'stone-masonry', monumentTradition: 'european', materials: {wall: 'stone', roof: 'slate'}}},
    {id: 'terraced', label: '北海 · 联排砖屋', source: 'settlement-0017',
      layout: {prototype: 'river_port_market_city', architecture: 'terraced', monumentTradition: 'european', materials: {wall: 'brick', roof: 'slate'}}},
    {id: 'canal', label: '运河商港 · 窄屋', source: 'settlement-0017',
      layout: {prototype: 'river_port_market_city', architecture: 'canal-side', monumentTradition: 'european', materials: {wall: 'brick', roof: 'tile'}}},
    {id: 'vernacular', label: '乡土混合', source: 'settlement-0015',
      layout: {prototype: 'rural_market_hinterland', architecture: 'vernacular-mixed', monumentTradition: 'vernacular', materials: {wall: 'plaster', roof: 'tile'}}}
  ];
  let catalog = [], selected = null, map = null, mapIdentity = '', busy = false;
  window.cityAppReady = false;

  function identityOf(value) {
    const gridDigest = value.gridDigest;
    if (typeof gridDigest !== 'string' || !gridDigest) throw new Error('城市文件缺少 gridDigest。');
    const worldId = value.worldId || value.recipe?.worldId || gridDigest;
    return {worldId, gridDigest};
  }
  function ensureMap(value) {
    const identity = identityOf(value), key = JSON.stringify(identity);
    if (mapIdentity === key && map) return;
    map?.destroy();
    byId('city-map-viewport').querySelectorAll('.city-relief-key').forEach(node => node.remove());
    map = WorldAtlasCityMap.create({
      viewport: byId('city-map-viewport'), container: byId('city-fabric-layer'), ...identity,
      loadCity: async place => {
        const payload = payloads.get(place.id);
        if (!payload) throw new Error('重新生成需要导入该城市的原始输入文件。');
        return withChoices(payload);
      }
    });
    window.cityMap = map;
    mapIdentity = key;
  }
  async function sourceRecipe(id) {
    if (sources.has(id)) return sources.get(id);
    const response = await fetch(`city-maps/${encodeURIComponent(id)}.json`);
    if (!response.ok) throw new Error('无法读取建筑文化示例。');
    const recipe = (await response.json()).recipe;
    sources.set(id, recipe);
    return recipe;
  }
  async function cultureOption(id) {
    const preset = CULTURES.find(culture => culture.id === id);
    if (!preset) return null;
    const source = await sourceRecipe(preset.source), layout = preset.layout || source.culture.cityLayout;
    return {id, culture: {...source.culture, cityLayout: layout, style: layout.architecture}, naming: source.naming, namePool: source.namePool};
  }
  // Era and culture are generation inputs: the planner receives a recipe
  // already carrying them, so saved layouts and exports stay self-contained.
  async function withChoices(payload) {
    const era = eraSelect.value === 'input' ? null : eraSelect.value, culture = await cultureOption(cultureSelect.value);
    const recipe = era || culture ? WorldAtlasCityEra.apply(payload.recipe, {era, culture}) : structuredClone(payload.recipe);
    recipe.eraChoice = eraSelect.value; recipe.culturePreset = cultureSelect.value;
    return {...payload, recipe};
  }
  function syncChoices(recipe) {
    if (!recipe) return;
    eraSelect.value = recipe.eraChoice || 'input';
    cultureSelect.value = CULTURES.some(culture => culture.id === recipe.culturePreset) ? recipe.culturePreset : 'input';
  }
  function refreshControls() {
    const ready = Boolean(map?.recipe), hasInput = payloads.has(selected?.id);
    for (const id of ['city-select', 'import-city-button', 'import-layout-button', 'import-city', 'import-layout']) byId(id).disabled = busy;
    byId('regenerate').disabled = busy || !ready || !hasInput;
    eraSelect.disabled = cultureSelect.disabled = busy || !hasInput;
    byId('random-city').disabled = busy || !catalog.some(city => !city.imported);
    byId('regenerate').title = hasInput ? '保留地形，更换布局种子' : '请先导入原始城市输入文件';
    byId('export-input').disabled = busy || !ready || !hasInput;
    byId('export-json').disabled = byId('export-svg').disabled = busy || !ready;
    byId('city-map-section').setAttribute('aria-busy', String(busy));
  }
  function setBusy(value) { busy = value; refreshControls(); }
  function describe(recipe) {
    const stats = map.stats();
    byId('city-name').textContent = recipe.name;
    byId('city-description').textContent = selected.label.split(' · ')[0];
    byId('population').textContent = recipe.population.estimate.toLocaleString('zh-CN');
    byId('building-count').textContent = stats.buildings.toLocaleString('zh-CN');
    byId('character').textContent = stats.character;
    const profile = WorldAtlasCityCharacter.profile(recipe);
    byId('era').textContent = WorldAtlasCityEra.eraLabel[recipe.era] || recipe.era;
    byId('layout-grammar').textContent = profile.eraPlan?.label || profile.prototypeLabel || '—';
    byId('layout-grammar').title = profile.eraPlan?.summary || '';
    byId('city-description').textContent = [selected.label.split(' · ')[0], byId('era').textContent, profile.eraPlan?.summary].filter(Boolean).join(' · ');
    syncChoices(recipe);
    byId('seed').textContent = stats.seed;
    byId('generation-hint').textContent = payloads.has(selected.id)
      ? '布局会自动保存在当前浏览器。' : '已载入完整布局；重新生成需原始城市输入。';
    document.title = `${recipe.name} · 城市生成器`;
    window.cityAppReady = true;
  }
  function validateInput(payload) {
    if (payload?.schema !== 'world-atlas-city-map-v1' || !payload.recipe?.id || !payload.recipe?.urban
        || !payload.recipe?.population || payload.siteContext?.schema !== 'city-site-context-v2'
        || !Array.isArray(payload.siteContext.elevationMetres) || !payload.grid) {
      throw new Error('请选择新版城市输入 JSON，需包含 recipe、siteContext v2 和 grid。');
    }
    identityOf(payload);
    return payload;
  }
  async function loadInput(place) {
    if (payloads.has(place.id)) return payloads.get(place.id);
    const response = await fetch(`city-maps/${encodeURIComponent(place.sourceId)}.json`);
    if (!response.ok) throw new Error('无法读取城市输入。');
    const payload = validateInput(await response.json());
    if (payload.recipe.id !== place.sourceId) throw new Error('城市目录与输入标识不一致。');
    payloads.set(place.id, payload);
    return payload;
  }
  async function openCity(place, {regenerate = false, snapshot = null, keepSeed = false, resetCamera = false} = {}) {
    if (busy || !place) return;
    status.textContent = '';
    setBusy(true);
    try {
      let value;
      if (snapshot) value = snapshot;
      else if (place.snapshotIdentity) value = place.snapshotIdentity;
      else value = await loadInput(place);
      ensureMap(value);
      selected = place;
      const recipe = snapshot ? await map.importSnapshot(snapshot, place, {replace: true}) : await map.open(place, {regenerate, keepSeed, resetCamera});
      if (!recipe) throw new Error(byId('city-map-status').textContent || '城市生成失败。');
      describe(recipe);
      const url = new URL(location.href);
      if (place.imported) url.searchParams.delete('city');
      else url.searchParams.set('city', place.id);
      history.replaceState(null, '', url);
    } catch (error) {
      status.textContent = error.message;
    } finally { setBusy(false); }
  }
  function download(content, filename, type) {
    const url = URL.createObjectURL(new Blob([content], {type}));
    const link = document.createElement('a');
    link.href = url; link.download = filename; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function safeFilename(name) { return String(name).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_'); }
  function refreshOptions() {
    select.replaceChildren(...catalog.map(city => {
      const option = document.createElement('option');
      option.value = city.id; option.textContent = `${city.name} · ${city.label}`;
      return option;
    }));
  }
  function addImported(value, label, snapshot = false) {
    const place = {
      id: `import-${crypto.randomUUID()}`, sourceId: value.recipe.id, kind: 'city',
      name: value.recipe.name || value.recipe.id, label, imported: true
    };
    if (snapshot) place.snapshotIdentity = identityOf(value);
    else payloads.set(place.id, value);
    catalog.push(place);
    refreshOptions(); select.value = place.id;
    return place;
  }
  select.addEventListener('change', () => openCity(catalog.find(city => city.id === select.value)));
  for (const node of [eraSelect, cultureSelect]) node.addEventListener('change', () => {
    if (selected && payloads.has(selected.id)) openCity(selected, {regenerate: true, keepSeed: true, resetCamera: true});
  });
  byId('random-city').addEventListener('click', async () => {
    const pool = catalog.filter(city => !city.imported && city.id !== 'border-site-001'), pick = list => list[Math.floor(Math.random() * list.length)];
    const place = pick(pool);
    eraSelect.value = pick(['ancient', 'ancient', 'industrial', 'industrial', 'medieval', 'preindustrial']);
    cultureSelect.value = Math.random() < .35 ? 'input' : pick(CULTURES).id;
    select.value = place.id;
    if (!payloads.has(place.id)) { try { await loadInput(place); } catch (error) { status.textContent = error.message; return; } }
    await openCity(place, {regenerate: true, resetCamera: true});
  });
  byId('regenerate').addEventListener('click', () => openCity(selected, {regenerate: true}));
  byId('import-city-button').addEventListener('click', () => byId('import-city').click());
  byId('import-layout-button').addEventListener('click', () => byId('import-layout').click());
  byId('export-input').addEventListener('click', () => {
    const payload = structuredClone(payloads.get(selected.id));
    payload.recipe.seed = map.stats().seed;
    download(JSON.stringify(payload), `${safeFilename(selected.sourceId)}-input.json`, 'application/json');
  });
  byId('export-json').addEventListener('click', () => {
    try {
      const snapshot = map.exportSnapshot();
      download(JSON.stringify(snapshot), `${safeFilename(snapshot.cityId)}-${snapshot.seed}-layout.json`, 'application/json');
      status.textContent = '完整布局已导出，包含当前地形、街道、建筑与标注几何。';
    } catch (error) { status.textContent = error.message; }
  });
  byId('export-svg').addEventListener('click', () => {
    const node = byId('city-map-canvas'), copy = node.cloneNode(true), box = node.getBoundingClientRect();
    copy.setAttribute('width', box.width); copy.setAttribute('height', box.height);
    copy.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
    copy.style.background = getComputedStyle(byId('city-map-viewport')).backgroundColor;
    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    style.textContent = [...document.styleSheets].flatMap(sheet => [...sheet.cssRules].map(rule => rule.cssText)).join('\n');
    copy.prepend(style);
    download(new XMLSerializer().serializeToString(copy), `${safeFilename(selected.sourceId)}-${map.stats().seed}.svg`, 'image/svg+xml');
  });
  byId('import-city').addEventListener('change', async event => {
    const input = event.target, file = input.files[0];
    if (!file || busy) return;
    try {
      const payload = validateInput(JSON.parse(await file.text()));
      const place = addImported(payload, '导入的城市输入');
      await openCity(place);
    } catch (error) { status.textContent = `导入失败：${error.message}`; }
    finally { input.value = ''; }
  });
  byId('import-layout').addEventListener('change', async event => {
    const input = event.target, file = input.files[0];
    if (!file || busy) return;
    try {
      const snapshot = JSON.parse(await file.text());
      WorldAtlasCityLayouts.validate(snapshot);
      const place = addImported(snapshot, '导入的完整布局', true);
      await openCity(place, {snapshot});
    } catch (error) { status.textContent = `导入失败：${error.message}`; }
    finally { input.value = ''; }
  });
  // ---- 星球推演：嵌入模式。由世界地图通过 postMessage 送来城市输入（与“导入城市输入”同一格式） ----
  const EMBED = new URLSearchParams(location.search).has('embed');
  const embedPlaces = new Map();
  window.addEventListener('message', async event => {
    const msg = event.data; if (!msg || msg.type !== 'planet-city') return;
    try {
      const payload = validateInput(msg.payload);
      let place = embedPlaces.get(payload.recipe.id);
      if (!place) { place = addImported(payload, msg.label || '世界地图城市'); embedPlaces.set(payload.recipe.id, place); }
      else payloads.set(place.id, payload);
      select.value = place.id;
      await openCity(place);
    } catch (error) { status.textContent = `载入失败：${error.message}`; }
  });
  async function start() {
    if (EMBED) {
      document.documentElement.classList.add('embedded');
      try { const response = await fetch('city-maps/catalog.json'); if (response.ok) { catalog = await response.json(); refreshOptions(); } } catch (e) { /* 示例目录可缺省 */ }
      cultureSelect.append(...CULTURES.map(culture => Object.assign(document.createElement('option'), {value: culture.id, textContent: culture.label})));
      parent.postMessage({ type: 'citygen-ready' }, '*');
      return;
    }
    try {
      const response = await fetch('city-maps/catalog.json');
      if (!response.ok) throw new Error('无法读取示例目录');
      catalog = await response.json();
      refreshOptions();
      cultureSelect.append(...CULTURES.map(culture => Object.assign(document.createElement('option'), {value: culture.id, textContent: culture.label})));
      const requested = new URLSearchParams(location.search).get('city');
      const first = catalog.find(city => city.id === requested) || catalog[0];
      if (!first) throw new Error('示例目录为空');
      select.value = first.id;
      await openCity(first);
    } catch (error) {
      status.textContent = `${error.message}。请用便携包内的启动程序打开。`;
    }
  }
  start();
})();
