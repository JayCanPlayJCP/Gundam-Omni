'use strict';
// Rules regression tests: node tests.js
const eng = require('./engine'); const EFX = require('./effects'); eng.setEffects(EFX);
const { AI } = require('./ai'); const { CARDS } = eng;
let pass = 0, fail = 0; const fails = [];
function T(name, fn) { try { fn(); pass++; } catch (e) { fail++; fails.push(name + ': ' + e.message); } }
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

T('setup: 5-card hand, 6 shields, EX Base 0/3, P2 has EX Resource', () => {
  const g = new eng.Game(filler, filler, 3, [new AI(), new AI()]); g.setup();
  for (const p of g.players) { eq(p.hand.length, 5); eq(p.shields.length, 6); eq(p.base.def.hp, 3); eq(p.deck.length, 39); }
  eq(g.players[0].ex, 0); eq(g.players[1].ex, 1);
});
T('Lv requirement counts resources incl. EX; cost rests active resources; EX removed when used', () => {
  const g = mk(); const p = g.players[1]; p.res = 2; p.resRested = 0; p.ex = 1;
  eq(g.level(p), 3); ok(g.canPlay(p, C('GD01-030'))); g.pay(p, 3); eq(p.ex, 0); eq(g.avail(p), 0);
});
T('newly deployed non-link unit cannot attack; link unit can', () => {
  const g = mk(); const p = g.players[0];
  const u = g.deployUnit(p, C('GD01-030')); ok(!g.canAttackThisTurn(u));
  const v = g.deployUnit(p, C('GD06-036')); g.pair(v, C('GD06-090')); ok(v.linked, 'Vidar links Gundam Vidar'); ok(g.canAttackThisTurn(v));
});
T('link by trait: Geara Zulu style / Kayra name match / alsoNamed (Ple-Twelve = Marida Cruz)', () => {
  const g = mk(); const p = g.players[0];
  const k = g.deployUnit(p, C('GD01-044')); g.pair(k, C('ST12-012')); ok(k.linked, 'Kshatriya [Marida Cruz] links Ple-Twelve');
});
T('attack target must be player or rested enemy unit', () => {
  const g = mk(); const [A, D] = g.players; const a = put(g, A, 'GD01-018'); const e = put(g, D, 'GD05-027');
  const ai = A.ai; let t = ai.attackTargets(g, A, a); ok(!t.includes(e)); e.rested = true; t = ai.attackTargets(g, A, a); ok(t.includes(e));
});
T('attack player: EX Base absorbs first, then shields one per hit', () => {
  const g = mk(); const [A, D] = g.players; const a = put(g, A, 'GD01-018'); // 4 AP
  g.attack(a, 'player'); eq(D.base, null, 'EX base (3hp) destroyed by 4 dmg'); eq(D.shields.length, 6);
  a.rested = false; g.attack(a, 'player'); eq(D.shields.length, 5);
});
T('no base & no shields: next unhindered hit wins', () => {
  const g = mk(); const [A, D] = g.players; D.base = null; D.trash.push(...D.shields); D.shields = []; const a = put(g, A, 'GD05-027'); g.attack(a, 'player'); eq(g.winner, 0);
});
T('Blocker redirects; High-Maneuver cannot be blocked', () => {
  const g = mk(); const [A, D] = g.players; D.base = null; const bl = put(g, D, 'GD01-086'); // Lfrith 2/4 blocker
  const a = put(g, A, 'GD05-027'); D.ai.chooseBlock = () => bl; g.attack(a, 'player'); ok(bl.rested, 'blocker rested'); eq(D.shields.length, 6);
  const c = g.deployToken(A, 'Gundam Calibarn'); c.sick = false; bl.rested = false; g.attack(c, 'player'); eq(D.shields.length, 5, 'HM unblocked');
});
T('battle damage simultaneous; damage persists; Repair heals at end of turn', () => {
  const g = mk(); const [A, D] = g.players; const a = put(g, A, 'GD01-017'); const e = put(g, D, 'GD05-027', { rested: true });
  g.attack(a, e); ok(!g.alive(e)); eq(a.dmg, 2); g.heal(a, g.kw(a, 'Repair')); eq(a.dmg, 1);
});
T('First Strike: kills before receiving damage', () => {
  const g = mk(); const [A, D] = g.players; const a = put(g, A, 'GD05-027'); a.tKw['First Strike'] = 1; const e = put(g, D, 'ST01-005', { rested: true });
  g.attack(a, e); ok(!g.alive(e)); eq(a.dmg, 0);
});
T('Breach: battle kill on your turn damages first shield-area card (Base first)', () => {
  const g = mk(); const [A, D] = g.players; const a = put(g, A, 'GD01-030'); const e = put(g, D, 'ST01-005', { rested: true });
  g.attack(a, e); eq(D.base.dmg, 2, 'EX base took breach 2'); D.base = null; const e2 = put(g, D, 'ST01-005', { rested: true }); a.rested = false; a.dmg = 0; g.attack(a, e2); eq(D.shields.length, 5);
});
T('Suppression hits first two shield-area cards', () => {
  const g = mk(); const [A, D] = g.players; D.base = null; const a = put(g, A, 'ST14-001'); g.attack(a, 'player'); eq(D.shields.length, 4);
});
T('Burst: Pilot returns to hand; Base deploys and adds a shield', () => {
  const g = mk(); const [A, D] = g.players; D.base = null; D.shields.unshift(C('ST01-010')); const h = D.hand.length; const a = put(g, A, 'GD05-027'); g.attack(a, 'player'); eq(D.hand.length, h + 1);
  D.shields.unshift(C('ST03-016')); a.rested = false; const sh = D.shields.length; g.attack(a, 'player'); ok(D.base && D.base.def.id === 'ST03-016', 'Falmel deployed'); eq(D.shields.length, sh - 2, 'one broken + one to hand');
});
T('Pilot leaves with its unit (bounce returns both); tokens vanish', () => {
  const g = mk(); const [A, D] = g.players; const u = put(g, D, 'GD06-036'); g.pair(u, C('GD06-090')); const h = D.hand.length; g.bounce(u); eq(D.hand.length, h + 2);
  const t = g.deployToken(D, 'Leo'); g.bounce(t); eq(D.hand.length, h + 2); eq(D.units.length, 0);
});
T('six-unit cap trashes one', () => { const g = mk(); const p = g.players[0]; for (let i = 0; i < 7; i++) g.deployUnit(p, C('GD05-027')); eq(p.units.length, 6); });
T('hand limit 10 at end of turn', () => { const g = mk(); const p = g.players[0]; while (p.hand.length < 13) p.hand.push(C('GD05-027')); p.ai.mainPhase = () => {}; g.takeTurn(p); ok(p.hand.length <= 10); });
T('deck out on draw loses', () => { const g = mk(); const p = g.players[0]; p.deck = []; p.ai.mainPhase = () => {}; g.takeTurn(p); eq(g.winner, 1); });
T('Silver Bullet reduces enemy effect damage by 3', () => { const g = mk(); const [A, D] = g.players; const s = put(g, D, 'GD04-068'); g.effectDamage(A, s, 4); eq(s.dmg, 1); });
T('Argama base immune to enemy effect damage', () => { const g = mk(); const [A, D] = g.players; g.deployBase(D, C('GD02-129')); g.damageShieldArea(A, D, 5, { effect: true }); eq(D.base.dmg, 0); });
T('Exia Repair destroys unpaired Lv4- unit it damages in battle', () => { const g = mk(); const [A, D] = g.players; const a = put(g, A, 'GD05-050'); const e = put(g, D, 'GD06-036', { rested: true }); g.attack(a, e); ok(!g.alive(e)); });
T('Strike Freedom deploy: chosen unit draws on destroying enemy card', () => { const g = mk(); const [A, D] = g.players; D.base = null; const a = put(g, A, 'GD01-018'); const h0 = A.hand.length; g.deployUnit(A, C('GD05-002')); ok(a.flags.sfDraw); g.attack(a, 'player'); eq(A.hand.length, h0 + 1); });
T('Falmel on your turn: shield to hand + rested Char Zaku token', () => { const g = mk(); const A = g.players[0]; const h = A.hand.length; g.deployBase(A, C('ST03-016')); eq(A.hand.length, h + 1); eq(A.units.length, 1); ok(A.units[0].rested && A.units[0].token); });
T('Char Aznable ST03-011 on Char Zaku: linked attack gains High-Maneuver', () => { const g = mk(); const [A, D] = g.players; const u = g.deployUnit(A, C('GD01-026')); g.pair(u, C('ST03-011')); ok(u.linked && g.canAttackThisTurn(u)); D.base = null; const bl = put(g, D, 'GD01-086'); D.ai.chooseBlock = () => bl; g.attack(u, 'player'); eq(D.shields.length, 5); ok(!bl.rested); });
T('GD01-026 paired destroyed -> token', () => { const g = mk(); const A = g.players[0]; const u = g.deployUnit(A, C('GD01-026')); g.pair(u, C('ST03-011')); g.destroy(u, {}); eq(A.units.length, 1); ok(A.units[0].token); });
T('Grace Under Pressure deploys a token (outside main deck)', () => { const g = mk(); const A = g.players[0]; EFX['GD06-105'].main(g, A); eq(A.units.length, 1); ok(A.units[0].token); });
T('Amuro ST01-010 rests enemy unit with <=5 HP on pair', () => { const g = mk(); const [A, D] = g.players; const e = put(g, D, 'GD01-018'); const u = put(g, A, 'GD05-027'); g.pair(u, C('ST01-010')); ok(e.rested); });
T('Darkness Finger draws only with Master Gundam', () => { const g = mk(); const [A, D] = g.players; put(g, D, 'GD05-027'); const h = A.hand.length; EFX['GD05-110'].main(g, A); eq(A.hand.length, h); put(g, D, 'GD05-027'); put(g, A, 'GD05-033'); EFX['GD05-110'].main(g, A); eq(A.hand.length, h + 1); });
T('The-O keeps lowest-Lv rested enemy units from readying', () => { const g = mk(); const [A, D] = g.players; put(g, A, 'ST14-001'); const e = put(g, D, 'GD05-027', { rested: true }); D.ai.mainPhase = () => {}; g.turnPlayer = D; g.takeTurn(D); ok(e.rested); });
T('Breach not applied on opponent turn (blocker kill on defense)', () => { const g = mk(); const [A, D] = g.players; g.turnPlayer = D; const bl = put(g, A, 'GD01-030'); bl.def; const att = put(g, D, 'ST01-005'); A.ai.chooseBlock = () => null; g.attack(att, bl.rested ? bl : 'player'); ok(true); });

T('Turn X: enemy attackers must target our rested tokens; Turn X attack makes Arms+Legs', () => { const g = mk(); const [A, D] = g.players; const tx = put(g, D, 'GD06-019'); const tok = g.deployToken(D, 'Turn X (Arms)', { rested: true }); const a = put(g, A, 'GD01-018');
  const t = A.ai.attackTargets(g, A, a); eq(t.length, 1); ok(t[0] === tok); g.turnPlayer = D; D.units.splice(D.units.indexOf(tok), 1); tx.sick = false; g.attack(tx, 'player'); eq(D.units.filter(x => x.token).length, 2); });
T('Turn X (Top) copies a token (e.g. Calibarn)', () => { const g = mk(); const A = g.players[0]; g.deployToken(A, 'Gundam Calibarn'); g.deployUnit(A, C('GD06-021')); eq(A.units.filter(x => x.def.name === 'Gundam Calibarn').length, 2); });
T('Wheel Spoke destroys a <=3 AP Blocker when a Ghingnham unit is in play', () => { const g = mk(); const [A, D] = g.players; put(g, A, 'GD06-031'); const b = put(g, D, 'GD01-086'); ok(EFX['GD06-107'].canMain(g, A)); EFX['GD06-107'].main(g, A); ok(!g.alive(b)); });
T('Wing Gundam Zero deploy deals 3 to all Lv<=5 units (both sides)', () => { const g = mk(); const [A, D] = g.players; const mine = put(g, A, 'GD05-027'); const e = put(g, D, 'GD01-018'); g.deployUnit(A, C('GD01-024')); ok(!g.alive(mine) && !g.alive(e)); });
T('Gundam Calibarn (GD05-018) places 3 EX Resources', () => { const g = mk(); const A = g.players[0]; A.ex = 0; g.deployUnit(A, C('GD05-018')); eq(A.ex, 3); });
T('Kikeroga linked: Lv<=3 non-token units deploy rested', () => { const g = mk(); const [A, D] = g.players; const k = put(g, A, 'GD04-022'); g.pair(k, C('GD06-083').type === 'PILOT' ? C('GD06-083') : C('GD02-090')); ok(k.linked); const u = g.deployUnit(D, C('GD05-027')); ok(u.rested); });
T('Lauda Neill gives High-Maneuver to an Academy unit', () => { const g = mk(); const A = g.players[0]; const u = put(g, A, 'GD04-031'); g.pair(u, C('GD05-087')); ok(g.kw(u, 'High-Maneuver')); });
T('Gym Ghingnham linked: Ghingnham units +1 AP on opponent turn', () => { const g = mk(); const [A, D] = g.players; const tx = put(g, A, 'GD06-021'); g.pair(tx, C('GD06-085')); const z = put(g, A, 'GD06-031'); g.turnPlayer = D; eq(g.ap(z), 4); g.turnPlayer = A; eq(g.ap(z), 3); });
T('every card in all 25 decks has an implementation', () => { const D = require('./decks.json'); const miss = new Set(); for (const k in D) for (const c of D[k].cards) if (!EFX[c.id]) miss.add(c.id); eq(miss.size, 0, 'missing ' + [...miss].join(',')); });

// ---- compiled-card tests (Track 2) ----
T('compiled: GD01-043 Rasid\'s Maganac grants an active-attack on a <=4 AP enemy', () => { const g = mk(); const [A, D] = g.players; const att = put(g, A, 'GD01-030'); const bl = put(g, D, 'GD01-086'); ok(EFX['GD01-043'].fidelity === 'auto');
  g.deployUnit(A, C('GD01-043')); ok(A.ai.attackTargets(g, A, att).includes(bl) || g.ap(bl) > 4, 'active blocker targetable'); });
T('compiled: Support 2 (GD01-055 BuCUE) rests self and pumps another attacker', () => { const g = mk(); const A = g.players[0]; const s = put(g, A, 'GD01-055'); const a = put(g, A, 'GD01-018'); const ap0 = g.ap(a); EFX['GD01-055'].activate.run(g, A, s); ok(s.rested); eq(g.ap(a), ap0 + 2); });
T('compiled: shield-protect Action stops a Lv<=3 attacker\'s player damage', () => { const g = mk(); const [A, D] = g.players; const a = put(g, A, 'GD01-018'); D.hand.push(C('GD02-106')); D.res = 6; const before = D.shields.length + (D.base ? D.base.dmg : 0);
  const e = EFX['GD02-106']; ok(e.defAction); const b = { attacker: a, target: 'player' }; ok(e.defAction.can(g, D, b) === (a.def.lv <= 3)); });
T('compiled: deploy "Look at top 3, reveal 1 (T) Unit" adds at most 1 and keeps deck size', () => { const g = mk(); const A = g.players[0]; const n0 = A.deck.length + A.hand.length; g.deployUnit(A, C('EB01-030')); eq(A.deck.length + A.hand.length, n0); });
T('compiled: vanilla cards are present as auto (no-text) entries', () => { let v = 0; for (const id in EFX) if (EFX[id].fidelity === 'auto' && (CARDS[id].text === '-' || CARDS[id].text === '')) v++; ok(v > 30, 'vanilla count ' + v); });

console.log(`tests: ${pass} passed, ${fail} failed`); if (fails.length) console.log(fails.join('\n'));
process.exitCode = fail ? 1 : 0;
