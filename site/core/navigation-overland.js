/* On-demand overland A* on the unchanged full physical raster.
 * Navigation owns transport speeds and world-day conversion; this module only
 * supplies terrain/gradient measurements and minimizes that shared day cost.
 */
(function(G){
  'use strict';
  // Relative ground resistance: ice, tundra, taiga, grassland, broadleaf forest,
  // temperate rainforest, scrub, cool/hot desert, savanna, seasonal/rain forest, alpine.
  const GROUND=[3,1.6,1.8,1,1.6,2,1.35,1.5,1.65,1.15,1.8,2.2,1.8];
  const DX=[1,1,0,-1,-1,-1,0,1],DY=[0,1,1,1,0,-1,-1,-1];
  function create({P,Cl,Hy,cfg}){
    const {W,H,elev}=P,N=W*H,radius=cfg.radius,biome=Cl.biome,lake=Hy.lake,lakeField=Hy.lakeView||Hy.lakeSoft||lake;
    if(!Number.isInteger(W)||W<2||!Number.isInteger(H)||H<2||!(radius>0)||elev.length!==N||biome.length!==N||lake.length!==N)throw Error('越野寻路缺少完整物理网格');
    const wrap=x=>((x%W)+W)%W,cell=(x,y)=>y*W+wrap(x);
    const point=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.y>=0&&p.y<H?{x:wrap(p.x),y:p.y,i:cell(Math.floor(p.x),Math.floor(p.y))}:null;
    const hardDry=i=>i>=0&&i<N&&Number.isFinite(elev[i])&&elev[i]>0&&!lake[i];
    const center=i=>({x:i%W+.5,y:Math.floor(i/W)+.5});
    let interior,pass,edgeKnown,edgeDry;
    function passability(){if(!pass){interior=new Uint8Array(N);pass=new Uint8Array(N);edgeKnown=new Uint8Array(N);edgeDry=new Uint8Array(N);}}
    // Immutable physical fields: memoize only cells/edges actually queried. A
    // uniformly high, lake-free interpolation support is provably inland; the
    // boundary otherwise uses the renderer's exact continuous surface functions.
    function inland(i){
      passability();if(interior[i])return interior[i]===1;
      const x=i%W,y=Math.floor(i/W);
      for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
        const j=cell(x+dx,Math.max(0,Math.min(H-1,y+dy)));
        if(!(elev[j]>50)||lake[j]||lakeField[j]!==0){interior[i]=2;return false;}
      }
      interior[i]=1;return true;
    }
    function surfaceDry(p){
      const q=point(p);return !!q&&hardDry(q.i)&&(inland(q.i)||G.Noise.coastSurface(elev,W,H,q.x,q.y,true)>.6&&G.Noise.surface(lakeField,W,H,q.x,q.y)<.45);
    }
    function dry(i){if(!hardDry(i))return false;passability();if(!pass[i])pass[i]=surfaceDry(center(i))?1:2;return pass[i]===1;}
    const delta=x=>x>W/2?x-W:x<-W/2?x+W:x;
    function distance(a,b){
      const lat1=(.5-a.y/H)*Math.PI,lat2=(.5-b.y/H)*Math.PI;
      const dlon=delta(wrap(b.x)-wrap(a.x))*2*Math.PI/W;
      const h=Math.sin((lat2-lat1)/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dlon/2)**2;
      return radius*2*Math.asin(Math.sqrt(Math.max(0,Math.min(1,h))));
    }
    // Exact grid traversal, including both cells on a diagonal corner. Sampling
    // only endpoints would allow short road attachments to jump over narrow water.
    function dryLine(from,to){
      const a=point(from),b=point(to);if(!a||!b||!dry(a.i)||!dry(b.i)||!surfaceDry(a)||!surfaceDry(b))return false;
      let allInland=inland(a.i)&&inland(b.i);
      const visit=i=>{if(!dry(i))return false;if(!inland(i))allInland=false;return true;};
      const ex=a.x+delta(b.x-a.x),ey=b.y,dx=ex-a.x,dy=ey-a.y;
      let x=Math.floor(a.x),y=Math.floor(a.y),tx=Math.floor(ex),ty=Math.floor(ey);
      const sx=Math.sign(dx),sy=Math.sign(dy),stepX=dx?1/Math.abs(dx):Infinity,stepY=dy?1/Math.abs(dy):Infinity;
      let nextX=dx?(sx>0?x+1-a.x:a.x-x)/Math.abs(dx):Infinity,nextY=dy?(sy>0?y+1-a.y:a.y-y)/Math.abs(dy):Infinity;
      while(x!==tx||y!==ty){
        if(Math.abs(nextX-nextY)<1e-12){
          if(!visit(cell(x+sx,y))||!visit(cell(x,y+sy)))return false;
          x+=sx;y+=sy;nextX+=stepX;nextY+=stepY;
        }else if(nextX<nextY){x+=sx;nextX+=stepX;}
        else{y+=sy;nextY+=stepY;}
        if(y<0||y>=H||!visit(cell(x,y)))return false;
      }
      // Resolve subcell coast/lake bends as well as the physical cell mask. This
      // does not simplify the raster or smooth the resulting route across water.
      if(!allInland){const steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)*16));for(let s=1;s<steps;s++)if(!surfaceDry({x:a.x+dx*s/steps,y:a.y+dy*s/steps}))return false;}
      return true;
    }
    function clearEdge(i,k,j){
      const bit=1<<k;if(!(edgeKnown[i]&bit)){
        const back=1<<((k+4)%8),clear=dryLine(center(i),center(j));edgeKnown[i]|=bit;edgeKnown[j]|=back;
        if(clear){edgeDry[i]|=bit;edgeDry[j]|=back;}
      }
      return !!(edgeDry[i]&bit);
    }
    let dist,pred,seen,closed,epoch=0,east,diagonal;
    const northSouth=radius*Math.PI/H;
    function workspace(){
      if(!dist){
        // Allocated only when a route is requested, never during world generation.
        dist=new Float64Array(N);pred=new Int32Array(N);seen=new Uint32Array(N);closed=new Uint32Array(N);
        east=new Float64Array(H);diagonal=new Float64Array(H-1);
        for(let y=0;y<H;y++){
          east[y]=distance({x:.5,y:y+.5},{x:1.5,y:y+.5});
          if(y+1<H)diagonal[y]=distance({x:.5,y:y+.5},{x:1.5,y:y+1.5});
        }
      }
      if(++epoch>=0xffffffff){seen.fill(0);closed.fill(0);epoch=1;}
    }
    const ground=i=>GROUND[biome[i]]||1;
    function metrics(a,b,km){
      const rise=elev[b]-elev[a],grade=km>0?Math.abs(rise)/(km*1000):0;
      return {km,climb:Math.max(0,rise),descent:Math.max(0,-rise),grade,terrainFactor:(ground(a)+ground(b))*.5*(1+Math.min(6,12*grade))};
    }
    function route({from,to,segmentCost,maxKmPerDay,maxDays=Infinity}){
      const a=point(from),b=point(to);if(!a||!b||!dry(a.i)||!dry(b.i)||!surfaceDry(a)||!surfaceDry(b))return null;
      if(typeof segmentCost!=='function'||!Number.isFinite(maxKmPerDay)||maxKmPerDay<=0||!(maxDays>=0))throw Error('越野寻路缺少有效统一时间 cost');
      const time=e=>{if(!e.km)return 0;const value=segmentCost(e);if(value===Infinity)return value;if(!Number.isFinite(value)||value<=0)throw Error('越野路径时间 cost 必须为正数或 Infinity');return value;};
      const stepTime=(i,j,km)=>time(metrics(i,j,km));
      const cA=center(a.i),cB=center(b.i);
      // Endpoints in one dry physical cell need no detour through its centre.
      if(a.i===b.i){
        if(!dryLine(a,b))return null;
        const km=distance(a,b),days=stepTime(a.i,b.i,km);if(!Number.isFinite(days)||days>maxDays)return null;
        if(!km)return {pts:Float32Array.from([from.x,from.y]),pointDays:Float64Array.of(0),km:0,days:0};
        return {pts:Float32Array.from([from.x,from.y,from.x+delta(b.x-a.x),to.y]),pointDays:Float64Array.of(0,days),km,days};
      }
      if(!dryLine(a,cA)||!dryLine(cB,b))return null;
      const startKm=distance(a,cA),endKm=distance(cB,b),startDays=stepTime(a.i,a.i,startKm),endDays=stepTime(b.i,b.i,endKm);
      if(!Number.isFinite(startDays+endDays))return null;
      const heuristic=i=>distance(center(i),cB)/maxKmPerDay+endDays;
      if(startDays+heuristic(a.i)>maxDays)return null;
      workspace();const heap=new G.Hydro.Heap(1024);
      dist[a.i]=startDays;pred[a.i]=-1;seen[a.i]=epoch;heap.push(a.i,startDays+heuristic(a.i));
      let found=false;
      while(heap.n){
        const i=heap.pop();if(closed[i]===epoch)continue;closed[i]=epoch;
        if(i===b.i){found=true;break;}
        const y=Math.floor(i/W),x=i-y*W;
        for(let k=0;k<8;k++){
          const yy=y+DY[k];if(yy<0||yy>=H)continue;
          const j=cell(x+DX[k],yy);if(!dry(j)||closed[j]===epoch)continue;
          if(DX[k]&&DY[k]&&(!dry(cell(x+DX[k],y))||!dry(cell(x,yy))))continue;
          if(!clearEdge(i,k,j))continue;
          const km=DY[k]?(DX[k]?diagonal[Math.min(y,yy)]:northSouth):east[y];
          const days=stepTime(i,j,km),next=dist[i]+days;if(!Number.isFinite(next)||(seen[j]===epoch&&next>=dist[j]))continue;
          const estimate=next+heuristic(j);if(estimate>maxDays)continue;
          seen[j]=epoch;dist[j]=next;pred[j]=i;heap.push(j,estimate);
        }
      }
      if(!found)return null;
      const cells=[];for(let i=b.i;i>=0;i=pred[i])cells.push(i);cells.reverse();
      const pts=[from.x,from.y],pointDays=[0];let km=0,days=0,previous=a;
      function append(p,i,j){
        const length=distance(previous,p);if(!length)return;
        days+=stepTime(i,j,length);km+=length;
        const last=pts[pts.length-2],x=last+delta(wrap(p.x)-wrap(last));pts.push(x,p.y);pointDays.push(days);previous=p;
      }
      append(cA,a.i,a.i);
      for(let k=1;k<cells.length;k++)append(center(cells[k]),cells[k-1],cells[k]);
      append(b,b.i,b.i);
      return {pts:Float32Array.from(pts),pointDays:Float64Array.from(pointDays),km,days};
    }
    return {route,dryLine};
  }
  G.NavigationOverland={create};
})(typeof self!=='undefined'?self:globalThis);
