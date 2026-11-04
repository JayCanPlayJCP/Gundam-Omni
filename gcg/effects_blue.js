'use strict';
// Blue cards, batch 2 (written from official English text; 1v1: "enemy players" = 1 opponent).
// NOTES
//  Skipped: none. Simplified (see each `note`): EB01-004, EB01-014, EB01-020, GD01-014, GD02-001, GD02-009, GD02-010,
//   GD02-011, GD02-085, GD03-085, GD03-102, GD03-124, GD05-006, GD05-104, GD06-001, ST08-011, ST10-001, ST11-002, ST11-014.
//  Also registered: T-021 [Parts] token (carries GD05-084 Odelo Henrik's damage reduction).
//  Wished-for hooks / engine items:
//   - heal hook: engine g.heal / Repair firing onHealed(g,u,n) / p_onHealed. Here a local healU() fires them for this
//     file's heal effects, and end-of-turn <Repair> is detected by snapshotting u.dmg in the kw('Repair') query that
//     endPhase makes right before healing (EB01-004, GD02-001 + GD02-085). Heals from other files are not seen.
//   - pilot endTurn / start-of-turn hooks (Four Murasame on non-Psycho units, Lane Aim baselines).
//   - draw hook onDraw(g,p,n,byEffect): Lane Aim (ST08-011) only sees draws made through this file's drawE().
//   - "destroys an enemy shield area card" hook (battle and effect, with the source Unit): GD02-001 / GD05-006 / GD06-002
//     diff stats.shieldsBroken + base identity between attack declarations; ST10-001 predicts it at the attack step.
//   - post-damage / "real hit" flag for reduceEffectDmg (AI previews call it): GD02-010 records a pending hit and resolves
//     it at the Unit's next hook. Source card (Unit vs Command) for reduceEffectDmg (EB01-014).
//   - onAttacked(g,target,attacker) at attack declaration (GD06-001); onApReduced(g,u,n,src) (GD02-009).
//   - base onAllyPaired (GD03-124 Ribo Colony only sees links); flag-based untargetable (u.flags.untargetableTurn) for
//     ST11-014; per-unit granted Destroyed triggers (GD05-104); aura_reduceEffectDmg (ST11-002 protects only itself).
//   - unit 【Activate･Action】 in the battle action step (EB01-020, GD01-014, GD02-011), attacker-side defAction for
//     Commands (GD03-102), conditional battlePump (ST10-013 is Main + defensive defAction only).
//   - AI: a second attack phase after post-combat development; re-ready effects used from the main phase (V2 Gundam,
//     Tallgeese, Guncannon) can only protect/block, never re-attack.
//   - AI pilot candidates use c.cost, not g.costOf (GD03-085 Christina's 0 cost is a refund on pairing).
//   - engine: an attack with 0 AP still destroys a Shield (attack() breaks shields without checking AP) - affects
//     EB01-013 Red Gundam (0085) 0/4 and GD02-011 Moebius 0/1.
module.exports = function (F, H, EFX) {
  const { CARDS, shuffle } = require('./engine');
  const { tr, yourTurn, cmd, baseShield, dmgPick, bouncePick } = H;

  // ---------- helpers ----------
  const GG = 'G Generation';
  const isG = (g, x) => tr(g, x, GG);
  const ggTrash = (c) => c.traits.includes(GG);
  const titT = (c) => c.traits.includes('Titans');
  const allUnits = (g) => g.players[0].units.concat(g.players[1].units);
  const restedCount = (g, except) => allUnits(g).filter(x => x !== except && x.rested).length;
  const onceT = (u, k, g) => { if (u.flags[k] === g.turn) return false; u.flags[k] = g.turn; return true; }; // 【Once per Turn】
  const toHand = (g, p, c) => { p.hand.push(c); g.stats.p[p.i].extraCards++; };
  const pilotCard = (pl) => pl.cmdPilot ? CARDS[pl.id] : pl;
  const pilotColor = (pl) => (CARDS[pl.id] || pl).color;
  const ptr = (pl, t) => !!pl && (pl.traits || []).includes(t);
  function pilotTrashToHand(g, p, pilot) { const pd = pilotCard(pilot); const i = p.trash.lastIndexOf(pd); if (i < 0) return false; p.trash.splice(i, 1); toHand(g, p, pd); return true; }
  // "Return this Unit's paired Pilot to its owner's hand. Then, discard 1." (keep the returned Pilot unless it is the only choice)
  function pilotBackThenDiscard(g, p, pilot) { const pd = pilotCard(pilot); pilotTrashToHand(g, p, pilot); if (p.hand.some(c => c.id !== pd.id)) g.discard(p, 1, c => c.id !== pd.id); else g.discard(p, 1); }
  function exileN(g, p, pred, n) { // exile n matching cards from the trash (worst first); false if not enough
    if (p.trash.filter(pred).length < n) return false;
    for (let k = 0; k < n; k++) { const c = p.ai.pickWorstCard(g, p, p.trash.filter(pred)); p.trash.splice(p.trash.indexOf(c), 1); p.exile.push(c); }
    return true;
  }
  // draws made by effects (Lane Aim ST08-011: "When you draw with an effect, if this is a blue Unit, it gains <High-Maneuver>")
  function drawE(g, p, n) { g.draw(p, n); for (const x of p.units) if (x.pilot && x.pilot.id === 'ST08-011' && x.def.color === 'Blue') x.tKw['High-Maneuver'] = 1; }
  // HP recovery that fires "when this Unit recovers HP" (onHealed on the Unit's card, p_onHealed on its Pilot)
  function fireHealed(g, u, r) { const e = EFX[u.def.id]; if (e && e.onHealed) e.onHealed(g, u, r); if (u.pilot && g.alive(u)) { const pe = EFX[u.pilot.id]; if (pe && pe.p_onHealed) pe.p_onHealed(g, u, r); } }
  function healU(g, u, n) { if (!u || !g.alive(u) || n <= 0) return 0; const b = u.dmg; g.heal(u, n); const r = b - u.dmg; if (r > 0) fireHealed(g, u, r); return r; }
  const healVal = (g, p, x, n) => Math.min(x.dmg, n) * (0.2 + 0.06 * p.ai.unitValue(g, x));
  const healScore = (g, p, n, f) => Math.max(0, ...p.units.filter(x => x.dmg > 0 && (!f || f(x))).map(x => healVal(g, p, x, n)));
  function healBest(g, p, f, n) { const c = p.units.filter(x => x.dmg > 0 && (!f || f(x))); if (!c.length) return null; const t = c.reduce((a, b) => healVal(g, p, b, n) > healVal(g, p, a, n) ? b : a); healU(g, t, n); return t; }
  // end-of-turn <Repair>: endPhase queries kw(u,'Repair') right before healing, then calls endTurn(u)
  const snapRepair = (u) => { u.flags.rpSnap = u.dmg; };
  function afterRepair(g, u) { const s = u.flags.rpSnap; u.flags.rpSnap = undefined; if (s !== undefined && s > u.dmg && g.alive(u)) fireHealed(g, u, s - u.dmg); }
  // resting enemies: on our turn use the AI's rest value; on the opponent's turn stop the strongest Unit that can still attack
  const restOppVal = (g, x) => (g.canAttackThisTurn(x) ? 0.8 + 0.25 * g.ap(x) : 0.1) + (g.kw(x, 'Blocker') ? 0.3 : 0);
  const restVal = (g, p, t) => t.rested ? 0 : (g.turnPlayer === p ? p.ai.restValue(g, p, t) : restOppVal(g, t));
  function smartRest(g, p, f) { const c = p.opp.units.filter(x => !x.rested && (!f || f(x))); if (!c.length) return null; const t = c.reduce((a, b) => restVal(g, p, b) > restVal(g, p, a) ? b : a); t.rested = true; return t; }
  const restScoreS = (g, p, f) => Math.max(0, ...p.opp.units.filter(x => !x.rested && (!f || f(x))).map(x => restVal(g, p, x)));
  function ownRestCost(g, p, x) { let c = 0.15; if (yourTurn(g, p) && g.canAttackThisTurn(x)) c += 0.4 + 0.25 * g.ap(x); if (g.kw(x, 'Blocker')) c += 0.5; return c + 0.3 * p.ai.exposure(g, p, x); }
  const pickOwnRest = (g, p, c) => c.reduce((a, b) => ownRestCost(g, p, b) < ownRestCost(g, p, a) ? b : a);
  // "All enemy players each choose 1 of their active Units. Rest them." (the opponent rests its least valuable one)
  const oppRestPreview = (g, p) => { const o = p.opp; const c = o.units.filter(x => !x.rested); return c.length ? o.ai.pickRestOwn(g, o, c) : null; };
  function oppRestsOwn(g, p) { const t = oppRestPreview(g, p); if (t) t.rested = true; return t; }
  // White Ark (GD05-124): during your turn, a (League Militaire) Unit's effect that would rest your Unit may rest the Base instead
  function restOwnLM(g, p, x) { if (yourTurn(g, p) && p.base && p.base.def.id === 'GD05-124' && !p.base.rested) p.base.rested = true; else x.rested = true; }
  // shield-area destruction tracker: armed at an attack declaration, read at the next declaration / end of turn
  function sdArm(g, holder, attacker) { const D = attacker.owner.opp; holder.flags.sdPend = { turn: g.turn, sb: g.stats.p[attacker.owner.i].shieldsBroken, had: !!D.base, id: D.base ? D.base.def.id : null }; }
  function sdTake(g, holder) {
    const pd = holder.flags.sdPend; if (!pd) return 0; holder.flags.sdPend = null; if (pd.turn !== g.turn) return 0;
    const p = holder.owner, D = p.opp; let n = g.stats.p[p.i].shieldsBroken - pd.sb; if (pd.had && (!D.base || D.base.def.id !== pd.id)) n++; return n;
  }
  // best friendly attacker for "+n AP this turn" (enables a kill on a rested enemy): [unit, value]
  function pumpOne(g, p, n, f) {
    let best = null, bv = 0;
    for (const a of p.units) { if (!g.canAttackThisTurn(a) || (f && !f(a))) continue;
      for (const t of p.opp.units) { if (!t.rested) continue; const ap = g.ap(a), hl = g.hpLeft(t); if (ap >= hl || ap + n < hl) continue;
        const v = p.ai.unitValue(g, t) - (g.ap(t) >= g.hpLeft(a) ? p.ai.unitValue(g, a) : 0); if (v > bv) { bv = v; best = a; } } }
    return [best, bv];
  }
  const pumpTarget = (g, p, n, f) => { const [b] = pumpOne(g, p, n, f); if (b) return b; const c = p.units.filter(x => !f || f(x)); return c.length ? c.reduce((a, x) => (x.dmg > a.dmg || (x.dmg === a.dmg && g.ap(x) > g.ap(a))) ? x : a) : null; };

  // ======================= G GENERATION =======================
  const rfVal = (g, p, t) => restVal(g, p, t) + 0.5 * p.ai.unitValue(g, t) + (g.kw(t, 'Blocker') ? 0.4 : 0);
  const rfC = (p) => p.opp.units.filter(t => t.dmg > 0 && t.def.lv <= 7);
  F('EB01-001', 'full', { activate: { cost: 0, once: true,
    can: (g, p) => p.trash.filter(c => c.type === 'COMMAND').length >= 2 && rfC(p).length > 0,
    score: (g, p) => Math.max(...rfC(p).map(t => rfVal(g, p, t))) - 0.7,
    run(g, p) { const c = rfC(p); if (!c.length || !exileN(g, p, x => x.type === 'COMMAND', 2)) return; const t = c.reduce((a, b) => rfVal(g, p, b) > rfVal(g, p, a) ? b : a); t.rested = true; t.noReady = true; } } });
  F('EB01-002', 'full', { deploy(g, u) { if (u.owner.units.some(x => x !== u && isG(g, x))) smartRest(g, u.owner, null); },
    ai_deploy: (g, p) => p.units.some(x => isG(g, x)) ? restScoreS(g, p, null) : 0,
    attack(g, u) { if (u.linked && restedCount(g, u) >= 3 && onceT(u, 'hinu', g)) u.rested = false; } });
  F('EB01-003', 'full', { endTurn(g, u) { if (!u.rested) return; let n = 0; for (const x of allUnits(g)) if (!x.rested) { x.rested = true; n++; } if (n >= 3) drawE(g, u.owner, 1); } });
  F('EB01-004', 'simplified', { note: 'HP-recovery trigger sees end-of-turn <Repair> and heals made by effects_blue.js only',
    kw(g, u, k) { if (k === 'Repair') snapRepair(u); return 0; }, endTurn(g, u) { afterRepair(g, u); },
    onHealed(g, u) { if (yourTurn(g, u.owner) && onceT(u, 'lrex', g)) dmgPick(g, u.owner, 1, x => x.rested); } });
  const actPenalty = (g, p, t) => (g.kw(t, 'Blocker') ? 1.0 : 0.15) + (yourTurn(g, p) && p.units.some(a => g.canAttackThisTurn(a) && g.ap(a) >= g.hpLeft(t)) ? 0.7 * p.ai.unitValue(g, t) : 0);
  F('EB01-005', 'full', { deploy(g, u) { const p = u.owner; const c = p.opp.units.filter(t => t.rested); if (c.length) c.reduce((a, b) => actPenalty(g, p, b) < actPenalty(g, p, a) ? b : a).rested = false; drawE(g, p, 1); },
    ai_deploy: (g, p) => { const c = p.opp.units.filter(t => t.rested); return 1.2 - (c.length ? Math.min(...c.map(t => actPenalty(g, p, t))) : 0); } });
  F('EB01-008', 'full', { deploy(g, u) { const p = u.owner; if (healScore(g, p, 2) > 0.3 && exileN(g, p, ggTrash, 1)) healBest(g, p, null, 2); },
    ai_deploy: (g, p) => p.trash.some(ggTrash) ? healScore(g, p, 2) : 0 });
  F('EB01-009', 'full', { deploy(g, u) { oppRestsOwn(g, u.owner); }, ai_deploy: (g, p) => { const t = oppRestPreview(g, p); return t ? restVal(g, p, t) : 0; } });
  F('EB01-010', 'full', { deploy(g, u) { const p = u.owner; if (p.ai.bestDamageValue(g, p, 2, x => x.rested) >= 0.9 && exileN(g, p, ggTrash, 3)) dmgPick(g, p, 2, x => x.rested); },
    ai_deploy: (g, p) => p.trash.filter(ggTrash).length >= 3 ? Math.max(0, p.ai.bestDamageValue(g, p, 2, x => x.rested) - 0.3) : 0 });
  F('EB01-013', 'full', { attack(g, u) { if (u.owner.opp.hand.length >= 6) u.tAP += 2; } });
  // source of enemy effect damage: the attacking Unit during a battle, else a just-deployed enemy Unit (deploy trigger); Commands otherwise
  function lowLvSource(g, u) { const o = u.owner.opp; const b = g.inBattle; if (b && b.attacker && b.attacker.owner === o) return b.attacker.def.lv <= 5;
    const last = o.units[o.units.length - 1]; return !!(last && last.sick && !last.token && last.def.lv <= 5); }
  F('EB01-014', 'simplified', { note: 'effect source unknown: treated as the attacking enemy Unit in battle, else a just-deployed enemy Unit (else a Command: no protection)',
    reduceEffectDmg: (g, u, d) => (g.turnPlayer === u.owner.opp && lowLvSource(g, u)) ? 0 : d });
  F('EB01-015', 'full', { destroyed(g, u) { if (restedCount(g, u) >= 2) dmgPick(g, u.owner, 1, x => x.rested); } });
  F('EB01-017', 'full', { destroyed(g, u, pilot, cause) { if (!cause || !cause.battle) return; drawE(g, u.owner, 1); drawE(g, cause.by && cause.by.owner ? cause.by.owner : u.owner.opp, 1); } });
  F('EB01-019', 'full', { attack(g, u) { if (restedCount(g, u) >= 2) u.bKw['High-Maneuver'] = 1; } });
  const healAct = (needLink) => ({ note: '【Activate･Action】 used in the main phase (no unit action-step hook)',
    activate: { cost: 0, once: true, can: (g, p, u) => (!needLink || u.linked) && p.units.some(x => x.dmg > 0), score: (g, p) => healScore(g, p, 1) + 0.05, run(g, p) { healBest(g, p, null, 1); } } });
  F('EB01-020', 'simplified', healAct(true));
  F('EB01-061', 'full', { p_whenPaired(g, u) { if (u.owner.units.some(x => isG(g, x))) smartRest(g, u.owner, x => x.def.lv <= 3); },
    ai_whenPaired: (g, p, u) => (isG(g, u) || p.units.some(x => isG(g, x))) ? restScoreS(g, p, x => x.def.lv <= 3) : 0 });
  F('EB01-062', 'full', { p_attack(g, u) { const p = u.owner, o = p.opp; if (!onceT(u, 'jona', g)) return; if (o.deck.length > 5 && o.hand.length <= 6) { drawE(g, o, 1); drawE(g, p, 1); } } });
  F('EB01-063', 'full', { p_kw: (g, u, k) => (k === 'Repair' && restedCount(g, u) >= 2) ? 2 : 0 });
  F('EB01-064', 'full', { p_kw: (g, u, k) => (k === 'Breach' && g.kw(u, 'Repair') > 0) ? 1 : 0 });
  F('EB01-073', 'full', cmd({ burst(g, p) { drawE(g, p, 1); }, canMain: (g) => restedCount(g, null) >= 6, main(g, p) { if (restedCount(g, null) >= 6) drawE(g, p, 2); }, score: () => 2.3 }));
  const erOwn = (g, p) => p.units.filter(x => !x.rested && isG(g, x));
  F('EB01-074', 'full', cmd({ burst(g, p) { smartRest(g, p, x => g.hpLeft(x) <= 3); }, actionToo: true,
    canMain: (g, p) => erOwn(g, p).length > 0 && p.opp.units.some(x => !x.rested),
    main(g, p) { const own = erOwn(g, p); if (!own.length) return; pickOwnRest(g, p, own).rested = true; oppRestsOwn(g, p); },
    score: (g, p) => { const own = erOwn(g, p); const t = oppRestPreview(g, p); if (!own.length || !t) return -1; return restVal(g, p, t) - ownRestCost(g, p, pickOwnRest(g, p, own)) - 0.6; } }));
  F('EB01-085', 'full', baseShield({ baseDeploy(g, p) {
    const own = p.units.filter(x => !x.rested && x.def.color === 'Blue' && isG(g, x)); const en = p.opp.units.filter(x => !x.rested); if (!own.length || !en.length) return;
    const o = pickOwnRest(g, p, own); const t = en.reduce((a, b) => restVal(g, p, b) > restVal(g, p, a) ? b : a);
    if (restVal(g, p, t) - ownRestCost(g, p, o) < 0.2) return; o.rested = true; t.rested = true; } }));
  F('EB01-086', 'full', baseShield({ onAllyLinked(g, p, u) { if (isG(g, u) && !p.flags.turn.gwazine) { p.flags.turn.gwazine = true; u.tKw.Repair = (u.tKw.Repair || 0) + 2; } } }));
  // Zeta Gundam (EX): set active after destroying a shield-area card with battle damage; can't attack the player again
  F('ST10-001', 'simplified', { note: 'shield/base destruction predicted at the attack step (undone if blocked); a 2nd attack on the player is redirected to the best rested enemy Unit or cancelled',
    attack(g, u, b) { const p = u.owner, D = p.opp; u.flags.zPend = null;
      if (b.target === 'player' && u.flags.zNoP === g.turn) {
        const c = p.ai.attackTargets(g, p, u).filter(t => t !== 'player' && g.alive(t)); const t = c.length ? p.ai.pickFightTarget(g, p, u, c) : null;
        if (t) b.target = t; else { b.target = { owner: D, def: u.def, cancelled: true }; u.rested = false; u.flags.zStop = g.turn; } // not alive -> battle ends
        return; }
      if (b.target !== 'player') return;
      const be = D.base && EFX[D.base.def.id];
      const hit = D.base ? (g.ap(u) >= D.base.def.hp - D.base.dmg && !(be && be.baseNoBattle && be.baseNoBattle(g, D, u))) : D.shields.length > 0;
      if (hit) { u.rested = false; u.flags.zPend = g.turn; u.flags.zNoP = g.turn; } },
    noBattleDmg(g, u, src, b) { if (b && b.blocked && b.attacker === u && u.flags.zPend === g.turn) { u.rested = true; u.flags.zPend = null; u.flags.zNoP = null; } return false; },
    cannotAttack: (g, u) => u.flags.zStop === g.turn });
  F('ST10-002', 'full', { deploy(g, u) { const p = u.owner; if (restScoreS(g, p, x => g.hpLeft(x) <= 4) >= 0.6 && exileN(g, p, ggTrash, 2)) smartRest(g, p, x => g.hpLeft(x) <= 4); },
    ai_deploy: (g, p) => p.trash.filter(ggTrash).length >= 2 ? Math.max(0, restScoreS(g, p, x => g.hpLeft(x) <= 4) - 0.2) : 0 });
  F('ST10-011', 'full', { p_whenLinked(g, u) { if (restedCount(g, null) >= 2) smartRest(g, u.owner, x => x.def.lv <= u.def.lv); },
    ai_whenLinked: (g, p, u) => restedCount(g, null) >= 2 ? restScoreS(g, p, x => x.def.lv <= u.def.lv) : 0 });
  const ttF = (g, x) => isG(g, x) && x.def.lv >= 5;
  F('ST10-013', 'full', cmd({ actionToo: true, canMain: (g, p) => p.units.some(x => ttF(g, x)),
    main(g, p) { const t = pumpTarget(g, p, 2, x => ttF(g, x)); if (!t) return; healU(g, t, 2); t.tAP += 2; },
    score: (g, p) => pumpOne(g, p, 2, x => ttF(g, x))[1] + healScore(g, p, 2, x => ttF(g, x)) - 0.9,
    defAction: { can: (g, p, b) => b.target !== 'player' && b.target.owner === p && g.alive(b.target) && g.alive(b.attacker) && ttF(g, b.target),
      value(g, p, b) { const m = b.target, a = b.attacker; const f0 = p.ai.fight(g, a, m, true); const sd = m.dmg, sb = m.bAP; m.dmg = Math.max(0, m.dmg - 2); m.bAP += 2; const f1 = p.ai.fight(g, a, m, true); m.dmg = sd; m.bAP = sb;
        return (f0.killT && !f1.killT ? p.ai.unitValue(g, m) : 0) + (!f0.killA && f1.killA ? p.ai.unitValue(g, a) : 0); },
      run(g, p, b) { const m = b.target; healU(g, m, 2); m.tAP += 2; } } }));
  const udAlt = (g, p) => { const c = p.hand.filter(x => x.type === 'UNIT' && ggTrash(x)); return c.length > 0 && (g.level(p) < 4 || p.ai.cardValue(g, p, p.ai.pickWorstCard(g, p, c)) <= 3.6); };
  F('ST10-014', 'full', cmd({ costMod: (g, p) => udAlt(g, p) ? -2 : 0, lvMod: (g, p) => udAlt(g, p) ? -2 : 0, canMain: () => true,
    main(g, p) { if (udAlt(g, p)) g.discard(p, 1, c => c.type === 'UNIT' && ggTrash(c)); drawE(g, p, 2); }, score: (g, p) => udAlt(g, p) ? 1.5 : 2.2 }));

  // ======================= TITANS / JUPITRIS =======================
  const psyOn = (u) => ptr(u.pilot, 'Cyber-Newtype');
  function psyResolve(g, u) { const n = sdTake(g, u); if (n > 0 && psyOn(u) && g.alive(u)) for (let k = 0; k < n; k++) healU(g, u, 2); }
  F('GD02-001', 'simplified', { note: 'shield-area cards destroyed during a (Titans) Unit\'s attack are counted (stats diff) and the 2-HP recoveries applied at the next attack declaration / end of turn',
    kw(g, u, k) { if (k === 'Repair') snapRepair(u); return 0; },
    attack(g, u) { psyResolve(g, u); sdArm(g, u, u); },
    onAllyAttack(g, u, a) { psyResolve(g, u); if (tr(g, a, 'Titans')) sdArm(g, u, a); },
    endTurn(g, u) { afterRepair(g, u); psyResolve(g, u); } });
  F('GD02-003', 'full', { destroyed(g, u, pilot) { if (!pilot || pilot.lv > 3) return; const p = u.owner; const c = p.hand.filter(x => x.type === 'UNIT'); if (!c.length) return;
    const w = p.ai.pickWorstCard(g, p, c); if (p.ai.cardValue(g, p, w) > 2.6 || p.trash.lastIndexOf(pilotCard(pilot)) < 0) return;
    p.hand.splice(p.hand.indexOf(w), 1); p.trash.push(w); pilotTrashToHand(g, p, pilot); } });
  F('GD02-085', 'simplified', { note: 'recovery seen only from effects_blue.js heals and end-of-turn <Repair> on Psycho Gundam (GD02-001, its only link Unit)',
    p_onHealed(g, u) { const p = u.owner; if (u.linked && yourTurn(g, p) && p.hand.length <= 4 && onceT(u, 'four', g)) drawE(g, p, 1); } });
  F('GD03-002', 'full', { onAllyAttack(g, u, a) { if (u.pilot && g.kw(a, 'Repair') > 0) smartRest(g, u.owner, x => x.def.lv <= a.def.lv); } });
  F('GD03-009', 'full', { deploy(g, u) { const p = u.owner; if (restScoreS(g, p, x => x.def.lv <= 4) >= 0.6 && exileN(g, p, titT, 2)) smartRest(g, p, x => x.def.lv <= 4); },
    ai_deploy: (g, p) => p.trash.filter(titT).length >= 2 ? Math.max(0, restScoreS(g, p, x => x.def.lv <= 4) - 0.2) : 0 });
  F('GD03-014', 'full', { costMod: (g, p) => p.units.filter(x => tr(g, x, 'Titans')).length >= 2 ? -1 : 0 });
  F('GD03-015', 'full', { activate: { cost: 0, once: true, can: (g, p, u) => p.trash.filter(titT).length >= 3 && g.canAttackThisTurn(u) && p.opp.units.some(t => t.rested),
    score: (g, p, u) => { let best = -1; for (const t of p.opp.units) { if (!t.rested) continue; const f = p.ai.fight(g, u, t, true); if (f.killT) best = Math.max(best, f.killA ? 0.5 : 1.6); } return best; },
    run(g, p, u) { if (exileN(g, p, titT, 3)) u.tKw.Breach = (u.tKw.Breach || 0) + 4; } } });
  F('GD03-084', 'full', { p_whenLinked(g, u) { const p = u.owner; const o = p.units.filter(x => x !== u); if (!o.length) return;
    const val = (x) => (tr(g, x, 'Jupitris') ? 3 : 0) + (x.dmg > 0 ? 1 : 0) + (g.canAttackThisTurn(x) ? 0.5 : 0) + 0.05 * p.ai.unitValue(g, x);
    const t = o.reduce((a, b) => val(b) > val(a) ? b : a); t.tKw.Repair = (t.tKw.Repair || 0) + 2; if (tr(g, t, 'Jupitris')) drawE(g, p, 1); },
    ai_whenLinked: (g, p, u) => p.units.some(x => x !== u && tr(g, x, 'Jupitris')) ? 1.3 : 0.2 });
  F('GD03-086', 'full', { p_attack(g, u, b) { const p = u.owner; const c = p.units.filter(x => tr(g, x, 'Titans') && x.def.lv <= u.def.lv); if (!c.length) return;
    const self = c.includes(u) && (b.target !== 'player' || !!p.opp.base); const later = c.filter(x => x !== u && g.canAttackThisTurn(x));
    const t = self ? u : later.length ? later.reduce((a, x) => g.ap(x) > g.ap(a) ? x : a) : c[0]; t.tAP += 1; } });
  const hcN = (p) => p.trash.filter(c => c.name.includes('A Healthy Curiosity')).length;
  F('GD03-101', 'full', cmd({ canMain: () => true, main(g, p) { drawE(g, p, 1); if (hcN(p) >= 2) smartRest(g, p, x => g.hpLeft(x) <= 4); },
    score: (g, p) => 1.0 + (hcN(p) >= 2 ? restScoreS(g, p, x => g.hpLeft(x) <= 4) : 0) }));
  F('GD03-102', 'simplified', cmd({ note: 'Action used by the defender only (sets its battling Titans Link Unit active); attacker re-ready not available to the AI',
    burst(g, p) { drawE(g, p, 1); }, actionOnly: true, canMain: () => false, main() {},
    defAction: { can: (g, p, b) => b.target !== 'player' && b.target.owner === p && b.target.linked && tr(g, b.target, 'Titans') && g.alive(b.attacker),
      value: (g, p, b) => p.ai.fight(g, b.attacker, b.target, true).killT ? 0 : 0.4 + (g.kw(b.target, 'Blocker') ? 0.6 : 0) + 0.3 * p.ai.exposure(g, p, b.target),
      run(g, p, b) { if (g.alive(b.target)) b.target.rested = false; } } }));
  const jupLink = (g, p) => p.units.some(x => x.linked && tr(g, x, 'Jupitris'));
  F('GD03-104', 'full', cmd({ pilotName: 'Reccoa Londe', actionToo: true, canMain: (g, p) => p.opp.units.some(x => !x.rested && g.hpLeft(x) <= 3),
    main(g, p) { const f = x => g.hpLeft(x) <= 3; const two = jupLink(g, p); smartRest(g, p, f); if (two) smartRest(g, p, f); },
    score: (g, p) => restScoreS(g, p, x => g.hpLeft(x) <= 3) * (jupLink(g, p) ? 1.5 : 1) - 0.5 }));
  F('GD03-123', 'full', baseShield({ baseDeploy(g, p) { if (p.units.some(x => tr(g, x, 'Jupitris'))) smartRest(g, p, x => x.def.lv <= 3); } }));
  F('GD04-004', 'full', { whenPaired(g, u) { mk2Draw(g, u, u); }, onAllyPaired(g, u, x) { mk2Draw(g, u, x); } });
  function mk2Draw(g, s, unit) { if (ptr(unit.pilot, 'Cyber-Newtype') && unit.def.color === 'Blue' && onceT(s, 'pmk2', g)) drawE(g, s.owner, 1); }
  F('GD04-082', 'full', { p_whenLinked(g, u) { const p = u.owner; if (p.opp.units.some(x => x.rested)) { dmgPick(g, p, 1, x => x.rested); return; }
    const own = p.units.filter(x => x.rested); if (!own.length) return; const safe = own.filter(x => g.hpLeft(x) > 1);
    const t = safe.length ? safe.reduce((a, x) => g.hpLeft(x) > g.hpLeft(a) ? x : a) : own.reduce((a, x) => p.ai.unitValue(g, x) < p.ai.unitValue(g, a) ? x : a); g.effectDamage(p, t, 1); },
    ai_whenLinked: (g, p) => p.opp.units.some(x => x.rested) ? p.ai.bestDamageValue(g, p, 1, x => x.rested) : (p.units.some(x => x.rested) ? -0.3 : 0) });
  F('GD05-007', 'full', { ap: (g, u) => u.linked ? 2 : 0, kw: (g, u, k) => (k === 'Repair' && u.linked) ? 1 : 0 });
  F('GD05-103', 'full', cmd({ pilotName: 'Buran Blutarch', actionToo: true, battlePump: 2, canMain: (g, p) => p.units.length > 0,
    main(g, p) { const t = pumpTarget(g, p, 2, null); if (!t) return; healU(g, t, 1); t.tAP += 2; }, score: (g, p) => pumpOne(g, p, 2, null)[1] - 0.7,
    action(g, p, b, role, unit) { const t = unit || (b && b.target !== 'player' && b.target.owner === p ? b.target : (b && b.attacker && b.attacker.owner === p ? b.attacker : null)); if (!t || !g.alive(t)) return; healU(g, t, 1); t.tAP += 2; } }));

  // ======================= LEAGUE MILITAIRE =======================
  F('GD04-011', 'full', { destroyed(g, u) { const p = u.owner; if (p.units.some(x => tr(g, x, 'League Militaire')) && p.units.length < 6) g.deployToken(p, 'Parts'); } });
  F('GD04-013', 'full', { aura_kw: (g, src, u, k) => (k === 'Blocker' && src.rested && u.token && tr(g, u, 'League Militaire')) ? 1 : 0 });
  F('GD04-015', 'full', { deploy(g, u) { const p = u.owner; const own = p.units.filter(x => !x.rested && tr(g, x, 'League Militaire')); if (own.length) restOwnLM(g, p, pickOwnRest(g, p, own)); smartRest(g, p, x => x.def.lv <= 3); },
    ai_deploy: (g, p) => restScoreS(g, p, x => x.def.lv <= 3) - (p.base && p.base.def.id === 'GD05-124' && !p.base.rested ? 0 : 0.25) });
  F('GD04-083', 'full', { p_aura_ap: (g, src, u) => (u.token && tr(g, u, 'League Militaire')) ? 1 : 0 });
  F('GD05-001', 'full', { activate: { cost: 0, once: true, can: (g, p, u) => u.rested && p.units.filter(x => x !== u && !x.rested).length >= 2,
    score: (g, p, u) => { const o = v2Pay(g, p, u); const cost = o.reduce((s, x) => s + ownRestCost(g, p, x), 0);
      const gain = (!p.flags.turn.attacked && !u.sick) ? 0.8 + 0.25 * g.ap(u) : 0.5 * p.ai.exposure(g, p, u) + (g.kw(u, 'Blocker') ? 0.5 : 0); return gain - cost; },
    run(g, p, u) { for (const x of v2Pay(g, p, u)) x.rested = true; u.rested = false; } } });
  function v2Pay(g, p, u) { return p.units.filter(x => x !== u && !x.rested).sort((a, b) => ownRestCost(g, p, a) - ownRestCost(g, p, b)).slice(0, 2); }
  const odeloN = (p) => p.units.filter(x => x.pilot && x.pilot.id === 'GD05-084').length;
  F('GD05-084', 'full', { note: 'reduction lives on the [Parts] token (T-021), the only (League Militaire) Unit token' });
  if (!EFX['T-021']) F('T-021', 'full', { note: 'Parts token: GD05-084 Odelo Henrik reduces enemy effect damage by 1 per Odelo in play', reduceEffectDmg: (g, u, d) => Math.max(0, d - odeloN(u.owner)) });
  F('GD05-104', 'simplified', cmd({ note: 'used by the defender when its Shrike Team Link Unit is predicted to die; the granted Destroyed effect resolves at the action step', pilotName: 'Helen Jackson',
    actionOnly: true, canMain: () => false, main() {},
    defAction: { can: (g, p, b) => { const m = b.target; return m !== 'player' && m.owner === p && m.linked && tr(g, m, 'Shrike Team') && g.alive(b.attacker) && p.ai.fight(g, b.attacker, m, true).killT && p.units.some(x => x !== m && x.rested && tr(g, x, 'League Militaire')); },
      value: (g, p, b) => Math.max(0, ...p.units.filter(x => x !== b.target && x.rested && tr(g, x, 'League Militaire')).map(x => 0.6 + (g.kw(x, 'Blocker') ? 0.7 : 0) + 0.4 * p.ai.exposure(g, p, x))),
      run(g, p, b) { const c = p.units.filter(x => x !== b.target && x.rested && tr(g, x, 'League Militaire')); if (c.length) c.reduce((a, x) => p.ai.unitValue(g, x) > p.ai.unitValue(g, a) ? x : a).rested = false; } } }));
  F('GD05-124', 'full', baseShield({ note: 'replacement applied by effects_blue restOwnLM (Gun EZ GD04-015 is the only own-rest League Militaire effect; V-Dash/V2 rests are costs)' }));

  // ======================= EARTH FEDERATION / WHITE BASE TEAM / ALBION SQUAD =======================
  const umLink = (p) => p.units.find(x => x.linked && x.def.name.includes('Unicorn Mode') && x.def.lv === 5);
  F('GD01-002', 'full', { note: 'alternative play always taken when a Lv.5 "Unicorn Mode" Link Unit is in play',
    costMod: (g, p) => umLink(p) ? -6 : 0, lvMod: (g, p) => umLink(p) ? -7 : 0,
    deploy(g, u) { const um = umLink(u.owner); if (um) g.destroy(um, { effect: true, by: u.owner }); },
    ai_deploy: (g, p) => { const um = umLink(p); return um ? -Math.max(0, p.ai.unitValue(g, um) - 2.5) : 0; },
    attack(g, u) { smartRest(g, u.owner, null); } });
  F('GD01-003', 'full', { attack(g, u) { const p = u.owner; if (!u.linked || p.trash.length < 12) return;
    const pick = [...p.trash].sort((a, b) => p.ai.cardValue(g, p, b) - p.ai.cardValue(g, p, a)).slice(0, 12);
    for (const c of pick) p.trash.splice(p.trash.indexOf(c), 1); p.deck.push(...pick); shuffle(p.deck, g.rng); u.rested = false; u.tKw['First Strike'] = 1; } });
  F('GD01-005', 'full', { destroyed(g, u, pilot) { if (!u.linked || !pilot) return; pilotBackThenDiscard(g, u.owner, pilot); } });
  F('GD01-014', 'simplified', healAct(true));
  F('GD01-089', 'full', { p_ap: (g, u) => g.kw(u, 'Repair') > 0 ? 1 : 0 });
  F('GD01-124', 'full', baseShield({ activate: { cost: 0, restBase: true, can: (g, p) => p.units.some(x => x.dmg > 0), score: (g, p) => healScore(g, p, 1) + 0.05, run(g, p) { healBest(g, p, null, 1); } } }));
  F('GD03-085', 'simplified', { note: '0 cost modelled as a 1-Resource refund when paired with a "Gundam NT-1" Unit (AI pilot candidates ignore costMod)',
    p_whenPaired(g, u) { const p = u.owner; if (!u.def.name.includes('Gundam NT-1')) return; if (p.flags.lastPayEX) p.ex = Math.min(5, p.ex + 1); else p.resRested = Math.max(0, p.resRested - 1); },
    ai_whenPaired: (g, p, u) => u.def.name.includes('Gundam NT-1') ? 1.0 : 0 });
  F('GD03-124', 'simplified', baseShield({ note: 'pairing trigger only seen when the Pilot links (no base onAllyPaired hook)',
    onAllyLinked(g, p, u) { if (u.pilot && u.pilot.lv <= 3 && !p.flags.turn.ribo) { p.flags.turn.ribo = true; smartRest(g, p, x => g.hpLeft(x) <= 3); } } }));
  F('GD04-001', 'full', { note: 'returns the Pilot when the Unit would be destroyed in this battle anyway (unless that costs the kill)',
    attack(g, u, b) { if (!u.linked || !u.pilot || b.target === 'player' || pilotColor(u.pilot) !== 'Blue') return; const p = u.owner, t = b.target;
      const f = p.ai.fight(g, u, t, true); if (!f.killA) return;
      const pl = u.pilot; u.pilot = null; u.linked = false; const apNo = g.ap(u), hpNo = g.hpLeft(u); u.pilot = pl; u.linked = true;
      if (f.killT && !(hpNo > 0 && apNo >= g.hpLeft(t))) return;
      u.pilot = null; u.linked = false; toHand(g, p, pilotCard(pl)); if (g.hpLeft(u) <= 0) g.destroy(u, { effect: true, by: p }); } });
  const gcVal = (g, x) => (x.rested ? 1 + (g.turnPlayer === x.owner && (!x.sick || x.linked) ? 0.5 : 0) : 0) + 0.01 * g.ap(x);
  F('GD04-009', 'full', { whenLinked(g, u) { const c = u.owner.units.filter(x => x !== u && tr(g, x, 'White Base Team') && x.def.lv >= 4); if (c.length) c.reduce((a, b) => gcVal(g, b) > gcVal(g, a) ? b : a).rested = false; },
    ai_whenLinked: (g, p, u) => p.units.some(x => x !== u && x.rested && tr(g, x, 'White Base Team') && x.def.lv >= 4) ? 0.7 : 0 });
  const efAct = (g, p) => p.units.filter(x => !x.rested && tr(g, x, 'Earth Federation'));
  F('GD04-122', 'full', baseShield({ activate: { cost: 0, once: true, can: (g, p) => efAct(g, p).length > 0 && p.opp.units.some(x => !x.rested && x.def.lv <= 3),
    score: (g, p) => restScoreS(g, p, x => x.def.lv <= 3) - ownRestCost(g, p, pickOwnRest(g, p, efAct(g, p))),
    run(g, p) { pickOwnRest(g, p, efAct(g, p)).rested = true; smartRest(g, p, x => x.def.lv <= 3); } } }));
  F('GD06-001', 'simplified', { note: '"When this Unit is attacked" detected at the damage step (no attack-declaration hook for the target)',
    kw: (g, u, k) => (k === 'High-Maneuver' && u.pilot) ? 1 : 0,
    noBattleDmg(g, u, src, b) { if (b && !b.effectBattle && !b.blocked && b.target === u && b.attacker === src && src.owner !== u.owner && onceT(u, 'gp01fb', g)) drawE(g, u.owner, 1); return false; } });
  F('GD06-004', 'full', { destroyed(g, u, pilot) { if (!u.linked || !pilot || !yourTurn(g, u.owner)) return; pilotBackThenDiscard(g, u.owner, pilot); } });
  F('GD06-008', 'full', { attack(g, u) { const b = u.owner.base; if (b && (b.def.traits || []).includes('Earth Federation')) u.tAP += 2; } });
  F('ST08-006', 'full', { attack(g, u, b) { const p = u.owner; if (!u.pilot || b.target !== 'player' || !p.hand.some(x => x.type === 'UNIT' && x.traits.includes('Earth Federation')) || !onceT(u, 'pen', g)) return;
    const w = p.ai.pickWorstCard(g, p, p.hand.filter(x => x.type === 'UNIT' && x.traits.includes('Earth Federation'))); p.hand.splice(p.hand.indexOf(w), 1); p.deck.push(w); drawE(g, p, 2); } });
  const jgVal = (g, p, t) => 0.5 * p.ai.unitValue(g, t) + (g.kw(t, 'Blocker') ? 0.5 : 0);
  F('ST08-009', 'full', { deploy(g, u) { const p = u.owner; const c = p.opp.units.filter(t => t.rested && t.def.lv <= 2); if (c.length) c.reduce((a, t) => jgVal(g, p, t) > jgVal(g, p, a) ? t : a).noReady = true; },
    ai_deploy: (g, p) => Math.max(0, ...p.opp.units.filter(t => t.rested && t.def.lv <= 2).map(t => jgVal(g, p, t))) });
  F('ST08-011', 'simplified', { note: 'only draws made by effects_blue.js effects grant <High-Maneuver> (no engine draw hook)' });
  F('ST08-015', 'full', baseShield({ activate: { cost: 2, once: true, can: (g, p) => p.units.some(x => x.dmg > 0), score: (g, p) => healScore(g, p, 2) - 0.4, run(g, p) { healBest(g, p, null, 2); } } }));

  // ======================= ORB / ALPHACIDE =======================
  const orbN = (g, p) => p.units.some(x => x.def.lv >= 6) ? 0 : p.units.filter(x => tr(g, x, 'Orb')).length;
  F('GD05-004', 'full', { lvMod: (g, p) => -orbN(g, p), costMod: (g, p) => -orbN(g, p), whenLinked(g, u) { bouncePick(g, u.owner, x => x.def.lv <= 4); },
    ai_whenLinked: (g, p) => Math.max(0, ...p.opp.units.filter(x => x.def.lv <= 4).map(x => p.ai.removalValue(g, p, x, 'hand'))) });
  F('GD05-016', 'full', { deploy(g, u) { u.tKw['High-Maneuver'] = 1; }, onAllyDeploy(g, u, x) { if (tr(g, x, 'Orb')) u.tKw['High-Maneuver'] = 1; } });
  const ijHeal = (g, u) => { if (yourTurn(g, u.owner) && onceT(u, 'ij', g)) healBest(g, u.owner, x => tr(g, x, 'Orb'), 3); };
  F('GD06-002', 'full', { note: 'shield-area kills are read from stats at the next attack declaration / end of turn',
    onBattleKill(g, u) { ijHeal(g, u); }, attack(g, u) { if (sdTake(g, u) > 0) ijHeal(g, u); sdArm(g, u, u); },
    onAllyAttack(g, u) { if (sdTake(g, u) > 0) ijHeal(g, u); }, endTurn(g, u) { if (sdTake(g, u) > 0) ijHeal(g, u); },
    deploy(g, u) { const p = u.owner; const c = p.opp.units.filter(x => !x.rested); if (!c.length || Math.max(...c.map(x => p.ai.removalValue(g, p, x, 'hand'))) < 1.8) return;
      if (exileN(g, p, x => x.type === 'UNIT', 3)) bouncePick(g, p, x => !x.rested); },
    ai_deploy: (g, p) => p.trash.filter(x => x.type === 'UNIT').length >= 3 ? Math.max(0, ...p.opp.units.filter(x => !x.rested).map(x => p.ai.removalValue(g, p, x, 'hand') - 0.4)) : 0 });
  F('GD06-003', 'full', { ap: (g, u) => u.owner.hand.length, attack(g, u) { const p = u.owner; if (p.units.some(x => x !== u && tr(g, x, 'Alphacide')) && p.hand.length <= 5) drawE(g, p, 1); } });
  F('GD06-005', 'full', { attack(g, u, b) { const p = u.owner; const kills = b.target !== 'player' && p.ai.fight(g, u, b.target, true).killT; bouncePick(g, p, x => x.dmg > 0 && x.def.lv <= 5 && !(kills && x === b.target)); } });
  F('GD06-006', 'full', { deploy(g, u) { if (u.owner.units.some(x => x !== u && tr(g, x, 'Alphacide'))) bouncePick(g, u.owner, x => g.hpLeft(x) <= 3); },
    ai_deploy: (g, p) => p.units.some(x => tr(g, x, 'Alphacide')) ? Math.max(0, ...p.opp.units.filter(x => g.hpLeft(x) <= 3).map(x => p.ai.removalValue(g, p, x, 'hand'))) : 0 });

  // ======================= EARTH ALLIANCE =======================
  F('GD02-006', 'full', { noBattleDmg: (g, u, src) => g.turnPlayer === u.owner && src.owner !== u.owner && src.def.lv <= 2 });
  const calChk = (g, u) => { if ((u.tAP < 0 || u.bAP < 0) && onceT(u, 'cal', g)) dmgPick(g, u.owner, 2, x => x.rested); };
  F('GD02-009', 'simplified', { note: 'AP reduction (net negative tAP/bAP) checked at its battle damage step, attack declarations and end of turn',
    noBattleDmg(g, u, src) { calChk(g, u); return !g.alive(src); }, attack(g, u) { calChk(g, u); }, onAllyAttack(g, u) { calChk(g, u); }, endTurn(g, u) { calChk(g, u); } });
  // Raider: reduceEffectDmg (also called by AI previews) records a pending hit; it resolves at the Unit's next hook
  const rdRes = (g, u) => { const pd = u.flags.rdPend; if (!pd) return; u.flags.rdPend = null; if (u.dmg > pd.dmg && onceT(u, 'raider', g)) drawE(g, u.owner, 1); };
  F('GD02-010', 'simplified', { note: 'draw resolves at the Unit\'s next hook (battle damage step, attack, deploy, destroyed, end/start of turn) instead of immediately',
    reduceEffectDmg(g, u, d) { const pd = u.flags.rdPend; if (!pd || pd.dmg >= u.dmg) u.flags.rdPend = { dmg: u.dmg }; return d; },
    noBattleDmg(g, u) { rdRes(g, u); return false; }, attack(g, u) { rdRes(g, u); }, onAllyAttack(g, u) { rdRes(g, u); }, onAllyDeploy(g, u) { rdRes(g, u); },
    onCommand(g, u) { rdRes(g, u); }, endTurn(g, u) { rdRes(g, u); }, onOppStart(g, u) { rdRes(g, u); }, destroyed(g, u) { rdRes(g, u); }, onAllyDestroyed(g, u) { rdRes(g, u); } });
  F('GD02-011', 'simplified', { note: 'Action modelled as Activate･Main when it could attack the player unblocked: destroy it, 6 damage to the enemy Base (vs Shields the engine already lets its 0-AP attack break one)',
    activate: { cost: 0, can: (g, p, u) => g.canAttackThisTurn(u) && g.canAttackPlayer(u) && !!p.opp.base && !(EFX[p.opp.base.def.id] || {}).immuneEffect && !p.opp.units.some(x => !x.rested && g.kw(x, 'Blocker')),
      score: (g, p, u) => { const b = p.opp.base; return (b.def.hp - b.dmg <= 6 ? 1.8 : 0.4) - 0.5 * p.ai.unitValue(g, u); },
      run(g, p, u) { g.destroy(u, { effect: true, by: p }); g.damageShieldArea(p, p.opp, 6, { effect: true }); } } });
  F('GD02-087', 'full', { p_whenLinked(g, u) { if (u.def.color === 'Blue') smartRest(g, u.owner, x => g.kw(x, 'Blocker') > 0); },
    ai_whenLinked: (g, p, u) => u.def.color === 'Blue' ? restScoreS(g, p, x => g.kw(x, 'Blocker') > 0) : 0 });
  F('GD05-011', 'full', { deploy(g, u) { const p = u.owner; const own = p.units.filter(x => x !== u && !x.rested && tr(g, x, 'Earth Alliance')); if (!own.length || !p.opp.units.some(x => x.rested)) return;
    const o = pickOwnRest(g, p, own); if (p.ai.bestDamageValue(g, p, 2, x => x.rested) - ownRestCost(g, p, o) < 0.3) return; o.rested = true; dmgPick(g, p, 2, x => x.rested); },
    ai_deploy: (g, p) => { const own = p.units.filter(x => !x.rested && tr(g, x, 'Earth Alliance')); return own.length ? Math.max(0, p.ai.bestDamageValue(g, p, 2, x => x.rested) - ownRestCost(g, p, pickOwnRest(g, p, own))) : 0; } });

  // ======================= OZ / WHITE FANG / MARINE / OTHERS =======================
  const epy = (g, s) => { if (s.linked && yourTurn(g, s.owner) && onceT(s, 'epyon', g)) s.rested = false; };
  F('GD02-002', 'full', { onBattleKill(g, u) { epy(g, u); }, onAllyBattleKill(g, u) { epy(g, u); } });
  F('ST02-006', 'full', { activate: { cost: 4, once: true, can: (g, p, u) => u.rested,
    score: (g, p, u) => ((!p.flags.turn.attacked && !u.sick) ? 0.6 + 0.25 * g.ap(u) : 0.5 * p.ai.exposure(g, p, u) + (g.kw(u, 'Blocker') ? 0.4 : 0)) - 1.0,
    run(g, p, u) { u.rested = false; } } });
  const cwTok = (g, p) => p.units.filter(x => x.token && tr(g, x, 'Calamity War')).length;
  const hashFire = (g, u) => { if (yourTurn(g, u.owner) && onceT(u, 'hash', g) && u.owner.units.length < 6) g.deployToken(u.owner, 'Pluma'); };
  F('GD05-006', 'simplified', { note: 'shield/base destroyed by its battle damage is read from stats at the next attack declaration / end of turn (token arrives after this end phase\'s <Repair>)',
    kw: (g, u, k) => k === 'Repair' ? cwTok(g, u.owner) : 0,
    onBattleKill(g, u) { hashFire(g, u); }, attack(g, u) { if (sdTake(g, u) > 0) hashFire(g, u); sdArm(g, u, u); },
    onAllyAttack(g, u) { if (sdTake(g, u) > 0) hashFire(g, u); }, endTurn(g, u) { if (sdTake(g, u) > 0) hashFire(g, u); } });
  F('GD05-008', 'full', { costMod: (g, p) => p.units.some(x => x.pilot && ptr(x.pilot, 'Newtype') && pilotColor(x.pilot) !== 'Blue') ? -2 : 0 });
  F('GD06-011', 'full', { whenLinked(g, u) { for (const x of u.owner.units) x.tKw.Repair = (x.tKw.Repair || 0) + 1; }, ai_whenLinked: (g, p) => 0.2 + 0.15 * p.units.filter(x => x.dmg > 0).length });
  F('GD06-083', 'full', { p_kw: (g, u, k) => (k === 'High-Maneuver' && u.linked && g.kw(u, 'Repair') > 0) ? 1 : 0 });
  F('ST11-002', 'simplified', { note: 'protects only itself (no aura for other Units\' effect damage)', reduceEffectDmg: (g, u, d) => (g.turnPlayer !== u.owner && u.rested && g.hpLeft(u) <= 2) ? 0 : d });
  F('ST11-014', 'simplified', cmd({ note: 'Action (attack-target protection) not modelled; playable as Pilot [Marco Morassim]', pilotName: 'Marco Morassim', actionOnly: true, canMain: () => false, main() {} }));
};
