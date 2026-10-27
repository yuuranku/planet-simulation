import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createCelestial } from './globe-celestial.js';
import { createMapOverlays } from './globe-map-overlays.js';
import { prepareGlobeSvg } from './globe-raster.js';
import { composeGlobeSvg } from './globe-composition.js';
import { createNaturalSurface } from './globe-surface.js';

// Natural materials and thematic vectors share this world's physical geometry.
const mount = document.getElementById('globe');
const status = document.getElementById('globe-status');
const payload = window.WorldAtlasGlobe;
const handoff = WorldAtlasViewState.readHandoff(location.href, payload.gridDigest);
const layerValues={cities:false,transport:false,'nominal-realms':false,'geographic-symbols':false,
  'frozen-ground-surface':false,...handoff?.layers};
try {
  const renderer = new THREE.WebGLRenderer({antialias: true, alpha: true, powerPreference: 'low-power'});
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  mount.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const initialBounds = mount.getBoundingClientRect();
  const camera = new THREE.PerspectiveCamera(38, initialBounds.width / Math.max(1, initialBounds.height), 0.01, 100);
  camera.position.set(0, 0.25, 3.4);
  if(handoff){
    const tilt=(payload.astronomy?.axialTiltDegrees||0)*Math.PI/180;
    camera.up.set(-Math.sin(tilt),Math.cos(tilt),0);
  }
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.minDistance = 1.08;
  controls.maxDistance = 5.5;
  controls.enableDamping = false;
  const textureWidth = Math.min(8192, renderer.capabilities.maxTextureSize);
  const sharedController = new AbortController();
  let sharedSources=null;
  const loadSharedSources=()=>sharedSources??=Promise.all([payload.surfaceUrl, payload.inkUrl].map(url =>
    svgSource(url, sharedController.signal))).then(([surface, ink]) => {
    const baseSurface = parseSvg(surface);
    const commonInk = parseSvg(ink);
    const viewBox = baseSurface.getAttribute('viewBox').replaceAll(',', ' ').trim().split(/\s+/);
    commonInk.setAttribute('width', viewBox[2]);
    commonInk.setAttribute('height', viewBox[3]);
    return {baseSurface, commonInk, viewBox};
  });
  const themeSelect = document.getElementById('globe-theme');
  const requestedTheme = new URLSearchParams(location.search).get('theme');
  let selection = 0;
  let selectedTheme = Object.hasOwn(payload.textures, requestedTheme) ? requestedTheme : 'terrain';
  themeSelect.value = selectedTheme;
  let appliedTheme = null;
  let disposed = false;
  let themeController = null;
  const themeSources = new Map();
  let mapOverlays = null;
  let selectedPlace = handoff?.place || null;
  const names = WorldAtlasNames.create({worldId:payload.gridDigest,
    onChange:()=>{if(disposed)return;names.applyLabels(document);mapOverlays?.refreshNames();celestial?.refreshNames();updateRegionReadout();
      document.title=document.getElementById('globe-world-name').textContent+' · 球体';},
    onError:error=>{status.textContent=`名称档案读取失败：${error.message}`;}});
  function parseSvg(source) {
    const document = new DOMParser().parseFromString(source, 'image/svg+xml');
    if (document.querySelector('parsererror') || document.documentElement.localName !== 'svg')
      throw new Error('球体 SVG 无效');
    return document.documentElement;
  }
  async function svgSource(url, signal) {
    const response = await fetch(url, {signal, cache: 'no-cache'});
    if (!response.ok) throw new Error(`球体图层加载失败：HTTP ${response.status}`);
    return response.text();
  }
  async function themeSource(key, signal) {
    const url = payload.textures[key];
    if (themeSources.has(key)) {
      const source = themeSources.get(key);
      themeSources.delete(key); themeSources.set(key, source);
      return source;
    }
    const source = await svgSource(url, signal);
    if (signal.aborted) throw new DOMException('Superseded globe theme', 'AbortError');
    themeSources.set(key, source);
    while (themeSources.size > 4) themeSources.delete(themeSources.keys().next().value);
    return source;
  }
  const material = new THREE.MeshBasicMaterial();
  const planet = new THREE.Mesh(new THREE.SphereGeometry(1, 256, 128), material);
  scene.add(planet);
  let celestial = null;
  const naturalSurface=createNaturalSurface({payload,draw});
  const gridPoints = [];
  const globePoint = (longitude, latitude) => {
    const lat = latitude * Math.PI / 180, lon = longitude * Math.PI / 180;
    return new THREE.Vector3(Math.cos(lat) * Math.cos(lon), Math.sin(lat), -Math.cos(lat) * Math.sin(lon)).multiplyScalar(1.001);
  };
  for (let latitude = -60; latitude <= 60; latitude += 30) {
    for (let longitude = -180; longitude < 180; longitude += 2) gridPoints.push(globePoint(longitude, latitude), globePoint(longitude + 2, latitude));
  }
  for (let longitude = -180; longitude < 180; longitude += 30) {
    for (let latitude = -90; latitude < 90; latitude += 2) gridPoints.push(globePoint(longitude, latitude), globePoint(longitude, latitude + 2));
  }
  const graticule = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(gridPoints), new THREE.LineBasicMaterial({color: 0x34495a, transparent: true, opacity: 0.30}));
  graticule.visible = false;
  scene.add(graticule);
  let queued = false;
  let frames = 0;
  function draw() {
    if (queued || document.hidden || disposed) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      if (document.hidden || disposed) return;
      celestial?.prepareFrame();
      renderer.render(scene, camera);
      celestial?.updateLabels();
      mapOverlays?.updateLabels();
      frames++;
    });
  }
  function resize() {
    const {width, height} = mount.getBoundingClientRect();
    const previousAspect = camera.aspect;
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
    celestial?.viewportChanged(previousAspect);
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.setSize(width, height, false);
    draw();
  }
  names.applyLabels(document);names.attachEditor();
  document.title=document.getElementById('globe-world-name').textContent+' · 球体';
  celestial = createCelestial({scene,planet,camera,controls,mount,payload,names,draw,surfaceUniforms:naturalSurface.uniforms,anisotropy:renderer.capabilities.getMaxAnisotropy()});
  if (celestial) celestial.spin.add(graticule);
  mapOverlays = createMapOverlays({planet,camera,mount,payload,names,draw,layers:layerValues,
    occluders:()=>celestial?.occluders()||[],
    onSelect:place=>{selectedPlace=place;updateRegionReadout();updateAtlasLink();},
    onError:error=>{status.textContent=`球面地图细节加载失败：${error.message}`;window.WorldAtlasMapLoading?.fail(status.textContent);}});
  const atlasLink=document.getElementById('atlas-link');
  let initialCamera=null;
  const returnRay=new THREE.Raycaster();
  const worldSphere=new THREE.Sphere(new THREE.Vector3(),1);
  const pixelsPerRadian=()=>mount.clientHeight/(2*Math.tan(camera.fov*Math.PI/360)*Math.max(.001,camera.position.length()-1));
  function centerCoordinates(){
    camera.updateMatrixWorld();planet.updateWorldMatrix(true,false);
    returnRay.setFromCamera(new THREE.Vector2(0,0),camera);
    const hit=returnRay.ray.intersectSphere(worldSphere,new THREE.Vector3());
    if(!hit)return null;
    planet.worldToLocal(hit).normalize();
    return[Math.atan2(-hit.z,hit.x)*180/Math.PI,Math.asin(Math.max(-1,Math.min(1,hit.y)))*180/Math.PI];
  }
  function updateAtlasLink(){
    planet.updateWorldMatrix(true,false);
    const changed=initialCamera&&(camera.position.distanceToSquared(initialCamera.position)>1e-18
      ||controls.target.distanceToSquared(initialCamera.target)>1e-18
      ||planet.matrixWorld.elements.some((value,index)=>Math.abs(value-initialCamera.surface[index])>1e-10));
    atlasLink.href=WorldAtlasViewState.flatLink({url:location.href,state:handoff,theme:selectedTheme,
      center:changed?centerCoordinates():null,pixelsPerRadian:pixelsPerRadian(),graticule:graticule.visible});
    if(selectedPlace&&/^(city|state|province|frontier|geography):/.test(selectedPlace.id)){
      const target=new URL(atlasLink.href,location.href);target.searchParams.set('place',selectedPlace.id);atlasLink.href=target.href;}
  }
  const regionReadout=document.createElement('div');regionReadout.id='globe-region';
  document.getElementById('globe-coordinates').before(regionReadout);
  function updateRegionReadout(){
    regionReadout.replaceChildren();if(!selectedPlace)return;
    const label=document.createElement('span');label.dataset.nameId=selectedPlace.id;label.textContent=names.get(selectedPlace.id)||selectedPlace.name;
    regionReadout.append(selectedPlace.id===handoff?.place?.id?'平面选中：':'选中地点：',label);
  }
  function applyHandoff(){
    if(!handoff)return;
    celestial?.resetCamera();
    const [longitude,latitude]=handoff.center,lat=latitude*Math.PI/180,lon=longitude*Math.PI/180;
    const normal=new THREE.Vector3(Math.cos(lat)*Math.cos(lon),Math.sin(lat),-Math.cos(lat)*Math.sin(lon));
    planet.updateWorldMatrix(true,false);normal.transformDirection(planet.matrixWorld);
    const focal=mount.clientHeight/(2*Math.tan(camera.fov*Math.PI/360));
    const distance=Math.max(controls.minDistance,1+focal/handoff.pixelsPerRadian);
    controls.maxDistance=Math.max(controls.maxDistance,distance*2);
    camera.far=Math.max(camera.far,distance*8);camera.updateProjectionMatrix();
    controls.target.set(0,0,0);camera.position.copy(normal).multiplyScalar(distance);
    // A global flat-map view has no close terrain detail to preserve. Keep
    // its geographic facing direction while fitting the saved moon system.
    // Regional handoffs retain their exact requested map scale.
    if(celestial&&!celestial.diagnostics().physical&&payload.astronomy?.satellites.length
        &&handoff.pixelsPerRadian*Math.PI<=Math.min(mount.clientWidth,mount.clientHeight))
      celestial.showMoons(normal);
    controls.update();initialCamera={position:camera.position.clone(),target:controls.target.clone(),surface:planet.matrixWorld.toArray()};
    graticule.visible=!!handoff.layers.graticule;document.getElementById('globe-graticule').checked=graticule.visible;
    updateRegionReadout();updateAtlasLink();draw();
  }
  async function selectTheme(key) {
    if (!Object.hasOwn(payload.textures, key)) throw new Error('未知的球体专题');
    selectedTheme = key;
    const currentSelection = ++selection;
    themeController?.abort();
    if (appliedTheme === key) {
      status.textContent = mapOverlays.diagnostics().loadError?'精细线条或地名暂不可用':'';
      return;
    }
    const controller = new AbortController();
    themeController = controller;
    status.textContent = '正在载入清晰球体…';
    if(key==='terrain'){
      const texture=await naturalSurface.load();
      if(selection!==currentSelection||disposed)return;
      texture.anisotropy=renderer.capabilities.getMaxAnisotropy();
      if(material.map!==naturalSurface.colorTexture)material.map?.dispose();
      material.map=texture;naturalSurface.setTheme(key);celestial?.setTheme(key);mapOverlays.setTheme(key);
      appliedTheme=key;material.needsUpdate=true;status.textContent='';updateAtlasLink();draw();return;
    }
    let sourceMarkup, shared;
    try {
      [sourceMarkup, shared] = await Promise.all([themeSource(key, controller.signal), loadSharedSources()]);
    } catch (error) {
      if (selection !== currentSelection || disposed || controller.signal.aborted) return;
      throw error;
    }
    if (selection !== currentSelection || disposed) return;
    // A failed detail download retains the complete original raster ink.
    // Remove an ink layer only after its same-world vector data are ready.
    // The terrain texture has no administrative ink to replace. Its first
    // frame can render while precise overlay geometry loads independently.
    if(key!=='terrain')await mapOverlays.ready.catch(()=>{});
    if (selection !== currentSelection || disposed) return;
    const {baseSurface, commonInk} = shared;
    const svg = composeGlobeSvg(baseSurface, commonInk, parseSvg(sourceMarkup), key);
    prepareGlobeSvg(svg);
    mapOverlays.stripRaster(svg);
    names.applyLabels(svg);
    svg.querySelectorAll('[id]').forEach(node=>{if(layerValues[node.id]===false)node.setAttribute('display','none');});
    if(layerValues['frozen-ground-surface']!==true)
      svg.querySelectorAll('[id="frozen-ground-surface"]').forEach(node=>node.setAttribute('display','none'));
    svg.setAttribute('width', textureWidth);
    svg.setAttribute('height', textureWidth / 2);
    // Explicit intrinsic dimensions make the browser rasterize vector edges at
    // texture resolution instead of enlarging the original simulation pixels.
    const source = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], {type:'image/svg+xml;charset=utf-8'}));
    let image;
    try {
      image = await new THREE.ImageLoader().loadAsync(source);
    } catch (error) {
      if (selection !== currentSelection || disposed) return;
      throw error;
    } finally {
      URL.revokeObjectURL(source);
    }
    // A slow previous selection must never overwrite the user's latest choice.
    if (selection !== currentSelection || disposed) return;
    const texture = new THREE.Texture(image);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    texture.wrapS = THREE.RepeatWrapping;
    texture.needsUpdate = true;
    // A full-resolution texture is large; keep only the visible theme on the GPU.
    if(material.map!==naturalSurface.colorTexture)material.map?.dispose();
    material.map = texture;
    naturalSurface.setTheme(key);
    celestial?.setTheme(key);
    mapOverlays.setTheme(key);
    appliedTheme = key;
    material.needsUpdate = true;
    status.textContent = mapOverlays.diagnostics().loadError?'精细线条或地名暂不可用':'';
    updateAtlasLink();
    draw();
  }
  controls.addEventListener('change', ()=>{draw();updateAtlasLink();});
  atlasLink.addEventListener('click',updateAtlasLink);
  const observer = new ResizeObserver(resize);
  observer.observe(mount);
  document.addEventListener('visibilitychange', draw);
  themeSelect.addEventListener('change', event => selectTheme(event.target.value).catch(error => { status.textContent = `纹理加载失败：${error.message}`; }));
  document.getElementById('globe-graticule').addEventListener('change', event => { graticule.visible = event.target.checked; updateAtlasLink();draw(); });
  const labelsToggle = document.getElementById('globe-labels-toggle');
  labelsToggle.addEventListener('click', () => {
    const hidden = mount.classList.toggle('globe-labels-hidden');
    labelsToggle.setAttribute('aria-pressed', String(!hidden));
    labelsToggle.textContent = hidden ? '显示标签' : '隐藏标签';
    draw();
  });
  const coordinates = document.getElementById('globe-coordinates');
  const raycaster = new THREE.Raycaster();
  let pointerStart = null;
  renderer.domElement.addEventListener('pointerdown', event => { pointerStart = {x: event.clientX, y: event.clientY}; });
  renderer.domElement.addEventListener('pointerup', event => {
    if (!pointerStart || Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 5) return;
    const bounds = renderer.domElement.getBoundingClientRect();
    raycaster.setFromCamera(new THREE.Vector2((event.clientX - bounds.left) / bounds.width * 2 - 1, 1 - (event.clientY - bounds.top) / bounds.height * 2), camera);
    const hit = raycaster.intersectObject(planet)[0];
    if (hit) {
      const latitude = hit.uv.y * 180 - 90, longitude = hit.uv.x * 360 - 180;
      coordinates.textContent = `${Math.abs(latitude).toFixed(2)}° ${latitude >= 0 ? 'N' : 'S'} · ${Math.abs(longitude).toFixed(2)}° ${longitude >= 0 ? 'E' : 'W'}`;
    }
  });
  document.getElementById('globe-reset').addEventListener('click', () => {
    if (celestial) { celestial.resetCamera(); return; }
    camera.position.set(0, 0.25, 3.4);
    controls.target.set(0, 0, 0);
    controls.update();
    draw();
  });
  window.WorldAtlasGlobeDiagnostics = () => ({frames, textures: renderer.info.memory.textures, geometries:renderer.info.memory.geometries,cachedThemeSources: themeSources.size, theme: selectedTheme, appliedTheme, textureWidth:material.map?.image.width||0, textureHeight:material.map?.image.height||0, naturalSurface:naturalSurface.diagnostics(),pixelRatio: renderer.getPixelRatio(), anisotropy: material.map?.anisotropy || 0, graticule: graticule.visible, vertices: planet.geometry.attributes.position.count, calls: renderer.info.render.calls, celestial:celestial?.diagnostics() || null, mapOverlays:mapOverlays.diagnostics(), names:names.exportSnapshot(),handoff:handoff?{worldId:handoff.worldId,requestedCenter:handoff.center,center:centerCoordinates(),requestedPixelsPerRadian:handoff.pixelsPerRadian,pixelsPerRadian:pixelsPerRadian(),layers:handoff.layers,placeId:selectedPlace?.id||null}:null});
  window.WorldAtlasGlobeDiagnostics.inspect = () => ({renderer,scene,camera,controls});
  window.addEventListener('pagehide', event => {
    if (event.persisted) return;
    disposed = true;
    mapOverlays.dispose();
    celestial?.dispose();
    names.destroy();
    themeController?.abort(); sharedController.abort(); themeSources.clear();
    observer.disconnect(); controls.dispose();
    if(material.map!==naturalSurface.colorTexture)material.map?.dispose();naturalSurface.dispose();
    planet.geometry.dispose(); material.dispose();
    graticule.geometry.dispose(); graticule.material.dispose(); renderer.dispose();
  });
  resize();
  applyHandoff();updateAtlasLink();
  selectTheme(selectedTheme).then(()=>{
    draw();return window.WorldAtlasMapLoading?.ready();
  }).catch(error => {status.textContent=`地图加载失败：${error.message}`;window.WorldAtlasMapLoading?.fail(status.textContent);});
} catch (error) {
  status.textContent = `此设备无法启用 WebGL 球体：${error.message}。平面地图仍可使用。`;
  window.WorldAtlasMapLoading?.fail(status.textContent);
}
