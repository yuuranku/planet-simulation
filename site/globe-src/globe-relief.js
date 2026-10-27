import * as THREE from 'three';

export const reliefLightingGLSL=`
uniform sampler2D atlasReliefTexture;uniform float atlasReliefStrength;uniform vec3 atlasReliefNorth;uniform vec2 atlasReliefTexel;
varying vec2 atlasReliefUv;
vec3 atlasReliefNormal(vec3 radial){
  if(atlasReliefStrength<=0.0)return radial;
  vec3 tangent=(texture2D(atlasReliefTexture,atlasReliefUv).rgb*255.0-128.0)/127.0;
  // Recover metric slope from the export's 12x precision scale. Emphasize
  // actual mountain faces while preserving the quieter 8x response on plains.
  float physicalSlope=length(tangent.xy)/max(tangent.z,.05)/12.0;
  float emphasis=mix(8.0,24.0,smoothstep(.003,.018,physicalSlope));
  tangent.xy*=emphasis/12.0;
  vec3 east=cross(atlasReliefNorth,radial);east/=max(length(east),0.00001);
  vec3 north=cross(radial,east);
  return normalize(mix(radial,east*tangent.x+north*tangent.y+radial*tangent.z,atlasReliefStrength));
}
float atlasReliefOcclusion(){
  if(atlasReliefStrength<=0.0||atlasReliefUv.y<=atlasReliefTexel.y||atlasReliefUv.y>=1.0-atlasReliefTexel.y)return 0.0;
  vec3 west=(texture2D(atlasReliefTexture,atlasReliefUv-vec2(atlasReliefTexel.x,0.0)).rgb*255.0-128.0)/127.0;
  vec3 east=(texture2D(atlasReliefTexture,atlasReliefUv+vec2(atlasReliefTexel.x,0.0)).rgb*255.0-128.0)/127.0;
  vec3 south=(texture2D(atlasReliefTexture,atlasReliefUv-vec2(0.0,atlasReliefTexel.y)).rgb*255.0-128.0)/127.0;
  vec3 north=(texture2D(atlasReliefTexture,atlasReliefUv+vec2(0.0,atlasReliefTexel.y)).rgb*255.0-128.0)/127.0;
  // The exporter reserves exactly radial normals for water/coastal support.
  // Require slope support on every side so that its boundary cannot become
  // a false valley. A radial centre remains valid: that can be a real bottom.
  float support=min(min(length(west.xy),length(east.xy)),min(length(south.xy),length(north.xy)));
  if(support<.5/127.0)return 0.0;
  vec2 w=west.xy/max(west.z,.05),e=east.xy/max(east.z,.05);
  vec2 s=south.xy/max(south.z,.05),n=north.xy/max(north.z,.05);
  // Negative normal divergence identifies concave ground independently of
  // the Sun. Only the sky fill is occluded; this is no cast-shadow/height map.
  float valley=max(0.0,(w.x-e.x+s.y-n.y)*.25);
  return .55*smoothstep(.01,.16,valley)*atlasReliefStrength;
}`;

export function createGlobeRelief({payload,north,draw}){
  let disposed=false,pending=false,texture=null,bitmap=null,error=null,loaded=false;
  const controller=new AbortController(),source=payload.relief;
  const uniforms={atlasReliefTexture:{value:null},atlasReliefStrength:{value:0},atlasReliefNorth:{value:north},
    atlasReliefTexel:{value:new THREE.Vector2(source?1/source.width:0,source?1/source.height:0)}};
  const ready=(async()=>{
    if(!source)return;
    pending=true;
    try{
      if(source.bitmap){const image=source.bitmap;bitmap=image;texture=new THREE.Texture(image);texture.colorSpace=THREE.NoColorSpace;texture.flipY=false;
        texture.wrapS=THREE.RepeatWrapping;texture.minFilter=THREE.LinearFilter;texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=false;
        texture.needsUpdate=true;uniforms.atlasReliefTexture.value=texture;loaded=true;draw();return;}
      if(source.schema!=='world-atlas-globe-relief-v1'||source.gridDigest!==payload.gridDigest||source.url!=='globe-relief-normal.png'
          ||source.normalSpace!=='tangent-east-north-out'||source.encoding!=='rgb8-centered-128'||source.latitudeOrder!=='north-to-south'
          ||!Number.isInteger(source.height)||source.height<4||source.height>1024||source.width!==source.height*2
          ||!Number.isInteger(source.encodedBytes)||source.encodedBytes<=0||source.encodedBytes>3*1024*1024||!/^[a-f0-9]{64}$/.test(source.sha256))throw new Error('球面法线数据不属于当前世界');
      const response=await fetch(source.url,{signal:controller.signal,cache:'no-cache'});
      if(!response.ok)throw new Error('球面法线数据加载失败');
      const bytes=await response.arrayBuffer();
      if(bytes.byteLength!==source.encodedBytes)throw new Error('球面法线数据字节数不符');
      const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
      if(hash!==source.sha256)throw new Error('球面法线数据校验失败');
      const image=await createImageBitmap(new Blob([bytes],{type:'image/png'}),{imageOrientation:'flipY',colorSpaceConversion:'none'});
      if(disposed){image.close();return;}
      if(image.width!==source.width||image.height!==source.height){image.close();throw new Error('球面法线尺寸不符');}
      bitmap=image;texture=new THREE.Texture(image);texture.colorSpace=THREE.NoColorSpace;texture.flipY=false;
      // A coarser averaged normal mip can tilt water near coasts. The exported
      // flat coastal support and distant strength fade keep linear sampling quiet.
      texture.wrapS=THREE.RepeatWrapping;texture.minFilter=THREE.LinearFilter;texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=false;
      texture.needsUpdate=true;uniforms.atlasReliefTexture.value=texture;loaded=true;draw();
    }catch(cause){if(!disposed)error=cause.message;}
    finally{pending=false;}
  })();
  return{uniforms,ready,refresh(projectedRadius,terrain){uniforms.atlasReliefStrength.value=loaded&&terrain?THREE.MathUtils.smoothstep(projectedRadius,80,280):0;},
    diagnostics:()=>({loaded,pending,error,disposed,strength:uniforms.atlasReliefStrength.value,source:source||null,
      colorSpace:texture?.colorSpace??null,generateMipmaps:texture?.generateMipmaps??false,gpuBaseBytes:loaded?source.width*source.height*4:0}),
    dispose(){if(disposed)return;disposed=true;controller.abort();texture?.dispose();bitmap?.close();texture=null;bitmap=null;uniforms.atlasReliefTexture.value=null;uniforms.atlasReliefStrength.value=0;}};
}
