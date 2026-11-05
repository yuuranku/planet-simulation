/* Province travel uses real existing road/sea links and terrain travel in days. */
(function (G) {
  'use strict';
  function cityPopulations(h,R,population) {
    const total=new Float64Array(R.nR+1),exact=new Float64Array(R.nR+1),assigned=new Float64Array(R.nR+1),out=new Float64Array(h.settlements.length);
    h.settlements.forEach(s=>{const r=R.regionOf[s.cell];if(r)total[r]+=s.pop||0});
    h.settlements.forEach((s,i)=>{const r=R.regionOf[s.cell];if(!r)return;const baseline=R.weight[r]*h.popTotal,factor=baseline>0?population[r]/baseline:0;
      exact[r]+=(s.pop||0)*Math.min(factor,population[r]/Math.max(1,total[r]));const n=Math.min(population[r],Math.round(exact[r]));out[i]=n-assigned[r];assigned[r]=n;});
    return out;
  }
  function protectSeatCities(deadlines,provinces) {for(const p of provinces)for(const [year,city] of p.seatCities)if(city>=0)deadlines[city]=Math.min(deadlines[city],year);}
  function create({h,R,D,C,routes,admin}) {
    const roadYear=new Float64Array(R.edges.length).fill(Infinity), sea=Array.from({length:R.nR+1},()=>[]),seaChanges=new Map();
    const edgeAt=(a,b)=>{for(let k=R.off[a];k<R.off[a+1];k++)if(R.nbr[k]===b&&!R.edges[R.eid[k]].sea)return R.eid[k];return -1};
    const regionAt=(x,y)=>{if(y<0||y>=h.H*2)return 0;const w=h.W*2;return R.regionOf[Math.floor(y/2)*h.W+Math.floor((((x%w)+w)%w)/2)]||0};
    for(const rd of C.roads){const source=h.roads[rd.id];if(!source||!Number.isFinite(rd.year))continue;
      for(const line of source.lines||[]){let previous=0;for(let i=2;i<line.length;i+=2){const x=line[i-2],y=line[i-1],dx=line[i]-x,dy=line[i+1]-y;if(Math.abs(dx)>h.W){previous=0;continue}const cuts=[0,1];
        if(dx)for(let z=Math.floor(Math.min(x,x+dx)/2)*2+2;z<Math.max(x,x+dx);z+=2)cuts.push((z-x)/dx);
        if(dy)for(let z=Math.floor(Math.min(y,y+dy)/2)*2+2;z<Math.max(y,y+dy);z+=2)cuts.push((z-y)/dy);
        cuts.sort((a,b)=>a-b);for(let k=0;k+1<cuts.length;k++){if(cuts[k+1]-cuts[k]<1e-12)continue;const t=(cuts[k]+cuts[k+1])/2,r=regionAt(x+dx*t,y+dy*t);if(r&&previous&&r!==previous){const edge=edgeAt(previous,r);if(edge>=0)roadYear[edge]=Math.min(roadYear[edge],rd.year)}previous=r;}}}
    }
    const cityByCell=new Map(), citiesByRegion=Array.from({length:R.nR+1},()=>[]);for(let i=0;i<C.cities.length;i++){const c=C.cities[i];if(!c.fort&&c.idx>=0&&h.settlements[c.idx]){cityByCell.set(h.settlements[c.idx].cell,c);if(c.r>0)citiesByRegion[c.r].push(i)}}
    for(const route of routes||[]){if(route.mode!=='sea'||!(route.km>0))continue;const a=R.regionOf[route.a],b=R.regionOf[route.b],ca=cityByCell.get(route.a),cb=cityByCell.get(route.b);if(!a||!b||a===b||!ca||!cb)continue;
      const link={a,b,ca,cb,days:route.km/(admin.sea||160)};sea[a].push(link);sea[b].push(link);for(const c of [ca,cb])if(Number.isFinite(c.ruined)){if(!seaChanges.has(c.ruined))seaChanges.set(c.ruined,new Set());seaChanges.get(c.ruined).add(a);seaChanges.get(c.ruined).add(b);}}
    const alive=(c,y)=>y>=c.founded&&(c.ruined===null||y<c.ruined);
    const budget=admin.response;
    function city(r,year,popAt){let best=-1,bp=0;for(const i of citiesByRegion[r]||[]){const c=C.cities[i];if(!alive(c,year))continue;const p=popAt(i,year);if(p>bp){best=i;bp=p}}return best;}
    function seat(regs,year,popAt,preferred=-1){if(regs.includes(preferred)&&city(preferred,year,popAt)>=0)return preferred;let best=-1,bp=0;for(const r of regs){const i=city(r,year,popAt);if(i<0)continue;const p=popAt(i,year);if(p>bp){best=r;bp=p}}return best;}
    function rollbackLimit(r,year,popAt,max,previous=-Infinity){let allowed=0;if(previous<year)max=Math.min(max,year-previous);while(allowed<max&&city(r,year-allowed-1,popAt)>=0)allowed++;return allowed;}
    function reachable({seat,id,owner,prov,year}) {
      const dist=new Map([[seat,0]]),queue=new R.Heap(32);queue.push(seat,0);
      const add=(b,d)=>{if(prov[b]!==id||owner[b]!==owner[seat]||d>budget||d>=(dist.get(b)??Infinity))return;dist.set(b,d);queue.push(b,d)};
      while(queue.n){const a=queue.pop(),v=queue.top;if(v!==dist.get(a))continue;
        for(let k=R.off[a];k<R.off[a+1];k++){const ed=R.edges[R.eid[k]];if(ed.sea)continue;let days=G.HumanAnchors.travelDays(ed,null,null);if(roadYear[R.eid[k]]<=year)days=Math.min(days,ed.km/(admin.road||90)*(1+.05*Math.max(0,ed.rough||0)));add(R.nbr[k],v+days);}
        for(const link of sea[a]){const b=link.a===a?link.b:link.a;if(!alive(link.ca,year)||!alive(link.cb,year))continue;if(D.NAV<0||D.ideaA[D.NAV*D.NN+a]>year||D.ideaA[D.NAV*D.NN+b]>year)continue;add(b,v+link.days);}
      }
      return dist;
    }
    return {city,seat,rollbackLimit,reachable,budget,roadYear,seaChanges};
  }
  G.HistoryAdministration={create,cityPopulations,protectSeatCities};
})(typeof self!=='undefined'?self:globalThis);
