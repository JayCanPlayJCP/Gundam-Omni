'use strict';
// Track 3/4 global search: genetic algorithm over a 2-colour pool with island seeds, crossover, package + swap mutation,
// common-random-number evaluation per generation and periodic fresh-seed re-checks of the elite (anti-overfitting).
// node ga.js --colors Green,Blue --seeds BGNU_opt2,J_BGOYW_Chelmo,GB_HYBRID_opt --gens 40 --pop 16 --n 30 --out results/ga_GB.json
const { runMatrix } = require('./run'); const D = require('./decks.json'); const C = require('./cards.json');
const EFX = require('./effects'); const P = require('./profiles'); const OPP = require('./opp_profiles.json'); const fs = require('fs');
const { W } = require('./evalfield');
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, x, i, arr) => (x.startsWith('--') ? acc.concat([[x.slice(2), arr[i + 1]]]) : acc), []));
const COLORS = (args.colors || 'Green,Blue').split(','); const SEEDS = (args.seeds || '').split(',').filter(Boolean); const SEEDFILES = (args.seedfiles || '').split(',').filter(Boolean);
const GENS = +(args.gens || 40), POP = +(args.pop || 16), N = +(args.n || 30), OUT = args.out || 'results/ga.json', PROF = args.prof || 'hyper';
const LOCK = Object.fromEntries((args.lock || '').split(',').filter(Boolean).map(x => { const [id, n] = x.split(':'); return [id, +n]; }));
let rs = +(args.rseed || 99); const rnd = () => { rs = (rs * 1103515245 + 12345) & 0x7fffffff; return rs / 0x7fffffff; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const opps = Object.keys(D).filter(k => k.startsWith('W_') || k.startsWith('J_'));
const VANILLA = new Set(Object.keys(C).filter(id => (C[id].legality || '').startsWith('Vanilla')));
const POOL = Object.keys(EFX).filter(id => C[id] && COLORS.includes(C[id].color) && ['UNIT', 'PILOT', 'COMMAND', 'BASE'].includes(C[id].type) && id !== 'GD01-020' && (C[id].legality || '') !== 'banned');
// prior weights: cards seen in tournament lists / seeds / positive screens get sampled more often
const prior = {}; for (const id of POOL) prior[id] = 1;
for (const k in D) for (const { id, n } of D[k].cards) if (prior[id] !== undefined) prior[id] += k.startsWith('W_') || k.startsWith('J_') ? 0.6 * n : 0.3 * n;
for (const f of fs.readdirSync('results').filter(f => f.startsWith('screen_') && f.endsWith('.json'))) { try { const j = JSON.parse(fs.readFileSync('results/' + f)); for (const r of (j.conf || [])) if (prior[r.id] !== undefined && r.cd > 0) prior[r.id] += 6; for (const r of (j.res || []).slice(0, 25)) if (prior[r.id] !== undefined) prior[r.id] += 2; } catch (e) { } }
if (args.prior) { const j = JSON.parse(fs.readFileSync(args.prior)); for (const [id, v] of Object.entries(j)) if (prior[id] !== undefined) prior[id] += v; }
const priorTot = POOL.reduce((s, id) => s + prior[id], 0);
const samplePool = () => { let r = rnd() * priorTot; for (const id of POOL) { r -= prior[id]; if (r <= 0) return id; } return POOL[POOL.length - 1]; };
const PACKAGES = [
  { 'ST03-016': 4, 'GD01-026': 3, 'ST03-006': 4, 'ST03-011': 4 }, { 'ST03-011': 4, 'ST03-016': 4 }, { 'GD05-086': 3 }, { 'GD01-100': 3 }, { 'GD06-123': 2 }, { 'GD02-125': 2 },
  { 'GD05-017': 3, 'GD05-085': 3, 'GD05-019': 3 }, { 'GD06-019': 2, 'GD06-085': 3 }, { 'GD06-021': 3, 'GD06-109': 3 }, { 'GD04-008': 3, 'ST01-010': 3 }, { 'GD01-024': 2, 'ST02-010': 2 },
  { 'GD05-018': 2, 'ST13-012': 3 }, { 'GD06-105': 4 }, { 'GD06-107': 3, 'GD06-031': 3 }, { 'GD01-108': 2 }, { 'ST01-001': 3, 'ST01-010': 4 }, { 'GD01-008': 4 }, { 'ST03-007': 4 }, { 'GD05-027': 4, 'GD05-029': 4 },
].filter(pk => Object.keys(pk).every(id => POOL.includes(id)));
const toMap = (l) => { const m = {}; for (const { n, id } of l) m[id] = (m[id] || 0) + n; return m; };
const toList = (m) => Object.entries(m).filter(([, n]) => n > 0).map(([id, n]) => ({ n, id }));
const key = (m) => Object.keys(m).filter(id => m[id] > 0).sort().map(id => id + ':' + m[id]).join(',');
function legal(m) {
  let tot = 0; const col = new Set(); const van = [];
  for (const [id, n] of Object.entries(m)) { if (!n) continue; if (n < 0) return 'neg'; tot += n; col.add(C[id].color); if (!POOL.includes(id)) return 'pool ' + id; if (n > (id === 'ST02-016' ? 2 : 4)) return 'copies'; if (VANILLA.has(id)) van.push(id); }
  if (tot !== 50) return 'size'; if (col.size > 2) return 'colors'; if (van.length > 1) return 'vanilla'; if ((m['ST01-010'] && m['ST05-010']) || (m['GD01-008'] && m['GD05-015'])) return 'pair';
  for (const [id, n] of Object.entries(LOCK)) if ((m[id] || 0) < n) return 'lock';
  return null;
}
function repair(m) { // fix size to 50 / copy limits / vanilla group by trimming worst-prior cards or adding prior-sampled cards
  for (const id in m) { const cap = id === 'ST02-016' ? 2 : 4; if (m[id] > cap) m[id] = cap; if (m[id] <= 0) delete m[id]; }
  const van = Object.keys(m).filter(id => VANILLA.has(id)); if (van.length > 1) { van.sort((a, b) => m[b] - m[a]); for (const id of van.slice(1)) delete m[id]; }
  if (m['ST01-010'] && m['ST05-010']) delete m['ST05-010']; if (m['GD01-008'] && m['GD05-015']) delete m['GD05-015'];
  let tot = Object.values(m).reduce((a, b) => a + b, 0);
  for (let g = 0; tot > 50 && g < 500; g++) { const ids = Object.keys(m).filter(id => !(LOCK[id] && m[id] <= LOCK[id])); const id = ids.reduce((a, b) => (prior[b] * (m[b] + 1) < prior[a] * (m[a] + 1) ? b : a)); m[id]--; if (!m[id]) delete m[id]; tot--; }
  for (let g = 0; tot < 50 && g < 2000; g++) { const id = rnd() < 0.6 ? pick(Object.keys(m)) : samplePool(); const cap = id === 'ST02-016' ? 2 : 4; if ((m[id] || 0) >= cap) continue; if (VANILLA.has(id) && Object.keys(m).some(x => x !== id && VANILLA.has(x))) continue; m[id] = (m[id] || 0) + 1; tot++; }
  return m;
}
function mutate(m0) {
  const m = { ...m0 }; const r = rnd();
  if (r < 0.15 && PACKAGES.length) { const pk = pick(PACKAGES); for (const [id, k] of Object.entries(pk)) m[id] = Math.max(m[id] || 0, k); }
  else if (r < 0.35) { const ids = Object.keys(m); const a = pick(ids), b = pick(ids); if (a !== b && m[a] > 0) { m[a]--; m[b] = (m[b] || 0) + 1; } }
  else { const k = r < 0.7 ? 1 : r < 0.9 ? 2 : 3; const ids = Object.keys(m).filter(id => !(LOCK[id] && m[id] <= LOCK[id])); const x = pick(ids); const y = samplePool(); const kk = Math.min(k, m[x]); m[x] -= kk; m[y] = (m[y] || 0) + kk; }
  return repair(m);
}
function crossover(a, b) {
  const m = {}; const ids = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const id of ids) { const x = ((a[id] || 0) + (b[id] || 0)) / 2; const v = Math.floor(x) + (rnd() < x - Math.floor(x) ? 1 : 0); if (v > 0) m[id] = v; }
  return repair(m);
}
const cache = new Map();
async function evalMany(ms, n, seed) {
  const pairs = []; ms.forEach((m, i) => { const list = toList(m); for (const b of opps) pairs.push({ a: list, b, key: i + '|' + b, opts: { aiA: P[PROF], aiB: P[OPP[b]] }, seed }); });
  const r = await runMatrix(pairs, n, seed, 2);
  return ms.map((m, i) => { const wrs = opps.map(b => r[i + '|' + b].wr); const s = [...wrs].sort((x, y) => x - y); const B = wrs.reduce((x, y) => x + y, 0) / wrs.length; const A = opps.reduce((x, b, j) => x + W[b] * wrs[j], 0); const b5 = s.slice(0, 5).reduce((x, y) => x + y, 0) / 5;
    return { B, A, b5, min: s[0], minOpp: opps[wrs.indexOf(s[0])], f: 0.5 * A + 0.5 * B + 0.5 * b5 }; });
}
(async () => {
  const t0 = Date.now();
  let pop = SEEDS.map(s => repair(toMap(D[s].cards)));
  for (const f of SEEDFILES) { const j = JSON.parse(fs.readFileSync(f)); if (j.best) pop.push(repair(toMap(j.best.deck))); for (const d of (j.elite || [])) pop.push(repair(toMap(d))); }
  while (pop.length < POP) { const base = pick(pop.slice(0, SEEDS.length)); let m = base; for (let k = 0; k < 3; k++) m = mutate(m); if (!legal(m)) pop.push(m); }
  pop = pop.filter(m => !legal(m));
  const hist = []; let best = null; let seed = 300000;
  for (let gen = 0; gen < GENS; gen++) {
    const es = await evalMany(pop, N, seed + gen * 101);
    const scored = pop.map((m, i) => ({ m, e: es[i] })).sort((x, y) => y.e.f - x.e.f);
    // fresh-seed re-check of the top 3 every 5 generations; keep a running "best" by fresh score
    if (gen % 5 === 4 || gen === GENS - 1) {
      const top = scored.slice(0, 3); const fe = await evalMany(top.map(x => x.m), 100, 700000 + gen * 13);
      top.forEach((x, i) => { x.fresh = fe[i]; if (!best || fe[i].f > best.fresh.f) best = { m: x.m, fresh: fe[i], gen }; });
      console.log(`gen ${gen} fresh: ` + top.map(x => `B ${(x.fresh.B * 100).toFixed(1)} A ${(x.fresh.A * 100).toFixed(1)} b5 ${(x.fresh.b5 * 100).toFixed(1)}`).join(' | ') + `  best-so-far B ${(best.fresh.B * 100).toFixed(1)} A ${(best.fresh.A * 100).toFixed(1)}`);
      fs.writeFileSync(OUT, JSON.stringify({ colors: COLORS, gen, best: { deck: toList(best.m), ...best.fresh, gen: best.gen }, elite: scored.slice(0, 6).map(x => toList(x.m)), hist }, null, 1));
    }
    const s0 = scored[0].e; hist.push({ gen, B: s0.B, A: s0.A, b5: s0.b5, f: s0.f });
    console.log(`gen ${gen} top f ${s0.f.toFixed(3)} B ${(s0.B * 100).toFixed(1)} A ${(s0.A * 100).toFixed(1)} b5 ${(s0.b5 * 100).toFixed(1)} min ${(s0.min * 100).toFixed(1)} ${s0.minOpp} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    const elite = scored.slice(0, Math.max(4, Math.floor(POP * 0.35))).map(x => x.m);
    const next = [...elite]; const seen = new Set(next.map(key));
    for (let g = 0; next.length < POP && g < 500; g++) { const a = pick(elite), b = pick(elite); let c = rnd() < 0.5 && a !== b ? crossover(a, b) : a; c = mutate(c); if (rnd() < 0.4) c = mutate(c); if (legal(c)) continue; const k = key(c); if (seen.has(k)) continue; seen.add(k); next.push(c); }
    pop = next;
  }
  console.log('done', ((Date.now() - t0) / 1000).toFixed(0), 's');
})();
