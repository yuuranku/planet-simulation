import * as THREE from 'three';

// Preserve the RGB appearance of the user-selected NASA Sun model texture.
// Its original model UV is baked offline to an equirectangular color map.
export function createStarMaterial(){
  const material=new THREE.MeshBasicMaterial({name:'solar-model-emission',color:0xffffff,toneMapped:false});
  material.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec3 atlasStellarPosition;varying vec3 atlasStellarNormal;\n'+shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\natlasStellarPosition=(modelMatrix*vec4(transformed,1.0)).xyz;atlasStellarNormal=normalize(mat3(modelMatrix)*normal);');
    shader.fragmentShader='varying vec3 atlasStellarPosition;varying vec3 atlasStellarNormal;\n'+shader.fragmentShader.replace('#include <opaque_fragment>',
      `float mu=max(0.0,dot(normalize(atlasStellarNormal),normalize(cameraPosition-atlasStellarPosition)));
       outgoingLight*=0.6+0.4*mu;
       #include <opaque_fragment>`);
  };
  return material;
}

export function createStarGlow(){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
  const context=canvas.getContext('2d');
  const gradient=context.createRadialGradient(128,128,0,128,128,128);
  gradient.addColorStop(0,'rgba(255,228,155,1)');
  gradient.addColorStop(.48,'rgba(255,198,88,.7)');
  gradient.addColorStop(.62,'rgba(255,159,42,.14)');
  gradient.addColorStop(1,'rgba(0,0,0,0)');
  context.fillStyle=gradient;context.fillRect(0,0,256,256);
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  const material=new THREE.SpriteMaterial({map:texture,transparent:true,opacity:.55,
    blending:THREE.AdditiveBlending,depthWrite:false,depthTest:true,toneMapped:false});
  const glow=new THREE.Sprite(material);glow.name='stellar-glow';glow.scale.set(3.8,3.8,1);
  return glow;
}

// Nominal Carrington sidereal rotation; integrated by the shared saved clock.
export const stellarRotationPerDisplayHour=2*Math.PI/(25.38*24);
