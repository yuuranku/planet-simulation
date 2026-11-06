/* 战棋图层：按月显示战役。动画只在已记录的行军之间插值。
 * 棋子 —— 每支部队一枚方形算子（兵棋 counter）：国色底、白框、兵种格（交叉线为步兵，守军加城垛横线），下方注兵力；
 * 轨迹 —— 进攻路线：已走过的实线 + 箭头，未走的虚线；撤退为折返的虚线；
 * 交战 —— 接敌 / 交战时在目标处画交叉双刃，围城画一圈围困短线；当月决出胜负时盖“克 / 退”印。 */
(function(G){
  'use strict';
  const indexes=new WeakMap(),paths=new WeakMap(),CELL=34,PAGE=12,month=t=>Math.floor(t*12+1e-7);
  
  let view='here',log={q:'',sort:'recent',big:false,page:0,open:null},app,panel,world=null,time=null,enabled=true,revision=0,drawn=[],selection=null,selected=null,page=0,frame=null,animation=null,raf=0,battles=[];
  function rows(H,t){
    let index=indexes.get(H);if(!index){index=new Map();for(const c of H.military?.campaigns||[])for(let m=month(c.startTime);m<=month(c.endTime);m++){if(!index.has(m))index.set(m,[]);index.get(m).push(c);}indexes.set(H,index);}
    return index.get(month(t))||[];
  }
  function init(a){
    app=a;panel=document.createElement('section');panel.id='militaryPanel';panel.className='card tl-focus military-panel';panel.hidden=true;panel.setAttribute('aria-label','战事记录');document.body.appendChild(panel);
    panel.addEventListener('click',e=>{
      if(e.target.closest('[data-military-close]'))return hide();
      const tab=e.target.closest('[data-mtab]');if(tab){view=tab.dataset.mtab;log.page=0;renderPanel();panel.scrollTop=0;return;}
      const nav=e.target.closest('[data-military-page]');if(nav){const list=currentList(),n=Math.max(1,Math.ceil(list.length/PAGE));if(view==='history'){log.page=Math.max(0,Math.min(n-1,log.page+Number(nav.dataset.militaryPage)));}else{page=Math.max(0,Math.min(n-1,page+Number(nav.dataset.militaryPage)));selected=list[page*PAGE]||selected;}renderPanel();panel.scrollTop=0;revision++;app.map.drawDynamic();return;}
      const go=e.target.closest('[data-mgo]');if(go){const c=world.military.campaigns.find(x=>x.id===go.dataset.mgo);if(c){selected=c;G.Timeline?.pause();G.Timeline?.setYear(Math.min(c.resultTime,c.endTime));fly(c);renderPanel();}return;}
      const row=e.target.closest('[data-mrow]');if(row){log.open=log.open===row.dataset.mrow?null:row.dataset.mrow;selected=world.military.campaigns.find(x=>x.id===log.open)||selected;renderPanel();revision++;app.map.drawDynamic();return;}
      if(e.target.closest('[data-military-fly]')&&selected){fly(selected);return;}
      const summary=e.target.closest('summary'),detail=summary?.parentElement;
      if(detail?.dataset.militaryCampaign){selected=world.military.campaigns.find(c=>c.id===detail.dataset.militaryCampaign)||selected;revision++;app.map.drawDynamic();}
    });
    panel.addEventListener('input',e=>{if(e.target.id==='mlQ'){log.q=e.target.value.trim();log.page=0;clearTimeout(log.t);log.t=setTimeout(()=>{renderPanel();const q=panel.querySelector('#mlQ');if(q){q.focus();q.setSelectionRange(q.value.length,q.value.length);}},220);}});
    panel.addEventListener('change',e=>{if(e.target.id==='mlSort'){log.sort=e.target.value;log.page=0;renderPanel();}if(e.target.id==='mlBig'){log.big=e.target.checked;log.page=0;renderPanel();}});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden){hide();e.preventDefault();}});
  }
  function fly(c){const p=c.route?.points;if(!p?.length)return;const a=p[0],b=p.at(-1);app.map.flyTo((a[0]+b[0])/2,(a[1]+b[1])/2,Math.max(4,app.map.zoomRel()));}
  function stopAnimation(){animation=null;if(raf)cancelAnimationFrame(raf);raf=0;}
  function clear(){stopAnimation();drawn=[];battles=[];selection=null;selected=null;page=0;frame=null;if(panel)panel.hidden=true;revision++;}
  function hide(){selection=null;selected=null;log.open=null;if(panel)panel.hidden=true;revision++;app?.map?.drawDynamic();}
  function reset(){world=null;time=null;enabled=true;clear();}
  function animate(){raf=0;if(!animation)return;if(G.Timeline?.on===false){stopAnimation();return;}app?.map?.drawDynamic();if(performance.now()-animation.start<animation.duration)raf=requestAnimationFrame(animate);else animation=null;}
  function onTime(t,{animate:move=false,duration=420}={}){
    if(t===time)return;const previous=time;time=t;drawn=[];frame=null;stopAnimation();
    if(enabled&&world&&move&&previous!==null&&month(t)-month(previous)===1&&rows(world,t).length){animation={from:previous,start:performance.now(),duration:Math.max(40,Math.min(600,duration))};raf=requestAnimationFrame(animate);}
    if(selection){selection=selection.filter(c=>G.MilitaryUI.atMonth(c,t));if(!selection.length){selection=null;if(view==='here')view='month';}else if(view==='here'&&!selection.includes(selected))selected=selection[0];}
    if(panel&&!panel.hidden&&world&&(view!=='history'||!G.Timeline?.playing))renderPanel();
    revision++;
  }
  function setEnabled(value){if(enabled===!!value)return;enabled=!!value;clear();app?.map?.drawDynamic();}
  const BATTLE_PHASES=['encounter','siege','battle'];
  function monthList(){return world?rows(world,time).filter(c=>c.battle&&G.MilitaryUI.atMonth(c,time)):[];}
  function totalMob(c){return (c.forces?.attacker?.mobilized||0)+(c.forces?.defender?.mobilized||0);}
  function totalDead(c){let n=0;for(const k of ['attacker','defender']){const d=c.forces?.[k]?.deaths;if(d)n+=d.combat+d.disease+d.starvation;}return n;}
  function historyList(){
    const U=G.MilitaryUI,through=(month(time)+1)/12-1e-7,q=log.q;let L=world.military.campaigns.filter(c=>c.battle&&c.resultTime<=through&&(!log.big||totalMob(c)>=1e4));
    if(q)L=L.filter(c=>{const t=c.resultTime;return U.name(world,c.attacker,t).includes(q)||U.name(world,c.defender,t).includes(q)||U.title(world,c,t).includes(q);});
    if(log.sort==='recent')L=L.slice().reverse();else if(log.sort==='size')L=L.slice().sort((a,b)=>totalMob(b)-totalMob(a));else if(log.sort==='deaths')L=L.slice().sort((a,b)=>totalDead(b)-totalDead(a));else if(log.sort==='siege')L=L.filter(c=>c.siege).reverse();
    return L;
  }
  function currentList(){return view==='here'?(selection||[]):view==='month'?monthList():historyList();}
  function logRow(c){
    const U=G.MilitaryUI,t=c.resultTime,won=c.status==='won',open=log.open===c.id;
    return `<li class="ml-item${open?' open':''}"><button class="ml-row" data-mrow="${c.id}"><time>${U.dateShort(t)}</time><span class="ml-main"><b>${esc(U.title(world,c,t))}</b><small><i style="background:${U.colorOf(world,c.attacker)}"></i>${esc(U.name(world,c.attacker,t))} <em>对</em> <i style="background:${U.colorOf(world,c.defender)}"></i>${esc(U.name(world,c.defender,t))}</small></span><span class="ml-num"><b>${U.short(totalMob(c))}</b><small>亡 ${U.short(totalDead(c))}</small></span><span class="ml-seal ${won?'win':'lose'}">${c.siege?(won?(c.siege.outcome==='surrender'?'降':'克'):(c.siege.outcome==='relieved'?'解':'退')):(won?'克':'退')}</span></button>
      ${open?`<div class="ml-open">${U.campaign(world,c,{open:true,time:Math.max(time,c.endTime)})}<div class="tl-city-acts"><button data-mgo="${c.id}">跳到此战并定位</button></div></div>`:''}</li>`;
  }
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function renderPanel(){
    if(!world?.military)return;const scroll=panel.scrollTop,U=G.MilitaryUI;
    if(view==='here'&&!selection?.length)view='month';
    const list=currentList(),pg=view==='history'?log.page:page,n=Math.max(1,Math.ceil(list.length/PAGE)),slice=list.slice(pg*PAGE,(pg+1)*PAGE);
    const month0=monthList(),fighting=month0.filter(c=>BATTLE_PHASES.includes(U.atMonth(c,time)?.phase)).length;
    const tabs=`<nav class="ml-tabs">${selection?.length?`<button data-mtab="here" class="${view==='here'?'on':''}">此处<small>${selection.length}</small></button>`:''}<button data-mtab="month" class="${view==='month'?'on':''}">当月战斗<small>${month0.length}</small></button><button data-mtab="history" class="${view==='history'?'on':''}">历代战役</button></nav>`;
    let body='';
    if(view==='history'){
      const done=world.military.campaigns.filter(c=>c.battle&&c.resultTime<=(month(time)+1)/12),big=done.filter(c=>totalMob(c)>=1e4).length,dead=done.reduce((s,c)=>s+totalDead(c),0);
      body=`<div class="mr-sum ml-sum"><div><b>${done.length.toLocaleString('zh-CN')}</b><small>场交战</small></div><div><b>${big.toLocaleString('zh-CN')}</b><small>万人以上大战</small></div><div><b>${done.filter(c=>c.siege).length.toLocaleString('zh-CN')}</b><small>攻守城</small></div><div><b>${U.short(dead)}</b><small>累计阵亡与病饥</small></div></div>
        <div class="ml-filter"><input id="mlQ" type="search" placeholder="搜国名或地名" value="${esc(log.q)}" autocomplete="off"><select id="mlSort"><option value="recent"${log.sort==='recent'?' selected':''}>最近</option><option value="size"${log.sort==='size'?' selected':''}>规模最大</option><option value="deaths"${log.sort==='deaths'?' selected':''}>伤亡最重</option><option value="siege"${log.sort==='siege'?' selected':''}>只看攻守城</option></select><label><input id="mlBig" type="checkbox"${log.big?' checked':''}>只看大战</label></div>
        <p class="ml-count">${list.length.toLocaleString('zh-CN')} 条记录 · 截至${U.date(time)}</p>
        <ol class="ml-list">${slice.map(logRow).join('')||'<li class="tf-none">没有符合条件的战役。</li>'}</ol>`;
    } else {
      body=`<div class="military-body">${slice.map(c=>U.campaign(world,c,{open:c===selected,time})).join('')||'<p class="tf-none">这个月没有交战。可以切到“历代战役”查看过去的战斗。</p>'}</div>`;
    }
    const pager=list.length>PAGE?`<div class="tl-city-acts mr-pager"><button data-military-page="-1"${pg===0?' disabled':''}>上一页</button><span>${pg+1} / ${n}</span><button data-military-page="1"${pg+1>=n?' disabled':''}>下一页</button></div>`:'';
    panel.innerHTML=`<button class="tl-icon tl-city-x" data-military-close aria-label="关闭战事簿"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
      <header class="tf-head mr-head"><p class="tf-eyebrow"><i></i>战事簿</p><h3>${U.date(time)}</h3><p class="tf-sub">本月 ${month0.length} 场战役${fighting?` · ${fighting} 场正在交战`:''}</p></header>${tabs}${body}${pager}
      ${selected&&view!=='history'?`<footer class="tl-city-acts tf-acts"><button class="pri" data-military-fly>定位所选战役</button></footer>`:''}`;
    panel.hidden=false;panel.scrollTop=scroll;
  }
  function openCampaign(id){if(!world&&G.Timeline?.data)world=G.Timeline.data;const c=world?.military?.campaigns.find(x=>x.id===id);if(!c)return;G.Timeline?.clearDetails();G.Person?.hide();G.City?.close();if(!world.military.campaigns.length)return;if(time===null&&G.Timeline)time=G.Timeline.year;
    const st=G.MilitaryUI.atMonth(c,time);if(st&&c.resultTime>(month(time)+1)/12-1e-7){view='here';selection=[c];selected=c;page=0;renderPanel();revision++;app.map.drawDynamic();return;}
    view='history';log.q='';log.sort='recent';log.big=false;log.open=id;selected=c;const L=historyList(),k=L.indexOf(c);log.page=k<0?0:Math.floor(k/PAGE);renderPanel();revision++;app.map.drawDynamic();requestAnimationFrame(()=>{const row=panel.querySelector('.ml-item.open');if(row)panel.scrollTop=row.offsetTop-80;});}
  function openLog(tab='month'){if(!world&&G.Timeline?.data)world=G.Timeline.data;if(!world?.military)return;G.Timeline?.clearDetails();G.Person?.hide();G.City?.close();view=tab;selection=null;renderPanel();panel.scrollTop=0;}
  function counterSvg(color,side){
    const glyph=side==='attacker'?'<path d="M7.4 4.5 13 9l-5.6 4.5L8.8 9Z" fill="#fff"/>':'<path d="M9 3.8l4 1.4v3.6c0 2.6-2 4.2-4 5-2-.8-4-2.4-4-5V5.2Z" fill="#fff"/>';
    return `<svg viewBox="0 0 34 18" width="30" height="16" aria-hidden="true"><rect x=".5" y=".5" width="33" height="17" rx="3.5" fill="#fffdf7" stroke="rgba(42,38,34,.5)"/><path d="M4 .5h14v17H4a3.5 3.5 0 0 1-3.5-3.5V4A3.5 3.5 0 0 1 4 .5Z" fill="${color}"/>${glyph}<path d="M22 9h8" stroke="#2a2622" stroke-width="2"/></svg>`;
  }
  function hit(sx,sy){
    if(!enabled)return false;
    let marker=[...drawn].reverse().find(m=>m.box&&sx>=m.box.x0-3&&sx<=m.box.x1+3&&sy>=m.box.y0-3&&sy<=m.box.y1+3);
    const battle=marker?null:battles.find(b=>Math.hypot(sx-b.x,sy-b.y)<=13);
    if(!marker&&!battle)return false;
    const entries=marker?marker.entries:battle.entries;
    G.Timeline?.pause();G.Timeline?.clearDetails();G.Person?.hide();G.City?.close();
    selection=[...new Map(entries.map(e=>[e.campaign.id,e.campaign])).values()];selected=selection[0];page=0;view='here';renderPanel();revision++;app?.map?.drawDynamic();return true;
  }
  function ink(H,p,colorOf){if(p<0||!H.polities[p])return '#8c7a5e';return colorOf?colorOf(p,time):`rgb(${H.polities[p].color})`;}
  function route(c,W){
    let path=paths.get(c);if(path)return path;
    const original=c.route?.points;if(!original?.length)return null;const points=[[original[0][0],original[0][1]]],lengths=[0];
    for(let i=1;i<original.length;i++){const previous=points[i-1],raw=original[i];let dx=raw[0]-previous[0];dx-=Math.round(dx/W)*W;points.push([previous[0]+dx,raw[1]]);lengths.push(lengths[i-1]+Math.hypot(dx,raw[1]-previous[1]));}
    path={points,lengths,total:lengths.at(-1)};paths.set(c,path);return path;
  }
  function position(path,progress){
    const target=Math.max(0,Math.min(1,progress))*path.total;let i=1;while(i<path.lengths.length-1&&path.lengths[i]<target)i++;
    if(path.points.length===1)return path.points[0];const a=path.points[i-1],b=path.points[i],f=(target-path.lengths[i-1])/Math.max(1e-10,path.lengths[i]-path.lengths[i-1]);return[a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f];
  }
  function heading(path,progress){const a=position(path,Math.max(0,progress-.04)),b=position(path,Math.min(1,progress+.04));return Math.atan2(b[1]-a[1],b[0]-a[0]);}
  function stateRows(H,t){
    if(frame)return frame;
    frame=rows(H,t).map(campaign=>({campaign,state:G.MilitaryUI.atMonth(campaign,t),before:animation?G.MilitaryUI.atMonth(campaign,animation.from):null})).filter(r=>r.state);return frame;
  }
  const lerp=(old,now,mix)=>old?.active?old.progress+(now.progress-old.progress)*mix:now.progress;
  // 轨迹：已走过的实线 + 箭头；未走的虚线；撤退为折返虚线
  function trails(c,map,ks,records,mix,H,colorOf){
    const v=map.view,sel=selected?.id;
    for(const record of records){
      const cp=record.campaign,a=record.state.attacker;if(!cp.route||!a)continue;const path=route(cp,map.W);if(!path||path.total<.5)continue;
      const on=cp.id===sel,p=lerp(record.before?.attacker,a,mix),retreat=['retreat','ended'].includes(record.state.phase)&&!(cp.status==='won'),peak=retreat?Math.max(p,.88):p;
      const col=dark(ink(H,cp.attacker,colorOf)),lim=path.total*peak,alpha=sel&&!on?.35:1;
      for(const k of ks){
        const ox=v.x+k*map.W*v.s,X=q=>ox+q[0]*v.s,Y=q=>v.y+q[1]*v.s;
        const lo=Math.min(...path.points.map(X)),hi=Math.max(...path.points.map(X));if(hi<-40||lo>map.vw+40)continue;
        c.save();c.globalAlpha=alpha;c.lineCap='round';c.lineJoin='round';
        // 未走的部分
        c.beginPath();c.moveTo(X(path.points[0]),Y(path.points[0]));for(let i=1;i<path.points.length;i++)c.lineTo(X(path.points[i]),Y(path.points[i]));
        c.setLineDash([2,4]);c.lineWidth=on?1.6:1.1;c.strokeStyle='rgba(60,45,35,.5)';c.stroke();c.setLineDash([]);
        // 已走的部分（白色描边 + 国色）
        const end=position(path,peak);c.beginPath();c.moveTo(X(path.points[0]),Y(path.points[0]));for(let i=1;i<path.points.length&&path.lengths[i]<lim;i++)c.lineTo(X(path.points[i]),Y(path.points[i]));c.lineTo(X(end),Y(end));
        c.lineWidth=on?8:6.5;c.strokeStyle='rgba(255,253,247,.75)';c.stroke();c.globalAlpha=alpha*.85;c.lineWidth=on?5:3.8;c.strokeStyle=col;c.stroke();c.globalAlpha=alpha;
        // 箭头：宽头的进军箭
        const ang=heading(path,peak),ex=X(end),ey=Y(end),L=on?13:11,W=on?7:6;
        c.beginPath();c.moveTo(ex+Math.cos(ang)*L*.55,ey+Math.sin(ang)*L*.55);c.lineTo(ex+Math.cos(ang)*-L*.45+Math.cos(ang+Math.PI/2)*W,ey+Math.sin(ang)*-L*.45+Math.sin(ang+Math.PI/2)*W);c.lineTo(ex-Math.cos(ang)*L*.2,ey-Math.sin(ang)*L*.2);c.lineTo(ex+Math.cos(ang)*-L*.45-Math.cos(ang+Math.PI/2)*W,ey+Math.sin(ang)*-L*.45-Math.sin(ang+Math.PI/2)*W);c.closePath();
        c.lineWidth=2;c.strokeStyle='rgba(255,253,247,.95)';c.stroke();c.fillStyle=col;c.fill();
        // 撤退：从最远处折返的虚线
        if(retreat&&p<peak-.01){const back=position(path,p);c.beginPath();c.moveTo(ex,ey);let i=path.points.length-1;while(i>0&&path.lengths[i]>lim)i--;for(;i>0&&path.lengths[i]>path.total*p;i--)c.lineTo(X(path.points[i]),Y(path.points[i]));c.lineTo(X(back),Y(back));c.setLineDash([5,3]);c.lineWidth=2;c.strokeStyle='#8a2f24';c.stroke();c.setLineDash([]);}
        c.restore();
      }
      // 盟军：各自的进军通道，盟国国色细线 + 小箭头（与主力同步推进）
      for(const side of ['attacker','defender'])for(const al of cp.allies?.[side]||[]){
        const ap=route(al,map.W);if(!ap||ap.total<.3)continue;const st=record.state[side],pp=side==='attacker'?p:Math.min(1,Math.max(.15,(st?.progress??1)));const acol=dark(ink(H,al.p,colorOf)),alim=ap.total*pp,aend=position(ap,pp),aang=heading(ap,pp);
        for(const k of ks){const ox=v.x+k*map.W*v.s,X=q=>ox+q[0]*v.s,Y=q=>v.y+q[1]*v.s;
          c.save();c.globalAlpha=alpha;c.lineCap='round';c.lineJoin='round';c.beginPath();c.moveTo(X(ap.points[0]),Y(ap.points[0]));for(let i=1;i<ap.points.length&&ap.lengths[i]<alim;i++)c.lineTo(X(ap.points[i]),Y(ap.points[i]));c.lineTo(X(aend),Y(aend));
          c.lineWidth=5.5;c.strokeStyle='rgba(255,253,247,.75)';c.stroke();c.lineWidth=3;c.setLineDash([7,3]);c.strokeStyle=acol;c.stroke();c.setLineDash([]);
          const ex=X(aend),ey=Y(aend),L=9,Wd=5;c.beginPath();c.moveTo(ex+Math.cos(aang)*L*.55,ey+Math.sin(aang)*L*.55);c.lineTo(ex-Math.cos(aang)*L*.45+Math.cos(aang+Math.PI/2)*Wd,ey-Math.sin(aang)*L*.45+Math.sin(aang+Math.PI/2)*Wd);c.lineTo(ex-Math.cos(aang)*L*.45-Math.cos(aang+Math.PI/2)*Wd,ey-Math.sin(aang)*L*.45-Math.sin(aang+Math.PI/2)*Wd);c.closePath();c.lineWidth=1.6;c.strokeStyle='rgba(255,253,247,.95)';c.stroke();c.fillStyle=acol;c.fill();c.restore();}
      }
    }
  }
  // 交战标记：交叉双刃；围城外加一圈围困短线；当月决出胜负盖印
  function findBattles(map,ks,records){
    const v=map.view,m=month(time),seen=new Map();battles=[];
    for(const record of records){
      const cp=record.campaign,phase=record.state.phase,fighting=['encounter','siege','battle'].includes(phase),decided=cp.battle&&month(cp.resultTime)===m;
      if(!fighting&&!decided)continue;const path=route(cp,map.W);if(!path)continue;
      const at=position(path,cp.battle?.kind==='siege'?1:.94),gx=((at[0]%map.W)+map.W)%map.W;
      for(const k of ks){const x=v.x+(gx+k*map.W)*v.s,y=v.y+at[1]*v.s;if(x<-30||x>map.vw+30||y<-30||y>map.vh+30)continue;
        const key=Math.round(x/22)+','+Math.round(y/22);let b=seen.get(key);if(!b){b={x,y,entries:[],siege:false,fighting:false,won:0,lost:0};seen.set(key,b);battles.push(b);}
        b.entries.push({campaign:cp});if(cp.battle?.kind==='siege')b.siege=true;if(fighting)b.fighting=true;if(decided&&record.state.finished!==false&&phase!=='battle'){cp.status==='won'?b.won++:b.lost++;}}
    }
    return battles;
  }
  // 交叉双刀（历史地图的战场符号）
  function sabres(c,x,y,k,col){
    c.save();c.translate(x,y);c.lineCap='round';c.lineJoin='round';
    const blade=()=>{c.beginPath();c.moveTo(-k*.78,k*.78);c.quadraticCurveTo(-k*.05,k*.25,k*.82,-k*.86);};
    const hilt=()=>{c.beginPath();c.moveTo(-k*.78,k*.38);c.lineTo(-k*.38,k*.78);c.moveTo(-k*.95,k*.95);c.lineTo(-k*.66,k*.66);};
    for(const pass of [0,1]){c.strokeStyle=pass?col:'rgba(255,253,247,.95)';for(const sx of [1,-1]){c.save();c.scale(sx,1);c.lineWidth=pass?2:5;blade();c.stroke();c.lineWidth=pass?1.7:4.6;hilt();c.stroke();c.restore();}}
    c.restore();
  }
  function drawBattles(c,map){
    for(const b of battles){
      const {x,y}=b,on=selected&&b.entries.some(e=>e.campaign.id===selected.id);
      c.save();
      if(b.fighting||on){const g=c.createRadialGradient(x,y,2,x,y,18);g.addColorStop(0,on?'rgba(26,115,232,.28)':'rgba(190,52,36,.32)');g.addColorStop(1,'rgba(190,52,36,0)');c.fillStyle=g;c.beginPath();c.arc(x,y,18,0,7);c.fill();}
      if(b.siege){c.beginPath();c.arc(x,y,13,0,7);c.setLineDash([2.5,2.5]);c.lineWidth=1.6;c.strokeStyle='#9b2a1f';c.stroke();c.setLineDash([]);}
      sabres(c,x,y,on?8.5:7.5,b.fighting?'#9b2a1f':'#4b3a2c');
      const tag=b.fighting?(b.siege?'围城':'交战'):b.won>=b.lost&&b.won?'攻克':b.lost?'击退':'';
      if(tag){c.font='600 10px "Songti SC","STSong","Noto Serif SC",serif';c.textAlign='center';c.textBaseline='top';c.lineWidth=3;c.strokeStyle='rgba(255,253,247,.95)';const t=tag+(b.entries.length>1?' ×'+b.entries.length:'');c.strokeText(t,x,y+11);c.fillStyle=b.fighting||b.won>=b.lost?'#9b2a1f':'#55606a';c.fillText(t,x,y+11);}
      c.restore();
    }
  }
  // 棋子：一枚标签式算子——左侧国色方块（攻方画行进箭头、守方画盾），右侧注兵力
  function dark(col,k=.62){const m=/rgba?\((\d+)\D+(\d+)\D+(\d+)/.exec(col);return m?`rgb(${Math.round(m[1]*k)},${Math.round(m[2]*k)},${Math.round(m[3]*k)})`:col;}
  function rr(c,x,y,w,h,r){c.beginPath();if(c.roundRect)c.roundRect(x,y,w,h,r);else c.rect(x,y,w,h);}
  const PH=18;
  function counter(c,x,y,{colors,side,label,stack,active,engaged,ang,align='center'}){
    const attack=side==='attacker';c.save();
    c.font='600 11px -apple-system,"PingFang SC","Noto Sans SC",sans-serif';const text=stack>1?`${stack} 部 · ${label}`:label,tw=Math.ceil(c.measureText(text).width),w=PH+tw+10;
    const left=align==='right'?x-w:align==='left'?x:x-w/2,top=y-PH/2;
    if(stack>1){rr(c,left+3,top-3,w,PH,4);c.fillStyle='#fffdf7';c.fill();c.lineWidth=1;c.strokeStyle='rgba(42,38,34,.35)';c.stroke();}
    if(active){rr(c,left-3,top-3,w+6,PH+6,6);c.fillStyle='rgba(26,115,232,.14)';c.fill();c.lineWidth=1.6;c.strokeStyle='rgba(26,115,232,.9)';c.stroke();}
    c.shadowColor='rgba(30,20,10,.28)';c.shadowBlur=4;c.shadowOffsetY=1;rr(c,left,top,w,PH,4);c.fillStyle='#fffdf7';c.fill();c.shadowColor='transparent';
    // 国色方块
    c.save();rr(c,left,top,w,PH,4);c.clip();c.fillStyle=colors[0];c.fillRect(left,top,PH,PH);if(colors[1]){c.fillStyle=colors[1];c.beginPath();c.moveTo(left+PH,top);c.lineTo(left+PH,top+PH);c.lineTo(left+PH*.55,top+PH);c.closePath();c.fill();}c.restore();
    rr(c,left,top,w,PH,4);c.lineWidth=engaged?1.6:1;c.strokeStyle=engaged?'#9b2a1f':'rgba(42,38,34,.55)';c.stroke();
    const cx=left+PH/2,cy=y;c.fillStyle='#fff';c.strokeStyle=dark(colors[0],.45);c.lineWidth=1.2;c.lineJoin='round';
    if(attack){const a=Number.isFinite(ang)?ang:0,L=5.6;c.beginPath();c.moveTo(cx+Math.cos(a)*L,cy+Math.sin(a)*L);c.lineTo(cx+Math.cos(a+2.45)*L,cy+Math.sin(a+2.45)*L);c.lineTo(cx-Math.cos(a)*L*.25,cy-Math.sin(a)*L*.25);c.lineTo(cx+Math.cos(a-2.45)*L,cy+Math.sin(a-2.45)*L);c.closePath();c.stroke();c.fill();}
    else{c.beginPath();c.moveTo(cx,cy-5.5);c.lineTo(cx+4.6,cy-3.8);c.lineTo(cx+4.6,cy+.4);c.quadraticCurveTo(cx+4.2,cy+4,cx,cy+5.8);c.quadraticCurveTo(cx-4.2,cy+4,cx-4.6,cy+.4);c.lineTo(cx-4.6,cy-3.8);c.closePath();c.stroke();c.fill();}
    c.textAlign='left';c.textBaseline='middle';c.fillStyle=engaged?'#8a2418':'#2a2622';c.fillText(text,left+PH+5,y+.5);
    c.restore();return {x0:left,y0:top,x1:left+w,y1:top+PH};
  }
  function draw(c,map,ks,t,H,colorOf,filter){
    if(world!==H){world=H;time=null;clear();}onTime(t);drawn=[];battles=[];if(!enabled||!H?.military)return drawn;
    const records=filter?stateRows(H,t).filter(r=>filter(r.campaign)):stateRows(H,t),mix=animation?Math.min(1,(performance.now()-animation.start)/animation.duration):1,points=new Map(),v=map.view;
    for(const record of records)for(const side of ['attacker','defender']){
      const {campaign,state:current,before}=record,state=current[side];if(!state?.active||!(state.remaining>0))continue;
      const path=route(campaign,map.W);if(!path)continue;const progress=lerp(before?.[side],state,mix),pos=position(path,progress),gx=((pos[0]%map.W)+map.W)%map.W,gy=pos[1],ang=heading(path,progress);
      for(const k of ks){const x=v.x+(gx+k*map.W)*v.s,yy=v.y+gy*v.s;if(x<-30||x>map.vw+30||yy<-30||yy>map.vh+30)continue;
        const key=side+':'+Math.round(x)+','+Math.round(yy);let point=points.get(key);if(!point){point={x,y:yy,side,entries:[]};points.set(key,point);}point.entries.push({campaign,side,state,force:campaign.forces[side],polity:campaign[side],phase:current.phase,events:current.events,ang});
      }
    }
    // 同侧、相近的棋子叠成一摞
    const nodes=[...points.values()],parent=nodes.map((_,i)=>i),bins=new Map(),find=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
    nodes.forEach((p,i)=>{const bx=Math.floor(p.x/CELL),by=Math.floor(p.y/CELL);for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(const j of bins.get(p.side+(bx+dx)+','+(by+dy))||[])if(Math.hypot(p.x-nodes[j].x,p.y-nodes[j].y)<CELL)parent[find(i)]=find(j);const key=p.side+bx+','+by;if(!bins.has(key))bins.set(key,[]);bins.get(key).push(i);});
    const groups=new Map();nodes.forEach((p,i)=>{const key=find(i);if(!groups.has(key))groups.set(key,{x:0,y:0,n:0,side:p.side,entries:[]});const g=groups.get(key);g.x+=p.x;g.y+=p.y;g.n++;g.entries.push(...p.entries);});
    const markers=[...groups.values()].map(g=>({x:g.x/g.n,y:g.y/g.n,side:g.side,entries:g.entries}));
    // 攻守同处时左右错开，避免压在一起
    // 布阵：交战点两侧，攻方在左、守方在右，与交战标记同一水平线
    findBattles(map,ks,records);
    for(const b of battles){const near=markers.filter(m=>Math.hypot(m.x-b.x,m.y-b.y)<46&&m.entries.some(e=>b.entries.some(x=>x.campaign===e.campaign)));for(const m of near){m.x=b.x+(m.side==="attacker"?-1:1)*(b.siege?17:13);m.y=b.y;m.atBattle=true;m.align=m.side==="attacker"?'right':'left';}}
    for(const a of markers)for(const d of markers)if(a!==d&&a.side==='attacker'&&d.side==='defender'&&!a.atBattle&&!d.atBattle&&Math.abs(a.x-d.x)<60&&Math.abs(a.y-d.y)<PH+4){a.x-=4;a.align='right';d.x+=4;d.align='left';d.y=a.y=(a.y+d.y)/2;}
    c.save();c.setTransform(map.dpr,0,0,map.dpr,0,0);
    trails(c,map,ks,records,mix,H,colorOf);
    markers.sort((a,b)=>a.y-b.y);
    for(const marker of markers){
      const entries=marker.entries,colors=[...new Set(entries.map(e=>ink(H,e.polity,colorOf)))].slice(0,3),stack=new Set(entries.map(e=>e.campaign.id)).size;
      const active=!!(selected&&entries.some(e=>e.campaign.id===selected.id)),engaged=entries.some(e=>['encounter','siege','battle'].includes(e.phase));
      const n=entries.reduce((s,e)=>s+e.state.remaining,0),label=G.MilitaryUI.short(n);
      marker.box=counter(c,marker.x,marker.y,{colors,side:marker.side,label,stack,active,engaged,ang:marker.atBattle?(marker.side==='attacker'?0:Math.PI):entries[0].ang,align:marker.align});drawn.push(marker);
    }
    drawBattles(c,map);
    c.restore();
    return drawn;
  }
  G.MilitaryMap={openLog,openCampaign,get open(){return !!panel&&!panel.hidden;},init,draw,hit,onTime,reset,hide,setEnabled,get enabled(){return enabled;},get revision(){return revision;}};
})(window);
