/* Personal pursuits are inferred stories inside fixed history, never world events. */
(function(G){
  'use strict';
  const profiles={
    knowledge:{title:'求知游历',goal:'踏访异乡，把亲走的路线和地方见闻汇成能传给后来人的行旅志',purposes:['核对家乡以外的地形与行程','走访另一处聚落，比较先前的见闻','带着亲历记录寻找传授经验的落脚处']},
    trade:{title:'商路求索',goal:'背着家产试走异乡商路，用盈亏与险途换来一部可交给接班者的行商账',purposes:['带一批家用物品试探异地交换','根据上次盈亏改换目的地和携带物品','带着往返账目寻找能够长期谋生的落脚处']},
    guardian:{title:'护乡救援',goal:'走出家乡护送行路者，把付过代价的补给与救助经验编成护途之法',purposes:['携带口粮寻找可以相互照应的聚落','带着前次救助的教训练习护送与补给','把途中照料和避险的经验带到安顿之处']},
    faith:{title:'信仰游历',goal:'带着故乡未解的疑问远行，将异乡交谈和难以调和的分歧留作问道集',purposes:['向外地居民请教他们如何实践信仰','带着前次未解的问题再访另一处聚落','整理亲自听到的讲述，在落脚处继续交流']},
    craft:{title:'工艺求索',goal:'携家传工具走访异乡，以坏件和失败反复磨练手艺，留下自己的传艺谱',purposes:['带着家传工具到外地试做修补','针对上次暴露的问题再访同行','带着试过的修补办法寻找传艺的落脚处']}
  };
  function create({familyClass,education,stage,religion,conflict,rnd}){
    const archetype=familyClass==='craft'&&stage>=2?'craft':familyClass==='trade'&&stage>=2?'trade':familyClass==='learned'||education==='literate'?'knowledge':conflict?'guardian':religion>=0&&rnd()<.45?'faith':rnd()<.5?'guardian':'knowledge';
    const index=Math.floor(rnd()*4),temperament=['好奇而执拗','谨慎而守诺','敢冒风险，重视同行','遇挫后愿意改弦更张'][index],disposition=['curious','careful','bold','adaptable'][index];
    return{archetype,...profiles[archetype],temperament,disposition,status:'growing',reputation:0,journeys:[],achievements:[],costs:[],navigationCalls:0,debt:0};
  }
  function trial(story,journey,rnd){
    const roll=rnd();
    if(roll<.3)return{challenge:'伤病',reason:`抵达后脚伤发作，暂停奔走，花费家用休养；${journey.routeKind==='offroad'?'越野途中没有现成道路可借力':'长途负重消耗了体力'}`,resourceCost:4,healthLoss:story.disposition==='careful'?6:story.disposition==='bold'?10:8};
    if(roll<.65)return{challenge:'器物损耗',reason:'抵达时发现随身工具和容器受损，必须先付出修补费用，原定打算被迫延后',resourceCost:9,healthLoss:2};
    return{challenge:'救助与取舍',reason:'途中遇到体力不支的同行者，分出口粮并留下照料，带到目的地的物资因此减少',resourceCost:7,healthLoss:4};
  }
  function result(story,{journey,place,education,health,rnd}){
    const success=rnd()<Math.max(.25,.76+(education==='literate'?.08:0)+(story.disposition==='adaptable'&&story.achievements.length?.06:0)-(health<65?.2:0)),km=journey.km.toFixed(1),days=journey.days.toFixed(1);
    const artifacts={knowledge:education==='literate'?`为行旅志写下“${place.name}篇”：标出亲走的${km}公里路线、${days}世界日耗时和沿途见闻`:`编成“${place.name}行路诀”：将亲走的${km}公里路线、地形和${days}世界日耗时化作可背诵的次序`,trade:`做成“${place.name}往返账”：把${days}世界日的路费与随身货物逐项对照，记下这次异地交换的盈亏，留给下一程检验`,guardian:`在${place.name}整理一份护途补给次序，把这段${km}公里、${days}世界日旅程中缺粮与照料的教训变成可实际试行的办法`,faith:`在${place.name}完成一次问道记录，${education==='literate'?'逐项写下':'反复背述'}交谈中始终未解的疑问和不同讲述，保留原有分歧`,craft:`在${place.name}留下“${place.name}试作谱”：把途中损坏的工具重新修配，逐处标记失效位置与改动，准备带到下一站再试`};
    const partial={knowledge:'记录中有无法互相印证的见闻，明确留作疑问，没有写成定论',trade:'交换所得没能覆盖路费，缩减货物，保留这次亏损账目',guardian:'准备的口粮仍不足，没能按原先打算帮助所有同行者，改为更短的补给段',faith:'几次交谈仍未取得共识，承认分歧，没有宣称说服当地群体',craft:'修补件再次损坏，承认做法尚不可靠，留下失效的位置供下次修改'};
    return{outcome:success?'earned':'revised',artifact:artifacts[story.archetype],reason:success?'在当地反复试验之后，同行者愿意采用其中已经验证的部分；仍把未能证明的地方留白':partial[story.archetype],reputationDelta:success?2:0,resourceGain:success?(story.archetype==='trade'?12:story.archetype==='craft'?5:0):0,resourceCost:success?0:4};
  }
  function work(p,education){
    const names={knowledge:'行旅志',trade:'异乡行商账',guardian:'护途经验集',faith:'异乡问道集',craft:'远行试作谱'};
    return{title:p.name+'·'+names[p.story.archetype],form:education==='literate'?'手录成册':'口传与实物演示',sources:p.story.achievements.slice(),journeys:p.story.journeys.slice()};
  }
  function summary(p,year,full=false){
    const events=G.Life.eventsAt(p,year,full),aspiration=events.find(e=>e.kind==='aspiration');
    const view={title:aspiration?.result.title||'尚未立志',goal:aspiration?.result.goal||null,temperament:aspiration?.result.temperament||null,status:aspiration?'pursuing':'growing',reputation:0,journeys:[],achievements:[],costs:[],epithet:null,works:[]};
    for(const e of events){const r=e.result;if(e.kind==='migration'&&r.pursuit)view.journeys.push(e);if(e.kind==='achievement'){view.achievements.push(e);view.reputation+=r.reputationDelta;}if(e.kind==='trial')view.costs.push(e);if(e.kind==='legacy'){view.status='fulfilled';view.works.push(r.work);}if(e.kind==='unfinished')view.status='unfinished';}
    if(view.journeys.length>=2&&view.achievements.filter(e=>e.result.outcome==='earned').length>=2)view.epithet={knowledge:'记路人',trade:'远行商',guardian:'护途者',faith:'问道者',craft:'百炼匠'}[aspiration.result.archetype];
    return view;
  }
  G.LifeStory={profiles,create,trial,result,work,summary};
})(typeof self!=='undefined'?self:globalThis);
