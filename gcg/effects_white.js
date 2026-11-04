'use strict';
// White cards, batch 2 (written from the official English text in cards.json; 1v1: "each enemy player" = the opponent,
// clauses gated on "2 or more enemy players" are implemented but never true).
// NOTES
//  127 cards: 115 full, 12 simplified (see each `note`): EB01-042, GD03-098, GD03-120, GD04-067, GD04-100, GD04-119,
//   GD04-129, GD05-098, GD05-101, GD06-070, GD06-098, GD06-100. Skipped: none.
//  Also hand entries (full) for two previously auto-compiled cards whose Action the AI could not use: GD01-120, GD06-120.
//  Rules calls:
//   - The EX Base counts as a friendly Base ("a friendly Base", "active friendly Base"); "white Base" excludes it.
//   - "It can't attack during this turn" / "can't choose the enemy player ... during this turn" use the engine flags
//     u.flags.noAtkT / u.flags.noAtkPlayerT; GD02-069 / GD04-065 set playerTargetOk (their text clause is conditional).
//   - Set-active effects go through setActive() (fires GD03-098 Graham Aker). "Rest your Base with one of your Units'
//     effects" goes through restOwnBase() (GD03-079 G-Defenser replacement).
//   - Turn A "paid ① for one of your Units' effects": paidFx() records costs paid by this file's Unit effects (activations,
//     Kapool's optional ①) and fires Sochie Heim / Gavane Goonny / Willgem; totals feed Eagail and ∀ Gundam (GD04-069).
//   - "Activate 【Main】/【Action】 on the card paired with this Unit" (Bolt / Shadow Gundam) runs the paired Command's
//     effect with opt {fromPair:true} (no pair-from-trash), counts as activating that Command (onCommand, Special Move).
//   - Commands that "pair this card from your trash" (GD05-122, GD06-119) pair only when cast (g.curCmd is the card) and
//     intercept castCommand's single trash push for the card.
//   - Copies of a card are one shared object: trash/hand selections that need two different cards go by position.
//  AI usage: re-ready Activate･Main abilities (Zeta, Banshee Norn, GN Flag, Guel) are used after combat (there is no
//   second attack phase), so they protect/ready Blockers. Unit/Pilot Activate･Action abilities run in the battle action
//   step (ai battleAct / p_battleAct) when they flip the fight; not in the end-phase action step.
//  Engine/AI hooks added (additive; see HOOKS.md): flags noAtkT/noAtkPlayerT, playerTargetOk, p_reduceEffectDmg, p_onBlock,
//   guardArea/p_guardArea, grantFirstStrike, onBattleDamage, p_onDestroyShieldArea, ai battleAct/p_battleAct, p_activate.
//  Wished-for hooks:
//   - an enemy-side keyword aura (EB01-042: a rested Psycho Haro gives ALL Units <Blocker>).
//   - onSetActive(g,u,byEffect) fired by every effect that sets a Unit active (GD03-098 sees only this file's).
//   - onPayUnitEffect(g,p,u,n) fired by the AI for every Unit activation cost and by "you may pay" effects in all files
//     (GD04-100, GD05-101, GD04-129, GD06-070 see only this file's costs).
//   - a source card/Unit on effect damage (effectDamage, damageShieldArea opts.src for every Unit effect): GD04-119
//     ("can't receive effect damage from enemy Units"), GD06-098 (Base vs enemy Unit effect damage), GD05-098 (shield area
//     card destroyed by this Unit's effect damage).
//   - per-player delayed triggers (GD03-120 grants its trigger to the Units in play when it resolves).
//   - granting an activated <Support N> to a Unit (GD04-067); pilot cost modifiers per target Unit (GD06-100).
//   - AI: ai.fight() consulting grantFirstStrike (GD02-073 is exact in the engine, the AI's block/attack previews ignore it).
module.exports = function (F, H, EFX) {
  const { CARDS } = require('./engine');
  const { tr, yourTurn, cmd, baseShield, restPick, bouncePick, apDownPick } = H;

  // ---------------- local helpers ----------------
  const N_ENEMY = 1; // number of enemy players (1v1)
  const GG = 'G Generation';
  const toHand = (g, p, c) => { p.hand.push(c); g.stats.p[p.i].extraCards++; };
  const fromTrash = (p, c) => { const i = p.trash.lastIndexOf(c); if (i < 0) return false; p.trash.splice(i, 1); return true; };
  const onceT = (g, u, k) => { const key = 'w_' + k; if (u.flags[key] === g.turn) return false; u.flags[key] = g.turn; return true; }; // 【Once per Turn】 (either player's turn)
  const usedT = (g, u, k) => u.flags['w_' + k] === g.turn;
  const pOnce = (g, p, k) => { const key = 'w_' + k; if (p.flags[key] === g.turn) return false; p.flags[key] = g.turn; return true; };
  const ggCount = (p) => p.trash.filter(c => c.traits.includes(GG)).length;
  const anyTr = (g, x, ...ts) => ts.some(t => tr(g, x, t));
  const cardTr = (c, ...ts) => ts.some(t => c.traits.includes(t));
  const whiteBase = (p) => !!(p.base && !p.base.ex && p.base.def.color === 'White');
  const ptr = (u, t) => !!(u.pilot && (u.pilot.traits || []).includes(t));
  const pilotCard = (pl) => pl.cmdPilot ? CARDS[pl.id] : pl;
  const loot = (g, p, n) => { g.draw(p, n); g.discard(p, n); };
  const bestBy = (arr, f) => arr.reduce((m, x) => (m === null || f(x) > f(m)) ? x : m, null);
  // 【Development N】: exile N (G Generation) cards from the trash (worst first). Returns true if paid.
  function development(g, p, n) {
    if (ggCount(p) < n) return false;
    for (let k = 0; k < n; k++) { const c = p.ai.pickWorstCard(g, p, p.trash.filter(x => x.traits.includes(GG))); fromTrash(p, c); p.exile.push(c); }
    return true;
  }
  // value of a removal-to-hand of the best enemy matching f
  const bounceVal = (g, p, f) => Math.max(0, ...p.opp.units.filter(x => f(x)).map(x => p.ai.removalValue(g, p, x, 'hand')));
  // value of having our rested Unit `u` active for the opponent's turn (not attackable, may block)
  function readyVal(g, p, u) {
    if (!u || !u.rested) return 0;
    let v = 0.15 + Math.min(3, p.ai.exposure(g, p, u) * p.ai.aggr(g, p));
    if (g.kw(u, 'Blocker') && p.opp.units.some(o => g.ap(o) > 0)) v += 0.4 + (p.ai.lethalThreat(g, p, null) ? 1.5 : 0);
    return v;
  }
  // set a rested Unit active by an effect (noAtk: "It can't attack during this turn"); fires Graham Aker (GD03-098)
  function setActive(g, u, noAtk) {
    if (!g.alive(u) || !u.rested) return false;
    u.rested = false; if (noAtk) u.flags.noAtkT = g.turn;
    if (u.linked && u.pilot && u.pilot.id === 'GD03-098') bouncePick(g, u.owner, x => g.hpLeft(x) <= 3); // 【During Link】 Graham Aker
    return true;
  }
  // "Choose 1 active friendly Base. Rest it." through one of our Units' effects; G-Defenser (GD03-079) may be rested instead.
  function restOwnBase(g, p) {
    const b = p.base; if (!b || b.rested) return false;
    const gd = p.units.filter(x => x.def.id === 'GD03-079' && !x.rested);
    if (gd.length) { // AI: rest G-Defenser instead only when the Base still has a "Rest this Base" ability to use this turn
      const be = !b.ex && EFX[b.def.id]; const baseActLeft = !!(be && be.activate && be.activate.restBase && (!be.activate.once || !p.flags.turn.baseAct));
      const free = gd.filter(x => !g.canAttackThisTurn(x)); if (baseActLeft && yourTurn(g, p)) { (free.length ? free[0] : gd[0]).rested = true; return true; }
    }
    b.rested = true; return true;
  }
  // our Unit in battle b and the enemy Unit it is fighting
  function myBattle(g, p, b) {
    if (!b || b.target === 'player' || !g.alive(b.attacker) || !g.alive(b.target)) return null;
    if (b.attacker.owner === p) return { mine: b.attacker, foe: b.target, att: true };
    if (b.target.owner === p) return { mine: b.target, foe: b.attacker, att: false };
    return null;
  }
  function outcome(g, p, bt) {
    const f = bt.att ? p.ai.fight(g, bt.mine, bt.foe, true) : p.ai.fight(g, bt.foe, bt.mine, true);
    const myDies = bt.att ? f.killA : f.killT, foeDies = bt.att ? f.killT : f.killA;
    return (foeDies ? p.ai.unitValue(g, bt.foe) : 0) - (myDies ? p.ai.unitValue(g, bt.mine) - p.ai.deathValue(g, bt.mine) : 0);
  }
  // value change of a temporary modification (apply/undo) for the battle bt
  function swing(g, p, bt, apply, undo) { if (!bt) return 0; const v0 = outcome(g, p, bt); apply(); let v1; try { v1 = outcome(g, p, bt); } finally { undo(); } return v1 - v0; }
  const apSwing = (g, p, bt, who, n) => swing(g, p, bt, () => { who.bAP += n; }, () => { who.bAP -= n; });
  const hpSwing = (g, p, bt, who, n) => { const d0 = who.dmg, h = Math.min(n, d0); return swing(g, p, bt, () => { who.dmg -= h; }, () => { who.dmg = d0; }); };
  // defensive value of AP-n on an attacker that is attacking the player (0 AP deals no battle damage)
  const playerSave = (g, p, b, n, threat) => (b && b.target === 'player' && g.alive(b.attacker) && b.attacker.owner !== p && g.ap(b.attacker) <= n) ? threat : 0;
  // "Choose 1 enemy Unit. It gets AP-n during this battle/turn" used as a defensive 【Action】 (defAction)
  function apDownDef(n, battle, cond) {
    return {
      can: (g, p, b) => !!b && g.alive(b.attacker) && b.attacker.owner !== p && (!cond || cond(g, p, b)),
      value: (g, p, b, threat) => Math.max(playerSave(g, p, b, n, threat), apSwing(g, p, myBattle(g, p, b), b.attacker, -n)),
      run(g, p, b) { if (battle) b.attacker.bAP -= n; else b.attacker.tAP -= n; } };
  }
  // pre-combat score of "enemy Unit gets AP-n this turn" (enables a favourable trade)
  const apDownScore = (g, p, n, f) => { if (!yourTurn(g, p)) return -1; const en = p.ai.tradeEnable(g, p, n); return (en && (!f || f(en.t))) ? en.v : -1; };
  // Turn A "paid ① or more for one of your Units' effects" bookkeeping (costs paid through this file's Unit effects)
  function paidFx(g, p, u, n) {
    if (!(n > 0)) return;
    if (p.flags.wPaidT !== g.turn) { p.flags.wPaidT = g.turn; p.flags.wPaidN = 0; }
    p.flags.wPaidN += n; // primitives only on p.flags (Game.clone copies p.flags shallowly)
    if (anyTr(g, u, 'Militia', 'Dianna Counter')) { if (p.flags.wPaidMDT !== g.turn) { p.flags.wPaidMDT = g.turn; p.flags.wPaidMDuid = u.uid; } else if (p.flags.wPaidMDuid !== u.uid) p.flags.wPaidMDuid = -1; }
    for (const x of [...p.units]) {
      if (!x.pilot) continue;
      if (x.pilot.id === 'GD04-100' && onceT(g, x, 'sochie')) x.tAP += n; // Sochie Heim
      if (x.pilot.id === 'GD05-101' && tr(g, x, 'Militia') && x.dmg > 0 && onceT(g, x, 'gavane')) g.heal(x, 2); // Gavane Goonny
    }
    const b = p.base; if (b && !b.ex && b.def.id === 'GD04-129' && yourTurn(g, p) && b.dmg > 0 && pOnce(g, p, 'willgem')) b.dmg = Math.max(0, b.dmg - 2); // Willgem
  }
  const paidTotal = (g, p) => p.flags.wPaidT === g.turn ? (p.flags.wPaidN || 0) : 0;
  // "Choose 1 ... from your trash. Add it to your hand."
  function trashToHand(g, p, pred) { const c = p.trash.filter(pred); if (!c.length) return null; const x = p.ai.pickBestCard(g, p, c); fromTrash(p, x); toHand(g, p, x); return x; }
  // pair a Pilot card from the hand with u (no cost)
  function pairFromHand(g, p, u, pred) {
    if (!g.alive(u) || u.pilot) return false; const c = p.hand.filter(x => x.type === 'PILOT' && pred(x)); if (!c.length) return false;
    const pd = bestBy(c, x => p.ai.pairBonus(g, p, u, x)); p.hand.splice(p.hand.indexOf(pd), 1); g.pair(u, pd); return true;
  }
  // "Units that are Lv.N or lower can't activate <Blocker> during this battle": hide them from the defender's block choice
  function restrictBlock(g, D, b, pred) {
    const ai = D.ai; const own = Object.prototype.hasOwnProperty.call(ai, 'chooseBlock') ? ai.chooseBlock : null; const base = own || Object.getPrototypeOf(ai).chooseBlock;
    ai.chooseBlock = function (g2, D2, a, t) {
      if (own) ai.chooseBlock = own; else delete ai.chooseBlock;
      if (g2.inBattle !== b) return base.call(ai, g2, D2, a, t);
      const hid = D2.units.filter(x => !x.rested && pred(x)); for (const x of hid) x.rested = true;
      try { return base.call(ai, g2, D2, a, t); } finally { for (const x of hid) x.rested = false; } };
  }
  // run the 【Main】 / 【Action】 of a Command card paired with u (Bolt Gundam / Shadow Gundam / ...)
  function activatePairedCmd(g, u, which, b) {
    if (!u.linked || !u.pilot || !u.pilot.cmdPilot) return false; const p = u.owner; const c = CARDS[u.pilot.id]; const e = EFX[c.id]; if (!e) return false;
    const hasMain = /【Main】/.test(c.text), hasAct = /【Action】/.test(c.text); if (which === 'Main' ? !hasMain : !hasAct) return false;
    const pc = g.curCmd; g.curCmd = { c, p };
    try {
      const rem = () => { const r = e.removal; if (r.kind === 'damage') H.dmgPick(g, p, r.n, x => r.f(g, x)); else if (r.kind === 'destroy') H.destroyPick(g, p, x => r.f(g, x)); else bouncePick(g, p, x => r.f(g, x), r.kind === 'bottom' ? 'bottom' : 'hand'); };
      if (which === 'Action' && e.action) e.action(g, p, b || g.inBattle, 'attack', u, { fromPair: true });
      else if (which === 'Action' && e.actionOnly && e.removal) rem();
      else if (e.main) e.main(g, p, { fromPair: true });
      else if (e.removal) rem();
    } finally { g.curCmd = pc; }
    if (c.traits.includes('Special Move')) p.specialMoveThisTurn = true;
    g.fireAllies(p, 'onCommand', c);
    return true;
  }
  // "After activating this card's 【Main】/【Action】, you may pair this card from your trash with one of your (MF) Units":
  // pair now and intercept the single trash push castCommand makes for the card right after.
  function pairFromTrashMF(g, p, id) {
    const cands = p.units.filter(x => tr(g, x, 'MF') && p.ai.canPair(g, x)); if (!cands.length) return;
    const c = CARDS[id]; const po = p.ai.pilotObj(c, true); const t = bestBy(cands, x => p.ai.pairBonus(g, p, x, po));
    const tsh = p.trash; if (Object.prototype.hasOwnProperty.call(tsh, 'push')) return;
    tsh.push = function (...xs) { const i = xs.indexOf(c); if (i >= 0) { xs.splice(i, 1); delete tsh.push; } return Array.prototype.push.apply(tsh, xs); };
    g.pair(t, po);
  }

  // ======================= EB01 (G Generation) =======================
  F('EB01-041', 'full', { deploy(g, u) { bouncePick(g, u.owner, x => g.hpLeft(x) <= 4); }, ai_deploy: (g, p) => bounceVal(g, p, x => g.hpLeft(x) <= 4) });
  F('EB01-042', 'simplified', { note: 'enemy Units gain <Blocker> from a rested Psycho Haro only via a turn-long grant made when it attacks (no enemy-side keyword aura hook); friendly Units and itself are exact',
    kw: (g, u, k) => (k === 'Blocker' && u.rested) ? 1 : 0,
    aura_kw: (g, src, u, k) => (k === 'Blocker' && src.rested) ? 1 : 0,
    attack(g, u, b) { const D = u.owner.opp; for (const x of D.units) x.tKw.Blocker = Math.max(x.tKw.Blocker || 0, 1); restrictBlock(g, D, b, x => x.def.lv <= 7); } });
  F('EB01-043', 'full', { attack(g, u, b) { const p = u.owner; if (p.units.some(x => g.kw(x, 'Blocker') > 0)) apDownPick(g, p, 2, x => x.def.lv <= 5, { battle: true, b }); } });
  F('EB01-044', 'full', { note: 'Deploy needs 2+ enemy players: never true in 1v1', deploy(g, u) { if (N_ENEMY >= 2) bouncePick(g, u.owner, null); } });
  F('EB01-045', 'full', { whenPaired(g, u) { bouncePick(g, u.owner, x => g.kw(x, 'Repair') > 0); }, ai_whenPaired: (g, p) => bounceVal(g, p, x => g.kw(x, 'Repair') > 0) });
  F('EB01-047', 'full', { whenPaired(g, u) { const p = u.owner; if (g.kw(u, 'High-Maneuver') || !g.canAttackThisTurn(u) || !p.opp.units.some(x => !x.rested && g.kw(x, 'Blocker') > 0)) return; if (development(g, p, 1)) u.tKw['High-Maneuver'] = 1; },
    ai_whenPaired: (g, p, u) => (ggCount(p) >= 1 && p.opp.units.some(x => !x.rested && g.kw(x, 'Blocker') > 0) && !u.rested) ? 0.5 : 0 });
  F('EB01-049', 'full', { kw: (g, u, k) => (k === 'Suppression' && u.owner.units.some(x => tr(g, x, GG) && g.kw(x, 'Blocker') > 0)) ? 1 : 0 });
  F('EB01-050', 'full', { attack(g, u, b) { const p = u.owner; if (!p.deck.length) return; const c = p.deck.shift(); p.trash.push(c); if (c.lv >= 3) apDownPick(g, p, 2, null, { battle: true, b }); } });
  F('EB01-055', 'full', { note: 'needs 2+ enemy players: never true in 1v1', guardArea: (g, self, a, kind) => N_ENEMY >= 2 && self.rested && kind === 'shield' && a.owner !== self.owner });
  const gem2Cost = (g, p, x) => (g.canAttackThisTurn(x) ? 0.5 + 0.3 * g.ap(x) : 0) + p.ai.exposure(g, p, x) * 0.5;
  F('EB01-057', 'full', { deploy(g, u) { const p = u.owner; const own = p.units.filter(x => x !== u && !x.rested && x.def.lv === 3); const tg = p.opp.units.filter(x => x.def.lv <= 2); if (!own.length || !tg.length) return;
    const r = bestBy(own, x => -gem2Cost(g, p, x)); if (bounceVal(g, p, x => x.def.lv <= 2) - gem2Cost(g, p, r) < 0.3) return; r.rested = true; bouncePick(g, p, x => x.def.lv <= 2); },
    ai_deploy: (g, p) => { const own = p.units.filter(x => !x.rested && x.def.lv === 3); if (!own.length) return 0; return Math.max(0, bounceVal(g, p, x => x.def.lv <= 2) - Math.min(...own.map(x => gem2Cost(g, p, x)))); } });
  F('EB01-058', 'full', { note: 'needs 2+ enemy players: never true in 1v1', kw: (g, u, k) => (k === 'Blocker' && N_ENEMY >= 2) ? 1 : 0 });
  F('EB01-059', 'full', { attack(g, u) { if (!u.linked || !onceT(g, u, 'pzaku')) return; for (const pl of [u.owner, u.owner.opp]) pl.resRested = Math.max(0, pl.resRested - 1); } });
  F('EB01-060', 'full', { whenPaired(g, u) { const p = u.owner; if (ggCount(p) < 3 || bounceVal(g, p, x => x.def.lv <= 4) < 1.2) return; if (development(g, p, 3)) bouncePick(g, p, x => x.def.lv <= 4); },
    ai_whenPaired: (g, p) => ggCount(p) >= 3 ? Math.max(0, bounceVal(g, p, x => x.def.lv <= 4) - 0.4) : 0 });
  F('EB01-070', 'full', { note: 'Activate･Action used in the battle action step on the opponent\'s turn, on our Unit in that battle',
    p_battleAct: { cost: 1, once: true, can: (g, p, u, b) => u.linked && g.turnPlayer !== p && !!myBattle(g, p, b),
      value: (g, p, u, b) => { const bt = myBattle(g, p, b); return apSwing(g, p, bt, bt.mine, 1); },
      run(g, p, u, b) { const bt = myBattle(g, p, b); if (bt) bt.mine.bAP += 1; } } });
  F('EB01-072', 'full', { p_whenPaired(g, u) { const p = u.owner; const own = p.units.filter(x => !x.rested && g.kw(x, 'Blocker') > 0); if (own.length) p.ai.pickRestOwn(g, p, own).rested = true; restPick(g, p, x => x.def.lv <= 4); },
    ai_whenPaired: (g, p) => { const own = p.units.filter(x => !x.rested && g.kw(x, 'Blocker') > 0); return p.ai.restScore(g, p, x => x.def.lv <= 4) - (own.length ? 0.3 + Math.min(...own.map(x => p.ai.exposure(g, p, x))) : 0); } });
  F('EB01-082', 'full', cmd({ actionOnly: true, canMain: () => false, main() {}, canAction: (g, p) => p.opp.units.some(x => x.def.lv <= 3),
    burst(g, p) { bouncePick(g, p, x => x.def.lv <= 3); },
    action(g, p, b, role) { const a = (role === 'defend' && b && g.alive(b.attacker) && b.attacker.owner !== p && b.attacker.def.lv <= 3) ? b.attacker : null; if (a) g.bounce(a); else bouncePick(g, p, x => x.def.lv <= 3); },
    removal: { kind: 'hand', f: (g, x) => x.def.lv <= 3 } }));
  F('EB01-083', 'full', cmd({ actionOnly: true, canMain: () => false, main() {}, canAction: (g, p) => g.turnPlayer !== p,
    defAction: { can: (g, p, b) => g.turnPlayer !== p && !!myBattle(g, p, b),
      value: (g, p, b) => { const bt = myBattle(g, p, b); return apSwing(g, p, bt, bt.mine, 3); },
      run(g, p, b) { const bt = myBattle(g, p, b); if (bt) bt.mine.tAP += 3; } } }));
  const restedBlockers = (g, p) => p.units.filter(x => x.rested && g.kw(x, 'Blocker') > 0);
  const lateReady = (g, p, b) => { // value of readying a Blocker in the middle of the opponent's attacks
    const rem = p.opp.units.filter(x => x !== b.attacker && g.canAttackThisTurn(x)); if (!rem.length) return 0;
    return 0.3 + 0.25 * rem.length + (p.ai.lethalThreat(g, p, null) ? 2.0 : 0); };
  F('EB01-084', 'full', cmd({ pilotName: 'Demeziere Sonnen', actionToo: true,
    canMain: (g, p) => restedBlockers(g, p).length > 0,
    main(g, p) { const c = restedBlockers(g, p); if (c.length) setActive(g, bestBy(c, x => readyVal(g, p, x)), true); },
    score: (g, p) => Math.max(0, ...restedBlockers(g, p).map(x => readyVal(g, p, x))) - 0.9,
    defAction: { can: (g, p, b) => restedBlockers(g, p).filter(x => x !== b.target).length > 0, value: (g, p, b) => lateReady(g, p, b),
      run(g, p, b) { const c = restedBlockers(g, p).filter(x => x !== b.target); if (c.length) setActive(g, p.ai.pickBestUnit(g, p, c), true); } } }));
  F('EB01-089', 'full', baseShield({ baseDeploy(g, p) { const c = p.units.filter(x => x.rested && x.def.color === 'White' && tr(g, x, GG)); if (c.length) setActive(g, bestBy(c, x => readyVal(g, p, x)), true); } }));
  F('EB01-090', 'full', baseShield({ baseDeploy(g, p) { if (yourTurn(g, p)) bouncePick(g, p, x => g.hpLeft(x) <= 2); } }));
  // ======================= GD01 (Triple Ship Alliance / Academy) =======================
  const fr65 = (g, u) => { if (!u.pilot || !u.owner.opp.units.length || !onceT(g, u, 'fr65')) return; apDownPick(g, u.owner, 2, null, null); };
  F('GD01-065', 'full', { whenPaired(g, u) { fr65(g, u); }, onAllyPaired(g, src, x) { if (x.def.color === 'White') fr65(g, src); },
    ai_whenPaired: (g, p, u) => (usedT(g, u, 'fr65') || !p.opp.units.length) ? 0 : Math.max(0.3, apDownScore(g, p, 2)) });
  const rwb = (g, p) => p.units.filter(x => x.rested && x.def.color === 'White' && g.kw(x, 'Blocker') > 0);
  F('GD01-069', 'full', { activate: { cost: 1, once: true, can: (g, p) => rwb(g, p).length > 0,
    score: (g, p) => Math.max(0, ...rwb(g, p).map(x => readyVal(g, p, x))) - 0.5,
    run(g, p, u) { const c = rwb(g, p); if (c.length) setActive(g, bestBy(c, x => readyVal(g, p, x)), true); paidFx(g, p, u, 1); } } });
  F('GD01-070', 'full', { costMod: (g, p) => p.trash.filter(c => c.type === 'COMMAND').length >= 4 ? -2 : 0 });
  F('GD01-074', 'full', { attack(g, u) { loot(g, u.owner, 1); } });
  const enemyFoe = (g, p, b) => { const bt = myBattle(g, p, b); return bt ? bt.foe : ((b && b.target === 'player' && b.attacker.owner !== p && g.alive(b.attacker)) ? b.attacker : null); };
  F('GD01-082', 'full', { note: 'Activate･Action used in the battle action step on the enemy Unit our Unit is fighting (or an attacker it brings to 0 AP)',
    battleAct: { cost: 2, once: true, can: (g, p, u, b) => !!u.pilot && !!enemyFoe(g, p, b),
      value: (g, p, u, b, role) => { const bt = myBattle(g, p, b); return bt ? apSwing(g, p, bt, bt.foe, -1) : playerSave(g, p, b, 1, p.base ? 0.6 : 1.0 + (6 - p.shields.length) * 0.3); },
      run(g, p, u, b) { const f = enemyFoe(g, p, b); if (f) f.bAP -= 1; } } });
  F('GD01-097', 'full', { p_activate: { once: true, can: (g, p, u) => u.rested && p.opp.hand.length >= 8, score: (g, p, u) => readyVal(g, p, u) - 0.1, run(g, p, u) { if (p.opp.hand.length >= 8) setActive(g, u, true); } } });
  F('GD01-098', 'full', { note: 'Activate･Action used in a battle when the 1 HP saves this Unit',
    p_battleAct: { once: true, can: (g, p, u, b) => u.dmg > 0 && p.opp.units.some(x => g.ap(x) <= 1) && !!myBattle(g, p, b) && myBattle(g, p, b).mine === u,
      value: (g, p, u, b) => hpSwing(g, p, myBattle(g, p, b), u, 1), run(g, p, u) { if (p.opp.units.some(x => g.ap(x) <= 1)) g.heal(u, 1); } } });
  const rbAny = (g, p) => p.units.filter(x => x.rested && g.kw(x, 'Blocker') > 0);
  F('GD01-121', 'full', cmd({ canMain: (g, p) => rbAny(g, p).length > 0,
    main(g, p) { const c = rbAny(g, p); if (c.length) setActive(g, bestBy(c, x => readyVal(g, p, x)), true); },
    burst(g, p) { const c = rbAny(g, p); if (c.length) setActive(g, bestBy(c, x => readyVal(g, p, x)), true); },
    score: (g, p) => Math.max(0, ...rbAny(g, p).map(x => readyVal(g, p, x))) - 0.9 }));
  const covF = (g, x) => g.hpLeft(x) <= (x.owner.opp.units.some(y => y.linked) ? 4 : 2);
  F('GD01-122', 'full', cmd({ pilotName: 'Shaddiq Zenelli', canMain: (g, p) => p.opp.units.some(x => covF(g, x)), main(g, p) { bouncePick(g, p, x => covF(g, x)); }, removal: { kind: 'hand', f: covF } }));
  F('GD01-130', 'full', baseShield({ activate: { cost: 0, restBase: true, can: (g, p) => p.units.some(x => tr(g, x, 'Academy')) && p.opp.units.length > 0,
    score: (g, p) => apDownScore(g, p, 1), run(g, p) { if (p.units.some(x => tr(g, x, 'Academy'))) apDownPick(g, p, 1, null, null); } } }));

  // ======================= GD02 (AEUG / Gjallarhorn) =======================
  const baseRestCost = (g, p) => { const b = p.base; if (!b || b.ex) return 0; const be = EFX[b.def.id]; return (be && be.activate && be.activate.restBase && (!be.activate.once || !p.flags.turn.baseAct)) ? 0.8 : 0; };
  const canRestBase = (p) => !!p.base && !p.base.rested;
  F('GD02-069', 'full', { note: 'AI uses the re-ready after combat (protects it; no second attack phase)', playerTargetOk: true,
    activate: { once: true, cost: 0, postCombat: true, can: (g, p, u) => u.linked && u.rested && canRestBase(p),
      score: (g, p, u) => readyVal(g, p, u) - 0.2 - (p.units.some(x => x.def.id === 'GD03-079' && !x.rested) ? 0 : baseRestCost(g, p)),
      run(g, p, u) { if (restOwnBase(g, p)) { setActive(g, u, false); u.flags.noAtkPlayerT = g.turn; } } } });
  F('GD02-070', 'full', { deploy(g, u) { const p = u.owner; if (p.trash.filter(c => c.traits.includes('Gjallarhorn')).length >= 4) { const h = p.hand.length; g.draw(p, 2); if (p.hand.length > h) g.discard(p, 2); } },
    ai_deploy: (g, p) => p.trash.filter(c => c.traits.includes('Gjallarhorn')).length >= 4 ? 0.5 : 0 });
  F('GD02-071', 'full', { deploy(g, u) { const p = u.owner; if (whiteBase(p)) pairFromHand(g, p, u, c => c.traits.includes('AEUG')); },
    ai_deploy: (g, p) => (whiteBase(p) && p.hand.some(c => c.type === 'PILOT' && c.traits.includes('AEUG'))) ? 1.6 : 0 });
  F('GD02-072', 'full', { kw: (g, u, k) => (k === 'Repair' && whiteBase(u.owner)) ? 1 : 0 });
  F('GD02-073', 'full', { note: 'drawback: the enemy attacker fighting it on the opponent\'s turn deals damage first (engine grantFirstStrike)',
    grantFirstStrike: (g, self, a) => g.turnPlayer !== self.owner && a.owner !== self.owner });
  F('GD02-074', 'full', { kw: (g, u, k) => (k === 'Blocker' && !!u.pilot && u.owner.trash.filter(c => c.type === 'COMMAND').length >= 4) ? 1 : 0 });
  F('GD02-075', 'full', { attack(g, u, b) { const p = u.owner; if (restOwnBase(g, p)) apDownPick(g, p, 2, x => x.def.lv <= 4, { battle: true, b }); } });
  F('GD02-076', 'full', { kw(g, u, k) { if (k !== 'Blocker' || u.flags.w_bk) return 0; u.flags.w_bk = true; try { return g.ap(u) >= 5 ? 1 : 0; } finally { u.flags.w_bk = false; } } }); // re-entry guard: AP hooks may ask for <Blocker>
  F('GD02-081', 'full', { deploy(g, u) { if (whiteBase(u.owner)) apDownPick(g, u.owner, 2, null, null); }, ai_deploy: (g, p) => whiteBase(p) && p.opp.units.length ? Math.max(0.2, apDownScore(g, p, 2)) : 0 });
  F('GD02-082', 'full', { kw: (g, u, k) => (k === 'Blocker' && u.owner.units.some(x => x !== u && tr(g, x, 'Gjallarhorn'))) ? 1 : 0 });
  F('GD02-083', 'full', { destroyed(g, u) { const p = u.owner; if (yourTurn(g, p)) return; const c = p.units.filter(x => x.rested && tr(g, x, 'Gjallarhorn')); if (c.length) setActive(g, bestBy(c, x => readyVal(g, p, x)), false); } });
  F('GD02-097', 'full', { p_ap: (g, u) => whiteBase(u.owner) ? 2 : 0 });
  F('GD02-098', 'full', { alsoNamed: 'Char Aznable', p_whenLinked(g, u) { if (tr(g, u, 'AEUG')) { const p = u.owner; const h = p.hand.length; g.draw(p, 1); if (p.hand.length > h) g.discard(p, 1); } }, ai_whenLinked: (g, p, u) => tr(g, u, 'AEUG') ? 0.4 : 0 });
  F('GD02-117', 'full', cmd({ burst(g, p) { trashToHand(g, p, c => c.type === 'BASE' && c.traits.includes('AEUG')); },
    canMain: (g, p) => p.deck.length > 0, main(g, p) { g.draw(p, 3); g.discard(p, 2); }, score: (g, p) => p.deck.length >= 3 ? 1.5 : 0.2 }));
  const hsrF = (g, x) => { const b = g.inBattle; if (!b || b.target === 'player' || g.hpLeft(x) > 4) return false; const o = b.attacker === x ? b.target : (b.target === x ? b.attacker : null); return !!o && o.owner !== x.owner && g.kw(o, 'Blocker') > 0; };
  F('GD02-118', 'full', cmd({ pilotName: 'Ein Dalton', actionOnly: true, canMain: () => false, main() {}, canAction: (g, p) => p.opp.units.some(x => hsrF(g, x)),
    action(g, p, b) { const c = p.opp.units.filter(x => hsrF(g, x)); if (c.length) g.bounce(c[0]); }, removal: { kind: 'hand', f: hsrF } }));
  const aspBase = (g, p, b) => { const B = p.base; if (!B || B.ex || !B.def.traits.includes('AEUG') || !b || b.target !== 'player' || !g.alive(b.attacker) || B.dmg <= 0) return 0; const left = B.def.hp - B.dmg, ap = g.ap(b.attacker); return (ap >= left && ap < left + Math.min(2, B.dmg)) ? 1.3 : 0; };
  F('GD02-120', 'full', cmd({ pilotName: 'Fa Yuiry', actionOnly: true, canMain: () => false, main() {}, canAction: () => true,
    action(g, p) { const c = p.units.filter(x => x.dmg > 0 && tr(g, x, 'AEUG')); if (c.length) g.heal(p.ai.pickBestUnit(g, p, c), 2); else if (p.base && !p.base.ex && p.base.def.traits.includes('AEUG')) p.base.dmg = Math.max(0, p.base.dmg - 2); },
    defAction: { can: (g, p, b) => { const bt = myBattle(g, p, b); return (!!bt && bt.mine.dmg > 0 && tr(g, bt.mine, 'AEUG')) || aspBase(g, p, b) > 0; },
      value: (g, p, b) => { const bt = myBattle(g, p, b); return Math.max(aspBase(g, p, b), (bt && tr(g, bt.mine, 'AEUG')) ? hpSwing(g, p, bt, bt.mine, 2) : 0); },
      run(g, p, b) { const bt = myBattle(g, p, b); if (bt && tr(g, bt.mine, 'AEUG') && bt.mine.dmg > 0 && hpSwing(g, p, bt, bt.mine, 2) >= aspBase(g, p, b)) g.heal(bt.mine, 2); else if (p.base && !p.base.ex && p.base.def.traits.includes('AEUG')) p.base.dmg = Math.max(0, p.base.dmg - 2); } } }));
  F('GD02-130', 'full', baseShield({ baseDeploy(g, p) { if (p.units.some(x => tr(g, x, 'Gjallarhorn'))) apDownPick(g, p, 2, null, null); } }));

  // ======================= GD03 =======================
  F('GD03-069', 'full', { whenPaired(g, u) { u.flags.w_pairT = g.turn; }, endTurn(g, u) { if (u.linked && u.flags.w_pairT === g.turn) setActive(g, u, false); },
    ai_whenLinked: () => 0.5 });
  F('GD03-070', 'full', { guardArea: (g, self, a, kind) => kind === 'shield' && self.rested && a.owner !== self.owner });
  const aeugUnitsTrash = (p) => p.trash.filter(c => c.type === 'UNIT' && c.traits.includes('AEUG')).length;
  F('GD03-071', 'full', { deploy(g, u) { const n = aeugUnitsTrash(u.owner); if (n > 0) apDownPick(g, u.owner, n, null, null); },
    ai_deploy: (g, p) => { const n = aeugUnitsTrash(p); return n > 0 && p.opp.units.length ? Math.max(0.2, apDownScore(g, p, n)) : 0; } });
  F('GD03-072', 'full', { deploy(g, u) { if (u.owner.units.some(x => x !== u && tr(g, x, 'Triple Ship Alliance'))) loot(g, u.owner, 1); }, ai_deploy: (g, p) => p.units.some(x => tr(g, x, 'Triple Ship Alliance')) ? 0.3 : 0 });
  F('GD03-073', 'full', { note: 'Activate･Action used in the battle action step when AP-3 on its opponent flips the fight',
    battleAct: { once: true, can: (g, p, u, b) => { const bt = myBattle(g, p, b); return u.linked && !!bt && bt.mine === u && p.trash.filter(c => c.traits.includes('Gjallarhorn')).length >= 6; },
      value: (g, p, u, b) => { const bt = myBattle(g, p, b); return apSwing(g, p, bt, bt.foe, -3); }, run(g, p, u, b) { const bt = myBattle(g, p, b); if (bt) bt.foe.bAP -= 3; } } });
  F('GD03-074', 'full', { selfTaunt: (g, u) => !!u.pilot && u.owner.units.some(x => x !== u && tr(g, x, 'Superpower Bloc')) });
  F('GD03-076', 'full', { note: 'engine onBattleDamage event; "you may return" taken whenever the damaged enemy Unit is still in play (once per turn)',
    onBattleDamage(g, self, src, victim) { const p = self.owner; if (!yourTurn(g, p) || src.owner !== p || victim.owner === p || !tr(g, src, 'Triple Ship Alliance') || !g.alive(victim) || !onceT(g, self, 'meteor')) return; g.bounce(victim); } });
  F('GD03-077', 'full', { whenLinked(g, u) { for (let k = 0; k < 3; k++) if (!bouncePick(g, u.owner, x => g.hpLeft(x) <= 3)) break; },
    ai_whenLinked: (g, p) => p.opp.units.filter(x => g.hpLeft(x) <= 3).map(x => p.ai.removalValue(g, p, x, 'hand')).sort((a, b) => b - a).slice(0, 3).reduce((s, v) => s + v, 0) });
  F('GD03-078', 'full', { destroyed(g, u, pilot) { if (!u.linked || !pilot) return; const p = u.owner; const pc = pilotCard(pilot); if (fromTrash(p, pc)) toHand(g, p, pc); } });
  F('GD03-079', 'full', { note: 'replacement applied by this file\'s base-resting Unit effects (GD02-069 Zeta, GD02-075 Rick Dias): AI rests G-Defenser instead when it cannot attack or the Base still has a rest ability to use' });
  F('GD03-080', 'full', { whenLinked(g, u) { trashToHand(g, u.owner, c => c.type === 'COMMAND' && c.traits.includes('Gjallarhorn')); },
    ai_whenLinked: (g, p) => p.trash.some(c => c.type === 'COMMAND' && c.traits.includes('Gjallarhorn')) ? 1.1 : 0 });
  const markSB = (g, p, x) => { if (cardTr(x.def || x, 'Superpower Bloc', 'UN')) p.flags.w_sbDep = g.turn; };
  F('GD03-081', 'full', { cannotAttack: (g, u) => u.owner.flags.w_sbDep !== g.turn, deploy(g, u) { markSB(g, u.owner, u); }, onAllyDeploy(g, src, nu) { markSB(g, src.owner, nu); } });
  F('GD03-082', 'full', { costMod: (g, p) => p.units.filter(x => anyTr(g, x, 'Superpower Bloc', 'UN')).length >= 2 ? -1 : 0 });
  F('GD03-098', 'simplified', { note: 'set-active trigger fires for this file\'s set-active effects (GD03-069 end-of-turn, GD04-071, Commands/Bases that set Units active); other files\' set-active effects are not seen (no onSetActive hook)',
    ai_whenLinked: (g, p, u) => (u.def.id === 'GD03-069' || u.def.id === 'GD04-071') ? bounceVal(g, p, x => g.hpLeft(x) <= 3) * 0.7 : 0 });
  F('GD03-099', 'full', { p_destroyed(g, u) { if (u.linked && whiteBase(u.owner)) bouncePick(g, u.owner, x => x.def.lv <= u.def.lv); } });
  const awF = (g, x) => x.rested && x.def.lv <= 4;
  F('GD03-118', 'full', cmd({ actionOnly: true, canMain: () => false, main() {}, canAction: (g, p) => p.opp.units.some(x => awF(g, x)),
    action(g, p, b, role) { const a = (role === 'defend' && b && g.alive(b.attacker) && b.attacker.owner !== p && awF(g, b.attacker)) ? b.attacker : null; if (a) g.bounce(a); else bouncePick(g, p, x => awF(g, x));
      if (p.trash.filter(c => c.name.includes('Awakened Potential')).length >= 2 && g.turnPlayer !== p) { const c = p.units.filter(x => !x.rested && !g.kw(x, 'Blocker')); if (c.length) p.ai.pickBestUnit(g, p, c).tKw.Blocker = 1; } },
    removal: { kind: 'hand', f: awF } }));
  F('GD03-119', 'full', cmd({ canMain: (g, p) => !!p.base && !!p.base.rested,
    main(g, p) { if (!p.base || !p.base.rested) return; p.base.rested = false; for (const x of p.opp.units) x.tAP -= 1; },
    score: (g, p) => Math.max(apDownScore(g, p, 1), 0) + baseRestCost(g, p) * 0.8 - 0.4 }));
  const sbun = (g, x) => anyTr(g, x, 'Superpower Bloc', 'UN');
  F('GD03-120', 'simplified', cmd({ note: 'the delayed trigger is granted to the friendly (Superpower Bloc)/(UN) Units in play when it resolves (Units deployed later that turn are not covered); resolves once', pilotName: 'Patrick Colasour',
    canMain: (g, p) => p.units.some(x => sbun(g, x) && g.canAttackThisTurn(x)) && p.opp.units.some(x => x.rested),
    main(g, p) { const T = g.turn; let done = false;
      for (const x of p.units) { if (!sbun(g, x)) continue; const old = x.flags.onKill;
        x.flags.onKill = (g2, a, v) => { if (old) old(g2, a, v); if (done || g2.turn !== T || g2.turnPlayer !== p) return; done = true; const c = p.units.filter(y => y.rested && sbun(g2, y)); if (c.length) setActive(g2, bestBy(c, y => readyVal(g2, p, y)), true); }; } },
    score: (g, p) => p.units.some(x => sbun(g, x) && g.canAttackThisTurn(x) && p.opp.units.some(t => t.rested && g.ap(x) >= g.hpLeft(t))) ? 0.4 : -1 }));
  const unhV = (g, p, t) => (g.kw(t, 'Blocker') ? 1.0 : 0.3) + (p.units.some(x => g.ap(x) >= g.hpLeft(t)) ? p.ai.unitValue(g, t) * 0.5 : 0);
  F('GD03-121', 'full', cmd({ pilotName: 'Katz Kobayashi', actionOnly: true, canMain: () => false, main() {}, canAction: (g, p) => p.opp.units.some(x => !x.rested && g.hpLeft(x) <= 3),
    action(g, p) { if (p.base) p.base.rested = true; restPick(g, p, x => g.hpLeft(x) <= 3); },
    defAction: { can: (g, p) => g.turnPlayer !== p && p.opp.units.some(x => !x.rested && g.hpLeft(x) <= 3),
      value: (g, p) => Math.max(0, ...p.opp.units.filter(x => !x.rested && g.hpLeft(x) <= 3).map(x => unhV(g, p, x))) - baseRestCost(g, p) * 0.3,
      run(g, p) { if (p.base) p.base.rested = true; const c = p.opp.units.filter(x => !x.rested && g.hpLeft(x) <= 3); if (c.length) bestBy(c, x => unhV(g, p, x)).rested = true; } } }));
  F('GD03-132', 'full', baseShield({ baseDestroyed(g, p) { if (p.units.some(x => x.linked && tr(g, x, 'AEUG'))) restPick(g, p, x => g.hpLeft(x) <= 4); } }));

  // ======================= GD04 =======================
  const blueTrash = (p) => p.trash.filter(c => c.color === 'Blue');
  F('GD04-065', 'full', { note: 'AI uses the re-ready after combat (protects it; no second attack phase)', playerTargetOk: true,
    activate: { cost: 0, postCombat: true, can: (g, p, u) => u.linked && u.rested && blueTrash(p).length >= 3, score: (g, p, u) => readyVal(g, p, u) - 0.4,
      run(g, p, u) { for (let k = 0; k < 3; k++) { const c = p.ai.pickWorstCard(g, p, blueTrash(p)); fromTrash(p, c); p.exile.push(c); } setActive(g, u, false); u.flags.noAtkPlayerT = g.turn; } },
    attack(g, u) { for (const x of u.owner.opp.units) x.tAP -= 1; } });
  const KWS = ['Repair', 'Breach', 'First Strike', 'High-Maneuver', 'Suppression', 'Blocker'];
  const turnAKws = (c) => c.type === 'UNIT' && (KWS.some(k => c.skw[k]) || c.skw.Support);
  function kwVal(g, p, u, c) { let v = 0; const o = p.opp;
    if (c.skw['High-Maneuver'] && !g.kw(u, 'High-Maneuver') && o.units.some(x => !x.rested && g.kw(x, 'Blocker') > 0)) v += 0.9;
    if (c.skw.Suppression && !g.kw(u, 'Suppression') && o.shields.length >= 2) v += 0.7;
    if (c.skw['First Strike'] && !g.kw(u, 'First Strike') && o.units.some(x => x.rested)) v += 0.5;
    if (c.skw.Breach && o.units.some(x => x.rested)) v += 0.25 * c.skw.Breach;
    if (c.skw.Repair && u.dmg > 0) v += 0.3 * Math.min(c.skw.Repair, u.dmg);
    return v; }
  const allTrash = (g) => g.players[0].trash.concat(g.players[1].trash);
  F('GD04-067', 'simplified', { note: 'a copied <Support N> is not granted (no hook to give a Unit an activated Support); the AI copies the most useful keywords for its attacks',
    activate: { cost: 1, once: true, can: (g, p, u) => g.canAttackThisTurn(u) && allTrash(g).some(turnAKws),
      score: (g, p, u) => 0.3 + Math.max(0, ...allTrash(g).filter(turnAKws).map(c => kwVal(g, p, u, c))) - 0.6,
      run(g, p, u) { const c = bestBy(allTrash(g).filter(turnAKws), x => kwVal(g, p, u, x)); u.tAP += 1; paidFx(g, p, u, 1); if (!c) return;
        for (const k of KWS) if (c.skw[k]) u.tKw[k] = (k === 'Breach' || k === 'Repair') ? (u.tKw[k] || 0) + c.skw[k] : Math.max(u.tKw[k] || 0, c.skw[k]); } } });
  F('GD04-069', 'full', { note: 'end-of-turn re-ready checked at our own end phase (at the end of the opponent\'s turn it only differs for "won\'t be set as active" Units); counts costs paid through this file\'s Unit effects',
    endTurn(g, u) { const p = u.owner; if (!u.linked || p.flags.wPaidMDT !== g.turn || p.flags.wPaidMDuid === u.uid) return;
      const c = p.units.filter(x => x.rested && tr(g, x, 'Militia')); if (c.length) setActive(g, bestBy(c, x => readyVal(g, p, x)), false); } });
  F('GD04-070', 'full', { deploy(g, u) { pairFromHand(g, u.owner, u, c => c.name.includes('Ali al-Saachez')); }, ai_deploy: (g, p) => p.hand.some(c => c.type === 'PILOT' && c.name.includes('Ali al-Saachez')) ? 2.0 : 0 });
  F('GD04-071', 'full', { burst(g, p, c) { if (p.opp.units.some(x => tr(g, x, 'CB'))) { toHand(g, p, c); return 'kept'; } },
    activate: { cost: 0, postCombat: true, can: (g, p, u) => u.rested && !!safePair(g, p), score: (g, p, u) => readyVal(g, p, u) - 0.5,
      run(g, p, u) { const pr = safePair(g, p); if (!pr) return; for (const c of pr) { fromTrash(p, c); p.exile.push(c); } setActive(g, u, true); } } });
  function safePair(g, p) { // two distinct trash cards (by position: copies of a card are one shared object)
    const T = p.trash; let best = null, bv = Infinity;
    for (let i = 0; i < T.length; i++) { if (!T[i].traits.includes('Superpower Bloc')) continue; for (let j = 0; j < T.length; j++) { if (j === i || !T[j].traits.includes('UN')) continue;
      const v = p.ai.cardValue(g, p, T[i]) + p.ai.cardValue(g, p, T[j]); if (v < bv) { bv = v; best = [T[i], T[j]]; } } }
    return best; }
  const pumpSelf = (g, p, u, n) => { if (!g.canAttackThisTurn(u)) return -1; let s = -0.5; const ap = g.ap(u);
    for (const t of p.opp.units) if (t.rested && ap < g.hpLeft(t) && ap + n >= g.hpLeft(t)) s = Math.max(s, p.ai.unitValue(g, t) * 0.7 - 0.4);
    if (p.opp.base && ap < p.opp.base.def.hp - p.opp.base.dmg && ap + n >= p.opp.base.def.hp - p.opp.base.dmg) s = Math.max(s, 0.3); return s; };
  F('GD04-073', 'full', { activate: { cost: 1, once: true, can: (g, p, u) => g.canAttackThisTurn(u), score: (g, p, u) => pumpSelf(g, p, u, 2), run(g, p, u) { u.tAP += 2; paidFx(g, p, u, 1); } } });
  F('GD04-074', 'full', { attack(g, u) { const p = u.owner; if (g.avail(p) < 1 || p.deck.length < 3 || !g.pay(p, 1)) return; paidFx(g, p, u, 1); loot(g, p, 1); } });
  F('GD04-075', 'full', { costMod: (g, p) => -p.trash.filter(c => c.type === 'COMMAND' && cardTr(c, 'UN', 'Superpower Bloc')).length });
  F('GD04-080', 'full', { destroyed(g, u) { const p = u.owner; if (p.units.some(x => x !== u && sbun(g, x)) && p.units.length < 6) { const t = g.deployToken(p, 'Alvaaron', { rested: true }); markSB(g, p, t); } } });
  F('GD04-098', 'full', { p_reduceEffectDmg: (g, u, d) => u.linked ? Math.max(0, d - 2) : d });
  F('GD04-099', 'full', { p_attack(g, u) { if (!u.linked) return; const p = u.owner; const c = p.opp.units.filter(x => x.pilot); if (!c.length) return;
    const t = bestBy(c, x => p.ai.unitValue(g, x) + (x.linked ? 0.5 : 0)); const pc = pilotCard(t.pilot); t.pilot = null; t.linked = false; toHand(g, t.owner, pc); g.stats.p[t.owner.i].extraCards--;
    if (g.hpLeft(t) <= 0) g.destroy(t, { effect: true, by: p }); } });
  F('GD04-100', 'simplified', { note: 'sees costs paid through this file\'s White Unit effects only (no engine pay-for-Unit-effect hook); "may" always taken' });
  const unF = (g, x) => g.hpLeft(x) <= 5 && x.owner.opp.units.filter(y => tr(g, y, 'UN')).length >= 2;
  F('GD04-118', 'full', cmd({ pilotName: 'Alejandro Corner', actionToo: true, canMain: (g, p) => p.opp.units.some(x => unF(g, x)), main(g, p) { bouncePick(g, p, x => unF(g, x)); }, removal: { kind: 'hand', f: unF } }));
  F('GD04-119', 'simplified', cmd({ note: 'Main/Action effect-damage immunity "from enemy Units" not modelled (effect damage does not carry its source card); played as Pilot [Gael Chan]', pilotName: 'Gael Chan', canMain: () => false, main() {} }));
  F('GD04-129', 'simplified', baseShield({ note: 'Deploy damage exact; the recover-2 trigger sees costs paid through this file\'s White Unit effects only', baseDeploy(g, p) { if (p.base && p.base.def.id === 'GD04-129') { p.base.dmg += 3; if (p.base.dmg >= p.base.def.hp) g.destroyBase(p); } } }));
  F('GD04-130', 'full', baseShield({ activate: { cost: 0, once: true, can: (g, p) => p.trash.some(c => c.type === 'COMMAND') && p.opp.units.length > 0, score: (g, p) => apDownScore(g, p, 1) - 0.2,
    run(g, p) { const c = p.ai.pickWorstCard(g, p, p.trash.filter(x => x.type === 'COMMAND')); fromTrash(p, c); p.exile.push(c); apDownPick(g, p, 1, null, null); } } }));

  // ======================= GD05 =======================
  const gtp = (g, x) => anyTr(g, x, 'G Team', 'Preventer');
  const otherGT = (g, u) => u.owner.units.some(x => x !== u && gtp(g, x));
  F('GD05-070', 'full', { onBattleKill(g, u) { const p = u.owner; if (!yourTurn(g, p)) return; const c = p.units.filter(x => x.rested && x.linked && gtp(g, x)); if (!c.length || !onceT(g, u, 'tg3')) return; setActive(g, bestBy(c, x => readyVal(g, p, x)), true); } });
  F('GD05-071', 'full', { attack(g, u) { if (otherGT(g, u)) apDownPick(g, u.owner, 2, null, null); } });
  F('GD05-074', 'full', { destroyed(g, u) { loot(g, u.owner, 1); } });
  F('GD05-076', 'full', { attack(g, u, b) { if (u.linked) activatePairedCmd(g, u, 'Main', b); } });
  F('GD05-078', 'full', { deploy(g, u) { u.flags.hasteUnitsOnly = true; } });
  F('GD05-079', 'full', { activate: { once: true, cost: 0, can: (g, p, u) => otherGT(g, u) && p.opp.units.some(x => x.def.lv <= 4), score: (g, p) => apDownScore(g, p, 1, x => x.def.lv <= 4),
    run(g, p, u) { if (otherGT(g, u)) apDownPick(g, p, 1, x => x.def.lv <= 4, null); } } });
  F('GD05-098', 'simplified', { note: 'shield area cards destroyed by this Unit\'s battle damage trigger it; destruction by its effect damage (e.g. <Breach>) is not seen',
    p_onDestroyShieldArea(g, u) { apDownPick(g, u.owner, 2, null, null); } });
  F('GD05-099', 'full', { p_onBattleKill(g, u) { if (yourTurn(g, u.owner)) loot(g, u.owner, 1); } });
  F('GD05-101', 'simplified', { note: 'sees costs paid through this file\'s White Unit effects only (no engine pay-for-Unit-effect hook); recovers only when damaged' });
  F('GD05-118', 'full', cmd({ canMain: (g, p) => p.opp.units.length > 0,
    main(g, p) { const t = apDownPick(g, p, 2, null, null); if (t && p.flags.lastPayEX && g.alive(t)) t.rested = true; },
    score: (g, p) => Math.max(apDownScore(g, p, 2), (p.res - p.resRested) < g.costOf(p, CARDS['GD05-118']) && p.ex > 0 ? p.ai.restScore(g, p, null) - 0.5 : -1) }));
  F('GD05-119', 'full', cmd({ pilotName: 'Zechs Merquise', actionOnly: true, canMain: () => false, main() {}, canAction: () => true,
    action(g, p, b) { const bt = myBattle(g, p, b); if (bt && bt.mine.def.lv >= 5) bt.foe.bAP -= 3; },
    defAction: { can: (g, p, b) => { const bt = myBattle(g, p, b); return !!bt && bt.mine.def.lv >= 5; }, value: (g, p, b) => { const bt = myBattle(g, p, b); return apSwing(g, p, bt, bt.foe, -3); },
      run(g, p, b) { const bt = myBattle(g, p, b); if (bt) bt.foe.bAP -= 3; } } }));
  // pair-from-trash only when the card itself is being cast (castCommand sets g.curCmd and pushes the card to the trash afterwards)
  const castNow = (g, id, opt) => !(opt && opt.fromPair) && !!g.curCmd && g.curCmd.c === CARDS[id];
  const mfOpen = (g, p) => p.units.some(x => tr(g, x, 'MF') && p.ai.canPair(g, x));
  const mfPairVal = (g, p, id) => { const po = p.ai.pilotObj(CARDS[id], true); const c = p.units.filter(x => tr(g, x, 'MF') && p.ai.canPair(g, x)); return c.length ? Math.max(...c.map(x => p.ai.pairBonus(g, p, x, po))) : 0; };
  F('GD05-122', 'full', cmd({ specialMove: true, pilotName: 'Argo Gulskii', canMain: (g, p) => p.opp.units.some(x => !x.rested && x.def.lv <= 4) || mfOpen(g, p),
    main(g, p, opt) { restPick(g, p, x => x.def.lv <= 4); if (castNow(g, 'GD05-122', opt)) pairFromTrashMF(g, p, 'GD05-122'); },
    score: (g, p) => p.ai.restScore(g, p, x => x.def.lv <= 4) + mfPairVal(g, p, 'GD05-122') - 0.6 }));
  F('GD05-130', 'full', baseShield({ baseDestroyed(g, p) { const c = p.hand.filter(x => x.type === 'BASE' && x.name.includes('Presidential Office')); if (!c.length || !fromTrash(p, CARDS['GD05-130'])) return; p.exile.push(CARDS['GD05-130']);
    const nb = c[0]; p.hand.splice(p.hand.indexOf(nb), 1); g.deployBase(p, nb); } }));

  // ======================= GD06 =======================
  F('GD06-064', 'full', { ap: (g, u) => u.owner.opp.units.some(x => x.def.lv >= 5) ? 3 : 0 });
  const sgB = (g, p) => p.units.filter(x => x.rested && anyTr(g, x, 'Dianna Counter', 'Militia') && g.kw(x, 'Blocker') > 0);
  F('GD06-065', 'full', { activate: { cost: 4, once: true, can: (g, p) => sgB(g, p).length > 0, score: (g, p) => sgB(g, p).reduce((s, x) => s + readyVal(g, p, x), 0) - 1.8,
    run(g, p, u) { for (const x of sgB(g, p)) setActive(g, x, true); paidFx(g, p, u, 4); } } });
  F('GD06-066', 'full', { attack(g, u, b) { if (u.linked) activatePairedCmd(g, u, 'Action', b); } });
  F('GD06-067', 'full', { whenPaired(g, u, pd) { if (!(pd.lv >= 4)) return; const p = u.owner; const c = p.opp.units.filter(x => x.rested && g.hpLeft(x) <= 3 && !x.noReady); if (c.length) p.ai.pickRemovalTarget(g, p, c, 'destroy').noReady = true; },
    ai_whenPaired: (g, p) => Math.max(0, ...p.opp.units.filter(x => x.rested && g.hpLeft(x) <= 3).map(x => 0.5 * p.ai.unitValue(g, x) + (g.kw(x, 'Blocker') ? 0.5 : 0))) * 0.7 });
  F('GD06-068', 'full', { deploy(g, u) { const p = u.owner; const c = p.opp.units.filter(x => x.def.lv <= 3); if (!c.length) return; const act = c.filter(x => !x.rested);
    const t = act.length ? p.ai.pickRestTarget(g, p, act) : p.ai.pickApDownTarget(g, p, c, 2, null); t.rested = true; if (otherGT(g, u)) t.tAP -= 2; },
    ai_deploy: (g, p) => p.ai.restScore(g, p, x => x.def.lv <= 3) });
  F('GD06-069', 'full', { note: 'Activate･Action used in the battle action step on our damaged (Dianna Counter) Unit in that battle',
    battleAct: { cost: 1, once: true, can: (g, p, u, b) => { const bt = myBattle(g, p, b); return !!bt && bt.mine.dmg > 0 && tr(g, bt.mine, 'Dianna Counter'); },
      value: (g, p, u, b) => { const bt = myBattle(g, p, b); return hpSwing(g, p, bt, bt.mine, 1); }, run(g, p, u, b) { const bt = myBattle(g, p, b); if (bt) g.heal(bt.mine, 1); paidFx(g, p, u, 1); } } });
  F('GD06-070', 'simplified', { note: 'the ③-paid condition counts costs paid through this file\'s White Unit effects only',
    deploy(g, u) { if (u.owner.units.length < 6) g.deployToken(u.owner, 'Gozzo'); }, ai_deploy: (g, p) => p.units.length < 5 ? 1.2 : 0,
    attack(g, u, b) { if (paidTotal(g, u.owner) >= 3) apDownPick(g, u.owner, 5, null, { battle: true, b }); } });
  F('GD06-071', 'full', { onCommand(g, u, c) { if (!yourTurn(g, u.owner) || !c.traits.includes('Special Move') || !u.owner.opp.units.length || !onceT(g, u, 'meikyo')) return; if (apDownPick(g, u.owner, 2, null, null)) u.tAP += 2; } });
  F('GD06-072', 'full', { destroyed(g, u, pilot) { if (pilot && otherGT(g, u)) trashToHand(g, u.owner, c => c.type === 'COMMAND' && c.lv <= 5); } });
  F('GD06-073', 'full', { onDestroyShieldArea(g, u) { if (u.pilot && u.owner.opp.units.some(x => !x.rested && x.def.lv <= 3) && onceT(g, u, 'wz')) restPick(g, u.owner, x => x.def.lv <= 3); } });
  F('GD06-078', 'full', { activate: { cost: 3, can: (g, p, u) => !u.rested && p.units.some(x => x !== u && tr(g, x, 'Dianna Counter')) && p.opp.units.some(x => !x.rested && x.def.lv <= 4),
    score: (g, p, u) => p.ai.restScore(g, p, x => x.def.lv <= 4) - 1.3 - (g.canAttackThisTurn(u) ? 0.4 : 0),
    run(g, p, u) { u.rested = true; paidFx(g, p, u, 3); if (p.units.some(x => x !== u && tr(g, x, 'Dianna Counter'))) restPick(g, p, x => x.def.lv <= 4); } } });
  F('GD06-097', 'full', { p_onBlock(g, u) { if (onceT(g, u, 'harry')) setActive(g, u, false); } });
  const duoGuard = (g, x, a) => x.linked && x.rested && !!x.pilot && x.pilot.id === 'GD06-098' && a && a.owner !== x.owner && a.def.lv <= x.def.lv;
  function duoInstall(p) { if (p.flags.w_duoSR) return; p.flags.w_duoSR = true; const old = p.flags.shieldRed;
    p.flags.shieldRed = (g, D, n, srcP, opts) => { if (old) n = old(g, D, n, srcP, opts); if (n > 0 && D.base && opts && opts.src && D.units.some(x => duoGuard(g, x, opts.src))) return 0; return n; }; }
  F('GD06-098', 'simplified', { note: 'Base protected from battle damage and <Breach> of enemy Units with Lv <= this Unit; other enemy Unit effect damage to the Base carries no source Unit and is not prevented',
    p_whenPaired(g, u) { duoInstall(u.owner); }, p_guardArea: (g, self, a, kind) => kind === 'base' && duoGuard(g, self, a) });
  F('GD06-100', 'simplified', { note: 'cost -1 when paired with a Lv5+ (Dianna Counter) Unit is a refund of 1 on pairing (the AI still needs ① available to play it)',
    ai_whenPaired: (g, p, u) => (tr(g, u, 'Dianna Counter') && u.def.lv >= 5) ? 0.5 : 0,
    p_whenPaired(g, u) { const p = u.owner; if (!tr(g, u, 'Dianna Counter') || u.def.lv < 5 || !yourTurn(g, p)) return; if (p.flags.lastPayEX && p.ex < 5) p.ex++; else if (p.resRested > 0) p.resRested--; } });
  const ivN = (g, p) => p.units.filter(x => x.def.color === 'White' && g.kw(x, 'Blocker') > 0).length;
  function ivRun(g, p, first) { const n = ivN(g, p); const done = []; if (first && n > 0 && g.alive(first)) { first.tAP -= 2; done.push(first); }
    for (let k = done.length; k < n; k++) { const c = p.opp.units.filter(x => !done.includes(x)); if (!c.length) break; const t = p.ai.pickApDownTarget(g, p, c, 2, null); t.tAP -= 2; done.push(t); } }
  F('GD06-118', 'full', cmd({ actionToo: true, canMain: (g, p) => ivN(g, p) > 0 && p.opp.units.length > 0, main(g, p) { ivRun(g, p, null); },
    score: (g, p) => apDownScore(g, p, 2) + (ivN(g, p) >= 2 ? 0.2 : 0),
    defAction: { can: (g, p, b) => ivN(g, p) > 0 && g.alive(b.attacker), value: (g, p, b, threat) => apDownDef(2, false).value(g, p, b, threat) + 0.15 * Math.min(ivN(g, p) - 1, p.opp.units.filter(x => x !== b.attacker && g.canAttackThisTurn(x)).length),
      run(g, p, b) { ivRun(g, p, b.attacker); } } }));
  function sudRun(g, p, opt) { const c = p.opp.units.filter(x => !x.rested && g.hpLeft(x) <= 3); if (c.length) bestBy(c, x => unhV(g, p, x)).rested = true; if (castNow(g, 'GD06-119', opt)) pairFromTrashMF(g, p, 'GD06-119'); }
  F('GD06-119', 'full', cmd({ specialMove: true, pilotName: 'Schwarz Bruder', actionOnly: true, canMain: () => false, main() {}, canAction: () => true,
    action(g, p, b, role, unit, opt) { sudRun(g, p, opt); },
    defAction: { can: (g, p) => p.opp.units.some(x => !x.rested && g.hpLeft(x) <= 3) || mfOpen(g, p),
      value: (g, p) => Math.max(0, ...p.opp.units.filter(x => !x.rested && g.hpLeft(x) <= 3).map(x => unhV(g, p, x))) + mfPairVal(g, p, 'GD06-119') * 0.5,
      run(g, p) { sudRun(g, p, null); } } }));
  const poeN = (g, x) => g.kw(x, 'High-Maneuver') > 0 ? 6 : 2;
  F('GD06-121', 'full', cmd({ pilotName: 'Poe Aijee', actionOnly: true, canMain: () => false, main() {}, canAction: () => true,
    action(g, p, b) { const bt = myBattle(g, p, b); const t = bt ? bt.foe : (p.opp.units.length ? p.ai.pickApDownTarget(g, p, p.opp.units, 2, null) : null); if (t) t.bAP -= poeN(g, t); },
    defAction: { can: (g, p, b) => g.alive(b.attacker) && b.attacker.owner !== p,
      value: (g, p, b, threat) => apDownDef(poeN(g, b.attacker), true).value(g, p, b, threat), run(g, p, b) { b.attacker.bAP -= poeN(g, b.attacker); } } }));
  F('GD06-130', 'full', baseShield({ baseDeploy(g, p) { const n = p.units.filter(x => anyTr(g, x, 'Dianna Counter', 'Militia')).length; if (n > 0) apDownPick(g, p, n, x => !x.pilot, null); } }));

  // ======================= ST =======================
  F('ST01-011', 'full', { p_attack(g, u) { const p = u.owner; if (p.resRested > 0 && onceT(g, u, 'suletta')) p.resRested--; } });
  const linkPump = (g, p) => { let s = -0.3; for (const a of p.units) { if (!a.linked || !g.canAttackThisTurn(a)) continue; const ap = g.ap(a); for (const t of p.opp.units) if (t.rested && ap < g.hpLeft(t) && ap + 1 >= g.hpLeft(t)) { s += 0.8; break; } } return s; };
  F('ST01-016', 'full', baseShield({ activate: { cost: 0, restBase: true, can: (g, p) => p.units.some(x => x.linked), score: (g, p) => linkPump(g, p), run(g, p) { for (const x of p.units) if (x.linked) x.tAP += 1; } } }));
  F('ST04-002', 'full', { deploy(g, u) { loot(g, u.owner, 1); }, ai_deploy: () => 0.3 });
  F('ST04-015', 'full', baseShield({ activate: { cost: 2, once: true, can: (g, p) => rbAny(g, p).length > 0, score: (g, p) => Math.max(0, ...rbAny(g, p).map(x => readyVal(g, p, x))) - 1.0,
    run(g, p) { const c = rbAny(g, p); if (c.length) setActive(g, bestBy(c, x => readyVal(g, p, x)), true); } } }));
  F('ST05-012', 'full', { p_whenPaired(g, u) { const p = u.owner; if (p.units.filter(x => x !== u && anyTr(g, x, 'Gjallarhorn', 'Tekkadan')).length >= 2) restPick(g, p, x => g.hpLeft(x) <= 3); },
    ai_whenPaired: (g, p, u) => p.units.filter(x => x !== u && anyTr(g, x, 'Gjallarhorn', 'Tekkadan')).length >= 2 ? p.ai.restScore(g, p, x => g.hpLeft(x) <= 3) : 0 });
  F('ST09-004', 'full', { kw: (g, u, k) => (k === 'Suppression' && !!u.owner.base) ? 1 : 0, note: 'the EX Base counts as a friendly Base' });
  F('ST10-007', 'full', { whenLinked(g, u) { const p = u.owner; const f = c => c.type === 'COMMAND' && c.lv <= 4; if (!p.trash.some(f) || ggCount(p) < 2) return; if (development(g, p, 2)) trashToHand(g, p, f); },
    ai_whenLinked: (g, p) => (ggCount(p) >= 2 && p.trash.some(c => c.type === 'COMMAND' && c.lv <= 4)) ? 1.0 : 0 });
  F('ST10-008', 'full', { deploy(g, u) { const p = u.owner; if (ggCount(p) < 4 || p.deck.length < 3) return; if (development(g, p, 2)) loot(g, p, N_ENEMY); }, ai_deploy: (g, p) => ggCount(p) >= 4 ? 0.3 : 0 });
  F('ST10-015', 'full', cmd({ pilotName: 'Claire Heathrow', actionOnly: true, canMain: () => false, main() {}, canAction: (g, p) => p.units.some(x => tr(g, x, GG)),
    action(g, p, b) { if (!p.units.some(x => tr(g, x, GG))) return; const bt = myBattle(g, p, b); if (bt) bt.foe.bAP -= 3; else apDownPick(g, p, 3, null, { battle: true, b }); },
    defAction: apDownDef(3, true, (g, p) => p.units.some(x => tr(g, x, GG))) }));
  F('ST14-003', 'full', { ai_deploy: (g, p) => p.opp.trash.some(x => x.type === 'UNIT') ? 0.2 : 0, deploy(g, u) { const o = u.owner.opp; for (let k = 0; k < 2; k++) { const c = o.trash.filter(x => x.type === 'UNIT'); if (!c.length) break; const w = o.ai.pickWorstCard(g, o, c); fromTrash(o, w); o.exile.push(w); } } });
  F('ST14-011', 'full', { p_attack(g, u, b) { const n = u.owner.opp.units.filter(x => x.rested).length; if (n > 0) apDownPick(g, u.owner, n, null, { battle: true, b }); } });
  const ntRest = (g, p) => p.opp.units.filter(x => !x.rested && g.hpLeft(x) <= 3).map(x => p.ai.restValue(g, p, x)).sort((a, b) => b - a).slice(0, 2).reduce((s, v) => s + v, 0);
  F('ST14-013', 'full', cmd({ actionToo: true, burst(g, p) { apDownPick(g, p, 3, null, null); }, canMain: (g, p) => p.opp.units.length > 0,
    main(g, p) { if (ntRest(g, p) > apDownScore(g, p, 3)) { restPick(g, p, x => g.hpLeft(x) <= 3); restPick(g, p, x => g.hpLeft(x) <= 3); } else apDownPick(g, p, 3, null, null); },
    score: (g, p) => Math.max(ntRest(g, p) - 0.8, apDownScore(g, p, 3)),
    defAction: apDownDef(3, false) }));
  F('ST14-016', 'full', baseShield({ onAllyLinked(g, p) { if (yourTurn(g, p) && p.opp.units.some(x => x.def.lv <= 5) && pOnce(g, p, 'gryph')) apDownPick(g, p, 1, x => x.def.lv <= 5, null); } }));

  // ======================= previously auto-compiled cards given hand entries (AI can use their Action side) =======================
  const navalBlk = (g, p, b) => { const bt = myBattle(g, p, b); return bt && g.kw(bt.mine, 'Blocker') > 0 ? bt : null; };
  F('GD01-120', 'full', cmd({ note: 'overrides the auto-compiled entry: Action used by the defender on its battling Blocker', actionOnly: true, canMain: () => false, main() {},
    canAction: (g, p) => p.units.some(x => g.kw(x, 'Blocker') > 0), burst(g, p) { apDownPick(g, p, 3, null, null); },
    action(g, p, b) { const bt = navalBlk(g, p, b); const c = p.units.filter(x => g.kw(x, 'Blocker') > 0); const t = bt ? bt.mine : (c.length ? p.ai.pickBestAttacker(g, p, c) : null); if (t) t.tAP += 3; },
    defAction: { can: (g, p, b) => !!navalBlk(g, p, b), value: (g, p, b) => { const bt = navalBlk(g, p, b); return apSwing(g, p, bt, bt.mine, 3); }, run(g, p, b) { const bt = navalBlk(g, p, b); if (bt) bt.mine.tAP += 3; } } }));
  const hopeAct = (g, p) => p.opp.units.filter(x => !x.rested);
  F('GD06-120', 'full', cmd({ note: 'overrides the auto-compiled entry: Action used on the opponent\'s turn to rest an active enemy Unit (it stays rested through our turn)', actionToo: true,
    burst(g, p) { restPick(g, p, x => g.hpLeft(x) <= 5); }, canMain: (g, p) => hopeAct(g, p).length > 0, main(g, p) { restPick(g, p, null); }, score: (g, p) => p.ai.restScore(g, p, null) - 0.8,
    action(g, p) { restPick(g, p, null); },
    defAction: { can: (g, p) => g.turnPlayer !== p && hopeAct(g, p).length > 0, value: (g, p) => Math.max(0, ...hopeAct(g, p).map(x => unhV(g, p, x))),
      run(g, p) { const c = hopeAct(g, p); if (c.length) bestBy(c, x => unhV(g, p, x)).rested = true; } } }));
};
