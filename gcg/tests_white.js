'use strict';
// Focused tests for effects_white.js: node tests_white.js
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
const cmdPilot = (g, p, id) => p.ai.pilotObj(C(id), true);

T('every White card in the pool is registered', () => { const miss = Object.keys(CARDS).filter(id => !id.startsWith('T-') && CARDS[id].color === 'White' && ['UNIT', 'PILOT', 'COMMAND', 'BASE'].includes(CARDS[id].type) && !EFX[id]); eq(miss.length, 0, 'missing ' + miss.join(',')); });
T('every effects_white entry has a fidelity and simplified ones a note', () => {
  const src = require('fs').readFileSync(__dirname + '/effects_white.js', 'utf8'); const ids = [...src.matchAll(/F\('([A-Z0-9]+-\d+)', '(full|simplified)'/g)];
  ok(ids.length >= 127, 'entries ' + ids.length); for (const [, id, f] of ids) { eq(EFX[id].fidelity, f, id); if (f === 'simplified') ok(EFX[id].note, id + ' note'); }
});

T('EB01-042 Psycho Haro: its attack cannot be blocked by Lv<=7 Blockers; rested Haro gives friendly Units <Blocker>', () => {
  const g = mk(); const [A, D] = g.players; A.ai.actionStep = () => {}; D.ai.actionStep = () => {}; D.base = null;
  const h = put(g, A, 'EB01-042'); const blk = put(g, D, 'GD03-072'); // Aile Strike: Blocker 3/4, Lv4
  const fr = put(g, A, 'GD05-027'); ok(!g.kw(fr, 'Blocker'), 'no Blocker while Haro active');
  const sh = D.shields.length; g.attack(h, 'player'); eq(D.shields.length, sh - 1, 'not blocked'); ok(!blk.rested, 'Lv4 Blocker did not block');
  ok(g.kw(fr, 'Blocker') > 0 && g.kw(h, 'Blocker') > 0, 'friendly Units and Haro gain Blocker while it is rested');
  ok(!Object.prototype.hasOwnProperty.call(D.ai, 'chooseBlock') || D.ai.chooseBlock !== undefined, 'block chooser restored');
  const a2 = put(g, A, 'GD05-027'); g.attack(a2, 'player'); ok(blk.rested, 'a later attacker can be blocked normally');
});
T('GD02-069 Zeta Gundam: may attack the player; re-ready rests the Base (or G-Defenser) and then forbids attacking the player', () => {
  const g = mk(); const A = g.players[0]; const z = put(g, A, 'GD02-069'); ok(g.canAttackPlayer(z), 'can attack the player normally');
  g.pair(z, C('GD02-097')); ok(z.linked); z.rested = true; const e = EFX['GD02-069'].activate; ok(e.can(g, A, z));
  e.run(g, A, z); ok(!z.rested, 'set active'); ok(A.base.rested, 'base rested'); ok(!g.canAttackPlayer(z), 'cannot choose the player this turn'); ok(g.canAttackThisTurn(z), 'may still attack Units');
  const g2 = mk(); const A2 = g2.players[0]; g2.deployBase(A2, C('ST01-016')); const z2 = put(g2, A2, 'GD02-069'); g2.pair(z2, C('GD02-097')); const gd = put(g2, A2, 'GD03-079', { sick: true }); z2.rested = true;
  EFX['GD02-069'].activate.run(g2, A2, z2); ok(gd.rested && !A2.base.rested, 'G-Defenser rested instead of a Base that still has its rest ability'); ok(!z2.rested);
  const g3 = mk(); const A3 = g3.players[0]; const z3 = put(g3, A3, 'GD02-069'); g3.pair(z3, C('GD02-097')); const gd3 = put(g3, A3, 'GD03-079', { sick: true }); z3.rested = true;
  EFX['GD02-069'].activate.run(g3, A3, z3); ok(!gd3.rested && A3.base.rested, 'EX Base (no rest ability) is rested');
});
T('GD03-070 Freedom Gundam: while rested, Shields take no battle damage (Base still does)', () => {
  const g = mk(); const [A, D] = g.players; g.turnPlayer = A; quiet(A); quiet(D); D.base = null; const f = put(g, D, 'GD03-070', { rested: true });
  const a = put(g, A, 'GD04-032'); const sh = D.shields.length; g.attack(a, 'player'); eq(D.shields.length, sh, 'shield kept');
  f.rested = false; const a2 = put(g, A, 'GD04-032'); g.attack(a2, 'player'); eq(D.shields.length, sh - 1, 'active Freedom: normal');
  const g2 = mk(); const [A2, D2] = g2.players; quiet(A2); quiet(D2); put(g2, D2, 'GD03-070', { rested: true }); const b0 = D2.base.dmg; const a3 = put(g2, A2, 'GD05-027'); g2.attack(a3, 'player'); eq(D2.base.dmg, b0 + 2, 'Base takes damage');
});
T('GD02-073 Carta\'s Graze Ritter: on the opponent\'s turn the attacker fighting it deals damage first', () => {
  const g = mk(); const [A, D] = g.players; g.turnPlayer = A; quiet(A); quiet(D); const c = put(g, D, 'GD02-073', { rested: true }); // 5/4
  const a = put(g, A, 'GD04-032'); a.tAP = 1; // 5/5 attacker -> kills Carta first
  g.attack(a, c); ok(!g.alive(c)); eq(a.dmg, 0, 'Carta dealt no damage');
  const g2 = mk(); const [A2, D2] = g2.players; g2.turnPlayer = D2; quiet(A2); quiet(D2); const c2 = put(g2, D2, 'GD02-073'); const t2 = put(g2, A2, 'GD04-032', { rested: true }); t2.tAP = 1;
  g2.attack(c2, t2); ok(!g2.alive(c2)); eq(t2.dmg, 5, 'own turn: simultaneous damage');
});
T('GD03-076 Freedom (METEOR): a TSA Unit\'s battle damage returns the surviving enemy Unit (once per turn)', () => {
  const g = mk(); const [A, D] = g.players; quiet(A); quiet(D); put(g, A, 'GD03-076'); const m1 = put(g, A, 'GD01-081'); // M1 Astray 2/2 TSA
  const t = put(g, D, 'GD04-032', { rested: true }); g.attack(m1, t); ok(!g.alive(t), 'returned'); ok(D.hand.some(x => x.id === 'GD04-032'), 'in hand');
  const m2 = put(g, A, 'GD01-081'); const t2 = put(g, D, 'GD04-032', { rested: true }); g.attack(m2, t2); ok(g.alive(t2), 'once per turn');
});
T('GD06-097 Harry Ord: a Unit that blocks is set active again (once per turn)', () => {
  const g = mk(); const [A, D] = g.players; g.turnPlayer = A; A.ai.actionStep = () => {}; D.ai.actionStep = () => {};
  const blk = put(g, D, 'GD03-072'); g.pair(blk, C('GD06-097')); blk.tHP = 10; D.ai.chooseBlock = () => blk;
  const a = put(g, A, 'GD05-027'); g.attack(a, 'player'); ok(!blk.rested, 'active after blocking'); const a2 = put(g, A, 'GD05-027'); g.attack(a2, 'player'); ok(blk.rested, 'second block stays rested');
});
T('GD04-098 Riddhe Marcenas: linked Unit takes 2 less enemy effect damage', () => {
  const g = mk(); const [A, D] = g.players; const u = put(g, D, 'GD04-065'); g.pair(u, C('GD04-098')); ok(u.linked); g.effectDamage(A, u, 3); eq(u.dmg, 1);
  const v = put(g, D, 'GD05-027'); g.pair(v, C('GD04-098')); ok(!v.linked); g.effectDamage(A, v, 3); eq(v.dmg, 3, 'unlinked: full damage');
});
T('GD06-098 Duo Maxwell: rested linked Unit protects the Base from enemy Units of Lv <= its Lv (battle and Breach)', () => {
  const g = mk(); const [A, D] = g.players; g.turnPlayer = A; quiet(A); quiet(D); const w = put(g, D, 'GD06-072', { rested: true }); g.pair(w, C('GD06-098')); ok(w.linked, 'Duo links Deathscythe Hell');
  const b0 = D.base.dmg; const lo = put(g, A, 'GD05-027'); g.attack(lo, 'player'); eq(D.base.dmg, b0, 'Lv2 attacker: no base damage');
  const hi = put(g, A, 'GD04-032'); hi.def = Object.assign({}, hi.def, { lv: 6 }); g.attack(hi, 'player'); ok(D.base === null || D.base.dmg > b0, 'Lv6 attacker damages the base');
  const g2 = mk(); const [A2, D2] = g2.players; g2.turnPlayer = A2; quiet(A2); quiet(D2); const w2 = put(g2, D2, 'GD06-072', { rested: true }); g2.pair(w2, C('GD06-098'));
  const br = put(g2, A2, 'GD01-030'); const v = put(g2, D2, 'GD05-027', { rested: true }); const bb = D2.base.dmg; g2.attack(br, v); ok(!g2.alive(v)); eq(D2.base.dmg, bb, 'Breach 2 of a Lv3 Unit prevented');
});
T('EB01-084 30cm Cannon: sets a rested Blocker active and it cannot attack this turn', () => {
  const g = mk(); const A = g.players[0]; const b = put(g, A, 'GD03-072', { rested: true }); A.hand.push(C('EB01-084'));
  ok(EFX['EB01-084'].canMain(g, A)); A.ai.castCommand(g, A, C('EB01-084'), 'main'); ok(!b.rested); ok(!g.canAttackThisTurn(b), 'cannot attack'); g.turn++; ok(g.canAttackThisTurn(b), 'flag expires');
});
T('GD05-122 Graviton Hammer: rests a Lv<=4 enemy and pairs itself from the trash with an MF Unit; Bolt Gundam re-activates its Main without pairing', () => {
  const g = mk(); const [A, D] = g.players; const bolt = put(g, A, 'GD05-076'); const e = put(g, D, 'GD05-027'); A.hand.push(C('GD05-122'));
  A.ai.castCommand(g, A, C('GD05-122'), 'main'); ok(e.rested, 'enemy rested'); ok(bolt.pilot && bolt.pilot.id === 'GD05-122' && bolt.linked, 'paired + linked (Argo Gulskii)');
  eq(A.trash.filter(x => x.id === 'GD05-122').length, 0); ok(!Object.prototype.hasOwnProperty.call(A.trash, 'push'), 'trash push restored');
  const e2 = put(g, D, 'GD01-030'); quiet(D); g.attack(bolt, 'player'); ok(e2.rested, 'Bolt attack activated the Main'); eq(A.units.filter(u => u.pilot && u.pilot.id === 'GD05-122').length, 1, 'no extra pairing');
});
T('GD03-069 Graham\'s Flag Custom + GD03-098 Graham Aker: set active at end of the pairing turn, which returns an enemy with <=3 HP', () => {
  const g = mk(); const [A, D] = g.players; const f = put(g, A, 'GD03-069'); g.pair(f, C('GD03-098')); ok(f.linked); f.rested = true; const e = put(g, D, 'GD05-027');
  g.endPhase(A); ok(!f.rested, 'set active'); ok(!g.alive(e) && D.hand.some(x => x.id === 'GD05-027'), 'Graham bounced');
});
T('GD06-073 Wing Zero (EW) + GD05-098 Heero Yuy: destroying a Shield rests a Lv<=3 enemy and gives AP-2', () => {
  const g = mk(); const [A, D] = g.players; quiet(A); quiet(D); D.base = null; const w = put(g, A, 'GD06-073'); g.pair(w, C('GD05-098')); const e = put(g, D, 'GD01-030'); const ap = g.ap(e);
  g.attack(w, 'player'); ok(e.rested, 'Wing Zero rested it'); eq(g.ap(e), ap - 2, 'Heero AP-2');
});
T('GD03-073 Graze Ein: linked, 6+ Gjallarhorn in trash -> Activate･Action AP-3 on its attacker in the action step', () => {
  const g = mk(); const [A, D] = g.players; g.turnPlayer = A; A.ai.actionStep = () => {}; const ge = put(g, D, 'GD03-073'); g.pair(ge, cmdPilot(g, D, 'GD02-118')); ok(ge.linked, 'Ein Dalton command pilot links');
  for (let k = 0; k < 6; k++) D.trash.push(C('GD02-082')); D.ai.chooseBlock = () => ge; D.hand = []; D.base = null;
  const a = put(g, A, 'GD04-032'); a.tAP = 1; // 5/5 vs 7/4 Graze Ein: both die without the ability, AP-3 saves Graze Ein
  g.attack(a, 'player'); ok(g.alive(ge), 'survives thanks to AP-3'); ok(!g.alive(a), 'attacker destroyed');
});
T('EB01-070 Daryl Lorenz: on the opponent\'s turn pays 1 for AP+1 that lets the defender win', () => {
  const g = mk(); const [A, D] = g.players; g.turnPlayer = A; quiet(A); D.ai.chooseBlock = () => null; D.hand = [];
  const pz = put(g, D, 'EB01-059', { rested: true }); g.pair(pz, C('EB01-070')); ok(pz.linked); // 6/5
  const a = put(g, A, 'GD04-032'); a.tAP = 1; a.tHP = 2; // 5/7: dies only to 7 AP
  const av = g.avail(D); g.attack(a, pz); ok(!g.alive(a), 'AP+1 killed it'); eq(g.avail(D), av - 1, 'paid 1');
});
T('GD01-097 Guel Jeturk: pilot Activate･Main offered by the AI only when the opponent holds 8+ cards', () => {
  const g = mk(); const [A, D] = g.players; const u = put(g, A, 'GD03-072', { rested: true }); g.pair(u, C('GD01-097'));
  ok(!A.ai.candidates(g, A, 'post').some(x => x.kind === 'pact'), 'not offered'); while (D.hand.length < 8) D.hand.push(C('GD05-027'));
  const c = A.ai.candidates(g, A, 'post').find(x => x.kind === 'pact'); ok(c, 'offered'); A.ai.exec(g, A, c); ok(!u.rested); ok(!g.canAttackThisTurn(u));
  ok(!A.ai.candidates(g, A, 'post').some(x => x.kind === 'pact'), 'once per turn');
});
T('GD04-099 Ali al-Saachez: linked attack returns an enemy Pilot to hand; a Unit left at 0 HP is destroyed', () => {
  const g = mk(); const [A, D] = g.players; quiet(A); quiet(D); const u = put(g, A, 'GD04-070'); g.pair(u, C('GD04-099')); ok(u.linked);
  const e = put(g, D, 'GD05-027'); g.pair(e, C('GD04-098')); e.dmg = 2; const h = D.hand.length; g.attack(u, 'player');
  ok(D.hand.some(x => x.id === 'GD04-098') && D.hand.length === h + 1, 'pilot in hand'); ok(!g.alive(e), '2/2 Unit with 2 damage destroyed');
});
T('GD04-070 AEU Enact Custom: Deploy pairs Ali al-Saachez from hand for free', () => {
  const g = mk(); const A = g.players[0]; A.hand.push(C('GD04-099')); const av = g.avail(A); const u = g.deployUnit(A, C('GD04-070')); ok(u.pilot && u.pilot.id === 'GD04-099' && u.linked); eq(g.avail(A), av);
});
T('GD03-081 AEU Enact Demonstration Color: attacks only on a turn a (Superpower Bloc)/(UN) Unit was deployed', () => {
  const g = mk(); const A = g.players[0]; const u = put(g, A, 'GD03-081'); g.turn = 3; ok(!g.canAttackThisTurn(u)); g.deployUnit(A, C('GD03-082')); ok(g.canAttackThisTurn(u)); g.turn = 5; ok(!g.canAttackThisTurn(u));
});
T('Turn A: paying for GD04-073 ∀ triggers Sochie Heim (AP+cost); Eagail AP-5 needs ③ paid this turn', () => {
  const g = mk(); const [A, D] = g.players; const t = put(g, A, 'GD04-073'); const s = put(g, A, 'GD04-074'); g.pair(s, C('GD04-100')); const ap = g.ap(s);
  const act = A.ai.candidates(g, A, 'pre').find(x => x.kind === 'act' && x.u === t); A.ai.exec(g, A, act); eq(g.ap(t), 5, '∀ AP+2'); eq(g.ap(s), ap + 1, 'Sochie AP+1');
  quiet(A); quiet(D); const eg = put(g, A, 'GD06-070'); const e = put(g, D, 'GD04-032', { rested: true }); e.tHP = 1; const ap0 = g.ap(e);
  g.attack(eg, e); ok(g.alive(e) && e.dmg === 5, 'only 1 paid: no AP-5'); ok(ap0 === 4);
  const g2 = mk(); const [A2, D2] = g2.players; quiet(A2); quiet(D2); A2.flags.wPaidT = g2.turn; A2.flags.wPaidN = 3; const eg2 = put(g2, A2, 'GD06-070'); const e2 = put(g2, D2, 'GD04-032', { rested: true });
  g2.attack(eg2, e2); eq(eg2.dmg, 0, 'AP-5 during this battle'); ok(!g2.alive(e2));
});
T('GD02-118 Heart Set on Revenge: defender returns a <=4 HP attacker battling a friendly Blocker', () => {
  const g = mk(); const [A, D] = g.players; g.turnPlayer = A; A.ai.actionStep = () => {}; D.base = null; const blk = put(g, D, 'GD03-072'); D.ai.chooseBlock = () => blk;
  D.hand = [C('GD02-118')]; D.resRested = 0; const a = put(g, A, 'GD01-030'); g.attack(a, 'player'); ok(!g.alive(a) && A.hand.some(x => x.id === 'GD01-030'), 'attacker returned'); ok(D.trash.some(x => x.id === 'GD02-118'));
});
T('EB01-057 Geminass 02: rests a spare Lv3 friendly to return an enemy Lv<=2 Unit', () => {
  const g = mk(); const [A, D] = g.players; const l3 = put(g, A, 'GD01-030', { sick: true }); const e = put(g, D, 'GD04-032'); e.def = Object.assign({}, e.def, { lv: 2 }); g.pair(e, C('GD04-098'));
  g.deployUnit(A, C('EB01-057')); ok(l3.rested, 'Lv3 rested'); ok(!g.alive(e), 'enemy returned');
});
T('GD05-130 Presidential Office: when destroyed, exiles itself to deploy another Presidential Office from hand', () => {
  const g = mk(); const A = g.players[0]; g.deployBase(A, C('GD05-130')); A.hand.push(C('GD05-130')); const sh = A.shields.length; g.destroyBase(A);
  ok(A.base && A.base.def.id === 'GD05-130', 'new base'); ok(A.exile.some(x => x.id === 'GD05-130')); eq(A.shields.length, sh - 1, 'new base Deploy took a shield');
});
T('GD06-119 Sturm und Drang: defender rests an active <=3 HP enemy and pairs it from trash with an MF Unit', () => {
  const g = mk(); const [A, D] = g.players; g.turnPlayer = A; A.ai.actionStep = () => {}; D.ai.chooseBlock = () => null; D.base = null;
  const mf = put(g, D, 'GD06-066'); const e = put(g, A, 'GD05-027'); D.hand = [C('GD06-119')]; D.resRested = 0; const a = put(g, A, 'GD01-030');
  g.attack(a, 'player'); ok(e.rested, 'enemy rested on its own turn'); ok(mf.pilot && mf.pilot.id === 'GD06-119', 'paired from trash'); eq(D.trash.filter(x => x.id === 'GD06-119').length, 0);
});

T('GD04-071 GN Flag: exiles a (Superpower Bloc) card and a different (UN) card (two copies of one card count as two) to re-ready, cannot attack', () => {
  const g = mk(); const A = g.players[0]; const u = put(g, A, 'GD04-071', { rested: true }); A.trash.push(C('GD03-098'));
  ok(!EFX['GD04-071'].activate.can(g, A, u), 'one SB+UN card is not enough'); A.trash.push(C('GD03-098')); ok(EFX['GD04-071'].activate.can(g, A, u));
  EFX['GD04-071'].activate.run(g, A, u); ok(!u.rested); eq(A.exile.length, 2); ok(!g.canAttackThisTurn(u));
});

// ======================= pre-existing fixes =======================
T('fix 1: canAttackPlayer text check blocks only a card\'s own static "This Unit can\'t choose the enemy player" clause', () => {
  const g = mk(); const A = g.players[0];
  for (const id of ['GD04-007', 'GD04-011', 'GD05-057', 'GD02-069', 'GD04-065']) ok(g.canAttackPlayer(put(g, A, id)), id + ' may attack the player');
  const g2 = mk(); const A2 = g2.players[0];
  for (const id of ['GD04-016', 'GD02-018', 'ST01-009', 'GD05-075']) ok(!g2.canAttackPlayer(put(g2, A2, id)), id + ' may not');
  ok(!g2.canAttackPlayer(g2.deployToken(A2, 'Parts')), 'Parts token may not');
});
T('fix 2: GD05-120 Shining Finger is Main/Action: the defender rests an active <=4 HP enemy during the opponent\'s attack', () => {
  ok(EFX['GD05-120'].actionToo && EFX['GD05-120'].defAction, 'Action timing');
  const g = mk(); const [A, D] = g.players; g.turnPlayer = A; A.ai.actionStep = () => {}; D.ai.chooseBlock = () => null; D.base = null;
  const e = put(g, A, 'GD03-072'); put(g, D, 'GD04-032', { rested: true }); D.hand = [C('GD05-120')]; D.resRested = 0; const a = put(g, A, 'GD01-030');
  g.attack(a, 'player'); ok(e.rested, 'enemy Blocker rested on its own turn'); ok(D.trash.some(x => x.id === 'GD05-120'));
});
T('fix 3: GD02-129 Argama ignores enemy <Breach> (effect damage) but still takes battle damage', () => {
  const g = mk(); const [A, D] = g.players; quiet(A); quiet(D); g.deployBase(D, C('GD02-129')); const br = put(g, A, 'GD01-030'); const v = put(g, D, 'GD05-027', { rested: true });
  g.attack(br, v); ok(!g.alive(v)); eq(D.base.dmg, 0, 'Breach 2 prevented'); const a2 = put(g, A, 'GD05-027'); g.attack(a2, 'player'); eq(D.base.dmg, 2, 'battle damage dealt');
});
T('fix 4: Action AP-down Commands respect condition, filter and duration (GD02-119, GD01-119, ST14-014)', () => {
  const g = mk(); const [A, D] = g.players; g.turnPlayer = A; const e = EFX['GD02-119']; const a = put(g, A, 'GD04-032'); const b = { attacker: a, target: 'player' };
  ok(e.action && e.apDownOk && !e.apDownOk(g, D, a, b), 'needs a (Gjallarhorn) Link Unit'); const gl = put(g, D, 'GD03-073'); g.pair(gl, cmdPilot(g, D, 'GD02-118')); ok(gl.linked && e.apDownOk(g, D, a, b));
  g.inBattle = b; e.action(g, D, b); eq(a.bAP, -3, 'AP-3 during this battle'); g.endBattle(b); eq(g.ap(a), 4, 'gone after the battle');
  const lo = put(g, A, 'GD05-027'); const i = EFX['GD01-119']; ok(i.apDownOk(g, D, lo, null) && !i.apDownOk(g, D, a, null), 'Lv<=4 filter');
  g.inBattle = { attacker: a, target: 'player' }; i.action(g, D, g.inBattle); eq(a.tAP, 0, 'Lv5 attacker not hit'); eq(lo.tAP, -2, 'a Lv<=4 enemy chosen instead'); g.inBattle = null;
  const big = put(g, A, 'GD04-032'); big.def = Object.assign({}, big.def, { lv: 6 }); ok(!EFX['ST14-014'].apDownOk(g, D, big, null)); for (let k = 0; k < 4; k++) D.trash.push(C('GD01-118')); ok(EFX['ST14-014'].apDownOk(g, D, big, null), '4+ Commands: any enemy');
  const g2 = mk(); const [A2, D2] = g2.players; g2.turnPlayer = A2; A2.ai.actionStep = () => {}; D2.ai.chooseBlock = () => null; const tg = put(g2, D2, 'GD01-030', { rested: true });
  const hi = put(g2, A2, 'GD04-032'); D2.hand = [C('GD01-119')]; D2.resRested = 0; g2.attack(hi, tg); ok(D2.hand.some(x => x.id === 'GD01-119'), 'not cast on a Lv5 attacker'); ok(!g2.alive(tg));
});
T('fix 5: AI uses the Action of GD01-120 Naval Bombardment (Blocker AP+3) and GD06-120 Hoping for Peace (rest an active enemy)', () => {
  const g = mk(); const [A, D] = g.players; g.turnPlayer = A; A.ai.actionStep = () => {}; D.base = null; const blk = put(g, D, 'GD03-072'); D.ai.chooseBlock = () => blk;
  D.hand = [C('GD01-120')]; D.resRested = 0; const a = put(g, A, 'GD04-032'); g.attack(a, 'player'); ok(!g.alive(a), 'blocker with AP+3 destroyed the attacker'); ok(D.trash.some(x => x.id === 'GD01-120'));
  const g2 = mk(); const [A2, D2] = g2.players; g2.turnPlayer = A2; A2.ai.actionStep = () => {}; D2.ai.chooseBlock = () => null; D2.base = null;
  const en = put(g2, A2, 'GD03-072'); put(g2, D2, 'GD04-032', { rested: true }); D2.hand = [C('GD06-120')]; D2.resRested = 0; const a2 = put(g2, A2, 'GD01-030');
  g2.attack(a2, 'player'); ok(en.rested, 'active enemy rested'); ok(D2.trash.some(x => x.id === 'GD06-120'));
});
T('fix 6: GD05-069 Gundam Maxter running its paired Command\'s Main fires onCommand (Special Move)', () => {
  const g = mk(); const [A, D] = g.players; quiet(A); quiet(D); const sm = put(g, A, 'GD05-068'); const mx = put(g, A, 'GD05-069'); g.pair(mx, cmdPilot(g, A, 'GD05-121')); ok(mx.linked);
  put(g, D, 'GD05-027'); ok(!g.kw(sm, 'Suppression')); g.attack(mx, 'player'); ok(g.kw(sm, 'Suppression') > 0, 'Super Mode saw the Special Move'); ok(A.specialMoveThisTurn);
});
T('effects.js no longer registers the stale GD05-129 / GD05-049 entries (effects_purple.js owns them)', () => {
  const src = require('fs').readFileSync(__dirname + '/effects.js', 'utf8'); ok(!/F\('GD05-129'/.test(src) && !/F\('GD05-049'/.test(src)); ok(EFX['GD05-129'] && EFX['GD05-049']);
});

console.log(`tests_white: ${pass} passed, ${fail} failed`); if (fails.length) console.log(fails.join('\n'));
process.exitCode = fail ? 1 : 0;
