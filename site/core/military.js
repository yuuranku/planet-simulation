/* Regional campaigns with dated marches, engagements and withdrawals.
 * Food is an annual flow, never a stockpile. Only additional campaign food,
 * transport losses and forgone civilian production are charged here.
 * Mobilized people remain in their joint population group until actual death.
 */
(function (G) {
  'use strict';
  const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
  const DEFAULTS = Object.freeze({ mobilizationRate:.04, campaignDays:120, training:.45, equipment:.5 });
  const totalLosses = d => d.combat+d.disease+d.starvation;
  // 兵种：t 训练、e 装备（未计科技阶段上限）；arm 步 / 骑；standing 常备（领饷在营）或应召（平时务农）
  const UNITS = Object.freeze({
    warband:{name:'部族战士',arm:'inf',t:.25,e:.15}, levy:{name:'农兵',arm:'inf',t:.12,e:.18}, conscript:{name:'征召兵',arm:'inf',t:.38,e:.4},
    fubing:{name:'府兵',arm:'inf',t:.52,e:.5}, guard:{name:'禁军',arm:'inf',t:.72,e:.72,standing:true}, retinue:{name:'亲兵',arm:'cav',t:.66,e:.7,standing:true},
    knight:{name:'封臣骑士',arm:'cav',t:.6,e:.78}, frontier:{name:'边军',arm:'inf',t:.62,e:.6,standing:true}, merc:{name:'募兵',arm:'inf',t:.55,e:.55},
    army:{name:'常备军',arm:'inf',t:.74,e:.8,standing:true}, militia:{name:'民兵',arm:'inf',t:.24,e:.34}, reserve:{name:'后备役',arm:'inf',t:.46,e:.62},
    horde:{name:'控弦之士',arm:'cav',t:.5,e:.34}, keshig:{name:'怯薛',arm:'cav',t:.76,e:.6,standing:true}, rota:{name:'番上府兵',arm:'inf',t:.55,e:.5,standing:true},
    watch:{name:'城防兵',arm:'inf',t:.3,e:.42}, fort:{name:'关堡戍卒',arm:'inf',t:.42,e:.46}
  });
  // 军制：standing 常备部分 [兵种, 占全国人口比例, 驻地 cap 都城 / edge 边地 / split 都城与边地各半]；reserve 战时应召 [兵种, 动员倍率]；watch 城防兵占城市人口比例
  const SYSTEMS = Object.freeze({
    warband:{name:'部族兵',short:'部族',color:[150,140,120],desc:'人人皆兵，战时随首领出征，事毕即散；没有常备部队',standing:[],reserve:[['warband',1.3]],watch:.004},
    levy:{name:'农兵制',short:'农兵',color:[176,150,96],desc:'只在战时集结农夫成军，人数众多而训练、装备都差；首领只有少量亲卫',standing:[['retinue',.0006,'cap']],reserve:[['levy',1.5]],watch:.006},
    conscript:{name:'征兵制',short:'征兵',color:[196,120,72],desc:'编户齐民，按丁征发服役；宿卫禁军常驻都城，其余平时在籍、战时应征',standing:[['guard',.0025,'cap']],reserve:[['conscript',1]],watch:.008},
    fubing:{name:'府兵制',short:'府兵',color:[188,84,64],desc:'兵农合一：府兵平时务农、农闲操练，轮番上京宿卫，战时应召出征；禁军常驻京师',standing:[['guard',.002,'cap'],['rota',.0015,'cap']],reserve:[['fubing',.8]],watch:.008},
    feudal:{name:'封建兵役',short:'封建',color:[140,96,150],desc:'封臣领主率骑士与农兵应召出征，服役期满即散；君主只有亲兵常备',standing:[['retinue',.0015,'cap']],reserve:[['knight',.12],['levy',.8]],watch:.007},
    merc:{name:'募兵制',short:'募兵',color:[66,112,170],desc:'招募职业兵领饷常驻：禁军守京师、边军戍守要地，随战事调防；乡兵为辅',standing:[['guard',.005,'cap'],['frontier',.005,'edge']],reserve:[['merc',.25],['militia',.25]],watch:.01},
    standing:{name:'常备军制',short:'常备',color:[40,86,140],desc:'火器与操典；国家常备军常年在营，分驻京师与边地，随时调拨',standing:[['army',.012,'split']],reserve:[['militia',.35]],watch:.012},
    nation:{name:'国民征兵制',short:'国民',color:[30,60,96],desc:'常备军为骨干，国民服役后转入后备役，战时大规模动员',standing:[['army',.01,'split']],reserve:[['reserve',1.5]],watch:.012},
    horde:{name:'部落骑兵',short:'骑兵',color:[118,150,80],desc:'游牧部众全民皆兵，随时上马成军；怯薛护卫可汗',standing:[['keshig',.002,'cap']],reserve:[['horde',2]],watch:.003}
  });
  const SYSTEM_ORDER = ['warband','levy','horde','conscript','feudal','fubing','merc','standing','nation'];
  // 一国在某时的军制：由都城接纳的军事思潮与政体决定。ideas(id) 判断是否已接纳。
  function systemFor({ideas,stage,pastoral,style}) {
    if (pastoral && !ideas('mercenary') && !ideas('gunpowder')) return stage>=3?'horde':'warband';
    if (stage<3) return 'warband';
    if (ideas('nation')) return 'nation';
    if (ideas('gunpowder')) return 'standing';
    if (style==='feudal' && ideas('feudal')) return 'feudal';   // 封建文化：即使有了募兵，主力仍是封臣骑士与农兵
    if (ideas('mercenary')) return 'merc';
    if (ideas('fubing')) return 'fubing';
    if (ideas('feudal')) return 'feudal';
    if (ideas('conscript')) return 'conscript';
    return 'levy';
  }
  const cityGarrison = (pop,sys,capital) => Math.max(0,Math.round((pop||0)*(SYSTEMS[sys]||SYSTEMS.levy).watch*(capital?1.6:1)));
  function calendar(at,yearDays) {
    const year=Math.floor(at+1e-9), fraction=Math.max(0,at-year), month=Math.min(12,Math.floor(fraction*12+1e-8)+1);
    return {year,month,day:Math.max(1,Math.floor((fraction-(month-1)/12)*yearDays+1e-7)+1)};
  }
  // Querying a campaign only reads its already simulated record. In particular,
  // neither map playback nor a detail panel can run a second battle calculation.
  function atTime(c,time,{includeEnded=false}={}) {
    if(!Number.isFinite(time)||!c.timeline?.length||time<c.startTime-1e-8)return null;
    if(!includeEnded&&Math.floor(time*12+1e-7)>Math.floor(c.endTime*12+1e-7))return null;
    const nodes=c.timeline;let i=0;while(i+1<nodes.length&&nodes[i+1].at<=time+1e-8)i++;
    const node=nodes[i],next=nodes[i+1],fraction=next?clamp((time-node.at)/Math.max(1e-9,next.at-node.at),0,1):0;
    const state=side=>{const a=node[side],b=next?.[side];return {...a,deaths:{...a.deaths},supply:{...a.supply},progress:b?a.progress+(b.progress-a.progress)*fraction:a.progress};};
    return {time,phase:node.phase,attacker:state('attacker'),defender:state('defender'),events:c.events.filter(e=>e.at<=time+1e-8),finished:time>=c.resultTime-1e-8,started:true};
  }
  function validateRules(input = {}) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('军事规则必须是对象');
    for (const key of Object.keys(input)) if (!(key in DEFAULTS)) throw Error('未知军事规则：' + key);
    const rules = {...DEFAULTS,...input};
    for (const [key,lo,hi,label] of [['mobilizationRate',.005,.15,'动员比例'],['campaignDays',15,300,'战役天数'],['training',0,1,'训练投入'],['equipment',0,1,'装备投入']])
      if (!Number.isFinite(rules[key]) || rules[key]<lo || rules[key]>hi) throw Error(`军事${label}必须在 ${lo}–${hi} 之间`);
    return rules;
  }
  function create({ R, terrain, fullTerrain, human, species, effectsAt, cultureAt, rules:input, yearDays=365, random, onDeaths=()=>{} }) {
    const rules = validateRules(input);
    if (!(Number.isFinite(yearDays) && yearDays>0)) throw Error('军事推演缺少有效世界年长');
    const campaigns=[], effects=[], effectByCampaign=new Map(), used=new Map(), garrisons=new Map(), routes=new Map();
    const overland=fullTerrain?G.NavigationOverland.create(fullTerrain):null;
    const summary={campaigns:0,mobilized:0,deaths:0,combat:0,disease:0,starvation:0,extraFood:0,lostProduction:0,garrisonFood:0};
    let tick = null;
    // Regional cells choose the corridor; the unchanged physical grid decides
    // whether its coast and lake crossings are actually walkable. Only rejected
    // corridors need a finer search, limited to the same two adjacent regions.
    function refineRoute(route) {
      if(!overland)return route;
      const point=p=>({x:p[0],y:p[1]}),clear=(a,b)=>overland.dryLine(point(a),point(b))&&(a===b||overland.dryLine(point(b),point(a)));
      if(route.points.every((p,k)=>clear(p,k?route.points[k-1]:p)))return route;
      const {W,H}=fullTerrain.P,halfW=terrain.W,[a,b]=route.regions;
      const wrap=x=>(x+W)%W,cell=(x,y)=>y*W+wrap(x),center=i=>[i%W+.5,Math.floor(i/W)+.5];
      const half=i=>Math.floor(i/W/2)*halfW+Math.floor(i%W/2);
      const inside=i=>i>=0&&i<W*H&&(R.regionOf[half(i)]===a||R.regionOf[half(i)]===b);
      const distance=(p,q)=>{const dx=Math.abs(p[0]-q[0]);return Math.hypot(Math.min(dx,W-dx),p[1]-q[1]);};
      function anchors(p) {
        const dry=clear(p,p),x=Math.floor(p[0]/2)*2,y=Math.floor(p[1]/2)*2,result=[];
        for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){
          const i=cell(x+dx,y+dy),q=center(i);
          if(inside(i)&&clear(q,q)&&(!dry||clear(p,q)))result.push({i,point:dry?p:q,cost:dry?distance(p,q):0});
        }
        return result;
      }
      const starts=anchors(route.points[0]),ends=anchors(route.points.at(-1));
      if(!starts.length||!ends.length)return null;
      const targets=new Map(ends.map(e=>[e.i,e])),dist=new Map(),prev=new Map(),origins=new Map(),heap=new R.Heap(128);
      for(const s of starts){dist.set(s.i,s.cost);origins.set(s.i,s.point);heap.push(s.i,s.cost);}
      let target=-1;
      while(heap.n){
        const i=heap.pop(),cost=heap.top;if(cost!==dist.get(i))continue;
        if(targets.has(i)){target=i;break;}
        const x=i%W,y=Math.floor(i/W),p=center(i),hi=half(i);
        for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
          if(!dx&&!dy||y+dy<0||y+dy>=H)continue;
          const j=cell(x+dx,y+dy);if(!inside(j)||dx&&dy&&(!inside(cell(x+dx,y))||!inside(cell(x,y+dy))))continue;
          const hj=half(j),friction=1+2*(terrain.eN[hi]+terrain.eN[hj])+8*(terrain.slopeN[hi]+terrain.slopeN[hj]);
          const candidate=cost+(dx&&dy?Math.SQRT2:1)*friction;
          if(candidate>=(dist.get(j)??Infinity)||!clear(p,center(j)))continue;
          dist.set(j,candidate);prev.set(j,i);origins.set(j,origins.get(i));heap.push(j,candidate);
        }
      }
      if(target<0)return null;
      const cells=[];for(let i=target;i!==undefined;i=prev.get(i))cells.push(i);cells.reverse();
      const points=[origins.get(target)];
      for(const i of cells){const p=center(i);if(distance(points.at(-1),p)>1e-9)points.push(p);}
      const end=targets.get(target).point;if(distance(points.at(-1),end)>1e-9)points.push(end);
      let km=0;for(let k=1;k<points.length;k++)km+=distance(points[k-1],points[k])*terrain.cellKm/2;
      return {...route,points,km:Math.max(.001,km)};
    }
    function routeFor(edge,source) {
      const key=Math.min(edge.a,edge.b)+','+Math.max(edge.a,edge.b);
      let route=routes.get(key);
      if(!routes.has(key)) {
        const a=Math.min(edge.a,edge.b),b=Math.max(edge.a,edge.b),points=[];
        let km=edge.km;
        if(terrain) {
          const start=R.center[a],target=R.center[b],dist=new Map([[start,0]]),prev=new Map(),heap=new R.Heap(128),W=terrain.W;
          const inside=i=>i>=0&&(R.regionOf[i]===a||R.regionOf[i]===b);
          heap.push(start,0);
          while(heap.n) {
            const i=heap.pop(),cost=heap.top;if(cost!==dist.get(i))continue;if(i===target)break;
            for(let d=0;d<8;d++) {
              const j=terrain.NB[i*8+d];if(!inside(j))continue;
              if(d===0||d===2||d===5||d===7){const vertical=d<3?1:6,horizontal=d===0||d===5?3:4;if(!inside(terrain.NB[i*8+vertical])||!inside(terrain.NB[i*8+horizontal]))continue;}
              const diagonal=d===0||d===2||d===5||d===7;
              const friction=1+2*(terrain.eN[i]+terrain.eN[j])+8*(terrain.slopeN[i]+terrain.slopeN[j]);
              const candidate=cost+(diagonal?Math.SQRT2:1)*friction;
              if(candidate<(dist.get(j)??Infinity)){dist.set(j,candidate);prev.set(j,i);heap.push(j,candidate);}
            }
          }
          // A regional edge can touch a detached fragment or only a corner.
          // Without a walkable centre-to-centre corridor this campaign cannot
          // deploy; cache the same unreachable result as physical refinement.
          if(!dist.has(target)){routes.set(key,null);return null;}
          const cells=[];for(let i=target;;i=prev.get(i)){cells.push(i);if(i===start)break;}cells.reverse();
          km=0;
          for(let k=0;k<cells.length;k++){const i=cells[k],y=Math.floor(i/W);points.push([(i-y*W+.5)*2,(y+.5)*2]);if(k)km+=terrain.gdist(cells[k-1],i)*terrain.cellKm;}
        } else if(R.cx&&R.cy)points.push([R.cx[a],R.cy[a]],[R.cx[b],R.cy[b]]);
        route=refineRoute({regions:[a,b],points,km:Math.max(.001,km),kind:'land-corridor'});routes.set(key,route);
      }
      if(!route)return null;
      return source===route.regions[0]?route:{...route,regions:[...route.regions].reverse(),points:[...route.points].reverse()};
    }
    const key = (r,g) => `${r},${g.species},${g.culture},${g.religion}`;
    const remaining = r => Math.max(0,tick.food.foodAvailable[r]-tick.food.foodDemand[r]);
    const kmBetween = (a,b) => terrain&&R.center?terrain.gdist(R.center[a],R.center[b])*terrain.cellKm:0;
    const pressure = new Float64Array(R.nR+1), armies = new Map();
    function spend(r, extraFood, lostProduction) {
      if (extraFood<0 || lostProduction<0 || extraFood+lostProduction>remaining(r)+1e-7) throw Error('军事供给超出当期剩余预算');
      tick.food.foodAvailable[r]-=extraFood+lostProduction;
      tick.food.foodProduction[r]-=lostProduction;
      tick.food.militaryExtra[r]+=extraFood; tick.food.militaryLaborLoss[r]+=lostProduction;
      if(tick.account){summary.extraFood+=extraFood; summary.lostProduction+=lostProduction;}
    }
    // 兵种素质：受科技阶段上限约束；世界设定的训练 / 装备投入整体放大或压低
    const tf=rules.training/DEFAULTS.training, ef=rules.equipment/DEFAULTS.equipment;
    function quality(unit,stage) {
      const u=UNITS[unit]||UNITS.levy, s=stage||1;
      return {t:Math.min(clamp(s/8+.25,.2,1),u.t*(.55+.45*tf)), e:Math.min(clamp(s/8+.12,.1,1),u.e*(.55+.45*ef))};
    }
    function group(r,g,n,role,unit='levy',stage=4) {
      const e=effectsAt(r,g), dry=R.Pr && R.Pr[r]<400, q=quality(unit,stage);
      return {source:r,species:g.species,culture:g.culture,religion:g.religion,mobilized:n,remaining:n,role,unit,t:q.t,e:q.e,
        deaths:{combat:0,disease:0,starvation:0}, foodNeed:species[g.species].foodNeed*G.HumanRules.multiplier((e.foodNeed||0)+(dry?e.dryFoodNeed||0:0)),
        attack:G.HumanRules.multiplier((e.combat||0)+(e.attack||0)), defense:G.HumanRules.multiplier((e.combat||0)+(e.defense||0)),
        diseaseRisk:G.HumanRules.multiplier(e.deathRate||0)};
    }
    const sysOf = p => tick?.sys?.get(p) || null;
    function beginTick({year,food,owner,forts=[],account=true}) {
      used.clear(); garrisons.clear();
      tick={year,food,owner,account,sys:new Map(),cities:new Map()}; food.militaryExtra=new Float64Array(R.nR+1); food.militaryLaborLoss=new Float64Array(R.nR+1);
      for (const fort of forts) {
        const entry=fort.log[fort.log.length-1], r=fort.region;
        if (!entry || !entry[1] || owner[r]<0) continue;
        if(garrisons.has(r))throw Error('军事驻军要求一区最多一堡');
        const pop=human.total(r), productionPerPerson=food.foodProduction[r]/Math.max(1,pop);
        const requested=Math.min(entry[1],Math.floor(pop*.05)), groups=[];
        let guards=0, extra=0, labor=0;
        for (const g of human.view(r)) {
          const wanted=Math.floor(requested*g.population/Math.max(1,pop)), unit=group(r,g,0,'garrison','fort');
          // Resident foodDemand already includes these people; guards add 25% exertion rations.
          const n=Math.min(wanted,Math.floor(remaining(r)/(.25*unit.foodNeed+productionPerPerson)));
          if (!n) continue;
          unit.mobilized=unit.remaining=n; groups.push(unit); used.set(key(r,g),n);
          const foodCost=n*.25*unit.foodNeed, workCost=n*productionPerPerson; spend(r,foodCost,workCost);
          guards+=n; extra+=foodCost; labor+=workCost;
        }
        const paid=[year,guards,extra,owner[r],Math.max(0,entry[4]),pop];
        if(entry[0]===year)fort.log[fort.log.length-1]=paid;else fort.log.push(paid);
        garrisons.set(r,{fort,groups,extraFood:extra,lostProduction:labor}); if(account)summary.garrisonFood+=extra;
      }
      for(let r=1;r<=R.nR;r++)pressure[r]*=.55;
    }
    // 常备兵：按军制从全国人口中募集、领饷在营（每轮结算口粮与误工），驻守都城与受威胁的边地；
    // 驻地随边境压力（近年进攻与被攻的地点）调拨，调防记入部署日志。
    function deploy(list) {
      const regions=new Map();
      for(let r=1;r<=R.nR;r++){const p=tick.owner[r];if(p<0)continue;let L=regions.get(p);if(!L)regions.set(p,L=[]);L.push(r);}
      for(const x of list){
        const sys=SYSTEMS[x.sys]||SYSTEMS.levy;tick.sys.set(x.p,{key:x.sys,stage:x.stage,horse:!!x.horse,siege:!!x.siege,cap:x.cap});
        const own=regions.get(x.p)||[];let army=armies.get(x.p);
        if(!army)armies.set(x.p,army={p:x.p,log:[],moves:[],units:[]});
        army.units=[];
        if(!own.length||!sys.standing.length){record(army,x,[]);continue;}
        let pop=0;for(const r of own)pop+=human.total(r);
        const sources=own.slice().sort((a,b)=>human.total(b)-human.total(a)||a-b).slice(0,4),srcPop=sources.reduce((s,r)=>s+human.total(r),0);
        // 边地驻点：与他国接壤的地区，按近年战事压力与关堡排序
        const edgeScore=[];
        for(const r of own){let border=false;for(let k=R.off[r];k<R.off[r+1];k++){const b=R.nbr[k];if(R.edges[R.eid[k]].sea)continue;const o=tick.owner[b];if(o>=0&&o!==x.p){border=true;break;}}
          if(border)edgeScore.push([r,1+pressure[r]+(garrisons.has(r)?50:0)+human.total(r)*1e-4]);}
        edgeScore.sort((a,b)=>b[1]-a[1]||a[0]-b[0]);
        const nEdge=Math.min(3,1+Math.floor(own.length/12)),edges=edgeScore.slice(0,nEdge),edgeSum=edges.reduce((s,e)=>s+e[1],0);
        const scale=Math.sqrt(rules.mobilizationRate/DEFAULTS.mobilizationRate);
        const stations=[];
        for(const [unitKey,frac,where] of sys.standing){
          const target=Math.floor(pop*frac*scale);if(target<1)continue;
          const unit={unit:unitKey,groups:[],n:0,stations:[]};
          for(const src of sources){
            const pp=human.total(src);if(!pp)continue;const productionPerPerson=tick.food.foodProduction[src]/Math.max(1,pp);
            for(const g of human.view(src)){
              const occupied=used.get(key(src,g))||0,wanted=Math.min(Math.floor(target*pp/srcPop*g.population/pp),Math.floor(g.population*.08)-occupied);
              if(wanted<1)continue;const u=group(src,g,0,'standing',unitKey,x.stage),each=.25*u.foodNeed+productionPerPerson;
              const n=Math.min(wanted,Math.floor(remaining(src)/Math.max(1e-4,each)));if(n<1)continue;
              u.mobilized=u.remaining=n;unit.groups.push(u);unit.n+=n;used.set(key(src,g),occupied+n);spend(src,n*.25*u.foodNeed,n*productionPerPerson);
            }
          }
          if(!unit.n)continue;
          const put=(r,n)=>{if(n>=1){const st={r,n:Math.floor(n),free:Math.floor(n),unit:unitKey};unit.stations.push(st);stations.push(st);}};
          if(where==='cap'||!edges.length)put(x.cap,unit.n);
          else{const home=where==='split'?unit.n*.4:0;put(x.cap,home);for(const [r,w] of edges)put(r,(unit.n-home)*w/edgeSum);}
          army.units.push(unit);
        }
        record(army,x,stations);
      }
    }
    function record(army,x,stations){
      const total=stations.reduce((s,t)=>s+t.n,0),rows=stations.map(t=>[t.r,t.n,t.unit]),last=army.log[army.log.length-1];
      // 调防：边地驻点换了地方，记下从哪里调到哪里
      if(last&&last[3].length){
        for(const [r,n,u] of rows){if(UNITS[u]?.standing&&!last[3].some(o=>o[0]===r&&o[2]===u)){
          const from=last[3].filter(o=>o[2]===u&&!rows.some(q=>q[0]===o[0]&&q[2]===u)).sort((a,b)=>kmBetween(a[0],r)-kmBetween(b[0],r))[0];
          if(from&&from[0]!==r)army.moves.push([tick.year,from[0],r,n,u]);}}
      }
      const same=last&&last[1]===x.sys&&last[3].length===rows.length&&rows.every((q,i)=>q[0]===last[3][i][0]&&q[2]===last[3][i][2]&&Math.abs(q[1]-last[3][i][1])<=Math.max(30,.12*last[3][i][1]));
      if(!same){const entry=[tick.year,x.sys,total,rows];if(last&&last[0]===tick.year)army.log[army.log.length-1]=entry;else army.log.push(entry);}
    }
    // 某国驻在 r 及其邻区的常备兵（可抽调出征 / 守御）
    function standingNear(p,r,share,{adjacent=true,capitalReach=0}={}) {
      const army=armies.get(p);if(!army||!tick.sys.has(p))return [];
      const near=new Set([r]);if(adjacent)for(let k=R.off[r];k<R.off[r+1];k++)if(!R.edges[R.eid[k]].sea)near.add(R.nbr[k]);
      const out=[];
      for(const unit of army.units)for(const st of unit.stations){
        const far=!near.has(st.r);if(far&&!(capitalReach>0&&st.r===tick.sys.get(p).cap&&kmBetween(st.r,r)/22<capitalReach))continue;
        const n=Math.floor(st.free*(far?share*.6:share));if(n<1)continue;st.free-=n;
        out.push({unit,station:st,n,far,km:far?kmBetween(st.r,r):0});
      }
      return out;
    }
    function joinStanding(force,joined,role='standing'){
      for(const j of joined){const ratio=j.n/Math.max(1,j.unit.n);
        for(const g of j.unit.groups){const n=Math.floor(g.mobilized*ratio);if(n<1)continue;
          const u={...g,mobilized:n,remaining:n,role,station:j.station.r,far:j.far,deaths:{combat:0,disease:0,starvation:0}};force.groups.push(u);force.mobilized+=n;force.requested+=n;force.standing+=n;}}
    }
    function recruit(r,side,x,edge) {
      const attacking=side==='attacker', stage=attacking?x.stage:x.defenderStage, cohesion=attacking?x.cohesion:x.defenderCohesion,p=x[side];
      const info=p>=0?sysOf(p):null, sysKey=info?.key||(stage>=3?'levy':'warband'), sys=SYSTEMS[sysKey];
      const days=Math.min(rules.campaignDays,yearDays), fraction=days/yearDays, reserveSum=sys.reserve.reduce((s,c)=>s+c[1],0);
      const force={groups:[],mobilized:0,eligible:0,requested:0,standing:0,sys:sysKey,horse:!!info?.horse,mission:attacking?x.objective:'defend-home',training:0,equipment:0,morale:clamp(.45+.35*(cohesion||0),.2,1),
        supply:{extraFood:0,lostProduction:0,garrisonExtraFood:0,garrisonLaborLoss:0,requested:0,ratio:0},traits:{attack:1,defense:1},travelDays:0,deaths:{combat:0,disease:0,starvation:0}};
      // Local mobilization and immediately connected friendly districts; no teleportation from the capital.
      const origins=[[r,null]];
      if (p>=0) for(let k=R.off[r];k<R.off[r+1];k++) {
        const s=R.nbr[k], link=R.edges[R.eid[k]];
        if(!link.sea && tick.owner[s]===p) origins.push([s,link]);
      }
      for(const [origin,march] of origins) {
        const productionPerPerson=tick.food.foodProduction[origin]/Math.max(1,human.total(origin));
        for(const g of human.view(origin)) {
          if(attacking && x.objective==='holy-war' && g.religion!==x.religion) continue;
          const occupied=used.get(key(origin,g))||0;
          const wanted=Math.max(0,Math.floor(g.population*rules.mobilizationRate*reserveSum*(attacking?1:1.25))-occupied);
          force.eligible+=wanted;
          const travel=(attacking?G.HumanAnchors.travelDays(edge,species[g.species],cultureAt(origin,g.culture)):0)+(march?G.HumanAnchors.travelDays(march,species[g.species],cultureAt(origin,g.culture)):0);
          if(!Number.isFinite(travel)||travel*2>=days) continue;
          // 一个人口组按军制的应召兵种比例拆成几支（农兵 / 骑士 / 府兵……）
          for(const [unitKey,mult] of sys.reserve){
            const share=Math.floor(wanted*mult/reserveSum);if(share<1)continue;
            const unit=group(origin,g,0,origin===r||!attacking?(origin===r&&!attacking?'local':'field'):'field',unitKey,stage);unit.march=travel;
            const extraEach=unit.foodNeed*fraction*(.25+travel/120), laborEach=productionPerPerson*fraction*(1+unit.t*.35+unit.e*.4);
            force.requested+=share; force.supply.requested+=share*(extraEach+laborEach);
            const n=Math.min(share,Math.floor(remaining(origin)/Math.max(.0001,extraEach+laborEach)));
            if(!n)continue;
            unit.mobilized=unit.remaining=n;force.groups.push(unit); used.set(key(origin,g),(used.get(key(origin,g))||0)+n);
            const extra=n*extraEach, labor=n*laborEach;spend(origin,extra,labor);
            force.supply.extraFood+=extra; force.supply.lostProduction+=labor; force.travelDays+=travel*n; force.mobilized+=n;
          }
        }
      }
      // 常备兵：驻在出发地 / 目标地及邻区的部队；守方还可从都城调主力来援
      if(p>=0){
        const joined=attacking?standingNear(p,r,.7):standingNear(p,r,.85,{capitalReach:days*.55});
        for(const j of joined){const travel=j.far?j.km/22:attacking?G.HumanAnchors.travelDays(edge,null,null):0;j.travel=travel;
          const extra=Math.min(remaining(j.station.r),j.n*.6*fraction*(.25+travel/120));if(extra>0)spend(j.station.r,extra,0);force.supply.extraFood+=extra;force.supply.requested+=extra;}
        const before=force.groups.length;joinStanding(force,joined);
        for(let i=before;i<force.groups.length;i++){const g=force.groups[i],j=joined.find(q=>q.station.r===g.station&&q.unit.unit===g.unit);g.march=j?.travel||0;force.travelDays+=g.march*g.mobilized;}
      }
      const guard=garrisons.get(r);
      if(!attacking && guard && guard.fort.site.edges.includes(typeof x.edge==='number'?x.edge:-1)) {
        force.supply.garrisonExtraFood=guard.extraFood;force.supply.garrisonLaborLoss=guard.lostProduction;
        for(const resident of guard.groups) if(resident.remaining>0) {
          const unit={...resident,mobilized:resident.remaining,remaining:resident.remaining,deaths:{combat:0,disease:0,starvation:0},_guard:resident};
          force.groups.push(unit);force.mobilized+=unit.mobilized;force.requested+=unit.mobilized;
        }
      }
      // 城防兵：有城墙的城市常驻守城兵（不出城野战，只守城）
      if(!attacking&&x.city&&x.city.walls){
        const want=cityGarrison(x.city.pop,sysKey,x.city.capital),pop=human.total(r),productionPerPerson=tick.food.foodProduction[r]/Math.max(1,pop);
        for(const g of human.view(r)){const occupied=used.get(key(r,g))||0,share=Math.min(Math.floor(want*g.population/Math.max(1,pop)),Math.floor(g.population*.06)-occupied);if(share<1)continue;
          const unit=group(r,g,0,'garrison','watch',stage),each=.25*unit.foodNeed+productionPerPerson*.5,n=Math.min(share,Math.floor(remaining(r)/Math.max(1e-4,each)));if(n<1)continue;
          unit.mobilized=unit.remaining=n;unit.march=0;force.groups.push(unit);force.mobilized+=n;force.requested+=n;used.set(key(r,g),occupied+n);spend(r,n*.25*unit.foodNeed,n*productionPerPerson*.5);force.supply.extraFood+=n*.25*unit.foodNeed;}
      }
      if(force.mobilized) {
        force.travelDays/=force.mobilized;
        for(const stat of ['attack','defense'])force.traits[stat]=force.groups.reduce((sum,g)=>sum+g.mobilized*g[stat],0)/force.mobilized;
        force.training=force.groups.reduce((s,g)=>s+g.mobilized*g.t,0)/force.mobilized;force.equipment=force.groups.reduce((s,g)=>s+g.mobilized*g.e,0)/force.mobilized;
      } else {const q=quality(sys.reserve[0]?.[0]||'levy',stage);force.training=q.t;force.equipment=q.e;}
      force.supply.ratio=force.requested?Math.min(1,force.mobilized/force.requested):0;
      force.morale*=.7+.3*force.supply.ratio;
      force.comp=compOf(force.groups);
      return force;
    }
    function compOf(groups){const m=new Map();for(const g of groups){const k=g.unit+'|'+(g.role==='standing'?'s':g.role==='garrison'||g.role==='local'?'g':'f');m.set(k,(m.get(k)||0)+g.mobilized);}return [...m].map(([k,n])=>{const [u,r]=k.split('|');return [u,n,r];}).sort((a,b)=>b[1]-a[1]);}
    function casualties(force,combatRate,shortage,pick=null,combatOther=0) {
      for(const g of force.groups) {
        const chosen=!pick||pick(g);
        const rates={combat:chosen?combatRate:combatOther,disease:.006*g.diseaseRisk*(Math.min(rules.campaignDays,yearDays)/yearDays),starvation:.02*shortage*(chosen?1:.3)};
        for(const cause of ['combat','disease','starvation']) {
          const requested=Math.min(g.remaining,Math.floor(g.mobilized*clamp(rates[cause],0,.95)));
          const actual=-human.adjust(g.source,g.species,g.culture,g.religion,-requested);
          g.deaths[cause]+=actual;force.deaths[cause]+=actual;g.remaining-=actual;
          if(g._guard)g._guard.remaining-=actual;
          summary[cause]+=actual;summary.deaths+=actual;onDeaths(actual,g,cause);
        }
        delete g._guard;
      }
    }
    const strengthOf=(groups,stat,morale)=>groups.reduce((s,g)=>s+g.remaining*(.55+.45*g.t)*(.55+.45*g.e)*g[stat],0)*morale;
    const cavShare=force=>{const cav=force.groups.reduce((s,g)=>s+(UNITS[g.unit]?.arm==='cav'?g.mobilized:0),0);return clamp(cav/Math.max(1,force.mobilized)+(force.horse?.18:0),0,1);};
    function tacticsFor(attacker,defender,edge,siege,attack,defense) {
      const tactics=[],rough=Math.max(0,edge.rough||0),river=clamp(edge.river||0,0,1);
      const modifiers={attack:1,defense:1,attackerCombat:0,defenderCombat:0,attackerShortage:0,defenderShortage:0};
      const add=(id,side,label,detail,effect)=>{tactics.push({id,side,label,detail,effect});for(const [k,v]of Object.entries(effect))if(k==='attack'||k==='defense')modifiers[k]*=v;else modifiers[k]+=v;};
      if(!siege&&defender.mobilized>0&&defender.training>=.3) {
        if(attacker.travelDays>=8&&defender.supply.ratio>=.5) {
          const cut=clamp(.08+attacker.travelDays/180+rough*.015,.1,.3);
          add('supply-raid','defender','袭扰粮道',`进攻军粮道需 ${attacker.travelDays.toFixed(1)} 日，守军以轻兵绕到敌后袭击运输队；有效军需减少 ${Math.round(cut*100)}%。`,{attack:1-cut*.55,attackerShortage:cut,attackerCombat:.012});
        } else if(rough>=1.2||river>=.25) {
          const advantage=clamp(.08+rough*.018+river*.08,.08,.24);
          add('ambush','defender','设伏截击',river>=.25?'守军伏于渡口两岸，趁进攻军半渡而击。':'守军伏兵于山道两侧，截击行军中的进攻军纵队。',{attack:1-advantage,attackerCombat:advantage*.2});
        } else if(defender.training>=.4&&defender.morale>=.6&&attack>defense*1.25) {
          add('feigned-retreat','defender','佯退诱敌','守军中军佯装败退，诱敌深入后两翼合击。',{attack:.9,attackerCombat:.018});
        }
      }
      if(siege) return {tactics,modifiers};
      if(attacker.training>=defender.training+.15&&attacker.travelDays<7&&defender.mobilized>0) {
        add('surprise','attacker','奇袭','进攻军轻装疾进，在守军集结完毕之前突袭营地。',{defense:.82,defenderCombat:.022});
      } else if(attacker.training>=defender.training+.08&&rough<2.5) {
        const cav=cavShare(attacker);
        add('flanking','attacker',cav>=.2?'骑兵迂回':'侧翼迂回',cav>=.2?'进攻军骑兵从两翼包抄，冲击守军侧后。':'进攻军以一翼兵力绕过守军侧翼，迫使守军分散阵线。',{attack:1.1+.08*cav,defenderCombat:.018});
      }
      return {tactics,modifiers};
    }
    function dateRecord(record,resultTime) {
      record.resultTime=resultTime;record.startTime=resultTime-record.preResultDays/yearDays;record.endTime=record.startTime+record.durationDays/yearDays;
      record.year=Math.floor(resultTime+1e-9);record.month=calendar(resultTime,yearDays).month;
      record.startYear=Math.floor(record.startTime+1e-9);record.endYear=Math.floor(record.endTime+1e-9);
      for(const node of record.timeline){node.at=record.startTime+node.dayOffset/yearDays;Object.assign(node,calendar(node.at,yearDays));}
      for(const event of record.events){event.at=record.startTime+event.dayOffset/yearDays;Object.assign(event,calendar(event.at,yearDays));}
    }
    const POSTURE={hold:'坚守不出',surrender:'开城投降',sally:'出城逆袭',open:'无兵可守'};
    function chronicle(record,engaged) {
      const A=record.forces?.attacker,D=record.forces?.defender;
      record.timeline=[];record.events=[];record.attacks=[];
      if(!A||!D){record.durationDays=0;record.preResultDays=0;dateRecord(record,record.year);return;}
      const plan=record.plan||{};
      if(!engaged){record.durationDays=0;record.preResultDays=0;}
      else{record.preResultDays=plan.result;record.durationDays=Math.min(Math.min(rules.campaignDays,yearDays),plan.result+plan.back);}
      const duration=record.durationDays;
      const event=(dayOffset,type,label,detail,side='both',extra={})=>{const e={dayOffset,type,label,detail,side,...extra};record.events.push(e);if(type==='attack')record.attacks.push(e);};
      const casualty=(force,fraction,combatFraction)=>({combat:Math.floor(force.deaths.combat*combatFraction),disease:Math.floor(force.deaths.disease*fraction),starvation:Math.floor(force.deaths.starvation*fraction)});
      const state=(force,progress,dayOffset,combatFraction,active=true)=>{const fraction=duration>0?clamp(dayOffset/duration,0,1):1,dead=casualty(force,fraction,combatFraction);return {mobilized:force.mobilized,remaining:force.mobilized-totalLosses(dead),progress,active:active&&force.mobilized>totalLosses(dead),morale:force.morale*(1-.3*combatFraction),deaths:dead,supply:{ratio:force.supply.ratio,extraFood:force.supply.extraFood*fraction,lostProduction:force.supply.lostProduction*fraction}};};
      const node=(dayOffset,phase,a,d,combatFraction=0,activeD=true)=>record.timeline.push({dayOffset,phase,attacker:state(A,a,dayOffset,combatFraction),defender:state(D,d,dayOffset,combatFraction,activeD)});
      if(!engaged){
        node(0,'aborted',0,1,1);
        for(const side of ['attacker','defender']){const force=record.forces[side],last=record.timeline[0][side];last.active=false;last.deaths={...force.deaths};last.remaining=force.mobilized-totalLosses(force.deaths);last.supply.extraFood=force.supply.extraFood;last.supply.lostProduction=force.supply.lostProduction;}
        event(0,'aborted','攻势取消',record.reason==='supply'?'军需不足，部队停止出发。':record.reason==='unreachable'?'无法在战役期限内抵达并返回。':'没有可供再次征召的兵员。');dateRecord(record,record.year);return;
      }
      const won=record.status==='won',S=record.siege;
      const sideOf=k=>{const f=record.forces[k];return f.standing?`其中常备 ${f.standing.toLocaleString('zh-CN')} 人`:'全部为战时应召';};
      node(0,'muster',0,1);event(0,'mobilization','集结出征',`进攻方动员 ${A.mobilized.toLocaleString('zh-CN')} 人（${sideOf('attacker')}），防守方动员 ${D.mobilized.toLocaleString('zh-CN')} 人（${sideOf('defender')}）。`);
      node(plan.muster,'march',0,1);event(plan.muster,'march','部队开拔',`沿陆地通道进军，部队加权行程 ${A.travelDays.toFixed(1)} 日。`,'attacker');
      if(S){
        node(plan.contact,'siege',1,1);
        const g=S.garrison;
        event(plan.contact,'siege','兵临城下',`${S.fort&&!S.walls?'进攻军抵达关堡':'进攻军包围城池'}。城中守军 ${g.total.toLocaleString('zh-CN')} 人${[g.watch?`城防兵 ${g.watch.toLocaleString('zh-CN')}`:'',g.standing?`驻防常备军 ${g.standing.toLocaleString('zh-CN')}`:'',g.fort?`关堡戍卒 ${g.fort.toLocaleString('zh-CN')}`:'',g.local?`入城乡勇 ${g.local.toLocaleString('zh-CN')}`:''].filter(Boolean).join('、').replace(/^(.)/,'（$1')}${g.watch||g.standing||g.fort||g.local?'）':''}。`);
        const postureText={hold:'守军闭门坚守，等待主力来援。',surrender:'守军见敌众我寡、援军无望，开城投降。',sally:'守军趁攻方立足未稳，出城逆袭。',open:'城中无兵可守，攻方不战而入。'}[S.posture];
        event(plan.contact+.5,'garrison',POSTURE[S.posture],postureText,'defender',{posture:S.posture});
        if(S.posture==='hold'||S.posture==='sally'){
          event(plan.contact+1,'tactic',S.method==='storm'?'架梯强攻':'围城断粮',S.method==='storm'?(record.siege.engines?'攻方以云梯、冲车与抛石机强攻城防。':'攻方兵力占优，架梯蚁附强攻。'):'攻方挖壕立营，断绝城中粮道，困守待降。','attacker',{tactic:{id:S.method,label:S.method==='storm'?'架梯强攻':'围城断粮'}});
          if(S.relief.n)event(plan.muster+1,'relief','援军出发',`守方${S.relief.main?`调都城主力 ${S.relief.main.toLocaleString('zh-CN')} 人，`:''}共 ${S.relief.n.toLocaleString('zh-CN')} 人赶来解围，预计 ${Math.round(S.relief.days)} 日后抵达。`,'defender');
        }
        if(S.outcome==='relieved'||S.outcome==='relief-routed'){
          node(plan.battle,'battle',1,1,.4);
          event(plan.battle,'attack','援军抵达 · 城下会战',`守方援军赶到城下，守军开门策应，与攻方会战。`,'both');
        } else if(S.outcome==='stormed'||S.outcome==='repulsed'){
          node(plan.battle,'battle',1,1,.5);
          event(plan.battle,'attack',S.outcome==='stormed'?'总攻城防':'强攻受挫',S.outcome==='stormed'?`围城 ${Math.round(plan.battle-plan.contact)} 日后发起总攻。`:`攻方连番强攻，在城下伤亡惨重。`,'both');
        }
        const RES={surrender:['守军投降','城门洞开，守军缴械，伤亡轻微。'],open:['不战而下','攻方入城接管。'],stormed:['城破','攻方攻入城中，守军溃散。'],starved:['粮尽城降',`被围 ${Math.round(plan.result-plan.contact)} 日，城中粮尽，守军出降。`],relieved:['援军解围','攻方在城下会战中失利，撤围而去。'],'relief-routed':['援军败北，城破','援军被击溃，孤城随即陷落。'],repulsed:['久攻不克','攻方伤亡过重，被迫撤围。'],lifted:['撤围','攻方粮秣与时限将尽，城池未下，解围而去。']}[S.outcome];
        node(plan.result,won?'occupation':'retreat',1,1,1,!won);
        event(plan.result,'result',RES[0],`${RES[1]}进攻方战死 ${A.deaths.combat.toLocaleString('zh-CN')} 人，守方战死 ${D.deaths.combat.toLocaleString('zh-CN')} 人。`,'both',{losses:{attacker:{...record.timeline.at(-1).attacker.deaths},defender:{...record.timeline.at(-1).defender.deaths}}});
        event(plan.result,won?'occupation':'retreat',won?'占领城池':'残部撤回',won?'胜方入城，接管目标地区。':'进攻军沿来路撤回。');
      } else {
        const ambush=record.tactics.some(t=>t.side==='defender');
        node(plan.contact,'encounter',.72,.88,ambush?.18:0);
        event(plan.contact,'encounter','两军接敌','两军沿进军通道接触，侦察与试探交锋开始。');
        for(const tactic of record.tactics)event(plan.contact,'tactic',tactic.label,tactic.detail,tactic.side,{tactic:{id:tactic.id,label:tactic.label,detail:tactic.detail}});
        if(ambush)event(plan.contact,'attack','守军袭击进攻部队','守军采取战术袭击；伤亡已计入本场战役总损失。','defender',{losses:{attacker:casualty(A,plan.contact/duration,.18),defender:casualty(D,plan.contact/duration,.18)}});
        node(plan.battle,'battle',.88,.88,ambush?.18:0);
        event(plan.battle,'attack','主力交战','双方按阵列、训练、装备、地形与军需展开会战。','both');
        node(plan.result,won?'occupation':'retreat',.88,.88,1,!won);
        event(plan.result,'result',won?'进攻方获胜':'进攻被击退',`进攻方战死 ${A.deaths.combat.toLocaleString('zh-CN')} 人，防守方战死 ${D.deaths.combat.toLocaleString('zh-CN')} 人；地区归属在此刻结算。`,'both',{losses:{attacker:{...record.timeline.at(-1).attacker.deaths},defender:{...record.timeline.at(-1).defender.deaths}}});
        event(plan.result,won?'occupation':'retreat',won?'占领目标地区':'残部沿原路撤退',won?'胜方接管目标，败方退出战场。':'进攻军沿实际来路撤回，守军恢复防线。');
      }
      node(duration,'ended',won?1:0,1,1,!won);
      event(duration,'demobilization','战役结束',won?'占领部署完成，应召兵员遣返归田，常备兵回营。':'退兵与遣返结束，存活兵员返回原籍或营地。');
      for(const snapshot of record.timeline)if(snapshot.dayOffset>=plan.contact){for(const side of ['attacker','defender'])snapshot[side].supply.ratio=clamp(snapshot[side].supply.ratio-(record.battle.modifiers[side+'Shortage']||0),0,1);}
      for(const side of ['attacker','defender']){const force=record.forces[side],last=record.timeline.at(-1)[side];last.deaths={...force.deaths};last.remaining=force.mobilized-totalLosses(force.deaths);last.supply.extraFood=force.supply.extraFood;last.supply.lostProduction=force.supply.lostProduction;}
      record.events.sort((a,b)=>a.dayOffset-b.dayOffset);
      dateRecord(record,record.year);
    }
    function resolve(x) {
      if(!tick||tick.year!==x.year)throw Error('战役年份未建立供给预算');
      let edge=typeof x.edge==='number'?R.edges[x.edge]:x.edge;
      const days=Math.min(rules.campaignDays,yearDays);
      const record={id:`campaign-${campaigns.length}`,year:x.year,startYear:x.year,endYear:x.year,calculatedThroughYear:x.year,durationDays:days,
        source:x.source,target:x.target,attacker:x.attacker,defender:x.defender,objective:x.objective||'border',religion:x.religion,
        status:'failed',reason:'unreachable',forces:null,battle:null,tactics:[],control:{region:x.target,from:x.defender,to:x.defender}};
      campaigns.push(record);summary.campaigns++;
      if(!edge||edge.sea||!((edge.a===x.source&&edge.b===x.target)||(edge.b===x.source&&edge.a===x.target))){chronicle(record,false);return record;}
      if(tick.owner[x.source]!==x.attacker||tick.owner[x.target]!==x.defender){record.reason='changed-control';chronicle(record,false);return record;}
      record.route=routeFor(edge,x.source);
      if(!record.route){chronicle(record,false);return record;}
      edge={...edge,km:record.route.km};
      const attacker=recruit(x.source,'attacker',x,edge);
      const defender=recruit(x.target,'defender',x,edge);record.forces={attacker,defender};
      let won=false, engaged=false;
      if(!attacker.requested) record.reason=attacker.eligible?'unreachable':'mobilization';
      else if(attacker.mobilized<1||attacker.supply.ratio<.25)record.reason='supply';
      else {
        engaged=true;
        const strength=(force,side)=>force.mobilized*(.55+.45*force.training)*(.55+.45*force.equipment)*force.morale*force.traits[side];
        const baseAttack=strength(attacker,'attack')/(1+attacker.travelDays/80);
        const fortGuards=defender.groups.filter(g=>g.unit==='fort').reduce((s,g)=>s+g.mobilized,0);
        const walls=!!(x.city&&x.city.walls);
        // 守方就近的野战兵力足以一战，就先在城外列阵迎敌；不足则退守城池、关堡，等待主力
        const fieldReady=strengthOf(defender.groups.filter(g=>!g.far&&g.unit!=='watch'&&g.unit!=='fort'),'defense',defender.morale)*(1+.18*Math.max(0,edge.rough||0));
        const siege=(walls||fortGuards>0)&&fieldReady<.8*baseAttack;
        const muster=Math.min(12,Math.max(0,days-2*attacker.travelDays)*.25), back=Math.max(0,attacker.travelDays);
        const info=sysOf(x.attacker),engines=!!info?.siege;
        if(siege){
          // 守城：城防兵、驻防常备军、关堡戍卒与逃入城中的本地乡勇据城而守；其余应召兵与都城主力是援军
          const inside=g=>g.role==='garrison'||g.role==='local'||(g.role==='standing'&&g.station===x.target);
          const garrison=defender.groups.filter(inside),relief=defender.groups.filter(g=>!inside(g));
          const sum=(L,f)=>L.filter(f).reduce((s,g)=>s+g.mobilized,0);
          const gsum={watch:sum(garrison,g=>g.unit==='watch'),fort:sum(garrison,g=>g.unit==='fort'),standing:sum(garrison,g=>g.role==='standing'),local:sum(garrison,g=>g.role==='local')};gsum.total=gsum.watch+gsum.fort+gsum.standing+gsum.local;
          const wall=(walls?1.8+(x.city.capital?.5:0)+(x.city.pop>=1e5?.3:0):0)+(fortGuards?1.4:0)+.18*Math.max(0,edge.rough||0);
          const gMorale=defender.morale*(.8+.2*(x.defenderCohesion??.6));
          const G0=strengthOf(garrison,'defense',gMorale)*Math.max(1,wall);
          const tactical=tacticsFor(attacker,defender,edge,true,baseAttack,G0),m=tactical.modifiers;
          const attack=baseAttack*(engines?1.25:1);
          const r0=attack/Math.max(1,G0),uncertainty=.85+.3*random();
          let posture='hold';
          if(gsum.total<1)posture='open';
          else if(r0>4.5&&((x.defenderCohesion??.6)<.5||gMorale<.55)&&random()<.55)posture='surrender';
          else if(garrison.length&&garrison.reduce((s,g)=>s+g.t*g.mobilized,0)/Math.max(1,gsum.total)>=.38&&(r0<1.1||(r0<1.7&&attacker.supply.ratio<.85))&&random()<.6)posture='sally';
          const method=engines||r0>2.2?'storm':'blockade';
          const contact=muster+attacker.travelDays,window=Math.max(1,days-contact-back);
          const reliefN=relief.reduce((s,g)=>s+g.mobilized,0),mainN=relief.filter(g=>g.role==='standing'&&g.far).reduce((s,g)=>s+g.mobilized,0);
          const reliefDays=reliefN?8+relief.reduce((s,g)=>s+g.march*g.mobilized,0)/reliefN:Infinity;
          const holdDays=clamp((method==='storm'?16:58)*Math.max(1,wall)*Math.sqrt(1/Math.max(.12,r0))*(.7+.6*defender.supply.ratio),4,400);
          const reliefAt=Math.max(contact+2,muster+reliefDays);
          const S={walls:walls?(x.city.capital?3:x.city.pop>=1e5?2:1):0,fort:fortGuards>0,city:x.city?.i??-1,capital:!!x.city?.capital,garrison:gsum,wallFactor:wall,posture,method,engines,
            holdDays,relief:{n:reliefN,main:mainN,days:reliefDays},ratio:r0,outcome:'lifted'};
          let plan,att,def,battleDay,result,combat;
          if(posture==='open'||posture==='surrender'){
            won=true;S.outcome=posture==='open'?'open':'surrender';result=contact+(posture==='open'?1:2+3*random());
            combat=[.004,.01,g=>true,0];att=attack;def=G0;
          } else if(reliefN&&reliefAt<Math.min(contact+holdDays,contact+window)){
            const R0=strengthOf(relief,'defense',defender.morale)*(1+.18*Math.max(0,edge.rough||0));
            att=attack*m.attack;def=(R0+G0*.45)*m.defense*(posture==='sally'?1.08:1);
            won=att*uncertainty/Math.max(1,def)>1.12;S.outcome=won?'relief-routed':'relieved';battleDay=reliefAt;result=reliefAt+1;
            combat=[won?.04:.13,won?.17:.05,null,0];
          } else if(holdDays<=window){
            att=attack*m.attack;def=G0*m.defense;
            won=att*uncertainty/Math.max(1,def)>(method==='storm'?1:.8);
            S.outcome=won?(method==='storm'?'stormed':'starved'):'repulsed';battleDay=contact+holdDays;result=battleDay+(won?1:3);
            combat=method==='storm'?[won?.07:.16,won?.3:.06,inside,.0]:[won?.025:.06,won?.1:.03,inside,0];
            if(posture==='sally')combat[0]+=.02;
          } else {
            att=attack*m.attack;def=G0*m.defense;won=false;S.outcome='lifted';result=contact+window;combat=[.035,.03,inside,0];
          }
          S.reliefAt=reliefN?reliefAt:null;
          plan={muster,contact,battle:battleDay??result,result:Math.min(days-back,Math.max(contact+.5,result)),back};
          record.plan=plan;record.siege=S;record.tactics=tactical.tactics;
          record.status=won?'won':'failed';record.reason=won?'objective':'repelled';
          record.battle={region:x.target,kind:'siege',baseAttack,baseDefense:G0,attack:att,defense:def,uncertainty,ratio:att/Math.max(1,def),winner:won?x.attacker:x.defender,modifiers:m};
          const starve=S.outcome==='starved'?.4:0;
          casualties(attacker,clamp(combat[0]+m.attackerCombat,0,.8),clamp(1-attacker.supply.ratio+m.attackerShortage,0,1));
          const pickD=combat[2]||(()=>true);casualties(defender,clamp(combat[1]+m.defenderCombat,0,.8),clamp(1-defender.supply.ratio+m.defenderShortage+starve,0,1),combat[2]?pickD:null,S.outcome==='relieved'||S.outcome==='relief-routed'?combat[1]*.6:0);
        } else {
          const baseDefense=strength(defender,'defense')*(1+.18*Math.max(0,edge.rough||0));
          const tactical=tacticsFor(attacker,defender,edge,false,baseAttack,baseDefense),m=tactical.modifiers;
          record.tactics=tactical.tactics;
          const attack=baseAttack*m.attack,defense=baseDefense*m.defense;
          const uncertainty=.85+.3*random(), ratio=attack/Math.max(1,defense);
          won=ratio*uncertainty>1.12; record.status=won?'won':'failed';record.reason=won?'objective':'repelled';
          record.battle={region:x.target,kind:'field',baseAttack,baseDefense,attack,defense,uncertainty,ratio,winner:won?x.attacker:x.defender,modifiers:m};
          const contact=muster+attacker.travelDays*.72,pre=days-back,battle=Math.max(contact,muster+attacker.travelDays*.88,pre-Math.min(10,days*.1));
          record.plan={muster,contact,battle,result:Math.max(battle,pre),back};
          casualties(attacker,clamp((won?.035:.13)+m.attackerCombat,0,.8),clamp(1-attacker.supply.ratio+m.attackerShortage,0,1));casualties(defender,clamp((won?.16:.045)+m.defenderCombat,0,.8),clamp(1-defender.supply.ratio+m.defenderShortage,0,1));
        }
        if(won)record.control.to=x.attacker;
        pressure[x.source]+=attacker.mobilized;pressure[x.target]+=attacker.mobilized+defender.mobilized;
      }
      if(!engaged){casualties(attacker,0,1-attacker.supply.ratio);casualties(defender,0,1-defender.supply.ratio);}
      chronicle(record,engaged);
      summary.mobilized+=attacker.mobilized+defender.mobilized;
      const count=f=>Object.values(f.deaths).reduce((a,b)=>a+b,0), deaths=count(attacker)+count(defender);
      const exposure=new Map();
      for(const region of [x.source,x.target])exposure.set(region,{region,combat:engaged&&region===x.target,mobilized:0,deaths:0});
      for(const force of [attacker,defender])for(const g of force.groups){let local=exposure.get(g.source);if(!local)exposure.set(g.source,local={region:g.source,combat:false,mobilized:0,deaths:0});local.mobilized+=g.mobilized;local.deaths+=g.deaths.combat+g.deaths.disease+g.deaths.starvation;}
      if(attacker.mobilized+defender.mobilized){const effect={id:`effect-${record.id}`,campaignId:record.id,kind:'war',startYear:record.startTime,endYear:record.endTime,
        regions:[...new Set([x.source,x.target,...attacker.groups.map(g=>g.source),...defender.groups.map(g=>g.source)])],participants:[x.attacker,x.defender].filter(p=>p>=0),
        exposure:[...exposure.values()],severity:clamp(deaths/Math.max(1,attacker.mobilized+defender.mobilized)*4,0,1),consequences:{mobilized:attacker.mobilized+defender.mobilized,deaths,controlChanged:won,reason:record.reason}};effects.push(effect);effectByCampaign.set(record.id,effect);}
      // 战报只保留人口来源与兵种；结算用的中间量不进入输出，同来源同兵种的几支合并为一条
      for(const force of [attacker,defender]){const m=new Map();
        for(const g of force.groups){const k=`${g.source},${g.species},${g.culture},${g.religion},${g.unit},${g.role}`,o=m.get(k);if(o)o.mobilized+=g.mobilized;else m.set(k,{source:g.source,species:g.species,culture:g.culture,religion:g.religion,mobilized:g.mobilized,role:g.role,unit:g.unit});}
        force.groups=[...m.values()];}
      const guard=garrisons.get(x.target);if(guard){const last=guard.fort.log[guard.fort.log.length-1];last[1]=guard.groups.reduce((n,g)=>n+g.remaining,0);}
      return record;
    }
    function setControl(record,owner,kind='occupation') {
      if(record.status!=='won')throw Error('未获胜的战役不能改变归属');
      record.control.to=owner;record.control.kind=kind;
      const effect=effectByCampaign.get(record.id);if(effect)effect.consequences.controlChanged=owner!==record.control.from;
    }
    function endTick(){used.clear();garrisons.clear();tick=null;}
    function refineYears(refine,{earliest}={}) {
      for(const c of campaigns){const time=refine(c.attacker,c.calculatedThroughYear);dateRecord(c,time);if(earliest&&c.startTime<earliest(c)-1e-8)throw Error('战役开始时间早于参战政权成立：'+c.id);}
      for(const e of effects){const c=campaigns[Number(e.campaignId.slice(9))];e.startYear=c.startTime;e.endYear=c.endTime;}
      for(const a of armies.values()){let last=-Infinity;for(const row of a.log){row[0]=Math.max(last,refine(a.p,row[0]));last=row[0];}for(const m of a.moves)m[0]=refine(a.p,m[0]);}
    }
    const output=()=>({version:3,rules,yearDays,campaigns,effects,summary,armies:[...armies.values()].filter(a=>a.log.some(r=>r[2]>0)).map(a=>({p:a.p,log:a.log,moves:a.moves})),
      model:'军制由一国都城接纳的军事思潮决定：常备兵领饷在营、驻守都城与边地并随战事调防，应召兵只在战时集结。有城墙的城市与关堡由守军据守，援军赶到之前守军坚守、投降或出城逆袭；城破、粮尽、解围或撤围各按兵力、城防与时限结算。年度供给先供居民，军需只计算额外消耗、运输与劳动力机会成本。'});
    return {beginTick,deploy,resolve,setControl,endTick,refineYears,output,remaining};
  }
  G.Military={DEFAULTS,UNITS,SYSTEMS,SYSTEM_ORDER,systemFor,cityGarrison,validateRules,create,atTime};
})(typeof self!=='undefined'?self:globalThis);
