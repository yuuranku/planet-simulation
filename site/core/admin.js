/* 行政制度：把政权的政府组织（推演给出的 q.gov 键 + 文化库的组织风格）归成几大类，
 * 供历史时间线的“制度”图层与人文专题“行政制度”共用——一眼看出哪里行郡县、哪里行分封、哪里是游牧汗国。
 *  - 行政制：官僚按地域治民（郡县、行省、科层）；集权时代（发展阶段 ≥ 7）一律归此；王国与帝国时代看文化库的组织风格是否为官僚制；
 *  - 封建制：土地与人民分封给贵族世袭领有；封建时代（阶段 6）与非官僚风格的王国、帝国归此；
 *  - 游牧制：随畜迁徙的部族联盟（左右翼、千户、库里台）；
 *  - 其余：部落酋邦、城邦、共和、神权、藩属、起义政权。 */
(function (G) {
  'use strict';
  const ORDER = ['admin', 'feudal', 'nomad', 'tribal', 'city', 'republic', 'theo', 'vassal', 'rebel'];
  const NAME = { admin: '行政制', feudal: '封建制', nomad: '游牧制', tribal: '部落酋邦', city: '城邦制', republic: '共和制', theo: '神权制', vassal: '藩属自治', rebel: '起义政权' };
  const DESC = {
    admin: '官僚按地域治民：郡县、行省与科层官僚，官员由朝廷任免、不世袭',
    feudal: '土地与人民分封给贵族世袭领有，君主通过封臣间接统治',
    nomad: '随畜迁徙的部族联盟：可汗之下分左右翼与千户，大事由部族大会决定',
    tribal: '氏族长老与酋长治理，尚无常设官僚',
    city: '一城及其近郊自治，由公民大会、长老或豪族议事',
    republic: '无君主，由议会与选任的执政治理',
    theo: '教权与政权合一，祭司或教主统治',
    vassal: '自有疆土与朝廷，向宗主称臣纳贡',
    rebel: '起义军控制，军营与大帐代行治理'
  };
  const COL = { admin: [52, 104, 178], feudal: [186, 72, 52], nomad: [150, 160, 56], tribal: [190, 156, 108], city: [232, 160, 40], republic: [34, 150, 140], theo: [128, 72, 168], vassal: [214, 128, 150], rebel: [200, 40, 32] };
  // 推演的政府组织键 → 制度类；king / empire 看组织风格
  function classOf(key, style) {
    switch (key) {
      case 'central': return 'admin';
      case 'feudal': return 'feudal';
      case 'king': case 'empire': return style === 'bureaucratic' ? 'admin' : 'feudal';
      case 'nomad': return 'nomad';
      case 'chief': return 'tribal';
      case 'city': return 'city';
      case 'republic': return 'republic';
      case 'theo': return 'theo';
      case 'vassal': return 'vassal';
      case 'rebel': return 'rebel';
      case 'colony': return 'vassal';
      default: return style === 'bureaucratic' ? 'admin' : style === 'tribal' ? 'tribal' : 'feudal';
    }
  }
  // 现在的国家：优先用推演终局的政府组织键，旧数据按政体推断
  const REGIME_KEY = { theo: 'theo', republic: 'republic', nomad: 'nomad', vassal: 'vassal', city: 'city', chief: 'chief', central: 'central', feudal: 'feudal' };
  function classOfCountry(k) {
    if (!k) return 'feudal';
    let key = k.govKey;
    if (!key) key = REGIME_KEY[k.regime] || (k.regime === 'monarchy' ? (k.imperial ? 'empire' : 'king') : ({ nomadic: 'nomad', chiefdom: 'chief', cityRepublic: 'city', republic: 'republic', league: 'chief', empire: 'empire', theocracy: 'theo', vassal: 'vassal' }[k.form] || 'king'));
    return classOf(key, k.govStyle);
  }
  G.AdminSys = { ORDER, NAME, DESC, COL, classOf, classOfCountry };
})(typeof self !== 'undefined' ? self : this);
