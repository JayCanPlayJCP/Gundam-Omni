'use strict';
// Red batch 2 card tests: node tests_red.js
const eng = require('./engine'); const EFX = require('./effects'); eng.setEffects(EFX);
const { AI } = require('./ai'); const { CARDS } = eng;
let pass = 0, fail = 0; const fails = [];
function T(name, fn) { try { fn(); pass++; } catch (e) { fail++; fails.push(name + ': ' + (e.stack || e.message).split('\n').slice(0, 3).join(' | ')); } }
function eq(a, b, m) { if (a !== b) throw new Error(`${m || ''} expected ${b} got ${a}`); }
function ok(c, m) { if (!c) throw new Error(m || 'assert'); }
const filler = [{ n: 50, id: 'GD05-027' }];
function mk(deckA = filler, deckB = filler, seed = 1) {
  const g = new eng.Game(deckA, deckB, seed, [new AI(), new AI()]); g.setup();
  g.turn = 1; g.turnPlayer = g.players[0]; for (const p of g.players) { p.flags.turn = {}; p.res = 6; p.resDeck = 4; }
  return g;
}
const C = (id) => CARDS[id];
const put = (g, p, id, o = {}) => { const u = g.deployUnit(p, C(id), { token: !!o.token }); u.sick = o.sick ?? false; if (o.rested) u.rested = true; return u; };
const tok = (g, p, name, o = {}) => { const u = g.deployToken(p, name, o); u.sick = false; return u; };

T('all 101 batch-2 Red cards are registered', () => { const ids = require('fs').readFileSync(__dirname + '/effects_red.js', 'utf8').match(/F\('([A-Z0-9]+-\d+)'/g).map(x => x.slice(3, -1));
  eq(new Set(ids).size, 101); for (const id of ids) ok(EFX[id] && (EFX[id].fidelity === 'full' || EFX[id].fidelity === 'simplified'), id); });

T('Throne Eins deploy rests 2 CB Units -> 2 damage to all enemy Lv<=6; Throne Drei readies itself', () => {
  const g = mk(); const [A, D] = g.players; const drei = put(g, A, 'GD04-041'); const ky = put(g, A, 'GD04-034');
  const j1 = put(g, D, 'GD05-027'), j2 = put(g, D, 'GD05-027'), gc = put(g, D, 'ST01-003');
  g.deployUnit(A, C('GD04-036')); ok(!g.alive(j1) && !g.alive(j2), 'Jegans (2 HP) destroyed'); eq(gc.dmg, 2, 'Guncannon took 2'); ok(ky.rested, 'Kyrios rested'); ok(!drei.rested, 'Drei set active again');
});
T('Throne Drei stays rested while the opponent has a paired Reginlaze Julia', () => {
  const g = mk(); const [A, D] = g.players; const drei = put(g, A, 'GD04-041'); const ju = put(g, D, 'GD06-037'); g.pair(ju, C('GD06-090')); const r = put(g, D, 'GD01-018');
  EFX['GD03-113'].main(g, A); ok(drei.rested, 'Drei could not be set active'); ok(!g.alive(r), 'Human Karma dealt 3 to the Lv3 ReZEL');
});
T('Human Karma rests Drei (effect), Drei readies, 3 damage to enemy with Lv <= Drei', () => {
  const g = mk(); const [A, D] = g.players; const drei = put(g, A, 'GD04-041'); const r = put(g, D, 'GD01-018');
  ok(EFX['GD03-113'].canMain(g, A)); EFX['GD03-113'].main(g, A); ok(!g.alive(r)); ok(!drei.rested);
});
T('Gundam Kyrios (linked): AP+2 per rested (CB) Unit incl. itself', () => {
  const g = mk(); const A = g.players[0]; const ky = put(g, A, 'GD04-034'); g.pair(ky, C('GD04-090')); ok(ky.linked); const d = put(g, A, 'GD04-041');
  eq(g.ap(ky), 3); d.rested = true; eq(g.ap(ky), 5); ky.rested = true; eq(g.ap(ky), 7);
});
T('Buster Gundam Support 3 + Coordinator pilot: ZAFT target +3 (gains Breach 3 at 5+ AP), Buster set active once per turn', () => {
  const g = mk(); const A = g.players[0]; const bu = put(g, A, 'GD01-046'); g.pair(bu, C('GD01-094')); const du = put(g, A, 'GD01-054');
  EFX['GD01-046'].activate.run(g, A, bu); eq(g.ap(du), 6); eq(g.kw(du, 'Breach'), 3); ok(!bu.rested, 'Buster active again');
  EFX['GD01-046'].activate.run(g, A, bu); eq(g.ap(du), 9); ok(bu.rested, 'second use: stays rested');
});
T('Hoka Kyoten Juzetsujin cast: MF Unit gains Breach 3, card paired from trash (links Dragon), not left in trash', () => {
  const g = mk(); const A = g.players[0]; const dr = put(g, A, 'GD05-035'); const c = C('GD05-112'); A.hand.push(c);
  A.ai.castCommand(g, A, c, 'main'); eq(g.kw(dr, 'Breach'), 3); ok(dr.pilot && dr.pilot.id === 'GD05-112', 'paired'); ok(dr.linked, 'Sai Saici links Dragon Gundam');
  ok(!A.trash.includes(c), 'not in trash'); ok(!Object.prototype.hasOwnProperty.call(A.trash, 'push'), 'push override removed'); ok(A.specialMoveThisTurn);
  g.destroy(dr, {}); eq(A.trash.filter(x => x === c).length, 1, 'one copy after the unit dies');
});
T('Rose Screamer with no MF Unit to pair: just goes to trash', () => {
  const g = mk(); const A = g.players[0]; const ro = put(g, A, 'GD05-044'); g.pair(ro, C('GD01-094')); const c = C('GD05-113'); A.hand.push(c);
  A.ai.castCommand(g, A, c, 'main'); eq(g.ap(ro), 3 + 1 + 2, 'MF Unit with 4 AP gets +2'); ok(A.trash.includes(c)); ok(!Object.prototype.hasOwnProperty.call(A.trash, 'push'));
});
T('Sinanju: shield destroyed by battle damage -> 2 damage to an enemy Unit, resolved right after the battle', () => {
  const g = mk(); const [A, D] = g.players; D.base = null; const s = put(g, A, 'ST03-001'); const j = put(g, D, 'GD05-027'); const sh = D.shields.length;
  g.attack(s, 'player'); eq(D.shields.length, sh - 1); ok(g.alive(j), 'not yet resolved inside the battle'); g.kw(s, 'High-Maneuver'); ok(!g.alive(j), 'resolved at next keyword query');
});
T('Sinanju: blocked attack does not trigger', () => {
  const g = mk(); const [A, D] = g.players; D.base = null; const s = put(g, A, 'ST03-001'); const bl = put(g, D, 'GD01-086'); const j = put(g, D, 'GD05-027');
  D.ai.chooseBlock = () => bl; g.attack(s, 'player'); A.ai.endPhaseAction = null; g.endPhase(A); ok(g.alive(j) && j.dmg === 0);
});
T('McGillis (linked): after the shield hit, a Gjallarhorn ally may attack an active Lv<=5 enemy', () => {
  const g = mk(); const [A, D] = g.players; D.base = null; const b = put(g, A, 'GD06-034'); g.pair(b, C('GD06-089')); ok(b.linked); const ju = put(g, A, 'GD06-043'); const r = put(g, D, 'GD01-018');
  ok(!A.ai.attackTargets(g, A, ju).includes(r), 'not before'); g.attack(b, 'player'); ok(A.ai.attackTargets(g, A, ju).includes(r), 'unlocked after hit');
});
T('Providence (ZAFT pilot): ZAFT Units +2 AP on own turn only; Attack deals 1 per 4 AP', () => {
  const g = mk(); const [A, D] = g.players; const pv = put(g, A, 'GD03-033'); g.pair(pv, C('GD03-091')); const du = put(g, A, 'GD01-054');
  eq(g.ap(du), 5); eq(g.ap(pv), 9); g.turnPlayer = D; eq(g.ap(du), 3); g.turnPlayer = A;
  const t = put(g, D, 'ST01-003', { rested: true }); const e = put(g, D, 'ST01-003'); D.ai.chooseBlock = () => null; g.attack(pv, t); ok(e.dmg === 2 || !g.alive(t), '2 damage from Attack (9 AP)');
});
T('Gundam Epyon (Lv5+ pilot): battle kill triggers chained 2-damage sweeps', () => {
  const g = mk(); const [A, D] = g.players; const ep = put(g, A, 'ST12-001'); g.pair(ep, C('ST12-011')); ok(ep.linked);
  const t = put(g, D, 'ST01-005', { rested: true }); const j = put(g, D, 'GD05-027'); const g1 = put(g, D, 'ST01-003'); const g2 = put(g, D, 'ST01-003'); g2.tHP = 2;
  D.ai.chooseBlock = () => null; g.attack(ep, t); eq(D.units.length, 0, 'all swept: 2 -> 4 -> 6 damage');
});
T('Gundam Epyon deploy deals 5 to the enemy Base', () => { const g = mk(); const [A, D] = g.players; ok(D.base); g.deployUnit(A, C('ST12-001')); eq(D.base, null); });
T('Izuma Colony: battle damage from a <=3 AP attacker deals 1 back', () => {
  const g = mk(); const [A, D] = g.players; g.deployBase(D, C('GD04-126')); const a = put(g, A, 'GD02-028'); D.ai.chooseBlock = () => null;
  g.attack(a, 'player'); eq(D.base.dmg, 3); eq(a.dmg, 1); const b = put(g, A, 'GD01-018'); D.base.dmg = 0; g.attack(b, 'player'); eq(b.dmg, 0, '4 AP attacker not hit');
});
T('Destroy Gundam: Lv-3/cost-3 in hand while the enemy has 7+ trash', () => {
  const g = mk(); const [A, D] = g.players; const c = C('GD05-037'); D.trash = Array(6).fill(C('GD05-027')); eq(g.effLv(A, c), 9); eq(g.costOf(A, c), 8);
  D.trash.push(C('GD05-027')); eq(g.effLv(A, c), 6); eq(g.costOf(A, c), 5);
});
T('Abyss (MA) paired with a Phantom Pain Pilot: opponent with 4+ cards discards; Gaia (MA) then costs 2 less', () => {
  const g = mk(); const [A, D] = g.players; const ab = put(g, A, 'GD05-046'); eq(g.costOf(A, C('GD05-041')), 3); const h = D.hand.length; ok(h >= 4);
  g.pair(ab, C('GD05-092')); eq(D.hand.length, h - 1); eq(g.costOf(A, C('GD05-041')), 1);
});
T('Eliminate Target destroys only the Pilot of an enemy Lv<=5 Unit', () => {
  const g = mk(); const [A, D] = g.players; const v = put(g, D, 'GD06-036'); g.pair(v, C('GD06-090')); ok(v.linked);
  EFX['GD03-110'].main(g, A); ok(g.alive(v)); ok(!v.pilot && !v.linked); ok(D.trash.includes(C('GD06-090'))); eq(g.ap(v), 3);
});
T('Neo Core Fighter: destroy Core Top + Core Base + itself -> deploy ZZ from hand; ZZ deploy deals 3 (2+1 AEUG) to all enemies', () => {
  const g = mk(); const [A, D] = g.players; put(g, A, 'GD06-044'); put(g, A, 'GD06-045'); const n = put(g, A, 'GD06-039'); A.hand.push(C('GD06-033'));
  const j = put(g, D, 'GD05-027'); const r = put(g, D, 'GD01-018'); const gc = put(g, D, 'ST01-003'); const e = EFX['GD06-039'].activate;
  ok(e.can(g, A, n)); ok(e.score(g, A, n) > 0, 'AI wants it'); e.run(g, A, n);
  eq(A.units.length, 1); eq(A.units[0].def.id, 'GD06-033'); ok(!A.hand.includes(C('GD06-033'))); ok(!g.alive(j) && !g.alive(r)); ok(gc.dmg >= 3);
});
T('ZZ Gundam: AEUG Unit battling an enemy Unit deals +1 (AP), not vs player', () => {
  const g = mk(); const [A, D] = g.players; const ct = put(g, A, 'GD06-044'); put(g, A, 'GD06-033'); const t = put(g, D, 'GD01-018', { rested: true });
  eq(g.ap(ct), 3); g.inBattle = { attacker: ct, target: t }; eq(g.ap(ct), 4); g.inBattle = { attacker: ct, target: 'player' }; eq(g.ap(ct), 3); g.inBattle = null;
});
T('Rivalry with Roux: playable only while a friendly AEUG Unit battles; deals 2 to the enemy battler', () => {
  const g = mk(); const [A, D] = g.players; const ct = put(g, A, 'GD06-044'); const jg = put(g, A, 'GD05-027'); const t = put(g, D, 'ST01-003', { rested: true }); const c = C('GD06-112');
  g.inBattle = { attacker: jg, target: t }; ok(g.costOf(A, c) >= 99, 'unplayable'); g.inBattle = { attacker: ct, target: t }; eq(g.costOf(A, c), 1);
  EFX['GD06-112'].action(g, A, g.inBattle, 'attack', ct); eq(t.dmg, 2); g.inBattle = null;
});
T('Trinity: Action guard needs a CB battler; Main/Action gives +2 to up to 3 CB Units', () => {
  const g = mk(); const [A, D] = g.players; const k = put(g, A, 'GD04-034'); const d = put(g, A, 'GD04-041'); const v = put(g, A, 'GD04-047'); const x = put(g, A, 'GD04-047'); const jg = put(g, A, 'GD05-027'); const t = put(g, D, 'ST01-003', { rested: true }); const c = C('GD04-111');
  g.inBattle = { attacker: jg, target: t }; ok(g.costOf(A, c) >= 99, 'unplayable'); g.inBattle = { attacker: d, target: t }; eq(g.costOf(A, c), 1);
  EFX['GD04-111'].action(g, A, g.inBattle, 'attack', d); eq(d.tAP, 2); eq([k, v, x].filter(u => u.tAP === 2).length, 2); eq(jg.tAP, 0); g.inBattle = null;
});
T('Assault on Torrington Base used by the AI as a combat trick: +1 to the battler and +1 to another Unit', () => {
  const g = mk(); const [A, D] = g.players; const a = put(g, A, 'ST01-005'); const o = put(g, A, 'GD05-027'); const t = put(g, D, 'GD01-037', { rested: true }); const c = C('GD01-114'); A.hand.push(c);
  const b = { attacker: a, target: t }; g.inBattle = b; ok(A.ai.battlePumpUse(g, A, b, 'attack')); eq(a.tAP, 1); eq(o.tAP, 1); ok(A.trash.includes(c)); g.inBattle = null;
});
T('Olba Frost: own-turn battle kill of a Newtype-paired Unit draws 1', () => {
  const g = mk(); const [A, D] = g.players; const a = put(g, A, 'GD04-044'); g.pair(a, C('GD02-093')); a.tHP = 3; const e = put(g, D, 'GD05-027', { rested: true }); g.pair(e, C('ST06-009'));
  D.ai.chooseBlock = () => null; const h = A.hand.length; g.attack(a, e); ok(!g.alive(e)); eq(A.hand.length, h + 1);
});
T('Final Duty: destroy own token, deploy a Lv<=4 Unit from the top 4', () => {
  const g = mk(); const A = g.players[0]; tok(g, A, 'Zaku Ⅱ'); A.deck.unshift(C('GD06-044')); const n = A.deck.length;
  EFX['ST13-014'].main(g, A); eq(A.units.length, 1); ok(!A.units[0].token); eq(A.deck.length, n - 1);
});
T('GQuuuuuuX (Omega Psycommu) GD02-038: deploys a Clan Lv<=4 from top 3 (its Deploy resolves after)', () => {
  const g = mk(); const [A, D] = g.players; A.deck.unshift(C('ST06-002')); const j = put(g, D, 'ST01-005'); const n = A.deck.length;
  g.deployUnit(A, C('GD02-038')); ok(A.units.some(u => u.def.id === 'ST06-002')); eq(A.deck.length, n - 1); eq(j.dmg, 1, 'ST06-002 deploy pinged (another Clan in play)');
});
T('Duel Gundam (Assault Shroud) GD03-042: active Lv<=5 enemy targetable only at 5+ AP', () => {
  const g = mk(); const [A, D] = g.players; const du = put(g, A, 'GD03-042'); const r = put(g, D, 'GD01-018');
  ok(!A.ai.attackTargets(g, A, du).includes(r)); du.tAP = 2; ok(A.ai.attackTargets(g, A, du).includes(r));
});
T('Gaza C: rest + destroy itself to deal 1 damage to an enemy Lv<=5 Unit', () => {
  const g = mk(); const [A, D] = g.players; const gz = put(g, A, 'GD02-047'); const e = put(g, D, 'GD01-062'); const A2 = EFX['GD02-047'].activate;
  ok(A2.can(g, A, gz)); A2.run(g, A, gz); ok(!g.alive(gz)); eq(e.dmg, 1);
});
T('Psycho Gundam (GQ) linked: another Unit paired with a Cyber-Newtype breaks a shield -> 2 damage to enemy <=5 AP (once/turn)', () => {
  const g = mk(); const [A, D] = g.players; D.base = null; const ps = put(g, A, 'GD04-042'); g.pair(ps, C('GD04-091')); ok(ps.linked); const s = put(g, A, 'ST03-001'); g.pair(s, C('ST03-010'));
  const j = put(g, D, 'GD05-027'); const j2 = put(g, D, 'GD05-027'); g.attack(s, 'player'); A.ai.endPhaseAction = null; g.endPhase(A);
  eq(D.units.length, 0, 'Sinanju trigger + Psycho trigger each destroyed one Jegan');
});
T('Gaia Gundam (paired): shield hit -> opponent with <4 cards declines discard -> deploy a Phantom Pain Lv<=4 from hand', () => {
  const g = mk(); const [A, D] = g.players; D.base = null; D.hand = D.hand.slice(0, 3); const ga = put(g, A, 'GD05-034'); g.pair(ga, C('GD05-090')); A.hand.push(C('GD06-047'));
  g.attack(ga, 'player'); g.kw(ga, 'Blocker'); ok(!A.units.some(u => u.def.id === 'GD06-047'), 'unsafe resolution waits for an explicit hook'); g.endPhase(A);
  ok(A.units.some(u => u.def.id === 'GD06-047'), 'Windam deployed'); ok(!A.hand.includes(C('GD06-047')));
});
T('Gaia Gundam: opponent with 4+ cards discards instead; Gaia (MA) then costs 2 less', () => {
  const g = mk(); const [A, D] = g.players; D.base = null; const ga = put(g, A, 'GD05-034'); g.pair(ga, C('GD05-090')); A.hand.push(C('GD06-047')); const h = D.hand.length;
  g.attack(ga, 'player'); g.deployUnit(A, C('GD05-027')); eq(D.hand.length, h - 1); ok(A.hand.includes(C('GD06-047'))); eq(g.costOf(A, C('GD05-041')), 1);
});
T('Ξ Gundam GD04-035: chosen Mafty Unit draws on a battle kill this turn while hand <= 3', () => {
  const g = mk(); const [A, D] = g.players; const m = put(g, A, 'ST08-004'); m.tHP = 3; A.hand = A.hand.slice(0, 2); g.deployUnit(A, C('GD04-035'));
  const e = put(g, D, 'GD05-027', { rested: true }); D.ai.chooseBlock = () => null; const h = A.hand.length; const x = A.units.find(u => (u.flags.xi || []).length);
  ok(x); g.attack(x, e); ok(!g.alive(e)); eq(A.hand.length, h + 1);
});
T('Gamow-free Duel Gundam GD01-054: Breach 3 only while 5+ AP', () => { const g = mk(); const A = g.players[0]; const du = put(g, A, 'GD01-054'); eq(g.kw(du, 'Breach'), 0); du.tAP = 2; eq(g.kw(du, 'Breach'), 3); });

console.log(`tests_red: ${pass} passed, ${fail} failed`); if (fails.length) console.log(fails.join('\n'));
process.exitCode = fail ? 1 : 0;
