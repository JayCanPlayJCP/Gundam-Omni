'use strict';
// Search AI: determinized Monte Carlo lookahead over the heuristic policy.
// At each development step and each attack choice it takes the top-K heuristic options plus "stop",
// plays each out N times on a cloned game (opponent hand/deck/shields resampled from their own cards;
// our deck/shields resampled; our hand known), through the rest of our turn and the opponent's next turn,
// then picks the option with the best average evaluation.
const { AI } = require('./ai'); const { shuffle } = require('./engine'); const EFX = require('./effects');

class SearchAI extends AI {
  constructor(params = {}, sopts = {}) { super(params); this.K = sopts.K || 3; this.N = sopts.N || 4; this.searching = true; }
  life(g, p) { return p.shields.length + (p.base ? Math.max(0, p.base.def.hp - p.base.dmg) / 3 : 0); }
  evaluate(g, me) {
    if (g.winner !== null) return g.winner === me.i ? 1000 : -1000;
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
  makeClone(g, p) {
    const myP = this.p, opP = (p.opp.ai && p.opp.ai.p) || {};
    const g2 = g.clone(i => new AI(i === p.i ? myP : opP)); this.determinize(g2, p.i); return g2;
  }
  finishTurn(g2, me, stage) {
    // continue our turn with the heuristic, then the opponent's whole turn
    const ai = me.ai;
    if (g2.winner === null && stage === 'pre') { ai.develop(g2, me, 'pre'); }
    if (g2.winner === null && (stage === 'pre' || stage === 'attack')) ai.attackPhase(g2, me);
    if (g2.winner === null && stage !== 'done') ai.develop(g2, me, 'post');
    if (g2.winner === null) g2.endPhase(me);
    if (g2.winner === null) { g2.turn++; g2.turnPlayer = me.opp; g2.takeTurn(me.opp); g2.turnPlayer = me; }
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
          const g2 = this.makeClone(g, p); const p2 = g2.players[p.i];
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
          const g2 = this.makeClone(g, p); const p2 = g2.players[p.i];
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
module.exports = { SearchAI };
