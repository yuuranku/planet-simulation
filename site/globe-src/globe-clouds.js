import * as THREE from 'three';

// The cloud shell rotates independently; its ground shadow uses the same phase.
export const cloudShadowGLSL=`
uniform sampler2D atlasCloudCover;
uniform float atlasCloudPhase;uniform float atlasCloudOpacity;uniform float atlasCloudReady;
vec2 atlasCloudDensityUv(vec2 uv){
  // Keep longitude continuous so RepeatWrapping preserves mip derivatives.
  return vec2(uv.x-atlasCloudPhase/6.283185307179586,clamp(uv.y,0.0,1.0));
}
float atlasCloudDensity(vec2 uv){
  return texture2D(atlasCloudCover,atlasCloudDensityUv(uv)).r*atlasCloudReady;
}
float atlasCloudTransmission(vec2 uv){
  return mix(1.0,exp(-atlasCloudDensity(uv)*2.8),atlasCloudOpacity);
}`;

export function createCloudCover({naturalSurface,gridDigest,anisotropy}){
  const texture=new THREE.DataTexture(new Uint8Array(1),1,1,THREE.RedFormat);
  texture.colorSpace=THREE.NoColorSpace;texture.wrapS=THREE.RepeatWrapping;
  texture.wrapT=THREE.ClampToEdgeWrapping;texture.unpackAlignment=1;
  texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;
  texture.generateMipmaps=true;texture.anisotropy=anisotropy;texture.needsUpdate=true;
  const controller=new AbortController(),source=naturalSurface?.clouds;
  let disposed=false,loaded=false,pending=true,loadError=null,decodeMilliseconds=0;
  const ready=(async()=>{
    try{
      if(source&&source.bitmap){const bitmap=source.bitmap;const started=performance.now();
        const canvas=new OffscreenCanvas(bitmap.width,bitmap.height),context=canvas.getContext('2d',{willReadFrequently:true});
        context.drawImage(bitmap,0,0);const rgba=context.getImageData(0,0,bitmap.width,bitmap.height).data;const density=new Uint8Array(bitmap.width*bitmap.height);
        for(let index=0;index<density.length;index++)density[index]=rgba[index*4];
        texture.dispose();texture.image={data:density,width:bitmap.width,height:bitmap.height};texture.needsUpdate=true;
        decodeMilliseconds=performance.now()-started;loaded=true;bitmap.close();return;}
      if(naturalSurface?.schema!=='world-atlas-natural-surface-v1'||naturalSurface.gridDigest!==gridDigest
          ||naturalSurface.latitudeOrder!=='north-to-south'||!source||source.url!=='globe-natural-clouds.jpg'||source.encoding!=='linear-r8-opacity'
          ||source.width!==4096||source.height!==2048
          ||!Number.isInteger(source.encodedBytes)||source.encodedBytes<=0||source.encodedBytes>16*1024*1024
          ||!/^[a-f0-9]{64}$/.test(source.sha256))throw new Error('云层数据不属于当前世界');
      const response=await fetch(`${source.url}?v=${source.sha256}`,{signal:controller.signal,cache:'force-cache'});
      if(!response.ok)throw new Error(`云层图像 HTTP ${response.status}`);
      const bytes=await response.arrayBuffer();
      if(bytes.byteLength!==source.encodedBytes)throw new Error('云层图像字节数与清单不一致');
      const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),value=>value.toString(16).padStart(2,'0')).join('');
      if(digest!==source.sha256)throw new Error('云层图像校验失败');
      if(disposed)return;
      const started=performance.now();
      const bitmap=await createImageBitmap(new Blob([bytes],{type:'image/jpeg'}),{imageOrientation:'flipY',colorSpaceConversion:'none'});
      try{
        if(disposed)return;
        if(bitmap.width!==source.width||bitmap.height!==source.height)throw new Error('云层图像尺寸与清单不一致');
        const canvas=new OffscreenCanvas(bitmap.width,bitmap.height),context=canvas.getContext('2d',{willReadFrequently:true});
        context.drawImage(bitmap,0,0);
        const rgba=context.getImageData(0,0,bitmap.width,bitmap.height).data;
        const density=new Uint8Array(bitmap.width*bitmap.height);
        for(let index=0;index<density.length;index++)density[index]=rgba[index*4];
        // The ground shadow can upload the empty texture before this fetch
        // finishes. WebGL2 texture storage is immutable: release that GPU
        // allocation before replacing its dimensions, retaining the uniform.
        texture.dispose();
        texture.image={data:density,width:bitmap.width,height:bitmap.height};texture.needsUpdate=true;
        decodeMilliseconds=performance.now()-started;loaded=true;
      }finally{bitmap.close();}
    }catch(error){if(!disposed&&!controller.signal.aborted)loadError=error.message;}
    finally{pending=false;}
  })();
  return{texture,ready,get loaded(){return loaded&&!disposed;},diagnostics:()=>({loaded,pending,disposed,loadError,
    width:source?.width||0,height:source?.height||0,channel:'R8-opacity',
    bytes:loaded&&!disposed?source.width*source.height:0,encodedBytes:source?.encodedBytes||0,
    estimatedMipBytes:loaded&&!disposed?Math.ceil(source.width*source.height*4/3):0,decodeMilliseconds,
    gridDigest:naturalSurface?.gridDigest||null,sha256:source?.sha256||null,
    provenance:source?.provenance||null,anisotropy:texture.anisotropy}),
    dispose(){if(disposed)return;disposed=true;controller.abort();texture.dispose();texture.image={data:null,width:0,height:0};}};
}
