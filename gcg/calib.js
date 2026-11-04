'use strict';
// Track 1 calibration: Spearman rank correlation of simulated archetype strength vs real-world proxy (share + 2x major wins).
const fs = require('fs');
const ARCH = { MF: ['J_MobileFighter', 'J_MF_Kichijoji', 'J_MF_Machida', 'W_DUS_Shining', 'W_TKY3_Shining'], 'SF Blockers': ['J_SFBlockers', 'W_DC_SF', 'W_TOR_SF'],
  'Char IBO/G-P Zeon': ['J_CharIBO', 'W_MNL_GPZeon', 'W_MEX_GPZeon'], 'SF IBO': ['J_SFIBO_Chiba', 'J_SFIBO_alt', 'W_TKY1_BarbSF'], Nu: ['W_LILLE_Nu', 'W_JKT_Nu', 'J_NuAggro'],
  'BG OYW': ['J_BGOYW', 'J_BGOYW_Chelmo'], Kshatriya: ['J_KshatriyaBanshee'], EFF: ['J_EFFBanshee'], Wing: ['J_Wing_Omiya'], Justice: ['J_JusticeAerial'], Academy: ['W_BRIS_RWAcademy'], "Z'Gok": ['W_MKE_ZGok'], 'SF Victory': ['W_MEL_SFVictory'] };
const PROXY = { MF: 32.7, 'SF Blockers': 22.3, 'Char IBO/G-P Zeon': 21.5, 'SF IBO': 16.3, Nu: 15.3, 'BG OYW': 6.1, Kshatriya: 5.2, EFF: 5.2, Wing: 4.1, Justice: 3.1, Academy: 3, "Z'Gok": 2, 'SF Victory': 2 };
const rank = (xs) => { const idx = xs.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]); const r = new Array(xs.length); for (let i = 0; i < idx.length;) { let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++; for (let k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2 + 1; i = j + 1; } return r; };
const spear = (a, b) => { const ra = rank(a), rb = rank(b); const n = a.length; const ma = ra.reduce((s, x) => s + x, 0) / n, mb = rb.reduce((s, x) => s + x, 0) / n; let num = 0, da = 0, db = 0; for (let i = 0; i < n; i++) { num += (ra[i] - ma) * (rb[i] - mb); da += (ra[i] - ma) ** 2; db += (rb[i] - mb) ** 2; } return num / Math.sqrt(da * db); };
for (const f of process.argv.slice(2)) {
  const j = JSON.parse(fs.readFileSync(f)); const wr = Object.fromEntries(j.rows);
  const names = Object.keys(ARCH); const sim = names.map(a => ARCH[a].reduce((s, id) => s + (wr[id] ?? NaN), 0) / ARCH[a].length); const prox = names.map(a => PROXY[a]);
  console.log(`\n${f}: Spearman rho = ${spear(sim, prox).toFixed(3)}`);
  names.map((a, i) => [a, sim[i], prox[i]]).sort((x, y) => y[1] - x[1]).forEach(([a, s, p]) => console.log(`  ${a.padEnd(20)} sim ${(s * 100).toFixed(1)}%  proxy ${p}`));
}
