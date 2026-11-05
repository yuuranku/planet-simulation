(function(G){
  'use strict';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let footAll=false,app,panel,selection=null,activeId=null,full=false,view=null,shownYear=null,shownMonth=null,journeyView=null,journeyRaf=0,requestToken=0,lastJourneyLabel=0,scrubbing=false,filter='all',lastGroups=[],pendingDelete=null;
  const form={path:'',temperament:'',name:''};
  const $=id=>document.getElementById(id),history=()=>app.history||G.Timeline.data,cfg=()=>G.Config.toCfg(app.state),records=()=>app.people||[];
  const monthKey=time=>Math.floor(time*12+1e-7), monthText=time=>`第 ${Math.floor(time)} 年 ${monthKey(time)%12+1} 月`;
  const dateTime=(p,d)=>d.year+((d.day-1)+(d.hour||0)/p.calendar.hoursPerDay)/p.calendar.daysPerYear;
  const v3=p=>p.version===G.Life.VERSION;
  function init(a){
    app=a;panel=document.createElement('section');panel.className='card tl-focus person-panel';panel.id='personPanel';panel.hidden=true;
    panel.setAttribute('aria-label','人物人生');document.body.appendChild(panel);
    panel.addEventListener('click',e=>{if(e.target.closest('[data-person-close]'))hide();});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden&&!e.target.closest?.('input')){hide();e.preventDefault();e.stopImmediatePropagation();}});
  }
  function reveal(){G.Timeline?.clearDetails?.();G.City?.close();G.MilitaryMap?.hide();panel.hidden=false;}
  function render(title,html,footer='',head=''){panel.innerHTML=`<button class="tl-icon tl-city-x" data-person-close aria-label="关闭人物面板"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button>${head||`<header class="tf-head"><p class="tf-eyebrow"><i></i>人物人生</p><h3>${esc(title)}</h3></header>`}<div class="person-body">${html}</div>${footer?`<footer class="tl-city-acts tf-acts">${footer}</footer>`:''}`;panel.hidden=false;}
  // 人生事件刻字：类别决定颜色，字决定一眼可辨的事
  const GLYPH={birth:'生',death:'卒',partnership:'婚',child:'子',education:'学',aspiration:'志',occupation:'业',retirement:'老',migration:'行',return:'归',displacement:'徙',trial:'挫',illness:'病',hardship:'灾',foodPressure:'饥',war:'兵',service:'役',recovery:'愈',achievement:'成',legacy:'传',unfinished:'憾',ruleChange:'易',culture:'俗',religion:'信',office:'仕',battle:'战',mission:'使',deed:'事',trade:'商',revolt:'义',sight:'见',court:'朝',faith:'道',injury:'险',captivity:'囚'};
  const glyph=e=>e.kind==='migration'&&e.result?.march?'军':GLYPH[e.kind]||'·';
  const cat=e=>G.LifeText.categoryOf(e);
  const ageAt=(p,t)=>Math.max(0,Math.floor((t-dateTime(p,p.birth))*(p.calendar.earthYearsPerYear||1)));
  function hide(){stopJourney();journeyView=null;G.Timeline?.personBand?.(null);if(panel)panel.hidden=true;app?.map?.drawDynamic();}
  function acceptVersion(p){
    if(p.version===G.Life.VERSION||p.version===G.Life.LEGACY_VERSION)return true;
    stopJourney();selection=null;activeId=null;full=false;view='unsupported';shownYear=null;shownMonth=null;journeyView=null;
    reveal();render(p.name,'<p role="alert">此人物使用旧版人生记录，当前版本无法打开。原记录已保留，请回到历史地图重新生成人物。</p>','<button class="btn ghost" id="personList">人物列表</button>');
    $('personList').onclick=list;app.map?.drawDynamic();return false;
  }
  const option=(v,t)=>`<option value="${esc(v)}">${esc(t)}</option>`;
  // ---------- 生成表单 ----------
  function pathCards(){
    const P=G.LifePaths.PATHS,groups=[...new Set(P.map(x=>x.group))];
    const card=(id,icon,label,group)=>`<button type="button" class="pf-path${form.path===id?' on':''}" data-path="${esc(id)}" data-group="${esc(group)}" aria-pressed="${form.path===id}"><i>${esc(icon)}</i><b>${esc(label)}</b></button>`;
    return `<div class="pf-paths">${card('','缘','随缘','随缘')}${groups.map(g=>P.filter(x=>x.group===g).map(x=>card(x.id,x.icon,x.label,g)).join('')).join('')}</div>`;
  }
  const pathDesc=()=>{const d=G.LifePaths.BY[form.path];return d?`<b>${esc(d.label)}</b>　${esc(d.blurb)}${d.ranks?`<span class="pf-ranks">${d.ranks.map(esc).join(' → ')}</span>`:''}`:'<b>随缘</b>　按家境、信仰与天性自然选定一条路：劳作人家多从军、拓荒、云游，商贾人家多行商，文书人家多入仕游学。';};
  function open({kind,id,year}){
    const H=history();if(!H)return;stopJourney();selection={kind,id,year:G.HistoryDate.time(year)};view='form';G.Timeline.pause();G.Timeline.setYear(selection.year);reveal();
    const cal=G.Life.calendar(cfg()),place=G.HistoryQuery.location(H,{kind,id},selection.year),T=G.LifePaths.TEMPERAMENTS;
    render('在此生成人物',`<div class="pf-place"><span>出生地</span><b>${esc(place.name)}</b><small>${monthText(selection.year)}</small></div><form id="personForm" class="pf-form" autocomplete="off">
      <fieldset><legend>姓名</legend><div class="pf-name"><input id="personName" maxlength="24" placeholder="留空则按家庭文化起名" value="${esc(form.name)}"><button type="button" id="personNameRoll" title="按所选家庭文化随机起一个名字"><svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3.5"/><circle cx="9" cy="9" r="1.2"/><circle cx="15" cy="15" r="1.2"/><circle cx="15" cy="9" r="1.2"/><circle cx="9" cy="15" r="1.2"/></svg>起名</button></div></fieldset>
      <fieldset><legend>人生方向<small>大致走向，具体经历随时局展开</small></legend>${pathCards()}<p class="pf-path-desc" id="personPathDesc">${pathDesc()}</p></fieldset>
      <fieldset><legend>性情</legend><div class="pf-temper">${[['','随机'],...T.map(t=>[t.id,t.short])].map(([v,l])=>`<button type="button" data-temper="${v}" class="${form.temperament===v?'on':''}" title="${esc(T.find(t=>t.id===v)?.label||'随机性情')}">${esc(l)}</button>`).join('')}</div></fieldset>
      <details class="pf-more"><summary>出生与出身<small>年份、种族、文化、信仰、家境</small></summary>
      <div class="pf-grid">
      <label class="pf-wide">生成方式<select id="personMode"><option value="birth">在此年出生</option><option value="resident">所选月份在世的本地居民</option></select></label>
      <label>出生年份<input id="personBirthYear" type="number" min="0" max="${H.E}" step="1" value="${Math.floor(selection.year)}"></label>
      <label id="personAgeLabel" hidden>当时年龄<input id="personAge" type="number" min="0" max="${Math.floor(selection.year)}" step="1" placeholder="随机"></label>
      <label>生日<small>年内第几日</small><input id="personBirthDay" type="number" min="1" max="${Math.ceil(cal.daysPerYear)}" step="1" placeholder="随机"></label>
      <label>种族<select id="personSpecies"></select></label><label>性别<select id="personSex">${option('','随机')}${['女','男','其他'].map(s=>option(s,s)).join('')}</select></label>
      <label class="pf-wide">家庭文化<select id="personCulture"></select></label><label class="pf-wide">出生信仰<select id="personReligion"></select></label>
      <label>家庭背景<select id="personClass">${option('','随机')}${Object.entries(G.Life.CLASSES).map(([k,v])=>option(k,v)).join('')}</select></label>
      <label>初始家境<small>0～100</small><input id="personWealth" type="number" min="0" max="100" step="1" placeholder="随机"></label>
      ${kind==='city'?'<label class="pf-check pf-wide"><input id="personRural" type="checkbox"> 改为同地区乡村出生（城市未建或已毁时可选）</label>':''}</div></details>
      <p id="personEvidence" class="pf-evidence"></p><p id="personError" role="alert" class="pf-error"></p>
      <button type="submit" class="btn primary pf-go" id="personGenerate">推演这一生</button>
      <p class="lm-note">人物随所选方向在固定历史中行动：随国出征、随朝迁都、投奔起义、遇上改宗与瘟疫，都读自这个世界已有的编年史，不改写战争与人口。一年 ${cal.daysPerYear} 世界日，每日 ${cal.hoursPerDay} 小时。</p></form>`, '<button class="btn ghost" id="personSaved">已保存人物</button>');
    $('personSaved').onclick=list;
    panel.querySelectorAll('[data-path]').forEach(b=>b.onclick=()=>{form.path=b.dataset.path;panel.querySelectorAll('[data-path]').forEach(x=>{x.classList.toggle('on',x===b);x.setAttribute('aria-pressed',x===b);});$('personPathDesc').innerHTML=pathDesc();});
    panel.querySelectorAll('[data-temper]').forEach(b=>b.onclick=()=>{form.temperament=b.dataset.temper;panel.querySelectorAll('[data-temper]').forEach(x=>x.classList.toggle('on',x===b));});
    $('personName').oninput=e=>{form.name=e.target.value;};
    $('personNameRoll').onclick=()=>{try{const culture=$('personCulture').value!==''?Number($('personCulture').value):lastGroups.length?lastGroups.reduce((a,b)=>b.population>a.population?b:a).culture:null,region=lastGroups[0]?.region;if(culture==null)throw Error('当地还没有可用的人口记录。');$('personName').value=form.name=G.Life.rollName(H,cfg(),culture,crypto.randomUUID(),$('personSex').value,region,selection.year);$('personError').textContent='';}catch(error){$('personError').textContent='起名失败：'+error.message;}};
    const request=()=>({mode:$('personMode').value,place:{kind,id},year:selection.year,birthYear:Number($('personBirthYear').value),age:$('personAge').value===''?null:Number($('personAge').value),birthDay:$('personBirthDay').value||null,species:$('personSpecies').value,culture:$('personCulture').value,religion:$('personReligion').value,sex:$('personSex').value,familyClass:$('personClass').value,wealth:$('personWealth').value,rural:!!$('personRural')?.checked,name:$('personName').value.trim(),path:form.path,temperament:form.temperament});
    function refresh(){
      const resident=$('personMode').value==='resident';$('personAgeLabel').hidden=!resident;$('personBirthYear').disabled=resident;
      if(resident&&$('personAge').value!=='')$('personBirthYear').value=Math.floor(selection.year)-Number($('personAge').value);
      try{const r=request(),choices=G.Life.choices(H,cfg(),{...r,species:null,culture:null,religion:null}),groups=choices.groups;lastGroups=groups;
        for(const [field,node,name] of [['species','personSpecies',id=>H.human.species[id].label],['culture','personCulture',id=>G.HistoryQuery.culture(H,id)?.name||'尚未形成文化'],['religion','personReligion',id=>id>=0?H.religions[id].name:'原始信仰']]){
          const old=$(node).value,ids=[...new Set(groups.map(g=>g[field]))];$(node).innerHTML=option('','按本地联合人口随机')+ids.map(id=>option(id,name(id))).join('');if(old!==''&&!ids.includes(Number(old)))$(node).insertAdjacentHTML('beforeend',option(old,'已锁定条件不在当前人口记录中'));$(node).value=old;
        }
        $('personEvidence').textContent=`出身依据：第 ${choices.population.year} 年人口采样（计算至第 ${choices.population.calculatedThroughYear} 年），${groups.length} 个联合身份组。${resident?'在世居民的远行从所选月份之后开始。':''}`;$('personError').textContent='';
      }catch(error){lastGroups=[];$('personError').textContent=error.message;$('personEvidence').textContent='请调整年份、地点或出生条件。';for(const node of ['personSpecies','personCulture','personReligion'])if(!$(node).options.length)$(node).innerHTML=option('','随机');}
    }
    for(const id of ['personMode','personBirthYear','personAge','personRural'])if($(id))$(id).onchange=refresh;
    $('personForm').onsubmit=async e=>{e.preventDefault();const btn=$('personGenerate'),formEl=$('personForm'),token=++requestToken,originYear=selection.year,currentForm=()=>!panel.hidden&&view==='form'&&$('personForm')===formEl&&token===requestToken;btn.disabled=true;btn.textContent='正在推演这一生…';try{
      const r=request();if(r.mode!=='resident'||r.age!==null)G.Life.choices(H,cfg(),r);
      const person=await create(r);
      if(currentForm()&&app.worldKey()===person.worldKey){form.name='';const time=r.mode==='birth'?dateTime(person,person.birth):originYear;G.Timeline.setYear(time);filter='all';show(person.id,{year:G.Timeline.year,full:r.mode==='birth'});}
    }catch(error){if(currentForm())$('personError').textContent=error.message;}finally{if(btn.isConnected){btn.disabled=false;btn.textContent='推演这一生';}}};
    refresh();
  }
  async function create(base,replaceId=null){
    const id=crypto.randomUUID(),r={...base,id,worldKey:app.worldKey(),seed:String(app.state.seed)+':person:'+id};
    const person=await app.generatePerson(r);G.Life.validateRecord(person,r.worldKey);
    if(app.worldKey()!==r.worldKey)throw Error('生成期间已切换世界。');
    const list=records().slice(),at=replaceId?list.findIndex(x=>x.id===replaceId):-1;if(at>=0)list[at]=person;else list.push(person);app.people=list;
    const saved=await app.savePeople();if(!saved)throw Error('人物已保留在当前会话，但世界存档保存失败。请保存或导出世界后再关闭。');
    return person;
  }
  // ---------- 人物视图 ----------
  function currentStop(p,limit){let stop=p.trajectory[0]?.to||p.birth.place;for(const t of p.trajectory){const e=p.events.find(x=>x.id===t.eventId);if(!e||G.Life.eventTime(p,e)>=limit)break;stop=t.to;}return stop;}
  function meter(label,value,max,cls){const v=Math.max(0,Math.min(100,value/max*100));return `<div class="pp-meter ${cls}"><span>${label}</span><i><s style="width:${v.toFixed(1)}%"></s></i><b>${Math.round(value)}</b></div>`;}
  function chart(p,bt,et,nowT){
    const pts=p.events.filter(e=>e.result?.s).map(e=>[G.Life.eventTime(p,e),...e.result.s]);if(pts.length<3)return'';
    const W=300,Hh=58,fx=t=>((t-bt)/Math.max(1e-6,et-bt))*W,maxF=Math.max(10,...pts.map(x=>x[1])),line=(k,max)=>pts.map(([t,...v],i)=>`${i?'L':'M'}${fx(t).toFixed(1)},${(Hh-2-v[k-1]/max*(Hh-6)).toFixed(1)}`).join('');
    return `<figure class="pp-chart" title="点击曲线跳到那一年"><svg viewBox="0 0 ${W} ${Hh}" preserveAspectRatio="none" id="personChart"><path class="f" d="${line(1,maxF)}"/><path class="w" d="${line(2,100)}"/><path class="h" d="${line(3,100)}"/><line x1="${fx(nowT).toFixed(1)}" x2="${fx(nowT).toFixed(1)}" y1="0" y2="${Hh}"/></svg><figcaption><span class="f">声望</span><span class="w">家资</span><span class="h">健康</span></figcaption></figure>`;
  }
  function show(id,{year=G.Timeline.year,full:all=false}={}){
    const p=records().find(x=>x.id===id);if(!p||!acceptVersion(p))return;const entering=view!=='person'||activeId!==id||panel.hidden,switching=view!=='person'||activeId!==id;if(activeId!==id){stopJourney();journeyView=null;filter='all';}activeId=id;full=all;view='person';shownYear=Math.floor(year);shownMonth=monthKey(year);const currentTrip=activeJourney();if(currentTrip&&monthKey(dateTime(p,G.Navigation.journeyAt(currentTrip,journeyView.elapsedDays).date))!==shownMonth){stopJourney();journeyView=null;}if(entering)reveal();
    const visible=G.Life.eventsAt(p,year,all),limit=all?p.endYear+11/12:Math.min(year,p.endYear+11/12),born=visible.some(e=>e.kind==='birth'),dead=visible.some(e=>e.kind==='death');
    const status=!born?'尚未出生':dead?`${G.LifeText.dateText(p,p.events.at(-1).date)}去世`:`截至${monthText(limit)}仍在世${Math.floor(limit)===p.endYear?'，后续未推演':''}`;
    const bio=G.LifeText.biography(p,{year,full:all}),kin=new Set(visible.filter(e=>e.kind==='partnership'||e.kind==='child').flatMap(e=>e.participants||[])),relations=p.relations.filter(r=>r.role==='parent'?born:kin.has(r.id));
    const bt=dateTime(p,p.birth),deathEv=p.events.find(e=>e.kind==='death'),et=deathEv?G.Life.eventTime(p,deathEv):p.endYear+11/12,nowT=Math.min(Math.max(year,bt),et),span=Math.max(1e-6,et-bt),pos=t=>Math.max(0,Math.min(100,(t-bt)/span*100));
    const st=G.Life.summary(p,year,all),path=v3(p)&&G.LifePaths.BY[p.story.path],epithet=st.epithet?`<span class="pp-epithet">「${esc(st.epithet)}」</span>`:'';
    const role=st.rankTitle||(st.goal&&path?path.occupation:null),stop=currentStop(p,limit+1e-9),trip=journeyView&&activeJourney();
    const head=`<header class="tf-head pp-head"><p class="tf-eyebrow">${path?`<em class="pp-path">${esc(path.icon)}</em>${esc(path.label)} · `:'<i></i>'}${esc(p.speciesName)} · ${esc(p.sex)} · ${esc(G.Life.CLASSES[p.familyClass])}</p><h3 id="personTitle"><span>${esc(p.name)}</span><button class="pp-rename" id="personRename" title="修改姓名" aria-label="修改姓名"><svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/></svg></button>${epithet}</h3><p class="tf-sub">${esc(status)}${role&&born&&!dead?` · ${esc(role)}${st.serving?'（'+esc(st.serving)+'）':''}`:''}</p></header>`;
    const kpis=`<div class="tf-kpis pp-kpis"><div><small>生于</small><b>${p.birth.year}<em>年</em></b><span>${esc(p.birth.place.name)}</span></div><div><small>${dead?'享年':born?'此时':'—'}</small><b>${born?ageAt(p,dead?et:nowT):'—'}<em>${born?'岁':''}</em></b><span>${dead?'第 '+Math.floor(et)+' 年去世':born?'仍在世':'尚未出生'}</span></div><div><small>足迹</small><b>${st.cities?.size||1}<em>城</em></b><span>${st.polities?`${st.polities.size} 国 · ${Math.round(st.km).toLocaleString()} 公里`:`游历 ${st.journeys?.length||0} 次`}</span></div></div>`;
    const lifebar=`<div class="pp-life" title="一生：点击圆点跳到该事件"><i class="pp-life-fill" style="width:${pos(nowT)}%"></i>${p.events.map(e=>{const t=G.Life.eventTime(p,e);return `<button class="pp-dot c-${cat(e)}${t>limit+1e-9?' later':''}" style="left:${pos(t)}%" data-person-event="${esc(e.id)}" title="${esc(G.LifeText.titleOf(e))} · 第 ${Math.floor(t)} 年"></button>`;}).join('')}<u style="left:${pos(nowT)}%"></u></div><div class="pp-life-axis"><span>${Math.floor(bt)}</span><span>${deathEv?Math.floor(et):Math.floor(et)+' · 推演终点'}</span></div>`;
    const here=trip?`在路上：${esc(trip.from.name)} → ${esc(trip.to.name)}`:esc(stop.name);
    const now=born&&v3(p)?`<section class="pp-now"><div class="pp-now-row"><span>${dead?'终于':'此刻'}</span><b>${here}</b><small>${esc(st.religionName)}${st.cultureName&&st.cultureName!=='尚未形成文化'?' · '+esc(st.cultureName):''}</small></div><div class="pp-meters">${meter('声望',st.fame,Math.max(20,st.fame),'m-f')}${meter('家资',st.wealth,100,'m-w')}${meter('健康',st.health,100,'m-h')}</div>${chart(p,bt,et,nowT)}</section>`:`<dl class="pp-ident"><div><dt>文化</dt><dd>${esc(p.birth.cultureName)}</dd></div><div><dt>信仰</dt><dd>${esc(p.birth.religionName)}</dd></div><div><dt>家境</dt><dd><i class="mr-meter"><s style="width:${p.initialWealth}%"></s></i>${p.initialWealth}</dd></div></dl>`;
    const counts={all:visible.length};for(const e of visible){const c=cat(e);counts[c]=(counts[c]||0)+1;}
    const shown=visible.filter(e=>filter==='all'||cat(e)===filter);
    const chips=`<div class="pp-filter" role="tablist">${Object.entries(G.LifeText.CATEGORY_NAME).filter(([k])=>k==='all'||counts[k]).map(([k,n])=>`<button role="tab" data-person-filter="${k}" class="c-${k}${filter===k?' on':''}" aria-selected="${filter===k}">${esc(n)}<em>${counts[k]||0}</em></button>`).join('')}</div>`;
    const events=shown.map(e=>{const t=G.Life.eventTime(p,e),cur=monthKey(t)===shownMonth,text=G.LifeText.eventText(p,e),w=e.result?.world;return `<li class="c-${cat(e)}${cur?' cur':''}"><button class="pp-ev" data-person-event="${esc(e.id)}"><i>${glyph(e)}</i><span><b>${esc(G.LifeText.titleOf(e))}</b><small>第 ${e.date.year} 年 ${e.date.month} 月 · ${born?ageAt(p,t)+' 岁 · ':''}${esc(e.place.name)}</small></span></button><p>${esc(text)}</p>${w&&!text.includes(w.text)?`<blockquote class="pp-world"><em>时局</em>${esc(w.text)}</blockquote>`:''}</li>`;}).join('');
    render(p.name,`${kpis}${lifebar}${now}${storyHTML(p,year,all,st)}${footprintHTML(p,visible,st)}
      ${journeyHTML(p,limit)}
      <section class="tf-sec pp-sec" data-person-section="events"><h4><span>人生年表</span><small>${visible.length} / ${p.events.length} · 点击定位</small></h4>${chips}<ol class="pp-events">${events||'<li class="none">此类暂无经历</li>'}</ol>${!all&&visible.length<p.events.length?'<p class="tf-none">之后的经历随时间轴展开，或点下方“完整人生”。</p>':''}</section>
      ${born?`<details class="tf-sec pp-sec pp-fold" data-person-section="family"><summary>家人</summary><p>成年 ${p.biology.maturity}、衰老 ${p.biology.oldAge} 生理年，按世界年长换算。</p><ul class="pp-kin">${relations.map(r=>`<li><i>${esc({parent:'亲',partner:'偶',child:'子',friend:'友',mentor:'师'}[r.role])}</i><b>${esc(r.name)}</b><small>${esc({parent:'家长',partner:'伴侣',child:'孩子',friend:'朋友',mentor:'师长'}[r.role])}${r.ageAtBirth!=null?' · 人物出生时约 '+r.ageAtBirth+' 岁':r.birthYear!=null?' · 第 '+r.birthYear+' 年出生':''}</small></li>`).join('')||'<li class="none">暂无记录</li>'}</ul></details>`:''}
      <details class="tf-sec pp-sec pp-fold" data-person-section="biography"><summary>传记全文</summary><div class="person-biography">${esc(bio)}</div><p class="lm-note">${esc(p.provenance.details)} 出身依据第 ${p.provenance.sampleYear} 年采样。${esc(p.conditioning||'')}</p></details>`,
      `<button class="pri" id="personMap"><svg viewBox="0 0 24 24"><path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/></svg>定位</button><button id="personFull">${all?'只看到此时':'完整人生'}</button><button id="personCopy">复制传记</button>${v3(p)?'<button id="personReroll" title="同样的出身与方向，换一种命运">再推一次</button>':''}<button id="personList">人物列表</button>`,head);
    if(switching)panel.scrollTop=0;
    G.Timeline.personBand?.({from:bt,to:et,name:p.name,marks:p.events.map(e=>G.Life.eventTime(p,e))});
    $('personFull').onclick=()=>show(id,{year,full:!all});$('personList').onclick=list;
    $('personCopy').onclick=async()=>{try{await navigator.clipboard.writeText(bio);$('personCopy').textContent='已复制';}catch(_){$('personCopy').textContent='请选中传记文字复制';}};
    $('personMap').onclick=()=>{const trip=activeJourney(),point=trip&&G.Navigation.journeyAt(trip,journeyView.elapsedDays),position=mapState(p,G.Timeline.year).position;if(point&&monthKey(dateTime(p,point.date))===monthKey(G.Timeline.year))focusJourney(trip);else if(position)focusPoint(position,4);app.map.drawDynamic();};
    $('personRename').onclick=()=>rename(p);
    if($('personReroll'))$('personReroll').onclick=()=>reroll(p);
    panel.querySelectorAll('[data-person-event]').forEach(b=>b.onclick=()=>focusEvent(id,b.dataset.personEvent));
    panel.querySelectorAll('[data-person-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.personFilter;const keep=panel.scrollTop;show(id,{year,full:all});panel.scrollTop=keep;});
    if($('personFootMore'))$('personFootMore').onclick=()=>{footAll=!footAll;const keep=panel.scrollTop;show(id,{year,full:all});panel.scrollTop=keep;};
    const svg=$('personChart');if(svg)svg.onclick=e=>{const r=svg.getBoundingClientRect(),t=bt+(e.clientX-r.left)/r.width*(et-bt);G.Timeline.pause();G.Timeline.setYear(Math.max(bt,Math.min(et,t)));onYear(G.Timeline.year);};
    if($('personJourneyRange')){$('personJourneyRange').oninput=e=>{stopJourney();scrubbing=true;try{seekJourney(Number(e.target.value));}finally{scrubbing=false;}};$('personJourneyRange').onchange=()=>onYear(G.Timeline.year);$('personJourneyPlay').onclick=()=>journeyRaf?stopJourney():playJourney();updateJourneyControls();}
    app.map?.drawDynamic();
  }
  function rename(p){
    const h=$('personTitle');if(!h)return;h.innerHTML=`<input id="personRenameInput" class="pp-rename-input" maxlength="24" value="${esc(p.name)}" aria-label="新的姓名">`;const input=$('personRenameInput');input.focus();input.select();
    let done=false;const finish=async ok=>{if(done)return;done=true;const name=input.value.replace(/[\u0000-\u001f<>]/g,'').trim();if(ok&&name&&name!==p.name){const parts=G.Life.customName(name);const next={...p,name:parts.full,nameParts:{...parts,original:p.nameParts?.original||p.nameParts?.full||p.name}};app.people=records().map(x=>x.id===p.id?next:x);try{await app.savePeople();}catch(error){app.toast?.(error.message);}}show(p.id,{year:G.Timeline.year,full});};
    input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();finish(true);}else if(e.key==='Escape'){e.preventDefault();e.stopPropagation();finish(false);}};input.onblur=()=>finish(true);
  }
  async function reroll(p){
    const btn=$('personReroll');if(!btn||btn.disabled)return;btn.disabled=true;btn.textContent='推演中…';
    try{const {id,worldKey,seed,...base}=p.request;const req={...base,name:p.nameParts?.source==='custom'?p.name:base.name||''};const next=await create(req,p.id);show(next.id,{year:req.mode==='birth'?dateTime(next,next.birth):G.Timeline.year,full:req.mode==='birth'});}
    catch(error){if(btn.isConnected){btn.textContent='再推一次';btn.disabled=false;}app.toast?.('推演失败：'+error.message.split('\n')[0]);}
  }
  function storyHTML(p,time,all,st){
    if(!st.goal)return'';const state={growing:'成长中',pursuing:'仍在路上',fulfilled:'功成名就',unfinished:'壮志未竟'}[st.status];
    if(!v3(p))return`<section class="pp-story s-${st.status}"><header><b>${esc(st.title)}</b><span>${state}</span></header><p>${esc(st.goal)}</p><div class="pp-tags"><span>${esc(st.temperament)}</span><span>游历 ${st.journeys.length}</span><span>成果 ${st.achievements.length}</span><span>转折 ${st.costs.length}</span></div>${(st.works||[]).map(w=>`<p class="pp-work">留下${esc(w.form)}<b>《${esc(w.title)}》</b></p>`).join('')}</section>`;
    const path=G.LifePaths.BY[p.story.path],ranks=path.ranks;
    const ladder=ranks&&st.rank>=0&&(st.role===p.story.path)?`<ol class="pp-ladder">${ranks.map((r,i)=>`<li class="${i<st.rank?'past':i===st.rank?'on':''}">${esc(r)}</li>`).join('')}</ol>`:'';
    return `<section class="pp-story s-${st.status}"><header><b>${esc(st.title)}</b><span>${state}</span></header><p>${esc(st.goal)}</p>${ladder}<div class="pp-tags"><span>${esc(st.temperament)}</span><span>远行 ${st.journeys.length}</span><span>功业 ${st.achievements.length}</span><span>挫折 ${st.costs.length}</span></div>${(st.works||[]).map(w=>`<p class="pp-work">${esc(w.form)}<b>《${esc(w.title)}》</b></p>`).join('')}</section>`;
  }
  function footprintHTML(p,visible,st){
    if(!v3(p))return'';const cities=new Map(),pols=new Map(),faiths=[];
    cities.set('b',{name:p.birth.place.name,event:p.events[0].id,home:true});
    for(const e of visible){const r=e.result||{};if(e.kind==='migration'&&!cities.has(e.place.kind+e.place.id))cities.set(e.place.kind+e.place.id,{name:e.place.name,event:e.id});if(e.kind==='migration'&&r.owner>=0&&!pols.has(r.polity))pols.set(r.polity,{name:r.polity,event:e.id,served:false});if(r.serving){const x=pols.get(r.serving)||{name:r.serving,event:e.id};x.served=true;pols.set(r.serving,x);}if(e.kind==='religion')faiths.push({name:r.religionName,year:e.date.year,event:e.id});}
    if(cities.size<2&&!faiths.length)return'';
    return `<section class="tf-sec pp-sec pp-foot"><h4><span>阅历</span><small>${cities.size} 城 · ${pols.size} 国 · ${Math.round(st.km).toLocaleString()} 公里</small></h4>
      <div class="pp-chips">${[...cities.values()].slice(0,footAll?999:14).map(c=>`<button class="pp-chip${c.home?' born':''}" data-person-event="${esc(c.event)}" title="${c.home?'出生地':'跳到抵达此地的那一程'}">${esc(c.name)}</button>`).join('')}${cities.size>14?`<button class="pp-chip more" id="personFootMore">${footAll?'收起':'另 '+(cities.size-14)+' 城'}</button>`:''}</div>
      ${pols.size?`<div class="pp-chips pp-pol">${[...pols.values()].map(c=>`<button class="pp-chip${c.served?' served':''}" data-person-event="${esc(c.event)}" title="${c.served?'曾效力于此国':'到过此国'}">${c.served?'<i>仕</i>':''}${esc(c.name)}</button>`).join('')}</div>`:''}
      <p class="pp-faith"><span>信仰</span>${esc(p.birth.religionName)}${faiths.map(f=>` <em>→</em> <button class="tl-link" data-person-event="${esc(f.event)}">${esc(f.name)}</button><small>${f.year}</small>`).join('')}</p></section>`;
  }
  const dateText=d=>`${G.HistoryDate.label(d.year+(d.day-1)/G.Life.calendar(cfg()).daysPerYear)} · 年内第 ${d.day} 日 ${Math.floor(d.hour||0)} 时`;
  function activeJourney(){const p=records().find(x=>x.id===journeyView?.personId);return p?.trajectory.find(t=>t.eventId===journeyView.eventId&&t.journey);}
  function journeyHTML(p,limit){const trip=activeJourney();if(!trip||journeyView.personId!==p.id||trip.journey.departure.year>limit)return'';const j=trip.journey;return`<section class="person-journey"><h4><span>${j.modeId==='march'?'行军':'行程'}</span><small>${esc(j.mode)} · ${esc(j.modeId==='march'?'随大军':j.routeKind==='offroad'?'越野':j.routeKind==='mixed'?'道路与越野':'沿路')}</small></h4><p class="pj-route"><b>${esc(trip.from.name)}</b><em>→</em><b>${esc(trip.to.name)}</b></p><p class="lm-note">${j.km.toFixed(0)} 公里 · ${j.days.toFixed(1)} 世界日<br>出发 ${dateText(j.departure)}<br>到达 ${dateText(j.arrival)}</p><label for="personJourneyRange">沿途进度</label><input id="personJourneyRange" type="range" min="0" max="${j.days}" step="any" value="${journeyView.elapsedDays}"><p id="personJourneyStatus" aria-live="polite"></p><div class="tl-city-acts"><button id="personJourneyPlay">沿路线播放</button></div></section>`;}
  function updateJourneyControls(throttle=false){const trip=activeJourney();if(!trip||!$('personJourneyStatus'))return;const point=G.Navigation.journeyAt(trip,journeyView.elapsedDays);$('personJourneyRange').value=point.elapsedDays;const now=performance.now();if(throttle&&now-lastJourneyLabel<100)return;lastJourneyLabel=now;$('personJourneyStatus').textContent=`${dateText(point.date)} · 已走 ${point.elapsedDays.toFixed(2)} / ${trip.journey.days.toFixed(2)} 世界日`;$('personJourneyPlay').textContent=journeyRaf?'暂停行程':'沿路线播放';}
  function seekJourney(days){const trip=activeJourney();if(!trip)return;journeyView.elapsedDays=Math.max(0,Math.min(trip.journey.days,days));const p=records().find(x=>x.id===journeyView.personId),point=G.Navigation.journeyAt(trip,journeyView.elapsedDays),time=dateTime(p,point.date);if(monthKey(G.Timeline.year)!==monthKey(time))G.Timeline.setYear(time);updateJourneyControls(!!journeyRaf);keepVisible(point);app.map.drawDynamic();}
  function focusPoint(point,zoom){const map=app.map,right=Math.min(map.vw,panel.getBoundingClientRect().left)-24,cx=(Math.min(100,right/3)+right)/2,cy=(map.vh-90)/2,s=map.fitScale()*zoom;map.flyTo(point.x+(map.vw/2-cx)/s,point.y+(map.vh/2-cy)/s,zoom);}
  function focusJourney(trip){const pts=trip.journey.pts;let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;for(let i=0;i<pts.length;i+=2){minX=Math.min(minX,pts[i]);maxX=Math.max(maxX,pts[i]);minY=Math.min(minY,pts[i+1]);maxY=Math.max(maxY,pts[i+1]);}const map=app.map,width=Math.max(80,panel.getBoundingClientRect().left-140),height=Math.max(80,map.vh-160),scale=Math.min(width*.7/Math.max(1,maxX-minX),height*.7/Math.max(1,maxY-minY)),zoom=Math.max(2,Math.min(48,scale/map.fitScale()));focusPoint({x:(minX+maxX)/2,y:(minY+maxY)/2},zoom);}
  function keepVisible(point){const map=app.map;if(map.motion)return;const right=Math.min(map.vw,panel.getBoundingClientRect().left)-24,gx=((point.x%map.W)+map.W)%map.W,visible=map.copies().some(k=>{const [x,y]=map.toScreen(gx+k*map.W,point.y);return x>Math.min(100,right/3)&&x<right&&y>24&&y<map.vh-110;});if(!visible)focusPoint(point,map.zoomRel());}
  function stopJourney(){if(journeyRaf)cancelAnimationFrame(journeyRaf);journeyRaf=0;if($('personJourneyPlay'))$('personJourneyPlay').textContent='沿路线播放';}
  function playJourney(){const trip=activeJourney();if(!trip)return;G.Timeline.pause();if(journeyView.elapsedDays>=trip.journey.days)journeyView.elapsedDays=0;let previous=null;const tick=time=>{if(previous!==null)seekJourney(journeyView.elapsedDays+(time-previous)/1000*Math.max(.1,trip.journey.days/10));previous=time;if(journeyView&&journeyView.elapsedDays<trip.journey.days)journeyRaf=requestAnimationFrame(tick);else{stopJourney();updateJourneyControls();}};journeyRaf=requestAnimationFrame(tick);updateJourneyControls();}
  function focusEvent(id,eventId){const p=records().find(x=>x.id===id);if(!p||!acceptVersion(p))return;const e=p.events.find(x=>x.id===eventId);if(!e)return;if(activeId!==id||view!=='person'||panel.hidden)show(id,{year:G.Life.eventTime(p,e),full});stopJourney();const trip=p.trajectory.find(t=>t.eventId===eventId&&t.journey);journeyView=trip?{personId:id,eventId,elapsedDays:0}:null;G.Timeline.pause();const point=trip?G.Navigation.journeyAt(trip,0):null,year=point?dateTime(p,point.date):G.Life.eventTime(p,e);G.Timeline.setYear(year);const keep=panel.scrollTop;show(id,{year,full});panel.scrollTop=keep;if(trip)focusJourney(trip);else focusPoint(e.place,5);app.map.drawDynamic();}
  function onYear(year){if(scrubbing||!panel||panel.hidden||view!=='person'||monthKey(year)===shownMonth)return;const scroll=panel.scrollTop,sections=new Map([...panel.querySelectorAll('[data-person-section]')].map(el=>[el.dataset.personSection,el.open]));show(activeId,{year,full});for(const el of panel.querySelectorAll('[data-person-section]'))if(sections.has(el.dataset.personSection))el.open=sections.get(el.dataset.personSection);panel.scrollTop=scroll;}
  function current(){return{person:records().find(p=>p.id===activeId)||null,year:shownYear,full,journey:journeyView};}
  function list(){
    stopJourney();view='list';reveal();G.Timeline.personBand?.(null);
    const items=records().map(p=>{const ok=p.version===G.Life.VERSION||p.version===G.Life.LEGACY_VERSION,d=ok&&p.events.find(e=>e.kind==='death'),path=p.version===G.Life.VERSION&&G.LifePaths.BY[p.story.path],ep=path&&G.LifePaths.epithetOf(p.story.path,p.state?.fame||0);
      return `<li><button data-person-record="${esc(p.id)}"><i class="${path?'g-'+esc(path.group):''}">${esc(path?path.icon:p.name.slice(0,1))}</i><span><b>${esc(p.name)}${ep?` <em>「${esc(ep)}」</em>`:''}</b><small>${ok?`${p.birth.year}–${d?d.date.year:'?'} · ${path?esc(path.label)+' · ':''}${esc(p.birth.place.name)}${p.footprint?` · ${p.footprint.cities.length+1} 城`:''}`:'旧版人物 · 当前版本无法打开'}</small></span></button><button class="pp-del${pendingDelete===p.id?' armed':''}" data-person-delete="${esc(p.id)}" title="${pendingDelete===p.id?'再点一次确认删除':'删除这个人物'}" aria-label="删除">${pendingDelete===p.id?'确认删除':'<svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/></svg>'}</button></li>`;}).join('');
    render('已保存人物',records().length?`<p class="tf-none pp-count">${records().length} 位人物 · 点选查看一生</p><ul class="person-list">${items}</ul>`:'<p class="tf-none">在历史地图上点一座当年存在的城市或一个省份，就能在那里生成人物：选好方向，看他随时局走遍天下。</p>');
    panel.scrollTop=0;
    panel.querySelectorAll('[data-person-record]').forEach(b=>b.onclick=()=>{pendingDelete=null;show(b.dataset.personRecord);});
    panel.querySelectorAll('[data-person-delete]').forEach(b=>b.onclick=async()=>{const id=b.dataset.personDelete;if(pendingDelete!==id){pendingDelete=id;list();return;}pendingDelete=null;app.people=records().filter(x=>x.id!==id);if(activeId===id)activeId=null;try{await app.savePeople();}catch(error){app.toast?.(error.message);}list();app.map?.drawDynamic();});
  }
  function draw(c,map,ks,year){
    if(!panel||panel.hidden||view!=='person')return;const p=records().find(x=>x.id===activeId);if(!p)return;const {position,lines,stops}=mapState(p,year);if(!position)return;
    c.save();c.setTransform(map.dpr,0,0,map.dpr,0,0);
    const v=map.view;
    // 走过的城市：小圆点
    c.fillStyle='rgba(141,61,98,.55)';for(const s of stops){const gx=((s.x%map.W)+map.W)%map.W;for(const k of ks){const x=v.x+(k*map.W+gx)*v.s,y=v.y+s.y*v.s;c.beginPath();c.arc(x,y,3.2,0,Math.PI*2);c.fill();}}
    lines.forEach((line,li)=>{const march=line.march,last=li===lines.length-1;c.strokeStyle=march?'#b0402e':'#8d3d62';c.globalAlpha=last?1:.55;c.lineWidth=last?3:2;c.setLineDash(march?[6,4]:[]);const base=Math.floor(line.pts[0]/map.W)*map.W;for(let k=Math.min(...ks)-1;k<=Math.max(...ks)+1;k++){c.beginPath();for(let i=0;i<line.pts.length;i+=2){const x=v.x+(k*map.W+line.pts[i]-base)*v.s,y=v.y+line.pts[i+1]*v.s;i?c.lineTo(x,y):c.moveTo(x,y);}c.stroke();}});
    c.setLineDash([]);c.globalAlpha=1;c.fillStyle='#8d3d62';
    const gx=((position.x%map.W)+map.W)%map.W;for(const k of ks){
      const x=v.x+(k*map.W+gx)*v.s,y=v.y+position.y*v.s;c.beginPath();c.arc(x,y,6,0,Math.PI*2);c.fill();c.font='600 13px sans-serif';c.textAlign='left';c.strokeStyle='#fff';c.lineWidth=4;c.strokeText(p.name,x+10,y-10);c.fillText(p.name,x+10,y-10);
    }c.restore();
  }
  function mapState(p,time){
    const lines=[],stops=[],cutoff=(monthKey(time)+1)/12,selected=activeJourney(),selectedPoint=selected&&G.Navigation.journeyAt(selected,journeyView.elapsedDays),playing=selectedPoint&&monthKey(dateTime(p,selectedPoint.date))===monthKey(time);let position=null;
    for(const t of p.trajectory){
      const e=p.events.find(e=>e.id===t.eventId),march=!!e?.result?.march;
      if(t.journey){const j=t.journey;if(dateTime(p,j.departure)>=cutoff)continue;const partial=playing&&t===selected?selectedPoint:dateTime(p,j.arrival)>=cutoff?G.Navigation.journeyAt(t,Math.max(0,(cutoff-dateTime(p,j.departure))*p.calendar.daysPerYear)):null;
        if(partial){const line=[];for(let i=0;i<j.pointDays.length&&j.pointDays[i]<=partial.elapsedDays;i++)line.push(j.pts[2*i],j.pts[2*i+1]);line.push(partial.x,partial.y);lines.push({pts:line,march});position=partial;break;}
        lines.push({pts:j.pts,march});position=t.to;stops.push(t.to);
      }else{if(e&&(G.Life.eventTime(p,e)>=cutoff))continue;position=t.to;stops.push(t.to);}
    }
    // 只画最近的四十段，避免一生的线路把地图涂满
    return{position,lines:lines.slice(-40),stops};
  }
  function reset(){requestToken++;activeId=null;selection=null;view=null;shownYear=null;shownMonth=null;journeyView=null;pendingDelete=null;hide();}
  G.Person={init,open,show,list,draw,reset,hide,onYear,focusEvent,current};
})(window);
