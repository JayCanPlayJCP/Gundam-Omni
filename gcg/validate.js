'use strict';
// Final validation for one deck: 1000 fresh-seed games per field opponent (seat-balanced), card-level stats,
// plus metric A/B. node validate.js DECK N SEED PROF OUT
const { runMatrix } = require('./run'); const D = require('./decks.json'); const P = require('./profiles'); const OPP = require('./opp_profiles.json'); const fs = require('fs');
const { W } = require('./evalfield');
const [deck, n = 1000, seed = 8800000, prof = 'hyper', out] = process.argv.slice(2);
const opps = Object.keys(D).filter(k => k.startsWith('W_') || k.startsWith('J_'));
(async () => {
  const t0 = Date.now();
  const pairs = opps.map(b => ({ a: deck, b, key: b, opts: { aiA: P[prof], aiB: P[OPP[b]], cardStats: true }, seed: +seed }));
  const r = await runMatrix(pairs, +n, +seed, 2);
  const per = {}; const cards = {};
  for (const b of opps) { const x = r[b]; per[b] = { wr: x.wr, ci95: x.ci95, firstWR: x.firstWR, secondWR: x.secondWR, avgTurns: x.avgTurns, hand6: x.avgHandAt6plus, low6: x.pctMainPhases6plusHand0to1, conv2: x.twoShieldConversion, reasons: x.reasons };
    for (const id in x.cards) { const c = cards[id] || (cards[id] = [0, 0, 0, 0]); for (let i = 0; i < 4; i++) c[i] += x.cards[id][i]; } }
  const wrs = opps.map(b => per[b].wr); const s = [...wrs].sort((a, b) => a - b);
  const B = wrs.reduce((a, b) => a + b, 0) / wrs.length, A = opps.reduce((a, b) => a + W[b] * per[b].wr, 0);
  const res = { deck, n: +n, seed: +seed, prof, metricB: B, metricA: A, min: s[0], minOpp: opps[wrs.indexOf(s[0])], b5: s.slice(0, 5).reduce((a, b) => a + b, 0) / 5, per, cards, sec: (Date.now() - t0) / 1000 };
  fs.writeFileSync(out || `results/validate_${deck}.json`, JSON.stringify(res, null, 1));
  console.log(`${deck}: B ${(B * 100).toFixed(1)} A ${(A * 100).toFixed(1)} b5 ${(res.b5 * 100).toFixed(1)} min ${(s[0] * 100).toFixed(1)} ${res.minOpp} (${res.sec.toFixed(0)}s)`);
})();
