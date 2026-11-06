/* Shared road/ferry navigation and travel clock for map routes and historical lives. */
(function (G) {
  'use strict';
  function travelProfile(era, cfg) {
    const dayHours = cfg.day;
    if (!(dayHours > 0)) throw Error('缺少世界日长，无法计算旅程。');
    const ship = era === 'industrial' ? ['动力船', 18, 20] : ['帆船', 8, 16];
    const modes = [{ id:'walk', label:'步行', speed:5, daily:8, grade:.45 }, { id:'horse', label:'骑马', speed:7, daily:8, grade:.25 }, { id:'carriage', label:'马车', speed:6, daily:8, grade:.1 }];
    if (era === 'industrial') modes.push({ id:'train', label:'步行＋火车', speed:40, daily:18, grade:.45, rail:true });
    for (const m of modes) { m.daily = Math.min(m.daily, dayHours); m.ship = ship[1]; m.shipDaily = Math.min(ship[2], dayHours); m.shipName = ship[0]; }
    return { era, modes, dayHours, note:`地面交通每世界日最多行进 ${Math.min(8,dayHours)} 小时；马车避开超过 10% 的坡度。船程按${ship[0]}平均 ${ship[1]} km/h、每世界日最多航行 ${Math.min(ship[2],dayHours)} 小时估算，在实际渡运或港口换乘。` + (era==='industrial' ? `火车沿干线与区域铁路，平均 40 km/h、每世界日最多运营 ${Math.min(18,dayHours)} 小时。` : '') };
  }
  const exists = (c,y) => !!c && c.founded<=y && !(c.ruined>0 && y>=c.ruined);
  function profileFor(net,year,travelSpeed=1){if(!Number.isFinite(travelSpeed)||travelSpeed<.25||travelSpeed>2)throw Error('人物通行速度修正无效。');const h=net.world.history,stage=net.historical?(h.eraAt?.[Math.floor(year/h.eraStep)]||0):null,profile=travelProfile(net.historical?(stage>=8?'industrial':'preindustrial'):net.world.Cv.era,net.world.cfg);if(net.historical)profile.modes=profile.modes.filter(m=>!m.rail);for(const m of profile.modes){m.speed*=travelSpeed;m.ship*=travelSpeed;m.travelSpeed=travelSpeed;}return profile;}
  function overlandProfile(mode,dayHours){const daily=Math.min(8,dayHours),speed=(mode.rail?5*mode.travelSpeed:mode.speed)*.45,climbRate=(mode.id==='walk'?500:800)*mode.travelSpeed;return {maxKmPerDay:speed*daily,segmentCost:({km,climb,terrainFactor,grade})=>mode.id==='carriage'&&grade>.1?Infinity:(km/speed*terrainFactor+climb/climbRate)/daily};}
  function continuous(pts,width){for(let i=2;i<pts.length;i+=2)pts[i]+=Math.round((pts[i-2]-pts[i])/width)*width;return Float32Array.from(pts);}
  const overlandWorlds=new WeakMap();
  function buildNetwork(world, historical = false) {
    let overland=overlandWorlds.get(world);if(!overland){overland=G.NavigationOverland.create(world);overlandWorlds.set(world,overland);}
    const { P, Cv, cfg } = world, h = world.history, W=P.W, H=P.H, kmPer=2*Math.PI*cfg.radius/W;
    const nodes=new Map(), nx=[], ny=[], adj=[];
    const wrap=x=>((x%W)+W)%W;
    const segKm=(x0,y0,x1,y1)=>{let dx=Math.abs(wrap(x1)-wrap(x0));dx=Math.min(dx,W-dx);return Math.hypot(dx*Math.cos((90-(y0+y1)/2/H*180)*Math.PI/180),y1-y0)*kmPer;};
    const elevAt=(x,y)=>P.elev[Math.min(H-1,Math.max(0,Math.floor(y)))*W+Math.floor(wrap(x))];
    const dryBetween=(x0,y0,x1,y1)=>overland.dryLine({x:x0,y:y0},{x:x1,y:y1});
    const node=(x,y)=>{const k=Math.round(wrap(x)*20)+','+Math.round(y*20);let id=nodes.get(k);if(id===undefined){id=nx.length;nodes.set(k,id);nx.push(wrap(x));ny.push(y);adj.push([]);}return id;};
    function addLine(pts,cls,record=null) {
      if(pts.length<4)return;const lengths=[],up=[],down=[];let km=0,climb=0,descent=0;
      for(let i=2;i<pts.length;i+=2){const d=segKm(pts[i-2],pts[i-1],pts[i],pts[i+1]),dh=cls==='sea'?0:Math.max(0,elevAt(pts[i],pts[i+1]))-Math.max(0,elevAt(pts[i-2],pts[i-1]));lengths.push(d);up.push(Math.max(0,dh));down.push(Math.max(0,-dh));km+=d;climb+=Math.max(0,dh);descent+=Math.max(0,-dh);}
      const a=node(pts[0],pts[1]),b=node(pts.at(-2),pts.at(-1));if(a===b)return;
      const ed={a,b,pts,cls,km,climb,descent,lengths,up,down,record};adj[a].push(ed);adj[b].push(ed);
    }
    const cities=historical?h.cities:Cv.cities;
    if(historical){
      const cityByIdx=new Map(cities.map((c,i)=>[c.idx,i]));
      for(const rd of h.roads||[]){const a=cityByIdx.get(rd.sa),b=cityByIdx.get(rd.sb);if(a===undefined||b===undefined)continue;const record={id:rd.id,year:rd.year,a,b};for(const line of rd.lines||[])addLine(line,rd.imp||'local',record);for(const line of rd.ferries||[])addLine(line,'sea',record);}
    }else for(const cls of ['trunk','regional','local','sea','rail'])for(const line of Cv.roads[cls]||[])addLine(line,cls);
    // Preserve the existing navigation's short endpoint joins, only over dry ground.
    const grid=new Map();nx.forEach((x,i)=>{const k=Math.floor(x)+','+Math.floor(ny[i]);if(!grid.has(k))grid.set(k,[]);grid.get(k).push(i);});
    const joins=[];
    for(let i=0;i<nx.length;i++)for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)for(const j of grid.get(wrap(Math.floor(nx[i])+dx)+','+(Math.floor(ny[i])+dy))||[]){if(j<=i||adj[i].some(ed=>ed.a===j||ed.b===j))continue;const km=segKm(nx[i],ny[i],nx[j],ny[j]);if(km>kmPer*1.1||!dryBetween(nx[i],ny[i],nx[j],ny[j]))continue;joins.push([i,j]);}
    for(const [a,b] of joins){const pts=Float32Array.from([nx[a],ny[a],nx[b],ny[b]]);addLine(pts,'offroad');}
    const nodeCities=new Map();cities.forEach((c,id)=>{let best=-1,limit=.9*kmPer;for(let n=0;n<nx.length;n++){const d=segKm(c.x,c.y,nx[n],ny[n]);if(d<limit){limit=d;best=n;}}if(best>=0){if(!nodeCities.has(best))nodeCities.set(best,[]);nodeCities.get(best).push(id);}});
    return {world,historical,W,H,nx,ny,adj,cities,segKm,kmPer,dryBetween,overland,nodeCities};
  }
  // 领土偏好：本国（含宗藩、盟国）领土照常计价，无主荒野略贵，他国领土按 K 倍计价——只要国内有路可走，就不借道他国
  function territory(net,year,points,realm){
    const h=net.world.history;if(!net.historical||!h||!h.regionF||!h.own||!h.polities)return null;
    const Q=G.HistoryQuery,FW=h.FW,FH=h.FH,own=new Int32Array(h.nR+1).fill(-3),K=40;
    const ownerOf=r=>{if(!(r>0))return -2;let o=own[r];if(o===-3){o=Q.logAt(h.own,r,year,'owner');own[r]=o;}return o;};
    const regAt=(x,y)=>{const yy=Math.floor(y);if(yy<0||yy>=FH)return 0;return h.regionF[yy*FW+((Math.floor(x)%FW)+FW)%FW];};
    const liegeAt=p=>{const V=h.polities[p]?.vas;let l=-1;if(V)for(let i=0;i<V.length;i+=2){if(V[i]>year)break;l=V[i+1];}return l;};
    const top=p=>{let x=p;for(let g=0;g<8;g++){const l=liegeAt(x);if(l<0||l===x)break;x=l;}return x;};
    const tops=new Set(),add=p=>{if(p!=null&&p>=0)tops.add(top(p));};
    for(const pt of points)add(ownerOf(regAt(pt.x,pt.y)));add(realm);
    for(const a of h.alliances||[]){if(a.from>year||(a.to!=null&&year>=a.to))continue;const now=(a.roster||[]).filter(x=>x[1]<=year&&(x[2]==null||year<x[2])).map(x=>x[0]);if(now.some(m=>tops.has(top(m))))for(const m of now)tops.add(top(m));} // 盟国借道
    if(!tops.size)return null;
    const okCache=new Map(),ok=o=>{let v=okCache.get(o);if(v===undefined){v=tops.has(top(o));okCache.set(o,v);}return v;};
    const regionPen=r=>{if(!(r>0))return 1;const o=ownerOf(r);return o<0?1.25:ok(o)?1:K;};
    const cellPen=i=>regionPen(h.regionF[i]);cellPen.max=K;
    const edgePen=new Map();
    return {cellPen,K,edge(ed){let v=edgePen.get(ed);if(v===undefined){let sum=0,n=0;for(let i=0;i<ed.pts.length;i+=2){sum+=regionPen(regAt(ed.pts[i],ed.pts[i+1]));n++;}v=n?sum/n:1;edgePen.set(ed,v);}return v;}};
  }
  function roadRoute(net,points,modeId='walk',year=null,maxDays=Infinity,travelSpeed=1,terr=null) {
    const {world,historical,nx,ny,adj,cities,segKm}=net;
    if(historical&&(!Number.isFinite(year)||year<0||year>world.history.E))throw Error('导航年份超出已有历史。');
    // The timeline dates the era and ferries; it has no separately dated rail records.
    const prof=profileFor(net,year,travelSpeed),mode=prof.modes.find(m=>m.id===modeId);
    if(!mode)throw Error('当年没有所选出行方式的可用记录。');
    const allowed=ed=>!historical||ed.record&&ed.record.year<=year&&exists(cities[ed.record.a],year)&&exists(cities[ed.record.b],year);
    const active=historical?adj.map(rows=>rows.some(allowed)):null;
    const usable=ed=>allowed(ed)||historical&&!ed.record&&ed.cls==='offroad'&&active[ed.a]&&active[ed.b];
    const CLS={trunk:1,regional:.92,local:.8,path:.65};
    const gapCosts=new Map();
    function cost(ed,reverse=false){
      if(ed.cls==='offroad'){let pair=gapCosts.get(ed);if(!pair){pair=[];gapCosts.set(ed,pair);}const key=reverse?1:0;if(pair[key]===undefined){const a=reverse?ed.b:ed.a,b=reverse?ed.a:ed.b,connection=net.overland.route({from:{x:nx[a],y:ny[a]},to:{x:nx[b],y:ny[b]},...overlandProfile(mode,prof.dayHours),maxDays,cellPen:terr?terr.cellPen:null});pair[key]=connection?{hours:connection.days,daily:1,connection,w:connection.days>0?connection.cost/connection.days:1}:null;}return pair[key];}
      if(ed.cls==='sea')return {hours:ed.km/mode.ship+2,daily:mode.shipDaily,speed:mode.ship,wait:2,climbRate:Infinity};
      if(ed.cls==='rail')return mode.rail?{hours:ed.km/mode.speed+.5,daily:mode.daily,speed:mode.speed,wait:.5,climbRate:Infinity}:null;
      const climb=reverse?ed.descent:ed.climb;if(mode.id==='carriage'&&ed.lengths.some((km,i)=>Math.max(ed.up[i],ed.down[i])/Math.max(1,km*1000)>.1))return null;
      const speed=(mode.rail?5*mode.travelSpeed:mode.speed)*CLS[ed.cls],climbRate=(mode.id==='walk'?500:800)*mode.travelSpeed,daily=mode.rail?Math.min(8,prof.dayHours):mode.daily;
      return {hours:ed.km/speed+climb/climbRate,daily,speed,climbRate,wait:0};
    }
    const offroad=overlandProfile(mode,prof.dayHours);
    const snap=(p,reverse=false)=>{if(historical&&p.city!=null&&!exists(cities[p.city],year))return null;const nearest=[];for(let i=0;i<nx.length;i++){if(active&&!active[i])continue;nearest.push({node:i,km:segKm(nx[i],ny[i],p.x,p.y)});}nearest.sort((a,b)=>a.km-b.km);for(const hit of nearest.slice(0,5)){const q={x:nx[hit.node],y:ny[hit.node]},from=reverse?q:p,to=reverse?p:q;const connection=hit.km<1e-8?{pts:Float32Array.from([from.x,from.y,to.x,to.y]),pointDays:Float64Array.from([0,0]),km:0,days:0}:net.overland.route({from,to,...offroad,maxDays,cellPen:terr?terr.cellPen:null});if(connection)return {...hit,...connection,cost:connection.cost??connection.days};}return null;};
    const allPts=[],pointDays=[],segments=[],legs=[],passed=[],roadIds=new Set();let km=0,seaKm=0,railKm=0,days=0,totalCost=0;
    const push=(x,y,d)=>{allPts.push(x,y);pointDays.push(d);};
    const appendConnection=connection=>{const start=allPts.length/2,startDay=days;for(let i=0;i<connection.pts.length;i+=2)push(connection.pts[i],connection.pts[i+1],days+connection.pointDays[i/2]);days+=connection.days;if(connection.days>0)segments.push({start,end:allPts.length/2-1,startDay,endDay:days,cls:'offroad',roadId:null});};
    for(let L=0;L<points.length-1;L++){
      const A=snap(points[L]),B=snap(points[L+1],true);if(!A||!B)return {fail:true,leg:L};
      const dist=new Float64Array(nx.length).fill(Infinity),prev=new Array(nx.length),hp=new G.Hydro.Heap(1024);dist[A.node]=0;hp.push(A.node,0);
      while(hp.n){const u=hp.pop();if(u===B.node)break;for(const ed of adj[u]){if(!usable(ed))continue;const v=ed.a===u?ed.b:ed.a,c=cost(ed,ed.b===u);if(!c)continue;const nd=dist[u]+c.hours/c.daily*(c.w??(terr&&ed.cls!=='sea'?terr.edge(ed):1));if(nd+A.cost+B.cost+days<=maxDays*(terr?terr.K:1)&&nd<dist[v]){dist[v]=nd;prev[v]={u,ed,c};hp.push(v,nd);}}}
      if(!Number.isFinite(dist[B.node]))return {fail:true,leg:L};
      const seq=[];let v=B.node;while(v!==A.node){const st=prev[v];seq.push(st);v=st.u;}seq.reverse();
      const startDays=days;let legKm=A.km+B.km;appendConnection(A);
      for(const {u,ed,c} of seq){if(c.connection){appendConnection(c.connection);legKm+=c.connection.km;continue;}const fwd=ed.a===u,p=ed.pts,start=allPts.length/2-1,startDay=days;if(ed.record)roadIds.add(ed.record.id);days+=c.wait/c.daily;push(fwd?p[0]:p.at(-2),fwd?p[1]:p.at(-1),days);
        for(let s=0;s<ed.lengths.length;s++){const j=fwd?s:ed.lengths.length-1-s,idx=fwd?(s+1)*2:p.length-4-s*2,climb=fwd?ed.up[j]:ed.down[j];days+=(ed.lengths[j]/c.speed+climb/c.climbRate)/c.daily;push(p[idx],p[idx+1],days);}
        segments.push({start,end:allPts.length/2-1,startDay,endDay:days,cls:ed.cls,roadId:ed.record?.id??null});legKm+=ed.km;if(ed.cls==='sea')seaKm+=ed.km;if(ed.cls==='rail')railKm+=ed.km;
        for(const city of net.nodeCities.get(fwd?ed.b:ed.a)||[])if((!historical||exists(cities[city],year))&&passed.at(-1)?.city!==city)passed.push({city,cls:ed.cls,leg:L});
      }
      totalCost+=A.cost+dist[B.node]+B.cost;appendConnection(B);km+=legKm;legs.push({km:Math.round(legKm),days:days-startDays});
    }
    return {pts:continuous(allPts,net.W),pointDays:Float64Array.from(pointDays),segments,km:Math.round(km),seaKm:Math.round(seaKm),railKm:Math.round(railKm),days,mode:mode.label,modeId:mode.id,travelSpeed,routeKind:segments.some(s=>s.cls==='offroad')?'mixed':'road',shipName:mode.shipName,legs,passed,year:historical?year:null,roadIds:[...roadIds],cost:totalCost};
  }
  function route(net,points,modeId='walk',year=null,maxDays=Infinity,travelSpeed=1,realm=-1){
    if(net.historical&&points.some(p=>p.city!=null&&!exists(net.cities[p.city],year)))return {fail:true,leg:0};
    const terr=net.historical?territory(net,year,points,realm):null;
    let road=roadRoute(net,points,modeId,year,maxDays,travelSpeed,terr);if(road&&!road.fail&&road.days>maxDays)road={fail:true,leg:0};
    const prof=profileFor(net,year,travelSpeed),mode=prof.modes.find(m=>m.id===modeId);
    const offroad=overlandProfile(mode,prof.dayHours);
    const pts=[],pointDays=[],segments=[],legs=[];let days=0,km=0,cost=0;
    const roadCost=road&&!road.fail?road.cost??road.days:Infinity;
    for(let i=0;i<points.length-1;i++){
      const leg=net.overland.route({from:points[i],to:points[i+1],...offroad,maxDays:maxDays-days,cellPen:terr?terr.cellPen:null});
      if(!leg||cost+(leg.cost??leg.days)>=roadCost)return road;
      const start=pts.length/2;pts.push(...leg.pts);for(const d of leg.pointDays)pointDays.push(days+d);segments.push({start,end:pts.length/2-1,startDay:days,endDay:days+leg.days,cls:'offroad',roadId:null});legs.push({km:Math.round(leg.km),days:leg.days});days+=leg.days;km+=leg.km;cost+=leg.cost??leg.days;
    }
    if(cost>=roadCost)return road;
    return {pts:continuous(pts,net.W),pointDays:Float64Array.from(pointDays),segments,km:Math.round(km),seaKm:0,railKm:0,days,mode:mode.label,modeId:mode.id,travelSpeed,routeKind:'offroad',shipName:mode.shipName,legs,passed:[],year:net.historical?year:null,roadIds:[],cost};
  }
  const historyNetworks=new WeakMap();
  function historyRouter(world){let net=historyNetworks.get(world);if(!net){net=buildNetwork(world,true);historyNetworks.set(world,net);}return(from,to,year,mode='walk',maxDays=Infinity,travelSpeed=1,realm=-1)=>{const point=p=>{if(typeof p==='number'){const c=world.history.cities[p];return c?{x:c.x,y:c.y,city:p}:null;}return p?{x:p.x,y:p.y,...(p.kind==='city'?{city:p.id}:{})}:null;};const a=point(from),b=point(to);if(!a||!b)return null;return route(net,[a,b],mode,year,maxDays,travelSpeed,realm);};}
  function dateAfter(departure,elapsedDays,calendar){const total=(departure.day-1)+(departure.hour||0)/calendar.hoursPerDay+elapsedDays,years=Math.floor(total/calendar.daysPerYear),within=total-years*calendar.daysPerYear,day=Math.floor(within)+1;return {year:departure.year+years,day,hour:(within-(day-1))*calendar.hoursPerDay};}
  function journey(routeResult,departure,calendar,width){return {...routeResult,pts:Array.from(routeResult.pts),pointDays:Array.from(routeResult.pointDays),departure:{...departure},arrival:dateAfter(departure,routeResult.days,calendar),calendar:{daysPerYear:calendar.daysPerYear,hoursPerDay:calendar.hoursPerDay},width};}
  function journeyAt(trip,elapsedDays){const j=trip.journey;if(!j||!j.pts.length)return null;const elapsed=Math.max(0,Math.min(j.days,elapsedDays)),times=j.pointDays;let hi=times.length-1,lo=0;while(lo<hi){const m=(lo+hi+1)>>>1;if(times[m]<=elapsed)lo=m;else hi=m-1;}const next=Math.min(lo+1,times.length-1),f=times[next]>times[lo]?(elapsed-times[lo])/(times[next]-times[lo]):0,x=j.pts[lo*2]+(j.pts[next*2]-j.pts[lo*2])*f,y=j.pts[lo*2+1]+(j.pts[next*2+1]-j.pts[lo*2+1])*f;return {x,y,progress:j.days?elapsed/j.days:1,elapsedDays:elapsed,remainingDays:j.days-elapsed,date:dateAfter(j.departure,elapsed,j.calendar)};}
  G.Navigation={territory,travelProfile,buildNetwork,route,historyRouter,dateAfter,journey,journeyAt};
})(typeof self!=='undefined'?self:globalThis);
