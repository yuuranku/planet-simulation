/* User-owned city plans. Temporary viewer caches must never evict these records. */
(() => {
  'use strict';
  const schema='world-atlas-city-layout-v3';
  const generatorId=WorldAtlasCitySite.generatorId;
  if(typeof generatorId!=='string'||!/^[a-f0-9]{64}$/.test(generatorId))throw new Error('城市生成器身份未载入');
  const planArrays=['blocks','districts','streets','buildings','walls','innerWalls','towers','plazas','landmarks',
    'countryside','farmland','gates','barbicans','moats','countryLanes','hamlets','annotations','cores',
    'wallSpans','innerWallSpans','enclosures','innerEnclosures','gateStreets'];
  const nonempty=value=>typeof value==='string'&&value.length>0;
  const aborted=()=>new DOMException('城市操作已取消','AbortError');
  function checkGeometry(value) {
    if(typeof value==='number'&&!Number.isFinite(value))throw new Error('已保存城市几何损坏，原记录已保留');
    if(Array.isArray(value)){for(const item of value)checkGeometry(item);return;}
    if(!value||typeof value!=='object')return;
    if(Object.hasOwn(value,'points')&&(!Array.isArray(value.points)||value.points.some(point=>
        !Number.isFinite(point?.row)||!Number.isFinite(point?.column))))
      throw new Error('已保存城市几何损坏，原记录已保留');
    for(const item of Object.values(value))checkGeometry(item);
  }
  function validate(record,{worldId,cityId,gridDigest}={}) {
    // A saved plan owns its complete geometry; this hash records its source.
    const plan=record?.cityPlan,recipe=record?.recipe,site=recipe?.localSite, surface=site?.surface,domain=surface?.waterDomain;
    if(record?.schema!==schema||!nonempty(record.worldId)||!nonempty(record.cityId)||!nonempty(record.gridDigest)
        ||typeof record.generatorId!=='string'||!/^[a-f0-9]{64}$/.test(record.generatorId)
        ||!nonempty(record.layoutRevision)||!Number.isSafeInteger(record.revision)||record.revision<1
        ||!Number.isSafeInteger(record.seed)||record.seed<0||record.seed>0xffffffff
        ||recipe?.id!==record.cityId||recipe.seed!==record.seed
        ||!Number.isFinite(recipe.location?.row)||!Number.isFinite(recipe.location?.column)
        ||!recipe.urban||!surface||!domain||!site.bounds||!site.waterSource||!site.elevationRange
        ||!Number.isSafeInteger(domain.rows)||domain.rows<2||!Number.isSafeInteger(domain.columns)||domain.columns<2
        ||!Array.isArray(domain.shorelineClearanceNativeCells)||domain.shorelineClearanceNativeCells.length!==domain.rows*domain.columns
        ||!domain.shorelineClearanceNativeCells.every(Number.isFinite)||!Array.isArray(domain.waterBodies)
        ||domain.waterBodies.some(body=>!['sea','finite'].includes(body.kind)||!Number.isFinite(body.headMetres)
          ||!['Polygon','MultiPolygon'].includes(body.geometry?.type))
        ||!Number.isSafeInteger(surface.rows)||surface.rows<2||!Number.isSafeInteger(surface.columns)||surface.columns<2
        ||!Array.isArray(surface.elevationMetres)||surface.elevationMetres.length!==surface.rows*surface.columns
        ||!surface.elevationMetres.every(Number.isFinite)||!surface.bounds
        ||['north','south','east','west'].some(key=>!Number.isFinite(site.bounds[key])||!Number.isFinite(surface.bounds[key]))
        ||['terrainBands','contours','channels','lakes','bridges','ruralRoads'].some(key=>!Array.isArray(site[key]))
        ||!Array.isArray(recipe.transport?.corridors)
        ||!Number.isSafeInteger(record.grid?.width)||record.grid.width<2
        ||!Number.isSafeInteger(record.grid?.height)||record.grid.height<2
        ||!plan||planArrays.some(key=>!Array.isArray(plan[key]))||!Array.isArray(plan.buildable?.allowedCells)
        ||!Number.isFinite(plan.gridCellKilometres)||plan.gridCellKilometres<=0
        ||!Number.isFinite(plan.footprintRadiusRows)||plan.footprintRadiusRows<=0
        ||!plan.streetWidths||!plan.character
        ||worldId!==undefined&&record.worldId!==worldId||cityId!==undefined&&record.cityId!==cityId
        ||gridDigest!==undefined&&record.gridDigest!==gridDigest) {
      throw new Error('已保存城市布局损坏或不属于当前世界，原记录已保留');
    }
    for(const annotation of plan.annotations)if(!nonempty(annotation.id)||typeof annotation.name!=='string'
        ||!Number.isFinite(annotation.anchor?.row)||!Number.isFinite(annotation.anchor?.column))
      throw new Error('已保存城市标签损坏，原记录已保留');
    for(const key of ['blocks','streets','buildings','towers','plazas','landmarks','countryside','farmland','gates','barbicans','moats','hamlets'])
      if(plan[key].some(item=>!item||typeof item!=='object'))throw new Error('已保存城市几何损坏，原记录已保留');
    checkGeometry(plan);
    return record;
  }
  function create({worldId,gridDigest}) {
    if(!nonempty(worldId)||!nonempty(gridDigest))throw new TypeError('城市保存需要稳定的世界身份');
    let opening=null;
    function database() {
      if(!opening)opening=new Promise((resolve,reject)=>{
        const request=indexedDB.open('world-atlas-city-layouts-v3',1);
        request.onupgradeneeded=()=>request.result.createObjectStore('layouts');
        request.onerror=()=>reject(request.error);
        request.onblocked=()=>reject(new Error('城市保存数据库被其他页面占用，请关闭旧页面后重试'));
        request.onsuccess=()=>{
          const db=request.result;
          db.onversionchange=()=>{db.close();opening=null;};
          resolve(db);
        };
      }).catch(error=>{opening=null;throw error;});
      return opening;
    }
    const key=cityId=>JSON.stringify([worldId,cityId]);
    async function read(cityId) {
      const db=await database();
      return new Promise((resolve,reject)=>{
        const transaction=db.transaction('layouts','readonly'),request=transaction.objectStore('layouts').get(key(cityId));
        let value;
        request.onsuccess=()=>{value=request.result;};
        transaction.oncomplete=()=>{
          try{resolve(value===undefined?null:validate(value,{worldId,cityId,gridDigest}));}catch(error){reject(error);}
        };
        transaction.onabort=()=>reject(transaction.error||new Error('城市布局读取失败'));
        transaction.onerror=()=>reject(transaction.error||new Error('城市布局读取失败'));
      });
    }
    async function write(record,{expectedRevision=null,signal,isCurrent=()=>true}={}) {
      validate(record,{worldId,gridDigest});
      const db=await database();
      if(signal?.aborted||!isCurrent())throw aborted();
      return new Promise((resolve,reject)=>{
        const transaction=db.transaction('layouts','readwrite'),store=transaction.objectStore('layouts');
        let failure=null,saved=null;
        const stop=()=>{failure=aborted();try{transaction.abort();}catch{}};
        signal?.addEventListener('abort',stop,{once:true});
        const request=store.get(key(record.cityId));
        request.onsuccess=()=>{
          try{
            if(signal?.aborted||!isCurrent())throw aborted();
            const previous=request.result;
            if(previous!==undefined)validate(previous,{worldId,cityId:record.cityId,gridDigest});
            if((previous?.revision??null)!==expectedRevision)
              throw new Error('城市布局已被另一操作更新，请重新打开后再保存');
            saved={...record,revision:(previous?.revision??0)+1};
            store.put(saved,key(record.cityId));
          }catch(error){failure=error;transaction.abort();}
        };
        const finish=()=>signal?.removeEventListener('abort',stop);
        transaction.oncomplete=()=>{finish();resolve(saved);};
        transaction.onabort=()=>{finish();reject(failure||transaction.error||new Error('城市布局保存失败'));};
        transaction.onerror=()=>{failure ||= transaction.error;};
      });
    }
    return {read,write,validate:record=>validate(record,{worldId,gridDigest})};
  }
  window.WorldAtlasCityLayouts=Object.freeze({create,validate,schema});
})();
