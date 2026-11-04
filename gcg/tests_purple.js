'use strict';
// Focused tests for effects_purple.js: node tests_purple.js
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
const fill = (p, id, n) => { for (let k = 0; k < n; k++) p.trash.push(C(id)); };

T('every Purple card in the pool is registered', () => { const miss = Object.keys(CARDS).filter(id => !id.startsWith('T-') && CARDS[id].color === 'Purple' && ['UNIT', 'PILOT', 'COMMAND', 'BASE'].includes(CARDS[id].type) && !EFX[id]); eq(miss.length, 0, 'missing ' + miss.join(',')); });

T('GD06-050 Legend Gundam: Lv/cost -3 in trash with a ZAFT Link Unit; Awakened Power deploys it, from-trash Deploy destroys 2', () => {
  const g = mk(); const [A, D] = g.players; A.trash.push(C('GD06-050')); const e1 = put(g, D, 'GD05-027'); const e2 = put(g, D, 'GD05-027'); const e3 = put(g, D, 'GD01-030');
  ok(!EFX['GD02-110'].canMain(g, A), 'Lv6 in trash is not Lv<=5 without a ZAFT Link Unit');
  const z = put(g, A, 'GD04-053'); g.pair(z, C('GD04-093')); ok(z.linked, "Rey links Rey's Blaze");
  ok(EFX['GD02-110'].canMain(g, A), 'Lv3 in trash now'); A.resRested = 0; const av = g.avail(A); A.hand.push(C('GD02-110')); A.ai.castCommand(g, A, C('GD02-110'), 'main');
  eq(g.avail(A), av - 2 - 2, 'paid command 2 + reduced unit cost 2'); ok(A.units.some(u => u.def.id === 'GD06-050'), 'deployed'); eq([e1, e2, e3].filter(x => g.alive(x)).length, 1, 'two Lv<=3 destroyed');
  const g2 = mk(); const [A2, D2] = g2.players; const f1 = put(g2, D2, 'GD05-027'); const f2 = put(g2, D2, 'GD05-027'); g2.deployUnit(A2, C('GD06-050')); eq([f1, f2].filter(x => g2.alive(x)).length, 1, 'from hand: only 1');
});
T('GD03-058 Farsia: cost -1 only in the trash (Desil Galette When Linked pays 1 for it)', () => {
  const g = mk(); const A = g.players[0]; A.trash.push(C('GD03-058')); eq(g.costOf(A, C('GD03-058')), 2, 'hand cost unchanged');
  const z = put(g, A, 'GD02-057'); A.resRested = 0; const av = g.avail(A); g.pair(z, C('GD02-096')); ok(z.linked);
  ok(A.units.some(u => u.def.id === 'GD03-058'), 'Farsia deployed from trash'); eq(g.avail(A), av - 1);
});
T('GD03-053 Full City + GD03-060 CGS Commander + GD03-129 Hotarubi: own effect damage on your turn', () => {
  const g = mk(); const [A, D] = g.players; g.deployBase(A, C('GD03-129')); const fc = put(g, A, 'GD03-053'); g.pair(fc, C('ST05-011'));
  const cmdr = put(g, A, 'GD03-060'); const e = put(g, D, 'GD03-067'); const e2 = put(g, D, 'GD03-067'); const tr0 = A.trash.length; const dk = A.deck.length;
  g.effectDamage(A, cmdr, 1); ok(e.rested || e2.rested, 'Full City rested an enemy Lv<=4'); eq(A.units.filter(u => u.token && u.def.name === 'CGS Mobile Worker').length, 1, 'token');
  ok(A.units.find(u => u.token).rested, 'token rested'); ok(A.base.rested, 'Hotarubi rested'); eq(A.deck.length, dk - 1); eq(A.trash.length, tr0 + 1, 'milled 1');
  g.effectDamage(A, fc, 1); eq([e, e2].filter(x => x.rested).length, 1, 'Full City once per turn'); eq(A.units.filter(u => u.token).length, 1);
  g.turnPlayer = D; cmdr.flags = {}; g.turn = 2; g.effectDamage(D, cmdr, 1); eq(A.units.filter(u => u.token).length, 1, "CGS Commander: not on the opponent's turn");
});
T('GD02-064 Gundam Leopard: on your turn with 7+ trash, enemy Command damage is 0, enemy Unit effect damage is not', () => {
  const g = mk(); const [A, D] = g.players; fill(A, 'GD05-027', 7); const l = put(g, A, 'GD02-064'); D.hand.push(C('ST03-013')); D.resRested = 0;
  D.ai.castCommand(g, D, C('ST03-013'), 'main'); eq(l.dmg, 0, 'Command damage prevented'); ok(D.trash.some(c => c.id === 'ST03-013'), 'command was cast');
  g.effectDamage(D, l, 2); eq(l.dmg, 2, 'non-Command effect damage'); g.turnPlayer = D; l.dmg = 0; D.hand.push(C('ST03-013')); D.ai.castCommand(g, D, C('ST03-013'), 'main'); eq(l.dmg, 2, "on the opponent's turn");
});
T("GD04-053 Rey's Blaze Zaku Phantom: AI previews keep the once-per-turn; real damage -1 once", () => {
  const g = mk(); const [A, D] = g.players; const z = put(g, A, 'GD04-053'); g.pair(z, C('GD04-093')); ok(z.linked); z.flags.reduceNext = 0;
  eq(D.ai.effPreview(g, D, z, 2), 1, 'preview'); eq(D.ai.effPreview(g, D, z, 2), 1, 'preview again'); g.effectDamage(D, z, 2); eq(z.dmg, 1); g.effectDamage(D, z, 1); eq(z.dmg, 2, 'second hit not reduced');
});
T('GD04-096 Ennil El: linked attacker destroys a Lv<=5 enemy it damages; AI fight() predicts it', () => {
  const g = mk(); const [A, D] = g.players; quiet(A); quiet(D); const u = put(g, A, 'GD04-060'); g.pair(u, C('GD04-096')); ok(u.linked);
  const t = put(g, D, 'GD02-068', { rested: true }); t.dmg = 0; ok(A.ai.fight(g, u, t, true).killT, 'predicted'); g.attack(u, t); ok(!g.alive(t), 'destroyed by 2 damage on HP5');
});
T('GD04-115 Backup: granted "destroy Lv<=5 on battle damage" lasts this turn only', () => {
  const g = mk(); const [A, D] = g.players; quiet(A); quiet(D); const u = put(g, A, 'GD05-027'); const t = put(g, D, 'GD02-068', { rested: true });
  EFX['GD04-115'].main(g, A); ok(A.ai.fight(g, u, t, true).killT); g.turn = 2; ok(!A.ai.fight(g, u, t, true).killT, 'expired');
  g.attack(u, t); ok(g.alive(t), 'expired grant does not apply'); g.turn = 3; EFX['GD04-115'].main(g, A); const u2 = put(g, A, 'GD05-027'); EFX['GD04-115'].main(g, A); g.attack(u2, t); ok(!g.alive(t), 'fresh grant applies');
});
T("ST12-014 Wise Leader's Pride: defender destroys the attacker -> also destroys an enemy with AP<=2", () => {
  const g = mk(); const [A, D] = g.players; A.ai.actionStep = () => {}; D.ai.chooseBlock = () => null; const t = put(g, D, 'GD04-053', { rested: true }); // 4/3
  const a = put(g, A, 'GD05-027'); const small = put(g, A, 'GD03-060'); D.hand.push(C('ST12-014')); D.resRested = 0;
  g.attack(a, t); ok(!g.alive(a), 'attacker destroyed in battle'); ok(!g.alive(small), 'AP<=2 enemy destroyed'); ok(D.trash.some(c => c.id === 'ST12-014'));
});
T('GD04-095 Lunamaria Hawke: battle damage to the chosen Minerva Unit is dealt to her Unit instead', () => {
  const g = mk(); const [A, D] = g.players; quiet(A); quiet(D); const other = put(g, A, 'GD04-053'); const luna = put(g, A, 'GD05-064'); g.pair(luna, C('GD04-095')); ok(luna.linked);
  const t = put(g, D, 'GD01-030', { rested: true }); g.attack(other, t); eq(other.dmg, 0, 'no damage on the chosen Unit'); eq(luna.dmg, 3, 'Luna took the 3 battle damage');
});
T('GD06-093 Anavel Gato: during that battle, -2 from an enemy Unit with Lv <= this Unit', () => {
  const g = mk(); const [A, D] = g.players; quiet(A); quiet(D); const u = put(g, A, 'GD06-055'); g.pair(u, C('GD06-093')); u.dmg = 0;
  const t = put(g, D, 'GD01-030', { rested: true }); g.attack(u, t); ok(!g.alive(t)); eq(u.dmg, 1, '3 - 2'); eq(u.flags.redB(g, u, 3, t), 3, 'grant expired after the battle');
});
T('GD03-049 Exia (Trans-Am): each shield-area card destroyed by its battle damage (10+ CB in trash) destroys the lowest-HP enemy', () => {
  const g = mk(); const [A, D] = g.players; quiet(A); quiet(D); D.base = null; fill(A, 'GD03-063', 10); const ex = put(g, A, 'GD03-049');
  const lo = put(g, D, 'GD04-061'); const lo2 = put(g, D, 'GD05-027'); const hi = put(g, D, 'GD02-068'); const sh = D.shields.length;
  g.attack(ex, 'player'); eq(D.shields.length, sh - 2, 'Suppression'); ok(!g.alive(lo) && !g.alive(lo2) && g.alive(hi), 'two triggers: HP1 then HP2');
});
T('ST11-006 Shamblo: another Marine at the start of the opponent\'s turn -> enemy effect/Breach damage to shield area -5', () => {
  const g = mk(); const [A, D] = g.players; put(g, D, 'ST11-006'); put(g, D, 'ST11-007'); g.turn = 2; EFX['ST11-006'].onOppStart(g, D.units[0], A);
  g.damageShieldArea(A, D, 5, { effect: true }); eq(D.base.dmg, 0, 'EX base took nothing'); g.damageShieldArea(A, D, 6, { breach: true }); eq(D.base.dmg, 1);
  g.turn = 3; g.damageShieldArea(A, D, 1, { effect: true }); eq(D.base.dmg, 2, 'only that turn');
});
T('ST07-015 Ptolemaios: with a rested CB Unit, no damage from Lv<=3 non-token enemy Units (battle and Breach)', () => {
  const g = mk(); const [A, D] = g.players; quiet(A); quiet(D); g.deployBase(D, C('ST07-015')); put(g, D, 'GD03-063', { rested: true });
  const a = put(g, A, 'GD05-027'); g.attack(a, 'player'); eq(D.base.dmg, 0, 'Lv2 attacker'); const tk = g.deployToken(A, 'Graze Custom'); tk.sick = false; g.attack(tk, 'player'); eq(D.base.dmg, 2, 'token is not protected against');
  g.damageShieldArea(A, D, 2, { breach: true, src: a }); eq(D.base.dmg, 2, 'Breach from Lv2 prevented');
});
T('GD06-129 5th Luna: destroyed with Shields left -> Axis Base token (HP5) that never goes to the trash', () => {
  const g = mk(); const [A, D] = g.players; g.deployBase(D, C('GD06-129')); g.damageShieldArea(A, D, 2, { effect: true }); ok(D.base && D.base.def.name === 'Axis' && D.base.def.hp === 5, 'Axis');
  ok(D.trash.some(c => c.id === 'GD06-129')); g.damageShieldArea(A, D, 5, { effect: true }); eq(D.base, null); ok(!D.trash.some(c => c.name === 'Axis'), 'token vanished');
});
T('GD05-052 Sazabi + GD05-053 Quess\'s Jagd Doga + GD05-054 Alpha Azieru: Neo Zeon sacrifice returns to hand, Alpha draws once', () => {
  const g = mk(); const A = g.players[0]; const q = put(g, A, 'GD05-053'); const aa = put(g, A, 'GD05-054'); const h = A.hand.length; A.deck.unshift(C('GD05-027'), C('GD05-061'), C('GD05-027'), C('GD05-027')); // Alpha's draw takes the first
  g.deployUnit(A, C('GD05-052')); ok(!g.alive(q), 'sacrificed'); ok(A.hand.includes(C('GD05-053')), 'Jagd Doga back in hand'); ok(A.hand.includes(C('GD05-061')), 'Neo Zeon unit from the milled 3');
  eq(A.hand.length, h + 3, 'Jagd Doga + Geara Doga + Alpha draw'); const t = put(g, A, 'GD05-027'); g.destroy(t, { effect: true, by: A }); eq(A.hand.length, h + 3, 'Alpha once per turn');
  const g2 = mk(); const A2 = g2.players[0]; const q2 = put(g2, A2, 'GD05-053'); g2.destroy(q2, { effect: true, by: A2 }); ok(!A2.hand.includes(C('GD05-053')), 'unknown source: stays in trash');
});
T('GD04-051 Airmaster Burst: Vulture pilot + 7 trash -> may attack an active enemy Unit with a keyword', () => {
  const g = mk(); const [A, D] = g.players; const u = put(g, A, 'GD04-051'); const kwU = put(g, D, 'GD04-061'); const plain = put(g, D, 'GD05-027');
  g.pair(u, C('GD04-094')); ok(!A.ai.attackTargets(g, A, u).includes(kwU), 'needs 7 trash'); fill(A, 'GD05-027', 7); const ts = A.ai.attackTargets(g, A, u); ok(ts.includes(kwU) && !ts.includes(plain));
});
T("GD05-057 Gyunei's Jagd Doga: destroy another Unit -> set active, can't attack the player this turn", () => {
  const g = mk(); const A = g.players[0]; const u = put(g, A, 'GD05-057', { rested: true }); const tok = g.deployToken(A, 'Graze Custom'); const A_ = EFX['GD05-057'].activate;
  ok(A_.can(g, A, u)); A_.run(g, A, u); ok(!g.alive(tok) && !u.rested); ok(g.canAttackThisTurn(u) && !g.canAttackPlayer(u)); g.turn = 2; ok(g.canAttackPlayer(u));
});
T('ST09-001 Impulse Gundam: (2) + to deck bottom -> deploys a Lv4+ Impulse from trash (Sword Impulse from-trash Deploy fires)', () => {
  const g = mk(); const [A, D] = g.players; const u = put(g, A, 'ST09-001'); A.trash.push(C('ST09-006')); const e = put(g, D, 'GD05-027'); A.resRested = 0; const av = g.avail(A);
  const act = EFX['ST09-001'].activate; ok(act.can(g, A, u)); g.pay(A, act.cost); act.run(g, A, u); ok(!g.alive(u) && A.deck[A.deck.length - 1].id === 'ST09-001'); ok(A.units.some(x => x.def.id === 'ST09-006')); ok(!g.alive(e), 'from-trash destroy'); eq(g.avail(A), av - 2);
  const g2 = mk(); const D2 = g2.players[1]; const e2 = put(g2, D2, 'GD05-027'); g2.deployUnit(g2.players[0], C('ST09-006')); ok(g2.alive(e2), 'from hand: nothing');
});
T('GD02-053 Gundam X: [Suppression] in square brackets is honoured; Link aura +2 to other Vulture Units with 7+ trash on your turn', () => {
  const g = mk(); const A = g.players[0]; const x = put(g, A, 'GD02-053'); const v = put(g, A, 'GD04-061'); ok(g.kw(x, 'Suppression') > 0); g.pair(x, C('GD02-094')); ok(x.linked);
  const ap = g.ap(v); fill(A, 'GD05-027', 7); eq(g.ap(v), ap + 2); g.turnPlayer = g.players[1]; eq(g.ap(v), ap);
});
T('GD06-114 Alphaciders: saves an Alphacide Unit (-3) or destroys a Lv<=2 attacker', () => {
  const g = mk(); const [A, D] = g.players; g.turnPlayer = A; A.ai.actionStep = () => {}; D.ai.chooseBlock = () => null; const t = put(g, D, 'GD06-054', { rested: true }); t.dmg = 2; // 6/5 with 3 HP left
  const a = put(g, A, 'GD04-053'); D.hand.push(C('GD06-114')); D.resRested = 0; a.tAP = 1; // 5 AP
  g.attack(a, t); ok(g.alive(t), 'reduced to 2 damage'); eq(t.dmg, 4); ok(!g.alive(a));
  const g2 = mk(); const [A2, D2] = g2.players; g2.turnPlayer = A2; A2.ai.actionStep = () => {}; D2.ai.chooseBlock = () => null; D2.base = null; const a2 = put(g2, A2, 'GD06-060'); D2.hand.push(C('GD06-114')); D2.resRested = 0;
  D2.shields.length = 1; g2.attack(a2, 'player'); ok(!g2.alive(a2), 'Lv2 attacker destroyed'); eq(D2.shields.length, 1);
});
T('ST05 Tekkadan: Barbatos 2nd +2 AP while damaged, 4th gains Suppression while damaged, 6th Repair 3 at 1 HP, Lupus Rex AP+damage', () => {
  const g = mk(); const A = g.players[0]; const b2 = put(g, A, 'ST05-002'); const b4 = put(g, A, 'ST05-001'); const b6 = put(g, A, 'GD03-061'); const lr = put(g, A, 'GD05-051'); for (const x of A.units) { x.dmg = 0; x.tAP = 0; }
  eq(g.ap(b2), 2); b2.dmg = 1; eq(g.ap(b2), 4); ok(!g.kw(b4, 'Suppression')); b4.dmg = 1; ok(g.kw(b4, 'Suppression')); b6.dmg = 3; eq(g.kw(b6, 'Repair'), 3); b6.dmg = 2; eq(g.kw(b6, 'Repair'), 0); lr.dmg = 2; eq(g.ap(lr), 6);
});
T('ST05-013 With Iron and Blood on defence: 1 damage + AP+3 lets the blocker destroy the attacker', () => {
  const g = mk(); const [A, D] = g.players; g.turnPlayer = A; A.ai.actionStep = () => {}; D.base = null; const bl = put(g, D, 'GD02-055'); bl.dmg = 0; D.ai.chooseBlock = () => bl; // 3/5 Blocker (Gusion Rebake)
  const a = put(g, A, 'GD02-068'); a.dmg = 0; a.tHP = 1; // 3/6
  D.hand.push(C('ST05-013')); D.resRested = 0; g.attack(a, 'player'); ok(bl.rested, 'blocked'); ok(!g.alive(a), 'attacker destroyed by 6 AP'); eq(bl.dmg, 1 + 3); ok(D.trash.some(c => c.id === 'ST05-013'));
});

T('GD06-117 Veterans Joining Forces: defender moves a player attack onto a sturdy rested Delaz Fleet Unit', () => {
  const g = mk(); const [A, D] = g.players; g.turnPlayer = A; D.base = null; A.ai.actionStep = () => {}; D.ai.chooseBlock = () => null;
  const x = put(g, D, 'GD06-056', { rested: true }); const a = put(g, A, 'GD05-027'); D.hand.push(C('GD06-117')); D.resRested = 0; const sh = D.shields.length;
  g.attack(a, 'player'); eq(D.shields.length, sh, 'no shield lost'); ok(!g.alive(a), 'attacker destroyed by Xamel'); eq(x.dmg, 2); ok(D.trash.some(c => c.id === 'GD06-117'));
});
T('GD03-115 Distant Reunion: X-Rounder-piloted Unit takes no battle damage from an AP<=2 attacker', () => {
  const g = mk(); const [A, D] = g.players; g.turnPlayer = A; A.ai.actionStep = () => {}; D.ai.chooseBlock = () => null;
  const z = put(g, D, 'GD02-057', { rested: true }); g.pair(z, C('GD02-096')); z.dmg = 2; const a = put(g, A, 'GD05-027'); D.hand.push(C('GD03-115')); D.resRested = 0;
  g.attack(a, z); ok(g.alive(z)); eq(z.dmg, 2, 'no battle damage'); ok(!g.alive(a)); ok(D.trash.some(c => c.id === 'GD03-115'));
});
T('GD03-114 Look of Determination: on defence destroys an active enemy Lv<=2 (Lv<=4 with 10+ trash)', () => {
  const g = mk(); const [A, D] = g.players; g.turnPlayer = A; A.ai.actionStep = () => {}; D.ai.chooseBlock = () => null;
  const a = put(g, A, 'GD05-027'); const act = put(g, A, 'GD05-027'); const big = put(g, A, 'GD03-067'); D.hand.push(C('GD03-114')); D.resRested = 0;
  g.attack(a, 'player'); ok(!g.alive(act) && g.alive(big) && g.alive(a), 'the active Lv2 Jegan'); fill(D, 'GD05-027', 10); D.hand.push(C('GD03-114')); const a2 = put(g, A, 'GD05-027');
  g.attack(a2, 'player'); ok(!g.alive(big), 'Lv4 Rouei with 10+ trash');
});
T("GD05-049 Sazabi (effects.js) sacrificing GD05-053 Quess's Jagd Doga returns it to hand (Neo Zeon source)", () => {
  const g = mk(); const [A, D] = g.players; quiet(A); quiet(D); put(g, D, 'GD06-054'); put(g, D, 'GD06-054'); const sz = put(g, A, 'GD05-049'); const q = put(g, A, 'GD05-053');
  g.attack(sz, 'player'); ok(!g.alive(q), 'sacrificed'); ok(A.hand.includes(C('GD05-053')), 'back to hand'); eq(D.units.length, 1, 'enemy destroyed one');
});
T('GD02-110 Awakened Power / GD06-116 Afterglow of Zeon / ST11-015 Twinkle: trash deploys (paid / free / rested)', () => {
  const g = mk(); const A = g.players[0]; A.trash.push(C('GD06-052')); A.resRested = 0; const av = g.avail(A);
  ok(EFX['GD06-116'].canMain(g, A)); EFX['GD06-116'].main(g, A); const v = A.units.find(u => u.def.id === 'GD06-052'); ok(v && !v.rested); eq(g.avail(A), av, 'free');
  A.trash.push(C('ST11-007')); EFX['ST11-015'].main(g, A); const l = A.units.find(u => u.def.id === 'ST11-007'); ok(l && l.rested, 'deployed rested');
  A.trash.push(C('GD03-067')); A.resRested = A.res - 1; ok(!EFX['GD02-110'].canMain(g, A), 'cannot pay 2 + 3'); A.resRested = 0; ok(EFX['GD02-110'].canMain(g, A));
});

T('granted flags chain with hooks other files installed (u.flags.onKill / p.flags.shieldRed are kept)', () => {
  const g = mk(); const [A, D] = g.players; let other = 0; const u = put(g, A, 'GD05-027'); u.flags.onKill = () => { other++; }; let mine = 0;
  const run = EFX['ST12-014'].defAction.run; const b = { attacker: put(g, D, 'GD05-027'), target: u }; g.inBattle = b; run(g, A, b); u.flags.onKills[0].f = () => { mine++; };
  u.flags.onKill(g, u, b.attacker); eq(other, 1); eq(mine, 1); g.inBattle = null; u.flags.onKill(g, u, b.attacker); eq(other, 2); eq(mine, 1, 'battle-scoped grant expired');
  let ext = 0; D.flags.shieldRed = (g2, P, n) => { ext++; return n; }; put(g, D, 'ST11-006'); put(g, D, 'ST11-007'); g.turn = 2; EFX['ST11-006'].onOppStart(g, D.units.find(x => x.def.id === 'ST11-006'), A);
  g.damageShieldArea(A, D, 5, { effect: true }); eq(ext, 1, 'other shieldRed still runs'); eq(D.base.dmg, 0);
});

T('GD05-129 Axis: after an own Neo Zeon effect destroyed your Unit this turn, rest -> deploy a Neo Zeon Lv<=3 Unit from hand for free', () => {
  const g = mk(); const A = g.players[0]; g.deployBase(A, C('GD05-129')); A.hand.push(C('GD05-061')); A.resRested = 0; const av = g.avail(A);
  const bact = () => A.ai.candidates(g, A, 'post').find(a => a.kind === 'bact'); ok(!bact(), 'locked before any destruction');
  put(g, g.players[1], 'GD05-027'); const z = put(g, A, 'GD02-057'); g.pair(z, C('GD02-096')); const tok = g.deployToken(A, 'Graze Custom'); EFX['GD02-057'].attack(g, z, { attacker: z, target: 'player' }); ok(!g.alive(tok), 'Zedas destroyed the token'); ok(!bact(), 'non-Neo Zeon source does not unlock');
  const gy = put(g, A, 'GD05-057', { rested: true }); if (!g.alive(tok)) g.deployToken(A, 'Graze Custom'); EFX['GD05-057'].activate.run(g, A, gy); eq(A.flags.nzKillT, g.turn);
  const a = bact(); ok(a && a.v > 0, 'unlocked and worth using'); A.ai.exec(g, A, a); ok(A.units.some(u => u.def.id === 'GD05-061'), 'Geara Doga deployed'); ok(A.base.rested); eq(g.avail(A), av, 'free');
  A.hand.push(C('GD05-061')); ok(!bact(), 'base rested'); g.turn = 3; A.base.rested = false; ok(!bact(), 'condition is per turn');
});
T('GD05-049 Sazabi: may destroy itself (doomed attack), passes cause.src; the opponent destroys a non-battling Unit', () => {
  const g = mk(); const [A, D] = g.players; quiet(A); quiet(D); const t = put(g, D, 'GD05-055', { rested: true }); const j = put(g, D, 'GD05-027'); const sz = put(g, A, 'GD05-049');
  g.attack(sz, t); ok(!g.alive(sz), 'Sazabi chose itself'); eq(sz.destroyCause.src, C('GD05-049')); ok(!g.alive(j) && g.alive(t), 'opponent lost its non-battling Unit, the battle never happened'); eq(t.dmg, 0);
  const g2 = mk(); const [A2, D2] = g2.players; quiet(A2); quiet(D2); put(g2, D2, 'GD05-027'); const sz2 = put(g2, A2, 'GD05-049'); const sh = D2.shields.length; g2.attack(sz2, 'player'); ok(g2.alive(sz2), 'no reason to sacrifice itself'); ok(D2.shields.length < sh || !D2.base || D2.base.dmg > 0);
});
T('GD06-115 Teaching New Techniques: destroys a Lv<=4 enemy, deploys a Sazabi token; the destroyed Unit\'s owner deploys a Nu Gundam token', () => {
  const g = mk(); const [A, D] = g.players; const e = put(g, D, 'GD03-067'); EFX['GD06-115'].main(g, A); ok(!g.alive(e));
  const s = A.units.find(u => u.token && u.def.name === 'Sazabi'); ok(s && g.ap(s) === 4 && g.hp(s) === 4); const n = D.units.find(u => u.token && u.def.name === 'Nu Gundam'); ok(n && g.kw(n, 'First Strike') > 0, 'Nu Gundam for the opponent');
  const g2 = mk(); const [A2, D2] = g2.players; EFX['GD06-115'].main(g2, A2); eq(A2.units.length, 1); eq(D2.units.length, 0, 'no destroyed Unit -> no Nu Gundam'); ok(EFX['GD06-115'].score(g2, A2) > 0);
});

console.log(`tests_purple: ${pass} passed, ${fail} failed`); if (fails.length) console.log(fails.join('\n'));
process.exitCode = fail ? 1 : 0;
