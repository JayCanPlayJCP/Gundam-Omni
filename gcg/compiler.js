'use strict';
// Strict template compiler for card text. A card is 'auto' only if EVERY clause parses; otherwise it is reported as
// unparsed and NOT added (so the optimizer never plays a half-implemented card).
const { shuffle } = require('./engine');

const NUM = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6 };
function parseFilter(s) {
  // returns predicate builder (g, u) => bool for enemy units, or null if unparsable
  let rest = s.trim(); const fs = [];
  const take = (re, f) => { const m = rest.match(re); if (m) { fs.push(f(m)); rest = rest.replace(re, '').trim(); return true; } return false; };
  take(/^(rested )/, () => (g, u) => u.rested); take(/^(active )/, () => (g, u) => !u.rested);
  take(/^(damaged )/, () => (g, u) => u.dmg > 0); take(/^(undamaged )/, () => (g, u) => u.dmg === 0);
  if (!/^enemy Units?/.test(rest)) return null; rest = rest.replace(/^enemy Units?/, '').trim();
  for (let guard = 0; guard < 4 && rest; guard++) {
    if (take(/^with (\d+) or less HP/, m => (g, u) => g.hpLeft(u) <= +m[1])) continue;
    if (take(/^with (\d+) or less AP/, m => (g, u) => g.ap(u) <= +m[1])) continue;
    if (take(/^with (\d+) or more AP/, m => (g, u) => g.ap(u) >= +m[1])) continue;
    if (take(/^with 1 HP/, () => (g, u) => g.hpLeft(u) === 1)) continue;
    if (take(/^with ?<Blocker>/, () => (g, u) => g.kw(u, 'Blocker') > 0)) continue;
    if (take(/^that is Lv\.(\d+) or lower/, m => (g, u) => u.def.lv <= +m[1])) continue;
    if (take(/^that is Lv\.(\d+) or higher/, m => (g, u) => u.def.lv >= +m[1])) continue;
    if (take(/^that are Lv\.(\d+) or lower/, m => (g, u) => u.def.lv <= +m[1])) continue;
    if (take(/^and (\d+) or less AP/, m => (g, u) => g.ap(u) <= +m[1])) continue;
    if (take(/^with no paired Pilot|^without a paired Pilot/, () => (g, u) => !u.pilot)) continue;
    return null;
  }
  return (g, u) => fs.every(f => f(g, u));
}
function parseFriendly(s) {
  // "of your other (Clan) Units", "friendly (G Generation) Unit", "of your green Units", "(AGE System) Units", "Link Units" ... returns f(g,x,self)
  let rest = s.trim().replace(/^(of your|friendly|your)\s*/, ''); const fs = []; let other = false;
  if (/^other /.test(rest)) { other = true; rest = rest.replace(/^other /, ''); }
  let m;
  if ((m = rest.match(/^(rested |active )/))) { const r = m[1] === 'rested '; fs.push((g, x) => x.rested === r); rest = rest.slice(m[0].length); }
  if ((m = rest.match(/^(green|red|blue|white|purple) /))) { const col = m[1][0].toUpperCase() + m[1].slice(1); fs.push((g, x) => x.def.color === col); rest = rest.slice(m[0].length); }
  if ((m = rest.match(/^\(([^)]+)\)\/\(([^)]+)\) /))) { const a = m[1], b = m[2]; fs.push((g, x) => g.hasTrait(x, a) || g.hasTrait(x, b)); rest = rest.slice(m[0].length); }
  else if ((m = rest.match(/^\(([^)]+)\) /))) { const a = m[1]; fs.push((g, x) => g.hasTrait(x, a)); rest = rest.slice(m[0].length); }
  if ((m = rest.match(/^Link /))) { fs.push((g, x) => x.linked); rest = rest.slice(m[0].length); }
  if (!/^Units?\b/.test(rest)) return null; rest = rest.replace(/^Units?/, '').trim();
  for (let k = 0; k < 3 && rest; k++) {
    if ((m = rest.match(/^that (?:is|are) Lv\.(\d+) or (higher|lower)/))) { const n = +m[1], hi = m[2] === 'higher'; fs.push((g, x) => hi ? x.def.lv >= n : x.def.lv <= n); rest = rest.slice(m[0].length).trim(); continue; }
    if ((m = rest.match(/^paired with an? \(([^)]+)\) Pilot/))) { const t = m[1]; fs.push((g, x) => x.pilot && (x.pilot.traits || []).includes(t)); rest = rest.slice(m[0].length).trim(); continue; }
    if ((m = rest.match(/^with <([A-Za-z\- ]+)>/))) { const kw = m[1]; fs.push((g, x) => g.kw(x, kw) > 0); rest = rest.slice(m[0].length).trim(); continue; }
    return null;
  }
  return (g, x, self) => (!other || x !== self) && fs.every(f => f(g, x));
}
function parseEnemyActiveFilter(s) {
  s = (s || '').trim(); let m;
  if (!s) return (g, t) => true;
  if ((m = s.match(/^with (\d+) or less AP$/))) { const n = +m[1]; return (g, t) => g.ap(t) <= n; }
  if ((m = s.match(/^with (\d+) or less HP$/))) { const n = +m[1]; return (g, t) => g.hpLeft(t) <= n; }
  if ((m = s.match(/^that is Lv\.(\d+) or lower$/))) { const n = +m[1]; return (g, t) => t.def.lv <= n; }
  if ((m = s.match(/^with ?<Blocker>$/))) return (g, t) => g.kw(t, 'Blocker') > 0;
  return null;
}
function grantActive(g, p, fa, fe, self, all) {
  const cand = p.units.filter(x => fa(g, x, self));
  if (all) { for (const x of cand) { const old = x.attackActiveFilter; x.attackActiveFilter = t => (old && old(t)) || fe(g, t); } return; }
  let best = null, bv = -1e9;
  for (const a of cand) { let v = g.canAttackThisTurn(a) ? 0.5 : -1; for (const t of p.opp.units) { if (t.rested || !fe(g, t)) continue; const f = p.ai.fight(g, a, t, true); v = Math.max(v, (f.killT ? p.ai.unitValue(g, t) + (g.kw(t, 'Blocker') ? 0.8 : 0) : 0) - (f.killA ? p.ai.unitValue(g, a) : 0)); } if (v > bv) { bv = v; best = a; } }
  if (best) { const old = best.attackActiveFilter; best.attackActiveFilter = t => (old && old(t)) || fe(g, t); }
}
function parseCond(s) {
  let m0;
  if ((m0 = s.match(/^If you are Lv\.(\d+) or higher$/))) { const n = +m0[1]; return (g, p) => g.level(p) >= n; }
  if ((m0 = s.match(/^If you are attacking an enemy Unit$/))) return (g, p, u, b) => !!(b && b.target && b.target !== 'player');
  if ((m0 = s.match(/^If you are attacking the enemy player$/))) return (g, p, u, b) => !!(b && b.target === 'player');
  if ((m0 = s.match(/^If this Unit is (?:a )?Link Unit$|^If this is a Link Unit$/))) return (g, p, u) => !!(u && u.linked);
  if ((m0 = s.match(/^If you have a \(([^)]+)\) (Link )?Unit in play$/))) { const t = m0[1], l = !!m0[2]; return (g, p, u) => p.units.some(x => x !== u && g.hasTrait(x, t) && (!l || x.linked)); }
  if ((m0 = s.match(/^If an? (?:friendly )?\(([^)]+)\) Link Unit is in play$/))) { const t = m0[1]; return (g, p) => p.units.some(x => g.hasTrait(x, t) && x.linked); }
  if ((m0 = s.match(/^If you have an? \(([^)]+)\) Pilot in play$/))) { const t = m0[1]; return (g, p) => p.units.some(x => x.pilot && (x.pilot.traits || []).includes(t)); }
  if ((m0 = s.match(/^If an enemy Unit is in play$/))) return (g, p) => p.opp.units.length > 0;
  // "If ..., " conditions → (g, p, u) => bool
  let m;
  if ((m = s.match(/^If you have (\d+) or more (other )?\(([^)]+)\) Units in play$/))) { const n = +m[1], tr = m[3], other = !!m[2]; return (g, p, u) => p.units.filter(x => (!other || x !== u) && g.hasTrait(x, tr)).length >= n; }
  if ((m = s.match(/^If you have another \(([^)]+)\) Unit in play$/))) { const tr = m[1]; return (g, p, u) => p.units.some(x => x !== u && g.hasTrait(x, tr)); }
  if ((m = s.match(/^If you have another friendly \(([^)]+)\) Unit in play$/))) { const tr = m[1]; return (g, p, u) => p.units.some(x => x !== u && g.hasTrait(x, tr)); }
  if ((m = s.match(/^If (\d+) or more enemy Units are in play$/))) { const n = +m[1]; return (g, p) => p.opp.units.length >= n; }
  if ((m = s.match(/^If there are (\d+) or more \(([^)]+)\) cards in your trash$/))) { const n = +m[1], tr = m[2]; return (g, p) => p.trash.filter(c => c.traits.includes(tr)).length >= n; }
  if ((m = s.match(/^If there are (\d+) or more cards in your trash$/))) { const n = +m[1]; return (g, p) => p.trash.length >= n; }
  if ((m = s.match(/^If this is an? \(([^)]+)\) Unit$/))) { const tr = m[1]; return (g, p, u) => u && g.hasTrait(u, tr); }
  if ((m = s.match(/^If this Unit is damaged$/))) return (g, p, u) => u && u.dmg > 0;
  if ((m = s.match(/^If it is your turn$/))) return (g, p) => g.turnPlayer === p;
  if ((m = s.match(/^If you have (\d+) or less cards in your hand$/))) { const n = +m[1]; return (g, p) => p.hand.length <= n; }
  if ((m = s.match(/^If there are (\d+) or less enemy Shields$/))) { const n = +m[1]; return (g, p) => p.opp.shields.length <= n; }
  return null;
}
function tokenName(s) { const m = s.match(/\[([^\]]+)\]\(\(/); return m ? m[1] : null; }
// action sentence → { run(g,p,u,ctx), val(g,p,u) }
function parseAction(sent, TOKEN) {
  let m; const s = sent.trim().replace(/\.$/, '');
  if ((m = s.match(/^Draw (\d+)$/))) { const n = +m[1]; return { run: (g, p) => g.draw(p, n), val: () => 1.3 * n }; }
  if ((m = s.match(/^Discard 1\. If you do, draw (\d+)$/))) { const n = +m[1]; return { run: (g, p) => { if (g.discard(p, 1)) g.draw(p, n); }, val: () => 1.2 * (n - 1) + 0.3 }; }
  if (s === 'Draw 1. Then, discard 1' || s === 'Draw 1, then discard 1') return { run: (g, p) => { g.draw(p, 1); g.discard(p, 1); }, val: () => 0.4 };
  if (s === 'Add 1 of your Shields to your hand') return { run: (g, p) => g.addShieldToHand(p), val: () => 1.0 };
  if (s === 'Place 1 EX Resource') return { run: (g, p) => g.placeEX(p, 1), val: () => 0.9 };
  if (s === 'Place 1 rested Resource') return { run: (g, p) => { if (p.resDeck > 0) { p.resDeck--; p.res++; p.resRested++; } }, val: (g, p) => g.level(p) <= 6 ? 1.2 : 0.3 };
  if ((m = s.match(/^This Unit gets AP\+(\d+) during this (turn|battle)$/))) { const n = +m[1], b = m[2] === 'battle'; return { run: (g, p, u) => { if (u) { if (b) u.bAP += n; else u.tAP += n; } }, val: () => 0.3 * n }; }
  if ((m = s.match(/^This Unit recovers (\d+) HP$/))) { const n = +m[1]; return { run: (g, p, u) => u && g.heal(u, n), val: () => 0.2 * n }; }
  if ((m = s.match(/^All (?:your|friendly) Units get AP\+(\d+) during this turn$/))) { const n = +m[1]; return { run: (g, p) => { for (const x of p.units) x.tAP += n; }, val: (g, p) => p.ai.pumpScore(g, p, n) }; }
  if ((m = s.match(/^Deploy (1|2) (rested )?\[/)) && /Unit tokens?$/.test(s)) { const name = tokenName(s); const n = +m[1]; const rested = !!m[2]; if (!name || !TOKEN[name]) return null;
    return { run: (g, p) => { for (let k = 0; k < n; k++) if (p.units.length < 6) g.deployToken(p, name, { rested }); }, val: (g, p) => p.units.length < 6 ? n * (0.4 + 0.35 * (TOKEN[name].ap + TOKEN[name].hp)) * (rested ? 0.8 : 1) : 0 }; }
  if ((m = s.match(/^Look at the top card of your deck\. Return it to the top or bottom of your deck$/))) return { run: (g, p) => { if (!p.deck.length) return; const c = p.deck[0]; if (!p.ai.keepOnTop(g, p, c)) { p.deck.shift(); p.deck.push(c); } }, val: () => 0.2 };
  if ((m = s.match(/^Look at the top (\d+) cards of your deck\. You may reveal 1 (.+?) among them and add it to your hand\. Return the remaining cards randomly to the bottom of your deck$/))) {
    const n = +m[1]; const what = m[2]; const pred = revealPred(what); if (!pred) return null;
    return { run: (g, p) => { const top = p.deck.splice(0, n); const hits = top.filter(pred); let got = null; if (hits.length) { got = p.ai.pickBestCard(g, p, hits); top.splice(top.indexOf(got), 1); p.hand.push(got); g.stats.p[p.i].extraCards++; } shuffle(top, g.rng); p.deck.push(...top); }, val: () => 0.5 + 0.08 * n }; }
  // targeted enemy effects
  const tm = s.match(/^Choose (1 to 2|1) (.+?)\. (Deal (\d+) damage to (?:it|them)|Rest (?:it|them)|Return (?:it|them) to (?:its|their) owners?'s? hands?|Destroy (?:it|them)|(?:It|They) gets? AP-(\d+) during this (turn|battle))$/);
  if (tm) {
    const two = tm[1] === '1 to 2'; const f = parseFilter(tm[2]); if (!f) return null; const act = tm[3];
    const pickN = (g, p, chooser) => { const done = []; for (let k = 0; k < (two ? 2 : 1); k++) { const c = p.opp.units.filter(x => f(g, x) && !done.includes(x) && (!act.startsWith('Rest') || !x.rested)); if (!c.length) break; const t = chooser(c); if (!t) break; done.push(t); } return done; };
    if (/^Deal/.test(act)) { const n = +tm[4]; return { run: (g, p) => { const ts = pickN(g, p, c => p.ai.pickDamageTarget(g, p, c, n)); for (const t of ts) g.effectDamage(p, t, n); }, val: (g, p) => p.ai.bestDamageValue(g, p, n, x => f(g, x)) * (two ? 1.5 : 1), removal: { kind: 'damage', n, f } }; }
    if (/^Rest/.test(act)) return { run: (g, p) => { for (const t of pickN(g, p, c => p.ai.pickRestTarget(g, p, c))) g.restUnit(t); }, val: (g, p) => p.ai.restScore(g, p, x => f(g, x)) * (two ? 1.5 : 1) };
    if (/^Return/.test(act)) return { run: (g, p) => { for (const t of pickN(g, p, c => p.ai.pickRemovalTarget(g, p, c, 'hand'))) g.bounce(t); }, val: (g, p) => Math.max(0, ...p.opp.units.filter(x => f(g, x)).map(x => p.ai.removalValue(g, p, x, 'hand'))), removal: { kind: 'hand', f } };
    if (/^Destroy/.test(act)) return { run: (g, p) => { for (const t of pickN(g, p, c => p.ai.pickRemovalTarget(g, p, c, 'destroy'))) g.destroy(t, { effect: true, by: p }); }, val: (g, p) => Math.max(0, ...p.opp.units.filter(x => f(g, x)).map(x => p.ai.removalValue(g, p, x, 'destroy'))), removal: { kind: 'destroy', f } };
    if (/AP-/.test(act)) { const n = +tm[5]; const battle = tm[6] === 'battle'; return { run: (g, p) => { for (const t of pickN(g, p, c => p.ai.pickApDownTarget(g, p, c, n, null))) { if (battle) t.bAP -= n; else t.tAP -= n; } }, val: () => 0.3, apDown: n }; }
  }
  if ((m = s.match(/^Choose 1 of your Units\. It gets AP\+(\d+) during this turn$/))) { const n = +m[1]; return { run: (g, p) => { if (p.units.length) p.ai.pickBestAttacker(g, p, p.units).tAP += n; }, val: () => 0.4 }; }
  if ((m = s.match(/^Choose 1 (?:of your|friendly) Units?\. It recovers (\d+) HP$/))) { const n = +m[1]; return { run: (g, p) => { const d = p.units.filter(x => x.dmg > 0); if (d.length) g.heal(p.ai.pickBestUnit(g, p, d), n); }, val: (g, p) => p.units.some(x => x.dmg > 0) ? 0.3 * n : 0 }; }
  // active-attack grants (Blocker answers)
  if ((m = s.match(/^Choose 1 (.+?)\. During this turn, it may choose an active enemy Unit ?(.*?) as its attack target$/))) {
    const fa = parseFriendly(m[1]); const fe = parseEnemyActiveFilter(m[2]); if (!fa || !fe) return null;
    return { run: (g, p, u) => grantActive(g, p, fa, fe, u, false), val: (g, p, u) => Math.max(0, p.ai.unlockScore(g, p, x => fa(g, x, u), t => fe(g, t)) + 0.9) * 0.9 }; }
  if ((m = s.match(/^All your (.+?) may choose an active enemy Unit ?(.*?) as their attack target during this turn$/))) {
    const fa = parseFriendly(m[1]); const fe = parseEnemyActiveFilter(m[2]); if (!fa || !fe) return null;
    return { run: (g, p, u) => grantActive(g, p, fa, fe, u, true), val: (g, p, u) => Math.max(0, p.ai.unlockScore(g, p, x => fa(g, x, u), t => fe(g, t)) + 0.9) * 1.2 }; }
  // friendly pumps / keyword grants
  if ((m = s.match(/^Choose (1 to 2|1) (.+?)\. (?:It gets|They get) AP\+(\d+) during this (turn|battle)$/))) {
    const two = m[1] !== '1'; const fa = parseFriendly(m[2]); const n = +m[3]; const bt = m[4] === 'battle'; if (!fa) return null;
    return { run: (g, p, u, b) => { const c = p.units.filter(x => fa(g, x, u)).sort((x, y) => (g.canAttackThisTurn(y) - g.canAttackThisTurn(x)) || (g.ap(y) - g.ap(x))); for (const x of c.slice(0, two ? 2 : 1)) { if (bt) x.bAP += n; else x.tAP += n; } },
      val: (g, p, u) => p.units.some(x => fa(g, x, u) && g.canAttackThisTurn(x)) ? 0.25 * n * (two ? 1.6 : 1) : 0.05 }; }
  if ((m = s.match(/^Choose (1 to 3|1 to 2|1) (.+?)\. (?:It gains|They gain) <([A-Za-z\- ]+?)(?: (\d+))?> during this (turn|battle)$/))) {
    const k = m[1] === '1' ? 1 : (m[1] === '1 to 2' ? 2 : 3); const fa = parseFriendly(m[2]); const kw = m[3], n = m[4] ? +m[4] : 1; if (!fa) return null;
    return { run: (g, p, u) => { const c = p.units.filter(x => fa(g, x, u)).sort((x, y) => (g.canAttackThisTurn(y) - g.canAttackThisTurn(x)) || (g.ap(y) - g.ap(x))); for (const x of c.slice(0, k)) x.tKw[kw] = Math.max(x.tKw[kw] || 0, n); },
      val: (g, p, u) => p.units.some(x => fa(g, x, u) && g.canAttackThisTurn(x)) ? (kw === 'Breach' ? 0.25 * n : kw === 'High-Maneuver' ? 0.9 : 0.5) * Math.min(k, 2) : 0.05 }; }
  if ((m = s.match(/^This Unit gains <([A-Za-z\- ]+?)(?: (\d+))?> during this (turn|battle)$/))) { const kw = m[1], n = m[2] ? +m[2] : 1; const bt = m[3] === 'battle';
    return { run: (g, p, u) => { if (!u) return; if (bt) u.bKw[kw] = Math.max(u.bKw[kw] || 0, n); else u.tKw[kw] = Math.max(u.tKw[kw] || 0, n); }, val: () => 0.4 }; }
  // trash recursion
  if ((m = s.match(/^Choose 1 (.+?) card from your trash\. Add it to your hand$/))) { const pred = cardPred(m[1]); if (!pred) return null;
    return { run: (g, p) => { const c = p.trash.filter(pred); if (!c.length) return; const x = p.ai.pickBestCard(g, p, c); p.trash.splice(p.trash.indexOf(x), 1); p.hand.push(x); g.stats.p[p.i].extraCards++; }, val: (g, p) => p.trash.some(pred) ? 1.1 : 0 }; }
  // free deploy from hand
  if ((m = s.match(/^You may deploy 1 (.+?) card(?: that is Lv\.(\d+) or lower)? from your hand$/))) { const pred0 = cardPred(m[1]); const lv = m[2] ? +m[2] : 99; if (!pred0) return null; const pred = c => pred0(c) && c.type === 'UNIT' && c.lv <= lv;
    return { run: (g, p) => { const c = p.hand.filter(pred); if (!c.length || p.units.length >= 6) return; const x = p.ai.pickBestCard(g, p, c); p.hand.splice(p.hand.indexOf(x), 1); g.deployUnit(p, x); }, val: (g, p) => p.hand.some(pred) && p.units.length < 6 ? 1.0 + 0.3 * Math.max(...p.hand.filter(pred).map(c => c.cost)) : 0 }; }
  if ((m = s.match(/^Choose 1 (.+?)\. It recovers (\d+) HP$/))) { const fa = parseFriendly(m[1].replace(/^(friendly |of your )?damaged /, '$1')); const n = +m[2]; if (!fa) return null;
    return { run: (g, p, u) => { const c = p.units.filter(x => fa(g, x, u) && x.dmg > 0); if (c.length) g.heal(p.ai.pickBestUnit(g, p, c), n); }, val: (g, p, u) => p.units.some(x => fa(g, x, u) && x.dmg > 0) ? 0.25 * n : 0 }; }
  if ((m = s.match(/^All (?:friendly|your) (.*?)Units(?: that are Lv\.(\d+) or lower)? recover (\d+) HP$/))) { const fa = parseFriendly((m[1] || '') + 'Units'); const lv = m[2] ? +m[2] : 99, n = +m[3]; if (!fa) return null;
    return { run: (g, p, u) => { for (const x of p.units) if (fa(g, x, null) && x.def.lv <= lv) g.heal(x, n); }, val: (g, p) => 0.15 * p.units.filter(x => x.dmg > 0).length * n }; }
  if ((m = s.match(/^Choose 1 rested enemy Unit(?: (?:with (\d+) or less HP|that is Lv\.(\d+) or lower))?\. It won't be set as active during the start phase of your opponent's next turn$/))) { const hp = m[1] ? +m[1] : 99, lv = m[2] ? +m[2] : 99;
    const f = (g, x) => x.rested && g.hpLeft(x) <= hp && x.def.lv <= lv;
    return { run: (g, p) => { const c = p.opp.units.filter(x => f(g, x)); if (!c.length) return; const t = p.ai.pickRemovalTarget(g, p, c, 'destroy'); t.noReady = true; }, val: (g, p) => Math.max(0, ...p.opp.units.filter(x => f(g, x)).map(x => 0.5 * p.ai.unitValue(g, x) + (g.kw(x, 'Blocker') ? 0.5 : 0))) }; }
  if ((m = s.match(/^You may discard 1 (.*?)card\. If you do, (.+)$/))) { const what = m[1].trim(); const pred = what ? cardPred(what.replace(/ $/, '')) : (c => true); if (!pred) return null; const rest = parseAction(m[2].charAt(0).toUpperCase() + m[2].slice(1), TOKEN); if (!rest) return null;
    return { run: (g, p, u, b) => { const c = p.hand.filter(pred); if (!c.length) return; const w = p.ai.pickWorstCard(g, p, c); if (p.ai.cardValue(g, p, w) > 2.6 + rest.val(g, p, u, b)) return; p.hand.splice(p.hand.indexOf(w), 1); p.trash.push(w); rest.run(g, p, u, b); }, val: (g, p, u, b) => p.hand.some(pred) ? rest.val(g, p, u, b) - 0.9 : 0 }; }
  if (s === 'Place 1 EX Resource' || s === 'You may place 1 EX Resource') return { run: (g, p) => g.placeEX(p, 1), val: () => 0.9 };
  if ((m = s.match(/^Deal (\d+) damage to all enemy Units(?: that are Lv\.(\d+) or lower)?$/))) { const n = +m[1], lv = m[2] ? +m[2] : 99; return { run: (g, p) => { for (const x of [...p.opp.units]) if (x.def.lv <= lv) g.effectDamage(p, x, n); }, val: (g, p) => p.opp.units.filter(x => x.def.lv <= lv).reduce((s, x) => s + p.ai.dmgTargetValue(g, p, x, n), 0) }; }
  return null;
}
function revealPred(what) {
  let m; what = what.trim();
  if ((m = what.match(/^(.+?) Unit card that is Lv\.(\d+) or (lower|higher)$/))) { const b = cardPred(m[1] + ' Unit'); const n = +m[2], lo = m[3] === 'lower'; return b ? c => b(c) && (lo ? c.lv <= n : c.lv >= n) : null; }
  if ((m = what.match(/^(.+?) Unit card that is Lv\.(\d+)$/))) { const b = cardPred(m[1] + ' Unit'); const n = +m[2]; return b ? c => b(c) && c.lv === n : null; }
  if ((m = what.match(/^(.+?) Unit card\/Pilot card$/))) { const b = cardPred(m[1] + ' Unit'), q = cardPred(m[1] + ' Pilot'); return b && q ? c => b(c) || q(c) : null; }
  if ((m = what.match(/^(.+?) card$/))) return cardPred(m[1]);
  return null;
}
function cardPred(what) {
  if (what === 'Unit') return c => c.type === 'UNIT';
  { const mm = what.match(/^\(([^)]+)\)\/\(([^)]+)\) (Unit|Pilot)$/); if (mm) { const ty = mm[3].toUpperCase(); return c => c.type === ty && (c.traits.includes(mm[1]) || c.traits.includes(mm[2])); } }
  { const mm = what.match(/^(green|red|blue|white|purple) \(([^)]+)\) Pilot$/); if (mm) { const col = mm[1][0].toUpperCase() + mm[1].slice(1); return c => c.type === 'PILOT' && c.color === col && c.traits.includes(mm[2]); } }
  let m;
  if (what === 'Pilot') return c => c.type === 'PILOT';
  if (what === 'Command') return c => c.type === 'COMMAND';
  if ((m = what.match(/^\(([^)]+)\) Unit$/))) return c => c.type === 'UNIT' && c.traits.includes(m[1]);
  if ((m = what.match(/^\(([^)]+)\)\/\(([^)]+)\) Unit$/))) return c => c.type === 'UNIT' && (c.traits.includes(m[1]) || c.traits.includes(m[2]));
  if ((m = what.match(/^\(([^)]+)\) Pilot$/))) return c => c.type === 'PILOT' && c.traits.includes(m[1]);
  if ((m = what.match(/^(green|red|blue|white|purple) \(([^)]+)\) Unit$/))) { const col = m[1][0].toUpperCase() + m[1].slice(1); return c => c.type === 'UNIT' && c.color === col && c.traits.includes(m[2]); }
  return null;
}
function parseBody(body, TOKEN) {
  // body: one or more sentences, possibly with "If ..., " condition and "Then, " continuations
  const parts = []; let rest = body.trim();
  // split on ". Then, " keeping order
  const sents = rest.split(/\. Then, /);
  for (let raw of sents) {
    raw = raw.trim().replace(/\.$/, ''); raw = raw.charAt(0).toUpperCase() + raw.slice(1); let cond = null;
    const cm = raw.match(/^(If [^,]+), (.+)$/); if (cm) { cond = parseCond(cm[1]); if (!cond) return null; raw = cm[2]; raw = raw.charAt(0).toUpperCase() + raw.slice(1); }
    const a = parseAction(raw, TOKEN); if (!a) return null; parts.push({ cond, a });
  }
  return { run: (g, p, u, b) => { for (const { cond, a } of parts) { if (cond && !cond(g, p, u, b)) continue; a.run(g, p, u, b); } },
    val: (g, p, u, b) => parts.reduce((s, { cond, a }) => s + ((!cond || cond(g, p, u, b)) ? a.val(g, p, u, b) : 0), 0),
    removal: parts.length === 1 && !parts[0].cond ? parts[0].a.removal : null, apDown: parts.length === 1 ? parts[0].a.apDown : null };
}
function compileCard(def, TOKEN) {
  const segs = def.text.split(' / ').map(x => x.trim()).filter(Boolean);
  const e = { fidelity: 'auto', note: 'compiled from official text' }; let ok = true; const failed = [];
  if (def.text === '-' || def.text === '') return e;
  for (const seg of segs) {
    if (seg.startsWith('(') || /^<[^>]+>( \(.*\))?$/.test(seg)) continue; // reminder or unconditional keyword
    if (/^【Burst】Add this card to your hand\.?$/.test(seg) || /^【Burst】Deploy this card\.?$/.test(seg)) continue; // engine default
    if (/^【Burst】Activate this card's 【Main】\.?$/.test(seg)) { e.burst = (g, p, c) => { if (e.main && (!e.canMain || e.canMain(g, p))) e.main(g, p); }; continue; }
    if (def.type === 'BASE' && /^【Deploy】Add 1 of your Shields to your hand\.?$/.test(seg)) { e.base = true; continue; }
    if (def.type === 'BASE') { const m = seg.match(/^【Deploy】Add 1 of your Shields to your hand\. Then, (.+)$/); if (m) { const b = parseBody(m[1], TOKEN); if (!b) { ok = false; failed.push(seg); continue; } e.base = true; e.baseDeploy = (g, p) => b.run(g, p, null); continue; } }
    let m;
    if ((m = seg.match(/^【Pilot】\[(.+)\]$/))) { e.pilotName = m[1]; continue; }
    if ((m = seg.match(/^【Burst】(.+)$/))) { const b = parseBody(m[1], TOKEN); if (!b) { ok = false; failed.push(seg); continue; } e.burst = (g, p) => b.run(g, p, null); continue; }
    if ((m = seg.match(/^【Action】During this battle, your shield area cards can't receive damage from enemy Units (?:that are Lv\.(\d+) or lower|with (\d+) or less AP)\.?$/)) && def.type === 'COMMAND') {
      const lv = m[1] ? +m[1] : null, ap = m[2] ? +m[2] : null; const okU = (g, a) => lv !== null ? a.def.lv <= lv : g.ap(a) <= ap;
      e.cmd = true; e.actionOnly = true; e.canMain = () => false; e.main = () => {};
      e.defAction = { can: (g, p, b) => b.target === 'player' && okU(g, b.attacker), value: (g, p, b, threat) => threat * (g.kw(b.attacker, 'Suppression') ? 1.4 : 1) + 0.2, run: (g, p, b) => { b.shieldProtect = true; } };
      continue; }
    if ((m = seg.match(/^【(Main】\/【Action|Main|Action)】(.+)$/)) && def.type === 'COMMAND') {
      const b = parseBody(m[2], TOKEN); if (!b) { ok = false; failed.push(seg); continue; }
      e.cmd = true; e.main = (g, p) => b.run(g, p, null); e.canMain = (g, p) => b.val(g, p, null) > 0 || !b.removal; e.score = (g, p) => b.val(g, p, null) - 0.8;
      if (b.removal) e.removal = b.removal; if (b.apDown) e.apDown = b.apDown;
      if (m[1] === 'Action') { e.actionOnly = true; e.canMain = () => false; } if (m[1].includes('Action')) e.actionToo = true; continue; }
    const trig = { Deploy: 'deploy', Attack: 'attack', Destroyed: 'destroyed', 'When Paired': 'whenPaired', 'When Linked': 'whenLinked' };
    if ((m = seg.match(/^【(Deploy|Attack|Destroyed|When Paired|When Linked)】(.+)$/))) {
      const b = parseBody(m[2], TOKEN); if (!b) { ok = false; failed.push(seg); continue; }
      const k = trig[m[1]];
      if (def.type === 'PILOT') { const pk = 'p_' + k; e[pk] = (g, u) => b.run(g, u.owner, u); e['ai_' + k] = (g, p, u) => b.val(g, p, u); }
      else { e[k] = (g, u) => b.run(g, u.owner, u); e['ai_' + k] = (g, p, u) => b.val(g, p, u); }
      continue; }
    if ((m = seg.match(/^【During (Link|Pair)】【(Attack|Destroyed)】(.+)$/))) {
      const b = parseBody(m[3], TOKEN); if (!b) { ok = false; failed.push(seg); continue; } const need = m[1];
      const fn = (g, u) => { if (need === 'Link' ? u.linked : !!u.pilot) b.run(g, u.owner, u); };
      if (def.type === 'PILOT') e['p_' + m[2].toLowerCase()] = fn; else e[m[2].toLowerCase()] = fn; continue; }
    if ((m = seg.match(/^【During (Link|Pair)】This Unit gets AP\+(\d+)( and HP\+(\d+))?\.?$/))) { const need = m[1], a = +m[2], h = m[4] ? +m[4] : 0;
      const on = (u) => need === 'Link' ? u.linked : !!u.pilot; if (def.type === 'PILOT') { e.p_ap = (g, u) => on(u) ? a : 0; e.p_hp = (g, u) => on(u) ? h : 0; } else { e.ap = (g, u) => on(u) ? a : 0; e.hp = (g, u) => on(u) ? h : 0; } continue; }
    if ((m = seg.match(/^【During (Link|Pair)】This Unit gains ?<([A-Za-z\- ]+?)(?: (\d+))?>\.?$/))) { const need = m[1], kw = m[2], n = m[3] ? +m[3] : 1;
      const on = (u) => need === 'Link' ? u.linked : !!u.pilot; if (def.type === 'PILOT') e.p_kw = (g, u, k) => (k === kw && on(u)) ? n : 0; else e.kw = (g, u, k) => (k === kw && on(u)) ? n : 0; continue; }
    if ((m = seg.match(/^While you have (\d+) or more (other )?\(([^)]+)\) Units in play, this Unit gets AP\+(\d+)\.?$/))) { const n = +m[1], other = !!m[2], tr = m[3], a = +m[4]; e.ap = (g, u) => u.owner.units.filter(x => (!other || x !== u) && g.hasTrait(x, tr)).length >= n ? a : 0; continue; }
    if ((m = seg.match(/^During your turn, this Unit gets AP\+(\d+)\.?$/))) { const a = +m[1]; e.ap = (g, u) => g.turnPlayer === u.owner ? a : 0; continue; }
    if ((m = seg.match(/^While (\d+) or more enemy Units are in play, this Unit gains ?<([A-Za-z\- ]+)>\.?$/))) { const n = +m[1], kw = m[2]; e.kw = (g, u, k) => (k === kw && u.owner.opp.units.length >= n) ? 1 : 0; continue; }
    if ((m = seg.match(/^This Unit can't choose the enemy player as its attack target\.?$/))) { e.noAttackPlayer = true; continue; }
    if ((m = seg.match(/^This Unit may choose an active enemy Unit that is Lv\.(\d+) or lower as its attack target\.?$/))) { const lv = +m[1]; e.permActive = (g, t) => t.def.lv <= lv; continue; }
    if ((m = seg.match(/^While you have another \(([^)]+)\) Unit in play, this Unit gets AP\+(\d+)(?: and <([A-Za-z\- ]+?)(?: (\d+))?>)?\.?$/))) { const tr = m[1], a = +m[2], kw = m[3], n = m[4] ? +m[4] : 1; const on = (g, u) => u.owner.units.some(x => x !== u && g.hasTrait(x, tr)); e.ap = (g, u) => on(g, u) ? a : 0; if (kw) e.kw = (g, u, k) => (k === kw && on(g, u)) ? n : 0; continue; }
    if ((m = seg.match(/^While (?:another friendly|you have another) \(([^)]+)\) Unit is in play, this Unit gains ?<([A-Za-z\- ]+?)(?: (\d+))?>\.?$/))) { const tr = m[1], kw = m[2], n = m[3] ? +m[3] : 1; e.kw = (g, u, k) => (k === kw && u.owner.units.some(x => x !== u && g.hasTrait(x, tr))) ? n : 0; continue; }
    if ((m = seg.match(/^While you are Lv\.(\d+) or higher, this Unit gets AP\+(\d+)\.?$/))) { const lv = +m[1], a = +m[2]; e.ap = (g, u) => g.level(u.owner) >= lv ? a : 0; continue; }
    if ((m = seg.match(/^While this Unit is (?:\(([^)]+)\)|(blue|green|red|white|purple)), it gains ?<([A-Za-z\- ]+?)(?: (\d+))?>\.?$/)) && def.type === 'PILOT') { const tr = m[1], col = m[2] ? m[2][0].toUpperCase() + m[2].slice(1) : null, kw = m[3], n = m[4] ? +m[4] : 1;
      e.p_kw = (g, u, k) => (k === kw && (tr ? g.hasTrait(u, tr) : u.def.color === col)) ? n : 0; continue; }
    if ((m = seg.match(/^While you have another \(([^)]+)\) Unit in play, this gets AP\+(\d+)\.?$/)) && def.type === 'PILOT') { const tr = m[1], a = +m[2]; e.p_ap = (g, u) => u.owner.units.some(x => x !== u && g.hasTrait(x, tr)) ? a : 0; continue; }
    if ((m = seg.match(/^【Activate･Main】<Support (\d+)>/))) { const n = +m[1];
      e.activate = { cost: 0, can: (g, p, u) => !u.rested && p.units.some(x => x !== u && g.canAttackThisTurn(x)),
        score: (g, p, u) => { if (g.canAttackThisTurn(u) && g.ap(u) >= 3) return -1; let s = -0.2; for (const a of p.units) { if (a === u || !g.canAttackThisTurn(a)) continue; for (const t of p.opp.units) if (t.rested && g.ap(a) < g.hpLeft(t) && g.ap(a) + n >= g.hpLeft(t)) s = Math.max(s, p.ai.unitValue(g, t) * 0.8); } return s; },
        run: (g, p, u) => { u.rested = true; let best = null, bv = -1; for (const a of p.units) { if (a === u || !g.canAttackThisTurn(a)) continue; let v = g.ap(a) * 0.05; for (const t of p.opp.units) if (t.rested && g.ap(a) < g.hpLeft(t) && g.ap(a) + n >= g.hpLeft(t)) v = Math.max(v, p.ai.unitValue(g, t)); if (v > bv) { bv = v; best = a; } } if (best) best.tAP += n; } };
      continue; }
    if ((m = seg.match(/^(?:【During (Link|Pair)】)?(?:【Once per Turn】)?During your turn, when this Unit destroys an enemy Unit with battle damage, (.+)$/))) {
      const need = m[1]; let body = m[2]; body = body.charAt(0).toUpperCase() + body.slice(1); const b = parseBody(body, TOKEN); if (!b) { ok = false; failed.push(seg); continue; }
      const once = /Once per Turn/.test(seg);
      const fn = (g, u) => { if (g.turnPlayer !== u.owner) return; if (need && !(need === 'Link' ? u.linked : !!u.pilot)) return; if (once) { if (u.once.has('obk')) return; u.once.add('obk'); } b.run(g, u.owner, u); };
      if (def.type === 'PILOT') e.p_onBattleKill = fn; else e.onBattleKill = fn; continue; }
    if ((m = seg.match(/^【(When Paired|During Pair)･\(([^)]+)\) Pilot】(.+)$/)) && def.type === 'UNIT') {
      const tr = m[2]; let rest = m[3];
      if (m[1] === 'When Paired') { const b = parseBody(rest, TOKEN); if (!b) { ok = false; failed.push(seg); continue; }
        e.whenPaired = (g, u, pd) => { if ((pd.traits || []).includes(tr)) b.run(g, u.owner, u); }; e.ai_whenPaired = (g, p, u) => b.val(g, p, u) * 0.8; continue; }
      let mm;
      if ((mm = rest.match(/^This Unit gets AP\+(\d+)( and HP\+(\d+))?\.?$/))) { const a = +mm[1], h = mm[3] ? +mm[3] : 0; e.ap = (g, u) => (u.pilot && (u.pilot.traits || []).includes(tr)) ? a : 0; e.hp = (g, u) => (u.pilot && (u.pilot.traits || []).includes(tr)) ? h : 0; continue; }
      if ((mm = rest.match(/^This Unit gains ?<([A-Za-z\- ]+?)(?: (\d+))?>\.?$/))) { const kw = mm[1], n = mm[2] ? +mm[2] : 1; e.kw = (g, u, k) => (k === kw && u.pilot && (u.pilot.traits || []).includes(tr)) ? n : 0; continue; }
      ok = false; failed.push(seg); continue; }
    ok = false; failed.push(seg);
  }
  return ok ? e : { failed };
}
module.exports = { compileCard, grantActive };
