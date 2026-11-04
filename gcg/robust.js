'use strict';
// Robustness: optimized deck vs every opponent under EVERY opponent AI style; reports the worst style per opponent.
// node robust.js RG25 300
const { runMatrix } = require('./run'); const D = require('./decks.json'); const P = require('./profiles'); const fs = require('fs');
const d = process.argv[2]; const N = +(process.argv[3] || 300); const o = JSON.parse(fs.readFileSync(`results/opt_${d}.json`));
const opps = Object.keys(D).filter(k => (k.startsWith('W_') || k.startsWith('J_')) && k !== d);
const pairs = []; for (const b of opps) for (const pn in P) pairs.push({ a: o.deck, b, key: `${b}|${pn}`, opts: { aiA: P[o.profile], aiB: P[pn] } });
runMatrix(pairs, N, 2718281, 2).then(r => {
  let worstSum = 0, res = {}; for (const b of opps) { let w = 1, wp = ''; for (const pn in P) { const x = r[`${b}|${pn}`].wr; if (x < w) { w = x; wp = pn; } } res[b] = { worst: w, style: wp }; worstSum += w; }
  fs.writeFileSync(`results/robust_${d}.json`, JSON.stringify(res, null, 1));
  console.log(`${d}: mean of worst-style win rates ${(worstSum / opps.length * 100).toFixed(1)}%`);
});
