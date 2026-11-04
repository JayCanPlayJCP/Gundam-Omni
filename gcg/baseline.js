'use strict';
// node baseline.js RG25,BG74,RG418 [n] [out.json] — each deck vs all 22 gauntlet lists
const { runMatrix } = require('./run'); const D = require('./decks.json'); const fs = require('fs');
const mine = (process.argv[2] || 'RG25,BG74,RG418').split(','); const n = +(process.argv[3] || 1000); const out = process.argv[4] || 'results/baseline.json';
const opps = Object.keys(D).filter(k => k.startsWith('W_') || k.startsWith('J_'));
const pairs = []; for (const a of mine) for (const b of opps) pairs.push({ a, b, key: `${a}|${b}` });
const t0 = Date.now();
runMatrix(pairs, n, 777000, 2).then(r => {
  fs.mkdirSync('results', { recursive: true }); fs.writeFileSync(out, JSON.stringify(r, null, 1));
  for (const a of mine) {
    const rows = opps.map(b => [b, r[`${a}|${b}`]]); const mean = rows.reduce((s, [, x]) => s + x.wr, 0) / rows.length; const min = rows.reduce((m, [b, x]) => x.wr < m[1] ? [b, x.wr] : m, ['', 1]);
    console.log(`\n${a}: field mean ${(mean * 100).toFixed(1)}%  worst ${min[0]} ${(min[1] * 100).toFixed(1)}%  >=75%: ${rows.filter(([, x]) => x.wr >= 0.75).length}/${rows.length}`);
    for (const [b, x] of rows) console.log(`  ${b.padEnd(20)} ${(x.wr * 100).toFixed(1).padStart(5)}% [${(x.ci95[0] * 100).toFixed(1)}-${(x.ci95[1] * 100).toFixed(1)}] 1st ${(x.firstWR * 100).toFixed(0)} 2nd ${(x.secondWR * 100).toFixed(0)} turns ${x.avgTurns.toFixed(1)} hand6+ ${x.avgHandAt6plus?.toFixed(2)} 0-1cards ${(x.pctMainPhases6plusHand0to1 * 100).toFixed(0)}% conv2 ${x.twoShieldConversion === null ? '-' : (x.twoShieldConversion * 100).toFixed(0)}%`);
  }
  console.error('games', pairs.length * n, 'sec', ((Date.now() - t0) / 1000).toFixed(1));
});
