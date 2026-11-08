/* 君主的一生：由历史推演里已有的世系、上位方式、结局与编年史，写出一位君主从出生、即位、在位到身后的生平。
 * 只读历史，不改写任何事件；同一位君主每次生成的生平都相同（以国与序号为种子）。 */
(function (G) {
  'use strict';
  const ACC = {
    found: '开国称尊', unite: '统一诸部', secede: '割据自立', usurp: '代前朝而立', coup: '政变夺位', revolution: '革命建政', rebel: '起义称王', rebel2: '众推为首领',
    restore: '复国即位', independence: '领导独立', holy: '教团推举', elect: '当选执政', theo: '教团选立', kurultai: '诸部大会推举', inherit: '旁支入继', adopt: '外戚入继',
    son: '子承父位', son2: '庶子继位', brother: '兄终弟及', nephew: '侄承叔位', grandson: '孙承祖位', cousin: '宗亲入继', regency: '幼主即位', abdicated: '受禅继位'
  };
  const FATE = { ill: '病逝', old: '寿终', young: '早夭', battle: '战殁', murdered: '遇弑', accident: '意外身亡', abdicate: '退位', deposed: '被废', captive: '国破被俘', suicide: '殉国', killed: '为乱军所杀', term: '任满卸任', reigning: '在位' };
  const CN = '〇一二三四五六七八九';
  const cnNum = n => { n = Math.round(n); if (n < 10) return CN[n]; if (n < 20) return '十' + (n % 10 ? CN[n % 10] : ''); if (n < 100) return CN[Math.floor(n / 10)] + '十' + (n % 10 ? CN[n % 10] : ''); return String(n); };
  function rng(seed) { let a = seed | 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const pick = (r, a) => a[Math.floor(r() * a.length) % a.length];

  // 一位君主的生平。T：时间线提供的查询（国名、城名、都城、疆土、日期格式）
  function build(H, p, i, T) {
    const q = H.polities[p], R = q.rulers || [], r = R[i]; if (!r) return null;
    const rand = rng((p + 1) * 7919 + i * 104729 + (H.W || 0));
    const nx = R[i + 1] || null, pv = i ? R[i - 1] : null, end = q.died === null || q.died === undefined ? H.E : q.died;
    const acc = r[6] || (i ? 'son' : 'found'), accAge = r[7] || 30, fate = r[8] || (nx ? 'ill' : q.died === null || q.died === undefined ? 'reigning' : 'ill'), after = r[9] || 0;
    const start = r[0], stop = nx ? nx[0] : end, reign = Math.max(0, stop - start);
    const birth = Math.floor(start - accAge), death = fate === 'reigning' ? null : Math.floor(Math.min(H.E, stop + after));
    const ageAt = y => Math.max(0, Math.floor(y - birth)), house = q.houses && q.houses[r[3]] ? q.houses[r[3]][1] : '', houseName = (q.houses && q.houses.find(x => x[1] === house) || [])[2] || house;
    const state = y => T.nameWhen(p, Math.max(q.born, Math.min(end, y)));
    const capCity = y => { const c = T.capAt(p, Math.max(q.born, Math.min(end, y))); return c && c[1] >= 0 ? T.cityName(c[1], y) : ''; };
    const nomad = q.nomad && !(q.settled != null && start >= q.settled), style = (() => { let g = null; for (const x of q.gov || []) { if (x[0] > start) break; g = x; } return g ? g[3] : q.govStyle; })();
    const who = r[1], title = r[2], pName = pv ? pv[1] : '';
    const out = [], ev = (year, kind, text) => out.push({ year, kind, text });

    // 一、出身
    const bornAt = capCity(birth) || (nomad ? '草原上的王帐' : '');
    const parent = { son: `${pName}的长子`, son2: `${pName}的庶子`, regency: `${pName}的${rand() < 0.7 ? '儿子' : '孙子'}`, abdicated: `${pName}的儿子`, brother: `${pName}的弟弟`, nephew: `${pName}的侄子`, grandson: `${pName}的孙子`,
      cousin: `${houseName || '王室'}的远支宗亲`, inherit: `${houseName}的族人，与前朝王室有姻亲之谊`, adopt: `前任君主${pName}的${rand() < 0.5 ? '养子' : '外孙'}`,
      coup: `${state(start - 1)}的${pick(rand, ['禁军统帅', '权臣', '宗室亲王', '边镇大将'])}`, usurp: `前朝的${pick(rand, ['大司马', '辅政大臣', '外戚首领', '禁军统帅'])}`,
      found: nomad ? '一位部族首领的儿子' : '当地' + pick(rand, ['豪族', '贵族', '城主', '军事首领']) + '的子弟', unite: '一位小部落首领的儿子', secede: pick(rand, ['镇守一方的大将', '地方望族的家主', '宗室旁支', '一州的长官']),
      rebel: pick(rand, ['佃农', '小吏', '戍卒', '盐贩', '游侠', '破产的工匠']) + '出身', rebel2: '起义军中的头目', restore: '故国王室的后裔', independence: '殖民地出生的望族子弟', holy: '一位虔诚的神职人员',
      elect: pick(rand, ['商贾世家', '名门望族', '律师家庭', '军人家庭']) + '的子弟', theo: '教团中德高望重的神职人员', kurultai: `${houseName || '汗族'}的一位王子`, revolution: pick(rand, ['律师', '军官', '学者', '报人']) + '出身' }[acc] || '贵族子弟';
    const loose = !!q.loose || nomad, hall = loose ? '帐中' : '宫中';
    ev(birth, 'birth', `第 ${birth} 年生于${bornAt || (loose ? '部落的营地' : '国中')}，是${parent}。`);
    // 二、少年
    const youth = nomad ? '自幼在马背上长大，习骑射、通部族谱系' : style === 'bureaucratic' ? '少年时从名师读经史律令，熟悉朝廷典章' : style === 'temple' ? '少年时在神庙中学习祭仪与经卷' : style === 'mercantile' ? '少年时随家族商队往来各地，通晓账目与诸国言语' : style === 'tribal' ? '少年时随长辈狩猎、主持部族祭祀' : '少年时习武艺、学礼仪，随父辈出入宫廷';
    const y15 = birth + 15; const war15 = H.events.find(e => e.kind === 'campaign' && e.time >= y15 - 3 && e.time <= y15 + 5 && (e.p === p || e.q === p) && e.gain > 0);
    ev(y15, 'youth', `${youth}${['rebel', 'rebel2', 'coup', 'usurp', 'secede', 'independence', 'revolution'].includes(acc) && war15 ? `；目睹${T.unpre(war15.brief || '')}，自此留心兵事` : ''}。`);
    if (accAge >= 18) { const y = birth + 16 + Math.floor(rand() * 8); if (y < start || acc === 'regency') ev(y, 'marry', `${ageAt(y)} 岁成婚，${pick(rand, loose ? ['娶邻近部落首领的女儿', '与盟部联姻', '迎娶同族女子'] : ['娶名门之女为妻', '与邻邦贵族联姻', '娶一位大臣的女儿', '迎娶同族贵女'])}。`); }
    // 三、上位
    const prevFate = pv ? FATE[pv[8]] || '去世' : '';
    const prevEnd = pv && pv[8] === 'abdicate' ? '退位' : pv && pv[8] === 'deposed' ? '被废' : pv && pv[8] === 'murdered' ? '遇弑' : prevFate;
    const accText = {
      found: `第 ${Math.floor(start)} 年在${capCity(start) || '故地'}建立${state(start)}，自称${title}`, unite: `第 ${Math.floor(start)} 年兼并周边诸部，建立${state(start)}，被推为${title}`,
      secede: `趁${(q.parents.find(x => x.kind === 'split' || x.kind === 'secede') ? T.nameWhen(q.parents.find(x => x.kind === 'split' || x.kind === 'secede').id, start - 1) : '旧主')}内乱，据${capCity(start) || '一方'}自立，建立${state(start)}`,
      usurp: `前朝末年总揽朝政，第 ${Math.floor(start)} 年代${q.parents.find(x => x.kind === 'dynasty') ? T.nameWhen(q.parents.find(x => x.kind === 'dynasty').id, start - 1) : '前朝'}而立，开创${state(start)}`,
      coup: pv ? `第 ${Math.floor(start)} 年发动宫廷政变，废黜${pName}，自立为${title}` : `第 ${Math.floor(start)} 年发动政变，推翻前朝，建立${state(start)}`,
      revolution: `第 ${Math.floor(start)} 年都城爆发革命，被推为新政权的首脑`, rebel: `第 ${Math.floor(start)} 年在${capCity(start) || '乡里'}揭竿而起，聚众数万，号令一方`, rebel2: `前任首领${pName}${prevEnd}后，被众人推为首领`,
      restore: `收复故国旧地，第 ${Math.floor(start)} 年宣告复国，即${title}位`, independence: `第 ${Math.floor(start)} 年领导殖民地起事，宣布独立，建立${state(start)}`, holy: `第 ${Math.floor(start)} 年圣战告捷，被教团推举为新教国的${title}`,
      elect: `第 ${Math.floor(start)} 年当选为${state(start)}的${title}`, theo: `前任${pName}${prevEnd}后，第 ${Math.floor(start)} 年被教团选立为${title}`, kurultai: `${pName}${prevEnd}后，诸部首领召开大会，推举其为${title}`,
      inherit: `${pName}${prevEnd}而无嗣，${houseName}以宗亲入继大统`, adopt: `${pName}${prevEnd}而无子，以${parent.includes('养子') ? '养子' : '外孙'}身份入继`,
      son: `父亲${pName}${prevEnd}，以嫡长子身份即位`, son2: `父亲${pName}${prevEnd}，诸兄早逝，以庶子身份即位`, brother: `兄长${pName}${prevEnd}，兄终弟及，即${title}位`, nephew: `叔父${pName}${prevEnd}而无子，以侄子身份入继`,
      grandson: `祖父${pName}${prevEnd}，太子早逝，以长孙身份即位`, cousin: `${pName}${prevEnd}，近支无人，以宗亲身份入继`, abdicated: `父亲${pName}退位，受禅即位`,
      regency: `${pName}${prevEnd}，年仅 ${accAge} 岁即位，由${pick(rand, ['太后', '叔父', '辅政大臣', '母后与外戚'])}摄政`
    }[acc] || `第 ${Math.floor(start)} 年即位`;
    ev(start, 'accession', `${accText}，时年 ${accAge} 岁。`);
    if (acc === 'regency') { const y = start + Math.max(1, 16 - accAge); if (y < stop) ev(y, 'rule', `${ageAt(y)} 岁亲政，${pick(rand, ['罢黜摄政的权臣', '收回朝政', '诛除专权的外戚'])}。`); }
    // 四、在位大事：编年史里本国在位期间的事，战争只记有得失的几场
    const inReign = e => e.time >= start && e.time < (nx ? stop : end + 1) && (e.p === p || e.q === p || (e.kids && e.kids.includes(p)));
    const evs = H.events.filter(inReign);
    const wars = evs.filter(e => e.kind === 'campaign'), won = wars.filter(e => e.w === p).reduce((a, e) => a + (e.wn || 0), 0), lostW = wars.filter(e => e.w >= 0 && e.w !== p && e.gain > 0).reduce((a, e) => a + (e.wn || 0), 0);
    const SKIP = new Set(['campaign', 'transfer', 'provSplit', 'provRedraw', 'fortStatus', 'fort', 'frontierAffiliation', 'islandSettle', 'territoryIntegrate', 'house', 'dynasty', 'coup', 'revolution', 'rise', 'looseForm', 'allianceLeave', 'migrate', 'exclave', 'tribalFree', 'revolt', 'suppress', 'rebelDisperse']);
    const main = evs.filter(e => !SKIP.has(e.kind)).sort((a, b) => (b.major ? 1 : 0) - (a.major ? 1 : 0) || a.time - b.time).slice(0, 8).sort((a, b) => a.time - b.time);
    for (const e of main) ev(e.time, 'reign', `${ageAt(e.time)} 岁，${T.unpre(e.text)}。`);
    const bigWars = wars.filter(e => e.gain > 0).sort((a, b) => (b.wn || 0) - (a.wn || 0)).slice(0, 2).sort((a, b) => a.time - b.time);
    for (const e of bigWars) ev(e.time, 'war', `${ageAt(e.time)} 岁，${T.unpre(e.text)}。`);
    const revs = evs.filter(e => e.kind === 'revolt' && e.q === p);
    if (revs.length) { const e = revs[0]; ev(e.time, 'revolt', `${ageAt(e.time)} 岁，${T.unpre(e.text)}${revs.length > 1 ? `；在位期间共有${cnNum(revs.length)}起民变` : ''}。`); }
    { const ideas = (q.ideaAdopt || []).filter(([k, t]) => t > Math.max(start, q.born + 1) && t < stop && H.ideas[k]); // 建国时承袭来的思潮不算这位君主的作为
      for (const [k, t] of ideas.slice(0, 2)) ev(t, 'idea', `${ageAt(t)} 岁，朝廷接纳${H.ideas[k].name}思潮${ideas.length > 2 && k === ideas[1][0] ? `；在位期间共接纳${cnNum(ideas.length)}种新思潮` : ''}。`); }
    // 子嗣
    if (nx && ['son', 'son2', 'regency', 'abdicated', 'grandson'].includes(nx[6])) { const by = Math.floor(nx[0] - (nx[7] || 20)); if (by > birth + 14 && by < stop) ev(by, 'child', `${ageAt(by)} 岁时，${nx[6] === 'grandson' ? '长孙' : nx[6] === 'son2' ? '庶子' : '儿子'}${nx[1]}出生。`); }
    else if (nx && nx[6] === 'brother') ev(Math.max(start, stop - 3), 'heir', `膝下无子，立弟${nx[1]}为储。`);
    // 五、结局
    const nT = T.countAt ? [T.countAt(p, start + 0.01), T.countAt(p, Math.min(end, stop - 0.01))] : null;
    const foe = (() => { const e = wars.filter(x => x.time >= stop - 3).pop(); return e ? T.nameWhen(e.p === p ? e.q : e.p, e.time) : ''; })();
    const deathText = {
      reigning: `至第 ${H.E} 年仍在位，已 ${Math.floor(H.E - start)} 年，时年 ${ageAt(H.E)} 岁。`,
      ill: `第 ${death} 年病逝于${capCity(death) || hall}，享年 ${ageAt(death)} 岁。`, old: `第 ${death} 年寿终正寝，享年 ${ageAt(death)} 岁。`, young: `第 ${death} 年早夭，年仅 ${ageAt(death)} 岁。`,
      battle: `第 ${death} 年${foe ? '与' + foe + '交战，' : ''}亲临阵前，中流矢而死，享年 ${ageAt(death)} 岁。`, murdered: `第 ${death} 年${pick(rand, ['为近侍所弑', `在${hall}遇刺`, '于宴席上被毒杀'])}，享年 ${ageAt(death)} 岁。`,
      accident: `第 ${death} 年${pick(rand, ['狩猎时坠马', '渡河时舟覆溺水', `${hall}失火`])}而死，享年 ${ageAt(death)} 岁。`,
      abdicate: `第 ${Math.floor(stop)} 年${nx ? '传位于' + nx[1] : '禅位于新朝'}，退居${after} 年后去世，享年 ${ageAt(death)} 岁。`,
      deposed: `第 ${Math.floor(stop)} 年被废黜，幽禁${after ? ' ' + after + ' 年后' : '不久'}去世，享年 ${ageAt(death)} 岁。`,
      captive: `第 ${Math.floor(stop)} 年国破被俘，${after ? '囚禁 ' + after + ' 年后' : ''}死于异乡，享年 ${ageAt(death)} 岁。`, suicide: `第 ${Math.floor(stop)} 年都城陷落，自尽殉国，享年 ${ageAt(death)} 岁。`,
      killed: `第 ${Math.floor(stop)} 年起义军攻入都城，死于乱军之中，享年 ${ageAt(death)} 岁。`, term: `第 ${Math.floor(stop)} 年任满卸任，此后又过了 ${after} 年，享年 ${ageAt(death)} 岁。`
    }[fate] || `第 ${death} 年去世。`;
    ev(death === null ? H.E : death, 'death', deathText);
    out.sort((a, b) => a.year - b.year || (a.kind === 'birth' ? -1 : 0));
    // 六、史评：疆土、战争、民变与结局
    const dN = nT && nT[0] ? (nT[1] - nT[0]) / nT[0] : 0;
    let mark;
    if (!nx && q.died != null && ['captive', 'suicide', 'killed', 'deposed', 'abdicate'].includes(fate)) mark = ['亡国之君', `${state(stop - 1)}亡于其手，后世多以此为戒`];
    else if (i === 0 && ['found', 'unite', 'usurp', 'secede', 'restore', 'independence', 'rebel'].includes(acc)) mark = ['开创之主', `开创${state(start)}的基业`];
    else if (dN >= 0.3 && won >= 3) mark = ['开疆拓土', `在位 ${Math.round(reign)} 年，疆土增加${Math.round(dN * 100)}%`];
    else if (dN <= -0.3) mark = ['丧师失地', `在位 ${Math.round(reign)} 年，疆土减少${Math.round(-dN * 100)}%`];
    else if (revs.length >= 2) mark = ['内乱频仍', `在位期间民变迭起`];
    else if (reign < 3) mark = ['在位短暂', '未及有所作为'];
    else if (reign >= 35) mark = ['享国长久', `在位 ${Math.round(reign)} 年，国势平稳`];
    else mark = ['守成之君', '守成而已，国势大体如旧'];
    const summary = `${who}，${houseName ? houseName + '，' : ''}${state(start)}第 ${i + 1} 位${title}。${ACC[acc] || '即位'}，在位 ${Math.round(reign)} 年${fate === 'reigning' ? '（至今）' : ''}；${mark[1]}${won || lostW ? `；在位期间${won ? '得地' + cnNum(won) + '处' : ''}${won && lostW ? '，' : ''}${lostW ? '失地' + cnNum(lostW) + '处' : ''}` : ''}。`;
    return { who, title, house: houseName, state: state(start), birth, death, reign, accAge, acc, accLabel: ACC[acc] || '即位', fate, fateLabel: FATE[fate] || '', mark: mark[0], summary, events: out, start, stop, territory: nT };
  }

  G.RulerLife = { build, ACC, FATE };
})(window);
