/* Decision primitives. Units: days, labour hours, person-food-years, people.
 * These are explicit simulation assumptions, not calibrated economic laws.
 * State mutations belong to population/history, not to these evaluators. */
(function(G){
  'use strict';
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const effects=d=>G.HumanRules.effects(d), mult=G.HumanRules.multiplier;
  function temperatureFit(species,t) {
    const e=effects(species),lo=species.temperature[0]-e.coldTolerance, hi=species.temperature[1]+e.heatTolerance;
    const outside=Math.max(lo-t,0,t-hi); return Math.exp(-outside*outside/100);
  }
  function habitat(species,R,r) { return temperatureFit(species,R.T[r]); }
  function travelDays(edge,species,culture) {
    const s=effects(species),c=effects(culture),mobility=(species?species.mountainMobility:1)*mult(s.mountainTravel+c.mountainTravel);
    const rough=Math.max(0,edge.rough||0)/mobility;
    const speed=edge.sea?80:24*mult(s.travelSpeed+c.travelSpeed);
    return Math.max(0,edge.km)/speed*(1+.22*rough)/mult(Math.min(1,edge.river||0)*(s.riverTravel+c.riverTravel));
  }
  function migration(species,R,from,to,edge,culture,rights) {
    const fit=habitat(species,R,to), days=travelDays(edge,species,culture);
    const risk=clamp((rights&&rights.risk)||0,0,1), toll=Math.max(0,(rights&&rights.tollDays)||0);
    const viable=!(rights&&rights.allowed===false)&&fit>.02&&risk<1&&Number.isFinite(days);
    const s=effects(species),c=effects(culture),wet=R.Pr&&R.Pr[to]>=1400;
    const costFactor=mult(s.migrationCost+c.migrationCost+(wet?s.wetMigration+c.wetMigration:0));
    const food=species.foodNeed*mult(s.foodNeed+c.foodNeed+((R.Pr&&R.Pr[to]<400)?s.dryFoodNeed+c.dryFoodNeed:0));
    return {viable,cost:viable?(days*food+toll)*costFactor/(1-risk):Infinity,days,risk,reason:!viable?'环境或通行权阻止迁入':toll?'通行税增加迁徙负担':'交通、天赋与食物共同约束迁徙'};
  }
  function contact(R,from,to,edge,culture,religion,pilgrimageAllowed=false) {
    const days=travelDays(edge,null,culture);
    const c=effects(culture),r=effects(religion);
    return clamp(Math.exp(-days/35)*mult(c.culturalExchange+r.culturalExchange+(pilgrimageAllowed?r.pilgrimage:0)),0,1);
  }
  function production(x) {
    if(!(x.yieldRate>0&&x.yieldRate<=1)||!(x.trainingOutput>0))throw Error('生产良率和训练产量无效');
    const inputs=[x.laborHours,x.transportHours,x.trainingHours,x.materialHours];
    if(inputs.some(v=>!Number.isFinite(v)||v<0))throw Error('生产工时必须为非负数');
    return {hoursPerUnit:(x.laborHours+x.transportHours+x.materialHours+x.trainingHours/x.trainingOutput)/x.yieldRate};
  }
  function allocate(quantity,options) {
    if(!Number.isFinite(quantity)||quantity<0)throw Error('需求数量无效');
    const choices=options.filter(o=>o.allowed!==false&&o.capacity>0&&Number.isFinite(o.cost)&&o.cost>=0).slice().sort((a,b)=>a.cost-b.cost||String(a.id).localeCompare(String(b.id)));
    let unmet=quantity,totalCost=0; const flows=[];
    for(const o of choices){const q=Math.min(unmet,o.capacity);if(q<=0)break;flows.push({id:o.id,quantity:q,cost:o.cost});totalCost+=q*o.cost;unmet-=q;}
    return {flows,unmet,totalCost};
  }
  function governance(x) {
    const autonomy=clamp(x.autonomy||0,0,1), share=clamp(x.culturalShare,0,1);
    const reach=Math.exp(-Math.max(0,x.travelDays)/Math.max(1,x.capacityDays))*(1-.25*autonomy);
    return {reach,friction:(1-share)*(1-.7*autonomy)+(1-reach)*.3};
  }
  function defense(x) {
    const labor=Math.floor(Math.max(0,x.population)*.05);
    const food=Math.floor(Math.max(0,x.availableFood)/Math.max(.01,x.maintenancePerGuard));
    const affordable=Math.max(0,Math.min(labor,food));
    const bypass=x.detourDays===Infinity?1:clamp(x.detourDays/30,0,1);
    // Both numerator and denominator are person-days of construction labor.
    const laborDays=x.laborDaysPerPerson===undefined?30:x.laborDaysPerPerson;
    if(!Number.isFinite(laborDays)||laborDays<=0||!Number.isFinite(x.constructionPersonDays)||x.constructionPersonDays<0)throw Error('筑防劳动量无效');
    const build=1/(1+x.constructionPersonDays/Math.max(1,x.population*laborDays));
    const guards=Math.floor(affordable*clamp(x.threat,0,1)*bypass*build);
    return {guards,affordable,deterrence:guards/Math.max(1,x.population),bypass};
  }
  // Exact alternate path on the regional graph. Compute only queried edges, cache by static graph.
  function network(n,edges) {
    const adj=Array.from({length:n+1},()=>[]), costs=edges.map(e=>travelDays(e,null,null)), cache=new Map();
    edges.forEach((e,i)=>{adj[e.a].push([e.b,i]);adj[e.b].push([e.a,i]);});
    function detour(excluded) {
      if(cache.has(excluded))return cache.get(excluded);
      const edge=edges[excluded];if(!edge)throw Error('绕行边不存在');
      const d=new Float64Array(n+1).fill(Infinity), heap=[];
      const push=(r,c)=>{let i=heap.length;heap.push([r,c]);while(i){const p=(i-1)>>1;if(heap[p][1]<=c)break;heap[i]=heap[p];i=p;}heap[i]=[r,c];};
      const pop=()=>{const v=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length&&heap[c+1][1]<heap[c][1])c++;if(heap[c][1]>=last[1])break;heap[i]=heap[c];i=c;}heap[i]=last;}return v;};
      d[edge.a]=0;push(edge.a,0);
      while(heap.length){const [r,c]=pop();if(c!==d[r])continue;if(r===edge.b)break;for(const [s,e] of adj[r]){if(e===excluded)continue;const nd=c+costs[e];if(nd<d[s]){d[s]=nd;push(s,nd);}}}
      cache.set(excluded,d[edge.b]);return d[edge.b];
    }
    return {detour,days:costs};
  }
  G.HumanAnchors={temperatureFit,habitat,travelDays,migration,contact,production,allocate,governance,defense,network};
})(typeof self!=='undefined'?self:this);
