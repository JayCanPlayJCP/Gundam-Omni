'use strict';
// Matchup analysis for a play guide: DECK vs each OPP, both sides on the given search AI.
// For each matchup: win rate first / second, game length, how games end, and card-level "seen vs not seen" win-rate
// deltas for both decks (cards drawn / played in a game vs not), which point at the cards that decide the matchup.
// node matchup.js DECK OPP1,OPP2,... [n=200] [seed=6161000] ['{"K":2,"N":2}'] -> results/final/matchup_DECK.json
const { runMatrix } = require('./run'); const D = require('./decks.json'); const C = require('./cards.json'); const P = require('./profiles'); const OPP = require('./opp_profiles.json'); const fs = require('fs');
const [deck, oppStr, nStr, seedStr, sStr] = process.argv.slice(2); const n = +(nStr || 200), seed = +(seedStr || 6161000); const S = sStr ? JSON.parse(sStr) : { K: 2, N: 2 };
const oppsL = oppStr.split(',');
(async () => {
  const t0 = Date.now();
  const pairs = [];
  for (const o of oppsL) {
    pairs.push({ a: deck, b: o, key: 'F|' + o, seed, opts: { aiA: P.hyper, aiB: P[OPP[o] || 'hyper'], searchA: S, searchB: S, cardStats: true } });
    pairs.push({ a: o, b: deck, key: 'O|' + o, seed, opts: { aiA: P[OPP[o] || 'hyper'], aiB: P.hyper, searchA: S, searchB: S, cardStats: true } }); // same games from the other seat: opponent card stats
  }
  const r = await runMatrix(pairs, n, seed, 2); const res = {};
  const deltas = (cards, minSeen) => Object.entries(cards).map(([id, [sn, sw, nn, nw]]) => ({ id, name: C[id] ? C[id].name : id, seen: sn, wrSeen: sn ? sw / sn : null, wrNot: nn ? nw / nn : null, d: (sn >= minSeen && nn >= minSeen) ? sw / sn - nw / nn : null })).filter(x => x.d !== null).sort((a, b) => b.d - a.d);
  for (const o of oppsL) {
    const F = r['F|' + o], O = r['O|' + o]; const mine = deltas(F.cards, Math.max(8, n * 0.08)), theirs = deltas(O.cards, Math.max(8, n * 0.08));
    res[o] = { n: F.n, wr: F.wr, ci95: F.ci95, first: F.firstWR, second: F.secondWR, avgTurns: F.avgTurns, reasons: F.reasons, reachedOpp2: F.reachedOpp2Shields, conv2: F.twoShieldConversion,
      oppWrCheck: O.wr, myBest: mine.slice(0, 6), myWorst: mine.slice(-4).reverse(), theirThreats: theirs.slice(0, 6) };
    console.log(`${deck} vs ${o}: ${(F.wr * 100).toFixed(1)}% (first ${(F.firstWR * 100).toFixed(0)} / second ${(F.secondWR * 100).toFixed(0)}, ${F.avgTurns.toFixed(1)} turns) | best: ${mine.slice(0, 3).map(x => `${x.name} ${(x.d * 100).toFixed(0)}`).join(', ')} | their threats: ${theirs.slice(0, 3).map(x => `${x.name} ${(x.d * 100).toFixed(0)}`).join(', ')}`);
  }
  fs.mkdirSync('results/final', { recursive: true });
  fs.writeFileSync(`results/final/matchup_${deck}.json`, JSON.stringify({ deck, S, n, seed, res, sec: (Date.now() - t0) / 1000 }, null, 1));
})();
