/* Historical facts for on-demand lives. Never substitute terminal or future data. */
(function (G) {
  'use strict';
  const caches = new WeakMap();
  function rowAt(rows, year) { let result = null; for (const row of rows || []) { if (row[0] > year) break; result = row; } return result; }
  function logAt(log, region, year, key = 'val') {
    if (!log || !log.off || region < 1 || region + 1 >= log.off.length) return -1;
    let low = log.off[region], high = log.off[region + 1] - 1, value = -1;
    while (low <= high) { const mid = (low + high) >>> 1; if (log.year[mid] <= year) { value = log[key][mid]; low = mid + 1; } else high = mid - 1; }
    return value;
  }
  const exists = (city, year) => !!city && city.founded <= year && !(city.ruined != null && city.ruined > 0 && year >= city.ruined);
  const culture = (h, id) => id >= 0 ? h.civs[id] : id <= -2 ? h.ancient[-2-id] : null;
  function sampleAt(h, year) {
    let sample = null;
    for (const s of h.human?.snapshots || []) {
      if (s.year > year) break;
      if (Number.isFinite(s.calculatedThroughYear) && s.calculatedThroughYear > year) continue;
      sample = s;
    }
    return sample;
  }
  function population(h, regions, year) {
    const s = sampleAt(h, year); if (!s) return { available:false, year:null, groups:[], total:0, reason:'此前没有可用的人口采样，请选择较晚年份。' };
    const groups = []; let total = 0;
    for (const region of regions) for (let i = s.offsets[region]; i < s.offsets[region + 1]; i++) {
      const n = s.population[i], faith = s.religion[i];
      if (!(n > 0)) continue;
      // An inconsistent record must not fabricate a religion before its founding.
      if (faith >= 0 && (!h.religions[faith] || !Number.isFinite(h.religions[faith].founded) || h.religions[faith].founded > year)) continue;
      groups.push({region,species:s.species[i],culture:s.culture[i],religion:faith,population:n}); total += n;
    }
    return {available:total > 0,year:s.year,calculatedThroughYear:s.calculatedThroughYear ?? s.year,groups,total,source:'human.snapshots',reason:total ? '' : '当地在此前采样中没有符合条件的居民。'};
  }
  function polity(h, id, year) {
    const p = h.polities?.[id]; if (!p || year < p.born || (p.died != null && year > p.died)) return null;
    const name = rowAt(p.names, year), gov = rowAt(p.gov, year), ruling = rowAt(p.rulingCulture, year);
    return {id,name:name ? name[1] : '国名未记录',government:gov ? gov[1] : null,rulingCulture:ruling ? ruling[1] : p.initialCiv ?? null};
  }
  function district(h, region, year) {
    const owner = logAt(h.own, region, year, 'owner'), province = logAt(h.provLog, region, year), s = sampleAt(h, year);
    return {region,year,owner,polity:polity(h,owner,year),province,culture:logAt(h.cultLog,region,year),religion:logAt(h.relLog,region,year),food:s?.localFood ? {year:s.localFood.sampleYear,available:s.localFood.available[region],demand:s.localFood.demand[region]} : null};
  }
  function location(h, selection, year) {
    if (!Number.isFinite(year) || year < 0 || year >= h.E+1) throw Error('年份必须在已推演的世界历史范围内。');
    const id = Number(selection.id), kind = selection.kind;
    if (kind === 'city') {
      const c = h.cities[id]; if (!c) throw Error('城市不存在。');
      const active = exists(c, year), nm = rowAt(c.names, year);
      return {kind,id,year,exists:active,regions:[c.r],name:nm ? nm[1] : '尚未建成的城市',x:c.x,y:c.y,...district(h,c.r,year),reason:active ? '' : `所选年份城市${year < c.founded ? '尚未建立' : '已经毁弃'}。可选择该地乡村出生。`};
    }
    if (kind === 'province') {
      const p = h.provinces[id]; if (!p) throw Error('省份不存在。');
      const active = year >= p.created && (p.abolished == null || year < p.abolished), regions=[];
      if (active) for (let r=1;r<=h.nR;r++) if (logAt(h.provLog,r,year)===id) regions.push(r);
      const nm=rowAt(p.names,year);
      return {kind,id,year,exists:active&&regions.length>0,regions,name:nm ? nm[1] : '尚未设立的省份',reason:active ? '所选年份没有可用辖区。' : '所选年份省份尚未设立或已经撤销。'};
    }
    if (kind === 'rural' && Number.isInteger(id) && id>0 && id<=h.nR) {
      const info=district(h,id,year), nm=info.province>=0 ? rowAt(h.provinces[info.province]?.names,year)?.[1] : null;
      return {kind,id,year,exists:true,regions:[id],name:nm ? nm+'乡间' : `第 ${id} 地区乡间`,x:h.cx[id],y:h.cy[id],...info};
    }
    throw Error('地点类型无效。');
  }
  function cache(h) {
    if (caches.has(h)) return caches.get(h);
    const effects=Array.from({length:h.nR+1},()=>[]), roads=new Map(), cityIdx=new Map(),campaigns=new Map((h.military?.campaigns||[]).map(c=>[c.id,c]));
    h.cities.forEach((c,id)=>{if(c.idx>=0)cityIdx.set(c.idx,id);});
    for(const e of h.military?.effects||[]) for(const r of new Set(e.regions||[])) if(effects[r]) effects[r].push(e);
    // Only explicitly located historical events qualify as local exposure.
    for(let i=0;i<(h.events||[]).length;i++) {
      const e=h.events[i]; if(!['plague','disaster','ruin'].includes(e.kind)||!effects[e.r])continue;
      effects[e.r].push({id:'history-event-'+i,kind:e.kind,startYear:e.time,endYear:e.time,regions:[e.r],severity:.25,source:'events',text:e.text});
    }
    for(const rd of h.roads||[]) {
      const a=cityIdx.get(rd.sa),b=cityIdx.get(rd.sb); if(a===undefined||b===undefined||a===b)continue;
      for(const [from,to] of [[a,b],[b,a]]) { if(!roads.has(from))roads.set(from,[]); roads.get(from).push({to,road:rd}); }
    }
    const result={effects,roads,campaigns};caches.set(h,result);return result;
  }
  function effects(h,region,from,to) { return (cache(h).effects[region]||[]).filter(e=>e.startYear<=to && e.endYear>=from); }
  function campaign(h,id) { return cache(h).campaigns.get(id)||null; }
  function roadsFrom(h,cityId,year) { return (cache(h).roads.get(cityId)||[]).filter(x=>x.road.year<=year&&exists(h.cities[x.to],year)&&exists(h.cities[cityId],year)); }
  G.HistoryQuery={rowAt,logAt,exists,culture,sampleAt,population,polity,district,location,effects,campaign,roadsFrom};
})(typeof self!=='undefined'?self:globalThis);
