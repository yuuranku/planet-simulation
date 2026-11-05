/* 人生方向：人物一生的大致走向。只描述个人在固定历史中的选择，不改写世界。 */
(function (G) {
  'use strict';
  // range：一次远行偏好的地图距离（地图单位，约 35～40 公里）；cadence：两次行动之间的地球年
  const PATHS = [
    { id:'official', group:'庙堂', icon:'仕', label:'入朝为官', title:'宦海浮沉', mode:'carriage', serve:true, cadence:[2,4],
      blurb:'赴京应选，从小吏做起；外放州县、内调中枢，随朝局起落。',
      goal:'入京应选，在宦海中一步步走向中枢；无论外放何方，都要留下几件被百姓记住的政绩',
      ranks:['书吏','主簿','县令','郡守','侍郎','尚书','宰辅'], epithet:['能吏','名臣','一代贤相'], occupation:'官吏' },
    { id:'general', group:'庙堂', icon:'将', label:'出将入相', title:'金戈入相', mode:'horse', serve:true, cadence:[1,2],
      blurb:'投军从伍，随本国大军征战四方，积功封将；功成之后入朝拜相。',
      goal:'投身行伍，随国家的战事走遍边关，以战功封将，最终入朝执掌国政',
      ranks:['士卒','什长','百夫长','校尉','偏将','将军','大将军'], epithet:['勇将','名将','国之柱石'], occupation:'军人' },
    { id:'envoy', group:'庙堂', icon:'使', label:'纵横使节', title:'纵横列国', mode:'horse', serve:true, cadence:[1,3],
      blurb:'奉国书出使列国，往返诸国都城之间，在战与和之间斡旋。',
      goal:'凭口舌与胆识出使列国，在诸国的宫廷之间奔走，为本国换来盟约与和平',
      ranks:['随员','副使','正使','大鸿胪'], epithet:['辩士','纵横家','一代名使'], occupation:'使臣' },
    { id:'wanderer', group:'江湖', icon:'游', label:'云游四方', title:'踏遍山河', mode:'walk', cadence:[1,2], far:true,
      blurb:'不求功名，只想看遍天下：名都大邑、异国风俗、远方的圣地与边城。',
      goal:'不为功名所困，走遍天下的名城、异国与边地，把一路见闻写成一部游记',
      ranks:null, epithet:['行者','游方客','天下行者'], occupation:'旅人' },
    { id:'knight', group:'江湖', icon:'侠', label:'仗剑游侠', title:'仗剑天涯', mode:'horse', cadence:[1,2],
      blurb:'仗剑出游，哪里有动乱与不平就往哪里去，扶危济困、快意恩仇。',
      goal:'仗剑走天涯，哪里有乱事与不平就往哪里去，以手中剑护住路上遇见的人',
      ranks:null, epithet:['剑客','游侠','一代大侠'], occupation:'游侠' },
    { id:'mercenary', group:'江湖', icon:'佣', label:'佣兵四海', title:'刀头舔血', mode:'horse', cadence:[1,2],
      blurb:'以刀剑为生，哪国开战就投奔哪方，跟着战火走遍诸国。',
      goal:'把刀剑卖给出价最高的一方，跟着各国的战火四处转战，攒下足够的金子与名声',
      ranks:['佣兵','小队长','佣兵队长','佣兵团长'], epithet:['老兵','战狼','佣兵之王'], occupation:'佣兵' },
    { id:'rebel', group:'江湖', icon:'义', label:'揭竿而起', title:'乱世枭雄', mode:'walk', cadence:[1,2],
      blurb:'生逢苛政，投身各地的起义军；事成则开国封侯，事败则亡命天涯。',
      goal:'不甘受苛政压迫，投身天下的起义，盼着有一天能改天换地',
      ranks:['义从','头目','渠帅','义军首领'], epithet:['义士','草莽英雄','乱世枭雄'], occupation:'义军' },
    { id:'merchant', group:'商旅', icon:'商', label:'行商天下', title:'商路万里', mode:'carriage', cadence:[1,2],
      blurb:'贩货于诸国大城之间，赌商路的盈亏，在各地开设商号。',
      goal:'把货物从一座大城运到另一座大城，在列国开设自己的商号，成就一方巨贾',
      ranks:['行脚商','商贩','坐商','巨贾'], epithet:['良贾','豪商','天下巨贾'], occupation:'商人' },
    { id:'explorer', group:'商旅', icon:'拓', label:'拓荒远行', title:'向远方去', mode:'walk', cadence:[2,3], far:true,
      blurb:'奔向新建的边城与世界的尽头，开垦荒地、绘制陌生的地图。',
      goal:'离开熟悉的故土，去往世界边缘新开的城镇，看看地图之外还有什么',
      ranks:null, epithet:['拓荒者','开路人','远方之子'], occupation:'拓荒者' },
    { id:'missionary', group:'信仰与学问', icon:'道', label:'传道布教', title:'传道四方', mode:'walk', cadence:[1,2],
      blurb:'带着自己的信仰走进异教之地，宣讲、辩经、建立会所，也会遭遇驱逐。',
      goal:'把自己的信仰带到异教流行的远方，在那里宣讲、立会，让更多人听见',
      ranks:['信众','传道人','教长','大德'], epithet:['传道者','布道师','一代宗师'], occupation:'传道人' },
    { id:'pilgrim', group:'信仰与学问', icon:'圣', label:'朝圣苦修', title:'朝圣之路', mode:'walk', cadence:[2,3], far:true,
      blurb:'徒步前往信仰的圣地，再访诸教名山，以苦行求得内心的答案。',
      goal:'徒步走到信仰的发源圣地，再遍访诸教名山古迹，以苦行求得心中的答案',
      ranks:null, epithet:['朝圣者','苦行僧','圣者'], occupation:'朝圣者' },
    { id:'scholar', group:'信仰与学问', icon:'学', label:'游学四方', title:'负笈游学', mode:'walk', cadence:[2,3],
      blurb:'负笈远行，往名都拜师论辩，著书立说；名声大了，也许会被朝廷征召。',
      goal:'负笈远游，往天下名都求师问学、与人论辩，最终著成一部能传世的书',
      ranks:['学子','讲学先生','博士','宗师'], epithet:['学人','名士','一代宗师'], occupation:'学者' },
    { id:'physician', group:'信仰与学问', icon:'医', label:'悬壶济世', title:'悬壶济世', mode:'walk', cadence:[1,2],
      blurb:'背着药箱奔赴瘟疫、灾荒与战乱之地，行医救人，也冒着染病的风险。',
      goal:'背起药箱，往瘟疫、饥荒和战乱最重的地方去，救下尽可能多的人，再把医术传下去',
      ranks:['郎中','名医','御医'], epithet:['良医','神医','医圣'], occupation:'医者' },
    { id:'artisan', group:'商旅', icon:'匠', label:'匠作游方', title:'百工游方', mode:'walk', cadence:[2,3],
      blurb:'带着工具四处应募：筑城、修关、营建新都，手艺在一座座城池里留下痕迹。',
      goal:'带着工具四处应募，在各地修城筑关、营建宫室，让自己的手艺留在一座座城池里',
      ranks:['学徒','匠人','匠师','大匠'], epithet:['巧匠','名匠','天下大匠'], occupation:'工匠' },
    { id:'bard', group:'江湖', icon:'诗', label:'吟游诗人', title:'诗酒天涯', mode:'walk', cadence:[1,2],
      blurb:'游走诸国都城与大邑，把天下兴亡谱成诗歌，或被请进宫廷。',
      goal:'游走于诸国的都城与市井，把亲眼见到的兴亡离乱写成诗歌，让它们被人传唱',
      ranks:null, epithet:['歌者','诗人','一代诗宗'], occupation:'诗人' }
  ];
  const BY = Object.fromEntries(PATHS.map(p => [p.id, p]));
  const TEMPERAMENTS = [
    { id:'curious', label:'好奇而执拗', short:'好奇' },
    { id:'careful', label:'谨慎而守诺', short:'谨慎' },
    { id:'bold', label:'豪勇敢冒险', short:'豪勇' },
    { id:'adaptable', label:'随机应变', short:'机变' }
  ];
  // 随缘：按家境挑一个“会走动”的方向
  const CLASS_WEIGHT = {
    labor:{general:3,mercenary:3,rebel:3,knight:2,explorer:3,wanderer:2,pilgrim:2,artisan:1,missionary:1,bard:1,merchant:1,physician:1},
    craft:{artisan:5,merchant:2,explorer:2,general:1,wanderer:2,knight:1,mercenary:1,physician:1,bard:1,missionary:1},
    trade:{merchant:6,envoy:2,explorer:2,wanderer:2,official:1,bard:1,scholar:1,mercenary:1,knight:1},
    learned:{official:5,scholar:4,envoy:3,physician:2,missionary:1,wanderer:1,bard:2,general:1,pilgrim:1}
  };
  function pick(familyClass, rnd, religion) {
    const w = { ...(CLASS_WEIGHT[familyClass] || CLASS_WEIGHT.labor) };
    if (religion >= 0) { w.missionary = (w.missionary || 0) + 1.5; w.pilgrim = (w.pilgrim || 0) + 1; }
    const list = Object.entries(w), sum = list.reduce((s, [, v]) => s + v, 0);
    let x = rnd() * sum; for (const [id, v] of list) { x -= v; if (x <= 0) return id; } return list[0][0];
  }
  const rankTitle = (path, rank) => { const d = BY[path]; if (!d?.ranks || rank < 0) return null; return d.ranks[Math.min(rank, d.ranks.length - 1)]; };
  function epithetOf(path, fame) { const d = BY[path]; if (!d) return null; return fame >= 16 ? d.epithet[2] : fame >= 8 ? d.epithet[1] : fame >= 4 ? d.epithet[0] : null; }
  G.LifePaths = { PATHS, BY, TEMPERAMENTS, CLASS_WEIGHT, pick, rankTitle, epithetOf };
})(typeof self !== 'undefined' ? self : globalThis);
