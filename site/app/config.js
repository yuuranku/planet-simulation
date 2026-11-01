/* 21 道推演题与参数映射 */
(function (G) {
  'use strict';
  const POLE = [['land', '有大陆', '极地被陆地覆盖'], ['ocean', '以海洋为主', '极点处为开阔海洋'], ['random', '随机', '由推演决定'], ['separate', '单独大陆', '与宜居大陆隔海']];
  const Q = [
    { id: 'north', t: '北极是否有大陆', o: POLE, d: 'ocean' },
    { id: 'south', t: '南极是否有大陆', o: POLE, d: 'land' },
    { id: 'star', t: '恒星与光照', o: [['1260', '暖橙恒星、柔和光照', '1260 W/m²'], ['1361', '黄色恒星、类地光照', '1361 W/m²'], ['1460', '偏亮恒星、较强光照', '1460 W/m²']], d: '1361' },
    { id: 'radius', t: '星球大小', o: [['5200', '较小类地星球', '半径 5200 公里'], ['6400', '约地球大小', '半径 6400 公里'], ['8000', '较大类地星球', '半径 8000 公里']], d: '6400' },
    { id: 'day', t: '一天多长', o: [['20', '20 小时', '环流带更窄'], ['26', '26 小时', '接近地球'], ['32', '32 小时', '哈德来环流更宽']], d: '26' },
    { id: 'spin', t: '自转方向', o: [['pro', '顺行', '盛行西风带'], ['retro', '逆行', '风带与洋流反向'], ['random', '随机', '由推演决定']], d: 'pro' },
    { id: 'orbit', t: '公转与季节', o: [['A', '一年 360 日', '轴倾角 12°'], ['B', '一年 320 日', '轴倾角 18°'], ['C', '一年 420 日', '轴倾角 28°']], d: 'B' },
    { id: 'moons', t: '卫星与星环', o: [['one', '一颗主要卫星', '潮差大 · 河口多三角湾与潮滩'], ['many', '多颗小卫星', '潮差中等'], ['none', '无卫星', '几乎无潮汐 · 河口三角洲发育'], ['ring', '仅主星环', '无卫星 · 星环投影降温']], d: 'one' },
    { id: 'plates', t: '板块与构造', o: [['8', '8 块', '偏稳定'], ['14', '14 块', '中等活动'], ['20', '20 块', '活动较强']], d: '14' },
    { id: 'land', t: '陆地占比', o: [['0.25', '25%', '海洋世界'], ['0.35', '35%', '接近地球'], ['0.45', '45%', '大陆世界']], d: '0.35' },
    { id: 'structure', t: '大陆总体结构', o: [['A', '偏聚合', '3–5 个大陆核心'], ['B', '相对分散', '6–8 个大陆核心'], ['C', '裂解附属陆块丰富', '9–12 个核心']], d: 'B' },
    { id: 'coast', t: '海岸与岛屿倾向', o: [['A', '完整陆缘', '岛链适量'], ['B', '海湾半岛与岛弧均衡', '介于两者之间'], ['C', '破碎陆缘', '丰富岛链和群岛']], d: 'B' },
    { id: 'interior', t: '内陆地形倾向', o: [['A', '低地较广', '平原与缓丘'], ['B', '山系、高原与盆地多样', '起伏丰富'], ['C', '山地较多', '崎岖多山']], d: 'B' },
    { id: 'era', t: '人口规模', o: [['A', '人口较少', '1 亿–1.6 亿'], ['B', '人口中等', '2.5 亿–4 亿'], ['C', '人口众多', '6.5 亿–9.5 亿']], d: 'B', extra: 'pop' }, // id 沿用 era 以兼容旧存档；时代见第 21 题 age
    { id: 'culture', t: '文化与宗教复杂度', o: [['A', '8 个文化圈', '12 种语言 · 6 个宗教'], ['B', '14 个文化圈', '24 种语言 · 10 个宗教'], ['C', '20 个文化圈', '36 种语言 · 16 个宗教']], d: 'B' },
    { id: 'politics', t: '政治格局与部落空间', o: [['A', '约 45 国', '部落游牧空间 25%'], ['B', '约 80 国', '部落游牧空间 35%'], ['C', '约 120 国', '部落游牧空间 45%']], d: 'B' },
    { id: 'towns', t: '城市、省份与交通', o: [['A', '疏朗', '480 城镇 · 行政粗分 · 基础交通'], ['B', '标准', '720 城镇 · 标准行政与交通'], ['C', '密集', '1080 城镇 · 行政细分 · 完善交通']], d: 'B', extra: 'towns' },
    { id: 'climate', t: '气候调节——冷热与水汽', o: [['A', '类地平均', '参考温偏 ±0 °C · 水汽 1.0×'], ['B', '偏热偏湿润', '+3 °C · 1.1×'], ['C', '更热更湿润', '+6 °C · 1.2×'], ['D', '偏冷偏干燥', '−3 °C · 0.9×'], ['E', '很冷很干燥', '−6 °C · 0.8×']], d: 'A', extra: 'climate' },
    { id: 'newWorld', t: '是否有新大陆', o: [['yes', '有新大陆', '远隔大洋、晚接触的陆块'], ['no', '没有新大陆', '所有大陆同属旧世界'], ['random', '随机', '由推演决定']], d: 'random' },
    { id: 'lakes', t: '湖泊与内陆水体', o: [['A', '湖泊稀少', '排水通畅 · 湖面约为类地的一半'], ['B', '类地', '湖面约占陆地 1.3–1.8%（地球实测 1.8%）'], ['C', '湖泊众多', '冰川湖区般 · 约为类地的两倍']], d: 'B' },
    { id: 'age', t: '文明时代（现在是文明纪元第几年）', o: [['classical', '古典时代', '约第 2700–3500 年 · 相当于公元前 300 – 公元 500 年'], ['medieval', '中世纪', '约第 3500–4450 年 · 相当于公元 500 – 1450 年'], ['preind', '前工业时代', '约第 4450–4760 年 · 相当于公元 1450 – 1760 年']], d: 'preind' }
  ];
  // 选项影响提示：每个选项右侧灰色小标记，悬浮可见。行格式 [类别, 方向, 说明]，方向 '+' 变多/变强、'-' 变少/变弱、'·' 说明或位置变化。
  // 每一条都对应推演中的实际机制（planet / climate / hydro / society / history），只写方向与大致幅度，具体分布由种子决定。
  const poleHint = p => ({
    land: [['地理', '·', `${p}极点是一块覆冰大陆，约占星球表面积 2–5%`], ['地理', '-', '陆地总量不变，分给其他大陆的陆地相应变少'], ['群系', '+', '冰盖'], ['文明', '·', '极地大陆基本无人居住']],
    ocean: [['地理', '·', `${p}极点是开阔海洋，没有极地大陆`], ['群系', '-', '冰盖（极点没有陆地可积冰）'], ['地理', '+', '分给宜居大陆的陆地']],
    random: [['说明', '·', '按种子在“有大陆 / 以海洋为主 / 单独大陆”中等概率抽一种']],
    separate: [['地理', '·', `${p}极有一块覆冰大陆（约 2–5%），与其他大陆隔海`], ['地理', '-', `宜居大陆的核心只落在 46° 以内，${p}半球高纬陆地少`], ['群系', '-', `${p}半球宜居大陆上的苔原与北方针叶林`], ['群系', '+', '冰盖（集中在孤立的极地大陆上）'], ['文明', '·', '极地大陆与人居大陆隔海，基本无人']]
  });
  const HINTS = {
    north: poleHint('北'), south: poleHint('南'),
    star: {
      1260: [['温度', '-', '全球约 −6 °C（与第 18 题叠加）'], ['群系', '+', '冰盖、苔原、北方针叶林'], ['群系', '-', '热带雨林、热带季雨林'], ['水汽', '-', '海面蒸发随温度降低，整体偏干'], ['文明', '-', '高纬可耕地，人口更集中到中低纬']],
      1361: [['温度', '·', '类地基准，各气候带比例接近地球']],
      1460: [['温度', '+', '全球约 +6 °C（与第 18 题叠加）'], ['群系', '+', '热带雨林、季雨林、稀树草原'], ['群系', '-', '冰盖、苔原'], ['水汽', '+', '海面蒸发增强，整体偏湿'], ['文明', '+', '高纬可耕地']]
    },
    radius: {
      5200: [['地理', '-', '表面积约为地球的 0.66 倍'], ['地形', '+', '山地起伏略高'], ['气候', '-', '大陆腹地离海较近，大陆性与内陆干旱'], ['文明', '+', '人口与国家更密（总数仍由第 14、16 题决定）'], ['推演', '·', '网格较小，推演更快']],
      6400: [['地理', '·', '约地球大小，标准网格']],
      8000: [['地理', '+', '表面积约为地球的 1.56 倍'], ['地形', '-', '山地起伏略低'], ['气候', '+', '大陆腹地离海更远，大陆性与内陆干旱'], ['文明', '-', '人口与国家更稀，单国疆域更大'], ['推演', '·', '网格较大，推演更慢']]
    },
    day: {
      20: [['环流', '·', '副热带高压移到约 26°、极锋约 54°，风带整体向赤道收拢'], ['群系', '-', '热带与稀树草原带变窄'], ['气候', '·', '副热带荒漠带更靠近赤道']],
      26: [['环流', '·', '副热带高压约 30°、极锋约 60°，接近地球']],
      32: [['环流', '·', '副热带高压推到约 34°、极锋约 66°，风带整体向极地推'], ['群系', '+', '热带与稀树草原带变宽'], ['气候', '·', '荒漠带、地中海气候与西风带往高纬移']]
    },
    spin: {
      pro: [['风带', '·', '与地球相同：中纬西风；大洋西侧暖流、东侧寒流'], ['气候', '·', '副热带大陆西岸贴寒流偏干，东岸偏湿润']],
      retro: [['风带', '·', '风带与洋流整体反向，暖流与寒流换边'], ['气候', '·', '大陆东西两岸气候对调：干旱海岸换到东岸，湿润海岸换到西岸'], ['总量', '·', '各类气候总量变化不大，变的是在大陆哪一侧']],
      random: [['说明', '·', '按种子在顺行与逆行中各一半概率抽取']]
    },
    orbit: {
      A: [['季节', '-', '轴倾角 12°，四季平缓，内陆冬夏温差小'], ['温度', '-', '极地年均更冷（极区全年日照少）'], ['群系', '+', '冰盖'], ['气候', '-', '雨带随季节南北摆动小，季风弱']],
      B: [['季节', '·', '轴倾角 18°，季节比地球（23.4°）略弱']],
      C: [['季节', '+', '轴倾角 28°，季节强烈，内陆冬冷夏热'], ['温度', '+', '极地年均更暖，热带年均略凉'], ['群系', '-', '冰盖'], ['气候', '+', '季风与大陆性气候']]
    },
    moons: {
      one: [['海岸', '+', '潮差大：河口多三角湾，沿海潮滩湿地多'], ['海岸', '-', '三角洲（大潮冲刷，河口难淤积）']],
      many: [['海岸', '·', '潮差中等：仍有潮滩湿地，三角洲比一颗主卫星时多']],
      none: [['海岸', '+', '大河口三角洲'], ['海岸', '-', '几乎无潮汐，没有潮滩湿地']],
      ring: [['海岸', '+', '三角洲（潮汐微弱）'], ['海岸', '-', '潮滩湿地'], ['温度', '-', '星环在冬季半球投影：纬度 6–34° 冬季日照减约三成'], ['季节', '+', '低纬冬夏温差']]
    },
    plates: {
      8: [['地形', '-', '构造活动弱，山地更少更矮'], ['群系', '-', '高山草甸与裸岩'], ['文明', '-', '高地生计文明'], ['边界', '·', '山脊阻隔少，文化与国家疆域更连片']],
      14: [['地形', '·', '构造活动中等，山地比例接近地球']],
      20: [['地形', '+', '构造活动强，山地更多更高'], ['群系', '+', '高山草甸与裸岩'], ['气候', '+', '迎风坡多雨、背风坡雨影干旱'], ['文明', '+', '高地生计文明'], ['边界', '·', '国界与文化边界多沿山脊划分']]
    },
    land: {
      0.25: [['地理', '-', '陆地 25%，海洋世界'], ['气候', '-', '大陆性与内陆干旱（处处离海近）'], ['群系', '-', '温带荒漠与草原'], ['文明', '+', '沿海、航海生计文明']],
      0.35: [['地理', '·', '陆地 35%，接近地球']],
      0.45: [['地理', '+', '陆地 45%，大陆世界'], ['气候', '+', '大陆性气候与内陆干旱'], ['群系', '+', '温带荒漠与草原'], ['文明', '+', '游牧生计文明']]
    },
    structure: {
      A: [['地理', '·', '3–5 个大陆核心，大多并成少数大块'], ['气候', '+', '内陆深远，大陆性与干旱'], ['群系', '+', '内陆荒漠与草原'], ['文明', '+', '游牧生计文明']],
      B: [['地理', '·', '6–8 个大陆核心，接近地球']],
      C: [['地理', '·', '9–12 个核心很少合并，另有较多微大陆'], ['气候', '+', '海洋性气候'], ['群系', '-', '内陆荒漠'], ['文明', '+', '沿海、航海生计文明']]
    },
    coast: {
      A: [['海岸', '-', '海岸平直，岛群少（约 3 组），零碎小岛少'], ['文明', '-', '沿海、航海生计文明']],
      B: [['海岸', '·', '海湾、半岛与岛弧均衡（约 12 组岛群）']],
      C: [['海岸', '+', '海岸曲折，岛链与群岛多（约 36 组）'], ['文明', '+', '沿海、航海生计文明']]
    },
    interior: {
      A: [['地形', '-', '山地被压低，平原缓丘为主'], ['群系', '+', '平坦低地上的湿地'], ['文明', '+', '连片农耕区'], ['文明', '-', '高地生计文明']],
      B: [['地形', '·', '山系、高原与盆地交错']],
      C: [['地形', '+', '崎岖多山，山地更高更多'], ['群系', '+', '高山草甸与裸岩'], ['文明', '+', '高地生计文明'], ['边界', '·', '疆域被山脊切得更碎']]
    },
    era: {
      A: [['人口', '-', '总人口 1–1.6 亿（不会超过土地承载）'], ['城市', '-', '城市人口与规模']],
      B: [['人口', '·', '总人口 2.5–4 亿（不会超过土地承载）']],
      C: [['人口', '+', '总人口 6.5–9.5 亿（不会超过土地承载）'], ['城市', '+', '城市人口与规模']]
    },
    culture: {
      A: [['文化', '-', '8 个文化圈、12 种语言、6 个宗教'], ['文化', '+', '每个文化圈覆盖范围更大']],
      B: [['文化', '·', '14 个文化圈、24 种语言、10 个宗教']],
      C: [['文化', '+', '20 个文化圈、36 种语言、16 个宗教'], ['文化', '-', '每个文化圈覆盖范围更小，语言区更细碎']]
    },
    politics: {
      A: [['政治', '-', '约 45 国，单国疆域更大'], ['边疆', '-', '部落与非国家空间约 25%']],
      B: [['政治', '·', '约 80 国；部落与非国家空间约 35%']],
      C: [['政治', '+', '约 120 国，小国更多'], ['边疆', '+', '部落与非国家空间约 45%']]
    },
    towns: {
      A: [['城镇', '-', '约 480 座城镇'], ['行政', '-', '省份数量少，单省更大'], ['交通', '-', '道路网较稀']],
      B: [['城镇', '·', '约 720 座城镇，标准行政与路网']],
      C: [['城镇', '+', '约 1080 座城镇'], ['行政', '+', '省份数量多，单省更小'], ['交通', '+', '道路网更密']]
    },
    climate: {
      A: [['温度', '·', '温偏 ±0 °C，水汽 1.0×（类地）']],
      B: [['温度', '+', '全球 +3 °C'], ['水汽', '+', '海面蒸发 ×1.1，降水增多'], ['群系', '+', '热带雨林、季雨林'], ['群系', '-', '冰盖、荒漠']],
      C: [['温度', '+', '全球 +6 °C'], ['水汽', '+', '海面蒸发 ×1.2，降水明显增多'], ['群系', '+', '热带雨林、季雨林、湿润森林'], ['群系', '-', '冰盖、苔原、荒漠'], ['文明', '+', '高纬可耕地']],
      D: [['温度', '-', '全球 −3 °C'], ['水汽', '-', '海面蒸发 ×0.9，降水减少'], ['群系', '+', '苔原、北方针叶林、荒漠与草原'], ['群系', '-', '热带雨林'], ['文明', '+', '游牧与部族生计']],
      E: [['温度', '-', '全球 −6 °C，接近冰期'], ['水汽', '-', '海面蒸发 ×0.8，降水明显减少'], ['群系', '+', '冰盖、苔原、冷荒漠'], ['群系', '-', '热带雨林'], ['文明', '-', '可耕地，人口挤向中低纬'], ['文明', '+', '游牧与部族生计']]
    },
    newWorld: {
      yes: [['地理', '·', '在旧大陆的另一面另放 1–2 个大陆，旧大陆彼此更靠拢'], ['文明', '-', '新大陆人口承载低，起源文明也较少'], ['历史', '·', '学会远洋航海前，新旧大陆互不相通；远洋航海要到前工业时代才出现']],
      no: [['地理', '·', '所有大陆同属旧世界'], ['历史', '·', '没有新旧大陆的隔绝与接触']],
      random: [['说明', '·', '按种子在有、无新大陆中各一半概率抽取']]
    },
    lakes: {
      A: [['水体', '-', '湖面约为类地的一半'], ['城市', '-', '湖滨城镇']],
      B: [['水体', '·', '湖面约占陆地 1.3–1.8%，接近地球']],
      C: [['水体', '+', '湖面约为类地的两倍，像冰川湖区'], ['城市', '+', '湖滨城镇，淡水更易得']]
    },
    age: {
      classical: [['时代', '·', '现在约第 2700–3500 年'], ['科技', '·', '上限：文字、城邑、成文法、冶铁、官僚驿传、货币'], ['科技', '-', '还没有封建契约、印刷、火药、远洋航海'], ['历史', '·', '若有新大陆，仍与旧大陆隔绝']],
      medieval: [['时代', '·', '现在约第 3500–4450 年'], ['科技', '+', '新增封建契约、经院与书院'], ['科技', '-', '还没有印刷、火药、远洋航海'], ['历史', '·', '若有新大陆，仍与旧大陆隔绝']],
      preind: [['时代', '·', '现在约第 4450–4760 年'], ['科技', '+', '新增印刷术、火药与常备军、远洋航海'], ['历史', '+', '若有新大陆，可能已被航海国家接触'], ['说明', '·', '自定义到第 4780 年后，还会出现启蒙思想、工场与蒸汽']]
    }
  };
  const hintOf = (qid, v) => (HINTS[qid] || {})[v] || null;
  const N_ = (key, label, def, min, max, step = 1) => ({ key, label, def, min, max, step });
  const CUSTOM = {
    north: [N_('areaPercent', '北极大陆占星球表面积（%）', 3.5, 0.5, 10, 0.1)],
    south: [N_('areaPercent', '南极大陆占星球表面积（%）', 3.5, 0.5, 10, 0.1)],
    star: [N_('solarConstantWm2', '辐照度（W/m²）', 1361, 800, 1800, 0.1)],
    radius: [N_('radiusKm', '星球半径（公里）', 6400, 3000, 10000)],
    day: [N_('rotationPeriodHours', '一天长度（小时）', 26, 6, 96, 0.1)],
    orbit: [N_('orbitalPeriodDays', '一年长度（世界日）', 320, 60, 1200, 0.1), N_('axialTiltDegrees', '轴倾角（°）', 18, 0, 90, 0.1)],
    moons: [N_('moonCount', '卫星数量（无主星环）', 3, 0, 8)],
    plates: [N_('plateCount', '板块数量', 14, 4, 32), N_('tectonicActivity', '构造活动程度', 0.34, 0, 1, 0.01)],
    land: [N_('landPercent', '陆地占比（%）', 35, 18, 55, 0.1)],
    structure: [N_('continentCount', '大陆核心数量', 7, 3, 12)],
    culture: [N_('civilizationCount', '文化圈数量', 14, 1, 40), N_('languageCount', '语言数量', 24, 1, 80), N_('religionCount', '宗教数量', 10, 1, 40)],
    politics: [N_('stateCount', '国家数量', 80, 1, 240), N_('frontierPercent', '部落与非国家空间（%）', 35, 0, 90, 0.1)],
    age: [N_('year', '文明纪元年份（1800–4840；4780 年后进入早期工业，4840 年约相当于维多利亚前期的 1840 年）', 4700, 1800, 4840)]
  };
  const PAGES = [
    { t: '星球与恒星', q: [0, 1, 2, 3, 4] },
    { t: '运转与卫星', q: [5, 6, 7] },
    { t: '地质与大陆', q: [8, 9, 10, 11, 12] },
    { t: '文明', q: [20, 13, 14, 15, 16] },
    { t: '气候、水体与新大陆', q: [17, 19, 18], final: true }
  ];
  const CLIMATE = { A: [0, 1], B: [3, 1.1], C: [6, 1.2], D: [-3, 0.9], E: [-6, 0.8] };
  const ERA_RANGE = [[1, 1.6], [2.5, 4], [6.5, 9.5]]; // 人口范围（亿）
  const AGE = { classical: [2700, 3500], medieval: [3500, 4450], preind: [4450, 4760] }; // 文明纪元：现实世界约 4700 年为前工业
  const AGE_MAX = 4840, AGE_MIN = 1800, INDUSTRIAL_FROM = 4780;
  const ageLabel = y => y >= INDUSTRIAL_FROM ? '早期工业时代' : y >= 4450 ? '前工业时代' : y >= 3500 ? '中世纪' : y >= 2500 ? '古典时代' : '青铜时代';

  function defaults() {
    const a = {}; for (const q of Q) a[q.id] = q.d;
    return {
      a, seed: (Math.random() * 1e9) | 0, res: null,
      popMode: 'env', popLo: null, popHi: null,
      townsCustom: false, townsN: 720, admin: 1, transport: 1,
      climateCustom: false, tempBias: 0, moisture: 1, custom: {}
    };
  }
  // 版本：世界文件记录写出它的版本；读到旧版本时按其中的设置迁移，再用当前版本重新推演
  const VERSION = '1.4.2';
  const verOf = f => f && f.engineVersion ? String(f.engineVersion) : (/(\d+\.\d+\.\d+)/.exec(f && f.engine || '') || [, '1.4.0'])[1];
  const verCmp = (a, b) => { const pa = String(a).split('.').map(n => parseInt(n, 10) || 0), pb = String(b).split('.').map(n => parseInt(n, 10) || 0); for (let k = 0; k < 3; k++) { const d = (pa[k] || 0) - (pb[k] || 0); if (d) return d; } return 0; };
  // 旧存档 / 旧世界文件的设置补齐到当前版本：缺失或已不存在的选项取默认值（种子、自定义、文化与宗教库快照原样保留）
  function migrate(old) {
    const o = JSON.parse(JSON.stringify(old || {})), oa = o.a || {}, st = Object.assign(defaults(), o), changes = [];
    st.a = {};
    for (const q of Q) {
      const v = oa[q.id];
      if (q.o.some(x => x[0] === v)) st.a[q.id] = v;
      else { st.a[q.id] = q.d; changes.push(q.t + (v === undefined ? '（新增，取默认）' : '（旧选项已调整，取默认）')); }
    }
    if (!('seed' in o)) changes.push('种子（缺失，已随机）');
    if (!('age' in oa) && st.a.era === 'C' && !(st.custom && st.custom.age)) { st.custom = st.custom || {}; st.custom.age = { on: true, v: { year: 4800 } }; } // 与旧链接同规则：“早期工业”档落在第 4800 年
    return { st, changes };
  }
  function randomize(st) {
    const r = Math.random;
    for (const q of Q) st.a[q.id] = q.o[(r() * q.o.length) | 0][0];
    st.seed = (r() * 1e9) | 0;
    st.townsCustom = false; st.climateCustom = false; st.popMode = 'env'; st.custom = {};
    return st;
  }
  function toCfg(st) {
    const a = st.a, rnd = mulberry(st.seed ^ 0x5bd1e995);
    const idx = (id) => ({ A: 0, B: 1, C: 2, D: 3, E: 4 })[a[id]];
    const era = idx('era');
    const tw = idx('towns');
    const cl = CLIMATE[a.climate];
    let W = 0, H = 0;
    const orbit = { A: [360, 12], B: [320, 18], C: [420, 28] }[a.orbit];
    const cult = { A: [8, 12, 6], B: [14, 24, 10], C: [20, 36, 16] }[a.culture];
    const pol = { A: [45, 0.25], B: [80, 0.35], C: [120, 0.45] }[a.politics];
    const range = ERA_RANGE[era];
    let popRange = null;
    if (st.popMode === 'range') {
      const lo = Math.max(range[0], Math.min(range[1], +st.popLo || range[0])), hi = Math.max(lo, Math.min(range[1], +st.popHi || range[1]));
      popRange = [lo * 1e8, hi * 1e8];
    }
    const cu = (q, k) => { const o = st.custom && st.custom[q]; return o && o.on && o.v && o.v[k] !== undefined && o.v[k] !== '' && isFinite(+o.v[k]) ? +o.v[k] : undefined; };
    const pick = (v, d) => v === undefined ? d : v;
    const moonCount = cu('moons', 'moonCount');
    const out = {
      seed: st.seed, W, H,
      northPole: a.north, southPole: a.south,
      flux: +a.star, radius: +a.radius, day: +a.day,
      retro: a.spin === 'retro' || (a.spin === 'random' && rnd() < 0.5),
      yearDays: orbit[0], tilt: orbit[1], moons: a.moons,
      plates: +a.plates, activity: { 8: 0.78, 14: 1, 20: 1.25 }[a.plates],
      land: +a.land, cores: { A: [3, 5], B: [6, 8], C: [9, 12] }[a.structure], coreSpread: { A: 62, B: 100, C: 160 }[a.structure],
      coast: idx('coast'), interior: idx('interior'), structIdx: idx('structure'),
      era, popIdx: era, popMode: st.popMode, popRange,
      cultures: cult[0], languages: cult[1], religions: cult[2],
      countries: pol[0], tribal: pol[1],
      towns: st.townsCustom ? Math.max(100, Math.min(2000, +st.townsN || 720)) : [480, 720, 1080][tw],
      admin: st.townsCustom ? +st.admin : tw, transport: st.townsCustom ? +st.transport : tw,
      tempBias: st.climateCustom ? +st.tempBias : cl[0], moisture: st.climateCustom ? +st.moisture : cl[1],
      lakeFactor: { A: 0.45, B: 1, C: 2.2 }[a.lakes || 'B'],
      newWorld: a.newWorld === 'yes' ? true : a.newWorld === 'no' ? false : 'random'
    };
    // 文化库快照（所选内置库 id + 自定义库内容）
    if (st.libs) { out.cultureSelection = st.libs.ids; out.customLibraries = st.libs.custom || []; }
    if (st.rlibs) { out.religionSelection = st.rlibs.ids; out.customReligions = st.rlibs.custom || []; } // 宗教库快照
    // 自定义数值覆盖（与原版问卷的“自定义”字段一致）
    out.polarArea = { N: cu('north', 'areaPercent'), S: cu('south', 'areaPercent') };
    out.flux = pick(cu('star', 'solarConstantWm2'), out.flux); out.radius = pick(cu('radius', 'radiusKm'), out.radius);
    // 网格精度由星球大小决定：每格约 18.5 km（与原版类地星球 2176 格一致），宽度取 544 的整数倍
    out.W = st.res || gridFor(out.radius); out.H = out.W / 2; out.day = pick(cu('day', 'rotationPeriodHours'), out.day);
    out.yearDays = pick(cu('orbit', 'orbitalPeriodDays'), out.yearDays); out.tilt = pick(cu('orbit', 'axialTiltDegrees'), out.tilt);
    if (a.moons !== 'ring') { out.moonCount = moonCount; if (moonCount !== undefined) out.moons = moonCount === 0 ? 'none' : moonCount === 1 ? 'one' : 'many'; }
    const pc = cu('plates', 'plateCount'), act = cu('plates', 'tectonicActivity'); if (pc) out.plates = Math.round(pc); if (act !== undefined) out.activity = 0.55 + 1.3 * act;
    const lp = cu('land', 'landPercent'); if (lp) out.land = lp / 100;
    const cc = cu('structure', 'continentCount'); if (cc) out.cores = [Math.round(cc), Math.round(cc)];
    const cv = cu('culture', 'civilizationCount'), lv = cu('culture', 'languageCount'), rv = cu('culture', 'religionCount'); if (cv) out.cultures = Math.round(cv); if (lv) out.languages = Math.round(lv); if (rv) out.religions = Math.round(rv);
    const sc = cu('politics', 'stateCount'), fp = cu('politics', 'frontierPercent'); if (sc) out.countries = Math.round(sc); if (fp !== undefined) out.tribal = fp / 100;
    // 文明时代：自定义年份优先；否则在所选时代的范围内按种子随机（结束年份不取整）
    { let y = cu('age', 'year'); if (y === undefined) { const r2 = mulberry(st.seed ^ 0x2545f491), rg = AGE[a.age] || AGE.preind; y = rg[0] + r2() * (rg[1] - rg[0]); }
      out.endYear = Math.round(Math.max(AGE_MIN, Math.min(AGE_MAX, y))); out.era = out.endYear >= INDUSTRIAL_FROM ? 2 : 1; out.ageLabel = ageLabel(out.endYear); }
    return out;
  }
  function gridFor(radiusKm) { const k = Math.round(2 * Math.PI * radiusKm / 18.48 / 544); return 544 * Math.max(2, Math.min(5, k)); }
  function gridOf(st) { const r = st.custom && st.custom.radius && st.custom.radius.on && isFinite(+st.custom.radius.v.radiusKm) ? +st.custom.radius.v.radiusKm : +st.a.radius; const W = st.res || gridFor(r); return { W, H: W / 2, km: 2 * Math.PI * r / W }; }
  function mulberry(a) { return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  // URL：#w=<答案串>&s=<种子>&r=<分辨率>&x=<附加>
  function encode(st) {
    let ans = Q.map(q => q.o.findIndex(o => o[0] === st.a[q.id])).join('');
    if (!st.a.age || st.a.age === 'preind') { ans = ans.slice(0, 20); if (st.a.lakes === 'B' || !st.a.lakes) ans = ans.slice(0, 19); } // 末尾为默认时保持旧链接与旧存档的键不变
    const cj = Object.entries(st.custom || {}).filter(([, o]) => o.on).map(([q, o]) => q + ':' + Object.entries(o.v || {}).map(([k, v]) => k + '=' + v).join(',')).join(';');
    const x = [cj ? 'u' + encodeURIComponent(cj) : '', st.popMode === 'range' ? `p${st.popLo}-${st.popHi}` : '', st.townsCustom ? `t${st.townsN}-${st.admin}-${st.transport}` : '', st.climateCustom ? `c${st.tempBias}_${st.moisture}` : ''].filter(Boolean).join('~');
    const q = new URLSearchParams({ w: ans, s: st.seed }); if (st.res) q.set('r', st.res);
    if (x) q.set('x', x);
    if (st.libs && st.libs.ids) q.set('l', st.libs.ids.join('.'));
    if (st.rlibs && st.rlibs.ids) q.set('rl', st.rlibs.ids.join('.'));
    return q.toString();
  }
  function decode(hash) {
    const q = new URLSearchParams(hash.replace(/^#/, ''));
    if (!q.get('w') || !q.get('s')) return null;
    const st = defaults(), ans = q.get('w');
    Q.forEach((qq, i) => { const k = +ans[i]; if (qq.o[k]) st.a[qq.id] = qq.o[k][0]; });
    const oldIndustrial = ans.length < 21 && st.a.era === 'C'; // 旧存档：“早期工业”档落在第 4800 年
    st.seed = +q.get('s') | 0;
    const r = +q.get('r'); if ([1088, 1632, 2176, 2720].includes(r)) st.res = r; // 旧存档沿用原网格
    if (q.get('l')) st.libs = { ids: q.get('l').split('.').filter(Boolean), custom: [] };
    if (q.get('rl')) st.rlibs = { ids: q.get('rl').split('.').filter(Boolean), custom: [] };
    for (const part of (q.get('x') || '').split('~')) {
      if (part[0] === 'u') { st.custom = {}; for (const seg of decodeURIComponent(part.slice(1)).split(';')) { const [q, kv] = seg.split(':'); if (!q) continue; const v = {}; (kv || '').split(',').forEach(p => { const [k, val] = p.split('='); if (k) v[k] = +val; }); st.custom[q] = { on: true, v }; } }
      if (part[0] === 'p') { const [lo, hi] = part.slice(1).split('-'); st.popMode = 'range'; st.popLo = +lo; st.popHi = +hi; }
      if (part[0] === 't') { const [n, ad, tr] = part.slice(1).split('-'); st.townsCustom = true; st.townsN = +n; st.admin = +ad; st.transport = +tr; }
      if (part[0] === 'c') { const [tb, mo] = part.slice(1).split('_'); st.climateCustom = true; st.tempBias = +tb; st.moisture = +mo; }
    }
    if (oldIndustrial && !(st.custom && st.custom.age)) { st.custom = st.custom || {}; st.custom.age = { on: true, v: { year: 4800 } }; }
    return st;
  }
  G.Config = { Q, PAGES, CUSTOM, HINTS, hintOf, VERSION, verOf, verCmp, migrate, defaults, randomize, toCfg, encode, decode, ERA_RANGE, AGE, ageLabel, CLIMATE, gridFor, gridOf };
})(window);
