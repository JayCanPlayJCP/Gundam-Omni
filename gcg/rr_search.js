'use strict';
// Round robin of the real gauntlet lists; mode=heur|search; each deck uses its best-response AI style.
const { runMatrix } = require('./run'); const D = require('./decks.json'); const P = require('./profiles'); const OPP = require('./opp_profiles.json'); const fs = require('fs');
const mode = process.argv[2] || 'heur'; const n = +(process.argv[3] || 40); const out = process.argv[4] || `results/rr_${mode}.json`;
const ids = Object.keys(D).filter(k => k.startsWith('W_') || k.startsWith('J_'));
const S = mode === 'search' ? { K: 3, N: 3 } : null;
const pairs = []; for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) pairs.push({ a: ids[i], b: ids[j], key: `${ids[i]}|${ids[j]}`, opts: { aiA: P[OPP[ids[i]]], aiB: P[OPP[ids[j]]], searchA: S, searchB: S } });
const t0 = Date.now();
runMatrix(pairs, n, 2024, 2).then(r => {
  const sc = {}; for (const id of ids) sc[id] = { w: 0, n: 0 };
  for (const k in r) { const [a, b] = k.split('|'); sc[a].w += r[k].win; sc[a].n += r[k].n; sc[b].w += r[k].loss; sc[b].n += r[k].n; }
  const rows = ids.map(id => [id, sc[id].w / sc[id].n]).sort((a, b) => b[1] - a[1]);
  fs.writeFileSync(out, JSON.stringify({ rows, raw: r }, null, 1));
  for (const [id, wr] of rows) console.log(id.padEnd(20), (wr * 100).toFixed(1) + '%');
  console.error('sec', ((Date.now() - t0) / 1000).toFixed(0));
});
