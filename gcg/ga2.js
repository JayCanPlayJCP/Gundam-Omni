'use strict';
// Multi-fidelity deck search: children are screened with the fast heuristic AI, the best are judged with the
// determinized search AI on both sides. Every evaluation is accumulated per deck (racing), so elites get more
// precise the longer they survive. Fitness = wS * searchWR + (1-wS) * heurWR, with a floor term on the worst 5.
// node ga2.js --colors Green,Blue --seeds GB_GA2,J_BGOYW_Chelmo --gens 12 --kids 20 --keep 6 --elite 4 --out results/ga2_GB.json
const { runMatrix } = require('./run'); const D = require('./decks.json'); const C = require('./cards.json');
const EFX = require('./effects'); const P = require('./profiles'); const OPP = require('./opp_profiles.json'); const fs = require('fs');
const { W } = require('./evalfield');
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, x, i, arr) => (x.startsWith('--') ? acc.concat([[x.slice(2), arr[i + 1]]]) : acc), []));
const COLORS = (args.colors || 'Green,Blue').split(','); const SEEDS = (args.seeds || '').split(',').filter(Boolean); const SEEDFILES = (args.seedfiles || '').split(',').filter(Boolean);
const GENS = +(args.gens || 12), KIDS = +(args.kids || 20), KEEP = +(args.keep || 6), ELITE = +(args.elite || 4), HN = +(args.hn || 24), SNN = +(args.sn || 24), WS = +(args.ws || 0.65);
const OUT = args.out || 'results/ga2.json', PROF = args.prof || 'hyper'; const PURE = !!+(args.pure || 0); const S = { K: +(args.k || 2), N: +(args.nr || 2) };
const LOCK = Object.fromEntries((args.lock || '').split(',').filter(Boolean).map(x => { const [id, n] = x.split(':'); return [id, +n]; }));
let rs = +(args.rseed || 7); const rnd = () => { rs = (rs * 1103515245 + 12345) & 0x7fffffff; return rs / 0x7fffffff; }; const pick = (a) => a[Math.floor(rnd() * a.length)];
const opps = Object.keys(D).filter(k => k.startsWith('W_') || k.startsWith('J_'));
const VANILLA = new Set(Object.keys(C).filter(id => (C[id].legality || '').startsWith('Vanilla')));
const POOL = Object.keys(EFX).filter(id => C[id] && COLORS.includes(C[id].color) && ['UNIT', 'PILOT', 'COMMAND', 'BASE'].includes(C[id].type) && id !== 'GD01-020' && !(C[id].legality || '').startsWith('Banned'));
const POOLSET = new Set(POOL);
const prior = {}; for (const id of POOL) prior[id] = 1;
for (const k in D) for (const { id, n } of D[k].cards) if (prior[id] !== undefined) prior[id] += (k.startsWith('W_') || k.startsWith('J_')) ? 0.6 * n : 0.3 * n;
if (args.prior) { const j = JSON.parse(fs.readFileSync(args.prior)); for (const [id, v] of Object.entries(j)) if (prior[id] !== undefined) prior[id] += v; }
const priorTot = () => POOL.reduce((s, id) => s + prior[id], 0); let PT = priorTot();
const samplePool = () => { let r = rnd() * PT; for (const id of POOL) { r -= prior[id]; if (r <= 0) return id; } return POOL[POOL.length - 1]; };
const toMap = (l) => { const m = {}; for (const { n, id } of l) m[id] = (m[id] || 0) + n; return m; };
const toList = (m) => Object.entries(m).filter(([, n]) => n > 0).map(([id, n]) => ({ n, id })).sort((a, b) => a.id.localeCompare(b.id));
const key = (m) => Object.keys(m).filter(id => m[id] > 0).sort().map(id => id + ':' + m[id]).join(',');
const cap = (id) => id === 'ST02-016' ? 2 : 4;
function legal(m) {
  let tot = 0; const col = new Set(); const van = [];
  for (const [id, n] of Object.entries(m)) { if (!n) continue; if (n < 0) return 'neg'; tot += n; col.add(C[id].color); if (!POOLSET.has(id)) return 'pool'; if (n > cap(id)) return 'copies'; if (VANILLA.has(id)) van.push(id); }
  if (tot !== 50) return 'size'; if (col.size > 2) return 'colors'; if (van.length > 1) return 'vanilla'; if ((m['ST01-010'] && m['ST05-010']) || (m['GD01-008'] && m['GD05-015'])) return 'pair';
  for (const [id, n] of Object.entries(LOCK)) if ((m[id] || 0) < n) return 'lock'; return null;
}
function repair(m) {
  for (const id in m) { if (!POOLSET.has(id)) { delete m[id]; continue; } if (m[id] > cap(id)) m[id] = cap(id); if (m[id] <= 0) delete m[id]; }
  for (const [id, n] of Object.entries(LOCK)) if ((m[id] || 0) < n) m[id] = n;
  const van = Object.keys(m).filter(id => VANILLA.has(id)); if (van.length > 1) { van.sort((a, b) => m[b] - m[a]); for (const id of van.slice(1)) delete m[id]; }
  if (m['ST01-010'] && m['ST05-010']) delete m['ST05-010']; if (m['GD01-008'] && m['GD05-015']) delete m['GD05-015'];
  let tot = Object.values(m).reduce((a, b) => a + b, 0);
  for (let g = 0; tot > 50 && g < 500; g++) { const ids = Object.keys(m).filter(id => !(LOCK[id] && m[id] <= LOCK[id])); const id = ids.reduce((a, b) => (prior[b] * (m[b] + 1) < prior[a] * (m[a] + 1) ? b : a)); m[id]--; if (!m[id]) delete m[id]; tot--; }
  for (let g = 0; tot < 50 && g < 3000; g++) { const id = rnd() < 0.6 && Object.keys(m).length ? pick(Object.keys(m)) : samplePool(); if ((m[id] || 0) >= cap(id)) continue; if (VANILLA.has(id) && Object.keys(m).some(x => x !== id && VANILLA.has(x))) continue; m[id] = (m[id] || 0) + 1; tot++; }
  return m;
}
const PACKS = [];
for (const s of SEEDS) { const m = toMap(D[s].cards); const core = Object.entries(m).filter(([, n]) => n >= 3); for (let k = 0; k < 3; k++) { const pk = {}; for (const [id, n] of core) if (rnd() < 0.3) pk[id] = n; if (Object.keys(pk).length) PACKS.push(pk); } }
if (args.packs) for (const pk of JSON.parse(fs.readFileSync(args.packs))) PACKS.push(pk);
function mutate(m0) {
  const m = { ...m0 }; const r = rnd();
  if (r < 0.12 && PACKS.length) { const pk = pick(PACKS); for (const [id, k] of Object.entries(pk)) if (POOLSET.has(id)) m[id] = Math.max(m[id] || 0, k); }
  else if (r < 0.32) { const ids = Object.keys(m); const a = pick(ids), b = pick(ids); if (a !== b && m[a] > 0 && !(LOCK[a] && m[a] <= LOCK[a])) { m[a]--; m[b] = (m[b] || 0) + 1; } }
  else { const k = r < 0.7 ? 1 : r < 0.9 ? 2 : 3; const ids = Object.keys(m).filter(id => !(LOCK[id] && m[id] <= LOCK[id])); const x = pick(ids); const y = samplePool(); const kk = Math.min(k, m[x]); m[x] -= kk; m[y] = (m[y] || 0) + kk; }
  return repair(m);
}
function crossover(a, b) { const m = {}; for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) { const x = ((a[id] || 0) + (b[id] || 0)) / 2; const v = Math.floor(x) + (rnd() < x - Math.floor(x) ? 1 : 0); if (v > 0) m[id] = v; } return repair(m); }
// accumulated evidence per deck: per opponent wins/games for heuristic (h) and search (s)
const BOOK = new Map();
const rec = (m) => { const k = key(m); if (!BOOK.has(k)) BOOK.set(k, { m, h: {}, s: {} }); return BOOK.get(k); };
function stat(r, which) { const t = r[which]; let n = 0; const wr = []; for (const b of opps) { const x = t[b]; if (!x || !x.n) return null; wr.push(x.w / x.n); n += x.n; } const s = [...wr].sort((a, b) => a - b); return { B: wr.reduce((a, b) => a + b, 0) / wr.length, A: opps.reduce((a, b, i) => a + W[b] * wr[i], 0), b5: s.slice(0, 5).reduce((a, b) => a + b, 0) / 5, min: s[0], minOpp: opps[wr.indexOf(s[0])], n: n / opps.length }; }
function fitness(r) { const h = stat(r, 'h'), s = stat(r, 's'); if (PURE) return s ? s.B + 0.3 * s.b5 - 0.15 / Math.sqrt(s.n) : -1; if (!h) return -1; const hs = h.B + 0.3 * h.b5; if (!s) return (1 - WS) * hs + WS * (hs - 0.06); return WS * (s.B + 0.3 * s.b5) + (1 - WS) * hs; }
let seedCtr = +(args.eseed || 1000000);
async function evalBatch(list, which, n) {
  const pairs = []; const sd = seedCtr; seedCtr += 7919;
  list.forEach((r, i) => { const deck = toList(r.m); for (const b of opps) pairs.push({ a: deck, b, key: i + '|' + b, seed: sd, opts: { aiA: P[PROF], aiB: P[OPP[b]], searchA: which === 's' ? S : null, searchB: which === 's' ? S : null } }); });
  const res = await runMatrix(pairs, n, sd, 2);
  list.forEach((r, i) => { for (const b of opps) { const x = res[i + '|' + b]; const t = r[which][b] || (r[which][b] = { w: 0, n: 0 }); t.w += x.win; t.n += x.n; } });
}
(async () => {
  const t0 = Date.now(); const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s]`, ...a);
  let elites = SEEDS.map(s => rec(repair(toMap(D[s].cards))));
  for (const f of SEEDFILES) { const j = JSON.parse(fs.readFileSync(f)); for (const d of [j.best && j.best.deck, ...(j.elite || []), ...((j.elites || []).map(e => e.deck))].filter(Boolean)) elites.push(rec(repair(toMap(d)))); }
  elites = elites.filter(r => !legal(r.m)); log(`colors ${COLORS} pool ${POOL.length} seeds ${elites.length} lock ${JSON.stringify(LOCK)}`);
  if (!PURE) await evalBatch(elites, 'h', HN * 2); await evalBatch(elites, 's', SNN);
  for (let gen = 0; gen < GENS; gen++) {
    // children
    const kids = []; const seen = new Set([...elites.map(r => key(r.m))]);
    for (let g = 0; kids.length < KIDS && g < 2000; g++) { const a = pick(elites).m, b = pick(elites).m; let c = rnd() < 0.4 && a !== b ? crossover(a, b) : a; c = mutate(c); if (rnd() < 0.5) c = mutate(c); if (legal(c)) continue; const k = key(c); if (seen.has(k)) continue; seen.add(k); kids.push(rec(c)); }
    let finalists;
    if (PURE) { finalists = kids; await evalBatch([...kids, ...elites], 's', SNN); }
    else {
    await evalBatch(kids, 'h', HN);
    const hsc = (r) => { const h = stat(r, 'h'); return h ? h.B + 0.3 * h.b5 : -1; };
    kids.sort((x, y) => hsc(y) - hsc(x)); finalists = kids.slice(0, KEEP);
    await evalBatch([...finalists, ...elites], 's', SNN); // elites get fresh search games every generation (racing)
    await evalBatch(elites, 'h', HN); }
    const all = [...elites, ...finalists].sort((x, y) => fitness(y) - fitness(x)); elites = all.slice(0, ELITE);
    const b = elites[0]; const hs = stat(b, 'h') || { B: 0, n: 0 }, ss = stat(b, 's');
    log(`gen ${gen} best f ${fitness(b).toFixed(3)} | heur B ${(hs.B * 100).toFixed(1)} (n${hs.n.toFixed(0)}) | search B ${(ss.B * 100).toFixed(1)} A ${(ss.A * 100).toFixed(1)} b5 ${(ss.b5 * 100).toFixed(1)} min ${(ss.min * 100).toFixed(1)} ${ss.minOpp} (n${ss.n.toFixed(0)})`);
    fs.writeFileSync(OUT, JSON.stringify({ colors: COLORS, gen, lock: LOCK, elites: elites.map(r => ({ deck: toList(r.m), heur: stat(r, 'h'), search: stat(r, 's'), f: fitness(r) })) }, null, 1));
  }
  log('done');
})();
