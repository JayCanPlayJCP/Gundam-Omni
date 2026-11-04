'use strict';
// Red cards, batch 2 (101 cards, written from the official English text in cards.json).
// NOTES
// Rules calls:
// - Costs are not effects: CR 13-1-3-1 defines <Support N> as "【Activate･Main】Rest this Unit：...", so resting for a cost
//   (Support, Trinity Warship, GN High Mega Launcher, Gaza C) does NOT trigger "when this Unit is rested by an effect".
//   Own *effects* that rest own Units go through restByEffect() below (Red Gundam, Throne Eins, Dynames, Human Karma).
// - "Destroys an enemy shield area card" triggers (Sinanju, Dragon, Psycho Gundam (GQ), Gaia) are tracked with a
//   before/after snapshot of the defender's shield area for that battle and resolved right after the battle: at the next
//   friendly keyword query outside a battle (i.e. before the AI's next decision), next friendly attack/deploy/command/pair,
//   or the end phase. Gaia (moves cards from hand) only resolves at those explicit hooks.
// - Base "when this Base receives battle damage" triggers (Izuma Colony, Argama) run inside baseNoBattle (returns false).
// - Hoka Kyoten Juzetsujin / Rose Screamer "pair this card from your trash" intercept the one trash push that castCommand
//   makes for the card (own-property push override on that trash array, removed on first use).
// Wished-for hooks:
// - onRested(g, u, srcPlayer, byEffect) fired by g.restUnit / every effect rest (Throne Drei, GuAIZ (Commander), Doritea).
// - onSetActive / canSetActive(g, u, srcPlayer) for "can't be set as active by enemy effects" (Reginlaze Julia).
// - onBattleDestroyCard(g, attacker, victim|null) per card (Sinanju, Dragon, Gaia, Psycho, McGillis) instead of snapshots.
// - permActive(g, t, attacker) (Duel Gundam (Assault Shroud) GD03-042 needs the attacker's own AP).
// - unit Activate･Action abilities in the action step (Galluss-K, Milliardo Peacecraft) and base Activate･Action (Gamow).
// - command postTrash(g, p, c) after castCommand puts the card in the trash (Hoka Kyoten / Rose Screamer pair-from-trash).
// - victim's pilot passed to onBattleKill / p_onBattleKill and to p_onEffectKillWhileAttacking (Olba Frost, Yzak Jule
//   use the victim owner's trash order instead).
// - "can't activate <Blocker>" flag per unit (Girty Lue); "a friendly paired Unit destroyed an enemy Unit with battle
//   damage this turn" player flag (Libra); damage-dealt modifier by source card (ZZ Gundam for non-Red AEUG effects).
// Skipped: none (every remaining Red card is registered; partial ones are 'simplified' with a note).
module.exports = function (F, H, EFX) {
  const { CARDS, shuffle } = require('./engine');
  const { tr, yourTurn, dmgPick, lookTop, cmd, baseShield, grantActive } = H;

  // ---------------- local helpers ----------------
  const has = (pd, t) => !!pd && (pd.traits || []).includes(t);
  const T = (p) => p.flags.turn || (p.flags.turn = {});
  const toHand = (g, p, c) => { p.hand.push(c); g.stats.p[p.i].extraCards++; };
  const colorOf = (pd) => (CARDS[pd.id] || pd).color;
  const onceT = (g, u, k) => { const key = 'o_' + k; if (u.flags[key] === g.turn) return false; u.flags[key] = g.turn; return true; }; // once per turn (any turn)
  const unitT = (c, ...ts) => c.type === 'UNIT' && ts.some(t => c.traits.includes(t));
  const postCombat = (p) => !!T(p).attacked;
  function pHit(p, n, pred) { const N = p.deck.length; if (!N) return 0; const K = p.deck.filter(pred).length; let q = 1; for (let i = 0; i < Math.min(n, N); i++) q *= Math.max(0, N - K - i) / (N - i); return 1 - q; }
  function lookDeploy(g, p, n, pred) { // look at top n, may deploy 1 matching Unit card, rest randomly to bottom (then its Deploy resolves)
    const top = p.deck.splice(0, n); const hits = top.filter(c => c.type === 'UNIT' && pred(c)); let got = null;
    if (hits.length && p.units.length < 6) { got = p.ai.pickBestCard(g, p, hits); top.splice(top.indexOf(got), 1); }
    shuffle(top, g.rng); p.deck.push(...top); if (got) g.deployUnit(p, got); return got;
  }
  const sweepVal = (g, p, n, f) => p.opp.units.filter(x => !f || f(x)).reduce((s, x) => s + p.ai.dmgTargetValue(g, p, x, n), 0);
  const baseHitVal = (g, D, n) => { if (!D.base) return 0; const left = D.base.def.hp - D.base.dmg; return n >= left ? (D.base.ex ? 1.1 : 1.6) : 0.35 * n / left; };
  const dmgBase = (g, srcP, D, n) => { if (D.base) g.damageShieldArea(srcP, D, n, { effect: true }); };
  const newEXBase = () => ({ def: { id: 'EXB', name: 'EX Base', hp: 3, traits: [], text: '' }, dmg: 0, ex: true });
  // Reginlaze Julia (paired): enemy Units can't be set as active by enemy effects.
  const canSetActive = (g, u) => !u.owner.opp.units.some(x => x.def.id === 'GD06-037' && x.pilot);
  const setActive = (g, u) => { if (!g.alive(u) || !canSetActive(g, u)) return false; u.rested = false; return true; };
  function restByEffect(g, u) { // an own effect rests own Unit u -> "when this Unit is rested by an effect" reactions
    if (!g.alive(u) || u.rested) return false; u.rested = true;
    const e = EFX[u.def.id]; if (e && e.onRestedByEffect) e.onRestedByEffect(g, u); return true;
  }
  function restCost(g, p, x, byEffect) { // AI cost of resting own active Unit x now
    if (x.rested) return 0;
    if (byEffect && x.def.id === 'GD04-041' && x.flags.o_drei !== g.turn && canSetActive(g, x)) return 0.05; // Throne Drei readies itself
    let c = 0.15;
    if (g.turnPlayer === p && !postCombat(p) && g.canAttackThisTurn(x)) c += 0.4 + g.ap(x) * 0.15;
    if (g.kw(x, 'Blocker')) c += 0.6;
    return c + p.ai.exposure(g, p, x) * 0.6;
  }
  const cheapest = (g, p, cands, byEffect) => [...cands].sort((a, b) => restCost(g, p, a, byEffect) - restCost(g, p, b, byEffect));
  function killEnable(g, p, a, n) { let v = 0; for (const t of p.opp.units) if (t.rested && g.ap(a) < g.hpLeft(t) && g.ap(a) + n >= g.hpLeft(t)) v = Math.max(v, p.ai.unitValue(g, t)); return v; }
  function pumpVal(g, p, n, f, k = 1) { // AI value of AP+n this turn for up to k attackers matching f
    if (postCombat(p)) return 0;
    const vals = p.units.filter(a => g.canAttackThisTurn(a) && (!f || f(a))).map(a => killEnable(g, p, a, n) * 0.7).sort((a, b) => b - a);
    return vals.slice(0, k).reduce((s, v) => s + v, 0);
  }
  function pumpPick(g, p, n, cands) { // best unit to receive AP+n (prefers the one in battle, then kill-enabling attackers)
    const b = g.inBattle; let best = null, bv = -1e9;
    for (const a of cands) { let v = (b && (b.attacker === a || b.target === a) ? 5 : 0) + (g.canAttackThisTurn(a) ? 1 : 0) + killEnable(g, p, a, n) + g.ap(a) * 0.05; if (v > bv) { bv = v; best = a; } }
    return best;
  }
  const myBattler = (g, p) => { const b = g.inBattle; if (!b) return null; if (b.attacker.owner === p) return b.attacker; return (b.target !== 'player' && b.target.owner === p) ? b.target : null; };
  const foeBattler = (g, p) => { const b = g.inBattle; if (!b) return null; if (b.attacker.owner !== p) return b.attacker; return b.target !== 'player' ? b.target : null; };
  const battleGuard = (ok) => (g, p) => (g.inBattle && !ok(g, p)) ? 99 : 0; // costMod: combat trick unplayable if its target condition fails
  const battleFoe = (g, u) => { const b = g.inBattle; if (!b) return null; if (b.attacker === u) return b.target !== 'player' ? b.target : null; if (b.target === u) return b.attacker; return null; };
  const attackingUnit = (g, u) => { const b = g.inBattle; return (b && b.attacker === u && b.target !== 'player') ? b.target : null; };
  function supportAct(n, o = {}) { // <Support N>: rest this Unit (cost) -> 1 other friendly Unit gets AP+N this turn
    const pick = (g, p, u) => { let best = null, bv = -1; for (const a of p.units) { if (a === u || !g.canAttackThisTurn(a)) continue; const pref = o.prefer && o.prefer(g, a, u) ? 0.3 : 0;
      const v = Math.max(g.ap(a) * 0.05, killEnable(g, p, a, n)) + pref; if (v > bv) { bv = v; best = a; } } return best; };
    return { cost: 0, can: (g, p, u) => !u.rested && !postCombat(p) && p.units.some(x => x !== u && g.canAttackThisTurn(x)),
      score: (g, p, u) => { const free = o.free && o.free(g, p, u); if (!free && g.canAttackThisTurn(u) && g.ap(u) >= 3) return -1;
        let s = -0.2 - (free ? 0 : (g.kw(u, 'Blocker') ? 0.4 : 0)); for (const a of p.units) { if (a === u || !g.canAttackThisTurn(a)) continue; s = Math.max(s, killEnable(g, p, a, n) * 0.8); } return s; },
      run: (g, p, u) => { u.rested = true; const best = pick(g, p, u); if (best) { best.tAP += n; if (o.after) o.after(g, p, u, best); } } };
  }
  // ---- shield-area-hit snapshots: record at attack, resolve after the battle ----
  const SH = {};
  function shRec(g, a, cb, src, battleOnly, unsafe) {
    const b = g.inBattle; if (!b) return; const D = a.owner.opp;
    const r = { b, turn: g.turn, cb, src: src.uid, bo: !!battleOnly, unsafe: !!unsafe, sh: D.shields.length, bid: D.base ? D.base.def.id : null, bdmg: D.base ? D.base.dmg : 0 };
    a.flags.shT = [...(a.flags.shT || []), r]; a.owner.flags.shN = (a.owner.flags.shN || 0) + 1;
  }
  function shResolve(g, p, safeOnly) {
    if (!(p.flags.shN > 0)) return; const fire = []; let left = 0;
    for (const a of p.units) { const L = a.flags.shT; if (!L || !L.length) continue; const keep = [];
      for (const r of L) { if (g.inBattle === r.b || (safeOnly && r.unsafe && r.turn === g.turn)) keep.push(r); else if (r.turn === g.turn) fire.push([a, r]); }
      a.flags.shT = keep; left += keep.length; }
    p.flags.shN = left;
    for (const [a, r] of fire) {
      if (g.winner !== null) return; if (!g.alive(a)) continue; if (r.bo && (r.b.target !== 'player' || r.b.shieldProtect)) continue;
      const D = p.opp; let n = Math.max(0, r.sh - D.shields.length); if (r.bid && (!D.base || D.base.def.id !== r.bid || D.base.dmg < r.bdmg)) n++;
      const src = p.units.find(x => x.uid === r.src); if (n > 0 && src) SH[r.cb](g, p, src, a, n);
    }
  }
  const pend = (g, p) => { if (p.flags.shN > 0 && !g.inBattle) shResolve(g, p, true); };
  const shHooks = (extra) => Object.assign({
    onAllyAttack(g, u) { shResolve(g, u.owner); }, onAllyDeploy(g, u) { shResolve(g, u.owner); }, onCommand(g, u) { shResolve(g, u.owner); },
    onAllyPaired(g, u) { shResolve(g, u.owner); }, endTurn(g, u) { shResolve(g, u.owner); }, aura_kw(g, s) { pend(g, s.owner); return 0; }, kw(g, u) { pend(g, u.owner); return 0; } }, extra);
  // ---- command-pilot from trash (Hoka Kyoten / Rose Screamer) ----
  function pairFromTrash(g, p, id) {
    if (g.inBattle) return; // activated as a paired card's 【Main】: the card is not in the trash
    const c = CARDS[id]; const t = p.trash;
    const pickU = () => { const mf = p.units.filter(u => !u.pilot && tr(g, u, 'MF') && p.ai.canPair(g, u)); if (!mf.length) return null; const po = p.ai.pilotObj(c, true);
      return mf.reduce((a, b) => p.ai.pairBonus(g, p, b, po) > p.ai.pairBonus(g, p, a, po) ? b : a); };
    if (t.length && t[t.length - 1] === c) { const u = pickU(); if (u) { t.pop(); g.pair(u, p.ai.pilotObj(c, true)); } return; } // already trashed
    if (Object.prototype.hasOwnProperty.call(t, 'push')) return;
    t.push = function (...a) { delete t.push; if (a.length === 1 && a[0] === c) { const u = pickU(); if (u) { g.pair(u, p.ai.pilotObj(c, true)); return t.length; } } return Array.prototype.push.apply(t, a); };
  }
  const trashPairVal = (g, p, id) => { const c = CARDS[id]; const po = p.ai.pilotObj(c, true); const mf = p.units.filter(u => !u.pilot && tr(g, u, 'MF') && p.ai.canPair(g, u)); return mf.length ? Math.max(...mf.map(u => p.ai.pairBonus(g, p, u, po))) : 0; };
  function activatePairedMain(g, u) { // 【During Link】【Attack】Activate 【Main】 on the card paired with this Unit
    if (!u.linked || !u.pilot || !u.pilot.cmdPilot) return; const e = EFX[u.pilot.id];
    if (e && e.canMain && e.canMain(g, u.owner)) { e.main(g, u.owner); if (CARDS[u.pilot.id].traits.includes('Special Move')) u.owner.specialMoveThisTurn = true; }
  }
  const victimPilot = (victim) => { const t = victim.owner.trash; if (victim.token) return t[t.length - 1] || null; const i = t.lastIndexOf(victim.def); return i >= 0 ? (t[i + 1] || null) : null; };
  const zz = (p) => p.units.filter(x => x.def.id === 'GD06-033').length; // ZZ Gundam: your (AEUG) cards deal +1 damage to enemy Units
  function killPilot(g, byP, u) { // destroy only the Pilot paired with u
    const pd = u.pilot; if (!pd) return; const wasLinked = u.linked; u.pilot = null; u.owner.trash.push(pd.cmdPilot ? CARDS[pd.id] : pd);
    g.L(`P${u.owner.i} pilot ${pd.name} of ${u.def.name} destroyed`);
    const pe = EFX[pd.id]; if (pe && pe.p_destroyed) { u.linked = wasLinked; pe.p_destroyed(g, u, pd, { effect: true, by: byP }); } u.linked = false;
    if (g.alive(u) && g.hpLeft(u) <= 0) g.destroy(u, { effect: true, by: byP });
  }
  const pilotLoss = (g, p, u) => { const pd = u.pilot; if (!pd) return 0; if (g.hpLeft(u) - pd.hp <= 0) return p.ai.unitValue(g, u) + 0.6; return 1.2 + (u.linked ? 0.5 : 0) + pd.ap * 0.55 + Math.max(0, pd.hp) * 0.45; };
  const pairedWith = (u, t) => !!u.pilot && has(u.pilot, t);
  const baseOnce = (g, p, k) => { if (!p.base) return false; if (p.base['o_' + k] === g.turn) return false; p.base['o_' + k] = g.turn; return true; };
  const basePump = (n, cond) => ({ cost: 0, restBase: true, can: (g, p) => cond(g, p) && !postCombat(p) && p.units.some(u => g.canAttackThisTurn(u)),
    score: (g, p) => Math.max(pumpVal(g, p, n, null, 1), p.opp.base ? 0.15 : 0) - 0.05, run: (g, p) => { const u = pumpPick(g, p, n, p.units); if (u) u.tAP += n; } });

  // ======================= Clan =======================
  F('GD02-038', 'full', { deploy(g, u) { lookDeploy(g, u.owner, 3, c => c.traits.includes('Clan') && c.lv <= 4); }, ai_deploy: (g, p) => pHit(p, 3, c => unitT(c, 'Clan') && c.lv <= 4) * 2.4 });
  F('GD03-039', 'full', { deploy(g, u) { const p = u.owner; const c = p.units.filter(x => x !== u && !x.rested && tr(g, x, 'Clan')); if (!c.length) return; const r = cheapest(g, p, c, true)[0];
    if (restByEffect(g, r)) dmgPick(g, p, 2, x => g.ap(x) <= 2); },
  ai_deploy: (g, p) => { const c = p.units.filter(x => !x.rested && tr(g, x, 'Clan')); if (!c.length) return 0; return p.ai.bestDamageValue(g, p, 2, x => g.ap(x) <= 2) - restCost(g, p, cheapest(g, p, c, true)[0], true); } });
  F('ST06-001', 'full', { whenLinked(g, u) { if (u.owner.units.some(x => x !== u && tr(g, x, 'Clan'))) u.tKw['First Strike'] = 1; } });
  F('ST06-002', 'full', { deploy(g, u) { if (u.owner.units.some(x => x !== u && tr(g, x, 'Clan'))) dmgPick(g, u.owner, 1, null); }, ai_deploy: (g, p) => p.units.some(x => tr(g, x, 'Clan')) ? p.ai.bestDamageValue(g, p, 1, null) : 0 });
  F('ST06-009', 'full', { p_whenLinked(g, u) { lookTop(g, u.owner, 1, c => c.traits.includes('Clan')); } });
  F('ST06-014', 'full', baseShield({ activate: basePump(2, (g, p) => p.units.some(u => u.linked && tr(g, u, 'Clan'))) }));
  F('GD04-126', 'full', baseShield({ baseNoBattle(g, D, a) { const ap = g.ap(a); if (ap > 0 && ap <= 3) g.effectDamage(D, a, 1); return false; } }));

  // ======================= CB / GN Drive / Trinity =======================
  F('GD04-034', 'full', { ap: (g, u) => u.linked ? 2 * u.owner.units.filter(x => x.rested && tr(g, x, 'CB')).length : 0 });
  function einsPlan(g, p, u) { // Throne Eins: rest 1-2 other active CB Units -> that much damage to all enemy Units Lv<=6
    const c = cheapest(g, p, p.units.filter(x => x !== u && !x.rested && tr(g, x, 'CB')), true); let best = { k: 0, v: 0.3 };
    for (let k = 1; k <= Math.min(2, c.length); k++) { const v = sweepVal(g, p, k, x => x.def.lv <= 6) - c.slice(0, k).reduce((s, x) => s + restCost(g, p, x, true), 0); if (v > best.v) best = { k, v, units: c.slice(0, k) }; }
    return best;
  }
  F('GD04-036', 'full', { deploy(g, u) { const p = u.owner; const pl = einsPlan(g, p, u); if (!pl.k) return; let n = 0; for (const x of pl.units) if (restByEffect(g, x)) n++;
    if (n) for (const e of [...p.opp.units]) if (e.def.lv <= 6) g.effectDamage(p, e, n); }, ai_deploy: (g, p) => Math.max(0, einsPlan(g, p, null).v) });
  const ssPilot = (p, col) => p.units.some(x => x.pilot && has(x.pilot, 'Super Soldier') && colorOf(x.pilot) === col);
  F('GD04-037', 'full', { kw: (g, u, k) => k === 'First Strike' ? (ssPilot(u.owner, 'Red') ? 1 : 0) : k === 'Breach' ? (ssPilot(u.owner, 'Green') ? 3 : 0) : 0 });
  F('GD04-041', 'simplified', { note: 'readies when rested by an own Red effect (restByEffect); rests by enemy effects / other colour files have no hook',
    onRestedByEffect(g, u) { if (onceT(g, u, 'drei')) setActive(g, u); } });
  const cbF = (g, x) => tr(g, x, 'CB'); const dmgF = (g, t) => t.dmg > 0;
  F('GD04-045', 'full', { whenLinked(g, u) { grantActive(g, u.owner, cbF, dmgF, u, false); }, ai_whenLinked: (g, p) => Math.max(0, p.ai.unlockScore(g, p, x => cbF(g, x), t => t.dmg > 0) + 0.9) * 0.9 });
  F('GD04-046', 'full', { deploy(g, u) { const p = u.owner; const v = p.ai.bestDamageValue(g, p, 2, x => x.def.lv <= 3); const link = p.hand.some(c => c.type === 'PILOT' && g.isLinkPilot(u.def, c)) ? 0.8 : 0;
    if (v > restCost(g, p, u, true) + link + 0.2 && restByEffect(g, u)) dmgPick(g, p, 2, x => x.def.lv <= 3); },
  ai_deploy: (g, p) => Math.max(0, p.ai.bestDamageValue(g, p, 2, x => x.def.lv <= 3) - 0.4) });
  F('GD04-090', 'full', { p_onBattleKill(g, u) { if (yourTurn(g, u.owner) && u.linked && onceT(g, u, 'halle')) lookTop(g, u.owner, 1, c => c.traits.includes('CB')); } });
  F('GD04-111', 'full', cmd({ pilotName: 'Johann Trinity', actionToo: true, battlePump: 2, costMod: battleGuard((g, p) => { const m = myBattler(g, p); return !!m && tr(g, m, 'CB'); }),
    canMain: (g, p) => p.units.some(u => tr(g, u, 'CB') && g.canAttackThisTurn(u)), score: (g, p) => pumpVal(g, p, 2, u => tr(g, u, 'CB'), 3) - 1.2,
    main(g, p) { const c = p.units.filter(u => tr(g, u, 'CB')); for (let k = 0; k < 3 && c.length; k++) { const u = pumpPick(g, p, 2, c); c.splice(c.indexOf(u), 1); u.tAP += 2; } },
    action(g, p, b, role, unit) { const c = p.units.filter(u => tr(g, u, 'CB')); const first = unit && c.includes(unit) ? unit : null; if (first) { first.tAP += 2; c.splice(c.indexOf(first), 1); }
      for (let k = first ? 1 : 0; k < 3 && c.length; k++) { const u = pumpPick(g, p, 2, c); c.splice(c.indexOf(u), 1); u.tAP += 2; } } }));
  F('GD04-125', 'full', baseShield({ activate: { cost: 1, once: true, can: (g, p) => p.units.some(u => !u.rested && tr(g, u, 'CB')) && p.opp.units.some(x => x.def.lv <= 5),
    score: (g, p) => p.ai.bestDamageValue(g, p, 1, x => x.def.lv <= 5) - restCost(g, p, cheapest(g, p, p.units.filter(u => !u.rested && tr(g, u, 'CB')), false)[0], false) - 0.5,
    run(g, p) { const r = cheapest(g, p, p.units.filter(u => !u.rested && tr(g, u, 'CB')), false)[0]; r.rested = true; dmgPick(g, p, 1, x => x.def.lv <= 5); } } }));
  F('GD05-038', 'full', { kw: (g, u, k) => (k === 'Suppression' && u.linked) ? 1 : 0,
    activate: { cost: 0, once: true, can: (g, p) => p.units.filter(x => !x.rested && tr(g, x, 'CB')).length >= 3 && p.opp.units.length > 0,
      score: (g, p) => p.ai.bestDamageValue(g, p, 4, null) - cheapest(g, p, p.units.filter(x => !x.rested && tr(g, x, 'CB')), false).slice(0, 3).reduce((s, x) => s + restCost(g, p, x, false), 0),
      run(g, p) { for (const x of cheapest(g, p, p.units.filter(y => !y.rested && tr(g, y, 'CB')), false).slice(0, 3)) x.rested = true; dmgPick(g, p, 4, null); } } });
  F('GD05-048', 'full', { deploy(g, u) { u.flags.hasteUnitsOnly = true; }, ai_deploy: (g, p) => p.opp.units.some(x => x.rested) ? 0.6 : 0 });

  // ======================= Neo Zeon =======================
  F('GD01-053', 'full', { activate: { cost: 1, once: true, can: (g, p) => p.opp.units.some(x => g.ap(x) <= 2), score: (g, p) => p.ai.bestDamageValue(g, p, 1, x => g.ap(x) <= 2) - 0.7, run(g, p) { dmgPick(g, p, 1, x => g.ap(x) <= 2); } } });
  F('GD02-036', 'full', { whenLinked(g, u) { u.tKw.Suppression = 1; }, attack(g, u) { if (pairedWith(u, 'Neo Zeon')) dmgPick(g, u.owner, 2, x => x.dmg > 0); } });
  F('GD02-047', 'full', { activate: { cost: 0, can: (g, p, u) => !u.rested && p.opp.units.some(x => x.def.lv <= 5),
    score: (g, p, u) => p.ai.bestDamageValue(g, p, 1, x => x.def.lv <= 5) - p.ai.unitValue(g, u) * 0.5 - 0.3,
    run(g, p, u) { u.rested = true; g.destroy(u, { effect: true, by: p }); dmgPick(g, p, 1, x => x.def.lv <= 5); } } });
  F('GD02-091', 'full', { p_whenPaired(g, u) { if (u.def.color === 'Red') dmgPick(g, u.owner, 1, x => x.def.lv <= u.def.lv); }, ai_whenPaired: (g, p, u) => u.def.color === 'Red' ? p.ai.bestDamageValue(g, p, 1, x => x.def.lv <= u.def.lv) : 0 });
  const rzDmg = (g, t) => g.kw(t, 'Repair') ? 3 : 1;
  F('GD04-039', 'full', { costMod: (g, p) => p.trash.filter(c => c.traits.includes('Neo Zeon')).length >= 8 ? -4 : 0,
    deploy(g, u) { const p = u.owner; let best = null, bv = -1; for (const t of p.opp.units) { const v = p.ai.dmgTargetValue(g, p, t, rzDmg(g, t)); if (v > bv) { bv = v; best = t; } } if (best) g.effectDamage(p, best, rzDmg(g, best)); },
    ai_deploy: (g, p) => Math.max(0, ...p.opp.units.map(t => p.ai.dmgTargetValue(g, p, t, rzDmg(g, t)))) });
  F('GD04-043', 'full', { deploy(g, u) { dmgBase(g, u.owner, u.owner.opp, 1); } });
  SH['ST03-001'] = (g, p, src, a, n) => { if (a !== src || !yourTurn(g, p)) return; const k = Math.min(n, g.kw(src, 'Suppression') ? 2 : 1); for (let i = 0; i < k; i++) dmgPick(g, p, 2, null); };
  F('ST03-001', 'full', shHooks({ note: 'shield-area trigger resolved right after the battle (snapshot)', kw(g, u, k) { pend(g, u.owner); return (k === 'High-Maneuver' && u.pilot) ? 1 : 0; },
    attack(g, u, b) { shResolve(g, u.owner); if (b.target === 'player') shRec(g, u, 'ST03-001', u, true); } }));

  // ======================= Zeon =======================
  F('GD01-047', 'full', { attack(g, u) { const p = u.owner; if (p.units.filter(x => x !== u && x.rested).length >= 2) dmgPick(g, p, 3, null); } });
  F('GD01-048', 'full', { activate: supportAct(1), deploy(g, u) { lookTop(g, u.owner, 1, c => unitT(c, 'Zeon', 'Neo Zeon')); } });
  F('GD01-058', 'simplified', { note: 'Activate･Action (AP+1 this battle) used as a Main-phase AP+1 this turn on a Lv4+ attacker',
    activate: { cost: 1, once: true, can: (g, p) => !postCombat(p) && p.units.some(x => x.def.lv >= 4 && g.canAttackThisTurn(x)), score: (g, p) => pumpVal(g, p, 1, x => x.def.lv >= 4) - 0.6,
      run(g, p) { const u = pumpPick(g, p, 1, p.units.filter(x => x.def.lv >= 4)); if (u) u.tAP += 1; } } });
  F('GD03-092', 'full', { p_whenLinked(g, u) { const p = u.owner; const c = p.deck.shift(); if (!c) return; p.trash.push(c); if (c.traits.includes('Zeon') || c.traits.includes('Clan')) dmgPick(g, p, 1, null); },
    ai_whenLinked: (g, p) => pHit(p, 1, c => c.traits.includes('Zeon') || c.traits.includes('Clan')) * p.ai.bestDamageValue(g, p, 1, null) });
  F('ST13-010', 'full', { activate: { cost: 0, once: true, can: (g, p, u) => p.units.some(x => x.token) && g.canAttackThisTurn(u) && !postCombat(p) && !g.kw(u, 'Breach'),
    score: (g, p, u) => { const tok = p.units.filter(x => x.token); const tv = Math.min(...tok.map(x => p.ai.unitValue(g, x))); const kill = p.opp.units.some(t => t.rested && g.ap(u) >= g.hpLeft(t)) && (p.opp.base || p.opp.shields.length); return kill ? 1.3 - tv * 0.5 : -1; },
    run(g, p, u) { const tok = p.units.filter(x => x.token).sort((a, b) => p.ai.unitValue(g, a) - p.ai.unitValue(g, b))[0]; g.destroy(tok, { effect: true, by: p }); u.tKw.Breach = Math.max(u.tKw.Breach || 0, 3); } } });
  const hasDestroyed = (t) => /【Destroyed】/.test(t.def.text) || (!!t.pilot && /【Destroyed】/.test((CARDS[t.pilot.id] || {}).text || ''));
  F('GD03-037', 'full', { kw: (g, u, k) => { if (k !== 'First Strike' || !u.linked || !yourTurn(g, u.owner)) return 0; const t = battleFoe(g, u); return t && hasDestroyed(t) ? 1 : 0; } });
  F('GD01-114', 'full', cmd({ pilotName: 'Yonem Kirks', actionOnly: true, battlePump: 1, canMain: () => false, main() {},
    action(g, p, b, role, unit) { const m = unit || myBattler(g, p); if (m) m.tAP += 1; const o = p.units.filter(x => x !== m); if (o.length) pumpPick(g, p, 1, o).tAP += 1; } }));

  // ======================= ZAFT =======================
  F('GD01-045', 'full', { whenPaired(g, u) { lookDeploy(g, u.owner, 3, c => c.traits.includes('ZAFT') && c.lv <= 4); }, ai_whenPaired: (g, p) => pHit(p, 3, c => unitT(c, 'ZAFT') && c.lv <= 4) * 2.4 });
  const busterFree = (g, p, u) => pairedWith(u, 'Coordinator') && u.flags.o_buster !== g.turn && canSetActive(g, u) && p.units.some(x => x !== u && tr(g, x, 'ZAFT') && g.canAttackThisTurn(x));
  F('GD01-046', 'full', { activate: supportAct(3, { prefer: (g, a, u) => tr(g, a, 'ZAFT') && pairedWith(u, 'Coordinator'), free: busterFree,
    after(g, p, u, t) { if (pairedWith(u, 'Coordinator') && tr(g, t, 'ZAFT') && onceT(g, u, 'buster')) setActive(g, u); } }) });
  F('GD01-049', 'full', { deploy(g, u) { const p = u.owner; const c = p.units.filter(x => tr(g, x, 'ZAFT') && g.ap(x) >= 5); if (c.length) p.ai.pickBestAttacker(g, p, c).tKw['First Strike'] = 1; } });
  F('GD01-050', 'full', { attack(g, u, b) { if (g.ap(u) >= 5 && b.target !== 'player') dmgPick(g, u.owner, 2, null); } });
  F('GD01-054', 'full', { kw: (g, u, k) => (k === 'Breach' && g.ap(u) >= 5) ? 3 : 0 });
  F('GD01-063', 'full', { kw: (g, u, k) => { if (k !== 'First Strike' || !yourTurn(g, u.owner)) return 0; const t = battleFoe(g, u); return t && t.def.lv <= 2 ? 1 : 0; } });
  F('GD01-094', 'full', { note: 'effect kills detected from the victim owner trash (unit + its link pilot on top)',
    p_onBattleKill(g, u, victim) { const b = g.inBattle; if (b && b.attacker === u && !b.effectBattle && victim.linked && onceT(g, u, 'yzak')) g.draw(u.owner, 1); },
    p_onEffectKillWhileAttacking(g, u) { const t = u.owner.opp.trash; const pd = t[t.length - 1], ud = t[t.length - 2]; if (!pd || !ud || ud.type !== 'UNIT') return;
      const pilot = pd.type === 'PILOT' ? pd : (pd.type === 'COMMAND' && EFX[pd.id] && EFX[pd.id].pilotName ? u.owner.ai.pilotObj(pd, true) : null);
      if (pilot && g.isLinkPilot(ud, pilot) && onceT(g, u, 'yzak')) g.draw(u.owner, 1); } });
  F('GD02-045', 'full', { attack(g, u, b) { if (g.ap(u) >= 5 && b.target !== 'player') g.draw(u.owner, 1); } });
  const provOn = (g, s) => pairedWith(s, 'ZAFT') && yourTurn(g, s.owner);
  F('GD03-033', 'full', { ap: (g, u) => provOn(g, u) ? 2 : 0, aura_ap: (g, s, o) => (provOn(g, s) && tr(g, o, 'ZAFT')) ? 2 : 0,
    attack(g, u) { const n = Math.floor(g.ap(u) / 4); if (n > 0) dmgPick(g, u.owner, n, null); } });
  F('GD03-038', 'simplified', { note: 'Support 1 full; "rested by an effect" only fires for own Red effects (Support rest is a cost)', activate: supportAct(1),
    onRestedByEffect(g, u) { const p = u.owner; if (!yourTurn(g, p)) return; const c = p.units.filter(x => tr(g, x, 'ZAFT')); if (c.length) pumpPick(g, p, 2, c).tAP += 2; } });
  F('GD03-042', 'full', { note: 'active-target unlock checks for any own copy with 5+ AP (permActive has no attacker arg)', permActive: (g, t) => t.def.lv <= 5 && t.owner.opp.units.some(x => x.def.id === 'GD03-042' && g.ap(x) >= 5) });
  F('GD03-091', 'full', { p_whenLinked(g, u) { const p = u.owner; const c = p.trash.filter(x => x.type === 'BASE' && x.traits.includes('ZAFT')); if (!c.length) return; const b = p.ai.pickBestCard(g, p, c); p.trash.splice(p.trash.indexOf(b), 1); toHand(g, p, b); },
    ai_whenLinked: (g, p) => p.trash.some(x => x.type === 'BASE' && x.traits.includes('ZAFT')) ? 1.0 : 0 });
  F('ST04-009', 'full', { destroyed(g, u, pilot) { if (pilot && u.owner.units.some(x => x.linked)) g.draw(u.owner, 1); } });
  F('ST04-016', 'full', baseShield({ activate: basePump(1, () => true) }));
  F('GD01-127', 'simplified', baseShield({ note: 'Activate･Action (Breach 3 this battle) used in Main phase as Breach 3 this turn on a ZAFT 5+ AP attacker',
    activate: { cost: 0, restBase: true, can: (g, p) => !postCombat(p) && p.units.some(x => tr(g, x, 'ZAFT') && g.ap(x) >= 5 && g.canAttackThisTurn(x) && !g.kw(x, 'Breach')),
      score: (g, p) => p.units.some(x => tr(g, x, 'ZAFT') && g.ap(x) >= 5 && g.canAttackThisTurn(x) && p.opp.units.some(t => t.rested && g.ap(x) >= g.hpLeft(t))) ? 0.8 : 0.1,
      run(g, p) { const c = p.units.filter(x => tr(g, x, 'ZAFT') && g.ap(x) >= 5 && g.canAttackThisTurn(x) && !g.kw(x, 'Breach')); if (c.length) { const u = pumpPick(g, p, 0, c); u.tKw.Breach = Math.max(u.tKw.Breach || 0, 3); } } } }));
  F('ST09-003', 'full', { whenLinked(g, u) { const p = u.owner; if (p.trash.filter(c => c.color === 'Purple').length < 5) return;
    for (const pl of g.players) for (const x of [...pl.units]) if (g.ap(x) <= 5) g.effectDamage(p, x, 2); },
  ai_whenLinked: (g, p) => { if (p.trash.filter(c => c.color === 'Purple').length < 5) return 0; let v = 0; for (const pl of g.players) for (const x of pl.units) if (g.ap(x) <= 5) v += pl === p ? (g.hpLeft(x) <= 2 ? -p.ai.unitValue(g, x) : -0.1) : p.ai.dmgTargetValue(g, p, x, 2); return v; } });

  // ======================= Gjallarhorn =======================
  F('GD06-034', 'full', { deploy(g, u) { const p = u.owner; if (p.trash.filter(c => c.traits.includes('Gjallarhorn')).length >= 4) lookDeploy(g, p, 4, c => (c.traits.includes('Gjallarhorn') || c.traits.includes('Tekkadan')) && c.lv <= 6); },
    ai_deploy: (g, p) => p.trash.filter(c => c.traits.includes('Gjallarhorn')).length >= 4 ? pHit(p, 4, c => unitT(c, 'Gjallarhorn', 'Tekkadan') && c.lv <= 6) * 3.0 : 0 });
  F('GD06-037', 'simplified', { note: 'FS vs damaged enemy full; "enemy Units can\'t be set as active by enemy effects" only enforced for Red-file set-active effects',
    kw: (g, u, k) => { if (k !== 'First Strike' || !yourTurn(g, u.owner)) return 0; const t = battleFoe(g, u); return t && t.dmg > 0 ? 1 : 0; } });
  const topLv = (p) => Math.max(...p.opp.units.map(x => x.def.lv));
  F('GD06-038', 'full', { whenPaired(g, u) { const p = u.owner; if (!p.opp.units.length) return; const m = topLv(p); dmgPick(g, p, 3, x => x.def.lv === m); },
    ai_whenPaired: (g, p) => p.opp.units.length ? p.ai.bestDamageValue(g, p, 3, x => x.def.lv === topLv(p)) : 0 });
  F('GD06-043', 'full', { aura_ap: (g, s, o) => (s.linked && yourTurn(g, s.owner) && tr(g, o, 'Gjallarhorn')) ? 1 : 0 });
  F('GD06-089', 'full', { note: 'Gjallarhorn ally chosen at the attack; its active-target unlock turns on only if the battle damage destroyed a shield area card',
    p_attack(g, u, b) { if (!u.linked || b.target !== 'player') return; const p = u.owner, D = p.opp; const c = p.units.filter(x => x !== u && tr(g, x, 'Gjallarhorn') && g.canAttackThisTurn(x)); if (!c.length) return;
      const x = p.ai.pickBestAttacker(g, p, c); const sh = D.shields.length, bid = D.base ? D.base.def.id : null, bdmg = D.base ? D.base.dmg : 0;
      const hit = () => g.inBattle !== b && b.target === 'player' && !b.shieldProtect && (D.shields.length < sh || (!!bid && (!D.base || D.base.def.id !== bid || D.base.dmg < bdmg)));
      const old = x.attackActiveFilter; x.attackActiveFilter = t => (old && old(t)) || (t.def.lv <= 5 && hit()); } });

  // ======================= New UNE =======================
  F('GD02-040', 'full', { activate: supportAct(2),
    deploy(g, u) { const p = u.owner; const c = p.units.filter(x => x !== u && tr(g, x, 'New UNE')); if (!c.length) return; const x = p.ai.pickBestAttacker(g, p, c); const old = x.flags.nbd;
      x.flags.nbd = (g2, v, src, b) => (old && old(g2, v, src, b)) || (src.owner !== v.owner && g2.hpLeft(src) <= 2); } });
  F('GD02-093', 'full', { note: 'victim pilot read from the trash order', p_onBattleKill(g, u, victim) { if (!yourTurn(g, u.owner)) return; const pd = victimPilot(victim); if (pd && (pd.type === 'PILOT' || pd.type === 'COMMAND') && has(pd, 'Newtype')) g.draw(u.owner, 1); } });
  F('GD03-045', 'full', { ap: (g, u) => u.owner.units.some(x => x.token) ? 1 : 0 });
  F('GD04-044', 'full', { attack(g, u, b) { if (b.target !== 'player' && b.target.dmg > 0) u.bKw.Breach = Math.max(u.bKw.Breach || 0, 3); } });
  F('GD03-128', 'simplified', baseShield({ note: 'trigger (your Unit rested by an opponent effect -> 1 damage) not modeled: no rest hook' }));

  // ======================= Phantom Pain / Earth Alliance =======================
  SH['GD05-034'] = (g, p, src, a, n) => { if (a !== src || !src.pilot || !onceT(g, src, 'gaia')) return; const D = p.opp;
    if (D.hand.length >= 4 && g.discard(D, 1)) { T(p).oppDisc = true; return; }
    const c = p.hand.filter(x => unitT(x, 'Phantom Pain') && x.lv <= 4); if (!c.length || p.units.length >= 6) return; const d = p.ai.pickBestCard(g, p, c); p.hand.splice(p.hand.indexOf(d), 1); g.deployUnit(p, d); };
  F('GD05-034', 'simplified', shHooks({ note: 'shield-area trigger resolved after the battle at the next friendly attack/deploy/command/pair or end phase; opponent discards iff 4+ cards in hand',
    attack(g, u, b) { shResolve(g, u.owner); if (b.target === 'player') shRec(g, u, 'GD05-034', u, true, true); } }));
  F('GD05-037', 'full', { lvMod: (g, p) => p.opp.trash.length >= 7 ? -3 : 0, costMod: (g, p) => p.opp.trash.length >= 7 ? -3 : 0, kw: (g, u, k) => (k === 'Breach' && u.linked) ? 3 : 0 });
  F('GD05-039', 'full', { attack(g, u, b) { const p = u.owner; const c = p.units.filter(x => x.linked && tr(g, x, 'Phantom Pain')); if (!c.length) return;
    const others = c.filter(x => x !== u && g.canAttackThisTurn(x)); const t = (c.includes(u) && (b.target === 'player' || !others.length)) ? u : (others.length ? p.ai.pickBestAttacker(g, p, others) : c[0]); t.tKw['High-Maneuver'] = 1; } });
  F('GD05-041', 'full', { costMod: (g, p) => (p.flags.turn && p.flags.turn.oppDisc) ? -2 : 0 });
  F('GD05-046', 'full', { whenPaired(g, u, pd) { const p = u.owner; if (has(pd, 'Phantom Pain') && p.opp.hand.length >= 4 && g.discard(p.opp, 1)) T(p).oppDisc = true; }, ai_whenPaired: (g, p) => p.opp.hand.length >= 4 ? 0.5 : 0 });
  F('GD05-090', 'full', { p_destroyed(g, u) { lookTop(g, u.owner, 1, c => c.traits.includes('Phantom Pain')); } });
  F('GD05-091', 'full', { p_ap: (g, u) => u.owner.opp.trash.length >= 7 ? 1 : 0, p_hp: (g, u) => u.owner.opp.trash.length >= 7 ? 1 : 0 });
  F('GD05-127', 'simplified', baseShield({ note: 'chosen Blocker denial modeled as High-Maneuver for all own Units this turn when the opponent has exactly 1 Blocker; no effect with 2+',
    onAllyLinked(g, p, u) { if (!tr(g, u, 'Phantom Pain') || !baseOnce(g, p, 'girty')) return; const bl = p.opp.units.filter(x => g.kw(x, 'Blocker')); if (bl.length === 1) for (const x of p.units) x.tKw['High-Maneuver'] = 1; } }));
  F('GD06-042', 'full', { deploy(g, u) { const p = u.owner; const top = p.deck.splice(0, 4); const hits = top.filter(c => c.type === 'PILOT' && c.traits.includes('Biological CPU')); let got = null;
    if (hits.length && !u.pilot) { got = p.ai.pickBestCard(g, p, hits); top.splice(top.indexOf(got), 1); } shuffle(top, g.rng); p.deck.push(...top); if (got && g.alive(u)) g.pair(u, got); },
  ai_deploy: (g, p) => pHit(p, 4, c => c.type === 'PILOT' && c.traits.includes('Biological CPU')) * 2.8 });
  F('GD06-092', 'full', { alsoNamed: 'Mu La Flaga', p_whenPaired(g, u) { if (tr(g, u, 'Phantom Pain') || tr(g, u, 'Orb')) dmgPick(g, u.owner, 1, x => g.ap(x) <= g.ap(u)); },
    ai_whenPaired: (g, p, u) => (tr(g, u, 'Phantom Pain') || tr(g, u, 'Orb')) ? p.ai.bestDamageValue(g, p, 1, x => g.ap(x) <= g.ap(u) + 1) : 0 });

  // ======================= MF / Shuffle Alliance =======================
  SH['GD05-035'] = (g, p, src, a, n) => { if (a !== src || !onceT(g, src, 'dragon')) return; dmgPick(g, p, 2, x => g.ap(x) <= 3); };
  F('GD05-035', 'full', shHooks({ note: 'shield-area trigger resolved right after the battle (snapshot)', attack(g, u) { shResolve(g, u.owner); shRec(g, u, 'GD05-035', u, false); activatePairedMain(g, u); } }));
  F('GD05-044', 'full', { attack(g, u) { activatePairedMain(g, u); } });
  const mfAttack = (g, p, f) => { const b = g.inBattle; const c = p.units.filter(u => tr(g, u, 'MF') && f(u)); if (!c.length) return null; if (b && c.includes(b.attacker)) return b.attacker; return pumpPick(g, p, 0, c); };
  F('GD05-112', 'full', cmd({ specialMove: true, pilotName: 'Sai Saici', canMain: (g, p) => p.units.some(u => tr(g, u, 'MF')),
    score: (g, p) => { const brk = p.units.some(a => tr(g, a, 'MF') && !g.kw(a, 'Breach') && g.canAttackThisTurn(a) && p.opp.units.some(t => t.rested && g.ap(a) >= g.hpLeft(t))) && !postCombat(p) ? 0.9 : 0; return brk + trashPairVal(g, p, 'GD05-112') - 0.7; },
    main(g, p) { const u = mfAttack(g, p, x => !g.kw(x, 'Breach')); if (u) u.tKw.Breach = Math.max(u.tKw.Breach || 0, 3); pairFromTrash(g, p, 'GD05-112'); } }));
  F('GD05-113', 'full', cmd({ specialMove: true, pilotName: 'George de Sand', canMain: (g, p) => p.units.some(u => tr(g, u, 'MF')),
    score: (g, p) => pumpVal(g, p, 2, x => tr(g, x, 'MF') && g.ap(x) <= 4) + trashPairVal(g, p, 'GD05-113') - 0.7,
    main(g, p) { const u = mfAttack(g, p, x => g.ap(x) <= 4); if (u) u.tAP += 2; pairFromTrash(g, p, 'GD05-113'); } }));
  F('GD05-128', 'full', baseShield({ activate: basePump(2, (g, p) => p.units.some(u => u.linked && tr(g, u, 'MF'))) }));
  F('ST12-002', 'full', { deploy(g, u) { const p = u.owner; const c = p.units.filter(x => g.ap(x) >= 5); if (c.length) { const x = p.ai.pickBestAttacker(g, p, c); x.tKw.Breach = Math.max(x.tKw.Breach || 0, 3); } } });

  // ======================= Mafty =======================
  F('GD04-035', 'full', { note: 'draw rider lasts while this Ξ Gundam stays in play',
    deploy(g, u) { const p = u.owner; const c = p.units.filter(x => tr(g, x, 'Mafty')); if (!c.length) return; const x = p.ai.pickBestAttacker(g, p, c); x.flags.xi = [...(x.flags.xi || []), u.uid + ':' + g.turn]; },
    onBattleKill(g, u) { if ((u.flags.xi || []).includes(u.uid + ':' + g.turn) && u.owner.hand.length <= 3) g.draw(u.owner, 1); },
    onAllyBattleKill(g, s, killer) { if ((killer.flags.xi || []).includes(s.uid + ':' + g.turn) && s.owner.hand.length <= 3) g.draw(s.owner, 1); } });
  const xiMod = (g, p) => p.units.some(x => x.def.lv >= 6) ? 0 : -p.opp.units.length;
  F('ST08-001', 'full', { lvMod: xiMod, costMod: xiMod, whenPaired(g, u) { const p = u.owner; if (!p.opp.units.length) return; const m = topLv(p); dmgPick(g, p, 3, x => x.def.lv === m); },
    ai_whenPaired: (g, p) => p.opp.units.length ? p.ai.bestDamageValue(g, p, 3, x => x.def.lv === topLv(p)) : 0 });
  F('ST08-004', 'full', { attack(g, u, b) { if (b.target !== 'player') dmgPick(g, u.owner, 1, null); } });
  const maftyF = (g, x) => tr(g, x, 'Mafty');
  F('ST08-010', 'full', { p_whenPaired(g, u) { if (tr(g, u, 'Mafty')) grantActive(g, u.owner, maftyF, dmgF, u, false); },
    ai_whenPaired: (g, p, u) => tr(g, u, 'Mafty') ? Math.max(0, p.ai.unlockScore(g, p, x => maftyF(g, x), t => t.dmg > 0) + 0.9) * 0.9 : 0 });
  const ladyN = (g, p) => p.units.some(u => u.linked && tr(g, u, 'Mafty')) ? 2 : 1;
  F('ST08-013', 'full', cmd({ actionToo: true, canMain: (g, p) => p.opp.units.length > 0, score: (g, p) => p.ai.bestDamageValue(g, p, ladyN(g, p), null) - 1.4, main(g, p) { dmgPick(g, p, ladyN(g, p), null); },
    defAction: { can: (g, p, b) => g.alive(b.attacker) && p.ai.effPreview(g, p, b.attacker, ladyN(g, p)) >= g.hpLeft(b.attacker),
      value: (g, p, b, threat) => p.ai.removalValue(g, p, b.attacker, 'destroy') + threat * 0.7, run(g, p, b) { g.effectDamage(p, b.attacker, ladyN(g, p)); } } }));

  // ======================= AEUG / Gundam Team =======================
  const zzOn = (g, u) => { const t = battleFoe(g, u); return !!t && t.owner !== u.owner && tr(g, u, 'AEUG'); };
  F('GD06-033', 'simplified', { note: '+1 damage covers AEUG battle damage vs Units and AEUG effects in this file (Rivalry with Roux, Argama, own deploy); other AEUG cards (e.g. Core Base, Zeta) not boosted',
    ap: (g, u) => zzOn(g, u) ? 1 : 0, aura_ap: (g, s, o) => zzOn(g, o) ? 1 : 0,
    deploy(g, u) { const p = u.owner; const n = 2 + zz(p); for (const x of [...p.opp.units]) g.effectDamage(p, x, n); }, ai_deploy: (g, p) => sweepVal(g, p, 3, null) });
  const gtLv3 = (g, p, u) => { const c = p.units.filter(x => x !== u && tr(g, x, 'Gundam Team') && x.def.lv === 3).sort((a, b) => p.ai.unitValue(g, a) - p.ai.unitValue(g, b));
    for (let i = 0; i < c.length; i++) for (let j = i + 1; j < c.length; j++) if (c[i].def.name !== c[j].def.name) return [c[i], c[j]]; return null; };
  const bigGT = (g, p) => { const c = p.hand.filter(x => unitT(x, 'Gundam Team') && x.lv >= 8); return c.length ? p.ai.pickBestCard(g, p, c) : null; };
  F('GD06-039', 'full', { activate: { cost: 0, can: (g, p, u) => !!gtLv3(g, p, u) && !!bigGT(g, p),
    score: (g, p, u) => { const s = gtLv3(g, p, u), c = bigGT(g, p); const e = EFX[c.id]; const gain = p.ai.defValue(c) + (e && e.ai_deploy ? e.ai_deploy(g, p, null) : 0) + c.cost * 0.25;
      return gain - [...s, u].reduce((t, x) => t + p.ai.unitValue(g, x) - (x.def.id === 'GD06-045' ? 0.6 : 0), 0); },
    run(g, p, u) { const s = gtLv3(g, p, u), c = bigGT(g, p); for (const x of [...s, u]) g.destroy(x, { effect: true, by: p }); p.hand.splice(p.hand.indexOf(c), 1); g.deployUnit(p, c); } } });
  F('GD06-088', 'full', { p_destroyed(g, u) { if (!u.linked) return; const p = u.owner; const c = p.trash.filter(x => unitT(x, 'Gundam Team') && x.lv <= 2); if (!c.length) return; const b = p.ai.pickBestCard(g, p, c); p.trash.splice(p.trash.lastIndexOf(b), 1); toHand(g, p, b); } });
  F('GD06-112', 'full', cmd({ pilotName: 'Elle Vianno', actionOnly: true, battlePump: 2, canMain: () => false, main() {},
    costMod: battleGuard((g, p) => { const m = myBattler(g, p), f = foeBattler(g, p); return !!m && !!f && tr(g, m, 'AEUG'); }),
    action(g, p) { const f = foeBattler(g, p); if (f) g.effectDamage(p, f, 2 + zz(p)); } }));
  F('GD06-125', 'full', baseShield({ baseNoBattle(g, D, a) { if (g.ap(a) > 0 && D.units.some(x => x.rested && tr(g, x, 'AEUG')) && D.opp.units.length && baseOnce(g, D, 'argama')) dmgPick(g, D, 1 + zz(D), null); return false; } }));

  // ======================= Earth Federation / SRA / White Fang / Preventer / colourless =======================
  F('GD02-046', 'full', { deploy(g, u) { dmgPick(g, u.owner, 2, x => x.token); }, ai_deploy: (g, p) => p.ai.bestDamageValue(g, p, 2, x => x.token) });
  SH['GD04-042'] = (g, p, src, a) => { if (!src.linked || !pairedWith(a, 'Cyber-Newtype') || !onceT(g, src, 'psy')) return; dmgPick(g, p, 2, x => g.ap(x) <= 5); };
  F('GD04-042', 'full', shHooks({ note: 'shield-area trigger resolved right after the battle (snapshot)',
    attack(g, u) { shResolve(g, u.owner); if (pairedWith(u, 'Cyber-Newtype')) shRec(g, u, 'GD04-042', u, false); },
    onAllyAttack(g, s, a) { shResolve(g, s.owner); if (pairedWith(a, 'Cyber-Newtype')) shRec(g, a, 'GD04-042', s, false); } }));
  F('GD04-112', 'full', cmd({ pilotName: 'Gates Capa', canMain: () => true, score: (g, p) => p.ai.sweepValue(g, p, 1, 2, null) - 1.0,
    main(g, p) { for (const pl of g.players) for (const x of [...pl.units]) if (x.def.lv <= 2) g.effectDamage(p, x, 1); } }));
  F('GD03-041', 'full', { deploy(g, u) { for (const pl of g.players) dmgBase(g, u.owner, pl, 3); }, ai_deploy: (g, p) => baseHitVal(g, p.opp, 3) - baseHitVal(g, p, 3) * 0.8 });
  F('GD03-093', 'full', { p_ap: (g, u) => u.owner.opp.base ? 0 : 1 });
  F('GD02-107', 'full', cmd({ burst(g, p) { dmgPick(g, p, 1, null); }, canMain: (g, p) => p.opp.units.some(x => !x.linked), score: (g, p) => sweepVal(g, p, 1, x => !x.linked) - 1.0,
    main(g, p) { for (const x of [...p.opp.units]) if (!x.linked) g.effectDamage(p, x, 1); } }));
  const elimF = (x) => !!x.pilot && x.def.lv <= 5;
  F('GD03-110', 'full', cmd({ actionToo: true, canMain: (g, p) => p.opp.units.some(elimF), score: (g, p) => Math.max(0, ...p.opp.units.filter(elimF).map(x => pilotLoss(g, p, x))) - 1.4,
    main(g, p) { const c = p.opp.units.filter(elimF); if (!c.length) return; killPilot(g, p, c.reduce((a, b) => pilotLoss(g, p, b) > pilotLoss(g, p, a) ? b : a)); },
    defAction: { can: (g, p, b) => g.alive(b.attacker) && elimF(b.attacker),
      value: (g, p, b, threat, myLoss) => { const a = b.attacker; let v = pilotLoss(g, p, a); if (b.target !== 'player' && myLoss > 0 && g.ap(a) - a.pilot.ap < g.hpLeft(b.target)) v += myLoss; if (b.target === 'player' && g.kw(a, 'Suppression') && !a.def.skw.Suppression) v += threat * 0.4; return v; },
      run(g, p, b) { killPilot(g, p, b.attacker); } } }));
  const pairedAll = (g) => g.players.flatMap(pl => pl.units.filter(u => u.pilot));
  F('GD03-112', 'full', cmd({ actionToo: true, battlePump: 2, costMod: battleGuard((g, p) => { const m = myBattler(g, p), f = foeBattler(g, p); return !!m && !!m.pilot && !!f && !f.pilot; }),
    canMain: (g, p) => p.units.some(u => u.pilot && g.canAttackThisTurn(u)), score: (g, p) => pumpVal(g, p, 2, u => !!u.pilot, 3) - 0.4 * p.opp.units.filter(u => u.pilot).length - 1.0,
    main(g) { for (const u of pairedAll(g)) u.tAP += 2; }, action(g) { for (const u of pairedAll(g)) u.tAP += 2; } }));
  function karma(g, p, maxLvTarget) { // best (own active Unit to rest, enemy target) pair
    let best = null; for (const o of p.units) { if (o.rested) continue; const rc = restCost(g, p, o, true);
      for (const t of p.opp.units) { if (t.def.lv > o.def.lv || (maxLvTarget && t !== maxLvTarget)) continue; const v = p.ai.dmgTargetValue(g, p, t, 3) - rc; if (!best || v > best.v) best = { o, t, v, rc }; } }
    return best;
  }
  F('GD03-113', 'full', cmd({ actionToo: true, canMain: (g, p) => !!karma(g, p), score: (g, p) => { const k = karma(g, p); return k ? k.v - 1.1 : -1; },
    main(g, p) { const k = karma(g, p); if (k && restByEffect(g, k.o)) { const c = p.opp.units.filter(x => x.def.lv <= k.o.def.lv); if (c.includes(k.t)) g.effectDamage(p, k.t, 3); else dmgPick(g, p, 3, x => x.def.lv <= k.o.def.lv); } },
    defAction: { can: (g, p, b) => { const a = b.attacker; return g.alive(a) && p.ai.effPreview(g, p, a, 3) >= g.hpLeft(a) && !!karma(g, p, a); },
      value: (g, p, b, threat) => p.ai.removalValue(g, p, b.attacker, 'destroy') + threat * 0.7 - karma(g, p, b.attacker).rc,
      run(g, p, b) { const k = karma(g, p, b.attacker); if (k && restByEffect(g, k.o)) g.effectDamage(p, b.attacker, 3); } } }));
  F('GD04-110', 'full', cmd({ actionToo: true, canMain: (g, p) => !p.base || (p.base.ex && p.base.dmg > 0), score: (g, p) => !p.base ? 1.3 : 0.4 * p.base.dmg - 0.4,
    main(g, p) { if (p.base && !p.base.ex) p.trash.push(p.base.def); p.base = newEXBase(); },
    defAction: { can: (g, p, b) => b.target === 'player' && !p.base, value: (g, p, b, threat) => threat * 0.9, run(g, p) { if (!p.base) p.base = newEXBase(); } } }));
  function epyonSweep(g, u, depth) { // each enemy Unit Epyon destroys with damage triggers another sweep
    const p = u.owner; if (depth > 10 || !g.alive(u) || !yourTurn(g, p) || !u.pilot || u.pilot.lv < 5 || g.winner !== null) return;
    let kills = 0; for (const x of [...p.opp.units]) if (g.ap(x) <= 5 && g.effectDamage(p, x, 2)) kills++;
    for (let k = 0; k < kills; k++) epyonSweep(g, u, depth + 1);
  }
  F('ST12-001', 'full', { note: 'kills by its own sweep count as "this Unit destroys ... with damage" (chains)', onBattleKill(g, u) { epyonSweep(g, u, 0); },
    deploy(g, u) { dmgBase(g, u.owner, u.owner.opp, 5); }, ai_deploy: (g, p) => baseHitVal(g, p.opp, 5) });
  F('ST12-003', 'full', { onBattleKill(g, u) { const p = u.owner; if (!yourTurn(g, p) || !onceT(g, u, 'tallg')) return; for (const x of [...p.opp.units]) if (g.ap(x) <= 3) g.effectDamage(p, x, 1); } });
  F('ST12-011', 'simplified', { alsoNamed: 'Zechs Merquise', note: 'Activate･Action (2 damage to a damaged enemy Unit battling this Unit) used at the attack step vs a damaged target Unit only',
    p_attack(g, u, b) { if (b.target !== 'player' && b.target.dmg > 0 && onceT(g, u, 'milli')) g.effectDamage(u.owner, b.target, 2); } });
  function duel(g, p) { // The Final Victor: we pick our Unit (minimax), the opponent answers with the Unit that is worst for us
    let best = null; for (const a of p.units) { let worst = null;
      for (const t of p.opp.units) { const ka = g.ap(a) >= g.hpLeft(t), kt = g.ap(t) >= g.hpLeft(a); const v = (ka ? p.ai.unitValue(g, t) : 0) - (kt ? p.ai.unitValue(g, a) : 0); if (!worst || v < worst.v) worst = { a, t, v }; }
      if (worst && (!best || worst.v > best.v)) best = worst; }
    return best;
  }
  F('ST12-013', 'simplified', cmd({ note: 'damage-step-only battle via g.damageOnlyBattle, which also applies Breach / First Strike (not attacks by the rules)', burst(g, p) { dmgPick(g, p, 1, null); },
    canMain: (g, p) => p.units.length > 0 && p.opp.units.length > 0, score: (g, p) => { const d = duel(g, p); return d ? d.v - 0.9 : -1; },
    main(g, p) { const d = duel(g, p); if (d) g.damageOnlyBattle(d.a, d.t); } }));
  F('ST12-016', 'simplified', baseShield({ note: 'condition approximated as: a friendly paired Unit has attacked this turn',
    activate: { cost: 0, restBase: true, can: (g, p) => postCombat(p) && p.units.some(u => u.pilot && u.rested) && p.opp.units.some(x => x.def.lv <= 4),
      score: (g, p) => p.ai.bestDamageValue(g, p, 1, x => x.def.lv <= 4) - 0.1, run(g, p) { dmgPick(g, p, 1, x => x.def.lv <= 4); } } }));
  const sacPick = (g, p) => p.units.reduce((a, b) => (p.ai.unitValue(g, b) - p.ai.deathValue(g, b)) < (p.ai.unitValue(g, a) - p.ai.deathValue(g, a)) ? b : a);
  F('ST13-014', 'full', cmd({ canMain: (g, p) => p.units.length > 0, score: (g, p) => { const s = sacPick(g, p); return pHit(p, 4, c => c.type === 'UNIT' && c.lv <= 4) * 3.0 + p.ai.deathValue(g, s) - p.ai.unitValue(g, s) - 0.5; },
    main(g, p) { if (!p.units.length) return; g.destroy(sacPick(g, p), { effect: true, by: p }); lookDeploy(g, p, 4, c => c.lv <= 4); } }));
  const solN = (p) => p.trash.filter(c => c.type === 'UNIT').length;
  const solExile = (g, p) => { for (let k = 0; k < 3; k++) { const c = p.ai.pickWorstCard(g, p, p.trash.filter(x => x.type === 'UNIT')); p.trash.splice(p.trash.indexOf(c), 1); p.exile.push(c); } };
  F('ST13-015', 'full', cmd({ actionToo: true, canMain: (g, p) => solN(p) >= 3 && p.opp.units.length > 0, removal: { kind: 'damage', n: 3, f: (g, u) => solN(u.owner.opp) >= 3 },
    main(g, p) { if (solN(p) < 3) return; solExile(g, p); dmgPick(g, p, 3, null); },
    action(g, p, b) { if (solN(p) < 3 || !b || !g.alive(b.attacker)) return; solExile(g, p); g.effectDamage(p, b.attacker, 3); } }));
};
