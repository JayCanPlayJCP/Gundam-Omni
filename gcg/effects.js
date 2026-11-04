'use strict';
// Card effect implementations for every card in the 25 test decks (138 cards), written from official English text.
// Each entry: fidelity 'full' | 'simplified' with a note. Hooks are called by engine.js / ai.js.
const { shuffle, CARDS } = require('./engine');

// ---------- helpers ----------
const tr = (g, u, t) => g.hasTrait(u, t);
const enemiesOf = (p) => p.opp.units;
function effPreview(g, srcP, t, n) {
  const e = EFX[t.def.id]; let d = n;
  if (e && e.reduceEffectDmg) d = e.reduceEffectDmg(g, t, d);
  if (t.owner.base) { const be = EFX[t.owner.base.def.id]; if (be && be.protectEffect) d = be.protectEffect(g, t, d); }
  if (t.flags.reduce1) d = Math.max(0, d - 1);
  return d;
}
function dmgPick(g, p, n, filter, purpose) {
  const c = p.opp.units.filter(u => !filter || filter(u)); if (!c.length) return null;
  const t = p.ai.pickDamageTarget(g, p, c, n, purpose); if (t) g.effectDamage(p, t, n); return t;
}
function restPick(g, p, filter) {
  const c = p.opp.units.filter(u => !u.rested && (!filter || filter(u))); if (!c.length) return null;
  const t = p.ai.pickRestTarget(g, p, c); if (t) g.restUnit(t); return t;
}
function bouncePick(g, p, filter, dest = 'hand') {
  const c = p.opp.units.filter(u => !filter || filter(u)); if (!c.length) return null;
  const t = p.ai.pickRemovalTarget(g, p, c, dest); if (t) { dest === 'hand' ? g.bounce(t) : g.toBottom(t); } return t;
}
function destroyPick(g, p, filter) {
  const c = p.opp.units.filter(u => !filter || filter(u)); if (!c.length) return null;
  const t = p.ai.pickRemovalTarget(g, p, c, 'destroy'); if (t) g.destroy(t, { effect: true, by: p }); return t;
}
function apDownPick(g, p, n, filter, ctx) {
  const c = p.opp.units.filter(u => !filter || filter(u)); if (!c.length) return null;
  const t = p.ai.pickApDownTarget(g, p, c, n, ctx); if (t) { if (ctx && ctx.battle) t.bAP -= n; else t.tAP -= n; } return t;
}
function lookTop(g, p, n, pred) {
  const top = p.deck.splice(0, n); const hits = top.filter(pred); let got = null;
  if (hits.length) { got = p.ai.pickBestCard(g, p, hits); top.splice(top.indexOf(got), 1); p.hand.push(got); g.stats.p[p.i].extraCards++; }
  shuffle(top, g.rng); p.deck.push(...top); return got;
}
function lookOneTopOrBottom(g, p) { if (!p.deck.length) return; const c = p.deck[0]; if (!p.ai.keepOnTop(g, p, c)) { p.deck.shift(); p.deck.push(c); } }
function ownAndEnemyPing(g, p, src) { // "Choose 1 of your Units and 1 enemy Unit. Deal 1 damage to them."
  const mine = p.ai.pickOwnPing(g, p, src); const en = p.opp.units;
  if (mine) g.effectDamage(null, mine, 1);
  if (en.length) dmgPick(g, p, 1, null);
}
const yourTurn = (g, p) => g.turnPlayer === p;
const unitsWith = (p, f) => p.units.filter(f);
const cardIsUnitWithTrait = (c, t) => c.type === 'UNIT' && c.traits.includes(t);
function burstMain(name) { return { burst(g, p, c) { const e = EFX[c.id]; if (e.canMain(g, p)) e.main(g, p); } }; }
function baseShield(extra) { return Object.assign({ base: true }, extra || {}); } // shield-to-hand handled by engine deployBase
function cmd(def) { return Object.assign({ cmd: true }, def); }

const EFX = {};
const F = (id, fidelity, obj) => { obj.fidelity = fidelity; EFX[id] = obj; };

// ======================= BLUE =======================
F('GD04-121', 'full', baseShield({ baseDeploy(g, p) { if (yourTurn(g, p) && p.units.some(u => tr(g, u, 'League Militaire'))) g.deployToken(p, 'Parts'); } }));
F('GD05-123', 'full', baseShield({ protectEffect(g, t, d) { return (g.turnPlayer !== t.owner && tr(g, t, 'Orb') && d <= 2) ? 0 : d; } }));
F('ST01-015', 'full', baseShield({ activate: { cost: 2, once: true, can: (g, p) => true, run(g, p) { const n = p.units.length; g.deployToken(p, n === 0 ? 'Gundam' : n === 1 ? 'Guncannon' : 'Guntank'); }, score: (g, p) => p.units.length < 6 ? 2 : 0 } }));
F('ST02-016', 'full', baseShield({ baseDeploy(g, p) { if (!yourTurn(g, p)) return; if (p.trash.some(c => c.name.includes('Corsica Base'))) { g.deployToken(p, 'Leo'); g.deployToken(p, 'Leo'); } else g.deployToken(p, 'Tallgeese'); } }));
F('ST11-016', 'full', baseShield({ baseDeploy(g, p) { if (p.opp.units.length >= 4) dmgPick(g, p, 2, u => u.rested); } }));
F('GD01-100', 'full', cmd({ main(g, p) { g.draw(p, 2); }, canMain: () => true, score: (g, p) => 3.2 }));
F('GD05-102', 'full', cmd({ actionOnly: true, canAction: (g, p) => p.opp.units.some(u => g.hpLeft(u) <= 5),
  action(g, p, b, role) { const t = role === 'defend' && b && b.attacker && g.hpLeft(b.attacker) <= 5 ? b.attacker : null; if (t) g.bounce(t); else bouncePick(g, p, u => g.hpLeft(u) <= 5); },
  canMain: (g, p) => p.opp.units.some(u => g.hpLeft(u) <= 5), main(g, p) { bouncePick(g, p, u => g.hpLeft(u) <= 5); }, removal: { kind: 'hand', f: (g, u) => g.hpLeft(u) <= 5 } }));
F('GD05-105', 'full', cmd({ burst(g, p) { bouncePick(g, p, u => u.def.lv <= 3); }, canMain: (g, p) => p.opp.units.some(u => u.def.lv <= 3), main(g, p) { bouncePick(g, p, u => u.def.lv <= 3); }, actionToo: true, removal: { kind: 'hand', f: (g, u) => u.def.lv <= 3 } }));
F('GD06-104', 'full', cmd({ pilotName: 'Chuck Keith', canMain: (g, p) => p.opp.units.some(u => g.hpLeft(u) <= 3), main(g, p) { bouncePick(g, p, u => g.hpLeft(u) <= 3); }, actionToo: true, removal: { kind: 'hand', f: (g, u) => g.hpLeft(u) <= 3 } }));
F('GD04-081', 'full', { p_whenPaired(g, u) { if (tr(g, u, 'League Militaire')) g.deployToken(u.owner, 'Parts'); } });
F('GD05-081', 'full', { p_whenLinked(g, u) { if (tr(g, u, 'Orb') || tr(g, u, 'Triple Ship Alliance')) g.draw(u.owner, 1); } });
F('ST01-010', 'full', { p_whenPaired(g, u) { restPick(g, u.owner, x => g.hpLeft(x) <= 5); } });
F('ST11-011', 'full', { p_whenPaired(g, u) { for (const x of u.owner.units) if (tr(g, x, 'Marine')) x.tAP += 1; } });
F('GD01-006', 'full', { hp: (g, u) => u.linked ? 1 : 0 });
F('GD01-008', 'full', { deploy(g, u) { dmgPick(g, u.owner, 1, x => x.rested); } });
F('GD01-016', 'full', { costMod: (g, p) => p.units.filter(x => tr(g, x, 'Earth Federation')).length >= 2 ? -1 : 0 });
F('GD01-017', 'full', {});
F('GD01-018', 'full', {});
F('GD03-001', 'full', { whenPaired(g, u) { const t = dmgPick(g, u.owner, 1, x => x.rested); if (t && !g.alive(t)) g.draw(u.owner, 1); } });
F('GD04-002', 'full', { aura_ap: (g, src, u) => (yourTurn(g, src.owner) && tr(g, u, 'Earth Federation')) ? 1 : 0, ap: (g, u) => (yourTurn(g, u.owner)) ? 1 : 0,
  deploy(g, u) { u.owner.flags.turn.penelope = true; }, onAllyBattleKill(g, src, killer) { if (src.owner.flags.turn && src.owner.flags.turn.penelope && tr(g, killer, 'Earth Federation')) restPick(g, src.owner, x => g.hpLeft(x) <= 5); } });
F('GD04-003', 'full', { attack(g, u) { if (u.owner.units.filter(x => tr(g, x, 'League Militaire')).length >= 3) g.draw(u.owner, 1); } });
F('GD04-006', 'full', { activate: { once: true, cost: 0, can: (g, p, u) => p.units.some(x => x !== u && !x.rested && tr(g, x, 'League Militaire')) && p.opp.units.some(x => !x.rested && g.hpLeft(x) <= 4),
  run(g, p, u) { const o = p.units.filter(x => x !== u && !x.rested && tr(g, x, 'League Militaire')); const r = p.ai.pickRestOwn(g, p, o); r.rested = true; restPick(g, p, x => g.hpLeft(x) <= 4); }, score: () => 1.5 } });
F('GD04-016', 'full', { noAttackPlayer: true });
F('GD05-002', 'full', { deploy(g, u) { const mine = u.owner.ai.pickSFTargets(g, u.owner, u); for (const x of mine) x.flags.sfDraw = true; },
  attack(g, u) { if (!u.pilot) return; const p = u.owner; const en = p.opp.units; if (!en.length || p.hand.length < 2) return;
    const minLv = Math.min(...en.map(x => x.def.lv)); const cands = en.filter(x => x.def.lv === minLv);
    if (p.ai.wantSFDiscard(g, p, cands)) { g.discard(p, 2); const t = p.ai.pickRemovalTarget(g, p, cands, 'bottom'); if (t) g.toBottom(t); } } });
F('GD05-005', 'full', {});
F('GD05-010', 'full', {});
F('GD05-015', 'full', { deploy(g, u) { dmgPick(g, u.owner, 1, x => x.rested); } });
F('GD06-014', 'full', { kw: (g, u, k) => (k === 'Blocker' && u.owner.opp.units.length >= 3) ? 1 : 0 });
F('ST01-001', 'full', { aura_ap: (g, src, u) => (src.pilot && yourTurn(g, src.owner)) ? 1 : 0, ap: (g, u) => (u.pilot && yourTurn(g, u.owner)) ? 1 : 0 });
F('ST01-005', 'full', {});
F('ST11-001', 'full', { untargetable: (g, u) => !!u.pilot && u.owner.units.filter(x => x !== u && tr(g, x, 'Marine')).length >= 2,
  deploy(g, u) { if (u.owner.units.some(x => x !== u && tr(g, x, 'Marine'))) bouncePick(g, u.owner, x => x.def.lv <= 2, 'bottom'); } });
F('ST11-003', 'full', { kw: (g, u, k) => (k === 'Blocker' && u.owner.units.some(x => x !== u && tr(g, x, 'Marine'))) ? 1 : 0 });

// ======================= GREEN =======================
F('GD01-126', 'full', baseShield());
F('GD05-125', 'simplified', baseShield({ note: 'Activate (reduce 1 dmg to a Londo Bell unit) used by AI on own turn before attacks', activate: { cost: 0, restBase: true, can: (g, p) => p.units.some(u => tr(g, u, 'Londo Bell')), run(g, p) { const c = p.units.filter(u => tr(g, u, 'Londo Bell')); const u = p.ai.pickBestUnit(g, p, c); u.flags.reduce1 = true; }, score: () => 0.3 } }));
F('ST03-016', 'full', baseShield({ baseDeploy(g, p) { if (yourTurn(g, p)) g.deployToken(p, "Char's Zaku Ⅱ", { rested: true }); } }));
F('GD01-105', 'full', cmd({ canMain: (g, p) => p.units.some(u => !u.rested), main(g, p) { for (const u of p.units) u.tAP += 2; }, pump: 2, score: (g, p) => p.ai.pumpScore(g, p, 2) }));
F('GD04-105', 'full', cmd({ canMain: (g, p) => p.deck.length > 0, main(g, p) { lookTop(g, p, 5, c => c.type === 'PILOT'); }, score: (g, p) => 1.6 }));
F('GD06-105', 'full', cmd({ canMain: (g, p) => true, main(g, p) { g.deployToken(p, p.ai.graceChoice(g, p)); }, score: (g, p) => p.units.length < 6 ? 4.5 : 0 }));
F('GD04-086', 'full', { p_destroyed(g, u, pilot) { if (u.linked && u.owner.ex === 0) g.placeEX(u.owner, 1); } });
F('GD05-085', 'full', { p_onBattleKill(g, u) { if (yourTurn(g, u.owner)) g.heal(u, 2); } });
F('GD06-084', 'full', { p_whenPaired(g, u) { const n = u.owner.units.filter(x => tr(g, x, 'Neo Zeon') || tr(g, x, 'Long-Range Weapon')).length; u.tKw.Breach = (u.tKw.Breach || 0) + n; } });
F('ST03-011', 'full', { p_attack(g, u) { u.tAP += 1; if (u.linked) u.tKw['High-Maneuver'] = 1; }, p_kwPreview: (g, u) => u.linked ? 'High-Maneuver' : null });
F('ST13-011', 'full', { p_whenPaired(g, u) { lookTop(g, u.owner, 5, c => c.type === 'PILOT' && c.lv <= u.def.lv); } });
F('GD01-023', 'full', { activate: { cost: 0, can: (g, p, u) => !u.pilot && p.hand.some(c => c.type === 'UNIT' && (c.traits.includes('Zeon') || c.traits.includes('Neo Zeon'))) && p.trash.some(c => c.type === 'PILOT' && c.traits.includes('Newtype') && c.lv <= 3),
  run(g, p, u) { g.discard(p, 1, c => c.type === 'UNIT' && (c.traits.includes('Zeon') || c.traits.includes('Neo Zeon'))); const pc = p.trash.filter(c => c.type === 'PILOT' && c.traits.includes('Newtype') && c.lv <= 3); const pd = p.ai.pickBestCard(g, p, pc); p.trash.splice(p.trash.indexOf(pd), 1); g.pair(u, pd); }, score: () => 1.0 } });
F('GD01-026', 'full', { destroyed(g, u, pilot) { if (pilot) g.deployToken(u.owner, "Char's Zaku Ⅱ", { rested: true }); } });
F('GD01-030', 'full', {}); F('GD01-031', 'full', {}); F('GD01-035', 'full', {});
F('GD01-039', 'full', { deploy(g, u) { lookOneTopOrBottom(g, u.owner); } });
F('GD04-017', 'full', { whenPaired(g, u, pd) { if ((pd.traits || []).includes('Newtype')) { g.deployToken(u.owner, 'Wire-Guided Arm'); g.deployToken(u.owner, 'Wire-Guided Arm'); } },
  destroyed(g, u) { g.deployToken(u.owner, 'Zeong (Head)', { rested: true }); } });
F('GD05-017', 'full', { whenPaired(g, u) { const p = u.owner; const lb = p.trash.filter(c => c.traits.includes('Londo Bell')); if (lb.length >= 3 && p.opp.units.length) {
  const t = p.ai.pickFightTarget(g, p, u, p.opp.units); if (!t) return; for (let k = 0; k < 3; k++) { const c = p.ai.pickWorstCard(g, p, p.trash.filter(x => x.traits.includes('Londo Bell'))); p.trash.splice(p.trash.indexOf(c), 1); p.exile.push(c); } g.damageOnlyBattle(u, t); } } });
F('GD05-019', 'full', { destroyed(g, u) { lookTop(g, u.owner, 3, c => cardIsUnitWithTrait(c, 'Londo Bell')); } });
F('GD05-020', 'full', { kw: (g, u, k) => (k === 'Breach' && u.pilot) ? 3 : 0, deploy(g, u) { if (u.owner.trash.filter(c => c.traits.includes('Londo Bell')).length >= 2) g.placeEX(u.owner, 1); } });
F('GD05-025', 'full', { deploy(g, u) { lookTop(g, u.owner, 3, c => c.type === 'COMMAND'); } });
F('GD05-027', 'full', {});
F('GD05-028', 'full', { deploy(g, u) { const c = u.owner.units.filter(x => tr(g, x, 'Londo Bell')); if (!c.length) return; const t = u.owner.ai.pickBestAttacker(g, u.owner, c); t.attackActiveFilter = (e) => g.ap(e) <= 4; } });
F('GD05-029', 'full', { deploy(g, u) { lookOneTopOrBottom(g, u.owner); } });
F('GD06-018', 'simplified', { note: 'Redirect used automatically when it would save this Unit (once/turn, paired)', redirect(g, u, n, b) {
  if (!u.pilot || u.once.has('redir') || g.hpLeft(u) > n) return null; const p = u.owner;
  const cands = p.units.filter(x => x !== u && (tr(g, x, 'Neo Zeon') || tr(g, x, 'Long-Range Weapon')));
  let best = cands.sort((a, c) => (c.token - a.token) || (g.hpLeft(c) - g.hpLeft(a)))[0];
  if (best) { u.once.add('redir'); return { unit: best }; }
  if (p.base && p.base.def.traits && p.base.def.traits.includes('Neo Zeon')) { u.once.add('redir'); return { base: p }; }
  return null; } });
F('ST03-006', 'full', { destroyed(g, u) { lookTop(g, u.owner, 3, c => c.type === 'UNIT' && (c.traits.includes('Zeon') || c.traits.includes('Neo Zeon'))); } });
F('ST03-007', 'full', {});
F('ST03-008', 'full', { attack(g, u) { u.tAP += 2; } });
F('ST13-001', 'simplified', { note: 'Funnel trigger on pair; damage-step battle with a token vs enemy via activate', onAllyPaired(g, src, u) { if (yourTurn(g, src.owner) && !src.once.has('funnel')) { src.once.add('funnel'); g.deployToken(src.owner, 'Bit / Funnel'); if (src.owner.units.length < 6) g.deployToken(src.owner, 'Bit / Funnel'); } },
  whenPaired(g, u) { EFX['ST13-001'].onAllyPaired(g, u, u); },
  activate: { cost: 1, once: true, can: (g, p, u) => p.units.some(x => x.token) && p.opp.units.length > 0, run(g, p, u) { const tok = p.units.filter(x => x.token).sort((a, b) => g.ap(b) - g.ap(a))[0]; const t = p.ai.pickFightTarget(g, p, tok, p.opp.units); if (t) g.damageOnlyBattle(tok, t); }, score: (g, p) => 1.2 } });

// ======================= PURPLE =======================
F('GD05-114', 'full', cmd({ canMain: (g, p) => true, main(g, p) { for (const pl of g.players) for (const u of [...pl.units]) if (u.def.lv <= 4 || u.token) { if (u.def.lv <= 4) g.destroy(u, { effect: true, by: p }); } },
  score: (g, p) => { const v = (pl) => pl.units.filter(u => u.def.lv <= 4).reduce((s, u) => s + p.ai.unitValue(g, u), 0); return (v(p.opp) - v(p)) / 2.5; } }));
F('ST05-014', 'full', cmd({ burst(g, p) { dmgPick(g, p, 1, null); }, canMain: (g, p) => p.opp.units.some(u => u.def.lv <= 3), main(g, p) { destroyPick(g, p, u => u.def.lv <= 3); }, removal: { kind: 'destroy', f: (g, u) => u.def.lv <= 3 } }));
F('GD05-093', 'full', { p_whenLinked(g, u) { const p = u.owner; const b = p.trash.filter(c => c.type === 'BASE' && c.traits.includes('Neo Zeon')); if (b.length) { const c = b[0]; p.trash.splice(p.trash.indexOf(c), 1); g.deployBase(p, c); } } });
F('ST05-010', 'full', { p_whenPaired(g, u) { ownAndEnemyPing(g, u.owner, u); } });
F('ST07-009', 'full', { p_attack(g, u) { const p = u.owner; if (p.trash.filter(c => c.traits.includes('CB')).length >= 7) { for (const x of p.units) if (tr(g, x, 'CB')) x.tAP += 1; } else u.tAP += 1; } });
F('ST12-012', 'full', { alsoNamed: 'Marida Cruz', p_whenLinked(g, u) { const p = u.owner; const top = p.deck.splice(0, 2); if (!top.length) return; const keep = p.ai.pickBestCard(g, p, top); const other = top.length > 1 ? top[1 - top.indexOf(keep)] : undefined;
  const low = g.players.some(pl => pl.shields.length <= 3); p.deck.unshift(keep); if (other) { if (low) { p.hand.push(other); g.stats.p[p.i].extraCards++; } else p.trash.push(other); } } });
F('GD02-054', 'full', { attack(g, u) { if (u.dmg > 0) g.draw(u.owner, 1); } });
F('GD02-055', 'full', { deploy(g, u) { ownAndEnemyPing(g, u.owner, u); } });
F('GD03-050', 'full', { activate: { cost: 0, can: (g, p) => p.trash.filter(c => c.type === 'UNIT' && (c.traits.includes('Tekkadan') || c.traits.includes('Teiwaz'))).length >= 3 && p.opp.units.length,
  run(g, p) { for (let k = 0; k < 3; k++) { const c = p.ai.pickWorstCard(g, p, p.trash.filter(x => x.type === 'UNIT' && (x.traits.includes('Tekkadan') || x.traits.includes('Teiwaz')))); p.trash.splice(p.trash.indexOf(c), 1); p.exile.push(c); } dmgPick(g, p, 2, null); }, score: (g, p) => p.ai.bestDamageValue(g, p, 2, null) - 0.5 } });
F('GD03-056', 'full', { deploy(g, u) { ownAndEnemyPing(g, u.owner, u); } });
F('GD03-063', 'full', {});
F('GD05-050', 'full', { battleDestroyRule: (g, src, victim) => victim.def.lv <= 4 && !victim.pilot && victim.owner !== src.owner, destroyed(g, u) { const p = u.owner; p.trash.push(...p.deck.splice(0, 2)); } });
F('GD05-060', 'full', { deploy(g, u) { destroyPick(g, u.owner, x => x.def.lv <= 2); }, attack(g, u) { destroyPick(g, u.owner, x => x.def.lv <= 2); } });
F('ST05-004', 'full', {}); F('ST05-006', 'full', {}); F('ST11-007', 'full', {}); F('ST11-008', 'full', {});
F('ST11-009', 'full', { destroyed(g, u) { const p = u.owner; if (!yourTurn(g, p) && p.units.some(x => tr(g, x, 'Marine'))) g.draw(p, 1); } });
F('ST12-006', 'simplified', { note: 'Activate Main First Strike used before attacking a Unit; Action Suppression used when attacking player', activate: { cost: 0, can: (g, p, u) => !!u.pilot && p.trash.length >= 4 && !u.tKw['First Strike'], run(g, p, u) { for (let k = 0; k < 4; k++) { const c = p.ai.pickWorstCard(g, p, p.trash); p.trash.splice(p.trash.indexOf(c), 1); p.exile.push(c); } u.tKw['First Strike'] = 1; }, score: (g, p, u) => p.opp.units.some(x => x.rested) ? 0.8 : -1 },
  attack(g, u, b) { const p = u.owner; if (b.target === 'player' && p.trash.length >= 4 && p.opp.shields.length >= 2) { for (let k = 0; k < 4; k++) { const c = p.ai.pickWorstCard(g, p, p.trash); p.trash.splice(p.trash.indexOf(c), 1); p.exile.push(c); } u.bKw.Suppression = 1; } } });

// ======================= RED =======================
F('GD01-128', 'full', baseShield());
F('GD02-126', 'full', baseShield({ baseDestroyed(g, p) { dmgPick(g, p, 1, u => u.def.lv <= 4); } }));
F('ST08-014', 'full', baseShield({ baseDeploy(g, p) { if (p.units.length) { const u = p.ai.pickBestAttacker(g, p, p.units); u.tAP += 2; } } }));
F('GD03-109', 'full', cmd({ burst(g, p) { if (this_canIT(g, p)) EFX['GD03-109'].main(g, p); }, canMain: (g, p) => this_canIT(g, p), main(g, p) { const any = p.trash.filter(c => c.name.includes('Improved Technique')).length >= 2; dmgPick(g, p, 3, any ? null : u => u.def.lv <= 4); }, actionToo: true, removal: { kind: 'damage', n: 3, f: (g, u) => u.def.lv <= 4 || u.owner.opp.trash.filter(c => c.name.includes('Improved Technique')).length >= 2 } }));
function this_canIT(g, p) { const any = p.trash.filter(c => c.name.includes('Improved Technique')).length >= 2; return p.opp.units.some(u => any || u.def.lv <= 4); }
F('GD04-109', 'full', cmd({ canMain: (g, p) => p.opp.units.some(u => u.def.lv <= 6), main(g, p) { dmgPick(g, p, 4, u => u.def.lv <= 6); }, actionToo: true, removal: { kind: 'damage', n: 4, f: (g, u) => u.def.lv <= 6 } }));
F('GD05-110', 'full', cmd({ specialMove: true, burst(g, p) { if (p.opp.units.length) EFX['GD05-110'].main(g, p); }, canMain: (g, p) => p.opp.units.length > 0, main(g, p) { dmgPick(g, p, 2, null); if (p.units.some(u => u.def.name.includes('Master Gundam'))) g.draw(p, 1); }, actionToo: true, removal: { kind: 'damage', n: 2, f: () => true } }));
F('GD05-111', 'full', cmd({ canMain: (g, p) => p.hand.length >= 2, main(g, p) { if (g.discard(p, 1)) g.draw(p, 2); }, score: (g, p) => 1.4 }));
F('GD06-113', 'full', cmd({ burst(g, p) { dmgPick(g, p, 2, null); }, canMain: (g, p) => p.opp.units.some(u => u.dmg > 0), main(g, p) { dmgPick(g, p, 5, u => u.dmg > 0); }, actionToo: true, removal: { kind: 'damage', n: 5, f: (g, u) => u.dmg > 0 } }));
F('ST03-013', 'full', cmd({ burst(g, p) { if (p.opp.units.length) dmgPick(g, p, 2, null); }, canMain: (g, p) => p.opp.units.length > 0, main(g, p) { dmgPick(g, p, 2, null); }, actionToo: true, removal: { kind: 'damage', n: 2, f: () => true } }));
F('GD01-093', 'full', { p_attack(g, u) { if (u.linked) dmgPick(g, u.owner, 1, x => x.def.lv <= u.def.lv); } });
F('GD05-089', 'full', { note: 'Burst: deploy as AP3/HP3 Unit when 3+ MF cards in trash (if board room), else add to hand', burst(g, p, c) { if (p.trash.filter(x => x.traits.includes('MF')).length >= 3 && p.units.length < 6 && p.units.length <= p.opp.units.length) { const d = Object.assign({}, c, { type: 'UNIT', ap: 3, hp: 3, links: [], skw: {}, id: 'GD05-089', text: '' }); g.deployUnit(p, d, {}); return 'kept'; } p.hand.push(c); g.stats.p[p.i].extraCards++; return 'kept'; }, p_attack(g, u) { if (u.linked && u.owner.specialMoveThisTurn) dmgPick(g, u.owner, 2, null); } });
F('GD06-090', 'full', { alsoNamed: 'Gaelio Bauduin', p_attack(g, u) { if (u.owner.units.filter(x => tr(g, x, 'Gjallarhorn')).length >= 2) dmgPick(g, u.owner, 1, x => g.ap(x) <= 5); } });
F('ST03-010', 'full', { p_whenPaired(g, u) { const p = u.owner; const c = p.hand.filter(x => x.type === 'UNIT' && x.lv <= 4 && (x.traits.includes('Neo Zeon') || x.traits.includes('Zeon'))); if (c.length && p.units.length < 6) { const d = p.ai.pickBestCard(g, p, c); p.hand.splice(p.hand.indexOf(d), 1); g.deployUnit(p, d); } } });
F('ST04-011', 'full', { p_whenLinked(g, u) { u.attackActiveFilter = (e) => e.def.lv <= 5; } });
F('ST13-012', 'full', { p_onEffectKillWhileAttacking(g, u) { if (!u.once.has('suletta')) { u.once.add('suletta'); g.draw(u.owner, 1); } } });
F('GD01-044', 'full', { whenPaired(g, u, pd) { if ((pd.traits || []).some(t => t === 'Cyber-Newtype' || t === 'Newtype')) { const p = u.owner; const t1 = dmgPick(g, p, 1, null); dmgPick(g, p, 1, x => x !== t1); } } });
F('GD01-051', 'full', {});
F('GD03-035', 'full', { activate: { cost: 1, once: true, can: (g, p) => p.trash.some(c => c.type === 'PILOT') && p.opp.units.length > 0, run(g, p) { const c = p.ai.pickWorstCard(g, p, p.trash.filter(x => x.type === 'PILOT')); p.trash.splice(p.trash.indexOf(c), 1); p.exile.push(c); for (const e of [...p.opp.units]) g.effectDamage(p, e, 1); },
  score: (g, p) => p.opp.units.filter(e => g.hpLeft(e) <= 1).reduce((s, e) => s + p.ai.unitValue(g, e), 0) + p.opp.units.length * 0.3 - 0.8 }, whenLinked(g, u) { u.attackActiveFilter = (e) => g.ap(e) <= g.ap(u); } });
F('GD04-033', 'full', { onAllyDeploy(g, src, u) { if (tr(g, u, 'Neo Zeon')) dmgPick(g, src.owner, 3, null); }, deploy(g, u) { dmgPick(g, u.owner, 3, null); }, aura_traits(g, src, u, t) { if (src.linked) t.add('Neo Zeon'); } });
F('GD04-038', 'full', { deploy(g, u) { if (u.owner.opp.units.length >= 2) dmgPick(g, u.owner, 2, x => x.def.lv <= 2); } });
F('GD04-047', 'full', {});
F('GD05-033', 'full', { attack(g, u) { const p = u.owner; const sm = p.trash.filter(c => c.type === 'COMMAND' && c.traits.includes('Special Move')); if (sm.length >= 2 && (p.opp.base || p.opp.shields.length)) { for (let k = 0; k < 2; k++) { const c = sm[k]; p.trash.splice(p.trash.indexOf(c), 1); p.exile.push(c); } g.damageShieldArea(p, p.opp, 5, { effect: true }); } } });
F('GD05-036', 'full', { whenPaired(g, u) { const p = u.owner; const mf = p.units.filter(x => x !== u && !x.rested && tr(g, x, 'MF')); if (!mf.length) return; const r = mf.sort((a, b) => b.def.lv - a.def.lv)[0];
  const hits = p.opp.units.filter(e => e.def.lv <= r.def.lv); if (hits.reduce((s, e) => s + (effPreview(g, p, e, 2) >= g.hpLeft(e) ? p.ai.unitValue(g, e) : 0.5), 0) < 2.5) return; r.rested = true; for (const e of [...hits]) g.effectDamage(p, e, 2); } });
F('GD06-036', 'full', { whenLinked(g, u) { dmgPick(g, u.owner, 1, null); } });
F('GD06-048', 'full', { deploy(g, u) { const p = u.owner; const any = p.trash.filter(c => c.traits.includes('Gjallarhorn')).length >= 4; dmgPick(g, p, 1, any ? null : x => x.def.lv <= 2); } });
F('ST04-006', 'full', { attack(g, u) { if (g.ap(u) >= 5) dmgPick(g, u.owner, 3, x => x.def.lv >= 5); } });
F('ST12-004', 'full', {});
F('ST13-006', 'full', { attack(g, u, b) { if (u.pilot && b.target === 'player') dmgPick(g, u.owner, 2, null); },
  activate: { once: true, cost: 0, can: (g, p, u) => p.units.some(x => !x.rested && x !== u) && p.opp.units.some(x => x.def.lv <= 4), run(g, p, u) { const o = p.units.filter(x => !x.rested && x !== u); const r = p.ai.pickRestOwn(g, p, o); r.rested = true; dmgPick(g, p, 1, x => x.def.lv <= 4); }, score: (g, p) => p.ai.bestDamageValue(g, p, 1, x => x.def.lv <= 4) - 1.2, postCombat: true } });
F('ST13-008', 'full', {});

// ======================= WHITE =======================
F('GD02-129', 'full', baseShield({ immuneEffect: true }));
F('GD01-118', 'full', cmd({ canMain: () => true, main(g, p) { g.draw(p, 2); g.discard(p, 1); }, score: () => 2.0 }));
F('GD04-117', 'full', cmd({ burst(g, p) { EFX['GD04-117'].action(g, p); }, actionOnly: true, canAction: (g, p) => p.opp.units.some(u => u.def.lv <= 3),
  action(g, p, b, role) { const t1 = (role === 'defend' && b && b.attacker && b.attacker.def.lv <= 3) ? b.attacker : null; if (t1) g.bounce(t1); else bouncePick(g, p, u => u.def.lv <= 3); bouncePick(g, p, u => u.def.lv <= 3); },
  canMain: (g, p) => p.opp.units.filter(u => u.def.lv <= 3).length >= 2, main(g, p) { EFX['GD04-117'].action(g, p); }, removal: { kind: 'hand', f: (g, u) => u.def.lv <= 3, multi: 2 } }));
F('GD05-120', 'full', cmd({ specialMove: true, canMain: (g, p) => p.opp.units.some(u => !u.rested && g.hpLeft(u) <= 4), main(g, p) { restPick(g, p, u => g.hpLeft(u) <= 4); const s = p.units.filter(u => u.def.name.includes('Shining Gundam')); if (s.length) s[0].tKw['First Strike'] = 1; }, score: (g, p) => p.ai.restScore(g, p, u => g.hpLeft(u) <= 4), actionToo: true,
  action(g, p) { EFX['GD05-120'].main(g, p); }, defAction: { can: (g, p) => g.turnPlayer !== p && p.opp.units.some(u => !u.rested && g.hpLeft(u) <= 4), value: (g, p) => Math.max(0, ...p.opp.units.filter(u => !u.rested && g.hpLeft(u) <= 4).map(u => (g.kw(u, 'Blocker') ? 1.0 : 0.3) + (p.units.some(x => g.ap(x) >= g.hpLeft(u)) ? p.ai.unitValue(g, u) * 0.5 : 0))), run(g, p) { EFX['GD05-120'].main(g, p); } } }));
F('GD05-121', 'full', cmd({ specialMove: true, pilotName: 'Chibodee Crocket', canMain: (g, p) => p.opp.units.length > 0, main(g, p) { apDownPick(g, p, 2, null, null); const mf = p.units.filter(u => tr(g, u, 'MF') && !u.pilot); if (mf.length) { p.flags.cyclonePair = mf; } }, score: (g, p) => (p.units.some(u => tr(g, u, 'MF') && !u.pilot) ? 2.2 : 0.4) }));
F('ST01-014', 'full', cmd({ burst(g, p) { if (p.opp.units.length) apDownPick(g, p, 3, null, null); }, canMain: (g, p) => p.opp.units.length > 0, main(g, p) { apDownPick(g, p, 3, null, null); }, actionToo: true, apDown: 3 }));
F('ST04-012', 'full', cmd({ burst(g, p) { if (!p.units.some(u => u.token && tr(g, u, 'Earth Alliance'))) g.deployToken(p, 'Aile Strike Gundam'); },
  canMain: (g, p) => !p.units.some(u => u.token && tr(g, u, 'Earth Alliance')), main(g, p) { g.deployToken(p, p.opp.units.some(u => g.ap(u) >= 4) ? 'Launcher Strike Gundam' : 'Sword Strike Gundam'); }, score: (g, p) => p.units.length < 6 ? 3.0 : 0 }));
F('ST14-014', 'full', cmd({ pilotName: 'Garrod Ran & Tiffa Adill', canMain: (g, p) => p.opp.units.length > 0, main(g, p) { const any = p.trash.filter(c => c.type === 'COMMAND').length >= 4; apDownPick(g, p, 3, any ? null : u => u.def.lv <= 5, null); }, actionToo: true, apDown: 3, apDownOk: (g, p, u) => u.def.lv <= 5 || p.trash.filter(c => c.type === 'COMMAND').length >= 4 }));
F('GD05-097', 'full', { p_whenPaired(g, u) { const p = u.owner; g.draw(p, 1); if (!p.hand.length) return; const c = p.ai.pickDiscard(g, p, p.hand, true); p.hand.splice(p.hand.indexOf(c), 1); p.trash.push(c);
  const e = EFX[c.id]; if (c.type === 'COMMAND' && c.traits.includes('Special Move') && e && e.canMain && e.canMain(g, p)) { e.main(g, p); p.specialMoveThisTurn = true; g.fireAllies(p, 'onCommand', c); } } });
F('ST04-010', 'full', { p_attack(g, u, b) { apDownPick(g, u.owner, 2, null, { battle: true, b }); } });
F('EB01-054', 'full', {});
F('GD01-066', 'full', { deploy(g, u) { g.deployToken(u.owner, 'Fatum-00'); }, attack(g, u) { if (u.pilot) { const t = u.owner.units.find(x => x.token && tr(g, x, 'Triple Ship Alliance') && x.sick); if (t) t.flags.hasteThisTurn = true; } } });
F('GD01-068', 'full', { deploy(g, u) { bouncePick(g, u.owner, x => g.hpLeft(x) === 1); } });
F('GD01-073', 'full', { attack(g, u) { if (u.linked) bouncePick(g, u.owner, x => g.hpLeft(x) <= 2); } });
F('GD01-076', 'full', { ap: (g, u) => u.owner.trash.filter(c => c.type === 'COMMAND').length >= 4 ? 1 : 0, hp: (g, u) => u.owner.trash.filter(c => c.type === 'COMMAND').length >= 4 ? 1 : 0 });
F('GD01-086', 'full', {}); F('GD02-079', 'full', {});
F('GD04-066', 'full', { onCommand(g, u) { apDownPick(g, u.owner, 2, null, null); } });
F('GD04-068', 'full', { reduceEffectDmg: (g, u, d) => Math.max(0, d - 3) });
F('GD05-066', 'full', { deploy(g, u) { const p = u.owner; const mf = p.trash.filter(c => c.type === 'UNIT' && c.traits.includes('MF')); const sm = p.trash.filter(c => c.type === 'COMMAND' && c.traits.includes('Special Move'));
  if (mf.length >= 2 && sm.length) { for (let k = 0; k < 2; k++) { const c = p.ai.pickWorstCard(g, p, p.trash.filter(x => x.type === 'UNIT' && x.traits.includes('MF'))); p.trash.splice(p.trash.indexOf(c), 1); p.exile.push(c); } const s = p.ai.pickBestCard(g, p, sm); p.trash.splice(p.trash.indexOf(s), 1); p.hand.push(s); g.stats.p[p.i].extraCards++; } },
  attack(g, u) { if (!u.once.has('sg')) { u.once.add('sg'); const p = u.owner; if (p.resRested > 0) p.resRested--; } } });
F('GD05-068', 'full', { onCommand(g, u, c) { if (c.traits.includes('Special Move')) u.tKw.Suppression = 1; }, attack(g, u) { if (u.linked) u.bAP += 2; } });
F('GD05-069', 'full', { onBattleKill(g, u) { if (yourTurn(g, u.owner)) lookTop(g, u.owner, 4, c => c.type === 'COMMAND' && c.traits.includes('Special Move')); },
  attack(g, u) { if (u.linked && u.pilot && u.pilot.cmdPilot) { const c = CARDS[u.pilot.id]; const e = EFX[u.pilot.id]; if (e && e.canMain && e.canMain(g, u.owner)) { e.main(g, u.owner, { fromPair: true }); if (c.traits.includes('Special Move')) u.owner.specialMoveThisTurn = true; g.fireAllies(u.owner, 'onCommand', c); } } } });
F('GD05-072', 'full', { whenLinked(g, u) { restPick(g, u.owner, x => g.hpLeft(x) <= 4); } });
F('ST04-001', 'full', { whenPaired(g, u, pd) { if (pd.lv >= 4) bouncePick(g, u.owner, x => g.hpLeft(x) <= 4); } });
F('ST14-001', 'full', { onOppStart(g, u, opp) { const r = opp.units.filter(x => x.rested); if (!r.length) return; const m = Math.min(...r.map(x => x.def.lv)); for (const x of r) if (x.def.lv === m) x.noReady = true; } });
F('ST14-005', 'full', { deploy(g, u) { const p = u.owner; const t = restPick(g, p, x => x.def.lv <= 6); if (t && p.trash.length >= 7) t.tAP -= 2; } });

// ---------- per-colour hand implementations (Track 2 batch 2) ----------
{ const H = { dmgPick, restPick, bouncePick, destroyPick, apDownPick, lookTop, lookOneTopOrBottom, tr, yourTurn, cmd, baseShield, grantActive: require('./compiler').grantActive };
  for (const f of ['effects_green', 'effects_blue', 'effects_red', 'effects_white', 'effects_purple']) { let mod = null; try { mod = require('./' + f); } catch (e) { if (!(e.code === 'MODULE_NOT_FOUND' && String(e.message).includes(f))) throw e; } if (mod) mod(F, H, EFX); } }
// ---------- auto-compiled cards (strict templates; a card is added only if every clause parsed) ----------
{ const { compileCard } = require('./compiler'); const { TOKEN } = require('./engine');
  for (const id in CARDS) { if (EFX[id] || id.startsWith('T-')) continue; const r = compileCard(CARDS[id], TOKEN); if (!r.failed) { r.fidelity = r.fidelity || 'auto'; EFX[id] = r; } } }
module.exports = EFX;

// ======================= EXTENSION PACK (Green/Red/Blue candidates for optimization) =======================
// GREEN
F('ST13-016', 'full', baseShield({ baseDeploy(g, p) { g.deployToken(p, 'Bit / Funnel'); } }));
F('GD06-123', 'full', baseShield({ baseDeploy(g, p) { if (yourTurn(g, p) && p.units.some(u => tr(g, u, 'Neo Zeon') && u.pilot && u.pilot.lv <= 3)) destroyPick(g, p, u => g.kw(u, 'Blocker') && g.ap(u) <= 3); } }));
F('ST03-009', 'full', { deploy(g, u) { g.deployToken(u.owner, 'Zaku Ⅱ', { rested: true }); } });
F('GD01-106', 'full', cmd({ pilotName: 'Dozle Zabi', canMain: (g, p) => p.units.length < 6, main(g, p) { g.deployToken(p, 'Zaku Ⅱ'); g.deployToken(p, 'Zaku Ⅱ'); }, score: (g, p) => p.units.length <= 4 ? 3.0 : 1.0 }));
F('GD03-108', 'full', cmd({ pilotName: 'Gabriel Ramirez Garcia', canMain: (g, p) => p.units.length < 6, main(g, p) { g.deployToken(p, 'Hy-Gogg'); }, score: (g, p) => p.units.length < 6 ? 2.2 : 0 }));
F('GD06-109', 'full', cmd({ canMain: (g, p) => p.units.length < 6, main(g, p) { g.deployToken(p, p.opp.units.some(u => g.ap(u) >= 3) ? 'Turn X (Arms)' : 'Turn X (Legs)', { rested: true }); }, score: (g, p) => p.units.length < 6 ? 2.4 : 0 }));
F('GD02-104', 'full', cmd({ canMain: (g, p) => p.deck.length > 0, main(g, p) { const top = p.deck.splice(0, 3); if (!top.length) return; const keep = p.ai.pickBestCard(g, p, top); top.splice(top.indexOf(keep), 1); p.deck.push(...top); p.deck.unshift(keep); if (p.units.some(u => u.pilot && (u.pilot.traits || []).includes('Newtype'))) g.draw(p, 1); }, score: (g, p) => p.units.some(u => u.pilot && (u.pilot.traits || []).includes('Newtype')) ? 1.6 : 0.4 }));
F('GD06-020', 'simplified', { note: 'HP recovery trigger not modeled (minor)' });
F('EB01-032', 'full', {}); F('ST08-005', 'full', {});
F('ST13-004', 'full', { deploy(g, u) { lookOneTopOrBottom(g, u.owner); } });
F('GD05-086', 'full', { p_taunt: true });
F('ST03-014', 'simplified', cmd({ note: 'Action protection used on defense vs AP<=2 attacker', pilotName: 'Ramba Ral', actionOnly: true, canAction: () => true, action(g, p, b) { if (b && b.target !== 'player') b.target.flags.noBattleFrom2 = true; }, canMain: () => false, main() {} }));
F('GD06-108', 'full', cmd({ pilotName: 'Chara Soon', canMain: (g, p) => p.units.some(u => tr(g, u, 'Neo Zeon') && u.def.lv <= 4), main(g, p) { for (const u of p.units) if (tr(g, u, 'Neo Zeon') && u.def.lv <= 4) u.tAP += 2; }, score: (g, p) => p.ai.pumpScore(g, p, 2) }));
F('ST13-013', 'full', cmd({ pilotName: 'Carris Nautilus', canMain: (g, p) => p.units.length < 6, main(g, p) { g.deployToken(p, 'Bit / Funnel'); if (p.units.length < 6) g.deployToken(p, 'Bit / Funnel'); }, score: (g, p) => (p.units.some(u => u.def.id === 'GD06-018' && u.pilot) ? 1.6 : 0.6) }));
F('GD06-086', 'simplified', { note: 'cost -1 when pairing with [Mashymre Cello] link not modeled' });
F('GD05-106', 'full', cmd({ canMain: (g, p) => p.resDeck > 0 || p.trash.some(c => c.type === 'PILOT' && c.lv >= 5), main(g, p) { const pl = p.trash.filter(c => c.type === 'PILOT' && c.lv >= 5); if (pl.length && g.level(p) >= 7) { const c = p.ai.pickBestCard(g, p, pl); p.trash.splice(p.trash.indexOf(c), 1); p.hand.push(c); g.stats.p[p.i].extraCards++; } else if (p.resDeck > 0) { p.resDeck--; p.res++; p.resRested++; } }, score: (g, p) => g.level(p) <= 5 ? 1.8 : 0.9 }));
// RED
F('GD02-125', 'full', baseShield({ baseDeploy(g, p) { if (!yourTurn(g, p)) return; const red = p.hand.filter(c => c.color === 'Red'); if (red.length) { const w = p.ai.pickWorstCard(g, p, red); if (p.ai.cardValue(g, p, w) < 2.6) { p.hand.splice(p.hand.indexOf(w), 1); p.trash.push(w); g.draw(p, 1); } } } }));
F('ST03-015', 'full', baseShield({ baseDeploy(g, p) { dmgPick(g, p, 1, u => g.ap(u) <= 5); } }));
F('GD06-126', 'full', baseShield({ baseDeploy(g, p) { if (p.units.some(u => tr(g, u, 'Gjallarhorn'))) dmgPick(g, p, 1, u => u.dmg > 0); } }));
F('ST12-005', 'full', { attack(g, u) { const p = u.owner; if (!p.hand.length) return; const w = p.ai.pickWorstCard(g, p, p.hand); if (p.ai.cardValue(g, p, w) < 2.3) { p.hand.splice(p.hand.indexOf(w), 1); p.trash.push(w); g.draw(p, 1); } } });
F('GD06-110', 'full', cmd({ actionOnly: true, battlePump: 2, cantripIfLE: 3, canMain: () => false, main() {}, canAction: () => true, action(g, p, b, role, unit) { if (unit) unit.bAP += 2; if (p.hand.length <= 3) g.draw(p, 1); } }));
F('ST03-012', 'full', cmd({ pilotName: 'Angelo Sauper', battlePump: 2, actionToo: true, canMain: () => false, main() {}, canAction: () => true, action(g, p, b, role, unit) { if (unit) unit.tAP += 2; } }));
F('GD02-109', 'full', cmd({ pilotName: 'Shiiko Sugai', canMain: (g, p) => p.opp.units.length > 0, main(g, p) { dmgPick(g, p, 1, null); }, actionToo: true, removal: { kind: 'damage', n: 1, f: () => true } }));
F('GD01-112', 'full', cmd({ pilotName: 'Loni Garvey', canMain: (g, p) => p.units.filter(u => !u.rested).length >= 2 && p.opp.units.length > 0, main(g, p) { const act = p.units.filter(u => !u.rested).sort((a, b) => p.ai.unitValue(g, a) - p.ai.unitValue(g, b)); act[0].rested = true; act[1].rested = true; dmgPick(g, p, 3, null); }, score: (g, p) => p.ai.bestDamageValue(g, p, 3, null) - 1.6, postCombat: true }));
F('GD06-111', 'full', cmd({ pilotName: 'Julieta Juris', actionOnly: true, canMain: () => false, main() {}, canAction: (g, p) => p.trash.filter(c => c.traits.includes('Gjallarhorn')).length >= 4, removal: { kind: 'damage', n: 2, f: (g, u) => u.owner.opp.trash.filter(c => c.traits.includes('Gjallarhorn')).length >= 4 } }));
F('GD04-091', 'full', { p_destroyed(g, u) { dmgPick(g, u.owner, 1, x => x.dmg === 0); } });
// BLUE
F('GD01-001', 'full', { aura_kw: (g, src, u, k) => (k === 'Repair' && tr(g, u, 'White Base Team')) ? 1 : 0, whenPaired(g, u) { if (u.owner.units.filter(x => x !== u).length >= 2) g.draw(u.owner, 1); }, kw: (g, u, k) => (k === 'Repair' && tr(g, u, 'White Base Team')) ? 1 : 0 });
F('ST01-002', 'full', { whenPaired(g, u, pd) { if ((pd.traits || []).includes('White Base Team')) g.draw(u.owner, 1); } });
F('GD06-010', 'full', { whenLinked(g, u) { g.draw(u.owner, 1); } });
F('GD06-009', 'full', { deploy(g, u) { bouncePick(g, u.owner, x => g.hpLeft(x) === 1); } });
F('GD06-122', 'full', baseShield({ baseDeploy(g, p) { bouncePick(g, p, u => u.def.lv <= 2); } }));
F('GD02-122', 'full', baseShield({ baseDeploy(g, p) { dmgPick(g, p, 1, u => u.rested && u.def.lv <= 4); } }));
F('GD01-104', 'full', cmd({ burst(g, p) { g.draw(p, 1); }, canMain: (g, p) => p.opp.units.some(u => u.rested), main(g, p) { dmgPick(g, p, 2, u => u.rested); }, removal: { kind: 'damage', n: 2, f: (g, u) => u.rested } }));
F('ST11-013', 'full', cmd({ burst(g, p) { bouncePick(g, p, u => u.rested && g.hpLeft(u) <= 3); }, canMain: (g, p) => p.opp.units.some(u => u.rested && g.hpLeft(u) <= 3), main(g, p) { if (bouncePick(g, p, u => u.rested && g.hpLeft(u) <= 3)) g.draw(p, 1); }, actionToo: true, removal: { kind: 'hand', f: (g, u) => u.rested && g.hpLeft(u) <= 3, cantrip: 1 } }));
F('GD04-101', 'simplified', cmd({ note: 'effect-destruction immunity not modeled; played as cantrip', burst(g, p) { g.draw(p, 1); }, canMain: () => true, main(g, p) { g.draw(p, 1); }, score: () => 1.2 }));
F('GD06-102', 'full', cmd({ endPhaseDraw: 2, actionOnly: true, canMain: () => false, main() {}, canAction: () => false }));
F('ST01-012', 'full', cmd({ pilotName: 'Hayato Kobayashi', canMain: (g, p) => p.opp.units.some(u => u.rested), main(g, p) { dmgPick(g, p, 1, u => u.rested); }, removal: { kind: 'damage', n: 1, f: (g, u) => u.rested } }));
F('GD06-103', 'full', cmd({ pilotName: 'South Burning', canMain: (g, p) => p.opp.units.some(u => u.rested), main(g, p) { dmgPick(g, p, 1, u => u.rested); }, removal: { kind: 'damage', n: 1, f: (g, u) => u.rested } }));
F('GD06-080', 'simplified', { note: 'recover-2 activate not modeled' });

// ======================= EXPANSION 2: Turn X / Ghingnham, tokens, Blocker answers, Academy (Grace), late game =======================
const gfCount = (g, p, except) => p.units.filter(x => x !== except && (tr(g, x, 'Ghingnham Fleet') || tr(g, x, 'Long-Range Weapon'))).length;
F('GD06-019', 'full', { taunt: true, attack(g, u) { const p = u.owner; if (!p.units.some(x => x.token && tr(g, x, 'Ghingnham Fleet'))) { g.deployToken(p, 'Turn X (Arms)', { rested: true }); g.deployToken(p, 'Turn X (Legs)', { rested: true }); } } });
F('GD06-021', 'full', { deploy(g, u) { const p = u.owner; const toks = p.units.filter(x => x.token); if (!toks.length || p.units.length >= 6) return; const best = toks.reduce((a, b) => p.ai.unitValue(g, b) > p.ai.unitValue(g, a) ? b : a); g.deployToken(p, best.def.name, { rested: true }); } });
F('GD06-022', 'full', { whenLinked(g, u) { const p = u.owner; const c = p.opp.units.filter(x => g.ap(x) <= 3); if (!c.length) return; const t = p.ai.pickFightTarget(g, p, u, c) || p.ai.pickBestUnit(g, p, c); g.damageOnlyBattle(u, t); } });
F('GD06-026', 'full', { attack(g, u) { const p = u.owner; if (gfCount(g, p, u) >= 3) { const t = p.ai.pickBestAttacker(g, p, p.units); t.tAP += 1; t.tKw.Repair = (t.tKw.Repair || 0) + 2; } } });
F('GD06-030', 'full', { ap: (g, u) => gfCount(g, u.owner, u) >= 3 ? 2 : 0 });
F('GD06-031', 'full', {});
F('GD06-032', 'full', { destroyed(g, u) { lookTop(g, u.owner, 2, c => c.type === 'UNIT' && (c.traits.includes('Ghingnham Fleet') || c.traits.includes('Dianna Counter'))); } });
F('GD06-085', 'full', { p_aura_ap: (g, src, u) => (src.linked && g.turnPlayer !== u.owner && tr(g, u, 'Ghingnham Fleet')) ? 1 : 0 });
F('GD06-087', 'full', { p_attack(g, u) { const p = u.owner; const c = p.units.filter(x => x !== u && !x.rested && tr(g, x, 'Ghingnham Fleet')); if (c.length) { const t = p.ai.pickBestAttacker(g, p, c); t.attackActiveFilter = (e) => e.def.lv <= 4; } } });
F('GD06-107', 'full', cmd({ pilotName: 'Sweatson Stero', canMain: (g, p) => p.units.some(u => tr(g, u, 'Ghingnham Fleet')) && p.opp.units.some(u => g.kw(u, 'Blocker') && g.ap(u) <= 3), main(g, p) { destroyPick(g, p, u => g.kw(u, 'Blocker') && g.ap(u) <= 3); }, removal: { kind: 'destroy', f: (g, u) => g.kw(u, 'Blocker') && g.ap(u) <= 3 } }));
F('GD06-124', 'full', baseShield({ activate: { cost: 0, restBase: true, can: (g, p) => gfCount(g, p) >= 3 && p.units.some(u => g.canAttackThisTurn(u)), run(g, p) { for (const u of p.units) if (tr(g, u, 'Ghingnham Fleet')) u.tAP += 1; }, score: (g, p) => 0.8 } }));
F('GD04-022', 'full', { aura_kw: (g, src, u, k) => (k === 'Breach' && u.token) ? 1 : 0, kikeroga: true });
F('GD03-126', 'full', baseShield({ aura_ap: (g, base, u) => (u.token && g.turnPlayer !== u.owner) ? 1 : 0 }));
F('GD02-123', 'full', baseShield({ baseDeploy(g, p) { const t = p.units.filter(x => x.token && !x.rested); if (t.length && yourTurn(g, p)) { const x = p.ai.pickBestAttacker(g, p, t); x.attackActiveFilter = (e) => g.ap(e) <= 5; } } }));
F('ST13-002', 'full', { deploy(g, u) { g.deployToken(u.owner, 'Bit / Funnel'); } });
F('GD03-107', 'full', cmd({ pilotName: 'Hardie Steiner', canMain: (g, p) => p.units.some(u => u.token) && p.opp.units.some(u => u.def.lv <= 5), main(g, p) { dmgPick(g, p, p.units.filter(u => u.token).length, u => u.def.lv <= 5); }, score: (g, p) => p.ai.bestDamageValue(g, p, p.units.filter(u => u.token).length, u => u.def.lv <= 5) - 1.2 }));
F('GD01-108', 'full', cmd({ canMain: (g, p) => p.opp.units.some(u => g.kw(u, 'Blocker')), main(g, p) { for (const pl of g.players) for (const u of [...pl.units]) if (g.kw(u, 'Blocker')) g.effectDamage(pl === p ? null : p, u, 2); },
  score: (g, p) => p.opp.units.filter(u => g.kw(u, 'Blocker')).reduce((s, u) => s + p.ai.dmgTargetValue(g, p, u, 2), 0) - p.units.filter(u => g.kw(u, 'Blocker') && g.hpLeft(u) <= 2).reduce((s, u) => s + p.ai.unitValue(g, u), 0) - 1.0 }));
F('GD06-024', 'full', { destroyed(g, u) { destroyPick(g, u.owner, x => g.kw(x, 'Blocker') && g.ap(x) <= 3); } });
F('GD01-024', 'full', { deploy(g, u) { for (const pl of g.players) for (const x of [...pl.units]) if (x !== u && x.def.lv <= 5) g.effectDamage(pl === u.owner ? null : u.owner, x, 3); } });
F('ST02-010', 'full', { p_ap: (g, u) => u.linked ? 1 : 0, p_hp: (g, u) => u.linked ? 1 : 0 });
F('GD01-027', 'full', { deploy(g, u) { const p = u.owner; if (p.trash.filter(c => c.type === 'UNIT' && (c.traits.includes('Zeon') || c.traits.includes('Neo Zeon'))).length >= 10) for (const pl of g.players) for (const x of [...pl.units]) if (g.kw(x, 'Blocker')) g.effectDamage(pl === p ? null : p, x, 4); } });
F('GD01-032', 'full', { whenPaired(g, u, pd) { if ((pd.traits || []).includes('Zeon')) destroyPick(g, u.owner, x => g.kw(x, 'Blocker') && x.def.lv <= 2); } });
F('GD03-029', 'full', { onBattleKill(g, u) { if (yourTurn(g, u.owner)) for (const x of [...u.owner.opp.units]) if (g.kw(x, 'Blocker')) g.effectDamage(u.owner, x, 2); } });
F('GD01-110', 'full', cmd({ pilotName: 'Rasid Kurama', actionToo: true, canMain: (g, p) => p.units.some(u => u.def.lv >= 4 && g.canAttackThisTurn(u)) && p.opp.units.some(u => !u.rested && g.ap(u) <= 6), main(g, p) { const c = p.units.filter(u => u.def.lv >= 4 && g.canAttackThisTurn(u)); const t = p.ai.pickBestAttacker(g, p, c); t.attackActiveFilter = (e) => g.ap(e) <= 6; }, score: (g, p) => p.ai.unlockScore(g, p, u => u.def.lv >= 4, e => g.ap(e) <= 6) }));
F('GD03-105', 'full', cmd({ canMain: (g, p) => p.units.some(u => g.canAttackThisTurn(u)) && p.opp.units.some(u => !u.rested && !u.pilot), main(g, p) { const t = p.ai.pickBestAttacker(g, p, p.units.filter(u => g.canAttackThisTurn(u))); t.attackActiveFilter = (e) => !e.pilot; }, score: (g, p) => p.ai.unlockScore(g, p, () => true, e => !e.pilot) }));
F('GD05-018', 'full', { deploy(g, u) { g.placeEX(u.owner, 3); } });
F('GD04-024', 'full', { deploy(g, u) { lookTop(g, u.owner, 3, c => (c.type === 'UNIT' || c.type === 'COMMAND') && c.traits.includes('Academy') || (c.type === 'COMMAND' && c.id === 'GD06-105')); } });
F('GD05-087', 'full', { p_kw: (g, u, k) => (k === 'High-Maneuver' && tr(g, u, 'Academy')) ? 1 : 0 });
F('GD04-085', 'simplified', { note: 'EX-Resource command trigger not modeled (stats only)' });
F('GD04-030', 'full', { attack(g, u) { const p = u.owner; const c = p.units.filter(x => x !== u && !x.rested && tr(g, x, 'Academy')); if (c.length) { const t = p.ai.pickBestAttacker(g, p, c); t.attackActiveFilter = (e) => e.def.lv <= 3; } } });
F('GD05-022', 'simplified', { note: 'Action damage reduction (exile 2 Commands) not modeled' });
F('GD04-018', 'simplified', { note: 'EX Resource on ally damage not modeled' });
F('GD04-087', 'simplified', { note: 'damage redirect not modeled (stats only)' });
F('GD04-031', 'full', {}); F('GD05-031', 'full', {});
F('GD05-030', 'full', { deploy(g, u) { u.flags.hasteUnitsOnly = true; } });
F('ST13-009', 'full', { attack(g, u) { const o = u.owner.opp; for (let k = 0; k < 2; k++) { const c = o.trash.find(x => x.type === 'UNIT'); if (c) { o.trash.splice(o.trash.indexOf(c), 1); o.exile.push(c); } } } });
F('GD04-124', 'simplified', baseShield({ note: 'EX Resource AP trigger not modeled' }));
F('ST02-015', 'full', baseShield({ baseDeploy(g, p) { const top = p.deck.splice(0, 2); if (!top.length) return; const keep = p.ai.pickBestCard(g, p, top); p.deck.unshift(keep); const o = top.length > 1 ? top[1 - top.indexOf(keep)] : undefined; if (o) p.deck.push(o); } }));
F('GD04-008', 'full', { kw: (g, u, k) => (k === 'High-Maneuver' && u.linked) ? 1 : 0 });
F('GD01-009', 'full', { deploy(g, u) { const p = u.owner; const c = p.units.filter(x => x !== u && tr(g, x, 'White Base Team') && !x.rested); if (c.length) { const t = p.ai.pickBestAttacker(g, p, c); t.tKw['High-Maneuver'] = 1; } } });
F('GD01-103', 'full', cmd({ pilotName: 'Daguza Mackle', canMain: (g, p) => p.units.some(u => !u.rested && tr(g, u, 'Earth Federation')) && p.opp.units.some(u => !u.rested), main(g, p) { const own = p.units.filter(u => !u.rested && tr(g, u, 'Earth Federation')); const o = p.ai.pickRestOwn(g, p, own); o.rested = true; restPick(g, p, null); }, score: (g, p) => p.ai.restScore(g, p, null) - 0.6 }));
F('GD03-006', 'full', { deploy(g, u) { const p = u.owner; restPick(g, p, x => g.hpLeft(x) <= 3); restPick(g, p, x => g.hpLeft(x) <= 3); } });
F('GD05-126', 'full', baseShield({ activate: { cost: 2, once: true, can: (g, p) => p.units.some(u => u.def.name.includes('Gundam Aerial') && u.def.lv >= 5) && p.units.length < 6, run(g, p) { g.deployToken(p, 'Gundnode'); }, score: () => 2.0 } }));
// ---- cards from new 64-player GD06 winners (2–3 Nov 2026) ----
F('GD01-036', 'full', {});
F('GD05-067', 'full', { kw: (g, u, k) => (k === 'Suppression' && u.owner.opp.units.some(x => x.rested)) ? 1 : 0, attack(g, u) { restPick(g, u.owner, null); } });
F('GD01-067', 'full', { whenPaired(g, u) { const p = u.owner; const c = p.trash.filter(x => x.type === 'COMMAND' && x.lv <= 5); if (c.length) { const b = p.ai.pickBestCard(g, p, c); p.trash.splice(p.trash.indexOf(b), 1); p.hand.push(b); g.stats.p[p.i].extraCards++; } } });
F('GD03-125', 'simplified', baseShield({ note: 'Lv6+ Operation Meteor/G Team heal-on-kill not modeled' }));
F('ST02-001', 'full', { deploy(g, u) { u.attackActiveFilterPermanent = true; } });
