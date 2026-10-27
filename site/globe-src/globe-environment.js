import * as THREE from 'three';
import {solarLightingGLSL,ringLightingGLSL,ringShadowGLSL} from './globe-lighting.js';
import {createCloudCover,cloudShadowGLSL} from './globe-clouds.js';
export {cloudShadowGLSL} from './globe-clouds.js';

function randomFor(identity){
  let seed=2166136261;
  for(const character of identity)seed=Math.imul(seed^character.charCodeAt(0),16777619)>>>0;
  return()=>{seed+=0x6d2b79f5;let value=seed;value=Math.imul(value^value>>>15,value|1);
    value^=value+Math.imul(value^value>>>7,value|61);return((value^value>>>14)>>>0)/4294967296;};
}

export function createGlobeEnvironment({scene,axis,spin,camera,mount,identity,naturalSurface,gridDigest,anisotropy,solar,ring,dayNight,draw}){
  let disposed=false,hours=0;
  const cover=createCloudCover({naturalSurface,gridDigest,anisotropy}),cloudPhase=0;
  const cloudUniforms={atlasCloudCover:{value:cover.texture},atlasCloudPhase:{value:cloudPhase},
    atlasCloudOpacity:{value:1},atlasCloudReady:{value:0}};
  const cloudLighting={...solar,...ring,...cloudUniforms,atlasDayNight:dayNight};
  const clouds=new THREE.Mesh(new THREE.SphereGeometry(1.003,128,64),new THREE.ShaderMaterial({
    uniforms:cloudLighting,transparent:true,depthTest:true,depthWrite:false,side:THREE.FrontSide,
    vertexShader:`varying vec3 cloudPosition;varying vec2 cloudUv;
      void main(){cloudUv=uv;cloudPosition=(modelMatrix*vec4(position,1.0)).xyz;
      gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:solarLightingGLSL+ringLightingGLSL+ringShadowGLSL+cloudShadowGLSL+`uniform float atlasDayNight;
      varying vec3 cloudPosition;varying vec2 cloudUv;
      void main(){
      float opacity=texture2D(atlasCloudCover,cloudUv).r*atlasCloudReady*atlasCloudOpacity;
      if(opacity<.003)discard;
      vec3 toStar=atlasStarPosition-cloudPosition;float starDistance=length(toStar);vec3 sun=toStar/starDistance;
      float day=dot(normalize(cloudPosition),sun);
      float visibility=atlasDayNight>.5?atlasSphereVisibility(cloudPosition,vec3(0.0),1.0,sun,starDistance):1.0;
      float transmission=visibility>.001?atlasRingTransmission(cloudPosition,sun,starDistance):1.0;
      float twilight=1.0-smoothstep(.02,.22,abs(day));
      vec3 sunlight=mix(vec3(1.0,.99,.97),vec3(1.0,.57,.32),twilight*.5);
      float daylight=smoothstep(-.10,.14,day);
      vec3 light=vec3(.008,.012,.02)+sunlight*(.14+.86*max(0.0,day))*daylight*visibility*transmission;
      if(atlasDayNight<.5)light=vec3(.95);
      gl_FragColor=vec4(light,opacity);
      #include <colorspace_fragment>}`
  }));
  clouds.name='main-world-clouds';clouds.renderOrder=3;spin.add(clouds);
  const atmosphere=new THREE.Mesh(new THREE.SphereGeometry(1.035,128,64),new THREE.ShaderMaterial({
    uniforms:{...solar,atlasDayNight:dayNight},side:THREE.FrontSide,transparent:true,depthTest:true,depthWrite:false,
    vertexShader:`varying vec3 airPosition;void main(){
      airPosition=(modelMatrix*vec4(position,1.0)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:solarLightingGLSL+`varying vec3 airPosition;uniform float atlasDayNight;
      void main(){
      vec3 ray=normalize(airPosition-cameraPosition);
      float along=dot(cameraPosition,ray),outerD=along*along-dot(cameraPosition,cameraPosition)+1.035*1.035;
      if(outerD<=0.0)discard;
      float start=max(0.0,-along-sqrt(outerD)),finish=-along+sqrt(outerD);
      float groundD=along*along-dot(cameraPosition,cameraPosition)+1.0;bool hitsGround=false;
      if(groundD>=0.0){float ground=-along-sqrt(groundD);if(ground>0.0){finish=min(finish,ground);hitsGround=true;}}
      float stride=max(0.0,finish-start)/12.0;
      vec3 betaR=vec3(5.5,13.0,22.4),betaM=vec3(9.0);vec3 inR=vec3(0.0),inM=vec3(0.0);float optical=0.0;
      for(int index=0;index<12;index++){
        vec3 point=cameraPosition+ray*(start+(float(index)+.5)*stride),radial=normalize(point);
        vec3 sunDir=normalize(atlasStarPosition-point);
        float sunHeight=dot(radial,sunDir),height=max(0.0,length(point)-1.0);
        float dR=exp(-height/.0085)*stride,dM=exp(-height/.0024)*stride;
        optical+=dR;
        float airmass=1.0/max(.045,sunHeight+.16);
        vec3 atten=exp(-betaR*(optical*.35+.011*airmass)-betaM*.004*airmass)*smoothstep(-.16,.06,sunHeight);
        inR+=dR*atten;inM+=dM*atten;
      }
      vec3 sun=normalize(atlasStarPosition-airPosition);
      float mu=dot(ray,sun),phaseR=.0597*(1.0+mu*mu),g=.76,phaseM=.1194*((1.0-g*g)*(1.0+mu*mu))/((2.0+g*g)*pow(max(.0001,1.0+g*g-2.0*g*mu),1.5));
      vec3 light=(inR*betaR*phaseR+inM*betaM*phaseM*.35)*10.0;
      vec3 color=vec3(1.0)-exp(-light*1.15);
      float slant=hitsGround?clamp((finish-start)/.09,0.0,1.0):1.0;float opacity=clamp(max(color.r,max(color.g,color.b))*1.15,0.0,hitsGround?.12+.38*slant*slant:.92)*atlasDayNight; // 俯视时薄、近边缘时厚
      gl_FragColor=vec4(color/max(.0001,max(color.r,max(color.g,color.b)))*min(1.0,max(color.r,max(color.g,color.b))*1.25),opacity);
      #include <colorspace_fragment>}`
  }));
  atmosphere.name='main-world-atmosphere';atmosphere.renderOrder=4;axis.add(atmosphere);
  const random=randomFor(identity+':stars-v1'),count=1100,positions=new Float32Array(count*3),colors=new Float32Array(count*3),sizes=new Float32Array(count);
  for(let index=0;index<count;index++){
    const y=random()*2-1,angle=random()*Math.PI*2,radius=Math.sqrt(1-y*y);
    positions.set([radius*Math.cos(angle),y,radius*Math.sin(angle)],index*3);
    const brightness=.35+.55*random(),warm=random()>.86;
    colors.set(warm?[brightness,brightness*.86,brightness*.7]:[brightness*.85,brightness*.92,brightness],index*3);
    sizes[index]=.85+random()*.8;
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  geometry.setAttribute('starColor',new THREE.BufferAttribute(colors,3));geometry.setAttribute('starSize',new THREE.BufferAttribute(sizes,1));
  const stars=new THREE.Points(geometry,new THREE.ShaderMaterial({
    uniforms:{atlasPixelRatio:{value:window.devicePixelRatio||1}},transparent:true,depthTest:true,depthWrite:false,
    vertexShader:`attribute vec3 starColor;attribute float starSize;uniform float atlasPixelRatio;varying vec3 skyColor;
      void main(){skyColor=starColor;vec4 clip=projectionMatrix*vec4(mat3(viewMatrix)*position,1.0);
      gl_Position=vec4(clip.xy,clip.w*.99999,clip.w);gl_PointSize=starSize*atlasPixelRatio;}`,
    fragmentShader:`varying vec3 skyColor;void main(){float radius=length(gl_PointCoord-.5);
      if(radius>.5)discard;gl_FragColor=vec4(skyColor,.72*(1.0-smoothstep(.12,.5,radius)));
      #include <colorspace_fragment>}`
  }));
  stars.name='world-starfield';stars.frustumCulled=false;stars.renderOrder=-1000;scene.add(stars);
  scene.background=new THREE.Color('#02050a');
  function refresh(){
    const focal=mount.clientHeight/(2*Math.tan(camera.fov*Math.PI/360));
    const radius=focal/Math.sqrt(Math.max(.001,camera.position.lengthSq()-1));
    clouds.visible=cover.loaded&&cloudUniforms.atlasCloudOpacity.value>0&&radius>=12;atmosphere.visible=dayNight.value>.5&&radius>=12;
  }
  refresh();
  const ready=cover.ready.then(()=>{
    if(disposed)return;
    cloudUniforms.atlasCloudReady.value=cover.loaded?1:0;
    refresh();draw();
  });
  return{
    // Deliberately visible illustrative drift: this is a preview, not a weather forecast.
    update(value){hours=value;
      cloudUniforms.atlasCloudPhase.value=THREE.MathUtils.euclideanModulo(cloudPhase+hours*.003125,Math.PI*2);
      clouds.rotation.y=cloudUniforms.atlasCloudPhase.value;refresh();},
    ready,cloudTexture:cover.texture,cloudUniforms,
    setTheme(key){
      // Keep administrative colours and boundaries legible through quieter clouds.
      cloudUniforms.atlasCloudOpacity.value=key==='terrain'?1:['political','control','provinces'].includes(key)?.28:0;
      refresh();
    },
    refresh,
    resize(){stars.material.uniforms.atlasPixelRatio.value=window.devicePixelRatio||1;refresh();},
    diagnostics:()=>({disposed,simulationHours:hours,cloudRotation:cloudPhase+hours*.003125,
      cloudVisible:clouds.visible,cloudOpacity:cloudUniforms.atlasCloudOpacity.value,atmosphereVisible:atmosphere.visible,starCount:count,
      starVertexBytes:positions.byteLength+colors.byteLength+sizes.byteLength,
      cloudPhase:cloudUniforms.atlasCloudPhase.value,cloudCover:cover.diagnostics(),cloudModel:'single-alpha-shell',
      addedDraws:1+Number(clouds.visible)+Number(atmosphere.visible)}),
    dispose(){if(disposed)return;disposed=true;cover.dispose();
      cloudUniforms.atlasCloudReady.value=0;cloudUniforms.atlasCloudOpacity.value=0;
      for(const object of [clouds,atmosphere,stars]){object.geometry.dispose();object.material.dispose();object.removeFromParent();}}
  };
}
