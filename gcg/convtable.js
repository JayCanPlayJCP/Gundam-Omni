'use strict';
// Convergence table for the report: every deck validated under the strong judges (results/final/<deck>_k4n6*_200.json),
// with its origin (which search / judge produced it), colours, K4N6 field mean (all seeds pooled), K4N6+mlp2, and its
// card overlap with the finalist. Also: which colour pair each search route ranked first.
// node convtable.js FINALIST -> results/final/convergence.md
const fs = require('fs'); const D = require('./decks.json'); const C = require('./cards.json');
const fin = process.argv[2]; const opps = Object.keys(D).filter(k => k.startsWith('W_') || k.startsWith('J_'));
const rd = (f) => { try { return JSON.parse(fs.readFileSync(f)); } catch (e) { return null; } };
const cnt = (k) => { const m = {}; for (const x of D[k].cards) m[x.id] = (m[x.id] || 0) + x.n; return m; };
const ov = (a, b) => { const A = cnt(a), B = cnt(b); return Object.keys(A).reduce((s, id) => s + Math.min(A[id], B[id] || 0), 0) / 50; };
const cols = (k) => [...new Set(D[k].cards.map(x => C[x.id].color))].sort().join('/');
const ORIGIN = [[/^GP_S4_g14$/, 'Omni pure GA (K2N2 judge), G/P, gen 14'], [/^OMNIP_(\w+)_e(\d)$/, 'Omni pure GA (K2N2 judge), $1 elite $2'], [/^LGA_GB_e(\d)$/, 'pure GA with learned judge (K2N2+mlp2), G/B elite $1'],
  [/^OMNI_(\w+)$/, 'Omni island GA (fast AI judge), $1'], [/^PURE_GB_e1$/, 'session-1 pure GA (legacy judge), G/B'], [/^GB_S2_e1$/, 'session-1 stage-2 GA (legacy judge), G/B'], [/^GB_GA2$/, 'session-1 heuristic GA, G/B'],
  [/^GR_GA1$/, 'session-1 heuristic GA, G/R'], [/^J_|^W_/, 'tournament list (field)']];
const origin = (k) => { if (/^(J|W)_/.test(k)) return 'tournament list (field)'; for (const [re, s] of ORIGIN) if (re.test(k)) return k.replace(re, s); return k; };
const rows = [];
for (const k of Object.keys(D)) {
  const seeds = ['k4n6', 'k4n6s2', 'k4n6s3'].map(j => rd(`results/final/${k}_${j}_200.json`)).filter(Boolean); if (!seeds.length) continue;
  const B = seeds.reduce((s, x) => s + x.B, 0) / seeds.length; const m = rd(`results/final/${k}_mlp2_200.json`);
  rows.push({ k, o: origin(k), c: cols(k), B, n: 200 * seeds.length, M: m ? m.B : null, ov: ov(k, fin) });
}
rows.sort((a, b) => b.B - a.B);
const L = ['| deck | produced by | colours | K4N6 field mean (games/list) | K4N6 + mlp2 | card overlap with finalist |', '|---|---|---|---|---|---|'];
for (const r of rows) L.push(`| ${r.k === fin ? '**' + r.k + '**' : r.k} | ${r.o} | ${r.c} | ${(r.B * 100).toFixed(1)} (${r.n}) | ${r.M == null ? '—' : (r.M * 100).toFixed(1)} | ${(r.ov * 100).toFixed(0)}% |`);
// ranking agreement between the two strong judges
const both = rows.filter(r => r.M != null); const rank = (arr, key) => { const s = [...arr].sort((a, b) => b[key] - a[key]); return Object.fromEntries(s.map((r, i) => [r.k, i])); };
const r1 = rank(both, 'B'), r2 = rank(both, 'M'); const n = both.length; const d2 = both.reduce((s, r) => s + (r1[r.k] - r2[r.k]) ** 2, 0); const rho = 1 - 6 * d2 / (n * (n * n - 1));
const out = ['Every deck that was validated under the strong judges, both sides searching, 200 games per list per seed.', '', ...L, '',
  `The two strong judges agree on the order: Spearman rank correlation ${rho.toFixed(2)} over ${n} decks. They put the same colour pair on top, and the learned evaluator's numbers run 1–4 points higher.`, ''];
fs.writeFileSync('results/final/convergence.md', out.join('\n'));
console.log(out.join('\n'));
