'use strict';
// Logistic-regression value function (Newton / IRLS with L2), trained on one or more self-play datasets.
// Split by game: games with (gid*2654435761 mod 100) < VAL% go to the held-out set (positions of one game never straddle).
// node train_lr.js OUT.json d0[,d1,...] [l2=1e-2] [val=15]
// Prints train / held-out log-loss and accuracy, plus baselines (constant, hand-written evaluate as one feature).
const fs = require('fs'); const { NAMES } = require('./valuefn');
function loadSets(list) {
  const parts = list.split(',').map(base => { const m = JSON.parse(fs.readFileSync(base + '.meta.json'));
    if (m.names.join() !== NAMES.join()) throw new Error('feature names differ: ' + base);
    const rd = (ext, T) => new T(fs.readFileSync(base + ext).buffer.slice(0));
    return { m, X: rd('.x.f32', Float32Array), y: rd('.y.f32', Float32Array), g: rd('.g.i32', Int32Array), tag: base }; });
  const F = NAMES.length; const n = parts.reduce((s, p) => s + p.y.length, 0); const X = new Float32Array(n * F), y = new Float32Array(n), g = new Float64Array(n); let o = 0;
  parts.forEach((p, k) => { X.set(p.X, o * F); y.set(p.y, o); for (let i = 0; i < p.y.length; i++) g[o + i] = p.g[i] + 1e6 * (k + 1) * (p.m.seed || 1); o += p.y.length; });
  return { X, y, g, n, F, sets: parts.map(p => ({ tag: p.tag, rows: p.m.rows, games: p.m.games, ai: p.m.ai })) };
}
const isVal = (gid, pct) => ((Math.imul(gid >>> 0, 2654435761) >>> 0) % 100) < pct;
function cholSolve(A, b, d) { // A (d x d, row-major) SPD; returns x
  const L = new Float64Array(d * d);
  for (let i = 0; i < d; i++) for (let j = 0; j <= i; j++) { let s = A[i * d + j]; for (let k = 0; k < j; k++) s -= L[i * d + k] * L[j * d + k]; L[i * d + j] = i === j ? Math.sqrt(Math.max(s, 1e-12)) : s / L[j * d + j]; }
  const z = new Float64Array(d); for (let i = 0; i < d; i++) { let s = b[i]; for (let k = 0; k < i; k++) s -= L[i * d + k] * z[k]; z[i] = s / L[i * d + i]; }
  const x = new Float64Array(d); for (let i = d - 1; i >= 0; i--) { let s = z[i]; for (let k = i + 1; k < d; k++) s -= L[k * d + i] * x[k]; x[i] = s / L[i * d + i]; }
  return x;
}
// fit on rows idx with feature columns cols (standardized); returns {w (cols), b}
function fit(Z, y, idx, cols, F, l2, iters = 12) {
  const d = cols.length + 1; let w = new Float64Array(d);
  for (let it = 0; it < iters; it++) {
    const Hm = new Float64Array(d * d), gr = new Float64Array(d); const x = new Float64Array(d); x[d - 1] = 1;
    for (const i of idx) { for (let k = 0; k < cols.length; k++) x[k] = Z[i * F + cols[k]]; let s = 0; for (let k = 0; k < d; k++) s += w[k] * x[k]; const p = 1 / (1 + Math.exp(-s)); const r = p - y[i]; const q = Math.max(p * (1 - p), 1e-6);
      for (let a = 0; a < d; a++) { gr[a] += r * x[a]; const qa = q * x[a]; for (let c = 0; c <= a; c++) Hm[a * d + c] += qa * x[c]; } }
    for (let a = 0; a < d; a++) for (let c = 0; c < a; c++) Hm[c * d + a] = Hm[a * d + c];
    const nI = idx.length; for (let a = 0; a < d - 1; a++) { Hm[a * d + a] += l2 * nI; gr[a] += l2 * nI * w[a]; }
    const step = cholSolve(Hm, gr, d); let mx = 0; for (let a = 0; a < d; a++) { w[a] -= step[a]; mx = Math.max(mx, Math.abs(step[a])); } if (mx < 1e-6) break;
  }
  return { w: Array.from(w.slice(0, d - 1)), b: w[d - 1] };
}
function score(Z, y, idx, cols, F, mdl) { let ll = 0, acc = 0, n = 0; for (const i of idx) { if (y[i] === 0.5) continue; let s = mdl.b; for (let k = 0; k < cols.length; k++) s += mdl.w[k] * Z[i * F + cols[k]]; const p = Math.min(1 - 1e-7, Math.max(1e-7, 1 / (1 + Math.exp(-s)))); ll -= y[i] * Math.log(p) + (1 - y[i]) * Math.log(1 - p); acc += (p > 0.5) === (y[i] > 0.5) ? 1 : 0; n++; } return { logloss: ll / n, acc: acc / n, n }; }
if (require.main === module) {
  const [out, sets, l2s, vals] = process.argv.slice(2); const l2 = +(l2s || 1e-2), VAL = +(vals || 15); const t0 = Date.now();
  const { X, y, g, n, F, sets: meta } = loadSets(sets);
  const tr = [], va = []; for (let i = 0; i < n; i++) (isVal(g[i], VAL) ? va : tr).push(i);
  const mu = new Array(F).fill(0), sd = new Array(F).fill(0);
  for (const i of tr) for (let j = 0; j < F; j++) mu[j] += X[i * F + j]; for (let j = 0; j < F; j++) mu[j] /= tr.length;
  for (const i of tr) for (let j = 0; j < F; j++) { const d = X[i * F + j] - mu[j]; sd[j] += d * d; } for (let j = 0; j < F; j++) sd[j] = Math.sqrt(sd[j] / tr.length) || 1;
  const Z = new Float32Array(n * F); for (let i = 0; i < n; i++) for (let j = 0; j < F; j++) Z[i * F + j] = (X[i * F + j] - mu[j]) / sd[j];
  const all = NAMES.map((_, j) => j); const hcol = [NAMES.indexOf('handEval')];
  const mH = fit(Z, y, tr, hcol, F, 0); const mA = fit(Z, y, tr, all, F, l2);
  const R = { baseline_const: { logloss: Math.log(2), acc: 0.5 }, handEval_only: { train: score(Z, y, tr, hcol, F, mH), val: score(Z, y, va, hcol, F, mH) }, lr: { train: score(Z, y, tr, all, F, mA), val: score(Z, y, va, all, F, mA) } };
  const model = { type: 'lr', names: NAMES, mu, sd, w: mA.w, b: mA.b, l2, trainedOn: meta, rows: { train: tr.length, val: va.length }, metrics: R, created: new Date().toISOString() };
  fs.writeFileSync(out, JSON.stringify(model));
  const f = (s) => `logloss ${s.logloss.toFixed(4)} acc ${(s.acc * 100).toFixed(1)}%`;
  console.log(`train ${tr.length} / held-out ${va.length} positions (${(Date.now() - t0) / 1000 | 0}s)`);
  console.log(`  hand-written evaluate (1 feature): train ${f(R.handEval_only.train)} | held-out ${f(R.handEval_only.val)}`);
  console.log(`  logistic regression (${F} feats):  train ${f(R.lr.train)} | held-out ${f(R.lr.val)}`);
  const top = mA.w.map((w, j) => [NAMES[j], w]).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 15);
  console.log('  largest standardized weights: ' + top.map(([k, w]) => `${k} ${w.toFixed(2)}`).join(', '));
}
module.exports = { loadSets, isVal };
