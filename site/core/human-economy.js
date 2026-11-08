/* Annual food accounting, recalculated once per historical tick.
 * Units: person-food-years, labour-hours/person-food-year, route days.
 * No currency, stockpiling, sea trade, or unmodelled external supply.
 * Production, transport capacity and loss coefficients are model assumptions.
 */
(function (G) {
  'use strict';
  // Region edges never change after they are built, so the neutral (no species,
  // no culture) route duration is computed once per edge list, not every tick.
  const neutralDays=new WeakMap();
  function edgeDays(edges) {
    let d=neutralDays.get(edges);
    if(!d||d.length!==edges.length){d=new Float64Array(edges.length);for(let k=0;k<edges.length;k++){const e=edges[k];d[k]=e.sea?NaN:G.HumanAnchors.travelDays(e,null,null);}neutralDays.set(edges,d);}
    return d;
  }
  function allocate({ R, human, species, popTotal, stage, cultureAt, religionAt }) {
    if(typeof cultureAt!=='function'||typeof religionAt!=='function')throw Error('缺少文化或宗教的人口组查询');
    const n=R.nR, demand=new Float64Array(n+1), production=new Float64Array(n+1);
    const available=new Float64Array(n+1), capacity=new Float64Array(n+1), surplus=new Float64Array(n+1);
    const population=new Float64Array(n+1), cost=new Float64Array(n+1), tradeCapacity=new Float64Array(n+1), tradeLoss=new Float64Array(n+1);
    const laborByStage=Array.from({length:9},(_,s)=>G.HumanAnchors.production({laborHours:180/(1+.1*s),transportHours:0,trainingHours:0,trainingOutput:1,materialHours:0,yieldRate:1}).hoursPerUnit);
    // Per-step identity cache: local cultural variants stay independent, while
    // repeated joint groups reuse the same additive effects without losing detail.
    const groupCache=new Map();
    function groupEffects(s,c,f) {
      let cultures=groupCache.get(s); if(!cultures)groupCache.set(s,cultures=new Map());
      let faiths=cultures.get(c); if(!faiths)cultures.set(c,faiths=new Map());
      if(!faiths.has(f))faiths.set(f,G.HumanRules.combine(s,c,f));
      return faiths.get(f);
    }
    for(let r=1;r<=n;r++) {
      const p=human.total(r), st=Math.max(0,Math.min(8,stage[r]||0));
      if (!Number.isFinite(p)||p<0||!Number.isFinite(R.weight[r])||R.weight[r]<0||!Number.isFinite(popTotal)||popTotal<0) throw Error('粮食人口或区域产能无效');
      population[r]=p;
      const dry=Number.isFinite(R.Pr?.[r])&&R.Pr[r]<400, river=R.river?.[r]>0, mountain=R.eN?.[r]>=.4;
      let labor=0,weightedCost=0,weightedTrade=0,weightedLoss=0;
      for(const g of human.view(r)) {
        const need=species[g.species] && species[g.species].foodNeed;
        if(!Number.isFinite(need)||need<=0||!Number.isFinite(g.population)||g.population<0)throw Error('粮食需求无效');
        const fx=groupEffects(species[g.species],cultureAt(r,g.culture),religionAt(g.religion));
        const factor=G.HumanRules.multiplier(fx.foodOutput+(dry?fx.dryFoodOutput:0)+(river?fx.riverFoodOutput:0)+(mountain?fx.mountainFoodOutput:0));
        const work=g.population*factor;
        demand[r]+=g.population*need*G.HumanRules.multiplier(fx.foodNeed+(dry?fx.dryFoodNeed:0));
        labor+=work;
        // More output per worker lowers productive labour per food unit;
        // an explicit labourCost effect modifies the input hours separately.
        weightedCost+=g.population*G.HumanRules.multiplier(fx.laborCost);
        weightedTrade+=work*G.HumanRules.multiplier(fx.tradeCapacity);
        weightedLoss+=work*G.HumanRules.multiplier(fx.tradeLoss);
      }
      // Labour limits how much of the region's agricultural potential can be used.
      const potential=R.weight[r]*popTotal*(.15+.85*st/8);
      production[r]=Math.min(labor*(1.2+.2*st),potential);
      available[r]=production[r]; surplus[r]=Math.max(0,production[r]-demand[r]);
      cost[r]=laborByStage[Math.floor(st)]*(labor>0?weightedCost/labor:1);
      tradeCapacity[r]=labor>0?weightedTrade/labor:1;
      tradeLoss[r]=labor>0?weightedLoss/labor:1;
    }
    // Candidate paths are built once per tick. Exporters never resell imports.
    const candidates=Array.from({length:n+1},()=>[]);
    const neutral=edgeDays(R.edges);
    for(let ek=0;ek<R.edges.length;ek++) {
      const e=R.edges[ek];
      if(e.sea||!Number.isInteger(e.a)||!Number.isInteger(e.b)||e.a<1||e.b<1||e.a>n||e.b>n) continue;
      const days=neutral[ek];
      if(!Number.isFinite(days)||days<0)continue;
      const toll=e.tollLaborHours===undefined?0:e.tollLaborHours;
      if(!Number.isFinite(toll)||toll<0)throw Error('粮食通行费劳动时数无效');
      const add=(from,to)=>{
        if(surplus[from]<=0||demand[to]<=production[to])return;
        // Each edge has bounded annual capacity, reduced by route duration.
        const sentLimit=production[from]*.10*30/(30+days)*tradeCapacity[from];
        if(sentLimit<=0)return;
        const retention=1-Math.min(.3,days*.001*tradeLoss[from]);
        candidates[to].push({from,days,retention,sentLimit,toll});
      };
      add(e.a,e.b); add(e.b,e.a);
    }
    let totalExport=0,totalImport=0,loss=0,exchanges=0,unmet=0;
    const importedLaborCost=new Float64Array(n+1), imported=new Float64Array(n+1), exported=new Float64Array(n+1), exportLoss=new Float64Array(n+1);
    for(let r=1;r<=n;r++) {
      const shortage=Math.max(0,demand[r]-production[r]);
      if(!shortage)continue;
      const byId=new Map(), options=[], cheapest=new Map();
      for(const p of candidates[r]) {
        if(surplus[p.from]<=0)continue;
        const price=(cost[p.from]+p.days*.08+p.toll)/p.retention;
        const old=cheapest.get(p.from);
        if(!old||price<old.price)cheapest.set(p.from,{route:p,price});
      }
      for(const [from, choice] of cheapest) {
        const p=choice.route, sent=Math.min(surplus[from],p.sentLimit);
        const id=String(from); byId.set(id,p);
        // Model assumes one transport worker-day per 100 person-food-years.
        options.push({id,capacity:sent*p.retention,cost:choice.price});
      }
      const allocation=G.HumanAnchors.allocate(shortage,options);
      for(const flow of allocation.flows) {
        const route=byId.get(flow.id), sent=flow.quantity/route.retention;
        surplus[route.from]=Math.max(0,surplus[route.from]-sent);
        available[route.from]-=sent; available[r]+=flow.quantity; imported[r]+=flow.quantity;
        exported[route.from]+=sent; exportLoss[route.from]+=sent-flow.quantity;
        totalExport+=sent; totalImport+=flow.quantity; loss+=sent-flow.quantity; exchanges++;
        importedLaborCost[r]+=flow.quantity*flow.cost;
      }
    }
    // Unit cost includes local labour on retained output and the full production,
    // transport and toll labour of imports, divided by food actually available.
    // No supply is represented by NaN, not a free good or invented market price.
    const unitCost=new Float64Array(n+1).fill(NaN);
    for(let r=1;r<=n;r++) {
      unmet+=Math.max(0,demand[r]-available[r]);
      capacity[r]=population[r]>0&&demand[r]>0 ? available[r]*population[r]/demand[r] : 0;
      if(available[r]>0)unitCost[r]=((available[r]-imported[r])*cost[r]+importedLaborCost[r])/available[r];
    }
    return {foodDemand:demand,foodProduction:production,foodAvailable:available,effectiveCapacity:capacity,
      foodImport:imported,foodExport:exported,foodExportLoss:exportLoss,importedLaborCost,unitCost,
      summary:{exchanges,totalExport,totalImport,loss,unmet}};
  }
  G.HumanEconomy={allocate};
})(typeof self!=='undefined'?self:globalThis);
