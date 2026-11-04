'use strict';
// Search-AI robustness check: both sides use determinized Monte Carlo search (K top options x N rollouts).
// node searchcheck.js DECK n seed prof [mode=both|ours]
const { runMatrix } = require('./run'); const D = require('./decks.json'); const P = require('./profiles'); const OPP = require('./opp_profiles.json'); const fs = require('fs'); const { W } = require('./evalfield');
const [deck, n = 40, seed = 5150000, prof = 'hyper', mode = 'both'] = process.argv.slice(2);
const opps = Object.keys(D).filter(k => k.startsWith('W_') || k.startsWith('J_')); const S = process.env.SOPTS ? JSON.parse(process.env.SOPTS) : { K: +(process.env.SK || 3), N: +(process.env.SN || 3) }; // SOPTS='{"K":4,"N":6,"ev":"results/learn/m1.json"}' with STAG=name
(async () => {
  const t0 = Date.now();
  const pairs = opps.map(b => ({ a: deck, b, key: b, opts: { aiA: P[prof], aiB: P[OPP[b]], searchA: S, searchB: mode === 'both' ? S : null }, seed: +seed }));
  const r = await runMatrix(pairs, +n, +seed, 2); const wrs = opps.map(b => r[b].wr); const s = [...wrs].sort((a, b) => a - b);
  const B = wrs.reduce((a, b) => a + b, 0) / wrs.length, A = opps.reduce((a, b) => a + W[b] * r[b].wr, 0);
  const out = { deck, mode, n: +n, B, A, min: s[0], minOpp: opps[wrs.indexOf(s[0])], per: Object.fromEntries(opps.map(b => [b, r[b].wr])), first: Object.fromEntries(opps.map(b => [b, r[b].firstWR])), second: Object.fromEntries(opps.map(b => [b, r[b].secondWR])) };
  out.S = S; out.seed = +seed; fs.writeFileSync(process.env.SOUT || `results/search_${mode}_${deck}${process.env.STAG ? '_' + process.env.STAG : process.env.SK ? '_k' + process.env.SK + 'n' + process.env.SN : ''}.json`, JSON.stringify(out, null, 1));
  console.log(`${deck} search(${mode}) n=${n}/opp: B ${(B * 100).toFixed(1)} A ${(A * 100).toFixed(1)} min ${(s[0] * 100).toFixed(1)} ${out.minOpp} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
})();
