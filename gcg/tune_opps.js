'use strict';
// Pick, for each gauntlet deck, the AI profile that maximizes ITS win rate vs our three decks (best-response opponents).
const { runMatrix } = require('./run'); const D = require('./decks.json'); const P = require('./profiles'); const fs = require('fs');
const opps = Object.keys(D).filter(k => k.startsWith('W_') || k.startsWith('J_')); const mine = ['RG25', 'BG74', 'RG418'];
const pairs = []; for (const o of opps) for (const pn in P) for (const m of mine) pairs.push({ a: o, b: m, key: `${o}|${pn}|${m}`, opts: { aiA: P[pn] } });
runMatrix(pairs, 200, 99000, 2).then(r => {
  const best = {}; for (const o of opps) { let bp = null, bv = -1; for (const pn in P) { const v = mine.reduce((s, m) => s + r[`${o}|${pn}|${m}`].wr, 0) / mine.length; if (v > bv) { bv = v; bp = pn; } } best[o] = bp; console.log(o.padEnd(22), bp.padEnd(9), (bv * 100).toFixed(1)); }
  fs.writeFileSync('opp_profiles.json', JSON.stringify(best, null, 1));
});
