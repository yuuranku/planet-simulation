/* 区域道路级边防：道路已出现且跨越历史政权边界，才评估删边绕行与当年余粮。
 * 区域图路径是战略近似；它不证明一座堡垒能封死真实地形中的所有小路。
 */
(function (G) {
  'use strict';
  function create({ R, h, roads, cities, nameOf, constructionAt=()=>0 }) {
    const land = [], edgeIndex = new Int32Array(R.edges.length).fill(-1);
    R.edges.forEach((e, i) => { if (!e.sea) { edgeIndex[i] = land.length; land.push(e); } });
    const network = G.HumanAnchors.network(R.nR, land), byEdge = new Map(), width = h.W * 2, height = h.H * 2;
    const edgeAt = (a, b) => { for (let k = R.off[a]; k < R.off[a + 1]; k++) if (R.nbr[k] === b && edgeIndex[R.eid[k]] >= 0) return R.eid[k]; return -1; };
    const wrapX = x => ((x % width) + width) % width;
    const cellAt = (x,y) => y < 0 || y >= height ? -1 : Math.floor(y / 2) * h.W + Math.floor(wrapX(x) / 2);
    const km = (a,b) => { const dx = Math.abs(a.x-b.x), lon = Math.min(dx, width-dx) * 2 * Math.PI / width;
      const lat1 = (0.5-a.y/height)*Math.PI, lat2 = (0.5-b.y/height)*Math.PI;
      const hav = Math.sin((lat1-lat2)/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(lon/2)**2;
      return 2*h.R*Math.asin(Math.min(1,Math.sqrt(Math.max(0,hav)))); };
    // 以地图实际绘制的折线穿过历史区块网格为候选；线与线之间、渡口剪段之间不连接。
    for (const road of roads) {
      const source = h.roads[road.id]; if (!source || !source.lines || !Number.isFinite(road.year)) continue;
      source.lines.forEach((line, lineId) => {
        let previousRegion = 0, previousCell = -1;
        for (let j = 0; j + 3 < line.length; j += 2) {
          const x0=line[j], y0=line[j+1], dx=line[j+2]-x0, dy=line[j+3]-y0;
          if (Math.abs(dx) > width / 2) { previousRegion=0; previousCell=-1; continue; }
          const cuts=[0,1];
          if (dx) for (let x = Math.floor(Math.min(x0,x0+dx)/2)*2+2; x < Math.max(x0,x0+dx); x+=2) cuts.push((x-x0)/dx);
          if (dy) for (let y = Math.floor(Math.min(y0,y0+dy)/2)*2+2; y < Math.max(y0,y0+dy); y+=2) cuts.push((y-y0)/dy);
          cuts.sort((a,b)=>a-b);
          for (let n=0; n+1<cuts.length; n++) { if (cuts[n+1]-cuts[n] < 1e-12) continue;
            const mid=(cuts[n]+cuts[n+1])/2, cell=cellAt(x0+dx*mid,y0+dy*mid), region=cell>=0 ? R.regionOf[cell] : 0;
            if (previousRegion>0 && region>0 && previousRegion!==region) { const edge=edgeAt(previousRegion,region);
              if (edge>=0) { const t=cuts[n], candidate={edge,a:previousRegion,b:region,ca:previousCell,cb:cell,year:road.year,road:road.id,line:lineId,segment:j/2,t,x:wrapX(x0+dx*t),y:y0+dy*t};
                const old=byEdge.get(edge); if (!old || candidate.year<old.year || (candidate.year===old.year && candidate.road<old.road)) byEdge.set(edge,candidate);
              }
            }
            previousRegion=region; previousCell=cell;
          }
        }
      });
    }
    const byRoute=[...byEdge.values()].sort((a,b)=>a.road-b.road || a.line-b.line || a.segment-b.segment || a.t-b.t || a.edge-b.edge), sites=[];
    for (const c of byRoute) { let site=sites[sites.length-1], prev=site && site.crossings[site.crossings.length-1];
      const adjacent = prev && (prev.a===c.a || prev.a===c.b || prev.b===c.a || prev.b===c.b);
      if (!site || c.road!==prev.road || c.line!==prev.line || !adjacent || site.crossings.some(point => km(point,c)>10)) { site={ id:`site-${c.road}-${c.line}-${c.edge}`, crossings:[] }; sites.push(site); }
      site.crossings.push(c); c.site=site;
    }
    const candidates=[...byEdge.values()].sort((a,b)=>a.year-b.year || a.edge-b.edge);
    const cityList = cities || [];
    const relatedSettlements = new Map(), forts = [], bySite = new Map(), at = new Int32Array(R.nR + 1).fill(-1), constructionPersonDays = 1000;
    const extra = c => { if (c.extra === undefined) { const i = edgeIndex[c.edge]; c.extra = Math.max(0, network.detour(i) - network.days[i]); } return c.extra; };
    function estimate(r, c, population, food, construction) {
      const pop = population[r], surplus = Math.max(0, food.foodAvailable[r] - food.foodDemand[r]);
      if (!(pop > 0) || surplus < 1 || construction > pop * 30) return 0;
      return G.HumanAnchors.defense({ population: pop, availableFood: surplus, threat: 0.5, detourDays: extra(c), constructionPersonDays: construction, maintenancePerGuard: 1 }).guards;
    }
    const setLog = (f, year, guards, owner, surplus, population) => {
      const last = f.log[f.log.length - 1], maintenance = guards; // 选址的预估供给上限；Military 按实际驻军人口组结算额外口粮与生产占用。
      if (!last || last[1] !== guards || last[2] !== maintenance || last[3] !== owner) { const entry = [year, guards, maintenance, owner, surplus, population]; if (last && last[0] === year) f.log[f.log.length - 1] = entry; else f.log.push(entry); }
    };
    const setStatus = (f, year, status, cityIndex, settlementIndex, reason) => {
      const log = f.statusLog, last = log[log.length - 1];
      if (last && last[1] === status && last[2] === cityIndex) return;
      const entry = [year, status, cityIndex, settlementIndex, reason];
      if (last && last[0] === year) log[log.length - 1] = entry; else log.push(entry);
    };
    function nearbySettlements(f) {
      const road = h.roads[f.road], cells = new Set(road.cells), list = [], width = h.W * 2, height = h.H * 2;
      for (let i = 0; i < cityList.length; i++) { const city = cityList[i], settlement = h.settlements && h.settlements[city.idx];
        if (city.r !== f.region || !settlement || !cells.has(settlement.cell)) continue;
        const dx = Math.abs(city.x - f.x), lon = Math.min(dx, width - dx) * 2 * Math.PI / width;
        const lat1 = (0.5 - f.y / height) * Math.PI, lat2 = (0.5 - city.y / height) * Math.PI;
        const hav = Math.sin((lat1-lat2)/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(lon/2)**2;
        const km = 2 * h.R * Math.asin(Math.min(1, Math.sqrt(Math.max(0, hav))));
        if (km <= 30) list.push({ i, city, km });
      }
      return list.sort((a,b) => a.km - b.km || a.i - b.i);
    }
    function step({ year, owner, population, food, allowBuild = true, refreshOnly = false }) {
      // 一区最多一堡，故该区粮食余量只分配一次；没有余量时设施仍在、驻守归零。
      for (const f of forts) {
        const crossings = f.site.edges.map(edge => byEdge.get(edge));
        const borders = crossings.filter(c => { const other = c.a === f.region ? c.b : c.a; return owner[f.region] >= 0 && owner[other] >= 0 && owner[f.region] !== owner[other]; });
        const frontier = borders.length > 0;
        const surplus = Math.max(0, food.foodAvailable[f.region] - food.foodDemand[f.region]);
        const previous=f.log[f.log.length-1];
        const guards = frontier ? refreshOnly ? (previous && previous[3]===owner[f.region] ? previous[1] : 0) : Math.max(...borders.map(c => estimate(f.region, c, population, food, 0))) : 0;
        if(!refreshOnly)setLog(f, year, guards, owner[f.region], surplus, population[f.region]);
        else if(previous && (previous[1]!==guards || previous[3]!==owner[f.region])) {const entry=[year,guards,previous[2],owner[f.region],previous[4],population[f.region]];if(previous[0]===year)f.log[f.log.length-1]=entry;else f.log.push(entry);}
        const status = f.statusLog[f.statusLog.length - 1][1];
        if (frontier) { if (status !== 'active') { f.inlandSince = null; setStatus(f, year, 'active', -1, -1, 'frontier_restored'); } }
        else {
          if (status === 'active') { f.inlandSince = year; setStatus(f, year, 'inactive', -1, -1, 'frontier_lost'); }
          if (f.inlandSince !== null && year - f.inlandSince >= 50) {
            const found = population[f.region] > 0 && relatedSettlements.get(f.id).find(o => o.city.founded <= year && (o.city.ruined === null || o.city.ruined > year));
            if (found) setStatus(f, year, 'settlement', found.i, found.city.idx, 'interior_settlement');
            else setStatus(f, year, 'abandoned', -1, -1, 'interior_abandoned');
          }
        }
      }
      if (!allowBuild) return;
      const proposals = [];
      for (const c of candidates) {
        if (c.year > year || owner[c.a] < 0 || owner[c.b] < 0 || owner[c.a] === owner[c.b]) continue;
        for (const [r, cell] of [[c.a,c.ca],[c.b,c.cb]]) {
          const construction=Math.ceil(constructionPersonDays*G.HumanRules.multiplier(constructionAt(r)));
          if (at[r] >= 0 || bySite.has(c.site.id) || !(population[r] * 30 >= construction) || food.foodAvailable[r] - food.foodDemand[r] < 1) continue;
          const detour = extra(c); if (detour < 7) continue;
          const guards = estimate(r, c, population, food, construction); if (!guards) continue;
          proposals.push({ c, r, cell, detour, guards, construction, score: guards * Math.min(30, detour) });
        }
      }
      proposals.sort((a,b) => b.score - a.score || a.r - b.r || a.c.edge - b.c.edge);
      for (const p of proposals) {
        if (at[p.r] >= 0 || bySite.has(p.c.site.id)) continue;
        const site = { id:p.c.site.id, road:p.c.road, line:p.c.line, segment:p.c.segment, t:p.c.t, x:p.c.x, y:p.c.y, cell:p.cell, edges:p.c.site.crossings.filter(c => c.a === p.r || c.b === p.r).map(c => c.edge) };
        const f = { id:`fort-${p.c.site.id}`, site, name:nameOf(p.r), x:p.c.x, y:p.c.y,
          year, region:p.r, edge:p.c.edge, road:p.c.road, detourDays:Number.isFinite(p.detour) ? p.detour : null,
          detourDisconnected:!Number.isFinite(p.detour), constructionPersonDays:p.construction,
          foodSurplusAtBuild:Math.max(0, food.foodAvailable[p.r] - food.foodDemand[p.r]), laborBudgetPersonDaysAtBuild:population[p.r] * 30, log:[], statusLog:[], inlandSince:null };
        relatedSettlements.set(f.id, nearbySettlements(f)); setStatus(f, year, 'active', -1, -1, 'built');
        setLog(f, year, p.guards, owner[p.r], f.foodSurplusAtBuild, population[p.r]); at[p.r] = forts.length; bySite.set(p.c.site.id, forts.length); forts.push(f);
      }
    }
    function effect(region, edge) {
      const i = at[region]; if (i < 0) return 0;
      const f = forts[i], last = f.log[f.log.length - 1]; return f.site.edges.includes(edge) && last ? last[1] : 0;
    }
    return { forts, step, effect };
  }
  G.HumanFortifications = { create };
})(typeof self !== 'undefined' ? self : globalThis);
