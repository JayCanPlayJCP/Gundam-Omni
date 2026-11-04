'use strict';
// Purple cards, batch 2 (written from the official English text in cards.json; 1v1: "enemy players" = 1 opponent).
// NOTES
//  Skipped: none. Simplified: none (117 cards, all 'full'). Rules readings are recorded in `note`s: GD05-059 ("If you do" covers the
//  draw and <High-Maneuver>), GD05-054 (also triggers on itself), GD03-053 (once-per-turn used only with a target), ST11-006
//  (Breach counts as effect damage), ST07-015 (battle + Breach damage), GD02-064 (enemy Command = g.curCmd).
//  Engine/AI hooks added for this file (all optional, default = old behaviour):
//   engine: effDamaged -> onEffectDamaged / p_onEffectDamaged / onAllyEffectDamaged (unit+base); reduceEffectDmg 4th arg
//     `real`; u.destroyCause; bdrExtra (pilot p_battleDestroyRule + granted u.flags.bdr); granted u.flags.onKill (attacker
//     and defender side); granted u.flags.redB in reduceBattleDmg; shield-area reduceShieldDmg (base) / p.flags.shieldRed
//     for effect and Breach damage (Breach now passes {breach:true, src}); onDestroyShieldArea; g.curCmd {c,p} while a
//     Command's Burst resolves.
//   ai: fight() consults g.bdrExtra and u.flags.redB (preview); permActive(g,t,attacker); castCommand sets g.curCmd.
//  Granted per-unit effects (redB / bdr / onKill) are kept as lists u.flags.<key>s of {f, live} with one dispatcher in
//  u.flags.<key>; live() expires them (this turn / this battle), so nothing has to be cleared by the engine.
//  "Deploy ... from your trash": deployFT() marks p.flags.ftDeploy while the Unit's 【Deploy】 resolves (isFT(u)).
//  Trash-only Lv/cost modifiers: trashLvMod / trashCostMod (Farsia, Legend Gundam), read by tLv()/tCost().
//  Wished-for hooks:
//   - ai_whenPaired / ai_whenLinked receive no pilot def ("Purple Pilot" / "(X-Rounder) Pilot" conditions are guessed
//     from the hand in the AI hints only; the effects themselves check the real pilot).
//   - Commands resolved outside castCommand / Burst (e.g. Special Moves run from other effects) do not set g.curCmd.
//   - AI attacker-side use of Action Commands (only battlePump is used on attack): defensive Commands here are used by
//     the defender in the action step, Main/Action pumps from the main phase or on defence.
module.exports = function (F, H, EFX) {
  const { CARDS, TOKEN } = require('./engine');
  const { tr, yourTurn, cmd, baseShield, dmgPick, restPick, destroyPick, apDownPick, lookTop } = H;

  // ======================= local helpers =======================
  const toHand = (g, p, c) => { p.hand.push(c); g.stats.p[p.i].extraCards++; };
  const fromTrash = (p, c) => { const i = p.trash.lastIndexOf(c); if (i < 0) return false; p.trash.splice(i, 1); return true; };
  const pilotCard = (pl) => (pl && pl.cmdPilot) ? CARDS[pl.id] : pl;
  const ptr = (u, t) => !!(u && u.pilot && (u.pilot.traits || []).includes(t));
  const pdHas = (pd, t) => !!pd && (pd.traits || []).includes(t);
  const pdColor = (pd) => (CARDS[pd.id] || pd).color;
  const pilotIn = (p, t) => p.units.some(x => ptr(x, t));
  const onceT = (g, u, k) => { const key = 'o_' + k; if (u.flags[key] === g.turn) return false; u.flags[key] = g.turn; return true; }; // 【Once per Turn】
  const usedT = (g, u, k) => u.flags['o_' + k] === g.turn;
  const isU = (c, ...ts) => c.type === 'UNIT' && (!ts.length || ts.some(t => c.traits.includes(t)));
  const hasT = (c, ...ts) => ts.some(t => c.traits.includes(t));
  const nTrash = (p, f) => { let n = 0; for (const c of p.trash) if (f(c)) n++; return n; };
  const zeonU = (p) => nTrash(p, c => isU(c, 'Zeon'));
  const tekTei = (g, x) => tr(g, x, 'Tekkadan') || tr(g, x, 'Teiwaz');
  const setActiveRes = (p, n) => { p.resRested = Math.max(0, p.resRested - n); };
  const mill = (p, n) => { const top = p.deck.splice(0, n); p.trash.push(...top); return top; };
  const handHas = (p, f) => p.hand.some(f);
  const pilotLikeIn = (p, f) => handHas(p, c => (c.type === 'PILOT' || (c.type === 'COMMAND' && EFX[c.id] && EFX[c.id].pilotName)) && f(c));
  function exileN(g, p, n, pred) { if (nTrash(p, pred) < n) return false; for (let k = 0; k < n; k++) { const c = p.ai.pickWorstCard(g, p, p.trash.filter(pred)); fromTrash(p, c); p.exile.push(c); } return true; }
  function fetch(g, p, pred) { const c = p.trash.filter(pred); if (!c.length) return null; const x = p.ai.pickBestCard(g, p, c); fromTrash(p, x); toHand(g, p, x); return x; }
  function pHit(p, n, pred) { const N = p.deck.length; if (!N) return 0; let K = 0; for (const c of p.deck) if (pred(c)) K++; let q = 1; for (let i = 0; i < Math.min(n, N); i++) q *= Math.max(0, N - K - i) / (N - i); return 1 - q; }
  // "look at the top 2 cards of your deck and return 1 to the top. Place the remaining card into your trash."
  function top2Keep1(g, p) { const top = p.deck.splice(0, 2); if (!top.length) return; const keep = p.ai.pickBestCard(g, p, top); top.splice(top.indexOf(keep), 1); p.deck.unshift(keep); p.trash.push(...top); }
  const maxRemoval = (g, p, f, kind) => { let v = 0; for (const x of p.opp.units) if (!f || f(x)) v = Math.max(v, p.ai.removalValue(g, p, x, kind || 'destroy')); return v; };

  // ---- trash Lv/cost modifiers and deploying from the trash ----
  const tLv = (g, p, c) => c.lv + ((EFX[c.id] && EFX[c.id].trashLvMod) ? EFX[c.id].trashLvMod(g, p) : 0);
  const tCost = (g, p, c) => Math.max(0, c.cost + ((EFX[c.id] && EFX[c.id].trashCostMod) ? EFX[c.id].trashCostMod(g, p) : 0));
  const isFT = (u) => u.owner.flags.ftDeploy === u.def; // "If you deploy this Unit from your trash" (read inside 【Deploy】)
  function deployFT(g, p, c, opts = {}) { // opts.pay: "Pay its cost to deploy it"; opts.rested
    if (!p.trash.includes(c)) return null; const cost = opts.pay ? tCost(g, p, c) : 0; if (g.avail(p) < cost) return null;
    if (cost) g.pay(p, cost); fromTrash(p, c);
    const prev = p.flags.ftDeploy; p.flags.ftDeploy = c; let u = null;
    try { u = g.deployUnit(p, c, { rested: !!opts.rested }); } finally { p.flags.ftDeploy = prev; }
    return u;
  }
  const ftVal = (g, p, c) => { const e = EFX[c.id]; return 1.0 + 0.45 * (c.ap + c.hp) + c.lv * 0.12 + (c.skw.Blocker ? 0.6 : 0) + p.ai.deployBonus(g, p, c) + ((e && e.ai_fromTrash) ? e.ai_fromTrash(g, p) : 0); };
  function trashPick(g, p, pred, budget) { // best Unit card in the trash with pred(c, trashLv), affordable within budget (undefined = free)
    let best = null, bv = -Infinity;
    for (const c of p.trash) { if (c.type !== 'UNIT' || !pred(c, tLv(g, p, c))) continue; if (budget !== undefined && tCost(g, p, c) > budget) continue; const v = ftVal(g, p, c); if (v > bv) { bv = v; best = c; } }
    return best;
  }
  // "You may choose 1 <pred> Unit card from your trash. Pay its cost to deploy it." (AI: best affordable, board room)
  function mayPayDeploy(g, p, pred, minV) { if (p.units.length >= 6) return null; const c = trashPick(g, p, pred, g.avail(p)); if (!c || ftVal(g, p, c) < (minV ?? 1.5)) return null; return deployFT(g, p, c, { pay: true }); }
  const payDeployVal = (g, p, pred, budget) => { if (p.units.length >= 6) return 0; const c = trashPick(g, p, pred, budget ?? g.avail(p)); return c ? Math.max(0, ftVal(g, p, c) - 0.4 * tCost(g, p, c)) : 0; };

  // ---- damage to own Units (Tekkadan style) ----
  const DMGB = { 'ST05-001': 0.9, 'GD02-054': 0.8 }; // first damage enables Suppression / the attack draw
  function effTrigVal(g, p, x) { // value of the "receives effect damage" reactions a ping on own Unit x causes
    let v = 0; const my = yourTurn(g, p);
    if (my && x.def.id === 'GD03-060' && !usedT(g, x, 'cgs') && p.units.length < 6) v += 1.0;
    if (my && tekTei(g, x)) {
      if (p.units.some(f => f.def.id === 'GD03-053' && f.pilot && !usedT(g, f, 'fc'))) v += 0.7 * p.ai.restScore(g, p, t => t.def.lv <= 4);
      if (p.base && p.base.def.id === 'GD03-129' && !p.base.rested && p.deck.length > 8) v += 0.25;
    }
    if (x.pilot && x.pilot.id === 'GD03-095' && !usedT(g, x, 'azee') && p.opp.units.length) v += 0.35;
    return v;
  }
  function pumpGain(g, p, x, plus, selfDmg) { // x attacks this turn with +plus AP after taking selfDmg: newly enabled kill / pressure
    selfDmg = selfDmg || 0; const ts = p.opp.units.filter(t => t.rested); const f0 = ts.map(t => p.ai.fight(g, x, t, true)); const ap0 = g.ap(x);
    let best = 0; x.tAP += plus; x.dmg += selfDmg;
    try { best = 0.12 * (g.ap(x) - ap0); for (let i = 0; i < ts.length; i++) { const f1 = p.ai.fight(g, x, ts[i], true); if (f1.killT && !f0[i].killT && !f1.killA) best = Math.max(best, 0.7 * p.ai.unitValue(g, ts[i])); } }
    finally { x.tAP -= plus; x.dmg -= selfDmg; }
    return best;
  }
  function pingVal(g, p, x, n, apPlus) { // value of dealing n effect damage to own Unit x (and giving it AP+apPlus this turn)
    if (!g.alive(x)) return -9; const left = g.hpLeft(x) - n;
    if (left <= 0) return -p.ai.unitValue(g, x) + p.ai.deathValue(g, x) + 0.5 * effTrigVal(g, p, x);
    let v = -0.15 * n + effTrigVal(g, p, x);
    const atk = yourTurn(g, p) && g.canAttackThisTurn(x);
    if (x.dmg === 0 && DMGB[x.def.id] && atk) v += DMGB[x.def.id];
    if (x.def.id === 'GD03-061' && left === 1) v += 0.5;
    if (atk) v += pumpGain(g, p, x, apPlus || 0, n);
    return v;
  }
  function pickPing(g, p, cands, n, apPlus) { let best = null, bv = -Infinity; for (const x of cands) { if (!g.alive(x)) continue; const v = pingVal(g, p, x, n, apPlus); if (v > bv) { bv = v; best = x; } } return best ? { x: best, v: bv } : null; }
  const pingOwn = (g, p, x, n) => { if (!g.alive(x)) return false; const d0 = x.dmg; const k = g.effectDamage(p, x, n); return k || x.dmg > d0; }; // true = damage dealt
  // change of the current battle for attacker u if it gets AP+plus and takes selfDmg now (attack step heuristics)
  function battleDelta(g, p, u, b, plus, selfDmg) {
    if (selfDmg && g.hpLeft(u) <= selfDmg) return -p.ai.unitValue(g, u);
    let v = -0.15 * selfDmg + (selfDmg ? effTrigVal(g, p, u) : 0); const t = b && b.target;
    if (t && t !== 'player' && g.alive(t)) {
      const f0 = p.ai.fight(g, u, t, true); u.tAP += plus; u.dmg += selfDmg; let f1; try { f1 = p.ai.fight(g, u, t, true); } finally { u.tAP -= plus; u.dmg -= selfDmg; }
      const vt = p.ai.unitValue(g, t), vu = p.ai.unitValue(g, u);
      v += (f1.killT && !f0.killT ? vt : 0) - (f0.killT && !f1.killT ? vt : 0) - (f1.killA && !f0.killA ? vu : 0) + (f0.killA && !f1.killA ? vu : 0);
    } else if (t === 'player' && plus) { const D = p.opp; if (D.base) { const left = D.base.def.hp - D.base.dmg, ap = g.ap(u); v += (ap < left && ap + plus >= left) ? 1.2 : 0.05 * plus; } }
    return v;
  }

  // ---- granted effects with a duration (this turn / this battle) ----
  const liveTurn = (T) => (g) => g.turn === T;
  const liveBattle = (b) => (g) => g.inBattle === b;
  const DISPATCH = {
    redB: (g, v, n, src, pv) => { for (const e of v.flags.redBs || []) if (e.live(g)) n = e.f(g, v, n, src, pv); return n; },
    bdr: (g, s, victim) => (s.flags.bdrs || []).some(e => e.live(g) && e.f(g, s, victim)),
    onKill: (g, u, victim) => { for (const e of [...(u.flags.onKills || [])]) if (e.live(g) && g.alive(u)) e.f(g, u, victim); },
  };
  const COMBINE = { // keep a hook another file already installed in the same flag (it is chained, never replaced)
    redB: (prev, d) => (g, v, n, src, pv) => d(g, v, prev(g, v, n, src, pv), src, pv),
    bdr: (prev, d) => (g, s, victim) => !!prev(g, s, victim) || d(g, s, victim),
    onKill: (prev, d) => (g, u, victim) => { prev(g, u, victim); d(g, u, victim); },
  };
  function grant(g, u, key, f, live) {
    const L = (u.flags[key + 's'] || []).filter(e => e.live(g)); L.push({ f, live }); u.flags[key + 's'] = L;
    if (!u.flags[key + 'In']) { const cur = u.flags[key]; u.flags[key] = cur ? COMBINE[key](cur, DISPATCH[key]) : DISPATCH[key]; u.flags[key + 'In'] = true; } // dispatcher installed once per Unit
  }
  const redBy = (k, cond) => (g, v, n, src) => (src && src.owner !== v.owner && (!cond || cond(g, v, src))) ? Math.max(0, n - k) : n; // "when it receives enemy battle damage, reduce it by k"
  function redSave(g, p, b, k, ownF) { // value of "my battling Unit: reduce enemy battle damage by k this battle"
    const t = b && b.target; if (!t || t === 'player' || !g.alive(t) || t.owner !== p || (ownF && !ownF(g, t)) || !g.alive(b.attacker)) return 0;
    const a = b.attacker; const f0 = p.ai.fight(g, a, t, true); if (!f0.killT) return 0;
    const L = t.flags.redBs, R = t.flags.redB; let f1;
    const In = t.flags.redBIn; try { grant(g, t, 'redB', redBy(k), liveBattle(b)); f1 = p.ai.fight(g, a, t, true); } finally { t.flags.redBs = L; t.flags.redB = R; t.flags.redBIn = In; if (!R) delete t.flags.redB; if (!L) delete t.flags.redBs; if (!In) delete t.flags.redBIn; }
    return f1.killT ? 0 : p.ai.unitValue(g, t) + (f1.killA ? 0.5 * p.ai.unitValue(g, a) : 0.2);
  }
  const chainNbd = (u, f) => { const old = u.flags.nbd; u.flags.nbd = old ? (g, v, s, b) => old(g, v, s, b) || f(g, v, s, b) : f; };

  // ---- destroying own Units ----
  function sacCost(g, p, x, srcDef) {
    let c = p.ai.unitValue(g, x) - p.ai.deathValue(g, x);
    if (x.def.id === 'GD05-053' && srcDef && srcDef.traits.includes('Neo Zeon')) c = 0.8; // returns to hand
    if (p.units.some(a => a !== x && a.def.id === 'GD05-054' && !usedT(g, a, 'aa'))) c -= 1.2; // Alpha Azieru draws
    if (srcDef && srcDef.traits.includes('Neo Zeon') && axisReady(g, p)) c -= 1.0; // unlocks GD05-129 Axis
    return c;
  }
  function sacPick(g, p, cands, srcDef) { let best = null, bv = Infinity; for (const x of cands) { const v = sacCost(g, p, x, srcDef); if (v < bv) { bv = v; best = x; } } return best ? { x: best, v: bv } : null; }
  // destroy own Unit x with an effect of card srcDef; records "a Unit was destroyed by your (Neo Zeon) card's effect this turn"
  // (GD05-129 Axis). Every Neo Zeon card that destroys its owner's Units (GD05-049/052/057) goes through here.
  const killOwn = (g, p, x, srcDef) => { if (!g.alive(x)) return; if (srcDef && srcDef.traits.includes('Neo Zeon')) p.flags.nzKillT = g.turn; g.destroy(x, { effect: true, by: p, src: srcDef }); };
  const axisLow = (g, p) => p.hand.filter(c => isU(c, 'Neo Zeon') && g.effLv(p, c) <= 3);
  const axisReady = (g, p) => !!p.base && p.base.def.id === 'GD05-129' && !p.base.rested && p.flags.nzKillT !== g.turn && yourTurn(g, p) && axisLow(g, p).length > 0 && p.units.length < 6;

  // ---- 【Action】Choose 1 rested friendly (T) Unit. Change the battling enemy Unit's attack target to it. ----
  const takeHit = (g, p, a, x) => { const f = p.ai.fight(g, a, x, true); return (f.killA ? p.ai.unitValue(g, a) : 0) - (f.killT ? p.ai.unitValue(g, x) - p.ai.deathValue(g, x) : 0); };
  function changeTargetCmd(trait, extra) {
    const cands = (g, p, b) => p.units.filter(x => x.rested && x !== b.target && tr(g, x, trait));
    const best = (g, p, b) => cands(g, p, b).reduce((m, y) => (!m || takeHit(g, p, b.attacker, y) > takeHit(g, p, b.attacker, m)) ? y : m, null);
    return cmd(Object.assign({ actionOnly: true, canMain: () => false, main() {},
      defAction: {
        can: (g, p, b) => !!b && g.alive(b.attacker) && b.attacker.owner !== p && cands(g, p, b).length > 0,
        value: (g, p, b, threat) => threat + takeHit(g, p, b.attacker, best(g, p, b)),
        run(g, p, b) { const x = best(g, p, b); if (!x) return; if (b.blocked && b.target !== 'player') b.origBlocker = b.target; b.target = x; } } }, extra || {}));
  }

  // ---- 【Main】/【Action】Choose 1 <own> Unit and 1 enemy Unit <enF>. Deal n damage to them. ----
  function ownEnemyCmd(n, ownF, enF, extra) {
    const own = (g, p, b) => { const c = p.units.filter(x => !ownF || ownF(g, x)); const nb = b ? c.filter(x => x !== b.target) : c; return nb.length ? nb : c; };
    const ef = enF ? (g) => (x) => enF(g, x) : () => null;
    const enC = (g, p) => p.opp.units.filter(x => !enF || enF(g, x));
    const run = (g, p, t, b) => { const o = pickPing(g, p, own(g, p, b), n, 0); if (o) pingOwn(g, p, o.x, n); if (t && g.alive(t)) g.effectDamage(p, t, n); else dmgPick(g, p, n, ef(g)); };
    const killsA = (g, p, b) => { const a = b.attacker; return g.alive(a) && (!enF || enF(g, a)) && p.ai.effPreview(g, p, a, n) >= g.hpLeft(a); };
    return cmd(Object.assign({ actionToo: true,
      canMain: (g, p) => enC(g, p).length > 0,
      main(g, p) { run(g, p, null, null); },
      score: (g, p) => { const o = pickPing(g, p, own(g, p, null), n, 0); return p.ai.bestDamageValue(g, p, n, ef(g)) + (o ? o.v : 0) - 0.9; },
      defAction: {
        can: (g, p, b) => !!b && g.alive(b.attacker) && enC(g, p).length > 0,
        value(g, p, b, threat) { const o = pickPing(g, p, own(g, p, b), n, 0); const ov = o ? o.v : 0;
          if (killsA(g, p, b)) return p.ai.removalValue(g, p, b.attacker, 'destroy') + threat * 0.7 + ov;
          return p.ai.bestDamageValue(g, p, n, ef(g)) * 0.8 + ov - 0.3; },
        run(g, p, b) { run(g, p, killsA(g, p, b) ? b.attacker : null, b); } } }, extra || {}));
  }

  // ---- 【Main】/【Action】Choose 1 <own> Unit. (Deal selfDmg damage to it.) It gets AP+plus during this turn. ----
  function pumpCmd(plus, selfDmg, ownF, extra) {
    const own = (g, p) => p.units.filter(x => !ownF || ownF(g, x));
    const val = (g, p, x) => selfDmg ? pingVal(g, p, x, selfDmg, plus) : ((yourTurn(g, p) && g.canAttackThisTurn(x)) ? pumpGain(g, p, x, plus, 0) : 0);
    const best = (g, p) => { let r = null, bv = -Infinity; for (const x of own(g, p)) { const v = val(g, p, x); if (v > bv) { bv = v; r = x; } } return r ? { x: r, v: bv } : null; };
    const apply = (g, p, x) => { if (selfDmg) pingOwn(g, p, x, selfDmg); if (g.alive(x)) x.tAP += plus; };
    const defGain = (g, p, b) => { // my battling Unit now destroys the attacker without newly being destroyed
      const t = b && b.target; if (!t || t === 'player' || !g.alive(t) || t.owner !== p || (ownF && !ownF(g, t)) || !g.alive(b.attacker)) return 0;
      if (selfDmg && g.hpLeft(t) <= selfDmg) return 0; const a = b.attacker; const f0 = p.ai.fight(g, a, t, true);
      t.tAP += plus; t.dmg += selfDmg; let f1; try { f1 = p.ai.fight(g, a, t, true); } finally { t.tAP -= plus; t.dmg -= selfDmg; }
      if (!f1.killA || f0.killA || (f1.killT && !f0.killT)) return 0; return p.ai.unitValue(g, a) + 0.2 + (selfDmg ? effTrigVal(g, p, t) : 0); };
    return cmd(Object.assign({ actionToo: true,
      canMain: (g, p) => own(g, p).some(x => g.canAttackThisTurn(x)),
      main(g, p) { const r = best(g, p); if (r) apply(g, p, r.x); },
      score: (g, p) => { const r = best(g, p); return r ? r.v - 0.7 : -1; },
      defAction: { can: (g, p, b) => defGain(g, p, b) > 0, value: (g, p, b) => defGain(g, p, b), run(g, p, b) { if (b.target !== 'player' && g.alive(b.target)) apply(g, p, b.target); } } }, extra || {}));
  }

  // ======================= GD02 =======================
  // Gundam X: printed "[Suppression]" (square brackets in the card data, so the engine's <..> parser misses it).
  F('GD02-053', 'full', { note: 'printed [Suppression] is granted by kw()', kw: (g, u, k) => k === 'Suppression' ? 1 : 0,
    aura_ap: (g, src, u) => (src.linked && yourTurn(g, src.owner) && src.owner.trash.length >= 7 && tr(g, u, 'Vulture')) ? 2 : 0 });
  F('GD02-056', 'full', { destroyed(g, u, pilot) { if (!pdHas(pilot, 'Vulture')) return; const p = u.owner; fetch(g, p, c => isU(c, 'Vulture') && tLv(g, p, c) >= 5); } });
  F('GD02-057', 'full', { attack(g, u) {
    if (!u.pilot) return; const p = u.owner; const f = x => x.def.lv <= 4; const own = p.units.filter(x => x !== u); if (!own.length || !p.opp.units.some(f)) return;
    const s = sacPick(g, p, own, CARDS['GD02-057']); if (!s || s.v >= p.ai.bestDamageValue(g, p, 2, f) - 0.3) return;
    killOwn(g, p, s.x, CARDS['GD02-057']); dmgPick(g, p, 2, f); } });
  F('GD02-058', 'full', { deploy(g, u) { const p = u.owner; const r = pickPing(g, p, p.units, 1, 0); if (r && pingOwn(g, p, r.x, 1)) { g.draw(p, 1); g.discard(p, 1); } },
    ai_deploy: (g, p) => { const r = pickPing(g, p, p.units, 1, 0); return Math.max(r ? r.v : -0.15, -0.15) + 0.4; } });
  const teiTekTrash = (p) => nTrash(p, c => hasT(c, 'Teiwaz', 'Tekkadan'));
  F('GD02-061', 'full', { whenPaired(g, u, pd) { if (pdColor(pd) !== 'Purple') return; const p = u.owner; if (teiTekTrash(p) >= 3) restPick(g, p, x => g.ap(x) <= 3); },
    ai_whenPaired: (g, p) => (teiTekTrash(p) >= 3 && pilotLikeIn(p, c => c.color === 'Purple')) ? p.ai.restScore(g, p, x => g.ap(x) <= 3) : 0 });
  F('GD02-064', 'full', { note: 'enemy Command = g.curCmd (set by ai.castCommand and Command Bursts); AI previews on its owner\'s turn assume a Command',
    reduceEffectDmg: (g, u, d, real) => (yourTurn(g, u.owner) && u.owner.trash.length >= 7 && (!real || (g.curCmd && g.curCmd.p !== u.owner))) ? 0 : d });
  F('GD02-068', 'full', { deploy(g, u) { pingOwn(g, u.owner, u, 2); }, ai_deploy: (g, p) => -0.9 + (yourTurn(g, p) && p.units.some(f => f.def.id === 'GD03-053' && f.pilot && !usedT(g, f, 'fc')) ? 0.7 * p.ai.restScore(g, p, t => t.def.lv <= 4) : 0) });
  F('GD02-094', 'full', { p_whenPaired(g, u) {
    const p = u.owner; if (!p.hand.length || !p.deck.length) return; const pred = c => isU(c, 'Vulture');
    const w = p.ai.pickWorstCard(g, p, p.hand); if (p.ai.cardValue(g, p, w) > 1.2 + 3.0 * pHit(p, 3, pred)) return;
    p.hand.splice(p.hand.indexOf(w), 1); p.trash.push(w); lookTop(g, p, 3, pred); }, ai_whenPaired: () => 0.3 });
  F('GD02-095', 'full', { p_attack(g, u) { if (u.dmg > 0 && u.def.lv <= 5) u.bKw['High-Maneuver'] = 1; } });
  F('GD02-096', 'full', { p_whenLinked(g, u) { const p = u.owner; mayPayDeploy(g, p, (c, lv) => c.traits.includes('Vagan') && lv <= 2, 1.2); },
    ai_whenLinked: (g, p) => 0.7 * payDeployVal(g, p, (c, lv) => c.traits.includes('Vagan') && lv <= 2, g.avail(p) - 1) });
  const awP = (c, lv) => lv <= 5;
  F('GD02-110', 'full', cmd({ canMain: (g, p) => p.units.length < 6 && !!trashPick(g, p, awP, g.avail(p) - g.costOf(p, CARDS['GD02-110'])),
    main(g, p) { const c = trashPick(g, p, awP, g.avail(p)); if (c && p.units.length < 6) deployFT(g, p, c, { pay: true }); },
    score: (g, p) => { const c = trashPick(g, p, awP, g.avail(p) - g.costOf(p, CARDS['GD02-110'])); return c ? ftVal(g, p, c) - 1.6 : -1; } }));
  const purpleU = c => c.type === 'UNIT' && c.color === 'Purple';
  F('GD02-111', 'full', cmd({ burst(g, p) { dmgPick(g, p, 2, x => x.def.lv <= 3); },
    canMain: (g, p) => p.opp.units.length > 0 && nTrash(p, purpleU) >= 6, main(g, p) { if (exileN(g, p, 6, purpleU)) destroyPick(g, p, null); },
    removal: { kind: 'destroy', f: (g, u) => nTrash(u.owner.opp, purpleU) >= 6 } }));
  const purpleP = c => c.type === 'PILOT' && c.color === 'Purple';
  F('GD02-112', 'full', cmd({ burst(g, p) { g.draw(p, 1); }, canMain: (g, p) => p.trash.some(purpleP), main(g, p) { fetch(g, p, purpleP); }, score: (g, p) => p.trash.some(purpleP) ? 0.8 : -1 }));
  F('GD02-114', 'full', pumpCmd(2, 0, (g, x) => x.dmg > 0, { pilotName: 'Norba Shino' }));
  F('GD02-127', 'full', baseShield({ baseDestroyed(g, p) { mill(p, 2); } }));
  F('GD02-128', 'full', baseShield({ baseDeploy(g, p) { if (yourTurn(g, p) && p.units.some(x => x.linked && tr(g, x, 'Teiwaz'))) destroyPick(g, p, x => g.ap(x) <= 2); } }));

  // ======================= GD03 =======================
  F('GD03-049', 'full', { onDestroyShieldArea(g, u) {
    const p = u.owner; if (nTrash(p, c => c.traits.includes('CB')) < 10 || !p.opp.units.length) return;
    const m = Math.min(...p.opp.units.map(x => g.hpLeft(x))); destroyPick(g, p, x => g.hpLeft(x) === m); } });
  F('GD03-051', 'full', { whenLinked(g, u) { mayPayDeploy(g, u.owner, (c, lv) => lv <= 4); }, ai_whenLinked: (g, p) => 0.7 * payDeployVal(g, p, (c, lv) => lv <= 4, g.avail(p) - 1) });
  const support = (n) => ({ cost: 0, can: (g, p, u) => !u.rested && p.units.some(x => x !== u && g.canAttackThisTurn(x)),
    score: (g, p, u) => { if (g.canAttackThisTurn(u) && g.ap(u) >= 3) return -1; let s = -0.2; for (const a of p.units) { if (a === u || !g.canAttackThisTurn(a)) continue; for (const t of p.opp.units) if (t.rested && g.ap(a) < g.hpLeft(t) && g.ap(a) + n >= g.hpLeft(t)) s = Math.max(s, p.ai.unitValue(g, t) * 0.8); } return s; },
    run: (g, p, u) => { u.rested = true; let best = null, bv = -1; for (const a of p.units) { if (a === u || !g.canAttackThisTurn(a)) continue; let v = g.ap(a) * 0.05; for (const t of p.opp.units) if (t.rested && g.ap(a) < g.hpLeft(t) && g.ap(a) + n >= g.hpLeft(t)) v = Math.max(v, p.ai.unitValue(g, t)); if (v > bv) { bv = v; best = a; } } if (best) best.tAP += n; } });
  F('GD03-052', 'full', { activate: support(2), battleDestroyRule: (g, src, v) => v.owner !== src.owner && v.def.lv <= 5 && pilotIn(src.owner, 'CB') });
  const fcTrig = (g, self, x) => { if (!self.pilot || !yourTurn(g, self.owner) || !tekTei(g, x) || usedT(g, self, 'fc')) return; const p = self.owner;
    if (!p.opp.units.some(t => !t.rested && t.def.lv <= 4)) return; onceT(g, self, 'fc'); restPick(g, p, t => t.def.lv <= 4); };
  F('GD03-053', 'full', { note: 'once-per-turn is used only when there is an active enemy Lv<=4 Unit to rest', onEffectDamaged(g, u) { fcTrig(g, u, u); }, onAllyEffectDamaged(g, self, x) { fcTrig(g, self, x); } });
  const vaganC = c => c.traits.includes('Vagan');
  F('GD03-054', 'full', { whenPaired(g, u, pd) {
    if (!pdHas(pd, 'X-Rounder')) return; const p = u.owner; const f = x => x.def.lv <= 4; if (nTrash(p, vaganC) < 4 || maxRemoval(g, p, f) < 1.6) return;
    if (exileN(g, p, 4, vaganC)) destroyPick(g, p, f); },
    ai_whenPaired: (g, p) => (nTrash(p, vaganC) >= 4 && pilotLikeIn(p, c => c.traits.includes('X-Rounder'))) ? maxRemoval(g, p, x => x.def.lv <= 4) * 0.8 : 0 });
  F('GD03-055', 'full', { whenPaired(g, u, pd) { if (pdColor(pd) === 'Purple') destroyPick(g, u.owner, x => x.def.lv <= 2); },
    ai_whenPaired: (g, p) => pilotLikeIn(p, c => c.color === 'Purple') ? maxRemoval(g, p, x => x.def.lv <= 2) : 0 });
  F('GD03-058', 'full', { trashCostMod: () => -1 });
  F('GD03-059', 'full', { attack(g, u, b) {
    const p = u.owner; if (!p.trash.some(vaganC)) return; const vs = p.units.filter(x => tr(g, x, 'Vagan')); if (!vs.length) return;
    let best = null, bv = 0.25 + (p.units.some(x => x.def.id === 'GD03-054') || p.hand.some(c => c.id === 'GD03-054') ? 0.3 : 0);
    for (const x of vs) { const v = x === u ? battleDelta(g, p, u, b, 2, 0) : (g.canAttackThisTurn(x) ? pumpGain(g, p, x, 2, 0) : 0); if (v > bv) { bv = v; best = x; } }
    if (!best || !exileN(g, p, 1, vaganC)) return; best.tAP += 2; } });
  F('GD03-060', 'full', { onEffectDamaged(g, u) { if (yourTurn(g, u.owner) && onceT(g, u, 'cgs')) g.deployToken(u.owner, 'CGS Mobile Worker', { rested: true }); } });
  F('GD03-061', 'full', { kw: (g, u, k) => (k === 'Repair' && g.hpLeft(u) === 1) ? 3 : 0 });
  F('GD03-062', 'full', { deploy(g, u) { if (isFT(u)) dmgPick(g, u.owner, 2, x => g.ap(x) <= 4); }, ai_fromTrash: (g, p) => p.ai.bestDamageValue(g, p, 2, x => g.ap(x) <= 4) });
  F('GD03-064', 'full', { deploy(g, u) {
    const p = u.owner; const c = p.trash.filter(x => x.traits.includes('X-Rounder')); if (!c.length || !p.hand.length) return;
    const best = p.ai.pickBestCard(g, p, c); const worst = p.ai.pickWorstCard(g, p, p.hand); if (p.ai.cardValue(g, p, best) <= p.ai.cardValue(g, p, worst) + 0.2) return;
    fromTrash(p, best); toHand(g, p, best); g.discard(p, 1); }, ai_deploy: (g, p) => p.trash.some(x => x.traits.includes('X-Rounder')) && p.hand.length > 1 ? 0.4 : 0 });
  F('GD03-067', 'full', { deploy(g, u) { const p = u.owner; const r = pickPing(g, p, p.units, 1, 1); if (!r || r.v <= 0.05) return; pingOwn(g, p, r.x, 1); if (g.alive(r.x)) r.x.tAP += 1; },
    ai_deploy: (g, p) => { const r = pickPing(g, p, p.units, 1, 1); return r ? Math.max(0, r.v) : 0; } });
  F('GD03-068', 'full', { kw: (g, u, k) => (k === 'Blocker' && u.owner.base) ? 1 : 0 });
  F('GD03-094', 'full', { p_whenPaired(g, u) { const p = u.owner; const top = mill(p, 2); if (top.some(vaganC)) apDownPick(g, p, 2, null, null); }, ai_whenPaired: (g, p) => 0.2 + 0.5 * pHit(p, 2, vaganC) });
  F('GD03-095', 'full', { p_onEffectDamaged(g, u) { const p = u.owner; if (!p.opp.units.length || !onceT(g, u, 'azee')) return; apDownPick(g, p, 1, null, null); } });
  F('GD03-096', 'full', { p_attack(g, u) { if (!u.linked) return; const p = u.owner; if (!p.hand.length) return; const w = p.ai.pickWorstCard(g, p, p.hand);
    if (p.ai.cardValue(g, p, w) >= 2.3) return; p.hand.splice(p.hand.indexOf(w), 1); p.trash.push(w); g.draw(p, 1); } });
  F('GD03-097', 'full', { p_onBattleKill(g, u) { if (!u.linked || !yourTurn(g, u.owner) || !onceT(g, u, 'wist')) return; top2Keep1(g, u.owner); } });
  const lodF = (g, p) => { const lv = p.trash.length >= 10 ? 4 : 2; return x => !x.rested && x.def.lv <= lv; };
  F('GD03-114', 'full', cmd({ actionOnly: true, canMain: () => false, main() {}, burst(g, p) { destroyPick(g, p, lodF(g, p)); },
    defAction: { can: (g, p, b) => p.opp.units.some(lodF(g, p)), value: (g, p) => maxRemoval(g, p, lodF(g, p)) * 0.9, run(g, p) { destroyPick(g, p, lodF(g, p)); } } }));
  const drLim = (g, p) => g.level(p) >= 7 ? 5 : 2;
  F('GD03-115', 'full', cmd({ pilotName: "Yurin L'Ciel", actionOnly: true, canMain: () => false, main() {},
    defAction: {
      can(g, p, b) { const t = b.target; return t !== 'player' && g.alive(t) && t.owner === p && ptr(t, 'X-Rounder') && g.alive(b.attacker) && g.ap(b.attacker) <= drLim(g, p) && p.ai.fight(g, b.attacker, t, true).killT; },
      value: (g, p, b) => p.ai.unitValue(g, b.target) + (p.ai.fight(g, b.attacker, b.target, true).killA ? 0.5 : 0.2),
      run(g, p, b) { const t = b.target; if (t === 'player') return; const lim = drLim(g, p); chainNbd(t, (g2, v, src, bb) => bb === b && src.owner !== v.owner && g2.ap(src) <= lim); } } }));
  F('GD03-116', 'full', ownEnemyCmd(2, (g, x) => tr(g, x, 'Vagan'), null, { note: 'needs no friendly Vagan Unit to be cast (chooses what it can)' }));
  F('GD03-117', 'full', cmd({ canMain: (g, p) => p.opp.units.length > 0 && p.units.length < 6,
    main(g, p) { const n = p.opp.units.length; if (n >= 5) g.deployToken(p, 'Gundam Barbatos 4th Form'); else if (n >= 1) g.deployToken(p, 'Graze Custom'); },
    score: (g, p) => p.opp.units.length >= 5 ? 2.4 : 1.0 }));
  F('GD03-129', 'full', baseShield({ onAllyEffectDamaged(g, p, u) { if (!yourTurn(g, p) || !tekTei(g, u) || !p.base || p.base.rested || p.deck.length <= 8) return; p.base.rested = true; mill(p, 1); } }));
  F('GD03-130', 'full', baseShield({ baseDeploy(g, p) { if (yourTurn(g, p)) mayPayDeploy(g, p, (c, lv) => c.traits.includes('Vagan') && lv <= 4); } }));

  // ======================= GD04 =======================
  const vultC = c => c.traits.includes('Vulture');
  F('GD04-049', 'full', { attack(g, u, b) {
    if (!u.pilot || b.target !== 'player') return; const p = u.owner, o = p.opp; if (nTrash(p, vultC) < 7) return;
    const f = x => x.def.lv <= 8; const uv = maxRemoval(g, p, f);
    const bv = (o.base && (o.base.def.lv || 0) <= 8) ? 1.6 + (o.base.ex ? 0 : 0.5) + 0.1 * (o.base.def.hp - o.base.dmg) : 0;
    if (Math.max(uv, bv) < 2.0 || !exileN(g, p, 7, vultC)) return;
    if (bv >= uv) g.destroyBase(o); else destroyPick(g, p, f); } });
  const minervaU = (c, lv) => c.traits.includes('Minerva Squad');
  F('GD04-050', 'full', { attack(g, u) { if (u.pilot) mayPayDeploy(g, u.owner, minervaU, 2.0); } });
  const KWS = ['Blocker', 'Breach', 'Repair', 'High-Maneuver', 'First Strike', 'Suppression'];
  const hasKwE = (g, t) => KWS.some(k => g.kw(t, k) > 0) || /<Support \d+>/.test(t.def.text);
  F('GD04-051', 'full', { permActive: (g, t, a) => !!a && ptr(a, 'Vulture') && a.owner.trash.length >= 7 && hasKwE(g, t) });
  F('GD04-052', 'full', { attack(g, u, b) {
    if (!u.pilot) return; const p = u.owner; if (!p.opp.units.length || g.hpLeft(u) <= 2) return; const bt = b.target;
    const selfV = (tt) => { let v = -0.3 + effTrigVal(g, p, u); if (bt === 'player' || !g.alive(bt)) return v;
      const f0 = p.ai.fight(g, u, bt, true); u.dmg += 2; if (tt === bt) bt.dmg += 2; let f1; const dead = g.hpLeft(bt) <= 0;
      try { f1 = dead ? { killT: true, killA: false } : p.ai.fight(g, u, bt, true); } finally { u.dmg -= 2; if (tt === bt) bt.dmg -= 2; }
      if (f1.killA && !f0.killA) v -= p.ai.unitValue(g, u); if (f0.killA && !f1.killA) v += p.ai.unitValue(g, u);
      if (!dead && f1.killT && !f0.killT) v += p.ai.unitValue(g, bt); return v; };
    let best = null, bv = 0.5;
    for (const t of p.opp.units) { const v = p.ai.dmgTargetValue(g, p, t, 2) + selfV(t); if (v > bv) { bv = v; best = t; } }
    if (!best) return; g.effectDamage(p, best, 2); pingOwn(g, p, u, 2); } });
  F('GD04-053', 'full', { note: 'battle and effect damage; AI previews of effect damage do not use up the once-per-turn',
    reduceBattleDmg(g, u, n, src) { if (!u.linked || n <= 0 || src.owner === u.owner || !onceT(g, u, 'rey')) return n; return n - 1; },
    reduceEffectDmg(g, u, d, real) { if (!u.linked || d <= 0 || usedT(g, u, 'rey')) return d; if (real) onceT(g, u, 'rey'); return d - 1; } });
  F('GD04-054', 'full', { battleDestroyRule: (g, src, v) => v.owner !== src.owner });
  F('GD04-056', 'full', { deploy(g, u) { if (pingOwn(g, u.owner, u, 1)) restPick(g, u.owner, x => g.ap(x) <= 3); }, ai_deploy: (g, p) => p.ai.restScore(g, p, x => g.ap(x) <= 3) - 0.2 });
  const virtueN = (p) => nTrash(p, c => c.type === 'UNIT' && c.name.includes('Gundam Virtue'));
  F('GD04-057', 'full', { deploy(g, u) { const p = u.owner; const n = virtueN(p); if (n > 0) apDownPick(g, p, n, x => x.def.lv <= 6, null); }, ai_deploy: (g, p) => virtueN(p) ? 0.3 * Math.min(3, virtueN(p)) : 0 });
  F('GD04-058', 'full', { destroyed(g, u, pilot) { if (!pdHas(pilot, 'Vulture') || !yourTurn(g, u.owner)) return; const pd = pilotCard(pilot); if (fromTrash(u.owner, pd)) toHand(g, u.owner, pd); } });
  F('GD04-060', 'full', { deploy(g, u) { if (isFT(u)) g.draw(u.owner, 1); }, ai_fromTrash: () => 1.3 });
  F('GD04-061', 'full', { cannotAttack: (g, u) => u.owner.trash.length <= 6 });
  const gnaF = (g) => x => (x.def.lv || 0) <= 1 || g.ap(x) <= 1;
  F('GD04-063', 'full', { deploy(g, u) { destroyPick(g, u.owner, gnaF(g)); }, ai_deploy: (g, p) => maxRemoval(g, p, gnaF(g)) });
  F('GD04-093', 'full', { p_whenLinked(g, u) { const p = u.owner; const c = p.units.filter(x => x.linked && tr(g, x, 'ZAFT')); if (!c.length) return;
    const t = c.reduce((m, x) => ((g.canAttackThisTurn(x) ? 2 : 0) + p.ai.unitValue(g, x) * 0.1) > ((g.canAttackThisTurn(m) ? 2 : 0) + p.ai.unitValue(g, m) * 0.1) ? x : m);
    t.flags.reduceNext = Math.max(t.flags.reduceNext || 0, 2); }, ai_whenLinked: () => 0.3 });
  const palaP = c => c.type === 'UNIT' && c.color === 'Purple' && (c.skw.Suppression || /^\[Suppression\]/.test(c.text));
  F('GD04-094', 'full', { p_whenLinked(g, u) { fetch(g, u.owner, palaP); }, ai_whenLinked: (g, p) => p.trash.some(palaP) ? 2.0 : 0 });
  F('GD04-095', 'full', { note: 'AI picks another Minerva Squad Unit that can still attack (else no redirect)', p_whenLinked(g, u) {
    const p = u.owner; if (g.hpLeft(u) < 2) return; const c = p.units.filter(x => x !== u && tr(g, x, 'Minerva Squad') && g.canAttackThisTurn(x)); if (!c.length) return;
    const t = c.reduce((m, x) => p.ai.unitValue(g, x) > p.ai.unitValue(g, m) ? x : m); const self = u;
    grant(g, t, 'redB', (g2, v, n, src, pv) => { if (n <= 0 || !g2.alive(self)) return n; if (pv) return 0; self.dmg += n; if (g2.hpLeft(self) <= 0) g2.destroy(self, { battle: true }); return 0; }, liveTurn(g.turn)); },
    ai_whenLinked: (g, p) => 0.3 });
  F('GD04-096', 'full', { p_battleDestroyRule: (g, src, v) => src.linked && v.owner !== src.owner && v.def.lv <= 5 });
  F('GD04-113', 'full', cmd({ actionOnly: true, canMain: () => false, main() {}, burst(g, p) { apDownPick(g, p, 2, null, null); },
    defAction: { can: (g, p, b) => redSave(g, p, b, 3) > 0, value: (g, p, b) => redSave(g, p, b, 3), run(g, p, b) { if (b.target !== 'player' && g.alive(b.target)) grant(g, b.target, 'redB', (g2, v, n) => Math.max(0, n - 3), liveBattle(b)); } } }));
  const transAm = c => c.type === 'UNIT' && c.name.includes('Trans-Am');
  F('GD04-114', 'full', ownEnemyCmd(1, null, null, { burst(g, p) { fetch(g, p, transAm); } }));
  const bkF = (v) => v.def.lv <= 5;
  const backupVal = (g, p, a) => { if (!g.canAttackThisTurn(a)) return -1; let best = -1;
    for (const t of p.opp.units) { if (!t.rested || !bkF(t)) continue; const f = p.ai.fight(g, a, t, true); if (f.killT || g.ap(a) <= 0) continue; best = Math.max(best, p.ai.unitValue(g, t) - (f.killA ? p.ai.unitValue(g, a) : 0)); }
    return best; };
  F('GD04-115', 'full', cmd({ burst(g, p) { dmgPick(g, p, 1, null); }, canMain: (g, p) => p.units.length > 0,
    main(g, p) { if (!p.units.length) return; const u = p.units.reduce((m, x) => backupVal(g, p, x) > backupVal(g, p, m) ? x : m); grant(g, u, 'bdr', (g2, s, v) => v.owner !== s.owner && bkF(v), liveTurn(g.turn)); },
    score: (g, p) => Math.max(-1, ...p.units.map(x => backupVal(g, p, x))) * 0.8 - 0.6 }));
  const minervaC = c => c.traits.includes('Minerva Squad');
  F('GD04-116', 'full', cmd({ pilotName: 'Heine Westenfluss', canMain: (g, p) => p.deck.length > 0 && p.opp.units.some(x => g.ap(x) <= 4),
    main(g, p) { const top = mill(p, 2); if (!top.length) return; const n = top.filter(minervaC).length; if (n > 0) dmgPick(g, p, n, x => g.ap(x) <= 4); },
    score: (g, p) => { const N = p.deck.length; if (!N) return -1; const fr = p.deck.filter(minervaC).length / N; const f = x => g.ap(x) <= 4;
      return 2 * fr * (1 - fr) * p.ai.bestDamageValue(g, p, 1, f) + fr * fr * p.ai.bestDamageValue(g, p, 2, f) + 0.2 - 0.7; } }));
  F('GD04-128', 'full', baseShield({ baseDestroyed(g, p) { const first = g.turnPlayer || p; g.draw(first, 1); g.draw(first.opp, 1); } }));

  // ======================= GD05 =======================
  F('GD05-051', 'full', { ap: (g, u) => u.dmg, endTurn(g, u) {
    const p = u.owner; const c = p.units.filter(x => x.rested && tr(g, x, 'Tekkadan') && g.hpLeft(x) > 1); if (!c.length) return;
    const x = c.reduce((m, y) => (p.ai.unitValue(g, y) + (y === u ? 0.5 : 0)) > (p.ai.unitValue(g, m) + (m === u ? 0.5 : 0)) ? y : m);
    pingOwn(g, p, x, 1); if (g.alive(x)) x.rested = false; } });
  const nzU = c => isU(c, 'Neo Zeon');
  F('GD05-052', 'full', { deploy(g, u) {
    const p = u.owner; const own = p.units.filter(x => x !== u); if (!own.length) return; const S = CARDS['GD05-052'];
    const s = sacPick(g, p, own, S); if (!s || s.v > 2.6 * pHit(p, 3, nzU) + 0.4) return;
    killOwn(g, p, s.x, S); const top = mill(p, 3); const nz = top.filter(nzU); if (nz.length) { const c = p.ai.pickBestCard(g, p, nz); fromTrash(p, c); toHand(g, p, c); } },
    ai_deploy: (g, p) => { const s = sacPick(g, p, p.units, CARDS['GD05-052']); return s ? Math.max(0, 2.6 * pHit(p, 3, nzU) + 0.4 - s.v) : 0; } });
  F('GD05-053', 'full', { note: 'source card from cause.src (passed by killOwn: GD05-049/052/057)', destroyed(g, u, pilot, cause) {
    if (!cause || !cause.effect || cause.by !== u.owner || !cause.src || !(cause.src.traits || []).includes('Neo Zeon')) return; if (fromTrash(u.owner, u.def)) toHand(g, u.owner, u.def); } });
  // GD05-049 Sazabi (overrides the effects.js entry): may destroy any of your Units, itself included; the opponent then destroys
  // one of its non-battling Units (its own choice, AI: its least valuable).
  const SZ = CARDS['GD05-049'];
  F('GD05-049', 'full', { note: 'overrides effects.js: may choose itself; passes cause.src', attack(g, u, b) {
    const p = u.owner, o = p.opp; const nb = () => o.units.filter(x => x !== b.target); if (!nb().length) return;
    const theirs = o.ai.pickSelfDestroy(g, o, nb()); const gain = p.ai.unitValue(g, theirs);
    const t = b.target; const f = (t !== 'player' && g.alive(t)) ? p.ai.fight(g, u, t, true) : null;
    const selfCost = (f && f.killA ? 0 : p.ai.unitValue(g, u)) + (t === 'player' ? p.ai.shieldHitValue(g, p, u) : (f && f.killT ? p.ai.unitValue(g, t) : 0));
    let best = null, bv = Infinity; for (const x of p.units) { const v = x === u ? selfCost : sacCost(g, p, x, SZ); if (v < bv) { bv = v; best = x; } }
    if (!best || bv >= gain - 0.2) return; killOwn(g, p, best, SZ);
    const c = nb(); if (c.length) { const v = o.ai.pickSelfDestroy(g, o, c); if (v) g.destroy(v, { effect: true, by: p, src: SZ }); } } });
  // GD05-129 Axis (overrides the effects.js 'simplified' entry)
  F('GD05-129', 'full', baseShield({ note: 'overrides effects.js; condition tracked by killOwn (p.flags.nzKillT); the Unit is deployed without paying its cost',
    activate: { cost: 0, restBase: true, can: (g, p) => p.flags.nzKillT === g.turn && p.units.length < 6 && axisLow(g, p).length > 0,
      score: (g, p) => { const c = axisLow(g, p); return c.length ? Math.max(...c.map(x => 1.0 + 0.45 * (x.ap + x.hp) + x.lv * 0.12 + p.ai.deployBonus(g, p, x))) - 0.4 : -1; },
      run(g, p) { if (p.flags.nzKillT !== g.turn || p.units.length >= 6) return; const c = axisLow(g, p); if (!c.length) return;
        const x = c.reduce((m, y) => (y.ap + y.hp + p.ai.deployBonus(g, p, y)) > (m.ap + m.hp + p.ai.deployBonus(g, p, m)) ? y : m); p.hand.splice(p.hand.indexOf(x), 1); g.deployUnit(p, x); } } }));
  const aaTrig = (g, self) => { if (onceT(g, self, 'aa')) g.draw(self.owner, 1); };
  F('GD05-054', 'full', { note: 'also triggers when Alpha Azieru itself is destroyed by an effect',
    destroyed(g, u, pilot, cause) { if (cause && cause.effect) aaTrig(g, u); }, onAllyDestroyed(g, self, x) { const c = x.destroyCause; if (c && c.effect) aaTrig(g, self); } });
  F('GD05-055', 'full', { reduceBattleDmg(g, u, n, src) { if (n <= 0 || src.owner === u.owner || !onceT(g, u, 'dst')) return n; return Math.max(0, n - 2); } });
  F('GD05-057', 'full', { playerTargetOk: true, activate: { cost: 0, once: true, postCombat: true, can: (g, p, u) => u.rested && p.units.some(x => x !== u),
    score: (g, p, u) => { const s = sacPick(g, p, p.units.filter(x => x !== u), CARDS['GD05-057']); return s ? p.ai.exposure(g, p, u) + 0.2 - s.v : -1; },
    run(g, p, u) { const s = sacPick(g, p, p.units.filter(x => x !== u), CARDS['GD05-057']); if (!s) return; killOwn(g, p, s.x, CARDS['GD05-057']); if (g.alive(u)) { u.rested = false; u.flags.noAtkPlayerT = g.turn; } } } });
  F('GD05-059', 'full', { note: '"If you do" read as covering both the draw and <High-Maneuver>', attack(g, u) {
    const p = u.owner; const c = p.units.filter(x => x !== u && !x.rested && tr(g, x, 'Gjallarhorn')); if (!c.length) return;
    const cost = x => (g.canAttackThisTurn(x) ? 10 : 0) + p.ai.unitValue(g, x); const x = c.reduce((m, y) => cost(y) < cost(m) ? y : m);
    x.rested = true; g.draw(p, 1); u.tKw['High-Maneuver'] = 1; } });
  F('GD05-061', 'full', { kw: (g, u, k) => (k === 'Blocker' && u.owner.units.some(x => x !== u && tr(g, x, 'Neo Zeon'))) ? 1 : 0 });
  const shinnP = c => c.type === 'PILOT' && c.name.includes('Shinn Asuka');
  F('GD05-064', 'full', { deploy(g, u) { if (isFT(u)) fetch(g, u.owner, shinnP); }, ai_fromTrash: (g, p) => p.trash.some(shinnP) ? 2.0 : 0 });
  F('GD05-065', 'full', { ap: (g, u) => (u.linked && yourTurn(g, u.owner)) ? 2 : 0 });
  F('GD05-094', 'full', { p_destroyed(g, u) { const p = u.owner; const c = p.units.filter(x => tr(g, x, 'Neo Zeon')); if (!c.length) return;
    const b = g.inBattle; const inB = c.filter(x => b && (b.attacker === x || b.target === x)); const t = p.ai.pickBestUnit(g, p, inB.length ? inB : c);
    grant(g, t, 'redB', redBy(2), liveTurn(g.turn)); } });
  F('GD05-096', 'full', { p_attack(g, u, b) {
    const p = u.owner; const hs = p.units.filter(x => x !== u && x.dmg > 0 && tr(g, x, 'Tekkadan'));
    if (battleDelta(g, p, u, b, 0, 1) + (hs.length ? 0.35 : 0) <= 0.1) return;
    if (pingOwn(g, p, u, 1)) { const t = p.units.filter(x => x !== u && x.dmg > 0 && tr(g, x, 'Tekkadan')); if (t.length) g.heal(p.ai.pickBestUnit(g, p, t), 1); } } });
  F('GD05-117', 'full', ownEnemyCmd(1, null, null, { pilotName: 'Ride Mass' }));

  // ======================= GD06 =======================
  const delazU = c => isU(c, 'Delaz Fleet');
  F('GD06-049', 'full', { whenPaired(g, u) { const p = u.owner; if (zeonU(p) >= 10 && p.opp.base) g.destroyBase(p.opp); },
    ai_whenPaired: (g, p) => (zeonU(p) >= 10 && p.opp.base) ? (p.opp.base.ex ? 1.0 : 1.8) : 0,
    destroyed(g, u) { const p = u.owner; const top = p.deck.splice(0, 3); const hits = top.filter(delazU);
      if (hits.length) { const c = p.ai.pickBestCard(g, p, hits); top.splice(top.indexOf(c), 1); toHand(g, p, c); } p.trash.push(...top); } });
  const zaftLink = (g, p) => p.units.some(x => x.linked && tr(g, x, 'ZAFT'));
  const lgF = x => x.def.lv <= 3;
  F('GD06-050', 'full', { trashLvMod: (g, p) => zaftLink(g, p) ? -3 : 0, trashCostMod: (g, p) => zaftLink(g, p) ? -3 : 0,
    deploy(g, u) { const p = u.owner; const t = destroyPick(g, p, lgF); if (t && isFT(u)) destroyPick(g, p, lgF); },
    ai_deploy: (g, p) => maxRemoval(g, p, lgF),
    ai_fromTrash: (g, p) => { const v = p.opp.units.filter(lgF).map(x => p.ai.removalValue(g, p, x, 'destroy')).sort((a, b) => b - a); return v.length > 1 ? v[1] : 0; } });
  const alphaP = (c, lv) => c.traits.includes('Alphacide') && lv <= 5;
  F('GD06-051', 'full', { activate: { cost: 2, once: true, postCombat: true, can: (g, p, u) => !u.rested && p.units.length < 6 && !!trashPick(g, p, alphaP),
    score: (g, p, u) => { const c = trashPick(g, p, alphaP); return c ? ftVal(g, p, c) - 1.4 : -1; },
    run(g, p, u) { u.rested = true; const c = trashPick(g, p, alphaP); if (c) deployFT(g, p, c); } },
    deploy(g, u) { if (u.owner.units.some(x => x !== u && tr(g, x, 'Alphacide'))) u.flags.gfredT = g.turn; },
    endTurn(g, u) { if (u.flags.gfredT === g.turn) setActiveRes(u.owner, 2); },
    ai_deploy: (g, p) => p.units.some(x => tr(g, x, 'Alphacide')) ? 0.6 : 0 });
  F('GD06-052', 'full', { kw: (g, u, k) => (k === 'High-Maneuver' && zeonU(u.owner) >= 5) ? 1 : 0,
    deploy(g, u) { const p = u.owner; const top = mill(p, 1); if (top.length && top[0].traits.includes('Zeon')) restPick(g, p, x => g.ap(x) <= 4); },
    ai_deploy: (g, p) => pHit(p, 1, c => c.traits.includes('Zeon')) * p.ai.restScore(g, p, x => g.ap(x) <= 4) });
  F('GD06-053', 'full', { destroyed(g, u) { setActiveRes(u.owner, 1); } });
  F('GD06-054', 'full', { deploy(g, u) {
    const p = u.owner; if (!p.opp.units.length) return; const o = pickPing(g, p, p.units, 1, 0);
    if (p.ai.bestDamageValue(g, p, 1, null) + (o ? o.v : 0) <= 0.15) return; if (o) pingOwn(g, p, o.x, 1); dmgPick(g, p, 1, null); },
    ai_deploy: (g, p) => { const o = pickPing(g, p, p.units, 1, 0); return Math.max(0, p.ai.bestDamageValue(g, p, 1, null) + (o ? o.v : 0)); } });
  F('GD06-055', 'full', { attack(g, u, b) {
    if (!u.pilot || g.hpLeft(u) <= 1) return; const p = u.owner; let want = false;
    const withDmg = (t) => { const f0 = p.ai.fight(g, u, t, true); u.dmg++; let f1; try { f1 = p.ai.fight(g, u, t, true); } finally { u.dmg--; } return f1.killT && (!f1.killA || f0.killA); };
    if (b.target !== 'player') want = g.alive(b.target) && withDmg(b.target);
    else { const D = p.opp; want = !g.kw(u, 'High-Maneuver') && (D.base || D.shields.length) && D.units.some(x => !x.rested && g.kw(x, 'Blocker') && withDmg(x)); }
    if (want && pingOwn(g, p, u, 1) && g.alive(u)) u.bKw.Breach = (u.bKw.Breach || 0) + 2; } });
  F('GD06-056', 'full', { attack(g, u) { const p = u.owner; const f = x => x.def.lv <= 2; if (g.avail(p) < 2 || maxRemoval(g, p, f) < 1.6) return; g.pay(p, 2); destroyPick(g, p, f); } });
  F('GD06-057', 'full', { kw: (g, u, k) => (k === 'Blocker' && u.owner.units.some(x => x !== u && tr(g, x, 'Delaz Fleet'))) ? 1 : 0 });
  F('GD06-058', 'full', { deploy(g, u) { u.flags.hasteUnitsOnly = true; }, ai_deploy: (g, p) => p.opp.units.some(x => x.rested) ? 0.6 : 0 });
  F('GD06-060', 'full', { ap: (g, u) => zeonU(u.owner) >= 4 ? 1 : 0 });
  F('GD06-093', 'full', { p_attack(g, u, b) { grant(g, u, 'redB', redBy(2, (g2, v, src) => src.def.lv <= v.def.lv), liveBattle(b)); } });
  const nyVal = (g, p, a) => { if (!yourTurn(g, p) || !g.canAttackThisTurn(a)) return 0; let best = 0.05;
    for (const t of p.opp.units) { if (!t.rested || t.def.lv > 4) continue; const f = p.ai.fight(g, a, t, true); if (f.killT || g.ap(a) <= 0) continue; best = Math.max(best, p.ai.unitValue(g, t) - (f.killA ? p.ai.unitValue(g, a) : 0)); }
    return best; };
  F('GD06-094', 'full', { p_whenPaired(g, u) { const p = u.owner; const t = p.units.reduce((m, x) => nyVal(g, p, x) > nyVal(g, p, m) ? x : m, u);
    grant(g, t, 'bdr', (g2, s, v) => v.owner !== s.owner && v.def.lv <= 4, liveTurn(g.turn)); },
    ai_whenPaired: (g, p) => 0.6 * Math.max(0, ...p.units.map(x => nyVal(g, p, x))) });
  F('GD06-095', 'full', { p_attack(g, u, b) {
    const p = u.owner; if (g.hpLeft(u) <= 1) return; const zs = p.units.filter(x => tr(g, x, 'Zeon')); if (!zs.length) return;
    const cost = battleDelta(g, p, u, b, 0, 1); let best = null, bv = 0.25;
    for (const x of zs) { const v = x === u ? battleDelta(g, p, u, b, 2, 1) : cost + (g.canAttackThisTurn(x) ? pumpGain(g, p, x, 2, 0) : 0); if (v > bv) { bv = v; best = x; } }
    if (best && pingOwn(g, p, u, 1) && g.alive(best)) best.tAP += 2; } });
  F('GD06-096', 'full', { p_attack(g, u) { if (!u.linked) return; const p = u.owner; const top = mill(p, 1); if (top.length && hasT(top[0], 'Zeon', 'Alphacide')) for (const x of p.opp.units) x.bAP -= 1; } });
  const acDestroyV = (g, p, b, threat) => { let v = 0; for (const x of p.opp.units) if (x.def.lv <= 2) v = Math.max(v, p.ai.removalValue(g, p, x, 'destroy') + (b && x === b.attacker ? threat * 0.7 : 0)); return v; };
  const acRun = (g, p, b) => { const a = b && b.attacker; if (a && g.alive(a) && a.def.lv <= 2 && p.ai.removalValue(g, p, a, 'destroy') + 0.01 >= maxRemoval(g, p, x => x.def.lv <= 2) - 1.0) g.destroy(a, { effect: true, by: p }); else destroyPick(g, p, x => x.def.lv <= 2); };
  F('GD06-114', 'full', cmd({ actionOnly: true, canMain: () => false, main() {},
    defAction: {
      can: (g, p, b) => redSave(g, p, b, 3, (g2, x) => tr(g2, x, 'Alphacide')) > 0 || p.opp.units.some(x => x.def.lv <= 2),
      value: (g, p, b, threat) => Math.max(redSave(g, p, b, 3, (g2, x) => tr(g2, x, 'Alphacide')), acDestroyV(g, p, b, threat)),
      run(g, p, b) { const r = redSave(g, p, b, 3, (g2, x) => tr(g2, x, 'Alphacide')); if (r > 0 && r >= acDestroyV(g, p, b, 1)) grant(g, b.target, 'redB', redBy(3), liveBattle(b)); else acRun(g, p, b); } } }));
  const agP = (c, lv) => c.color === 'Purple' && c.traits.includes('Zeon') && lv <= 5;
  F('GD06-116', 'full', cmd({ canMain: (g, p) => p.units.length < 6 && !!trashPick(g, p, agP), main(g, p) { const c = trashPick(g, p, agP); if (c && p.units.length < 6) deployFT(g, p, c); },
    score: (g, p) => { const c = trashPick(g, p, agP); return c ? ftVal(g, p, c) - 2.0 : -1; } }));
  F('GD06-117', 'full', changeTargetCmd('Delaz Fleet', { pilotName: 'Karius' }));
  // GD06-115 Teaching New Techniques (overrides the auto-compiled entry, which dropped the opponent's [Nu Gundam] token)
  const tntF = x => (x.def.lv || 0) <= 4;
  const tokV = (name) => { const d = TOKEN[name]; return 0.4 + 0.35 * (d.ap + d.hp) + (d.skw && d.skw['First Strike'] ? 0.5 : 0); };
  F('GD06-115', 'full', cmd({ note: 'overrides the auto-compiled entry; Sazabi token is deployed even without a target',
    canMain: (g, p) => p.opp.units.some(tntF) || p.units.length < 6,
    main(g, p) { const t = destroyPick(g, p, tntF); g.deployToken(p, 'Sazabi'); if (t && !g.alive(t)) g.deployToken(t.owner, 'Nu Gundam'); },
    score: (g, p) => (p.opp.units.some(tntF) ? maxRemoval(g, p, tntF) - tokV('Nu Gundam') : 0) + (p.units.length < 6 ? tokV('Sazabi') : 0) - 1.4 }));
  F('GD06-127', 'full', baseShield({ baseDeploy(g, p) { if (!yourTurn(g, p)) return; const top = mill(p, 2); if (top.some(c => c.traits.includes('Alphacide'))) destroyPick(g, p, x => g.ap(x) <= 2); } }));
  const gwPick = (g, p) => { const z = p.units.filter(x => tr(g, x, 'Zeon')); if (!z.length) return null; let best = null, bv = -1;
    for (const x of z) { let v = (g.canAttackThisTurn(x) ? 0.25 : 0) + p.ai.unitValue(g, x) * 0.01;
      if (g.canAttackThisTurn(x)) for (const t of p.opp.units) { if (!t.rested) continue; const f0 = p.ai.fight(g, x, t, true); if (!f0.killA) continue; const keep = [x.flags.redBs, x.flags.redB, x.flags.redBIn];
        try { grant(g, x, 'redB', redBy(1), liveTurn(g.turn)); if (!p.ai.fight(g, x, t, true).killA) v = Math.max(v, 0.6 * p.ai.unitValue(g, x)); } finally { x.flags.redBs = keep[0]; x.flags.redB = keep[1]; x.flags.redBIn = keep[2]; } }
      if (v > bv) { bv = v; best = x; } }
    return best ? { x: best, v: bv } : null; };
  F('GD06-128', 'full', baseShield({ activate: { cost: 0, restBase: true, can: (g, p) => p.units.some(x => tr(g, x, 'Zeon')),
    score: (g, p) => { const r = gwPick(g, p); return r && r.v >= 0.25 ? r.v : -1; }, run(g, p) { const r = gwPick(g, p); if (r) grant(g, r.x, 'redB', redBy(1), liveTurn(g.turn)); } } }));
  F('GD06-129', 'full', baseShield({ note: 'Axis Base token is stored with ex:true so it never goes to the trash', baseDestroyed(g, p) {
    if (p.shields.length && !p.base && TOKEN['Axis']) p.base = { def: TOKEN['Axis'], dmg: 0, ex: true, token: true, rested: false }; } }));

  // ======================= ST05 Iron-Blooded Orphans =======================
  F('ST05-001', 'full', { kw: (g, u, k) => (k === 'Suppression' && u.dmg > 0) ? 1 : 0,
    deploy(g, u) { const p = u.owner; const r = pickPing(g, p, p.units.filter(x => x !== u), 1, 1); if (!r) return; pingOwn(g, p, r.x, 1); if (g.alive(r.x)) r.x.tAP += 1; },
    ai_deploy: (g, p) => { const r = pickPing(g, p, p.units, 1, 1); return r ? r.v : 0; } });
  F('ST05-002', 'full', { ap: (g, u) => u.dmg > 0 ? 2 : 0 });
  F('ST05-003', 'full', { activate: { cost: 0, can: (g, p, u) => !u.rested,
    score: (g, p, u) => { const r = pickPing(g, p, p.units, 1, 1); return r ? r.v - 0.15 : -1; },
    run(g, p, u) { u.rested = true; const r = pickPing(g, p, p.units, 1, 1); if (!r) return; pingOwn(g, p, r.x, 1); if (g.alive(r.x)) r.x.tAP += 1; } } });
  F('ST05-011', 'full', { p_onBattleKill(g, u) { if (!u.linked || !yourTurn(g, u.owner)) return; const p = u.owner; fetch(g, p, c => isU(c, 'Tekkadan') && tLv(g, p, c) <= 2); } });
  F('ST05-013', 'full', pumpCmd(3, 1, null));
  const isaPick = (g, p) => { const c = p.units.filter(x => x.dmg > 0); let best = null, bv = -1; for (const x of c) { const v = (yourTurn(g, p) && g.canAttackThisTurn(x)) ? pumpGain(g, p, x, 2, 0) : -1; if (v > bv) { bv = v; best = x; } } return best ? { x: best, v: bv } : null; };
  F('ST05-015', 'full', baseShield({ activate: { cost: 0, restBase: true, can: (g, p) => p.units.some(x => x.dmg > 0),
    score: (g, p) => { const r = isaPick(g, p); return r && r.v > 0 ? r.v - 0.05 : -1; },
    run(g, p) { const r = isaPick(g, p) || (p.units.some(x => x.dmg > 0) ? { x: p.ai.pickBestAttacker(g, p, p.units.filter(x => x.dmg > 0)) } : null); if (r) r.x.tAP += 2; } } }));

  // ======================= ST07 Celestial Being =======================
  const cbC = c => c.traits.includes('CB');
  F('ST07-001', 'full', { endTurn(g, u) { if (nTrash(u.owner, cbC) >= 7) setActiveRes(u.owner, 1); },
    whenPaired(g, u) { const p = u.owner; const top = mill(p, 2); if (top.some(cbC)) g.draw(p, 1); }, ai_whenPaired: (g, p) => 0.2 + 1.2 * pHit(p, 2, cbC) });
  F('ST07-004', 'full', { kw: (g, u, k) => (k === 'Blocker' && pilotIn(u.owner, 'CB')) ? 1 : 0 });
  F('ST07-010', 'full', { p_destroyed(g, u) { if (!yourTurn(g, u.owner) && u.def.traits.includes('CB')) g.draw(u.owner, 1); } });
  F('ST07-013', 'full', changeTargetCmd('CB', { burst(g, p) { g.draw(p, 1); } }));
  const ptoGuard = (g, D, a) => !!a && a.owner !== D && !a.token && a.def.lv <= 3 && D.units.some(x => x.rested && tr(g, x, 'CB'));
  F('ST07-015', 'full', baseShield({ note: 'battle damage and Breach damage from Lv<=3 non-token enemy Units',
    baseNoBattle: (g, D, a) => ptoGuard(g, D, a), reduceShieldDmg: (g, D, n, srcP, opts) => (opts.breach && ptoGuard(g, D, opts.src)) ? 0 : n }));

  // ======================= ST09 ZAFT / Minerva =======================
  const impP = (c, lv) => c.name.includes('Impulse Gundam') && lv >= 4;
  F('ST09-001', 'full', { activate: { cost: 2, can: (g, p, u) => !!trashPick(g, p, impP),
    score: (g, p, u) => { const c = trashPick(g, p, impP); return c ? ftVal(g, p, c) - p.ai.unitValue(g, u) - 0.6 - (g.canAttackThisTurn(u) ? 0.6 : 0) : -1; },
    run(g, p, u) { const c = trashPick(g, p, impP); g.toBottom(u); if (c) deployFT(g, p, c); } } });
  F('ST09-002', 'full', { destroyed(g, u) { fetch(g, u.owner, c => isU(c, 'Minerva Squad') && !c.name.includes('Force Impulse Gundam')); } });
  F('ST09-006', 'full', { deploy(g, u) { if (isFT(u)) destroyPick(g, u.owner, x => x.def.lv <= 3); }, ai_fromTrash: (g, p) => maxRemoval(g, p, x => x.def.lv <= 3) });
  F('ST09-008', 'full', { p_attack(g, u) { if (tr(g, u, 'Minerva Squad')) setActiveRes(u.owner, 1); } });
  F('ST09-010', 'full', baseShield({ baseDeploy(g, p) { if (yourTurn(g, p)) top2Keep1(g, p); } }));

  // ======================= ST11 Marine =======================
  const shamRed = (g, D, n, srcP) => (D.flags.shamT === g.turn && srcP && srcP !== D) ? Math.max(0, n - 5 * (D.flags.shamN || 1)) : n;
  F('ST11-006', 'full', { note: 'Breach damage counts as effect damage',
    onOppStart(g, u) { const p = u.owner; if (!p.units.some(x => x !== u && tr(g, x, 'Marine'))) return; p.flags.shamN = p.flags.shamT === g.turn ? (p.flags.shamN || 1) + 1 : 1; p.flags.shamT = g.turn;
      if (!p.flags.shamIn) { const old = p.flags.shieldRed; p.flags.shieldRed = old ? (g2, D, n, s, o) => shamRed(g2, D, old(g2, D, n, s, o), s, o) : shamRed; p.flags.shamIn = true; } },
    deploy(g, u) { fetch(g, u.owner, c => isU(c, 'Marine')); }, ai_deploy: (g, p) => p.trash.some(c => isU(c, 'Marine')) ? 1.6 : 0 });
  F('ST11-012', 'full', { p_whenPaired(g, u) { const p = u.owner; const c = p.units.filter(x => tr(g, x, 'Marine')); if (!c.length) return;
    const t = c.includes(u) && g.canAttackThisTurn(u) ? u : p.ai.pickBestAttacker(g, p, c); grant(g, t, 'redB', redBy(2), liveTurn(g.turn)); }, ai_whenPaired: () => 0.2 });
  const twP = (c, lv) => c.traits.includes('Marine') && lv <= 4;
  F('ST11-015', 'full', cmd({ canMain: (g, p) => p.units.length < 6 && !!trashPick(g, p, twP), main(g, p) { const c = trashPick(g, p, twP); if (c && p.units.length < 6) deployFT(g, p, c, { rested: true }); },
    score: (g, p) => { const c = trashPick(g, p, twP); return c ? ftVal(g, p, c) * 0.85 - 1.3 : -1; } }));

  // ======================= ST12 =======================
  F('ST12-009', 'full', { destroyed(g, u) { const p = u.owner; if (!g.players.some(pl => pl.shields.length <= 3)) return; if (fetch(g, p, c => c.type === 'UNIT' && tLv(g, p, c) >= 6)) g.discard(p, 1); } });
  const wlpVal = (g, p, b) => { const t = b && b.target; if (!t || t === 'player' || !g.alive(t) || t.owner !== p || !g.alive(b.attacker) || !p.ai.fight(g, b.attacker, t, true).killA) return 0;
    let v = 0; for (const x of p.opp.units) if (x !== b.attacker && g.ap(x) <= 2) v = Math.max(v, p.ai.removalValue(g, p, x, 'destroy')); return v * 0.9; };
  F('ST12-014', 'full', cmd({ pilotName: "M'Quve", actionOnly: true, canMain: () => false, main() {},
    defAction: { can: (g, p, b) => wlpVal(g, p, b) > 0, value: (g, p, b) => wlpVal(g, p, b),
      run(g, p, b) { const t = b.target; if (t === 'player') return; grant(g, t, 'onKill', (g2, u) => { destroyPick(g2, u.owner, x => g2.ap(x) <= 2); }, liveBattle(b)); } } }));
  const tuOwn = (g, p, b) => { const c = p.units.filter(x => x !== (b && b.target)); return c.length ? c : p.units; };
  const tuDmgV = (g, p, b, threat) => { const o = pickPing(g, p, tuOwn(g, p, b), 2, 0); const ov = o ? o.v : 0; let v = -Infinity;
    for (const x of p.opp.units) { if (x.def.lv < 5) continue; const kill = p.ai.effPreview(g, p, x, 2) >= g.hpLeft(x); v = Math.max(v, p.ai.dmgTargetValue(g, p, x, 2) + (kill && b && x === b.attacker ? threat * 0.7 : 0)); }
    return v === -Infinity ? 0 : v + ov; };
  F('ST12-015', 'full', cmd({ actionOnly: true, canMain: () => false, main() {},
    defAction: {
      can: (g, p, b) => p.opp.units.some(x => x.def.lv <= 2 || x.def.lv >= 5),
      value: (g, p, b, threat) => Math.max(acDestroyV(g, p, b, threat), tuDmgV(g, p, b, threat)),
      run(g, p, b) { if (acDestroyV(g, p, b, 1) >= tuDmgV(g, p, b, 1)) { acRun(g, p, b); return; }
        const a = b && b.attacker; const o = pickPing(g, p, tuOwn(g, p, b), 2, 0); if (o) pingOwn(g, p, o.x, 2);
        if (a && g.alive(a) && a.def.lv >= 5 && p.ai.effPreview(g, p, a, 2) >= g.hpLeft(a)) g.effectDamage(p, a, 2); else dmgPick(g, p, 2, x => x.def.lv >= 5); } } }));
};
