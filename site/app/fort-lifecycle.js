(function (G) {
  'use strict';
  const labels = {active:'边境设施',inactive:'已撤守',abandoned:'废弃旧关',settlement:'并入已有聚落'};
  const reasons = {built:'道路与边境防御选址',frontier_lost:'边境消失，撤守',interior_settlement:'长期处于内陆，并入附近既有聚落',interior_abandoned:'长期处于内陆，废弃',frontier_restored:'边境恢复，重新启用'};
  function at(fort, year) {
    let row = null;
    for (const item of fort.statusLog) { if (item[0] > year) break; row = item; }
    return row ? {status:row[1], since:row[0], cityIndex:row[2], settlementIndex:row[3], reason:row[4]} : null;
  }
  function guardAt(fort, year) { let row = null; for (const item of fort.log) { if (item[0] > year) break; row = item; } return row; }
  function label(fort, year) {
    const state = at(fort, year); if (!state) return '尚未建成';
    if (state.status !== 'active') return labels[state.status];
    const guards = guardAt(fort, year); return !guards ? '边境设施（驻军无记录）' : guards[1] > 0 ? '边防驻守' : '边境设施（无驻军）';
  }
  function kind(fort, year, detail) {
    const state = at(fort, year); if (!state) return null;
    if (state.status === 'active') return 'fort';
    if ((state.status === 'inactive' || state.status === 'abandoned') && detail >= 3) return 'ruin';
    return null;
  }
  function search(fort, year, cities, historical) {
    const state = at(fort, year); if (!state) return null;
    const cityIndex = historical ? state.cityIndex : state.settlementIndex;
    const city = state.status === 'settlement' ? cities[cityIndex] : null;
    return {ci: !historical && city ? cityIndex : undefined, t:label(fort, year), x:city ? city.x : fort.x, y:city ? city.y : fort.y, z:state.status === 'active' ? 10 : 20};
  }
  function linked(forts, city, year, historical) { return forts.map(fort => [fort, at(fort, year)]).filter(([,s]) => s && s.status === 'settlement' && (historical ? s.cityIndex : s.settlementIndex) === city); }
  G.FortLifecycle = {at, kind, linked, guardAt, label, search, labels, reasons};
})(window);
