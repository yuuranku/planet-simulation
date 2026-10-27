/* Stylised plan rendering: an antique tinted-engraving look layered over the
 * generated drawing. Generation is untouched; this module only recolours the
 * drawn layers and adds hand-drawn detail from the saved plan geometry:
 * open-field strips and balks, hedgerows, crenellated walls and round towers,
 * engraved water lines, burgage fences and garden trees, paper grain. */
(function (global) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const svg = (name, attributes = {}) => {
    const node = document.createElementNS(NS, name);
    for (const [key, value] of Object.entries(attributes)) if (value !== undefined) node.setAttribute(key, String(value));
    return node;
  };
  const INK = '#4a3d2e';
  const CROPS = ['#e0cd8b', '#e6d9a1', '#d4d293', '#c9b183', '#bea179', '#c4cf92', '#d9c27f', '#cfd6a2'];
  const FALLOW = ['#c9b183', '#bea179'];

  function hash(a, b = 0) {
    let x = (Math.imul(a | 0, 0x9e3779b1) ^ Math.imul(b | 0, 0x85ebca6b)) >>> 0;
    x ^= x >>> 15; x = Math.imul(x, 0x2c1b3c6d) >>> 0; x ^= x >>> 12; x = Math.imul(x, 0x297a2d39) >>> 0; x ^= x >>> 15;
    return (x >>> 0) / 4294967296;
  }
  const mix = (a, b, t) => {
    const p = a.match(/\w\w/g).map(h => parseInt(h, 16)), q = b.match(/\w\w/g).map(h => parseInt(h, 16));
    return '#' + p.map((v, i) => Math.round(v + (q[i] - v) * t).toString(16).padStart(2, '0')).join('');
  };
  // ---- tiny 2D helpers in kilometres ----
  function clip(poly, nx, ny, d) { // keep n·p <= d
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length], da = a.x * nx + a.y * ny - d, db = b.x * nx + b.y * ny - d;
      if (da <= 0) out.push(a);
      if (da < 0 !== db < 0 && da !== db) { const t = da / (da - db); out.push({x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t}); }
    }
    return out;
  }
  const area = poly => Math.abs(poly.reduce((s, p, i) => { const q = poly[(i + 1) % poly.length]; return s + p.x * q.y - q.x * p.y; }, 0)) / 2;
  const d = (pts, close = true) => pts.length ? 'M' + pts.map(p => p.x.toFixed(5) + ' ' + p.y.toFixed(5)).join('L') + (close ? 'Z' : '') : '';
  const circle = (c, r) => `M${(c.x - r).toFixed(5)} ${c.y.toFixed(5)}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
  const centroid = pts => ({x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length});
  function inside(poly, p) {
    let hit = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], b = poly[j];
      if (a.y > p.y !== b.y > p.y && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) hit = !hit;
    }
    return hit;
  }

  function apply(container, layout) {
    const recipe = layout.recipe, plan = layout.cityPlan, m = recipe.urban.gridCellKilometres, loc = recipe.location,
      scalar = plan.gridCellKilometres, seed = (layout.seed >>> 0) || 1;
    const km = p => ({x: (p.column - loc.column) * m.column, y: (p.row - loc.row) * m.row});
    const siteFrame = attrs => svg('g', {transform: `scale(${1 / m.column} ${1 / m.row})`, ...attrs});
    const cityFrame = attrs => svg('g', {transform: `scale(${1 / scalar})`, ...attrs});
    const site = container.querySelector('.city-local-site'), city = container.querySelector('.city-detail');
    if (!site || !city) return;
    container.classList.add('atlas-style');

    // ---- terrain: parchment ramp with relief ----
    const bands = Array.from(site.querySelectorAll('.city-local-terrain path'));
    bands.forEach((band, i) => band.setAttribute('fill', mix('#e8e1c2', '#d3c79d', bands.length > 1 ? i / (bands.length - 1) : 0)));
    for (const line of site.querySelectorAll('.city-local-contours path')) line.setAttribute('stroke', '#a88f66');

    // ---- open fields: furlongs of strips with crop tints, balks, ridge lines ----
    const agriculture = container.querySelector('.city-agricultural-ground');
    if (agriculture) {
      for (const node of agriculture.querySelectorAll('.city-farmland')) node.setAttribute('fill-opacity', '0');
      for (const node of agriculture.querySelectorAll('.city-field-headlands')) { node.setAttribute('fill', '#c7b48a'); node.setAttribute('fill-opacity', '.55'); }
      const strips = new Map(), balks = [], hedges = [], hedgeTrees = [];
      for (const [index, field] of plan.farmland.entries()) {
        const poly = field.points.map(km);
        if (field.kind === 'orchard') { (strips.get('#c7d39c') || strips.set('#c7d39c', []).get('#c7d39c')).push(d(poly)); continue; }
        if (field.kind === 'meadow') { (strips.get('#cfd8a8') || strips.set('#cfd8a8', []).get('#cfd8a8')).push(d(poly)); continue; }
        // Furrow direction from the saved plough lines, else the longest edge.
        let dir = null;
        const line = field.lines?.find(l => l.length > 1);
        if (line) { const a = km(line[0]), b = km(line.at(-1)), l = Math.hypot(b.x - a.x, b.y - a.y); if (l > 1e-6) dir = {x: (b.x - a.x) / l, y: (b.y - a.y) / l}; }
        if (!dir) {
          let best = 0;
          poly.forEach((a, i) => { const b = poly[(i + 1) % poly.length], l = Math.hypot(b.x - a.x, b.y - a.y); if (l > best) { best = l; dir = {x: (b.x - a.x) / l, y: (b.y - a.y) / l}; } });
        }
        if (!dir) continue;
        const n = {x: -dir.y, y: dir.x}, proj = poly.map(p => p.x * n.x + p.y * n.y), lo = Math.min(...proj), hi = Math.max(...proj),
          width = .016 + hash(seed + index, 7) * .01, count = Math.max(1, Math.round((hi - lo) / width)),
          holding = String(field.holdingId || index), base = Math.floor(hash(seed, holding.length * 131 + holding.charCodeAt(holding.length - 1)) * CROPS.length);
        for (let k = 0; k < count; k++) {
          let piece = clip(poly, -n.x, -n.y, -(lo + (hi - lo) * k / count));
          piece = clip(piece, n.x, n.y, lo + (hi - lo) * (k + 1) / count);
          if (piece.length < 3 || area(piece) < 1e-6) continue;
          const r = hash(seed + index * 97, k), colour = r < .12 ? FALLOW[k % 2] : CROPS[(base + (r < .55 ? 0 : r < .8 ? 1 : 3)) % CROPS.length];
          (strips.get(colour) || strips.set(colour, []).get(colour)).push(d(piece));
          if (k) { const a = clip(poly, n.x, n.y, lo + (hi - lo) * k / count + 1e-7); // balk between strips
            const cut = [], t = lo + (hi - lo) * k / count;
            for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length], dp = p.x * n.x + p.y * n.y - t, dq = q.x * n.x + q.y * n.y - t;
              if (dp < 0 !== dq < 0) { const s = dp / (dp - dq); cut.push({x: p.x + (q.x - p.x) * s, y: p.y + (q.y - p.y) * s}); } }
            if (cut.length >= 2 && a) balks.push(d(cut.slice(0, 2), false)); }
        }
        // Hedged closes near settlements; open furlongs elsewhere keep bare balks.
        if (hash(seed + index, 33) < .38) {
          hedges.push(d(poly));
          for (let i = 0; i < poly.length; i++) {
            const a = poly[i], b = poly[(i + 1) % poly.length], l = Math.hypot(b.x - a.x, b.y - a.y);
            for (let t = .02 + hash(index, i) * .03; t < l; t += .028 + hash(index * 7, i + Math.round(t * 1e3)) * .05)
              hedgeTrees.push({x: a.x + (b.x - a.x) * t / l, y: a.y + (b.y - a.y) * t / l, r: .0028 + hash(index, Math.round(t * 1e4)) * .0022});
          }
        }
      }
      const fields = svg('g', {class: 'atlas-fields', transform: `scale(${1 / scalar})`});
      for (const [colour, paths] of strips) fields.append(svg('path', {d: paths.join(''), fill: colour, 'fill-opacity': .78}));
      fields.append(svg('path', {class: 'atlas-balks', d: balks.join(''), fill: 'none', stroke: '#9c875f', 'stroke-width': .0007, 'stroke-opacity': .55}));
      fields.append(svg('path', {class: 'atlas-field-edges', d: plan.farmland.map(f => d(f.points.map(km))).join(''), fill: 'none', stroke: '#8d7a55', 'stroke-width': .0011, 'stroke-opacity': .6}));
      fields.append(svg('path', {class: 'atlas-hedges', d: hedges.join(''), fill: 'none', stroke: '#7d8b5a', 'stroke-width': .0032, 'stroke-opacity': .65, 'stroke-linejoin': 'round'}));
      fields.append(svg('path', {class: 'atlas-hedge-trees', d: hedgeTrees.map(t => circle(t, t.r)).join(''), fill: '#8f9f6c', stroke: '#5c6845', 'stroke-width': .0005}));
      agriculture.insertBefore(fields, agriculture.firstChild);
    }

    // ---- woodland: deeper greens, inked crowns ----
    for (const node of site.querySelectorAll('.city-local-woodland > path:first-child')) { node.setAttribute('fill', '#c4cd9c'); node.setAttribute('opacity', '.85'); }
    const crownFills = ['#93a671', '#a1b07c', '#86996a'];
    site.querySelectorAll('.city-tree-canopies').forEach((node, i) => { node.setAttribute('fill', crownFills[i % 3]); node.setAttribute('stroke', '#4f5b3c'); node.setAttribute('stroke-opacity', '.55'); });
    for (const node of site.querySelectorAll('.city-tree-shadows')) { node.setAttribute('fill', '#4b5236'); node.setAttribute('opacity', '.22'); }

    // ---- water: engraved lines parallel to the banks ----
    const water = site.querySelector('.city-local-water');
    for (const node of site.querySelectorAll('.city-supply-river,.city-coastal-water,.city-local-lakes path')) node.setAttribute('fill', '#a3c0c0');
    for (const node of site.querySelectorAll('.city-river-outline')) { node.setAttribute('stroke', '#4f7276'); node.setAttribute('stroke-width', '1.1'); }
    for (const node of site.querySelectorAll('.city-riverbank')) { node.setAttribute('fill', '#cfcfaa'); node.setAttribute('opacity', '.9'); }
    if (water && recipe.localSite.channels.length) {
      const lines = [];
      for (const channel of recipe.localSite.channels) {
        const pts = channel.points.map(p => ({...km(p), w: (p.widthMetres || channel.widthMetres || 6) / 1000}));
        for (const k of [1, 2, 3]) for (const sign of [-1, 1]) {
          const run = [];
          for (let i = 0; i < pts.length; i++) {
            const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], l = Math.hypot(b.x - a.x, b.y - a.y) || 1,
              off = pts[i].w / 2 - k * Math.min(.0045, pts[i].w * .14);
            if (off <= pts[i].w * .12) { if (run.length > 1) lines.push({pts: run.slice(), k}); run.length = 0; continue; }
            run.push({x: pts[i].x - (b.y - a.y) / l * off * sign, y: pts[i].y + (b.x - a.x) / l * off * sign});
          }
          if (run.length > 1) lines.push({pts: run, k});
        }
      }
      const g = siteFrame({class: 'atlas-water-lines', fill: 'none', 'stroke-linecap': 'round'});
      for (const k of [1, 2, 3]) g.append(svg('path', {d: lines.filter(l => l.k === k).map(l => d(l.pts, false)).join(''), stroke: '#5f878b',
        'stroke-width': .00045, 'stroke-opacity': [0, .5, .32, .18][k], 'stroke-dasharray': k === 1 ? undefined : `${.012 * k} ${.004 * k}`}));
      water.append(g);
    }

    const arid = ['lime', 'earth'].includes(plan.character.material?.name) || ['west-asian', 'mesopotamian'].includes(plan.character.monumentTradition);
    // ---- roads: earthen country roads, packed urban streets ----
    const roads = site.querySelector('.city-external-roads');
    if (roads) {
      const paths = roads.querySelectorAll('path');
      paths.forEach((node, i) => node.setAttribute('stroke', i % 2 === 0 ? '#9a8058' : '#e8d9b4'));
    }
    for (const node of city.querySelectorAll('.city-street-edges')) node.setAttribute('stroke', '#a08860');
    for (const node of city.querySelectorAll('.city-streets')) node.setAttribute('stroke', '#efe4c9');
    for (const node of city.querySelectorAll('.city-field-tracks')) { node.setAttribute('stroke', '#a58e63'); node.setAttribute('stroke-dasharray', '.004 .003'); }
    for (const node of city.querySelectorAll('.city-country-lanes')) node.setAttribute('stroke', '#e6d6b0');
    for (const node of city.querySelectorAll('.city-street-ground')) node.setAttribute('fill', '#e9dfc4');
    for (const node of city.querySelectorAll('.city-block')) {
      const kind = [...node.classList].find(c => c.startsWith('city-block-'))?.slice(11);
      if (['old-town', 'residential', 'planned-extension', 'warehouse', 'industrial'].includes(kind)) node.setAttribute('fill', arid ? '#cbb68a' : '#ddd6b5');
    }
    if (arid) for (const node of city.querySelectorAll('.city-street-ground')) node.setAttribute('fill', '#dac6a0');

    // ---- burgage fences and garden trees behind the street frontages ----
    const geometry = city.querySelector('.city-geometry'), buildingsNode = city.querySelector('.city-buildings');
    if (geometry && buildingsNode && plan.buildings.length) {
      const fences = [], trees = [];
      const blocks = plan.blocks.filter(b => ['old-town', 'residential', 'planned-extension'].includes(b.kind)).map(b => b.points.map(km));
      for (const [i, b] of plan.buildings.entries()) {
        if (!b.frontage || b.courtyard || b.perimeter || ['factory', 'warehouse'].includes(b.kind)) continue;
        const pts = b.points.map(km), road = km(b.frontage.roadPoint), c = centroid(pts);
        let away = {x: c.x - road.x, y: c.y - road.y}; const l = Math.hypot(away.x, away.y); if (l < 1e-6) continue;
        away = {x: away.x / l, y: away.y / l};
        const rear = pts.map(p => ({p, s: (p.x - c.x) * away.x + (p.y - c.y) * away.y})).sort((a, z) => z.s - a.s).slice(0, 2).map(e => e.p);
        const reach = .008 + hash(seed + i, 3) * .014;
        for (const p of rear) fences.push(d([p, {x: p.x + away.x * reach, y: p.y + away.y * reach}], false));
        if (hash(seed + i, 5) < .55) {
          const t = {x: (rear[0].x + rear[1].x) / 2 + away.x * reach * (.45 + hash(i, 9) * .4), y: (rear[0].y + rear[1].y) / 2 + away.y * reach * (.45 + hash(i, 9) * .4)};
          trees.push({...t, r: .0018 + hash(i, 11) * .0016});
        }
      }
      const inBlock = t => blocks.some(poly => inside(poly, t));
      const garden = cityFrame({class: 'atlas-burgage'});
      garden.append(svg('path', {class: 'atlas-garden-trees', d: trees.filter(inBlock).map(t => circle(t, t.r)).join(''), fill: '#9aab78', stroke: '#5c6845', 'stroke-width': .0004}));
      garden.append(svg('path', {class: 'atlas-burgage-fences', d: fences.join(''), fill: 'none', stroke: '#8f7a55', 'stroke-width': .00035, 'stroke-opacity': .7}));
      geometry.insertBefore(garden, buildingsNode);
    }
    // Buildings: inked outlines and a deeper drop shadow.
    for (const node of city.querySelectorAll('.city-building,.city-landmark,.city-country-houses')) { node.setAttribute('stroke', INK); node.setAttribute('stroke-opacity', '.8'); }
    for (const node of city.querySelectorAll('.city-building-shadows,.city-landmark-shadows')) node.setAttribute('fill', '#3f3424');

    // ---- fortifications: stone, crenellations, round towers with conical roofs ----
    const forts = city.querySelector('.city-fortifications');
    if (forts && (plan.walls.length || plan.innerWalls.length)) {
      const european = ['timber-frame', 'stone-masonry', 'terraced', 'canal-side', 'vernacular-mixed', 'arcaded'].includes(plan.character.style);
      const widthKm = (plan.streetWidths.collector * 2.6) * scalar, merlons = [], center = {x: 0, y: 0};
      for (const wall of [...plan.walls, ...plan.innerWalls]) {
        for (let i = 1; i < wall.length; i++) {
          const a = km(wall[i - 1]), b = km(wall[i]), l = Math.hypot(b.x - a.x, b.y - a.y); if (l < .004) continue;
          const u = {x: (b.x - a.x) / l, y: (b.y - a.y) / l}; let n = {x: -u.y, y: u.x};
          const mid = {x: (a.x + b.x) / 2, y: (a.y + b.y) / 2};
          if ((mid.x - center.x) * n.x + (mid.y - center.y) * n.y < 0) n = {x: -n.x, y: -n.y};
          const off = widthKm / 2, depth = Math.min(.0012, widthKm * .22), step = .0052, size = .0019;
          for (let t = step / 2; t < l - size; t += step) {
            const p = {x: a.x + u.x * t + n.x * off, y: a.y + u.y * t + n.y * off};
            merlons.push(d([p, {x: p.x + u.x * size, y: p.y + u.y * size}, {x: p.x + u.x * size - n.x * depth, y: p.y + u.y * size - n.y * depth}, {x: p.x - n.x * depth, y: p.y - n.y * depth}]));
          }
        }
      }
      const g = cityFrame({class: 'atlas-fortification'});
      g.append(svg('path', {class: 'atlas-merlons', d: merlons.join(''), fill: '#a8987a', stroke: '#5b4d3b', 'stroke-width': .00018}));
      if (european) {
        const towers = svg('g', {class: 'atlas-round-towers'}), bodies = [], roofs = [], ribs = [], shades = [];
        for (const [i, tower] of plan.towers.entries()) {
          const pts = tower.points.map(km), c = centroid(pts), r = Math.max(...pts.map(p => Math.hypot(p.x - c.x, p.y - c.y))) * .92;
          bodies.push(circle(c, r)); roofs.push(circle(c, r * .78));
          shades.push(d(Array.from({length: 13}, (_, k) => ({x: c.x + Math.cos(Math.PI * (.25 + k / 12)) * r * .78, y: c.y + Math.sin(Math.PI * (.25 + k / 12)) * r * .78})).concat([c])));
          for (let k = 0; k < 8; k++) ribs.push(d([c, {x: c.x + Math.cos(k * Math.PI / 4 + i) * r * .78, y: c.y + Math.sin(k * Math.PI / 4 + i) * r * .78}], false));
        }
        towers.append(svg('path', {d: bodies.join(''), fill: '#c9bb98', stroke: INK, 'stroke-width': .0006}));
        towers.append(svg('path', {d: roofs.join(''), fill: '#a75f45', stroke: '#5a3526', 'stroke-width': .0004}));
        towers.append(svg('path', {d: shades.join(''), fill: '#4a2a1d', opacity: .28}));
        towers.append(svg('path', {d: ribs.join(''), fill: 'none', stroke: '#e3c3a2', 'stroke-width': .00025, opacity: .7}));
        g.append(towers);
        for (const node of forts.querySelectorAll('.city-wall-towers,.city-tower-roofs')) node.setAttribute('display', 'none');
      }
      forts.append(g);
      for (const node of forts.querySelectorAll('[class$="-walls"]')) node.setAttribute('stroke', INK);
      forts.querySelectorAll('[class$="-walls-material"] > path:nth-child(2)').forEach(node => node.setAttribute('stroke', '#cfc29f'));
      for (const node of forts.querySelectorAll('.city-wall-material-joints')) node.setAttribute('opacity', '.28');
      for (const node of forts.querySelectorAll('.city-gatehouses path:nth-child(2),.city-barbicans path:last-child')) node.setAttribute('stroke', '#e6d7b2');
      for (const node of forts.querySelectorAll('.city-gatehouses path:first-child')) { node.setAttribute('fill', '#bfae88'); node.setAttribute('stroke', INK); }
    }

    // ---- bridges: timber or stone decks with inked parapets ----
    for (const node of site.querySelectorAll('.city-bridge-deck')) node.setAttribute('stroke', node.dataset.bridgeKind === 'rail' ? '#cfc5ad' : '#dfd0ab');
    site.querySelectorAll('.city-local-bridges > path').forEach(node => { if (node.getAttribute('stroke') === '#727e77' || node.getAttribute('stroke') === WorldAtlasCityCharacter.mapPalette.roadEdge) node.setAttribute('stroke', INK); });
    for (const node of container.querySelectorAll('.city-harbor-access-surface,.city-harbor-road-surfaces path')) if (/^#f/i.test(node.getAttribute('stroke') || '')) node.setAttribute('stroke', '#ece0c1');

    // Any leftover paper-white surfaces (gate passages, quays) become packed earth.
    const whites = new Set(['#fff9eb', '#fff8e9', '#fffdf7', '#fffefa', '#fffdf5', '#f4ead4', '#f7efd9']);
    for (const node of container.querySelectorAll('path,circle,rect')) {
      if (node.closest('.city-railways')) continue;
      const stroke = (node.getAttribute('stroke') || '').toLowerCase(), fill = (node.getAttribute('fill') || '').toLowerCase();
      if (whites.has(stroke)) node.setAttribute('stroke', '#eadcb8');
      if (whites.has(fill)) node.setAttribute('fill', '#eadcb8');
    }

    // ---- labels: serif ink on a parchment halo ----
    for (const node of container.querySelectorAll('[data-city-screen-label]')) {
      node.setAttribute('font-family', '"Songti SC","STSong","Noto Serif SC","SimSun",serif');
      if (!node.closest('.city-harbor')) node.setAttribute('fill', node.dataset.featureKind === 'road' ? '#6d5a40' : node.dataset.featureKind === 'river' ? '#3f6a72' : '#3e3124');
      node.setAttribute('stroke', '#f1e9d3');
    }
  }

  // A paper-grain overlay generated once; multiplied over the map.
  let grainUrl = null;
  function grain(viewport) {
    if (viewport.querySelector('.atlas-grain')) return;
    if (!grainUrl) {
      const c = document.createElement('canvas'); c.width = c.height = 256;
      const x = c.getContext('2d'), img = x.createImageData(256, 256);
      for (let i = 0; i < 256 * 256; i++) {
        const fibre = (Math.sin(i * .013) + Math.sin(i * .0071 + 2)) * 6, v = 226 + (hash(i, 77) - .5) * 44 + fibre;
        img.data.set([v, v - 6, v - 18, 255], i * 4);
      }
      x.putImageData(img, 0, 0); grainUrl = c.toDataURL('image/png');
    }
    const layer = document.createElement('div'); layer.className = 'atlas-grain'; layer.setAttribute('aria-hidden', 'true');
    layer.style.backgroundImage = `url(${grainUrl})`;
    const canvas = viewport.querySelector('svg');
    if (canvas) canvas.after(layer); else viewport.prepend(layer);
  }

  global.WorldAtlasCityStyle = Object.freeze({apply, grain});
})(window);
