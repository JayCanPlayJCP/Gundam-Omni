'use strict';
// Arc pipeline: for every arc shell -> short heuristic GA (arc-favouring prior) -> search-AI check of the best list.
// Resumable: skips shells whose results/arc_<name>.done exists.  node arcpipe.js [SHELL ...]
const { execSync } = require('child_process'); const fs = require('fs'); const { SHELLS } = require('./shells');
const only = process.argv.slice(2);
for (const sh of SHELLS) {
  if (only.length && !only.includes(sh.name)) continue;
  const done = `results/arc_${sh.name}.done`; if (fs.existsSync(done)) continue;
  const t0 = Date.now();
  execSync(`node ga.js --colors ${sh.colors.join(',')} --seeds SH_${sh.name},HY_${sh.name} --prior results/prior_${sh.name}.json --gens 12 --pop 12 --n 20 --rseed ${sh.name.length * 7} --out results/arcga_${sh.name}.json > results/arcga_${sh.name}.log 2>&1`);
  const j = JSON.parse(fs.readFileSync(`results/arcga_${sh.name}.json`)); const D = JSON.parse(fs.readFileSync('decks.json'));
  D['ARC_' + sh.name] = { label: `Arc ${sh.name} after heuristic GA (fresh B ${(j.best.B * 100).toFixed(1)})`, cards: j.best.deck }; fs.writeFileSync('decks.json', JSON.stringify(D, null, 1));
  execSync(`SK=2 SN=2 node searchcheck.js ARC_${sh.name} 30 7373000 hyper both >> results/arcpipe.log 2>&1`);
  fs.writeFileSync(done, JSON.stringify({ heurB: j.best.B, sec: (Date.now() - t0) / 1000 }));
  fs.appendFileSync('results/arcpipe.log', `${sh.name} heuristic fresh B ${(j.best.B * 100).toFixed(1)} A ${(j.best.A * 100).toFixed(1)} (${((Date.now() - t0) / 1000).toFixed(0)}s)\n`);
}
fs.writeFileSync('results/arcpipe.flag', 'done');
