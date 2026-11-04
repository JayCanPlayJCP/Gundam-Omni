'use strict';
// Green cards, batch 2 (written from official English text; 1v1: "enemy players" = 1).
// NOTES
//  Skipped: none. Simplified (see each `note`): EB01-033, EB01-087, GD01-090, GD04-029, GD05-021.
//  Wished-for hooks:
//   - base onAllyBattleKill(g,p,killer) (EB01-087 Ptolemaios 2 heal trigger is not modelled).
//   - unit 【Activate･Action】 abilities usable in the battle action step, e.g. activate:{action:true, can(g,p,u,b,role),
//     value, run} (EB01-033 Taurus, GD05-021 AGE-2 DB are emulated with a battle-time AP getter that pays ① itself
//     and is auto-used only when the +AP flips the unit fight).
//   - a "real damage" flag (or post-damage hook) for reduceEffectDmg: once-per-turn reductions (GD04-029, GD05-021) are
//     consumed by battle damage only, because AI previews also call reduceEffectDmg.
//   - an AP-reduction hook, e.g. apDownImmune(g,u,srcPlayer) consulted by apDownPick / tAP-=n (GD01-090 Duo Maxwell).
//   - ai.fight() consulting noBattleDmg / reduceBattleDmg / flags.nbd / flags.reduceNext, so damage-prevention
//     effects (Modification, Witches from Earth, Zudah, Tallgeese II, Tokwan, ...) shape attack/block choices.
//   - a post-resolution "command moved to trash" hook (GD04-021 pairs the Command from the trash by intercepting the
//     single trash push that castCommand does right after onCommand).
//   - AI choice to pay with EX Resources: the engine pays normal Resources first, so "If you use an EX Resource" bonuses
//     (GD04-020/021/106/108) only fire when normal Resources are exhausted.
//   - ai_whenPaired(g,p,u) receives no pilot def (EB01-021's pilot-trait condition is approximated from the hand).
//   - ai.canPair's /can't be paired/ misses Ad Balloon ("can't be set as active or paired with a Pilot"): handled by
//     registering T-014 with noPilot + an endTurn that keeps it from being set as active.
module.exports = function (F, H, EFX) {
  const { CARDS, shuffle } = require('./engine');
  const { tr, yourTurn, cmd, baseShield, lookTop } = H;

  // ---------- local helpers ----------
  const ptr = (u, t) => !!(u.pilot && (u.pilot.traits || []).includes(t));
  const pilotIn = (p, t) => p.units.some(x => ptr(x, t));
  const toHand = (g, p, c) => { p.hand.push(c); g.stats.p[p.i].extraCards++; };
  const fromTrash = (p, c) => { const i = p.trash.lastIndexOf(c); if (i < 0) return false; p.trash.splice(i, 1); return true; };
  const placeRested = (p) => { if (p.resDeck > 0) { p.resDeck--; p.res++; p.resRested++; return true; } return false; };
  const chainNbd = (u, f) => { const old = u.flags.nbd; u.flags.nbd = old ? (g, v, s, b) => old(g, v, s, b) || f(g, v, s, b) : f; };
  const lfrithName = (x) => /Gundam Lfrith|Gundnode/.test(x.def.name);
  const pilotLike = (c) => c.type === 'PILOT' || (c.type === 'COMMAND' && EFX[c.id] && EFX[c.id].pilotName);
  const ggCount = (p) => p.trash.filter(c => c.traits.includes('G Generation')).length;
  // 【Development N】: exile N (G Generation) cards from the trash (worst first). Returns true if paid.
  function development(g, p, n) {
    if (ggCount(p) < n) return false;
    for (let k = 0; k < n; k++) { const c = p.ai.pickWorstCard(g, p, p.trash.filter(x => x.traits.includes('G Generation'))); fromTrash(p, c); p.exile.push(c); }
    return true;
  }
  // "All players each look at the top card of their deck. If it is <pred>, they may reveal it and add it to their hand.
  //  They return any remaining card to the top or bottom of their deck."
  function allLookTop(g, pred) {
    for (const pl of [g.turnPlayer || g.players[0], (g.turnPlayer || g.players[0]).opp]) {
      if (!pl.deck.length) continue; const c = pl.deck[0];
      if (pred(c)) { pl.deck.shift(); toHand(g, pl, c); } else if (!pl.ai.keepOnTop(g, pl, c)) { pl.deck.shift(); pl.deck.push(c); }
    }
  }
  // grant "may attack an active enemy Unit" to up to n friendly units (best first)
  function grantActiveN(g, p, fa, fe, n) {
    const done = new Set();
    for (let k = 0; k < n; k++) {
      const before = new Map(p.units.map(x => [x, x.attackActiveFilter]));
      H.grantActive(g, p, (g2, x) => fa(g2, x) && !done.has(x), fe, null, false);
      const ch = p.units.find(x => x.attackActiveFilter !== before.get(x)); if (!ch) break; done.add(ch);
    }
  }
  // pay ① from inside a battle-time getter without disturbing p.flags.lastPayEX
  const payQuiet = (g, p, n) => { const keep = p.flags.lastPayEX; const ok = g.pay(p, n); p.flags.lastPayEX = keep; return ok; };
  // value of making `x` (our rested unit) the new target of enemy attacker `a`
  const takeHit = (g, p, a, x) => { const f = p.ai.fight(g, a, x, true); return (f.killA ? p.ai.unitValue(g, a) : 0) - (f.killT ? p.ai.unitValue(g, x) - p.ai.deathValue(g, x) : 0); };
  // 【Action】Choose 1 rested friendly (T) Unit. Change a battling enemy Unit's attack target to it.
  function changeTargetCmd(trait, extra) {
    const cands = (g, p, b) => p.units.filter(x => x.rested && x !== b.target && tr(g, x, trait));
    const best = (g, p, b) => cands(g, p, b).reduce((m, y) => (!m || takeHit(g, p, b.attacker, y) > takeHit(g, p, b.attacker, m)) ? y : m, null);
    return cmd(Object.assign({ actionOnly: true, canMain: () => false, main() {}, canAction: () => true,
      defAction: {
        can: (g, p, b) => !!b && g.alive(b.attacker) && b.attacker.owner !== p && cands(g, p, b).length > 0,
        value: (g, p, b, threat) => threat + takeHit(g, p, b.attacker, best(g, p, b)),
        run(g, p, b) { const x = best(g, p, b); if (!x) return; if (b.blocked && b.target !== 'player') b.origBlocker = b.target; b.target = x; } } }, extra || {}));
  }

  // ======================= G GENERATION =======================
  F('EB01-021', 'full', { whenPaired(g, u, pd) { const p = u.owner; if ((pd.traits || []).includes('G Generation') && p.trash.filter(c => c.type === 'UNIT' && c.traits.includes('G Generation')).length >= 2) placeRested(p); },
    ai_whenPaired: (g, p) => (p.trash.filter(c => c.type === 'UNIT' && c.traits.includes('G Generation')).length >= 2 && p.resDeck > 0 && p.hand.some(c => c.type === 'PILOT' && c.traits.includes('G Generation'))) ? (g.level(p) <= 7 ? 1.0 : 0.4) : 0 });
  F('EB01-022', 'full', { endTurn(g, u) {
    if (!ptr(u, 'G Generation')) return; const p = u.owner;
    const n = Math.min(3, 7 - p.units.length);
    const tokV = n * 2.1 + (u.linked && u.pilot.id === 'EB01-068' ? 1.0 : 0);
    const keepV = p.ai.unitValue(g, u) - (u.rested ? p.ai.exposure(g, p, u) : 0);
    if (tokV <= keepV) return;
    g.destroy(u, { effect: true, by: p }); for (let k = 0; k < 3; k++) g.deployToken(p, 'Gundam Exia'); } });
  F('EB01-023', 'full', { attack(g) { allLookTop(g, c => c.lv >= 5); } });
  F('EB01-025', 'full', { deploy(g, u) { const p = u.owner; if (p.opp.ex > 0 || !p.hand.some(pilotLike)) return; if (development(g, p, 2)) { g.placeEX(p, 1); g.placeEX(p.opp, 1); } },
    ai_deploy: (g, p) => (p.opp.ex === 0 && ggCount(p) >= 2 && p.hand.some(pilotLike)) ? 0.4 : 0,
    noBattleDmg: (g, u, src) => !!u.pilot && src.owner !== u.owner && u.owner.opp.ex > 0 && src.def.lv <= 5 });
  F('EB01-027', 'full', { deploy(g, u) { const p = u.owner; const c = p.units.filter(x => tr(g, x, 'G Generation') && g.canAttackThisTurn(x)); if (!c.length || !p.opp.units.length) return;
    if (!development(g, p, 2)) return; const t = p.ai.pickBestAttacker(g, p, c); t.tKw.Breach = (t.tKw.Breach || 0) + 1; } });
  F('EB01-028', 'full', { onAllyAttack(g, src, a) { const b = g.inBattle; if (!b || b.attacker !== a || b.target === 'player' || !src.rested || src.once.has('plutone')) return; src.once.add('plutone'); a.bKw.Breach = (a.bKw.Breach || 0) + 2; } });
  F('EB01-029', 'full', { deploy(g, u) { const p = u.owner; if (p.opp.units.length < 5) return; for (const pl of g.players) for (const x of [...pl.units]) if (g.kw(x, 'Blocker') && x.def.lv <= 4) g.effectDamage(pl === p ? null : p, x, 2); },
    ai_deploy: (g, p) => p.opp.units.length < 5 ? 0 : p.opp.units.filter(x => g.kw(x, 'Blocker') && x.def.lv <= 4).reduce((s, x) => s + p.ai.dmgTargetValue(g, p, x, 2), 0) - p.units.filter(x => g.kw(x, 'Blocker') && x.def.lv <= 4 && g.hpLeft(x) <= 2).reduce((s, x) => s + p.ai.unitValue(g, x), 0) });
  F('EB01-033', 'simplified', { note: 'Activate･Action (①, once/turn, AP+1 to another friendly Unit being attacked) is auto-used on the opponent\'s turn when the +1 lets that Unit destroy its attacker',
    aura_ap(g, self, other) {
      const b = g.inBattle; if (!b || b.effectBattle || b.target !== other || g.turnPlayer === self.owner) return 0;
      if (self.flags.tauB === b) return self.flags.tauU === other ? 1 : 0;
      if (self.flags.tauCalc || self.flags.tauT === g.turn) return 0;
      const a = b.attacker, p = self.owner; if (!g.alive(a) || g.avail(p) < 1) return 0;
      let ap0, hpA, fsKill; self.flags.tauCalc = true;
      try { ap0 = g.ap(other); hpA = g.hpLeft(a); fsKill = g.kw(a, 'First Strike') > 0 && g.ap(a) >= g.hpLeft(other); } finally { self.flags.tauCalc = false; }
      if (fsKill || ap0 >= hpA || ap0 + 1 < hpA) return 0;
      if (!payQuiet(g, p, 1)) return 0; self.flags.tauB = b; self.flags.tauU = other; self.flags.tauT = g.turn; return 1; } });
  F('EB01-035', 'full', { onAllyDeploy(g, src, nu) { if (nu !== src && tr(g, nu, 'G Generation') && nu.def.lv === 3) src.tKw.Breach = (src.tKw.Breach || 0) + 1; } });
  F('EB01-036', 'full', { aura_ap: (g, src, u) => (yourTurn(g, src.owner) && tr(g, u, 'G Generation') && u.def.lv === 3) ? 1 : 0 });
  F('EB01-037', 'full', { noBattleDmg: (g, u, src) => yourTurn(g, u.owner) && src.owner !== u.owner && g.kw(src, 'Blocker') > 0 });
  F('EB01-039', 'full', { lvMod: (g, p) => p.opp.units.length >= 3 ? 3 - CARDS['EB01-039'].lv : 0, costMod: (g, p) => p.opp.units.length >= 3 ? 3 - CARDS['EB01-039'].cost : 0 });
  F('EB01-040', 'full', { note: 'Deploy needs 2+ enemy players: never triggers in 1v1' });
  F('EB01-067', 'full', { p_whenPaired(g, u) { const p = u.owner; const top = p.deck.splice(0, 3); if (!top.length) return;
    const hits = top.filter(c => c.type === 'UNIT' && c.traits.includes('G Generation') && c.lv <= g.level(p) + 2); let keep = null;
    if (hits.length) { keep = p.ai.pickBestCard(g, p, hits); top.splice(top.indexOf(keep), 1); }
    shuffle(top, g.rng); p.deck.push(...top); if (keep) p.deck.unshift(keep); }, ai_whenPaired: () => 0.3 });
  F('EB01-068', 'full', { p_destroyed(g, u, pilot) { if (!u.linked || !pilot) return; const p = u.owner; if (fromTrash(p, pilot)) p.deck.unshift(pilot); } });
  F('EB01-077', 'full', changeTargetCmd('G Generation'));
  F('EB01-078', 'full', cmd({ canMain: (g, p) => p.deck.length > 0, main(g) { allLookTop(g, c => c.type === 'UNIT'); },
    score: (g, p) => (p.deck.length ? 1.1 * p.deck.filter(c => c.type === 'UNIT').length / p.deck.length : 0) - 0.35 }));
  const modVal = (g, p, a) => { let best = -1; if (!tr(g, a, 'G Generation') || !g.canAttackThisTurn(a)) return best;
    for (const t of p.opp.units) { if (!t.rested || t.def.lv > 3) continue; const f = p.ai.fight(g, a, t, true); if (f.killA && f.killT && p.ai.unitValue(g, t) + Math.min(g.kw(a, 'Breach'), 3) * 0.7 > p.ai.unitValue(g, a)) best = Math.max(best, p.ai.unitValue(g, a) * 0.8); }
    return best; };
  F('EB01-079', 'full', cmd({ canMain: (g, p) => p.units.some(u => tr(g, u, 'G Generation')),
    main(g, p) { const c = p.units.filter(u => tr(g, u, 'G Generation')); if (!c.length) return; const u = c.reduce((m, x) => modVal(g, p, x) > modVal(g, p, m) ? x : m); chainNbd(u, (g2, v, src) => src.owner !== v.owner && src.def.lv <= 3); },
    score: (g, p) => Math.max(-1, ...p.units.map(u => modVal(g, p, u))) - 0.6 }));
  F('EB01-087', 'simplified', baseShield({ note: 'Once/turn heal 2 when a green (G Generation) Unit destroys an enemy in battle not modelled (no base battle-kill hook)' }));
  F('EB01-088', 'full', baseShield({ aura_ap: (g, base, u) => (g.turnPlayer !== u.owner && tr(g, u, 'G Generation') && u.def.lv === 3) ? 1 : 0 }));

  // ======================= ACADEMY / DAWN OF FOLD / QUIET ZERO =======================
  const dofEX = (g, u, c) => yourTurn(g, u.owner) && c.type === 'COMMAND' && c.traits.includes('Dawn of Fold') && !!u.owner.flags.lastPayEX;
  F('GD04-020', 'full', { onCommand(g, u, c) { if (!dofEX(g, u, c) || u.once.has('lfur')) return; u.once.add('lfur'); g.draw(u.owner, 1); } });
  F('GD04-021', 'full', { onCommand(g, u, c) {
    if (!dofEX(g, u, c)) return; const p = u.owner; const ce = EFX[c.id]; if (!ce || !ce.pilotName) return;
    const po = p.ai.pilotObj(c, true); const cands = p.units.filter(x => lfrithName(x) && p.ai.canPair(g, x)); if (!cands.length) return;
    const t = cands.reduce((m, x) => p.ai.pairBonus(g, p, x, po) > p.ai.pairBonus(g, p, m, po) ? x : m);
    // castCommand moves the card to the trash right after onCommand: take it from there instead (pair "from your trash").
    const tsh = p.trash; if (Object.prototype.hasOwnProperty.call(tsh, 'push')) return;
    tsh.push = function (...xs) { const i = xs.indexOf(c); if (i >= 0) { xs.splice(i, 1); delete tsh.push; } return Array.prototype.push.apply(tsh, xs); };
    g.pair(t, po); } });
  F('GD04-025', 'full', { destroyed(g, u) { const p = u.owner; if (yourTurn(g, p) && p.units.some(x => x !== u && tr(g, x, 'Dawn of Fold'))) g.placeEX(p, 1); } });
  const ivA = (g, x) => tr(g, x, 'Academy'), ivE = (g, t) => g.ap(t) <= 5;
  F('GD04-106', 'full', cmd({ pilotName: 'Norea Du Noc',
    canMain: (g, p) => p.units.some(u => ivA(g, u) && g.canAttackThisTurn(u)) && p.opp.units.some(t => !t.rested && ivE(g, t)),
    main(g, p) { grantActiveN(g, p, ivA, ivE, p.flags.lastPayEX ? 2 : 1); },
    score: (g, p) => p.ai.unlockScore(g, p, u => ivA(g, u), t => ivE(g, t)) + ((p.res - p.resRested) < g.costOf(p, CARDS['GD04-106']) ? 0.3 : 0) }));
  F('GD04-107', 'full', cmd({ actionOnly: true, canMain: () => false, main() {}, canAction: () => true,
    defAction: {
      can: (g, p, b) => g.turnPlayer === p.opp && p.units.some(x => x.rested) && p.opp.units.some(x => x !== b.attacker && g.canAttackThisTurn(x)),
      value(g, p, b) { const t = destinedPick(g, p, b); if (!t) return 0; const rem = p.opp.units.filter(x => x !== b.attacker && g.canAttackThisTurn(x)); let v = -0.3;
        for (const a of rem) { if (!g.canAttackPlayer(a)) continue; const f = p.ai.fight(g, a, t, true); v += (f.killT ? 0.2 : 0.7) + (f.killA ? 0.5 * p.ai.unitValue(g, a) : 0); }
        if (rem.length >= p.shields.length + (p.base ? 1 : 0)) v += 3; return v; },
      run(g, p, b) { const t = destinedPick(g, p, b); if (t) t.flags.taunt = true; } } }));
  function destinedPick(g, p, b) { // sturdiest rested unit that survives the current battle
    const c = p.units.filter(x => x.rested && !(x === b.target && p.ai.fight(g, b.attacker, x, true).killT)); if (!c.length) return null;
    return c.reduce((m, x) => (g.hpLeft(x) * 2 + g.ap(x)) > (g.hpLeft(m) * 2 + g.ap(m)) ? x : m); }
  const wfeN = (g, p) => (p.res - p.resRested) < g.costOf(p, CARDS['GD04-108']) ? 4 : 2;
  const wfeVal = (g, p, a, n) => { if (!tr(g, a, 'Academy') || !g.canAttackThisTurn(a)) return -1; let best = -1;
    for (const t of p.opp.units) { if (!t.rested) continue; const f = p.ai.fight(g, a, t, true); if (f.killT && f.killA && g.ap(t) - n < g.hpLeft(a) && p.ai.unitValue(g, t) > p.ai.unitValue(g, a)) best = Math.max(best, p.ai.unitValue(g, a) * 0.7); }
    return best; };
  F('GD04-108', 'full', cmd({ pilotName: 'Sophie Pulone', actionToo: true,
    canMain: (g, p) => p.units.some(u => tr(g, u, 'Academy')),
    main(g, p) { const n = p.flags.lastPayEX ? 4 : 2; const c = p.units.filter(u => tr(g, u, 'Academy')); if (!c.length) return; const u = c.reduce((m, x) => wfeVal(g, p, x, n) > wfeVal(g, p, m, n) ? x : m); u.flags.reduceNext = Math.max(u.flags.reduceNext || 0, n); },
    score: (g, p) => Math.max(-1, ...p.units.map(u => wfeVal(g, p, u, wfeN(g, p)))) - 0.4,
    defAction: {
      can(g, p, b) { const t = b.target; if (t === 'player' || t.owner !== p || !tr(g, t, 'Academy') || !g.alive(b.attacker)) return false; const f = p.ai.fight(g, b.attacker, t, true); return f.killT && g.ap(b.attacker) - wfeN(g, p) < g.hpLeft(t); },
      value: (g, p, b) => p.ai.unitValue(g, b.target) + 0.2,
      run(g, p, b) { if (b.target !== 'player') b.target.flags.reduceNext = Math.max(b.target.flags.reduceNext || 0, p.flags.lastPayEX ? 4 : 2); } } }));
  F('GD05-026', 'full', { enemyDeployRested: (g, self, def) => def.lv <= 1 + self.owner.units.filter(x => x !== self && lfrithName(x)).length });
  F('GD05-088', 'full', { p_ap: () => 1, p_aura_ap: (g, src, other) => (other !== src && lfrithName(other)) ? 1 : 0 });
  F('GD05-107', 'full', cmd({ burst(g, p) { g.placeEX(p, 1); }, canMain: (g, p) => !!p.opp.base || p.opp.shields.length > 0,
    main(g, p) { const o = p.opp; let n = 2; if (o.base) { g.destroyBase(o); n--; } while (n-- > 0 && o.shields.length && g.winner === null) g.breakShield(p, o); },
    score: (g, p) => { const o = p.opp; const layers = (o.base ? 1 : 0) + o.shields.length; return Math.min(2, layers) * 1.7 + (layers <= 2 && p.units.some(u => g.canAttackThisTurn(u) && g.canAttackPlayer(u)) ? 2.5 : 0); } }));
  F('GD05-108', 'full', changeTargetCmd('Academy', { pilotName: 'Guel Jeturk' }));
  const felsiDraw = (x) => !!(x.pilot && x.pilot.lv <= 3);
  const felsiSaves = (g, p, b, x) => b && b.target === x && g.alive(b.attacker) && p.ai.fight(g, b.attacker, x, true).killT && g.ap(b.attacker) < g.hpLeft(x) + Math.min(2, x.dmg);
  const felsiVal = (g, p, b, x) => (felsiSaves(g, p, b, x) ? p.ai.unitValue(g, x) : 0) + (felsiDraw(x) ? 1.1 : 0) + Math.min(2, x.dmg) * 0.1;
  F('GD05-109', 'full', cmd({ pilotName: 'Felsi Rollo', actionOnly: true, canMain: () => false, main() {}, canAction: () => true,
    defAction: {
      can: (g, p) => p.units.some(x => tr(g, x, 'Academy')),
      value: (g, p, b) => Math.max(0, ...p.units.filter(x => tr(g, x, 'Academy')).map(x => felsiVal(g, p, b, x))),
      run(g, p, b) { const c = p.units.filter(x => tr(g, x, 'Academy')); if (!c.length) return; const x = c.reduce((m, y) => felsiVal(g, p, b, y) > felsiVal(g, p, b, m) ? y : m); g.heal(x, 2); if (felsiDraw(x)) g.draw(p, 1); } } }));

  // ======================= CB / GN DRIVE =======================
  F('GD03-030', 'full', { costMod: (g, p) => p.units.some(x => x.linked && tr(g, x, 'CB')) ? -1 : 0 });
  F('GD04-029', 'simplified', { note: 'once-per-turn -1 is consumed by battle damage only; effect damage is reduced unless battle damage already used it this turn',
    reduceBattleDmg(g, u, n, src) { if (n <= 0 || src.owner === u.owner || u.flags.redT === g.turn || !pilotIn(u.owner, 'CB')) return n; u.flags.redT = g.turn; return n - 1; },
    reduceEffectDmg: (g, u, d) => (u.flags.redT === g.turn || !pilotIn(u.owner, 'CB')) ? d : Math.max(0, d - 1) });
  F('ST07-007', 'full', { ap: (g, u) => (yourTurn(g, u.owner) && pilotIn(u.owner, 'CB')) ? 2 : 0 });
  F('ST07-011', 'full', { p_whenPaired(g, u) { if (!tr(g, u, 'CB')) return; const old = u.attackActiveFilter; const lv = u.def.lv; u.attackActiveFilter = t => (old && old(t)) || t.def.lv <= lv; },
    ai_whenPaired(g, p, u) { if (!tr(g, u, 'CB') || u.rested || (u.sick && !g.isLinkPilot(u.def, CARDS['ST07-011']))) return 0; let best = 0;
      for (const t of p.opp.units) { if (t.rested || t.def.lv > u.def.lv) continue; const kill = g.ap(u) + 1 >= g.hpLeft(t), die = g.ap(t) >= g.hpLeft(u) + 2;
        best = Math.max(best, (kill ? p.ai.unitValue(g, t) + (g.kw(t, 'Blocker') ? 0.8 : 0) : 0) - (die ? p.ai.unitValue(g, u) : 0)); }
      return best * 0.7; } });
  F('ST07-012', 'full', { p_noBattleDmg: (g, u, src) => yourTurn(g, u.owner) && src.owner !== u.owner && g.ap(src) <= 3 && u.owner.units.some(x => x.linked && tr(g, x, 'CB')) });

  // ======================= CLAN =======================
  const clanLow = (g, v, src) => src.owner !== v.owner && src.def.lv <= 2;
  F('ST06-013', 'full', cmd({ pilotName: 'Ortega (GQ)', actionOnly: true, canMain: () => false, main() {}, canAction: () => true,
    defAction: {
      can(g, p, b) { const t = b.target; return t !== 'player' && t.owner === p && tr(g, t, 'Clan') && g.alive(b.attacker) && b.attacker.def.lv <= 2 && p.ai.fight(g, b.attacker, t, true).killT; },
      value: (g, p, b) => p.ai.unitValue(g, b.target) + (p.ai.fight(g, b.attacker, b.target, true).killA ? 0.5 : 0.2),
      run(g, p, b) { const t = b.target; if (t === 'player') return; chainNbd(t, clanLow);
        const o = p.units.filter(x => x !== t && tr(g, x, 'Clan')); if (o.length) chainNbd(p.ai.pickBestUnit(g, p, o), clanLow); } } }));
  F('ST06-015', 'full', baseShield({ onAllyLinked(g, p, u) { if (!tr(g, u, 'Clan') || p.flags.kanebanT === g.turn) return; p.flags.kanebanT = g.turn; u.tKw.Breach = (u.tKw.Breach || 0) + 3; } }));

  // ======================= NEO ZEON =======================
  F('GD06-023', 'full', { deploy(g, u) { const p = u.owner; u.rested = true; const c = p.units.filter(x => x !== u && tr(g, x, 'Neo Zeon') && x.def.lv >= 3); if (!c.length) return;
    const lk = c.filter(x => x.linked); const t = p.ai.pickBestAttacker(g, p, lk.length ? lk : c); t.tAP += 1; if (t.linked) u.rested = false; },
    ai_deploy: (g, p) => p.units.some(x => x.linked && tr(g, x, 'Neo Zeon') && x.def.lv >= 3) ? 0.4 : 0 });

  // ======================= ZEON =======================
  F('GD02-020', 'full', { deploy(g, u) { lookTop(g, u.owner, 5, c => c.type === 'PILOT' && c.color === 'Green' && c.traits.includes('Zeon')); }, ap: (g, u) => u.linked ? 2 : 0, ai_deploy: () => 0.6 });
  F('GD02-033', 'full', { kw: (g, u, k) => (k === 'Breach' && u.owner.units.some(x => x !== u && x.linked && tr(g, x, 'Zeon'))) ? 5 : 0 });
  F('GD02-034', 'full', { ap: (g, u) => (u.pilot && (CARDS[u.pilot.id] || u.pilot).color === 'Red') ? 2 : 0 });
  F('GD02-090', 'full', { p_ap: (g, u) => u.owner.units.some(x => x !== u && g.kw(x, 'High-Maneuver') > 0) ? 1 : 0 });
  F('GD02-105', 'full', cmd({ pilotName: 'Xavier Olivette', actionOnly: true, canMain: () => false, main() {}, canAction: () => true,
    defAction: {
      can(g, p, b) { const t = b.target; return t !== 'player' && t.owner === p && t.token && g.alive(b.attacker) && p.ai.fight(g, b.attacker, t, true).killT; },
      value: (g, p, b) => p.ai.unitValue(g, b.target) + (p.ai.fight(g, b.attacker, b.target, true).killA ? p.ai.unitValue(g, b.attacker) : 0),
      run(g, p, b) { const t = b.target; if (t !== 'player') chainNbd(t, (g2, v, src, bb) => bb === b && src.owner !== v.owner); } } }));
  F('GD04-026', 'full', { deploy(g, u) { const p = u.owner; if (!p.deck.length) return; const c = p.deck[0]; if (!p.ai.keepOnTop(g, p, c)) { p.deck.shift(); p.trash.push(c); } } });
  F('GD04-028', 'full', { attack(g, u, b) { const p = u.owner, D = p.opp; const c = D.units.filter(x => !x.rested); if (!c.length) return;
    let best = null, bv = Infinity;
    for (const t of c) { const old = t.tKw.Blocker; t.tKw.Blocker = 1; let blk = null; try { blk = D.ai.bestBlockFor(g, D, u, b.target); } finally { if (old === undefined) delete t.tKw.Blocker; else t.tKw.Blocker = old; }
      const v = (blk ? 3 : 0) - (g.kw(t, 'Blocker') ? 1 : 0) + g.ap(t) * 0.2 + p.ai.unitValue(g, t) * 0.05; if (v < bv) { bv = v; best = t; } }
    best.tKw.Blocker = 1; } });
  F('GD04-088', 'full', { p_noBattleDmg: (g, u, src, b) => !!(b && b.blocked && b.attacker === u && src.owner !== u.owner && ((b.origBlocker || b.target) !== 'player') && (b.origBlocker || b.target).def.lv <= 4) });
  F('GD04-123', 'full', baseShield({ baseNoBattle: (g, D, a) => a.def.lv <= 4 && D.units.some(x => x.rested && tr(g, x, 'Zeon')) }));

  // ======================= EARTH FEDERATION / AGE =======================
  F('GD02-022', 'full', { onPlaceEX(g, u) { if (u.flags.gexT === g.turn) return; const p = u.owner; const c = p.units.filter(x => tr(g, x, 'AGE System')); if (!c.length) return;
    u.flags.gexT = g.turn; const t = p.ai.pickBestAttacker(g, p, c); t.tKw.Breach = (t.tKw.Breach || 0) + 2; } });
  F('GD02-023', 'full', { kw: (g, u, k) => (k === 'First Strike' && u.linked && g.level(u.owner) >= 7) ? 1 : 0 });
  F('GD02-088', 'full', { p_whenLinked(g, u) { lookTop(g, u.owner, 3, c => (c.type === 'UNIT' && c.color === 'Green' && c.traits.includes('Earth Federation')) || c.name.includes('AGE Device')); }, ai_whenLinked: () => 0.6 });
  F('GD02-103', 'full', cmd({ burst(g, p) { const c = p.trash.filter(x => x.type === 'PILOT' && x.traits.includes('Asuno Family')); if (!c.length) return; const x = p.ai.pickBestCard(g, p, c); fromTrash(p, x); toHand(g, p, x); },
    canMain: (g, p) => p.ex < 5 && p.units.some(u => tr(g, u, 'AGE System')), main(g, p) { if (p.units.some(u => tr(g, u, 'AGE System'))) g.placeEX(p, 1); },
    score: (g, p) => 0.4 + (g.level(p) <= 6 ? 0.4 : 0) + (p.units.some(u => u.def.id === 'GD02-022' || u.def.id === 'GD03-023') ? 0.8 : 0) }));
  F('GD02-124', 'full', baseShield({ aura_ap: (g, base, u) => (g.turnPlayer === u.owner && g.level(u.owner) >= 7 && u.def.color === 'Green' && tr(g, u, 'Earth Federation')) ? 1 : 0 }));
  F('GD03-019', 'full', { selfTaunt: (g, u) => !!u.pilot, whenLinked(g, u) { g.placeEX(u.owner, 1); }, ai_whenLinked: (g, p) => p.ex < 5 ? 0.9 : 0 });
  F('GD03-023', 'full', { onPlaceEX(g, u) { const p = u.owner; const c = p.units.filter(x => tr(g, x, 'AGE System')); if (!c.length) return;
    const pref = c.filter(x => g.canAttackThisTurn(x) && !g.kw(x, 'High-Maneuver')); const t = p.ai.pickBestAttacker(g, p, pref.length ? pref : c); t.tKw['High-Maneuver'] = 1; } });
  F('GD03-088', 'full', { p_ap: (g, u) => (u.linked && tr(g, u, 'AGE System')) ? 1 : 0, p_kw: (g, u, k) => (k === 'Breach' && u.linked && tr(g, u, 'AGE System')) ? 1 : 0 });
  F('GD05-021', 'simplified', { note: 'Activate･Action AP+4 (①, once/turn) auto-used in a unit battle when it flips the fight; once-per-turn -2 is consumed by battle damage only',
    ap(g, u) {
      const b = g.inBattle; if (!b || b.effectBattle) return 0;
      if (u.flags.dbB === b) return 4;
      if (u.flags.dbCalc || u.flags.dbT === g.turn) return 0;
      const other = b.attacker === u ? b.target : (b.target === u ? b.attacker : null);
      if (!other || other === 'player' || !g.alive(other) || !g.alive(u)) return 0;
      const p = u.owner; if (g.avail(p) < 1) return 0;
      let base, oh; u.flags.dbCalc = true; try { base = g.ap(u); oh = g.hpLeft(other); } finally { u.flags.dbCalc = false; }
      if (base >= oh || base + 4 < oh) return 0;
      if (!payQuiet(g, p, 1)) return 0; u.flags.dbB = b; u.flags.dbT = g.turn; return 4; },
    reduceBattleDmg(g, u, n, src) { if (n <= 0 || src.owner === u.owner || u.flags.redT === g.turn || !pilotIn(u.owner, 'Earth Federation')) return n; u.flags.redT = g.turn; return Math.max(0, n - 2); },
    reduceEffectDmg: (g, u, d) => (u.flags.redT === g.turn || !pilotIn(u.owner, 'Earth Federation')) ? d : Math.max(0, d - 2) });
  F('GD05-024', 'full', { destroyed(g, u) { const p = u.owner; const c = p.trash.filter(x => x.type === 'PILOT' && x.color === 'Green' && x.traits.includes('Earth Federation')); if (!c.length) return;
    const x = p.ai.pickBestCard(g, p, c); fromTrash(p, x); toHand(g, p, x); g.discard(p, 1); } });

  // ======================= OPERATION METEOR / G TEAM =======================
  F('GD01-090', 'simplified', { note: 'cancels the net negative turn/battle AP modifiers of the linked Unit (cannot tell enemy from own effects)',
    p_ap: (g, u) => { if (!u.linked) return 0; const m = u.tAP + u.bAP; return m < 0 ? -m : 0; } });
  F('GD01-091', 'full', { p_noBattleDmg: (g, u, src) => yourTurn(g, u.owner) && src.owner !== u.owner && g.kw(u, 'Breach') > 0 && g.ap(src) <= 3 });
  F('GD03-025', 'full', { tauntOthers: (g, self, t) => t.rested && tr(g, t, 'Maganac Corps') });

  // ======================= CYCLOPS TEAM =======================
  if (!EFX['T-014']) F('T-014', 'full', { note: 'Ad Balloon token: never set as active, never paired', noPilot: true, endTurn(g, u) { u.noReady = true; } });
  F('GD03-020', 'full', { whenPaired(g, u) { const p = u.owner; if (p.trash.filter(c => c.traits.includes('Cyclops Team')).length < 4) return; for (let k = 0; k < 2; k++) { const t = g.deployToken(p, 'Ad Balloon', { rested: true }); t.noReady = true; } },
    ai_whenPaired: (g, p) => (p.trash.filter(c => c.traits.includes('Cyclops Team')).length >= 4 && p.units.length <= 3) ? 1.2 : 0,
    noBattleDmg: (g, u, src) => src.owner !== u.owner && u.owner.units.some(x => x.def.name.includes('Ad Balloon')) });
  F('GD03-089', 'full', { p_ap: (g, u) => new Set(u.owner.trash.filter(c => (c.type === 'PILOT' || c.type === 'COMMAND') && c.traits.includes('Cyclops Team')).map(c => c.name)).size });

  // ======================= OTHER =======================
  F('ST14-006', 'full', { deploy(g, u) { lookTop(g, u.owner, 3, () => true); }, ai_deploy: () => 1.0,
    noBattleDmg(g, u, src) { if (!u.pilot || src.owner === u.owner || u.flags.fauT === g.turn || g.ap(src) > g.ap(u)) return false; u.flags.fauT = g.turn; return true; } });
  F('ST14-015', 'full', cmd({ burst(g, p) { g.placeEX(p, 1); }, canMain: (g, p) => p.resDeck > 0,
    main(g, p) { placeRested(p); if (!p.flags.turn.resActive) { p.flags.turn.resActive = true; p.resRested = Math.max(0, p.resRested - 1); } },
    score: (g, p) => p.resDeck <= 0 ? -1 : g.level(p) <= 7 ? 1.3 : 0.5 }));
};
