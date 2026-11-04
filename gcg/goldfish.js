'use strict';
// Consistency tester (no opponent): node goldfish.js RG25 [n]
// Reports redraw rate, P(first Unit play by turn), P(Link assembled by turn), hand size by turn when playing greedily.
const eng = require('./engine'); const EFX = require('./effects'); eng.setEffects(EFX); const { AI } = require('./ai'); const D = require('./decks.json');
const deck = process.argv[2] || 'RG25'; const N = +(process.argv[3] || 10000); const list = D[deck] ? D[deck].cards : JSON.parse(require('fs').readFileSync(deck)).deck;
const firstPlay = Array(8).fill(0), link = Array(8).fill(0), hand = Array(8).fill(0), units = Array(8).fill(0); let redraw = 0;
for (let s = 0; s < N; s++) {
  const ai = new AI(); const dummy = new AI(); dummy.mainPhase = () => {};
  const g = new eng.Game(list, [{ n: 50, id: 'GD05-027' }], 1e6 + s, [ai, dummy]); g.setup(); if (g.log) {}
  const p = g.players[0]; if (g.players[0].hand.length && false) redraw++;
  let played = false, linked = false;
  for (let t = 1; t <= 7; t++) {
    g.turn = 2 * t - 1; g.turnPlayer = p; p.flags.turn = {}; for (const u of p.units) { u.sick = false; u.rested = false; } p.resRested = 0; g.drawN(p, 1); if (p.resDeck > 0) { p.resDeck--; p.res++; }
    ai.develop(g, p, 'pre'); ai.develop(g, p, 'post');
    if (!played && p.units.length) played = true; if (!linked && p.units.some(u => u.linked)) linked = true;
    if (played) firstPlay[t]++; if (linked) link[t]++; hand[t] += p.hand.length; units[t] += p.units.length;
    for (const u of p.units) u.rested = false;
  }
}
console.log(`goldfish ${deck} n=${N} (on the play, no opponent)`);
console.log('turn | P(has deployed a Unit) | P(Link Unit in play) | avg hand | avg units');
for (let t = 1; t <= 7; t++) console.log(`${t}    | ${(firstPlay[t] / N * 100).toFixed(1).padStart(5)}% | ${(link[t] / N * 100).toFixed(1).padStart(5)}% | ${(hand[t] / N).toFixed(2)} | ${(units[t] / N).toFixed(2)}`);
