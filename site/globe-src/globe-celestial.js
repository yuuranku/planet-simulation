import * as THREE from 'three';
import {celestialScales,motionAt,orbitPosition,simulationClock,displaySpinAngle,satelliteSpinAngle,satelliteSpinPeriod} from './globe-motion.js';
import {solarLightingGLSL,ringLightingGLSL,ringShadowGLSL,solarAngularRadius} from './globe-lighting.js';
import {createStarMaterial,createStarGlow,stellarRotationPerDisplayHour} from './globe-star.js';
import {createRingGeometry,createRingMaterial,createOrbitMaterial} from './globe-rings.js';
import {celestialDisplayName} from './globe-names.js';
import {createGlobeEnvironment} from './globe-environment.js';
import {createGlobeRelief,reliefLightingGLSL} from './globe-relief.js';
import {cloudShadowGLSL} from './globe-environment.js';
import {naturalSurfaceLightingGLSL} from './globe-surface-lighting.js';

// Keep the same Standard-material BRDF and saved stellar direction. Companion
// planets receive no blue studio ambient light on their unilluminated side.
export function configureCompanionMaterial(material,{solar,shadows,dayNight,isMoon}){
  const companion={value:isMoon?0:1};
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,solar,shadows,{atlasDayNight:dayNight,atlasCompanionPlanet:companion});
    shader.vertexShader='varying vec3 atlasBodyPosition;\n'+shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\natlasBodyPosition=(modelMatrix*vec4(transformed,1.0)).xyz;');
    shader.fragmentShader=solarLightingGLSL+ringLightingGLSL+ringShadowGLSL+'\nvarying vec3 atlasBodyPosition;uniform float atlasDayNight;uniform float atlasCompanionPlanet;\n'+shader.fragmentShader
      .replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
        if(atlasDayNight>0.5){
          vec3 toStar=atlasStarPosition-atlasBodyPosition;float starDistance=length(toStar);vec3 sun=toStar/starDistance;
          float visibility=atlasSphereVisibility(atlasBodyPosition,vec3(0.0),1.0,sun,starDistance)*atlasRingTransmission(atlasBodyPosition,sun,starDistance);
          reflectedLight.directDiffuse*=visibility;reflectedLight.directSpecular*=visibility;
        }`)
      .replace('#include <opaque_fragment>',`if(atlasCompanionPlanet>.5){
          // All surface maps are reflectance colour, never emission or height.
          // Keep a small neutral visibility floor without lighting the nightside
          // with the main world's blue ambient or fabricating an atmosphere.
          outgoingLight=reflectedLight.directDiffuse+reflectedLight.directSpecular+diffuseColor.rgb*.001;
        }
        outgoingLight=mix(diffuseColor.rgb,outgoingLight,atlasDayNight);
        #include <opaque_fragment>`);
  };
}

// This layer adds a small saved scene. It never supplies the main world's map.
export function createCelestial({scene,planet,camera,controls,mount,payload,names,draw,surfaceUniforms={},anisotropy=1}){
  const config=payload.astronomy;
  if(!config)return null;
  const ui=id=>document.getElementById(id),status=ui('celestial-status');
  const axis=new THREE.Group(),spin=new THREE.Group();axis.rotation.z=config.axialTiltDegrees*Math.PI/180;
  axis.add(spin);spin.add(planet);scene.add(axis);
  planet.name='main-world';
  const group=new THREE.Group();scene.add(group);
  const moonGroup=new THREE.Group(),systemGroup=new THREE.Group();group.add(moonGroup,systemGroup);
  const labels=document.createElement('div');labels.id='celestial-labels';mount.appendChild(labels);
  const savedKey=`world-atlas-celestial:${payload.gridDigest}:${config.seed}`;
  if(config.mainRing.enabled&&config.satellites.length)throw new Error('主世界星环与卫星互斥');
  const initial={hours:0,speed:1,physical:false,dayNight:true,orbits:true,ring:config.mainRing.enabled,focus:config.satellites.length?'moons':'world'};
  let stored=null;
  try{stored=JSON.parse(localStorage.getItem(savedKey));}catch{}
  const state={...initial};
  if(stored&&stored.schema==='world-atlas-celestial-view-v2'){
    for(const key of ['physical','dayNight','orbits','ring'])if(typeof stored[key]==='boolean')state[key]=stored[key];
    if(Number.isFinite(stored.hours)&&stored.hours>=0)state.hours=stored.hours;
    if([.25,1,config.rotationPeriodHours,config.rotationPeriodHours*7].includes(stored.speed))state.speed=stored.speed;
    if(['world','moons','system'].includes(stored.focus))state.focus=stored.focus;
  }
  state.ring=state.ring&&config.mainRing.enabled;
  if(state.physical&&state.focus==='system')state.focus='world';
  if(!config.satellites.length&&state.focus==='moons')state.focus='world';
  let scale=celestialScales(config,state.physical,state.focus);
  let disposed=false,playing=true,animation=null,lastFrame=0,failures=0,pendingAssets=0,completedAssets=0;
  const clock=simulationClock(state.hours),textures=new Map(),bitmaps=new Set(),assetControllers=new Set(),owned=new Set(),assetFailures=[];
  const eventController=new AbortController();
  const starPosition=new THREE.Vector3(),starUniform={value:starPosition};
  const angularRadius=solarAngularRadius(config,config.star.physicalMainOrbitKm);
  const solarUniforms={atlasStarPosition:starUniform,atlasSolarAngularRadius:{value:angularRadius},
    atlasSolarDiskRadius:{value:Math.sin(angularRadius)},atlasSolarTangent:{value:Math.tan(angularRadius)}};
  const ringUniforms={atlasRingTexture:{value:null},atlasRingTextureReady:{value:0},atlasRingEnabled:{value:0},
    atlasRingCenter:{value:new THREE.Vector3()},atlasRingNormal:{value:new THREE.Vector3()},atlasRingInner:{value:config.mainRing.innerRadiusRatio},atlasRingOuter:{value:config.mainRing.outerRadiusRatio}};
  const nightUniform={value:state.dayNight?1:0},terrainUniform={value:1};
  const relief=createGlobeRelief({payload,north:new THREE.Vector3(0,1,0).applyQuaternion(axis.quaternion),draw});
  planet.material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,solarUniforms,ringUniforms,relief.uniforms,surfaceUniforms,environment.cloudUniforms,{atlasDayNight:nightUniform,atlasTerrain:terrainUniform});
    // The authoritative world is a unit sphere at the origin with rotations
    // only: its radial world position is its normal. Keep one varying.
    shader.vertexShader='varying vec3 atlasPosition;varying vec2 atlasReliefUv;\n'+shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\natlasPosition=(modelMatrix*vec4(transformed,1.0)).xyz;atlasReliefUv=uv;');
    shader.fragmentShader=solarLightingGLSL+ringLightingGLSL+ringShadowGLSL+reliefLightingGLSL+cloudShadowGLSL+'\nuniform sampler2D atlasWaterTexture;\n'+naturalSurfaceLightingGLSL+'\nvarying vec3 atlasPosition;uniform float atlasDayNight;uniform float atlasTerrain;uniform float atlasNaturalSurface;\n'+shader.fragmentShader.replace('#include <opaque_fragment>',
      `if(atlasDayNight>0.5){
       vec3 atlasN=normalize(atlasPosition),atlasV=normalize(cameraPosition-atlasPosition),atlasToStar=atlasStarPosition-atlasPosition;
       float atlasStarDistance=length(atlasToStar);vec3 atlasSun=atlasToStar/atlasStarDistance;
       float atlasDay=dot(atlasN,atlasSun);
       if(atlasTerrain>.5&&atlasNaturalSurface>.5){
         outgoingLight=atlasNaturalSurfaceLight(diffuseColor.rgb,atlasN,atlasV,atlasSun,atlasStarDistance,atlasReliefUv);
       }else{
         float atlasDirect=atlasSolarDiffuse(atlasDay);
         float atlasTransmission=atlasDirect>0.0?atlasRingTransmission(atlasPosition,atlasSun,atlasStarDistance):1.0;
         outgoingLight*=.018+.07*smoothstep(-.16,.25,atlasDay)+1.08*atlasDirect*atlasTransmission;
       }
       }
       #include <opaque_fragment>`);
  };
  planet.material.needsUpdate=true;
  // Constant display irradiance; direction is local to the one saved star,
  // including planets that orbit to its opposite side.
  const sunlight=new THREE.PointLight(0xfff3df,3,0,0),ambient=new THREE.AmbientLight(0x9bb5cf,.14);
  group.add(sunlight,ambient);
  const starMaterial=createStarMaterial();
  const star=new THREE.Mesh(new THREE.SphereGeometry(1,64,64),starMaterial);
  star.name=config.star.id;
  systemGroup.add(star);owned.add(star);
  const starGlow=createStarGlow();star.add(starGlow);owned.add(starGlow);
  textures.set('star:glow',starGlow.material.map);
  // Paint orbital annotations before opaque bodies, preserving quiet ink.
  // Foreground orbital arcs then cannot stripe a solar or planetary disk.
  const ringCount=Math.max(1,(config.mainRing.enabled?1:0)+config.planets.filter(item=>item.ring).length);
  const orbitRingCenters={value:Array.from({length:ringCount},()=>new THREE.Vector4())};
  const orbitRingNormals={value:Array.from({length:ringCount},()=>new THREE.Vector4())};
  const orbitMaterial=()=>createOrbitMaterial({ringTexture:ringUniforms.atlasRingTexture,
    ringTextureReady:ringUniforms.atlasRingTextureReady,centers:orbitRingCenters,normals:orbitRingNormals});
  const mainOrbit=new THREE.LineLoop(new THREE.BufferGeometry(),orbitMaterial());
  mainOrbit.renderOrder=-1;
  mainOrbit.name='main-world-orbit';group.add(mainOrbit);owned.add(mainOrbit);
  const environment=createGlobeEnvironment({scene,axis,spin,camera,mount,identity:payload.gridDigest,
    naturalSurface:payload.naturalSurface,gridDigest:payload.gridDigest,solar:solarUniforms,ring:ringUniforms,dayNight:nightUniform,draw,anisotropy});
  function displayName(definition){return names?.get('celestial:'+definition.id)||celestialDisplayName(definition.name,definition.id);}
  function label(definition){const node=document.createElement('span');node.textContent=displayName(definition);
    node.dataset.nameId='celestial:'+definition.id;node.dataset.celestialId=definition.id;labels.appendChild(node);return node;}
  const starLabel=label(config.star);
  const ringBodies=[];
  function ring(parent,inner,outer,body,bodySolar=solarUniforms,shadows=ringUniforms){
    const geometry=createRingGeometry(inner,outer);
    const uniforms={...bodySolar,atlasRingTexture:ringUniforms.atlasRingTexture,atlasRingTextureReady:ringUniforms.atlasRingTextureReady,
      atlasBodyCenter:shadows.atlasRingCenter,atlasBodyRadius:{value:1},atlasRingNormal:shadows.atlasRingNormal,atlasDayNight:nightUniform};
    const material=createRingMaterial(uniforms);
    const mesh=new THREE.Mesh(geometry,material);
    mesh.name=body.name+'-ring';mesh.rotation.x=-Math.PI/2;parent.add(mesh);owned.add(mesh);
    ringBodies.push({mesh,body,shadows,inner,outer});return mesh;
  }
  const mainRing=config.mainRing.enabled?ring(axis,config.mainRing.innerRadiusRatio,config.mainRing.outerRadiusRatio,planet):null;
  function body(definition,parent,isMoon){
    const geometry=new THREE.SphereGeometry(1,64,32);
    const offset=isMoon?0:
      ((config.seed>>>0)%997/997+Number(definition.id.split('-')[1])*.38196601125)%1;
    if(offset){const uv=geometry.attributes.uv;for(let i=0;i<uv.count;i++)uv.setX(i,uv.getX(i)+offset);}
    const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:0xffffff,roughness:.96,bumpScale:.008}));
    mesh.name=definition.id;
    if(!isMoon){
      mesh.rotation.order='ZYX';
      mesh.rotation.z=definition.axialTiltDegrees*Math.PI/180;
    }
    const solar={atlasStarPosition:starUniform,atlasSolarAngularRadius:{value:angularRadius},
      atlasSolarDiskRadius:{value:Math.sin(angularRadius)},atlasSolarTangent:{value:Math.tan(angularRadius)}};
    const shadows={...ringUniforms,atlasRingEnabled:{value:definition.ring?1:0},atlasRingCenter:{value:new THREE.Vector3()},
      atlasRingNormal:{value:new THREE.Vector3()},atlasRingInner:{value:1.3},atlasRingOuter:{value:2}};
    configureCompanionMaterial(mesh.material,{solar,shadows,dayNight:nightUniform,isMoon});
    parent.add(mesh);owned.add(mesh);
    const orbit=new THREE.LineLoop(new THREE.BufferGeometry(),orbitMaterial());
    orbit.renderOrder=-1;
    orbit.name=definition.id+'-orbit';
    parent.add(orbit);owned.add(orbit);
    const rings=definition.ring?ring(mesh,1.3,2,mesh,solar,shadows):null;
    const node=label(definition);
    return{mesh,orbit,rings,definition,isMoon,solar,
      physicalStarDistanceKm:config.star.physicalMainOrbitKm,label:node};
  }
  const moons=config.satellites.map(definition=>body(definition,moonGroup,true));
  const planets=config.planets.map(definition=>body(definition,systemGroup,false));
  const all=[...moons,...planets];
  function buildOrbit(item,index){
    const {definition,orbit}=item;
    const mapped=item.isMoon?scale.satellites[index]:scale.planets[index-moons.length];
    const points=Array.from({length:128},(_,index)=>{
      const angle=index/128*Math.PI*2;return new THREE.Vector3(...orbitPosition(config,definition,angle,state.physical,[0,0,0],mapped.orbit));
    });
    orbit.geometry.dispose();orbit.geometry=new THREE.BufferGeometry().setFromPoints(points);
    item.mesh.scale.setScalar(mapped.radius);
  }
  function buildGeometry(){
    scale=celestialScales(config,state.physical,state.focus);
    star.scale.setScalar(scale.star.radius);
    mainOrbit.geometry.dispose();
    mainOrbit.geometry=new THREE.BufferGeometry().setFromPoints(Array.from({length:128},(_,index)=>{
      const angle=index/128*Math.PI*2;
      return new THREE.Vector3(scale.star.orbit*Math.cos(angle),0,-scale.star.orbit*Math.sin(angle));
    }));
    all.forEach(buildOrbit);
  }
  function save(){
    if(disposed)return;
    try{localStorage.setItem(savedKey,JSON.stringify({schema:'world-atlas-celestial-view-v2',...state,hours:clock.hours}));}
    catch{status.textContent='天体显示设置未能保存；世界生成记录仍保留原始天体参数。';}
  }
  function updateLabels(){
    if(disposed)return;
    const bounds=mount.getBoundingClientRect();
    camera.updateMatrixWorld();scene.updateMatrixWorld();
    const right=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0);
    const visibleMesh=mesh=>{for(let node=mesh;node;node=node.parent)if(!node.visible)return false;return true;};
    const occluding=[planet,star,...all.map(item=>item.mesh)].filter(visibleMesh).map(mesh=>({mesh,
      sphere:new THREE.Sphere(mesh.getWorldPosition(new THREE.Vector3()),mesh.geometry.parameters.radius*mesh.getWorldScale(new THREE.Vector3()).x)}));
    const sight=new THREE.Ray(),hit=new THREE.Vector3(),placements=[];sight.origin.copy(camera.position);
    for(const {mesh,label:node} of [...all,{mesh:star,label:starLabel}]){
      const center=mesh.getWorldPosition(new THREE.Vector3()),position=center.clone().project(camera);
      const radius=mesh.geometry.parameters.radius*mesh.getWorldScale(new THREE.Vector3()).x;
      const anchor=center.clone().addScaledVector(right,radius).project(camera);
      let ancestor=mesh,visible=true;while(ancestor){if(!ancestor.visible){visible=false;break;}ancestor=ancestor.parent;}
      const pixelRadius=Math.abs(anchor.x-position.x)*bounds.width/2;
      visible=visible&&pixelRadius>=1&&position.z>=-1&&position.z<=1&&Math.abs(position.x)<=1&&Math.abs(position.y)<=1;
      const direction=center.clone().sub(camera.position),distance=direction.length();direction.normalize();
      sight.direction.copy(direction);
      if(visible&&occluding.some(item=>item.mesh!==mesh&&sight.intersectSphere(item.sphere,hit)
          &&camera.position.distanceTo(hit)<distance-radius-1e-10))visible=false;
      placements.push({node,visible,edgeX:(anchor.x+1)*bounds.width/2,
        centerX:(position.x+1)*bounds.width/2,centerY:(1-position.y)*bounds.height/2,pixelRadius});
    }
    // Apply visibility together, then read every label size before writing any
    // transforms. Newly visible labels participate in this one layout pass.
    for(const item of placements)if(item.node.hidden===item.visible)item.node.hidden=!item.visible;
    const measured=placements.map(item=>({...item,width:item.visible?item.node.offsetWidth:0,height:item.visible?item.node.offsetHeight:0}));
    const padding=4,gap=6,clamp=(value,maximum)=>Math.max(padding,Math.min(value,maximum-padding));
    for(const {node,visible,edgeX,centerX,centerY,pixelRadius,width,height} of measured){
      const left=edgeX+gap+width>bounds.width-padding;
      let x=left?centerX-pixelRadius-gap-width:edgeX+gap,y=centerY-height/2;
      x=clamp(x,bounds.width-width);y=clamp(y,bounds.height-height);
      // If neither side has enough room, keep the label away from the body's
      // centre by using vertical space before clamping to the viewport.
      if(x<=centerX&&x+width>=centerX&&y<=centerY&&y+height>=centerY){
        const above=centerY-pixelRadius-gap-height,below=centerY+pixelRadius+gap;
        y=clamp(above>=padding?above:below+height<=bounds.height-padding?below:
          centerY>bounds.height/2?centerY-gap-height:centerY+gap,bounds.height-height);
      }
      node.hidden=!visible||width>bounds.width-2*padding||height>bounds.height-2*padding;
      node.style.transform=`translate(${x}px,${y}px)`;
      node.dataset.anchorX=String(x);node.dataset.anchorY=String(y);
      node.dataset.centerX=String(centerX);node.dataset.centerY=String(centerY);
      node.dataset.edgeX=String(edgeX);node.dataset.radiusPx=String(pixelRadius);
      node.dataset.side=left?'left':'right';
    }
  }
  function motion(){
    const value=motionAt(config,clock.hours,state.physical,scale);
    spin.rotation.y=value.spin;starPosition.set(...value.star);sunlight.position.copy(starPosition);
    environment.update(clock.hours);
    star.position.copy(starPosition);
    star.rotation.y=clock.hours*stellarRotationPerDisplayHour;
    mainOrbit.position.copy(star.position);
    for(const [items,positions] of [[moons,value.moons],[planets,value.planets]])positions.forEach((position,index)=>{
      const item=items[index];item.mesh.position.set(...position.position);
      item.mesh.rotation.y=item.isMoon?satelliteSpinAngle(config,item.definition,clock.hours,state.physical):displaySpinAngle(item.definition,clock.hours);
      if(!item.isMoon)item.orbit.position.copy(star.position);
      const physicalPosition=item.isMoon?orbitPosition(config,item.definition,position.phase,true):null;
      item.physicalStarDistanceKm=item.isMoon?Math.hypot(...physicalPosition.map((coordinate,axis)=>
        coordinate*config.radiusKm-value.sun[axis]*config.star.physicalMainOrbitKm)):item.definition.physicalOrbitKm;
      item.solar.atlasSolarAngularRadius.value=solarAngularRadius(config,item.physicalStarDistanceKm);
      item.solar.atlasSolarDiskRadius.value=Math.sin(item.solar.atlasSolarAngularRadius.value);
      item.solar.atlasSolarTangent.value=Math.tan(item.solar.atlasSolarAngularRadius.value);
    });
    updateRings();
    const minute=Math.floor(value.hour%1*60);
    ui('globe-time').textContent=`第${value.day}日 ${String(Math.floor(value.hour)).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;
  }
  function updateRings(){
    for(const [index,item] of ringBodies.entries()){
      item.body.getWorldPosition(item.mesh.material.uniforms.atlasBodyCenter.value);
      const radius=item.body.getWorldScale(new THREE.Vector3()).x;
      item.mesh.material.uniforms.atlasBodyRadius.value=radius;
      item.shadows.atlasRingInner.value=item.inner*radius;item.shadows.atlasRingOuter.value=item.outer*radius;
      item.shadows.atlasRingNormal.value.set(0,0,1).applyQuaternion(item.mesh.getWorldQuaternion(new THREE.Quaternion()));
      let visible=true;for(let node=item.mesh;node;node=node.parent)if(!node.visible)visible=false;
      orbitRingCenters.value[index].set(...item.mesh.material.uniforms.atlasBodyCenter.value.toArray(),visible?item.outer*radius:0);
      orbitRingNormals.value[index].set(...item.shadows.atlasRingNormal.value.toArray(),item.inner*radius);
    }
    if(mainRing)ringUniforms.atlasRingNormal.value.set(0,0,1).applyQuaternion(mainRing.getWorldQuaternion(new THREE.Quaternion()));
  }
  function frameCamera(direction=null){
    const center=new THREE.Vector3();
    const worldFraming=mainRing?.visible?config.mainRing.outerRadiusRatio:1;
    const moonFraming=Math.max(worldFraming,scale.moonEnvelope);
    let radius=state.focus==='moons'?moonFraming:worldFraming;
    if(state.focus==='system'&&!state.physical){
      center.copy(star.position);
      radius=Math.max(scale.star.radius,scale.star.orbit+moonFraming,
        ...planets.map((item,index)=>scale.planets[index].orbit+item.mesh.scale.x*(item.rings?2:1)));
    }
    const halfFov=Math.atan(Math.tan(camera.fov*Math.PI/360)*Math.min(1,camera.aspect));
    const distance=radius*(state.focus==='world'?1.07:1.12)/Math.sin(halfFov);
    const orientation=direction?.clone()||new THREE.Vector3(0,state.focus==='world'?.5:.6,1);
    controls.target.copy(center);camera.position.copy(center).add(orientation.normalize().multiplyScalar(distance));
    camera.far=Math.max(100,distance*8);camera.updateProjectionMatrix();controls.maxDistance=Math.max(5.5,distance*2);controls.update();draw();
  }
  function apply(reframe=true){
    moonGroup.visible=config.satellites.length>0;systemGroup.visible=!state.physical;
    if(mainRing)mainRing.visible=state.ring;
    ringUniforms.atlasRingEnabled.value=mainRing?.visible?1:0;
    for(const item of planets){item.mesh.visible=config.extraPlanetsEnabled;item.orbit.visible=config.extraPlanetsEnabled&&state.orbits;}
    for(const item of moons)item.orbit.visible=state.orbits;
    mainOrbit.visible=state.orbits;
    nightUniform.value=state.dayNight?1:0;
    environment.refresh();
    if(ui('globe-ring'))ui('globe-ring').checked=state.ring;
    if(ui('globe-orbits')){ui('globe-orbits').textContent=state.orbits?'隐藏轨道':'显示轨道';ui('globe-orbits').setAttribute('aria-pressed',String(state.orbits));}
    ui('globe-day-night').checked=state.dayNight;
    ui('globe-scale').value=state.physical?'physical':'schematic';ui('globe-focus').value=state.focus;
    ui('globe-focus').querySelector('[value="system"]').disabled=state.physical;
    ui('globe-focus').querySelector('[value="moons"]').disabled=!moons.length;
    ui('celestial-scale-note').textContent=state.physical?
      (state.focus==='moons'?'卫星总览采用真实公里比例。卫星轨道较远，主世界因此显得很小；可切回主世界近景。':'主世界近景 · 天体半径和轨道距离共用真实公里比例；卫星通常位于画面外。'):
      (state.focus==='system'?'恒星系统示意 · 天体大小单独缩放；主世界卫星使用局部参考系。距离和大小请查看真实比例。':'局部示意 · 天体大小与轨道距离单独缩放，不能据画面量取物理距离。');
    if(reframe||scale.scope!==state.focus||scale.mode!==(state.physical?'physical-kilometres':'schematic')){buildGeometry();motion();}
    else updateRings();
    if(reframe)frameCamera();else draw();
    save();
  }
  function schedule(){if(playing&&!document.hidden&&!disposed&&animation===null)animation=requestAnimationFrame(animate);}
  function animate(now){
    animation=null;if(!playing||document.hidden||disposed)return;
    clock.tick(now,state.speed);
    if(now-lastFrame>=1000/30){lastFrame=now;motion();draw();}
    schedule();
  }
  function event(id,type,handler){ui(id)?.addEventListener(type,handler,{signal:eventController.signal});}
  event('globe-play','click',()=>{
    playing=!playing;clock.suspend();ui('globe-play').textContent=playing?'暂停':'播放';ui('globe-play').setAttribute('aria-pressed',String(playing));
    if(!playing){
      if(animation!==null)cancelAnimationFrame(animation);animation=null;
      motion();draw();save();
    }
    schedule();
  });
  const speedOptions=ui('globe-speed').options;
  speedOptions[2].value=String(config.rotationPeriodHours);speedOptions[3].value=String(config.rotationPeriodHours*7);
  ui('globe-speed').value=String(state.speed);
  event('globe-speed','change',event=>{state.speed=Number(event.target.value);clock.suspend();save();});
  event('globe-orbits','click',()=>{state.orbits=!state.orbits;apply(false);});
  for(const [id,key] of [['globe-day-night','dayNight'],['globe-ring','ring']])
    event(id,'change',event=>{state[key]=event.target.checked;apply(false);});
  event('globe-scale','change',event=>{state.physical=event.target.value==='physical';if(state.physical&&state.focus==='system')state.focus='world';apply();});
  event('globe-focus','change',event=>{state.focus=event.target.value;apply();});
  event('globe-show-moons','click',()=>{state.focus='moons';apply();});
  document.addEventListener('visibilitychange',()=>{
    clock.suspend();if(document.hidden&&animation!==null){cancelAnimationFrame(animation);animation=null;}else schedule();
  },{signal:eventController.signal});

  async function bitmap(asset,taskSignal){
    if(!asset||!['png','jpeg'].includes(asset.format)||!Number.isInteger(asset.width)||!Number.isInteger(asset.height)
        ||asset.width<1||asset.height<1||asset.width>(asset===appearances.ring?4096:2048)||asset.height>1024||asset.width*asset.height>2097152
        ||!Number.isInteger(asset.bytes)||asset.bytes<1||asset.bytes>2*1024*1024||!/^[a-f0-9]{64}$/.test(asset.sha256))
      throw new Error('天体材质清单无效');
    const response=await fetch(asset.url,{signal:taskSignal,cache:'no-cache'});
    if(!response.ok)throw new Error(`天体材质 HTTP ${response.status}`);
    const reader=response.body.getReader(),parts=[];let bytes=0;
    try{
      while(true){const {done,value}=await reader.read();if(taskSignal.aborted)throw new DOMException('Cancelled texture','AbortError');if(done)break;
        bytes+=value.byteLength;if(bytes>2*1024*1024)throw new Error('天体素材超出限额');parts.push(value);}
    }catch(error){await reader.cancel().catch(()=>{});throw error;}finally{reader.releaseLock();}
    let abort,accepted=false;
    const blob=new Blob(parts,{type:asset.format==='png'?'image/png':'image/jpeg'});
    if(bytes!==asset.bytes)throw new Error('天体材质字节数与清单不一致');
    const actual=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer())),
      value=>value.toString(16).padStart(2,'0')).join('');
    if(actual!==asset.sha256)throw new Error('天体材质校验失败');
    const header=new DataView(await blob.slice(0,24).arrayBuffer());
    if(asset.format==='png'?(header.byteLength<24||header.getUint32(0)!==0x89504e47||header.getUint32(4)!==0x0d0a1a0a
        ||header.getUint32(16)!==asset.width||header.getUint32(20)!==asset.height):
        (header.byteLength<3||header.getUint16(0)!==0xffd8||header.getUint8(2)!==0xff))throw new Error('天体材质编码无效');
    const decoded=createImageBitmap(blob,{premultiplyAlpha:'none',colorSpaceConversion:'none',imageOrientation:'flipY'});
    decoded.then(image=>{if(!accepted&&taskSignal.aborted)image.close();},()=>{});
    try{
      const image=await Promise.race([decoded,new Promise((resolve,reject)=>{
        abort=()=>reject(new DOMException('Cancelled texture','AbortError'));taskSignal.addEventListener('abort',abort,{once:true});
        if(taskSignal.aborted)abort();
      })]);
      if(image.width!==asset.width||image.height!==asset.height){image.close();throw new Error('无效天体材质尺寸');}
      accepted=true;bitmaps.add(image);return image;
    }finally{taskSignal.removeEventListener('abort',abort);}
  }
  const appearances=payload.celestialAssets,groups=new Map();
  if(appearances?.schema!=='world-atlas-celestial-assets-v5')throw new Error('天体材质清单版本无效');
  for(const item of all){
    const assets=appearances[item.isMoon?'textures':'planetTextures'][item.definition.textureId];
    const key=assets?Object.entries(assets).map(([kind,asset])=>kind+':'+asset.sha256).sort().join('|'):item.definition.textureId;
    if(!groups.has(key))groups.set(key,{key,assets,items:[]});
    groups.get(key).items.push(item);
  }
  const queue=[...groups.values()];
  if(mainRing||planets.some(item=>item.rings))queue.push({key:'ring',assets:{color:appearances.ring}});
  queue.push({key:'star',assets:{color:appearances.star}});
  // These are encoded library and decoded RGBA payload budgets, not total
  // browser/GPU memory. Reserve before starting either concurrent worker.
  let assetBytes=0,assetDecodedBytes=0;
  for(const task of queue)for(const asset of Object.values(task.assets||{})){
    assetBytes+=asset?.bytes||0;assetDecodedBytes+=(asset?.width||0)*(asset?.height||0)*4;
  }
  // Eight companion planets plus eight distinct moons fit these fixed caps.
  const assetBudgetValid=assetBytes<=6*1024*1024&&assetDecodedBytes<=64*1024*1024;
  async function worker(){
    while(queue.length&&!disposed){
      const task=queue.shift(),taskController=new AbortController();assetControllers.add(taskController);pendingAssets++;
      try{
        const loaded={};
        if(!assetBudgetValid||!task.assets?.color)throw new Error('天体材质清单无效');
        for(const [kind,asset] of Object.entries(task.assets)){
          if(!['color','height'].includes(kind))throw new Error('未知天体材质通道');
          const image=await bitmap(asset,taskController.signal);
          if(disposed||taskController.signal.aborted){image.close();bitmaps.delete(image);throw new DOMException('Closed scene','AbortError');}
          const texture=new THREE.Texture(image);texture.colorSpace=kind==='color'?THREE.SRGBColorSpace:THREE.NoColorSpace;
          if(task.key==='star')texture.anisotropy=2;
          texture.wrapS=task.key==='ring'?THREE.ClampToEdgeWrapping:THREE.RepeatWrapping;texture.needsUpdate=true;textures.set(`${task.key}:${kind}`,texture);loaded[kind]=texture;
        }
        if(task.key==='star'){starMaterial.map=loaded.color;starMaterial.needsUpdate=true;}
        else if(task.key==='ring'){ringUniforms.atlasRingTexture.value=loaded.color;ringUniforms.atlasRingTextureReady.value=1;}
        else for(const item of task.items){
          item.mesh.material.map=loaded.color;item.mesh.material.bumpMap=loaded.height||null;item.mesh.material.needsUpdate=true;
          item.label.dataset.textureLoaded='true';item.label.dataset.textureId=item.definition.textureId;
        }
        completedAssets++;draw();
      }catch(error){
        if(!disposed){
          failures++;
          const failure={bodies:task.items?.map(item=>item.definition.id)||[task.key],
            message:error?.message||String(error),aborted:taskController.signal.aborted};
          for(const item of task.items||[]){item.label.dataset.textureLoaded='false';item.label.dataset.textureId=item.definition.textureId;}
          assetFailures.push(failure);console.warn('天体材质载入失败',failure,error);
          status.textContent='部分天体材质未载入，已使用基础外观。';
        }
      }finally{assetControllers.delete(taskController);pendingAssets--;}
    }
  }
  function dispose(){
    if(disposed)return;save();disposed=true;playing=false;eventController.abort();
    if(animation!==null)cancelAnimationFrame(animation);animation=null;
    for(const item of assetControllers)item.abort();queue.length=0;
    environment.dispose();
    relief.dispose();
    for(const texture of textures.values())texture.dispose();textures.clear();
    for(const image of bitmaps)image.close();bitmaps.clear();
    for(const item of owned){item.geometry.dispose();item.material.dispose();}owned.clear();
    labels.remove();group.removeFromParent();axis.removeFromParent();
    window.removeEventListener('pagehide',dispose);
  }
  // Register before starting any optional network or decode work.
  window.addEventListener('pagehide',dispose);
  apply();ui('globe-play').textContent='暂停';ui('globe-play').setAttribute('aria-pressed','true');schedule();queueMicrotask(()=>{worker();worker();});
  function prepareFrame(){environment.refresh();const focal=mount.clientHeight/(2*Math.tan(camera.fov*Math.PI/360));
    relief.refresh(focal/Math.sqrt(Math.max(.001,camera.position.lengthSq()-1)),terrainUniform.value>.5);}
  return{spin,updateLabels,prepareFrame,frameCamera,dispose,refreshNames(){starLabel.textContent=displayName(config.star);
    for(const item of all)item.label.textContent=displayName(item.definition);updateLabels();draw();},setTheme:key=>{terrainUniform.value=key==='terrain'?1:0;environment.setTheme(key);},
    occluders:()=>[star,...all.map(item=>item.mesh)].filter(mesh=>{
      for(let node=mesh;node;node=node.parent)if(!node.visible)return false;
      return true;
    }),
    viewportChanged(previousAspect){
      const ratio=Math.min(1,previousAspect)/Math.min(1,camera.aspect);
      camera.position.sub(controls.target).multiplyScalar(ratio).add(controls.target);
      controls.maxDistance=Math.max(5.5,camera.position.distanceTo(controls.target)*2);controls.update();environment.resize();
    },
    resetCamera(){state.focus='world';apply();},showMoons(direction=null){if(!moons.length)return;state.focus='moons';apply(false);frameCamera(direction);},diagnostics:()=>({playing,simulationHours:clock.hours,rotation:spin.rotation.y,
      sceneIdentity:payload.celestialScene?{worldGridDigest:payload.celestialScene.worldGridDigest,baseAstronomySha256:payload.celestialScene.baseAstronomySha256,sceneSha256:payload.celestialScene.sceneSha256}:null,
    physical:state.physical,focus:state.focus,dayNight:state.dayNight,orbits:state.orbits,ring:Boolean(mainRing?.visible),planetsVisible:config.extraPlanetsEnabled&&!state.physical,
    environment:environment.diagnostics(),relief:relief.diagnostics(),
    displayScale:{...scale,physicalWorldRadiusKm:config.radiusKm,physicalStarRadiusKm:config.star.physicalRadiusKm,
      physicalMainOrbitKm:config.star.physicalMainOrbitKm,
      satellites:scale.satellites.map((mapped,index)=>({id:config.satellites[index].id,...mapped,physicalRadiusKm:config.satellites[index].physicalRadiusKm,physicalOrbitKm:config.satellites[index].physicalOrbitKm})),
      planets:scale.planets.map((mapped,index)=>({id:config.planets[index].id,...mapped,physicalRadiusKm:config.planets[index].physicalRadiusKm,physicalOrbitKm:config.planets[index].physicalOrbitKm}))},
    orbitLines:[{id:'main-world-orbit',visible:mainOrbit.visible,vertices:mainOrbit.geometry.attributes.position.count,displayRadius:scale.star.orbit,physicalOrbitKm:config.star.physicalMainOrbitKm},
      ...all.map(item=>({id:item.orbit.name,visible:item.orbit.visible&&(item.isMoon?moonGroup.visible:systemGroup.visible),vertices:item.orbit.geometry.attributes.position.count}))],
    lighting:{starPosition:starPosition.toArray(),solarAngularRadius:angularRadius,ringNormal:ringUniforms.atlasRingNormal.value.toArray(),ringTextureReady:ringUniforms.atlasRingTextureReady.value,
      ringInner:config.mainRing.innerRadiusRatio,ringOuter:config.mainRing.outerRadiusRatio,ringShadowEnabled:ringUniforms.atlasRingEnabled.value,pointLightPosition:sunlight.position.toArray(),
      bodies:all.map(item=>({id:item.definition.id,position:item.mesh.position.toArray(),physicalStarDistanceKm:item.physicalStarDistanceKm,
        solarAngularRadius:item.solar.atlasSolarAngularRadius.value}))},
    cameraDistance:camera.position.distanceTo(controls.target),worldRadiusPx:mount.clientHeight/(2*Math.tan(camera.fov*Math.PI/360)*camera.position.distanceTo(planet.getWorldPosition(new THREE.Vector3()))),
    camera:{position:camera.position.toArray(),target:controls.target.toArray(),matrixWorld:camera.matrixWorld.toArray(),matrixWorldInverse:camera.matrixWorldInverse.toArray(),projectionMatrix:camera.projectionMatrix.toArray()},
    labelBodies:[...all,{mesh:star,definition:config.star}].map(({mesh,definition})=>({id:definition.id,position:mesh.getWorldPosition(new THREE.Vector3()).toArray(),radius:mesh.geometry.parameters.radius*mesh.getWorldScale(new THREE.Vector3()).x})),
    labels:[...labels.children].map(node=>({id:node.dataset.celestialId||config.star.id,hidden:node.hidden,centerX:Number(node.dataset.centerX),centerY:Number(node.dataset.centerY),edgeX:Number(node.dataset.edgeX),radiusPx:Number(node.dataset.radiusPx),x:Number(node.dataset.anchorX),y:Number(node.dataset.anchorY)})),
    satellites:moons.map(item=>({id:item.definition.id,name:displayName(item.definition),textureId:item.definition.textureId,position:item.mesh.position.toArray(),radius:item.mesh.scale.x,
      rotationModel:state.physical?'saved-synchronous-period':'schematic-visible-spin',
      physicalPeriodHours:config.rotationPeriodHours*item.definition.periodDays,
      displayPeriodHours:satelliteSpinPeriod(config,item.definition,state.physical),rotation:item.mesh.rotation.y,
      material:{colorTexture:item.mesh.material.map?.uuid||null,heightTexture:item.mesh.material.bumpMap?.uuid||null,
        colorSize:item.mesh.material.map?[item.mesh.material.map.image.width,item.mesh.material.map.image.height]:null,
        heightSize:item.mesh.material.bumpMap?[item.mesh.material.bumpMap.image.width,item.mesh.material.bumpMap.image.height]:null}})),
    planets:planets.map(item=>({id:item.definition.id,name:displayName(item.definition),textureId:item.definition.textureId,
      material:{colorTexture:item.mesh.material.map?.uuid||null,heightTexture:item.mesh.material.bumpMap?.uuid||null,
        colorSize:item.mesh.material.map?[item.mesh.material.map.image.width,item.mesh.material.map.image.height]:null,
        heightSize:item.mesh.material.bumpMap?[item.mesh.material.bumpMap.image.width,item.mesh.material.bumpMap.image.height]:null},
      rotationModel:'saved-seeded-day-and-axis',periodHours:item.definition.rotationPeriodHours,
      direction:item.definition.rotationDirection,axialTiltDegrees:item.definition.axialTiltDegrees,
      initialPhaseRad:item.definition.spinPhaseRad,rotation:item.mesh.rotation.y,axisTilt:item.mesh.rotation.z})),
    starTexture:{ready:Boolean(starMaterial.map),sha256:appearances.star.sha256,
      colorSpace:starMaterial.map?.colorSpace||null,
      size:starMaterial.map?[starMaterial.map.image.width,starMaterial.map.image.height]:null,
      rotation:star.rotation.y,rotationRadiansPerDisplayHour:stellarRotationPerDisplayHour,
      glow:{size:[256,256],diameterRatio:starGlow.scale.x/2,opacity:starGlow.material.opacity,
        additive:starGlow.material.blending===THREE.AdditiveBlending}},
    assetBytes,assetDecodedBytes,assetBudgetValid,pendingAssets,completedAssets,optionalFailures:failures,assetFailures,assetTextures:textures.size,disposed,config})};
}
