'use strict';
// Targeted tech screen under the search AI: swap `copies` of each candidate into a base deck (replacing the given
// victims) and measure win rate vs a chosen opponent subset (default: the fast Zeon lists). Then confirm the top
// candidates on the whole field. node tscreen.js BASE "victim:n,victim:n" "cand1,cand2,..." [n] [opps]
const { runMatrix } = require('./run'); const D = require('./decks.json'); const C = require('./cards.json'); const P = require('./profiles'); const OPP = require('./opp_profiles.json'); const fs = require('fs');
const [base, vict, cands, nStr, oppStr] = process.argv.slice(2); const n = +(nStr || 80);
const opps = (oppStr || 'W_MEX_GPZeon,W_MNL_GPZeon,J_CharIBO,W_MKE_ZGok,J_BGOYW_Chelmo,J_BGOYW').split(',');
const field = Object.keys(D).filter(k => k.startsWith('W_') || k.startsWith('J_'));
const S = { K: 2, N: 2 }; const m0 = {}; for (const { n: k, id } of D[base].cards) m0[id] = (m0[id] || 0) + k;
const V = vict.split(',').map(x => x.split(':')).map(([id, k]) => [id, +k]); const copies = V.reduce((s, [, k]) => s + k, 0);
const mk = (id) => { const m = { ...m0 }; for (const [v, k] of V) { m[v] -= k; if (m[v] <= 0) delete m[v]; } m[id] = (m[id] || 0) + copies; return Object.entries(m).map(([i, k]) => ({ n: k, id: i })); };
async function ev(list, os, nn, seed) { const pairs = os.map(b => ({ a: list, b, key: b, seed, opts: { aiA: P.hyper, aiB: P[OPP[b]], searchA: S, searchB: S } })); const r = await runMatrix(pairs, nn, seed, 2); return os.reduce((s, b) => s + r[b].wr, 0) / os.length; }
(async () => {
  const t0 = Date.now(); const seed = 4040000;
  const b0 = await ev(D[base].cards, opps, n, seed); console.log(`base ${base} vs subset: ${(b0 * 100).toFixed(1)}%`);
  const res = [];
  for (const id of cands.split(',')) { if ((m0[id] || 0) + copies > (id === 'ST02-016' ? 2 : 4)) continue; const w = await ev(mk(id), opps, n, seed); res.push({ id, name: C[id].name, w, d: w - b0 }); console.log(`${id} ${C[id].name.padEnd(34)} ${(w * 100).toFixed(1)}%  ${((w - b0) * 100).toFixed(1)}`); }
  res.sort((a, b) => b.d - a.d);
  const top = res.slice(0, 4).filter(r => r.d > 0); const fb = await ev(D[base].cards, field, 40, seed + 77); console.log(`\nfield check (n=40/opp): base ${(fb * 100).toFixed(1)}%`);
  for (const r of top) { r.field = await ev(mk(r.id), field, 40, seed + 77); console.log(`${r.id} ${r.name.padEnd(34)} field ${(r.field * 100).toFixed(1)}%  ${((r.field - fb) * 100).toFixed(1)}`); }
  fs.writeFileSync(`results/tscreen_${base}.json`, JSON.stringify({ base, b0, fb, res }, null, 1)); console.log('sec', ((Date.now() - t0) / 1000).toFixed(0));
})();
