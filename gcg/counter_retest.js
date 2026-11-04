'use strict';
// Re-test the best counter-deck of each counter GA (results/counter/<TARGET>_vs_<PAIR>.json) against TARGET on fresh seeds.
// node counter_retest.js TARGET [n=200] [seed=8282000] ['{"K":4,"N":6}'] -> results/counter/retest_<TARGET>_vs_<PAIR>.json
// Also stores each counter as decks.json key CTR_<TARGET>_<PAIR>.
// CSRC=OTHER: re-test the counters evolved against OTHER (results/counter/OTHER_vs_*.json) against TARGET instead
// (-> results/counter/retest_<TARGET>_from_<OTHER>_vs_<PAIR>.json).
const fs = require('fs'); const { runMatrix } = require('./run'); const P = require('./profiles'); const OPP = require('./opp_profiles.json');
const [T, nS, sS, oS] = process.argv.slice(2); const n = +(nS || 200), seed = +(sS || 8282000), S = oS ? JSON.parse(oS) : { K: 4, N: 6 };
const D = JSON.parse(fs.readFileSync('decks.json')); const SRC = process.env.CSRC || T;
(async () => {
  const files = fs.readdirSync('results/counter').filter(f => f.startsWith(SRC + '_vs_') && f.endsWith('.json'));
  for (const f of files) {
    const tag = f.slice(SRC.length + 4, -5); const out = SRC === T ? `results/counter/retest_${T}_vs_${tag}.json` : `results/counter/retest_${T}_from_${SRC}_vs_${tag}.json`; if (fs.existsSync(out)) continue;
    const j = JSON.parse(fs.readFileSync('results/counter/' + f)); const e = j.elites[0]; const key = `CTR_${SRC}_${tag}`;
    if (!D[key] || SRC === T) { const D2 = JSON.parse(fs.readFileSync('decks.json')); D2[key] = { label: `Counter-deck GA (${tag}) vs ${SRC}, elite 0; in-search ${(e.search.B * 100).toFixed(1)}% over ${e.search.n} games`, cards: e.deck }; fs.writeFileSync('decks.json', JSON.stringify(D2, null, 1)); } // re-read: other jobs write decks.json too
    const t0 = Date.now();
    const r = await runMatrix([{ a: e.deck, b: T, key: 'x', seed, opts: { aiA: P.hyper, aiB: P[OPP[T] || 'hyper'], searchA: S, searchB: S } }], n, seed, 2);
    const x = r.x; const res = { target: T, counter: key, pair: tag, n: x.n, wr: x.wr, ci95: x.ci95, first: x.firstWR, second: x.secondWR, S, seed, inSearch: e.search, sec: (Date.now() - t0) / 1000 };
    fs.writeFileSync(out, JSON.stringify(res, null, 1));
    console.log(`${key}: counter wins ${(x.wr * 100).toFixed(1)}% vs ${T} (n=${x.n}, ${JSON.stringify(S)}, CI ${(x.ci95[0] * 100).toFixed(0)}-${(x.ci95[1] * 100).toFixed(0)}); in-search ${(e.search.B * 100).toFixed(1)}% (n=${e.search.n})`);
  }
})();
