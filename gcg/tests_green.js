'use strict';
// Focused tests for effects_green.js: node tests_green.js
const eng = require('./engine'); const EFX = require('./effects'); eng.setEffects(EFX);
const { AI } = require('./ai'); const { CARDS } = eng;
let pass = 0, fail = 0; const fails = [];
function T(name, fn) { try { fn(); pass++; } catch (e) { fail++; fails.push(name + ': ' + (e.stack || e.message).split('\n').slice(0, 2).join(' | ')); } }
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
const quiet = (p) => { p.ai.actionStep = () => {}; p.ai.chooseBlock = () => null; };

T('every Green card in the pool is registered', () => { const miss = Object.keys(CARDS).filter(id => !id.startsWith('T-') && CARDS[id].color === 'Green' && ['UNIT', 'PILOT', 'COMMAND', 'BASE'].includes(CARDS[id].type) && !EFX[id]); eq(miss.length, 0, 'missing ' + miss.join(',')); });

T('GD04-021/GD04-020: Dawn of Fold Command paid with EX -> paired from trash to a Lfrith, Lfrith Ur draws', () => {
  const g = mk(); const A = g.players[0]; const ur = put(g, A, 'GD04-020'); const th = put(g, A, 'GD04-021');
  A.resRested = A.res; A.ex = 1; const c = C('GD04-108'); A.hand.push(c); const h0 = A.hand.length;
  A.ai.castCommand(g, A, c, 'main');
  const paired = [ur, th].find(u => u.pilot && u.pilot.id === 'GD04-108'); ok(paired, 'command paired as pilot');
  ok(paired === ur && ur.linked, 'pairs where it links (Sophie Pulone -> Lfrith Ur)');
  eq(A.trash.filter(x => x.id === 'GD04-108').length, 0, 'not left in trash'); ok(!Object.prototype.hasOwnProperty.call(A.trash, 'push'), 'trash push restored');
  eq(A.hand.length, h0 - 1 + 1, 'Ur drew 1'); eq(A.ex, 0); ok(A.units.some(u => u.flags.reduceNext === 4), 'EX-paid Witches reduces by 4');
  A.trash.push(C('GD05-027')); eq(A.trash[A.trash.length - 1].id, 'GD05-027', 'later pushes work');
});
T('GD04-021: Dawn of Fold Command paid with normal resources -> no pairing, no draw, card to trash', () => {
  const g = mk(); const A = g.players[0]; const ur = put(g, A, 'GD04-020'); put(g, A, 'GD04-021'); A.ex = 0; const c = C('GD04-108'); A.hand.push(c); const h0 = A.hand.length;
  A.ai.castCommand(g, A, c, 'main'); ok(!ur.pilot); eq(A.hand.length, h0 - 1); ok(A.trash.includes(c)); ok(A.units.some(u => u.flags.reduceNext === 2), 'normal-paid reduces by 2');
});
T('EB01-022 Exia (EX) + Chall Acustica: endangered at end of turn -> destroyed into 3 Exia tokens, Chall to deck top', () => {
  const g = mk(); const [A, D] = g.players; put(g, D, 'GD04-032'); const ex = put(g, A, 'EB01-022'); g.pair(ex, C('EB01-068')); ok(ex.linked, 'Chall links via (Attack)');
  ex.rested = true; ex.dmg = 4; g.endPhase(A);
  ok(!g.alive(ex)); eq(A.units.filter(u => u.token && u.def.name === 'Gundam Exia').length, 3); eq(A.deck[0].id, 'EB01-068', 'Chall on top'); ok(A.trash.some(c => c.id === 'EB01-022'));
});
T('EB01-022 Exia (EX): healthy and unthreatened -> kept', () => { const g = mk(); const A = g.players[0]; const ex = put(g, A, 'EB01-022'); g.pair(ex, C('EB01-067')); g.endPhase(A); ok(g.alive(ex)); eq(A.units.length, 1); });
T('EB01-068 Chall Acustica: not linked -> stays in trash', () => { const g = mk(); const A = g.players[0]; const u = put(g, A, 'GD05-027'); g.pair(u, C('EB01-068')); ok(!u.linked); const top = A.deck[0]; g.destroy(u, {}); ok(A.deck[0] === top); ok(A.trash.some(c => c.id === 'EB01-068')); });
T('EB01-033 Taurus: on opponent\'s turn pays 1 to give the attacked unit AP+1 when that kills the attacker (once)', () => {
  const g = mk(); const [A, D] = g.players; g.turnPlayer = A; quiet(D); quiet(A);
  put(g, D, 'EB01-033'); const x = put(g, D, 'GD05-027', { rested: true }); // Jegan 2/2
  const a = put(g, A, 'GD01-030'); a.dmg = 0; // Rick Dom 3/3 -> needs 3
  D.resRested = 0; const av = g.avail(D); g.attack(a, x); ok(!g.alive(a), 'attacker destroyed by 2+1'); eq(g.avail(D), av - 1, 'paid 1');
  const y = put(g, D, 'GD05-027', { rested: true }); const a2 = put(g, A, 'GD01-030'); g.attack(a2, y); ok(g.alive(a2), 'once per turn');
});
T('GD05-021 AGE-2 Double Bullet: Activate AP+4 auto-used only when it flips the fight; -2 battle damage with EF pilot', () => {
  const g = mk(); const [A, D] = g.players; quiet(D); quiet(A); const db = put(g, A, 'GD05-021'); const t = put(g, D, 'GD04-032', { rested: true }); t.tHP = 3; // 4/8
  const av = g.avail(A); g.attack(db, t); ok(!g.alive(t), 'AP 4+4 kills HP 8'); eq(g.avail(A), av - 1, 'paid 1');
  const g2 = mk(); const [A2, D2] = g2.players; quiet(D2); quiet(A2); const db2 = put(g2, A2, 'GD05-021'); g2.pair(db2, C('GD03-088')); const t2 = put(g2, D2, 'GD04-032', { rested: true });
  const av2 = g2.avail(A2); g2.attack(db2, t2); ok(!g2.alive(t2), 'AP 4+2 (Asemu) kills HP 5 without activation'); eq(g2.avail(A2), av2, 'not paid'); eq(db2.dmg, 2, '4 damage reduced by 2 (EF pilot)');
});
T('GD04-029 Dynames: with a CB Pilot, enemy battle damage -1 once per turn', () => {
  const g = mk(); const [A, D] = g.players; g.turnPlayer = A; quiet(D); quiet(A); const dy = put(g, D, 'GD04-029', { rested: true }); g.pair(dy, C('ST07-011'));
  const a = put(g, A, 'GD05-027'); g.attack(a, dy); eq(dy.dmg, 1, '2-1'); const a2 = put(g, A, 'GD05-027'); g.attack(a2, dy); eq(dy.dmg, 3, 'second hit unreduced');
});
T('GD03-020 Zaku II FZ: 4 Cyclops in trash -> 2 rested Ad Balloons that never ready or take pilots; FZ immune to battle damage', () => {
  const g = mk(); const [A, D] = g.players; for (const id of ['GD03-017', 'GD03-024', 'GD03-027', 'GD03-090']) A.trash.push(C(id));
  const fz = put(g, A, 'GD03-020'); g.pair(fz, C('GD03-089')); const bal = A.units.filter(u => u.def.name === 'Ad Balloon'); eq(bal.length, 2); ok(bal.every(b => b.rested));
  ok(A.ai.pairBonus(g, A, bal[0], C('GD03-090')) < 0, 'AI never pairs a balloon');
  g.endPhase(A); g.turnPlayer = D; D.ai.mainPhase = () => {}; g.takeTurn(D); g.turnPlayer = A; A.ai.mainPhase = () => {}; g.takeTurn(A); ok(bal.every(b => b.rested), 'balloons stay rested');
  g.turnPlayer = D; quiet(A); quiet(D); fz.rested = true; fz.dmg = 0; const e = put(g, D, 'GD01-030'); g.attack(e, fz); eq(fz.dmg, 0, 'no battle damage while a balloon is in play');
});
T('GD03-089 Bernard Wiseman: AP + unique (Cyclops Team) Pilot/Command names in trash', () => { const g = mk(); const A = g.players[0]; const u = put(g, A, 'GD05-027'); g.pair(u, C('GD03-089')); const ap0 = g.ap(u); A.trash.push(C('GD03-090'), C('GD03-090'), C('GD03-024')); eq(g.ap(u), ap0 + 1); });
T('GD05-026 Aerial Rebuild + 1 Lfrith: enemy Lv<=2 units deploy rested, Lv3 active', () => {
  const g = mk(); const [A, D] = g.players; put(g, A, 'GD05-026'); put(g, A, 'EB01-034'); const lo = g.deployUnit(D, C('GD05-027')); const hi = g.deployUnit(D, C('GD01-030')); ok(lo.rested); ok(!hi.rested);
});
T('EB01-077 Master League Begins: defender redirects a player attack onto a sturdy rested G Generation unit', () => {
  const g = mk(); const [A, D] = g.players; g.turnPlayer = A; D.base = null; A.ai.actionStep = () => {}; D.ai.chooseBlock = () => null;
  const w = put(g, D, 'EB01-007', { rested: true }); // 5/4
  const a = put(g, A, 'GD05-027'); D.hand.push(C('EB01-077')); D.resRested = 0; const sh = D.shields.length;
  g.attack(a, 'player'); eq(D.shields.length, sh, 'no shield lost'); ok(!g.alive(a), 'attacker died to the new target'); eq(w.dmg, 2); ok(D.trash.some(c => c.id === 'EB01-077'));
});
T('GD04-107 Destined Battle: chosen rested unit must be attacked for the rest of the turn', () => {
  const g = mk(); const [A, D] = g.players; g.turnPlayer = A; const t = put(g, D, 'GD04-032', { rested: true }); put(g, D, 'GD05-027', { rested: true });
  const a = put(g, A, 'GD05-027'); const a2 = put(g, A, 'GD01-030'); const b = { attacker: a, target: 'player' };
  ok(EFX['GD04-107'].defAction.can(g, D, b)); EFX['GD04-107'].defAction.run(g, D, b); const tg = A.ai.attackTargets(g, A, a2); eq(tg.length, 1); ok(tg[0] === t, 'sturdiest rested unit taunts');
});
T('EB01-039 Rising Freedom: Lv6/cost5 played as Lv3/cost3 with 3 enemy Units', () => {
  const g = mk(); const [A, D] = g.players; A.res = 3; A.ex = 0; ok(!g.canPlay(A, C('EB01-039'))); for (let k = 0; k < 3; k++) put(g, D, 'GD05-027'); ok(g.canPlay(A, C('EB01-039'))); eq(g.costOf(A, C('EB01-039')), 3);
});
T('GD05-107 Interwoven Blessings: destroys base then first shield; Burst places EX', () => {
  const g = mk(); const [A, D] = g.players; const sh = D.shields.length; EFX['GD05-107'].main(g, A); eq(D.base, null); eq(D.shields.length, sh - 1);
  EFX['GD05-107'].main(g, A); eq(D.shields.length, sh - 3); A.ex = 0; EFX['GD05-107'].burst(g, A); eq(A.ex, 1);
});
T('ST14-015 Battlefield Emotions: +1 resource that is active, the set-active only once per turn', () => {
  const g = mk(); const A = g.players[0]; A.resRested = 4; EFX['ST14-015'].main(g, A); eq(A.res, 7); eq(A.resRested, 4); EFX['ST14-015'].main(g, A); eq(A.res, 8); eq(A.resRested, 5);
});
T('EB01-028 Plutone: rested Plutone gives another attacker Breach 2 vs an enemy Unit (once per turn)', () => {
  const g = mk(); const [A, D] = g.players; quiet(D); quiet(A); const pl = put(g, A, 'EB01-028', { rested: true }); const a = put(g, A, 'GD04-032'); const e = put(g, D, 'GD05-027', { rested: true });
  g.attack(a, e); ok(!g.alive(e)); eq(D.base.dmg, 2, 'Breach 2 to EX Base'); eq(g.kw(a, 'Breach'), 0, 'battle-only'); ok(pl.once.has('plutone'));
});
T('GD04-028 Zakrello: attack gives an active enemy <Blocker> (prefers one that will not block it)', () => {
  const g = mk(); const [A, D] = g.players; const z = put(g, A, 'GD04-028'); const big = put(g, D, 'GD04-032'); D.ai.actionStep = () => {}; A.ai.actionStep = () => {};
  g.attack(z, 'player'); ok(g.kw(big, 'Blocker') > 0, 'only active enemy gained Blocker');
  const g2 = mk(); const [A2, D2] = g2.players; const z2 = put(g2, A2, 'GD04-028'); const big2 = put(g2, D2, 'GD04-032'); const weak = put(g2, D2, 'GD02-034'); D2.ai.actionStep = () => {}; A2.ai.actionStep = () => {};
  g2.attack(z2, 'player'); ok(g2.kw(weak, 'Blocker') > 0 && !g2.kw(big2, 'Blocker'), '0-AP unit chosen'); ok(g2.alive(z2) && !weak.rested, 'not blocked');
});
T('ST06-015 Kaneban: Clan unit links -> Breach 3 this turn (once per turn)', () => {
  const g = mk(); const A = g.players[0]; g.deployBase(A, C('ST06-015')); const r = put(g, A, 'GD03-039'); const r2 = put(g, A, 'ST06-008');
  const lk = (u) => { const pl = Object.keys(CARDS).map(id => CARDS[id]).find(c => c.type === 'PILOT' && g.isLinkPilot(u.def, c)); return pl; };
  const p1 = lk(r), p2 = lk(r2); ok(p1 && p2, 'link pilots exist'); const b0 = g.kw(r, 'Breach'); g.pair(r, p1); eq(g.kw(r, 'Breach'), b0 + 3); const b1 = g.kw(r2, 'Breach'); g.pair(r2, p2); eq(g.kw(r2, 'Breach'), b1, 'once per turn');
});
T('GD02-022 G-Exes + GD03-023 G-Bouncer: placing an EX Resource gives an AGE System unit Breach 2 and High-Maneuver', () => {
  const g = mk(); const A = g.players[0]; put(g, A, 'GD02-022'); put(g, A, 'GD03-023'); const age = put(g, A, 'GD02-029'); A.ex = 0; const br = g.kw(age, 'Breach');
  g.placeEX(A, 1); eq(g.kw(age, 'Breach'), br + 2); ok(g.kw(age, 'High-Maneuver') > 0); g.placeEX(A, 1); eq(g.kw(age, 'Breach'), br + 2, 'G-Exes once per turn');
});
T('EB01-025 Tallgeese II: Development 2 gives both players an EX Resource; paired -> immune to Lv<=5 battle damage', () => {
  const g = mk(); const [A, D] = g.players; A.ex = 0; D.ex = 0; A.trash.push(C('EB01-012'), C('EB01-016')); A.hand.push(C('EB01-067'));
  const t = put(g, A, 'EB01-025'); eq(A.ex, 1); eq(D.ex, 1); eq(A.exile.length, 2); g.pair(t, C('EB01-067')); t.rested = true;
  g.turnPlayer = D; quiet(A); quiet(D); const e = put(g, D, 'GD01-030'); g.attack(e, t); eq(t.dmg, 0); ok(!g.alive(e) || e.dmg > 0);
});
T('GD04-088 Tokwan: blocked by Lv<=4 unit -> no battle damage', () => {
  const g = mk(); const [A, D] = g.players; D.base = null; const u = put(g, A, 'GD04-032'); g.pair(u, C('GD04-088')); const bl = put(g, D, 'GD01-086'); bl.tAP = 5; D.ai.chooseBlock = () => bl; D.ai.actionStep = () => {}; A.ai.actionStep = () => {};
  g.attack(u, 'player'); ok(bl.rested); eq(u.dmg, 0);
});
T('GD05-109 Felsi\'s Plea: heals 2 and draws when the Academy unit has a Lv<=3 pilot', () => {
  const g = mk(); const [A, D] = g.players; const u = put(g, D, 'GD01-076'); g.pair(u, C('GD05-086')); u.dmg = 2; const h = D.hand.length; const b = { attacker: put(g, A, 'GD05-027'), target: 'player' };
  ok(EFX['GD05-109'].defAction.value(g, D, b) > 1.12, 'worth casting as a cantrip'); EFX['GD05-109'].defAction.run(g, D, b); eq(u.dmg, 0); eq(D.hand.length, h + 1);
});
T('GD06-023 Galluss J: pumping a Neo Zeon Link Unit sets it back to active', () => {
  const g = mk(); const A = g.players[0]; const nz = Object.keys(CARDS).map(id => CARDS[id]).find(c => c.type === 'UNIT' && c.traits.includes('Neo Zeon') && c.lv >= 3 && c.links.length && !EFX[c.id].deploy && !EFX[c.id].whenLinked && !EFX[c.id].whenPaired);
  const u = put(g, A, nz.id); const pl = Object.keys(CARDS).map(id => CARDS[id]).find(c => c.type === 'PILOT' && g.isLinkPilot(nz, c) && !(EFX[c.id] || {}).p_whenPaired && !(EFX[c.id] || {}).p_whenLinked); g.pair(u, pl); ok(u.linked);
  const ap = g.ap(u); const gj = g.deployUnit(A, C('GD06-023')); eq(g.ap(u), ap + 1); ok(!gj.rested, 'active again');
  const g2 = mk(); const gj2 = g2.deployUnit(g2.players[0], C('GD06-023')); ok(gj2.rested, 'stays rested with no Link target');
});

console.log(`tests_green: ${pass} passed, ${fail} failed`); if (fails.length) console.log(fails.join('\n'));
process.exitCode = fail ? 1 : 0;
