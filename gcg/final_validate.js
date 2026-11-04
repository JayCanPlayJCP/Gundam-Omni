'use strict';
// Fresh-seed 1,000-game validation of each optimized deck vs its starting list, against all 22 opponents.
// node final_validate.js RG25,BG74,RG418,W_LILLE_Nu,W_TKY1_BarbSF 1000
const { runMatrix } = require('./run'); const D = require('./decks.json'); const P = require('./profiles'); const OPP = require('./opp_profiles.json'); const fs = require('fs');
const decks = (process.argv[2] || 'RG25,BG74,RG418').split(','); const N = +(process.argv[3] || 1000);
const opps = Object.keys(D).filter(k => k.startsWith('W_') || k.startsWith('J_'));
(async () => {
  const out = {};
  for (const d of decks) {
    const o = JSON.parse(fs.readFileSync(`results/opt_${d}.json`));
    for (const [tag, list, prof] of [['start_balanced', D[d].cards, 'balanced'], ['start_bestStyle', D[d].cards, o.profile], ['optimized', o.deck, o.profile]]) {
      const pairs = opps.filter(b => b !== d).map(b => ({ a: list, b, key: b, opts: { aiA: P[prof], aiB: P[OPP[b]] } }));
      const r = await runMatrix(pairs, N, 3141592, 2);
      const wrs = Object.values(r).map(x => x.wr); const mean = wrs.reduce((s, x) => s + x, 0) / wrs.length;
      out[`${d}|${tag}`] = { deck: list, profile: prof, mean, min: Math.min(...wrs), n75: wrs.filter(x => x >= 0.75).length, per: r };
      console.log(`${d.padEnd(14)} ${tag.padEnd(16)} style ${prof.padEnd(8)} mean ${(mean * 100).toFixed(1)}%  worst ${(Math.min(...wrs) * 100).toFixed(1)}%  >=75%: ${wrs.filter(x => x >= 0.75).length}/${wrs.length}`);
    }
  }
  fs.writeFileSync('results/final_validation.json', JSON.stringify(out, null, 1));
})();
