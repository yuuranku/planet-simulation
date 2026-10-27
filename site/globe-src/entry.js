/* 球体页入口：沿用用户生成器 dev164 的球面与天体显示（globe-celestial / 环境 / 云层 / 星环 / 恒星 / 地形法线），
 * 数据改由主页面通过 postMessage 传入本次推演的自然地表、地形法线与专题纹理。 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createCelestial } from './globe-celestial.js';
import { createNaturalSurface } from './globe-surface.js';

const SYLLABLES = ['艾', '弥', '洛', '瑟', '诺', '塔', '维', '兰', '伊', '索', '纳', '雅', '卢', '希', '尔', '珀'];
const TEXTURES = ['rock-1', 'rock-2', 'rock-3', 'ice-1', 'ice-2', 'barren-1', 'barren-2', 'gas-1', 'gas-2'];
const SATELLITE_TEXTURES = ['rock-1', 'ice-1', 'barren-1', 'barren-2', 'io', 'europa', 'ganymede', 'callisto'];
const G = 6.67430e-11, SOLAR_GM = 1.3271244e20, SOLAR_RADIUS_KM = 695700, TAU = Math.PI * 2;
async function sha(text) { return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))); }
const hex = b => [...b].map(v => v.toString(16).padStart(2, '0')).join('');
async function fraction(seed, id, purpose) { const d = await sha(`${seed}:${id}:${purpose}`); let v = 0; for (let k = 0; k < 8; k++) v = v * 256 + d[k]; return v / 2 ** 64; }
async function names(seed) {
  const out = {}, used = new Set();
  for (const id of ['star-1', ...Array.from({ length: 8 }, (_, i) => `moon-${i + 1}`), ...Array.from({ length: 8 }, (_, i) => `planet-${i + 1}`)]) {
    const d = await sha(`${seed}:${id}:name`); let n = 0; for (let i = 0; i < 3; i++) n += (d[i] % 16) * 16 ** (2 - i);
    for (;;) { const label = [2, 1, 0].map(i => SYLLABLES[Math.floor(n / 16 ** i) % 16]).join(''); if (!used.has(label)) { out[id] = label; used.add(label); break; } n = (n + 1) % 4096; }
  }
  return out;
}
async function sortBy(seed, list, key) { const h = await Promise.all(list.map(async t => [hex(await sha(`${seed}:system:${key}:${t}`)), t])); h.sort((a, b) => a[0] < b[0] ? -1 : 1); return h.map(x => x[1]); }
// 原版 astronomy.astronomy_config 的移植
async function astronomyConfig(c) {
  const seed = c.seed >>> 0, choice = { one: 'A', many: 'B', none: 'C', ring: 'D' }[c.moons] || 'A';
  const mainRing = choice === 'D', count = c.moonCount ?? { A: 1, B: 3, C: 0, D: 0 }[choice];
  const radius = c.radius, day = c.day, gravity = c.gravity || 9.81 * radius / 6371, mass = gravity * (radius * 1000) ** 2 / G;
  const nm = await names(seed), satTex = await sortBy(seed, SATELLITE_TEXTURES, 'satellite-textures'), satellites = [];
  for (let i = 0; i < (mainRing ? 0 : count); i++) {
    const id = `moon-${i + 1}`, v = await fraction(seed, id, 'orbit');
    const rk = radius * (count === 1 ? 0.2727 : 0.045 + 0.025 * v), period = count === 1 ? 27.3 : 5.3 + i * 6.1 + v * 2;
    const mm = 4 * Math.PI / 3 * (rk * 1000) ** 3 * 3344;
    const orbit = (G * (mass + mm) * (period * day * 3600 / TAU) ** 2) ** (1 / 3) / 1000;
    satellites.push({ id, name: nm[id], textureId: satTex[i], physicalRadiusKm: rk, physicalOrbitKm: orbit, radiusRatio: count === 1 ? 0.18 : 0.045 + 0.025 * v, orbitRadius: count === 1 ? 2.4 : 1.8 + i * 0.65, periodDays: period, inclinationDeg: count === 1 ? 5.1 : (v - 0.5) * 24, phaseRad: v * TAU });
  }
  const year = c.yearDays, mainOrbit = (SOLAR_GM * (year * day * 3600 / TAU) ** 2) ** (1 / 3) / 1000;
  const planets = [], pc = 5 + Math.floor(await fraction(seed, 'system', 'count') * 4), ptex = await sortBy(seed, TEXTURES, 'planet-textures');
  for (let i = 0; i < pc; i++) {
    const id = `planet-${i + 1}`, v = await fraction(seed, id, 'orbit'), ratioO = [0.4, 0.68, 1.5, 2.3, 3.4, 4.7, 6.1, 7.9][i], tex = ptex[i];
    const ratio = !tex.startsWith('gas') ? 0.3 + v * 0.45 : 2.5 + v * 3, sp = await fraction(seed, id, 'rotation-period');
    planets.push({ id, name: nm[id], textureId: tex, physicalRadiusKm: radius * ratio, physicalOrbitKm: mainOrbit * ratioO, radiusRatio: Math.min(0.65, 0.18 + ratio * 0.08), orbitRadius: 12 * ratioO, periodDays: year * ratioO ** 1.5, inclinationDeg: (v - 0.5) * 8, phaseRad: await fraction(seed, id, 'phase') * TAU, rotationPeriodHours: tex.startsWith('gas') ? 8 + 12 * sp : 10 * 60 ** sp, rotationDirection: await fraction(seed, id, 'rotation-direction') < 0.18 ? 'retrograde' : 'prograde', axialTiltDegrees: 85 * (await fraction(seed, id, 'axial-tilt')) ** 2, spinPhaseRad: await fraction(seed, id, 'spin-phase') * TAU, ring: tex.startsWith('gas') && await fraction(seed, id, 'ring') > 0.45 });
  }
  return { schema: 'world-atlas-astronomy-v1', seed, radiusKm: radius, rotationPeriodHours: day, rotationDirection: c.retro ? 'retrograde' : 'prograde', orbitalPeriodDays: year, axialTiltDegrees: c.tilt,
    star: { id: 'star-1', name: nm['star-1'], physicalRadiusKm: SOLAR_RADIUS_KM, massParameterM3S2: SOLAR_GM, temperatureK: 5772, physicalMainOrbitKm: mainOrbit, radiusRatio: 1.3, orbitRadius: 12 },
    satellites, extraPlanetsEnabled: true, planets, mainRing: { enabled: mainRing, innerRadiusRatio: 1.25, outerRadiusRatio: 1.9 },
    model: { orbits: 'analytic-circular-two-body', displayScale: 'independently-compressed', nominalSolarStar: true, satelliteDensityKgM3: 3344, nBodySimulated: false, coastalTidesSimulated: false, ringImpactsSimulated: false } };
}

const status = document.getElementById('globe-status');
async function start(data) {
  const astronomy = await astronomyConfig(data.cfg);
  const manifest = await (await fetch('celestial/manifest.json')).json();
  for (const cat of ['textures', 'planetTextures']) for (const e of Object.values(manifest[cat])) for (const a of Object.values(e)) a.url = 'celestial/' + a.filename;
  manifest.ring.url = 'celestial/' + manifest.ring.filename; manifest.star.url = 'celestial/' + manifest.star.filename;
  let clouds = null;
  try { const r = await fetch('celestial/clouds.jpg'); clouds = await createImageBitmap(await r.blob(), { imageOrientation: 'flipY', colorSpaceConversion: 'none' }); } catch (e) { clouds = null; }
  const gridDigest = 'world-' + data.cfg.seed;
  const payload = { gridDigest, astronomy, celestialAssets: manifest,
    naturalSurface: { inMemory: true, schema: 'world-atlas-natural-surface-v1', gridDigest, latitudeOrder: 'north-to-south', width: data.albedo.width, height: data.albedo.height,
      albedo: { bitmap: data.albedo, width: data.albedo.width, height: data.albedo.height }, water: { bitmap: data.water, width: data.water.width, height: data.water.height },
      clouds: clouds ? { bitmap: clouds, width: clouds.width, height: clouds.height } : null },
    relief: data.relief ? { bitmap: data.relief, width: data.relief.width, height: data.relief.height } : null };

  // 侧栏：世界名称、天体清单
  document.getElementById('globe-world-name').textContent = data.name;
  document.title = data.name + ' · 球体';
  const ring = astronomy.mainRing.enabled, moons = astronomy.satellites.length;
  document.querySelector('#celestial-settings .inventory').textContent = ring ? '主世界星环 · 无卫星' : moons ? `${moons} 颗卫星` : '无卫星';
  document.getElementById('globe-moons-note').textContent = moons ? '查看全部卫星及其轨道。' : ring ? '本世界选择主星环，没有卫星。' : '本世界没有卫星。';
  document.getElementById('globe-show-moons').disabled = !moons;
  if (!moons) document.querySelector('#globe-focus [value="moons"]').disabled = true;
  if (ring) document.getElementById('globe-orbits').insertAdjacentHTML('afterend', '<label class="switch-row" for="globe-ring"><span>主世界星环</span><input id="globe-ring" type="checkbox" checked></label>');
  const themeSelect = document.getElementById('globe-theme');
  themeSelect.innerHTML = '<option value="terrain">自然地表</option>' + Object.entries(data.themes).map(([k, t]) => `<option value="${k}">${t.label}</option>`).join('');

  const mount = document.getElementById('globe');
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.outputColorSpace = THREE.SRGBColorSpace; mount.appendChild(renderer.domElement);
  const scene = new THREE.Scene(), b0 = mount.getBoundingClientRect();
  const camera = new THREE.PerspectiveCamera(38, b0.width / Math.max(1, b0.height), 0.01, 100); camera.position.set(0, 0.25, 3.4);
  const controls = new OrbitControls(camera, renderer.domElement); controls.enablePan = false; controls.minDistance = 1.08; controls.maxDistance = 5.5; controls.enableDamping = false;
  const material = new THREE.MeshBasicMaterial(), planet = new THREE.Mesh(new THREE.SphereGeometry(1, 256, 128), material); scene.add(planet);
  const naturalSurface = createNaturalSurface({ payload, draw });
  const globePoint = (lon, lat) => { const a = lat * Math.PI / 180, o = lon * Math.PI / 180; return new THREE.Vector3(Math.cos(a) * Math.cos(o), Math.sin(a), -Math.cos(a) * Math.sin(o)); };
  const gp = []; for (let la = -60; la <= 60; la += 30) for (let lo = -180; lo < 180; lo += 2) gp.push(globePoint(lo, la).multiplyScalar(1.001), globePoint(lo + 2, la).multiplyScalar(1.001));
  for (let lo = -180; lo < 180; lo += 30) for (let la = -90; la < 90; la += 2) gp.push(globePoint(lo, la).multiplyScalar(1.001), globePoint(lo, la + 2).multiplyScalar(1.001));
  const graticule = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(gp), new THREE.LineBasicMaterial({ color: 0x34495a, transparent: true, opacity: 0.3 })); graticule.visible = false; scene.add(graticule);
  // 地名（首都与国家），只显示面向镜头的一侧
  const labelLayer = document.createElement('div'); labelLayer.id = 'globe-place-labels'; mount.appendChild(labelLayer);
  const places = (data.places || []).map(p => { const el = document.createElement('span'); el.className = 'place ' + p.kind; el.textContent = p.name; labelLayer.appendChild(el); return { ...p, el, v: globePoint(p.lon, p.lat) }; });
  const tmp = new THREE.Vector3(), camDir = new THREE.Vector3();
  function updatePlaces() {
    if (mount.classList.contains('globe-labels-hidden')) { labelLayer.hidden = true; return; } labelLayer.hidden = false;
    planet.updateWorldMatrix(true, false); const w = mount.clientWidth, h = mount.clientHeight, dist = camera.position.length();
    const boxes = [];
    for (const p of places) {
      tmp.copy(p.v).applyMatrix4(planet.matrixWorld); camDir.copy(camera.position).sub(tmp);
      const facing = tmp.dot(camDir.normalize());
      const show = facing > 0.25 && (p.kind === 'state' || dist < 2.6 || p.major);
      if (!show) { p.el.style.display = 'none'; continue; }
      tmp.project(camera); const x = (tmp.x + 1) / 2 * w, y = (1 - tmp.y) / 2 * h;
      const bw = p.name.length * (p.kind === 'state' ? 14 : 12) + 12, bh = 18;
      if (boxes.some(b => x < b[2] && x + bw > b[0] && y < b[3] && y + bh > b[1])) { p.el.style.display = 'none'; continue; }
      boxes.push([x - bw / 2, y - bh / 2, x + bw / 2, y + bh / 2]);
      p.el.style.display = ''; p.el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-50%)`; p.el.style.opacity = Math.min(1, (facing - 0.25) * 4).toFixed(2);
    }
  }
  let queued = false;
  function draw() { if (queued || document.hidden) return; queued = true; requestAnimationFrame(() => { queued = false; celestial?.prepareFrame(); renderer.render(scene, camera); celestial?.updateLabels(); updatePlaces(); }); }
  function resize() { const { width, height } = mount.getBoundingClientRect(); const prev = camera.aspect; camera.aspect = width / Math.max(1, height); camera.updateProjectionMatrix(); celestial?.viewportChanged(prev); renderer.setPixelRatio(window.devicePixelRatio || 1); renderer.setSize(width, height, false); draw(); }
  const namesStub = { get: () => undefined, applyLabels() {}, attachEditor() {}, destroy() {} };
  const celestial = createCelestial({ scene, planet, camera, controls, mount, payload, names: namesStub, draw, surfaceUniforms: naturalSurface.uniforms, anisotropy: renderer.capabilities.getMaxAnisotropy() });
  if (celestial) celestial.spin.add(graticule);
  const themeTextures = new Map();
  async function selectTheme(key) {
    if (key === 'terrain') { const t = await naturalSurface.load(); t.anisotropy = renderer.capabilities.getMaxAnisotropy(); material.map = t; naturalSurface.setTheme(key); celestial?.setTheme(key); }
    else { let t = themeTextures.get(key); if (!t) { t = new THREE.Texture(data.themes[key].bitmap); t.colorSpace = THREE.SRGBColorSpace; t.flipY = false; t.wrapS = THREE.RepeatWrapping; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); t.needsUpdate = true; themeTextures.set(key, t); }
      material.map = t; naturalSurface.setTheme(key); celestial?.setTheme(key); }
    material.needsUpdate = true; status.textContent = ''; draw();
  }
  controls.addEventListener('change', draw);
  new ResizeObserver(resize).observe(mount);
  document.addEventListener('visibilitychange', draw);
  themeSelect.addEventListener('change', e => selectTheme(e.target.value).catch(err => status.textContent = '纹理加载失败：' + err.message));
  document.getElementById('globe-graticule').addEventListener('change', e => { graticule.visible = e.target.checked; draw(); });
  const lt = document.getElementById('globe-labels-toggle');
  lt.addEventListener('click', () => { const hidden = mount.classList.toggle('globe-labels-hidden'); lt.setAttribute('aria-pressed', String(!hidden)); lt.textContent = hidden ? '显示标签' : '隐藏标签'; draw(); });
  const coords = document.getElementById('globe-coordinates'), ray = new THREE.Raycaster(); let ps = null;
  renderer.domElement.addEventListener('pointerdown', e => { ps = { x: e.clientX, y: e.clientY }; });
  renderer.domElement.addEventListener('pointerup', e => {
    if (!ps || Math.hypot(e.clientX - ps.x, e.clientY - ps.y) > 5) return;
    const b = renderer.domElement.getBoundingClientRect(); ray.setFromCamera(new THREE.Vector2((e.clientX - b.left) / b.width * 2 - 1, 1 - (e.clientY - b.top) / b.height * 2), camera);
    const hit = ray.intersectObject(planet)[0]; if (hit) { const la = hit.uv.y * 180 - 90, lo = hit.uv.x * 360 - 180; coords.textContent = `${Math.abs(la).toFixed(2)}° ${la >= 0 ? 'N' : 'S'} · ${Math.abs(lo).toFixed(2)}° ${lo >= 0 ? 'E' : 'W'}`; }
  });
  document.getElementById('globe-reset').addEventListener('click', () => { if (celestial) celestial.resetCamera(); });
  resize();
  await selectTheme('terrain');
  window.WorldAtlasMapLoading?.ready();
  parent.postMessage({ type: 'globe-ready' }, '*');
}
document.getElementById('atlas-link').addEventListener('click', e => { e.preventDefault(); parent.postMessage({ type: 'globe-close' }, '*'); });
window.addEventListener('message', e => { if (e.data && e.data.type === 'globe-world') start(e.data).catch(err => { status.textContent = '此设备无法启用 WebGL 球体：' + err.message; console.error(err); }); });
parent.postMessage({ type: 'globe-loaded' }, '*');
