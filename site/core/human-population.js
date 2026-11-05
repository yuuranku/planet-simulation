/* 区块稀疏联合人口：种族、文化、宗教分别是独立维度。 */
(function (G) {
  'use strict';
  function create(nRegions) {
    const regions = Array.from({ length: nRegions + 1 }, () => new Map());
    const totals = new Float64Array(nRegions + 1);
    const key = (s, c, f) => `${s},${c},${f}`;
    function add(r, species, culture, religion, population) {
      if (!regions[r] || !Number.isSafeInteger(population) || population < 0) throw new Error('非法人口或区块');
      if (!population) return;
      const k = key(species, culture, religion), map = regions[r], old = map.get(k);
      if (old) old.population += population;
      else map.set(k, { species, culture, religion, population });
      totals[r] += population;
    }
    function move(from, to, species, culture, religion, population) {
      if (!regions[from] || !regions[to] || !Number.isSafeInteger(population) || population < 0) throw new Error('非法迁移');
      const map = regions[from], k = key(species, culture, religion), g = map.get(k);
      const n = Math.min(population, g ? g.population : 0);
      if (!n || from === to) return 0;
      g.population -= n; totals[from] -= n; if (!g.population) map.delete(k);
      add(to, species, culture, religion, n); return n;
    }
    function adjust(r, species, culture, religion, delta) {
      if (!Number.isSafeInteger(delta)) throw new Error('非法人口变化');
      if (delta >= 0) { add(r, species, culture, religion, delta); return delta; }
      const map = regions[r], k = key(species, culture, religion), old = map.get(k);
      const n = Math.min(-delta, old ? old.population : 0);
      if (n) { old.population -= n; totals[r] -= n; if (!old.population) map.delete(k); }
      return -n;
    }
    function convert(r, field, target, fraction, source) {
      if (field !== 'culture' && field !== 'religion') throw new Error('非法认同维度');
      if (!Number.isFinite(fraction) || fraction < 0 || fraction > 1) throw new Error('非法转化比例');
      let changed = 0;
      for (const g of Array.from(regions[r].values(), x => ({ ...x }))) {
        if (g[field] === target || (source !== undefined && g[field] !== source)) continue;
        const n = Math.min(g.population, Math.floor(g.population * fraction));
        if (!n) continue;
        const k = key(g.species, g.culture, g.religion), old = regions[r].get(k);
        old.population -= n; totals[r] -= n; if (!old.population) regions[r].delete(k);
        g[field] = target; add(r, g.species, g.culture, g.religion, n); changed += n;
      }
      return changed;
    }
    function groups(r) { return Array.from(regions[r].values(), g => ({ ...g })); }
    // 只读遍历给推演热路径使用；调用方不能增删人口组。
    function view(r) { return regions[r].values(); }
    function groupCount(r) { return regions[r].size; }
    function total(r) { return totals[r]; }
    function dominant(r, field) {
      const counts = new Map(); for (const g of regions[r].values()) counts.set(g[field], (counts.get(g[field]) || 0) + g.population);
      let best = -1, max = 0; for (const [v, n] of counts) if (n > max || (n === max && v < best)) { best = v; max = n; }
      return best;
    }
    function share(r, field, value) {
      if (!totals[r]) return 0; let n = 0;
      for (const g of regions[r].values()) if (g[field] === value) n += g.population;
      return n / totals[r];
    }
    // 只存存在的联合组；压缩区块偏移不删减少数群体。
    function snapshot(year) {
      const offsets = new Uint32Array(regions.length + 1);
      for (let r = 0; r < regions.length; r++) offsets[r + 1] = offsets[r] + regions[r].size;
      const n = offsets[regions.length], species = new Int32Array(n), culture = new Int32Array(n), religion = new Int32Array(n), population = new Float64Array(n);
      let i = 0; for (const region of regions) for (const g of region.values()) { species[i] = g.species; culture[i] = g.culture; religion[i] = g.religion; population[i] = g.population; i++; }
      return { year, offsets, species, culture, religion, population };
    }
    return { add, move, adjust, convert, groups, view, groupCount, total, dominant, share, snapshot };
  }
  G.HumanPopulation = { create };
})(typeof self !== 'undefined' ? self : globalThis);
