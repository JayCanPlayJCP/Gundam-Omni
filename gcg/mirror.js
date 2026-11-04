'use strict';
// AI-vs-AI mirror test: the same deck on both sides, AI setting X vs AI setting Y, seat-balanced on shared seeds.
// Runs over every field list (each piloted in its best style from opp_profiles.json) unless decks are given.
// node mirror.js NAME '<X sopts json|null>' '<Y sopts json|null>' [nPerDeck=16] [seed=4040000] [deck1,deck2,...]
//   e.g. node mirror.js k3n3_vs_legacy '{"K":3,"N":3}' '{"K":3,"N":3,"legacy":true}' 16
// -> results/judge/mirror_NAME.json ; prints X's win rate with a Wilson 95% interval (draws count as half).
const { runMatrix, wilson } = require('./run'); const D = require('./decks.json'); const P = require('./profiles'); const OPP = require('./opp_profiles.json'); const fs = require('fs');
const [name, xs, ys, nStr, seedStr, deckStr] = process.argv.slice(2);
const X = JSON.parse(xs), Y = JSON.parse(ys); const n = +(nStr || 16), seed = +(seedStr || 4040000);
const decks = deckStr ? deckStr.split(',') : Object.keys(D).filter(k => k.startsWith('W_') || k.startsWith('J_'));
(async () => {
  const t0 = Date.now(); fs.mkdirSync('results/judge', { recursive: true });
  const pairs = decks.map(d => { const prof = P[OPP[d] || 'hyper']; return { a: d, b: d, key: d, seed, opts: { aiA: prof, aiB: prof, searchA: X, searchB: Y } }; });
  const r = await runMatrix(pairs, n, seed, 2);
  let w = 0, dr = 0, N = 0, fw = 0, fn = 0; const per = {};
  for (const d of decks) { const x = r[d]; w += x.win; dr += x.draw; N += x.n; fw += x.firstWR * Math.ceil(x.n / 2); fn += Math.ceil(x.n / 2); per[d] = { wr: x.wr, n: x.n, draw: x.draw }; }
  const score = (w + dr / 2) / N; const ci = wilson(w + dr / 2, N);
  const out = { name, X, Y, nPerDeck: n, seed, games: N, wins: w, draws: dr, score, ci95: ci, per, sec: (Date.now() - t0) / 1000 };
  fs.writeFileSync(`results/judge/mirror_${name}.json`, JSON.stringify(out, null, 1));
  console.log(`${name}: X ${JSON.stringify(X)} vs Y ${JSON.stringify(Y)}: X scores ${(score * 100).toFixed(1)}% [${(ci[0] * 100).toFixed(1)}-${(ci[1] * 100).toFixed(1)}] over ${N} games (${w}W ${dr}D) (${out.sec.toFixed(0)}s)`);
})();
