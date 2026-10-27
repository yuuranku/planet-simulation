/* City plans persist independently of the viewer and are regenerated explicitly. */
(() => {
  'use strict';
  const SVG_NS='http://www.w3.org/2000/svg';
  const svg=(name,attributes={})=>{
    const node=document.createElementNS(SVG_NS,name);
    for(const [key,value] of Object.entries(attributes))node.setAttribute(key,String(value));
    return node;
  };
  const path=(points,origin={column:0,row:0})=>points.map((p,i)=>`${i?'L':'M'}${(p.column-origin.column).toFixed(9)} ${(p.row-origin.row).toFixed(9)}`).join(' ');

  function terrainShadePixels(surface,metric,dryAt) {
    const {rows,columns,bounds,elevationMetres:height}=surface,rgba=new Uint8ClampedArray(rows*columns*4),
      dx=(bounds.east-bounds.west)*metric.column*1000/(columns-1),
      dy=(bounds.south-bounds.north)*metric.row*1000/(rows-1),
      dry=Array.from({length:rows*columns},(_,i)=>dryAt({
        column:bounds.west+(bounds.east-bounds.west)*(i%columns)/(columns-1),
        row:bounds.north+(bounds.south-bounds.north)*Math.floor(i/columns)/(rows-1)})),flat=Math.SQRT1_2;
    for(let row=0;row<rows;row++)for(let column=0;column<columns;column++){
      const i=row*columns+column;if(!dry[i])continue;
      const west=column>0&&dry[i-1]?column-1:column,east=column<columns-1&&dry[i+1]?column+1:column,
        north=row>0&&dry[i-columns]?row-1:row,south=row<rows-1&&dry[i+columns]?row+1:row,
        gx=east>west?(height[row*columns+east]-height[row*columns+west])/((east-west)*dx):0,
        gy=south>north?(height[south*columns+column]-height[north*columns+column])/((south-north)*dy):0,
        normal=Math.hypot(gx,gy,1),light=(.8*(.5*gx+.5*gy+flat)+.2*(flat*gy+flat))/normal,
        difference=light-flat,colour=difference<0?[82,103,94]:[255,255,249],
        opacity=Math.min(difference<0?.20:.12,Math.abs(difference)*(difference<0?.55:.35));
      rgba.set([...colour,Math.round(opacity*255)],i*4);
    }
    return rgba;
  }

  // One background worker; falls back to the main thread where workers fail.
  let worker=null,workerFailed=false,jobs=0;const pending=new Map();
  function generateCity(recipe,siteContext,seed,grid,name){
    const status=document.getElementById('city-map-status'),started=Date.now(),
      tick=setInterval(()=>{status.textContent=`正在生成${name||''}… ${Math.round((Date.now()-started)/1000)} 秒`;},1000);
    const done=value=>{clearInterval(tick);return value;};
    if(!workerFailed&&typeof Worker==='function'){
      try{
        if(!worker){
          worker=new Worker(new URL('assets/city-worker.js',document.baseURI));
          worker.onmessage=event=>{const job=pending.get(event.data.id);if(!job)return;pending.delete(event.data.id);
            if(event.data.error)job.reject(new Error(event.data.error));else job.resolve(event.data);};
          worker.onerror=event=>{event.preventDefault?.();workerFailed=true;worker=null;
            for(const job of pending.values())job.fallback();pending.clear();};
        }
        const id=++jobs;
        return new Promise((resolve,reject)=>{
          pending.set(id,{resolve:value=>resolve(done(value)),reject:error=>{done();reject(error);},
            fallback:()=>{try{resolve(done(generateHere()));}catch(error){done();reject(error);}}});
          worker.postMessage({id,recipe,siteContext,seed,grid});
        });
      }catch{workerFailed=true;}
    }
    function generateHere(){
      const generated=WorldAtlasCitySite.generate(recipe,siteContext,{seed});
      return {generated,cityPlan:WorldAtlasCities.plan(generated,{grid})};
    }
    return new Promise(resolve=>setTimeout(resolve,30)).then(()=>done(generateHere()));
  }

  function create({viewport,container,worldId,gridDigest,loadCity,names}) {
    worldId ||= gridDigest;
    const layouts=WorldAtlasCityLayouts.create({worldId,gridDigest});
    const cameraNode=document.getElementById('city-map-camera'),status=document.getElementById('city-map-status');
    const reliefKey=document.createElement('div');reliefKey.className='city-relief-key';reliefKey.setAttribute('aria-label','海拔与等高线');viewport.append(reliefKey);
    const updateButton=document.createElement('button');updateButton.id='place-update-layout';updateButton.type='button';
    updateButton.className='map-button';updateButton.textContent='更新布局';updateButton.hidden=true;
    updateButton.title='按当前规则更新布局，保留地形、种子和名称';
    document.getElementById('place-regenerate')?.after(updateButton);
    let selected=null,recipe=null,saved=null,controller=null,request=0,generatedCount=0,seed=null,loading=false;
    let scale=1,translateX=0,translateY=0,width=0,height=0,fitScale=1,extent='city';
    let minimumScale=1,maximumScale=1800,interaction=null;
    const localPath=points=>path(points,recipe.location);
    const sitePath=d=>d.replace(/([ML])\s*([-+\d.e]+)[\s,]+([-+\d.e]+)/gi,(_all,command,x,y)=>
      command+(Number(x)-recipe.location.column).toFixed(9)+' '+(Number(y)-recipe.location.row).toFixed(9));
    const notify=message=>{status.textContent=message;};
    function refreshUpdateButton() {
      updateButton.hidden=!saved||saved.generatorId===WorldAtlasCitySite.generatorId;
      updateButton.disabled=loading;
    }
    function updateCamera() {
      if(recipe&&width&&height){
        const bounds=recipe.localSite.bounds,metric=recipe.urban.gridCellKilometres;
        minimumScale=Math.min(width/((bounds.east-bounds.west)*metric.column),height/((bounds.south-bounds.north)*metric.row))*.94;
        maximumScale=Math.max(minimumScale,1800);
        scale=Math.max(minimumScale,Math.min(maximumScale,scale));
        const constrain=(position,size,start,end)=>{
          const first=-start*scale,last=size-end*scale;
          return last>first?(size-(start+end)*scale)/2:Math.max(last,Math.min(first,position));
        };
        translateX=constrain(translateX,width,(bounds.west-recipe.location.column)*metric.column,(bounds.east-recipe.location.column)*metric.column);
        translateY=constrain(translateY,height,(bounds.north-recipe.location.row)*metric.row,(bounds.south-recipe.location.row)*metric.row);
        document.getElementById('city-map-zoom-in').disabled=scale>=maximumScale*.999;
        document.getElementById('city-map-zoom-out').disabled=scale<=minimumScale*1.001;
      }
      cameraNode.setAttribute('transform',`translate(${translateX} ${translateY}) scale(${scale})`);
      if(!recipe)return;
      const metric=recipe.urban.gridCellKilometres;
      const terrainDetail=Math.max(0,Math.min(1,(recipe.localSite.radiusKm*2*scale/(recipe.localSite.surface.rows-1)-3)/8));
      for(const node of container.querySelectorAll('.city-tree-shadows,.city-tree-canopies,.city-tree-highlights'))
        node.style.opacity=Math.max(.3,Math.min(1,scale/120));
      for(const node of container.querySelectorAll('.city-local-rocks'))node.style.display=scale>=120?'':'none';
      // Roof construction becomes legible once a typical home spans several pixels.
      const roofDetail=Math.max(0,Math.min(1,(scale*.008-2)/4));
      for(const node of container.querySelectorAll('.city-roof-faces,.city-country-roof-faces,.city-country-doorways'))
        node.style.opacity=roofDetail;
      for(const node of container.querySelectorAll('.city-building-shadows'))node.style.opacity=.20*roofDetail;
      for(const node of container.querySelectorAll('.city-roof-ridges'))node.style.opacity=.48*roofDetail;
      for(const node of container.querySelectorAll('.city-roof-material,.city-building-wall-texture,.city-landmark-wall-texture,.city-country-wall-texture,.city-wall-material-joints'))node.style.opacity=Math.max(0,Math.min(1,(scale-650)/750));
      for(const node of container.querySelectorAll('.city-field-texture'))node.style.opacity=Math.max(0,Math.min(1,(scale-100)/380));
      for(const node of container.querySelectorAll('.atlas-balks,.atlas-burgage-fences,.atlas-merlons'))node.style.opacity=Math.max(0,Math.min(1,(scale-180)/400));
      for(const node of container.querySelectorAll('.atlas-water-lines'))node.style.opacity=Math.max(0,Math.min(1,(scale-60)/200));
      for(const node of container.querySelectorAll('.atlas-hedge-trees,.atlas-garden-trees'))node.style.opacity=Math.max(.35,Math.min(1,(scale-40)/160));
      for(const node of container.querySelectorAll('.city-harbor-fine-detail'))node.style.opacity=Math.max(0,Math.min(1,(scale*.006-1.5)/4));
      for(const line of container.querySelectorAll('.city-local-contours path'))line.setAttribute('stroke-opacity',
        line.dataset.major==='true'?.18+terrainDetail*.13:.035+terrainDetail*.115);
      for(const road of container.querySelectorAll('.city-external-roads path'))road.setAttribute('stroke-width',
        Math.max(Number(road.dataset.width),Number(road.dataset.minimumPixels)/scale));
      const diameter=recipe.urban.radiusKm*2*scale,occupied=[],names=new Set();
      const labels=Array.from(container.querySelectorAll('[data-city-screen-label]')).sort((a,b)=>
        (Number(a.dataset.priority)+(diameter>640&&a.dataset.featureKind==='square'?4:0))
        -(Number(b.dataset.priority)+(diameter>640&&b.dataset.featureKind==='square'?4:0)));
      for(const node of labels){
        const road=node.dataset.featureKind==='road',natural=['terrain','forest','river','elevation'].includes(node.dataset.featureKind),
          font=node.dataset.featureKind==='elevation'?9:road?10.5:11.5,angle=road?Number(node.dataset.angle):0;
        const row=Number(node.dataset.anchorRow),column=Number(node.dataset.anchorColumn);
        const x=translateX+(column-recipe.location.column)*metric.column*scale,y=translateY+(row-recipe.location.row)*metric.row*scale;
        node.setAttribute('font-size',font/(scale*metric.row));node.setAttribute('stroke-width',3/(scale*metric.row));
        node.setAttribute('transform',`translate(${column-recipe.location.column} ${row-recipe.location.row}) scale(${metric.row/metric.column} 1) rotate(${angle})`);
        node.setAttribute('font-weight',road?'400':'500');
        const textWidth=Array.from(node.textContent).reduce((sum,c)=>sum+(c.charCodeAt(0)>255?1:.58),0)*font+12;
        const radians=angle*Math.PI/180,w=Math.abs(Math.cos(radians))*textWidth+Math.abs(Math.sin(radians))*font+8,
          h=Math.abs(Math.sin(radians))*textWidth+Math.abs(Math.cos(radians))*font+8;
        const box={left:x-w/2,right:x+w/2,top:y-h/2,bottom:y+h/2};
        const visible=(natural||diameter>=[100,250,610][Number(node.dataset.detailLevel)])
          &&(!road||Number(node.dataset.lengthKm)*scale>textWidth*1.18)&&x>30&&x<width-30&&y>20&&y<height-20
          &&!names.has(node.textContent)&&!occupied.some(b=>box.left<b.right&&box.right>b.left&&box.top<b.bottom&&box.bottom>b.top);
        node.style.display=visible?'':'none';
        if(visible){occupied.push(box);names.add(node.textContent);}
      }
      container.classList.toggle('city-close-detail',diameter>520);
      reliefKey.textContent=`海拔 ${recipe.localSite.elevationRange.minimum}–${recipe.localSite.elevationRange.maximum} m · 等高距 ${recipe.localSite.elevationRange.interval} m`;
      const maximum=100/scale,power=10**Math.floor(Math.log10(maximum));
      const km=[1,2,5].map(v=>v*power).filter(v=>v<=maximum).pop()||power/2;
      document.getElementById('city-scale-label').textContent=km<1?`${Math.round(km*1000)} m`:`${Number(km.toFixed(2))} km`;
      document.getElementById('city-scale-rule').style.width=`${km*scale}px`;
    }
    function reset() {
      interaction?.stop();
      width=viewport.clientWidth;height=viewport.clientHeight;
      if(!recipe||!width||!height)return;
      const metric=recipe.urban.gridCellKilometres,site=recipe.localSite.bounds;
      let bounds=site,padding=0,margin=.94;
      if(extent==='city'){
        const plan=saved.cityPlan,points=[...plan.walls.flat(),...plan.innerWalls.flat(),
          ...[...plan.buildings,...plan.landmarks,...plan.towers,...plan.plazas,...plan.barbicans,...plan.moats]
            .flatMap(item=>item.compoundPoints||item.plotPoints||item.points),
          ...plan.gates.flatMap(gate=>gate.towers.flat()),...(plan.fortress?.clearancePoints||[])];
        if(!points.length)points.push(recipe.location);
        bounds={west:Infinity,east:-Infinity,north:Infinity,south:-Infinity};
        for(const point of points){bounds.west=Math.min(bounds.west,point.column);bounds.east=Math.max(bounds.east,point.column);
          bounds.north=Math.min(bounds.north,point.row);bounds.south=Math.max(bounds.south,point.row);}
        padding=.04;margin=.92;
      }
      fitScale=Math.min(width/((bounds.east-bounds.west)*metric.column+padding*2),
        height/((bounds.south-bounds.north)*metric.row+padding*2))*margin;
      scale=fitScale;
      translateX=width/2-((bounds.west+bounds.east)/2-recipe.location.column)*metric.column*scale;
      translateY=height/2-((bounds.north+bounds.south)/2-recipe.location.row)*metric.row*scale;
      viewport.style.backgroundColor=WorldAtlasCityCharacter.mapPalette.ground;updateCamera();
    }
    function setExtent(value) {
      if(!['city','region'].includes(value))throw new TypeError('Invalid city extent');
      extent=value;
      for(const key of ['city','region'])document.getElementById('city-map-'+key).setAttribute('aria-pressed',String(key===extent));
      reset();
    }
    function zoomBy(factor) {if(recipe)interaction.zoomBy(factor);}
    function clear() {
      interaction?.stop();
      request++;controller?.abort();controller=null;selected=null;recipe=null;saved=null;loading=false;
      container.replaceChildren();notify('');refreshUpdateButton();
    }
    function joinHarborRoadLayers(city,harbor,cityPlan) {
      const ground=harbor.querySelector('.city-harbor-ground');if(!ground)return;
      const scalar=cityPlan.gridCellKilometres,nativeToDrawing=`scale(${1/scalar})`,
        edges=city.querySelector('.city-street-edges'),surfaces=city.querySelector('.city-streets-major'),
        roadEdges=ground.querySelector('.city-harbor-road-edges'),roadSurfaces=ground.querySelector('.city-harbor-road-surfaces');
      roadEdges.setAttribute('transform',nativeToDrawing);roadSurfaces.setAttribute('transform',nativeToDrawing);
      edges.append(roadEdges);surfaces.append(roadSurfaces);ground.setAttribute('transform',nativeToDrawing);
      const land=city.querySelector('.city-land-geometry');
      land.insertBefore(ground,land.querySelector('.city-defensive-ditches'));
    }
    function drawSite(site,cityPlan) {
      const palette=WorldAtlasCityCharacter.mapPalette,group=svg('g',{class:'city-local-site','data-water-source':site.waterSource.kind});
      const bands=svg('g',{class:'city-local-terrain'});
      for(const band of site.terrainBands)bands.append(svg('path',{d:sitePath(band.d),fill:band.fill}));
      const definitions=svg('defs'),dryClip=svg('clipPath',{id:'city-river-dry-ground',clipPathUnits:'userSpaceOnUse'});
      dryClip.append(svg('path',{d:sitePath(site.dryArea)}));definitions.append(dryClip);
      // 星球推演：河道裁剪范围 = 干地 ∪ 精细水面，河一直流进湖海，不在粗糙的干地边缘截断
      const riverClip=svg('clipPath',{id:'city-river-reach',clipPathUnits:'userSpaceOnUse'});
      riverClip.append(svg('path',{d:sitePath(site.dryArea)}));if(site.waterArea)riverClip.append(svg('path',{d:sitePath(site.waterArea)}));definitions.append(riverClip);
      const shade=svg('g',{class:'city-local-hillshade','clip-path':'url(#city-river-dry-ground)'});
      const metric=recipe.urban.gridCellKilometres;
      const kilometrePath=points=>path(points.map(p=>({column:(p.column-recipe.location.column)*metric.column,
        row:(p.row-recipe.location.row)*metric.row}))),physicalTransform=`scale(${1/metric.column} ${1/metric.row})`;
      // Sample unexaggerated FP64 terrain normals at every original vertex.
      // Interpolation belongs to the display texture, never to the saved grid.
      const surface=site.surface,canvas=document.createElement('canvas');canvas.width=surface.columns;canvas.height=surface.rows;
      const context=canvas.getContext('2d'),pixels=context.createImageData(canvas.width,canvas.height);
      pixels.data.set(terrainShadePixels(surface,metric,point=>WorldAtlasCitySite.isDry(surface,point)));
      context.putImageData(pixels,0,0);
      const cellColumn=(surface.bounds.east-surface.bounds.west)/(surface.columns-1),
        cellRow=(surface.bounds.south-surface.bounds.north)/(surface.rows-1);
      shade.append(svg('image',{href:canvas.toDataURL('image/png'),
        x:surface.bounds.west-recipe.location.column-cellColumn/2,y:surface.bounds.north-recipe.location.row-cellRow/2,
        width:cellColumn*surface.columns,height:cellRow*surface.rows,preserveAspectRatio:'none',
        'data-surface-rows':surface.rows,'data-surface-columns':surface.columns}));
      group.append(definitions,bands,shade);
      if(site.waterArea)group.append(svg('path',{d:sitePath(site.waterArea),fill:palette.water,'fill-rule':'evenodd',class:'city-coastal-water'}));
      const contours=svg('g',{class:'city-local-contours',fill:'none',stroke:palette.contour,'stroke-linecap':'round'});
      for(const line of site.contours)contours.append(svg('path',{d:sitePath(line.d),'data-height-m':line.elevation,'data-major':line.major,
        'stroke-width':line.major?.7:.45,'vector-effect':'non-scaling-stroke'}));
      const water=svg('g',{class:'city-local-water'});
      water.setAttribute('clip-path','url(#city-river-reach)');
      const ribbon=(channel,factor,margin=0)=>{
        const banks=[[],[]];
        for(let i=0;i<channel.points.length;i++){
          const p=channel.points[i],a=channel.points[Math.max(0,i-1)],z=channel.points[Math.min(channel.points.length-1,i+1)],
            dx=(z.column-a.column)*metric.column,dy=(z.row-a.row)*metric.row,len=Math.hypot(dx,dy)||1,
            half=p.widthMetres/2000*factor+margin;
          for(const [bank,sign] of [[0,-1],[1,1]])banks[bank].push({column:p.column-dy/len*half*sign/metric.column,row:p.row+dx/len*half*sign/metric.row});
        }return localPath(banks[0].concat(banks[1].reverse()))+'Z';
      };
      // Exact exclusions protect narrow features between the cover samples.
      const b=site.bounds,woodMask=svg('mask',{id:'city-woodland-clearance',maskUnits:'userSpaceOnUse',
        x:b.west-recipe.location.column,y:b.north-recipe.location.row,width:b.east-b.west,height:b.south-b.north,'mask-type':'luminance'});
      woodMask.append(svg('path',{d:sitePath(site.dryArea),fill:'#fff'}));
      if(site.waterArea)woodMask.append(svg('path',{d:sitePath(site.waterArea),fill:'#000','fill-rule':'evenodd'})); // 星球推演：树林不进精细水面
      woodMask.append(svg('path',{d:[...site.farmland.map(field=>localPath(field.points)+'Z'),
        ...site.lakes.flatMap(lake=>lake.patches.map(points=>localPath(points)+'Z')),
        ...site.channels.map(channel=>ribbon(channel,1,.02))].join(' '),fill:'#000'}));
      const occupied=[...cityPlan.buildings.map(building=>building.plotPoints||building.points),
        ...cityPlan.countryside.map(home=>home.yard),...cityPlan.plazas.map(plaza=>plaza.points),
        ...cityPlan.landmarks.map(landmark=>landmark.points)];
      woodMask.append(svg('path',{class:'city-occupied-woodland-clearance',
        d:occupied.map(points=>localPath(points)+'Z').join(' '),fill:'#000'}));
      const roadClearance=svg('g',{transform:`scale(${1/metric.column} ${1/metric.row})`,fill:'none',
        stroke:'#000','stroke-linecap':'round','stroke-linejoin':'round'});
      for(const road of [...recipe.transport.corridors,...site.ruralRoads,...cityPlan.streets,...cityPlan.countryLanes.map(points=>({kind:'local',points}))]
        .filter(road=>['road','rail','arterial','collector','local'].includes(road.kind)))
        roadClearance.append(svg('path',{d:path(road.points.map(p=>({column:(p.column-recipe.location.column)*metric.column,row:(p.row-recipe.location.row)*metric.row}))),
          'stroke-width':WorldAtlasCitySite.woodlandRoadClearance(recipe,road)*2}));
      woodMask.append(roadClearance);definitions.append(woodMask);
      const woods=svg('g',{class:'city-local-woodland',mask:'url(#city-woodland-clearance)'});
      woods.append(svg('path',{d:(site.woodland||[]).map(points=>localPath(points)+'Z').join(' '),fill:palette.woodland,opacity:.72}));
      const crowns=cityPlan.trees.map((tree,index)=>{
        const rx=tree.radiusMetres/1000/metric.column,ry=tree.radiusMetres/1000/metric.row,p=tree.point;
        return Array.from({length:12},(_,i)=>{
          const angle=i*Math.PI/6,radius=.83+.15*Math.sin(i*2.7+index*1.9);
          return {column:p.column+Math.cos(angle)*rx*radius,row:p.row+Math.sin(angle)*ry*radius};
        });
      });
      woods.append(svg('path',{d:crowns.map(points=>localPath(points)+'Z').join(' '),class:'city-tree-shadows',fill:palette.treeShadow,opacity:.13,
        transform:`translate(${.002/metric.column} ${.003/metric.row})`}));
      for(const [index,fill] of palette.trees.entries())woods.append(svg('path',{
        d:crowns.filter((_,i)=>i%3===index).map(points=>localPath(points)+'Z').join(' '),class:'city-tree-canopies',fill,
        stroke:palette.treeShadow,'stroke-opacity':.28,'stroke-width':.00035/((metric.row+metric.column)/2),opacity:.9,
        'data-tree-count':crowns.filter((_,i)=>i%3===index).length}));
      woods.append(svg('path',{d:crowns.map(points=>localPath(points.slice(6,11))).join(' '),class:'city-tree-highlights',
        fill:'none',stroke:palette.treeHighlight,'stroke-width':.0007/((metric.row+metric.column)/2),opacity:.58,'stroke-linecap':'round'}));
      const rockPath=(site.rocks||[]).map(p=>localPath([{column:p.column-.015/metric.column,row:p.row},
        {column:p.column,row:p.row-.01/metric.row},{column:p.column+.018/metric.column,row:p.row+.007/metric.row}])).join(' ');
      woods.append(svg('path',{d:rockPath,class:'city-local-rocks',fill:'none',stroke:palette.rock,'stroke-width':.6,'vector-effect':'non-scaling-stroke'}));
      group.append(woods,contours);
      if(site.channels.length){
        // 星球推演：汇口加圆形水面，磨圆两河之间的针尖陆地
        const pools=[];for(const ch of site.channels)for(const end of [ch.points[0],ch.points.at(-1)]){
          for(const other of site.channels){if(other===ch)continue;const q=WorldAtlasCitySite.distanceToChannel(end,other,metric);
            if(q.distance<q.widthMetres/2000+.02){const r=Math.max(q.widthMetres,end.widthMetres||0)/2000*1.2,pts=[];
              for(let k=0;k<28;k++){const t=k/28*Math.PI*2;pts.push({column:end.column+Math.cos(t)*r/metric.column,row:end.row+Math.sin(t)*r/metric.row});}
              pools.push(localPath(pts)+'Z');break;}}}
        const riverWater=site.channels.map(channel=>ribbon(channel,1)).concat(pools).join(' '),
          widths=site.channels.flatMap(channel=>channel.points.map(p=>p.widthMetres)),
          bankOutline=svg('mask',{id:'city-river-outer-banks',maskUnits:'userSpaceOnUse',
            x:b.west-recipe.location.column,y:b.north-recipe.location.row,width:b.east-b.west,height:b.south-b.north,'mask-type':'luminance'});
        bankOutline.append(svg('path',{d:sitePath(site.dryArea),fill:'#fff'}));
        bankOutline.append(svg('path',{d:riverWater,fill:'#000','fill-rule':'nonzero'}));definitions.append(bankOutline);
        // One shared water surface covers every bank, including the joined
        // tributary cap. Draw outlines only outside that complete surface.
        water.append(svg('path',{d:site.channels.map(channel=>ribbon(channel,1,.004)).join(' '),
          fill:palette.riverbank,opacity:.8,class:'city-riverbank','fill-rule':'nonzero'}));
        water.append(svg('path',{d:riverWater,fill:palette.water,class:'city-supply-river','fill-rule':'nonzero',
          'data-min-width-m':Math.min(...widths),'data-max-width-m':Math.max(...widths)}));
        water.append(svg('path',{d:riverWater,fill:'none',stroke:palette.waterEdge,'stroke-width':.7,
          'vector-effect':'non-scaling-stroke',mask:'url(#city-river-outer-banks)',class:'city-river-outline'}));
      }
      const source=site.waterSource;
      if(source.kind==='groundwater')water.append(svg('circle',{cx:source.location.column-recipe.location.column,cy:source.location.row-recipe.location.row,r:.028/metric.row,fill:'#9dbcc2',stroke:'#536d75','stroke-width':1,'vector-effect':'non-scaling-stroke',class:'city-water-well'}));
      group.append(water);
      const lakes=svg('g',{class:'city-local-lakes','data-lake-count':site.lakes.length});
      for(const lake of site.lakes)lakes.append(svg('path',{d:lake.patches.map(p=>localPath(p)+'Z').join(' '),fill:palette.water,
        'data-water-level-m':lake.waterLevelMetres,'data-area-km2':lake.areaKm2}));
      group.append(lakes);
      const roadWidth=recipe.urban.streetWidthsMetres.arterial/1000;
      const roads=svg('g',{class:'city-external-roads',fill:'none','stroke-linecap':'round','stroke-linejoin':'round',
        'clip-path':'url(#city-river-dry-ground)'}),roadPaint=svg('g',{transform:physicalTransform}),segments={regional:[],village:[]};
      roads.append(roadPaint);
      const field=site.surface,bounds=field.bounds;
      const nearLine=(p,points)=>{let best=Infinity;for(let i=1;i<points.length;i++){
        const a=points[i-1],b=points[i],dx=(b.column-a.column)*metric.column,dy=(b.row-a.row)*metric.row,
          px=(p.column-a.column)*metric.column,py=(p.row-a.row)*metric.row,t=Math.max(0,Math.min(1,(px*dx+py*dy)/(dx*dx+dy*dy)));
        best=Math.min(best,Math.hypot(px-dx*t,py-dy*t));}return best;};
      const allowed=(point,corridor)=>{
        const u=(point.column-bounds.west)/(bounds.east-bounds.west),v=(point.row-bounds.north)/(bounds.south-bounds.north);
        if(u<0||u>1||v<0||v>1)return false;
        return WorldAtlasCitySite.isDry(field,point)&&!site.channels.some(channel=>{const near=window.WorldAtlasCitySite.distanceToChannel(point,channel,metric);return near.distance<near.widthMetres/2000+.004;})
          ||site.bridges.some(bridge=>nearLine(point,bridge.points)<.02);
      };
      for(const corridor of [...recipe.transport.corridors,...site.ruralRoads].filter(c=>c.kind==='road'&&!c.fieldTrack)){
        let run=[];
        const flush=()=>{if(run.length>1)segments[corridor.local?'village':'regional'].push(kilometrePath(run));run=[];};
        for(let i=1;i<corridor.points.length;i++){
          const a=corridor.points[i-1],b=corridor.points[i];
          const count=Math.max(1,Math.ceil(Math.hypot((b.column-a.column)*metric.column,(b.row-a.row)*metric.row)/.06));
          for(let j=0;j<=count;j++){
            const t=j/count,point={row:a.row+(b.row-a.row)*t,column:a.column+(b.column-a.column)*t};
            if(allowed(point,corridor))run.push(point);else flush();
          }
        }flush();
      }
      for(const kind of ['regional','village']){
        const local=kind==='village',width=local?recipe.urban.streetWidthsMetres.collector/1000:roadWidth,
          d=segments[kind].join(' ');
        roadPaint.append(svg('path',{d,stroke:palette.roadEdge,'stroke-width':width*1.35,
          'data-width':width*1.35,'data-minimum-pixels':local?1.15:2.3}));
        roadPaint.append(svg('path',{d,stroke:palette.road,'stroke-width':width,
          'data-width':width,'data-minimum-pixels':local ? .65 : 1.35}));
      }
      group.append(roads);
      const bridges=svg('g',{class:'city-local-bridges','data-bridge-count':site.bridges.length,transform:physicalTransform});
      for(const bridge of site.bridges){
        let [a,b]=bridge.points,dx=(b.column-a.column)*metric.column,dy=(b.row-a.row)*metric.row,length=Math.hypot(dx,dy),
          width=bridge.widthMetres/1000,rail=bridge.kind==='rail',offsetPoints=offset=>bridge.points.map(p=>({
            row:p.row+dx/length*offset/metric.row,column:p.column-dy/length*offset/metric.column}));
        // 星球推演：长桥（>120 m）画成真正的大桥——加宽桥面、水中按跨距立桥墩（带分水尖）、两岸桥台
        const longBridge=length>.12&&!rail;
        if(longBridge){
          const deck=Math.max(width,.02),ux=dx/length,uy=dy/length,nx=-uy,ny=ux,
            P=(p,u,v)=>({column:p.column+(ux*u+nx*v)/metric.column,row:p.row+(uy*u+ny*v)/metric.row}),
            spans=Math.max(3,Math.round(length/.07)),pierHalf=deck/2+.007,thick=.006,piers=[];
          for(let i=1;i<spans;i++){const t=i/spans,c={column:a.column+(b.column-a.column)*t,row:a.row+(b.row-a.row)*t};
            piers.push(kilometrePath([P(c,0,-pierHalf-.006),P(c,thick,-pierHalf),P(c,thick,pierHalf),P(c,0,pierHalf+.006),P(c,-thick,pierHalf),P(c,-thick,-pierHalf)])+'Z');}
          bridges.append(svg('path',{d:piers.join(' '),fill:'#8f8773',stroke:'#6f6858','stroke-width':.0004,class:'city-bridge-piers'}));
          const abut=[];for(const [p,dir] of [[a,1],[b,-1]])abut.push(kilometrePath([P(p,-.012*dir,-deck/2-.008),P(p,.02*dir,-deck/2-.003),P(p,.02*dir,deck/2+.003),P(p,-.012*dir,deck/2+.008)])+'Z');
          bridges.append(svg('path',{d:abut.join(' '),fill:'#b8ad92',stroke:'#7d745f','stroke-width':.0004,class:'city-bridge-abutments'}));
          width=deck;
        }
        bridges.append(svg('path',{d:kilometrePath(bridge.points),fill:'none',stroke:palette.roadEdge,'stroke-width':width+.0015}));
        bridges.append(svg('path',{d:kilometrePath(bridge.points),fill:'none',stroke:rail?palette.court:palette.road,'stroke-width':width,
          class:'city-bridge-deck','data-width-metres':bridge.widthMetres,'data-bridge-kind':bridge.kind}));
        if(rail){
          const ties=[],count=Math.ceil(length/.0018);
          for(let i=0;i<=count;i++){const t=i/count,p={column:a.column+(b.column-a.column)*t,row:a.row+(b.row-a.row)*t};
            ties.push(kilometrePath([-1,1].map(sign=>({column:p.column-dy/length*width*.33*sign/metric.column,
              row:p.row+dx/length*width*.33*sign/metric.row}))));}
          bridges.append(svg('path',{d:ties.join(' '),fill:'none',stroke:'#8e9990','stroke-width':.0003,class:'city-rail-bridge-ties'}));
          for(const sign of [-1,1])bridges.append(svg('path',{d:kilometrePath(offsetPoints(sign*.0007175)),
            fill:'none',stroke:'#66766e','stroke-width':.00018,class:'city-rail-bridge-rail'}));
        }
        for(const sign of [-1,1]){const offset=width/2*sign;
          bridges.append(svg('path',{d:kilometrePath(offsetPoints(offset)),
            fill:'none',stroke:'#727e77','stroke-width':.65,'vector-effect':'non-scaling-stroke'}));}
      }
      group.append(bridges);return group;
    }
    function drawHarbor(harbor,cityPlan){
      if(!harbor)return svg('g');
      const m=recipe.urban.gridCellKilometres,n=harbor.outward,t={x:-n.y,y:n.x},s=harbor.shore,
        extent=harbor.berthLayout.span*harbor.berthLayout.scale,capacity=harbor.berthLayout.capacity,
        at=(x,y)=>({column:s.column+(t.x*x+n.x*y)/m.column,row:s.row+(t.y*x+n.y*y)/m.row}),
        distance=(a,b)=>Math.hypot((a.column-b.column)*m.column,(a.row-b.row)*m.row),
        mix=(a,b,u)=>({column:a.column+(b.column-a.column)*u,row:a.row+(b.row-a.row)*u});
      const path=points=>points.map((p,i)=>`${i?'L':'M'}${((p.column-recipe.location.column)*m.column).toFixed(9)} ${((p.row-recipe.location.row)*m.row).toFixed(9)}`).join(' '),
        physicalTransform=`scale(${1/m.column} ${1/m.row})`;
      const group=svg('g',{class:'city-harbor','data-harbor-kind':harbor.kind,'stroke-linejoin':'round','stroke-linecap':'round'}),
        ground=svg('g',{class:'city-harbor-ground',transform:physicalTransform}),structures=svg('g',{class:'city-harbor-structures',transform:physicalTransform}),
        detail=svg('g',{class:'city-harbor-fine-detail',transform:physicalTransform}),labels=svg('g'),
        roadEdges=svg('g',{class:'city-harbor-road-edges','stroke-linejoin':'round','stroke-linecap':'round'}),
        roadSurfaces=svg('g',{class:'city-harbor-road-surfaces','stroke-linejoin':'round','stroke-linecap':'round'});
      group.append(ground,structures,detail,labels);
      ground.append(roadEdges,roadSurfaces);
      const field=recipe.localSite.surface,b=field.bounds;
      const inside=p=>p.column>=b.west&&p.column<=b.east&&p.row>=b.north&&p.row<=b.south;
      const inChannel=p=>recipe.localSite.channels.some(channel=>{const q=WorldAtlasCitySite.distanceToChannel(p,channel,m);return q.distance<q.widthMetres/2000;});
      const dry=p=>inside(p)&&WorldAtlasCitySite.isDry(field,p)&&!inChannel(p),wet=p=>inside(p)&&(!WorldAtlasCitySite.isDry(field,p)||inChannel(p));
      const random=salt=>{let x=(recipe.seed^Math.imul(salt,0x9e3779b9))>>>0;x=Math.imul(x^x>>>16,0x21f0aaad);return ((x^x>>>15)>>>0)/4294967296;};
      const small=recipe.population.estimate<1800,modern=['industrial','contemporary'].includes(recipe.era),
        quayWidth=small?.006:modern?.018:.012,promenadeWidth=small?.0025:.004,
        accessWidth=cityPlan.streetWidths.arterial*cityPlan.gridCellKilometres,berths=[],fronts=[],quays=[];
      const bounds=points=>({west:Math.min(...points.map(p=>p.column)),east:Math.max(...points.map(p=>p.column)),
        north:Math.min(...points.map(p=>p.row)),south:Math.max(...points.map(p=>p.row))});
      const intersects=(a,z,p,q)=>{const x=z.column-a.column,y=z.row-a.row,sx=q.column-p.column,sy=q.row-p.row,den=x*sy-y*sx;
        if(Math.abs(den)<1e-16)return false;
        const u=((p.column-a.column)*sy-(p.row-a.row)*sx)/den,v=((p.column-a.column)*y-(p.row-a.row)*x)/den;
        return u>=0&&u<=1&&v>=0&&v<=1;
      };
      const within=(p,poly)=>{let result=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){
        const a=poly[i],z=poly[j];if((a.row>p.row)!==(z.row>p.row)&&p.column<(z.column-a.column)*(p.row-a.row)/(z.row-a.row)+a.column)result=!result;}return result;};
      const overlap=(a,z)=>a.some(p=>within(p,z))||z.some(p=>within(p,a))||a.some((p,i)=>z.some((q,j)=>intersects(p,a[(i+1)%a.length],q,z[(j+1)%z.length])));
      const band=(a,z,half)=>{const length=distance(a,z);if(length<1e-8)return [];
        const x=-(z.row-a.row)*m.row/length*half,y=(z.column-a.column)*m.column/length*half;
        return [[a,1],[z,1],[z,-1],[a,-1]].map(([p,sign])=>({column:p.column+x*sign/m.column,row:p.row+y*sign/m.row}));};
      const portBounds=bounds([at(-extent-.18,-.65),at(extent+.18,-.65),at(extent+.18,.65),at(-extent-.18,.65)]),
        touches=(a,z)=>a.west<=z.east&&a.east>=z.west&&a.north<=z.south&&a.south>=z.north;
      const obstacles=[];
      const reserve=(points,road=false,owner=null)=>{if(points.length<3)return;const box=bounds(points);if(touches(box,portBounds))obstacles.push({points,box,road,owner});};
      // 星球推演：港区在城内，沿岸那段城墙是临水面（设水门）；港区内的城墙、塔楼、城门塔楼都不算码头障碍
      const yardC=harbor.reservedLand?{column:harbor.reservedLand.reduce((a2,p)=>a2+p.column,0)/harbor.reservedLand.length,row:harbor.reservedLand.reduce((a2,p)=>a2+p.row,0)/harbor.reservedLand.length}:null,
        yardBig=yardC?harbor.reservedLand.map(p=>({column:yardC.column+(p.column-yardC.column)*1.35,row:yardC.row+(p.row-yardC.row)*1.35})):null,
        inYard=p=>{if(!yardBig)return false;let r=false;for(let i=0,j=yardBig.length-1;i<yardBig.length;j=i++){const a2=yardBig[j],b2=yardBig[i];if((a2.row>p.row)!==(b2.row>p.row)&&p.column<(b2.column-a2.column)*(p.row-a2.row)/(b2.row-a2.row)+a2.column)r=!r;}return r;},
        centreOf=pts=>({column:pts.reduce((a2,p)=>a2+p.column,0)/pts.length,row:pts.reduce((a2,p)=>a2+p.row,0)/pts.length});
      for(const item of [...cityPlan.buildings,...cityPlan.landmarks,...cityPlan.countryside,...cityPlan.towers.filter(t=>!inYard(centreOf(t.points))),...cityPlan.plazas])reserve(item.points);
      for(const bridge of recipe.localSite.bridges){
        const half=(bridge.widthMetres+1.5)/2000+.005;
        for(let i=1;i<bridge.points.length;i++){
          const a=bridge.points[i-1],z=bridge.points[i],length=distance(a,z),reach=.010;
          const start=mix(a,z,-reach/length),end=mix(a,z,1+reach/length);
          reserve(band(start,end,half),false,bridge);
        }
      }
      for(const gate of cityPlan.gates)for(const points of gate.towers)if(!inYard(centreOf(points)))reserve(points);
      if(cityPlan.fortress)reserve(cityPlan.fortress.clearancePoints);
for(const [a,z] of [...cityPlan.walls,...cityPlan.innerWalls]){if(inYard({column:(a.column+z.column)/2,row:(a.row+z.row)/2}))continue;reserve(band(a,z,cityPlan.streetWidths.collector*cityPlan.gridCellKilometres*1.6+.001));}
      for(const street of cityPlan.streets){const half=cityPlan.streetWidths[street.kind]*cityPlan.gridCellKilometres*.5+.0015;
        if(!Number.isFinite(half))continue;
        for(let i=1;i<street.points.length;i++)reserve(band(street.points[i-1],street.points[i],half),true);
      }
      const rings=points=>[points.map(p=>[p.column,p.row])];
      const blocked=(points,roads=true,landing=null)=>{const box=bounds(points);return obstacles.some(o=>{
        if((!roads&&o.road)||!touches(box,o.box)||!overlap(points,o.points))return false;
        if(!landing||o.owner!==landing.owner)return true;
        // Only this bridge's dry end collar may be shared with a footpath.
        // Its complete deck and the other bridges remain reserved.
        if(!landing.portal)return false;
        return WorldAtlasCitySite.intersectPolygons(rings(points),rings(o.points)).some(polygon=>polygon.some(ring=>ring.some(([column,row])=>
          !within({column,row},landing.portal))));
      });};
      const safeArea=(points,test)=>{
        if(!points.every(test))return false;
        const center=points.reduce((p,z)=>({column:p.column+z.column/points.length,row:p.row+z.row/points.length}),{column:0,row:0});
        if(!test(center))return false;
        return points.every((a,i)=>{const z=points[(i+1)%points.length],steps=Math.max(2,Math.ceil(distance(a,z)/.006));
          for(let k=1;k<steps;k++)if(!test(mix(a,z,k/steps)))return false;return true;});
      };
      const channelWater=recipe.localSite.channels.map(channel=>{
        const banks=[[],[]];
        for(let i=0;i<channel.points.length;i++){
          const p=channel.points[i],a=channel.points[Math.max(0,i-1)],z=channel.points[Math.min(channel.points.length-1,i+1)],
            dx=(z.column-a.column)*m.column,dy=(z.row-a.row)*m.row,length=Math.hypot(dx,dy)||1,half=p.widthMetres/2000;
          for(const [side,sign]of [[0,-1],[1,1]])banks[side].push({column:p.column-dy/length*half*sign/m.column,row:p.row+dx/length*half*sign/m.row});
        }return banks[0].concat(banks[1].reverse());
      }).map(points=>({points,box:bounds(points)}));
      const dryArea=points=>{
        if(!safeArea(points,dry)||WorldAtlasCitySite.waterOverlaps(field,points))return false;
        const box=bounds(points);
        if(channelWater.some(w=>touches(box,w.box)&&overlap(points,w.points)))return false;
        if(field.lakeDepths)for(const triangle of WorldAtlasCitySite.surfaceTriangles(field,box)){
          const wet=[];
          for(let i=0;i<3;i++){
            const a=triangle[i],z=triangle[(i+1)%3];if(a.depth>=0)wet.push(a);
            if((a.depth>=0)!==(z.depth>=0))wet.push(mix(a,z,a.depth/(a.depth-z.depth)));
          }
          if(wet.length>=3&&overlap(points,wet))return false;
        }
        return true;
      };
      const safeLink=(a,z,landing=null)=>{
        if(distance(a,z)<1e-8)return true;
        const points=band(a,z,.0016);
        return dryArea(points)&&!blocked(points,false,landing)&&WorldAtlasCities.streetSegmentGrade(a,z,recipe)<=.12;
      };
      const line=(parent,points,color,width,extra={})=>parent.append(svg('path',{d:path(points),fill:'none',stroke:color,'stroke-width':width,...extra}));
      const bank=x=>{let low=-.25*harbor.berthLayout.scale,high=harbor.kind==='river'?harbor.channelWidthMetres/2000:.40*harbor.berthLayout.scale;
        if(!dry(at(x,low))||!wet(at(x,high)))return null;
        for(let i=0;i<22;i++){const middle=(low+high)/2;if(dry(at(x,middle)))low=middle;else high=middle;}return (low+high)/2;};
      const count=Math.max(16,Math.min(80,Math.ceil(extent*2/.018)));
      for(let i=0;i<=count;i++){const x=(i/count*2-1)*extent,y=bank(x);fronts.push(y===null?null:{x,y});}
      let run=[];
      const candidates=[];
      const flush=()=>{if(run.length>1){
        const land=run.map(p=>at(p.x,p.y-quayWidth)),edge=run.map(p=>at(p.x,p.y-.0012)),points=land.concat(edge.slice().reverse()),
          promenade=run.map(p=>at(p.x,p.y-quayWidth*.62));
        candidates.push({id:`quay-${candidates.length}`,front:run.slice(),land,edge,points,promenade});
      }run=[];};
      for(const front of fronts){if(!front){flush();continue;}const previous=run.at(-1);
        if(previous){const poly=[at(previous.x,previous.y-quayWidth),at(front.x,front.y-quayWidth),at(front.x,front.y-.0012),at(previous.x,previous.y-.0012)];
          if(!dryArea(poly)||blocked(poly,false)){flush();run.push(front);continue;}}
        run.push(front);
      }flush();
      const project=(p,a,z)=>{
        const dx=(z.column-a.column)*m.column,dy=(z.row-a.row)*m.row,
          u=Math.max(0,Math.min(1,((p.column-a.column)*m.column*dx+(p.row-a.row)*m.row*dy)/(dx*dx+dy*dy||1)));
        return mix(a,z,u);
      };
      const anchors=[];
      if(harbor.access.length){
        const end=harbor.access.at(-1),start=harbor.access[0],point=distance(end,harbor.landPoint)<=distance(start,harbor.landPoint)?end:start;
        anchors.push({id:'harbor-access',points:[point],width:accessWidth});
      }else if(harbor.landPoint){
        // 星球推演：港区在城墙内时没有出城的港口通道——直接从上岸点、以及城里离港最近的几条街接入码头
        anchors.push({id:'harbor-access',points:[harbor.landPoint],width:accessWidth});
        const near=[];for(const street of cityPlan.streets)if(street.kind!=='rail')for(const p of street.points){const d=distance(p,harbor.landPoint);if(d<.35)near.push({p,d});}
        near.sort((a2,z2)=>a2.d-z2.d);for(const [k,o] of near.slice(0,6).entries())anchors.push({id:'harbor-street-'+k,points:[o.p],width:promenadeWidth});
      }
      for(const bridge of recipe.localSite.bridges)if(bridge.kind==='road')for(const [index,p]of [[0,bridge.points[0]],[1,bridge.points.at(-1)]]){
        const adjacent=index?bridge.points.at(-2):bridge.points[1],length=distance(p,adjacent),
          outward=mix(p,adjacent,-.010/length),inward=mix(p,adjacent,.004/length),
          portal=band(outward,inward,(bridge.widthMetres+1.5)/2000+.005);
        if(dry(p))anchors.push({id:`${bridge.id}-landing-${index}`,points:[p],width:promenadeWidth,landing:{owner:bridge,portal}});
      }
      const approach=(a,z,startWidth,factor)=>{
        const length=distance(a,z);if(length<1e-8)return [];
        const nx=-(z.row-a.row)*m.row/length,ny=(z.column-a.column)*m.column/length;
        return [[a,startWidth/2],[z,promenadeWidth/2],[z,-promenadeWidth/2],[a,-startWidth/2]]
          .map(([p,half])=>({column:p.column+nx*half*factor/m.column,row:p.row+ny*half*factor/m.row}));
      };
      // Establish every quay's actual pedestrian route before making its docks
      // or buildings. A bridge reservation is opened only at its own dry portal.
      let pending=candidates.slice();
      while(pending.length){
        let connected=false;
        for(const quay of pending){
          const targets=[];
          for(const anchor of anchors){
            for(const point of anchor.points)for(let i=1;i<quay.promenade.length;i++)
              targets.push({anchor,a:point,z:project(point,quay.promenade[i-1],quay.promenade[i])});
            for(const point of quay.promenade)for(let i=1;i<anchor.points.length;i++)
              targets.push({anchor,a:project(point,anchor.points[i-1],anchor.points[i]),z:point});
          }
          targets.sort((a,z)=>distance(a.a,a.z)-distance(z.a,z.z));
          for(const {anchor,a,z}of targets){
            const edge=approach(a,z,anchor.width,1.20),surface=approach(a,z,anchor.width,1),length=distance(a,z);
            if(length>=1e-8&&(edge.length!==4||!dryArea(edge)||blocked(edge,false,anchor.landing)
                ||WorldAtlasCities.streetSegmentGrade(a,z,recipe)>.12))continue;
            quay.connection={anchor:anchor.id,a,z,edge,surface,width:anchor.width};
            quays.push(quay);anchors.push({id:quay.id,points:quay.promenade,width:promenadeWidth});connected=true;break;
          }
        }
        pending=pending.filter(q=>!q.connection);if(!connected)break;
      }
      for(const quay of quays){
        const {points,edge,land,promenade,connection}=quay;
        ground.append(svg('path',{d:path(points)+'Z',class:'city-harbor-quay',fill:small?'#b9aa8d':'#ddd8c5',
          'data-quay-id':quay.id,'data-connected-to':connection.anchor}));
        line(structures,edge,small?'#8a795f':'#8f9485',.0012,{class:'city-harbor-coping'});
        line(detail,land,'#f2eadd',.00055);line(ground,promenade,'#f1eddf',promenadeWidth);
        if(connection.edge.length){
          roadEdges.append(svg('path',{d:path(connection.edge)+'Z',fill:'#adb6bf',stroke:'none',class:'city-harbor-road-edge'}));
          roadSurfaces.append(svg('path',{d:path(connection.surface)+'Z',fill:'#fffdf7',stroke:'none',class:'city-harbor-road-link',
            'data-quay-id':quay.id,'data-connected-to':connection.anchor,
            'data-start-width-metres':connection.width*1000,'data-end-width-metres':promenadeWidth*1000}));
        }
      }
      const onQuay=x=>quays.some(quay=>x>=quay.front[0].x&&x<=quay.front.at(-1).x);
      // 港区在城墙内（沿岸墙）时，栈桥从岸边起步，不穿墙伸进城里
      const walledPort=[...cityPlan.walls].some(([a2,z2])=>inYard({column:(a2.column+z2.column)/2,row:(a2.row+z2.row)/2}));
      const palette=WorldAtlasCityCharacter.profile(recipe).roof;
      for(let i=0;i<capacity;i++){
        const base=capacity===1?0:(i/(capacity-1)*2-1)*extent*.79+(random(i+301)-.5)*extent/capacity*.35;
        let chosen=null;
        for(const offset of [0,-.012,.012,-.025,.025]){
          const x=base+offset,y=bank(x);if(y===null||!onQuay(x))continue;
          const length=harbor.kind==='river'?Math.min(small?.035:.080,harbor.channelWidthMetres/1000*.25):
            small?.025+random(i+303)*.035:modern?.080+random(i+303)*.15:.045+random(i+303)*.090,
            half=small?.0022+random(i+309)*.0012:modern?.007+random(i+309)*.005:.0033+random(i+309)*.0022,
            a=bank(x-.012),z=bank(x+.012),slope=a!==null&&z!==null?(z-a)/.024:0,
            cosine=1/Math.hypot(1,slope),sine=slope*cosine,
            dockAt=(u,v)=>at(x+cosine*u-sine*v,y+sine*u+cosine*v),
            pier=[dockAt(-half,walledPort?-.002:-quayWidth*.75),dockAt(half,walledPort?-.002:-quayWidth*.75),dockAt(half,length),dockAt(-half,length)],
            water=[dockAt(-half,.0015),dockAt(half,.0015),dockAt(half,length),dockAt(-half,length)];
          if(length<.012||!safeArea(water,wet)||blocked(pier,false)||berths.some(berth=>overlap(pier,berth.pier)))continue;
          chosen={x,y,length,half,pier,dockAt};break;
        }
        if(!chosen)continue;berths.push(chosen);const {x,y,length,half,pier,dockAt}=chosen;reserve(pier,false,chosen);
        const dock=svg('g',{class:'city-harbor-dock'});structures.append(dock);
        dock.append(svg('path',{d:path(pier)+'Z',class:'city-harbor-pier',fill:['#b9a17c','#c2ac87','#ae9470'][i%3],
          stroke:'#807563','stroke-width':.00065,'data-width-metres':half*2000,'data-length-metres':length*1000}));
        line(dock,[dockAt(-half,-.002),dockAt(-half,length)],'#dbc9a5',.00065);
        line(dock,[dockAt(half,-.002),dockAt(half,length)],'#8d785b',.0008);
        const plankCount=Math.ceil((length+quayWidth*.75)/.0016),planks=[];
        for(let k=1;k<plankCount;k++)planks.push(path([dockAt(-half*.9,-quayWidth*.75+(length+quayWidth*.75)*k/plankCount),dockAt(half*.9,-quayWidth*.75+(length+quayWidth*.75)*k/plankCount)]));
        detail.append(svg('path',{d:planks.join(' '),class:'city-pier-planks',fill:'none',stroke:'#ece0c4','stroke-opacity':.65,'stroke-width':.00022}));
        for(let k=1;k<=Math.floor(length/.012);k++)for(const side of [-1,1]){
          const p=dockAt(side*half,k*.012);detail.append(svg('circle',{cx:(p.column-recipe.location.column)*m.column,cy:(p.row-recipe.location.row)*m.row,r:.0006,fill:'#716451',class:'city-pier-bollard'}));
        }
        // Moored craft use independent metre dimensions and furled rigging.
        for(const side of [-1,1]){
          if(random(i*19+side+340)<.32)continue;
          const boatLength=Math.min(length*.60,small?.008+random(i*17+side+341)*.009:modern?.022+random(i*17+side+341)*.038:.014+random(i*17+side+341)*.023),
            boatWidth=boatLength*(.18+random(i*13+side+342)*.055),bx=side*(half+boatWidth*.60+.0012),by=length*(.45+random(i*23+side+343)*.25),
            heading=(random(i*11+side+344)-.5)*.13,cos=Math.cos(heading),sin=Math.sin(heading),
            boatAt=(u,v)=>dockAt(bx+u*cos-v*sin,by+u*sin+v*cos),
            outline=[[0,-.5],[.30,-.43],[.48,-.24],[.50,.10],[.43,.40],[.22,.48],[-.22,.48],[-.43,.40],[-.50,.10],[-.48,-.24],[-.30,-.43]].map(([u,v])=>boatAt(u*boatWidth,v*boatLength));
          if(!safeArea(outline,wet)||blocked(outline,false)||berths.some(berth=>overlap(outline,berth.pier)))continue;
          const ship=svg('g',{class:'city-moored-craft'});structures.append(ship);
          ship.append(svg('path',{d:path(outline)+'Z',class:'city-harbor-vessel',fill:['#d7c9aa','#eee1c4','#c5b594'][i%3],stroke:'#687369',
            'stroke-width':.00055,'data-length-metres':boatLength*1000,'data-width-metres':boatWidth*1000}));
          const deck=outline.map(p=>mix(dockAt(bx,by),p,.78));
          ship.append(svg('path',{d:path(deck)+'Z',fill:'#ae9571','fill-opacity':.4}));
          for(const v of [-.2,.16]){const hatch=[[-.26,v-.07],[.26,v-.07],[.26,v+.07],[-.26,v+.07]].map(([u,z])=>boatAt(u*boatWidth,z*boatLength));
            detail.append(svg('path',{d:path(hatch)+'Z',fill:'#88795f',class:'city-ship-hatch'}));}
          line(detail,[boatAt(0,-boatLength*.28),boatAt(0,boatLength*.31)],'#eee5ce',.0005);
          for(const v of [-.25,.25])line(detail,[boatAt(-side*boatWidth*.44,v*boatLength),dockAt(side*half,by+v*boatLength)],'#6d766b',.00022,{class:'city-mooring-line'});
          reserve(outline);
        }
        const width=small?.010+random(i+329)*.006:.016+random(i+329)*.013,depth=small?.009+random(i+330)*.006:.014+random(i+330)*.012,
          a=bank(x-.012),z=bank(x+.012),slope=a!==null&&z!==null?(z-a)/.024:0,tangent={x:1/Math.hypot(1,slope),y:slope/Math.hypot(1,slope)},apron=at(x,y-quayWidth*.62);
        let store=null;
        storeSearch:for(const along of [0,-.025,.025,-.050,.050])for(const gap of [.007,.015,.028,.045,.065]){
          const setback=quayWidth+depth*.5+gap,center={x:x+tangent.x*along+tangent.y*setback,y:y+tangent.y*along-tangent.x*setback},
            houseAt=(u,v)=>at(center.x+tangent.x*u-tangent.y*v,center.y+tangent.y*u+tangent.x*v),
            house=[[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]].map(([u,v])=>houseAt(u*width,v*depth)),
            heights=house.map(p=>WorldAtlasCitySite.elevationAt(field,p)),door=houseAt(0,depth*.5);
          if(dryArea(house)&&Math.max(...heights)-Math.min(...heights)<3.5&&!blocked(house)&&safeLink(door,apron,{owner:chosen})){
            store={house,houseAt,door};break storeSearch;
          }
        }
        if(store){
          const {house,houseAt,door}=store;
          const warehouse=svg('g',{class:'city-harbor-storehouse'});structures.append(warehouse);
          warehouse.append(svg('path',{d:path(house)+'Z',class:'city-harbor-warehouse',fill:palette[i%palette.length],stroke:'#687062',
            'stroke-width':.00045,'data-width-metres':width*1000,'data-depth-metres':depth*1000}));
          const ridge=[houseAt(-width*.5,0),houseAt(width*.5,0)];
          warehouse.append(svg('path',{d:path([house[0],house[1],ridge[1],ridge[0]])+'Z',fill:'#fff4d4','fill-opacity':.14}));
          warehouse.append(svg('path',{d:path([ridge[0],ridge[1],house[2],house[3]])+'Z',fill:'#293f3c','fill-opacity':.18}));
          line(detail,ridge,'#eee5ce',.00035);
          line(ground,[door,apron],'#eee8d8',.0028);
          reserve(house);
        }
      }
      if(harbor.kind==='sea'&&!small&&harbor.shelter<.78&&berths.length>1){
        const half=.004,cap=p=>Array.from({length:12},(_,i)=>({column:p.column+Math.cos(i*Math.PI/6)*half/m.column,
          row:p.row+Math.sin(i*Math.PI/6)*half/m.row}));
        let wall=null;
        // A mole starts on the actual bank. Only its seaward arm must be wholly wet.
        search:for(const side of [1,-1])for(const gap of [.025,.045,.070,.100]){
          const edge=side>0?Math.max(...berths.map(p=>p.x+p.half)):Math.min(...berths.map(p=>p.x-p.half)),
            x=edge+side*gap,y=bank(x);if(y===null)continue;
          const root=at(x,y-Math.max(.008,quayWidth*.75)),
            landing=quays.flatMap(quay=>quay.promenade).find(p=>distance(p,root)<.12&&safeLink(root,p));
          if(!landing||!safeArea(cap(root),dry))continue;
          const depth=Math.max(y+.060,...berths.map(p=>p.y+p.length+.030)),
            candidate=[root,at(x,depth),at(x-side*Math.min(.14,Math.max(.055,extent*.30)),depth)],
            arms=[band(candidate[0],candidate[1],half),band(candidate[1],candidate[2],half)];
          if(!safeArea(arms[0],inside)||!safeArea(arms[1],wet)||arms.some(points=>blocked(points,false))
              ||candidate.some(p=>blocked(cap(p),false))||!safeArea(cap(candidate[1]),wet)||!safeArea(cap(candidate[2]),wet))continue;
          // Across the full width, each shore transition goes from land to water once.
          // Returning to land would turn this into an accidental bridge over a bay or island.
          const start=y-Math.max(.008,quayWidth*.75),steps=Math.ceil((depth-start)/.002);
          let connected=true;
          crossings:for(const across of [-half,0,half]){
            let enteredWater=false;
            for(let k=0;k<=steps;k++){
              const p=at(x+across,start+(depth-start)*k/steps);
              if(wet(p))enteredWater=true;else if(enteredWater){connected=false;break crossings;}
            }
            if(!enteredWater){connected=false;break;}
          }
          if(!connected)continue;
          wall=candidate;break search;
        }
        if(wall){
          line(structures,wall,'#77887e',.007,{class:'city-harbor-breakwater'});line(structures,wall,'#d5ccb1',.0045);
          const tip=wall.at(-1);structures.append(svg('circle',{cx:(tip.column-recipe.location.column)*m.column,cy:(tip.row-recipe.location.row)*m.row,r:.0035,fill:'#ece0bd',stroke:'#6e7e70',
            'stroke-width':.0005,class:'city-harbor-beacon'}));
        }
      }
      group.dataset.berthCount=String(berths.length);group.dataset.quayRuns=String(quays.length);
      line(roadEdges,harbor.access,'#adb6bf',accessWidth*1.20,{class:'city-harbor-access-edge'});
      line(roadSurfaces,harbor.access,'#fffdf7',accessWidth,{class:'city-harbor-access-surface'});
      if(harbor.sailing?.length)labels.append(svg('path',{d:localPath(harbor.sailing),fill:'none',stroke:'#558e9e','stroke-opacity':.6,
        'stroke-width':.9,'stroke-dasharray':'4 5','vector-effect':'non-scaling-stroke',class:'city-harbor-sailing'}));
      const label=svg('text',{'data-anchor-column':s.column,'data-anchor-row':s.row,'data-city-screen-label':harbor.name,
        'data-feature-id':'harbor',
        'data-feature-kind':'harbor','data-priority':0,'data-detail-level':0,'data-angle':0,'paint-order':'stroke fill',
        'text-anchor':'middle',fill:'#2f6984',stroke:'#f5faf6'});label.textContent='⚓ '+harbor.name;labels.append(label);
      return group;
    }
    function drawLayout(layout,reuseCamera=false) {
      recipe=layout.recipe;seed=layout.seed;saved=layout;
      const city=WorldAtlasCities.render(recipe,{grid:layout.grid,clipPrefix:'city-panel',cityPlan:layout.cityPlan,origin:recipe.location});
      city.dataset.seed=String(seed);city.dataset.population=String(recipe.population.estimate);
      city.dataset.layoutRevision=layout.layoutRevision;
      city.dataset.nativeRow=String(recipe.location.row);city.dataset.nativeColumn=String(recipe.location.column);
      const metric=recipe.urban.gridCellKilometres;
      container.setAttribute('transform',`scale(${metric.column} ${metric.row})`);
      const harbor=drawHarbor(recipe.harbor,layout.cityPlan);joinHarborRoadLayers(city,harbor,layout.cityPlan);
      const site=drawSite(recipe.localSite,layout.cityPlan),agriculture=city.querySelector('.city-agricultural-ground');
      // Ground cover shares the terrain's relief and contours. Buildings keep
      // their own upper layer, while roads remain visible across the fields.
      agriculture.setAttribute('transform',city.querySelector('.city-physical-drawing').getAttribute('transform'));
      site.insertBefore(agriculture,site.querySelector('.city-local-woodland'));
      container.replaceChildren(site,city,harbor);loading=false;
      if(window.WorldAtlasCityStyle){WorldAtlasCityStyle.apply(container,layout);WorldAtlasCityStyle.grain(viewport);}
      const messages=[],capacity=layout.cityPlan.housingCapacity;
      // 不再提示住宅安置数量（地形限制属正常情况）
      if(recipe.localSite.railwayStatus?.state==='unconnected')messages.push('当地地形未找到可行车站，铁路保留至城外。');
      notify(messages.join(' '));
      refreshNames();
      if(!reuseCamera)setExtent('city');else updateCamera();return recipe;
    }
    function refreshNames(){
      refreshUpdateButton();
      for(const node of container.querySelectorAll('[data-feature-id]'))if(node.dataset.featureId.startsWith('world-'))
        node.dataset.nameId='geography:'+node.dataset.featureId.slice(6);
      names?.applyLabels(container);if(recipe)updateCamera();
    }
    async function open(place,{regenerate=false,keepSeed=false,resetCamera=false}={}) {
      if(!place||place.kind!=='city'){clear();return null;}
      const reuseCamera=!resetCamera&&selected?.sourceId===place.sourceId&&recipe&&width&&height;
      request++;controller?.abort();controller=new AbortController();const current=request,signal=controller.signal;
      selected=place;recipe=null;saved=null;container.replaceChildren();loading=true;notify(`正在载入${place.name}…`);
      refreshUpdateButton();
      try {
        let layout=await layouts.read(place.sourceId);if(current!==request)return null;
        if(!layout||regenerate){
          const payload=await loadCity(place,{signal});if(current!==request)return null;
          if(payload.schema!=='world-atlas-city-map-v1'||payload.recipe?.id!==place.sourceId||payload.gridDigest!==gridDigest)throw new Error('城市数据与当前世界不一致');
          notify(`正在生成${place.name}…`);
          await new Promise(resolve=>requestAnimationFrame(resolve));if(current!==request)return null;
          let nextSeed=payload.recipe.seed;
          if(regenerate&&keepSeed&&layout?.seed!=null)nextSeed=layout.seed;
          else if(regenerate){
            const value=crypto.getRandomValues(new Uint32Array(1))[0];
            nextSeed=value===layout?.seed?(value+1)>>>0:value;
          }
          const {generated,cityPlan}=await generateCity({...structuredClone(payload.recipe),worldId,seed:nextSeed},payload.siteContext,nextSeed,payload.grid,place.name);
          if(current!==request)return null;generatedCount++;
          layout=await layouts.write({schema:WorldAtlasCityLayouts.schema,worldId,gridDigest,cityId:place.sourceId,
            generatorId:WorldAtlasCitySite.generatorId,revision:1,layoutRevision:crypto.randomUUID(),seed:nextSeed,grid:payload.grid,recipe:generated,cityPlan},
            {expectedRevision:layout?.revision??null,signal,isCurrent:()=>current===request});
          if(current!==request)return null;
        }
        return drawLayout(layout,reuseCamera);
      }catch(error){
        if(signal.aborted||current!==request)return null;
        loading=false;recipe=null;saved=null;notify('城市布局未能载入或保存：'+error.message);return null;
      }
    }
    function exportSnapshot() {
      if(!saved||!recipe||loading)throw new Error('请先打开已保存的城市布局');
      return structuredClone(saved);
    }
    async function updateLayout() {
      const value=exportSnapshot();
      request++;controller?.abort();controller=new AbortController();const current=request,signal=controller.signal;
      loading=true;refreshUpdateButton();notify('正在更新城市布局…');
      try{
        await new Promise(resolve=>requestAnimationFrame(resolve));if(current!==request)return null;
        value.cityPlan=WorldAtlasCities.plan(value.recipe,{grid:value.grid});generatedCount++;
        value.generatorId=WorldAtlasCitySite.generatorId;value.layoutRevision=crypto.randomUUID();
        const stored=await layouts.write(value,{expectedRevision:value.revision,signal,isCurrent:()=>current===request});
        if(current!==request)return null;
        return drawLayout(stored,true);
      }catch(error){
        if(signal.aborted||current!==request)return null;
        loading=false;refreshUpdateButton();notify('城市布局更新失败：'+error.message);return null;
      }
    }
    async function importSnapshot(snapshot,place=selected,{replace=false}={}) {
      request++;controller?.abort();controller=new AbortController();const current=request,signal=controller.signal;
      loading=true;
      refreshUpdateButton();
      try{
        const value=structuredClone(snapshot);layouts.validate(value);
        place ||= {id:'city:'+value.cityId,sourceId:value.cityId,kind:'city',name:value.recipe.name};
        if(place.kind!=='city'||place.sourceId!==value.cityId)throw new Error('导入布局与所选城市不一致');
        const previous=await layouts.read(value.cityId);if(current!==request)return null;
        if(previous&&!replace)throw new Error('该城市已有保存布局，请明确选择替换后再导入');
        const stored=await layouts.write(value,{expectedRevision:previous?.revision??null,signal,isCurrent:()=>current===request});
        if(current!==request)return null;
        selected=place;return drawLayout(stored);
      }catch(error){
        if(signal.aborted||current!==request)return null;
        loading=false;refreshUpdateButton();notify('城市布局导入失败：'+error.message);throw error;
      }
    }
    async function renameFeature(id,name) {
      if(!saved||!recipe||loading)throw new Error('请先打开城市');
      if(typeof name!=='string'||!name.trim())throw new Error('名称不能为空');
      const value=exportSnapshot(),matches=value.cityPlan.annotations.filter(feature=>String(feature.id)===String(id));
      if(id==='harbor'&&value.recipe.harbor)value.recipe.harbor.name=name.trim();
      else if(!matches.length)throw new Error('找不到当前布局中的地点');
      for(const feature of matches)feature.name=name.trim();
      for(const street of value.cityPlan.streets)if(String(street.id)===String(id))street.name=name.trim();
      value.recipe.localNames={...value.recipe.localNames,[id]:name.trim()};
      const current=request,signal=controller?.signal;
      try{
        const stored=await layouts.write(value,{expectedRevision:saved.revision,signal,isCurrent:()=>current===request});
        if(current!==request)return null;
        return drawLayout(stored,true);
      }catch(error){if(current===request&&!signal?.aborted)notify('名称保存失败：'+error.message);throw error;}
    }
    interaction=WorldAtlasInteraction.attach({viewport,
      getCamera:()=>({scale,translateX,translateY,minimumScale,maximumScale}),
      setCamera:next=>{scale=next.scale;translateX=next.translateX;translateY=next.translateY;updateCamera();},
      reset,onTap:()=>{},onCommit:()=>updateCamera()});
    const listeners=[];
    updateButton.addEventListener('click',updateLayout);listeners.push(()=>updateButton.removeEventListener('click',updateLayout));
    for(const [id,action] of [['zoom-in',()=>zoomBy(2)],['zoom-out',()=>zoomBy(.5)],['reset',reset],['city',()=>setExtent('city')],['region',()=>setExtent('region')]]){
      const node=document.getElementById('city-map-'+id);node.addEventListener('click',action);listeners.push(()=>node.removeEventListener('click',action));
    }
    const observer=new ResizeObserver(()=>{
      if(!recipe)return;
      const nextWidth=viewport.clientWidth,nextHeight=viewport.clientHeight;
      if(!nextWidth||!nextHeight)return;
      interaction.stop();
      if(!width||!height)reset();else{translateX+=(nextWidth-width)/2;translateY+=(nextHeight-height)/2;width=nextWidth;height=nextHeight;updateCamera();}
    });observer.observe(viewport);
    return {open,regenerate:place=>open(place||selected,{regenerate:true}),updateLayout,exportSnapshot,importSnapshot,renameFeature,refreshNames,
      clear,zoomBy,reset,setExtent,get recipe(){return recipe;},stats:()=>({selected:selected?.id||null,recipeId:recipe?.id||null,
      layoutRevision:saved?.layoutRevision||null,revision:saved?.revision||null,
      seed,generatedCount,loading,active:recipe?1:0,anchor:recipe?{...recipe.location}:null,population:recipe?.population||null,
      buildings:Array.from(container.querySelectorAll('[data-building-count]'),node=>Number(node.dataset.buildingCount)).reduce((a,b)=>a+b,0),
      innerCity:container.querySelectorAll('.city-block-old-town,.city-block-civic').length,
      innerWalls:Array.from(container.querySelectorAll('.city-inner-walls')).filter(node=>node.getAttribute('d')).length,
      gates:Number(container.querySelector('[data-gate-count]')?.dataset.gateCount||0),
      bridges:recipe?.localSite.bridges.length||0,
      barbicans:Number(container.querySelector('[data-barbican-count]')?.dataset.barbicanCount||0),
      moats:Number(container.querySelector('[data-moat-count]')?.dataset.moatCount||0),riverMode:recipe?.localSite.riverMode,
      harbor:recipe?.harbor||null,
      character:recipe?WorldAtlasCityCharacter.profile(recipe).label:null,
      labels:container.querySelectorAll('[data-city-screen-label]').length,
      visibleLabels:Array.from(container.querySelectorAll('[data-city-screen-label]')).filter(node=>node.style.display!=='none').map(node=>node.textContent),
      outerCity:container.querySelectorAll('.city-blocks .city-block').length,
      farmland:Array.from(container.querySelectorAll('[data-farmland-count]'),node=>Number(node.dataset.farmlandCount)).reduce((a,b)=>a+b,0),
      waterSource:recipe?.localSite.waterSource||null,camera:{scale,translateX,translateY,width,height,extent,minimumScale,maximumScale}}),
      destroy(){clear();interaction.destroy();observer.disconnect();listeners.forEach(remove=>remove());updateButton.remove();}};
  }
  window.WorldAtlasCityMap={create};
})();
