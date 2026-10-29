/* 遗迹：从整部推演史里提取留存至今的遗迹，写进现在的地图（Cv.heritage），并给圣城做标记（Cv.cities[k].holy）。
 * 宗教遗迹：圣地（宗教发源地、教派祖庭）、圣山、圣墓（先知、神权国开国者）。
 * 战争遗迹：围城（都城被攻破、外族入主、起义军入城）、古战场（反复易手之地）、战火焚毁的城、旧关塞（如今已在腹地）、起义起事处。
 * 人文遗迹：古城废墟、古都、帝王陵、文明摇篮。 */
(function (G) {
  'use strict';
  const TYPE = { monotheist: '一神天启', dualist: '光暗二元', polytheist: '多神信仰', dharmic: '轮回觉悟', ancestral: '祖灵礼教', shamanic: '萨满万灵', philosophy: '哲学教化' };
  function build(Hc, Cv, h) {
    const { R, D, C, Pol } = Hc, end = Pol.end, P = Pol.polities, E = D.E, nR = R.nR, NN = nR + 1;
    const out = [], usedCity = new Map(), km = (a, b) => h.gdist(R.center[a], R.center[b]) * h.cellKm;
    const add = (o) => { o.id = out.length; out.push(o); return o; };
    const RELS = end.religions || Cv.religions || [];
    // 区块里现存最大的城（没有就用区块中心）
    const bigIn = r => { let b = -1, bp = -1; C.cities.forEach((c, i) => { if (c.r === r && !c.lost && !c.fort && c.final > bp) { bp = c.final; b = i; } }); return b; };
    const at = (r, ci) => ci >= 0 ? { x: C.cities[ci].x, y: C.cities[ci].y, city: C.cities[ci].idx } : { x: R.cx[r], y: R.cy[r], city: -1 };
    const cname = ci => ci >= 0 && C.cities[ci] ? C.cities[ci].name : '';
    const short = q => q.finalName || q.short + ((q.peakN >= (Pol.EMPN || 20) && q.titles && q.titles.empire) || (q.titles && q.titles.kingdom) || '');
    const nearCity = r => { let b = bigIn(r); if (b >= 0) return b; let best = -1, bd = 1e9; for (let k = R.off[r]; k < R.off[r + 1]; k++) { const n = R.nbr[k], c = bigIn(n); if (c >= 0) { const d = km(r, n); if (d < bd) { bd = d; best = c; } } } return best; };
    const markHoly = (ci, f) => { if (ci < 0) return; const k = C.cities[ci].idx; if (k < 0 || !Cv.cities[k]) return; const c = Cv.cities[k]; (c.holy = c.holy || []).includes(f) || c.holy.push(f); };

    // ---------- 宗教遗迹 ----------
    RELS.forEach((F, f) => {
      const r = F.origin; if (!r) return; const ci = bigIn(r), p = at(r, ci), par = F.parent >= 0 ? RELS[F.parent] : null;
      add(Object.assign(p, { cat: 'religious', kind: 'holy', imp: par ? 2 : 3, year: F.founded, rel: f,
        name: par ? `${F.name}祖庭` : (F.holy || (cname(ci) || F.name) + '圣地'),
        text: par ? `${F.name}自${par.name}分出，以此为中心（第 ${F.founded} 年）` : `${F.name}（${TYPE[F.type] || '宗教'}）的发源地，第 ${F.founded} 年在此创立${F.clergy && F.clergy.head ? `；${F.clergy.head}驻锡之地` : ''}` }));
      markHoly(ci, f);
      // 圣墓：宗教库里带“墓 / 陵”的圣地名，放在发源地附近的另一座城
      if (!par) { const tomb = (F.holyList || []).find(x => /[墓陵]/.test(x) && x !== F.holy); const tn = tomb || ((F.relic || '').includes('骸') ? `${F.name.slice(0, 2)}圣墓` : null);
        if (tn) { let best = -1, bd = 1e9; C.cities.forEach((c, i) => { if (c.lost || c.fort || i === ci || !c.r) return; const d = km(r, c.r); if (d > 40 && d < bd) { bd = d; best = i; } });
          if (best >= 0 && bd < 900) { const q2 = at(C.cities[best].r, best); add(Object.assign(q2, { cat: 'religious', kind: 'tomb', imp: 2, year: F.founded, rel: f, name: tn, text: `${F.name}先知与圣徒长眠之地，信众朝圣不绝` })); markHoly(best, f); } } }
    });
    // 圣山：每个宗教信众地区里最高的山峰
    { const peaks = (Cv.labels || []).filter(l => (l.type === 'peak' || l.type === 'snow') && l.h), taken = new Set();
      RELS.forEach((F, f) => { if (F.parent >= 0) return; let best = null; for (const l of peaks) { if (taken.has(l)) continue; const i = Math.min(h.H - 1, (l.y / 2) | 0) * h.W + Math.min(h.W - 1, (l.x / 2) | 0); if (Cv.religion[i] !== f) continue; if (!best || l.h > best.h) best = l; }
        if (!best) return; taken.add(best); add({ cat: 'religious', kind: 'mountain', imp: 2, year: F.founded, rel: f, x: best.x, y: best.y, city: -1, name: best.name, text: `${F.name}信众朝拜的圣山（海拔 ${best.h.toLocaleString()} 米）` }); }); }
    // 神权国开国者之墓
    P.forEach(q => { if (q.theo == null || q.peakN < 3 || !q.rulers || !q.rulers.length) return; let rr = q.rulers[0]; for (const x of q.rulers) if (x[0] <= q.theo) rr = x; const cp = (q.caps.filter(c => c[0] <= q.theo).pop() || q.caps[0]); const ci = cp[1];
      add(Object.assign(at(cp[2], ci >= 0 && C.cities[ci] && !C.cities[ci].lost ? ci : -1), { cat: 'religious', kind: 'tomb', imp: 1, year: q.theo, rel: q.theoRel >= 0 ? q.theoRel : -1, name: `${rr[1].replace(/^\S+\s/, '')}墓`, text: `${q.short}${(q.titles && q.titles.theo) || '教国'}政教合一后的首位${rr[2]}${rr[1]}长眠于此（第 ${q.theo} 年）` })); });

    // ---------- 战争遗迹 ----------
    { const sieges = new Map(); for (const e of Pol.events) { if (!(e.kind === 'sack' || e.kind === 'nomad' || e.kind === 'overthrow') || e.city === undefined || e.city < 0 || !C.cities[e.city]) continue; const Q = P[e.q]; if (Q && Q.rtype && (Q.rebelUntil == null || e.year < Q.rebelUntil)) continue; /* 攻破起义军营地不算 */ const s = sieges.get(e.city) || { n: 0, list: [] }; s.n++; s.list.push(e); sieges.set(e.city, s); }
      for (const [ci, s] of sieges) { const c = C.cities[ci], first = s.list[0], big = s.list.some(e => e.major); if (!big && s.n < 2) continue; /* 只留名城大围：重大事件或多次被攻破 */
        add({ cat: 'war', kind: 'siege', imp: big ? 2 : 1, year: first.year, x: c.x, y: c.y, city: c.lost ? -1 : c.idx, name: `${c.name}之围`, text: s.list.slice(0, 3).map(e => `第 ${e.year} 年，${e.text}`).join('；') + (s.n > 3 ? `；此城前后 ${s.n} 次被攻破` : '') }); } }
    // 古战场：不同国统之间反复易手最多的地方
    { const O = Pol.own, cnt = new Int32Array(NN), span = []; const pairs = new Map();
      for (let r = 1; r <= nR; r++) { let prev = -1, a = 1e9, b = 0; for (let k = O.off[r]; k < O.off[r + 1]; k++) { const o = O.owner[k]; if (prev >= 0 && o >= 0 && P[prev] && P[o] && P[prev].lin !== P[o].lin && !P[o].rtype && !P[prev].rtype) { cnt[r]++; a = Math.min(a, O.year[k]); b = Math.max(b, O.year[k]); const key = r + ':' + Math.min(P[prev].lin, P[o].lin) + ':' + Math.max(P[prev].lin, P[o].lin); pairs.set(key, (pairs.get(key) || 0) + 1); pairs.set(r + '|' + key.split(':').slice(1).join(':'), [prev, o]); } prev = o; } span[r] = [a, b]; }
      const ord = []; for (let r = 1; r <= nR; r++) if (cnt[r] >= 4 && R.weight[r] > 0) ord.push(r); ord.sort((a, b) => cnt[b] - cnt[a] || a - b);
      const nB = Math.max(6, Math.min(18, Math.round(nR / 110))), picked = [];
      for (const r of ord) { if (picked.length >= nB) break; if (picked.some(o => km(o, r) < 450)) continue; picked.push(r);
        let bestK = null, bv = 0; for (const [k, v] of pairs) { if (typeof v !== 'number' || !k.startsWith(r + ':')) continue; if (v > bv) { bv = v; bestK = k; } }
        const duo = bestK ? pairs.get(r + '|' + bestK.split(':').slice(1).join(':')) : null, ci = nearCity(r);
        add(Object.assign(at(r, -1), { cat: 'war', kind: 'battle', imp: picked.length <= 4 ? 2 : 1, year: span[r][0], name: `${cname(ci) || '无名'}古战场`,
          text: `第 ${Math.round(span[r][0])}–${Math.round(span[r][1])} 年间此地 ${cnt[r]} 次易手${duo ? `，${short(P[duo[0]])}与${short(P[duo[1]])}曾在此反复争夺` : ''}` })); } }
    // 战火焚毁的城
    C.cities.forEach((c, i) => { if (!c.lost || c.cause !== '毁于战火') return; const A = c.ancient >= 0 && D.ancient[c.ancient];
      add({ cat: 'war', kind: 'ruin', imp: 1, year: c.ruined, x: c.x, y: c.y, city: -1, name: `${c.name}遗址`, text: `${A ? A.name + '的城市，' : ''}第 ${c.founded} 年建城，第 ${c.ruined} 年毁于战火` }); });
    // 旧关塞：昔日的边塞如今已在一国腹地
    Cv.cities.forEach((c, k) => { if (c.role !== 'military-post') return; const s = h.settlements[k]; if (!s) return; const k0 = Cv.country[s.cell]; if (k0 < 0) return; const y0 = (s.cell / h.W) | 0, x0 = s.cell - y0 * h.W; let inner = true;
      for (let dy = -5; dy <= 5 && inner; dy++) for (let dx = -5; dx <= 5; dx++) { const yy = y0 + dy; if (yy < 0 || yy >= h.H) continue; const i = yy * h.W + ((x0 + dx) % h.W + h.W) % h.W; if (h.land[i] && Cv.country[i] !== k0) { inner = false; break; } }
      if (inner) add({ cat: 'war', kind: 'fort', imp: 1, year: null, x: c.x, y: c.y, city: k, name: `${c.name}旧关`, text: `昔日扼守边陲的${c.type === 'pass-fort' ? '关隘' : '要塞'}，如今已在${Cv.countries[k0].name}腹地` }); });
    // 起义起事处：推翻王朝或割据成国的起义
    P.forEach(q => { if (!q.rtype || !(q.outcome === 'overthrow' || (q.outcome === 'state' && q.peakN >= 10))) return; const r = q.caps[0][2], ci = nearCity(r);
      add(Object.assign(at(r, ci), { cat: 'war', kind: 'revolt', imp: q.outcome === 'overthrow' ? 2 : 1, year: q.born, name: `${q.rebelName}起事处`, text: `第 ${q.born} 年${q.rebelName}在此起事，${q.outcome === 'overthrow' ? '终于推翻王朝' : '割据成国'}` })); });

    // ---------- 人文遗迹 ----------
    C.cities.forEach((c, i) => { if (!c.lost || c.cause === '毁于战火') return; const A = c.ancient >= 0 && D.ancient[c.ancient];
      add({ cat: 'culture', kind: 'ruin', imp: A ? 2 : 1, year: c.founded, x: c.x, y: c.y, city: -1, name: `${c.name}遗址`, text: `${A ? A.name + '的城市，' : ''}第 ${c.founded} 年建城，第 ${c.ruined} 年${c.cause || '荒废'}` }); });
    // 古都：大国定都一百五十年以上、如今已不是首都的城
    { const capY = new Map(); P.forEach(q => { if (q.rtype || q.peakN < Math.max(6, (Pol.EMPN || 20) * 0.4)) return; const endY = q.died == null ? E : q.died; q.caps.forEach((c, i) => { if (c[1] < 0) return; const b = i + 1 < q.caps.length ? q.caps[i + 1][0] : endY, o = capY.get(c[1]) || { y: 0, list: [] }; o.y += Math.max(0, b - c[0]); o.list.push([c[0], b, short(q)]); capY.set(c[1], o); }); });
      const capTop = [...capY].sort((a, b) => b[1].y - a[1].y).slice(0, Math.max(12, Math.min(30, Math.round(nR / 50)))); /* 只取为都最久的一批 */
      for (const [ci, o] of capTop) { const c = C.cities[ci]; if (!c || o.y < 250 || (!c.lost && c.idx >= 0 && Cv.cities[c.idx] && Cv.cities[c.idx].capital !== undefined)) continue;
        o.list.sort((a, b) => a[0] - b[0]); add({ cat: 'culture', kind: 'capital', imp: o.y >= 400 ? 3 : 2, year: o.list[0][0], x: c.x, y: c.y, city: c.lost ? -1 : c.idx, name: `${c.name}${c.lost ? '故都遗址' : '古都'}`, text: `${o.list.slice(0, 3).map(l => `${l[2]}（第 ${l[0]}–${l[1]} 年）`).join('、')}${o.list.length > 3 ? '等' + o.list.length + '朝' : ''}的都城，前后为都 ${o.y} 年` }); } }
    // 帝王陵：最强盛的若干国统的开国之君
    { const byLin = new Map(); P.forEach(q => { if (q.rtype || !q.rulers || !q.rulers.length) return; const o = byLin.get(q.lin); if (!o || q.peakN > o.peakN) byLin.set(q.lin, q); });
      const top = [...byLin.values()].sort((a, b) => b.peakN - a.peakN).slice(0, Math.max(6, Math.min(14, Math.round(nR / 120))));
      for (const q of top) { const rr = q.rulers[0], cp = q.caps[0], ci = cp[1] >= 0 && C.cities[cp[1]] ? cp[1] : -1, temple = rr[1].includes(' ');
        add(Object.assign(at(cp[2], ci), { cat: 'culture', kind: 'mausoleum', imp: 2, year: rr[0], name: temple ? `${q.short}${rr[1].split(' ')[0]}陵` : `${rr[1]}陵墓`, text: `${short(q)}开国之君${rr[2]}${rr[1]}的陵墓（第 ${rr[0]} 年即位${q.houseName ? '，' + q.houseName : ''}）` })); } }
    // 文明摇篮
    D.cradles.forEach(cr => { const y = D.Y[NN + cr.region], ci = bigIn(cr.region); add(Object.assign(at(cr.region, ci), { cat: 'culture', kind: 'cradle', imp: 3, year: Math.round(y), name: `${cr.name || cr.river || '大河'}摇篮`, text: `${cr.river ? cr.river + '河谷，' : ''}世上最早的农耕村落约在第 ${Math.round(y)} 年于此出现` })); });

    // 同一座城上的多处遗迹轻微错开，避免重叠
    const seen = new Map(); for (const o of out) { const k = Math.round(o.x / 3) + ':' + Math.round(o.y / 3), n = seen.get(k) || 0; if (n) { o.x += 2.4 * Math.cos(n * 2.1); o.y += 2.4 * Math.sin(n * 2.1); } seen.set(k, n + 1); }
    return out;
  }
  G.HistoryHeritage = { build };
})(typeof self !== 'undefined' ? self : this);
