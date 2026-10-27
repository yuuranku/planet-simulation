import * as THREE from 'three';
import {solarLightingGLSL,ringLightingGLSL} from './globe-lighting.js';

// A thin particulate slab, rather than a glossy solid surface. The saved
// geometry and stellar direction remain the only geometry/light inputs.
export function createRingGeometry(inner,outer){
  const geometry=new THREE.RingGeometry(inner,outer,256);
  const position=geometry.attributes.position,uv=geometry.attributes.uv;
  for(let i=0;i<position.count;i++)uv.setXY(i,(Math.hypot(position.getX(i),position.getY(i))-inner)/(outer-inner),.5);
  return geometry;
}

export function createRingMaterial(uniforms){
  return new THREE.ShaderMaterial({uniforms,side:THREE.DoubleSide,transparent:true,
    depthTest:true,depthWrite:false,forceSinglePass:true,toneMapped:false,
    vertexShader:`varying vec3 ringPosition;varying vec2 ringUv;
      void main(){ringPosition=(modelMatrix*vec4(position,1.0)).xyz;ringUv=uv;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:solarLightingGLSL+ringLightingGLSL+`
      varying vec3 ringPosition;varying vec2 ringUv;
      uniform vec3 atlasBodyCenter;uniform float atlasBodyRadius;
      uniform vec3 atlasRingNormal;uniform float atlasDayNight;
      float ringPhase(float cosine,float asymmetry){
        float square=asymmetry*asymmetry;
        return (1.0-square)/pow(max(.001,1.0+square-2.0*asymmetry*cosine),1.5);
      }
      void main(){
        vec4 paint=atlasRingSample(ringUv.x);
        float tau=-log(max(.001,1.0-paint.a));
        vec3 view=normalize(cameraPosition-ringPosition),normal=normalize(atlasRingNormal);
        float signedView=dot(normal,view),mu=max(.015,abs(signedView));
        float opacity=1.0-exp(-tau/mu);
        if(opacity<.001)discard;
        vec3 color=paint.rgb;
        if(atlasDayNight>.5){
          vec3 toStar=atlasStarPosition-ringPosition;
          float starDistance=length(toStar);vec3 sun=toStar/starDistance;
          float signedSun=dot(normal,sun),mu0=max(.001,abs(signedSun));
          float a=tau/mu,b=tau/mu0;
          float reflected=mu0/(mu+mu0)*(1.0-exp(-a-b));
          // Stable equal-incidence limit of transmission through the slab.
          float difference=abs(b-a);
          float phi=difference<.001?1.0-difference*.5+difference*difference/6.0:(1.0-exp(-difference))/difference;
          float transmitted=a*exp(-min(a,b))*phi;
          float scattering=signedSun*signedView>=0.0?reflected:transmitted;
          float cosine=dot(-sun,view);
          float phase=.72*ringPhase(cosine,-.25)+.28*ringPhase(cosine,.45);
          float visibility=atlasSphereVisibility(ringPosition,atlasBodyCenter,atlasBodyRadius,sun,starDistance);
          // Authored neutral visibility floor and phase normalization. These
          // describe the illustration, not measured optical properties.
          vec3 radiance=paint.rgb*(.006*opacity+1.35*scattering*phase*visibility);
          color=radiance/max(.001,opacity);
        }
        // Scattering already includes optical depth. Convert to straight alpha
        // once, so normal blending does not apply particle opacity twice.
        gl_FragColor=vec4(color,opacity);
        #include <colorspace_fragment>
      }`});
}

// Orbit paths are annotations behind the scene, including a translucent ring.
// Suppress their ink in visible ring material; keep the actual radial gaps.
// centres.w=outer radius (zero disables a slot), normals.w=inner radius.
export function createOrbitMaterial({ringTexture,ringTextureReady,centers,normals}){
  const material=new THREE.LineBasicMaterial({
    color:new THREE.Color(0x8da4b8).lerp(new THREE.Color(0x101923),.58),depthWrite:false});
  const count=centers.value.length;
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,{atlasRingTexture:ringTexture,atlasRingTextureReady:ringTextureReady,
      atlasOrbitRingCenters:centers,atlasOrbitRingNormals:normals});
    shader.vertexShader='varying vec3 atlasOrbitPosition;\n'+shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\natlasOrbitPosition=(modelMatrix*vec4(transformed,1.0)).xyz;');
    shader.fragmentShader=ringLightingGLSL+`\nvarying vec3 atlasOrbitPosition;
      uniform vec4 atlasOrbitRingCenters[${count}];uniform vec4 atlasOrbitRingNormals[${count}];\n`+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
      vec3 atlasRay=normalize(atlasOrbitPosition-cameraPosition);
      for(int ringIndex=0;ringIndex<${count};ringIndex++){
        vec4 center=atlasOrbitRingCenters[ringIndex],normal=atlasOrbitRingNormals[ringIndex];
        float incidence=dot(atlasRay,normal.xyz);
        if(center.w>0.0&&abs(incidence)>.00001){
          float along=dot(center.xyz-cameraPosition,normal.xyz)/incidence;
          if(along>0.0){
            float radius=length(cameraPosition+along*atlasRay-center.xyz);
            if(radius>=normal.w&&radius<=center.w){
              float radial=(radius-normal.w)/(center.w-normal.w);
              if(atlasRingSample(radial).a>.025)discard;
            }
          }
        }
      }`);
  };
  material.customProgramCacheKey=()=>`ring-aware-orbit-${count}`;
  return material;
}
