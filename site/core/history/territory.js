/* Limited administrative incorporation of enclosed, unclaimed land.
 * Existing countries never lose territory to a visual border cleanup. */
(function (G) {
  'use strict';
  function pockets({R, owner, eligible, live, maxRegions, maxArea, budget, entryDays, edgeDays}) {
    const seen = new Uint8Array(R.nR + 1), result = [], committed = new Map();
    // Regions are indivisible and unequal in area. A fractional expansion
    // allowance must still admit one unit no larger than this state's existing
    // largest region, or a reachable interior hole can remain unclaimed forever.
    const unitArea = new Map();
    for (let r = 1; r <= R.nR; r++) if (owner[r] >= 0) unitArea.set(owner[r], Math.max(unitArea.get(owner[r]) || 0, R.area[r]));
    for (let first = 1; first <= R.nR; first++) {
      if (seen[first] || owner[first] >= 0) continue;
      const regions = [first], boundary = [], neighbors = new Set(); seen[first] = 1;
      let area = 0, inhabitable = true;
      for (let i = 0; i < regions.length; i++) {
        const a = regions[i]; area += R.area[a]; inhabitable = inhabitable && eligible(a);
        for (let k = R.off[a]; k < R.off[a + 1]; k++) {
          const edge = R.edges[R.eid[k]], b = R.nbr[k]; if (edge.sea) continue;
          if (owner[b] >= 0) { neighbors.add(owner[b]); boundary.push({a, b, edge}); }
          else if (!seen[b]) { seen[b] = 1; regions.push(b); }
        }
      }
      if (!inhabitable || neighbors.size !== 1) continue;
      const p = neighbors.values().next().value;
      const used = committed.get(p) || {regions:0, area:0};
      if (!live(p) || regions.length + used.regions > maxRegions(p) || area + used.area > Math.max(maxArea(p), unitArea.get(p) || 0)) continue;
      const limit = budget(p); if (!(limit > 0)) continue;
      const distance = new Map(regions.map(r => [r, Infinity])), pending = new Set(regions);
      for (const {a,b,edge} of boundary) distance.set(a, Math.min(distance.get(a), entryDays(p,b) + edgeDays(edge)));
      // Components are small by the territory budget; a bounded scan is cheaper
      // than allocating a world-sized routing graph for every pocket.
      while (pending.size) {
        let a = -1, cost = Infinity;
        for (const r of pending) if (distance.get(r) < cost) { a = r; cost = distance.get(r); }
        if (a < 0 || cost > limit) break;
        pending.delete(a);
        for (let k = R.off[a]; k < R.off[a + 1]; k++) {
          const edge = R.edges[R.eid[k]], b = R.nbr[k]; if (edge.sea || !pending.has(b)) continue;
          distance.set(b, Math.min(distance.get(b), cost + edgeDays(edge)));
        }
      }
      if (pending.size) continue;
      result.push({owner:p, regions, area, days:Math.max(...distance.values())});
      committed.set(p, {regions:used.regions + regions.length, area:used.area + area});
    }
    return result;
  }
  G.HistoryTerritory = {pockets};
})(typeof self !== 'undefined' ? self : globalThis);
