/* 人物文字：只把已保存的人生事件写成文字，从不掷骰子，也不改写历史。 */
(function(G){
  'use strict';
  const titles={birth:'出生',education:'学习',occupation:'谋生',ruleChange:'归属更替',service:'被征入伍',war:'战火波及',return:'返乡',illness:'患病',hardship:'生计受损',foodPressure:'食物压力',partnership:'成家',child:'孩子出生',retirement:'晚年',recovery:'康复',migration:'远行',displacement:'流离',culture:'入乡随俗',religion:'改宗',death:'去世',aspiration:'立志',trial:'受挫',achievement:'尝试与成果',legacy:'身后之名',unfinished:'未竟之志',office:'仕途',battle:'征战',mission:'出使',deed:'事迹',trade:'商事',revolt:'起义',sight:'见闻',court:'朝局',faith:'信仰',injury:'险阻',captivity:'羁留'};
  // 人生年表的分类：筛选与着色共用
  const CATEGORY={birth:'family',education:'family',partnership:'family',child:'family',retirement:'family',death:'family',recovery:'family',
    aspiration:'career',occupation:'career',office:'career',battle:'career',mission:'career',deed:'career',trade:'career',revolt:'career',achievement:'career',legacy:'career',unfinished:'career',
    migration:'road',return:'road',displacement:'road',sight:'road',injury:'road',trial:'road',captivity:'road',
    court:'world',ruleChange:'world',war:'world',service:'world',hardship:'world',foodPressure:'world',illness:'world',
    religion:'faith',faith:'faith',culture:'faith'};
  const CATEGORY_NAME={all:'全部',career:'功业',road:'行旅',world:'时局',faith:'信仰与风俗',family:'家庭'};
  const categoryOf=e=>e.result?.world&&!['migration'].includes(e.kind)&&CATEGORY[e.kind]!=='faith'?'world':CATEGORY[e.kind]||'career';
  function dateText(p,date){const text=`第 ${date.year} 年 ${date.month} 月`;return date.precision==='month'?text:`${text}（年内第 ${date.day} 日）`;}
  const titleOf=e=>e.result?.title||titles[e.kind]||e.kind;
  function eventText(p,e){
    const n=e.place.name,r=e.result||{};
    if(r.text)return r.text;
    switch(e.kind){
      case'birth':return `出生于${n}的${G.Life.CLASSES[r.familyClass]}。姓名取自出生家庭文化。`;
      case'education':return r.education==='literate'?`在${n}学习识字与记账。`:`在${n}跟随家人学习谋生技能。`;
      case'occupation':return `在${n}开始以${G.Life.OCCUPATIONS[r.occupation]||r.occupation}为业。${r.reason}。`;
      case'ruleChange':return `${n}的归属变为${r.polity}。个人姓名和早年出身保留。`;
      case'migration':return `由${r.from.name}${r.routeKind==='offroad'?'越野':r.routeKind==='mixed'?'经道路与越野路段':'沿当年道路与渡运'}迁往${n}，导航行程约${r.distanceKm}公里、${r.travelDays.toFixed(1)}世界日。${r.reason||r.purpose||''}。`;
      case'partnership':return `在${n}与一位当地同种族成年居民建立家庭。`;
      case'child':{const c=p.relations.find(x=>x.id===r.child);return `家庭迎来孩子${c?'“'+c.name+'”':''}。`;}
      case'culture':return `在${n}逐渐认同${r.cultureName}，保留出生时的姓名。`;
      case'religion':return `在${n}改信${r.religionName}。`;
      case'foodPressure':return `第${r.sampleYear}年的当地粮食采样显示供养偏紧，推演其生活承受食物压力；该记录不证明当年发生饥荒。`;
      case'aspiration':return `性情${r.temperament}，从家庭所学中确立“${r.title}”的追求：${r.goal}。${r.reason||''}`;
      case'trial':return `${r.reason}。${r.resourceCost>0?`家用支出${r.resourceCost.toFixed(1)}，健康损失${r.healthLoss}。`:''}${r.debtIncurred>0?`不得不向同行者借取${r.debtIncurred.toFixed(1)}，留下待偿债务。`:''}`;
      case'achievement':return `${r.artifact}。${r.reason}。${r.resourceGain>0?`获得${r.resourceGain}家用收入。`:''}${r.resourceCost>0?`另付出${r.resourceCost}家用。`:''}${r.debtPaid>0?`用所得偿还${r.debtPaid.toFixed(1)}债务。`:''}`;
      case'legacy':return `留下《${r.work.title}》，以${r.work.form}的方式传承。${r.reason}。`;
      case'unfinished':return `${r.goal?`“${r.goal}”仍未完成。`:''}${r.reason}。`;
      case'death':return `在${n}去世，个人推演原因为${r.reason}。`;
      default:return `${r.reason||titles[e.kind]||e.kind}。`;
    }
  }
  function biography(p,{year=p.endYear+11/12,full=false}={}){
    const limit=full?p.endYear+11/12:Math.min(year,p.endYear+11/12),events=G.Life.eventsAt(p,limit,full),displayYear=Math.floor(limit),month=Math.floor((limit-displayYear)*12+1e-6)+1;
    if(!events.some(e=>e.kind==='birth'))return `${p.name}在第 ${displayYear} 年第 ${month} 月尚未出生。`;
    const v3=p.version===G.Life.VERSION,path=v3&&G.LifePaths.BY[p.story.path];
    const intro=v3?`${p.name}，${p.speciesName}，${dateText(p,p.events[0].date)}生于${p.birth.place.name}，出身${p.birth.cultureName==='尚未形成文化'?'当地':p.birth.cultureName}的${G.Life.CLASSES[p.familyClass]}，自幼信奉${p.birth.religionName}。一生所向：${path.label}——${path.goal}。`
      :`${p.name}，${p.speciesName}，${dateText(p,p.events[0].date)}生于${p.birth.place.name}。出生家庭属于${p.birth.cultureName}，信仰为${p.birth.religionName}。这是固定世界历史中的传奇条件样本，个人经历与小范围声望为叙事推演。`;
    const death=events.find(e=>e.kind==='death'),tail=death?`人生记录止于${dateText(p,death.date)}。`:`截至第 ${displayYear} 年${displayYear===p.endYear&&month===12?'':'第 '+month+' 月'}仍在世${displayYear===p.endYear&&month===12?'，后续未推演':'；仅展示截至这个月的经历'}。`;
    return [intro,...events.filter(e=>e.kind!=='birth').map(e=>`${dateText(p,e.date)}【${titleOf(e)}】${eventText(p,e)}${e.result?.world&&!eventText(p,e).includes(e.result.world.text)?`（时局：${e.result.world.text}）`:''}`),tail].join('\n\n');
  }
  G.LifeText={titles,CATEGORY,CATEGORY_NAME,categoryOf,titleOf,eventText,biography,dateText};
})(typeof self!=='undefined'?self:globalThis);
