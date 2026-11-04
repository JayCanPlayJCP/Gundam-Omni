'use strict';
// Final fresh-seed matrix: each listed deck (with its piloting style) vs all 22 gauntlet lists, N games each.
// node final_matrix.js "RG25:balanced,RG25:aggro,RG25_opt1:aggro,..." 1000 out.json
const { runMatrix } = require('./run'); const D = require('./decks.json'); const P = require('./profiles'); const OPP = require('./opp_profiles.json'); const fs = require('fs');
const specs = process.argv[2].split(',').map(s => s.split(':')); const N = +(process.argv[3] || 1000); const out = process.argv[4] || 'results/final_matrix.json';
const opps = Object.keys(D).filter(k => k.startsWith('W_') || k.startsWith('J_'));
(async () => {
  const res = {};
  for (const [d, prof] of specs) {
    const pairs = opps.filter(b => b !== d).map(b => ({ a: D[d].cards, b, key: b, opts: { aiA: P[prof], aiB: P[OPP[b]] } }));
    const r = await runMatrix(pairs, N, 8675309, 2); const wrs = Object.values(r).map(x => x.wr);
    const agg = (k) => { const v = Object.values(r).map(x => x[k]).filter(x => x !== null); return v.reduce((s, x) => s + x, 0) / v.length; };
    res[`${d}:${prof}`] = { deck: d, style: prof, mean: wrs.reduce((s, x) => s + x, 0) / wrs.length, min: Math.min(...wrs), n75: wrs.filter(x => x >= 0.75).length, nOpp: wrs.length,
      hand6: agg('avgHandAt6plus'), low01: agg('pctMainPhases6plusHand0to1'), conv2: agg('twoShieldConversion'), first: agg('firstWR'), second: agg('secondWR'), turns: agg('avgTurns'), per: r };
    const x = res[`${d}:${prof}`];
    console.log(`${(d + ':' + prof).padEnd(22)} mean ${(x.mean * 100).toFixed(1)}% worst ${(x.min * 100).toFixed(1)}% >=75% ${x.n75}/${x.nOpp} | 1st ${(x.first * 100).toFixed(1)} 2nd ${(x.second * 100).toFixed(1)} | hand@6+ ${x.hand6.toFixed(2)} 0-1cards ${(x.low01 * 100).toFixed(0)}% | 2-shield conv ${(x.conv2 * 100).toFixed(0)}%`);
  }
  fs.writeFileSync(out, JSON.stringify(res, null, 1));
})();
