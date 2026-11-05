/* 人物人生（第 3 版）：有方向、会走动的传奇人生。
 * 人物只在固定的世界历史中行动——随本国出征、随朝廷迁都、投奔起义、出使列国、云游、行商、传道……
 * 本模块从不改写世界人口、战争和随机数；所有“时局”都读自已推演完成的历史。 */
(function (G) {
  'use strict';
  const VERSION=3, LEGACY_VERSION=2, Q=()=>G.HistoryQuery, LP=()=>G.LifePaths, clone=x=>JSON.parse(JSON.stringify(x));
  const CLASSES={labor:'劳作家庭',craft:'工匠家庭',trade:'商贾家庭',learned:'文书家庭'};
  const OCCUPATIONS={gatherer:'采集者',farmer:'农人',herder:'牧人',laborer:'雇工',artisan:'工匠',merchant:'商贩',scribe:'文书',caregiver:'照料者'};
  const NAV_MAX=64;
  function hash(s){let n=2166136261;for(const c of String(s)){n^=c.charCodeAt(0);n=Math.imul(n,16777619);}return n>>>0;}
  function random(seed){let a=hash(seed);return()=>{a=(a+0x6d2b79f5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
  function draw(list,rnd,weight=x=>x.population){const sum=list.reduce((v,x)=>v+weight(x),0);if(!(sum>0))throw Error('没有符合条件的候选。');let pick=rnd()*sum;for(const x of list){pick-=weight(x);if(pick<=0)return x;}return list[list.length-1];}
  function calendar(cfg){if(!(cfg.yearDays>0&&cfg.day>0))throw Error('缺少世界年长和日长。');return{daysPerYear:cfg.yearDays,hoursPerDay:cfg.day,earthYearsPerYear:cfg.yearDays*cfg.day/(365.25*24),ageUnit:'365.25个24小时日'};}
  function eventTime(p,e){return e.date.year+(e.date.day-1+e.date.hour/p.calendar.hoursPerDay)/p.calendar.daysPerYear;}
  function dateAt(time,cal,precision='day'){
    const year=Math.floor(time);let within=(time-year)*cal.daysPerYear;
    if(Math.abs(within-Math.round(within))<1e-8)within=Math.round(within);
    const date=G.Navigation.dateAfter({year,day:1,hour:0},within,cal);
    return {...date,month:G.HistoryDate.month(time),precision};
  }
  function definition(h,cfg,id){const c=Q().culture(h,id);if(!c)return null;const lib=[...(cfg.customLibraries||[]),...(G.CULTURE_LIBRARIES||[])].find(l=>l.id===c.libId);if(!lib)throw Error('缺少出生文化库快照：'+c.libId);return clone(lib);}
  function nameOf(lib,rnd,surname){if(!lib)return{given:'无名',surname:'',full:'无名居民',source:'出生群体尚无文化人名库，未套用其他文化姓名'};const n=G.CultureExt.personName(lib,rnd,{surname}),family=G.CultureExt.ext(lib).family;return{...n,full:['sinitic','japanese','korean'].includes(family)?n.surname+n.given:n.given+'·'+n.surname,source:lib.id};}
  // 自定义姓名：只做长度与字符检查，按常见写法推断姓氏，供亲属起名
  function customName(raw){
    const full=String(raw||'').replace(/[\u0000-\u001f<>]/g,'').trim().slice(0,24);if(!full)return null;
    const parts=full.split(/[·・\s]+/).filter(Boolean);let surname='',given=full;
    if(parts.length>1){surname=parts.at(-1);given=parts.slice(0,-1).join('·');}
    else if(/^[\u4e00-\u9fff]{2,4}$/.test(full)){const two=['欧阳','司马','上官','诸葛','东方','皇甫','令狐','慕容','长孙','宇文','司徒','夏侯','独孤','公孙','尉迟','端木'];surname=two.find(s=>full.startsWith(s)&&full.length>2)||full[0];given=full.slice(surname.length);}
    return{given,surname,full,source:'custom'};
  }
  // 出生群体尚未形成文化时，借用当地或最近文明的人名库，免得出现“无名居民”
  function borrowedLib(h,cfg,region,t){
    const local=Q().logAt(h.cultLog,region,t);if(local>=0||local<=-2){const l=definition(h,cfg,local);if(l)return l;}
    let best=null,bd=Infinity;const W=h.FW||h.W*2;(h.civs||[]).forEach((c,i)=>{if(!c||c.start==null)return;let dx=Math.abs(c.hx-h.cx[region]);dx=Math.min(dx,W-dx);const d=dx*dx+(c.hy-h.cy[region])**2;if(d<bd){bd=d;best=i;}});
    return best!=null?definition(h,cfg,best):null;
  }
  function rollName(h,cfg,culture,seed,sex,region,t){const lib=definition(h,cfg,Number(culture))||(region!=null?borrowedLib(h,cfg,region,t):null);return nameOf(lib,random(String(seed)+':name:'+(sex||''))).full;}
  function rollNameUnused(h,cfg,culture,seed,sex){const lib=definition(h,cfg,Number(culture));return nameOf(lib,random(String(seed)+':name:'+(sex||''))).full;}
  const birthYearOf=request=>request.mode==='resident'?Math.floor(request.year)-request.age:request.birthYear??Math.floor(request.year);
  function chooseBirthday(h,req,cal){
    if(req.birthDay!==null&&req.birthDay!==undefined&&req.birthDay!=='')return;
    const year=birthYearOf(req),source=!req.rural&&req.place.kind==='city'?h.cities[req.place.id]:req.place.kind==='province'?h.provinces[req.place.id]:null;
    const founded=source?.founded??source?.created??0,ended=source?.ruined??source?.abolished??Infinity;
    let first=Math.max(1,Math.ceil((founded-year)*cal.daysPerYear)+1),last=Math.min(Math.ceil(cal.daysPerYear),Math.ceil((ended-year)*cal.daysPerYear));
    if(req.mode==='resident')last=Math.min(last,Math.ceil(((G.HistoryDate.index(req.year)+1)/12-year)*cal.daysPerYear));
    if(last<first)throw Error('这个出生年没有符合地点与所选月份的生日。');
    req.birthDay=first+Math.floor(random(req.seed+':birthday:'+year)()*(last-first+1));
  }
  function choices(h,cfg,request){
    const cal=calendar(cfg), year=request.year, actualPlace=request.rural&&request.place.kind==='city'?{kind:'rural',id:h.cities[request.place.id].r}:request.place,anchor=Q().location(h,actualPlace,year);
    if(!anchor.exists)throw Error(anchor.reason);
    const rawAge=request.age==null?null:Number(request.age);
    if(request.mode==='resident'&&rawAge!==null&&(!Number.isInteger(rawAge)||rawAge<0))throw Error('在世年龄须为非负整数（世界年）。');
    const by=request.mode==='resident'&&rawAge===null?Math.floor(year):birthYearOf({...request,age:rawAge});
    if(!Number.isInteger(by)||by<0||by>h.E)throw Error('出生年份超出世界历史；不能用未来人口补写早年。');
    let place=request.place;
    if(request.rural&&place.kind==='city')place={kind:'rural',id:h.cities[place.id].r};
    const source=place.kind==='city'?h.cities[place.id]:place.kind==='province'?h.provinces[place.id]:null;
    const birthTime=request.birthDay!==null&&request.birthDay!==undefined&&request.birthDay!==''?by+(Number(request.birthDay)-1)/cal.daysPerYear:Math.max(by,Math.min(by+1-1e-8,source?.founded??source?.created??by));
    if(request.mode==='resident'&&birthTime>=(G.HistoryDate.index(year)+1)/12)throw Error('生日尚未到来，所选月份还不是在世居民。');
    const at=Q().location(h,place,birthTime);if(!at.exists)throw Error(at.reason);
    const pop=Q().population(h,at.regions,birthTime);if(!pop.available)throw Error(pop.reason);
    const groups=pop.groups.filter(g=>(request.mode!=='resident'||anchor.regions.includes(g.region))&&['species','culture','religion'].every(k=>request[k]==null||request[k]===''||g[k]===Number(request[k])));
    if(!groups.length)throw Error('锁定的种族、家庭文化与信仰组合不在当地该期人口记录中。请调整身份或年份。');
    return{cal,year,birthYear:by,birthTime,anchor,place:at,population:pop,groups};
  }

  // ---------- 时局索引：一次整理，按年份查询 ----------
  const INDEX=new WeakMap(),LANDS=new WeakMap(),LAND=h=>{let m=LANDS.get(h);if(!m)LANDS.set(h,m=new Map());return m;};
  function worldIndex(h){
    if(INDEX.has(h))return INDEX.get(h);
    const push=(m,k,v)=>{let a=m.get(k);if(!a)m.set(k,a=[]);a.push(v);};
    const byYear=new Map(),campByYear=new Map(),campByPolity=new Map(),cityByRegion=new Map(),fortsByYear=new Map(),warByYear=new Map();
    for(const e of h.events||[]){if(e.kind==='campaign'||e.kind==='fortStatus')continue;push(byYear,Math.floor(e.time??e.year),e);}
    for(const c of h.military?.campaigns||[]){if(!Number.isFinite(c.resultTime)||!Number.isFinite(c.startTime)||c.timeline?.[0]?.phase==='aborted')continue;push(campByYear,Math.floor(c.startTime),c);for(const s of [c.attacker,c.defender])if(s>=0)push(campByPolity,s,c);}
    for(const e of h.military?.effects||[])push(warByYear,Math.floor(e.startYear),e);
    h.cities.forEach((c,i)=>push(cityByRegion,c.r,i));
    for(const f of h.forts||[])push(fortsByYear,Math.floor(f.year),f);
    const W=h.FW||h.W*2,result={byYear,campByYear,campByPolity,cityByRegion,fortsByYear,warByYear,W,kmPerUnit:2*Math.PI*(h.Rkm||6371)/W};
    INDEX.set(h,result);return result;
  }
  function yearsOf(map,from,to){const out=[];for(let y=Math.floor(from);y<=Math.floor(to);y++){const a=map.get(y);if(a)for(const x of a)out.push(x);}return out;}
  function capitalOf(h,pid,t){const p=h.polities?.[pid];if(!p||t<p.born||(p.died!=null&&t>=p.died))return null;const row=Q().rowAt(p.caps,t);return row&&Q().exists(h.cities[row[1]],t)?row[1]:null;}
  function rulerOf(h,pid,t){const row=Q().rowAt(h.polities?.[pid]?.rulers,t);return row?{name:row[1],title:row[2]}:null;}
  const polityName=(h,pid,t)=>pid>=0?(Q().polity(h,pid,t)?.name||h.polities?.[pid]?.short||'某国'):'部族地带';
  const religionName=(h,f)=>f>=0?h.religions[f]?.name||'某教':'原始信仰';
  const alivePolity=(h,pid,t)=>{const p=h.polities?.[pid];return!!p&&t>=p.born&&(p.died==null||t<p.died);};

  function generate(h,cfg,request,navigate){
    if(!request.id||!request.seed||!request.worldKey)throw Error('人物需要固定编号、世界绑定与独立种子。');
    if(typeof navigate!=='function')throw Error('人物推演需要当前世界的历史导航。');
    const req=clone(request),cal=calendar(cfg);let opts;
    if(!['birth','resident'].includes(req.mode))throw Error('人物入口无效。');
    if(req.path&&!LP().BY[req.path])throw Error('人生方向无效。');
    if(req.temperament&&!LP().TEMPERAMENTS.some(t=>t.id===req.temperament))throw Error('性情选项无效。');
    if(req.mode==='resident'&&req.age==null){
      const place=req.rural&&req.place.kind==='city'?{kind:'rural',id:h.cities[req.place.id].r}:req.place,anchor=Q().location(h,place,req.year);
      if(!anchor.exists)throw Error(anchor.reason);
      const founded=place.kind==='city'?h.cities[place.id].founded:place.kind==='province'?h.provinces[place.id].created:0;
      const first=Math.max(0,Math.floor(founded),Math.floor((h.human?.snapshots||[])[0]?.year??h.E)),maxAge=Math.floor(Math.min(60/cal.earthYearsPerYear,Math.floor(req.year)-first));
      const ages=Array.from({length:Math.max(0,maxAge+1)},(_,i)=>i),rnd=random(req.seed+':age');let reason='当地没有支持随机年龄的出生人口采样。';
      while(ages.length&&!opts){const index=Math.floor(rnd()*ages.length);req.age=ages[index];req.birthDay=request.birthDay;ages[index]=ages.at(-1);ages.pop();try{chooseBirthday(h,req,cal);opts=choices(h,cfg,req);}catch(error){reason=error.message;}}
      if(!opts)throw Error(reason);
    }
    if(!opts){chooseBirthday(h,req,cal);opts=choices(h,cfg,req);}
    if(req.mode==='resident'){
      opts.groups=opts.groups.filter(g=>req.age*cal.earthYearsPerYear<h.human.species[g.species].life.maximum);
      if(!opts.groups.length)throw Error('所选年龄已达到当地候选种族的寿命上限。');
    }
    const limit=req.mode==='resident'?12:3;let best=null;
    for(let attempt=0;attempt<limit;attempt++){
      const result=simulate(h,cfg,req,opts,attempt,navigate);
      const selectedEnd=(G.HistoryDate.index(req.year)+1)/12,residence=result.trajectory.filter(t=>{const e=result.events.find(e=>e.id===t.eventId);return eventTime(result,e)<selectedEnd;}).at(-1)?.to,atAnchor=residence&&opts.anchor.regions.includes(residence.region)&&(req.place.kind!=='city'||req.rural||residence.kind==='city'&&residence.id===req.place.id);
      if(req.mode==='resident'){
        if((result.death===null||eventTime(result,{date:result.death})>=selectedEnd)&&atAnchor){result.conditioning='筛选在所选月末仍在当地生活的本地居民；此前经历是条件推演，远行从所选月份之后开始。';return result;}
        continue;
      }
      // 出生入口：优先选一生走得更远的样本，避免早夭或困守一地
      const score=result.story.journeys.length+(result.death&&result.story.journeys.length<3?-5:0);
      if(!best||score>best.score)best={result,score};
      if(result.story.journeys.length>=4)break;
    }
    if(best)return best.result;
    throw Error('这个年龄与地点条件下没有找到存活样本。请降低年龄或调整出生日期。');
  }

  function simulate(h,cfg,req,opts,attempt,navigate){
    const rnd=random(req.seed+':life:'+attempt),{cal,birthYear,population}=opts,idx=worldIndex(h),group=draw(opts.groups,rnd),species=h.human.species[group.species];
    G.HumanRules.validateLibrary(species,'species');
    const biology=species.life,lib=definition(h,cfg,group.culture)||borrowedLib(h,cfg,group.region,opts.birthTime),custom=customName(req.name),personName=custom||nameOf(lib,rnd);
    const day=Number(req.birthDay);
    if(!Number.isInteger(day)||day<1||day>Math.ceil(cal.daysPerYear))throw Error(`生日须在世界年的第 1～${Math.ceil(cal.daysPerYear)} 日之间。`);
    const familyClass=req.familyClass||draw([{id:'labor',population:60},{id:'craft',population:18},{id:'trade',population:13},{id:'learned',population:9}],rnd).id;
    if(!CLASSES[familyClass])throw Error('家庭背景无效。');
    const sex=req.sex||(['女','男'][Math.floor(rnd()*2)]);if(!['女','男','其他'].includes(sex))throw Error('性别选项无效。');
    const wealth0=req.wealth==null||req.wealth===''?({labor:25,craft:45,trade:60,learned:55}[familyClass]+Math.round(rnd()*20-10)):Number(req.wealth);
    if(!Number.isFinite(wealth0)||wealth0<0||wealth0>100)throw Error('初始家境须在 0～100 之间。');
    const pathId=req.path||LP().pick(familyClass,rnd,group.religion),PATH=LP().BY[pathId];
    const temper=LP().TEMPERAMENTS.find(t=>t.id===req.temperament)||LP().TEMPERAMENTS[Math.floor(rnd()*4)];
    const TA=sex==='女'?'她':sex==='男'?'他':'其';
    let place=opts.place;
    if(place.kind==='province'){
      const cities=h.cities.map((c,id)=>({c,id})).filter(x=>x.c.r===group.region&&Q().exists(x.c,opts.birthTime));
      place=cities.length&&rnd()<.35?Q().location(h,{kind:'city',id:cities[Math.floor(rnd()*cities.length)].id},opts.birthTime):Q().location(h,{kind:'rural',id:group.region},opts.birthTime);
    }
    const p={version:VERSION,id:req.id,seed:req.seed,worldKey:req.worldKey,request:clone(req),calendar:cal,name:personName.full,nameParts:personName,species:group.species,speciesId:species.id,speciesName:species.label,biology:clone(biology),sex,
      birth:{year:birthYear,day,place:placeRef(place),culture:group.culture,religion:group.religion,cultureName:Q().culture(h,group.culture)?.name||'尚未形成文化',religionName:religionName(h,group.religion)},
      provenance:{sampleYear:population.year,calculatedThroughYear:population.calculatedThroughYear,region:group.region,populationSource:population.source,identity:'当地联合人口组',details:'出身取自当地人口记录；之后的人生按所选方向在固定历史中推演：出征、迁都、政变、起义、疫病与改宗都读自世界编年史，人物不改写世界事件。'},
      familyClass,initialWealth:wealth0,events:[],relations:[],trajectory:[],death:null,endYear:h.E,aliveAtEnd:true,
      selection:{kind:'legendary',survivalThroughYear:Math.min(h.E,Math.max(req.mode==='resident'?Math.floor(req.year):0,birthYear+Math.floor(Math.min(biology.maturity+18,biology.oldAge)/cal.earthYearsPerYear))),rule:'在种族寿命内，条件选取度过早年日常死亡风险的个人；战场、瘟疫与刑狱仍可终止人生'},
      story:{path:pathId,role:pathId,title:PATH.title,goal:PATH.goal,temperament:temper.label,disposition:temper.id,status:'growing',fame:0,rank:-1,journeys:[],works:[],navigationCalls:0}};
    let clock=opts.birthTime,health=90+rnd()*10,wealth=wealth0,fame=0,rank=-1,role=pathId,serving=-1,servedSince=null,education='none',occupation=null,married=false,children=0,retired=false,nextAction=Infinity,minister=false,rebelName=null,captiveUntil=-1,lastStay=clock;
    let currentCulture=group.culture,currentReligion=group.religion,lastOwner=place.owner,lastRegionFaith=Q().logAt(h.relLog,place.region,clock),service=null,navCalls=0;
    const landings=id=>{const c=h.cities[id];let dx=h.cx[c.r]-c.x;if(dx>W/2)dx-=W;if(dx<-W/2)dx+=W;const dy=h.cy[c.r]-c.y,l=Math.hypot(dx,dy),out=l>.5?[{x:c.x+dx/l*1.5,y:c.y+dy/l*1.5}]:[];for(const [a,b] of [[0,1],[-1,0],[-2,-2],[2,2],[0,-1],[1,0]])out.push({x:c.x+a,y:c.y+b});return out;};
    const probed=new Set(),blocked=new Set(),seenWorld=new Set(),seenFamine=new Set(),pendingOutcomes=[],served=new Map(),works=[],branches=[],preached=[];
    const residentEnd=req.mode==='resident'?(G.HistoryDate.index(req.year)+1)/12:-Infinity,locked=()=>clock<residentEnd;
    const W=idx.W,dist=(a,b)=>{let dx=Math.abs(a.x-b.x);dx=Math.min(dx,W-dx);return Math.hypot(dx,a.y-b.y);};
    const pick=a=>a[Math.floor(rnd()*a.length)%a.length],chance=x=>rnd()<x,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
    const ageAt=t=>(t-opts.birthTime)*cal.earthYearsPerYear;
    const rankName=()=>LP().rankTitle(role==='official'&&minister?'official':role,rank)||PATH.occupation;
    const here=t=>Q().location(h,{kind:place.kind,id:place.id},Math.min(t,h.E+1-1e-6));
    const cityName=(id,t)=>Q().location(h,{kind:'city',id},Math.min(t,h.E+1-1e-6)).name;
    const regionName=(r,t)=>{const cs=(idx.cityByRegion.get(r)||[]).filter(i=>Q().exists(h.cities[i],t));return cs.length?cityName(cs[0],t)+'一带':Q().location(h,{kind:'rural',id:r},Math.min(t,h.E+1-1e-6)).name;};
    const end=()=>h.E+1-1e-6;
    function add(kind,time,data={},precision='day'){
      time=Math.min(end(),Math.max(time,clock));
      const date=dateAt(time,cal,precision),loc=here(time);
      const e={id:p.id+':event:'+p.events.length,date,year:date.year,kind,place:placeRef(loc),participants:[p.id],cause:{rule:'life-v3:'+kind},result:{...data,s:[Math.round(fame),Math.round(wealth),Math.round(health),rank]}};
      p.events.push(e);clock=eventTime(p,e);return e;
    }
    const note=(kind,time,title,text,extra={})=>{if((kind==='deed'||kind==='sight'||kind==='faith')&&wealth<40)wealth+=1+rnd()*3;return add(kind,time,{title,text,...extra},extra.world?'month':'day');};
    const fails=new Map(),quiet=(title,text)=>{const n=(fails.get(title)||0)+1;fails.set(title,n);return[1,3,7,15].includes(n)?note('trial',clock,title,n>1?text.replace(/。$/,'')+`（已是第 ${n} 次）。`:text):null;};
    const worldRef=e=>e?{text:e.text,year:e.year,month:e.month,kind:e.kind}:null;
    function serve(pid,t,why){if(pid===serving)return;serving=pid;servedSince=t;if(pid>=0){const n=polityName(h,pid,t);if(!served.has(pid))served.set(pid,{name:n,from:t});}}
    function setRole(r,newRank){role=r;rank=newRank;p.story.role=r;}
    const topRank=()=>Math.max(0,(LP().BY[role]?.ranks||[0]).length-1),promote=(n=1)=>{const before=rank;rank=Math.min(topRank(),Math.max(0,rank+n));return rank>before;},F=()=>Math.min(fame,20);
    function remember(){p.story.fame=Math.round(fame);p.story.rank=rank;}
    // ---------- 出行 ----------
    function departure(t){return G.Navigation.dateAfter({year:Math.floor(t),day:1,hour:0},(t-Math.floor(t))*cal.daysPerYear,cal);}
    const dTime=d=>d.year+(d.day-1+(d.hour||0)/cal.hoursPerDay)/cal.daysPerYear;
    function visit(){const t=clock,info=Q().district(h,place.region,t);p._footprint.cities.add(place.kind==='city'?place.id:-1-place.region);if(info.owner>=0)p._footprint.polities.add(info.owner);if(info.culture!==-1)p._footprint.cultures.add(info.culture);p._footprint.faiths.add(info.religion);lastStay=t;}
    p._footprint={cities:new Set(),polities:new Set(),cultures:new Set(),faiths:new Set(),km:0};
    function travel(cands,purpose,{mode=PATH.mode,title='启程',state=false,hazard=true,extra={}}={}){
      if(locked()||navCalls>=NAV_MAX||!cands.length)return null;
      const t0=clock+(3+rnd()*20)/cal.daysPerYear;if(t0>=end()-.02)return null;
      const hereId=place.kind==='city'?place.id:-1,seen=new Map();
      for(const c of cands)if(c.id!==hereId&&c.w>0&&Q().exists(h.cities[c.id],t0)&&(!seen.has(c.id)||seen.get(c.id).w<c.w))seen.set(c.id,c);
      const fromKey=place.kind+place.id,ok=c=>!blocked.has(fromKey+'>'+c.id);
      let pool=[...seen.values()].filter(ok);const order=[];while(pool.length&&order.length<4){const c=draw(pool,rnd,x=>x.w);order.push(c);pool=pool.filter(x=>x!==c);}
      // 原定方向走不通时，先绕到能走到的邻近城镇，免得困守一地
      const linked=new Set(place.kind==='city'?Q().roadsFrom(h,place.id,t0).map(r=>r.to):[]);
      const near=h.cities.map((c,id)=>({id,d:dist(place,c)*(linked.has(id)?.3:1)})).filter(x=>x.id!==hereId&&Q().exists(h.cities[x.id],t0)&&ok(x)&&!order.some(o=>o.id===x.id)).sort((a,b)=>a.d-b.d).slice(0,3).map(x=>({id:x.id,w:1,detour:true}));
      order.push(...near);
      const ef=G.HumanRules.combine(species,definition(h,cfg,currentCulture),currentReligion>=0?h.religions[currentReligion]:null),speed=G.HumanRules.multiplier(ef.travelSpeed,.25,2),maxDays=cal.daysPerYear*.95;
      for(const c of order){
        const target=h.cities[c.id];if(dist(place,target)*idx.kmPerUnit>maxDays*70)continue;let routed=false;
        for(const m of mode&&mode!=='walk'&&!c.detour?[mode,'walk']:['walk']){
          if(navCalls>=NAV_MAX)break;navCalls++;p.story.navigationCalls=navCalls;
          let nav=null;try{nav=navigate(placeRef(place),c.id,t0,m,maxDays,speed);}catch(_){nav=null;}
          // 港口城的路网节点常落在水面上：从朝内陆挪一步的登岸点重试一次
          if((!nav||nav.fail)&&navCalls<NAV_MAX){
            const fromId=place.kind==='city'&&String(h.cities[place.id].type||'').includes('port')?place.id:null,toId=String(target.type||'').includes('port')?c.id:null;
            if(fromId!=null||toId!=null){
              const optsOf=id=>id==null?[null]:LAND(h).has(id)?[LAND(h).get(id)]:probed.has(id)?[landings(id)[0]]:(probed.add(id),landings(id).slice(0,4));
              outer:for(const la of optsOf(fromId))for(const lb of optsOf(toId)){if(navCalls>=NAV_MAX)break outer;navCalls++;let n=null;try{n=navigate(la||placeRef(place),lb||c.id,t0,m,maxDays,speed);}catch(_){}if(n&&!n.fail){nav=n;if(la)LAND(h).set(fromId,la);if(lb)LAND(h).set(toId,lb);break outer;}}
            }
          }
          if(!nav||nav.fail||!(nav.km>0&&nav.days>0)||nav.days>maxDays)continue;
          const arr=t0+nav.days/cal.daysPerYear;if(arr>=end()||!Q().exists(target,arr))continue;routed=true;
          const from=placeRef(place),dep=departure(t0),journey=slim(G.Navigation.journey(nav,dep,cal,W)),arrival=journey.arrival,arrT=dTime(arrival);
          const cost=state?0:Math.min(wealth*.12,journey.days*.04);wealth-=cost;
          place=Q().location(h,{kind:'city',id:c.id},arrT);
          const owner=place.owner,why0=c.detour?`原定的路走不通，先绕道到${place.name}，再作打算`:typeof purpose==='function'?purpose(c):purpose,why=/[。！？）]$/.test(why0)?why0:why0+'。';
          const e=add('migration',arrT,{title:c.detour?'绕道':typeof title==='function'?title(c):title,text:`由${from.name}${journey.modeId==='horse'?'策马':journey.modeId==='carriage'?'乘车':'步行'}${journey.seaKm>0?'、渡海':''}${journey.routeKind==='offroad'?'翻越无路之地':journey.routeKind==='mixed'?'经道路与荒野':'沿驿路'}前往${place.name}，行程约 ${journey.km} 公里、${journey.days.toFixed(0)} 日。${why}`,from,travelDays:journey.days,distanceKm:journey.km,routeKind:journey.routeKind,resourceCost:+cost.toFixed(1),pursuit:true,purpose:why,polity:polityName(h,owner,arrT),owner,newPolity:owner>=0&&!p._footprint.polities.has(owner),...extra});
          e.date={...arrival,month:G.HistoryDate.month(arrT),precision:'day'};clock=eventTime(p,e);
          p.trajectory.push({eventId:e.id,year:arrival.year,day:arrival.day,from,to:placeRef(place),journey});p.story.journeys.push(e.id);p._footprint.km+=journey.km;visit();lastOwner=place.owner;lastRegionFaith=Q().logAt(h.relLog,place.region,clock);
          if(hazard)roadHazard(journey);
          return{event:e,journey,target:c,detour:!!c.detour};
        }
        if(!routed)blocked.add(fromKey+'>'+c.id);
      }
      return null;
    }
    function relocate(toPlace,kind,title,text,extra={}){
      const from=placeRef(place),t=Math.max(clock,extra.at??clock);place=toPlace;const e=add(kind,t,{title,text,from,...extra},extra.world?'month':'day');
      p.trajectory.push({eventId:e.id,year:e.year,day:e.date.day,from,to:placeRef(place),lines:[]});visit();lastOwner=place.owner;lastRegionFaith=Q().logAt(h.relLog,place.region,clock);return e;
    }
    function roadHazard(j){
      const risk=(j.routeKind==='offroad'?.16:j.routeKind==='mixed'?.1:.05)+(j.km>1500?.05:0)+(j.seaKm>0?.05:0);
      if(!chance(risk))return;
      const sea=j.seaKm>0&&chance(.5),kind=sea?'海上风浪':pick(['山贼','风雪','迷路','洪水','渡口翻船','疫气']);
      const loss=Math.round(4+rnd()*8),hurt=Math.round(3+rnd()*9);wealth=Math.max(0,wealth-loss);health=Math.max(5,health-hurt);
      const text={海上风浪:'渡海时遭遇风浪，船险些倾覆，随身行李散失大半',山贼:'途中遭遇山贼劫道，财物被抢走一部分，好在保住性命',风雪:'途中遇上大风雪，困在驿站多日，冻伤了手脚',迷路:'在荒野中迷失方向，绕了许多冤枉路，干粮几乎吃尽',洪水:'途经河谷时山洪暴发，只得弃了车马涉水逃生',渡口翻船:'渡河时船翻，在冷水里挣扎上岸，大病一场',疫气:'途中染上瘴疠之气，高烧数日才退'}[kind];
      note('injury',clock,'旅途险阻',`${text}。损失家资 ${loss}，健康受损。`,{hazard:kind});
    }
    // ---------- 候选目的地 ----------
    function cities(weight,{maxD=320}={}){
      const out=[],t=clock,hereId=place.kind==='city'?place.id:-1;
      for(let i=0;i<h.cities.length;i++){const c=h.cities[i];if(i===hereId||!Q().exists(c,t))continue;const d=dist(place,c);if(d>maxD)continue;const w=weight(i,c,d);if(w>0)out.push({id:i,w,d});}
      return out;
    }
    const band=(d,pref)=>Math.exp(-(((d-pref)/Math.max(8,pref))**2))+.04;
    const TIER={metropolis:4,city:2.5,town:1.2,site:.5};
    const seenCity=i=>p._footprint.cities.has(i);
    const nearestCity=(r,t,x,y)=>{let best=null,bd=Infinity;for(const i of idx.cityByRegion.get(r)||[]){const c=h.cities[i];if(!Q().exists(c,t))continue;const d=x==null?0:dist({x,y},c);if(d<bd){bd=d;best=i;}}return best;};
    const cityNear=(x,y,t,maxD=40)=>{let best=null,bd=maxD;for(let i=0;i<h.cities.length;i++){const c=h.cities[i];if(!Q().exists(c,t))continue;const d=dist({x,y},c);if(d<bd){bd=d;best=i;}}return best;};
    const placeInRegion=(r,t,x,y)=>{const id=nearestCity(r,t,x,y);return id!=null?Q().location(h,{kind:'city',id},t):Q().location(h,{kind:'rural',id:r},t);};
    function recentWorld(region,from,to,kinds){return yearsOf(idx.byYear,from,to).filter(e=>e.r===region&&e.time>=from&&e.time<=to&&(!kinds||kinds.includes(e.kind)));}
    function troubleSpots(from,to,kinds){
      const out=[];for(const e of yearsOf(idx.byYear,from,to))if(e.time>=from&&e.time<=to&&kinds.includes(e.kind)&&e.r>0)out.push({r:e.r,e,x:h.cx[e.r],y:h.cy[e.r]});
      return out;
    }
    function polityCities(pid,t,tiers){const out=[];for(let i=0;i<h.cities.length;i++){const c=h.cities[i];if(!Q().exists(c,t)||(tiers&&!tiers.includes(c.tier)))continue;if(Q().logAt(h.own,c.r,t,'owner')===pid)out.push(i);}return out;}
    function nearestCapital(t,except=-1){let best=null,bd=Infinity;for(let pid=0;pid<(h.polities||[]).length;pid++){if(pid===except||!alivePolity(h,pid,t))continue;const cap=capitalOf(h,pid,t);if(cap==null)continue;const d=dist(place,h.cities[cap]);if(d<bd){bd=d;best={pid,cap,d};}}return best;}
    function capitalsNear(t,maxD,except=-1){const out=[];for(let pid=0;pid<(h.polities||[]).length;pid++){if(pid===except||!alivePolity(h,pid,t))continue;const cap=capitalOf(h,pid,t);if(cap==null)continue;const d=dist(place,h.cities[cap]);if(d<=maxD)out.push({pid,cap,d});}return out;}
    // ---------- 效力的国家 ----------
    function findLord(t,why){
      let owner=Q().logAt(h.own,place.region,t,'owner');
      if(!(owner>=0&&alivePolity(h,owner,t)&&capitalOf(h,owner,t)!=null)){const n=nearestCapital(t);owner=n?n.pid:-1;}
      if(owner>=0)serve(owner,t,why);return owner;
    }
    function toCapital(purpose,title){const cap=capitalOf(h,serving,clock);if(cap==null)return false;if(place.kind==='city'&&place.id===cap)return true;travel([{id:cap,w:1}],purpose,{title,state:rank>=0});return place.kind==='city'&&place.id===cap;}
    // ---------- 战役 ----------
    function marchJourney(c,side,depT){
      const pts=[];let prev=null;for(const [x0,y] of c.route?.points||[]){let x=x0;if(prev!==null){while(x-prev>W/2)x-=W;while(prev-x>W/2)x+=W;}pts.push(x,y);prev=x;}
      if(pts.length<4)return null;
      const days=Math.max(1,c.forces[side]?.travelDays||c.plan?.contact||5),seg=[];let L=0;for(let i=2;i<pts.length;i+=2){L+=Math.hypot(pts[i]-pts[i-2],pts[i+1]-pts[i-1]);seg.push(L);}
      if(!(L>0))return null;
      const pointDays=[0,...seg.map(v=>v/L*days)];pointDays[pointDays.length-1]=days;
      const dep=departure(depT);
      return slim({pts,pointDays,segments:[{start:0,end:pointDays.length-1,cls:'path',startDay:0,endDay:days}],km:Math.max(1,Math.round(c.route.km||L*idx.kmPerUnit)),seaKm:0,railKm:0,days,mode:'行军',modeId:'march',travelSpeed:1,routeKind:'mixed',shipName:'',legs:[],passed:[],year:dTime(dep),roadIds:[],departure:dep,arrival:G.Navigation.dateAfter(dep,days,cal),calendar:{daysPerYear:cal.daysPerYear,hoursPerDay:cal.hoursPerDay},width:W});
    }
    const OBJ={border:'争夺边地',city:'攻打城池',homeland:'收复故土'};
    function joinCampaign(c,side,asWhat){
      const force=c.forces?.[side];if(!force||!(force.mobilized>0)||c.startTime<clock||c.resultTime>=end())return false;
      const me=side==='attacker'?c.attacker:c.defender,foe=side==='attacker'?c.defender:c.attacker,t0=c.startTime;
      const myName=role==='rebel'&&rebelName&&me===serving?rebelName:polityName(h,me,t0),foeName=foe>=0?polityName(h,foe,t0):'当地部族',musterR=side==='attacker'?c.source:c.target,targetName=regionName(c.target,t0);
      if(place.region!==musterR){const to=placeInRegion(musterR,t0,h.cx[musterR],h.cy[musterR]);relocate(to,'battle','奉调集结',`${myName}${side==='attacker'?'出兵'+(OBJ[c.objective]||'征伐'):'抵御'+foeName+'来犯'}，${TA}以${asWhat}身份奉调赶赴${to.name}集结。`,{at:t0,campaignId:c.id,stage:'muster'});}
      else note('battle',t0,'出征',`${myName}${side==='attacker'?'出兵'+(OBJ[c.objective]||'征伐')+'，进攻'+foeName+'的'+targetName:'抵御'+foeName+'来犯，守卫'+targetName}。${TA}以${asWhat}身份随军，全军动员 ${force.mobilized.toLocaleString()} 人。`,{campaignId:c.id,stage:'muster'});
      if(side==='attacker'){const j=marchJourney(c,side,Math.max(clock,t0+(c.plan?.muster||0)/cal.daysPerYear));if(j&&dTime(j.arrival)<c.resultTime){const from=placeRef(place),arrT=dTime(j.arrival);place=placeInRegion(c.target,arrT,j.pts.at(-2),j.pts.at(-1));const e=add('migration',arrT,{title:'行军',text:`随大军自${from.name}开拔，行军约 ${j.km} 公里、${j.days.toFixed(0)} 日，兵临${place.name}。`,from,travelDays:j.days,distanceKm:j.km,routeKind:'mixed',resourceCost:0,pursuit:false,march:true,campaignId:c.id,polity:polityName(h,place.owner,arrT),owner:place.owner});e.date={...j.arrival,month:G.HistoryDate.month(arrT),precision:'day'};clock=eventTime(p,e);p.trajectory.push({eventId:e.id,year:j.arrival.year,day:j.arrival.day,from,to:placeRef(place),journey:j});p.story.journeys.push(e.id);p._footprint.km+=j.km;visit();}}
      const won=(c.status==='won')===(side==='attacker'),deaths=Object.values(force.deaths||{}).reduce((a,b)=>a+b,0),ratio=deaths/Math.max(1,force.mobilized);
      const tactic=c.tactics?.[0],tText=tactic?`${tactic.side===side?'我军':'敌军'}${tactic.label}${tactic.side===side?'奏效':'，我军阵线一度动摇'}`:'两军正面交锋';
      const lethal=ratio*(rank>=4?.18:.4)*(temper.id==='bold'?1.3:temper.id==='careful'?.7:1);
      if(chance(lethal)){die(c.resultTime,`战死于${regionName(c.target,c.resultTime)}`,'battle',{campaignId:c.id,world:{text:`${myName}与${foeName}之战`,year:Math.floor(c.resultTime),month:G.HistoryDate.month(c.resultTime),kind:'campaign'}});return true;}
      let promo=false;
      if(won){fame+=1.5+Math.max(0,rank)*.4+(deaths>800?1:0);if(rank<0||chance(.5)){promo=promote();}wealth=Math.min(100,wealth+(role==='mercenary'?14:5));}
      else{fame+=.3;health=Math.max(10,health-(6+rnd()*14));if(role==='mercenary')wealth=Math.min(100,wealth+4);}
      if(chance(won?.12:.3)&&health>20){health=Math.max(10,health-10);}
      const after=won&&side==='attacker'?`，${c.control?.to===me?targetName+'自此归'+myName+'所有':'敌军溃退'}`:won?'，敌军退走':'';
      note('battle',c.resultTime,won?'大捷':'兵败',`${tText}。${won?myName+'获胜'+after:myName+'战败，'+(side==='attacker'?'残部退回':'城下失守')}。此役我方阵亡 ${deaths.toLocaleString()} 人。${promo?`${TA}因战功升为${rankName()}。`:won?`${TA}在阵中立下战功。`:`${TA}${health<50?'负了重伤，':''}随残部撤出战场。`}`,{campaignId:c.id,won,side,rankTitle:rankName(),world:{text:`${myName}与${foeName}之战（${targetName}）`,year:Math.floor(c.resultTime),month:G.HistoryDate.month(c.resultTime),kind:'campaign'}});
      if(!won&&side==='attacker'){const back=placeInRegion(c.source,clock,h.cx[c.source],h.cy[c.source]);if(back.region!==place.region)relocate(back,'return','撤军',`随败军撤回${back.name}。`);}
      clock=Math.max(clock,Math.min(end(),c.endTime||c.resultTime));return true;
    }
    function upcomingCampaigns(pid,from,to){return(idx.campByPolity.get(pid)||[]).filter(c=>c.startTime>=from&&c.startTime<to);}
    // ---------- 朝局：效力之国的变故 ----------
    function court(year){
      if(serving<0||!(['official','general','envoy','rebel'].includes(role)||rank>=2))return;
      const t0=Math.max(year,clock),t1=year+1;
      // 新君即位
      const rulers=h.polities[serving]?.rulers||[];
      for(const row of rulers){if(row[0]<t0||row[0]>=t1||row[0]<=servedSince)continue;if(rank<1)break;
        const favor=rnd()+F()*.02;const pol=polityName(h,serving,row[0]);
        if(favor>.75&&rank>=0&&promote()){fame+=1;note('court',row[0],'新君即位',`${pol}新君${row[1]}即位，素闻${TA}之名，擢为${rankName()}。`,{world:{text:`${row[1]}即${pol}${row[2]||'君'}位`,year:Math.floor(row[0]),month:G.HistoryDate.month(row[0]),kind:'ruler'}});}
        else if(favor<.22&&rank>=2){rank=Math.max(0,rank-1);note('court',row[0],'新君即位',`${pol}新君${row[1]}即位，起用亲信，${TA}被调为${rankName()}，渐受冷落。`,{world:{text:`${row[1]}即${pol}${row[2]||'君'}位`,year:Math.floor(row[0]),month:G.HistoryDate.month(row[0]),kind:'ruler'}});}
        else if(chance(.35))note('court',row[0],'新君即位',`${pol}改元，新君${row[1]}即位。${TA}仍任${rankName()}。`,{world:{text:`${row[1]}即位`,year:Math.floor(row[0]),month:G.HistoryDate.month(row[0]),kind:'ruler'}});
        break;
      }
      for(const e of idx.byYear.get(year)||[]){
        if(e.time<t0||p.death||serving<0)continue;if(e.p!==serving&&e.q!==serving)continue;if(seenWorld.has(e))continue;seenWorld.add(e);
        const w=worldRef(e),k=e.kind;
        if((k==='coup'||k==='overthrow'||k==='dynasty'||k==='revolution'||k==='house')&&(e.q===serving||(k==='house'&&e.p===serving))){
          if(role==='rebel'&&e.p===serving)continue;
          const newLord=k==='house'?serving:e.p;
          if(rank>=1&&chance(.45+(rank>=4?.15:0))){rank=Math.max(0,rank-2);fame=Math.max(0,fame-1);note('court',e.time,'政局剧变',`${e.text}。${TA}被视为旧朝之人，罢去官职。`,{world:w});exile(e.time,'罢官后离开都城');}
          else{if(newLord>=0&&newLord!==serving)serve(newLord,e.time);note('court',e.time,'改朝换代',`${e.text}。${TA}审时度势，归附新朝，仍任${rankName()}。`,{world:w,serving:polityName(h,serving,e.time)});}
        }else if((k==='annex'||k==='fromState'||k==='vassalAnnex')&&e.q===serving){
          if(chance(.5)&&e.p>=0&&alivePolity(h,e.p,e.time)){serve(e.p,e.time);rank=Math.max(0,rank-1);note('court',e.time,'故国覆亡',`${e.text}。故国已亡，${TA}忍辱出仕新主${polityName(h,e.p,e.time)}，降为${rankName()}。`,{world:w,serving:polityName(h,serving,e.time)});}
          else{note('court',e.time,'故国覆亡',`${e.text}。${TA}不愿侍奉新主，以遗民自处。`,{world:w});serving=-1;if(['official','envoy','general'].includes(role)&&chance(.5)){setRole('wanderer',-1);note('aspiration',clock,'心志转变',`国破之后，${TA}散去家财，决意云游四方，看看这天下究竟会走向何处。`,{path:'wanderer'});}else exile(e.time,'亡国后远走他乡');}
        }else if(k==='capital'&&e.p===serving&&e.city!=null&&rank>=0&&['official','envoy','general'].includes(role)){
          if(!(place.kind==='city'&&place.id===e.city)){const trip=travel([{id:e.city,w:1}],`随朝廷迁往新都。（${e.text}）`,{title:'随朝迁都',state:true});if(!trip)note('court',e.time,'迁都',`${e.text}。${TA}留守旧地。`,{world:w});}
        }else if((k==='convert'||k==='theocracy'||k==='schism')&&e.p===serving&&e.religion!=null&&e.religion!==currentReligion){
          const rel=religionName(h,e.religion);
          if(chance(rank>=2?.65:.45)){convert(e.religion,e.time,`${e.text}。${TA}随国改奉${rel}。`,w);}
          else{if(rank>=1)rank=Math.max(0,rank-1);note('faith',e.time,'坚守旧信',`${e.text}。${TA}不肯改奉${rel}，${rank>=0?'被排挤出中枢，降为'+rankName():'因此受到排挤'}。`,{world:w});if(k==='theocracy'&&chance(.4))exile(e.time,'因信仰不同遭到逼迫，出走他国');}
        }else if((k==='crown'||k==='unify'||k==='regal'||k==='empire')&&e.p===serving){fame+=.8;if(rank>=0&&chance(.4))promote();note('court',e.time,'国势鼎盛',`${e.text}。朝野振奋，${TA}${rank>=0?'以'+rankName()+'身份参与典礼':'躬逢其盛'}。`,{world:w});}
        else if(k==='sack'&&e.q===serving){note('court',e.time,'都城告急',`${e.text}。${TA}${place.kind==='city'&&place.id===e.city?'身陷城中，侥幸逃生':'闻讯痛心疾首'}。`,{world:w});if(place.kind==='city'&&place.id===e.city){health=Math.max(10,health-12);wealth=Math.max(0,wealth-15);}}
        else if(k==='vassal'&&e.q===serving){note('court',e.time,'称臣纳贡',`${e.text}。${TA}引以为国耻。`,{world:w});if(role==='envoy'&&e.p>=0){const cap=capitalOf(h,e.p,e.time);if(cap!=null)travel([{id:cap,w:1}],`奉命出使宗主国${polityName(h,e.p,e.time)}，呈递国书、商议岁贡。`,{title:'出使',state:true});}}
        else if(k==='vassal'&&e.p===serving){note('court',e.time,'接纳附庸',`${e.text}。${TA}见证两国宗藩关系的形成。`,{world:w});}
        else if(k==='revolt'&&e.q===serving&&role==='general'){note('court',e.time,'奉命平叛',`${e.text}。${TA}奉命率部前往弹压。`,{world:w});const to=nearestCity(e.r,e.time,h.cx[e.r],h.cy[e.r]);if(to!=null)travel([{id:to,w:1}],'率部开赴乱地。',{title:'出兵平叛',state:true});}
        else if(k==='suppress'&&e.p===serving&&role!=='rebel'){if(role==='general'){fame+=1.5;promote();note('battle',e.time,'平定叛乱',`${e.text}。${TA}以功升任${rankName()}。`,{world:w,won:true});}}
        else if((k==='split'||k==='provSecede')&&e.p===serving&&chance(.5))note('court',e.time,'国土分裂',`${e.text}。朝中人心惶惶。`,{world:w});
        else if((k==='decay'||k==='wane')&&e.p===serving&&rank>=2&&chance(.5))note('court',e.time,'朝政日衰',`${e.text}。${TA}屡次上书陈说时弊。`,{world:w});
      }
      const pol=h.polities[serving];if(pol&&pol.died!=null&&pol.died>=t0&&pol.died<t1&&serving>=0){note('court',pol.died,'故国覆亡',`${polityName(h,serving,pol.died-1e-6)}灭亡，${TA}失去了效力的国家。`,{world:{text:polityName(h,serving,pol.died-1e-6)+'灭亡',year:Math.floor(pol.died),month:G.HistoryDate.month(pol.died),kind:'fall'}});serving=-1;if(role==='rebel')setRole('wanderer',-1);}
    }
    function exile(t,why){
      const t0=Math.max(clock,t),caps=capitalsNear(t0,160,serving).filter(x=>x.pid!==serving);
      const trip=travel(caps.length?caps.map(x=>({id:x.cap,w:band(x.d,50),pid:x.pid})):cities((i,c,d)=>TIER[c.tier]*band(d,40)),why,{title:'出走'});
      if(trip){const pid=Q().logAt(h.own,place.region,clock,'owner');if(pid>=0&&pid!==serving&&['official','envoy','general','scholar'].includes(role)&&capitalOf(h,pid,clock)===place.id){serve(pid,clock);note('office',clock,'投奔他国',`来到${polityName(h,pid,clock)}，凭旧日声名重新出仕，任${rankName()}。`,{serving:polityName(h,pid,clock)});}}
      else serving=-1;
    }
    function convert(f,t,text,world){const old=currentReligion;currentReligion=f;add('religion',t,{title:'改宗',text,fromReligion:old,toReligion:f,religionName:religionName(h,f),world},world?'month':'day');}
    function die(t,cause,how,extra={}){
      t=Math.min(end(),Math.max(clock,t));
      if(p.story.status!=='fulfilled')conclude(t,cause);
      const e=add('death',t,{title:'去世',text:`${cause}。`,reason:cause,how,...extra},extra.world?'month':'day');p.death={...e.date,cause};p.aliveAtEnd=false;
    }
    // ---------- 收束：传承或未竟 ----------
    function conclude(t,why){
      if(p.story.status==='fulfilled'||p.story.status==='unfinished')return;
      const fp=p._footprint,cityN=[...fp.cities].filter(x=>x>=0).length,polN=fp.polities.size;
      const summary=`一生行程约 ${Math.round(fp.km).toLocaleString()} 公里，足迹遍及 ${cityN} 座城、${polN} 个国家${served.size?'，历仕'+[...served.values()].map(x=>x.name).slice(0,4).join('、'):''}`;
      const work=legacyWork();
      if(fame>=5||works.length){if(work)works.push(work);p.story.status='fulfilled';add('legacy',t,{title:'身后之名',text:`${summary}。${work?`留下${work.form}《${work.title}》。`:''}${LP().epithetOf(pathId,fame)?`后人称${TA}为“${LP().epithetOf(pathId,fame)}”。`:''}${preachLegacy(t)}`,work,works:works.slice(),summary});}
      else{p.story.status='unfinished';add('unfinished',t,{title:'未竟之志',text:`${summary}。${why?why+'，':''}“${PATH.goal}”终究未能完全实现。`,goal:PATH.goal,reason:why||''});}
    }
    function preachLegacy(t){const won=preached.filter(x=>Q().logAt(h.relLog,x.r,t)===x.f&&x.before!==x.f);return won.length?`${TA}曾宣讲过的${won.slice(0,3).map(x=>x.name).join('、')}，后来都改奉了${religionName(h,won[0].f)}。`:'';}
    function legacyWork(){
      if(!['official','general','envoy','wanderer','merchant','explorer','missionary','pilgrim','scholar','physician','bard','artisan','knight','mercenary','rebel'].includes(pathId))return null;
      const far=[...p._footprint.cities].filter(x=>x>=0).map(i=>({i,d:dist(p.birth.place,h.cities[i])})).sort((a,b)=>b.d-a.d)[0],farName=far?cityName(far.i,clock):p.birth.place.name;
      const lit=education==='literate';
      const T={official:['奏议',lit?'手录成册':'门生整理'],general:['兵略',lit?'手录成册':'部将追记'],envoy:['使'+farName+'录','手录成册'],wanderer:[farName+'游记',lit?'手录成册':'口述成书'],merchant:['商路图志','账簿与路图'],explorer:['远方山川图','手绘地图'],missionary:['传道书','信众传抄'],pilgrim:['朝圣记',lit?'手录成册':'口述成书'],scholar:['论',lit?'手录成册':'弟子笔记'],physician:['方','手录成册'],bard:['诗集','众人传唱'],artisan:['营造法式','图样与口诀'],knight:['剑侠传','坊间传说'],mercenary:['战记','老兵口述'],rebel:['檄文集','民间传抄']}[pathId];
      if(!T||fame<3)return null;
      const head={official:p.birth.place.name.replace(/乡间$/,''),general:'',scholar:pick(['天人','治道','名实','性命','万物']),physician:pick(['千金','济世','伤寒','救急']),bard:pick(['行吟','天涯','长歌','客路'])}[pathId]||'';
      return{title:head+T[0],form:T[1]};
    }
    // ---------- 各方向的一次行动 ----------
    const ACT={
      official(){
        if(serving<0||!alivePolity(h,serving,clock)){if(findLord(clock)<0)return ACT.wanderer();}
        const pol=()=>polityName(h,serving,clock);
        if(rank<0){
          const cap=capitalOf(h,serving,clock);if(cap==null)return ACT.wanderer();
          const tries=fails.get('落第')||0,blockedN=fails.get('行程受阻')||0;
          if(tries+blockedN>=3){rank=0;fame+=.5;return note('office',clock,'受荐入仕',`屡试不第，终得${place.name}长官赏识，举荐为${rankName()}，在${pol()}地方任职。`,{serving:pol(),rankTitle:rankName()});}
          if(!(place.kind==='city'&&place.id===cap)&&!toCapital(`赴${pol()}都城应选，盼一举成名。`,'赴京应选'))return quiet('行程受阻',`想去${pol()}都城应选，却找不到能走通的路，只得在当地做幕僚积攒资历。`);
          const pass=.5+(education==='literate'?.25:0)+(familyClass==='learned'?.1:0)+F()*.02+tries*.12;
          if(chance(pass)){rank=0;fame+=1;return note('office',clock,'入仕',`通过${pol()}的选拔，授${rankName()}，自此踏入仕途。`,{serving:pol(),rankTitle:rankName()});}
          fame+=.2;return quiet('落第',`在${pol()}应选落第，寄居京城，一边抄书糊口一边准备下一次。`);
        }
        if(minister&&chance(.5)){const r=rulerOf(h,serving,clock);fame+=1;const deeds=['主持修订律令','奏请减免赋税','整顿吏治、罢黜贪官','调度粮饷、充实边防','举荐寒门人才'];return note('office',clock,'辅政',`以${rankName()}身份辅佐${r?r.name:'国君'}，${pick(deeds)}。`,{rankTitle:rankName()});}
        const roll=rnd()+F()*.015+(temper.id==='careful'?.05:0);
        const cs=polityCities(serving,clock,['metropolis','city','town']),cap=capitalOf(h,serving,clock);
        if(roll>.62&&rank<6){
          promote();fame+=1;const toCap=rank>=4&&cap!=null&&!(place.kind==='city'&&place.id===cap);
          const ex={rankTitle:rankName()};
          if(toCap&&travel([{id:cap,w:1}],`考绩优异，升任${rankName()}，奉诏入京。`,{title:'奉诏入京',state:true,extra:ex})){}
          else if(!toCap&&cs.length&&chance(.6)&&travel(cs.map(i=>({id:i,w:(TIER[h.cities[i].tier]||1)*band(dist(place,h.cities[i]),35)})),c=>`升任${rankName()}，赴${cityName(c.id,clock)}到任。`,{title:'升迁赴任',state:true,extra:ex})){}
          else note('office',clock,'升迁',`考绩优异，在${place.name}升任${rankName()}。`,ex);
          if(rank>=6&&!minister){minister=true;fame+=2;note('office',clock,'拜相',`位极人臣，拜为${pol()}${rankName()}，总揽朝政。`,{rankTitle:rankName()});}
          return;
        }
        if(roll<.14&&rank>=1){
          rank=Math.max(0,rank-1);const far=cs.filter(i=>dist(h.cities[i],h.cities[cap??i]||place)>20);
          const why=pick(['因直言进谏触怒权贵','受同僚弹劾','卷入朋党之争','所辖之地出了大案']);
          if(far.length&&travel(far.map(i=>({id:i,w:1+dist(place,h.cities[i])/30})),c=>`${why}，被贬为${rankName()}，远赴${cityName(c.id,clock)}。`,{title:'贬谪',state:true,extra:{rankTitle:rankName()}}))return;
          return note('office',clock,'贬谪',`${why}，降为${rankName()}。`,{rankTitle:rankName()});
        }
        // 政绩：读取当地近况
        const r=place.region,near=recentWorld(r,clock-3,clock,['disaster','plague','revolt','sack','ruin']);
        const war=yearsOf(idx.warByYear,clock-2,clock).find(e=>e.regions?.includes(r)&&e.startYear<=clock);
        let deed;if(near.length){const e=near.at(-1);deed={disaster:'开仓赈济灾民',plague:'设立病坊、隔离疫区',revolt:'招抚流民、安定地方',sack:'收拾战后残局、重建城池',ruin:'安置流离失所的百姓'}[e.kind]+`（${e.text}）`;}
        else if(war)deed='战后安抚百姓、修补城防';
        else deed=pick(['兴修水利','劝课农桑','清理积案','兴办学校','丈量田亩','整顿驿路','平抑粮价','缉捕盗匪']);
        fame+=1;wealth=Math.min(100,wealth+3);
        if(cs.length>1&&chance(.45)){note('office',clock,'政绩',`在${place.name}任上${deed}，颇得民心。`,{rankTitle:rankName()});return travel(cs.map(i=>({id:i,w:(TIER[h.cities[i].tier]||1)*band(dist(place,h.cities[i]),30)*(seenCity(i)?.5:1.5)})),c=>`任满调往${cityName(c.id,clock)}，仍任${rankName()}。`,{title:'调任',state:true,extra:{rankTitle:rankName()}});}
        return note('office',clock,'政绩',`在${place.name}任上${deed}，颇得民心。`,{rankTitle:rankName()});
      },
      general(){
        if(serving<0||!alivePolity(h,serving,clock)){if(findLord(clock)<0)return ACT.mercenary();}
        const pol=polityName(h,serving,clock);
        if(rank<0){
          const cap=capitalOf(h,serving,clock);
          const camp=upcomingCampaigns(serving,clock+.02,clock+2).find(c=>c.forces?.[c.attacker===serving?'attacker':'defender']?.mobilized>0);
          if(camp){rank=0;note('office',clock,'投军',`投入${pol}军中，从${rankName()}做起。`,{serving:pol,rankTitle:rankName()});return joinCampaign(camp,camp.attacker===serving?'attacker':'defender',rankName());}
          if(cap!=null&&!(place.kind==='city'&&place.id===cap))toCapital(`前往${pol}都城投军。`,'投军');
          rank=0;return note('office',clock,'投军',`投入${pol}军中，从${rankName()}做起，操练弓马。`,{serving:pol,rankTitle:rankName()});
        }
        if(rank>=5&&fame>=9&&!minister&&ageAt(clock)>=biology.maturity+12&&chance(.5)){
          const cap=capitalOf(h,serving,clock);if(cap!=null){if(!(place.kind==='city'&&place.id===cap))travel([{id:cap,w:1}],`功勋卓著，奉诏还朝。`,{title:'奉诏还朝',state:true});setRole('official',6);minister=true;fame+=3;return note('office',clock,'出将入相',`解下兵权，入朝拜为${pol}${rankName()}。由将而相，朝野称羡。`,{rankTitle:rankName()});}
        }
        const camps=upcomingCampaigns(serving,clock+.01,clock+1.6).filter(c=>c.forces?.[c.attacker===serving?'attacker':'defender']?.mobilized>0);
        if(camps.length){const c=camps.sort((a,b)=>(b.forces[b.attacker===serving?'attacker':'defender'].mobilized)-(a.forces[a.attacker===serving?'attacker':'defender'].mobilized))[Math.floor(rnd()*Math.min(2,camps.length))];if(joinCampaign(c,c.attacker===serving?'attacker':'defender',rankName()))return;}
        // 戍边
        const forts=(h.forts||[]).filter(f=>f.year<=clock&&Q().logAt(h.own,f.region,clock,'owner')===serving&&(Q().rowAt(f.statusLog,clock)?.[1]??'active')==='active');
        if(forts.length){const f=pick(forts),c=cityNear(f.x,f.y,clock,60);if(c!=null){const up=chance(.18)&&rank<4&&promote();if(travel([{id:c,w:1}],`奉命戍守${f.name}，整饬边防${up?'，升为'+rankName():''}。`,{title:'戍边',state:true,extra:{rankTitle:rankName()}})){fame+=.6;return;}}}
        const cs=polityCities(serving,clock,['metropolis','city']);
        if(cs.length&&travel(cs.map(i=>({id:i,w:band(dist(place,h.cities[i]),30)})),c=>`调任${cityName(c.id,clock)}驻防，操练士卒。`,{title:'移防',state:true}))return;
        return note('office',clock,'练兵',`在${place.name}操练士卒，整修军械。`,{rankTitle:rankName()});
      },
      envoy(){
        if(serving<0||!alivePolity(h,serving,clock)){if(findLord(clock)<0)return ACT.wanderer();}
        const pol=polityName(h,serving,clock),home=capitalOf(h,serving,clock);
        if(rank<0){if(home!=null&&!(place.kind==='city'&&place.id===home))toCapital(`赴${pol}都城，投入鸿胪寺。`,'入京');rank=0;return note('office',clock,'入仕',`因通晓诸国语言风俗，被${pol}选为${rankName()}。`,{serving:pol,rankTitle:rankName()});}
        if(place.kind==='city'&&home!=null&&place.id!==home&&chance(.6)){travel([{id:home,w:1}],'出使归来，回京复命。',{title:'复命',state:true});return;}
        const caps=capitalsNear(clock,200,serving);if(!caps.length)return note('office',clock,'待命',`在${place.name}整理诸国档案，等待下一次出使。`);
        const war=pid=>(idx.campByPolity.get(serving)||[]).some(c=>(c.attacker===pid||c.defender===pid)&&c.startTime<=clock&&c.startTime>clock-5);
        const trip=travel(caps.map(x=>({id:x.cap,w:band(x.d,55)*(war(x.pid)?4:1)*(seenCity(x.cap)?.6:1.4),pid:x.pid})),c=>`奉${pol}国书出使${polityName(h,Q().logAt(h.own,h.cities[c.id].r,clock,'owner'),clock)}。`,{title:'出使',state:true});
        if(!trip)return quiet('使路断绝',`欲出使邻国，道路不通，只得暂返。`);
        const host=Q().logAt(h.own,place.region,clock,'owner'),hostName=polityName(h,host,clock),r=rulerOf(h,host,clock),atWar=war(host);
        const roll=rnd()+F()*.02+(temper.id==='adaptable'?.08:0);
        if(roll<.12){const yrs=1+Math.floor(rnd()*3);fame+=1;note('captivity',clock,'被扣留',`${hostName}${r?'的'+r.name:''}扣下使团，${TA}被软禁 ${yrs} 年，始终不肯屈节。`);clock=Math.min(end(),clock+yrs/cal.earthYearsPerYear*.9);return note('mission',clock,'脱身归国',`终于获释，持节而归，名动一时。`,{host:hostName});}
        const ok=roll>.4;fame+=ok?2:.5;if(ok&&chance(.5))promote();
        const what=atWar?(ok?`两国刚刚交兵，${TA}据理力争，促成和议`:'两国积怨已深，和议未成，被冷遇送归'):(ok?pick(['缔结盟约','议定通商之约','商定边界','促成两国联姻']):pick(['对方态度冷淡，只换回几句客套','被安排在驿馆久候，不得要领']));
        return note('mission',clock,ok?'出使有成':'出使受挫',`觐见${hostName}${r?'的'+r.name:'君主'}，${what}。${ok&&rank>0?'归国后升为'+rankName()+'。':''}`,{host:hostName,ok});
      },
      wanderer(){
        const trip=travel(cities((i,c,d)=>(TIER[c.tier]||1)*(c.type==='ancient'?2:1)*(c.type?.includes('port')?1.3:1)*band(d,85)*(seenCity(i)?.15:3)*(p._footprint.polities.has(Q().logAt(h.own,c.r,clock,'owner'))?1:2.2)),pick(['听说那里风物迥异，想亲眼去看看','追着一条从未走过的路','想看看世界另一头的人如何生活','跟着商队一路向远方']),{title:'云游'});
        if(!trip)return quiet('行路受阻','欲远行而道路不通，在当地暂住，帮人写信抄书换些盘缠。');
        return sight(trip,'游历');
      },
      knight(){
        const spots=troubleSpots(clock-3,clock,['revolt','sack','rebelState','steppeRevolt','disaster','plague','ruin']).concat(yearsOf(idx.warByYear,clock-2,clock).filter(e=>e.startYear<=clock).flatMap(e=>(e.exposure||[]).filter(x=>x.combat).map(x=>({r:x.region,war:e,x:h.cx[x.region],y:h.cy[x.region]}))));
        const cands=[];for(const s of spots){const id=nearestCity(s.r,clock,s.x,s.y);if(id==null)continue;const d=dist(place,h.cities[id]);if(d<110)cands.push({id,w:band(d,35)*(s.war?1.5:2),spot:s});}
        const trip=cands.length?travel(cands,c=>c.spot.e?`听闻${c.spot.e.text}，仗剑赶去。`:'听说那边战火正烈，赶去相助百姓。',{title:'仗剑远行'}):travel(cities((i,c,d)=>(TIER[c.tier]||1)*band(d,45)*(seenCity(i)?.3:2)),'仗剑出游，四处寻访不平之事。',{title:'游侠'});
        if(!trip)return quiet('困守','欲出游而无路可走，只得在当地习武授徒。');
        const s=trip.target.spot;let text,title;
        if(s?.e){const k=s.e.kind;title={revolt:'乱世护民',sack:'城破救人',rebelState:'乱世护民',steppeRevolt:'边地护民',disaster:'救灾',plague:'护送病患',ruin:'废墟救人'}[k];text={revolt:'乱兵四起，护着一群逃难的百姓穿过战线',sack:'在破城的混乱中救出被困的老幼',rebelState:'在新旧政权交战的夹缝中护送难民出城',steppeRevolt:'在草原诸部叛乱中，护送商旅脱险',disaster:'灾后盗匪横行，与乡勇一起守护粮仓',plague:'护送病患与医者穿过封锁',ruin:'在废墟里救出幸存者'}[k]+'。';}
        else if(s?.war){title='乱世护民';text=`${regionName(s.r,clock)}兵火未熄，${TA}护送一批难民穿过战线，免遭乱兵劫掠。`;}
        else{title=pick(['除暴安良','打抱不平','比武扬名']);text=pick([`在${place.name}击退一伙为祸乡里的恶霸`,`在${place.name}替一户受欺压的人家讨回公道`,`在${place.name}与当地高手比武，一战成名`])+'。';}
        fame+=1.5;if(chance(.22)){health=Math.max(8,health-(8+rnd()*14));text+=`激斗中${TA}身负刀伤，养了许久。`;}
        if(chance(.03+(temper.id==='bold'?.03:0))&&ageAt(clock)>biology.maturity+6)return die(clock,`在${place.name}与人恶斗，伤重不治`,'duel');
        return note('deed',clock,title,text,{world:worldRef(s?.e)});
      },
      mercenary(){
        const near=yearsOf(idx.campByYear,clock+.02,clock+1.3).filter(c=>c.startTime>clock+.02&&c.startTime<clock+1.3&&dist(place,{x:h.cx[c.source],y:h.cy[c.source]})<140);
        const opts=near.flatMap(c=>['attacker','defender'].filter(s=>c.forces?.[s]?.mobilized>0&&(s==='attacker'?c.attacker:c.defender)>=0).map(s=>({c,s,w:Math.sqrt(c.forces[s].mobilized)*(s==='attacker'?1.4:1)})));
        if(opts.length){const o=draw(opts,rnd,x=>x.w),me=o.s==='attacker'?o.c.attacker:o.c.defender;serve(me,clock);if(rank<0)rank=0;else if(fame>rank*4+3)promote();note('office',clock,'受雇',`受雇于${polityName(h,me,clock)}，领了定金。`,{serving:polityName(h,me,clock)});if(joinCampaign(o.c,o.s,rankName()))return;}
        const trip=travel(cities((i,c,d)=>(TIER[c.tier]||1)*band(d,60)*(seenCity(i)?.4:1.6)),'听说那边要打仗，前去寻找雇主。',{title:'投奔战场'});
        if(trip){wealth=Math.min(100,wealth+3);return note('deed',clock,'护卫商队',`暂无战事可接，在${place.name}给商队当护卫糊口。`);}
        return quiet('闲居',`无仗可打，在${place.name}酒肆里消磨时日。`);
      },
      rebel(){
        // 正在义军中：看义军的结局
        if(serving>=0&&rebelName){
          const evs=yearsOf(idx.byYear,clock-.01,clock+2).filter(e=>e.time>=clock&&e.p===serving&&['suppress','rebelState','overthrow','dynasty'].includes(e.kind));
          const camps=upcomingCampaigns(serving,clock+.01,clock+1.5).filter(c=>c.attacker===serving&&c.forces?.attacker?.mobilized>0);
          if(camps.length&&(!evs.length||camps[0].startTime<evs[0].time)){if(joinCampaign(camps[0],'attacker',rankName()))return;}
          if(evs.length){const e=evs[0];
            if(e.kind==='suppress'){const name=rebelName;rebelName=null;serving=-1;fame+=1;note('revolt',e.time,'起义失败',`${e.text}。${name}兵败星散，${TA}隐姓埋名逃亡。`,{world:worldRef(e)});if(chance(.08))return die(clock,'被官军搜捕，押赴刑场','execution');return exile(clock,'亡命天涯');}
            const name=rebelName;rebelName=null;fame+=4;setRole('general',4);note('revolt',e.time,'开国功臣',`${e.text}。${TA}以${name}元从之功，受封为${polityName(h,serving,e.time)}${rankName()}。`,{world:worldRef(e),serving:polityName(h,serving,e.time),rankTitle:rankName()});return;}
          const up=chance(.4)&&promote();fame+=.5;const own=polityCities(serving,clock,['metropolis','city','town']);
          if(own.length&&travel(own.map(i=>({id:i,w:band(dist(place,h.cities[i]),25)})),`随${rebelName}转战各地。`,{title:'转战'}))return;
          return note('revolt',clock,'招兵买马',`在${place.name}为${rebelName}招募流民、筹集粮草${up?'，升为'+rankName():''}。`,{rankTitle:rankName()});
        }
        const rev=yearsOf(idx.byYear,clock-1.5,clock+.6).filter(e=>['revolt','steppeRevolt','revolution'].includes(e.kind)&&e.time>=clock-1.5&&e.p>=0&&alivePolity(h,e.p,Math.max(clock,e.time)+.01)&&dist(place,{x:h.cx[e.r],y:h.cy[e.r]})<160);
        if(rev.length){const e=draw(rev,rnd,x=>band(dist(place,{x:h.cx[x.r],y:h.cy[x.r]}),35));const id=nearestCity(e.r,Math.max(clock,e.time),h.cx[e.r],h.cy[e.r]);
          if(id!=null&&!(place.kind==='city'&&place.id===id))travel([{id,w:1}],`听闻${e.text}，星夜赶去投奔。`,{title:'投奔义军'});
          if(!alivePolity(h,e.p,clock))return quiet('来迟一步',`赶到时义军已经星散。`);
          serve(e.p,clock);rebelName=(e.text.match(/爆发(.+?)（/)||e.text.match(/(\S+?起义军)/)||[])[1]||'义军';if(served.has(e.p))served.get(e.p).name=rebelName;rank=0;fame+=1;
          return note('revolt',Math.max(clock,e.time),'揭竿而起',`投入${rebelName}，成为一名${rankName()}。（${e.text}）`,{world:worldRef(e)});
        }
        const trip=travel(cities((i,c,d)=>(TIER[c.tier]||1)*band(d,50)*(seenCity(i)?.4:1.5)),'四处奔走，暗中结交豪杰，等待时机。',{title:'奔走'});
        if(trip){fame+=.3;return note('deed',clock,'结交豪杰',`在${place.name}结识了一批不满时政的豪杰，歃血为盟。`);}
        return quiet('蛰伏',`在${place.name}隐忍蛰伏，等待天下有变。`);
      },
      merchant(){
        const warNow=r=>yearsOf(idx.warByYear,clock-1.5,clock).some(e=>e.regions?.includes(r));
        const trip=travel(cities((i,c,d)=>(TIER[c.tier]||1)*(c.type==='market'?1.8:c.type?.includes('port')?1.5:1)*band(d,48)*(seenCity(i)?.8:1.6)*(warNow(c.r)?(temper.id==='bold'?1.2:.3):1)),c=>`押着一批${pick(['丝绸','茶叶','食盐','铁器','皮毛','香料','瓷器','马匹','谷物','药材','宝石','木材'])}前往${cityName(c.id,clock)}。`,{title:'押货远行'});
        if(!trip)return quiet('商路断绝','商路不通，只能在本地小本经营。');
        const d=trip.journey.km,tier=TIER[h.cities[place.id]?.tier]||1,war=warNow(place.region),plague=recentWorld(place.region,clock-2,clock,['plague']).length;
        let gain=Math.round((3+d/300)*Math.sqrt(tier)*(.5+rnd()*1.1));let text;
        if(war&&chance(.45)){gain=-Math.round(8+rnd()*12);text=`${place.name}兵荒马乱，货物被乱军征用，血本无归`;}
        else if(war){gain=Math.round(gain*1.8);text=`${place.name}战事方歇，物资奇缺，货物卖出高价`;}
        else if(plague){gain=-Math.round(4+rnd()*6);text=`${place.name}疫病流行，市面萧条，货物积压折价出手`;}
        else text=gain>8?`货物在${place.name}大受欢迎，获利颇丰`:gain>3?`在${place.name}出完货，小有盈余`:`${place.name}行情不佳，勉强保本`;
        wealth=clamp(wealth+gain,0,100);fame+=gain>0?.8:.2;
        note('trade',clock,gain>=0?'商事':'亏损',`${text}（家资${gain>=0?'+':''}${gain}）。`,{gain});
        if(wealth>=65&&!branches.includes(place.name)&&tier>=2.5&&chance(.5)){branches.push(place.name);fame+=1.5;wealth-=10;note('trade',clock,'开设商号',`在${place.name}开设分号，这是${TA}的第 ${branches.length} 家商号。`,{branch:place.name});}
      },
      explorer(){
        const trip=travel(cities((i,c,d)=>{const young=clock-c.founded;return(young<30?5:young<80?2:.6)*(c.tier==='site'||c.tier==='town'?1.6:1)*band(d,110)*(seenCity(i)?.1:3);},{maxD:340}),c=>{const y=Math.floor(clock-h.cities[c.id].founded);return y<30?`听说${cityName(c.id,clock)}建城才 ${y} 年，那里还有大片荒地。`:'朝着地图边缘走去。';},{title:'拓荒远行'});
        if(!trip)return quiet('前路断绝','想去更远的地方，却被大海与群山挡住，只好在当地开垦荒地。');
        const c=h.cities[place.id],young=clock-c.founded;fame+=young<30?1.5:1;
        const text=young<30?pick([`在新建不久的${place.name}外开垦荒地，筑屋定居`,`为${place.name}的新移民踏勘水源和道路`,`在${place.name}附近找到一处可以开垦的河谷`]):pick([`绘制${place.name}一带的山川地图`,`沿着${place.name}外的河流溯源而上，记下沿途地形`,`在${place.name}以外探出一条新路`]);
        note('deed',clock,young<30?'拓荒':'探路',text+'。');
        if(chance(.25))return sight(trip,'见闻');
      },
      missionary(){
        if(currentReligion<0){const f=Q().logAt(h.relLog,place.region,clock);if(f>=0){convert(f,clock,`在${place.name}聆听${religionName(h,f)}的讲道，皈依此教，立誓将它传扬远方。`);}else return ACT.pilgrim();}
        const mine=currentReligion,trip=travel(cities((i,c,d)=>{const f=Q().logAt(h.relLog,c.r,clock);return(f===mine?.25:f<0?2.2:3)*(TIER[c.tier]||1)*band(d,55)*(seenCity(i)?.5:1.6);}),c=>{const f=Q().logAt(h.relLog,h.cities[c.id].r,clock);return f===mine?'去探望当地的同道。':`那里奉行${religionName(h,f)}，${TA}决意前去传扬${religionName(h,mine)}。`;},{title:'远行传道'});
        if(!trip)return quiet('道路不通','欲往异乡传道，道路不通，便在当地讲经授徒。');
        const f=Q().logAt(h.relLog,place.region,clock),host=Q().logAt(h.own,place.region,clock,'owner'),theo=Q().rowAt(h.polities?.[host]?.gov,clock)?.[2]==='theo';
        if(f===mine){fame+=.5;return note('faith',clock,'会见同道',`与${place.name}的${religionName(h,mine)}信众共修，互相砥砺。`);}
        const roll=rnd()+F()*.015-(theo?.2:0);
        if(roll<.05&&ageAt(clock)>biology.maturity+5)return die(clock,`在${place.name}传道时被当地${religionName(h,f)}的狂热者所害，以身殉道`,'martyr');
        if(roll<.25){note('faith',clock,'被逐',`在${place.name}宣讲${religionName(h,mine)}，被${religionName(h,f)}的祭司斥为异端，驱逐出城。`);return exile(clock,'被驱逐后另觅传道之地');}
        const n=Math.round(10+rnd()*80*(1+F()/10));fame+=1.2+n/150;preached.push({r:place.region,f:mine,before:f,name:place.name});
        return note('faith',clock,roll>.7?'立会':'传道',roll>.7?`在${place.name}建起会所，聚集了约 ${n} 名信众。`:`在${place.name}街头与${religionName(h,f)}的学者辩经，有 ${n} 人听后皈依。`,{converts:n});
      },
      pilgrim(){
        const mine=currentReligion>=0?currentReligion:Q().logAt(h.relLog,place.region,clock),holy=[];
        for(let f=0;f<h.religions.length;f++){const r=h.religions[f];if(!(r.founded<=clock)||!Number.isFinite(r.x))continue;const id=cityNear(r.x,r.y,clock,60);if(id!=null)holy.push({id,f,w:(f===mine?8:r.parent===mine||h.religions[mine]?.parent===f?3:1)*(seenCity(id)?.08:1)*band(dist(place,h.cities[id]),90)});}
        if(!holy.some(x=>!seenCity(x.id))&&chance(.6))return ACT.wanderer();
        const trip=holy.length?travel(holy,c=>{const r=h.religions[c.f];return c.f===mine?`徒步前往${r.name}的发源圣地，朝拜${pick(r.holyList||[r.holy||'圣地'])}。`:`去拜访${r.name}的圣地${pick(r.holyList||[r.holy||'圣地'])}，看看异教的信众如何修行。`;},{title:'朝圣'}):null;
        if(!trip)return ACT.wanderer();
        if(trip.target.f==null)return sight(trip,'见闻');
        const f=trip.target.f,r=h.religions[f];fame+=f===mine?1.5:1;health=Math.max(10,health-(2+rnd()*5));
        if(f!==mine&&chance(.12+(temper.id==='adaptable'?.12:0))){return convert(f,clock,`在${r.name}的圣地苦修多日，心有所悟，改奉${r.name}。`);}
        return note('sight',clock,f===mine?'朝圣':'访圣',f===mine?`跪拜于${pick(r.holyList||[r.holy||'圣地'])}前，瞻仰${r.relic||'圣物'}，苦修 ${Math.round(10+rnd()*60)} 日。`:`在${r.name}的圣地与${r.clergy?.priest||'僧侣'}长谈，记下他们的教义与仪轨。`);
      },
      scholar(){
        const caps=new Set();for(const x of capitalsNear(clock,220))caps.add(x.cap);
        const trip=travel(cities((i,c,d)=>(caps.has(i)?3:1)*(TIER[c.tier]||1)*band(d,55)*(seenCity(i)?.4:1.8)),c=>caps.has(c.id)?`负笈前往${cityName(c.id,clock)}，那里聚集着天下的学者。`:'听说那里有位隐居的名师，前去求教。',{title:'游学'});
        if(!trip)return quiet('闭门著述','道路不通，便闭门读书著述。');
        const at=place.id,isCap=caps.has(at),pid=Q().logAt(h.own,place.region,clock,'owner');
        if(fame>=7&&isCap&&pid>=0&&chance(.45)&&ageAt(clock)<biology.oldAge){serve(pid,clock);setRole('official',4);fame+=1;return note('office',clock,'受征入仕',`学名远播，被${polityName(h,pid,clock)}征召，授${rankName()}。`,{serving:polityName(h,pid,clock),rankTitle:rankName()});}
        const n=p.events.filter(e=>e.kind==='deed'&&e.result.scholar).length,title=n===0?'拜师':pick(['论辩','讲学','著述']);fame+=title==='著述'?2:1.2;
        if(title==='著述'&&chance(.5))works.push({title:pick(['天人','名实','治乱','万物','性命','礼乐','山海'])+pick(['论','考','通义','新说']),form:education==='literate'?'手录成册':'弟子笔记'});
        return note('deed',clock,title,{拜师:`在${place.name}拜一位名宿为师，执弟子礼三年。`,论辩:`在${place.name}与各派学者公开论辩，${chance(.6)?'辩倒对手，声名大噪':'虽未取胜，却令众人折服'}。`,讲学:`在${place.name}开坛讲学，四方学子慕名而来。`,著述:`在${place.name}寓所著书，${works.length?'写成《'+works.at(-1).title+'》':'积稿盈箱'}。`}[title],{scholar:true});
      },
      physician(){
        const spots=troubleSpots(clock-2.5,clock,['plague','disaster']).concat(yearsOf(idx.warByYear,clock-1.5,clock).filter(e=>e.startYear<=clock).flatMap(e=>(e.exposure||[]).filter(x=>x.combat).map(x=>({r:x.region,war:e,x:h.cx[x.region],y:h.cy[x.region]}))));
        const cands=[];for(const s of spots){const id=nearestCity(s.r,clock,s.x,s.y);if(id==null)continue;const d=dist(place,h.cities[id]);if(d<95)cands.push({id,w:band(d,30)*(s.e?.kind==='plague'?4:2),spot:s});}
        const trip=cands.length?travel(cands,c=>c.spot.e?`听闻${c.spot.e.text}，背起药箱赶去。`:'听说那里刚经历战火，伤者无数，赶去救治。',{title:c=>c.spot?.e?.kind==='plague'?'奔赴疫区':c.spot?.e?'奔赴灾区':'奔赴战地'}):travel(cities((i,c,d)=>(TIER[c.tier]||1)*band(d,40)*(seenCity(i)?.4:1.6)),'游方行医，走到哪里治到哪里。',{title:'游方行医'});
        if(!trip)return quiet('坐堂行医',`道路不通，在${place.name}坐堂行医。`);
        const s=trip.target.spot,plague=s?.e?.kind==='plague',n=Math.round((plague?60:s?30:12)+rnd()*(plague?200:60));fame+=plague?2.5:s?1.8:1;
        if(plague&&chance(.22)){health=Math.max(5,health-(15+rnd()*20));if(chance(.15)&&health<40)return die(clock,`在${place.name}救治疫病时染病，不治身亡`,'plague',{world:worldRef(s.e)});note('illness',clock,'染疫',`救治病人时染上疫病，九死一生。`,{world:worldRef(s.e)});}
        const pid=Q().logAt(h.own,place.region,clock,'owner');
        if(fame>=10&&rank<2&&pid>=0&&capitalOf(h,pid,clock)!=null&&chance(.35)){rank=2;serve(pid,clock);const cap=capitalOf(h,pid,clock);if(!(place.kind==='city'&&place.id===cap))travel([{id:cap,w:1}],`名声传入宫中，被${polityName(h,pid,clock)}召为${rankName()}。`,{title:'应召入宫',state:true});return note('deed',clock,'入宫',`入宫为${polityName(h,pid,clock)}的君主诊病。`,{rankTitle:rankName()});}
        if(fame>=4&&rank<1)rank=Math.max(rank,fame>=6?1:0);
        return note('deed',clock,plague?'抗疫':s?'救治伤兵':'行医',plague?`在${place.name}疫区设药棚，救治约 ${n} 名病患。`:s?`在${place.name}救治战后伤者约 ${n} 人。`:`在${place.name}行医，诊治 ${n} 人。`,{world:worldRef(s?.e),saved:n});
      },
      artisan(){
        const forts=yearsOf(idx.fortsByYear,clock-.5,clock+1.5).filter(f=>f.year>=clock-.5),caps=yearsOf(idx.byYear,clock-3,clock).filter(e=>e.kind==='capital'&&e.city!=null&&e.time<=clock);
        const cands=[];for(const f of forts){const id=cityNear(f.x,f.y,clock,60);if(id!=null)cands.push({id,w:4*band(dist(place,h.cities[id]),45),fort:f});}
        for(const e of caps)if(Q().exists(h.cities[e.city],clock))cands.push({id:e.city,w:4*band(dist(place,h.cities[e.city]),50),cap:e});
        const trip=cands.length?travel(cands,c=>c.fort?`应募前往修筑${c.fort.name}。`:`${c.cap.text}，新都大兴土木，${TA}应募前往。`,{title:'应募营建'}):travel(cities((i,c,d)=>{const y=clock-c.founded;return(y<15?4:1)*(TIER[c.tier]||1)*band(d,45)*(seenCity(i)?.4:1.5);}),'背着工具四处寻活。',{title:'游方做工'});
        if(!trip)return quiet('就地做工',`在${place.name}替人修屋造器。`);
        const c=trip.target;let text,title='营建';
        if(c.fort){text=`参与修筑${c.fort.name}，${rank>=2?'主持城墙设计':'负责砌筑城门'}。`;works.length<4&&works.push({title:c.fort.name,form:'亲手营建'});fame+=2;}
        else if(c.cap){text=`参与营建新都${place.name}的宫室，${rank>=2?'主持一座殿宇的营造':'负责雕梁画栋'}。`;fame+=2.2;works.length<4&&works.push({title:place.name+'宫室',form:'亲手营建'});}
        else{const y=clock-h.cities[place.id].founded;title=y<15?'营建':'做工';text=y<15?`${place.name}建城才 ${Math.floor(y)} 年，${TA}参与修建城墙与街市。`:`在${place.name}${pick(['修缮城门','建造桥梁','打造器具','修复神庙'])}。`;fame+=y<15?1.5:.8;}
        wealth=Math.min(100,wealth+4);if(fame>=4&&chance(.5))promote();
        return note('deed',clock,title,text,{world:worldRef(c.cap)});
      },
      bard(){
        const caps=new Set();for(const x of capitalsNear(clock,220))caps.add(x.cap);
        const trip=travel(cities((i,c,d)=>(caps.has(i)?3:1)*(TIER[c.tier]||1)*band(d,60)*(seenCity(i)?.3:1.8)),c=>caps.has(c.id)?`听说${cityName(c.id,clock)}的宫廷礼遇诗人，前去献艺。`:'带着琴一路行吟。',{title:'行吟'});
        if(!trip)return quiet('市井卖唱',`在${place.name}市井卖唱为生。`);
        const ev=recentWorld(place.region,clock-15,clock,['sack','ruin','annex','fall','dynasty','overthrow','plague','disaster','crown','unify','revolt']).at(-1);
        const nm=place.name,poem=ev?{sack:`${nm}哀`,ruin:`${nm}故墟行`,annex:'亡国叹',fall:'故国叹',dynasty:'兴亡曲',overthrow:'兴亡曲',plague:'大疫行',disaster:`${nm}水旱谣`,crown:'一统颂',unify:'一统颂',revolt:`${nm}民谣`}[ev.kind]:pick([`${nm}春望`,`${nm}客中作`,`宿${nm}`,`${nm}夜曲`]);
        works.length<6&&works.push({title:poem,form:'诗篇'});fame+=ev?2:1.2;
        const pid=Q().logAt(h.own,place.region,clock,'owner'),r=caps.has(place.id)&&rulerOf(h,pid,clock);
        if(r&&chance(.55)){const ok=chance(.7);wealth=clamp(wealth+(ok?10:-3),0,100);return note('deed',clock,ok?'宫廷献诗':'触怒君王',ok?`为${polityName(h,pid,clock)}的${r.name}献上《${poem}》，获赏金帛。`:`在${r.name}面前吟诵《${poem}》，诗中暗讽时政，被逐出宫门。`,{poem,world:worldRef(ev)});}
        return note('deed',clock,'作诗',`在${nm}写下《${poem}》${ev?'，咏叹'+ev.text:''}，很快在市井传唱开来。`,{poem,world:worldRef(ev)});
      }
    };
    function sight(trip,title){
      const t=clock,info=Q().district(h,place.region,t),r=rulerOf(h,info.owner,t),bits=[];
      if(info.owner>=0)bits.push(`此地属${info.polity?.name||polityName(h,info.owner,t)}${r&&!/未详|未命名/.test(r.name)?'，'+r.name+'在位':''}`);else bits.push('此地尚无国家统辖，由部族自治');
      bits.push(`居民多奉${religionName(h,info.religion)}`);
      const ev=recentWorld(place.region,t-12,t).filter(e=>!['stage','territoryIntegrate','fort','provSplit','transfer','provRedraw'].includes(e.kind)).at(-1);
      if(ev)bits.push(`当地人还在谈论${Math.max(1,Math.round((t-ev.time)*cal.earthYearsPerYear))}年前的事：${ev.text}`);
      const c=h.cities[place.id];if(c?.type==='ancient')bits.push('城中多古迹，据说是上古文明的遗址');else if(c?.tier==='metropolis')bits.push('城池宏大，人烟稠密，是天下有数的大都会');else if(c?.type?.includes('port'))bits.push('港口帆樯林立，异国商人往来不绝');
      fame+=.6+(trip?.event?.result?.newPolity?.5:0);
      if(info.religion!==currentReligion&&info.religion>=0&&p._footprint.faiths.size>=3&&chance(temper.id==='adaptable'?.12:.05))return convert(info.religion,t,`游历诸国，见过太多信仰，在${place.name}被${religionName(h,info.religion)}打动，改奉此教。`);
      if(title==='游历')title=c?.type==='ancient'?'访古':c?.tier==='metropolis'?'游历名都':c?.type?.includes('port')?'观海':pick(['见闻','游历','客居']);
      return note('sight',t,title,`${bits.join('；')}。`,{world:worldRef(ev)});
    }

    // ---------- 被动时局：所在地的战火、易主、毁城、瘟疫、灾荒、改宗 ----------
    function local(year){
      const start=Math.max(year,clock),stop=year+1,region=place.region,queue=[];
      for(let i=pendingOutcomes.length-1;i>=0;i--)if(pendingOutcomes[i].at<stop)queue.push(...pendingOutcomes.splice(i,1));
      for(const e of Q().effects(h,region,start,stop-1e-8))if(e.startYear>=start&&e.startYear<stop&&!seenWorld.has(e.id))queue.push({at:e.startYear,type:'effect',e,region});
      for(let i=h.own.off[region];i<h.own.off[region+1];i++)if(h.own.year[i]>=start&&h.own.year[i]<stop)queue.push({at:h.own.year[i],type:'owner',region,owner:h.own.owner[i]});
      for(let i=h.relLog.off[region];i<h.relLog.off[region+1];i++)if(h.relLog.year[i]>=start&&h.relLog.year[i]<stop)queue.push({at:h.relLog.year[i],type:'faith',region,faith:h.relLog.val[i]});
      const ruined=place.kind==='city'?h.cities[place.id].ruined:null;
      if(ruined!=null&&ruined>=start&&ruined<stop)queue.push({at:ruined,type:'ruin',region,city:place.id});
      while(queue.length&&!p.death){
        queue.sort((a,b)=>a.at-b.at);const f=queue.shift(),at=f.at;
        if(f.type==='outcome'){if(service?.campaignId!==f.campaignId)continue;service=null;if(f.dead){die(at,'在有记录的战役中阵亡','conscript',{world:f.world});break;}health-=10+rnd()*15;note('return',at,'退伍',`战役结束，${TA}被遣散回乡。`,{world:f.world});continue;}
        if(place.region!==f.region||at+1e-8<clock)continue;
        const ev=yearsOf(idx.byYear,at-.01,at+.01).find(e=>e.r===f.region&&Math.abs(e.time-at)<.09);
        if(f.type==='owner'){if(f.owner!==lastOwner){const name=polityName(h,f.owner,at);note('ruleChange',at,'归属更替',`${place.name}改归${name}${ev?'（'+ev.text+'）':''}。`,{before:lastOwner,after:f.owner,polity:name,world:worldRef(ev)||{text:place.name+'归属'+name,year:Math.floor(at),month:G.HistoryDate.month(at),kind:'owner'}});lastOwner=f.owner;}continue;}
        if(f.type==='faith'){if(f.faith!==lastRegionFaith){lastRegionFaith=f.faith;const rel=religionName(h,f.faith);if(f.faith!==currentReligion&&f.faith>=0&&!['missionary','pilgrim'].includes(role)&&chance(.4)){convert(f.faith,at,`${place.name}一带改奉${rel}，${TA}也随众改宗。`,worldRef(ev)||{text:place.name+'一带改奉'+rel,year:Math.floor(at),month:G.HistoryDate.month(at),kind:'faith'});}else if(chance(.5))note('faith',at,'当地改宗',`${place.name}一带渐渐改奉${rel}，${f.faith===currentReligion?TA+'的信仰成了当地的主流':TA+'仍守着自己的'+religionName(h,currentReligion)}。`,{world:worldRef(ev)||{text:place.name+'一带改奉'+rel,year:Math.floor(at),month:G.HistoryDate.month(at),kind:'faith'}});}continue;}
        if(f.type==='ruin'){if(place.kind==='city'&&place.id===f.city){const name=place.name;relocate(Q().location(h,{kind:'rural',id:place.region},at),'displacement','城毁出逃',`${name}毁弃${ev?'（'+ev.text+'）':''}，${TA}从废墟中逃出，流落乡间。`,{at,world:worldRef(ev)||{text:name+'毁弃',year:Math.floor(at),month:G.HistoryDate.month(at),kind:'ruin'}});}continue;}
        if(service)continue;
        const e=f.e;
        if(f.type==='civilian'){wealth=Math.max(0,wealth-e.severity*20);note('war',at,'战火波及',`战火烧到${place.name}，${TA}家中财物损失惨重。`,{worldEvent:e.id,world:{text:'战火波及'+place.name,year:Math.floor(at),month:G.HistoryDate.month(at),kind:'war'}});continue;}
        seenWorld.add(e.id);
        if(e.kind==='war'){
          const campaign=Q().campaign(h,e.campaignId);if(campaign?.timeline?.[0]?.phase==='aborted')continue;
          const wtext={text:`${polityName(h,campaign?.attacker,at)}与${campaign?.defender>=0?polityName(h,campaign.defender,at):'当地部族'}之战`,year:Math.floor(at),month:G.HistoryDate.month(at),kind:'campaign'};
          if(['general','mercenary'].includes(role)||(role==='rebel'&&rebelName))continue;
          const groups=[...(campaign?.forces?.attacker?.groups||[]),...(campaign?.forces?.defender?.groups||[])],matching=groups.filter(g=>g.source===region&&g.species===group.species&&g.culture===currentCulture&&g.religion===currentReligion);
          const unit=matching.length?{mobilized:matching.reduce((n,g)=>n+g.mobilized,0),deaths:matching.reduce((n,g)=>n+Object.values(g.deaths||{}).reduce((a,b)=>a+b,0),0)}:null;
          const loc=Q().population(h,[region],at),base=loc.groups.filter(g=>g.species===group.species&&g.culture===currentCulture&&g.religion===currentReligion).reduce((n,g)=>n+g.population,0),age=ageAt(at);
          const exposure=(e.exposure||[]).find(x=>x.region===region),called=unit&&rank<2&&Number.isFinite(campaign.resultTime)&&Number.isFinite(campaign.endTime)&&age>=biology.maturity&&age<biology.oldAge&&rnd()<Math.min(.4,unit.mobilized/Math.max(1,base));
          if(called){note('service',at,'被征入伍',`${wtext.text}爆发，${place.name}征发壮丁，${TA}被编入军中。`,{worldEvent:e.id,campaignId:e.campaignId,world:wtext});const dead=rnd()<unit.deaths/Math.max(1,unit.mobilized)*.6;service={campaignId:e.campaignId};const ot={type:'outcome',at:dead?campaign.resultTime:campaign.endTime,campaignId:e.campaignId,world:wtext,dead};if(ot.at<stop)queue.push(ot);else pendingOutcomes.push(ot);}
          else if(exposure?.combat){const contact=campaign?.timeline?.find(n=>['siege','encounter','battle'].includes(n.phase));const ct={type:'civilian',at:contact?contact.at:at,e,region};if(ct.at<stop)queue.push(ct);}
          else if(e.severity>.2&&chance(.3))note('war',at,'战事消息',`${wtext.text}，${place.name}征粮征夫，人心惶惶。`,{worldEvent:e.id,world:wtext});
        }else if(e.kind==='plague'){if(role==='physician'){fame+=1.5;note('deed',at,'抗疫',`${e.text||'当地疫病流行'}，${TA}就地设棚施药。`,{world:{text:e.text||'疫病',year:Math.floor(at),month:G.HistoryDate.month(at),kind:'plague'}});}else if(rnd()<.35){health-=18+rnd()*20;note('illness',at,'染疫',`${e.text||'当地疫病流行'}，${TA}也染上了疫病。`,{worldEvent:e.id,world:{text:e.text||'疫病',year:Math.floor(at),month:G.HistoryDate.month(at),kind:'plague'}});}}
        else if(e.kind==='disaster'){wealth=Math.max(0,wealth-12);note('hardship',at,'天灾',`${e.text||'当地遭灾'}，${TA}的生计受到重创。`,{worldEvent:e.id,world:{text:e.text||'天灾',year:Math.floor(at),month:G.HistoryDate.month(at),kind:'disaster'}});}
      }
    }

    // ---------- 一生 ----------
    const parentAge=biology.maturity+Math.min(15,(biology.oldAge-biology.maturity)*.25)+rnd()*Math.min(15,(biology.oldAge-biology.maturity)*.2);
    for(let i=0;i<2;i++)p.relations.push({id:p.id+':parent:'+i,role:'parent',name:nameOf(lib,rnd,i===0?personName.surname||undefined:undefined).full,ageAtBirth:+parentAge.toFixed(1),ageUnit:cal.ageUnit,inferred:true});
    const birth=add('birth',opts.birthTime,{title:'出生',text:`生于${place.name}的${CLASSES[familyClass]}。${custom?'':'姓名取自出生家庭文化。'}`,familyClass,resources:wealth0,parents:p.relations.map(x=>x.id)});
    birth.date={year:birthYear,day,hour:0,month:G.HistoryDate.month(birthYear+(day-1)/cal.daysPerYear),precision:'day'};birth.year=birthYear;clock=eventTime(p,birth);
    p.trajectory.push({eventId:birth.id,year:birthYear,day,to:placeRef(place),from:null});visit();
    const matureAt=opts.birthTime+biology.maturity/cal.earthYearsPerYear;
    for(let year=birthYear;year<=h.E&&!p.death;year++){
      local(year);if(p.death)break;court(year);if(p.death)break;
      if(service||clock>=year+1)continue;
      const age=ageAt(Math.max(clock,year)),prevAge=ageAt(year);
      if(age>=biology.maturity*.4&&education==='none'){
        education=rnd()<(familyClass==='learned'?.9:familyClass==='trade'?.65:familyClass==='craft'?.4:.2)||['official','scholar','envoy'].includes(pathId)&&rnd()<.6?'literate':'practical';
        note('education',Math.max(clock,year+rnd()*.5),'学习',education==='literate'?`在${place.name}读书识字，${['official','scholar','envoy'].includes(pathId)?'尤好经史':'兼习算学'}。`:`在${place.name}跟随家人学习谋生的本事。`,{education});
        note('aspiration',clock,'立志',`性情${temper.label}，少年时便立下志向——${PATH.label}：${PATH.goal}。`,{path:pathId,title:PATH.title,goal:PATH.goal,temperament:temper.label,archetype:pathId});
        p.story.status='pursuing';
      }
      if(nextAction===Infinity&&age>=biology.maturity){nextAction=Math.max(clock,matureAt);if(!occupation){occupation=PATH.occupation;}}
      // 成家与子女：在哪里遇见就娶哪里的人
      if(!married&&age>=biology.maturity+2&&age<biology.oldAge&&rnd()<(.07+(['merchant','official','artisan'].includes(role)?.03:0))*cal.earthYearsPerYear){
        const info=Q().district(h,place.region,Math.max(clock,year)),plib=info.culture!==-1?definition(h,cfg,info.culture):lib,partner={id:p.id+':partner',role:'partner',name:nameOf(plib,rnd).full,species:group.species,culture:info.culture,ageAtMeeting:+Math.max(biology.maturity,age+(rnd()-.5)*6).toFixed(1),year,inferred:true};
        p.relations.push(partner);married=true;
        const foreign=info.culture!==currentCulture&&info.culture!==-1;
        note('partnership',Math.max(clock,year+rnd()*.9),'成家',`在${place.name}与${foreign?'当地的'+(Q().culture(h,info.culture)?.name||'异乡')+'人':place.region===p.birth.place.region?'同乡':'流寓此地的同族人'}${partner.name}结为夫妻。`,{partner:partner.id,participants:[p.id,partner.id]});
      }
      if(married&&children<4&&age<biology.oldAge*.8&&rnd()<.05*cal.earthYearsPerYear){
        let cn=nameOf(definition(h,cfg,currentCulture)||lib,rnd,personName.surname||undefined).full;if(cn===p.name)cn=nameOf(definition(h,cfg,currentCulture)||lib,rnd,personName.surname||undefined).full;
        const child={id:p.id+':child:'+children++,role:'child',name:cn,birthYear:year,species:group.species,inferred:true};p.relations.push(child);
        note('child',Math.max(clock,year+rnd()*.9),'孩子出生',`孩子${child.name}在${place.name}出生。`,{child:child.id,participants:[p.id,child.id]});
      }
      // 主动行动
      const old=age>=biology.oldAge;
      if(!old&&nextAction<year+1&&!locked()&&health>20){
        clock=Math.max(clock,nextAction,year+rnd()*.15);
        const before=p.events.length;try{(ACT[role]||ACT.wanderer)();}catch(err){if(!/没有符合条件/.test(err.message))throw err;}
        if(p.death)break;
        const [a,b]=LP().BY[role]?.cadence||PATH.cadence;nextAction=clock+(a+rnd()*(b-a))/cal.earthYearsPerYear*(temper.id==='bold'?.85:temper.id==='careful'?1.15:1);
      }
      if(old&&!retired){
        retired=true;const home=p.birth.place.kind==='city'&&Q().exists(h.cities[p.birth.place.id],clock)?p.birth.place.id:null;
        const word={official:'告老',general:'解甲',envoy:'致仕',merchant:'收手',mercenary:'金盆洗手'}[role]||'归隐';
        note('retirement',Math.max(clock,year+rnd()*.5),word,`年事渐高，${TA}${word}${role==='official'||role==='general'?'，辞去'+rankName()+'之职':''}。`);
        if(home!=null&&!(place.kind==='city'&&place.id===home)&&chance(.55))travel([{id:home,w:1}],'落叶归根，回到出生的地方。',{title:'落叶归根',hazard:false});
        else if(place.kind==='city')note('retirement',clock,'定居',`决定在${place.name}度过余生。`);
      }
      if(old&&retired&&['wanderer','pilgrim','scholar','physician','bard','missionary'].includes(role)&&nextAction<year+1&&health>45&&chance(.4)){clock=Math.max(clock,nextAction,year);try{(ACT[role])();}catch(_){}nextAction=clock+3/cal.earthYearsPerYear;if(p.death)break;}
      // 身份在长期接触中改变
      if(age>=biology.maturity&&rnd()<.05*cal.earthYearsPerYear){const info=Q().district(h,place.region,Math.max(clock,year));if(info.culture!==currentCulture&&info.culture!==-1&&Math.max(clock,year)-lastStay>4/cal.earthYearsPerYear){const old2=currentCulture;currentCulture=info.culture;add('culture',Math.max(clock,year+.5),{title:'入乡随俗',text:`在${place.name}久居，渐渐习惯了${Q().culture(h,currentCulture)?.name||'当地'}的语言与风俗。`,fromCulture:old2,toCulture:currentCulture,cultureName:Q().culture(h,currentCulture)?.name||'地方文化'});}}
      if(health<80&&rnd()<.25)health=Math.min(100,health+8+rnd()*8);
      // 死亡
      const infantFraction=Math.max(0,Math.min(age,2)-Math.min(prevAge,2))/cal.earthYearsPerYear;
      let rate=biology.adultMortality*(1-infantFraction)+biology.infantMortality*infantFraction;
      if(age>=biology.oldAge)rate+=biology.oldAgeMortality*(1+3*(age-biology.oldAge)/Math.max(1,biology.maximum-biology.oldAge));
      const ef=G.HumanRules.combine(species,definition(h,cfg,currentCulture),currentReligion>=0?h.religions[currentReligion]:null);
      rate*=G.HumanRules.multiplier(ef.deathRate)*(.8+(100-health)/65)*(1.15-wealth/400);
      if(age>=biology.maximum||year>p.selection.survivalThroughYear&&rnd()<1-Math.exp(-rate*cal.earthYearsPerYear)){die(Math.max(clock,year+rnd()*.9),`在${place.name}${age>=biology.oldAge?'寿终':'病逝'}`,'natural');break;}
      remember();
    }
    if(!p.death)conclude(Math.max(clock,Math.min(end(),h.E+.99)),ageAt(h.E)<biology.maturity?'历史在其尚未成年时结束':'世界历史在此截止');
    remember();
    p.story.works=works.slice();p.story.branches=branches.slice();
    p.footprint={cities:[...p._footprint.cities].filter(x=>x>=0),regions:[...p._footprint.cities].filter(x=>x<0).map(x=>-1-x),polities:[...p._footprint.polities],cultures:[...p._footprint.cultures],faiths:[...p._footprint.faiths],km:Math.round(p._footprint.km),served:[...served.entries()].map(([id,v])=>({id,name:v.name,from:v.from}))};
    delete p._footprint;
    p.state={health:Math.round(health),resources:Math.round(wealth),fame:Math.round(fame),rank,role,education,occupation,culture:currentCulture,religion:currentReligion,religionName:religionName(h,currentReligion),cultureName:Q().culture(h,currentCulture)?.name||'地方文化',place:placeRef(place)};
    p.events.sort((a,b)=>eventTime(p,a)-eventTime(p,b)||Number(a.id.split(':').at(-1))-Number(b.id.split(':').at(-1)));
    p.trajectory.sort((a,b)=>a.year-b.year||a.day-b.day);
    return p;
  }
  // 行程折线抽稀：保留起止、分段端点与均匀采样点，时间轴不变
  function slim(j,max=140){
    const n=j.pointDays.length;if(n<=max)return j;
    const keep=new Set([0,n-1]);for(const s of j.segments){keep.add(s.start);keep.add(s.end);}const step=Math.ceil(n/max);for(let i=0;i<n;i+=step)keep.add(i);
    const idx=[...keep].sort((a,b)=>a-b),map=new Map(idx.map((v,k)=>[v,k]));
    return{...j,pts:idx.flatMap(i=>[j.pts[2*i],j.pts[2*i+1]]),pointDays:idx.map(i=>j.pointDays[i]),segments:j.segments.map(s=>({...s,start:map.get(s.start),end:map.get(s.end)}))};
  }
  function placeRef(p){return{kind:p.kind,id:p.id,region:p.region??p.regions[0],name:p.name,x:p.x,y:p.y,owner:p.owner??-1};}
  function eventsAt(p,time,full=false){
    if(full)return p.events.slice();
    const end=(G.HistoryDate.index(time)+1)/12;
    return p.events.filter(e=>eventTime(p,e)<end-1e-9);
  }
  // ---------- 读取：某一时刻的人物状态 ----------
  function summary(p,time,full=false){
    if(p.version!==VERSION)return G.LifeStory.summary(p,time,full);
    const events=eventsAt(p,time,full),path=LP().BY[p.story.path],asp=events.find(e=>e.kind==='aspiration');
    const view={path:p.story.path,pathLabel:path?.label,icon:path?.icon,title:path?.title||'尚未立志',goal:asp?path.goal:null,temperament:asp?p.story.temperament:null,status:asp?'pursuing':'growing',fame:0,wealth:p.initialWealth,health:95,rank:-1,rankTitle:null,serving:null,religionName:p.birth.religionName,cultureName:p.birth.cultureName,journeys:[],achievements:[],costs:[],works:[],epithet:null,cities:new Set(),polities:new Set(),km:0,role:p.story.path};
    for(const e of events){const r=e.result;if(r.s){[view.fame,view.wealth,view.health,view.rank]=r.s;}if(r.rankTitle)view.rankTitle=r.rankTitle;if(r.serving)view.serving=r.serving;if(e.kind==='religion')view.religionName=r.religionName;if(e.kind==='culture')view.cultureName=r.cultureName;if(e.kind==='aspiration'&&r.path)view.role=r.path;
      if(e.kind==='migration'){view.journeys.push(e);view.km+=r.distanceKm||0;if(e.place.kind==='city')view.cities.add(e.place.id);if(r.owner>=0)view.polities.add(r.owner);}
      if(['office','battle','mission','deed','trade','revolt','sight'].includes(e.kind)||e.kind==='faith'&&r.converts)view.achievements.push(e);if(['trial','injury','captivity','illness','hardship'].includes(e.kind))view.costs.push(e);
      if(e.kind==='legacy'){view.status='fulfilled';view.works=r.works||[];}if(e.kind==='unfinished')view.status='unfinished';}
    if(p.birth.place.kind==='city')view.cities.add(p.birth.place.id);
    view.epithet=LP().epithetOf(p.story.path,view.fame);view.ageOf=null;
    return view;
  }
  // ---------- 校验 ----------
  function checkJourney(p,t,fail){
    const j=t.journey,integer=n=>Number.isInteger(n)&&n>=0,date=d=>d&&integer(d.year)&&integer(d.day)&&d.day>=1&&d.day<=Math.ceil(p.calendar.daysPerYear)&&Number.isFinite(d.hour)&&d.hour>=0&&d.hour<p.calendar.hoursPerDay;
    if(!Array.isArray(j.pts)||j.pts.length<4||j.pts.length%2||j.pts.some(v=>!Number.isFinite(v))||!Array.isArray(j.pointDays)||j.pointDays.length*2!==j.pts.length||!Number.isFinite(j.days)||j.days<=0||!Number.isFinite(j.km)||j.km<=0||!(j.width>0)||!date(j.departure)||!date(j.arrival)||Math.abs(j.departure.year+(j.departure.day-1+j.departure.hour/p.calendar.hoursPerDay)/p.calendar.daysPerYear-j.year)>1e-6||j.arrival.year!==t.year||j.arrival.day!==t.day||j.calendar?.daysPerYear!==p.calendar.daysPerYear||j.calendar.hoursPerDay!==p.calendar.hoursPerDay||!['road','offroad','mixed'].includes(j.routeKind)||!Number.isFinite(j.travelSpeed)||j.travelSpeed<.25||j.travelSpeed>2||!Array.isArray(j.segments))fail('行程');
    for(const s of j.segments)if(!s||!integer(s.start)||!integer(s.end)||s.end<s.start||s.end>=j.pointDays.length||!['trunk','regional','local','path','offroad','sea','rail'].includes(s.cls)||!Number.isFinite(s.startDay)||!Number.isFinite(s.endDay)||s.startDay<0||s.endDay<s.startDay||s.endDay>j.days+1e-6)fail('行程分段');
    let prev=-Infinity;for(const d of j.pointDays){if(!Number.isFinite(d)||d<prev||d<0||d>j.days+1e-6)fail('行程时间');prev=d;}if(j.pointDays[0]!==0||Math.abs(j.pointDays.at(-1)-j.days)>1e-6)fail('行程时间');
    const end=G.Navigation.dateAfter(j.departure,j.days,p.calendar);if(end.year!==j.arrival.year||end.day!==j.arrival.day||Math.abs(end.hour-j.arrival.hour)>1e-5)fail('到达时间');
  }
  const KINDS3=new Set(['birth','education','occupation','ruleChange','service','war','return','illness','hardship','foodPressure','partnership','child','retirement','recovery','migration','displacement','culture','religion','death','aspiration','trial','achievement','legacy','unfinished','office','battle','mission','deed','trade','revolt','sight','court','faith','injury','captivity']);
  function validateRecord(p,expectedWorldKey){
    if(p&&p.version===LEGACY_VERSION)return validateLegacy(p,expectedWorldKey);
    const fail=(what='')=>{throw Error('人物记录不完整或时间顺序无效。'+(what?'（'+what+'）':''));},string=s=>typeof s==='string'&&s.length<=10000,integer=n=>Number.isInteger(n)&&n>=0;
    if(!p||p.version!==VERSION||!string(p.id)||!p.id||!string(p.name)||!p.name||!string(p.seed)||typeof p.worldKey!=='string'||!p.worldKey||expectedWorldKey!==undefined&&p.worldKey!==expectedWorldKey||!string(p.speciesName)||!p.calendar||!(p.calendar.daysPerYear>0)||!(p.calendar.earthYearsPerYear>0)||!p.birth||!integer(p.birth.year)||!integer(p.birth.day)||!integer(p.endYear)||p.birth.year>p.endYear||!p.provenance||!p.biology||!CLASSES[p.familyClass]||!Array.isArray(p.events)||!p.events.length||p.events.length>100000||!Array.isArray(p.relations)||!Array.isArray(p.trajectory))fail('基本信息');
    const place=x=>x&&['city','rural','province'].includes(x.kind)&&integer(x.id)&&Number.isFinite(x.x)&&Number.isFinite(x.y)&&integer(x.region)&&string(x.name);
    if(!place(p.birth.place)||!string(p.birth.cultureName)||!string(p.birth.religionName))fail('出生地');
    if(!p.story||!LP().BY[p.story.path]||!['growing','pursuing','fulfilled','unfinished'].includes(p.story.status)||!Array.isArray(p.story.journeys))fail('人生方向');
    let last=-Infinity;const ids=new Set();
    for(const e of p.events){
      if(!e||!string(e.id)||ids.has(e.id)||!e.date||!['day','month'].includes(e.date.precision)||!integer(e.year)||e.date.year!==e.year||!integer(e.date.month)||e.date.month<1||e.date.month>12||!integer(e.date.day)||e.date.day<1||e.date.day>Math.ceil(p.calendar.daysPerYear)||!Number.isFinite(e.date.hour)||e.date.hour<0||e.date.hour>=p.calendar.hoursPerDay||!place(e.place)||!KINDS3.has(e.kind)||!e.result||!Array.isArray(e.participants))fail('事件 '+e?.kind);
      if(e.result.text!=null&&!string(e.result.text))fail('事件文字');
      ids.add(e.id);const time=eventTime(p,e);if(time+1e-7<last||e.year<p.birth.year||e.year>p.endYear+1||(p.death&&time>eventTime(p,{date:p.death})+1e-7))fail('事件顺序');last=time;
      if(e.kind==='migration'&&!place(e.result.from))fail('迁移来源');
    }
    if(p.events[0].kind!=='birth'||p.events[0].year!==p.birth.year||p.events[0].date.day!==p.birth.day)fail('出生事件');
    if(p.death&&(!integer(p.death.year)||!integer(p.death.day)||p.events.at(-1).kind!=='death'||p.aliveAtEnd!==false)||!p.death&&p.aliveAtEnd!==true)fail('生死');
    for(const id of p.story.journeys)if(!ids.has(id))fail('旅程引用');
    for(const r of p.relations)if(!r||!string(r.id)||!string(r.name)||!['parent','partner','child','friend','mentor'].includes(r.role)||(r.birthYear!=null&&!integer(r.birthYear)))fail('亲属');
    for(const t of p.trajectory){
      if(!t||!integer(t.year)||!place(t.to)||!ids.has(t.eventId))fail('轨迹');
      if(!t.journey){if(p.events.find(e=>e.id===t.eventId)?.kind==='migration')fail('迁移缺少行程');continue;}
      checkJourney(p,t,fail);
    }
    return p;
  }
  function validateLegacy(p,expectedWorldKey){
    const fail=()=>{throw Error('人物记录不完整或时间顺序无效。');},string=s=>typeof s==='string'&&s.length<=10000,integer=n=>Number.isInteger(n)&&n>=0;
    if(!p||p.version!==LEGACY_VERSION||!string(p.id)||!p.id||!string(p.name)||!string(p.seed)||typeof p.worldKey!=='string'||!p.worldKey||expectedWorldKey!==undefined&&p.worldKey!==expectedWorldKey||!string(p.speciesName)||!p.calendar||!(p.calendar.daysPerYear>0)||!p.birth||!integer(p.birth.year)||!Array.isArray(p.events)||!p.events.length||!Array.isArray(p.relations)||!Array.isArray(p.trajectory)||!p.story)fail();
    let last=-Infinity;for(const e of p.events){if(!e||!e.date||!e.place||!e.result)fail();const t=eventTime(p,e);if(t+1e-9<last)fail();last=t;}
    for(const t of p.trajectory)if(t.journey)checkJourney(p,t,fail);
    return p;
  }
  G.Life={VERSION,LEGACY_VERSION,CLASSES,OCCUPATIONS,calendar,choices,generate,eventTime,eventsAt,validateRecord,random,summary,rollName,customName};
})(typeof self!=='undefined'?self:globalThis);
