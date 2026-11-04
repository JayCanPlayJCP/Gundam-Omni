'use strict';
// Focused tests for effects_blue.js: node tests_blue.js
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

T('every Blue card in the pool is registered', () => { const miss = Object.keys(CARDS).filter(id => !id.startsWith('T-') && CARDS[id].color === 'Blue' && ['UNIT', 'PILOT', 'COMMAND', 'BASE'].includes(CARDS[id].type) && !EFX[id]); eq(miss.length, 0, 'missing ' + miss.join(',')); });

T('EB01-002 Hi-Nu (EX): linked attack with 3 other rested Units sets it active, once per turn', () => {
  const g = mk(); const [A, D] = g.players; quiet(D); const h = put(g, A, 'EB01-002'); g.pair(h, C('EB01-061')); ok(h.linked, 'G Generation pilot links');
  for (let k = 0; k < 3; k++) put(g, D, 'GD05-027', { rested: true });
  g.attack(h, 'player'); ok(!h.rested, 're-readied'); g.attack(h, 'player'); ok(h.rested, 'second attack: once per turn');
});
T('EB01-003 Narrative A-Packs: rested at end of turn rests every Unit and draws when 3+ were rested', () => {
  const g = mk(); const [A, D] = g.players; const n = put(g, A, 'EB01-003', { rested: true }); const a = put(g, A, 'GD05-027'); const e1 = put(g, D, 'GD05-027'); const e2 = put(g, D, 'GD05-027');
  const h0 = A.hand.length; g.endPhase(A); ok(a.rested && e1.rested && e2.rested, 'all rested'); eq(A.hand.length, h0 + 1, 'drew 1');
  const g2 = mk(); const A2 = g2.players[0]; put(g2, A2, 'EB01-003', { rested: true }); const x = put(g2, A2, 'GD05-027'); const h2 = A2.hand.length; g2.endPhase(A2); ok(x.rested); eq(A2.hand.length, h2, 'only 1 rested: no draw');
});
T('EB01-004 Lupus Rex: end-of-turn <Repair> recovery pings a rested enemy (not when undamaged)', () => {
  const g = mk(); const [A, D] = g.players; const u = put(g, A, 'EB01-004'); u.dmg = 2; const e = put(g, D, 'GD01-018', { rested: true });
  g.endPhase(A); eq(u.dmg, 0, 'repaired'); eq(e.dmg, 1, 'pinged');
  const g2 = mk(); const [A2, D2] = g2.players; put(g2, A2, 'EB01-004'); const e2 = put(g2, D2, 'GD01-018', { rested: true }); g2.endPhase(A2); eq(e2.dmg, 0, 'no recovery, no ping');
});
T('GD01-002 Destroy Mode: free with a Lv.5 Unicorn Mode Link Unit, which is destroyed and returns Banagher', () => {
  const g = mk(); const A = g.players[0]; const dm = C('GD01-002'); eq(g.costOf(A, dm), 6); const um = put(g, A, 'GD01-005'); g.pair(um, C('GD01-088')); ok(um.linked);
  eq(g.costOf(A, dm), 0); eq(g.effLv(A, dm), 0); const h0 = A.hand.length;
  g.deployUnit(A, dm); ok(!g.alive(um), 'Unicorn Mode destroyed'); ok(A.hand.some(c => c.id === 'GD01-088'), 'Banagher back to hand'); eq(A.hand.length, h0, '+Banagher -1 discard');
  ok(A.trash.some(c => c.id === 'GD01-005'));
});
T('GD01-003 Banshee: linked attack shuffles 12 trash cards into the deck, re-readies with First Strike', () => {
  const g = mk(); const [A, D] = g.players; quiet(D); const b = put(g, A, 'GD01-003'); g.pair(b, C('GD01-093')); ok(b.linked);
  for (let k = 0; k < 14; k++) A.trash.push(C('ST01-005')); const d0 = A.deck.length; const e = put(g, D, 'GD01-018', { rested: true });
  g.attack(b, e); eq(A.trash.length, 2 + (g.alive(e) ? 0 : 0), 'trash 14 -> 2'); eq(A.deck.length, d0 + 12); ok(!b.rested, 'active'); ok(g.kw(b, 'First Strike'), 'First Strike');
  ok(!g.alive(e) && b.dmg === 0, 'first strike kill took no damage');
});
T('GD02-001 + GD02-085: Titans shield break heals Psycho Gundam 2 and Four Murasame draws (hand <= 4)', () => {
  const g = mk(); const [A, D] = g.players; quiet(D); D.base = null; const psy = put(g, A, 'GD02-001'); g.pair(psy, C('GD02-085')); ok(psy.linked); psy.dmg = 3;
  A.hand.splice(0, A.hand.length - 3); const s0 = D.shields.length; g.attack(psy, 'player'); eq(D.shields.length, s0 - 1);
  const h0 = A.hand.length; const z = put(g, A, 'GD05-007'); g.attack(z, 'player'); // next declaration resolves the pending recovery (Asshimar is Titans)
  eq(psy.dmg, 1, 'recovered 2'); eq(A.hand.length, h0 + 1, 'Four Murasame drew');
});
T('GD02-002 Epyon: an ally battle kill on your turn re-readies linked Epyon once', () => {
  const g = mk(); const [A, D] = g.players; quiet(D); const ep = put(g, A, 'GD02-002', { rested: true }); g.pair(ep, C('ST02-011')); ok(ep.linked);
  const a = put(g, A, 'GD01-018'); const e = put(g, D, 'GD05-027', { rested: true }); g.attack(a, e); ok(!g.alive(e)); ok(!ep.rested, 'set active');
  ep.rested = true; const a2 = put(g, A, 'GD01-018'); const e2 = put(g, D, 'GD05-027', { rested: true }); g.attack(a2, e2); ok(ep.rested, 'once per turn');
});
T('GD02-010 Raider: AI preview does not draw; real enemy effect damage draws once per turn', () => {
  const g = mk(); const [A, D] = g.players; const r = put(g, A, 'GD02-010'); const h0 = A.hand.length;
  D.ai.effPreview(g, D, r, 2); EFX['GD02-010'].onOppStart(g, r, D); eq(A.hand.length, h0, 'preview: no draw');
  g.effectDamage(D, r, 1); EFX['GD02-010'].endTurn(g, r); eq(A.hand.length, h0 + 1, 'drew'); g.effectDamage(D, r, 1); EFX['GD02-010'].endTurn(g, r); eq(A.hand.length, h0 + 1, 'once per turn');
  g.turn++; g.effectDamage(A, r, 1); EFX['GD02-010'].endTurn(g, r); eq(A.hand.length, h0 + 1, 'own effect damage: no draw');
});
T('GD03-002 The-O (paired): another Unit with <Repair> attacking rests an enemy Unit of equal or lower Lv', () => {
  const g = mk(); const [A, D] = g.players; quiet(D); const o = put(g, A, 'GD03-002'); g.pair(o, C('GD03-084')); const n = put(g, A, 'EB01-003'); // Lv5 Repair 2
  const big = put(g, D, 'EB01-002'); const e = put(g, D, 'GD01-018'); g.attack(n, 'player'); ok(e.rested, 'Lv3 enemy rested'); ok(!big.rested, 'Lv8 enemy untouched');
});
T('League Militaire tokens: Core Fighter rested -> Blocker, Marbet +1 AP, Odelo reduces effect damage', () => {
  const g = mk(); const [A, D] = g.players; const cf = put(g, A, 'GD04-013'); const t = g.deployToken(A, 'Parts'); ok(!g.kw(t, 'Blocker')); cf.rested = true; ok(g.kw(t, 'Blocker'), 'Blocker while CF rested');
  eq(g.ap(t), 1); const m = put(g, A, 'ST01-005'); g.pair(m, C('GD04-083')); eq(g.ap(t), 2, 'Marbet aura'); eq(g.ap(m), 3, 'paired GM not a token: only pilot AP');
  g.effectDamage(D, t, 1); ok(!g.alive(t), 'no Odelo: destroyed'); const t2 = g.deployToken(A, 'Parts'); const o = put(g, A, 'GD01-018'); g.pair(o, C('GD05-084')); g.effectDamage(D, t2, 1); ok(g.alive(t2) && t2.dmg === 0, 'Odelo reduced 1 -> 0');
});
T('GD04-015 Gun EZ: rests itself + an enemy Lv<=3; with White Ark the Base is rested instead', () => {
  const g = mk(); const [A, D] = g.players; const e = put(g, D, 'GD01-018'); const gz = g.deployUnit(A, C('GD04-015')); ok(gz.rested, 'own LM rested'); ok(e.rested, 'enemy rested');
  const g2 = mk(); const [A2, D2] = g2.players; g2.deployBase(A2, C('GD05-124')); const e2 = put(g2, D2, 'GD01-018'); const gz2 = g2.deployUnit(A2, C('GD04-015')); ok(!gz2.rested, 'White Ark replaced the rest'); ok(A2.base.rested); ok(e2.rested);
});
T('ST10-001 Zeta (EX): shield kill re-readies; next player attack is redirected or cancelled; blocked -> stays rested', () => {
  const g = mk(); const [A, D] = g.players; quiet(D); D.base = null; const z = put(g, A, 'ST10-001'); const s0 = D.shields.length;
  g.attack(z, 'player'); eq(D.shields.length, s0 - 1); ok(!z.rested, 'active after shield kill');
  const e = put(g, D, 'GD05-027', { rested: true }); g.attack(z, 'player'); ok(!g.alive(e), 'redirected to the rested enemy Unit'); eq(D.shields.length, s0 - 1, 'no 2nd shield');
  const g2 = mk(); const [A2, D2] = g2.players; quiet(D2); D2.base = null; const z2 = put(g2, A2, 'ST10-001'); g2.attack(z2, 'player'); const s1 = D2.shields.length; g2.attack(z2, 'player');
  eq(D2.shields.length, s1, 'cancelled: no damage'); ok(!z2.rested && !g2.canAttackThisTurn(z2), 'stays active but cannot attack');
  const g3 = mk(); const [A3, D3] = g3.players; D3.ai.actionStep = () => {}; D3.base = null; const bl = put(g3, D3, 'GD01-086'); D3.ai.chooseBlock = () => bl; const z3 = put(g3, A3, 'ST10-001'); g3.attack(z3, 'player'); ok(z3.rested, 'blocked: no trigger');
});
T('ST10-014 Unlocking the Development Diagram: Lv/cost 2 by discarding a G Generation Unit, draws 2', () => {
  const g = mk(); const A = g.players[0]; const c = C('ST10-014'); A.hand = [C('GD05-027'), C('GD05-027')]; eq(g.costOf(A, c), 4); eq(g.effLv(A, c), 4);
  A.hand.push(C('EB01-016'), c); eq(g.costOf(A, c), 2); eq(g.effLv(A, c), 2); A.resRested = 0; const av = g.avail(A);
  A.ai.castCommand(g, A, c, 'main'); eq(g.avail(A), av - 2, 'paid 2'); ok(A.trash.some(x => x.id === 'EB01-016'), 'G Generation Unit discarded'); eq(A.hand.length, 4, '2 fillers + 2 drawn');
});
T('GD06-002 Infinite Justice: exile 3 trash Units to bounce an active enemy; heals an Orb Unit after a battle kill', () => {
  const g = mk(); const [A, D] = g.players; quiet(D); const e = put(g, D, 'EB01-002'); for (let k = 0; k < 3; k++) A.trash.push(C('ST01-005')); const hD = D.hand.length;
  const ij = g.deployUnit(A, C('GD06-002')); ok(!g.alive(e), 'bounced'); eq(D.hand.length, hD + 1); eq(A.exile.length, 3); ij.sick = false;
  const m = put(g, A, 'GD05-016'); m.dmg = 3; const r = put(g, D, 'GD05-027', { rested: true }); g.attack(ij, r); ok(!g.alive(r)); eq(m.dmg, 0, 'Murasame (Orb) recovered 3');
});
T('EB01-001 Red Frame Custom: exile 2 Commands -> damaged enemy rested and kept rested through its next start phase', () => {
  const g = mk(); const [A, D] = g.players; const u = put(g, A, 'EB01-001'); const e = put(g, D, 'GD01-018'); const A_ = EFX['EB01-001'].activate; ok(!A_.can(g, A, u), 'needs trash + damaged target');
  A.trash.push(C('GD01-100'), C('GD01-104')); e.dmg = 1; ok(A_.can(g, A, u)); A_.run(g, A, u); ok(e.rested && e.noReady); eq(A.exile.length, 2);
  D.ai.mainPhase = () => {}; g.turnPlayer = D; g.takeTurn(D); ok(e.rested, 'not set active at start phase');
});
T('GD05-006 Hashmal: battle kill deploys a Pluma token (once per turn); Repair = number of Calamity War tokens', () => {
  const g = mk(); const [A, D] = g.players; quiet(D); const h = put(g, A, 'GD05-006'); eq(g.kw(h, 'Repair'), 0);
  const e = put(g, D, 'GD05-027', { rested: true }); g.attack(h, e); eq(A.units.filter(x => x.def.name === 'Pluma').length, 1); eq(g.kw(h, 'Repair'), 1);
  h.rested = false; const e2 = put(g, D, 'GD05-027', { rested: true }); g.attack(h, e2); eq(A.units.filter(x => x.def.name === 'Pluma').length, 1, 'once per turn');
});
T('Repair-conditional pilots: Rondo Gina Breach 1, Io Fleming Repair 2 with 2 rested, Riddhe AP+1, Challia Bull HM', () => {
  const g = mk(); const [A, D] = g.players; const u = put(g, A, 'GD01-018'); g.pair(u, C('EB01-064')); eq(g.kw(u, 'Breach'), 0); u.tKw.Repair = 1; eq(g.kw(u, 'Breach'), 1);
  const v = put(g, A, 'GD01-018'); g.pair(v, C('EB01-063')); eq(g.kw(v, 'Repair'), 0); put(g, D, 'GD05-027', { rested: true }); put(g, A, 'GD05-027', { rested: true }); eq(g.kw(v, 'Repair'), 2);
  const w = put(g, A, 'GD01-018'); g.pair(w, C('GD01-089')); eq(g.ap(w), 5); w.tKw.Repair = 1; eq(g.ap(w), 6);
});
T('GD04-001 Gundam: returns its blue Pilot when it would be destroyed attacking without killing', () => {
  const g = mk(); const [A, D] = g.players; quiet(D); const u = put(g, A, 'GD04-001'); g.pair(u, C('ST01-010')); ok(u.linked);
  const big = put(g, D, 'EB01-002', { rested: true }); const h0 = A.hand.length; g.attack(u, big); ok(A.hand.some(c => c.id === 'ST01-010'), 'Amuro returned'); eq(A.hand.length, h0 + 1); ok(!g.alive(u));
  ok(!A.trash.some(c => c.id === 'ST01-010'), 'pilot not trashed');
});
T('GD02-011 Moebius: sacrifice for 6 damage to the enemy Base when it could attack unblocked', () => {
  const g = mk(); const [A, D] = g.players; const m = put(g, A, 'GD02-011'); g.deployBase(D, C('GD05-124')); const act = EFX['GD02-011'].activate; ok(act.can(g, A, m)); ok(act.score(g, A, m) > 0);
  act.run(g, A, m); ok(!g.alive(m)); eq(D.base, null, 'White Ark (5 HP) destroyed');
  const g2 = mk(); const [A2, D2] = g2.players; const m2 = put(g2, A2, 'GD02-011'); put(g2, D2, 'GD01-086'); ok(!EFX['GD02-011'].activate.can(g2, A2, m2), 'active blocker: not usable');
});
T('GD05-004 Akatsuki (Oowashi): Lv/cost -1 per Orb Unit unless you have a Lv.6+ Unit; link bounces Lv<=4', () => {
  const g = mk(); const [A, D] = g.players; const c = C('GD05-004'); put(g, A, 'GD05-016'); put(g, A, 'GD05-016'); eq(g.costOf(A, c), 4); eq(g.effLv(A, c), 4);
  put(g, A, 'EB01-001'); eq(g.costOf(A, c), 6, 'Lv6 unit in play'); });
T('ST10-013 Tactical Training defends: +2 AP and 2 HP on a G Generation Lv5+ Unit flips the battle', () => {
  const g = mk(); const [A, D] = g.players; const att = put(g, A, 'EB01-004'); att.rested = true; // 3/5 attacker
  const m = put(g, D, 'EB01-003'); m.dmg = 2; m.rested = true; const b = { attacker: att, target: m }; const e = EFX['ST10-013'];
  ok(e.defAction.can(g, D, b)); ok(e.defAction.value(g, D, b) > 1.12, 'worth casting'); eq(m.dmg, 2, 'value() restores state'); const f0 = A.ai.fight(g, att, m, true); ok(f0.killT && !f0.killA, 'before: defender dies'); e.defAction.run(g, D, b); eq(m.dmg, 0); eq(g.ap(m), 6); const f1 = A.ai.fight(g, att, m, true); ok(!f1.killT && f1.killA, 'after: defender survives and kills');
});

console.log(`tests_blue: ${pass} passed, ${fail} failed`); if (fails.length) console.log(fails.join('\n'));
process.exitCode = fail ? 1 : 0;
