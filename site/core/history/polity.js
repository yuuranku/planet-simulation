/* 政权推演（第三阶段）：在区块图上逐十年推演国家的兴起、争霸、统一、分裂、改朝换代、复国与外族入主，
 * 最后一段把推演结果对账到现在的国家（最后一年的疆域严格等于现在）。首都与战争反过来影响城市人口。
 *  - 国力 = 领土上各区块的人口 × 发展阶段，乘以凝聚力；投送到目标区块时随离首都的距离衰减（距离尺度随时代变大）；
 *  - 每个时代有规模上限（城邦 1–2 块、王国十来块、帝国几十块）；超出上限、统治异族、王朝老去都会消磨凝聚力；
 *  - 凝聚力耗尽：大国分裂（分出去的国家对母国故土持有法统宣称），小国改朝换代；
 *  - 统治满 150 年的区块成为该国统（lineage）的核心；夺回已亡之国大部分核心且同文明 → 复国；
 *  - 游牧政权攻下农耕大国的都城 → 外族入主，整国易主；
 *  - 终局对账：按重叠找每个现存国家的前身（继承者），没有前身的在晚期独立或兴起；各区块按离继承者核心由近到远依次易手。
 * 事件先记下参与者，等全部推演完、沿世系起好名字后再生成文字。 */
(function (G) {
  'use strict';
  const TICK = 10;
  const THEOCRACY_TYPE = { monotheist:1.5, dualist:1.3, dharmic:1.2, polytheist:1, ancestral:0.6, shamanic:0.6, philosophy:0.3 };
  function theocracyProbability(religion, style) {
    return Math.min(1, 0.03 * (THEOCRACY_TYPE[religion.type] || 1) * (style === 'temple' ? 2 : 1) * G.HumanRules.multiplier(G.HumanRules.effects(religion).theocracyChance));
  }
  function attemptTheocracy(polity, faith, religion, year, style, roll) {
    if (roll >= theocracyProbability(religion, style)) return false;
    polity.theo = year; polity.theoRel = faith; return true;
  }
  const rulingCultureAt = (q, y) => q.settled !== undefined && q.settledCiv !== undefined && q.settledCiv !== -1 && y >= q.settled ? q.settledCiv : q.civ;
  function cultureRollbackLimit(history, year, culture) {
    let current = -1, since = -Infinity;
    for (let i = 0; i < history.length && history[i] <= year; i += 2) { since = history[i]; current = history[i + 1]; }
    return current === culture && Number.isFinite(since) ? Math.max(0, year - since) : null;
  }
  function datedName(names, year) { let value = null; for (const entry of names) { if (entry[0] > year) break; value = entry; } return value; }
  function drawRulingName(lib, kind, used, rnd) {
    if (lib.unnamed) return kind === 'state' ? '未命名政权' : kind === 'city' ? '未命名城邑' : '未命名地区';
    const key = kind === 'state' ? 'states' : kind === 'city' ? 'cities' : 'provinces';
    for (const name of (lib.n && lib.n[key]) || []) if (name && !used.has(name)) { used.add(name); return name; }
    const source = kind === 'state' && lib.c && Array.isArray(lib.c.prefixes) ? { ...lib, c: { ...lib.c, prefixes: lib.c.prefixes.filter(x => !x.startsWith('后')) } } : lib;
    return G.NameGen.make(source, kind, used, rnd);
  }
  function advancePlaceName(state, year, civ, owner, firstKind, libKeyOf, draw) {
    const key = libKeyOf(civ);
    if (state.names.length && state.key === key) return;
    const name = draw(civ);
    state.names.push([year, name, state.names.length ? 'alien' : firstKind, owner]);
    state.key = key;
  }
  function splitStateName(child, parent, libKeyOf, cx, cy, width, used) {
    if (!parent || libKeyOf(child.civ) !== libKeyOf(parent.civ) || !parent.short || parent.short.length > 2 || /^[东西南北后新]/.test(parent.short)) return null;
    const dx0 = cx[child.cap] - cx[parent.cap], dx = Math.abs(dx0) > width ? -dx0 : dx0, dy = cy[child.cap] - cy[parent.cap];
    const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? '东' : '西') : (dy > 0 ? '南' : '北'), name = dir + parent.short;
    if (used.has(name)) return null;
    used.add(name); return { short: name, bare: parent.bare || parent.short };
  }
  function inheritedStateName(q, polities, year, libKeyOf, cx, cy, width, used, restoration) {
    const pa = restoration ? q.parents.find(x => x.kind === 'restore' && q.restoreYear !== undefined && year >= q.restoreYear) : q.parents.find(x => x.kind === 'dynasty') || q.parents.find(x => x.kind === 'restore' && q.restoreYear !== undefined && year >= q.restoreYear) || q.parents.find(x => x.kind === 'split' || x.kind === 'secede');
    if (!pa || !polities[pa.id]) return null;
    const A = polities[pa.id], prev = datedName(A.names, year), prior = rulingCultureAt(A, Math.min(year, A.died === null ? year : A.died)), civ = rulingCultureAt(q, year);
    if (!prev || libKeyOf(prior) !== libKeyOf(civ)) return null;
    if (pa.kind === 'dynasty') return { short: prev[1], bare: prev[2] };
    if (pa.kind === 'restore' && prev[1].length <= 2 && !used.has('后' + prev[1])) { used.add('后' + prev[1]); return { short: '后' + prev[1], bare: prev[2] }; }
    if (pa.kind === 'split' || pa.kind === 'secede') return splitStateName({civ,cap:q.cap}, {civ:prior,cap:A.cap,short:prev[1],bare:prev[2]}, libKeyOf, cx, cy, width, used);
    return null;
  }
  function buildDynastyHouses(q, polities, libAt, rnd, CE) {
    q.houses = [];
    const cultureAt = y => rulingCultureAt(q, y), culture = cultureAt(q.born), X = CE.ext(libAt(q, q.born));
    const S = X.people.surnames, rp = q.parents.find(x => x.kind === 'restore' && q.restoreYear !== undefined && q.restoreYear <= q.born), dp = q.parents.find(x => x.kind === 'dynasty');
    const parent = rp && polities[rp.id], prior = parent && datedName(parent.houses || [], q.born), inherited = !!(prior && culture !== -1 && rulingCultureAt(parent, Math.min(q.born, parent.died === null ? q.born : parent.died)) !== -1 && libAt(parent, Math.min(q.born, parent.died === null ? q.born : parent.died)).id === libAt(q, q.born).id);
    const other = (old, pool) => { if (pool.length <= 1) return old && pool.includes(old) ? old : pool[0]; const i = pool.indexOf(old); return i < 0 ? pool[Math.floor(rnd() * pool.length)] : pool[(i + 1 + Math.floor(rnd() * (pool.length - 1))) % pool.length]; };
    let house = inherited ? prior[1] : S[Math.floor(rnd() * S.length)];
    const dynastyParent = dp && polities[dp.id], dynastyPrior = dynastyParent && datedName(dynastyParent.houses || [], q.born);
    if (!rp && dynastyPrior && dynastyPrior[1] === house) house = other(house, S);
    if (culture === -1) house = '未详';
    const formatted = (name, x, c) => q.republic ? '' : c === -1 ? '家族未详' : x.house.replace('{s}', name);
    q.houses.push([q.born, house, inherited ? prior[2] : formatted(house, X, culture), 0, undefined, inherited ? prior[5] : culture, inherited]);
    const Dy = q.dyn || []; for (let i = 0; i < Dy.length; i += 2) { const year = Dy[i], civ = cultureAt(year), x = CE.ext(libAt(q, year)), pool = x.people.surnames, recent = new Set(q.houses.slice(-3).map(v => v[1])); let next = other(house, pool); for (let t = 0; t < 6 && recent.has(next); t++) next = other(house, pool); house = civ === -1 ? '未详' : next; q.houses.push([year, house, formatted(house, x, civ), Dy[i + 1], undefined, civ, false]); }
    q.house = house; q.houseName = q.houses[q.houses.length - 1][2];
  }
  function buildDynastyRulers(q, context) {
    const { CE, libAt, rnd, accessionRnd, end, govKey, formAt, religions, regCount, firstOf } = context;
    q.rulers = []; q.gov = []; if (end < q.born) return;
    const HS = q.houses; let hk = 0, house = HS[0][1];
    const years = new Set(q.rulingCulture.map(x => x[0]).filter(y => y >= q.born && y <= end)); if (q.settled !== undefined && q.settled >= q.born && q.settled <= end) years.add(q.settled); for (let y = q.born; y <= end; y += 20) years.add(y);
    let last = ''; for (const year of [...years].sort((a,b) => a-b)) { const k = govKey(q, year), civ = rulingCultureAt(q, year), X = CE.ext(libAt(q, year));
      const label = civ === -1 ? '制度未详' : (X.gov.org && X.gov.org[k]) || k, style = civ === -1 ? null : context.governmentStyle ? context.governmentStyle(q, year, X) : X.gov.style, marker = JSON.stringify([k,label,style]);
      if (marker !== last) { q.gov.push([G.HistoryDate.ceil(year), label, k, style]); last = marker; } }
    const RKEY = { rebel:'rebel',theo:'theo',republic:'republic',vassal:'vassal',nomad:'nomad',chief:'chief',city:'city',central:'king',feudal:'king',empire:'empire',king:'king' };
    let y = q.born, idx = 0; if (!regCount.has(q.lin)) regCount.set(q.lin, new Map()); const RC = regCount.get(q.lin);
    while (y < end || idx === 0) { const year = Math.min(end, G.HistoryDate.ceil(y)); while (hk + 1 < HS.length && year >= HS[hk + 1][0]) house = HS[++hk][1];
      const k = govKey(q, year), rep = k === 'republic', civ = rulingCultureAt(q, year), lib = libAt(q, year), X = CE.ext(lib);
      let len = rep ? 4 + rnd() * 8 : k === 'rebel' ? 15 + rnd() * 30 : 6 + rnd() * rnd() * 48;
      if (hk + 1 < HS.length && y + len > HS[hk + 1][0]) len = Math.max(1, HS[hk + 1][0] - y);
      let nm = CE.personName(lib, rnd, { surname: rep || k === 'rebel' ? undefined : house }); if (X.regnal !== 'number') for (let t = 0; t < 6 && q.rulers.slice(-8).some(r => r[1].endsWith(nm.given)); t++) nm = CE.personName(lib, rnd, { surname: rep || k === 'rebel' ? undefined : house });
      let disp;
      if (civ === -1) disp = '姓名未详';
      else if (rep || k === 'rebel') disp = X.regnal === 'number' ? nm.given : nm.surname + nm.given;
      else if (X.regnal === 'number') { const nameKey = lib.id + ':' + nm.given, c = (RC.get(nameKey) || 0) + 1; RC.set(nameKey, c); disp = nm.given + (c >= 2 ? CE.NUM[Math.min(15, c)] : ''); if (c === 1) firstOf.set(q.lin + ':' + nameKey, [q.rulers, q.rulers.length]); else if (c === 2) { const f0 = firstOf.get(q.lin + ':' + nameKey); if (f0) f0[0][f0[1]][1] += CE.NUM[1]; } }
      else if (X.regnal === 'temple') disp = (CE.TEMPLE[idx] || '') + ' ' + nm.surname + nm.given;
      else disp = (X.family === 'japanese' && nm.surname !== '未详' ? nm.surname : '') + nm.given;
      const fm = formAt(q, year), title = k === 'theo' ? ((q.theoRel >= 0 && religions[q.theoRel] && religions[q.theoRel].clergy && religions[q.theoRel].clergy.ruler) || (civ === -1 ? '统治者' : X.ruler.king)) : civ === -1 ? '统治者' : (k === 'central' || k === 'feudal' || k === 'king' || k === 'empire' || (k === 'nomad' && fm === 'empire') ? (fm === 'empire' ? (k === 'nomad' && X.ruler.nomadEmpire ? X.ruler.nomadEmpire : X.ruler.empire) : X.ruler.king) : X.ruler[RKEY[k]]) || X.ruler.king;
      // 上位方式是模拟数据：家族更替使用真实事件，普通王位交接才可能发生弑君。
      const previous = q.rulers[q.rulers.length - 1], newHouse = previous && previous[3] !== hk;
      let accession;
      if (!previous) {
        const origin = q.parents[0]?.kind;
        accession = k === 'rebel' ? 'revolt' : q.foundingHow === 'coup' ? 'coup' : q.foundingHow === 'revolution' ? 'revolution' : origin === 'dynasty' ? 'dynasty' : origin === 'split' || origin === 'secede' ? 'independence' : 'founder';
      } else if (newHouse) accession = HS[hk][3] ? 'coup' : 'dynasty';
      else if (k === 'republic') accession = 'office';
      else if (k === 'rebel') accession = 'rebelSuccession';
      else if (k === 'theo') accession = 'religiousSuccession';
      else if (previous[0] < year) {
        const roll = accessionRnd();
        if (roll < .04) { accession = 'regicide'; previous[7] = 'murdered'; }
        else if (roll < .08) { accession = 'usurp'; previous[7] = 'deposed'; }
        else accession = 'inherit';
      } else accession = 'inherit';
      q.rulers.push([year, disp.trim(), title, hk, civ, civ === -1 ? '姓名未详' : nm.given, accession, null]); y += len; idx++; if (idx > 400) break;
    }
    if (q.died !== null && q.rulers.length > 1 && q.children.some(c => c.kind === 'conquer')) {
      const L = q.rulers[q.rulers.length - 1], civ = L[4], X = CE.ext(libAt(q, L[0])), kind = govKey(q, L[0]);
      if (civ !== -1 && X.regnal === 'temple' && kind !== 'rebel' && kind !== 'republic') {
        // Only replace an actual temple title; later rulers may have no prefix.
        const temple = CE.TEMPLE.find(t => L[1].startsWith(t + ' '));
        L[1] = '末帝 ' + (temple ? L[1].slice(temple.length + 1) : L[1]);
      }
    }
  }
  function alignCultureYear(original, refined, year, proposed) {
    let i = 0; for (let k = 1; k < original.length && original[k][0] <= year; k++) i = k;
    const lo = refined[i][0], hi = i + 1 < refined.length ? refined[i + 1][0] - 1 : Infinity;
    return Math.max(lo, Math.min(hi, proposed));
  }
  function historicalCores(heldRegions, coreLin, lin) { return [...heldRegions].filter(r => coreLin[r] === lin); }
  // 故国必须在新政权建立前已亡，且不能是其后代；复国时必须实际占有其核心。
  function linkRestoration(polities, childId, targetId, year, owner, minShare) {
    const child = polities[childId], target = polities[targetId];
    if (!child || !target || child.id !== childId || target.id !== targetId || childId === targetId ||
        child.died !== null || child.born > year || child.restoreOf !== undefined || target.restored ||
        target.died === null || target.died >= child.born || target.born > target.died || !owner || !target.coreAtDeath || !target.coreAtDeath.length) return false;
    let regained = 0; for (const r of target.coreAtDeath) if (owner[r] === childId) regained++;
    if (regained < 1 || regained < minShare * target.coreAtDeath.length) return false;
    const pending = [targetId], seen = new Set();
    while (pending.length) {
      const id = pending.pop();
      if (id === childId) return false;
      if (seen.has(id)) continue;
      seen.add(id);
      const state = polities[id];
      if (state) for (const parent of state.parents) pending.push(parent.id);
    }
    target.restored = true; child.restoreOf = targetId; child.restoreYear = year; child.restoreRegions = target.coreAtDeath.filter(r => owner[r] === childId);
    child.parents.push({ id: targetId, kind: 'restore' });
    target.children.push({ id: childId, kind: 'restore' });
    return true;
  }
  const SFV = [0, 0.15, 0.35, 0.7, 1, 1.3, 1.45, 1.8, 2.4];          // 各阶段的区块价值（相对人口）
  const REACH = [0, 60, 120, 260, 600, 1300, 1000, 2100, 3400];     // 各阶段首都的投送距离尺度（km）
  const CAP = [0, 0, 1, 2, 9, 34, 24, 46, 70];                      // 各阶段的规模上限（区块数，按世界大小缩放）
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  function mulberry32(a) { return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  // 以城邑、海岸和地形选择少数区域，形成连续的地方政治中心。
  function regionalFragmentation(R, cityIn, eSea, kmBetween) {
    const nR = R.nR, candidates = [];
    for (let r = 1; r <= nR; r++) {
      if (!(R.weight[r] > 0) || R.civ[r] < 0 || R.newW[r] > .5 || R.pasture[r] > .45 || R.arid[r] > .55) continue;
      const local = [r], seen = new Set(local); let end = 1;
      for (let depth = 0, begin = 0; depth < 2; depth++) {
        const next = local.length;
        for (let i = begin; i < end; i++) for (let k = R.off[local[i]]; k < R.off[local[i] + 1]; k++) {
          const b = R.nbr[k]; if (!eSea[k] && !seen.has(b)) { seen.add(b); local.push(b); }
        }
        begin = next; end = local.length;
      }
      let cities = 0, coast = 0, rough = 0;
      for (const b of local) { if (cityIn[b].length) cities++; coast += R.coast[b]; rough += Math.min(1, R.eN[b] * 2 + R.slope[b] * 8); }
      if (cities < 3) continue;
      const score = cities * (1 + .55 * coast / local.length + .45 * rough / local.length) * (.7 + .3 * R.hab[r]);
      candidates.push({r, score});
    }
    candidates.sort((a,b) => b.score - a.score || a.r - b.r);
    const anchors = [];
    for (const c of candidates) {
      if (anchors.every(a => R.landComp[a] !== R.landComp[c.r] || kmBetween(a, c.r) >= 2200)) anchors.push(c.r);
      if (anchors.length >= 2) break;
    }
    const field = new Float32Array(nR + 1);
    for (let r = 1; r <= nR; r++) for (const a of anchors) if (R.landComp[r] === R.landComp[a]) {
      const d = kmBetween(a, r) / 850; field[r] = Math.max(field[r], Math.exp(-d * d));
    }
    return field;
  }

  function run(h, R, D, C, opt) {
    const { NN, E, Y } = D, nR = R.nR, rnd = mulberry32((h.seed | 0) + 7777);
    const scale = clamp(nR / 1400, 0.6, 3);
    const targetCountries = opt.targetCountries;
    if (!Number.isInteger(targetCountries) || targetCountries < 1) throw new Error('国家数量目标无效');
    const targetTribal = opt.targetTribal;
    if (!Number.isFinite(targetTribal) || targetTribal < 0 || targetTribal > 1) throw new Error('非国家比例目标无效');
    let inhabitableRegions = 0, inhabitedArea = 0;
    for (let r=1; r<=nR; r++) if (R.weight[r]>0) inhabitableRegions++;
    for (let i=0; i<h.N; i++) if (R.regionOf[i]>0 && h.weight[i]>0) inhabitedArea += h.area[Math.floor(i/h.W)];
    const regionsPerCountry = inhabitableRegions * (1-targetTribal) / targetCountries;
    const geographicScale = clamp(Math.sqrt(inhabitedArea * (1-targetTribal) / targetCountries / 1200000), 0.8, 2.5);
    // 目标是近似数量；每个世界从较窄范围中确定稳定的规模，历史继续自然演化。
    const countryVariation = Math.min(8, Math.floor(targetCountries / 10));
    const countryLimit = Math.max(1, targetCountries + Math.floor(mulberry32((h.seed | 0) + 48107)() * (countryVariation + 1)));
    const center = R.center;
    // 区块中心的三维单位向量：两点间距离用弦长近似（比格距函数快得多）
    const UX = new Float64Array(nR + 1), UY = new Float64Array(nR + 1), UZ = new Float64Array(nR + 1);
    for (let r = 1; r <= nR; r++) { const lon = R.cx[r] / (2 * h.W) * 2 * Math.PI, lat = (0.5 - R.cy[r] / (2 * h.H)) * Math.PI; UX[r] = Math.cos(lat) * Math.cos(lon); UY[r] = Math.cos(lat) * Math.sin(lon); UZ[r] = Math.sin(lat); }
    const kmBetween = (a, b) => { const dx = UX[a] - UX[b], dy = UY[a] - UY[b], dz = UZ[a] - UZ[b]; return Math.sqrt(dx * dx + dy * dy + dz * dz) * h.R; };
    const stageAt = (r, y) => { let s = 0; for (let k = 1; k <= 8; k++) if (Y[k * NN + r] <= y) s = k; else break; return s; };
    const cultAt = (r, y) => { const a = D.ancientOf[r]; if (a >= 0 && y < D.ancientEnd[r]) return -2 - a; if (R.civ[r] >= 0 && y >= D.civArr[r]) return R.civ[r]; return -1; };
    // 游牧部族主要迁入适合放牧的草原；进入农耕区、荒漠绿洲的多是统治者而非整个部族，那里的人多半保持原有文明
    // 定居后沿用的文明：优先所在地的农耕文明（原住民的称号与官制），都没有才沿用本族
    const settleCivOf = (r, own) => { const c = cult[r]; return c !== -1 && c !== undefined && typeOfCult(c) !== 'pastoral' ? c : own; };
    const rndN = mulberry32((h.seed | 0) + 9191); // 独立随机流：建国时的游牧倾向
    const pastureFit0 = r => clamp((R.pasture[r] - 0.3) / 0.5, 0, 1);
    const nomadAt = (q, y) => !!q.nomad && !(q.settled !== undefined && (y === undefined || y >= q.settled));
    const pastureFit = r => clamp((R.pasture[r] - 0.12) / 0.43, 0.3, 1);
    // 草原：适合放牧的区块。前近代的农耕国家难以实控草原——深入草原补给难、牧民随畜迁徙不服编户，多以羁縻、册封为藩属；火器与常备军普及后才能直辖
    const isSteppe = r => R.pasture[r] >= 0.45;
    const civOfNew = r => cult[r]; // 本地建国只承认当年实际形成的文明；无文明居民保持无主部族。
    const civilized = c => Number.isInteger(c) && (c >= 0 ? !!h.civLib[c] : c <= -2 && !!D.ancient[-2 - c]?.libObj);
    const styleCache = new Map(); // 文化库的政府组织风格：官僚 / 封建 / 部族 / 商贸 / 神庙
    const succCache = new Map(); // 改朝换代的方式：house 国号不变、只换王朝（西方：安茹 → 金雀花 → 都铎；拜占庭历代王朝）；state 新朝换国号（汉 → 唐）
    function succOf(cu) { if (succCache.has(cu)) return succCache.get(cu); const lib = cu >= 0 ? h.civLib[cu] : cu <= -2 ? D.ancient[-2 - cu].libObj : null; const s = lib && G.CultureExt ? (G.CultureExt.ext(lib).succession || 'state') : 'state'; succCache.set(cu, s); return s; }
    function styleOf(cu) { if (styleCache.has(cu)) return styleCache.get(cu); const lib = cu >= 0 ? h.civLib[cu] : cu <= -2 ? D.ancient[-2 - cu].libObj : null; const st = lib && G.CultureExt ? G.CultureExt.ext(lib).gov.style : 'feudal'; styleCache.set(cu, st); return st; }
    const typeOfCult = cu => cu >= 0 ? D.civType[cu] : cu <= -2 ? D.ancient[-2 - cu].type : 'tribal';
    // 政权的统治方式看它统治的土地，不看出身：游牧部族入主农耕之地定居后，沿用当地的官制，没有可依的就行封建（匈牙利人、北魏、沙陀诸朝）
    const polStyle = q => { if (q.settled === undefined || typeOfCult(q.civ) !== 'pastoral') return styleOf(q.civ); const s = q.settledCiv; return s !== undefined && s !== -1 && typeOfCult(s) !== 'pastoral' ? styleOf(s) : 'feudal'; };
    let wsum = 0; for (let r = 1; r <= nR; r++) wsum += R.weight[r]; const wmean = wsum / nR || 1;
    // 城市（含古城）按区块
    const cityIn = Array.from({ length: nR + 1 }, () => []); C.cities.forEach((c, i) => { if (c.r && !c.fort) cityIn[c.r].push(i); });
    const nT = C.popN, popAt = (i, y) => { const t = y / C.popStep, j = Math.min(nT - 2, Math.max(0, Math.floor(t))), f = Math.min(1, t - j); return C.pop[i * nT + j] * (1 - f) + C.pop[i * nT + j + 1] * f; };
    const alive = (c, y) => y >= c.founded && !(c.ruined && y >= c.ruined);
    const bigCity = (r, y) => { let b = -1, bp = 0; for (const i of cityIn[r]) { const c = C.cities[i]; if (!alive(c, y)) continue; const p = popAt(i, y); if (p > bp) { bp = p; b = i; } } return b; };
    const administration=G.HistoryAdministration.create({h,R,D,C,routes:opt.routes,admin:Object.assign({},opt.admin,{response:opt.admin.response * geographicScale})});
    let terminalCityPopulation=null;
    const seatPopulation=(i,y)=>y===E&&terminalCityPopulation?terminalCityPopulation[C.cities[i].idx]||0:popAt(i,y);
    const seatCity=(r,y)=>administration.city(r,y,seatPopulation),seatRegion=(regs,y,preferred=-1)=>administration.seat(regs,y,seatPopulation,preferred);
    const regionPop = (r, y) => { let s = 0; for (const i of cityIn[r]) if (alive(C.cities[i], y)) s += popAt(i, y); return s; };
    const eSea = new Uint8Array(R.nbr.length), eRough = new Float32Array(R.nbr.length); for (let k = 0; k < R.nbr.length; k++) { const ed = R.edges[R.eid[k]]; eSea[k] = ed.sea ? 1 : 0; eRough[k] = Math.min(4, ed.rough || 0); }
    const neighbors = (r, fn) => { for (let k = R.off[r]; k < R.off[r + 1]; k++) fn(R.nbr[k], R.edges[R.eid[k]]); };
    const fragmentation = regionalFragmentation(R, cityIn, eSea, kmBetween);

    // ---------- 状态 ----------
    const P = [];                                   // 政权
    // 起义军是军事控制方，独立之前仍计入其反叛的国家。
    const activeCountryActors = new Map();
    function trackCountry(q, delta) {
      const id = q.rebel ? q.target : q.id, count = (activeCountryActors.get(id) || 0) + delta;
      if (count < 0) throw new Error('国家与起义军计数不一致');
      if (count) activeCountryActors.set(id, count); else activeCountryActors.delete(id);
    }
    const countrySlots = () => Math.max(0, countryLimit - activeCountryActors.size);
    const owner = new Int32Array(nR + 1).fill(-1);
    const linOwnSince = new Float64Array(nR + 1), coreLin = new Int32Array(nR + 1).fill(-1);
    const log = [];                                 // [region, year, owner]
    const events = [];                              // 先记参与者，后生成文字
    const sacks = [];                               // [city, year, severity]
    let linSeq = 0;
    const ev = (year, kind, o) => events.push(Object.assign({ year: G.HistoryDate.ceil(year), kind }, o));
    // ---------- 省份：以“现在的省”为积木（区块不跨现在的省界），历史上的省由若干积木拼成 ----------
    const presentProv = opt.provinces || [], nPP = presentProv.length;
    const unitOf = new Int32Array(nR + 1).fill(-1); let nU = nPP;
    for (let r = 1; r <= nR; r++) if (R.prov[r] >= 0) unitOf[r] = R.prov[r];
    for (let r = 1; r <= nR; r++) { if (unitOf[r] >= 0 || R.weight[r] <= 0) continue; const u = nU++, q = [r]; unitOf[r] = u; // 边疆：同一分区里 4 块一组
      for (let i = 0; i < q.length && q.length < 4; i++) for (let k = R.off[q[i]]; k < R.off[q[i] + 1] && q.length < 4; k++) { const b = R.nbr[k]; if (unitOf[b] < 0 && R.weight[b] > 0 && R.zoneOfRegion[b] === R.zoneOfRegion[r]) { unitOf[b] = u; q.push(b); } } }
    const prov = new Int32Array(nR + 1).fill(-1), prevProv = new Int32Array(nR + 1).fill(-1), prevOwner = new Int32Array(nR + 1).fill(-1), occSince = new Float64Array(nR + 1);
    const PV = [], pvLog = [], fromStateMade = new Set();
    const unrest = new Float32Array(nR + 1), cause = new Uint8Array(nR + 1), famine = new Float32Array(nR + 1), tradition = new Uint8Array(nR + 1), memLin = new Int32Array(nR + 1).fill(-1);
    const rndU = mulberry32((h.seed | 0) + 4242), unrestSamples = [], lastFam = new Float64Array(nR + 1).fill(-1e9), calmUntil = new Float64Array(nR + 1);
    // 大航海与殖民：新大陆（与旧大陆隔海、很晚才被卷入的大陆）
    const isNW = r => R.newW[r] > 0.5, nwCoast = []; for (let r = 1; r <= nR; r++) if (isNW(r) && R.coast[r] && R.weight[r] > 0) nwCoast.push(r);
    const rndK = mulberry32((h.seed | 0) + 6161); let colonialAge = null;
    const vuln = new Float32Array(nR + 1); for (let r = 1; r <= nR; r++) vuln[r] = R.weight[r] > 0 ? 0.1 + 0.45 * R.arid[r] + 0.25 * R.semiArid[r] + (R.river[r] >= 3 ? 0.2 : 0) : 0;
    const TS = [0, 0, 0, 0, 4, 4, 4, 3, 1], MAXN = [0, 0, 0, 0, 8, 8, 7, 6, 5]; // 各阶段一省的目标与上限（区块数）
    function setProv(r, v, y) { if (prov[r] === v) return; const old = prov[r]; if (old >= 0) { const X = PV[old]; X.n--;X._rev=(X._rev||0)+1; if (!X.n) X.zeroSince = y; } prov[r] = v; if (v >= 0) {PV[v].n++;PV[v]._rev=(PV[v]._rev||0)+1;} pvLog.push(r, y, v);
      if (old >= 0 && PV[old].seat === r && PV[old].n) { const regs = []; for (let k = 1; k <= nR; k++) if (prov[k] === old) regs.push(k); const seat = seatRegion(regs, y); if(seat<0){PV[old].seat=-1;for(const k of regs)setProv(k,-1,y);}else{PV[old].seat=seat;PV[old].seats.push([y,seat]);PV[old].seatCities.push([y,seatCity(seat,y)]);} }
    }
    function provOwner(v, p, y, kind) { const X = PV[v]; if (X.owner === p) return; const o0 = X.owner; X.owner = p;X._rev=(X._rev||0)+1; X.hist.push(y, p, kind); if ((kind === 'conquer' || kind === 'inherit') && o0 >= 0 && P[o0]) { X.gotAt = y; X.gotCiv = P[o0].civ; X.rdDone = false; } } // 记下易主：新主人日后可能重划
    function newProv(y, p, seat, kind, parents, extra) { const city=seatCity(seat,y);if(city<0)throw Error('建省缺少当年有效治所');const id = PV.length; PV.push(Object.assign({ id, created: y, abolished: null, owner: p, seat, seats: [[y, seat]], seatCities:[[y,city]], kind, parents: parents || [], children: [], n: 0, hist: [y, p, kind], stage: stageAt(seat, y), present: -1, fromState: -1, zeroSince: y }, extra || {}));
      for (const pa of PV[id].parents) if (PV[pa]) PV[pa].children.push(id); return id; }
    const bigRegion = (list, y) => { let b = list[0], bv = -1; for (const r of list) { const v = regionPop(r, y) + R.weight[r] * 1e-3; if (v > bv) { bv = v; b = r; } } return b; };
    // 同一现今省份也可能包含不相邻区块；按陆路连通分量构造积木。
    function connectedUnits(regs) {
      const remaining = new Set(regs), byU = new Map(), unit = new Map(); let id = 0;
      for (const start of regs) { if (!remaining.delete(start)) continue; const group = [start], original = unitOf[start];
        for (let i = 0; i < group.length; i++) for (let k = R.off[group[i]]; k < R.off[group[i] + 1]; k++) { const b = R.nbr[k]; if (!eSea[k] && remaining.has(b) && original >= 0 && unitOf[b] === original) { remaining.delete(b); group.push(b); } }
        byU.set(id, group); for (const r of group) unit.set(r, id); id++;
      }
      return { byU, uOf: r => unit.get(r) };
    }
    function organize(p, y, quiet) { // 初置行省：按大城市把全国的积木拼成若干省
      const own = []; for (let r = 1; r <= nR; r++) if (owner[r] === p) own.push(r);
      const { byU, uOf } = connectedUnits(own);
      const units = [...byU.keys()].sort((a, b) => (regionPop(bigRegion(byU.get(b), y), y)) - (regionPop(bigRegion(byU.get(a), y), y)) || a - b);
      const done = new Set(), ts = TS[Math.max(4, Math.min(8, stageAt(P[p].cap, y)))]; let made = 0;
      for (const u0 of units) { if (done.has(u0)) continue; const grp = [u0]; done.add(u0); let size = byU.get(u0).length;
        for (let i = 0; i < grp.length && size < ts; i++) for (const r of byU.get(grp[i])) { for (let k = R.off[r]; k < R.off[r + 1] && size < ts; k++) { const b = R.nbr[k]; if (owner[b] !== p || eSea[k]) continue; const ub = uOf(b); if (done.has(ub)) continue; done.add(ub); grp.push(ub); size += byU.get(ub).length; } }
        const regs = grp.flatMap(u => byU.get(u)), seat=seatRegion(regs,y);if(seat<0)continue;const v = newProv(y, p, seat, 'establish'); for (const r of regs) setProv(r, v, y); made++; }
      P[p].org = y; if (made >= 2 && !quiet) ev(y, 'organize', { p, n: made, r: P[p].cap });
    }
    function splitProv(v, y, minRegs, why) { // 析置：一省太大（或人口太多），拆出新省（第二大城为治所）
      const X = PV[v], regs = []; for (let r = 1; r <= nR; r++) if (prov[r] === v) regs.push(r); if (regs.length < (minRegs || 4)) return; X.lastSplit = y;
      let s2 = -1, bv = -1; for (const r of regs) { if (r === X.seat || seatCity(r,y)<0) continue; const d = kmBetween(r, X.seat), val = (regionPop(r, y) + 1) * d; if (val > bv) { bv = val; s2 = r; } } if (s2 < 0) return;
      const part = new Map([[X.seat, 0], [s2, 1]]), q = [X.seat, s2]; for (let i = 0; i < q.length; i++) { const a = q[i]; for (let k = R.off[a]; k < R.off[a + 1]; k++) { const b = R.nbr[k]; if (!eSea[k] && prov[b] === v && !part.has(b)) { part.set(b, part.get(a)); q.push(b); } } }
      const nv = newProv(y, X.owner, s2, 'split', [v], why ? { why } : undefined); let moved = 0; for (const r of regs) if (part.get(r) === 1) { setProv(r, nv, y); moved++; }
      if (moved) ev(y, 'provSplit', { pv: v, nv, p: X.owner, r: s2, pop: why === 'pop' });
    }
    // ---------- 重新划省：人口繁盛的省析置新省；接收来的省，新主人（尤其异族）过些年按自己的意思重划，旧省撤销 ----------
    const rndD = mulberry32((h.seed | 0) + 5353); // 独立随机流
    let PCAP = 0; { let s = 0; for (const c of C.cities) if (!c.lost && !c.fort) s += c.final || 0; PCAP = 1.6 * s / Math.max(1, nPP); } // 一省城市人口的上限：今天一个省平均水平的 1.6 倍
    function regroup(list, p, y) {
      const old = new Set(list.map(X => X.id)), regs = []; for (let r = 1; r <= nR; r++) if (old.has(prov[r]) && owner[r] === p) regs.push(r);
      if (regs.length < 2) return false;
      const { byU, uOf } = connectedUnits(regs), inSet = new Set(regs);
      const st = Math.max(4, Math.min(8, stageAt(P[p].cap, y))), ts = Math.max(2, Math.round(TS[st] * (0.8 + 0.7 * rndD())));
      const units = [...byU.keys()].sort((a, b) => regionPop(bigRegion(byU.get(b), y), y) - regionPop(bigRegion(byU.get(a), y), y) || a - b);
      const done = new Set(), groups = [];
      for (const u0 of units) { if (done.has(u0)) continue; const grp = [u0]; done.add(u0); let size = byU.get(u0).length;
        for (let i = 0; i < grp.length && size < ts; i++) for (const r of byU.get(grp[i])) for (let k = R.off[r]; k < R.off[r + 1] && size < ts; k++) { const b = R.nbr[k]; if (!inSet.has(b) || eSea[k]) continue; const ub = uOf(b); if (done.has(ub)) continue; done.add(ub); grp.push(ub); size += byU.get(ub).length; }
        groups.push(grp.flatMap(u => byU.get(u))); }
      if (groups.length === list.length && groups.every(g => { const v = prov[g[0]]; return g.every(r => prov[r] === v) && PV[v].n === g.length; })) return false; // 与原来的划分一样
      const news = [];
      for (const g of groups) { const pa = [...new Set(g.map(r => prov[r]))].filter(v => v >= 0), seat=seatRegion(g,y);if(seat<0){for(const r of g)setProv(r,-1,y);continue}const v = newProv(y, p, seat, 'redraw', pa); for (const r of g) setProv(r, v, y); news.push(v); }
      const olds = []; for (const X of list) if (X.n === 0 && X.abolished === null) { X.abolished = y; X.abolishWhy = 'redraw'; olds.push(X.id); }
      ev(y, 'provRedraw', { p, olds, news, r: P[p].cap });
      return true;
    }
    let maxPP = 0;
    function redivide(y) {
      const pp = new Float64Array(PV.length), pn = new Int32Array(PV.length);
      for (let r = 1; r <= nR; r++) { const v = prov[r]; if (v < 0) continue; pn[v]++; pp[v] += regionPop(r, y); }
      for (let v = 0; v < PV.length; v++) if (pn[v] >= 2 && pp[v] > maxPP) maxPP = pp[v];
      const nPV = PV.length;
      for (let v = 0; v < nPV; v++) { const X = PV[v]; if (X.abolished !== null || pn[v] < 2 || pp[v] < PCAP || y - Math.max(X.created, X.lastSplit === undefined ? -1e9 : X.lastSplit) < 60) continue;
        const o = X.owner; if (o < 0 || !P[o].org || P[o].rebel || P[o].died !== null) continue; splitProv(v, y, 2, 'pop'); }
      const cand = new Map();
      for (const X of PV) { if (X.abolished !== null || X.n === 0 || X.gotAt === undefined || X.rdDone || y - X.gotAt < 30) continue; X.rdDone = true;
        const o = X.owner; if (o < 0 || !P[o].org || P[o].rebel || P[o].died !== null) continue; if (!cand.has(o)) cand.set(o, []); cand.get(o).push(X); }
      for (const [o, list] of cand) { if (list.length < 2) continue; const alien = list.some(X => X.gotCiv !== P[o].civ); if (rndD() < (alien ? 0.5 : 0.12)) regroup(list, o, y); }
    }
    function admin(y) { // 军管满二十年的新占领土地：改隶 / 以国为省 / 并入邻省 / 新设一省
      const order = Array.from({ length: nR }, (_, i) => i + 1).sort((a, b) => Number(prevProv[b] >= 0 && PV[prevProv[b]].seat === b) - Number(prevProv[a] >= 0 && PV[prevProv[a]].seat === a));
      for (const r of order) {
        const p = owner[r]; if (p < 0 || !P[p].org || prov[r] >= 0 || y - occSince[r] < 20) continue;
        const X = prevProv[r];
        const joinsOld = X >= 0 && (PV[X].n === 0 ? PV[X].seat === r && seatCity(r,y)>=0 : Array.from({ length: R.off[r + 1] - R.off[r] }, (_, i) => R.off[r] + i).some(k => !eSea[k] && prov[R.nbr[k]] === X));
        if (X >= 0 && PV[X].abolished === null && joinsOld && (PV[X].n === 0 || PV[X].owner === p)) { const q0 = PV[X].owner; if (q0 !== p) { provOwner(X, p, y, 'conquer'); if (PV[X].n === 0) ev(y, 'transfer', { pv: X, p, q: q0, r }); } if(PV[X].n===0){PV[X].seats.push([y,r]);PV[X].seatCities.push([y,seatCity(r,y)]);}setProv(r, X, y); continue; }
        const q = prevOwner[r];
        if (q >= 0 && P[q].died !== null && !P[q].org && P[q].peakN >= 2 && !fromStateMade.has(q)) { // 以国为省
          const regs = [r], seen = new Set(regs); for (let i = 0; i < regs.length; i++) for (let k = R.off[regs[i]]; k < R.off[regs[i] + 1]; k++) { const b = R.nbr[k]; if (!eSea[k] && !seen.has(b) && owner[b] === p && prov[b] < 0 && prevOwner[b] === q && y - occSince[b] >= 20) { seen.add(b); regs.push(b); } }
          const seat = seatRegion(regs,y,P[q].cap);if(seat>=0){const v = newProv(y, p, seat, 'from-state', [], { fromState: q }); for (const k of regs) setProv(k, v, y); fromStateMade.add(q); ev(y, 'fromState', { p, q, pv: v, r: seat }); continue;} }
        let best = -1, bn = 1e9; for (let k = R.off[r]; k < R.off[r + 1]; k++) { const b = R.nbr[k]; if (!eSea[k] && owner[b] === p && prov[b] >= 0 && PV[prov[b]].owner === p && PV[prov[b]].n < bn) { bn = PV[prov[b]].n; best = prov[b]; } }
        if (best >= 0) { setProv(r, best, y); if (PV[best].n > MAXN[Math.max(4, Math.min(8, stageAt(P[p].cap, y)))]) splitProv(best, y); continue; }
        const regs = [r], seen = new Set([r]); for (let i = 0; i < regs.length; i++) for (let k = R.off[regs[i]]; k < R.off[regs[i] + 1]; k++) { const b = R.nbr[k]; if (!eSea[k] && !seen.has(b) && owner[b] === p && prov[b] < 0 && y - occSince[b] >= 20) { seen.add(b); regs.push(b); } }
        const seat=seatRegion(regs,y);if(seat>=0){const v = newProv(y, p, seat, 'establish'); for (const k of regs) setProv(k, v, y);}
      }
      for (const X of PV) if (X.abolished === null && X.n === 0 && y - X.zeroSince >= 80) { X.abolished = y; X.abolishWhy = 'empty'; } // 空了八十年无人收复：撤省
      if (y < E && (y / TICK) % 5 === 0) redivide(y);
    }
    // 战争可能切断一个省。治所所在连片保留原省，其余连片各自建省。
    function separateFragments(y) {
      const seen = new Uint8Array(nR + 1), fragments = new Map();
      for (let start = 1; start <= nR; start++) { const v = prov[start]; if (v < 0 || seen[start]) continue;
        const regs = [start]; seen[start] = 1;
        for (let i = 0; i < regs.length; i++) for (let k = R.off[regs[i]]; k < R.off[regs[i] + 1]; k++) { const b = R.nbr[k]; if (!eSea[k] && !seen[b] && prov[b] === v) { seen[b] = 1; regs.push(b); } }
        if (!fragments.has(v)) fragments.set(v, []); fragments.get(v).push(regs);
      }
      for (const [v, groups] of fragments) { if (groups.length < 2) continue; const X = PV[v];
        for (const regs of groups) { if (regs.includes(X.seat)) continue; const seat=seatRegion(regs,y);if(seat<0){for(const r of regs)setProv(r,-1,y);continue}const nv = newProv(y, X.owner, seat, 'split', [v]); for (const r of regs) setProv(r, nv, y); }
      }
    }
    function enforceProvinces(y,daysOut,changedSea) {
      const groups=new Map();for(let r=1;r<=nR;r++){const v=prov[r];if(v<0)continue;if(!groups.has(v))groups.set(v,[]);groups.get(v).push(r)}
      for(const [v,regs] of groups){const X=PV[v],seat=seatRegion(regs,y,X.seat);
        if(seat<0){for(const r of regs)setProv(r,-1,y);continue}
        if(seat!==X.seat){X.seat=seat;X.seats.push([y,seat]);X.seatCities.push([y,seatCity(seat,y)]);X._rev=(X._rev||0)+1}
        else {const city=seatCity(seat,y);if(X.seatCities[X.seatCities.length-1]?.[1]!==city)X.seatCities.push([y,city]);}
        if(!daysOut&&X._checked===X._rev&&!(changedSea&&regs.some(r=>changedSea.has(r))))continue;
        const distances=administration.reachable({seat,id:v,owner,prov,year:y});
        for(const r of regs){const d=distances.get(r);if(d===undefined)setProv(r,-1,y);else if(daysOut)daysOut[r]=d}
        X._checked=X._rev;
      }
    }
    function secedeProvince(p, y, reachP) { // 割据：远离都城或住着异族的省自立
      const q = P[p]; let best = -1, bs = 0;
      for (const X of PV) { if (X.abolished !== null || X.owner !== p || X.n === 0 || prov[q.cap] === X.id) continue; const sc = kmBetween(X.seat, q.cap) / reachP + (cult[X.seat] !== q.civ ? 0.6 : 0); if (sc > bs) { bs = sc; best = X.id; } }
      if (best < 0 || bs < 1) return;
      const X = PV[best], civ = creole(X.seat, q, y);
      if (!civilized(civ)) { releaseTribes(p, Array.from({ length: nR }, (_, i) => i + 1).filter(r => prov[r] === best && owner[r] === p), y); q.coh = Math.max(0, q.coh - 0.04); return; }
      if (!countrySlots()) return;
      const c = newPolity(y, X.seat, [{ id: p, kind: 'secede' }], civ); P[c].org = y; P[c].claimLin = q.lin; P[c].claimUntil = y + 300; P[c].coh = 0.8;
      inheritRegions(Array.from({ length: nR }, (_, i) => i + 1).filter(r => prov[r] === best && owner[r] === p).map(r => [r, c]), y);
      q.coh = Math.max(0, q.coh - 0.04); ev(y, 'provSecede', { p: c, q: p, pv: best, r: X.seat });
    }
    // ---------- 文化与宗教的动态：自然传播、被统治者同化、游牧部族随军迁徙；宗教传教扩散、国教推行改宗 ----------
    const rndC = mulberry32((h.seed | 0) + 8888);   // 独立的随机流：不扰动政权推演
    const cult = new Int32Array(nR + 1).fill(-1), rel = new Int32Array(nR + 1).fill(-1), cLog = [], rLog = [];
    const human = G.HumanPopulation.create(nR), species = h.speciesLibraries;
    if (!Array.isArray(species) || !species.length) throw new Error('人文人口缺少选中的种族库');
    const habitat = species.map(s => Float64Array.from({ length: nR + 1 }, (_, r) => r ? G.HumanAnchors.habitat(s, R, r) : 0));
    // 初始人口是现有人文承载权重的 8%；以后按明确的出生死亡参数推演，不是年龄结构复原。
    const rndH = mulberry32((h.seed | 0) + 12913);
    for (let r = 1; r <= nR; r++) {
      const pop = Math.round(Math.max(0, R.weight[r]) * h.popTotal * 0.08); if (!pop) continue;
      const weights = habitat.map(a => a[r] > 0.02 ? a[r] : 0);
      const total = weights.reduce((a, b) => a + b, 0); let chosen = 0;
      if (!total) continue;
      { let draw = rndH() * total; for (let i = 0; i < weights.length; i++) { draw -= weights[i]; if (draw <= 0) { chosen = i; break; } } }
      human.add(r, chosen, -1, -1, pop);
    }
    const sync = (r, y) => {
      const c = human.dominant(r, 'culture'), f = human.dominant(r, 'religion');
      if (cult[r] !== c) { cult[r] = c; cLog.push(r, y, c); }
      if (rel[r] !== f) { rel[r] = f; rLog.push(r, y, f); }
    };
    const setCult = (r, c, y, fraction = 0.15) => { human.convert(r, 'culture', c, fraction); sync(r, y); };
    const setRel = (r, f, y, fraction = 0.15, source) => { human.convert(r, 'religion', f, fraction, source); sync(r, y); };
    const moveCult = (from, to, culture, y, edge) => {
      if (edge.sea) return 0;
      let n = 0;
      for (const g of human.groups(from)) if (g.culture === culture && G.HumanAnchors.migration(species[g.species], R, from, to, edge, effectiveCulture(from, culture)).viable) n += human.move(from, to, g.species, g.culture, g.religion, Math.floor(g.population * 0.04));
      if (n) { migrated += n; sync(from, y); sync(to, y); } return n;
    };
    const humanSnapshots = [], humanExchange = [], humanMigration = [], exchanged = new Set();
    const localTraits = new Map(), localEffective = new Map(), migrationRoutes = new Map();
    const cultureDef = c => c >= 0 ? h.civLib[c] : c <= -2 && D.ancient[-2 - c] ? D.ancient[-2 - c].libObj : null;
    const rndFortName = mulberry32((h.seed | 0) + 81371);
    const fortManager = G.HumanFortifications.create({ R, h, roads: C.roads, cities:C.cities, constructionAt:r => regionEffects(r).constructionCost, nameOf(r) {
      const lib = cultureDef(cult[r]) || cultureDef(P[owner[r]]?.civ);
      return G.NameGen.fort(lib, D.usedNames, rndFortName);
    } });
    function effectiveCulture(r, c) {
      const key = `${r},${c}`, base = cultureDef(c), extra = localTraits.get(key);
      if (!base || !extra) return base;
      if (localEffective.has(key)) return localEffective.get(key);
      const traits = (base.traits || []).slice();
      for (const [id, strength] of extra) { const i = traits.findIndex(t => t.id === id); if (i < 0) traits.push({ id, strength }); else if (traits[i].strength < strength) traits[i] = { id, strength }; }
      const result = Object.assign({}, base, { traits }); localEffective.set(key, result); return result;
    }
    let initialPopulation = 0, births = 0, deaths = 0, migrated = 0, foodSummary = null, lastFood = null, snapshotBytes = 0, peakGroups = 0, lastHumanTick = 0;
    const humanMs = { food: 0, population: 0, cultureReligion: 0 };
    for (let r = 1; r <= nR; r++) initialPopulation += human.total(r);
    if (!initialPopulation) throw new Error('所选种族无法在任何人文区块建立人口，请调整种族适温或世界气候');
    const recordHuman = (y, through = y) => {
      let population = 0; for (let r = 1; r <= nR; r++) population += human.total(r);
      if (population !== initialPopulation + births - deaths) throw new Error(`人文人口守恒失败：${y} 年`);
      const s = human.snapshot(y); s.calculatedThroughYear = through; s.ledger = { initial: initialPopulation, births, deaths, migrated, population }; s.food = foodSummary; humanSnapshots.push(s);
      if(lastFood)s.localFood={demand:Float64Array.from(lastFood.foodDemand),available:Float64Array.from(lastFood.foodAvailable),sampleYear:through};
      snapshotBytes += s.offsets.byteLength + s.species.byteLength + s.culture.byteLength + s.religion.byteLength + s.population.byteLength; peakGroups = Math.max(peakGroups, s.population.length);
      if(s.localFood)snapshotBytes+=s.localFood.demand.byteLength+s.localFood.available.byteLength;
    };
    // 宗教：来自宗教库（类型、传播方式、派别与异端）；推演中可能发生教派分裂，新教派追加在列表末尾
    const RELS = (opt.religions || []).map((r, f) => Object.assign({}, r, { founded: D.relFounded[f], origin: D.relOrigin[f], parent: -1, depth: 0 }));
    let nRel = RELS.length; const RCAP = nRel + 40, relOn = new Uint8Array(RCAP), relCnt = new Float64Array(RCAP), holyOf = new Int32Array(nR + 1).fill(-1);
    RELS.forEach((o, f) => { if (o.origin) holyOf[o.origin] = f; o.cult = o.origin ? R.civ[o.origin] : -1; o.usedBr = new Set(); o.lastSchism = -1e9; });
    // 相同种族、有效文化和宗教的组共享已编译效果；地方吸收产生新文化对象，自然形成新缓存键。
    const bundles = species.map(() => new Map());
    function groupEffects(r, g) {
      const culture = effectiveCulture(r, g.culture), religion = g.religion >= 0 ? RELS[g.religion] : null;
      let byReligion = bundles[g.species].get(culture); if (!byReligion) bundles[g.species].set(culture, byReligion = new Map());
      let result = byReligion.get(religion); if (!result) { result = G.HumanRules.combine(species[g.species], culture, religion); byReligion.set(religion, result); }
      return result;
    }
    const regionEffectKeys = ['combat','attack','defense','assimilation','culturalResistance','religiousSpread','religiousResistance','tolerance','governance','autonomy','constructionCost'];
    function regionEffects(r) {
      const total = human.total(r), out = { combat:0, attack:0, defense:0, assimilation:0, culturalResistance:0, religiousSpread:0, religiousResistance:0, tolerance:0, governance:0, autonomy:0, constructionCost:0 };
      if (!total) return out;
      for (const g of human.view(r)) { const e = groupEffects(r, g), w = g.population / total;
        for (const k of regionEffectKeys) out[k] += e[k] * w;
      }
      return out;
    }
    const holyWars = G.HolyWar.create(), rndHoly = mulberry32((h.seed | 0) + 99451);
    const military = G.Military.create({ R, terrain:h, fullTerrain:opt.fullTerrain, human, species, effectsAt:groupEffects, cultureAt:effectiveCulture,
      rules:opt.militaryRules, yearDays:opt.yearDays, random:mulberry32((h.seed|0)+99469), onDeaths(n,g) { deaths+=n; if(n)sync(g.source,lastHumanTick); } });
    const SPREAD_N = { missionary: 1.35, ethnic: 1, syncretic: 0.85 }, SPREAD_S = { missionary: 1.15, ethnic: 1, syncretic: 0.8 };
    const relTypeOf = f => f >= 0 && RELS[f] ? RELS[f].type : null, relSpreadOf = f => f >= 0 && RELS[f] ? RELS[f].spread : null;
    const ethnicMul = (f, r) => relSpreadOf(f) === 'ethnic' && RELS[f].cult >= 0 && cult[r] !== RELS[f].cult ? 0.25 : 1; // 民族宗教：难以传给外族
    function stepCR(y, gf) {
      const started = Date.now();
      const influence = new Map(), influenceAt = r => { if (!influence.has(r)) influence.set(r, regionEffects(r)); return influence.get(r); };
      const changeCulture = (r, c, fraction) => { setCult(r, c, y, fraction); influence.delete(r); };
      for (let f = 0; f < nRel; f++) if (!relOn[f] && y >= RELS[f].founded && RELS[f].origin) { relOn[f] = 1; setRel(RELS[f].origin, f, y, 0.6, -1); }
      for (let r = 1; r <= nR; r++) {
        // 文化
        const c = cult[r], fin = R.civ[r];
        if (c === -1) { const b = cultAt(r, y); if (b !== -1) changeCulture(r, b, 0.15); }
        else if (c <= -2 && y >= D.ancientEnd[r]) changeCulture(r, cultAt(r, y), 0.3);
        // 文明国统治下的无文明居民也逐步同化；占领本身不改写居民文化。
        {
          const p = owner[r];
          if (p >= 0) { const rc = rulingCultureAt(P[p], y); if (rc !== cult[r] && civilized(rc) && !(rc <= -2 && ancientFallen.has(-2 - rc))) { // 被异族长期统治，慢慢同化
              let pr = isNW(r) && (!isNW(P[p].cap) || P[p].colonialFrom !== undefined) ? 0.07 : 0.009 * clamp((y - linOwnSince[r] - 100) / 300, 0, 1) * (sg[r] >= 5 ? 1.4 : 1); pr *= G.HumanRules.multiplier(influenceAt(P[p].cap).assimilation) / G.HumanRules.multiplier(influenceAt(r).culturalResistance); if (rc === fin) pr *= 1 + 3 * gf; if (c === fin) pr *= 1 - 0.85 * gf; if (pr > 0 && rndC() < pr) changeCulture(r, rc, 0.15); } }
          if (gf > 0 && cult[r] !== fin && fin >= 0) { let nb = 0, nf = 0; for (let k = R.off[r]; k < R.off[r + 1]; k++) { nb++; if (cult[R.nbr[k]] === fin) nf++; } if (nf && rndC() < 0.006 * gf * nf / nb) setCult(r, fin, y); }
        }
        // 宗教：有文化的地方才有信仰；邻近的宗教传教扩散，国教在本国推行改宗
        if (cult[r] === -1 || sg[r] < 1) continue;
        const cur = rel[r], rf = R.rel[r]; if (cur >= 0 && holyOf[r] === cur) continue; relCnt.fill(0); let nb = 0; /* 宗教发源地（圣地）不改宗 */
        for (let k = R.off[r]; k < R.off[r + 1]; k++) { if (eSea[k]) continue; const b = R.nbr[k], total = human.total(b); nb++; if (!total) continue;
          // 同一源区、方向、宗教及有效文化的接触值不依赖种族；仅此边缓存，保留全部群体。
          const contacts = new Map();
          for (const group of human.view(b)) { const g = group.religion; if (g < 0) continue; const pilgrimage = holyOf[b] === g || holyOf[r] === g;
            let byFaith = contacts.get(group.culture); if (!byFaith) contacts.set(group.culture, byFaith = new Map());
            let contact = byFaith.get(g); if (contact === undefined) { contact = G.HumanAnchors.contact(R, b, r, R.edges[R.eid[k]], effectiveCulture(b, group.culture), RELS[g], pilgrimage); byFaith.set(g, contact); }
            relCnt[g] += group.population / total * contact * G.HumanRules.multiplier(groupEffects(b, group).religiousSpread);
          } }
        let best = -1, bp = 0;
        const resistance = G.HumanRules.multiplier(influenceAt(r).religiousResistance);
        for (let g = 0; g < nRel; g++) { if (!relCnt[g]) continue; let pr = (1 - Math.pow(1 - (cur === -1 ? 0.2 : 0.05) * (SPREAD_N[relSpreadOf(g)] || 1) * ethnicMul(g, r), relCnt[g])) / resistance; if (g === rf) pr *= 1 + 3 * gf; if (cur === rf) pr *= 1 - 0.85 * gf; if (pr > bp) { bp = pr; best = g; } }
        const p = owner[r]; if (p >= 0) { const sr = P[p].theoRel !== undefined ? P[p].theoRel : rel[P[p].cap]; if (sr >= 0) { let pr = (P[p].theo !== undefined ? 1.8 : 1) * (SPREAD_S[relSpreadOf(sr)] || 1) * ethnicMul(sr, r) * (isNW(r) && (!isNW(P[p].cap) || P[p].colonialFrom !== undefined) ? 0.15 : 0.04 * clamp((y - linOwnSince[r]) / 200, 0.25, 1) * (cur === -1 ? 1.5 : 1)); pr *= G.HumanRules.multiplier(influenceAt(P[p].cap).religiousSpread) / resistance; if (sr === rf) pr *= 1 + 3 * gf; if (cur === rf) pr *= 1 - 0.85 * gf; if (pr > bp) { bp = pr; best = sr; } } }
        if (best >= 0 && rndC() < bp) { setRel(r, best, y); influence.delete(r); }
      }
      humanMs.cultureReligion += Date.now() - started;
    }
    // 对相邻区块比较迁移阻力与生存条件；同一轮先规划再执行，避免一轮走过多条边。
    function stepHuman(y) {
      lastHumanTick = y;
      const started = Date.now(), moves = [], dirty = new Set(), food = G.HumanEconomy.allocate({ R, human, species, popTotal: h.popTotal, stage: sg, cultureAt: effectiveCulture, religionAt: f => f >= 0 ? RELS[f] : null });
      const afterFood = Date.now(); humanMs.food += afterFood - started;
      foodSummary = food.summary; lastFood = food;
      const shortages = new Float64Array(nR + 1); for (let r = 1; r <= nR; r++) shortages[r] = food.foodDemand[r] > 0 ? Math.max(0, 1 - food.foodAvailable[r] / food.foodDemand[r]) : 0;
      for (let r = 1; r <= nR; r++) {
        if (!human.total(r)) continue;
        const shortage = shortages[r];
        const occupancy = human.total(r) / Math.max(1, R.weight[r] * h.popTotal * (0.15 + 0.85 * sg[r] / 8));
        const choices = new Map();
        for (const g of human.view(r)) {
          const oldPopulation = g.population;
          const s = species[g.species]; let best = -1, bestScore = 0, bestRoute = null;
          const here = habitat[g.species][r];
          const effects = groupEffects(r, g);
          const born = Math.floor(oldPopulation * 0.012 * (1 - 0.5 * shortage) * G.HumanRules.multiplier(effects.birthRate));
          const dead = Math.min(oldPopulation + born, Math.floor(oldPopulation * (0.007 + shortage * 0.02 + Math.min(0.025, Math.max(0, occupancy - 1) * 0.012) + (1 - here) * 0.002) * G.HumanRules.multiplier(effects.deathRate)));
          human.adjust(r, g.species, g.culture, g.religion, born - dead); births += born; deaths += dead;
          if (oldPopulation < 50) continue; // 本轮最多迁出 2%，不足一人自然无法迁移
          const def = effectiveCulture(r, g.culture); let byCulture = migrationRoutes.get(def); if (!byCulture) migrationRoutes.set(def, byCulture = new Map());
          let choiceBySpecies = choices.get(def); if (!choiceBySpecies) choices.set(def, choiceBySpecies = new Map());
          let choice = choiceBySpecies.get(g.species);
          if (!choice) {
            const pressure = Math.min(1, Math.max(0, occupancy - 0.7)) * 0.3;
            for (let k = R.off[r]; k < R.off[r + 1]; k++) {
              const b = R.nbr[k], edge = R.edges[R.eid[k]];
              if (edge.sea) continue;
              const border = owner[b] >= 0 && owner[r] !== owner[b];
              const routeKey = (k * species.length + g.species) * 2 + (border ? 1 : 0);
              let route = byCulture.get(routeKey);
              if (!route) { route = G.HumanAnchors.migration(s, R, r, b, edge, def, border ? { risk: 0.03, tollDays: 1 } : null); byCulture.set(routeKey, route); }
              if (!route.viable) continue;
              const gain = habitat[g.species][b] - here + pressure + (shortage - shortages[b]) * 0.4;
              const score = gain / (1 + route.cost / 30);
              if (score > bestScore) { bestScore = score; best = b; bestRoute = route; }
            }
            choice = { best, bestScore, bestRoute }; choiceBySpecies.set(g.species, choice);
          } else { best = choice.best; bestScore = choice.bestScore; bestRoute = choice.bestRoute; }
          if (best > 0) moves.push([r, best, { species: g.species, culture: g.culture, religion: g.religion }, Math.floor(oldPopulation * Math.min(0.02, bestScore * 0.01)), bestRoute]);
        }
        if (human.groupCount(r) > 1) sync(r, y);
      }
      const evidence = [];
      for (const [a, b, g, n, route] of moves) if (n) {
        const moved = human.move(a, b, g.species, g.culture, g.religion, n); migrated += moved; if (moved) { dirty.add(a); dirty.add(b); }
        if (moved) { evidence.push({ year: y, from: a, to: b, species: g.species, culture: g.culture, religion: g.religion, population: moved, costDays: route.cost, travelDays: route.days, risk: route.risk, reason: route.reason }); evidence.sort((a, b) => b.population - a.population || a.from - b.from || a.to - b.to); if (evidence.length > 4) evidence.pop(); }
      }
      for (const r of dirty) sync(r, y);
      humanMigration.push(...evidence); // 记录规模最大的迁移用于解释；人口账本包含所有迁移
      // 邻地往来可带来文化特征：记录接收地、双方文化、来源及年代；不创建新文化。
      const exchangeInfluence = new Map(), exchangeInfluenceAt = r => { if (!exchangeInfluence.has(r)) exchangeInfluence.set(r, regionEffects(r)); return exchangeInfluence.get(r); };
      if (y % 100 === 0) for (let r = 1; r <= nR; r++) {
        const target = cult[r]; if (target === -1 || !human.total(r)) continue;
        for (let k = R.off[r]; k < R.off[r + 1]; k++) {
          if (eSea[k]) continue;
          const b = R.nbr[k], source = cult[b]; if (source === -1 || source === target) continue;
          const edge = R.edges[R.eid[k]], src = effectiveCulture(b, source), dst = effectiveCulture(r, target);
          if (!src || !dst) continue;
          let contact = 0; const sourceTotal = human.total(b);
          for (const group of human.view(b)) { const faith = group.religion >= 0 ? RELS[group.religion] : null; contact += group.population / sourceTotal * G.HumanAnchors.contact(R, b, r, edge, effectiveCulture(b, group.culture), faith, false); }
          if (contact <= 0) continue;
          const shift = Math.min(0.05, contact * 0.02 * G.HumanRules.multiplier(exchangeInfluenceAt(b).assimilation) / G.HumanRules.multiplier(exchangeInfluenceAt(r).culturalResistance));
          const changed = human.convert(r, 'culture', source, shift, target);
          if (!changed) continue;
          sync(r, y); exchangeInfluence.delete(r);
          for (const trait of G.HumanRules.TRAITS) {
            if (trait.scope !== 'culture') continue; const id = trait.id;
            if (trait.conflicts.some(other => G.HumanRules.strength(effectiveCulture(r, target), other) > 0)) continue;
            const strength = G.HumanRules.strength(src, id);
            if (strength <= G.HumanRules.strength(dst, id)) continue;
            const key = `${r},${target}`, marker = `${key},${id}`;
            if (exchanged.has(marker)) continue;
            if (!localTraits.has(key)) localTraits.set(key, new Map()); localTraits.get(key).set(id, strength); localEffective.delete(key);
            exchanged.add(marker); humanExchange.push({ year: y, region: r, sourceRegion: b, sourceCulture: source, targetCulture: target, trait: id, strength });
          }
        }
      }
      humanMs.population += Date.now() - afterFood;
    }
    function creole(seat, q, y) { const civ = rulingCultureAt(q, y); return isNW(seat) && typeOfCult(civ) !== 'new-world' ? civ : civOfNew(seat); } // 殖民地分立出来的是移民国家：随母国的文明
    function newPolity(y, cap, parents, civ, lin) {
      if (!civilized(civ)) throw new Error('无文明居民不能建立国家');
      const id = P.length;
      P.push({ id, born: y, died: null, cap, caps: [{ year: y, city: bigCity(cap, y), r: cap }], parents: parents || [], children: [], civ, initialCiv: civ, _initialRegion: civ !== -1 && cult[cap] === civ ? cap : -1, lin: lin === undefined ? linSeq++ : lin,
        dynStart: y, heldRegions: new Set(), coh: 0.8, n: 0, peakN: 0, peakYear: y, claimLin: -1, claimUntil: 0, restored: false, heirOf: -1, ext: [], liege: -1, vas: [] });
      // 文明类型只是倾向，不是定局：草原文明在草原上建立的国家多半是游牧汗国，但也会有定居的王国、城邦，日后也能走向封建、共和；
      // 其他文明在草原腹地也偶有游牧政权。称号一律取该文明文化库里对应政体的叫法（lib.t：monarchy / empire / republic / cityRepublic / nomadic……）。
      // 游牧与否主要看土地：草原腹地几乎都是游牧部族（绿洲城邦是少数），半农半牧之地两者参半，农耕之地即便是草原文明也是定居王朝
      if (civ !== undefined) { const Q = P[id], past = typeOfCult(civ) === 'pastoral', pa = R.pasture[cap], u = rndN();
        if (past && pa < 0.3) { Q.settled = y; Q.settledCiv = settleCivOf(cap, civ); if (Q.settledCiv !== civ && Q.settledCiv === cult[cap]) Q._settledRegion = cap; Q.leftSteppe = true; } // 草原之外建立的国家：生来就是定居王朝（用当地文明的称号）
        else Q.nomad = pa >= 0.45 ? u < (past ? 0.88 : 0.3) : pa >= 0.3 && u < (past ? 0.5 : 0.04); }
      for (const pa of P[id].parents) if (P[pa.id]) P[pa.id].children.push({ id, kind: pa.kind });
      return id;
    }
    // ---------- 宗藩：附庸保有自己的疆土与朝廷，向宗主称臣纳贡；同一宗藩体系内互不攻伐 ----------
    function setLiege(v, l, y, kind, quiet) { const V = P[v]; if (V.liege === l) return; const old = V.liege; V.liege = l; V.vas.push(y, l); V.vasSince = y;
      if (l >= 0 && V.crown !== undefined) uncrown(v, y, 'vassal', l); // 向他国称臣：去帝号
      if (!quiet) { if (l >= 0) ev(y, 'vassal', { p: l, q: v, r: V.cap, how: kind || 'submit' }); else if (old >= 0) ev(y, kind === 'annexV' ? 'vassalAnnex' : 'vassalFree', { p: old, q: v, r: V.cap }); } }
    const feudal = (st, y) => (st === 6 && y < 4350) || (st >= 4 && st <= 5 && y >= 3400 && y < 4350); // 第 4350 年（≈ 1350 年）以后不再新封附庸 // 封建宗藩：封建阶段，或中世纪年代的王国与帝国
    const topLiege = p => { let x = p; for (let g = 0; g < 8 && P[x].liege >= 0; g++) x = P[x].liege; return x; };
    function setOwner(r, p, y, keep) { // keep：疆域整体易主（改朝换代、分裂、外族入主、割据），省份随之改隶；否则新占领的土地先进入军管
      const old = owner[r]; if (old === p) return;
      const pv = prov[r];
      if (!keep) { if (pv >= 0) { prevProv[r] = pv; setProv(r, -1, y); } prevOwner[r] = old; occSince[r] = y; }
      owner[r] = p; log.push(r, y, p);
      if (old >= 0) { if (P[old].n === 1) trackCountry(P[old], -1); P[old].n--; }
      if (p >= 0) { P[p].heldRegions.add(r); if (P[p].n === 0) trackCountry(P[p], 1); P[p].n++; if (P[p].rebel) P[p].lastRebelGain = y; if (P[p].n > P[p].peakN) { P[p].peakN = P[p].n; P[p].peakYear = y; } }
      const nl = p >= 0 ? P[p].lin : -1, ol = old >= 0 ? P[old].lin : -1; if (nl !== ol) linOwnSince[r] = y;
    }
    // 整批处理疆域继承：同一省被不同国家分走时，按实际去向拆分，
    // 治所所在部分延续原省，其余部分成为新省。整省易主则保留原省身份。
    function inheritRegions(moves, y) {
      const dest = new Map(moves.filter(([r, p]) => owner[r] !== p));
      if (!dest.size) return;
      const affected = new Set(); for (const r of dest.keys()) if (prov[r] >= 0) affected.add(prov[r]);
      for (const v of affected) {
        const X = PV[v], groups = new Map();
        for (let r = 1; r <= nR; r++) if (prov[r] === v) {
          const p = dest.has(r) ? dest.get(r) : owner[r];
          if (!groups.has(p)) groups.set(p, []); groups.get(p).push(r);
        }
        let keepOwner = dest.has(X.seat) ? dest.get(X.seat) : owner[X.seat];
        if (!groups.has(keepOwner) || keepOwner < 0) keepOwner = [...groups.keys()].find(p => p >= 0);
        for (const [p, regs] of groups) {
          if (p < 0) { for (const r of regs) setProv(r, -1, y); continue; }
          if (p === keepOwner) { provOwner(v, p, y, 'inherit'); continue; }
          const seat=seatRegion(regs,y);if(seat<0){for(const r of regs)setProv(r,-1,y);continue}const nv = newProv(y, p, seat, 'split', [v]);
          for (const r of regs) setProv(r, nv, y);
        }
        if (X.n && prov[X.seat] !== v) { const regs = []; for (let r = 1; r <= nR; r++) if (prov[r] === v) regs.push(r); const seat = seatRegion(regs, y);if(seat<0){for(const r of regs)setProv(r,-1,y);}else{X.seat=seat;X.seats.push([y,seat]);X.seatCities.push([y,seatCity(seat,y)]);} }
      }
      for (const [r, p] of dest) setOwner(r, p, y, true);
    }
    function releaseTribes(p, regs, y) {
      if (!regs.length) return;
      inheritRegions(regs.map(r => [r, -1]), y);
      ev(y, 'tribalFree', { p, r: regs[0], n: regs.length, regions: regs });
    }
    function inheritOwned(from, to, y) {
      const moves = []; for (let r = 1; r <= nR; r++) if (owner[r] === from) moves.push([r, to]);
      inheritRegions(moves, y);
    }
    function moveCapital(p, y, why, to) {
      const q = P[p]; let best = to === undefined ? -1 : to, bv = -1;
      if (best < 0) for (let r = 1; r <= nR; r++) if (owner[r] === p) { const v = regionPop(r, y) + R.weight[r] * 1e-3; if (v > bv) { bv = v; best = r; } }
      if (best < 0 || (best === q.cap && (why !== 'found' || q.caps[q.caps.length - 1].city >= 0))) return;
      q.lastCapMove = y;
      q.cap = best; const city = bigCity(best, y); q.caps.push({ year: y, city, r: best });
      if (q.peakN >= 3 && city >= 0) ev(y, 'capital', { p, city, r: best, why });
    }
    function kill(q, y, by, kind) {
      const Q = P[q]; if (Q.died !== null) return; Q.died = y;
      if (by >= 0 && P[by] && !P[by].rebel) redirectRebels(q, by, y, -1);
      Q.coreAtDeath = historicalCores(Q.heldRegions, coreLin, Q.lin);
      // 继承的是稳定统治过的土地，而不是相同的国名或文化名称。
      if (by >= 0 && P[by] && !P[by].rebel && Q.coreAtDeath.length >= 2 && owner[Q.cap] === by) {
        const held = Q.coreAtDeath.filter(r => owner[r] === by).length;
        if (held >= Math.ceil(Q.coreAtDeath.length * 0.6)) (P[by].territorialPredecessors ||= []).push(q);
      }
      Q.heldRegions.clear();
      if (by >= 0) { Q.children.push({ id: by, kind: kind === 'integrate' || kind === 'nomadic' ? 'conquer' : kind || 'conquer' }); if (Q.peakN >= 3 && kind !== 'integrate') ev(y, 'annex', { p: by, q, r: Q.cap, n: Q.peakN }); }
      else if (kind !== 'quiet' && Q.peakN >= 3) ev(y, 'perish', { p: q, r: Q.cap }); // 失去最后的疆土而亡
      if (Q.crown !== undefined) { const s = Q.crown; uncrown(q, y); const B = by >= 0 ? P[by] : null; // 帝统：灭其国者若是同一文化圈的大国（或整国入主的外族），承袭帝统
        if (B && B.died === null && B.crown === undefined && !B.rebel && B.liege < 0 && !B.republic && (sphereOf(B) === s || kind === 'nomadic') && B.n >= 0.5 * EMPN && !crownOf.has(s)) crown(by, y, kind === 'nomadic' ? 'nomad' : 'conquer', q, s); }
    }
    // ---------- 帝统：帝国不是一种政体，而是文化圈里最高的法理名分（天无二日）——同一文化圈同一时间只有一个帝号，全世界的帝国也有定数；
    //            称帝要先成为本文化圈首屈一指的大国；帝号一旦确立便是法理，国势衰微也不失去，只随亡国、称臣而废，或由改朝换代、承袭、复国传下去 ----------
    const crownOf = new Map(); // 文化圈 → 当前的帝统所在
    const EMPMAX = clamp(Math.round(((opt.cultureNames && opt.cultureNames.length) || 12) / 3), 2, 7);
    // 法理圈 = 文化库（文化组）× 大陆：用同一个文化库的各文明共享一套名号与法统，同一块大陆上只容一个帝号（自定义世界常让几个文明共用一个库）；
    // 隔海的另一块大陆、海岛自成一圈（如日本之于中国）。入主定居的政权争的是所入主之地的帝统
    const libKeyOf = c => { const L = c >= 0 ? h.civLib[c] : c <= -2 && D.ancient[-2 - c] ? D.ancient[-2 - c].libObj : null; return L && L.id ? 'lib:' + L.id : 'civ:' + c; };
    const civOfSphere = q => q.settled !== undefined && q.settledCiv !== undefined && q.settledCiv !== -1 ? q.settledCiv : q.civ;
    const sphereOf = q => { const c = civOfSphere(q); return c === -1 ? -1 : libKeyOf(c) + '@' + R.landComp[q.cap]; };
    const sphereCivs = q => { const c = civOfSphere(q), key = libKeyOf(c), lc = R.landComp[q.cap], out = []; if (c < 0) return [c]; (opt.cultureNames || []).forEach((_, k) => { const hr = D.hearthR ? D.hearthR[k] : 0; if (libKeyOf(k) === key && (!hr || R.landComp[hr] === lc)) out.push(k); }); if (!out.includes(c)) out.unshift(c); else { out.splice(out.indexOf(c), 1); out.unshift(c); } return out; };
    function crown(p, y, how, from, s) { const q = P[p]; if (s === undefined) s = sphereOf(q); q.crown = s; q.crownS = s; crownOf.set(s, p); (q.emp = q.emp || []).push(y, null); if (how) ev(y, 'crown', { p, q: from, r: q.cap, how, sc: sphereCivs(q) }); }
    const lostAt = new Map(); // 文化圈 → [年份, 失去帝号者]：同一步里继起称帝的，与之对齐到同一月
    function uncrown(p, y, why, by) { const q = P[p]; if (q.crown === undefined) return; if (crownOf.get(q.crown) === p) crownOf.delete(q.crown); lostAt.set(q.crown, [y, p]); delete q.crown; q.emp[q.emp.length - 1] = y; if (why) ev(y, 'uncrown', { p, q: by, r: q.cap, why }); }
    const KINGN = Math.max(4, Math.round(3 * scale)); // 由公国晋为王国的规模
    function crownStep(y, alivePs, cs) {
      for (const [s, p] of [...crownOf]) if (P[p].died !== null) uncrown(p, P[p].died);
      const top = new Map(); for (const p of alivePs) { const q = P[p]; if (q.died !== null || q.rebel || !q.n) continue; const s = sphereOf(q); if (!top.has(s) || q.n > top.get(s)) top.set(s, q.n); }
      const cand = [];
      for (const p of alivePs) { const q = P[p]; if (q.died !== null || q.rebel || !q.n) continue;
        if (q.king === undefined && q.n >= KINGN) { q.king = y; if (y > q.born && !q.rtype) ev(y, 'regal', { p, r: q.cap }); } // 起义军割据成国：直接称王，不记“晋为王国” // 公国 → 王国
        if (q.crown !== undefined || q.liege >= 0 || q.republic) continue; const s = sphereOf(q); if (s === -1 || crownOf.has(s) || q.n < top.get(s)) continue; // 须是本文化圈首屈一指的大国
        const nom = nomadAt(q, y); if (nom ? !(cs[p] >= 3 && q.horde !== undefined && q.n >= 0.33 * EMPN) : !(cs[p] >= 5 && q.n >= EMPN)) continue; // 游牧帝国：大汗号令诸部即可称尊
        cand.push(p); }
      cand.sort((a, b) => P[b].n - P[a].n || a - b);
      for (const p of cand) { if (crownOf.size >= EMPMAX + (nomadAt(P[p], y) ? 1 : 0)) continue; const s = sphereOf(P[p]); if (crownOf.has(s)) continue; const la = lostAt.get(s); crown(p, y, 'proclaim', la && la[0] === y ? la[1] : undefined); } // 草原帝国来去匆匆，可以多占一席
    }

    // Only bounded, reachable unclaimed pockets can be incorporated. Borders of
    // existing states change through recorded political or military actions.
    const rndFrontier = mulberry32((h.seed | 0) + 79147);
    const rndFoundOrder = mulberry32((h.seed | 0) + 81473), rndFound = mulberry32((h.seed | 0) + 81479);
    function incorporatePockets(y, cap) {
      const countryArea = new Float64Array(P.length); let totalArea = 0;
      for (let r = 1; r <= nR; r++) { totalArea += R.area[r]; if (owner[r] >= 0) countryArea[owner[r]] += R.area[r]; }
      const provinceReach = new Map(), capitalReach = new Map();
      const edgeDays = (edge, id) => administration.roadYear[id] <= y ? Math.min(G.HumanAnchors.travelDays(edge,null,null), edge.km / opt.admin.road * (1 + .05 * Math.max(0,edge.rough || 0))) : G.HumanAnchors.travelDays(edge,null,null);
      const entryDays = (p,r) => {
        const v = prov[r], X = v >= 0 ? PV[v] : null;
        if (X && X.abolished === null && owner[X.seat] === p && seatCity(X.seat,y) >= 0) {
          if (!provinceReach.has(v)) provinceReach.set(v, administration.reachable({seat:X.seat,id:v,owner,prov,year:y}));
          return provinceReach.get(v).get(r) ?? Infinity;
        }
        if (!capitalReach.has(p)) {
          const dist = new Map([[P[p].cap,0]]), queue = new R.Heap(32); queue.push(P[p].cap,0);
          while (queue.n) {
            const a=queue.pop(), cost=queue.top; if (dist.get(a)!==cost) continue;
            for (let k=R.off[a];k<R.off[a+1];k++) {
              const b=R.nbr[k], edge=R.edges[R.eid[k]]; if (edge.sea || owner[b]!==p) continue;
              const days=cost+edgeDays(edge,R.eid[k]); if(days>administration.budget || days>=(dist.get(b)??Infinity))continue;
              dist.set(b,days);queue.push(b,days);
            }
          }
          capitalReach.set(p,dist);
        }
        return capitalReach.get(p).get(r) ?? Infinity;
      };
      const candidates = G.HistoryTerritory.pockets({R, owner,
        eligible:r => R.area[r] > 0,
        live:p => P[p].died === null && !P[p].rebel && P[p].n > 0,
        maxRegions:p => Math.min(8, Math.max(1, Math.floor(P[p].n * .15))),
        maxArea:p => Math.max(totalArea / Math.max(1,nR), countryArea[p] * .15),
        budget:p => administration.budget,
        entryDays,
        edgeDays:edge => G.HumanAnchors.travelDays(edge, null, null)
      });
      const grouped = new Map();
      for (const pocket of candidates) {
        let regions = grouped.get(pocket.owner); if (!regions) grouped.set(pocket.owner, regions = []);
        for (const r of pocket.regions) { setOwner(r, pocket.owner, y); regions.push(r); }
      }
      for (const [p, regions] of grouped) ev(y, 'territoryIntegrate', {p, r:regions[0], n:regions.length, regions});
      // 陆上相邻的居民区可逐步归附文明政权；部族原有文化不会因此立即改变。
      // 须从稳定边境出发，且在行政可达范围内；先收集候选，避免同一轮连锁扩张。
      const offers = new Map();
      for (let r = 1; r <= nR; r++) {
        if (owner[r] >= 0 || y - linOwnSince[r] < TICK || !habitable(r) || !human.total(r)) continue;
        for (let k = R.off[r]; k < R.off[r + 1]; k++) {
          const a = R.nbr[k], p = owner[a], edge = R.edges[R.eid[k]];
          if (edge.sea || p < 0 || P[p].died !== null || P[p].rebel || P[p].coh < .6 || !Number.isFinite(cap[p]) || P[p].n >= cap[p] * 1.5 || sg[P[p].cap] < 3 || y - linOwnSince[a] < 30) continue;
          const days = entryDays(p, a) + edgeDays(edge, R.eid[k]);
          if (days > administration.budget) continue;
          const chance = cult[r] === rulingCultureAt(P[p], y) ? .80 : cult[r] === -1 ? .32 : .06;
          const score = chance / (1 + days / administration.budget);
          let list = offers.get(p); if (!list) offers.set(p, list = []);
          const prev = list.find(o => o.r === r);
          if (!prev) list.push({r, chance, score}); else if (score > prev.score) prev.score = score;
        }
      }
      for (const [p, list] of offers) {
        list.sort((a,b) => b.score - a.score || a.r - b.r);
        for (const offer of list.slice(0, 2)) if (owner[offer.r] < 0 && P[p].n < cap[p] * 1.5 && rndFrontier() < offer.chance) {
          setOwner(offer.r, p, y); ev(y, 'frontierAffiliation', {p, r:offer.r});
        }
      }
    }

    // 远离本土、被陆上边界切断的小块领地，由接壤国家接管；
    // 海岛和跨大陆殖民地不参与此处理。所有变更都进入领土与行政日志。
    function settleDetachedTerritory(y) {
      const seen = new Uint8Array(nR + 1), groups = new Map();
      for (let start = 1; start <= nR; start++) {
        const p = owner[start]; if (p < 0 || seen[start] || P[p].rebel) continue;
        const regs = [start]; seen[start] = 1;
        for (let i = 0; i < regs.length; i++) for (let k = R.off[regs[i]]; k < R.off[regs[i]+1]; k++) {
          const b = R.nbr[k]; if (!eSea[k] && !seen[b] && owner[b] === p) { seen[b] = 1; regs.push(b); }
        }
        if (!groups.has(p)) groups.set(p, []); groups.get(p).push(regs);
      }
      for (const [p, parts] of groups) {
        const q = P[p], home = parts.find(g => g.includes(q.cap)); if (!home || q.died !== null) continue;
        for (const part of parts) {
          if (part === home || part.length > Math.max(1, Math.floor(q.n * .3)) || R.landComp[part[0]] !== R.landComp[q.cap]) continue;
          let distance = Infinity; for (const a of part) for (const b of home) distance = Math.min(distance, kmBetween(a, b));
          if (distance < 250) continue;
          const border = new Map();
          for (const a of part) for (let k = R.off[a]; k < R.off[a+1]; k++) {
            const other = owner[R.nbr[k]]; if (eSea[k] || other < 0 || other === p || P[other].rebel || P[other].died !== null) continue;
            border.set(other, (border.get(other) || 0) + 1);
          }
          const to = [...border].sort((a,b) => b[1] - a[1] || a[0] - b[0])[0]?.[0];
          if (to === undefined) continue;
          inheritRegions(part.map(r => [r, to]), y);
          ev(y, 'territoryCede', {p:to, q:p, r:part[0], n:part.length});
        }
      }
    }

    // 相邻、文化相近的小邦可以自愿合邦；它们没有进行低于战争门槛的战斗。
    // 双方必须规模相近、独立且不统辖附庸，避免把大片土地伪装为一次外交吞并。
    const rndUnion = mulberry32((h.seed | 0) + 88117), rndSuccession = mulberry32((h.seed | 0) + 88121);
    function peacefulUnions(y, alivePs) {
      if ((y / TICK) % 2) return;
      const maxSize = Math.min(14, Math.max(4, Math.round(regionsPerCountry * .4)));
      for (const v of alivePs) {
        const V = P[v]; if (V.died !== null || V.rebel || V.liege >= 0 || V.crown !== undefined || V.n < 1 || V.n > maxSize / 2 || y - V.born < 30 || rndUnion() >= .10) continue;
        if (P.some(X => X.died === null && X.liege === v)) continue;
        const border = new Map();
        for (let r = 1; r <= nR; r++) if (owner[r] === v) for (let k = R.off[r]; k < R.off[r + 1]; k++) {
          const p = owner[R.nbr[k]]; if (eSea[k] || p < 0 || p === v) continue;
          border.set(p, (border.get(p) || 0) + 1);
        }
        const choices = [...border].filter(([p]) => {
          const Q = P[p]; return Q.died === null && !Q.rebel && Q.liege < 0 && Q.crown === undefined && Q.n >= V.n && Q.n <= 3 * V.n && Q.n + V.n <= maxSize &&
            y - Q.born >= 30 && libKeyOf(rulingCultureAt(Q, y)) === libKeyOf(rulingCultureAt(V, y)) && !P.some(X => X.died === null && X.liege === p);
        }).sort((a,b) => b[1] - a[1] || P[a[0]].n - P[b[0]].n || a[0] - b[0]);
        if (!choices.length) continue;
        const p = choices[0][0]; inheritOwned(v, p, y); kill(v, y, p, 'integrate'); ev(y, 'peacefulUnion', {p, q:v, r:V.cap});
      }
    }

    // ---------- 时间轴 ----------
    let ys = Infinity; for (const cr of D.cradles) ys = Math.min(ys, Y[3 * NN + cr.region]); for (let r = 1; r <= nR; r++) ys = Math.min(ys, Y[3 * NN + r]);
    ys = Math.min(E, Math.max(0, Math.floor((isFinite(ys) && ys < 1e8 ? ys : E * 0.3) / TICK) * TICK));
    // 历史一路自由推演到现在：不再向事先生成的地图收拢；现在的政治地图由历史的终局写回（见 apply.js）
    const T0 = E + TICK, TG = Infinity;
    const sg = new Int8Array(nR + 1), v = new Float64Array(nR + 1);
    const habitable = r => R.weight[r] > 0;
    const ancientFallen = new Set();
    const NAMEBIG = 8 * scale;
    const EMPN = Math.round(20 * scale); // 称帝所需的规模

    const stepStage = y => { for (let r = 1; r <= nR; r++) { let s0 = sg[r]; while (s0 < 8 && Y[(s0 + 1) * NN + r] <= y) s0++; sg[r] = s0; } };
    for (let y = 0; y < ys; y += TICK) { stepStage(y); stepHuman(y); stepCR(y, 0); if (y % 100 === 0) recordHuman(y); }
    // ---------- 思潮与国力：军事思潮决定战场上的优势，治理思潮决定官僚体系的水平；只是加成，人口与疆土仍是根本 ----------
    const IDX = {}; D.IDEAS.forEach((I, k) => IDX[I.id] = k);
    const MILW = { iron: 1, feudal: 0.5, gunpowder: 1.5, manufactory: 0.5 }, ADMW = { bureau: 1, law: 0.5, coin: 0.5, academy: 0.5, print: 0.5 };
    const has = (id, r, y) => IDX[id] !== undefined && D.ideaA[IDX[id] * NN + r] <= y;
    const milAt = (r, y) => { let m = 0; for (const id in MILW) if (has(id, r, y)) m += MILW[id]; return m; };
    const admAt = (r, y) => { let m = 0; for (const id in ADMW) if (has(id, r, y)) m += ADMW[id]; return m; };
    const ideaShare = new Float64Array(D.IDEAS.length); let shareYear = -1e9, totW = 0; for (let r = 1; r <= nR; r++) totW += R.weight[r];
    const lagAt = (r, y) => { let n = 0; for (let k = 0; k < D.IDEAS.length; k++) if (ideaShare[k] > 0.5 && !D.IDEAS[k].opt && D.ideaA[k * NN + r] > y) n++; return n; }; // 世上过半人口已接纳、此地尚未接纳的思潮
    const ruinYears=[...new Set(C.cities.map(c=>c.ruined).filter(y=>Number.isFinite(y)&&y>=ys&&y<=E))].sort((a,b)=>a-b);let ruinCursor=0;
    const enforceRuinsThrough=y=>{while(ruinCursor<ruinYears.length&&ruinYears[ruinCursor]<=y){const t=ruinYears[ruinCursor++];enforceProvinces(t,null,administration.seaChanges.get(t));}};
    // ---------- 盟约：受同一强邻威胁的国家结盟；盟国互不攻伐，遇袭相援，出征时就近的盟国可联合进军 ----------
    const rndA = mulberry32((h.seed | 0) + 31337), alliances = [], allyOf = new Map(), recentWar = new Map(), pactEnd = new Map(), warKey = (a, b) => a < b ? a * 65536 + b : b * 65536 + a;
    const allianceOf = p => { const i = allyOf.get(p); return i === undefined ? null : alliances[i]; };
    const alliesOf = p => { const A = allianceOf(p); return A ? [...A.members].filter(m => m !== p) : []; };
    function endAlliance(A, y, why) { if (A.to !== null) return; const fm = [...A.members]; for (let i = 0; i < fm.length; i++) for (let j = i + 1; j < fm.length; j++) pactEnd.set(warKey(fm[i], fm[j]), y); for (const m of A.members) { allyOf.delete(m); A.roster.push([m, A.joined.get(m), y]); } A.members.clear(); A.to = y; ev(y, 'allianceEnd', { p: A.founders[0], q: A.founders[1], a: A.id, why, r: P[A.founders[0]].cap }); }
    function leaveAlliance(p, y, why) { const A = allianceOf(p); if (!A) return; A.members.delete(p); allyOf.delete(p); A.roster.push([p, A.joined.get(p), y]); if (A.members.size < 2) endAlliance(A, y, why); else ev(y, 'allianceLeave', { p, a: A.id, why, r: P[p].cap }); }
    function allianceStep(y, alivePs, pw, reach) {
      for (const A of alliances) { if (A.to !== null) continue;
        for (const m of [...A.members]) { const q = P[m]; if (q.died !== null || q.n === 0) leaveAlliance(m, y, 'perish'); else if (q.liege >= 0 && !A.members.has(q.liege)) leaveAlliance(m, y, 'vassal'); if (A.to !== null) break; }
        if (A.to !== null) continue;
        let sum = 0; for (const m of A.members) sum += pw[m] || 0;
        const T = A.against, gone = T < 0 || P[T].died !== null || P[T].n === 0 || (pw[T] || 0) < 0.55 * sum, age = y - A.from;
        if ((gone && rndA() < 0.25) || (age > 100 && (pw[T] || 0) < 1.3 * sum && rndA() < 0.06 * age / 100)) endAlliance(A, y, gone ? 'threat' : 'age'); // 强敌仍在则不轻易散盟
      }
      if ((y - ys) % 20) return; // 每二十年议一次新盟
      const nb = new Map(); for (let a = 1; a <= nR; a++) { const p = owner[a]; if (p < 0) continue; for (let k = R.off[a]; k < R.off[a + 1]; k++) { if (eSea[k]) continue; const q = owner[R.nbr[k]]; if (q < 0 || q === p) continue; let st = nb.get(p); if (!st) nb.set(p, st = new Set()); st.add(q); } }
      const ok = p => { const q = P[p]; return q && q.died === null && q.n > 0 && !q.rebel && q.liege < 0 && q.horde === undefined && q.born < y; };
      const threats = alivePs.filter(t => ok(t) && P[t].n >= 4).sort((a, b) => pw[b] - pw[a] || a - b).slice(0, 12);
      for (const T of threats) {
        const near = [...(nb.get(T) || [])].filter(p => ok(p) && pw[p] < 0.7 * pw[T] && !(allianceOf(p) && allianceOf(p).members.has(T))).sort((a, b) => a - b);
        if (near.length < 2) continue;
        let best = null;
        for (let i = 0; i < near.length; i++) for (let j = i + 1; j < near.length; j++) { const a = near[i], b = near[j], A = allianceOf(a), B = allianceOf(b);
          if ((A && B) || (A && A.members.has(b))) continue; if ((A && A.members.size >= 5) || (B && B.members.size >= 5)) continue;
          const lw = recentWar.get(warKey(a, b)); if (lw !== undefined && y - lw < 40) continue;
          const pe = pactEnd.get(warKey(a, b)); if (pe !== undefined && y - pe < 80) continue; // 刚散的盟不会马上重订
          const adj = nb.get(a)?.has(b), d = kmBetween(P[a].cap, P[b].cap); if (!adj && d > 2.2 * Math.max(reach[a] || 0, reach[b] || 0)) continue;
          let sc = Math.min(2.5, pw[T] / Math.max(1e-6, pw[a] + pw[b])) * (adj ? 1 : 0.6);
          if (rel[P[a].cap] >= 0 && rel[P[a].cap] === rel[P[b].cap]) sc *= 1.5;
          if (P[a].civ === P[b].civ) sc *= 1.25;
          if (!best || sc > best.sc) best = { a, b, sc }; }
        if (!best || rndA() > 0.12 * best.sc) continue;
        const { a, b } = best, A = allianceOf(a) || allianceOf(b);
        if (A) { const j = A.members.has(a) ? b : a; A.members.add(j); A.joined.set(j, y); allyOf.set(j, A.id); ev(y, 'allianceJoin', { p: j, q: A.founders.find(m => A.members.has(m)) ?? [...A.members][0], a: A.id, against: T, r: P[j].cap }); }
        else { const N = { id: alliances.length, from: y, to: null, against: T, members: new Set([a, b]), joined: new Map([[a, y], [b, y]]), roster: [], founders: [a, b] }; alliances.push(N); allyOf.set(a, N.id); allyOf.set(b, N.id); ev(y, 'alliance', { p: a, q: b, a: N.id, against: T, r: P[a].cap }); }
      }
    }
    // 出征时随行的盟军：盟国在目标地旁有接壤的领土才能出兵（进攻方的盟国针对共同的敌人才一定出兵）
    function allyForces(me, foe, b, attacking, stageOf) {
      const out = []; if (me < 0) return out; const A = allianceOf(me); if (!A) return out;
      for (const a of A.members) { if (a === me || P[a].died !== null || !(P[a].n > 0)) continue;
        if (attacking && foe !== A.against && rndA() > 0.35) continue;
        let src = -1, edge = -1; for (let k = R.off[b]; k < R.off[b + 1]; k++) { if (eSea[k]) continue; if (owner[R.nbr[k]] === a) { src = R.nbr[k]; edge = R.eid[k]; break; } }
        if (src < 0) continue;
        out.push({ p: a, source: src, edge, stage: stageOf(a), cohesion: P[a].coh });
        if (out.length >= 3) break; }
      return out;
    }
    for (let y = ys; y <= E; y += TICK) {
      enforceRuinsThrough(y);
      stepStage(y);
      stepHuman(y);
      stepCR(y, 0);
      const fortPopulation = new Float64Array(nR + 1); for (let r = 1; r <= nR; r++) fortPopulation[r] = human.total(r);
      fortManager.step({ year: y, owner, population: fortPopulation, food: lastFood });
      military.beginTick({year:y,food:lastFood,owner,forts:fortManager.forts});
      for (let r = 1; r <= nR; r++) { const s0 = sg[r]; v[r] = (human.total(r) / Math.max(1, h.popTotal) / wmean) * SFV[s0]; }
      // 古文明衰亡：其政权凝聚力崩溃，随后由继承文明的王朝取代
      D.ancient.forEach((a, ai) => { if (y >= a.fall && !ancientFallen.has(ai)) { ancientFallen.add(ai); for (const q of P) if (q.died === null && q.civ === -2 - ai) q.coh = 0.05; } });
      // 1. 城邦兴起：各大陆当年合格候选轮流尝试，避免区块编号决定先后。
      const landCandidates = new Map();
      for (let r=1;r<=nR;r++) {
        if(owner[r]>=0 || sg[r]<3 || !habitable(r) || !human.total(r) || !civilized(civOfNew(r)) || (colonialAge!==null && isNW(r))) continue;
        const tp=typeOfCult(civOfNew(r)); if(!(tp==='pastoral' && R.pasture[r]>=.35) && !cityIn[r].some(i=>alive(C.cities[i],y)))continue;
        const lc=R.landComp[r];let list=landCandidates.get(lc);if(!list)landCandidates.set(lc,list=[]);list.push(r);
      }
      const groups=[...landCandidates.values()];
      for(const list of groups)for(let i=list.length-1;i>0;i--){const j=Math.floor(rndFoundOrder()*(i+1));[list[i],list[j]]=[list[j],list[i]];}
      for(let i=groups.length-1;i>0;i--){const j=Math.floor(rndFoundOrder()*(i+1));[groups[i],groups[j]]=[groups[j],groups[i]];}
      for(let k=0,more=true;more && countrySlots();k++) { more=false;
        for(const group of groups){if(k>=group.length)continue;more=true;if(!countrySlots())break;const r=group[k];if(owner[r]>=0)continue;
          const roll=rndFound()/(isNW(r)?.3:1); if(roll>=.08)continue;
          let near=false;for(let j=R.off[r];j<R.off[r+1];j++){const b=R.nbr[j];if(!R.edges[R.eid[j]].sea && owner[b]>=0 && P[owner[b]].n>3){near=true;break;}}
          if(roll<(near?.03:.08)){const p=newPolity(y,r,[],civOfNew(r,y));P[p].cityBorn=sg[r]<=3;setOwner(r,p,y);}
        }
      }
      // 2. 国力
      const alivePs = []; for (const q of P) if (q.died === null && q.n > 0) alivePs.push(q.id);
      const pw = new Float64Array(P.length), cs = new Int8Array(P.length), reach = new Float64Array(P.length), cap = new Float64Array(P.length), ptype = [];
      for (let r = 1; r <= nR; r++) if (owner[r] >= 0) pw[owner[r]] += v[r];
      for (const p of alivePs) { const q = P[p]; cs[p] = Math.max(2, sg[q.cap]); { const tc = typeOfCult(q.civ); ptype[p] = nomadAt(q) ? 'pastoral' : tc === 'pastoral' ? 'agrarian' : tc; } /* 只有仍在游牧的政权才算游牧；定居（含生来定居）的草原文明国家按农耕国家推演 */ pw[p] = Math.max(0.05, pw[p]) * (0.35 + q.coh);
        const nomadEdge = ptype[p] === 'pastoral' ? Math.max(0, Math.min(1, (7 - cs[p]) / 2)) : 0; // 骑射之利随时代消退，近代早期不再
        if (ptype[p] === 'pastoral') pw[p] *= 1 + 0.8 * nomadEdge; // 全民皆兵：牧民人口虽少，控弦之士多
        reach[p] = REACH[cs[p]] * geographicScale * (1 + 0.6 * nomadEdge) * (0.8 + 0.3 * q.coh); const sizeFactor = 0.65 + ((p * 2654435761 >>> 0) % 1000) / 1000 * 1.1;
        cap[p] = Math.max(2, Math.min(CAP[cs[p]] * scale * geographicScale * (1 + 0.4 * nomadEdge), regionsPerCountry * sizeFactor * 1.3) * (1 - .48 * fragmentation[q.cap]));
        if (q.horde !== undefined) { pw[p] *= 1.8; reach[p] *= 1.5; cap[p] = Math.max(cap[p] * 2.5, CAP[5] * scale); } } // 大汗在位：诸部合一，兵锋所向
      if (y - shareYear >= 50) { shareYear = y; ideaShare.fill(0); for (let r = 1; r <= nR; r++) { const w = R.weight[r]; if (!w) continue; for (let k = 0; k < ideaShare.length; k++) if (D.ideaA[k * NN + r] <= y) ideaShare[k] += w; } for (let k = 0; k < ideaShare.length; k++) ideaShare[k] /= Math.max(1e-9, totW); }
      const mil = new Float64Array(P.length), adm = new Float64Array(P.length), lag = new Float64Array(P.length);
      for (const p of alivePs) { const c = P[p].cap; mil[p] = milAt(c, y); adm[p] = admAt(c, y); lag[p] = lagAt(c, y); P[p].milNow = mil[p]; P[p].admNow = adm[p];
        pw[p] *= 1 + 0.04 * adm[p];                                                    // 治理思潮：赋税与动员
        reach[p] *= 1 + 0.08 * adm[p]; cap[p] *= 1 + 0.08 * adm[p]; }                   // 官僚与驿传：管得更远、更大
      for (const p of alivePs) { const L = P[p].liege; if (L >= 0 && P[L].died === null) pw[L] += 0.25 * pw[p]; } // 附庸纳贡
      const realm = new Int32Array(P.length).fill(-1); for (const p of alivePs) realm[p] = topLiege(p);
      const modP = new Uint8Array(P.length); for (const p of alivePs) modP[p] = cs[p] >= 7 || has('gunpowder', P[p].cap, y) ? 1 : 0; // 近代：火器与常备军，可以实控草原
      for (const p of alivePs) P[p].reachNow = reach[p];
      // 军制：都城接纳的军事思潮 + 政体；据此募集常备兵、部署驻地
      { const list = []; for (const p of alivePs) { const q = P[p], c = q.cap;
          const key = q.rebel ? 'levy' : G.Military.systemFor({ ideas: id => has(id, c, y), stage: cs[p], pastoral: ptype[p] === 'pastoral', style: polStyle(q) });
          const L = q.msys || (q.msys = []); if (!L.length || L[L.length - 1][1] !== key) L.push([y, key]);
          list.push({ p, sys: key, stage: cs[p], cap: c, horse: has('horse', c, y), siege: has('siegecraft', c, y) }); }
        military.deploy(list); }
      const gf = 0;
      const presentOf = p => R.country[P[p].cap];
      // 圣战只选择战争目标，动员、粮食和胜负全部由统一军事账本结算。
      const emitWarEnds = () => { for (const w of holyWars.drain()) if (w.status === 'failed') ev(y, 'holyWarFail', { p:w.attacker, q:w.defender, r:w.target, f:w.religion, war:w.id, reason:w.reason }); };
      holyWars.advance({ year:y, owner, alive:p => !!P[p] && P[p].died === null && P[p].n > 0 });
      emitWarEnds();
      const candidates = new Map();
      for (let a = 1; a <= nR; a++) { const p = owner[a]; if (p < 0 || P[p].rebel) continue;
        const f = P[p].theoRel !== undefined ? P[p].theoRel : rel[P[p].cap];
        if (f < 0 || !RELS[f] || !(G.HumanRules.effects(RELS[f]).holyWar > 0)) continue;
        const believers = human.share(a, 'religion', f); if (!(believers > 0)) continue;
        for (let k = R.off[a]; k < R.off[a + 1]; k++) { if (eSea[k]) continue; const b = R.nbr[k], q = owner[b];
          if (q < 0 || q === p || realm[p] === realm[q] || P[q].rebel) continue;
          const pop = human.total(b); if (!pop) continue;
          const foreignShare = Math.max(0, 1 - human.share(b, 'religion', f) - human.share(b, 'religion', -1)); if (foreignShare < 0.5) continue;
          const edge = R.edges[R.eid[k]], days = Math.max(0, edge.km || 0) / 24 * (1 + 0.22 * Math.max(0, edge.rough || 0));
          if (military.remaining(a) < 1) continue;
          const score = foreignShare / (1 + days / 30), prior = candidates.get(p);
          if (!prior || score > prior.score) candidates.set(p, { p,q,a,b,f,believers,foreignShare,days,score,edge:R.eid[k] });
        }
      }
      for (const x of candidates.values()) if (rndHoly() < 0.12) {
        const w = holyWars.start({ year:y, attacker:x.p, defender:x.q, source:x.a, target:x.b, religion:x.f, trait:1, foreignShare:x.foreignShare, believerShare:x.believers, adjacent:true, sea:false, owner });
        if (w) { w.travelDays = x.days; w.edge = x.edge; w.foreignShare = x.foreignShare; w.believerShare = x.believers; ev(y, 'holyWarStart', { p:x.p, q:x.q, r:x.b, f:x.f, war:w.id }); }
      }
      allianceStep(y, alivePs, pw, reach);
      // 3. 进攻：每个政权在边界上找最有把握的目标
      // 每个政权只保留把握最大的 KB 个目标（定长槽位，插入排序）
      const KB = 8, nP = P.length, pw7 = new Float64Array(nP), bestB = new Int32Array(nP * KB), bestPriority = new Float64Array(nP * KB), bestA = new Int32Array(nP * KB), bestN = new Uint8Array(nP);
      const attackFactor = new Float64Array(nR + 1), defenseFactor = new Float64Array(nR + 1);
      for (let r = 1; r <= nR; r++) { const factors = G.HolyWar.combatFactors(regionEffects(r)); attackFactor[r] = factors.attack; defenseFactor[r] = factors.defense; }
      for (const p of alivePs) pw7[p] = Math.pow(pw[p], 0.7);
      const capOf = new Int32Array(nP); for (const p of alivePs) capOf[p] = P[p].cap;
      for (let a = 1; a <= nR; a++) { const p = owner[a]; if (p < 0) continue;
        for (let kk = R.off[a]; kk < R.off[a + 1]; kk++) { const b = R.nbr[kk], sea = eSea[kk];
          const q = owner[b]; if (sea || q === p || R.weight[b] <= 0 || sg[b] < 1) continue; // 首版只推演陆地战役；海军另行增加。
          if (P[p].rebel ? q !== P[p].target : (q >= 0 && P[q].rebel && P[q].target !== p)) continue; // 起义军只与朝廷交战
          if (P[p].rebel && P[p].rebelGoal === 'independence' && q >= 0 && b === P[q].cap) continue; // 独立派争取地方自治，不攻击母国都城。
          if (q >= 0 && realm[p] === realm[q] && realm[p] >= 0) continue; // 宗主与附庸、同一宗主的附庸之间互不攻伐
          if (q >= 0 && allyOf.has(p) && allyOf.get(p) === allyOf.get(q)) continue; // 盟国互不攻伐
          const cb = P[p].colBase, lcB = R.landComp[b], dk = cb && cb.has(lcB) && R.landComp[capOf[p]] !== lcB ? Math.min(kmBetween(capOf[p], b), kmBetween(cb.get(lcB), b)) : kmBetween(capOf[p], b); // 海外殖民地：从殖民据点向内陆投送
          let att = pw7[p] * Math.exp(-dk / reach[p]) * (sea ? (polStyle(P[p]) === 'mercantile' ? 0.8 : 0.5) : 1); // 商贸型文化善于跨海投送
          if (cs[p] >= 7 && isNW(b) && !isNW(capOf[p])) att *= 1 + 0.5 * Math.max(0, cs[p] - (q >= 0 ? cs[q] : sg[b])); // 殖民者的技术优势
          if (P[p].rebel) { att *= 0.95 + Math.max(0, 0.5 - P[q].coh) * 2; if (P[p].rtype === 'peasant') att *= 1 + 0.8 * Math.exp(-kmBetween(b, capOf[q]) / 700); } // 朝廷越虚弱越难挡；农民军向都城推进
          else if (q >= 0 && P[q].rebel) att *= 0.6 + P[p].coh;
          if (q >= 0 && allyOf.has(p)) { const AL = allianceOf(p); for (const al of AL.members) { if (al === p || !(pw7[al] > 0)) continue; let touch = false; for (let k2 = R.off[b]; k2 < R.off[b + 1]; k2++) if (!eSea[k2] && owner[R.nbr[k2]] === al) { touch = true; break; } if (touch) att += (q === AL.against ? 0.35 : 0.15) * pw7[al] * Math.exp(-kmBetween(capOf[al], b) / Math.max(1, reach[al])); } } // 盟军夹击
          if (P[p].n >= cap[p]) att *= 0.35;
          if (ptype[p] !== 'pastoral' && !modP[p] && isSteppe(b)) att *= 0.5;                               // 前近代的农耕国家深入草原：补给难继，牧民远遁
          if (P[p].horde !== undefined && q >= 0 && ptype[q] !== 'pastoral') att *= 1.3;                  // 大汗南下
          { const mg = mil[p] - (q >= 0 ? mil[q] : milAt(b, y)); att *= clamp(Math.pow(1.18, mg), 0.65, 1.6); } // 军事思潮的差距：有优势，但不决定胜负
          if (q >= 0 && P[q].theo !== undefined && rel[capOf[p]] >= 0 && rel[capOf[p]] === rel[P[q].cap] && !P[p].rebel) att *= 0.4; // 同信仰的国家不愿攻打本教的教国
          if (P[p].claimLin >= 0 && coreLin[b] === P[p].claimLin && y < P[p].claimUntil) att *= 1.5; // 法统宣称
          if (coreLin[b] === P[p].lin) att *= 1.4;                                                       // 收复故土
          if (gf > 0) { const kp = presentOf(p); if (kp >= 0) att *= R.country[b] === kp ? 1 + gf : 1 - 0.6 * gf; }
          let def;
          if (q >= 0) { const dq = kmBetween(capOf[q], b); def = pw7[q] * Math.exp(-dq / reach[q]) * (1 + 0.25 * eRough[kk]) * (coreLin[b] === P[q].lin ? 1.3 : 1);
            if (P[q].liege >= 0 && realm[q] >= 0 && P[realm[q]].died === null) { const L = realm[q]; def += 0.5 * pw7[L] * Math.exp(-kmBetween(capOf[L] || P[L].cap, b) / Math.max(1, reach[L])); } // 宗主出兵相护
            if (allyOf.has(q)) for (const al of alliesOf(q)) if (pw7[al] > 0) def += 0.4 * pw7[al] * Math.exp(-kmBetween(capOf[al] || P[al].cap, b) / Math.max(1, reach[al])); // 盟国来援
            if (ptype[p] === 'pastoral' && ptype[q] !== 'pastoral' && cs[p] >= 4 && cs[p] <= 6 && !has('gunpowder', capOf[q], y)) att *= 1.3; } // 对方有了火器，骑射之利不再
          else def = (v[b] * 0.5 + 0.06) * (sg[b] >= 3 ? 1.4 : 1) * (sg[b] <= 1 ? 0.5 : 1);
          // 城市密集、地形分隔的地方政治生态中，中小邻国更难被远方大国迅速吞并。
          if (q >= 0 && !P[q].rebel && P[q].n <= Math.max(3, regionsPerCountry * 1.3)) def *= 1 + .55 * fragmentation[b];
          att *= attackFactor[a]; def *= defenseFactor[b];
          const guards = fortManager.effect(b, R.eid[kk]); if (guards) def *= 1 + 20 * guards / Math.max(1, human.total(b));
          const ratio = att / Math.max(1e-6, def), base = p * KB; let n = bestN[p];
          const priority = ratio * (holyWars.goal(p, a, b, q) ? 1.5 : 1);
          if (n === KB && priority <= bestPriority[base + KB - 1]) continue;
          let i = n < KB ? n++ : KB - 1; while (i > 0 && (bestPriority[base + i - 1] < priority || (bestPriority[base + i - 1] === priority && bestB[base + i - 1] > b))) { bestPriority[base + i] = bestPriority[base + i - 1]; bestB[base + i] = bestB[base + i - 1]; bestA[base + i] = bestA[base + i - 1]; i--; }
          bestPriority[base + i] = priority; bestB[base + i] = b; bestA[base + i] = a; bestN[p] = n; } }
      const flipped = new Uint8Array(nR + 1), lost = new Float64Array(P.length), won = new Float64Array(P.length), migr = new Map(), lostBy = new Map();
      alivePs.sort((x, z) => pw[z] - pw[x] || x - z);
      for (const p of alivePs) {
        const q0 = P[p]; if (q0.died !== null || !bestN[p]) continue;
        if (!q0.rebel && q0.horde === undefined && q0.n >= Math.max(3, cap[p] * 1.5)) continue;
        if (!q0.rebel && q0.horde === undefined && rnd() > 0.25 + 0.25 * q0.coh) continue;
        const tries = 1 + Math.floor(Math.sqrt(q0.n) / 2) + (q0.horde !== undefined ? 2 : 0); // 大汗：连年南下
        for (let t = 0, done = 0; t < bestN[p] && done < tries; t++) { const b = bestB[p * KB + t]; if (flipped[b] || owner[b] === p) continue; done++;
          const q = owner[b];
          const source = bestA[p * KB + t]; if(owner[source]!==p || q0.born >= y || (q >= 0 && P[q].born >= y))continue;
          let edge=-1;for(let k=R.off[source];k<R.off[source+1];k++)if(R.nbr[k]===b){edge=R.eid[k];break;}
          const holy=holyWars.objective(p,source,b,q), objective=holy?'holy-war':coreLin[b]===q0.lin?'homeland':bigCity(b,y)>=0?'city':'border';
          const ci=bigCity(b,y),cpop=ci>=0?popAt(ci,y):0,isCap=q>=0&&P[q].cap===b;
          const city=ci>=0?{i:ci,pop:cpop,capital:isCap,walls:sg[b]>=3&&(cpop>=3000||isCap)}:null;
          const stageOf=a=>Math.max(2,sg[P[a].cap]),allies={attacker:q0.rebel?[]:allyForces(p,q,b,true,stageOf),defender:q>=0&&!P[q].rebel?allyForces(q,p,b,false,stageOf):[]};
          const campaign=military.resolve({year:y,attacker:p,defender:q,source,target:b,edge,stage:cs[p],defenderStage:q>=0?cs[q]:sg[b],cohesion:q0.coh,defenderCohesion:q>=0?P[q].coh:.6,objective,religion:holy?holy.religion:undefined,city,allies});
          holyWars.battle(campaign);
          if (campaign.id === null) continue;
          if(q>=0)recentWar.set(warKey(p,q),y); for(const al of allies.attacker)if(q>=0)recentWar.set(warKey(al.p,q),y); for(const al of allies.defender)recentWar.set(warKey(al.p,p),y);
          if(campaign.status!=='won')continue;
          if (q >= 0 && !P[q].rebel && !q0.rebel && ptype[p] !== 'pastoral' && !modP[p] && ptype[q] === 'pastoral' && P[q].horde === undefined && q0.liege < 0 && P[q].liege < 0 && rnd() < 0.75) { // 前近代：击败游牧政权多半只令其称臣纳贡，册封为藩，不能直辖
            if (!holy && !P.some(X => X.died === null && X.liege === q)) { flipped[b] = 1; setLiege(q, p, y, 'tributary'); military.setControl(campaign,q,'tributary'); done++; continue; } }
          if (q >= 0 && !P[q].rebel && !q0.rebel && feudal(cs[p], y) && q0.liege < 0 && P[q].liege < 0 && !P[q].vasOf && P[q].n <= Math.max(4, 0.5 * q0.n) && rnd() < 0.6 * ({ feudal: 1.3, bureaucratic: 0.6 }[polStyle(q0)] || 1)) { // 封建时代：不吞并，收为附庸
            if (!holy && !P.some(X => X.died === null && X.liege === q)) { flipped[b] = 1; setLiege(q, p, y, 'submit'); military.setControl(campaign,q,'vassal'); done++; continue; } }
          flipped[b] = 1; setOwner(b, p, y); won[p]++;
          if (isNW(b) && !isNW(P[p].cap) && cs[p] >= 7) { if (rndK() < 0.4) setCult(b, P[p].civ, y); if (rndK() < 0.4 && rel[P[p].cap] >= 0) setRel(b, rel[P[p].cap], y); } // 殖民统治的文化与传教影响
          if (ptype[p] === 'pastoral' && P[p].civ !== cult[b] && rndC() < (v[b] < 0.6 ? 0.55 : 0.3) * pastureFit(b)) { for (let k = R.off[b]; k < R.off[b + 1]; k++) { const a = R.nbr[k]; if (owner[a] === p && moveCult(a, b, P[p].civ, y, R.edges[R.eid[k]])) { migr.set(p, (migr.get(p) || 0) + 1); break; } } }
          if (q >= 0) { lost[q]++; { let m = lostBy.get(q); if (!m) lostBy.set(q, m = new Map()); m.set(p, (m.get(p) || 0) + 1); }
            const Q = P[q];
            if (b === Q.cap && P[p].rebel && P[p].target === q && P[p].rebelGoal === 'overthrow') { overthrow(p, q, y, b); continue; } // 起义军攻入都城：推翻王朝
            if (b === Q.cap) { // 攻破都城
              const city = bigCity(b, y); if (city >= 0) { sacks.push(city, y, 0.45); if (Q.peakN >= 3) ev(y, 'sack', { p, q, city, r: b, gun: has('gunpowder', capOf[p], y) && !has('gunpowder', capOf[q], y) }); }
              if (ptype[p] === 'pastoral' && ptype[q] !== 'pastoral' && Q.n >= 4 && cs[q] >= 4) { // 外族入主
                const inherited = []; for (let r = 1; r <= nR; r++) if (owner[r] === q) inherited.push(r); inheritRegions(inherited.map(r => [r, p]), y); for (const r of inherited) { flipped[r] = 1; if (P[p].civ !== cult[r] && rndC() < 0.25 * pastureFit(r)) setCult(r, P[p].civ, y); }
                ev(y, 'nomad', { p, q, r: b, city }); kill(q, y, p, 'nomadic'); if (P[q].org && !P[p].org) P[p].org = y;
                if (rnd() < 0.6) { P[p].cap = b; P[p].caps.push({ year: y, city, r: b }); P[p].lastCapMove = y; if (P[p].settled === undefined && Q.peakN >= 6) { P[p].settled = y; P[p].settledCiv = cult[b]; if (cult[b] !== -1 && cult[b] !== P[p].civ) P[p]._settledRegion = b; if (R.pasture[b] < 0.3) P[p].leftSteppe = true; } } /* 入主并定都旧都：改行定居王朝 */
              } else if (Q.n > 0) moveCapital(q, y, 'sack');
            } else { const city = bigCity(b, y); if (city >= 0 && rnd() < 0.3) sacks.push(city, y, 0.25); }
            if (Q.n === 0 && !Q.rebel) kill(q, y, p); } } }
      for (const [p, n] of migr) if (n >= 2) ev(y, 'migrate', { p, c: P[p].civ, n, r: P[p].cap });
      // 大国兵败失地：一步之内被同一敌国夺去三块以上、且过一成的疆土（亡国的另有吐并之事）
      for (const [q, m] of lostBy) { const Q = P[q]; if (Q.died !== null || Q.rebel || Q.peakN < NAMEBIG || y - (Q.lastDefeat || -1e9) < 50) continue;
        let bp = -1, bn = 0; for (const [p, c] of m) if (c > bn) { bn = c; bp = p; } if (bp < 0 || P[bp].rebel || bn < 3 || bn < 0.12 * (Q.n + bn)) continue; Q.lastDefeat = y; ev(y, 'defeat', { p: bp, q, n: bn, r: Q.cap }); }
      for (const p of alivePs) { const q = P[p]; if (q.died !== null || q.peakN < NAMEBIG * 0.6) continue; const sr = q.theoRel !== undefined ? q.theoRel : rel[q.cap]; if (q.stateRel === undefined) q.stateRel = sr; else if (sr !== q.stateRel) { q.stateRel = sr; if (sr >= 0) ev(y, 'convert', { p, f: sr, r: q.cap }); } }
      // 4. 凝聚力、核心领土与危机
      const foreignN = new Float64Array(P.length), steppeN = new Float64Array(P.length); for (let r = 1; r <= nR; r++) { const p = owner[r]; if (p < 0) continue; const cu = cult[r]; if (cu !== P[p].civ && cu !== -1) foreignN[p]++; if (isSteppe(r) && cu >= 0 && typeOfCult(cu) === 'pastoral') steppeN[p]++; }
      for (const p of alivePs) { const q = P[p]; if (q.died !== null || q.n === 0) { if (q.died === null && !q.rebel) kill(p, y, -1); continue; }
        if (q.rebel) { q.coh = 0.75; continue; }
        const foreign = foreignN[p];
        const over = q.n / cap[p] - 1, age = y - q.dynStart;
        // 王朝危机随年代增长而更可能出现，但不是固定寿命；少数家族可能延续很久。
        // 家族和国家分别计时：延续性国家换家族时不视为国家灭亡。
        const houseIndex = (q.dyn || []).length / 2, japan = /japanese/i.test(libKeyOf(rulingCultureAt(q, y)));
        const endurance = ((Math.imul(p + 1, 1103515245) + Math.imul(houseIndex + 1, 12345)) >>> 0) % 1000;
        const longHouse = endurance < (japan ? 180 : 35);
        const successionRisk = age < 120 ? 0 : age < 200 ? .012 : age < 300 ? .035 : age < 450 ? .08 : age < 650 ? .13 : .20;
        if (q.horde === undefined && rndSuccession() < successionRisk * (longHouse ? .20 : 1)) { dynasty(p, y); continue; }
        // 过度扩张的国家会因地方分权产生危机，而不是靠高凝聚力永久维持巨型版图。
        if (q.n >= 8 && q.n > cap[p] * 1.45 && countrySlots() && y - (q.lastSizeCrisis ?? q.born) >= 50) {
          q.lastSizeCrisis = y; crisis(p, y, cap[p], foreign / q.n); continue;
        }
        q.coh += 0.0015 * adm[p] + 0.0035 * adm[p] * Math.max(0, over) - 0.003 * lag[p]; // 治理思潮使国家稳固、减轻疆域过大之累；落后于时代的思潮则人心浮动
        const gst = polStyle(q); q.coh += (gst === 'bureaucratic' ? 0.0105 * Math.max(0, over) : 0) - (gst === 'tribal' ? 0.003 : 0); // 官僚制较能维系大国；部族制易离散
        q.coh += 0.016 - 0.035 * Math.max(0, over) - 0.012 * (foreign / q.n) - 0.02 * Math.min(3, lost[p]) + 0.006 * Math.min(3, won[p]) - (age > 160 ? (0.025 + 0.014 * (age - 160) / 100) * (longHouse ? .15 : 1) : 0) - 0.01 * rnd();
        if (q.theo !== undefined) q.coh += 0.006; // 神权：以教统民，较为稳固
        if (ptype[p] !== 'pastoral' && !modP[p]) q.coh -= 0.03 * steppeN[p] / q.n; // 直辖草原诸部：叛服无常，耗费甚巨
        q.coh = clamp(q.coh, 0, 1.2);
        if (q.horde !== undefined) q.coh = Math.max(q.coh, 0.75); // 大汗在世：诸部慑服
        if (q.peakN >= NAMEBIG) { // 中衰：凝聚力跌落时记下衰落的缘由（王朝老去、疆域过广、兵败、异族离心、落后于时代）
          if (q.coh < 0.3 && !q.decayed && y - q.born >= 60 && y - (q.lastDecay || -1e9) >= 100) { q.decayed = true; q.lastDecay = y;
            const why = age > 220 ? 'age' : over > 0.3 ? 'over' : lost[p] >= 2 ? 'war' : foreign / q.n > 0.4 ? 'foreign' : lag[p] >= 2 ? 'lag' : 'court'; ev(y, 'decay', { p, why, r: q.cap }); }
          else if (q.coh > 0.65) q.decayed = false; }
        if (q.coh < 0.18) crisis(p, y, cap[p], foreign / q.n);
      }
      for (let r = 1; r <= nR; r++) { const p = owner[r]; if (p >= 0 && y - linOwnSince[r] >= 150) coreLin[r] = P[p].lin; }
      // 由盛转衰：疆土跌到鼎盛时的六成、三成以下时各记一笔；重新兴盛后再衰可以再记
      for (const p of alivePs) { const q = P[p]; if (q.died !== null || q.rebel || !q.n || q.peakN < NAMEBIG) continue; const lv = q.waneLv || 0;
        if (q.n >= 0.9 * q.peakN) { q.waneLv = 0; continue; }
        if (lv < 2 && q.n <= 0.33 * q.peakN) { q.waneLv = 2; ev(y, 'wane', { p, lv: 2, n: q.n, peak: q.peakN, r: q.cap }); }
        else if (lv < 1 && q.n <= 0.6 * q.peakN) { q.waneLv = 1; ev(y, 'wane', { p, lv: 1, n: q.n, peak: q.peakN, r: q.cap }); } }
      steppeStep(y, alivePs, ptype, modP);
      reviewCapitals(y, alivePs, ptype); reviewTheocracy(y, alivePs, ptype); schismStep(y, alivePs);
      // 4d. 宗藩的维系、脱离与撤藩
      for (const v of alivePs) { const V = P[v]; if (V.died !== null || V.liege < 0) continue; let L = V.liege;
        if (P[L].died !== null) { const succ = P[L].children.find(c => c.kind === 'dynasty' && P[c.id].died === null); if (succ) { setLiege(v, succ.id, y, 'dynasty', true); L = succ.id; } else { setLiege(v, -1, y, 'free'); continue; } }
        if (V.n === 0) continue; const Lq = P[L], csL = Math.max(2, sg[Lq.cap]), late = csL >= 7 || y >= 4300 ? 1 : 0, held = y - (V.vasSince || y);
        const pFree = 0.006 + 0.1 * Math.max(0, 0.4 - Lq.coh) + (V.n > 0.5 * Lq.n ? 0.04 : 0) + (V.n > Lq.n ? 0.3 : 0) + 0.05 * late; /* 附庸比宗主还大：很快脱离 */
        const steppeV = nomadAt(V, y) && !nomadAt(Lq, y) && !modP[L]; // 草原藩属：前近代的农耕宗主无力改土归流
        const pAnnex = steppeV ? 0 : held >= 120 && Lq.coh > 0.55 && V.n <= 0.35 * Lq.n ? 0.015 + 0.08 * late : late && held >= 60 && V.n <= Lq.n ? 0.07 : 0; /* 集权时代：撤藩直辖 */
        const roll = rnd();
        if (roll < pAnnex) { inheritOwned(v, L, y); for (const X of P) if (X.died === null && X.liege === v) setLiege(X.id, L, y, 'dynasty', true); setLiege(v, -1, y, 'annexV'); kill(v, y, L, 'integrate'); }
        else if (roll < pAnnex + pFree) setLiege(v, -1, y, 'free'); }
      // 4e. 封建时代：弱小邻国向强邻称臣（国力相差四倍以上）
      for (const v of alivePs) { const V = P[v]; if (V.died !== null || V.rebel || V.liege >= 0 || V.n === 0 || V.n > 6 || cs[v] < 3 || rnd() > 0.05) continue; if (P.some(X => X.died === null && X.liege === v)) continue;
        let best = -1, bp = 0; for (let r = 1; r <= nR; r++) { if (owner[r] !== v) continue; for (let k = R.off[r]; k < R.off[r + 1]; k++) { const o = owner[R.nbr[k]]; if (o < 0 || o === v || P[o].rebel || P[o].died !== null || P[o].liege >= 0 || !feudal(cs[o], y)) continue; if (pw[o] > bp) { bp = pw[o]; best = o; } } }
        if (best >= 0 && bp > 4 * pw[v]) setLiege(v, best, y, 'submit'); }
      // 4b. 行政建制：古典时代起初置行省；新占领土地军管后设制；王朝衰弱时远省割据
      enforceProvinces(y);
      for (const p of alivePs) { const q = P[p]; if (q.died !== null || q.n === 0 || q.rebel) continue; if (!q.org && cs[p] >= 5 && q.n >= 3) organize(p, y);
        else if (q.org && q.coh < 0.35 && q.n >= 6 && !(isNW(q.cap) && typeOfCult(q.civ) === "new-world") && rnd() < 0.12) secedeProvince(p, y, reach[p]); }
      incorporatePockets(y, cap);
      admin(y);
      unrestStep(y, alivePs, cs, cap, reach);
      colonize(y, alivePs, cs);
      settleDetachedTerritory(y); separateFragments(y);enforceProvinces(y);
      if ((y / TICK) % 2 === 0) { const a = new Uint8Array(nR + 1); for (let r = 1; r <= nR; r++) a[r] = Math.min(255, Math.round(unrest[r] * 255)); unrestSamples.push(y, a); }
      // 5. 复国：同文明的政权夺回已亡之国四分之三以上的核心
      if ((y / TICK) % 5 === 0) for (const p of alivePs) { const q = P[p]; if (q.died !== null || q.restoreOf !== undefined || q.rebel) continue;
        for (const X of P) { if (X.died === null || X.died >= q.born || X.restored || X.peakN < NAMEBIG || X.civ !== q.civ || X.lin === q.lin || y - X.died < 60 || y - X.died > 600 || !X.coreAtDeath || X.coreAtDeath.length < 4 || q.n < X.coreAtDeath.length) continue;
          let own = 0; for (const r of X.coreAtDeath) if (owner[r] === p) own++;
          if (own >= 0.75 * X.coreAtDeath.length && linkRestoration(P, p, X.id, y, owner, 0.75)) { q.coh = Math.min(1.2, q.coh + 0.3); ev(y, 'restore', { p, q: X.id, r: q.cap });
            if (X.crownS !== undefined && q.crown === undefined && q.liege < 0 && !crownOf.has(X.crownS) && crownOf.size < EMPMAX) crown(p, y, 'restore', X.id, X.crownS); // 复国：重奉故国的帝统
            break; } } }
      // 6. 统一：城邦时代的政权吞并多座城邦，建立王国
      for (const p of alivePs) { const q = P[p]; if (q.died !== null || q.unified || !q.cityBorn) continue; if (q.n >= 4 && cs[p] >= 4) { q.unified = true; ev(y, 'unify', { p, r: q.cap, n: q.n }); } }
      // 6b. 帝统：本文化圈首屈一指的大国称帝（同一文化圈一个、全世界至多 EMPMAX 个）；公国晋为王国
      crownStep(y, alivePs, cs);
      peacefulUnions(y, alivePs);
      // 7. 规模采样（单国视角用）
      if ((y / TICK) % 5 === 0) for (const q of P) if (q.died === null && q.n > 0) q.ext.push(y, q.n);
      enforceProvinces(y);
      // 目标必须确由本轮战斗占领且此时仍在手；建立独立教国不改变人口。
      for (const w of holyWars.settle({ year:y, owner })) {
        if (!countrySlots()) { ev(y, 'holyWarConquest', { p:w.attacker, q:w.defender, r:w.target, f:w.religion, war:w.id }); continue; }
        const p = newPolity(y, w.target, [{ id:w.attacker, kind:'holyWar' }], rulingCultureAt(P[w.attacker], y));
        P[p].theo = y; P[p].theoRel = w.religion; P[p].stateRel = w.religion;
        setOwner(w.target, p, y); w.createdPolity = p;
        const campaign=military.output().campaigns.find(c=>c.id===w.campaignId);if(campaign)military.setControl(campaign,p,'holy-state');
        ev(y, 'holyWarWon', { p, q:w.defender, r:w.target, f:w.religion, war:w.id });
      }
      emitWarEnds();
      // 战争或割据可能改变同年归属；日志取本轮结束后的属主，不再建新堡。
      for (let r = 1; r <= nR; r++) fortPopulation[r] = human.total(r);
      fortManager.step({ year: y, owner, population: fortPopulation, food: lastFood, allowBuild: false, refreshOnly:true });
      military.endTick();
      if (y % 100 === 0 || y + TICK > E) recordHuman(y);
    }
    if (humanSnapshots.length && humanSnapshots[humanSnapshots.length - 1].year < E) recordHuman(E, lastHumanTick);

    // ---------- 草原：诸部难以统一；偶有雄主统一草原、挥师入侵农耕之地——入主成功则定居封建化，否则雄主死后诸部离散、退回草原；
    //            前近代农耕国家直辖的草原诸部容易叛离，多半只能册封为藩 ----------
    function steppeKid(c, y, parentNomad) { // 新立政权是否游牧：看它实际拥有的土地，不看王庭恰好落在哪里
      const Q = P[c]; if (typeOfCult(Q.civ) !== 'pastoral' && !parentNomad) return; let sw = 0, aw = 0, best = -1, bp = -1;
      for (let r = 1; r <= nR; r++) if (owner[r] === c) { const w = R.weight[r] + 1e-6; aw += w; if (isSteppe(r)) { sw += w; if (R.pasture[r] > bp) { bp = R.pasture[r]; best = r; } } }
      if (aw <= 0) return; const sh = sw / aw;
      if (sh >= 0.6 && Q.n >= 2 && rnd() < (typeOfCult(Q.civ) === 'pastoral' ? 0.9 : 0.5)) { Q.nomad = true; delete Q.settled; delete Q.settledCiv; delete Q._settledRegion; delete Q.leftSteppe; if (R.pasture[Q.cap] < 0.3 && best >= 0) { Q.cap = best; Q.caps[Q.caps.length - 1] = { year: Q.caps[Q.caps.length - 1].year, city: bigCity(best, y), r: best }; } }
      else if (sh < 0.4 && Q.nomad && Q.settled === undefined) { Q.settled = y; Q.settledCiv = settleCivOf(Q.cap, Q.civ); if (Q.settledCiv !== Q.civ && Q.settledCiv === cult[Q.cap]) Q._settledRegion = Q.cap; Q.leftSteppe = true; } }
    function nomadSplit(p, y, regs, kind) { // 把一片草原按相距较远的几个中心分给几个部族（游牧）
      const q = P[p], k = Math.min(4, 1 + Math.floor(regs.length / 5), 1 + countrySlots()), seeds = [q.cap];
      const ranked = regs.filter(r => r !== q.cap).sort((a, b) => kmBetween(b, q.cap) - kmBetween(a, q.cap) || a - b);
      for (const r of ranked) { if (seeds.length >= k) break; if (seeds.every(s => kmBetween(s, r) > 300)) seeds.push(r); }
      if (seeds.length < 2) return [];
      const set = new Set(regs), part = new Map(), queue = []; seeds.forEach((s, i) => { part.set(s, i); queue.push(s); });
      for (let i = 0; i < queue.length; i++) { const a = queue[i]; for (let kk = R.off[a]; kk < R.off[a + 1]; kk++) { const b = R.nbr[kk]; if (set.has(b) && !part.has(b) && owner[b] === p) { part.set(b, part.get(a)); queue.push(b); } } }
      const kids = []; for (let i = 1; i < seeds.length; i++) { const c = newPolity(y, seeds[i], [{ id: p, kind }], rulingCultureAt(q, y)); P[c].nomad = true; delete P[c].settled; delete P[c].settledCiv; delete P[c]._settledRegion; delete P[c].leftSteppe; P[c].coh = 0.6; kids.push(c); }
      inheritRegions(regs.filter(r => part.get(r) > 0 && owner[r] === p).map(r => [r, kids[part.get(r) - 1]]), y);
      return kids.filter(c => P[c].n > 0 || (P[c].died = y, false));
    }
    function steppeStep(y, alivePs, ptype, modP) {
      for (const p of alivePs) { const q = P[p]; if (q.died !== null || q.n === 0 || q.rebel) continue;
        // 1. 大汗崛起：草原诸部偶有雄主出，号令诸部
        if (q.horde === undefined && nomadAt(q, y) && !modP[p] && q.n >= 2 && q.coh >= 0.5 && y - (q.lastHorde || -1e9) >= 200 && rnd() < 0.004 * Math.min(2.5, q.n / 3)) {
          q.horde = y; q.hordeEnd = y + 40 + Math.floor(rnd() * 6) * 10; q.coh = Math.max(q.coh, 1); q.hordeLost = 0;
          if (q.liege >= 0) setLiege(p, -1, y, 'free', true); ev(y, 'horde', { p, r: q.cap }); }
        if (q.horde !== undefined) {
          // 2. 大汗在位：相邻的游牧部族纷纷归附
          if (y < q.hordeEnd) { const nb = new Set(); for (let r = 1; r <= nR; r++) if (owner[r] === p) for (let k = R.off[r]; k < R.off[r + 1]; k++) { const o = owner[R.nbr[k]]; if (o >= 0 && o !== p) nb.add(o); }
            for (const v of nb) { const V = P[v]; if (V.died !== null || V.rebel || V.horde !== undefined || !nomadAt(V, y) || V.n > q.n || rnd() > 0.35) continue;
              inheritOwned(v, p, y); for (const X of P) if (X.died === null && X.liege === v) setLiege(X.id, p, y, 'dynasty', true);
              if (V.liege >= 0) setLiege(v, -1, y, 'free', true); if (V.peakN >= 2) ev(y, 'hordeJoin', { p, q: v, r: V.cap }); kill(v, y, p, 'integrate'); }
            continue; }
          // 3. 大汗死：入主成功的已定居封建化（草原故地可能另立汗国）；没有成功的诸部离散、退回草原
          delete q.horde; q.lastHorde = y;
          if (!nomadAt(q, y)) { const home = []; for (let r = 1; r <= nR; r++) if (owner[r] === p && isSteppe(r) && cult[r] >= 0 && typeOfCult(cult[r]) === 'pastoral' && kmBetween(r, q.cap) > 400) home.push(r);
            if (home.length >= 3 && rnd() < 0.6) { const far = home.sort((a, b) => kmBetween(b, q.cap) - kmBetween(a, q.cap) || a - b)[0], grp = [far], seen = new Set(grp), hs = new Set(home);
              for (let i = 0; i < grp.length; i++) for (let k = R.off[grp[i]]; k < R.off[grp[i] + 1]; k++) { const b = R.nbr[k]; if (hs.has(b) && !seen.has(b)) { seen.add(b); grp.push(b); } }
              if (grp.length >= 3 && countrySlots()) { const c = newPolity(y, far, [{ id: p, kind: 'secede' }], cult[far]); P[c].nomad = true; delete P[c].settled; delete P[c].settledCiv; delete P[c]._settledRegion; delete P[c].leftSteppe; P[c].coh = 0.8; for (const r of grp) setOwner(r, c, y); ev(y, 'steppeHome', { p: c, q: p, r: far }); } }
            continue; }
          let gave = 0; const left = []; for (let r = 1; r <= nR; r++) if (owner[r] === p && R.pasture[r] < 0.35) left.push(r);
          const rest = []; for (const r of left) { const o = prevOwner[r]; if (o >= 0 && o !== p && P[o].died === null && !P[o].rebel && P[o].n > 0) { setOwner(r, o, y); gave++; } else rest.push(r); }
          const rs = new Set(rest), seen = new Set(); for (const r0 of rest) { if (seen.has(r0) || owner[r0] !== p || r0 === q.cap) continue; const grp = [r0]; seen.add(r0);
            for (let i = 0; i < grp.length; i++) for (let k = R.off[grp[i]]; k < R.off[grp[i] + 1]; k++) { const b = R.nbr[k]; if (rs.has(b) && !seen.has(b) && owner[b] === p && b !== q.cap) { seen.add(b); grp.push(b); } }
            const seat = bigRegion(grp, y), civ = civOfNew(seat);
            if (!civilized(civ)) { releaseTribes(p, grp, y); gave += grp.length; continue; }
            if (!countrySlots()) continue;
            const c = newPolity(y, seat, [{ id: p, kind: 'secede' }], civ); P[c].coh = 0.8; for (const r of grp) setOwner(r, c, y); gave += grp.length; ev(y, 'secede', { p: c, q: p, r: seat }); }
          const st = []; for (let r = 1; r <= nR; r++) if (owner[r] === p) st.push(r);
          const kids = q.n >= 4 ? nomadSplit(p, y, st, 'split') : []; q.coh = Math.min(q.coh, 0.45);
          const lostCrown = q.crown !== undefined; if (lostCrown) uncrown(p, y); // 草原上的帝号系于大汗一身：诸部离散，帝号随之断绝
          ev(y, 'hordeFall', { p, kids, r: q.cap, gave, lostCrown });
          continue; }
        // 4. 前近代农耕国家直辖的草原：诸部叛离，另立汗国（国势尚强时多半册封为藩）
        if (ptype[p] !== 'pastoral' && !modP[p] && countrySlots()) { const sp = []; for (let r = 1; r <= nR; r++) if (owner[r] === p && r !== q.cap && isSteppe(r) && cult[r] >= 0 && typeOfCult(cult[r]) === 'pastoral') sp.push(r);
          if (!sp.length || rnd() > (0.02 + 0.006 * Math.min(10, sp.length)) * (1.4 - Math.min(1, q.coh))) continue; // 草原越大，越难羁縻
          const far = sp.sort((a, b) => kmBetween(b, q.cap) - kmBetween(a, q.cap) || a - b)[0], ss = new Set(sp), grp = [far], seen = new Set(grp);
          for (let i = 0; i < grp.length && grp.length < 14; i++) for (let k = R.off[grp[i]]; k < R.off[grp[i] + 1]; k++) { const b = R.nbr[k]; if (ss.has(b) && !seen.has(b) && grp.length < 14) { seen.add(b); grp.push(b); } }
          const c = newPolity(y, far, [{ id: p, kind: 'secede' }], cult[far]); P[c].nomad = true; delete P[c].settled; delete P[c].settledCiv; delete P[c]._settledRegion; delete P[c].leftSteppe; P[c].coh = 0.75; for (const r of grp) setOwner(r, c, y);
          const trib = q.coh > 0.6 && q.liege < 0 && rnd() < 0.6; if (trib) setLiege(c, p, y, 'tributary', true); ev(y, 'steppeRevolt', { p: c, q: p, r: far, n: grp.length, trib }); }
      }
    }
    // ---------- 迁都：都城须有城邑；疆域广阔时迁往居中的大城以便统治；游牧入主农耕之地后定居 ----------
    function reachOf(p) { return P[p].reachNow || 600; }
    function reviewCapitals(y, alivePs, ptype) {
      for (const p of alivePs) { const q = P[p]; if (q.died !== null || q.n === 0 || q.rebel) continue;
        const own = []; for (let r = 1; r <= nR; r++) if (owner[r] === p) own.push(r);
        const lastCity = q.caps[q.caps.length - 1].city;
        // 1. 都城没有城邑：换到本国有城的地方（城建起来了就补记）
        if ((lastCity < 0 || !alive(C.cities[lastCity], y)) && ptype[p] !== 'pastoral') { let best = -1, bp = 0; for (const r of own) { const v = regionPop(r, y); if (v > bp) { bp = v; best = r; } } if (best >= 0) { moveCapital(p, y, 'found', best); continue; } } // 游牧政权的王庭逐水草而居，不必定都城邑
        // 2. 游牧政权入主农耕之地：人口多半已在定居地区，迁都最大的农耕城市，改行定居王朝
        //    判定看土地而不看文化：游牧部族迁入农耕区、森林后，那里的文化虽随之改变，但已不是草原——
        //    都城离开草原，或人口过半住在草原之外，就定居下来、改行封建王朝，不再称汗国
        if (ptype[p] === 'pastoral' && q.settled === undefined) { let offW = 0, allW = 0, best = -1, bp = 0;
          for (const r of own) { const w = R.weight[r] + 1e-6; allW += w; if (R.pasture[r] < 0.35) { offW += w; if (sg[r] >= 3) { const v = regionPop(r, y); if (v > bp) { bp = v; best = r; } } } }
          const capOff = R.pasture[q.cap] < 0.3;
          if ((capOff || (offW > 0.5 * allW && best >= 0)) && rnd() < (capOff ? 0.5 : 0.3)) {
            const at = capOff ? q.cap : best; q.settled = y; q.settledCiv = settleCivOf(at, q.civ); if (q.settledCiv !== q.civ && q.settledCiv === cult[at]) q._settledRegion = at; q.leftSteppe = true; q.coh = Math.max(q.coh, 0.7);
            if (at !== q.cap) { moveCapital(p, y, 'settle', at); ev(y, 'settle', { p, city: q.caps[q.caps.length - 1].city, r: at }); } else ev(y, 'sedent', { p, r: q.cap });
            continue; } }
        // 2b. 近代早期（火器、驿传普及）以后，游牧政权陆续定居，改行定居王朝
        if (ptype[p] === 'pastoral' && q.settled === undefined && sg[q.cap] >= 7 && rnd() < 0.12) { q.settled = y; q.settledCiv = q.civ; ev(y, 'sedent', { p, r: q.cap }); continue; }
        // 3. 疆域广阔、都城偏居一隅：迁往离全国人口更近的大城（每三十年评估一次，两次迁都至少相隔一百二十年）
        if (q.n < 8 || (y / TICK) % 3 !== p % 3 || y - (q.lastCapMove || q.born) < 120) continue;
        const cand = own.filter(r => regionPop(r, y) > 0).sort((a, b) => regionPop(b, y) - regionPop(a, y) || a - b).slice(0, 10); if (!cand.includes(q.cap)) cand.push(q.cap);
        const step = Math.max(1, Math.floor(own.length / 60)), meanD = r => { let s0 = 0, w0 = 0; for (let i = 0; i < own.length; i += step) { const o = own[i], w = R.weight[o] + 1e-4; s0 += w * kmBetween(r, o); w0 += w; } return s0 / Math.max(1e-9, w0); };
        const pref = r => (cult[r] === q.civ ? 1 : 1.3) * (q.settled !== undefined && typeOfCult(cult[r]) === 'pastoral' ? 1.4 : 1);
        const curD = meanD(q.cap) * pref(q.cap), curP = regionPop(q.cap, y); let best = -1, bs = curD;
        for (const r of cand) { if (r === q.cap || regionPop(r, y) < 0.35 * curP) continue; const d = meanD(r) * pref(r); if (d < bs) { bs = d; best = r; } }
        if (best >= 0 && curD > 1.4 * bs && curD > 0.35 * reachOf(p) && rnd() < 0.35) moveCapital(p, y, 'center', best); }
    }
    // ---------- 神权：圣城为都、奉本教为国教的国家，可能由祭司掌权，政教合一 ----------
    function reviewTheocracy(y, alivePs, ptype) {
      for (const p of alivePs) { const q = P[p]; if (q.died !== null || q.rebel || q.theo !== undefined || q.n === 0 || q.n > 14 || ptype[p] === 'pastoral' || q.republic) continue;
        const f = holyOf[q.cap]; if (f < 0 || rel[q.cap] !== f || sg[q.cap] < 4 || y - RELS[f].founded < 60) continue;
        if (attemptTheocracy(q, f, RELS[f], y, polStyle(q), rnd())) ev(y, 'theocracy', { p, f, r: q.cap }); }
    }
    // ---------- 教派分裂：传播广、历史久的宗教，远离圣地的大国另立教派（派别名取自宗教库） ----------
    function schismStep(y, alivePs) {
      if (nRel >= RCAP) return; const cnt = new Int32Array(nRel); for (let r = 1; r <= nR; r++) if (rel[r] >= 0) cnt[rel[r]]++;
      for (let f = 0; f < nRel; f++) { const F0 = RELS[f]; if (!relOn[f] || F0.depth >= 1 || y - F0.founded < 500 || y - F0.lastSchism < 450 || (F0.nSchism || 0) >= 2 || cnt[f] < Math.max(30, nR * 0.03)) continue; /* 每个宗教至多分出两派，派中不再分派 */
        const br = (F0.branches || []).filter(b => !F0.usedBr.has(b) && !D.usedNames.has(b) && !D.usedNames.has(F0.name.slice(0, 2) + b)); if (!br.length) continue;
        const pr = (F0.spread === 'missionary' ? 1 : 0.35) * ({ monotheist: 1.4, dualist: 1.2, dharmic: 1.2 }[F0.type] || 0.5) * 0.012; if (rnd() > pr) continue;
        let best = -1, bs = 0; for (const p of alivePs) { const q = P[p]; if (q.died !== null || q.rebel || q.n < 4 || rel[q.cap] !== f || (F0.origin && owner[F0.origin] === p)) continue; const d = F0.origin ? kmBetween(q.cap, F0.origin) : 0; if (d < 900) continue; const v = q.n * d; if (v > bs) { bs = v; best = p; } }
        if (best < 0) continue; const b0 = br[Math.floor(rnd() * br.length)]; F0.usedBr.add(b0); F0.lastSchism = y; F0.nSchism = (F0.nSchism || 0) + 1;
        const name = D.usedNames.has(b0) ? F0.name.slice(0, 2) + b0 : b0; D.usedNames.add(name);
        const g = nRel++, q = P[best], col = F0.color ? F0.color.map((v, i) => Math.max(0, Math.min(255, v + [40, -30, 20][(g + i) % 3]))) : null;
        RELS.push(Object.assign({}, F0, { name, founded: y, origin: q.cap, parent: f, depth: F0.depth + 1, color: col, usedBr: new Set([b0]), lastSchism: y, cult: q.civ }));
        relOn[g] = 1; if (holyOf[q.cap] < 0) holyOf[q.cap] = g;
        for (let r = 1; r <= nR; r++) if (rel[r] === f && (owner[r] === best ? rndC() < 0.85 : (owner[r] >= 0 && topLiege(owner[r]) === topLiege(best) && rndC() < 0.5))) setRel(r, g, y, 0.6, f);
        setRel(q.cap, g, y, 0.8, f); q.stateRel = g; ev(y, 'schism', { p: best, f, g, r: q.cap });
      }
    }
    function crisis(p, y, capP, foreignFrac) {
      const q = P[p];
      if (q.n >= 6 && (q.n > capP * 0.8 || foreignFrac > 0.3 || rnd() < 0.5)) { // 分裂
        const own = []; for (let r = 1; r <= nR; r++) if (owner[r] === p) own.push(r);
        const k = Math.min(4, 1 + Math.floor(q.n / 6)), seeds = [q.cap];
        const ranked = own.filter(r => r !== q.cap).sort((a, b) => (regionPop(b, y) + R.weight[b] * 1e-3) - (regionPop(a, y) + R.weight[a] * 1e-3) || a - b);
        const sep = Math.max(200, REACH[Math.max(2, stageAt(q.cap, y))] * 0.5);
        for (const r of ranked) { if (seeds.length >= k) break; if (seeds.every(s => kmBetween(s, r) > sep)) seeds.push(r); }
        if (seeds.length < 2) { dynasty(p, y); return; }
        const part = new Map(); const queue = []; seeds.forEach((s, i) => { part.set(s, i); queue.push(s); });
        for (let i = 0; i < queue.length; i++) { const a = queue[i]; neighbors(a, (b, ed) => { if (owner[b] === p && !part.has(b)) { part.set(b, part.get(a)); queue.push(b); } }); }
        if (q.org) { // 有省份的国家沿省界分裂：整省归属于治所所在的一方
          const pvPart = new Map(); for (const r of own) { const v = prov[r]; if (v < 0) continue; const sr = PV[v].seat; if (!pvPart.has(v)) pvPart.set(v, part.has(sr) ? part.get(sr) : part.get(r)); }
          seeds.forEach((sd, i) => { if (prov[sd] >= 0) pvPart.set(prov[sd], i); });
          for (const r of own) if (prov[r] >= 0 && pvPart.has(prov[r])) part.set(r, pvPart.get(prov[r])); }
        const kids = [], partitionOwners = [p]; let slots = countrySlots();
        for (let i = 1; i < seeds.length; i++) { const civ = creole(seeds[i], q, y); if (!civilized(civ)) { partitionOwners[i] = -1; continue; }
          if (!slots) { partitionOwners[i] = p; continue; } slots--;
          const c = newPolity(y, seeds[i], [{ id: p, kind: 'split' }], civ); partitionOwners[i] = c; P[c].claimLin = q.lin; P[c].claimUntil = y + 400; P[c].coh = 0.75; P[c].org = q.org; if (nomadAt(q, y) && P[c].settled === undefined) P[c].nomad = R.pasture[seeds[i]] >= 0.3; kids.push(c); } // 游牧汗国分裂：在草原上的部分仍是游牧部族
        if (!kids.length && !partitionOwners.includes(-1)) { dynasty(p, y); return; }
        const lost = own.filter(r => part.has(r) && part.get(r) > 0);
        inheritRegions(lost.filter(r => partitionOwners[part.get(r)] >= 0).map(r => [r, partitionOwners[part.get(r)]]), y);
        releaseTribes(p, lost.filter(r => partitionOwners[part.get(r)] === -1), y);
        for (const c of kids) { if (P[c].n === 0) P[c].died = y; else if (owner[P[c].cap] !== c) moveCapital(c, y, 'split'); }
        for (const c of kids) if (P[c].died === null) steppeKid(c, y, nomadAt(q, y)); // 分出去的一方若多半是草原牧地：退回草原，复归游牧
        if (owner[q.cap] !== p && q.n > 0) moveCapital(p, y, 'split');
        q.coh = 0.55; if (kids.length) ev(y, 'split', { p, kids, r: q.cap });
        if (feudal(stageAt(q.cap, y), y) && q.liege < 0) for (const c of kids) if (P[c].died === null && P[c].n > 0 && rnd() < (polStyle(q) === 'feudal' ? 0.8 : 0.5)) setLiege(c, p, y, 'split'); // 封建时代：分出去的诸侯仍奉旧主为宗主
      } else dynasty(p, y, rnd() < 0.3 ? 'coup' : 'dynasty');
    }
    function dynasty(p, y, how) { // 改朝换代：疆域不变，新王朝继承（国统延续），首都可能迁往最大的城市；how：dynasty / coup（宫廷政变）/ revolution（革命）
      const q = P[p], civ = civilized(civOfNew(q.cap)) ? civOfNew(q.cap) : rulingCultureAt(q, y); // 王朝更替延续既有文明统治集团，不借用未来当地文化。
      const sameStateName = how !== 'revolution' && succOf(rulingCultureAt(q, y)) === 'house' && succOf(civ) === 'house';
      const japan = /japanese/i.test(libKeyOf(rulingCultureAt(q, y)));
      // 少数国家具有较强制度延续性，日本式文化尤其如此；家族更替不切断国家。
      const continuousState = ((Math.imul(p + 1, 1103515245) >>> 0) % 1000) < (japan ? 500 : 60);
      if (sameStateName && continuousState) {
        (q.dyn = q.dyn || []).push(y, how === 'coup' ? 1 : 0); q.dynStart = y; q.coh = Math.max(q.coh, .8);
        if (q.peakN >= 2 || how === 'coup') ev(y, 'house', {p, r:q.cap, how:how || 'dynasty', k:q.dyn.length / 2});
        return p;
      }
      const nd = newPolity(y, q.cap, [{ id: p, kind: 'dynasty' }], civ, q.lin); P[nd].foundingHow = how || 'dynasty';
      if (q.theo !== undefined && rnd() < 0.7) { P[nd].theo = y; P[nd].theoRel = q.theoRel; } if (q.settled !== undefined) { P[nd].settled = y; P[nd].settledCiv = q.settledCiv; if (q.leftSteppe) P[nd].leftSteppe = true; } // 神权四成延续；定居不再回到游牧
      if (P[nd].settled === undefined) P[nd].nomad = nomadAt(q, y) && R.pasture[q.cap] >= 0.3; // 汗位更替不改游牧与否（不再随新朝重新抽签）
      if (q.horde !== undefined) { P[nd].horde = q.horde; P[nd].hordeEnd = q.hordeEnd; } if (q.lastHorde !== undefined) P[nd].lastHorde = q.lastHorde;
      if (q.liege >= 0) setLiege(nd, q.liege, y, 'dynasty', true); for (const X of P) if (X.died === null && X.liege === p) setLiege(X.id, nd, y, 'dynasty', true); // 宗藩随王朝延续
      P[nd].dynStart = y; P[nd].claimLin = q.claimLin; P[nd].claimUntil = q.claimUntil;
      P[nd].org = q.org;
      if (q.colBase) { P[nd].colBase = new Map(q.colBase); P[nd].colSince = new Map(q.colSince); P[nd].colonized = q.colonized; }
      inheritOwned(p, nd, y);
      q.died = y; q.coreAtDeath = []; redirectRebels(p, nd, y, -1);
      if (q.king !== undefined) P[nd].king = y;
      if (q.crown !== undefined) { const s = q.crown; uncrown(p, y); crown(nd, y, null, -1, s); } // 改朝换代：新朝承继帝统
      moveCapital(nd, y, 'dynasty');
      if (how === 'revolution' || q.republic) P[nd].republic = true;
      if (q.peakN >= 2 || how === 'coup') ev(y, how === 'revolution' ? 'revolution' : sameStateName ? 'house' : how === 'coup' ? 'coup' : 'dynasty', { p: nd, q: p, r: P[nd].cap, how });
      return nd;
    }
    // ---------- 大航海与殖民 ----------
    function colonize(y, alivePs, cs) {
      if (!nwCoast.length) return;
      const coastal = new Uint8Array(P.length); for (let r = 1; r <= nR; r++) { const p = owner[r]; if (p >= 0 && R.coast[r] && !isNW(r)) coastal[p] = 1; }
      // 只有接纳了“远洋航海”思潮的旧大陆沿海国家，才能远渡重洋
      const navOk = p => D.NAV >= 0 && D.ideaA[D.NAV * NN + P[p].cap] <= y;
      const can = alivePs.filter(p => P[p].died === null && !P[p].rebel && navOk(p) && coastal[p] && !isNW(P[p].cap) && P[p].n >= 3);
      if (!can.length) return;
      if (colonialAge === null) { colonialAge = y; ev(y, 'discovery', { p: can[0], r: P[can[0]].cap }); }
      for (const p of can) { const q = P[p]; if (rndK() > 0.16 * q.coh) continue;
        // 选登陆点：新大陆沿岸，无主或本地政权弱小处；靠近自己已有的殖民地更可能
        let tot = 0; const w = nwCoast.map(r => { const o = owner[r]; if (o === p) return 0;
          // 同一大陆已有殖民据点后，仅沿已控制海岸扩张，避免随机散布飞地。
          if (q.colBase && q.colBase.has(R.landComp[r])) { let adjacent = false; for (let k = R.off[r]; k < R.off[r+1]; k++) if (!eSea[k] && owner[R.nbr[k]] === p) { adjacent = true; break; } if (!adjacent) return 0; }
          let v = 0.2 + R.hab[r]; if (o >= 0) { if (!isNW(P[o].cap) || cs[o] >= 6) return 0; v *= 0.35; } if (q.colBase && q.colBase.has(R.landComp[r])) v *= 2.5; tot += v; return v; });
        if (!tot) continue; let pick = rndK() * tot, b = 0; for (let i = 0; i < w.length && pick > 0; i++) { pick -= w[i]; b = nwCoast[i]; }
        const o0 = owner[b]; setOwner(b, p, y); if (o0 >= 0 && P[o0].n === 0) kill(o0, y, p);
        if (rndK() < 0.6) setCult(b, q.civ, y); if (rndK() < 0.6 && rel[q.cap] >= 0) setRel(b, rel[q.cap], y); // 殖民统治与传教影响
        if (!q.colBase) q.colBase = new Map(), q.colSince = new Map();
        const lc = R.landComp[b]; if (!q.colBase.has(lc)) { q.colBase.set(lc, b); q.colSince.set(lc, y); ev(y, 'colony', { p, r: b, city: bigCity(b, y), first: !q.colonized }); q.colonized = true; } }
      // 殖民带来的发展：旧大陆国家统治下的新大陆土地逐步跟上宗主国（最多低一个阶段）
      for (let r = 1; r <= nR; r++) { const p = owner[r]; if (p < 0 || !isNW(r) || isNW(P[p].cap) || cs[p] < 7) continue; const t = cs[p] - 1;
        if (sg[r] < t && rndK() < 0.12) { const s1 = sg[r] + 1; if (D.Y[s1 * NN + r] > y) D.Y[s1 * NN + r] = y; for (let s2 = s1 + 1; s2 <= 8; s2++) if (D.Y[s2 * NN + r] < y) D.Y[s2 * NN + r] = y; sg[r] = s1; } }
      // 殖民地独立：殖民满一百二十年，宗主国越虚弱越可能
      if ((y / TICK) % 3 === 0) for (const p of alivePs) { const q = P[p]; if (!q.colBase || q.died !== null) continue;
        for (const [lc, base] of [...q.colBase]) { if (y - q.colSince.get(lc) < 120) continue; const regs = []; for (let r = 1; r <= nR; r++) if (owner[r] === p && R.landComp[r] === lc) regs.push(r);
          if (!regs.length) { q.colBase.delete(lc); continue; } if (regs.length < 2 || rndK() > 0.06 + 0.02 * Math.min(10, regs.length) + (q.coh < 0.5 ? 0.12 : 0)) continue;
          if (!countrySlots()) continue;
          const seat = bigRegion(regs, y), civ = rulingCultureAt(q, y); setCult(seat, civ, y); if (rel[q.cap] >= 0) setRel(seat, rel[q.cap], y); // 独立时殖民者精英掌权：首都随宗主国的文化与宗教
          const c = newPolity(y, seat, [{ id: p, kind: 'secede' }], civ); P[c].org = q.org || y; P[c].coh = 0.85; P[c].colonialFrom = p;
          inheritRegions(regs.map(r => [r, c]), y); q.colBase.delete(lc); ev(y, 'independence', { p: c, q: p, r: seat }); } }
    }
    // ---------- 民怨、灾年与起义 ----------
    function redirectRebels(oldTarget, newTarget, y, except) {
      for (const q of P) if (q.id !== except && q.rebel && q.died === null && q.target === oldTarget) {
        if (q.n > 0) trackCountry(q, -1); q.target = newTarget; if (q.n > 0) trackCountry(q, 1); q.rebelTargets.push([y, newTarget]);
      }
    }
    function overthrow(rb, q, y, capR) { // 起义军攻入都城：王朝覆亡，起义军成为新王朝，承接全部疆域（国统延续）
      const Q = P[q], Rb = P[rb], city = bigCity(capR, y); if (city >= 0) sacks.push(city, y, 0.35);
      inheritRegions(Array.from({ length: nR }, (_, i) => i + 1).filter(r => owner[r] === q || r === capR).map(r => [r, rb]), y);
      if (Q.king !== undefined) Rb.king = y;
      if (Q.crown !== undefined) { const s = Q.crown; uncrown(q, y); crown(rb, y, null, -1, s); } // 推翻旧朝者承继帝统
      kill(q, y, -1, 'quiet'); Q.children.push({ id: rb, kind: 'overthrow' }); Rb.parents.push({ id: q, kind: 'dynasty' });
      if (Rb.n > 0) trackCountry(Rb, -1); Rb.rebel = false; if (Rb.n > 0) trackCountry(Rb, 1); Rb.rebelUntil = y; redirectRebels(q, rb, y, rb); Rb.lin = Q.lin; Rb.org = Q.org; Rb.dynStart = y; Rb.coh = 0.85; Rb.cap = capR; Rb.caps.push({ year: y, city, r: capR });
      const restoreOf = Rb.rtype === 'loyalist' && Rb.memoryOf >= 0 && linkRestoration(P, rb, Rb.memoryOf, y, owner, 0) ? Rb.memoryOf : -1;
      Rb.outcome = 'overthrow'; ev(y, 'overthrow', { p: rb, q, city, r: capR, restoreOf });
      for (let r = 1; r <= nR; r++) if (owner[r] === rb) unrest[r] *= 0.4;
    }
    function settleRebel(rb, y, why) { // 起义军坚持下来：割据成国（或遗民复国）
      const Rb = P[rb], oldTarget = Rb.target;
      if (Rb.rebelGoal !== 'independence' || !canRebelFound(rb, y)) return;
      // 朝廷仍存时，割据建国须有国家名额；朝廷已亡则承接其原有名额。
      if (P[oldTarget].died === null && !countrySlots()) return;
      if (Rb.n > 0) trackCountry(Rb, -1); Rb.rebel = false; if (Rb.n > 0) trackCountry(Rb, 1); Rb.rebelUntil = y;
      if (P[oldTarget].died !== null) redirectRebels(oldTarget, rb, y, rb);
      Rb.coh = 0.8; Rb.claimLin = P[Rb.target].lin; Rb.claimUntil = y + 300;
      let restoreOf = -1; if (Rb.rtype === 'loyalist' && Rb.memoryOf >= 0 && linkRestoration(P, rb, Rb.memoryOf, y, owner, 0)) { restoreOf = Rb.memoryOf; Rb.lin = P[restoreOf].lin; }
      if (Rb.rtype === 'religious') { Rb.theo = y; Rb.theoRel = Rb.relAt; } // 教民起义建国：政教合一
      Rb.outcome = 'state'; ev(y, 'rebelState', { p: rb, q: Rb.target, r: Rb.cap, restoreOf, why });
    }
    // 建国需要真实、连片、有人口的支持地，以及现存城市或草原游牧基础。
    function canRebelFound(p, y) {
      const q = P[p]; if (q.n < 2 || y - q.rebelSince < 40 || !civilized(q.civ)) return false;
      const seen = new Set();
      for (let start = 1; start <= nR; start++) if (owner[start] === p && !seen.has(start)) {
        const group = [start]; seen.add(start); let populated = 0, seat = false;
        for (let i = 0; i < group.length; i++) {
          const r = group[i]; if (human.total(r) > 0) { populated++; if (bigCity(r, y) >= 0 || (typeOfCult(q.civ) === 'pastoral' && R.pasture[r] >= .35)) seat = true; }
          for (let k = R.off[r]; k < R.off[r+1]; k++) { const b=R.nbr[k]; if (!eSea[k] && owner[b] === p && !seen.has(b)) { seen.add(b); group.push(b); } }
        }
        if (group.length >= 2 && populated >= 2 && seat) return true;
      }
      return false;
    }
    function disperseRebel(p, y, target) {
      const q=P[p]; for (let r=1;r<=nR;r++) if (owner[r] === p) { setOwner(r, target, y); unrest[r] *= .4; }
      q.died=y; q.rebelUntil=y; q.outcome='dissolve'; ev(y, 'rebelDisperse', {p, q:q.target, r:q.cap, why:target < 0 ? 'fall' : 'stalled'});
    }
    function unrestStep(y, alivePs, cs, cap, reach) {
      // 灾年：干旱区多大旱，大河两岸多大水，其余是蝗灾与饥荒；一次覆盖一片相连的地方
      for (let r = 1; r <= nR; r++) famine[r] *= 0.5;
      if (rndU() < 0.3) { const wv = r => owner[r] >= 0 ? vuln[r] * clamp((y - lastFam[r]) / 150, 0.05, 1) : 0; let tot = 0; for (let r = 1; r <= nR; r++) tot += wv(r);
        let pick = rndU() * tot, r0 = 0; for (let r = 1; r <= nR && pick > 0; r++) { const w = wv(r); if (w > 0) { pick -= w; r0 = r; } }
        if (r0) { const size = 2 + Math.floor(rndU() * 6), cl = [r0], seen = new Set(cl); for (let i = 0; i < cl.length && cl.length < size; i++) for (let k = R.off[cl[i]]; k < R.off[cl[i] + 1] && cl.length < size; k++) { const b = R.nbr[k]; if (!seen.has(b) && !eSea[k] && R.weight[b] > 0) { seen.add(b); cl.push(b); } }
          for (const r of cl) { famine[r] = 1; lastFam[r] = y; for (const i of cityIn[r]) if (alive(C.cities[i], y) && rndU() < 0.5) sacks.push(i, y, 0.15); }
          const kind = R.arid[r0] + R.semiArid[r0] * 0.6 > 0.35 ? 'drought' : R.river[r0] >= 3 ? 'flood' : rndU() < 0.5 ? 'locust' : 'famine';
          if (cl.length >= 4) ev(y, 'disaster', { p: owner[r0], r: r0, dk: kind, n: cl.length }); } }
      // 民怨：赋役、灾荒、异族统治、信仰不合、王朝末年、新近征服、遗民记忆；近都城、太平久则回落
      const aliveLin = new Set(); for (const p of alivePs) if (P[p].died === null) aliveLin.add(P[p].lin);
      for (let r = 1; r <= nR; r++) { const p = owner[r]; if (p < 0 || P[p].rebel) { unrest[r] *= 0.8; cause[r] = 0; continue; }
        const q = P[p], over = Math.max(0, q.n / cap[p] - 0.8), sr = q.theoRel !== undefined ? q.theoRel : rel[q.cap];
        const effects = regionEffects(r), culturalShare = human.share(r, 'culture', q.civ), tolerance = clamp(effects.tolerance, 0, 0.8);
        const governance = G.HumanAnchors.governance({ travelDays: kmBetween(q.cap, r) / 30, capacityDays: reach[p] / 30 * G.HumanRules.multiplier(effects.governance), autonomy: effects.autonomy, culturalShare });
        const foreign = cult[r] === -1 ? 0 : Math.max(0, 1 - culturalShare) * governance.friction, heresy = sr >= 0 && human.total(r) ? Math.max(0, 1 - human.share(r, 'religion', sr) - human.share(r, 'religion', -1)) : 0;
        const fresh = y - linOwnSince[r] < 60 ? 1 : 0, mem = coreLin[r] >= 0 && coreLin[r] !== q.lin && !aliveLin.has(coreLin[r]) ? 1 : 0, near = kmBetween(r, q.cap) < reach[p] * 0.3 ? 1 : 0;
        const hw = heresy * (relSpreadOf(sr) === 'syncretic' || relSpreadOf(rel[r]) === 'syncretic' ? 0.09 : relSpreadOf(sr) === 'missionary' && (relTypeOf(sr) === 'monotheist' || relTypeOf(sr) === 'dualist') ? 0.27 : 0.2);
        const parts = [0.4 * over, 0.55 * famine[r], 0.28 * foreign * (1 - tolerance), hw * (1 - tolerance), 0.4 * Math.max(0, 0.55 - q.coh), 0.15 * fresh, 0.25 * mem];
        const target = Math.max(0, parts.reduce((a, b) => a + b, 0) - 0.15 * near);
        unrest[r] = 0.8 * unrest[r] + 0.2 * target;
        let bi = 0; for (let i = 1; i < parts.length; i++) if (parts[i] > parts[bi]) bi = i; cause[r] = [1, 2, 3, 4, 1, 3, 5][bi]; // 1 赋役 2 灾荒 3 异族 4 信仰 5 遗民
        if (mem) memLin[r] = coreLin[r]; }
      // 起义爆发：民怨高的连片地方
      const hot = new Map(); // 每国只看民怨最高的一处（已平定的地方一百二十年内保持平静）
      for (let r = 1; r <= nR; r++) { const p = owner[r]; if (p < 0 || P[p].rebel || y < calmUntil[r]) continue; const u = unrest[r] + 0.03 * Math.min(3, tradition[r]); const o = hot.get(p); if (o === undefined || u > o[1]) hot.set(p, [r, u]); }
      for (const [p, [r, u]] of [...hot].sort((a, b) => a[0] - b[0])) { if (P[p].n < 3 || y - (P[p].lastRevolt || -1e9) < 60 || (isNW(P[p].cap) && typeOfCult(P[p].civ) === 'new-world')) continue;
        const thr = 0.66; if (u < thr || rndU() > 0.15 * (u - thr + 0.04)) continue;
        const q = P[p], cl = [r], seen = new Set(cl), maxN = Math.max(1, Math.min(8, Math.floor(q.n * 0.35)));
        for (let i = 0; i < cl.length && cl.length < maxN; i++) for (let k = R.off[cl[i]]; k < R.off[cl[i] + 1] && cl.length < maxN; k++) { const b = R.nbr[k]; if (!eSea[k] && !seen.has(b) && owner[b] === p && unrest[b] > thr - 0.12) { seen.add(b); cl.push(b); } }
        if (cl.length >= q.n) continue;
        const c0 = cause[r], rtype = c0 === 3 ? 'ethnic' : c0 === 4 ? 'religious' : c0 === 5 ? 'loyalist' : 'peasant';
        const seat = bigRegion(cl, y), civ = civOfNew(seat);
        const revolution = cs[p] >= 7 && cl.includes(q.cap);
        q.lastRevolt = y; for (const k of cl) { tradition[k] = Math.min(9, tradition[k] + 1); calmUntil[k] = y + 120; }
        if (!civilized(civ)) { releaseTribes(p, cl, y); continue; }
        if (revolution) { dynasty(p, y, 'revolution'); continue; } // 近代：都城起事成为革命
        const rb = newPolity(y, seat, [{ id: p, kind: 'revolt' }], civ);
        const Rb = P[rb]; Rb.rebel = true; Rb.rtype = rtype; Rb.rebelGoal = rtype === 'ethnic' || rtype === 'loyalist' ? 'independence' : 'overthrow'; Rb.target = p; Rb.rebelTargets = [[y, p]]; Rb.rebelSince = y; Rb.coh = 0.75; Rb.cause = c0; Rb.memoryOf = -1; Rb.memoryRegion = r; Rb.relAt = rel[seat];
        if (rtype === 'loyalist') { const ml = memLin[r]; let last = -1; for (const X of P) if (X.lin === ml && X.died !== null && X.died < y && !X.restored && X.coreAtDeath && X.coreAtDeath.includes(r) && (last < 0 || X.died > P[last].died)) last = X.id; Rb.memoryOf = last; }
        for (const k of cl) { setOwner(k, rb, y); unrest[k] *= 0.6; }
        ev(y, 'revolt', { p: rb, q: p, r: seat, rtype, cause: c0, famine: famine[r] > 0.3 });
      }
      // 起义的结局：被镇压、割据建国，或在七十年演算步时结束；日期细化最多回拨十年。
      for (const p of alivePs) { const Rb = P[p]; if (!Rb.rebel || Rb.died !== null) continue;
        if (Rb.n === 0) { Rb.died = y; Rb.rebelUntil = y; Rb.outcome = 'suppress'; ev(y, 'suppress', { p, q: Rb.target, r: Rb.cap }); for (let r = 1; r <= nR; r++) if (owner[r] === Rb.target) unrest[r] *= 0.85; continue; }
        if (y - Rb.rebelSince >= 70) {
          if (Rb.rebelGoal === 'independence' && canRebelFound(p, y)) settleRebel(p, y, P[Rb.target].died === null ? 'hold' : 'fall');
          if (Rb.rebel) disperseRebel(p, y, P[Rb.target].died === null ? Rb.target : -1);
          continue;
        }
        if (P[Rb.target].died !== null) {
          const other = alivePs.some(id => id !== p && P[id].rebel && P[id].died === null && P[id].target === Rb.target && P[id].rebelGoal === 'independence' && canRebelFound(id, y));
          if (Rb.rebelGoal === 'independence' && canRebelFound(p, y)) settleRebel(p, y, 'fall');
          else if (!other) disperseRebel(p, y, -1);
          continue;
        }
        if (Rb.rebelGoal === 'independence' && y - Rb.rebelSince >= 40 && canRebelFound(p, y)) settleRebel(p, y, 'hold');
        if (Rb.rebel && y - Rb.lastRebelGain >= 60 && rndU() < .15 + .35 * P[Rb.target].n / Math.max(1, P[Rb.target].n + Rb.n)) disperseRebel(p, y, Rb.target);
      }
    }

    enforceRuinsThrough(E);
    terminalCityPopulation=G.HistoryAdministration.cityPopulations(h,R,Float64Array.from({length:nR+1},(_,r)=>human.total(r)));
    // 终点只校验现有国土与行政结构，不按国家数量吞并或结清战争。
    for (const q of P) if (q.died === null && q.n === 0) q.died = E;
    for (const q of P) if (q.died === null && q.n > 0 && !q.rebel && !q.org) organize(q.id, E, true);
    for (let r = 1; r <= nR; r++) occSince[r] = -1e9; admin(E); separateFragments(E);
    const adminDays=new Float64Array(nR+1).fill(Infinity);enforceProvinces(E,adminDays);
    for (const q of P) if (q.died === null && q.n > 0 && (owner[q.cap] !== q.id || q.caps[q.caps.length - 1].city < 0)) { if (owner[q.cap] !== q.id) moveCapital(q.id, E, 'final'); if (q.caps[q.caps.length - 1].city < 0) { let best = -1, bp = 0; for (let r = 1; r <= nR; r++) if (owner[r] === q.id) { const v = regionPop(r, E); if (v > bp) { bp = v; best = r; } } if (best >= 0) moveCapital(q.id, E, 'found', best); } }

    for (const q of P) if (q.crown !== undefined && q.died !== null) uncrown(q.id, q.died); // 帝统随亡国而绝
    // ---------- 首都与战争对城市人口的影响（终点人口不变） ----------
    // 推演用的粗采样（C.pop）与展示用的细采样（C.popF）各自乘上同一套系数
    for (const [A, nT, st] of [[C.pop, C.popN, C.popStep], [C.popF, C.popNF, C.popStepF]]) { if (!A) continue; const mult = new Float64Array(C.cities.length * nT).fill(1);
      for (const q of P) { for (let i = 0; i < q.caps.length; i++) { const c = q.caps[i]; if (c.city < 0) continue; const a = c.year, b = i + 1 < q.caps.length ? q.caps[i + 1].year : (q.died === null ? E + 1 : q.died);
          for (let j = 0; j < nT; j++) { const y = Math.min(E, j * st); if (y < a - 50 || y > b + 150) continue;
            const ramp = y < a ? (y - a + 50) / 50 : y > b ? 1 - (y - b) / 150 : 1, boost = 1 + 0.6 * Math.min(1, Math.max(1, q.peakN) / 12); mult[c.city * nT + j] *= 1 + (boost - 1) * clamp(ramp, 0, 1); } } }
      for (let k = 0; k < sacks.length; k += 3) { const ci = sacks[k], y0 = sacks[k + 1], sev = sacks[k + 2];
        for (let j = 0; j < nT; j++) { const y = Math.min(E, j * st); if (y < y0 || y > y0 + 120) continue; mult[ci * nT + j] *= 1 - sev * (1 - (y - y0) / 120); } }
      C.cities.forEach((c, i) => { const mE = c.lost ? 1 : mult[i * nT + nT - 1] || 1; for (let j = 0; j < nT; j++) A[i * nT + j] = Math.round(A[i * nT + j] * mult[i * nT + j] / mE); if (!c.lost) A[i * nT + nT - 1] = c.final; }); }

    // ---------- 命名：现存国家的名字沿世系往回传；分裂出去的叫方位 + 母名；复国叫“后某” ----------
    const used = new Set(), rndName = mulberry32((h.seed | 0) + 81373);
    const unknownLib = { id: 'unknown-ruling-culture', unnamed: true, n: {}, t: {}, c: { roots: ['无名'], prefixes: [''], suffixes: [''] } };
    const libOf = cu => (cu >= 0 ? h.civLib[cu] : cu <= -2 ? D.ancient[-2 - cu]?.libObj : null) || unknownLib;
    // 无文化库可用（部族地带、文明尚未成形）时，借这一带日后或邻近的文化起名，地图上不留“未命名”
    const hasLib = cu => libOf(cu) !== unknownLib;
    const nearCiv = (() => { const out = new Int32Array(nR + 1).fill(-1), qq = [];
      for (let i = 0; i < cLog.length; i += 3) { const r = cLog[i], c = cLog[i + 2]; if (out[r] === -1 && hasLib(c)) out[r] = c; }
      for (let i = 0; i < log.length; i += 3) { const r = log[i], o = log[i + 2]; if (out[r] === -1 && o >= 0 && P[o] && hasLib(P[o].civ)) out[r] = P[o].civ; }
      for (let r = 1; r <= nR; r++) if (out[r] !== -1) qq.push(r);
      for (let k = 0; k < qq.length; k++) { const a = qq[k]; for (let kk = R.off[a]; kk < R.off[a + 1]; kk++) { const b = R.nbr[kk]; if (b < 1 || b > nR || out[b] !== -1) continue; out[b] = out[a]; qq.push(b); } }
      let any = -1; for (let c = 0; c < (h.civLib || []).length; c++) if (hasLib(c)) { any = c; break; }
      if (any !== -1) for (let r = 1; r <= nR; r++) if (out[r] === -1) out[r] = any;
      return out; })();
    const civOr = (cu, r) => hasLib(cu) || !(r > 0) ? cu : nearCiv[r];
    // ---------- 殖民地城市：宗主国文化库起名；港口先建，再随殖民一圈圈向内陆推进 ----------
    const INF = 1e9, hash01 = a => { a = (a ^ 61) ^ (a >>> 16); a = (a + (a << 3)) | 0; a ^= a >>> 4; a = Math.imul(a, 0x27d4eb2d); a ^= a >>> 15; return (a >>> 0) / 4294967296; };
    const colonial = { year: new Float64Array(nR + 1).fill(INF), metro: new Int32Array(nR + 1).fill(-1), cities: [] };
    { const used = new Set(); const metroOf = p0 => { let x = p0; if (typeOfCult(P[x].civ) === 'new-world' && P[x].colonialFrom === undefined) return -1;
          for (let g = 0; g < 30 && x >= 0; g++) { const Q = P[x]; if (!isNW(Q.caps[0].r)) return x; if (Q.colonialFrom !== undefined) { x = Q.colonialFrom; continue; }
            const pa = Q.parents.find(k => k.kind === 'split' || k.kind === 'secede' || k.kind === 'dynasty' || k.kind === 'revolt'); if (!pa) return -1; x = pa.id; } return -1; };
      const mCache = new Map(), mOf = p0 => { if (!mCache.has(p0)) mCache.set(p0, metroOf(p0)); return mCache.get(p0); };
      for (let i = 0; i < log.length; i += 3) { const r = log[i], y = log[i + 1], o = log[i + 2]; if (o < 0 || !isNW(r) || y >= colonial.year[r] || colonialAge === null || y < colonialAge) continue; const m = mOf(o); /* 大航海以前（陆路相连）的占领不算殖民 */ if (m >= 0) { colonial.year[r] = y; colonial.metro[r] = m; } }
      // 离殖民海岸的步数（只走已殖民的新大陆区块）
      const hop = new Int16Array(nR + 1).fill(-1), qq = []; for (let r = 1; r <= nR; r++) if (colonial.year[r] < INF && R.coast[r]) { hop[r] = 0; qq.push(r); }
      for (let k = 0; k < qq.length; k++) { const a = qq[k]; for (let kk = R.off[a]; kk < R.off[a + 1]; kk++) { const b = R.nbr[kk]; if (hop[b] >= 0 || colonial.year[b] >= INF || R.edges[R.eid[kk]].sea) continue; hop[b] = hop[a] + 1; qq.push(b); } }
      // 每座城最晚必须存在的年份：当过首都、被劫掠、编年史提到过
      const mustBy = new Float64Array(C.cities.length).fill(INF);
      for (const q of P) for (const c of q.caps) if (c.city >= 0) mustBy[c.city] = Math.min(mustBy[c.city], c.year);
      G.HistoryAdministration.protectSeatCities(mustBy,PV);
      for (const e of events) if (e.city !== undefined && e.city >= 0) mustBy[e.city] = Math.min(mustBy[e.city], e.year);
      for (let k = 0; k < sacks.length; k += 3) mustBy[sacks[k]] = Math.min(mustBy[sacks[k]], sacks[k + 1]);
      const nativeCap = new Set(); for (const q of P) if (typeOfCult(q.civ) === 'new-world') for (const c of q.caps) if (c.city >= 0) nativeCap.add(c.city);
      const rndC = mulberry32((h.seed | 0) + 3131);
      // 宗主国的城市名池：先用库里没用过的城名，偶尔“新 + 宗主国大城名”
      const metroBig = (m, y) => { let b = -1, bp = 0; for (let r = 1; r <= nR; r++) { if (isNW(r)) continue; for (const i of cityIn[r]) { const c = C.cities[i]; if (!alive(c, y) || c.lost) continue; if (ownerAtYear(r, y) !== m) continue; const v = popAt(i, y); if (v > bp) { bp = v; b = i; } } } return b; };
      const ownLog = new Map(); for (let i = 0; i < log.length; i += 3) { const r = log[i]; if (!ownLog.has(r)) ownLog.set(r, []); ownLog.get(r).push(log[i + 1], log[i + 2]); }
      function ownerAtYear(r, y) { const L = ownLog.get(r); if (!L) return -1; let o = -1, yy = -INF; for (let k = 0; k < L.length; k += 2) if (L[k] <= y && L[k] >= yy) { yy = L[k]; o = L[k + 1]; } return o; }
      const bigNames = new Map();
      C.cities.forEach((c, i) => {
        const r = c.r; if (!r || c.lost || !isNW(r) || !(colonial.year[r] < INF)) return;
        const cy = colonial.year[r], m = colonial.metro[r]; if (m < 0) return;
        if (c.founded < cy && (nativeCap.has(i) || mustBy[i]<cy || popAt(i, cy) >= 15000)) return; // 治所或本土大城早已存在时，不能把建城推到殖民后
        const port = c.type === 'port' || c.type === 'island-port', d = Math.max(0, hop[r]), q = rndC();
        const rank = cityIn[r].indexOf(i);
        let f = cy + (port ? 5 + 35 * q : 25 + 45 * d + 50 * q) + (c.fort ? -10 : 0) + 30 * Math.max(0, rank);
        if (f > E - 8) f = cy + (E - 8 - cy) * (port ? 0.1 + 0.2 * q : Math.min(0.95, 0.3 + 0.12 * d + 0.2 * q));
        f = Math.max(cy, Math.min(f, mustBy[i], E - 5));
        const lib = libOf(P[m].civ); let nm = '';
        if (!c.fort && rndC() < 0.18) { const yb = Math.round(f / 10) * 10; let base = bigNames.get(m + ':' + yb); if (base === undefined) { const bi = metroBig(m, f); base = bi >= 0 ? C.cities[bi].name : ''; bigNames.set(m + ':' + yb, base); }
          if (base && base.length <= 5 && !/^新/.test(base) && !used.has('新' + base)) nm = '新' + base; }
        if (!nm) for (const cn of (lib.n && lib.n.cities) || []) if (!used.has(cn)) { nm = cn; break; }
        if (!nm) nm = G.NameGen.make(lib, 'city', used, rndC);
        used.add(nm);
        colonial.cities.push({ i, k: c.idx, old: c.name, name: nm, from: c.founded, founded: G.HistoryDate.ceil(f), metro: m, port });
        c.name = nm; c.founded = G.HistoryDate.ceil(f); c.colonial = m; if (c.idx >= 0 && h.settlements[c.idx]) h.settlements[c.idx].name = nm;
        // 人口：建城后由小到大，现在的人口不变
        const span = Math.max(20, E - c.founded);
        for (const [A, nT, st] of [[C.pop, C.popN, C.popStep], [C.popF, C.popNF, C.popStepF]]) { if (!A) continue;
          for (let j = 0; j < nT; j++) { const y = Math.min(E, j * st); A[i * nT + j] = y < c.founded ? 0 : Math.round(c.final * Math.max(0.02, Math.pow((y - c.founded) / span, 1.4))); }
          A[i * nT + nT - 1] = c.final; }
      });
      // 内陆城市不早于同一宗主国在这块大陆上的第一座港口（没有港口则不早于第一座殖民城市）
      const firstAt = new Map(); for (const o of colonial.cities) { const key = o.metro + ':' + R.landComp[C.cities[o.i].r], f0 = firstAt.get(key); const v = o.port ? o.founded : o.founded + 1e5; if (f0 === undefined || v < f0) firstAt.set(key, v); }
      for (const o of colonial.cities) { if (o.port) continue; const c = C.cities[o.i], f0 = firstAt.get(o.metro + ':' + R.landComp[c.r]) % 1e5, lo = Math.min(E - 5, f0 + 15 + 10 * Math.max(0, hop[c.r]));
        if (c.founded < lo && lo <= mustBy[o.i]) { c.founded = o.founded = G.HistoryDate.ceil(lo); const span = Math.max(20, E - c.founded); for (const [A, nT, st] of [[C.pop, C.popN, C.popStep], [C.popF, C.popNF, C.popStepF]]) { if (!A) continue; for (let j = 0; j < nT - 1; j++) { const y = Math.min(E, j * st); A[o.i * nT + j] = y < c.founded ? 0 : Math.round(c.final * Math.max(0.02, Math.pow((y - c.founded) / span, 1.4))); } } } }
      // 编年史与道路：随新的建城年份与名字更新
      const byI = new Map(colonial.cities.map(o => [o.i, o]));
      for (const e of C.events) if (e.city !== undefined && byI.has(e.city) && e.kind === 'found') { const o = byI.get(e.city); e.year = o.founded; e.text = `${G.HistoryCities.reference(o.i)}建城（殖民地）`; }
      if (C.roads) { for (const rd of C.roads) { const fa = rd.sa >= 0 ? C.cities[rd.sa].founded : 0, fb = rd.sb >= 0 ? C.cities[rd.sb].founded : 0, lo = Math.max(fa, fb); if (rd.year < lo + 10) rd.year = G.HistoryDate.ceil(Math.min(E - 3, lo + 10 + 40 * hash01(rd.sa * 31 + rd.sb))); } C.roads.sort((a, b) => a.year - b.year); }
      // 首批殖民港口记入编年史（每个宗主国一条）
      const firstC = new Map(); for (const o of colonial.cities) { const f0 = firstC.get(o.metro); if (!f0 || o.founded < f0.founded || (o.founded === f0.founded && o.port)) firstC.set(o.metro, o); }
      for (const o of firstC.values()) ev(o.founded, 'colonyCity', { p: o.metro, city: o.i, r: C.cities[o.i].r, port: o.port });
    }
    const bareOf = nm => G.CultureExt && G.CultureExt.bareName ? G.CultureExt.bareName(nm) : nm; // 去掉前缀后的本名（后唐 → 唐；“关闭前缀”时显示）
    // 公国（王国之下一级）：文化库显式填写的优先（自定义库可以写任何语言的称号）；没填就从君主国称号里找“公国 / 侯国”，再没有就不设这一级
    const duchyOf = (lib, t) => { const kt = (t.monarchy && t.monarchy[0]) || '王国', d = (G.CultureExt && G.CultureExt.extraTitle(lib, 'duchy')) || (t.monarchy || []).find(x => /^(公国|侯国)$/.test(x)) || (t.monarchy || []).find(x => /公国|侯国/.test(x)) || null;
      return d && d !== kt && d !== ((t.empire && t.empire[0]) || '帝国') ? d : null; };
    const titlesOf = (lib, tp) => { const t = lib.t || {}; const f = (k, d) => (t[k] && t[k][0]) || d; const xt = k => G.CultureExt ? G.CultureExt.extraTitle(lib, k) : null; return { vassal: xt('vassal') || f('monarchy', '王国'), colony: xt('colony') || '殖民地', theo: xt('theocracy') || '教国', city: tp === 'maritime' ? f('cityRepublic', '城邦') : f('city', '城邦'), kingdom: f('monarchy', '王国'), duchy: duchyOf(lib, t), empire: f('empire', '帝国'), nomadEmpire: xt('nomadEmpire') || null, nomad: f('nomadic', '部族邦联'), chief: f('chiefdom', '酋邦'), republic: f('republic', '共和国') }; };
    const sameRealm = q => { const pa = q.parents.find(x => x.kind === 'dynasty'); if (!pa) return null; const A = P[pa.id], a = rulingCultureAt(A, q.born), b = rulingCultureAt(q, q.born); return libKeyOf(a) === libKeyOf(b) && succOf(a) === 'house' && succOf(b) === 'house' ? A : null; };
    const order = P.map(q => q.id).sort((a, b) => P[a].born - P[b].born || a - b);
    const namingEvents = [];
    for (const q of P) { q.names = []; q.rulingCulture = [[q.born, rulingCultureAt(q, q.born)]]; namingEvents.push([q.born, q.id, 0]);
      const changes = [...new Set([q.settled].filter(y => y !== undefined && y > q.born && y <= (q.died === null ? E : q.died)))].sort((a,b) => a-b);
      if (q.restoreYear !== undefined && q.restoreYear > q.born) namingEvents.push([q.restoreYear, q.id, 2]);
      for (const year of changes) { const before = q.rulingCulture[q.rulingCulture.length - 1][1], after = rulingCultureAt(q, year); if (before === after) continue;
        q.rulingCulture.push([year, after]); if (libKeyOf(before) !== libKeyOf(after)) namingEvents.push([year, q.id, 1]); } }
    namingEvents.sort((a,b) => a[0] - b[0] || b[2] - a[2] || a[1] - b[1]);
    for (const [year, id, settled] of namingEvents) { const q = P[id], civ = rulingCultureAt(q, year), lib = libOf(civOr(civ, q.caps[0] && q.caps[0].r));
      if (settled === 1 && q.restoreYear === year) continue;
      const dynParent = q.parents.find(x => x.kind === 'dynasty');
      const keepDynastyName = !dynParent || (succOf(rulingCultureAt(P[dynParent.id], year)) === 'house' && succOf(civ) === 'house');
      let name = settled === 1 || (!settled && !keepDynastyName) ? null : inheritedStateName(q, P, year, libKeyOf, R.cx, R.cy, h.W, used, settled === 2);
      if (!name && settled === 2 && q.names.length && libKeyOf(rulingCultureAt(q, year - 1)) === libKeyOf(civ)) continue;
      if (!name) { const short = drawRulingName(lib, 'state', used, rndName); name = { short, bare: bareOf(short) }; }
      q.names.push([year, name.short, name.bare]); q.short = name.short; q.bare = name.bare;
    }
    for (const q of P) { q.type = typeOfCult(q.civ);
      const fr = q.theo !== undefined ? (q.theoRel !== undefined && q.theoRel >= 0 ? q.theoRel : rel[q.cap]) : -1, cl = fr >= 0 && RELS[fr] && RELS[fr].clergy;
      if (q.theo !== undefined) q.theoRel = fr;
      const titleYears = [...new Set(q.rulingCulture.map(x => x[0]).concat(q.settled !== undefined && q.settled > q.born && q.settled <= (q.died === null ? E : q.died) ? [q.settled] : []))].sort((a,b) => a-b);
      q.titlesLog = titleYears.map(year => { const civ = rulingCultureAt(q, year), lib = libOf(civ), tp = typeOfCult(civ), settled = q.settled !== undefined && year >= q.settled;
        const T = titlesOf(lib, settled && tp === 'pastoral' ? 'agrarian' : tp);
        if (cl && cl.theocracy && !(lib.t || {}).theocracy) T.theo = cl.theocracy;
        if (settled && tp === 'pastoral' && q.leftSteppe) { const nom = (lib.t || {}).nomadic || [], khan = v => !v || /汗|兀鲁思/.test(v) || nom.includes(v);
          if (khan(T.kingdom)) T.kingdom = '王国'; if (khan(T.empire)) T.empire = '帝国'; if (T.duchy && khan(T.duchy)) T.duchy = null; if (khan(T.vassal)) T.vassal = '公国'; }
        return [year, T]; });
      q.titles = q.titlesLog[q.titlesLog.length - 1][1]; }
    const titlesAt = (q, y) => (datedName(q.titlesLog, y) || q.titlesLog[0])[1];
    // 省名：延续到现在的省一直用现在的名字；以国为省的用旧国名加等级；其余从统治者文明的文化库取
    const temporaryProvNames = new Set();
    const RANKW = { 4: '郡', 5: '郡', 6: '州', 7: '省', 8: '省' };
    const drawProv = lib => drawRulingName(lib, 'prov', temporaryProvNames, rndName);
    for (const X of PV) { if (X.present >= 0 && presentProv[X.present] && !(colonial.metro[X.seat] >= 0)) { X.name = presentProv[X.present].name; continue; }
      if (colonial.metro[X.seat] >= 0) { X.name = drawProv(libOf(P[colonial.metro[X.seat]].civ)); continue; } // 殖民地的省：宗主国的地名
      if (X.fromState >= 0 && P[X.fromState].short) { const nm = P[X.fromState].short + (RANKW[X.stage] || '郡'); if (!temporaryProvNames.has(nm)) { temporaryProvNames.add(nm); X.name = nm; continue; } }
      X.name = drawProv(libOf(civOr(P[X.owner] ? P[X.owner].civ : -1, X.seat))); }
    const cultName = c => c >= 0 ? (opt.cultureNames ? opt.cultureNames[c] : '某文明') : c <= -2 ? D.ancient[-2 - c].name : '某部族';
    // 起义军的名号：东方风格的文化库用象征（赤眉、黄巾……），其余用起事地 + 起义
    const SYM = ['赤眉', '黄巾', '绿林', '白莲', '红巾', '青犊', '铜马', '黑山', '白波', '赤旗', '青巾', '黄旗'];
    const eastern = lib => /chinese|realistic-00|eastern|japanese|korean/.test(lib.id || '');
    let symI = 0;
    for (const q of P) { if (!q.rtype) continue; const lib = libOf(q.civ), place = (() => { const ci = bigCity(q.caps[0].r, q.born); if (ci < 0) return (q.names[0][1] || '').slice(0, 2); q._rebelCity = ci; return G.HistoryCities.reference(ci, q.born); })();
      const RX = G.CultureExt ? G.CultureExt.ext(lib).rebel : null;
      if (RX) { const syms = RX.symbols && RX.symbols.length ? RX.symbols : SYM, sym2 = syms[((symI++ + (h.seed | 0)) % syms.length + syms.length) % syms.length], fr = q.relAt >= 0 && RELS[q.relAt] ? RELS[q.relAt] : null, her = fr && fr.heresies && fr.heresies.length ? fr.heresies[((q.id + (h.seed | 0)) % fr.heresies.length + fr.heresies.length) % fr.heresies.length] : null;
        q.rebelName = q.rtype === 'religious' ? (her ? her + '起义军' : place + '圣战军') : q.rtype === 'loyalist' ? (q.memoryOf >= 0 && P[q.memoryOf].short ? P[q.memoryOf].short + '遗民军' : place + '义军') : q.rtype === 'ethnic' ? (cultName(q.civ).replace(/文明$/, '') + '人起义军')
          : (RX.style === 'symbol' ? RX.fmt.replace('{sym}', sym2) : RX.fmt.replace('{place}', place).replace('{sym}', sym2)); continue; }
      const sym = SYM[((symI++ + (h.seed | 0)) % SYM.length + SYM.length) % SYM.length];
      q.rebelName = q.rtype === 'religious' ? (eastern(lib) ? sym + '教军' : place + '圣战军') : q.rtype === 'loyalist' ? (q.memoryOf >= 0 && P[q.memoryOf].short ? P[q.memoryOf].short + '遗民军' : place + '义军') : q.rtype === 'ethnic' ? (cultName(q.civ).replace(/文明$/, '') + '人起义军') : eastern(lib) ? sym + '军' : place + '起义军'; }
    // 帝号是法理名分，不看当下大小：称帝以后就是帝国，哪怕只剩一城；政体（君主制、游牧、封建、集权、神权）照旧，只是等级升到了帝国
    const empAt = (q, y) => { const L = q.emp; if (!L) return false; if (y === undefined) return q.crown !== undefined; for (let i = 0; i < L.length; i += 2) if (y >= L[i] && (L[i + 1] === null || y < L[i + 1])) return true; return false; };
    const kingAt = (q, y) => q.king !== undefined && (y === undefined || y >= q.king);
    const formOf = (q, n, cs, vas, y) => q.theo !== undefined && (y === undefined || y >= q.theo) ? 'theo' : empAt(q, y) ? 'empire' : nomadAt(q, y) ? (cs >= 3 ? 'nomad' : 'chief') : n <= 2 && cs <= 3 ? 'city' : vas && cs >= 3 ? 'vassal' : cs <= 2 ? 'chief' : 'kingdom';
    // 政体（与等级分开）：君主制 / 封建 / 集权 / 游牧 / 神权 / 共和 / 城邦 / 酋邦 / 附庸
    const regimeOf = (q, y) => { const n = nAt(q, y), cs = stageAt(capAt(q, y).r, y); if (q.theo !== undefined && y >= q.theo) return 'theo'; if (q.republic) return 'republic'; if (nomadAt(q, y)) return 'nomad'; if (vasAt(q, y) && cs >= 3) return 'vassal'; const e = empAt(q, y); if (!e && n <= 2 && cs <= 3) return 'city'; if (cs <= 2) return e ? 'monarchy' : 'chief'; return cs >= 7 ? 'central' : cs === 6 ? 'feudal' : 'monarchy'; };
    const REGW = { monarchy: '君主制', feudal: '封建', central: '集权', nomad: '游牧', theo: '神权' };
    const formLabelOf = (q, y) => { const g = regimeOf(q, y); if (empAt(q, y)) return (REGW[g] || '君主制') + '帝国';
      if (g === 'theo') return '神权政体（政教合一）'; if (g === 'republic') return '共和国'; if (g === 'nomad') return '游牧政权'; if (g === 'vassal') return '附庸国（自有疆土与朝廷，向宗主称臣）'; if (g === 'city') return '城邦'; if (g === 'chief') return '酋邦';
      const T = titlesAt(q, y); return REGW[g] + (!kingAt(q, y) && T.duchy ? '公国' : '王国'); }; // 附庸：用文化库的附庸称号（公国、藩国、萨特拉普辖地……），不称帝
    const vasAt = (q, y) => { let l = -1; for (let i = 0; i < q.vas.length; i += 2) { if (q.vas[i] > y) break; l = q.vas[i + 1]; } return l >= 0; };
    const nAt = (q, y) => { let n = q.ext.length ? q.ext[1] : 1; for (let i = 0; i < q.ext.length; i += 2) { if (q.ext[i] > y) break; n = q.ext[i + 1]; } return n; };
    const capAt = (q, y) => { let c = q.caps[0]; for (const x of q.caps) { if (x.year > y) break; c = x; } return c; };
    // 现在的国名沿用现在地图上的国名——但只在政体相同时；推演的终局政体不同（如游牧部落成了酋邦）就按文化库里该政体的称号重新组名
    const shortAt = (p, y) => (datedName(P[p].names, y) || P[p].names[0])[1];
    const nameAt = (p, y) => { const q = P[p], short = shortAt(p, y); if (q.rebelName && (q.rebelUntil === undefined || y < q.rebelUntil)) return q.rebelName; const c = capAt(q, y); const fm = formOf(q, nAt(q, y), stageAt(c.r, y), vasAt(q, y), y), T = titlesAt(q, y); if (q.republic) return short + T.republic; if (fm === 'kingdom' && T.duchy && !kingAt(q, y)) return short + T.duchy; if (fm === 'empire' && T.nomadEmpire && nomadAt(q, y)) return short + T.nomadEmpire; return short + T[fm]; };
    const cityName = i => i >= 0 && C.cities[i] ? G.HistoryCities.reference(i) : '';
    const own0 = new Map(); for (let i = 0; i < log.length; i += 3) { const r = log[i]; if (!own0.has(r)) own0.set(r, []); own0.get(r).push(log[i + 1], log[i + 2]); }
    const owner0 = (r, y) => { const L = own0.get(r); let o = -1; if (L) for (let i = 0; i < L.length; i += 2) if (L[i] <= y) o = L[i + 1]; return o; };
    const relName = f => RELS[f] ? RELS[f].name : '本教';
    const big = p => P[p].peakN >= NAMEBIG;
    // ---------- 王朝（家族）：先定好每个政权的历代王朝，编年史与君主世系共用 ----------
    const dynastyLibAt = (q, y) => libOf(rulingCultureAt(q, y));
    { const CE = G.CultureExt, rndH = mulberry32((h.seed | 0) + 5354);
      for (const id of order) { const q = P[id]; q.houses = []; if (!CE) continue; buildDynastyHouses(q, P, dynastyLibAt, rndH, CE);
        const X = CE.ext(dynastyLibAt(q, q.died === null ? E : q.died)); q.govStyle = q.settled !== undefined ? polStyle(q) : X.gov.style; } }
    const houseAt = (p, y) => { const L = P[p].houses || []; let x = L[0]; for (const hh of L) { if (hh[0] > y) break; x = hh; } return x ? x[2] : ''; };
    const texts = [];
    for (const e of events) { const y = e.year; let t = null, major = false;
      switch (e.kind) {
        case 'unify': t = nomadAt(P[e.p], y) ? `${nameAt(e.p, y)}兼并周边诸部` : `${nameAt(e.p, y)}统一周边诸城邦，建立王国`; major = true; break;
        case 'horde': t = `${nameAt(e.p, y)}统一草原诸部，诸部共奉其主，控弦之士云集`; major = true; break;
        case 'hordeJoin': t = `${nameAt(e.q, Math.max(0, y - 1))}归附${nameAt(e.p, y)}`; major = false; break;
        case 'hordeFall': t = `${nameAt(e.p, y)}雄主死后诸子争立，诸部离散${e.gave ? '，弃所占农耕之地，退回草原' : ''}${e.kids && e.kids.length ? '，' + e.kids.map(c => nameAt(c, y)).join('、') + '各自为部' : ''}${e.lostCrown ? '，大汗之号遂绝' : ''}`; major = true; break;
        case 'steppeHome': t = `${nameAt(e.q, y)}的草原故地不服定居的朝廷，另立${nameAt(e.p, y)}`; major = true; break;
        case 'steppeRevolt': t = e.trib ? `${nameAt(e.q, y)}治下的草原诸部叛离，朝廷无力深入草原，册封其首领为藩，是为${nameAt(e.p, y)}` : `${nameAt(e.q, y)}治下的草原诸部叛离，建立${nameAt(e.p, y)}`; major = e.n >= 3; break;
        case 'vassal': t = e.how === 'tributary' ? `${nameAt(e.q, y)}兵败，向${nameAt(e.p, y)}称臣纳贡，受封为藩` : e.how === 'split' ? `${nameAt(e.q, y)}自立，仍奉${nameAt(e.p, y)}为宗主` : `${nameAt(e.q, y)}臣服于${nameAt(e.p, y)}，成为附庸`; major = big(e.p) && P[e.q].peakN >= 3; break;
        case 'alliance': t = `${nameAt(e.p, y)}与${nameAt(e.q, y)}${e.against >= 0 && P[e.against].died !== y ? '为抗衡' + nameAt(e.against, y) : ''}结为同盟`; major = big(e.p) || big(e.q) || (e.against >= 0 && big(e.against)); break;
        case 'allianceJoin': t = `${nameAt(e.p, y)}加入${nameAt(e.q, y)}的盟约${e.against >= 0 ? '，共抗' + nameAt(e.against, y) : ''}`; major = false; break;
        case 'allianceLeave': t = `${nameAt(e.p, Math.max(P[e.p].born, y - 1))}${e.why === 'vassal' ? '称臣于他国，' : e.why === 'perish' ? '覆亡，' : ''}退出盟约`; major = false; break;
        case 'allianceEnd': t = `${nameAt(e.p, Math.max(P[e.p].born, y - 1))}与${nameAt(e.q, Math.max(P[e.q].born, y - 1))}的盟约${e.why === 'threat' ? '因强敌已去' : e.why === 'age' ? '年久' : ''}解散`; major = big(e.p) && big(e.q); break;
        case 'vassalFree': t = `${nameAt(e.q, y)}摆脱${nameAt(e.p, y)}，不再称臣`; major = P[e.q].peakN >= 3; break;
        case 'vassalAnnex': t = `${nameAt(e.p, y)}撤藩，${nameAt(e.q, Math.max(0, y - 1))}并入直辖`; major = P[e.q].peakN >= 3; break;
        case 'annex': if (P[e.q].peakN < 3) break; t = `${nameAt(e.p, y)}吞并${nameAt(e.q, Math.min(y - 1, P[e.q].peakYear))}`; major = big(e.q); break;
        case 'sack': t = `${nameAt(e.p, y)}${e.gun ? '凭火器之利，' : ''}攻破${nameAt(e.q, Math.min(y - 1, P[e.q].peakYear))}都城${cityName(e.city)}`; major = big(e.q); break;
        case 'nomad': t = `${nameAt(e.p, y)}攻入${cityName(e.city)}，${nameAt(e.q, Math.min(y - 1, P[e.q].peakYear))}亡，${shortAt(e.p, y)}入主其地`; major = true; break;
        case 'split': t = `${nameAt(e.p, y)}陷入内乱，${e.kids.map(c => nameAt(c, y)).join('、')}自立`; major = big(e.p); break;
        case 'dynasty': t = `${nameAt(e.q, Math.min(y - 1, P[e.q].peakYear))}亡，${nameAt(e.p, y)}代之`; major = big(e.q); break;
        case 'restore': t = `${nameAt(e.p, y)}收复${shortAt(e.q, y)}故土，宣告复国`; major = true; break;
        case 'crown': { const cn = (e.sc || []).map(c => cultName(c).replace(/文明$/, '')), sw = cn.length <= 3 ? cn.join('、') : cn.slice(0, 2).join('、') + '等文明', nm = nameAt(e.p, y);
          t = e.how === 'conquer' ? `${nameAt(e.p, y - 1)}灭${nameAt(e.q, y - 1)}，承袭其帝统，改称${nm}` : e.how === 'nomad' ? `${shortAt(e.p, y)}入主${nameAt(e.q, y - 1)}故地，并承其帝统，称${nm}` : e.how === 'restore' ? `${nm}重奉${shortAt(e.q, y)}的帝统，帝号中兴`
            : nomadAt(P[e.p], y) ? `${nameAt(e.p, y - 1)}的大汗号令草原诸部，建立游牧帝国，称${nm}` : `${nameAt(e.p, y - 1)}的君主称帝，改称${nm}，成为${sw}诸国法理上的最高君权`; major = true; break; }
        case 'uncrown': t = `${nameAt(e.p, y - 1)}向${nameAt(e.q, y)}称臣，去帝号，降称${nameAt(e.p, y)}`; major = true; break;
        case 'regal': { const q0 = P[e.p], T0 = titlesAt(q0, y), a = nameAt(e.p, Math.max(q0.born, y - 1)), b = nameAt(e.p, y); if (a === b || !T0.duchy || !a.endsWith(T0.duchy) || !b.endsWith(T0.kingdom)) break; t = `${a}晋为王国，称${b}`; major = false; break; } // 只记公国级 → 王国级（同年成为附庸、改称藩 / 土邦的不算）
        case 'wane': { const k = clamp(Math.round((1 - e.n / e.peak) * 10), 1, 9), CN = '〇一二三四五六七八九', nm = nameAt(e.p, y), emp = empAt(P[e.p], y);
          t = e.lv === 1 ? `${nm}由盛转衰，疆土较鼎盛时十去其${CN[k]}` : emp ? `${nm}名存实亡，疆土较鼎盛时十去其${CN[k]}，帝号徒存` : `${nm}日渐衰微，疆土较鼎盛时十去其${CN[k]}`; major = big(e.p); break; }
        case 'decay': t = nameAt(e.p, Math.max(P[e.p].born, y - 1)) + ({ age: '立国日久，弊政丛生，律令废弛，国势中衰', over: '疆域过广，鞭长莫及，地方日益离心', war: '连年兵败，国力虚耗，人心浮动', foreign: '异族达半，各怀异志，统治动摇', lag: '墨守旧制，落后于邻国，朝野失望', court: '朝政紊乱，权臣当道，内争不休' }[e.why] || '国势中衰'); major = big(e.p); break;
        case 'defeat': t = `${nameAt(e.q, Math.max(P[e.q].born, y - 1))}为${nameAt(e.p, y)}所败，丧失 ${e.n} 地`; major = big(e.q) && e.n >= 5; break;
        case 'perish': t = `${nameAt(e.p, Math.max(P[e.p].born, y - 1))}失去最后的疆土，就此覆亡`; major = big(e.p); break;
        case 'capital': if (e.city < 0) break; { const nm = nameAt(e.p, y), cn = cityName(e.city);
          t = e.why === 'final' || e.why === 'found' ? `${nm}定都${cn}` : e.why === 'center' ? `${nm}疆域日广，为便于统治，迁都${cn}` : e.why === 'sack' ? `都城失陷，${nm}迁都${cn}` : e.why === 'split' ? `${nm}分裂后迁都${cn}` : e.why === 'dynasty' ? `新朝${nm}迁都${cn}` : `${nm}迁都${cn}`; }
          major = e.why === 'center' && big(e.p); break;
        case 'settle': t = `${nameAt(e.p, y - 1)}入主农耕之地，迁都${cityName(e.city)}，改行定居王朝，称${nameAt(e.p, y)}`; major = true; break;
        case 'sedent': t = `${nameAt(e.p, y - 1)}弃游牧而筑城定居，改行定居王朝，称${nameAt(e.p, y)}`; major = big(e.p); break;
        case 'idea': t = `${D.IDEAS[e.k].name}思潮在${cityName(e.city) || (owner0(e.r, y) >= 0 ? nameAt(owner0(e.r, y), y) : '某地')}兴起：${D.IDEAS[e.k].desc}`; major = true; break;
        case 'adopt': t = `${nameAt(e.p, y)}接纳${D.IDEAS[e.k].name}思潮${D.IDEAS[e.k].id === 'navigation' ? '，从此可以远渡重洋' : ''}`; major = D.IDEAS[e.k].id === 'navigation'; break;
        case 'schism': t = `${nameAt(e.p, y)}改奉${RELS[e.g].name}，自${RELS[e.f].name}分裂而出`; major = true; break;
        case 'theocracy': t = `${nameAt(e.p, y - 1)}祭司掌权，以${relName(e.f)}立国，政教合一，改称${nameAt(e.p, y)}`; major = true; break;
        case 'tribalFree': t = `${nameAt(e.p, y)}失去 ${e.n} 处边地的控制，当地部族恢复松散自治`; major = e.n >= 3; break;
        case 'secede': t = `${nameAt(e.p, y)}脱离${nameAt(e.q, Math.min(y - 1, P[e.q].peakYear))}独立`; major = true; break;
        case 'rise': t = `${nameAt(e.p, y)}建立`; major = true; break;
        case 'organize': t = `${nameAt(e.p, y)}初置行省，分天下为 ${e.n} 省`; major = big(e.p); break;
        case 'fromState': t = `${nameAt(e.p, y)}灭${nameAt(e.q, Math.min(y - 1, P[e.q].peakYear))}，以其地置${PV[e.pv].name}`; major = big(e.q) || P[e.q].peakN >= 3; break;
        case 'transfer': t = `${PV[e.pv].name}改隶${nameAt(e.p, y)}`; major = false; break;
        case 'provSecede': t = `${PV[e.pv].name}割据自立，建立${nameAt(e.p, y)}`; major = PV[e.pv].n >= 3 || big(e.q); break;
        case 'provSplit': t = e.pop ? `${PV[e.pv].name}人丁繁盛，${nameAt(e.p, y)}析其地置${PV[e.nv].name}` : `${nameAt(e.p, y)}析${PV[e.pv].name}，置${PV[e.nv].name}`; major = false; break;
        case 'provRedraw': { const L = a => a.slice(0, 3).map(v => PV[v].name).join('、') + (a.length > 3 ? `等 ${a.length} 省` : ''); t = `${nameAt(e.p, y)}重划疆界：撤${L(e.olds)}，改置${L(e.news)}`; major = false; break; }
        case 'reform': t = `${nameAt(e.p, y)}改行今制，全国分为 ${e.n} 省`; major = false; break;
        case 'disaster': t = `${{ drought: '大旱', flood: '大水', locust: '蝗灾', famine: '饥荒' }[e.kind2 || e.dk] || '饥荒'}${e.p >= 0 ? '席卷' + nameAt(e.p, y) : ''}，${e.n} 地颗粒无收`; major = false; break;
        case 'revolt': t = `${e.famine ? '饥民四起，' : ''}${nameAt(e.q, y)}境内爆发${P[e.p].rebelName}（${{ peasant: '农民起义', ethnic: '民族起义', religious: '教民起义', loyalist: '遗民起义' }[e.rtype]}，${P[e.p].rebelGoal === 'independence' ? '争取独立' : '意在推翻朝廷'}）`; major = P[e.p].outcome === 'state' || P[e.p].outcome === 'overthrow'; break;
        case 'rebelDisperse': t = e.why === 'fall' ? `${nameAt(e.q, y - 1)}覆亡，${P[e.p].rebelName}失去对抗对象，成员四散` : `${P[e.p].rebelName}久攻不进，逐渐瓦解`; major = false; break;
        case 'suppress': t = `${nameAt(e.q, y)}镇压了${P[e.p].rebelName}`; major = false; break;
        case 'rebelState': t = e.restoreOf >= 0 ? `${P[e.p].rebelName}光复故土，${nameAt(e.p, y)}复国` : `${P[e.p].rebelName}割据一方，建立${nameAt(e.p, y)}`; major = true; break;
        case 'overthrow': t = shortAt(e.p, y) === shortAt(e.q, y - 1) && e.restoreOf < 0 ? `${P[e.p].rebelName}攻入都城${cityName(e.city)}，${houseAt(e.q, y - 1)}覆亡，${houseAt(e.p, y)}入主${nameAt(e.p, y)}` : e.restoreOf >= 0 ? `${P[e.p].rebelName}攻入${cityName(e.city)}，${nameAt(e.q, y - 1)}亡，遗民光复故国，${nameAt(e.p, y)}复国` : `${P[e.p].rebelName}攻入都城${cityName(e.city)}，${nameAt(e.q, y - 1)}亡，${nameAt(e.p, y)}代之`; major = true; break;
        case 'house': { const L = P[e.p].houses || [], a = e.q === undefined ? L[e.k - 1]?.[2] : houseAt(e.q, y - 1), b = e.q === undefined ? L[e.k]?.[2] : houseAt(e.p, y), nm = nameAt(e.p, y);
          if (!a || !b) break;
          t = e.how === 'coup' ? `${nm}宫廷政变，${a}被推翻，${b}夺得大位，国号不改` : `${nm}的${a}终结，${b}入继大统`; major = big(e.q === undefined ? e.p : e.q); break; }
        case 'coup': t = `${nameAt(e.q, y - 1)}宫廷政变，${nameAt(e.p, y)}代之`; major = big(e.q); break;
        case 'revolution': t = `${nameAt(e.q, y - 1)}爆发革命，改建${nameAt(e.p, y)}`; major = true; break;
        case 'colonyCity': t = `${nameAt(e.p, y)}在新大陆建起第一座殖民${e.port ? '港口' : '城市'}${cityName(e.city)}`; major = true; break;
        case 'discovery': t = `${nameAt(e.p, y)}的船队远渡重洋，抵达新大陆，大航海时代开始`; major = true; break;
        case 'colony': t = `${nameAt(e.p, y)}在新大陆建立殖民地${e.city >= 0 ? cityName(e.city) : ''}`; major = !!e.first; break;
        case 'independence': t = `${nameAt(e.q, y)}的新大陆殖民地宣布独立，建立${nameAt(e.p, y)}`; major = true; break;
        case 'migrate': t = `${cultName(e.c)}的部族随${nameAt(e.p, y)}的征服迁入新地`; major = big(e.p); break;
        case 'peacefulUnion': t = `${nameAt(e.q, y - 1)}与邻国${nameAt(e.p, y)}和平合邦`; break;
        case 'territoryCede': t = `${nameAt(e.q, y)}失去对远离本土的 ${e.n} 处领地的控制，${nameAt(e.p, y)}接管当地`; break;
        case 'territoryIntegrate': t = `${nameAt(e.p, y)}将境内及沿海 ${e.n} 处无主地区纳入行政管辖`; break;
        case 'frontierAffiliation': t = `边疆聚落归附${nameAt(e.p, y)}`; break;
        case 'holyWarStart': t = `${nameAt(e.p, y)}以${RELS[e.f].name}之名发起圣战`; major = true; break;
        case 'holyWarWon': t = `${nameAt(e.p, y)}在圣战取得的土地上建立宗教政权`; major = true; break;
        case 'holyWarConquest': t = `${nameAt(e.p, y)}在圣战中取得领土`; major = true; break;
        case 'holyWarFail': t = `${nameAt(e.p, y)}发动的圣战因${({timeout:'久攻未克',supply:'粮食不足',mobilization:'可征召人口不足',unreachable:'路程超出战役期限', 'changed-control':'边境易主', 'lost-objective':'未能守住目标'})[e.reason] || '战局变化'}而结束`; major = true; break;
        case 'convert': t = `${nameAt(e.p, Math.max(P[e.p].born, y - 1))}奉${RELS[e.f] ? RELS[e.f].name : '新宗教'}为国教`; major = big(e.p); break;
      }
      if (t) texts.push({ year: y, kind: e.kind === 'secede' ? 'secede' : e.kind, text: t, r: e.r || 0, city: e.city !== undefined ? e.city : undefined, p: e.p, q: e.q, restoreOf: e.kind === 'restore' ? e.q : e.restoreOf, war: e.war, religion: e.f, reason: e.reason, regions: e.regions, kids: e.kids, pv: e.pv, nv: e.nv, pvs: e.olds ? e.olds.concat(e.news) : undefined, major }); }
    // ---------- 君主世系与政府组织：人名、王朝（家族）、称谓、庙号或序数、官制，均取自文化库 ----------
    { const CE = G.CultureExt, rndR = mulberry32((h.seed | 0) + 5353), accessionRnd = mulberry32((h.seed | 0) ^ 0x62af1893), regCount = new Map(), firstOf = new Map();
      const govKey = (q, y) => { if (q.rtype && y >= q.rebelSince && (q.rebelUntil === undefined || y < q.rebelUntil)) return 'rebel'; if (q.theo !== undefined && y >= q.theo) return 'theo'; if (q.republic) return 'republic'; if (nomadAt(q, y)) return stageAt(capAt(q, y).r, y) >= 3 ? 'nomad' : 'chief';
        const c = capAt(q, y), cs = stageAt(c.r, y), fm = formOf(q, nAt(q, y), cs, vasAt(q, y), y); if (fm === 'vassal') return 'vassal'; if (fm === 'nomad') return 'nomad'; if (fm === 'chief') return 'chief'; if (fm === 'city') return 'city'; if (cs >= 7) return 'central'; if (cs === 6) return 'feudal'; return fm === 'empire' ? 'empire' : 'king'; };
      for (const q of P) { q.rulers = []; q.gov = []; if (!CE || !q.houses.length) continue;
        buildDynastyRulers(q, { CE, libAt:dynastyLibAt, rnd:rndR, accessionRnd, end:q.died === null ? E : q.died, govKey, governmentStyle:(p,y,X) => p.settled !== undefined && y >= p.settled ? polStyle(p) : X.gov.style, formAt:(p,y) => formOf(p, nAt(p,y), stageAt(capAt(p,y).r,y), vasAt(p,y), y), religions:RELS, regCount, firstOf }); } }
    // ---------- 思潮：兴起与大国接纳（写进编年史） ----------
    { D.IDEAS.forEach((I, k) => { const yb = D.ideaBorn[k]; if (!(yb < INF) || yb > E) return; const o = D.ideaOrigins[k].filter(r => D.ideaA[k * NN + r] <= yb + 60)[0] || D.ideaOrigins[k][0]; if (!o) return;
        ev(G.HistoryDate.ceil(yb), 'idea', { k, r: o, city: bigCity(o, G.HistoryDate.ceil(yb)) });
        // 大国接纳：都城所在之地接纳的那一年
        for (const q of P) { if (q.rtype) continue; const endY = q.died === null ? E : q.died; let t = INF;
          for (let i = 0; i < q.caps.length && t >= INF; i++) { const c = q.caps[i], a = c.year, b = i + 1 < q.caps.length ? q.caps[i + 1].year : endY, ya = D.ideaA[k * NN + c.r]; const yy = Math.max(a, ya); if (ya < INF && yy < b) t = yy; }
          if (t < INF) (q.ideaAdopt = q.ideaAdopt || []).push([k, G.HistoryDate.ceil(t)]);
          if (q.peakN >= NAMEBIG && t < INF && t > q.born + 5 && t > yb + 5) ev(G.HistoryDate.ceil(t), 'adopt', { p: q.id, k, r: q.cap }); } }); }
    // ---------- 配色：同时代相邻的政权不同色；王朝更替、复国沿用前代色相 ----------
    const adj = Array.from({ length: P.length }, () => new Set());
    { const own = new Int32Array(nR + 1).fill(-1); let li = 0; const ord = []; for (let i = 0; i < log.length; i += 3) ord.push(i); ord.sort((a, b) => log[a + 1] - log[b + 1] || a - b);
      const ticks = []; for (let y = ys; y <= E; y += TICK * 5) ticks.push(y);
      for (const y of ticks) { while (li < ord.length && log[ord[li] + 1] <= y) { const i = ord[li++]; own[log[i]] = log[i + 2]; }
        for (const ed of R.edges) { const a = own[ed.a], b = own[ed.b]; if (a >= 0 && b >= 0 && a !== b) { adj[a].add(b); adj[b].add(a); } } } }
    const HUES = [8, 32, 52, 88, 128, 160, 188, 212, 238, 268, 292, 320]; // 与人文地图原有的国家配色同一套：柔和的地图色
    const hsl = (hh, s, l) => { hh = ((hh % 360) + 360) % 360 / 360; const f = n => { const k = (n + hh * 12) % 12, a = s * Math.min(l, 1 - l); return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); }; return [f(0), f(8), f(4)]; };
    const slot = new Int16Array(P.length).fill(-1);
    for (const id of order) { const q = P[id], used2 = new Set(); for (const o of adj[id]) if (slot[o] >= 0) used2.add(slot[o]);
      const pref = []; const pa = q.parents.find(x => x.kind === 'dynasty' || x.kind === 'restore'); if (pa && slot[pa.id] >= 0) pref.push(slot[pa.id]);
      const sp = q.parents.find(x => x.kind === 'split' || x.kind === 'secede'); if (sp && slot[sp.id] >= 0) { const s0 = slot[sp.id]; pref.push((s0 % 12) + 12 * ((Math.floor(s0 / 12) + 1) % 3), (s0 % 12) + 12 * ((Math.floor(s0 / 12) + 2) % 3)); }
      let s = pref.find(x => !used2.has(x)); if (s === undefined) for (let t = 0; t < 36; t++) { const c = ((id * 7 + t * 5) % 12) + 12 * ((id + Math.floor(t / 12)) % 3); if (!used2.has(c)) { s = c; break; } } if (s === undefined) s = id % 36;
      slot[id] = s; q.color = hsl(HUES[s % 12] + ((id * 13) % 9) - 4, [0.5, 0.46, 0.44][Math.floor(s / 12)], [0.74, 0.8, 0.66][Math.floor(s / 12)]);
      { const A = sameRealm(q); if (A && A.short === q.short && A.color && slot[A.id] === s) q.color = A.color.slice(); } } // 西方式同一国家：换了王朝也不换颜色

    // ---------- 月份细化：沿用十年宏观轮次，关联事务在同一月份生效 ----------
    // 每个政权在每一步里有自己的“月份”：它的易手、迁都、称臣、建国与灭亡都落在同一个细化月份；同一件事的当事者（灭国者与被灭者、分裂出的诸国与母国）对齐到同一月
    { const isTick = y => y !== null && y !== undefined && y >= ys && y < E && (y - ys) % TICK === 0;
      const hj = a => { a = (a ^ 61) ^ (a >>> 16); a = (a + (a << 3)) | 0; a ^= a >>> 4; a = Math.imul(a, 0x27d4eb2d); a ^= a >>> 15; return (a >>> 0) / 4294967296; };
      const par = new Map(), K = (y, p) => y * 100000 + p;
      const find = k => { let x = k; while (par.has(x)) x = par.get(x); let c = k; while (par.has(c)) { const n = par.get(c); par.set(c, x); c = n; } return x; };
      const union = (y, a, b) => { if (a === undefined || b === undefined || a < 0 || b < 0 || a === b) return; const ra = find(K(y, a)), rb = find(K(y, b)); if (ra !== rb) par.set(rb, ra); };
      const LINK = new Set(['vassal', 'vassalFree', 'vassalAnnex', 'crown', 'uncrown']);
      for (const e of events) { const y = e.year; if (!isTick(y) || e.p === undefined || e.p < 0) continue;
        for (const x of [e.q, ...(e.kids || [])]) if (x !== undefined && x >= 0 && P[x] && (P[x].born === y || P[x].died === y || LINK.has(e.kind))) union(y, e.p, x); }
      { const cur = new Int32Array(nR + 1).fill(-1); for (let i = 0; i < log.length; i += 3) { const r = log[i], y = log[i + 1], o = log[i + 2], pv = cur[r]; cur[r] = o; if (isTick(y) && pv >= 0 && o >= 0) union(y, o, pv); } } // 同一步领土易手的双方对齐，省界和治所不会先于或晚于易手
      for (const q of P) if (q.rebelTargets) for (let i = 1; i < q.rebelTargets.length; i++) {
        const [y, next] = q.rebelTargets[i]; union(y, q.id, next); union(y, q.id, q.rebelTargets[i - 1][1]);
      }
      // 回拨整件关联政权事务时，省治所必须在回拨后的年份已存在。
      const provinceOwnerAt=(X,y)=>{let p=X.hist[1];for(let i=3;i<X.hist.length&&X.hist[i]<=y;i+=3)p=X.hist[i+1];return p;},maxRollback=new Map();
      for(const X of PV){let previous=-Infinity;for(const [y,i] of X.seatCities){const p=provinceOwnerAt(X,y),r=C.cities[i]?.r;if(isTick(y)&&p>=0&&r){const key=find(K(y,p)),allowed=administration.rollbackLimit(r,y,popAt,TICK-1,previous);maxRollback.set(key,Math.min(maxRollback.get(key)??(TICK-1),allowed));}previous=y;}}
      const cultureHistory = new Map(); for (let i = 0; i < cLog.length; i += 3) { const r = cLog[i]; if (!cultureHistory.has(r)) cultureHistory.set(r, []); cultureHistory.get(r).push(cLog[i + 1], cLog[i + 2]); }
      for (const q of P) for (const [year, r, civ] of [[q.born, q._initialRegion, q.initialCiv], [q.settled, q._settledRegion, q.settledCiv]]) {
        if (!isTick(year) || !(r > 0) || civ === -1 || civ === undefined) continue;
        const allowed = cultureRollbackLimit(cultureHistory.get(r) || [], year, civ); if (allowed === null) continue;
        const key = find(K(year, q.id)); maxRollback.set(key, Math.min(maxRollback.get(key) ?? (TICK - 1), allowed));
      }
      for (const c of military.output().campaigns) {
        if (!isTick(c.year)) continue;
        const earliest = Math.max(P[c.attacker].born, c.defender >= 0 ? P[c.defender].born : 0);
        const allowed = Math.max(0, c.year - earliest - (c.preResultDays || 0) / military.output().yearDays), key = find(K(c.year, c.attacker));
        maxRollback.set(key, Math.min(maxRollback.get(key) ?? (TICK - 1), Math.floor(allowed * 12 + 1e-7) / 12));
      }
      const dOf = (p, y) => {if(!isTick(y)||p===undefined||p<0)return 0;const key=find(K(y,p));return Math.min(Math.floor(hj(key + (h.seed | 0) * 7919) * TICK * 12) / 12, Math.floor((maxRollback.get(key)??(TICK-1))*12+1e-7)/12, y);};
      const J = (p, y) => G.HistoryDate.ceil(y - dOf(p, y)), Jr = (r, y) => isTick(y) ? G.HistoryDate.ceil(Math.max(0, y - Math.floor(hj(r * 131 + y + (h.seed | 0)) * TICK * 12) / 12)) : G.HistoryDate.ceil(y);
      // 新教派的创立、首次传入与改奉事件在同一月发生。
      for (const e of events) if (e.kind === 'schism') {
        const at = J(e.p, e.year); RELS[e.g].founded = at;
        for (let i = 0; i < rLog.length; i += 3) if (rLog[i + 1] === e.year && rLog[i + 2] === e.g) rLog[i + 1] = at;
      }
      // 边防状态与导致它变更的边界日志使用同一细化年份；普通建设和长期内陆转换保留实际演算年份。
      { const changes = new Map(), cur = new Int32Array(nR + 1).fill(-1);
        for (let i = 0; i < log.length; i += 3) { const r = log[i], y = log[i + 1], o = log[i + 2], key = `${r},${y}`, t = J(o >= 0 ? o : cur[r], y); cur[r] = o; changes.set(key, Math.max(changes.get(key) ?? -Infinity, t)); }
        for (const f of fortManager.forts) { const others = f.site.edges.map(id => { const e = R.edges[id]; return e.a === f.region ? e.b : e.a; }), mapped = new Map(); let prev = f.year;
          for (const entry of f.statusLog) { const old = entry[0]; if (entry[4] === 'frontier_lost' || entry[4] === 'frontier_restored') { const t = Math.max(changes.get(`${f.region},${old}`) ?? -Infinity, ...others.map(r => changes.get(`${r},${old}`) ?? -Infinity)); if (Number.isFinite(t)) entry[0] = Math.max(prev, t); }
            mapped.set(old, entry[0]); prev = entry[0]; }
          let last = f.year; for (const entry of f.log) { if (mapped.has(entry[0])) entry[0] = Math.max(last, mapped.get(entry[0])); last = entry[0]; }
        }
      }
      // 区块易手：按新主人（弃地按旧主人）；同一区块同一步里的先后不变
      { const cur = new Int32Array(nR + 1).fill(-1), last = new Float64Array(nR + 1).fill(-Infinity);
        for (let i = 0; i < log.length; i += 3) { const r = log[i], y = log[i + 1], o = log[i + 2]; let ny = J(o >= 0 ? o : cur[r], y); if (ny < last[r]) ny = last[r]; log[i + 1] = ny; last[r] = ny; cur[r] = o; } }
      // 省界变动：跟着当时的主人
      { const last = new Float64Array(nR + 1).fill(-Infinity); for (let i = 0; i < pvLog.length; i += 3) { const r = pvLog[i], y = pvLog[i + 1]; const current = owner0(r, y), p = current >= 0 ? current : owner0(r, y - 1); let ny = J(p, y); if (ny < last[r]) ny = last[r]; pvLog[i + 1] = ny; last[r] = ny; } }
      for (const X of PV) { const ownerAtTick = y => { let p = X.hist[1]; for (let i = 3; i < X.hist.length && X.hist[i] <= y; i += 3) p = X.hist[i + 1]; return p; };
        for (let i = 1; i < X.seats.length; i++) X.seats[i][0] = J(ownerAtTick(X.seats[i][0]), X.seats[i][0]);
        if (X.abolished !== null) X.abolished = J(ownerAtTick(X.abolished), X.abolished);
        for (let i = 0; i < X.hist.length; i += 3) X.hist[i] = J(X.hist[i + 1], X.hist[i]); X.created = X.hist[0]; if (X.seats.length) X.seats[0][0] = X.created; }
      // 政权：建国、灭亡、迁都、宗藩、鼎盛、建制、政教合一、定居、起义
      const rebelRefs = new Map();
      for (const q of P) { const id = q.id, b0 = q.born, oldSettled = q.settled, oldCulture = q.rulingCulture.map(x => x.slice()); q.born = J(id, b0); const db = q.born - b0; if (q.died !== null) q.died = J(id, q.died);
        if (q._rebelCity !== undefined) { const old = G.HistoryCities.reference(q._rebelCity, b0), now = G.HistoryCities.reference(q._rebelCity, q.born); q.rebelName = q.rebelName.split(old).join(now); rebelRefs.set(id, [old, now]); }
        for (const x of q.names) x[0] = J(id, x[0]); for (const x of q.rulingCulture) x[0] = J(id, x[0]); for (const x of q.titlesLog) x[0] = J(id, x[0]);
        for (const c of q.caps) c.year = J(id, c.year); for (let i = 0; i < q.vas.length; i += 2) q.vas[i] = J(id, q.vas[i]); for (let i = 0; i < q.ext.length; i += 2) q.ext[i] = J(id, q.ext[i]);
        q.peakYear = J(id, q.peakYear); for (const f of ['org', 'theo', 'settled', 'rebelSince', 'rebelUntil', 'restoreYear', 'king']) if (typeof q[f] === 'number') q[f] = J(id, q[f]);
        if (q.rebelTargets) for (const x of q.rebelTargets) x[0] = J(id, x[0]);
        if (q.emp) for (let i = 0; i < q.emp.length; i++) if (q.emp[i] !== null) q.emp[i] = J(id, q.emp[i]);
        if (q.ideaAdopt) for (const a of q.ideaAdopt) a[1] = Math.max(q.born, J(id, a[1]));
        if (q.msys) { let lm = q.born; for (const a of q.msys) { a[0] = Math.max(lm, J(id, a[0])); lm = a[0]; } q.msys[0][0] = q.born; }
        const end = q.died === null ? E : q.died; let ly = -Infinity;
        const HY = q.houses ? q.houses.map((x, k) => k ? Math.min(end, J(id, x[0])) : q.born) : []; if (q.houses) q.houses.forEach((x, k) => { x[4] = HY[k]; });
        if (q.rulers) { let lk = 0; for (const rr of q.rulers) { const old = rr[0], k = rr[3], nk = k !== undefined && k !== lk && HY[k] !== undefined, nx = k !== undefined && HY[k + 1] !== undefined ? HY[k + 1] - 1 : end;
          const proposed = nk ? HY[k] : Math.min(nx, old + db), aligned = alignCultureYear(oldCulture, q.rulingCulture, old, proposed);
          rr[0] = G.HistoryDate.ceil(Math.max(ly, Math.min(end, nx, aligned))); ly = rr[0]; if (k !== undefined) lk = k; } } /* 新王朝的第一位君主与编年史同年即位 */
        const govPeriods = oldCulture.map(x => x.slice()); if (typeof oldSettled === 'number' && oldSettled > b0 && !govPeriods.some(x => x[0] === oldSettled)) { govPeriods.push([oldSettled, null]); govPeriods.sort((a,b) => a[0]-b[0]); }
        const refinedGovPeriods = govPeriods.map(x => [J(id, x[0]), x[1]]);
        if (q.gov) for (const g of q.gov) { const old = g[0], atChange = govPeriods.some(x => x[0] === old); g[0] = G.HistoryDate.ceil(Math.max(q.born, alignCultureYear(govPeriods, refinedGovPeriods, old, atChange ? J(id, old) : old + db))); } }
      for (const w of holyWars.records) { w.started = J(w.attacker, w.started); if (w.ended !== null) w.ended = J(w.attacker, w.ended); if (w.capturedYear !== undefined) w.capturedYear = J(w.attacker, w.capturedYear); for (const entry of w.supply) entry.year = J(w.attacker, entry.year); }
      military.refineYears(J, {earliest:c => Math.max(P[c.attacker].born, c.defender >= 0 ? P[c.defender].born : 0)});
      const campaignById = new Map(military.output().campaigns.map(c => [c.id, c]));
      const warStart = new Map();
      for (const w of holyWars.records) {
        const c = campaignById.get(w.campaignId);
        if (c) w.started = Math.min(w.started, G.HistoryDate.time(c.startTime));
        warStart.set(w.id, w.started);
      }
      // 编年史：跟着当事的政权（没有政权的按地点）
      for (const t of texts) { t.year = t.kind === 'holyWarStart' ? warStart.get(t.war) : t.kind === 'convert' ? G.HistoryDate.ceil(t.year) : t.p !== undefined && t.p >= 0 ? J(t.p, t.year) : Jr(t.r || 0, t.year); for (const p of [t.p, t.q]) { const pair = rebelRefs.get(p); if (pair) t.text = t.text.split(pair[0]).join(pair[1]); } } }

    // 弑君、篡位与继位是同一次实际交接；日期细化后用君主记录的日期生成编年史。
    for (const q of P) for (let i = 1; i < q.rulers.length; i++) {
      const ruler = q.rulers[i], previous = q.rulers[i - 1];
      if (ruler[6] !== 'regicide' && ruler[6] !== 'usurp') continue;
      const at = ruler[0], cap = capAt(q, at), murdered = ruler[6] === 'regicide';
      texts.push({ year: at, kind: ruler[6], p: q.id, r: cap.r, major: q.peakN >= NAMEBIG,
        text: murdered ? `${nameAt(q.id, at)}的${previous[2]}${previous[1]}遭${ruler[1]}弑杀，${ruler[1]}夺位` : `${nameAt(q.id, at)}的${previous[2]}${previous[1]}被${ruler[1]}废黜，${ruler[1]}篡位` });
    }

    // ---------- 地名按当时的统治文化正向命名，同库易主保留原名 ----------
    {
      const rndM = mulberry32((h.seed | 0) + 7373), cityUsed = new Set(), provUsed = new Set();
      const ownSeq = Array.from({ length: nR + 1 }, () => []); for (let i = 0; i < log.length; i += 3) ownSeq[log[i]].push(log[i + 1], log[i + 2]);
      const cSeq = Array.from({ length: nR + 1 }, () => []); for (let i = 0; i < cLog.length; i += 3) cSeq[cLog[i]].push(cLog[i + 1], cLog[i + 2]);
      const seqAt = (L, y, d) => { let v = d; for (let k = 0; k < L.length; k += 2) { if (L[k] > y) break; v = L[k + 1]; } return v; };
      const work = [], placeEvents = [];
      function prepare(object, kind, start, end, ownerSeq, seats, firstKind) {
        const state = { object, kind, names: [], key: null, ownerSeq, seats, firstKind, index: work.length }; work.push(state);
        const years = new Set([start]);
        for (let i = 0; i < ownerSeq.length; i += 2) { const y = ownerSeq[i], p = ownerSeq[i + 1]; if (y > start && y < end) years.add(y);
          if (p >= 0 && P[p]) for (const [when] of P[p].rulingCulture) if (when > start && when < end) years.add(when); }
        for (const [y, r] of seats) { if (y > start && y < end) years.add(y); if (r > 0) for (let i = 0; i < cSeq[r].length; i += 2) { const t = cSeq[r][i]; if (t > start && t < end) years.add(t); } }
        for (const year of years) placeEvents.push({ year, state });
      }
      for (const X of PV) { const os = []; for (let i = 0; i < X.hist.length; i += 3) os.push(X.hist[i], X.hist[i + 1]); X._nameBeforeRuling = X.name;
        prepare(X, 'prov', X.created, X.abolished === null ? E + 1 : X.abolished, os, X.seats, X.why === 'pop' ? 'splitPop' : X.kind); }
      for (const c of C.cities) { const r = c.r || 0;
        prepare(c, 'city', c.founded, c.ruined || E + 1, ownSeq[r], [[c.founded, r]], 'found'); }
      placeEvents.sort((a,b) => a.year - b.year || a.state.index - b.state.index);
      for (const {year, state} of placeEvents) { const o = seqAt(state.ownerSeq, year, -1); let r = state.seats[0][1]; for (const [y, rr] of state.seats) { if (y > year) break; r = rr; }
        const known = o >= 0 && P[o] ? datedName(P[o].rulingCulture, year) : null;
        const civ = civOr(known ? known[1] : r > 0 ? seqAt(cSeq[r], year, -1) : -1, r), pool = state.kind === 'city' ? cityUsed : provUsed;
        advancePlaceName(state, year, civ, o, state.firstKind, libKeyOf, c => drawRulingName(libOf(c), state.kind, pool, rndM)); }
      for (const state of work) { const x = state.object; x.names = state.names; if (x.names.length) x.name = x.names[x.names.length - 1][1]; }
      for (const q of P) if (q.rebelName) { const event = { text: q.rebelName, year: q.rebelSince }; G.HistoryCities.resolveEvent(event, C.cities); q.rebelName = event.text; }
      // 编年史里的省名按当年的叫法（改隶、割据按易主之前的旧名）
      const pvName = (v, y) => { const L = PV[v].names; let n = L[0][1]; for (const x of L) { if (x[0] > y) break; n = x[1]; } return n; };
      for (const t of texts) { const ids = [t.pv, t.nv].concat(t.pvs || []).filter(v => v !== undefined && v >= 0 && PV[v]); if (!ids.length) continue; const yy = t.kind === 'transfer' || t.kind === 'provSecede' ? t.year - 1 : t.year;
        for (const v of new Set(ids)) { const a = PV[v]._nameBeforeRuling, b = pvName(v, yy); if (a !== b) t.text = t.text.split(a).join(b); } }
    }

    // ---------- 输出：每个区块的易手记录（按年份），政权表 ----------
    const per = Array.from({ length: nR + 1 }, () => []); for (let i = 0; i < log.length; i += 3) per[log[i]].push(log[i + 1], log[i + 2]);
    const off = new Int32Array(nR + 2); for (let r = 1; r <= nR + 1; r++) off[r] = off[r - 1] + (r - 1 >= 1 ? per[r - 1].length / 2 : 0);
    const chgY = new Float64Array(off[nR + 1]), chgO = new Int32Array(off[nR + 1]);
    for (let r = 1; r <= nR; r++) { const l = per[r]; for (let i = 0; i < l.length; i += 2) { chgY[off[r] + i / 2] = l[i]; chgO[off[r] + i / 2] = l[i + 1]; } }
    const polities = P.map(q => ({ short: q.short, bare: q.bare && q.bare !== q.short ? q.bare : undefined, names: q.names, rulingCulture: q.rulingCulture, titles: q.titles, titlesLog: q.titlesLog, type: q.type, nomad: !!q.nomad, civ: q.civ, theoRel: q.theoRel, born: q.born, died: q.died, parents: q.parents, children: q.children,
      caps: q.caps.map(c => [c.year, c.city, c.r]), vas: q.vas.slice(), peakN: q.peakN, peakYear: q.peakYear, color: q.color, heirOf: q.heirOf, ext: q.ext, restoreOf: q.restoreOf === undefined ? -1 : q.restoreOf, restoreYear: q.restoreYear, restoreRegions: q.restoreRegions || [], restoreOrigin: q.rtype === 'loyalist' && q.restoreOf !== undefined ? q.memoryRegion : -1, coreAtDeath: q.coreAtDeath || [] }));
    const csr = L => { const per = Array.from({ length: nR + 1 }, () => []); for (let i = 0; i < L.length; i += 3) per[L[i]].push(L[i + 1], L[i + 2]);
      const o = new Int32Array(nR + 2); for (let r = 1; r <= nR + 1; r++) o[r] = o[r - 1] + (r - 1 >= 1 ? per[r - 1].length / 2 : 0);
      const yy = new Float64Array(o[nR + 1]), vv = new Int32Array(o[nR + 1]); for (let r = 1; r <= nR; r++) { const l = per[r]; for (let i = 0; i < l.length; i += 2) { yy[o[r] + i / 2] = l[i]; vv[o[r] + i / 2] = l[i + 1]; } } return { off: o, year: yy, val: vv }; };
    // 省份配色：同时代相邻的省不同色（省的色相跨朝代不变）
    const padj = Array.from({ length: PV.length }, () => new Set());
    { const pr = new Int32Array(nR + 1).fill(-1); const ord = []; for (let i = 0; i < pvLog.length; i += 3) ord.push(i); let li = 0;
      for (let y = ys; y <= E; y += TICK * 5) { while (li < ord.length && pvLog[ord[li] + 1] <= y) { const i = ord[li++]; pr[pvLog[i]] = pvLog[i + 2]; }
        for (const ed of R.edges) { const a = pr[ed.a], b = pr[ed.b]; if (a >= 0 && b >= 0 && a !== b) { padj[a].add(b); padj[b].add(a); } } } }
    const pslot = new Int16Array(PV.length).fill(-1);
    for (const X of PV) { const usedS = new Set(); for (const o of padj[X.id]) if (pslot[o] >= 0) usedS.add(pslot[o]); let sl = -1;
      if (X.parents.length && pslot[X.parents[0]] >= 0 && !usedS.has(pslot[X.parents[0]])) sl = pslot[X.parents[0]];
      if (sl < 0) for (let t = 0; t < 36; t++) { const c = ((X.id * 7 + t * 5) % 12) + 12 * ((X.id + Math.floor(t / 12)) % 3); if (!usedS.has(c)) { sl = c; break; } } if (sl < 0) sl = X.id % 36;
      pslot[X.id] = sl; X.color = hsl(HUES[sl % 12] + ((X.id * 11) % 9) - 4, [0.42, 0.38, 0.4][Math.floor(sl / 12)], [0.76, 0.83, 0.68][Math.floor(sl / 12)]); }
    const provinces = PV.map(X => ({ name: X.name, created: X.created, abolished: X.abolished, seats: X.seats, kind: X.kind, parents: X.parents, children: X.children, hist: X.hist, present: X.present, fromState: X.fromState, color: X.color, stage: X.stage, names: X.names, why: X.abolishWhy || null }));
    polities.forEach((q, i) => { const Q = P[i]; q.ideaAdopt = (Q.ideaAdopt || []).sort((a, b) => a[1] - b[1]); q.msys = Q.msys || []; q.rulers = Q.rulers; q.gov = Q.gov; q.houseName = Q.houseName; q.govStyle = Q.govStyle; q.houses = (Q.houses || []).map(x => [x[4] !== undefined ? x[4] : x[0], x[2], x[3], x[5], x[1], x[6]]); if (Q.theoRel !== undefined) q.theoRel = Q.theoRel; if (Q.theo !== undefined) q.theo = Q.theo; if (Q.settled !== undefined) q.settled = Q.settled; q.org = Q.org === undefined ? null : Q.org; q.lin = Q.lin; q.territorialPredecessors = Q.territorialPredecessors || []; if (Q.outcome) q.outcome = Q.outcome; if (Q.colonialFrom !== undefined) q.colonialFrom = Q.colonialFrom; if (Q.rtype) { q.rebelName = Q.rebelName; q.rtype = Q.rtype; q.rebelGoal = Q.rebelGoal; q.rebelTargets = Q.rebelTargets; q.rebelSince = Q.rebelSince; q.rebelUntil = Q.rebelUntil === undefined ? Q.died : Q.rebelUntil; } if (Q.republic) q.republic = true; q.emp = Q.emp ? Q.emp.slice() : null; if (Q.king !== undefined) q.king = Q.king; });
    const uS = unrestSamples.length / 2, uYears = new Float32Array(uS), uData = new Uint8Array(uS * (nR + 1)); for (let i = 0; i < uS; i++) { uYears[i] = unrestSamples[2 * i]; uData.set(unrestSamples[2 * i + 1], i * (nR + 1)); }
    // ---------- 终局：现在的国家与省份（写回现在的地图） ----------
    const FORMS = { city: 'cityRepublic', kingdom: 'monarchy', empire: 'empire', nomad: 'nomadic', chief: 'chiefdom', theo: 'theocracy', vassal: 'vassal' };
    const aliveNow = P.filter(q => q.died === null && q.n > 0 && !q.rebel).sort((a, b) => b.n - a.n || a.id - b.id);
    const countryOfP = new Int32Array(P.length).fill(-1); aliveNow.forEach((q, i) => countryOfP[q.id] = i);
    // 起义军独立前仍属于其反叛的国家；军事与历史记录保留实际控制方。
    for (const q of P) if (q.died === null && q.n > 0 && q.rebel) {
      const country = countryOfP[q.target];
      if (country < 0) throw new Error('起义军缺少存续的所属国家');
      countryOfP[q.id] = country;
    }
    const settleIdx = ci => ci >= 0 && C.cities[ci] ? C.cities[ci].idx : -1;
    const nowCountries = aliveNow.map(q => { const f = q.republic ? 'republic' : FORMS[formOf(q, nAt(q, E), stageAt(capAt(q, E).r, E), vasAt(q, E), E)] || 'monarchy'; // 与国名（nameAt）用同一套输入，国名与政体一致
      return { p: q.id, name: nameAt(q.id, E), short: q.short, bare: q.bare && q.bare !== q.short ? q.bare : undefined, form: f, formLabel: f === 'republic' ? '共和国' : formLabelOf(q, E), regime: regimeOf(q, E), imperial: empAt(q, E), capRegion: q.cap, capital: settleIdx(bigCity(q.cap, E)), civ: rulingCultureAt(q, E), religion: q.theoRel !== undefined ? q.theoRel : rel[q.cap], n: q.n, color: q.color, liegeP: q.liege >= 0 && P[q.liege].died === null ? topLiege(q.id) : -1, liegeD: q.liege >= 0 && P[q.liege].died === null ? q.liege : -1, gov: q.gov.length ? q.gov[q.gov.length - 1][1] : '', govKey: q.gov.length ? q.gov[q.gov.length - 1][2] : '', govStyle: q.govStyle, ruler: q.rulers.length ? q.rulers[q.rulers.length - 1] : null, house: q.houseName, rulers: q.rulers.length, ideas: D.IDEAS.map((I, k) => D.ideaA[k * NN + q.cap] <= E ? I.name : null).filter(Boolean), mil: milAt(q.cap, E), adm: admAt(q.cap, E) }; });
    const provIdx = new Int32Array(PV.length).fill(-1), nowProvinces = [];
    for (const X of PV) { if (X.n <= 0 || X.abolished !== null) continue; const regs = []; for (let r = 1; r <= nR; r++) if (prov[r] === X.id) regs.push(r); if (!regs.length) continue;
      const own = owner[regs[0]], seatR = X.seat;if(!regs.includes(seatR)||seatCity(seatR,E)<0)throw Error('终局省份缺少有效治所');provIdx[X.id] = nowProvinces.length;
      nowProvinces.push({ pv: X.id, name: X.name, country: own >= 0 ? countryOfP[own] : -1, seatRegion: seatR, seat: settleIdx(seatCity(seatR, E)) }); }
    const religionsOut = RELS.map((F0, f) => ({ name: F0.name, lib: F0.lib, libLabel: F0.libLabel, type: F0.type, spread: F0.spread, color: F0.color, symbol: F0.symbol, relic: F0.relic, holy: F0.holy, holyList: F0.holyList, clergy: F0.clergy, branches: F0.branches, heresies: F0.heresies, traits: F0.traits, founded: G.HistoryDate.ceil(F0.founded), origin: F0.origin, parent: F0.parent }));
    const end = { religions: religionsOut, owner: Int32Array.from(owner), prov: Int32Array.from(prov), adminDays, adminBudget:administration.budget, cult: Int32Array.from(cult), rel: Int32Array.from(rel), countryOfP, provIdx, countries: nowCountries, provinces: nowProvinces };
    const finalFood = G.HumanEconomy.allocate({ R, human, species, popTotal: h.popTotal, stage: sg, cultureAt: effectiveCulture, religionAt: f => f >= 0 ? RELS[f] : null }), guards = new Float64Array(nR + 1);
    const finalPopulation = new Float64Array(nR + 1); for (let r = 1; r <= nR; r++) finalPopulation[r] = human.total(r);
    fortManager.step({ year: E, owner, population: finalPopulation, food: finalFood, allowBuild: false });
    military.beginTick({year:E,food:finalFood,owner,forts:fortManager.forts,account:false});military.endTick();
    for (const fort of fortManager.forts) { const last = fort.log[fort.log.length - 1]; guards[fort.region] = last[1]; }
    const foodAfterFort = Float64Array.from(finalFood.foodAvailable);
    const economy = { foodDemand: finalFood.foodDemand, foodProduction: finalFood.foodProduction, foodImport: finalFood.foodImport, foodExport: finalFood.foodExport, foodExportLoss: finalFood.foodExportLoss, foodAvailable: finalFood.foodAvailable, foodAfterFort, militaryExtra:finalFood.militaryExtra, militaryLaborLoss:finalFood.militaryLaborLoss, unitCost: finalFood.unitCost, guards, summary: finalFood.summary, guardModel: '道路边界要塞按区域图绕行和本区当期粮食余量维持驻守，不模拟精确山口。' };
    const campaignEvents = [];
    for (const c of military.output().campaigns) for (const e of c.events) {
      if (e.type === 'occupation') continue; // The result and political records already describe control changes.
      const at = G.HistoryDate.time(e.at), attacker = nameAt(c.attacker, Math.max(P[c.attacker].born, e.at)), defender = c.defender >= 0 ? nameAt(c.defender, Math.max(P[c.defender].born, Math.min(e.at, c.resultTime - 1 / 12))) : '当地守军';
      const subject = e.side === 'attacker' ? attacker + '军队' : e.side === 'defender' ? defender + '军队' : attacker + '与' + defender;
      if (e.type === 'allies') { const L = (c.allies?.[e.side] || []).map(x => nameAt(x.p, Math.max(P[x.p].born, e.at))).join('、'); campaignEvents.push({year:at, kind:'campaign', phase:'allies', campaign:c.id, p:c.attacker, q:c.defender, r:c.target, text: e.side === 'attacker' ? `${attacker}联合${L}进军：${e.detail}` : `${L}出兵援救${defender}：${e.detail}`, major: big(c.attacker) || c.defender >= 0 && big(c.defender)}); continue; }
      campaignEvents.push({year:at, kind:'campaign', phase:e.type, campaign:c.id, p:c.attacker, q:c.defender, r:e.type === 'mobilization' || e.type === 'march' ? c.source : c.target,
        text:`${subject}：${e.label}。${e.detail}`, major:e.type === 'result' && (big(c.attacker) || c.defender >= 0 && big(c.defender))});
    }
    return { end, military: military.output(), forts: fortManager.forts, holyWars: holyWars.records, human: { species, snapshots: humanSnapshots, exchange: humanExchange, migration: humanMigration, economy, ledger: { initial: initialPopulation, births, deaths, migrated }, stats: { snapshotBytes, peakSampledGroups: peakGroups, ms: humanMs }, model: '区块人口以现今承载权重的8%作为初值；按十年一轮计算人口与相邻陆路粮食；每百年采样。粮食是当轮估算，不含库存和海贸。' }, unrest: { years: uYears, data: uData }, provinces, provLog: csr(pvLog), cultLog: csr(cLog), relLog: csr(rLog), polities, alliances: alliances.map(A => ({ id: A.id, from: A.from, to: A.to, against: A.against, founders: A.founders, members: [...new Set(A.roster.map(x => x[0]).concat([...A.members]))], roster: A.roster.concat([...A.members].map(m => [m, A.joined.get(m), null])) })), own: { off, year: chgY, owner: chgO }, events: texts, campaignEvents, EMPN, T0, stats: { pcap: Math.round(PCAP), popSplits: PV.filter(X => X.why === 'pop').length, maxPP: Math.round(maxPP), polities: P.length, alive: aliveNow.length, changes: chgY.length } };
  }

  G.HistoryPolity = { run, regionalFragmentation, historicalCores, theocracyProbability, attemptTheocracy, linkRestoration, splitStateName, rulingCultureAt, cultureRollbackLimit, datedName, drawRulingName, advancePlaceName, inheritedStateName, buildDynastyHouses, buildDynastyRulers, alignCultureYear };
})(typeof self !== 'undefined' ? self : this);
