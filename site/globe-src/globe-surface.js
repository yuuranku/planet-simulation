import * as THREE from 'three';

// One world owns these three exports. They are materials derived from its
// saved physical fields, never a second terrain generator or a stock planet.
export function createNaturalSurface({payload,draw}){
  const source=payload.naturalSurface,controller=new AbortController(),textures=[],bitmaps=[];
  let pending=false,loaded=false,error=null,disposed=false,request=null,colorTexture=null;
  const water=new THREE.DataTexture(new Uint8Array(1),1,1,THREE.RedFormat);
  water.colorSpace=THREE.NoColorSpace;water.needsUpdate=true;textures.push(water);
  const uniforms={atlasWaterTexture:{value:water},atlasNaturalSurface:{value:0}};
  function validate(){
    if(source&&source.inMemory)return;
    if(!source||source.schema!=='world-atlas-natural-surface-v1'||source.gridDigest!==payload.gridDigest
        ||source.latitudeOrder!=='north-to-south'||!Number.isInteger(source.height)||source.height<4||source.height>1024
        ||source.width!==source.height*2)throw new Error('自然地表不属于当前世界');
    for(const [key,filename,encoding] of [['albedo','globe-natural-color.png','srgb-rgb8'],['water','globe-natural-water.png','linear-r8-liquid-water']]){
      const asset=source[key];
      if(!asset||asset.url!==filename||!Number.isInteger(asset.height)||asset.height<4||asset.height>2048
          ||asset.width!==source.width||asset.height!==source.height||asset.encoding!==encoding||!Number.isInteger(asset.encodedBytes)||asset.encodedBytes<=0
          ||asset.encodedBytes>16*1024*1024||!/^[a-f0-9]{64}$/.test(asset.sha256))throw new Error('自然地表资源清单无效');
    }
  }
  async function imageFor(asset){
    if(asset.bitmap){bitmaps.push(asset.bitmap);return asset.bitmap;}
    const response=await fetch(asset.url,{signal:controller.signal,cache:'no-cache'});
    if(!response.ok)throw new Error(`自然地表加载失败：HTTP ${response.status}`);
    const bytes=await response.arrayBuffer();
    if(bytes.byteLength!==asset.encodedBytes)throw new Error('自然地表字节数不符');
    const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
    if(digest!==asset.sha256)throw new Error('自然地表校验失败');
    const bitmap=await createImageBitmap(new Blob([bytes],{type:'image/png'}),{imageOrientation:'flipY',colorSpaceConversion:'none'});
    if(disposed){bitmap.close();throw new DOMException('Disposed','AbortError');}
    if(bitmap.width!==asset.width||bitmap.height!==asset.height){bitmap.close();throw new Error('自然地表尺寸不符');}
    bitmaps.push(bitmap);return bitmap;
  }
  function load(){
    if(request)return request;
    request=(async()=>{
      pending=true;
      try{
        validate();
        const [color,mask]=await Promise.all([imageFor(source.albedo),imageFor(source.water)]);
        if(disposed)throw new DOMException('Disposed','AbortError');
        colorTexture=new THREE.Texture(color);colorTexture.colorSpace=THREE.SRGBColorSpace;
        colorTexture.flipY=false;colorTexture.wrapS=THREE.RepeatWrapping;colorTexture.needsUpdate=true;textures.push(colorTexture);
        const canvas=new OffscreenCanvas(mask.width,mask.height),context=canvas.getContext('2d',{willReadFrequently:true});
        context.drawImage(mask,0,0);const rgba=context.getImageData(0,0,mask.width,mask.height).data,density=new Uint8Array(mask.width*mask.height);
        for(let index=0;index<density.length;index++)density[index]=rgba[index*4];
        // The first frame can already have uploaded the one-pixel placeholder.
        // Release its immutable GPU allocation before changing texture size.
        water.dispose();water.image={data:density,width:mask.width,height:mask.height};water.wrapS=THREE.RepeatWrapping;
        water.minFilter=THREE.LinearMipmapLinearFilter;water.magFilter=THREE.LinearFilter;water.generateMipmaps=true;water.needsUpdate=true;
        // Mask is now owned as R8; release its decoded RGBA copy.
        mask.close();bitmaps.splice(bitmaps.indexOf(mask),1);loaded=true;draw();return colorTexture;
      }catch(cause){if(!disposed)error=cause.message;throw cause;}finally{pending=false;}
    })();
    return request;
  }
  return{uniforms,load,get colorTexture(){return colorTexture;},
    setTheme(key){uniforms.atlasNaturalSurface.value=key==='terrain'?1:0;},
    diagnostics:()=>({loaded,pending,error,disposed,gridDigest:source?.gridDigest,
      width:source?.albedo.width,height:source?.albedo.height,
      encodedBytes:loaded?source.albedo.encodedBytes+source.water.encodedBytes:0,
      estimatedGpuBytes:loaded?Math.ceil(source.albedo.width*source.albedo.height*5*4/3):4}),
    dispose(){if(disposed)return;disposed=true;controller.abort();for(const texture of textures)texture.dispose();
      for(const bitmap of bitmaps)bitmap.close();textures.length=0;bitmaps.length=0;uniforms.atlasNaturalSurface.value=0;}
  };
}
