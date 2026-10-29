/* 文化库扩展：人名与世系、君主称谓、政府组织、起义名号、地名后缀、更多政体称号。
 * 内置的 32 个文化库按文化渊源归入“族系”，族系提供默认值；每个库可在 lib.x 里覆盖任一项（自定义库同理）。
 * 政府组织的风格（gov.style）会影响历史推演：官僚制较能维系大国，封建制多附庸，部族制易分裂，商贸型善航海，神庙型易成神权。 */
(function (G) {
  'use strict';
  const ORG_KEYS = ['chief', 'city', 'king', 'empire', 'feudal', 'central', 'nomad', 'republic', 'theo', 'vassal', 'colony', 'rebel'];
  const F = {
    sinitic: { label: '华夏', regnal: 'temple', house: '{s}氏',
      people: { surnames: ['刘', '李', '赵', '杨', '陈', '曹', '司马', '萧', '高', '宇文', '朱', '郭', '柴', '孙', '周', '吴', '韩', '魏', '苏', '宋', '姚', '慕容'], given: ['衍', '昭', '晟', '煜', '恒', '隆', '昶', '瑾', '澄', '昱', '翊', '延', '承', '坚', '业', '弘', '嗣', '广', '渊', '绪', '璟', '彻', '询', '奭', '骜', '炎', '睿', '纬', '湛', '琮'], twoChar: 0.4 },
      ruler: { chief: '首领', city: '君', king: '王', empire: '皇帝', nomad: '单于', republic: '执政', vassal: '王', colony: '都护', rebel: '大元帅' },
      gov: { style: 'bureaucratic', minister: '丞相', org: { chief: '部落议事', city: '国人会议与卿士', king: '世卿世禄的卿大夫', empire: '三公九卿与郡县', feudal: '分封诸侯与门阀世家', central: '三省六部与科举官僚', nomad: '左右贤王与部族会盟', republic: '共和执政与议院', theo: '天师治民与祭酒', vassal: '藩王府与王国相', colony: '都护府', rebel: '义军大帐与军师' } },
      rebel: { style: 'symbol', fmt: '{sym}军', symbols: ['赤眉', '黄巾', '绿林', '白莲', '红巾', '青犊', '铜马', '黑山', '白波', '赤旗', '青巾', '黄旗'] },
      places: { port: ['津', '港', '浦', '渡'], fort: ['关', '堡', '寨', '镇'], pass: ['关', '隘', '口'] },
      titles: { vassal: '王国', colony: '都护府' } },
    japanese: { label: '日本', regnal: 'plain', house: '{s}氏',
      people: { surnames: ['源', '平', '藤原', '橘', '足利', '北条', '织田', '德川', '武田', '上杉', '毛利', '大内', '岛津', '伊达'], given: ['赖朝', '义经', '尊氏', '信长', '家康', '义满', '时宗', '政宗', '信玄', '谦信', '秀吉', '元就', '义政', '清盛', '道长', '赖光'] },
      ruler: { chief: '大人', city: '王', king: '大王', empire: '天皇', nomad: '首领', republic: '执政', vassal: '大名', colony: '奉行', rebel: '大将' },
      gov: { style: 'feudal', minister: '关白', org: { chief: '氏族长老', city: '豪族合议', king: '氏姓制度与大王', empire: '律令制与太政官', feudal: '幕府与守护大名', central: '幕藩体制', nomad: '部族合议', republic: '合议执政', theo: '神宫祭政', vassal: '大名领国', colony: '奉行所', rebel: '一揆众议' } },
      rebel: { style: 'symbol', fmt: '{sym}一揆', symbols: ['一向', '法华', '土', '国人', '山城', '白旗', '德政', '加贺'] },
      places: { port: ['津', '湊', '港'], fort: ['城', '砦', '馆'], pass: ['关', '越'] },
      titles: { vassal: '国', colony: '奉行所' } },
    korean: { label: '朝鲜', regnal: 'temple', house: '{s}氏',
      people: { surnames: ['王', '李', '金', '朴', '崔', '郑', '高', '姜', '尹', '洪', '柳', '徐'], given: ['建', '桂', '芳', '远', '祹', '琇', '昉', '顼', '琠', '昖', '倧', '焞', '昑', '玜', '勋', '昌'], twoChar: 0.3 },
      ruler: { chief: '渠帅', city: '君', king: '王', empire: '皇帝', nomad: '可汗', republic: '执政', vassal: '君', colony: '都护', rebel: '大将' },
      gov: { style: 'bureaucratic', minister: '领议政', org: { chief: '部族会议', city: '和白会议', king: '骨品制与和白', empire: '三省六部', feudal: '豪族割据', central: '议政府与六曹', nomad: '部族会盟', republic: '议政院', theo: '神宫祭政', vassal: '藩国王府', colony: '都护府', rebel: '义兵大帐' } },
      rebel: { style: 'symbol', fmt: '{sym}军', symbols: ['东学', '万积', '明火', '活贫', '壬戌', '红巾', '洪景来', '白衣'] },
      places: { port: ['浦', '津', '港'], fort: ['山城', '城', '镇'], pass: ['岭', '关'] },
      titles: { vassal: '国', colony: '都护府' } },
    germanic: { label: '日耳曼', regnal: 'number', house: '{s}家族',
      people: { surnames: ['加洛林', '奥托', '萨利安', '霍亨施陶芬', '哈布斯堡', '维特尔斯巴赫', '卢森堡', '韦尔夫', '霍亨索伦', '韦廷', '拿骚', '奥尔登堡', '阿斯坎尼', '巴本贝格'], given: ['卡尔', '奥托', '海因里希', '康拉德', '腓特烈', '路德维希', '鲁道夫', '阿尔布雷希特', '威廉', '马克西米利安', '西吉斯蒙德', '洛塔尔', '利奥波德', '约翰', '恩斯特', '阿道夫'] },
      ruler: { chief: '酋长', city: '市长', king: '国王', empire: '皇帝', nomad: '首领', republic: '执政', vassal: '公爵', colony: '总督', rebel: '首领' },
      gov: { style: 'feudal', minister: '宫相', org: { chief: '部族大会（庭）', city: '市议会与行会', king: '王室宫廷与伯爵', empire: '帝国议会与选帝侯', feudal: '采邑封建与诸侯', central: '枢密院与常备官僚', nomad: '部族大会', republic: '议会与执政', theo: '主教座堂与教会领地', vassal: '公爵宫廷', colony: '总督府', rebel: '农民联盟' } },
      rebel: { style: 'place', fmt: '{place}农民军', symbols: ['鞋会', '穷康拉德', '黑军', '农民联盟'] },
      places: { port: ['港', '湾'], fort: ['堡', '要塞'], pass: ['山口', '关'] },
      titles: { vassal: '公国', colony: '殖民地', theocracy: '主教国' } },
    latin: { label: '古典拉丁', regnal: 'plain', house: '{s}王朝',
      people: { surnames: ['尤利乌斯', '克劳狄乌斯', '弗拉维乌斯', '安敦宁', '塞维鲁', '君士坦丁', '瓦伦提尼安', '狄奥多西', '科尔内利乌斯', '法比乌斯'], given: ['盖乌斯', '马库斯', '提比略', '卢基乌斯', '昆图斯', '普布利乌斯', '格奈乌斯', '奥卢斯', '塞克斯图斯', '提图斯', '德奇姆斯', '阿庇乌斯'] },
      ruler: { chief: '首领', city: '执政官', king: '王', empire: '皇帝', nomad: '首领', republic: '执政官', vassal: '附庸王', colony: '行省总督', rebel: '统帅' },
      gov: { style: 'bureaucratic', minister: '近卫军长官', org: { chief: '氏族会议', city: '公民大会与元老', king: '王政与元老院', empire: '元首制与行省总督', feudal: '庄园与军区', central: '专制君主与官僚', nomad: '部族会议', republic: '元老院与执政官', theo: '大祭司团', vassal: '附庸王廷', colony: '行省总督府', rebel: '起义军营' } },
      rebel: { style: 'place', fmt: '{place}起义军', symbols: ['斯巴达克', '角斗士', '奴隶', '同盟者'] },
      places: { port: ['港'], fort: ['堡', '营'], pass: ['关', '山口'] },
      titles: { vassal: '王国', colony: '行省' } },
    romance: { label: '罗曼', regnal: 'number', house: '{s}家族',
      people: { surnames: ['卡佩', '瓦卢瓦', '波旁', '安茹', '金雀花', '萨伏依', '美第奇', '斯福尔扎', '埃斯特', '阿拉贡', '特拉斯塔马拉', '贡扎加'], given: ['路易', '腓力', '查理', '亨利', '弗朗索瓦', '让', '罗贝尔', '阿方索', '费尔南多', '佩德罗', '洛伦佐', '科西莫', '乔万尼', '海梅'] },
      ruler: { chief: '首领', city: '总督', king: '国王', empire: '皇帝', nomad: '首领', republic: '总督', vassal: '公爵', colony: '总督', rebel: '首领' },
      gov: { style: 'feudal', minister: '宰相', org: { chief: '部族会议', city: '公社与执政官', king: '王廷与伯爵', empire: '帝国宫廷与公爵', feudal: '封建领主与三级会议', central: '御前会议与总督制', nomad: '部族会议', republic: '大议会与总督', theo: '教廷与枢机团', vassal: '公爵宫廷', colony: '总督府', rebel: '起义公社' } },
      rebel: { style: 'symbol', fmt: '{sym}起义军', symbols: ['扎克雷', '梳毛工', '红帽', '公社', '图钦', '赤脚'] },
      places: { port: ['港', '湾'], fort: ['堡', '要塞'], pass: ['山口'] },
      titles: { vassal: '公国', colony: '总督区', theocracy: '教皇国' } },
    slavic: { label: '斯拉夫', regnal: 'number', house: '{s}家族',
      people: { surnames: ['留里克', '皮雅斯特', '普热米斯尔', '雅盖隆', '罗曼诺夫', '内马尼亚', '阿尔帕德', '戈杜诺夫', '舒伊斯基'], given: ['弗拉基米尔', '雅罗斯拉夫', '斯维亚托斯拉夫', '波列斯瓦夫', '卡齐米日', '瓦茨拉夫', '奥托卡', '伊凡', '瓦西里', '德米特里', '斯捷潘', '米哈伊尔', '鲍里斯', '尤里'] },
      ruler: { chief: '族长', city: '公', king: '国王', empire: '沙皇', nomad: '首领', republic: '市长', vassal: '大公', colony: '总督', rebel: '首领' },
      gov: { style: 'feudal', minister: '大贵族', org: { chief: '族长会议', city: '市民大会（韦切）', king: '王公与波雅尔', empire: '沙皇与贵族杜马', feudal: '王公分封与波雅尔杜马', central: '沙皇专制与衙门', nomad: '部族会议', republic: '韦切与市长', theo: '都主教府', vassal: '大公宫廷', colony: '总督府', rebel: '哥萨克大会' } },
      rebel: { style: 'symbol', fmt: '{sym}起义军', symbols: ['哥萨克', '农奴', '顿河', '伏尔加', '射击军', '老信徒'] },
      places: { port: ['港'], fort: ['堡', '城', '要塞'], pass: ['山口'] },
      titles: { vassal: '大公国', colony: '总督区' } },
    steppe: { label: '草原', regnal: 'plain', house: '{s}氏',
      people: { surnames: ['阿史那', '孛儿只斤', '耶律', '完颜', '拓跋', '乞颜', '札剌亦儿', '克烈', '斡亦剌', '挛鞮', '药罗葛', '绰罗斯'], given: ['铁木真', '阿骨打', '阿保机', '冒顿', '也先', '俺答', '脱欢', '忽必烈', '拔都', '窝阔台', '蒙哥', '土门', '室点密', '颉利', '骨力裴罗', '达延'] },
      ruler: { chief: '首领', city: '伯克', king: '汗', empire: '大汗', nomad: '可汗', republic: '议长', vassal: '汗', colony: '达鲁花赤', rebel: '首领' },
      gov: { style: 'tribal', minister: '大那颜', org: { chief: '氏族议事', city: '伯克与商队首领', king: '汗廷与千户', empire: '大汗廷与行省', feudal: '兀鲁思分封', central: '中书省与达鲁花赤', nomad: '库里台大会与万户', republic: '部族议会', theo: '大萨满与汗廷', vassal: '汗帐', colony: '达鲁花赤', rebel: '部众大帐' } },
      rebel: { style: 'symbol', fmt: '{sym}部众', symbols: ['青旗', '白旗', '苍狼', '鹰旗', '黑帐', '红缨'] },
      places: { port: ['渡'], fort: ['城', '营', '寨'], pass: ['口', '达坂'] },
      titles: { vassal: '汗国', colony: '达鲁花赤辖地' } },
    persian: { label: '伊朗', regnal: 'number', house: '{s}王朝',
      people: { surnames: ['阿契美尼德', '安息', '萨珊', '萨法维', '塞尔柱', '伽色尼', '白益', '萨曼', '恺加', '阿夫沙尔'], given: ['居鲁士', '大流士', '薛西斯', '沙普尔', '霍斯劳', '阿尔达希尔', '伊斯迈尔', '阿拔斯', '纳迪尔', '卡瓦德', '巴赫拉姆', '米特拉达梯', '塔赫马斯普', '亚兹德'] },
      ruler: { chief: '族长', city: '总督', king: '沙阿', empire: '万王之王', nomad: '汗', republic: '议长', vassal: '萨特拉普', colony: '总督', rebel: '首领' },
      gov: { style: 'bureaucratic', minister: '维齐尔', org: { chief: '部族会议', city: '城市长老', king: '王廷与七大家族', empire: '萨特拉普行省制', feudal: '伊克塔封地', central: '维齐尔与迪万', nomad: '部族会议', republic: '议会', theo: '大祭司团', vassal: '萨特拉普辖地', colony: '总督府', rebel: '起义军营' } },
      rebel: { style: 'symbol', fmt: '{sym}军', symbols: ['马兹达克', '黑衣', '红头', '白衣', '红旗', '赤足'] },
      places: { port: ['港', '班达尔'], fort: ['堡', '卡拉'], pass: ['山口'] },
      titles: { vassal: '萨特拉普辖地', colony: '总督区' } },
    arabic: { label: '阿拉伯', regnal: 'plain', house: '{s}王朝',
      people: { surnames: ['倭马亚', '阿拔斯', '法蒂玛', '阿尤布', '哈希姆', '拉苏勒', '布赛义德', '图伦', '伊德里斯', '哈夫斯'], given: ['穆阿维叶', '哈伦', '曼苏尔', '萨拉丁', '拜伯尔斯', '阿卜杜拉', '奥马尔', '阿里', '哈桑', '优素福', '苏莱曼', '易卜拉欣', '马立克', '叶齐德'] },
      ruler: { chief: '谢赫', city: '埃米尔', king: '苏丹', empire: '大苏丹', nomad: '谢赫', republic: '议长', vassal: '埃米尔', colony: '瓦利', rebel: '首领' },
      gov: { style: 'bureaucratic', minister: '维齐尔', org: { chief: '部落谢赫会议', city: '埃米尔与商人会议', king: '苏丹宫廷与维齐尔', empire: '迪万与行省瓦利', feudal: '伊克塔封地', central: '迪万与常备奴隶军', nomad: '部落联盟会议', republic: '舒拉会议', theo: '乌理玛与伊玛目', vassal: '埃米尔府', colony: '瓦利辖地', rebel: '起义军营' } },
      rebel: { style: 'symbol', fmt: '{sym}军', symbols: ['黑旗', '赞吉', '卡尔马特', '绿旗', '白衣', '沙漠'] },
      places: { port: ['港', '米纳'], fort: ['堡', '卡斯尔'], pass: ['山口'] },
      titles: { vassal: '埃米尔国', colony: '瓦利辖地' } },
    indic: { label: '印度', regnal: 'plain', house: '{s}王朝',
      people: { surnames: ['孔雀', '笈多', '难陀', '朱罗', '帕拉', '遮娄其', '帕拉瓦', '拉什特拉库塔', '毗奢耶那伽罗'], given: ['旃陀罗笈多', '阿育', '沙摩陀罗', '迦腻色迦', '戒日', '拉金德拉', '毗湿奴伐弹那', '鸠摩罗', '室建陀', '达摩波罗', '普拉凯辛', '克里希纳提婆'] },
      ruler: { chief: '罗阇', city: '罗阇', king: '摩诃罗阇', empire: '众王之王', nomad: '首领', republic: '议事长', vassal: '罗阇', colony: '总督', rebel: '首领' },
      gov: { style: 'temple', minister: '宰辅', org: { chief: '村社长老', city: '伽那僧伽（共和议会）', king: '王廷与婆罗门顾问', empire: '行省总督与大臣会议', feudal: '萨曼塔封臣', central: '曼萨卜官制', nomad: '部族会议', republic: '伽那议会', theo: '神庙祭司团', vassal: '萨曼塔领', colony: '总督府', rebel: '起义军营' } },
      rebel: { style: 'symbol', fmt: '{sym}起义军', symbols: ['苦行者', '桑尼亚西', '比尔', '山民', '纳拉', '贡德'] },
      places: { port: ['港', '帕塔纳'], fort: ['堡', '杜尔加'], pass: ['山口'] },
      titles: { vassal: '土邦', colony: '总督区' } },
    malay: { label: '南岛', regnal: 'plain', house: '{s}王朝',
      people: { surnames: ['夏连特拉', '桑阇耶', '拉惹沙', '伊沙纳', '马打兰', '谏义里'], given: ['巴拉普特拉', '哈奄武禄', '拉登威查耶', '巴拉米苏拉', '曼苏尔', '穆扎法尔', '阿拉乌丁', '甘达', '布拉威查耶', '格尔达纳加拉'] },
      ruler: { chief: '拿督', city: '罗阇', king: '摩诃罗阇', empire: '众岛之王', nomad: '首领', republic: '港主', vassal: '罗阇', colony: '总督', rebel: '首领' },
      gov: { style: 'mercantile', minister: '盘陀诃罗', org: { chief: '村社长老', city: '港主与商会', king: '王廷与港务长', empire: '朝贡港邦网络', feudal: '属邦朝贡', central: '宫廷与港务官', nomad: '部族会议', republic: '港邦商会', theo: '神庙祭司', vassal: '属邦王廷', colony: '商馆总督', rebel: '起义军营' } },
      rebel: { style: 'place', fmt: '{place}起义军', symbols: [] },
      places: { port: ['港', '湾', '浦'], fort: ['堡', '寨'], pass: ['山口'] },
      titles: { vassal: '属邦', colony: '商馆领' } },
    celtic: { label: '凯尔特', regnal: 'number', house: '{s}家族',
      people: { surnames: ['阿伯弗劳', '迪内弗', '奥尼尔', '奥布莱恩', '麦克唐纳', '斯图亚特', '坎莫尔', '都铎', '麦克默罗'], given: ['罗德里', '卢埃林', '欧文', '布莱恩', '康纳', '尼尔', '肯尼思', '马尔科姆', '邓肯', '罗伯特', '大卫', '卡德瓦拉德', '格鲁菲兹'] },
      ruler: { chief: '族长', city: '领主', king: '国王', empire: '高王', nomad: '族长', republic: '议长', vassal: '领主', colony: '总督', rebel: '首领' },
      gov: { style: 'tribal', minister: '王室总管', org: { chief: '氏族与布雷恩法官', city: '领主会议', king: '王与氏族议会', empire: '高王与诸王会盟', feudal: '领主与氏族', central: '王室议会', nomad: '氏族会议', republic: '议会', theo: '德鲁伊会议', vassal: '领主府', colony: '总督府', rebel: '氏族起事' } },
      rebel: { style: 'symbol', fmt: '{sym}起义军', symbols: ['高地', '氏族', '荒原', '绿林', '盟约', '白玫瑰'] },
      places: { port: ['港', '湾'], fort: ['堡', '要塞'], pass: ['山口'] },
      titles: { vassal: '领地', colony: '殖民地' } },
    finnic: { label: '芬乌', regnal: 'number', house: '{s}家族',
      people: { surnames: ['卡勒瓦', '卡累利', '汉密', '萨沃', '塔瓦斯', '尤格拉'], given: ['卡勒沃', '伊尔马里宁', '莱明凯宁', '乌科', '阿赫托', '塔皮奥', '库勒沃', '萨缪', '维克', '阿尔沃'] },
      ruler: { chief: '长老', city: '首领', king: '国王', empire: '大王', nomad: '首领', republic: '议长', vassal: '领主', colony: '总督', rebel: '首领' },
      gov: { style: 'tribal', minister: '长老', org: { chief: '长老议事会', city: '村社大会', king: '王与部族会议', empire: '大王与诸部会盟', feudal: '领主与部族', central: '王室议会', nomad: '部族会议', republic: '议会', theo: '萨满会', vassal: '领主府', colony: '总督府', rebel: '起事部众' } },
      rebel: { style: 'place', fmt: '{place}起义军', symbols: [] },
      places: { port: ['港'], fort: ['堡'], pass: ['山口'] }, titles: { vassal: '领地', colony: '殖民地' } },
    arctic: { label: '极北原住民', regnal: 'plain', house: '{s}一族',
      people: { surnames: ['纳努克', '阿基克', '乌米克', '西库', '卡纳克', '图卢', '皮塔', '伊努'], given: ['纳努克', '阿基克', '乌米克', '西库', '卡纳克', '图卢', '伊克', '皮塔', '阿玛鲁', '基纳', '塔基', '乌卢'] },
      ruler: { chief: '长老', city: '首领', king: '大首领', empire: '至高首领', nomad: '首领', republic: '议长', vassal: '首领', colony: '总督', rebel: '首领' },
      gov: { style: 'tribal', minister: '萨满', org: { chief: '长老会与萨满', city: '营地议事', king: '大首领与长老会', empire: '诸部联盟大会', feudal: '诸部联盟', central: '大首领议事会', nomad: '营地议事', republic: '部族议会', theo: '萨满议事', vassal: '附属部族', colony: '贸易站总督', rebel: '起事部众' } },
      rebel: { style: 'place', fmt: '{place}起义', symbols: [] },
      places: { port: ['湾'], fort: ['营'], pass: ['口'] }, titles: { vassal: '部', colony: '贸易站' } }
  };
  const FAMILY_OF = {
    'realistic-00': 'sinitic', 'historical-chinese': 'sinitic', 'fantasy-eastern-dynastic': 'sinitic', 'fantasy-eastern-riverlands': 'sinitic', 'fantasy-eastern-highlands': 'sinitic',
    'fantasy-astral': 'sinitic', 'fantasy-sylvan': 'sinitic', 'fantasy-elder': 'sinitic',
    'realistic-japanese': 'japanese', 'realistic-korean': 'korean',
    'realistic-01': 'germanic', 'fantasy-insular-shires': 'germanic', 'fantasy-mountain-citadels': 'germanic', 'fantasy-northern-fjords': 'germanic',
    'realistic-02': 'romance', 'fantasy-romance-marches': 'romance', 'historical-latin': 'latin',
    'realistic-03': 'slavic', 'realistic-04': 'steppe', 'fantasy-eastern-steppe': 'steppe', 'realistic-05': 'persian',
    'realistic-06': 'arabic', 'fantasy-caravan-sultanates': 'arabic', 'realistic-11': 'arabic', 'realistic-07': 'indic',
    'realistic-08': 'malay', 'fantasy-island-leagues': 'malay', 'realistic-09': 'celtic', 'historical-gaelic': 'celtic', 'realistic-10': 'finnic',
    'realistic-new-world-arctic': 'arctic', 'fantasy-new-world-arctic': 'arctic'
  };
  const CAT_FAMILY = { agrarian: 'sinitic', pastoral: 'steppe', maritime: 'malay', highland: 'celtic', tribal: 'finnic', 'new-world': 'arctic' };
  const clone = o => JSON.parse(JSON.stringify(o));
  // 合并：lib.x 覆盖族系默认（对象逐层合并，数组整体替换）
  function merge(a, b) { if (!b) return a; for (const k of Object.keys(b)) { const v = b[k]; if (v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object' && !Array.isArray(a[k])) merge(a[k], v); else if (v !== undefined && v !== '' && !(Array.isArray(v) && !v.length)) a[k] = v; } return a; }
  function ext(lib) {
    if (!lib) return clone(F.sinitic);
    if (lib._x) return lib._x;
    const fam = (lib.x && lib.x.family) || FAMILY_OF[lib.id] || CAT_FAMILY[lib.cat] || 'sinitic';
    const x = clone(F[fam] || F.sinitic); x.family = fam;
    // 架空的华夏系库：姓氏取库里的单字词根，人名风格随库
    if (lib.mode === 'fantasy' && fam === 'sinitic' && lib.c && lib.c.roots) { const one = lib.c.roots.filter(r => r.length === 1); if (one.length >= 8) x.people.surnames = one.slice(0, 30); }
    merge(x, lib.x ? clone(lib.x) : null);
    try { Object.defineProperty(lib, '_x', { value: x, enumerable: false, configurable: true }); } catch (e) {}
    return x;
  }
  // 政体称号补充：神权、附庸、殖民地
  function extraTitle(lib, key) { const t = lib && lib.t && lib.t[key] && lib.t[key][0]; if (t) return t; const x = ext(lib); return x.titles && x.titles[key] || null; }
  // 人名
  function personName(lib, rnd, opt) {
    const x = ext(lib), P = x.people, pick = a => a[Math.floor(rnd() * a.length) % a.length];
    let given = pick(P.given); if (x.family === 'sinitic' || x.family === 'korean') { given = pick(P.given); if (rnd() < (P.twoChar || 0)) { let g2 = pick(P.given); for (let t = 0; t < 4 && g2 === given; t++) g2 = pick(P.given); if (g2 !== given) given += g2; } }
    return { given, surname: opt && opt.surname || pick(P.surnames) };
  }
  const NUM = ['', '一世', '二世', '三世', '四世', '五世', '六世', '七世', '八世', '九世', '十世', '十一世', '十二世', '十三世', '十四世', '十五世'];
  const TEMPLE = ['太祖', '太宗', '世宗', '高宗', '仁宗', '英宗', '神宗', '哲宗', '孝宗', '光宗', '宁宗', '理宗', '中宗', '睿宗', '玄宗', '肃宗', '代宗', '德宗', '顺宗', '宪宗', '穆宗', '敬宗', '文宗', '武宗', '宣宗', '懿宗', '僖宗', '昭宗', '景宗', '显宗', '成宗', '明宗'];
  G.CultureExt = { FAMILIES: F, FAMILY_OF, ORG_KEYS, ext, extraTitle, personName, NUM, TEMPLE, GOV_STYLE: { bureaucratic: '官僚制', feudal: '封建制', tribal: '部族制', mercantile: '商贸型', temple: '神庙型' } };
})(typeof self !== 'undefined' ? self : this);
