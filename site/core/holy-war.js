/* 圣战只协调现有战斗：必须真实夺取目标且结算时守住，才可建立宗教政权。 */
(function (G) {
  'use strict';
  function create() {
    const records = [], active = new Map(), lastStart = new Map(), ended = [];
    const close = (war, year, status, reason) => {
      if (war.status !== 'active') return;
      war.status = status; war.ended = year; war.reason = reason; active.delete(war.attacker); ended.push(war);
    };
    function start(x) {
      const { year, attacker, defender, source, target, religion, owner } = x;
      if (!(x.trait > 0) || !(x.foreignShare >= 0.5) || !(x.believerShare > 0) || x.sea || !x.adjacent ||
          !(attacker >= 0 && defender >= 0 && attacker !== defender && source > 0 && target > 0 && source !== target && religion >= 0) ||
          owner[source] !== attacker || owner[target] !== defender || active.has(attacker) || year - (lastStart.get(attacker) ?? -Infinity) < 120) return null;
      const war = { id:`holy-${attacker}-${year}-${target}`, attacker, defender, source, target, religion, started:year, ended:null, status:'active', supply:[], captured:false };
      records.push(war); active.set(attacker, war); lastStart.set(attacker, year); return war;
    }
    function advance({ year, owner, alive }) {
      for (const war of [...active.values()]) {
        if (year <= war.started) continue;
        if (year - war.started >= 60) { close(war, year, 'failed', 'timeout'); continue; }
        if (!alive(war.attacker) || !alive(war.defender) || owner[war.source] !== war.attacker || owner[war.target] !== war.defender) { close(war, year, 'failed', 'changed-control'); continue; }
      }
    }
    function battle(result) {
      const war = active.get(result.attacker);
      if (!war || result.objective !== 'holy-war' || war.defender !== result.defender || war.source !== result.source || war.target !== result.target || result.year < war.started) return false;
      war.campaignId = result.id;
      const force=result.forces && result.forces.attacker;
      if(force)war.supply.push({year:result.year,campaignId:result.id,regions:[...new Set(force.groups.map(g=>g.source))],amount:force.supply.extraFood,lostProduction:force.supply.lostProduction,mobilized:force.mobilized});
      if(result.status==='won'){war.captured=true;war.capturedYear=result.year;return true;}
      if(['supply','unreachable','mobilization','changed-control'].includes(result.reason))close(war,result.year,'failed',result.reason);
      return false;
    }
    function settle({ year, owner }) {
      const won = [];
      for (const war of [...active.values()]) {
        if (war.captured) {
          if (owner[war.source] === war.attacker && owner[war.target] === war.attacker) { close(war, year, 'won', 'battle'); won.push(war); }
          else close(war, year, 'failed', 'lost-objective');
        } else if (owner[war.source] !== war.attacker || owner[war.target] !== war.defender) close(war, year, 'failed', 'changed-control');
      }
      return won;
    }
    function drain() { return ended.splice(0); }
    const goal = (p, source, target, defender) => { const w = active.get(p); return !!w && w.source === source && w.target === target && w.defender === defender; };
    const objective = (p, source, target, defender) => goal(p,source,target,defender) ? active.get(p) : null;
    return { records, start, advance, battle, settle, drain, goal, objective };
  }
  function combatFactors(e) { return { attack:G.HumanRules.multiplier(e.combat + e.attack), defense:G.HumanRules.multiplier(e.combat + e.defense) }; }
  G.HolyWar = { create, combatFactors };
})(typeof self !== 'undefined' ? self : globalThis);
