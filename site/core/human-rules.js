/* Human definitions shared by the library editors and simulation worker. */
(function (G) {
  'use strict';
  const VERSION = 'anchors-1.4.3-three-systems';
  // Lower costs are beneficial; autonomy trades central reach for less friction.
  const COST_EFFECTS = new Set(['laborCost','foodNeed','dryFoodNeed','migrationCost','wetMigration','deathRate','tradeLoss','constructionCost']);
  function traitValence(effects) {
    let positive = false, negative = false;
    for (const [key,value] of Object.entries(effects)) {
      if (!value) continue;
      if (key === 'autonomy') { positive = true; negative = true; continue; }
      const benefit = COST_EFFECTS.has(key) ? -value : value;
      if (benefit > 0) positive = true; else negative = true;
    }
    return positive && negative ? 'mixed' : negative ? 'negative' : 'positive';
  }
  const TRAITS = [
    ['river_trade','河运传统','culture','生计与交通','沿河出行速度提高25%。',{riverTravel:.25}],
    ['mountain_routes','山路传统','culture','生计与交通','山地通行能力提高50%。',{mountainTravel:.5}],
    ['local_autonomy','地方自治','culture','制度与认同','异文化治理摩擦降低，中央直接触达降低12.5%。',{autonomy:.5},['legalist']],
    ['cultural_exchange','兼收并蓄','culture','制度与认同','陆路文化接触强度提高45%；代价：抵抗文化转变的能力降低10%。',{culturalExchange:.45,culturalResistance:-.1},['insular']],
    ['pastoralists','逐水草居','culture','生计与交通','干旱地区粮食劳动产出提高15%。',{dryFoodOutput:.15}],
    ['terrace_farming','梯田耕作','culture','生计与交通','山地粮食劳动产出提高15%。',{mountainFoodOutput:.15}],
    ['irrigation','水利协作','culture','生计与交通','沿河地区粮食劳动产出提高15%。',{riverFoodOutput:.15}],
    ['granaries','储运经验','culture','生计与交通','粮食运输损失降低15%，不额外生成库存。',{tradeLoss:-.15}],
    ['mercantile','商旅传统','culture','生计与交通','陆路粮食运输容量提高20%。',{tradeCapacity:.2}],
    ['craft_guilds','工匠行会','culture','生计与交通','单位生产劳动成本降低10%；代价：行会限制使陆路粮食运输容量降低10%。',{laborCost:-.1,tradeCapacity:-.1}],
    ['martial','尚武风俗','culture','战争与边防','攻击和防御能力提高5%；代价：军事训练占用劳力，粮食劳动产出降低8%。',{combat:.05,foodOutput:-.08}],
    ['defensive','守土有责','culture','战争与边防','防御能力提高10%；代价：离乡义务约束使迁徙折算成本提高10%。',{defense:.1,migrationCost:.1}],
    ['expansionist','开疆精神','culture','战争与边防','攻击能力提高8%；代价：治理触达能力降低5%。',{attack:.08,governance:-.05}],
    ['legalist','成文律法','culture','制度与认同','治理触达能力提高10%。',{governance:.1},['local_autonomy']],
    ['pluralism','多元共处','culture','制度与认同','异文化与异教治理摩擦降低20%。',{tolerance:.2}],
    ['oral_history','口述传承','culture','制度与认同','抵抗文化转变的能力提高15%；代价：向相邻人群传播文化认同的强度降低10%。',{culturalResistance:.15,assimilation:-.1}],
    ['cosmopolitan','文化交汇','culture','制度与认同','向相邻人群传播文化认同的强度提高20%。',{assimilation:.2},['insular']],
    ['caravans','商队组织','culture','生计与交通','迁徙折算成本降低15%。',{migrationCost:-.15},['travel_taboos']],
    ['communal','公社互助','culture','制度与认同','人均食物需求降低5%。',{foodNeed:-.05},['wasteful']],
    ['fort_builders','筑垒传统','culture','战争与边防','要塞建设所需劳动降低20%。',{constructionCost:-.2}],
    ['insular','闭塞乡俗','culture','制度与认同','陆路文化接触强度降低25%，陆路粮食运输容量降低15%。',{culturalExchange:-.25,tradeCapacity:-.15},['cultural_exchange','cosmopolitan']],
    ['wasteful','奢靡风气','culture','生计与交通','人均食物需求提高15%，单位生产劳动成本提高10%。',{foodNeed:.15,laborCost:.1},['communal']],
    ['bureaucratic','冗官繁文','culture','制度与认同','治理触达能力降低15%，要塞建设所需劳动提高15%。',{governance:-.15,constructionCost:.15}],
    ['travel_taboos','行旅禁忌','culture','生计与交通','陆地出行速度降低15%，迁徙折算成本提高15%。',{travelSpeed:-.15,migrationCost:.15},['caravans']],

    ['missionary','传教传统','religion','传播与信仰','向邻区传播信仰的强度提高20%；代价：传教占用劳力，粮食劳动产出降低5%。',{religiousSpread:.2,foodOutput:-.05}],
    ['pilgrimage','朝圣传统','religion','传播与信仰','与本教圣地相连的陆路信仰接触提高25%。',{pilgrimage:.25}],
    ['syncretism','信仰融合','religion','传播与信仰','传教强度提高10%；代价：抵抗改宗能力降低15%。',{religiousSpread:.1,religiousResistance:-.15},['orthodoxy']],
    ['orthodoxy','正统守护','religion','传播与信仰','抵抗改宗的能力提高25%；代价：入教要求严格，向邻区传教强度降低10%。',{religiousResistance:.25,religiousSpread:-.1},['syncretism','sectarian_disputes']],
    ['war_name','以战之名','religion','战争与圣地','信徒参战时攻击和防御能力提高5%；代价：备战使粮食劳动产出降低5%。',{combat:.05,foodOutput:-.05},['pacifism']],
    ['great_holy_war','大圣战','religion','战争与圣地','解锁大圣战：有陆路目标与供养时出征，实际夺取异教土地后建立宗教国家；可能失败。',{holyWar:1},['pacifism']],
    ['earthly_kingdom','地上天国','religion','战争与圣地','符合圣城、发展阶段等条件的政权转为宗教国家的概率提高100%（概率翻倍）；不改变大圣战。',{theocracyChance:1}],
    ['pacifism','和平誓约','religion','战争与圣地','攻击能力降低10%，异文化与异教治理摩擦降低30%；不能发动大圣战。',{attack:-.1,tolerance:.3},['war_name','great_holy_war']],
    ['warrior_orders','护教武团','religion','战争与圣地','信徒防御能力提高10%。',{defense:.1},['fatalism']],
    ['charity','慈善布施','religion','生活与秩序','信徒基础死亡率降低5%。',{deathRate:-.05}],
    ['asceticism','苦修节制','religion','生活与秩序','信徒人均食物需求降低5%；代价：出生率降低5%。',{foodNeed:-.05,birthRate:-.05},['ritual_feasts']],
    ['communal_rites','家庭祝福','religion','生活与秩序','信徒出生率提高5%。',{birthRate:.05}],
    ['sacred_law','神圣律法','religion','生活与秩序','治理触达能力提高10%。',{governance:.1}],
    ['sacred_groves','丰穰祭仪','religion','生活与秩序','信徒粮食劳动产出提高5%。',{foodOutput:.05}],
    ['hospices','施医济病','religion','生活与秩序','基础死亡率降低10%，生产劳动成本提高5%。',{deathRate:-.1,laborCost:.05}],
    ['temple_schools','寺院学舍','religion','生活与秩序','生产劳动成本降低5%，治理触达能力提高5%；代价：办学供养使人均食物需求提高5%。',{laborCost:-.05,governance:.05,foodNeed:.05}],
    ['ritual_feasts','共宴礼仪','religion','传播与信仰','文化接触强度提高10%，食物需求提高5%。',{culturalExchange:.1,foodNeed:.05},['asceticism']],
    ['ancestor_veneration','敬祖守礼','religion','传播与信仰','抵抗文化转变提高15%，抵抗改宗提高10%。',{culturalResistance:.15,religiousResistance:.1}],
    ['monastic_isolation','静修共同体','religion','生活与秩序','粮食劳动产出提高5%，文化接触强度降低10%。',{foodOutput:.05,culturalExchange:-.1}],
    ['sacred_markets','圣地集市','religion','生活与秩序','信徒参与的陆路粮食运输容量提高15%。',{tradeCapacity:.15}],
    ['guardians_holy','守护圣约','religion','战争与圣地','防御能力提高8%，抵抗改宗提高10%。',{defense:.08,religiousResistance:.1}],
    ['ritual_burden','繁苛仪轨','religion','生活与秩序','粮食劳动产出降低10%，生产投入工时增加10%；两项叠加会进一步推高单位粮食成本。',{foodOutput:-.1,laborCost:.1}],
    ['clergy_corruption','神职腐败','religion','生活与秩序','抵抗改宗的能力降低20%，治理触达能力降低10%。',{religiousResistance:-.2,governance:-.1}],
    ['fatalism','消极宿命','religion','生活与秩序','粮食劳动产出降低10%，防御能力降低10%。',{foodOutput:-.1,defense:-.1},['warrior_orders']],
    ['sectarian_disputes','教派内耗','religion','传播与信仰','向邻区传教强度降低15%，抵抗改宗的能力降低15%。',{religiousSpread:-.15,religiousResistance:-.15},['orthodoxy']],

    ['mountain_adapted','山地适应','species','环境适应','山地通行能力提高50%。',{mountainTravel:.5}],
    ['cold_adapted','耐寒','species','环境适应','适宜温度下限降低10°C；代价：适宜温度上限也降低5°C。',{coldTolerance:10,heatTolerance:-5}],
    ['heat_adapted','耐热','species','环境适应','适宜温度上限提高10°C；代价：适宜温度下限也提高5°C。',{heatTolerance:10,coldTolerance:-5}],
    ['wetland_adapted','湿地步行','species','环境适应','迁入多雨地区时，迁徙折算成本降低15%。',{wetMigration:-.15}],
    ['dry_adapted','耐旱体质','species','环境适应','干旱地区人均食物需求降低15%。',{dryFoodNeed:-.15}],
    ['hardy','强健体魄','species','生理天赋','基础死亡率降低10%。',{deathRate:-.1},['frail']],
    ['fecund','繁衍旺盛','species','生理天赋','出生率提高10%；代价：抚育负担使人均食物需求提高5%。',{birthRate:.1,foodNeed:.05},['slow_breeding']],
    ['long_lived','长寿经验','species','生理天赋','生产劳动成本降低10%；代价：出生率降低5%。',{laborCost:-.1,birthRate:-.05}],
    ['frugal','低耗代谢','species','生理天赋','人均食物需求降低10%；代价：粮食劳动产出降低5%。',{foodNeed:-.1,foodOutput:-.05},['ravenous']],
    ['vigorous','强力肌群','species','战斗与行动','攻击和防御能力提高5%，食物需求提高5%。',{combat:.05,foodNeed:.05}],
    ['keen_senses','敏锐感官','species','战斗与行动','防御能力提高8%。',{defense:.08}],
    ['enduring','长途耐力','species','战斗与行动','迁徙折算成本降低15%。',{migrationCost:-.15}],
    ['swift','迅捷步伐','species','战斗与行动','陆地出行速度提高15%。',{travelSpeed:.15},['clumsy']],
    ['strong_arms','强壮劳作','species','生理天赋','粮食劳动产出提高10%，筑防劳动需求降低10%。',{foodOutput:.1,constructionCost:-.1}],
    ['dexterous','灵巧双手','species','生理天赋','生产劳动成本降低10%。',{laborCost:-.1},['clumsy']],
    ['rapid_learning','模仿学习','species','认知与传承','向邻区传播本群体文化认同的强度提高15%。',{assimilation:.15}],
    ['cohesive','群体记忆','species','认知与传承','抵抗文化转变的能力提高15%。',{culturalResistance:.15}],
    ['regenerative','快速恢复','species','生理天赋','基础死亡率降低15%，食物需求提高10%。',{deathRate:-.15,foodNeed:.1}],
    ['nocturnal','夜行优势','species','战斗与行动','攻击能力提高8%；代价：粮食劳动产出降低5%。',{attack:.08,foodOutput:-.05}],
    ['high_altitude','高地生存','species','环境适应','山地粮食劳动产出提高15%。',{mountainFoodOutput:.15}],
    ['frail','脆弱体质','species','生理天赋','基础死亡率提高20%，攻击和防御能力降低5%。',{deathRate:.2,combat:-.05},['hardy']],
    ['slow_breeding','繁育困难','species','生理天赋','出生率降低20%。',{birthRate:-.2},['fecund']],
    ['ravenous','高耗代谢','species','生理天赋','人均食物需求提高20%。',{foodNeed:.2},['frugal']],
    ['clumsy','肢体笨拙','species','战斗与行动','单位生产劳动成本提高15%，陆地出行速度降低10%。',{laborCost:.15,travelSpeed:-.1},['dexterous','swift']]
  ].map(([id,label,scope,group,description,effects,conflicts=[]])=>Object.freeze({id,label,scope,group,description,valence:traitValence(effects),effects:Object.freeze(effects),conflicts:Object.freeze(conflicts)}));
  const TRAIT_BY_ID=new Map(TRAITS.map(t=>[t.id,t]));
  const EFFECT_KEYS=Object.freeze([...new Set(TRAITS.flatMap(t=>Object.keys(t.effects)))]);
  const ZERO=Object.freeze(Object.fromEntries(EFFECT_KEYS.map(k=>[k,0]))), effectCache=new WeakMap();
  function effects(def) {
    if(!def)return ZERO;
    const cached=effectCache.get(def);if(cached&&cached.traits===def.traits)return cached.value;
    const result={...ZERO};
    for(const v of def.traits||[]){const t=TRAIT_BY_ID.get(v.id);if(!t)throw Error('未知词条：'+v.id);for(const [k,n] of Object.entries(t.effects))result[k]+=n*v.strength;}
    const value=Object.freeze(result);effectCache.set(def,{traits:def.traits,value});return value;
  }
  function combine(...defs){const result={...ZERO};for(const d of defs){const e=effects(d);for(const k of EFFECT_KEYS)result[k]+=e[k];}return result;}
  // Hot path (called per population group every tick): same result as Math.max(min, Math.min(max, 1 + value)), NaN included.
  function multiplier(value,min,max){if(min===undefined)min=.1;if(max===undefined)max=3;const v=1+value;return v>max?max:v<min?min:v;}
  const SPECIES = [
    {id:'human',label:'人类',description:'体格与食量均衡的种族，天赋由你选择；可形成不同文化与信仰。',color:[165,119,65],temperature:[-5,32],mountainMobility:1,foodNeed:1,traits:[]},
    {id:'elf',label:'精灵',description:'体态轻盈、长耳而感官敏锐的种族。食量较小，行动迅捷，精细劳作成本较低，繁衍较慢。',color:[96,160,132],temperature:[-2,30],mountainMobility:1,foodNeed:.85,traits:[{id:'long_lived',strength:1},{id:'keen_senses',strength:1},{id:'dexterous',strength:1},{id:'swift',strength:1},{id:'slow_breeding',strength:1}]},
    {id:'orc',label:'兽人',description:'身躯强健、肌肉发达的种族。力量有利于战斗、耕作和筑防，也需要更多食物。',color:[131,145,82],temperature:[-8,36],mountainMobility:1.1,foodNeed:1.25,traits:[{id:'vigorous',strength:1},{id:'strong_arms',strength:1},{id:'hardy',strength:1}]},
    {id:'dwarf',label:'矮人',description:'身形矮壮、双手灵巧的种族。耐寒，擅长山地行走和高地谋生；食量较大，繁衍较慢。',color:[169,119,87],temperature:[-15,28],mountainMobility:1.35,foodNeed:1.1,traits:[{id:'mountain_adapted',strength:1},{id:'dexterous',strength:1},{id:'high_altitude',strength:1},{id:'slow_breeding',strength:1}]},
    {id:'goblin',label:'地精',description:'身形小巧、食量较低的种族。繁衍旺盛，有夜行攻击天赋；体质脆弱，粮食劳动产出偏低。',color:[133,156,92],temperature:[0,36],mountainMobility:1,foodNeed:.65,traits:[{id:'fecund',strength:1},{id:'frugal',strength:1},{id:'nocturnal',strength:1},{id:'frail',strength:1}]}
  ];
  // Ages use biological Earth years (365.25 days of 24 h); Life converts world years explicitly.
  const LIFE_DEFAULTS = Object.freeze({maturity:18,oldAge:60,maximum:110,infantMortality:.035,adultMortality:.004,oldAgeMortality:.035});
  const LIFE_PRESETS = {
    human:LIFE_DEFAULTS,
    elf:{maturity:40,oldAge:220,maximum:420,infantMortality:.012,adultMortality:.0012,oldAgeMortality:.009},
    orc:{maturity:15,oldAge:48,maximum:85,infantMortality:.03,adultMortality:.005,oldAgeMortality:.045},
    dwarf:{maturity:25,oldAge:130,maximum:240,infantMortality:.02,adultMortality:.002,oldAgeMortality:.018},
    goblin:{maturity:12,oldAge:38,maximum:70,infantMortality:.045,adultMortality:.007,oldAgeMortality:.06}
  };
  for(const species of SPECIES)species.life={...LIFE_PRESETS[species.id]};
  function strength(def,id) { const t = def && def.traits && def.traits.find(t=>t.id===id); return t ? t.strength : 0; }
  const RESERVED_IDS = new Set([...Object.getOwnPropertyNames(Object.prototype), 'prototype']);
  const CATEGORIES = ['agrarian','pastoral','maritime','highland','tribal','new-world'];
  const RELIGION_TYPES = ['monotheist','dualist','polytheist','dharmic','ancestral','shamanic','philosophy'];
  const RELIGION_SPREADS = ['missionary','ethnic','syncretic'];
  const FAMILIES = ['sinitic','japanese','korean','germanic','latin','romance','slavic','steppe','persian','arabic','indic','malay','celtic','finnic','arctic'];
  const NAME_KEYS = ['states','provinces','cities','mountains','rivers','lakes','seas','regions','streets'];
  const TITLE_KEYS = ['monarchy','duchy','empire','republic','city','cityRepublic','nomadic','nomadEmpire','chiefdom','league','jimi','nomad','tribe','vassal','colony','theocracy'];
  const RULER_KEYS = ['chief','city','king','empire','nomad','nomadEmpire','republic','vassal','colony','rebel'];
  const ORG_KEYS = ['chief','city','king','empire','feudal','central','nomad','republic','theo','vassal','colony','rebel'];
  function object(value, field) { if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error(field+' 必须为对象'); }
  function keys(value, allowed, field) {
    object(value, field);
    for (const key of Object.keys(value)) if (!allowed.includes(key)) throw Error(field+' 包含未知字段：'+key);
  }
  function text(value, field) { if (typeof value !== 'string') throw Error(field+' 必须为文本'); }
  function list(value, field) {
    if (!Array.isArray(value) || value.some(v => typeof v !== 'string' || !v.trim())) throw Error(field+' 必须为非空文本组成的列表');
  }
  function listFields(value, allowed, field) { keys(value,allowed,field); for (const [k,v] of Object.entries(value)) list(v,field+'.'+k); }
  function textFields(value, allowed, field) { keys(value,allowed,field); for (const [k,v] of Object.entries(value)) text(v,field+'.'+k); }
  function enumField(v, options, field) { if (typeof v !== 'string' || !options.includes(v)) throw Error(field+' 无效'); }
  function cultureExtension(x) {
    keys(x,['family','people','regnal','house','succession','ruler','gov','rebel','places','titles'],'文化扩展');
    if (x.family !== undefined && x.family !== '') enumField(x.family,FAMILIES,'文化族系');
    if (x.regnal !== undefined && x.regnal !== '') enumField(x.regnal,['number','temple','plain'],'君主名号');
    if (x.succession !== undefined && x.succession !== '') enumField(x.succession,['state','house'],'王朝格式');
    if (x.house !== undefined) text(x.house,'王朝名称格式');
    if (x.people !== undefined) { keys(x.people,['surnames','given','twoChar'],'人名'); for(const k of ['surnames','given']) if(x.people[k]!==undefined) list(x.people[k],'人名.'+k); if(x.people.twoChar!==undefined && (!Number.isFinite(x.people.twoChar)||x.people.twoChar<0||x.people.twoChar>1))throw Error('双字人名比例无效'); }
    if (x.ruler !== undefined) textFields(x.ruler,RULER_KEYS,'君主称谓');
    if (x.gov !== undefined) { keys(x.gov,['style','minister','org'],'政府组织'); if(x.gov.style!==undefined && x.gov.style!=='')enumField(x.gov.style,['bureaucratic','feudal','tribal','mercantile','temple'],'政府风格'); if(x.gov.minister!==undefined)text(x.gov.minister,'首席大臣称谓'); if(x.gov.org!==undefined)textFields(x.gov.org,ORG_KEYS,'官制'); }
    if (x.rebel !== undefined) { keys(x.rebel,['style','fmt','symbols'],'起义名号'); if(x.rebel.style!==undefined && x.rebel.style!=='')enumField(x.rebel.style,['symbol','place'],'起义命名方式'); if(x.rebel.fmt!==undefined)text(x.rebel.fmt,'起义命名格式'); if(x.rebel.symbols!==undefined)list(x.rebel.symbols,'起义象征'); }
    if (x.places !== undefined) listFields(x.places,['port','fort','pass'],'地名后缀');
    if (x.titles !== undefined) textFields(x.titles,['vassal','colony','theocracy'],'附加称号');
  }
  function validateLibrary(l,scope) {
    if (!l || typeof l !== 'object' || Array.isArray(l) || !['species','culture','religion'].includes(scope)) throw Error('库定义无效');
    if (typeof l.id !== 'string' || !/^[a-zA-Z0-9_.:-]{1,100}$/.test(l.id) || RESERVED_IDS.has(l.id)) throw Error('库 ID 必须是稳定的字母数字标识');
    if (typeof l.label !== 'string' || !l.label.trim() || l.label.length>100) throw Error('库名称需要 1～100 个字符');
    if (l.traits !== undefined && !Array.isArray(l.traits)) throw Error('词条必须为列表');
    const seen = new Set();
    for (const t of l.traits || []) {
      if (!t || !TRAITS.some(d=>d.id===t.id&&d.scope===scope)) throw Error('未知或不适用的词条：'+(t&&t.id));
      if (seen.has(t.id)) throw Error('重复词条：'+t.id); seen.add(t.id);
      if (t.strength!==1) throw Error('库内词条为勾选制，强度必须为 1');
    }
    if ((scope==='species' || l.color !== undefined) && (!Array.isArray(l.color)||l.color.length!==3||l.color.some(v=>!Number.isInteger(v)||v<0||v>255))) throw Error('颜色必须为三个 0～255 的整数');
    if (scope==='culture') {
      enumField(l.cat,CATEGORIES,'文化类别'); enumField(l.mode,['realistic','historical','fantasy','custom'],'文化风格');
      if(l.style!==undefined && (!Number.isInteger(l.style)||l.style<0))throw Error('文化风格编号无效');
      listFields(l.n,NAME_KEYS,'文化名称');
      if(l.t!==undefined)listFields(l.t,TITLE_KEYS,'国家后缀');
      if(l.c!==undefined)listFields(l.c,['roots','prefixes','suffixes'],'组合词根');
      if(!Object.values(l.n).some(v=>v.length) && !(l.c && l.c.roots && l.c.roots.length))throw Error('文化库至少需要一类名称或词根');
      if(l.x!==undefined)cultureExtension(l.x);
    }
    if (scope==='religion') {
      enumField(l.mode,['realistic','fantasy'],'宗教风格'); enumField(l.type,RELIGION_TYPES,'宗教类型'); enumField(l.spread,RELIGION_SPREADS,'宗教传播方式');
      if(l.cats!==undefined) { list(l.cats,'适用文化'); if(l.cats.some(c=>!CATEGORIES.includes(c)))throw Error('适用文化类别无效'); }
      listFields(l.names,['faiths','suffix','branches','heresies','holy'],'宗教名称');
      if(!(l.names.faiths && l.names.faiths.length) && !(l.names.suffix && l.names.suffix.length))throw Error('宗教库至少需要教名或教名后缀');
      if(l.clergy!==undefined)textFields(l.clergy,['head','priest','theocracy','ruler'],'宗教神职');
      if(l.symbol!==undefined)text(l.symbol,'圣徽'); if(l.relic!==undefined)text(l.relic,'圣物');
    }
    for(const t of l.traits||[])for(const id of TRAIT_BY_ID.get(t.id).conflicts)if(seen.has(id))throw Error('互斥词条不能同时选择：'+TRAIT_BY_ID.get(t.id).label+'、'+TRAIT_BY_ID.get(id).label);
    if (scope==='species') {
      if (l.description !== undefined && (typeof l.description !== 'string' || l.description.length>300)) throw Error('种族简介必须为不超过 300 字符的文本');
      if (!Array.isArray(l.temperature)||l.temperature.length!==2||l.temperature.some(v=>!Number.isFinite(v)||v< -100||v>100)||l.temperature[0]>=l.temperature[1]) throw Error('温度范围无效');
      for(const k of ['mountainMobility','foodNeed']) if(!Number.isFinite(l[k])||l[k]<.5||l[k]>2) throw Error(k+' 必须在 0.5～2 之间');
      keys(l.life,['maturity','oldAge','maximum','infantMortality','adultMortality','oldAgeMortality'],'种族成长与寿命');
      for(const k of ['maturity','oldAge','maximum'])if(!Number.isFinite(l.life[k])||l.life[k]<=0||l.life[k]>10000)throw Error('成长与寿命年龄须在 0～10000 生理年之间');
      if(!(l.life.maturity<l.life.oldAge&&l.life.oldAge<l.life.maximum))throw Error('成年年龄必须早于衰老年龄，衰老年龄必须早于寿命上限');
      for(const k of ['infantMortality','adultMortality','oldAgeMortality'])if(!Number.isFinite(l.life[k])||l.life[k]<0||l.life[k]>1)throw Error('年龄死亡风险须在 0～1 之间');
    }
    return l;
  }
  function species(cfg) {
    const defs = cfg.speciesLibraries === undefined ? [SPECIES[0]] : cfg.speciesLibraries;
    if (!Array.isArray(defs)||!defs.length) throw Error('至少选择一个种族');
    const ids=new Set(); for(const l of defs){validateLibrary(l,'species');if(ids.has(l.id))throw Error('重复种族 ID：'+l.id);ids.add(l.id);}
    return JSON.parse(JSON.stringify(defs));
  }
  G.HumanRules={VERSION,TRAITS,SPECIES,LIFE_DEFAULTS,strength,validateLibrary,species,effects,combine,multiplier,EFFECT_KEYS};
})(typeof self!=='undefined'?self:this);
