'use strict';
// Heuristic AI pilot. One instance per player; `params` lets the optimizer/tester vary style.
const { CARDS } = require('./engine');
const EFX = require('./effects');

const UV_KW = ['Blocker', 'High-Maneuver', 'Suppression', 'Breach', 'Repair', 'First Strike'];
const DEFAULT = { aggression: 1.0, removalThreshold: 1.4, exposureWeight: 0.45, holdDraw: false };

class AI {
  constructor(params = {}) { this.p = Object.assign({}, DEFAULT, params); }

  // ---------------- valuation ----------------
  unitValue(g, u) {
    const m = g._m; let c; if (m) { c = m.get(u); if (c && c.uv !== undefined) return c.uv; }
    const v = this.unitValue0(g, u);
    if (m) { if (!c) m.set(u, c = {}); c.uv = v; }
    return v;
  }
  unitValue0(g, u) {
    let v = 0.5 + g.ap(u) * 0.55 + Math.max(0, g.hpLeft(u)) * 0.45 + u.def.lv * 0.15;
    if (u.pilot) v += 1.2; if (u.linked) v += 0.5; if (u.token) v -= 0.4;
    const [kB, kH, kS, kBr, kR, kF] = g.kwVals(u, UV_KW);
    if (kB) v += 0.8; if (kH) v += 0.8; if (kS) v += 0.8;
    v += kBr * 0.25 + kR * 0.3 + (kF ? 0.6 : 0);
    if (EFX[u.def.id] && EFX[u.def.id].noAttackPlayer) v -= 0.6;
    return Math.max(0.3, v);
  }
  defValue(def) { return 0.6 + def.ap * 0.5 + def.hp * 0.4 + def.lv * 0.12; }
  cardValue(g, p, c) {
    let v;
    if (c.type === 'UNIT') v = 0.8 + 0.4 * (c.ap + c.hp) + c.lv * 0.1;
    else if (c.type === 'PILOT') v = 2.2;
    else if (c.type === 'COMMAND') v = (EFX[c.id] && EFX[c.id].removal) ? 3.0 : 2.5;
    else v = (p.base && !p.base.ex) ? 1.0 : 2.8;
    if (c.lv > g.level(p) + 2) v -= 0.8;
    return v;
  }
  pickBestCard(g, p, cands) { return cands.reduce((a, b) => this.cardValue(g, p, b) > this.cardValue(g, p, a) ? b : a); }
  pickWorstCard(g, p, cands) { return cands.reduce((a, b) => this.cardValue(g, p, b) < this.cardValue(g, p, a) ? b : a); }
  pickDiscard(g, p, cands, domon) {
    if (domon) { const sm = cands.filter(c => c.type === 'COMMAND' && c.traits.includes('Special Move') && EFX[c.id] && EFX[c.id].canMain && EFX[c.id].canMain(g, p)); if (sm.length) return sm[0]; }
    return this.pickWorstCard(g, p, cands);
  }
  pickBestUnit(g, p, cands) { return cands.reduce((a, b) => this.unitValue(g, b) > this.unitValue(g, a) ? b : a); }
  pickBestAttacker(g, p, cands) { const act = cands.filter(u => g.canAttackThisTurn(u)); const c = act.length ? act : cands; return c.reduce((a, b) => g.ap(b) > g.ap(a) ? b : a); }
  pickOverflowTrash(g, p) { return p.units.reduce((a, b) => this.unitValue(g, b) < this.unitValue(g, a) ? b : a); }
  keepOnTop(g, p, c) { return this.cardValue(g, p, c) >= 2.4 && c.lv <= g.level(p) + 1; }
  useBurst() { return true; }
  mulligan(g, p) {
    const two = p.hand.filter(c => c.type === 'UNIT' && c.lv <= 2).length;
    const three = p.hand.filter(c => c.lv <= 3 && c.type !== 'BASE').length;
    return !(two >= 2 || (two >= 1 && three >= 3));
  }
  graceChoice(g, p) { const blockers = p.opp.units.filter(u => g.kw(u, 'Blocker')).length; return (blockers > 0 || p.opp.shields.length <= 2) ? 'Gundam Calibarn' : 'Gundam Aerial Rebuild'; }

  // ---------------- targeting ----------------
  effPreview(g, p, t, n) {
    const e = EFX[t.def.id]; let d = n;
    if (e && e.reduceEffectDmg) d = e.reduceEffectDmg(g, t, d);
    if (t.owner.base) { const be = EFX[t.owner.base.def.id]; if (be && be.protectEffect) d = be.protectEffect(g, t, d); }
    return d;
  }
  dmgTargetValue(g, p, t, n) {
    const d = this.effPreview(g, p, t, n); if (d <= 0) return 0;
    if (d >= g.hpLeft(t)) return this.unitValue(g, t);
    // chip: valuable if our attackers can then finish it
    return 0.22 * this.unitValue(g, t) * d / g.hpLeft(t);
  }
  pickDamageTarget(g, p, cands, n) { let best = null, bv = -1; for (const t of cands) { const v = this.dmgTargetValue(g, p, t, n); if (v > bv) { bv = v; best = t; } } return best; }
  bestDamageValue(g, p, n, f) { let bv = 0; for (const t of p.opp.units) if (!f || f(t)) bv = Math.max(bv, this.dmgTargetValue(g, p, t, n)); return bv; }
  removalValue(g, p, t, kind) {
    let v = this.unitValue(g, t);
    if (kind === 'hand') v = t.token ? v : v * 0.7 + (t.pilot ? 0.4 : 0) + t.def.cost * 0.15;
    if (kind === 'bottom') v = v + 0.3;
    return v;
  }
  pickRemovalTarget(g, p, cands, kind) { return cands.reduce((a, b) => this.removalValue(g, p, b, kind) > this.removalValue(g, p, a, kind) ? b : a); }
  restValue(g, p, t) {
    if (t.rested) return 0;
    let v = 0.3; if (g.kw(t, 'Blocker')) v += 1.0;
    if (g.turnPlayer === p) { // can we kill it this turn?
      const killers = p.units.filter(a => g.canAttackThisTurn(a) && g.ap(a) >= g.hpLeft(t));
      if (killers.length) v += this.unitValue(g, t) * 0.7;
    }
    return v;
  }
  pickRestTarget(g, p, cands) { return cands.reduce((a, b) => this.restValue(g, p, b) > this.restValue(g, p, a) ? b : a); }
  restScore(g, p, f) { let bv = 0; for (const t of p.opp.units) if (!t.rested && (!f || f(t))) bv = Math.max(bv, this.restValue(g, p, t)); return bv; }
  tradeEnable(g, p, n) {
    if (g.turnPlayer !== p) return null; let best = null;
    for (const a of p.units) { if (!g.canAttackThisTurn(a)) continue; for (const t of p.opp.units) { if (!t.rested) continue;
      const f = this.fight(g, a, t, true); if (!f.killT || !f.killA) continue; if (g.ap(t) - n >= g.hpLeft(a)) continue;
      const v = this.unitValue(g, a) * 0.8 + 0.3; if (!best || v > best.v) best = { a, t, v }; } }
    return best;
  }
  pickApDownTarget(g, p, cands, n, ctx) {
    if (!ctx && g.turnPlayer === p) { const en = this.tradeEnable(g, p, n); if (en && cands.includes(en.t)) return en.t; }
    if (ctx && ctx.battle && ctx.b) { const b = ctx.b; if (b.target !== 'player' && cands.includes(b.target)) return b.target; const bl = cands.filter(u => !u.rested && g.kw(u, 'Blocker')); if (bl.length) return bl.reduce((a, c) => g.ap(c) > g.ap(a) ? c : a); }
    if (g.inBattle && cands.includes(g.inBattle.attacker)) return g.inBattle.attacker;
    return cands.reduce((a, b) => g.ap(b) > g.ap(a) ? b : a);
  }
  pickOwnPing(g, p, src) {
    const own = p.units; if (!own.length) return null;
    const b1 = own.find(u => u.def.id === 'GD02-054' && u.dmg === 0 && g.hpLeft(u) > 1); if (b1) return b1;
    const safe = own.filter(u => g.hpLeft(u) > 1); const pool = safe.length ? safe : own;
    return pool.reduce((a, b) => (g.hpLeft(b) - (b.token ? 2 : 0)) > (g.hpLeft(a) - (a.token ? 2 : 0)) ? b : a);
  }
  pickSFTargets(g, p, sf) { const c = p.units.filter(u => g.canAttackThisTurn(u) || u === sf).sort((a, b) => g.ap(b) - g.ap(a)); return c.slice(0, 2); }
  wantSFDiscard(g, p, cands) { const t = this.pickRemovalTarget(g, p, cands, 'bottom'); const worst2 = [...p.hand].sort((a, b) => this.cardValue(g, p, a) - this.cardValue(g, p, b)).slice(0, 2); return this.removalValue(g, p, t, 'bottom') > worst2.reduce((s, c) => s + this.cardValue(g, p, c), 0) * 0.9; }
  pickRestOwn(g, p, cands) { return cands.reduce((a, b) => this.unitValue(g, b) < this.unitValue(g, a) ? b : a); }
  pickFightTarget(g, p, u, cands) {
    let best = null, bv = 0; for (const t of cands) { const kill = g.ap(u) >= g.hpLeft(t); const die = g.ap(t) >= g.hpLeft(u); const v = (kill ? this.unitValue(g, t) : 0) - (die ? this.unitValue(g, u) : 0); if (v > bv) { bv = v; best = t; } } return best;
  }
  pickSacrifice(g, p, own) { const tok = own.filter(u => u.token).sort((a, b) => this.unitValue(g, a) - this.unitValue(g, b)); const worst = tok[0] || own.reduce((a, b) => this.unitValue(g, b) < this.unitValue(g, a) ? b : a); const enemyBest = Math.max(...p.opp.units.map(u => this.unitValue(g, u))); return this.unitValue(g, worst) < enemyBest * 0.6 ? worst : null; }
  pickSelfDestroy(g, p, cands) { return cands.reduce((a, b) => this.unitValue(g, b) < this.unitValue(g, a) ? b : a); }
  unlockScore(g, p, fa, fe) { let best = 0; for (const a of p.units) { if (!g.canAttackThisTurn(a) || !fa(a)) continue; for (const t of p.opp.units) { if (t.rested || !fe(t)) continue; const f = this.fight(g, a, t, true); const v = (f.killT ? this.unitValue(g, t) + (g.kw(t, 'Blocker') ? 0.8 : 0) : 0) - (f.killA ? this.unitValue(g, a) : 0); if (v > best) best = v; } } return best - 0.9; }
  sweepValue(g, p, n, maxLv, self) { let v = 0; for (const pl of g.players) for (const x of pl.units) { if (x === self || x.def.lv > maxLv) continue; const d = pl === p ? n : this.effPreview(g, p, x, n); if (d >= g.hpLeft(x)) v += (pl === p ? -1 : 1) * this.unitValue(g, x); } return v; }
  pumpScore(g, p, n) { const att = p.units.filter(u => g.canAttackThisTurn(u)); if (att.length < 2) return 0; let s = 0; for (const a of att) for (const t of p.opp.units) if (t.rested && g.ap(a) < g.hpLeft(t) && g.ap(a) + n >= g.hpLeft(t)) { s += 1; break; } return s + (p.opp.base ? 0.6 : 0) - 0.3; }

  // ---------------- combat sim helpers ----------------
  fight(g, a, t, attacking) {
    const fs = attacking && g.kw(a, 'First Strike'); const apA = g.ap(a), apT = g.ap(t);
    const er = EFX[a.def.id] && EFX[a.def.id].battleDestroyRule && EFX[a.def.id].battleDestroyRule(g, a, t);
    const erT = EFX[t.def.id] && EFX[t.def.id].battleDestroyRule && EFX[t.def.id].battleDestroyRule(g, t, a);
    const dmg = (v, src, n) => { if (n <= 0) return 0; if (v.flags.noBattleFrom2 && g.ap(src) <= 2) return 0; if (g.noBattleDmg && g.noBattleDmg(v, src, g.inBattle)) return 0; return Math.max(0, n - (v.flags.reduceNext || 0)); };
    const dT = dmg(t, a, apA), dA = dmg(a, t, apT);
    const killT = dT >= g.hpLeft(t) || (er && dT > 0);
    const killA = (fs && killT) ? false : (dA >= g.hpLeft(a) || (erT && dA > 0));
    return { killT, killA };
  }
  deathValue(g, u) { // value we get back when u dies
    const id = u.def.id; if (id === 'GD01-026' && u.pilot) return 1.4; if (id === 'ST03-006' || id === 'GD05-019') return 1.0; if (id === 'GD04-017') return 1.5; if (id === 'ST11-009' && g.turnPlayer !== u.owner) return 1.0; return 0;
  }
  lethalThreat(g, p, excluding) {
    // can the opponent likely deal lethal next turn if `excluding` (our unit) is rested?
    const opp = p.opp; const att = opp.units.filter(u => g.ap(u) > 0 && !(u.token && /or attack\./.test(u.def.text)) && g.canAttackPlayer(u)).length;
    const blockers = p.units.filter(u => u !== excluding && g.kw(u, 'Blocker') && (!u.rested || g.turnPlayer === p)).length;
    const layers = p.shields.length + (p.base ? 1 : 0) + 1;
    return att + 1 >= layers + blockers; // +1: units/commands they may add
  }
  exposure(g, p, a) {
    // risk that opponent destroys rested `a` next turn
    const opp = p.opp; let can = false;
    for (const o of opp.units) { if (EFX[o.def.id] && EFX[o.def.id].cannotAttack) continue; if (g.ap(o) >= g.hpLeft(a) && (g.hpLeft(o) > g.ap(a) || this.unitValue(g, o) < this.unitValue(g, a))) { can = true; break; } }
    const v = this.unitValue(g, a) - this.deathValue(g, a);
    let r = v * (can ? this.p.exposureWeight : 0.08);
    if (g.kw(a, 'Blocker') && opp.units.some(o => g.ap(o) > 0)) r += this.lethalThreat(g, p, a) ? 4.0 : 0.25 + Math.max(0, 3 - p.shields.length) * 0.4;
    return r / this.aggr(g, p);
  }
  aggr(g, p) {
    const mine = p.units.reduce((s, u) => s + g.ap(u), 0), theirs = p.opp.units.reduce((s, u) => s + g.ap(u), 0);
    let a = this.p.aggression; if (mine > theirs * 1.5 + 2) a *= 1.3;
    if (g.turn > 14) a *= 1 + (g.turn - 14) * 0.08;
    return a;
  }
  shieldHitValue(g, p, a) {
    const D = p.opp; const ap = g.ap(a);
    const supp = g.kw(a, 'Suppression') ? 1 : 0;
    if (D.base) { const left = D.base.def.hp - D.base.dmg; const v = Math.min(ap, left) / Math.max(1, D.base.def.hp) * 1.5 + (ap >= left ? 0.7 : 0); return v + supp * 1.4; }
    if (!D.shields.length) return 100;
    const s = D.shields.length; return (1.6 + (6 - s) * 0.35 - 0.25) * (1 + supp * 0.8);
  }
  bestBlockFor(g, D, a, target) {
    const bl = D.units.filter(u => !u.rested && g.kw(u, 'Blocker') && u !== target); if (!bl.length) return null;
    let best = null, bv = -Infinity;
    const lethal = target === 'player' && !D.base && !D.shields.length;
    for (const b of bl) {
      const { killT: aKillsB, killA: bKillsA } = this.fight(g, a, b, true);
      let v = (bKillsA ? this.unitValue(g, a) : 0) - (aKillsB ? this.unitValue(g, b) - this.deathValue(g, b) : 0);
      if (target === 'player') v += lethal ? 100 : (D.base ? Math.min(g.ap(a), D.base.def.hp - D.base.dmg) * 0.3 : 1.0 + (6 - D.shields.length) * 0.25);
      else { const f = this.fight(g, a, target, true); v += (f.killT ? this.unitValue(g, target) : 0) - (f.killA ? this.unitValue(g, a) : 0); }
      if (aKillsB && g.kw(a, 'Breach')) v -= 1.0;
      v -= 0.3;
      if (v > bv) { bv = v; best = b; }
    }
    return bv > 0 ? best : null;
  }
  chooseBlock(g, D, a, target) { return this.bestBlockFor(g, D, a, target); }
  scoreAttack(g, p, a, t) {
    if (t === 'player') {
      const D = p.opp; const lethal = !D.base && !D.shields.length;
      if (!g.kw(a, 'High-Maneuver')) { const b = this.bestBlockFor(g, D, a, 'player'); if (b) { const f = this.fight(g, a, b, true); let v = (f.killT ? this.unitValue(g, b) + g.kw(a, 'Breach') * 0.6 : 0) - (f.killA ? this.unitValue(g, a) - this.deathValue(g, a) : 0); return lethal ? 6 + v : v - (f.killA ? 0 : this.exposure(g, p, a) * 0.5); } }
      if (lethal) return 1000;
      return this.shieldHitValue(g, p, a) * this.aggr(g, p) - this.exposure(g, p, a);
    }
    const f = this.fight(g, a, t, true);
    let v = f.killT ? this.unitValue(g, t) + Math.min(g.kw(a, 'Breach'), 3) * 0.7 : 0.2 * this.unitValue(g, t) * Math.min(1, g.ap(a) / Math.max(1, g.hpLeft(t)));
    if (f.killA) v -= this.unitValue(g, a) - this.deathValue(g, a); else v -= this.exposure(g, p, a) * 0.8;
    const b = this.bestBlockFor(g, p.opp, a, t);
    if (b && !g.kw(a, 'High-Maneuver')) { const fb = this.fight(g, a, b, true); v = (fb.killT ? this.unitValue(g, b) + Math.min(g.kw(a, 'Breach'), 3) * 0.7 : 0) - (fb.killA ? this.unitValue(g, a) - this.deathValue(g, a) : this.exposure(g, p, a) * 0.8); }
    return v;
  }
  attackTargets(g, p, a) {
    // Kayra Su (During Link): non-link attackers must target that rested unit if possible
    if (!a.linked) { const taunt = p.opp.units.filter(t => t.rested && t.linked && t.pilot && EFX[t.pilot.id] && EFX[t.pilot.id].p_taunt); if (taunt.length) return taunt; }
    // Turn X: enemy Units must choose one of our rested Unit tokens if possible
    if (p.opp.units.some(t => EFX[t.def.id] && EFX[t.def.id].taunt)) { const rt = p.opp.units.filter(t => t.token && t.rested); if (rt.length) return rt; }
    { const D = p.opp; const tt = D.units.filter(t => t.rested && (t.flags.taunt || (EFX[t.def.id] && EFX[t.def.id].selfTaunt && EFX[t.def.id].selfTaunt(g, t)) || D.units.some(o => o !== t && EFX[o.def.id] && EFX[o.def.id].tauntOthers && EFX[o.def.id].tauntOthers(g, o, t)))); if (tt.length) return tt; }
    const out = []; if (g.canAttackPlayer(a) && !(a.sick && !a.linked && a.flags.hasteUnitsOnly && !a.flags.hasteThisTurn)) out.push('player');
    for (const t of p.opp.units) {
      const e = EFX[t.def.id]; if (e && e.untargetable && e.untargetable(g, t)) continue;
      if (t.rested || (a.attackActiveFilter && a.attackActiveFilter(t)) || (a.def.id === 'ST02-001' && t.def.lv <= 4) || (EFX[a.def.id] && EFX[a.def.id].permActive && EFX[a.def.id].permActive(g, t))) out.push(t);
    }
    return out;
  }
  attackPhase(g, p) {
    for (let guard = 0; guard < 20 && g.winner === null; guard++) {
      const atk = p.units.filter(u => g.canAttackThisTurn(u)); if (!atk.length) return;
      let best = null, bv = 0.05;
      // lethal push: if opponent at 0 shields/no base, attack player with everything
      g._m = g.inBattle ? null : new Map(); // memo ap/hp/kw/unitValue while scoring on the frozen state
      try { for (const a of atk) for (const t of this.attackTargets(g, p, a)) { const v = this.scoreAttack(g, p, a, t); if (v > bv) { bv = v; best = [a, t]; } } } finally { g._m = null; }
      if (!best) return;
      this.preAttack(g, p, best[0], best[1]);
      if (!g.alive(best[0]) || !g.canAttackThisTurn(best[0])) continue;
      if (best[1] !== 'player' && !g.alive(best[1])) continue;
      g.attack(best[0], best[1]);
    }
  }
  preAttack(g, p, a, t) {
    // Banshee first strike before attacking a unit
    const e = EFX[a.def.id];
    if (t !== 'player' && e && e.activate && a.def.id === 'ST12-006' && e.activate.can(g, p, a)) { const f = this.fight(g, a, t, true); if (f.killA) e.activate.run(g, p, a); }
  }

  // ---------------- action step ----------------
  endPhaseAction(g, p, turnP) {
    if (turnP.flags.turn && turnP.flags.turn.attacked) return;
    for (const c of [...p.hand]) { const e = EFX[c.id]; if (e && e.endPhaseDraw && g.canPlay(p, c)) { p.hand.splice(p.hand.indexOf(c), 1); g.pay(p, g.costOf(p, c)); g.draw(p, e.endPhaseDraw); p.trash.push(c); return; } }
  }
  battlePumpUse(g, p, b, role) {
    const mine = role === 'attack' ? b.attacker : (b.target !== 'player' ? b.target : null); const other = role === 'attack' ? b.target : b.attacker;
    if (!mine || other === 'player' || !g.alive(mine) || !g.alive(other)) return false;
    for (const c of p.hand) { const e = EFX[c.id]; if (!e || !e.battlePump || !g.canPlay(p, c)) continue;
      const f0 = role === 'attack' ? this.fight(g, mine, other, true) : this.fight(g, other, mine, true);
      mine.bAP += e.battlePump; const f1 = role === 'attack' ? this.fight(g, mine, other, true) : this.fight(g, other, mine, true); mine.bAP -= e.battlePump;
      const gain = role === 'attack' ? (f1.killT && !f0.killT) : (f1.killA && !f0.killA);
      if (gain) { p.hand.splice(p.hand.indexOf(c), 1); g.pay(p, g.costOf(p, c)); e.action(g, p, b, role, mine); p.trash.push(c); return true; } }
    return false;
  }
  actionStep(g, p, b, role) {
    if (this.battlePumpUse(g, p, b, role)) return;
    if (role !== 'defend') return;
    const a = b.attacker; if (!g.alive(a)) return;
    const lethal = b.target === 'player' && !p.base && !p.shields.length;
    const unitBattle = b.target !== 'player';
    const myLoss = unitBattle ? (() => { const f = this.fight(g, a, b.target, true); return f.killT ? this.unitValue(g, b.target) : 0; })() : 0;
    const threat = lethal ? 100 : (b.target === 'player' ? (p.base ? 0.6 : 1.0 + (6 - p.shields.length) * 0.3) : myLoss);
    let best = null, bv = this.p.removalThreshold * 0.8;
    for (const c of p.hand) {
      if (c.type !== 'COMMAND') continue; const e = EFX[c.id]; if (!e) continue;
      const actionable = e.actionToo || e.actionOnly; if (!actionable) continue;
      if (!g.canPlay(p, c)) continue;
      let v = 0;
      if (e.removal) {
        if (!e.removal.f(g, a)) continue;
        const k = e.removal.kind;
        const removes = k === 'damage' ? this.effPreview(g, p, a, e.removal.n) >= g.hpLeft(a) : true;
        if (!removes) { // chip may still save unit? skip
          continue; }
        v = this.removalValue(g, p, a, k === 'damage' ? 'destroy' : k) + threat * 0.7;
      } else if (e.apDown && unitBattle) {
        const t = b.target; const f = this.fight(g, a, t, true); if (!f.killT) continue;
        if (g.ap(a) - e.apDown >= g.hpLeft(t)) continue; v = this.unitValue(g, t) + (f.killA ? 0 : 0.3);
      } else if (e.defAction) { if (!e.defAction.can(g, p, b)) continue; v = e.defAction.value(g, p, b, threat, myLoss); }
      else continue;
      if (v > bv) { bv = v; best = c; }
    }
    if (best) this.castCommand(g, p, best, 'action', b);
  }

  // ---------------- main phase ----------------
  pilotObj(c, asCmd) {
    if (!asCmd) return c;
    const e = EFX[c.id]; return { id: c.id, name: c.name, pname: e.pilotName, ap: c.ap, hp: c.hp, traits: c.traits, lv: c.lv, cost: c.cost, cmdPilot: true, text: '' };
  }
  pairBonus(g, p, u, pd) {
    let v = 0.45 * (pd.ap + pd.hp) + 0.4;
    const link = g.isLinkPilot(u.def, pd);
    if (link) { v += 1.2; if (u.sick && !u.rested && g.turnPlayer === p) v += 1.0; }
    const pe = EFX[pd.id]; const ue = EFX[u.def.id];
    const id = pd.id;
    if (id === 'ST01-010') v += this.restScore(g, p, x => g.hpLeft(x) <= 5);
    if (id === 'ST05-010') v += this.bestDamageValue(g, p, 1, null) * 0.8;
    if (id === 'GD06-084') v += p.units.filter(x => g.hasTrait(x, 'Neo Zeon') || g.hasTrait(x, 'Long-Range Weapon')).length * 0.35;
    if (id === 'GD05-081' && link && (g.hasTrait(u, 'Orb') || g.hasTrait(u, 'Triple Ship Alliance'))) v += 1.8;
    if (id === 'ST13-011') v += 0.8; if (id === 'GD05-097') v += 0.7; if (id === 'ST12-012' && link) v += 0.6;
    if (id === 'ST03-010') { const c = p.hand.filter(x => x.type === 'UNIT' && x.lv <= 4 && (x.traits.includes('Neo Zeon') || x.traits.includes('Zeon'))); if (c.length) v += 2.5; }
    if (id === 'GD04-081' && g.hasTrait(u, 'League Militaire')) v += 1.0;
    if (id === 'ST03-011' && link) v += 1.0;
    if (id === 'GD01-093' && link) v += 0.8;
    // unit-side paired/linked effects
    const uid = u.def.id;
    if (uid === 'GD03-001') v += this.bestDamageValue(g, p, 1, x => x.rested);
    if (uid === 'GD01-044' && (pd.traits || []).some(t => t === 'Newtype' || t === 'Cyber-Newtype')) v += this.bestDamageValue(g, p, 1, null) * 1.6;
    if (uid === 'GD05-072' && link) v += this.restScore(g, p, x => g.hpLeft(x) <= 4);
    if (uid === 'GD06-036' && link) v += this.bestDamageValue(g, p, 1, null);
    if (uid === 'ST04-001' && pd.lv >= 4) v += Math.max(0, ...p.opp.units.filter(x => g.hpLeft(x) <= 4).map(x => this.removalValue(g, p, x, 'hand')));
    if (uid === 'GD04-017' && (pd.traits || []).includes('Newtype')) v += 2.5;
    if (uid === 'GD05-017') v += p.trash.filter(c => c.traits.includes('Londo Bell')).length >= 3 ? 2.0 : 0;
    if (uid === 'GD05-036') v += 1.0; if (uid === 'GD01-026') v += 0.6; if (uid === 'GD05-002') v += 1.0;
    if (uid === 'ST13-001' || p.units.some(x => x.def.id === 'ST13-001' && !x.once.has('funnel'))) v += 1.5;
    if (uid === 'GD06-022' && link) v += Math.max(0, ...p.opp.units.filter(x => g.ap(x) <= 3).map(x => g.ap(u) + pd.ap >= g.hpLeft(x) ? this.unitValue(g, x) : 0));
    if (uid === 'GD01-032' && (pd.traits || []).includes('Zeon')) v += Math.max(0, ...p.opp.units.filter(x => g.kw(x, 'Blocker') && x.def.lv <= 2).map(x => this.unitValue(g, x)));
    if (id === 'GD05-087' && g.hasTrait(u, 'Academy')) v += 1.2; if (id === 'GD06-085' && link) v += 0.8; if (id === 'GD06-087') v += 0.5;
    if ((uid === 'GD04-008') && link) v += 1.0;
    if (pe && pe.ai_whenPaired) v += pe.ai_whenPaired(g, p, u); if (ue && ue.ai_whenPaired) v += ue.ai_whenPaired(g, p, u);
    if (link && pe && pe.ai_whenLinked) v += pe.ai_whenLinked(g, p, u); if (link && ue && ue.ai_whenLinked) v += ue.ai_whenLinked(g, p, u);
    if (u.token && (EFX[u.def.id] || {}).noPilot) v = -99;
    v += Math.min(1.5, this.unitValue(g, u) * 0.12);
    return v;
  }
  canPair(g, u) { if (u.pilot) return false; if (u.token && /can't be[^.]*paired/.test(u.def.text)) return false; return true; }
  deployBonus(g, p, c) {
    const id = c.id; const B = (n, f) => this.bestDamageValue(g, p, n, f);
    switch (id) {
      case 'GD01-008': case 'GD05-015': return B(1, x => x.rested);
      case 'GD03-056': case 'GD02-055': return B(1, null) + (p.units.some(x => x.def.id === 'GD02-054' && x.dmg === 0) ? 0.6 : -0.2);
      case 'GD04-038': return p.opp.units.length >= 2 ? B(2, x => x.def.lv <= 2) : 0;
      case 'GD06-048': return B(1, p.trash.filter(x => x.traits.includes('Gjallarhorn')).length >= 4 ? null : x => x.def.lv <= 2);
      case 'GD05-060': return Math.max(0, ...p.opp.units.filter(x => x.def.lv <= 2).map(x => this.unitValue(g, x)));
      case 'ST11-001': return p.units.some(x => g.hasTrait(x, 'Marine')) ? Math.max(0, ...p.opp.units.filter(x => x.def.lv <= 2).map(x => this.unitValue(g, x))) : 0;
      case 'GD01-068': return Math.max(0, ...p.opp.units.filter(x => g.hpLeft(x) === 1).map(x => this.removalValue(g, p, x, 'hand')));
      case 'GD04-033': return B(3, null) + 1;
      case 'GD05-002': return 1.5; case 'GD05-025': return 0.8; case 'GD01-039': case 'GD05-029': return 0.2;
      case 'GD01-066': return 2.0; case 'ST14-005': return this.restScore(g, p, x => x.def.lv <= 6);
      case 'GD05-066': return 0.4; case 'GD05-020': return p.trash.filter(x => x.traits.includes('Londo Bell')).length >= 2 ? 0.8 : 0;
      case 'GD05-028': return 0.5;
      case 'GD06-021': { const t = p.units.filter(x => x.token); return t.length && p.units.length < 6 ? Math.max(...t.map(x => this.unitValue(g, x))) : -0.5; }
      case 'GD01-024': return this.sweepValue(g, p, 3, 5, null) + 1.0;
      case 'GD05-018': return 2.5; case 'GD04-024': return 0.9; case 'GD03-006': return this.restScore(g, p, x => g.hpLeft(x) <= 3) * 1.5;
      case 'ST13-002': return 1.2; case 'GD01-009': return 0.6; case 'GD05-030': return p.opp.units.some(x => x.rested) ? 0.8 : 0;
      case 'GD01-027': return p.trash.filter(c => c.type === 'UNIT' && (c.traits.includes('Zeon') || c.traits.includes('Neo Zeon'))).length >= 10 ? p.opp.units.filter(x => g.kw(x, 'Blocker')).reduce((s, x) => s + this.dmgTargetValue(g, p, x, 4), 0) : 0;
      default: { const e = EFX[id]; return (e && e.ai_deploy) ? e.ai_deploy(g, p, null) : 0; }
    }
  }
  linkPilotInHand(g, p, c) { return p.hand.some(x => (x.type === 'PILOT' || (x.type === 'COMMAND' && EFX[x.id] && EFX[x.id].pilotName)) && g.isLinkPilot(c, this.pilotObj(x, x.type === 'COMMAND'))); }
  candidates(g, p, stage) {
    const acts = []; const lv = g.level(p);
    for (const c of p.hand) {
      if (g.effLv(p, c) > lv) continue;
      if (c.type === 'UNIT') {
        const cost = g.costOf(p, c); if (g.avail(p) < cost) continue;
        let v = 1.0 + 0.45 * (c.ap + c.hp) + c.lv * 0.12 + this.deployBonus(g, p, c);
        if (c.skw.Blocker) v += 0.6; if (c.skw.Breach) v += 0.2 * c.skw.Breach;
        if (stage === 'pre' && this.linkPilotInHand(g, p, c) && g.avail(p) >= cost + 1) v += 1.2;
        if (p.units.length >= 6) v -= this.unitValue(g, this.pickOverflowTrash(g, p)) + 0.5;
        acts.push({ kind: 'unit', c, cost, v });
      } else if (c.type === 'PILOT') {
        if (g.avail(p) < c.cost) continue;
        for (const u of p.units) if (this.canPair(g, u)) acts.push({ kind: 'pilot', c, u, cost: c.cost, v: this.pairBonus(g, p, u, c) });
      } else if (c.type === 'COMMAND') {
        const e = EFX[c.id]; if (!e) continue; const cost = g.costOf(p, c); if (g.avail(p) < cost) continue;
        if (e.pilotName) for (const u of p.units) if (this.canPair(g, u)) { const po = this.pilotObj(c, true); acts.push({ kind: 'cmdpilot', c, u, cost, v: this.pairBonus(g, p, u, po) - 0.6 }); }
        if (e.actionOnly || !e.canMain || !e.canMain(g, p)) continue;
        let v;
        if (e.removal) {
          const r = e.removal; const cands = p.opp.units.filter(u => r.f(g, u)); if (!cands.length) continue;
          if (r.kind === 'damage') v = Math.max(...cands.map(u => this.dmgTargetValue(g, p, u, r.n)));
          else v = Math.max(...cands.map(u => this.removalValue(g, p, u, r.kind)));
          if (r.multi) v *= 1.5;
          v -= this.p.removalThreshold; if (e.actionToo && stage === 'pre') v -= 0.3; // prefer holding instant removal slightly
        } else if (e.apDown || c.id === 'GD05-121') { const n = e.apDown || 2; const en = this.tradeEnable(g, p, n); v = en ? en.v : -1; if (c.id === 'GD05-121' && p.units.some(u => g.hasTrait(u, 'MF') && !u.pilot)) v = Math.max(v, 0) + 2.2; }
        else v = e.score ? e.score(g, p) : 1.0;
        if (e.specialMove) v += p.units.some(u => u.def.id === 'GD05-068' || u.def.id === 'GD04-066') ? 0.6 : 0;
        if (e.specialMove && p.units.some(u => u.linked && u.pilot && u.pilot.id === 'GD05-089' && g.canAttackThisTurn(u))) v += 1.5;
        if (c.id === 'GD05-110' && p.units.some(u => u.def.name.includes('Master Gundam'))) v += 2.2;
        if (p.units.some(u => u.def.id === 'GD04-066')) v += 0.8;
        acts.push({ kind: 'cmd', c, cost, v });
      } else if (c.type === 'BASE') {
        const cost = g.costOf(p, c); if (g.avail(p) < cost) continue;
        let v = (!p.base || p.base.ex) ? 2.6 : (p.base.dmg > 0 ? 1.4 : 0.2);
        if (c.id === 'ST03-016' || c.id === 'ST02-016') v += yourTurnTokenValue(c, g, p);
        if (c.id === 'ST08-014') v += 0.4;
        if (!p.shields.length) v -= 1.0;
        acts.push({ kind: 'base', c, cost, v });
      }
    }
    // activated abilities
    for (const u of p.units) { const e = EFX[u.def.id]; if (!e || !e.activate) continue; const A = e.activate; if (A.once && u.once.has('act')) continue; if (g.avail(p) < (A.cost || 0)) continue; if (!A.can(g, p, u)) continue; if (A.postCombat && stage === 'pre') continue; acts.push({ kind: 'act', u, A, cost: A.cost || 0, v: A.score(g, p, u) }); }
    if (p.base && !p.base.ex) { const e = EFX[p.base.def.id]; if (e && e.activate) { const A = e.activate; const ok = (!A.once || !p.flags.turn.baseAct) && (!A.restBase || !p.base.rested) && g.avail(p) >= (A.cost || 0) && A.can(g, p); if (ok) acts.push({ kind: 'bact', A, cost: A.cost || 0, v: A.score(g, p) }); } }
    return acts;
  }
  exec(g, p, a) {
    const rm = (c) => { const i = p.hand.indexOf(c); if (i >= 0) p.hand.splice(i, 1); };
    if (a.kind === 'unit') { rm(a.c); g.pay(p, a.cost); g.deployUnit(p, a.c); }
    else if (a.kind === 'pilot') { rm(a.c); g.pay(p, a.cost); g.pair(a.u, a.c); }
    else if (a.kind === 'cmdpilot') { rm(a.c); g.pay(p, a.cost); g.pair(a.u, this.pilotObj(a.c, true)); }
    else if (a.kind === 'cmd') { this.castCommand(g, p, a.c, 'main'); }
    else if (a.kind === 'base') { rm(a.c); g.pay(p, a.cost); g.deployBase(p, a.c); }
    else if (a.kind === 'act') { g.pay(p, a.cost); a.u.once.add('act'); a.A.run(g, p, a.u); }
    else if (a.kind === 'bact') { g.pay(p, a.cost); if (a.A.once) p.flags.turn.baseAct = true; if (a.A.restBase) p.base.rested = true; a.A.run(g, p); }
  }
  castCommand(g, p, c, mode, b) {
    const i = p.hand.indexOf(c); if (i < 0) return; p.hand.splice(i, 1); g.pay(p, g.costOf(p, c));
    const e = EFX[c.id]; g.L(`P${p.i} casts ${c.name} (${mode})`);
    if (mode === 'action' && e.defAction) e.defAction.run(g, p, b); else if (mode === 'action' && e.action) e.action(g, p, b, 'defend'); else if (mode === 'action') { // Main/Action removal used as action: target attacker if possible
      if (e.removal && b && g.alive(b.attacker) && e.removal.f(g, b.attacker)) { const k = e.removal.kind; if (k === 'damage') g.effectDamage(p, b.attacker, e.removal.n); else if (k === 'hand') g.bounce(b.attacker); else g.destroy(b.attacker, { effect: true, by: p }); if (c.id === 'GD05-110' && p.units.some(u => u.def.name.includes('Master Gundam'))) g.draw(p, 1); }
      else if (e.apDown && b) { b.attacker.tAP -= e.apDown; }
    } else e.main(g, p);
    if (e.specialMove) p.specialMoveThisTurn = true;
    g.fireAllies(p, 'onCommand', c);
    if (c.id === 'GD05-121' && p.flags.cyclonePair) { const mf = p.flags.cyclonePair.filter(u => g.alive(u) && !u.pilot); p.flags.cyclonePair = null; if (mf.length) { const u = this.pickBestUnit(g, p, mf); g.pair(u, this.pilotObj(c, true)); return; } }
    p.trash.push(c);
  }
  mainPhase(g, p) {
    this.develop(g, p, 'pre');
    if (g.winner !== null) return;
    this.attackPhase(g, p);
    if (g.winner !== null) return;
    this.develop(g, p, 'post');
  }
  reserveFor(g, p, stage) {
    if (stage !== 'post' || !p.opp.units.length) return null;
    let best = null;
    for (const c of p.hand) { if (c.type !== 'COMMAND') continue; const e = EFX[c.id]; if (!e || !(e.actionToo || e.actionOnly) || !(e.removal || e.apDown || e.action || e.defAction)) continue; if (c.lv > g.level(p)) continue;
      const cost = g.costOf(p, c); if (cost > g.avail(p)) continue;
      const tgt = e.removal ? p.opp.units.filter(u => e.removal.f(g, u)).length : p.opp.units.length; if (!tgt) continue;
      const value = 1.2 + Math.min(1.2, p.opp.units.length * 0.3) + (this.lethalThreat(g, p, null) ? 1.5 : 0);
      if (!best || cost < best.cost) best = { c, cost, value }; }
    return best;
  }
  develop(g, p, stage) {
    for (let guard = 0; guard < 25 && g.winner === null; guard++) {
      const acts = this.candidates(g, p, stage); if (!acts.length) return;
      // one-step lookahead on remaining resources: prefer combos that use mana well
      const budget = g.avail(p);
      const reserve = this.reserveFor(g, p, stage);
      let best = null, bv = 0;
      for (const a of acts) {
        let follow = 0; const rem = budget - a.cost;
        for (const b of acts) if (b !== a && b.cost <= rem && b.c !== a.c && b.v > follow) follow = b.v;
        let v = a.v + 0.35 * follow;
        if (reserve && rem < reserve.cost && a.c !== reserve.c) v -= reserve.value;
        if (a.v > 0 && v > bv) { bv = v; best = a; }
      }
      if (!best) return;
      this.exec(g, p, best);
    }
  }
}
function yourTurnTokenValue(c, g, p) { if (c.id === 'ST03-016') return 1.4; if (c.id === 'ST02-016') return p.trash.some(x => x.name.includes('Corsica Base')) ? 1.6 : 2.0; return 0; }

module.exports = { AI, DEFAULT };
