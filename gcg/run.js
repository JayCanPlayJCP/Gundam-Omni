'use strict';
// Batch runner: node run.js --a RG25 --b J_SFBlockers --n 1000 [--seed 1] [--workers 2] [--json out.json]
// Seat-balanced: game i uses seed base+floor(i/2); even i => A first, odd i => A second (same seed both seats).
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const path = require('path');

function wilson(k, n, z = 1.96) { if (!n) return [0, 0]; const p = k / n; const d = 1 + z * z / n; const c = p + z * z / (2 * n); const r = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)); return [(c - r) / d, (c + r) / d]; }
function emptyAgg() { return { cards: {}, n: 0, win: 0, loss: 0, draw: 0, firstN: 0, firstW: 0, secondN: 0, secondW: 0, turns: 0, h6: 0, h6n: 0, h6low: 0, reached2: 0, conv: 0, oppReached2: 0, extra: 0, reasons: {} }; }
function addRes(A, r) {
  A.n++; A[r.res]++; if (r.first) { A.firstN++; if (r.res === 'win') A.firstW++; } else { A.secondN++; if (r.res === 'win') A.secondW++; }
  A.turns += r.turns; for (const h of r.hands6) { A.h6 += h; A.h6n++; if (h <= 1) A.h6low++; }
  if (r.reached2) { A.reached2++; if (r.conv) A.conv++; } if (r.oppReached2) A.oppReached2++; A.extra += r.extra;
  A.reasons[r.reason] = (A.reasons[r.reason] || 0) + 1;
  if (r.deckIds) for (const id of r.deckIds) { const c = A.cards[id] || (A.cards[id] = [0, 0, 0, 0]); const s = (r.seen[id] || 0) > 0; const w = r.res === 'win' ? 1 : 0; if (s) { c[0]++; c[1] += w; } else { c[2]++; c[3] += w; } }
}
function merge(a, b) { for (const k in b) { if (k === 'cards') { for (const id in b.cards) { const x = a.cards[id] || (a.cards[id] = [0, 0, 0, 0]); for (let i = 0; i < 4; i++) x[i] += b.cards[id][i]; } } else if (k === 'reasons') { for (const r in b.reasons) a.reasons[r] = (a.reasons[r] || 0) + b.reasons[r]; } else a[k] += b[k]; } return a; }
function summarize(A) {
  const [lo, hi] = wilson(A.win, A.n);
  return { n: A.n, win: A.win, loss: A.loss, draw: A.draw, wr: A.win / A.n, ci95: [lo, hi], firstWR: A.firstW / Math.max(1, A.firstN), secondWR: A.secondW / Math.max(1, A.secondN),
    avgTurns: A.turns / A.n, avgHandAt6plus: A.h6n ? A.h6 / A.h6n : null, pctMainPhases6plusHand0to1: A.h6n ? A.h6low / A.h6n : null,
    reachedOpp2Shields: A.reached2 / A.n, twoShieldConversion: A.reached2 ? A.conv / A.reached2 : null, avgExtraCards: A.extra / A.n, reasons: A.reasons, cards: A.cards };
}

if (!isMainThread) {
  const { playGame } = require('./sim');
  const { jobs } = workerData; const out = [];
  for (const j of jobs) { const A = emptyAgg(); for (let i = j.from; i < j.to; i++) { const seed = j.seed + Math.floor(i / 2); const g = playGame(j.a, j.b, seed, i % 2 === 0, j.opts || {}); if (j.opts && j.opts.cardStats) g.deckIds = [...new Set((typeof j.a === 'string' ? require('./decks.json')[j.a].cards : j.a).map(x => x.id))]; addRes(A, g); } out.push({ key: j.key, agg: A }); }
  parentPort.postMessage(out);
} else {
  module.exports = { runMatrix, summarize, wilson };
}
// runMatrix(pairs:[{a,b,opts}], n, seed, workers) -> {key: summary}
function runMatrix(pairs, n = 1000, seed = 1000, workers = 2) {
  if (process.env.SIM_WORKERS) workers = Math.max(1, +process.env.SIM_WORKERS); // e.g. SIM_WORKERS=$(nproc) on a bigger machine
  return new Promise((resolve, reject) => {
    const jobs = []; for (const pr of pairs) { const key = pr.key || `${typeof pr.a === 'string' ? pr.a : 'custom'}|${pr.b}`; const chunk = Math.ceil(n / workers / 2) * 2; for (let f = 0; f < n; f += chunk) jobs.push({ key, a: pr.a, b: pr.b, opts: pr.opts, from: f, to: Math.min(n, f + chunk), seed: pr.seed ?? seed }); }
    const buckets = Array.from({ length: workers }, () => []); jobs.forEach((j, i) => buckets[i % workers].push(j));
    const res = {}; let done = 0;
    for (const b of buckets) {
      const w = new Worker(__filename, { workerData: { jobs: b } });
      w.on('message', (out) => { for (const o of out) res[o.key] = res[o.key] ? merge(res[o.key], o.agg) : o.agg; });
      w.on('error', reject);
      w.on('exit', () => { if (++done === workers) { const s = {}; for (const k in res) s[k] = summarize(res[k]); resolve(s); } });
    }
  });
}
if (isMainThread && require.main === module) {
  const args = Object.fromEntries(process.argv.slice(2).reduce((acc, x, i, arr) => (x.startsWith('--') ? acc.concat([[x.slice(2), arr[i + 1]]]) : acc), []));
  const t0 = Date.now();
  runMatrix([{ a: args.a, b: args.b }], +(args.n || 1000), +(args.seed || 1000), +(args.workers || 2)).then(r => { console.log(JSON.stringify(r, null, 1)); console.error('ms', Date.now() - t0); });
}
