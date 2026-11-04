'use strict';
// Search AIs layered on the heuristic policy (ai.js).
//
// SearchAI (determinized Monte Carlo, "K x N"): at each development step and each attack choice it takes the top-K
// heuristic options plus "stop", plays each out N times on a cloned game (opponent hand/deck/shields resampled from
// their own cards; our deck/shields resampled; our hand known), through the rest of our turn and D further turns
// (D=1: the opponent's next turn), then picks the option with the best average evaluation.
//   sopts: { K, N, D=1, legacy=false, ev=null }
//   - Rollout n uses its own determinization seed (shared by all options: common random numbers). Until v4 every
//     rollout reused the parent game's RNG state, so all N rollouts were identical (KxN behaved exactly like Kx1).
//     legacy:true reproduces that behaviour; KxN with legacy is the old "KxN" judge.
//   - ev: path of a learned value function (valuefn.js) used instead of the hand-written evaluate().
//
// MCTSAI (UCT over own-turn action sequences): at each decision point it grows a tree whose levels are our successive
// decisions this turn (development actions, attacks, and the "next phase" moves pre -> attack -> post -> end). Each
// iteration draws a fresh determinization, descends by UCT among the options legal in that sample (top-KM heuristic
// options per node), expands one node, finishes the turn with the heuristic, rolls out D further turns and backs up
// sigmoid(evaluate / scale). The most-visited root option is played; the search restarts at the next decision.
//   sopts: { mcts:true, I=48 iterations, KM=5, C=0.7, scale=6, M=0 (cycle M determinizations; 0 = fresh each), D=1, ev=null }
const { AI } = require('./ai'); const { shuffle } = require('./engine'); const EFX = require('./effects');

const mix = (a, n) => { let h = (a ^ Math.imul(n + 1, 0x9E3779B1)) >>> 0; h = Math.imul(h ^ (h >>> 16), 0x85EBCA6B) >>> 0; h = Math.imul(h ^ (h >>> 13), 0xC2B2AE35) >>> 0; return (h ^ (h >>> 16)) >>> 0; };

class SearchAI extends AI {
  constructor(params = {}, sopts = {}) {
    super(params); this.K = sopts.K || 3; this.N = sopts.N || 4; this.D = sopts.D || 1; this.legacy = !!sopts.legacy; this.searching = true;
    this.vf = sopts.ev ? require('./valuefn').load(sopts.ev) : null;
  }
  life(g, p) { return p.shields.length + (p.base ? Math.max(0, p.base.def.hp - p.base.dmg) / 3 : 0); }
  evaluate(g, me) {
    if (this.vf) return g.winner !== null ? (g.winner === me.i ? 10 : -10) : this.vf.score(g, me); // learned: 20*(p-0.5)
    if (g.winner !== null) return g.winner === me.i ? 1000 : -1000;
    return this.evaluateHand(g, me);
  }
  evaluateHand(g, me) {
    const op = me.opp; const H = this;
    const board = (p) => p.units.reduce((s, u) => s + H.unitValue(g, u) * (u.rested && p !== g.turnPlayer ? 0.85 : 1), 0);
    const lifeDiff = this.life(g, me) - this.life(g, op);
    const danger = (p) => { const l = this.life(g, p); return l <= 1 ? 4 : l <= 2 ? 2 : 0; };
    return 2.4 * lifeDiff + 1.0 * (board(me) - board(op)) + 0.55 * (me.hand.length - op.hand.length) + 0.25 * (g.level(me) - g.level(op)) - danger(me) + danger(op);
  }
  determinize(g2, meI) {
    const me = g2.players[meI], op = me.opp;
    const pool = [...op.hand, ...op.deck, ...op.shields]; shuffle(pool, g2.rng);
    const h = op.hand.length, sh = op.shields.length; op.hand = pool.slice(0, h); op.shields = pool.slice(h, h + sh); op.deck = pool.slice(h + sh);
    const mine = [...me.deck, ...me.shields]; shuffle(mine, g2.rng); const ms = me.shields.length; me.shields = mine.slice(0, ms); me.deck = mine.slice(ms);
  }
  makeClone(g, p, n = 0) {
    const myP = this.p, opP = (p.opp.ai && p.opp.ai.p) || {};
    const g2 = g.clone(i => new AI(i === p.i ? myP : opP));
    if (n && !this.legacy) g2.rng.state.a = mix(g.rng.state.a, n);
    this.determinize(g2, p.i); return g2;
  }
  // D-1 further whole turns after the opponent's reply (alternating players), then evaluate from our side.
  extraTurns(g2, me) {
    for (let d = 2; d <= this.D && g2.winner === null; d++) { const pl = d % 2 === 0 ? me : me.opp; g2.turn++; g2.turnPlayer = pl; g2.takeTurn(pl); }
    g2.turnPlayer = me;
  }
  finishTurn(g2, me, stage) {
    // continue our turn with the heuristic, then the opponent's whole turn (and D-1 more turns)
    const ai = me.ai;
    if (g2.winner === null && stage === 'pre') { ai.develop(g2, me, 'pre'); }
    if (g2.winner === null && (stage === 'pre' || stage === 'attack')) ai.attackPhase(g2, me);
    if (g2.winner === null && stage !== 'done') ai.develop(g2, me, 'post');
    if (g2.winner === null) g2.endPhase(me);
    if (g2.winner === null) { g2.turn++; g2.turnPlayer = me.opp; g2.takeTurn(me.opp); g2.turnPlayer = me; }
    if (this.D > 1) this.extraTurns(g2, me);
  }
  mapAction(g2, p2, a, p) {
    const idx = (c) => p.hand.indexOf(c);
    const b = Object.assign({}, a);
    if (a.c) { b.c = p2.hand[idx(a.c)]; if (!b.c) return null; }
    if (a.u) { b.u = p2.units[p.units.indexOf(a.u)]; if (!b.u) return null; }
    return b;
  }
  develop(g, p, stage) {
    if (!this.searching) return super.develop(g, p, stage);
    for (let guard = 0; guard < 25 && g.winner === null; guard++) {
      const acts = this.candidates(g, p, stage); if (!acts.length) return;
      const ranked = acts.filter(a => a.v > 0).sort((x, y) => y.v - x.v).slice(0, this.K); if (!ranked.length) return;
      const options = [...ranked, null]; const score = options.map(() => 0);
      for (let n = 0; n < this.N; n++) {
        options.forEach((a, k) => {
          const g2 = this.makeClone(g, p, n); const p2 = g2.players[p.i];
          if (a) { const b = this.mapAction(g2, p2, a, p); if (!b) { score[k] -= 999; return; } p2.ai.exec(g2, p2, b); this.finishTurn(g2, p2, stage); }
          else { if (stage === 'pre') { p2.ai.attackPhase(g2, p2); } if (g2.winner === null) p2.ai.develop(g2, p2, 'post'); this.finishTurn(g2, p2, 'done'); }
          score[k] += this.evaluate(g2, p2);
        });
      }
      let bk = 0; for (let k = 1; k < options.length; k++) if (score[k] > score[bk]) bk = k;
      const pick = options[bk]; if (!pick) return; this.exec(g, p, pick);
    }
  }
  attackPhase(g, p) {
    if (!this.searching) return super.attackPhase(g, p);
    for (let guard = 0; guard < 20 && g.winner === null; guard++) {
      const atk = p.units.filter(u => g.canAttackThisTurn(u)); if (!atk.length) return;
      const opts = []; for (const a of atk) for (const t of this.attackTargets(g, p, a)) opts.push({ a, t, v: this.scoreAttack(g, p, a, t) });
      if (!opts.length) return;
      // forced lethal: take it
      const lethal = opts.find(o => o.t === 'player' && o.v >= 1000); if (lethal) { this.preAttack(g, p, lethal.a, lethal.t); g.attack(lethal.a, lethal.t); continue; }
      const ranked = opts.sort((x, y) => y.v - x.v).slice(0, this.K); const options = [...ranked, null]; const score = options.map(() => 0);
      for (let n = 0; n < this.N; n++) {
        options.forEach((o, k) => {
          const g2 = this.makeClone(g, p, n); const p2 = g2.players[p.i];
          if (o) { const a2 = p2.units[p.units.indexOf(o.a)]; const t2 = o.t === 'player' ? 'player' : p2.opp.units[p.opp.units.indexOf(o.t)]; if (!a2 || !t2) { score[k] -= 999; return; }
            p2.ai.preAttack(g2, p2, a2, t2); if (g2.alive(a2) && g2.canAttackThisTurn(a2)) g2.attack(a2, t2); this.finishTurn(g2, p2, 'attack'); }
          else { if (g2.winner === null) p2.ai.develop(g2, p2, 'post'); this.finishTurn(g2, p2, 'done'); }
          score[k] += this.evaluate(g2, p2);
        });
      }
      let bk = 0; for (let k = 1; k < options.length; k++) if (score[k] > score[bk]) bk = k;
      const pick = options[bk]; if (!pick) return;
      this.preAttack(g, p, pick.a, pick.t); if (!g.alive(pick.a) || !g.canAttackThisTurn(pick.a)) continue; if (pick.t !== 'player' && !g.alive(pick.t)) continue;
      g.attack(pick.a, pick.t);
    }
  }
}

// ---------------------------------------------------------------- MCTS (UCT) ----------------------------------------
const NEXT = { pre: 'attack', attack: 'post', post: 'end' };
const devKey = (p, a) => `${a.kind}:${a.c ? a.c.id : ''}:${a.u ? p.units.indexOf(a.u) : ''}`;
class MCTSAI extends SearchAI {
  constructor(params = {}, sopts = {}) {
    super(params, sopts); this.I = sopts.I || 48; this.KM = sopts.KM || 5; this.C = sopts.C ?? 0.7; this.scale = sopts.scale || 6; this.M = sopts.M || 0; this.ctr = 0;
  }
  // options at a decision point in phase ph ('pre' | 'attack' | 'post'), computed with the policy `ai` on state g
  options(ai, g, p, ph) {
    const out = [];
    if (ph === 'attack') {
      const atk = p.units.filter(u => g.canAttackThisTurn(u)); const opts = [];
      g._m = g.inBattle ? null : new Map();
      try { for (const a of atk) for (const t of ai.attackTargets(g, p, a)) opts.push({ kind: 'atk', a, t, v: ai.scoreAttack(g, p, a, t), key: 'A' + p.units.indexOf(a) + '>' + (t === 'player' ? 'P' : p.opp.units.indexOf(t)) }); } finally { g._m = null; }
      const lethal = opts.find(o => o.t === 'player' && o.v >= 1000); if (lethal) return [lethal]; // forced
      opts.sort((x, y) => y.v - x.v); out.push(...opts.slice(0, this.KM));
    } else {
      const acts = ai.candidates(g, p, ph).filter(a => a.v > 0).sort((x, y) => y.v - x.v).slice(0, this.KM);
      for (const a of acts) out.push({ kind: 'dev', a, v: a.v, key: devKey(p, a) });
    }
    out.push({ kind: 'next', key: 'next', v: 0 });
    return out;
  }
  apply(g2, p2, o) { // returns false if the option could not be applied
    if (o.kind === 'dev') { p2.ai.exec(g2, p2, o.a); return true; }
    if (o.kind === 'atk') { p2.ai.preAttack(g2, p2, o.a, o.t); if (g2.alive(o.a) && g2.canAttackThisTurn(o.a) && (o.t === 'player' || g2.alive(o.t))) g2.attack(o.a, o.t); return true; }
    return true;
  }
  value(g2, p2) { if (g2.winner !== null) return g2.winner === p2.i ? 1 : 0; if (this.vf) return this.vf.prob(g2, p2); const e = this.evaluate(g2, p2); return 1 / (1 + Math.exp(-e / this.scale)); }
  // run UCT from the real state (g, p) in phase ph; returns the key of the chosen root option
  search(g, p, ph) {
    const root = { N: 0, W: 0, ch: new Map() };
    for (let it = 0; it < this.I; it++) {
      const g2 = this.makeClone(g, p, this.M ? (it % this.M) + 1 : ++this.ctr); const p2 = g2.players[p.i]; let node = root, phase = ph; const path = [root];
      for (let depth = 0; depth < 40 && g2.winner === null && phase !== 'end'; depth++) {
        const opts = this.options(p2.ai, g2, p2, phase); if (!opts.length) break;
        let pick = null, expand = false;
        for (const o of opts) if (!node.ch.has(o.key)) { pick = o; expand = true; break; } // untried, in heuristic order
        if (!pick) { let tot = 0; for (const o of opts) tot += node.ch.get(o.key).N; const lt = Math.log(Math.max(1, tot)); let bv = -Infinity;
          for (const o of opts) { const c = node.ch.get(o.key); const u = c.W / c.N + this.C * Math.sqrt(lt / c.N); if (u > bv) { bv = u; pick = o; } } }
        let child = node.ch.get(pick.key); if (!child) { child = { N: 0, W: 0, ch: new Map() }; node.ch.set(pick.key, child); }
        if (pick.kind === 'next') phase = NEXT[phase]; else this.apply(g2, p2, pick);
        node = child; path.push(node); if (expand) break;
      }
      if (g2.winner === null) this.finishTurn(g2, p2, phase === 'end' ? 'done' : phase);
      const v = this.value(g2, p2); for (const n of path) { n.N++; n.W += v; }
    }
    let best = null, bn = -1; for (const [k, c] of root.ch) if (c.N > bn || (c.N === bn && c.W / c.N > best.W / best.N)) { bn = c.N; best = c; best.key = k; }
    return best ? best.key : 'next';
  }
  decide(g, p, ph) { // real-state decision: the chosen option object (or the 'next' option)
    const opts = this.options(this, g, p, ph); if (!opts.length) return null;
    if (opts.length === 1) return opts[0];
    const key = this.search(g, p, ph); return opts.find(o => o.key === key) || opts[opts.length - 1];
  }
  develop(g, p, stage) {
    if (!this.searching) return AI.prototype.develop.call(this, g, p, stage);
    for (let guard = 0; guard < 25 && g.winner === null; guard++) { const o = this.decide(g, p, stage); if (!o || o.kind === 'next') return; this.exec(g, p, o.a); }
  }
  attackPhase(g, p) {
    if (!this.searching) return AI.prototype.attackPhase.call(this, g, p);
    for (let guard = 0; guard < 20 && g.winner === null; guard++) {
      const o = this.decide(g, p, 'attack'); if (!o || o.kind === 'next') return;
      this.preAttack(g, p, o.a, o.t); if (!g.alive(o.a) || !g.canAttackThisTurn(o.a)) continue; if (o.t !== 'player' && !g.alive(o.t)) continue;
      g.attack(o.a, o.t);
    }
  }
}
// factory used by sim.js: sopts null -> heuristic AI; {mcts:true,...} -> MCTSAI; otherwise SearchAI
function makeAI(params, sopts) { if (!sopts) return new AI(params); return sopts.mcts ? new MCTSAI(params, sopts) : new SearchAI(params, sopts); }
module.exports = { SearchAI, MCTSAI, makeAI };
