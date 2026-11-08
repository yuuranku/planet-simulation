/* 战事记录：只读的战役档案。所有结果由推演给出，这里只负责把它写成一份军事记录。
 * 一场战役 = 一张战报：对阵图（中军、左右翼、后军；围城画城墙与援军；设伏、奇袭、迂回各有画法）
 * → 双方兵力与军制 → 士气 / 训练 / 装备 / 补给对比 → 战役经过（阶段进度 + 逐条战报）→ 部队构成与军需。 */
(function (G) {
  'use strict';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const count=n=>Math.round(n||0).toLocaleString('zh-CN'),month=t=>Math.floor(t*12+1e-7);
  const short=n=>{n=Math.round(n||0);return n>=1e4?(n/1e4).toFixed(n>=1e5?0:1)+'万':n.toLocaleString('zh-CN');};
  const date=t=>`第 ${Math.floor(month(t)/12)} 年 · ${month(t)%12+1} 月`;
  const dateShort=t=>`${Math.floor(month(t)/12)}.${String(month(t)%12+1).padStart(2,'0')}`;
  const cutoff=t=>(month(t)+1)/12-1e-7;
  const atMonth=(c,t,options)=>G.Military.atTime(c,cutoff(t),options);
  const OBJECTIVES={border:'边境争夺',city:'夺取城邑',homeland:'收复故土','holy-war':'宗教战争'};
  const REASONS={objective:'达成作战目标',repelled:'攻势被击退',supply:'军需不足，停止进攻',mobilization:'可征召人口已用尽，未能出兵',unreachable:'无法在战役期限内往返','changed-control':'目标或出发地已经易主',naval:'海战失利，未能登陆'};
  const PHASES={muster:'集结',march:'行军',naval:'渡海',encounter:'接敌',siege:'围城',battle:'交战',retreat:'撤退',occupation:'占领',ended:'收兵',aborted:'取消'};
  const STEPS=[['muster','集结'],['march','行军'],['contact','接敌'],['battle','交战'],['result','结局'],['ended','收兵']];
  const STEP_OF={muster:0,march:1,naval:2,encounter:2,siege:2,battle:3,occupation:4,retreat:4,ended:5,aborted:0};
  const SIEGE_OUT={surrender:'开城投降',open:'不战而下',stormed:'城破',starved:'粮尽城降',relieved:'援军解围','relief-routed':'援军败北 · 城破',repulsed:'久攻不克',lifted:'撤围'};
  const POSTURE={hold:'坚守不出',surrender:'开城投降',sally:'出城逆袭',open:'无兵可守'};
  const phaseLabel=phase=>PHASES[phase]||phase;
  const U=()=>G.Military.UNITS, SY=()=>G.Military.SYSTEMS;
  const unitName=k=>U()[k]?.name||k, sysName=k=>SY()[k]?.name||'—';
  const placeIndexes=new WeakMap();
  function placeName(H,region,time,empty){
    let index=placeIndexes.get(H);
    if(!index){const cities=new Map();for(const city of H.cities){if(!cities.has(city.r))cities.set(city.r,[]);cities.get(city.r).push(city);}index={cities,month:null,names:new Map()};placeIndexes.set(H,index);}
    const key=month(time);if(index.month!==key){index.month=key;index.names.clear();}
    if(!index.names.has(region)){
      const at=cutoff(time),Q=G.HistoryQuery;let value=null;
      for(const city of index.cities.get(region)||[]){if(Q.exists(city,at))value=Q.rowAt(city.names,at)?.[1];if(value)break;}
      if(!value){const province=H.provinces[Q.logAt(H.provLog,region,at)];if(province&&province.created<=at&&(province.abolished==null||at<province.abolished))value=Q.rowAt(province.names,at)?.[1];}
      index.names.set(region,value||null);
    }
    return index.names.get(region)||empty;
  }
  function name(H,p,time){
    if(p<0)return '当地守军';const q=H.polities[p];if(!q)return '政权 '+p;
    let value='政权 '+p;for(const row of q.names||[]){if(row[0]>time)break;value=row[1];}return value;
  }
  const colorOf=(H,p)=>p>=0&&H.polities[p]?`rgb(${H.polities[p].color})`:'#9b8b72';
  const rgbOf=(H,p)=>p>=0&&H.polities[p]?H.polities[p].color:[155,139,114];
  const tint=(c,k)=>`rgb(${c.map(v=>Math.round(v+(255-v)*k)).join(',')})`, shade=(c,k)=>`rgb(${c.map(v=>Math.round(v*k)).join(',')})`;
  // 军制与常备兵的查询（推演日志只读）
  function msysAt(H,p,t){const L=H.polities[p]?.msys;if(!L?.length)return null;let v=L[0][1];for(const x of L){if(x[0]>t)break;v=x[1];}return v;}
  const armyIdx=new WeakMap();
  function armyOf(H,p){let m=armyIdx.get(H);if(!m){m=new Map();for(const a of H.military?.armies||[])m.set(a.p,a);armyIdx.set(H,m);}return m.get(p)||null;}
  function armyAt(H,p,t){const a=armyOf(H,p);if(!a)return null;const q=H.polities[p];if(q&&(t<q.born||(q.died!=null&&t>q.died)))return null;let row=null;for(const x of a.log){if(x[0]>t)break;row=x;}return row?{year:row[0],sys:row[1],total:row[2],stations:row[3].map(([r,n,unit])=>({r,n,unit}))}:null;}
  function movesAt(H,p,t,span=1){const a=armyOf(H,p);return a?a.moves.filter(m=>m[0]<=t&&t<m[0]+span).map(([at,from,to,n,unit])=>({at,from,to,n,unit})):[];}
  const siegeIdx=new WeakMap();
  function siegesOf(H,ci){let m=siegeIdx.get(H);if(!m){m=new Map();for(const c of H.military?.campaigns||[])if(c.siege&&c.siege.city>=0){if(!m.has(c.siege.city))m.set(c.siege.city,[]);m.get(c.siege.city).push(c);}siegeIdx.set(H,m);}return m.get(ci)||[];}
  // 一座城某时的守军：城防兵（按城市人口与军制）+ 驻在本区的常备兵 + 本区关堡戍卒
  function garrisonOf(H,{region,owner,pop,capital,time,walls=true}){
    if(owner<0)return null;const sys=msysAt(H,owner,time)||'levy';
    const watch=walls?G.Military.cityGarrison(pop,sys,capital):0;
    const army=armyAt(H,owner,time),standing=(army?.stations||[]).filter(s=>s.r===region);
    let fort=0;for(const f of H.forts||[]){if(f.region!==region)continue;const st=G.FortLifecycle?.at(f,time);if(st?.status!=='active')continue;const g=G.FortLifecycle.guardAt(f,time);if(g&&g[3]===owner)fort+=g[1]||0;}
    const sn=standing.reduce((s,x)=>s+x.n,0);return {sys,watch,standing,fort,total:watch+sn+fort};
  }
  // 一场战役的称呼：以战地命名。战地无名时借最近的城邑与方位（某城以北、某城东南），再按战法与规模取名（渡口之战、夜袭、会战……），同名者依次称“第二次……”
  const DIR8=['东','东南','南','西南','西','西北','北','东北'],CN=['','','二','三','四','五','六','七','八','九','十'];
  const titleCache=new WeakMap();
  // 地理名称（平原、盆地、高原、丘陵、山脉、半岛、湖……）：战地无城可名时，借山川之名
  const GEO_KIND={plain:1,basin:1,plateau:1,hills:1,range:1,ridge:1,peninsula:1,lake:1,snow:1,island:1};
  const geoIdx=new WeakMap();
  function geoOf(){const d=G.app?.data;if(!d?.labels)return [];let L=geoIdx.get(d);if(!L){L=d.labels.filter(l=>GEO_KIND[l.type]&&l.name&&Number.isFinite(l.x));geoIdx.set(d,L);}return L;}
  const unnamed=n=>!n||/^未命名/.test(n);
  function anchorOf(H,region,time){
    const own=placeName(H,region,time,null);if(own&&!unnamed(own))return{name:own,local:true};
    const at=cutoff(time),Q=G.HistoryQuery;
    for(const f of H.forts||[])if(f.region===region&&f.year<=at&&f.name&&!unnamed(f.name))return{name:f.name,local:true,fort:true};
    if(!(region>0)||!H.cx)return null;
    const W=H.FW||(H.W||0)*2,spacing=Math.sqrt(W*(H.H||1)*2/Math.max(1,H.nR||1)),x0=H.cx[region],y0=H.cy[region];
    const wrap=dx=>{if(W){if(dx>W/2)dx-=W;if(dx<-W/2)dx+=W;}return dx;};
    // 1. 身处某片平原、山地之中：直接以山川为名
    let geo=null,gd=Infinity;for(const l of geoOf()){const dx=wrap(x0-l.x),dy=y0-l.y,r=Math.max(spacing*1.2,Math.sqrt(l.size||1)*1.4),d=Math.hypot(dx,dy)/r;if(d<gd){gd=d;geo=l;}}
    if(geo&&gd<1)return{name:geo.name,local:true,geo:geo.type};
    // 2. 附近的城邑 + 方位
    let best=null,bd=Infinity;
    for(const city of H.cities){if(!Q.exists(city,at))continue;const nm=Q.rowAt(city.names,at)?.[1]||city.name;if(unnamed(nm))continue;const dx=wrap(x0-city.x),dy=y0-city.y,d=dx*dx+dy*dy;if(d<bd){bd=d;best={nm,dx,dy};}}
    if(best&&Math.sqrt(bd)<=spacing*5){
      const dir=DIR8[((Math.round(Math.atan2(best.dy,best.dx)/(Math.PI/4))%8)+8)%8],near=Math.sqrt(bd)<spacing*1.6;
      return{name:dir.length>1?`${best.nm}${dir}`:near?`${best.nm}${dir}郊`:`${best.nm}以${dir}`,local:false};
    }
    // 3. 稍远的山川
    if(geo&&gd<2.5)return{name:geo.name,local:true,geo:geo.type};
    return null;
  }
  function baseTitle(H,c){
    const time=c.resultTime??c.startTime,a=anchorOf(H,c.target,time);
    if(!a)return c.defender>=0?`${name(H,c.attacker,time)}伐${name(H,c.defender,time).replace(/(帝国|王国|公国|国)$/,'')}之役`:`${name(H,c.attacker,time)}远征`;
    const p=a.name;
    if(!c.forces||!c.battle)return `${p}出兵`;
    if(c.battle.kind==='naval')return `${p}海战`;
    if(c.naval?.fought&&c.naval.won)return c.siege?`${p}登陆围城战`:`${p}海战与登陆`;
    if(c.naval)return c.siege?`${p}渡海围城战`:`${p}登陆战`;
    if(c.battle.kind==='siege')return c.siege?.fort&&!c.siege?.walls?`${a.fort?p:p+'关堡'}之战`:`${p}围城战`;
    const tac=new Map((c.tactics||[]).map(t=>[t.id,t])),mob=(c.forces.attacker?.mobilized||0)+(c.forces.defender?.mobilized||0);
    if(tac.has('ambush'))return /渡口|半渡/.test(tac.get('ambush').detail||'')?`${p}渡口之战`:a.geo==='range'||a.geo==='ridge'||a.geo==='hills'?`${p}山道伏击战`:`${p}伏击战`;
    if(tac.has('supply-raid')&&c.status!=='won'&&(tac.get('supply-raid').effect?.attackerShortage||0)>=.2)return `${p}粮道之战`; // 断粮而退，才以粮道为名
    if(tac.has('surprise'))return `${p}夜袭`;
    if(tac.has('feigned-retreat'))return `${p}诱敌之战`;
    if(mob>=60000)return `${p}会战`;
    if(mob<2500)return `${p}遭遇战`;
    let hsh=0;for(const ch of String(c.id))hsh=(hsh*31+ch.charCodeAt(0))|0;
    return Math.abs(hsh)%3===0?`${p}之役`:`${p}之战`;
  }
  function title(H,c){
    let m=titleCache.get(H);
    if(!m){m=new Map();const list=[...(H.military?.campaigns||[])].sort((a,b)=>(a.resultTime??a.startTime)-(b.resultTime??b.startTime)),seen=new Map();
      // 同名战役：前五次称“第二次……”，再多就冠以年份
      for(const x of list){const b=baseTitle(H,x),n=(seen.get(b)||0)+1;seen.set(b,n);m.set(x.id,n===1?b:n<=5?`第${CN[n]}次${b}`:`${Math.floor(x.resultTime??x.startTime)} 年${b}`);}titleCache.set(H,m);}
    return m.get(c.id)||baseTitle(H,c);
  }
  function verdict(c,state,perspective){
    if(!state?.finished)return {k:'live',t:state?.phase==='naval'?(c.naval?.fought?'海战中':'渡海中'):state?.phase==='muster'||state?.phase==='march'?(c.naval?'舰队航行中':'进军中'):c.battle?.kind==='siege'?'围城中':'交战中'};
    if(!c.battle)return {k:'void',t:'未战'};
    const attackerWon=c.status==='won';
    if(perspective===undefined)return attackerWon?{k:'win',t:c.siege?SIEGE_OUT[c.siege.outcome]||'攻克':'攻克'}:{k:'lose',t:c.siege?SIEGE_OUT[c.siege.outcome]||'击退':'击退'};
    const won=perspective===c.attacker?attackerWon:!attackerWon;return won?{k:'win',t:'胜'}:{k:'lose',t:'败'};
  }

  // ---------- 对阵图 ----------
  // 把一方的部队排成 左翼 / 中军 / 右翼 / 后军：骑兵居两翼，常备精兵居中军，素质最差的应召兵为后军
  function arrange(force,state){
    const k=state&&force.mobilized?state.remaining/force.mobilized:1,total=Math.max(0,state?state.remaining:force.mobilized);
    const units=new Map();for(const g of force.groups){const u=units.get(g.unit)||{unit:g.unit,n:0,standing:false,role:g.role};u.n+=g.mobilized*k;if(g.role==='standing')u.standing=true;units.set(g.unit,u);}
    const L=[...units.values()].filter(u=>u.n>=1),UN=U();
    const q=u=>(UN[u.unit]?.t||.2)+(u.standing?.3:0);
    const cav=L.filter(u=>UN[u.unit]?.arm==='cav').sort((a,b)=>q(b)-q(a)),inf=L.filter(u=>UN[u.unit]?.arm!=='cav').sort((a,b)=>q(b)-q(a));
    const horse=force.horse?.16:0,slots={left:[],center:[],right:[],rear:[]},want={center:.42*total,left:.21*total,right:.21*total};
    const put=(slot,u,n)=>{if(n<1)return;const s=slots[slot].find(x=>x.unit===u.unit);if(s)s.n+=n;else slots[slot].push({unit:u.unit,n,standing:u.standing,cav:UN[u.unit]?.arm==='cav'});};
    const fill=(slot,u,limit)=>{const have=slots[slot].reduce((s,x)=>s+x.n,0),n=Math.min(u.left,Math.max(0,limit-have));put(slot,u,n);u.left-=n;};
    for(const u of L)u.left=u.n;
    // 骑兵分居两翼；有骑兵战法的步兵军队也拨出一部分骑兵到两翼
    for(const u of cav){const h=u.left/2;put('left',u,h);put('right',u,u.left-h);u.left=0;}
    for(const u of inf)fill('center',u,want.center);
    for(const u of inf){fill('left',u,want.left);fill('right',u,want.right);}
    for(const u of inf)if(u.left>=1){put('rear',u,u.left);u.left=0;}
    if(horse)for(const side of ['left','right']){const s=slots[side],n=s.reduce((a,x)=>a+x.n,0);if(n&&!s.some(x=>x.cav))s.push({unit:'_horse',n:Math.min(n*.5,total*horse/2),cav:true});}
    const sum=s=>s.reduce((a,x)=>a+x.n,0);
    return Object.fromEntries(Object.entries(slots).map(([k2,s])=>[k2,{n:Math.round(sum(s.filter(x=>x.unit!=='_horse')))||0,units:s.filter(x=>x.unit!=='_horse').sort((a,b)=>b.n-a.n),cav:s.some(x=>x.cav),standing:s.some(x=>x.standing)}]));
  }
  // 一枚兵棋式的部队方块：左侧兵种符号（步兵交叉、骑兵斜线、常备双框），右侧兵力
  function block(x,y,w,h,col,b,{label='',dash=false,fade=false,sub=true}={}){
    if(!b||b.n<1)return '';
    const fill=tint(col,.62),line=shade(col,.55),s=Math.min(h-6,14),sx=x+4,sy=y+(h-s)/2,sw=s*1.4;
    const sym=b.cav?`<path d="M${sx} ${sy+s}L${sx+sw} ${sy}"/>`:`<path d="M${sx} ${sy}L${sx+sw} ${sy+s}M${sx} ${sy+s}L${sx+sw} ${sy}"/>`;
    const names=b.units.slice(0,2).map(u=>unitName(u.unit)).join('·');
    return `<g class="fb${fade?' fade':''}"${dash?' stroke-dasharray="3 2"':''}>
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${fill}" stroke="${line}" stroke-width="${b.standing?1.6:1.1}"/>
      ${b.standing?`<rect x="${x+2.2}" y="${y+2.2}" width="${w-4.4}" height="${h-4.4}" rx="1.6" fill="none" stroke="${line}" stroke-width=".7"/>`:''}
      <g stroke="${line}" stroke-width="1.05" fill="none"><rect x="${sx}" y="${sy}" width="${sw}" height="${s}" fill="#fff"/>${sym}</g>
      <text x="${x+w-5}" y="${y+h/2+3.6}" text-anchor="end" class="fb-n">${short(b.n)}</text>
      ${label?`<text x="${x+w/2}" y="${y-4}" text-anchor="middle" class="fb-l">${esc(label)}</text>`:''}
      ${sub&&names?`<text x="${x+w/2}" y="${y+h+10}" text-anchor="middle" class="fb-u">${esc(names)}</text>`:''}</g>`;
  }
  const arrow=(d,col,{dash=false,w=2.2,head=true}={})=>`<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${dash?' stroke-dasharray="4 3"':''}${head?' marker-end="url(#mh)"':''} style="color:${col}"/>`;
  function sabres(x,y,k=7){return `<g transform="translate(${x} ${y})" stroke="#b4342a" stroke-width="1.8" stroke-linecap="round" fill="none"><path d="M${-k} ${k}Q0 ${k*.2} ${k} ${-k}M${k} ${k}Q0 ${k*.2} ${-k} ${-k}"/><path d="M${-k} ${k*.45}L${-k*.45} ${k}M${k} ${k*.45}L${k*.45} ${k}" stroke-width="1.5"/></g>`;}
  function sideTag(x,y,col,text,anchor='start'){return `<g><rect x="${anchor==='start'?x:x-8}" y="${y-7}" width="8" height="8" rx="2" fill="rgb(${col.join(',')})"/><text x="${anchor==='start'?x+12:x-12}" y="${y}" text-anchor="${anchor}" class="fb-side">${esc(text)}</text></g>`;}
  function wall(x,y,w,h,level,col){
    // 城墙：外框 + 垛口；都城加一重外郭；城门在下方正中
    const m=[];for(let i=x+4;i<x+w-4;i+=8)m.push(`M${i} ${y}v-4h4v4`);
    const gx=x+w/2;
    return `${level>=3?`<rect x="${x-7}" y="${y-7}" width="${w+14}" height="${h+14}" rx="3" fill="none" stroke="#8a8378" stroke-width="1.2" stroke-dasharray="1 0"/>`:''}
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="#f7f5f1" stroke="#6c665d" stroke-width="${level>=2?3.2:2.4}"/>
      <path d="${m.join('')}" fill="none" stroke="#6c665d" stroke-width="1.4"/>
      <rect x="${x-5}" y="${y-5}" width="10" height="10" fill="#fff" stroke="#6c665d" stroke-width="1.4"/><rect x="${x+w-5}" y="${y-5}" width="10" height="10" fill="#fff" stroke="#6c665d" stroke-width="1.4"/>
      <rect x="${x-5}" y="${y+h-5}" width="10" height="10" fill="#fff" stroke="#6c665d" stroke-width="1.4"/><rect x="${x+w-5}" y="${y+h-5}" width="10" height="10" fill="#fff" stroke="#6c665d" stroke-width="1.4"/>
      <rect x="${gx-9}" y="${y+h-6}" width="18" height="12" fill="#fff" stroke="#6c665d" stroke-width="1.4"/><path d="M${gx-4} ${y+h+6}v-5a4 4 0 0 1 8 0v5" fill="#e8e3da" stroke="#6c665d" stroke-width="1"/>`;
  }
  function fortShape(cx,cy,r){const pts=[];for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,rr=i%2?r*.62:r;pts.push(`${(cx+Math.cos(a)*rr).toFixed(1)},${(cy+Math.sin(a)*rr).toFixed(1)}`);}return `<polygon points="${pts.join(' ')}" fill="#f7f5f1" stroke="#6c665d" stroke-width="2.4" stroke-linejoin="round"/>`;}
  function flag(x,y,col,white=false){return `<path d="M${x} ${y}v-18" stroke="#4b463f" stroke-width="1.3"/><path d="M${x} ${y-18}h12l-3 4 3 4h-12z" fill="${white?'#fff':col}" stroke="${white?'#8a8378':shade(col.match(/\d+/g).map(Number),.6)}" stroke-width=".9"/>`;}
  function formation(H,c,state){
    const A=c.forces.attacker,D=c.forces.defender,ca=rgbOf(H,c.attacker),cd=rgbOf(H,c.defender),ka=colorOf(H,c.attacker),kd=colorOf(H,c.defender);
    const t=state.time,ph=state.phase,done=state.finished,won=c.status==='won',pre=ph==='muster'||ph==='march';
    const tac=new Set((c.tactics||[]).map(x=>x.id)),W=320,S=c.siege,ids=[];
    const sa=state.attacker,sd=state.defender,fa=arrange(A,sa),fd=arrange(D,sd);
    const loseA=done&&!won,loseD=done&&won;
    let body='',caption=[];
    const na=name(H,c.attacker,t),nd=name(H,c.defender,t);
    if(S){
      // ---------- 围城 / 关堡 ----------
      const gk=sd&&D.mobilized?sd.remaining/D.mobilized:1;
      const gb=[['watch','城防兵'],['standing','驻防常备军'],['fort','关堡戍卒'],['local','入城乡勇']].map(([k2,l])=>({k:k2,label:l,n:Math.round((S.garrison[k2]||0)*gk)})).filter(b=>b.n>=1);
      const cityW=S.walls?124:0,cx=W/2;
      if(S.walls){body+=wall(cx-cityW/2,20,cityW,74,S.walls,cd);}
      else body+=`<path d="M20 96 L62 34 L96 96Z M224 96 L262 40 L304 96Z" fill="#eceae4" stroke="#c9c4ba"/>`+fortShape(cx,58,34);
      // 守军方块（城内）
      const gy0=S.walls?32:46;gb.slice(0,3).forEach((b,i)=>{const bw=S.walls?104:66,bh=15;body+=block(cx-bw/2,gy0+i*(bh+5)-(gb.length>2&&!S.walls?8:0),bw,bh,cd,{n:b.n,units:[],cav:false,standing:b.k==='standing'},{sub:false,fade:loseD})+`<text x="${cx-bw/2+bw/2-6}" y="${gy0+i*(bh+5)+10.5-(gb.length>2&&!S.walls?8:0)}" class="fb-in" text-anchor="middle">${b.label}</text>`;});
      if(!gb.length)body+=`<text x="${cx}" y="60" text-anchor="middle" class="fb-note">城中无兵</text>`;
      // 守军态势
      const gateY=S.walls?100:96;
      if(S.posture==='surrender'&&!pre)body+=flag(cx+(S.walls?cityW/2:22),S.walls?16:30,'#fff',true);
      if(S.posture==='sally'&&!pre)body+=arrow(`M${cx} ${gateY} L${cx-26} ${gateY+20}`,kd,{w:2.4});
      if(done&&won)body+=flag(cx-(S.walls?cityW/2:22),S.walls?16:30,ka);
      // 攻方：主攻（中军）在城门前，两翼为左右营，后军为辎重与围营
      const fy=142,bw=78,bh=22;
      body+=block(cx-bw/2,fy,bw,bh,ca,fa.center,{label:'主攻 · 中军',fade:loseA});
      body+=block(cx-bw/2-bw-10,fy-14,bw,bh,ca,fa.left,{label:'左营',fade:loseA});
      body+=block(cx+bw/2+10,fy-14,bw,bh,ca,fa.right,{label:'右营',fade:loseA});
      body+=block(cx-bw/2,fy+52,bw,18,ca,fa.rear,{label:'后军 · 辎重',fade:loseA,sub:false});
      if(!pre){
        if(S.method==='blockade'||S.posture==='hold'&&S.method!=='storm')body+=`<ellipse cx="${cx}" cy="${S.walls?57:58}" rx="${S.walls?92:58}" ry="${S.walls?58:46}" fill="none" stroke="${shade(ca,.6)}" stroke-width="1.4" stroke-dasharray="2 3"/>`;
        if(S.method==='storm'&&(S.posture==='hold'||S.posture==='sally'))for(const dx of [-40,0,40])body+=arrow(`M${cx+dx} ${fy-4} L${cx+dx*.8} ${S.walls?100:84}`,shade(ca,.62),{w:1.8});
        else if(S.method==='blockade')body+=`<path d="M${cx-110} 120q10-5 20 0t20 0t20 0t20 0t20 0t20 0t20 0t20 0t20 0t20 0t20 0" fill="none" stroke="${shade(ca,.6)}" stroke-width="1.2"/>`;
      }
      // 援军（主力）：右上方赶来
      if(S.relief.n){const arrived=S.reliefAt!=null&&state.events.some(e=>e.type==='attack'&&/援军/.test(e.label));const rb={n:Math.round(S.relief.n*(sd&&D.mobilized?sd.remaining/D.mobilized:1)),units:[],cav:false,standing:S.relief.main>0};
        body+=block(W-84,12,76,20,cd,rb,{label:S.relief.main?'援军 · 主力':'援军',dash:!arrived,fade:loseD&&arrived,sub:false});
        if(!pre)body+=arrow(`M${W-46} 36 Q${W-40} 110 ${cx+bw/2+bw+6} ${fy-10}`,kd,{dash:!arrived,w:2});
        caption.push(arrived?'援军已抵达':`援军约 ${Math.round(S.relief.days)} 日后可到`);}
      body+=sideTag(8,16,cd,`守 · ${nd}`)+sideTag(8,226,ca,`攻 · ${na}`);
      caption.unshift(S.walls?['','城墙','重城','都城重郭'][S.walls]:'关堡',`守军 ${count(S.garrison.total)}`,POSTURE[S.posture],S.posture==='hold'||S.posture==='sally'?(S.method==='storm'?(S.engines?'器械攻城':'架梯强攻'):'围城断粮'):'');
      if(done)caption.push(SIEGE_OUT[S.outcome]);
      return wrapSvg(body,W,234,caption.filter(Boolean));
    }
    // ---------- 野战 ----------
    const ambush=tac.has('ambush');
    if(ambush&&!pre){
      // 设伏：进攻军成纵队沿道路行军，守军伏于两侧高地
      body+=`<path d="M0 118 C80 100 160 136 240 112 S300 108 320 112" fill="none" stroke="#d8d2c6" stroke-width="12" stroke-linecap="round"/><path d="M0 118 C80 100 160 136 240 112 S300 108 320 112" fill="none" stroke="#fff" stroke-width="1" stroke-dasharray="4 4"/>`;
      body+=`<path d="M40 70 Q90 18 150 62 Q190 30 240 68Z" fill="#e9ecdf" stroke="#c7ccb6"/><path d="M70 168 Q130 196 200 160 Q240 190 290 166Z" fill="#e9ecdf" stroke="#c7ccb6"/>`;
      const col=[fa.left,fa.center,fa.right,fa.rear];col.forEach((b,i)=>{body+=block(30+i*68,106+(i%2?6:-4),58,18,ca,b,{fade:loseA,sub:false});});
      body+=block(96,44,84,18,cd,{n:Math.round((fd.center.n+fd.left.n)),units:[],cav:fd.left.cav,standing:fd.center.standing},{label:'伏兵',dash:pre,fade:loseD,sub:false});
      body+=block(176,164,84,18,cd,{n:Math.round(fd.right.n+fd.rear.n),units:[],cav:fd.right.cav},{label:'伏兵',dash:pre,fade:loseD,sub:false});
      body+=arrow('M140 64 L136 98',kd)+arrow('M214 164 L206 128',kd);
      body+=sideTag(8,16,cd,`守 · ${nd}`)+sideTag(8,212,ca,`攻 · ${na}`);
      caption.push('野战','设伏截击');if(done)caption.push(won?'进攻方突围获胜':'进攻军中伏溃退');
      return wrapSvg(body,W,222,caption);
    }
    const surprise=tac.has('surprise'),feign=tac.has('feigned-retreat'),flank=tac.has('flanking'),raid=tac.has('supply-raid');
    const bw=82,bh=22,gx=[16,W/2-bw/2,W-16-bw],dy=64,ay=pre?162:146,clash=(dy+bh+10+ay-14)/2;
    // 守方面朝下：画面左边是守方右翼
    const dfade=loseD,dash=surprise&&!done;
    body+=block(W/2-bw/2,18,bw,18,cd,fd.rear,{label:'后军',dash,fade:dfade,sub:false});
    body+=block(gx[0],dy,bw,bh,cd,fd.right,{label:'右翼',dash,fade:dfade});
    body+=block(gx[1],dy,bw,bh,cd,fd.center,{label:'中军',dash,fade:dfade});
    body+=block(gx[2],dy,bw,bh,cd,fd.left,{label:'左翼',dash,fade:dfade});
    body+=block(gx[0],ay,bw,bh,ca,fa.left,{label:'左翼',fade:loseA});
    body+=block(gx[1],ay,bw,bh,ca,fa.center,{label:'中军',fade:loseA});
    body+=block(gx[2],ay,bw,bh,ca,fa.right,{label:'右翼',fade:loseA});
    body+=block(W/2-bw/2,ay+52,bw,18,ca,fa.rear,{label:raid?'后军 · 辎重':'后军',fade:loseA,sub:false});
    if(pre){body+=arrow(`M${W/2} ${ay-8} L${W/2} ${clash+6}`,ka,{dash:true});body+=`<text x="${W/2+8}" y="${clash+12}" class="fb-note">行军中 · 尚未接敌</text>`;}
    else{
      body+=`<path d="M10 ${clash}H${W-10}" stroke="#c9c2b6" stroke-width="1" stroke-dasharray="2 3"/>`+sabres(W/2,clash,6.5);
      if(surprise)body+=arrow(`M${W/2-20} ${ay-6} L${W/2-24} ${dy+bh+4}`,ka,{w:2.6})+`<text x="${W/2+14}" y="${clash-6}" class="fb-note">守军未及列阵</text>`;
      if(flank){body+=arrow(`M${gx[2]+bw-10} ${ay-4} C${W+6} ${clash+10} ${W+4} ${dy-6} ${gx[2]+bw-30} ${dy-4}`,ka);}
      if(feign){body+=arrow(`M${W/2} ${dy-2} L${W/2} ${dy-14}`,kd,{dash:true,w:1.8})+arrow(`M${gx[0]+bw/2} ${dy+bh+2} Q${gx[0]+bw} ${clash+12} ${W/2-bw/2-2} ${ay-2}`,kd,{w:1.8})+arrow(`M${gx[2]+bw/2} ${dy+bh+2} Q${gx[2]} ${clash+12} ${W/2+bw/2+2} ${ay-2}`,kd,{w:1.8});}
      if(raid){body+=`<g>${block(W-74,ay+52,62,18,cd,{n:Math.max(1,Math.round(D.mobilized*.06)),units:[],cav:true},{sub:false})}</g>`+arrow(`M${W-76} ${ay+61} L${W/2+bw/2+6} ${ay+61}`,kd,{w:1.8})+`<text x="${W-43}" y="${ay+82}" text-anchor="middle" class="fb-u">轻骑袭粮道</text>`;}
      if(done){const x0=won?gx[0]+bw/2:gx[0]+bw/2,x1=gx[2]+bw/2;const back=won?[`M${x0} ${dy-14} L${x0-6} ${dy-34}`,`M${x1} ${dy-14} L${x1+6} ${dy-34}`]:[`M${x0} ${ay+bh+14} L${x0-6} ${ay+bh+40}`,`M${x1} ${ay+bh+14} L${x1+6} ${ay+bh+40}`];for(const d of back)body+=arrow(d,'#8a2f24',{dash:true,w:1.8});}
    }
    body+=sideTag(8,10,cd,`守 · ${nd}`,'start')+sideTag(8,236,ca,`攻 · ${na}`,'start');
    caption.push('野战');for(const x of c.tactics||[])caption.push(x.label);if(done)caption.push(won?'攻方获胜':'守方获胜');
    return wrapSvg(body,W,244,caption);
  }
  function wrapSvg(body,W,H,caption){
    return `<figure class="wr-fig"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="对阵图"><defs><marker id="mh" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="context-stroke"/></marker></defs>${body}</svg>
      ${caption.length?`<figcaption>${caption.map(x=>`<span>${esc(x)}</span>`).join('')}</figcaption>`:''}</figure>`;
  }

  // ---------- 战报卡 ----------
  // 舰队：双方船只、海战结果（渡海作战的战役才有）
  function navalStrip(H,c,state){
    const N=c.naval;if(!N)return '';const seen=state.finished||['encounter','siege','battle','occupation','retreat','ended'].includes(state.phase),sunk=seen&&N.fought;
    const side=(k,p)=>`<div class="wr-fleet ${k}" style="--sc:${colorOf(H,p)}"><i></i><b>${p>=0?esc(name(H,p,state.time)):'当地'}</b><span>${count(N.ships[k])} 艘${k==='attacker'&&N.transports?`<small>运兵 ${count(Math.min(N.transports,N.ships[k]))}</small>`:''}</span>${sunk?`<em>损失 ${count(N.sunk[k])}</em>`:''}</div>`;
    const res=!seen?(state.phase==='naval'&&N.fought?'海战进行中':'舰队航行中'):N.fought?(N.won?'攻方舰队取胜，登陆对岸':'攻方舰队败退'):'无人拦截，顺利渡海';
    return `<div class="wr-naval"><p class="wr-naval-h"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 16h16l-2.5 4h-11Z M12 3v12 M12 4l6 9h-6"/></svg>海上 · 航程 ${Math.round(N.km)} 公里<b>${res}</b></p><div class="wr-fleets">${side('attacker',c.attacker)}<span class="wr-fleet-vs">${N.fought&&N.ratio!=null?`<b>${N.ratio.toFixed(2)}</b><small>舰队战力比</small>`:'<small>未遇拦截</small>'}</span>${side('defender',c.defender)}</div></div>`;
  }
  function stepper(state,siege,naval){
    const at=state?STEP_OF[state.phase]??0:0,done=state?.finished;
    return `<ol class="wr-steps">${STEPS.map(([,t],i)=>`<li class="${i<at||(done&&i<=at)?'done':''}${i===at&&!done?' cur':''}">${naval&&i===1?'航渡':naval&&i===2&&state?.phase==='naval'?'海战':siege&&i===2?'围城':siege&&i===3?'攻守':t}</li>`).join('')}</ol>`;
  }
  function sideHead(H,c,side,state,time){
    const force=c.forces[side],s=state[side],p=c[side];
    const dead=s.deaths||{combat:0,disease:0,starvation:0},lost=dead.combat+dead.disease+dead.starvation;
    return `<div class="wr-side ${side}" style="--sc:${colorOf(H,p)}"><p class="wr-who"><i></i><b>${esc(name(H,p,time))}</b></p>
      <p class="wr-role">${side==='attacker'?'进攻':'防守'} · ${esc(sysName(force.sys))}</p>${c.allies?.[side]?.length?`<p class="wr-allies" title="盟军与主力合为一军">盟军 ${c.allies[side].map(a=>`<span style="--ac:${colorOf(H,a.p)}">${esc(name(H,a.p,time))} ${count(a.mobilized)}</span>`).join('')}</p>`:''}
      <p class="wr-num"><b>${count(s.remaining)}</b><span>/ ${count(s.mobilized)}</span></p>
      <p class="wr-loss">${lost?`损失 ${count(lost)} <small>战 ${short(dead.combat)} · 病 ${short(dead.disease)} · 饥 ${short(dead.starvation)}</small>`:'<small>尚无损失</small>'}</p></div>`;
  }
  function compareRows(c,state){
    const A=c.forces.attacker,D=c.forces.defender,sa=state.attacker,sd=state.defender,mx=Math.max(1,sa.remaining,sd.remaining);
    const rows=[['兵力',sa.remaining/mx,sd.remaining/mx,short(sa.remaining),short(sd.remaining)],
      ['常备',A.mobilized?A.standing/A.mobilized:0,D.mobilized?D.standing/D.mobilized:0,short(A.standing),short(D.standing)],
      ['训练',A.training,D.training],['装备',A.equipment,D.equipment],['士气',sa.morale,sd.morale],['补给',sa.supply?.ratio,sd.supply?.ratio]];
    const pc=v=>Math.round((v||0)*100);
    return `<div class="wr-cmp">${rows.map(([l,a,d,ta,td])=>{const better=Math.abs((a||0)-(d||0))<.03?'':a>d?'a':'d';return `<div class="wr-row ${better?'lead-'+better:''}"><b>${ta??pc(a)}</b><i class="wr-bar a"><s style="width:${Math.max(2,pc(a))}%"></s></i><span>${l}</span><i class="wr-bar d"><s style="width:${Math.max(2,pc(d))}%"></s></i><b>${td??pc(d)}</b></div>`;}).join('')}</div>`;
  }
  function groupsHtml(H,force,time){
    if(!force)return '';
    const ROLE={standing:'常备',garrison:'守城',local:'本地应召',field:'应召'};
    return `<ul>${force.groups.map(g=>{
      const species=H.human?.species[g.species]?.label||'种族 '+g.species,culture=g.culture>=0?H.civs?.[g.culture]?.name:g.culture<=-2?H.ancient?.[-2-g.culture]?.name:'文化未形成',faith=g.religion>=0?H.religions?.[g.religion]?.name:'无已记载信仰';
      return `<li><b>${count(g.mobilized)}</b><span>${esc(unitName(g.unit||'levy'))}<em>${ROLE[g.role]||''}</em> · ${esc(placeName(H,g.source,time,'驻地'))}<small>${esc(species)} · ${esc(culture||'文化未详')} · ${esc(faith||'信仰未详')}</small></span></li>`;}).join('')}</ul>`;
  }
  function campaign(H,c,{open=false,time,perspective}={}){
    if(!Number.isFinite(time))return '';const state=atMonth(c,time,{includeEnded:true});if(!state)return '';
    state.time=time;
    const v=verdict(c,state,perspective),stamp=Math.min(time,c.endTime),events=state.events,A=c.attacker,D=c.defender;
    const ratio=c.battle?c.battle.attack/Math.max(1,c.battle.defense):0;
    const kind=c.battle?(c.battle.kind==='naval'?'海战':(c.naval?'渡海 · ':'')+(c.battle.kind==='siege'?(c.siege?.fort&&!c.siege?.walls?'关堡':'围城'):'野战')):'';
    const result=state.finished?`<p class="wr-result ${v.k}"><b>${esc(c.siege?SIEGE_OUT[c.siege.outcome]:REASONS[c.reason]||c.reason)}</b>${c.battle?` · ${c.control.to!==c.control.from?'战后归属 '+esc(name(H,c.control.to,c.resultTime)):'地区归属未变'}${c.control.kind==='vassal'||c.control.kind==='tributary'?'，并建立臣属关系':''}`:''}</p>`:'';
    const tactics=c.tactics?.length&&events.some(e=>e.type==='tactic')?`<div class="wr-tactics">${c.tactics.map(t=>`<span class="${t.side}" title="${esc(t.detail)}"><i>${t.side==='attacker'?'攻':'守'}</i>${esc(t.label)}</span>`).join('')}</div>`:'';
    const log=events.length?`<ol class="wr-log">${events.map(e=>`<li class="t-${e.type} s-${e.side}${month(e.at)===month(time)?' cur':''}"><time>${dateShort(e.at)}</time><div><b>${esc(e.label)}</b>${e.detail?`<p>${esc(e.detail)}</p>`:''}</div></li>`).join('')}</ol>`:'<p class="wr-empty">部队正在集结，尚未出发。</p>';
    const body=c.forces&&c.battle?`
        ${navalStrip(H,c,state)}${c.battle.kind==='naval'?'':formation(H,c,state)}
        <div class="wr-sides">${sideHead(H,c,'attacker',state,time)}<div class="wr-vs"><b>${ratio.toFixed(2)}</b><small>战力比</small></div>${sideHead(H,c,'defender',state,time)}</div>
        ${compareRows(c,state)}${tactics}
        <h5 class="wr-h">战役经过</h5>${stepper(state,!!c.siege,!!c.naval)}
        <p class="wr-route">${esc(placeName(H,c.source,time,'驻地'))}<em>→</em>${esc(placeName(H,c.target,time,'前线'))}${c.route?` · ${Math.round(c.route.km)} 公里`:''} · 约 ${c.forces.attacker.travelDays.toFixed(1)} 日</p>
        ${log}${result}
        <details class="wr-more"><summary>部队构成与军需</summary><div class="wr-groups"><h6>进攻 · ${esc(sysName(c.forces.attacker.sys))} · ${c.forces.attacker.groups.length} 支</h6>${groupsHtml(H,c.forces.attacker,time)}<h6>防守 · ${esc(sysName(c.forces.defender.sys))} · ${c.forces.defender.groups.length} 支</h6>${groupsHtml(H,c.forces.defender,time)}</div><p class="wr-tiny">额外军粮：进攻 ${count(state.attacker?.supply?.extraFood)} · 防守 ${count(state.defender?.supply?.extraFood)} 人年粮；民用产出减少：进攻 ${count(state.attacker?.supply?.lostProduction)} · 防守 ${count(state.defender?.supply?.lostProduction)} 人年粮</p></details>`
      :`${log}${result}`;
    return `<details class="wr-card v-${v.k}" data-military-campaign="${esc(c.id)}"${open?' open':''}>
      <summary><span class="wr-title"><b>${esc(title(H,c,time))}</b><em class="wr-pill ${v.k}">${esc(v.t)}</em></span>
      <small class="wr-meta">${dateShort(c.startTime)}–${dateShort(stamp)} · ${esc(OBJECTIVES[c.objective]||c.objective)}${kind?' · '+kind:''}</small>
      <span class="wr-vsline"><i style="background:${colorOf(H,A)}"></i>${esc(name(H,A,time))}<em>攻</em><i style="background:${colorOf(H,D)}"></i>${esc(name(H,D,time))}<em>守</em></span></summary>
      <div class="wr-body">${body}</div></details>`;
  }
  // ---------- 国家详情：军制 + 战史 ----------
  function systemHtml(H,p,year){
    const q=H.polities[p];if(!q?.msys?.length||year<q.born)return '';
    const key=msysAt(H,p,year),S=SY()[key];if(!S)return '';
    const army=armyAt(H,p,year),cap=army?.stations||[];
    const byUnit=new Map();for(const s of cap)byUnit.set(s.unit,(byUnit.get(s.unit)||0)+s.n);
    const ideas=(q.ideaAdopt||[]).filter(([k,t])=>H.ideas[k]?.mil||['iron','feudal','gunpowder'].includes(H.ideas[k]?.id)).filter(([,t])=>t<=year);
    const L=q.msys.filter((x,i)=>i===0||x[1]!==q.msys[i-1][1]);
    return `<section class="tf-sec wr-sys"><h4><span>军制</span><small>${esc(S.name)}</small></h4>
      <p class="wr-sysdesc">${esc(S.desc)}</p>
      <div class="wr-syskpi"><div><small>常备兵</small><b>${army?count(army.total):'0'}</b></div><div><small>驻地</small><b>${new Set(cap.map(s=>s.r)).size}</b></div><div><small>应召</small><b>${esc(S.reserve.map(r=>unitName(r[0])).join('、')||'—')}</b></div></div>
      ${cap.length?`<ul class="wr-stations">${[...byUnit].map(([u,n])=>`<li><b>${esc(unitName(u))}</b><span>${count(n)} 人</span><small>${cap.filter(s=>s.unit===u).map(s=>`${esc(placeName(H,s.r,year,'驻地'))} ${short(s.n)}`).join(' · ')}</small></li>`).join('')}</ul>`:'<p class="tf-none">没有常备部队，战时临时集结。</p>'}
      ${ideas.length?`<p class="wr-ideas">${ideas.map(([k,t])=>`<span data-year="${t}">${esc(H.ideas[k].name)}</span>`).join('')}</p>`:''}
      ${L.length>1?`<ol class="tf-steps">${L.map((x,i)=>`<li data-year="${x[0]}" class="${x[1]===key&&(i+1>=L.length||L[i+1][0]>year)&&x[0]<=year?'cur':''}"><i>${String(i+1).padStart(2,'0')}</i><span>${esc(sysName(x[1]))}</span><b>${dateShort(x[0])}</b></li>`).join('')}</ol>`:''}</section>`;
  }
  function render(H,{polityId,region,year}){
    if(!H.military)return '';
    const through=cutoff(year),rows=H.military.campaigns.filter(c=>c.startTime<=through&&(polityId===undefined||c.attacker===polityId||c.defender===polityId||(c.resultTime<=through&&c.control.to===polityId))&&(region===undefined||c.source===region||c.target===region));
    let win=0,lose=0,dead=0,att=0,sieges=0;
    for(const c of rows){if(!c.battle||c.resultTime>through)continue;const mine=c.attacker===polityId?'attacker':c.defender===polityId?'defender':null;if(!mine)continue;if(mine==='attacker')att++;if(c.siege)sieges++;const won=mine==='attacker'?c.status==='won':c.status!=='won';won?win++:lose++;const d=c.forces?.[mine]?.deaths;if(d)dead+=d.combat+d.disease+d.starvation;}
    const recent=rows.slice(-20).reverse();
    return `${polityId!==undefined?systemHtml(H,polityId,year):''}<section class="tf-sec mr-sec"><h4><span>战史</span><small>截至${date(year)}</small></h4>
      <div class="tf-kpis wr-kpis"><div><small>战役</small><b>${rows.length}</b></div><div><small>胜 / 负</small><b>${win}<em>/ ${lose}</em></b></div><div><small>攻守城</small><b>${sieges}</b></div><div><small>伤亡</small><b>${short(dead)}</b></div></div>
      ${recent.map(c=>campaign(H,c,{time:year,perspective:polityId})).join('')||'<p class="tf-none">截至此月没有战役记录。</p>'}${rows.length>20?'<p class="tf-none">只列最近 20 场；拖动时间轴可查看更早的战报。</p>':''}</section>`;
  }
  G.MilitaryUI={render,campaign,name,date,dateShort,phaseLabel,atMonth,title,placeName,short,colorOf,msysAt,armyAt,movesAt,siegesOf,garrisonOf,sysName,unitName,SIEGE_OUT,POSTURE};
})(typeof window!=='undefined'?window:globalThis);
