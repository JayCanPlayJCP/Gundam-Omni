'use strict';
// Deck optimizer: legality-checked hill climbing with matched-seed screening + fresh-seed confirmation.
// node optimize.js --deck RG25 --iters 250 --screen 60 --confirm 200 --out results/opt_RG25.json
const { runMatrix } = require('./run'); const D = require('./decks.json'); const C = require('./cards.json');
const EFX = require('./effects'); const P = require('./profiles'); const OPP = require('./opp_profiles.json'); const fs = require('fs');
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, x, i, arr) => (x.startsWith('--') ? acc.concat([[x.slice(2), arr[i + 1]]]) : acc), []));
const START = args.deck || 'RG25'; const ITERS = +(args.iters || 250); const SN = +(args.screen || 60); const CN = +(args.confirm || 200); const OUT = args.out || `results/opt_${START}.json`;
const opps = Object.keys(D).filter(k => k.startsWith('W_') || k.startsWith('J_'));
let rngS = +(args.seed || 12345); const rnd = () => { rngS = (rngS * 1103515245 + 12345) & 0x7fffffff; return rngS / 0x7fffffff; };
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

const VANILLA = new Set(Object.keys(C).filter(id => C[id].legality.startsWith('Vanilla')));
const PAIRS = [['ST01-010', 'ST05-010'], ['GD01-008', 'GD05-015']];
function toMap(list) { const m = {}; for (const { n, id } of list) m[id] = (m[id] || 0) + n; return m; }
function toList(m) { return Object.entries(m).filter(([, n]) => n > 0).map(([id, n]) => ({ n, id })); }
function legal(m) {
  let tot = 0; const colors = new Set(); const van = [];
  for (const [id, n] of Object.entries(m)) { if (!n) continue; const c = C[id]; tot += n; colors.add(c.color); if (id === 'GD01-020') return 'banned'; if (n > (id === 'ST02-016' ? 2 : 4)) return 'copies ' + id; if (VANILLA.has(id)) van.push(id); }
  if (tot !== 50) return 'size ' + tot; if (colors.size > 2) return 'colors'; if (van.length > 1) return 'vanilla'; for (const [a, b] of PAIRS) if (m[a] && m[b]) return 'pair';
  return null;
}
const startList = D[START].cards; const startMap = toMap(startList);
const LOCK = Object.fromEntries((args.lock || '').split(',').filter(Boolean).map(x => { const [id, n] = x.split(':'); return [id, +n]; }));
function respectsLock(m) { for (const [id, n] of Object.entries(LOCK)) if ((m[id] || 0) < n) return false; return true; }
const colors = [...new Set(Object.keys(startMap).map(id => C[id].color))];
const POOL = Object.keys(EFX).filter(id => C[id] && colors.includes(C[id].color) && ['UNIT', 'PILOT', 'COMMAND', 'BASE'].includes(C[id].type) && id !== 'GD01-020');
const PACKAGES = [
  { name: 'Char Zeon closing', add: { 'ST03-016': 4, 'GD01-026': 3, 'ST03-006': 4, 'ST03-011': 4 }, need: 'Green' },
  { name: 'Falmel x4', add: { 'ST03-016': 4 }, need: 'Green' },
  { name: 'Char pilots x4', add: { 'ST03-011': 4 }, need: 'Green' },
  { name: 'Kayra Su x3', add: { 'GD05-086': 3 }, need: 'Green' },
  { name: 'Show of Resolve x3', add: { 'GD01-100': 3 }, need: 'Blue' },
  { name: 'Endra x2', add: { 'GD06-123': 2 }, need: 'Green' },
  { name: 'Gwadan x2', add: { 'GD02-125': 2 }, need: 'Red' },
  { name: 'Nu engine', add: { 'GD05-017': 3, 'GD05-085': 3, 'GD05-019': 3 }, need: 'Green' },
  { name: 'Turn X core', add: { 'GD06-019': 2, 'GD06-085': 3 }, need: 'Green' },
  { name: 'Turn X tokens', add: { 'GD06-021': 3, 'GD06-109': 3 }, need: 'Green' },
  { name: 'HM Gundam', add: { 'GD04-008': 3, 'ST01-010': 3 }, need: 'Blue' },
  { name: 'Wing Zero', add: { 'GD01-024': 2, 'ST02-010': 2 }, need: 'Green' },
  { name: 'Calibarn top', add: { 'GD05-018': 2, 'ST13-012': 3 }, need: 'Red' },
  { name: 'Grace x4', add: { 'GD06-105': 4 }, need: 'Green' },
  { name: 'Wheel Spoke x3', add: { 'GD06-107': 3, 'GD06-031': 3 }, need: 'Green' },
  { name: 'Strategic Arms x2', add: { 'GD01-108': 2 }, need: 'Green' },
].filter(pk => colors.includes(pk.need) && Object.keys(pk.add).every(id => EFX[id] && colors.includes(C[id].color)));

function mutate(m) {
  const n = { ...m }; const r = rnd(); const ids = Object.keys(n).filter(id => n[id] > 0);
  const removeK = (k, protect) => { let left = k; for (let g = 0; g < 200 && left > 0; g++) { const x = pick(ids); if (protect && protect[x]) continue; if (n[x] > 0) { n[x]--; left--; } } return left === 0; };
  if (r < 0.12 && PACKAGES.length) { const pk = pick(PACKAGES); let need = 0; for (const [id, k] of Object.entries(pk.add)) { const add = Math.max(0, k - (n[id] || 0)); need += add; n[id] = Math.max(n[id] || 0, k); } if (!removeK(need, pk.add)) return null; return { m: n, desc: `+package ${pk.name}` }; }
  const k = r < 0.55 ? 1 : r < 0.9 ? 2 : 3;
  const x = pick(ids); const y = pick(POOL); if (x === y) return null; const kk = Math.min(k, n[x]);
  n[x] -= kk; n[y] = (n[y] || 0) + kk; return { m: n, desc: `-${kk} ${x} ${C[x].name} +${kk} ${y} ${C[y].name}` };
}
async function evaluate(m, N, seed, prof) {
  const list = toList(m); const pairs = opps.map(b => ({ a: list, b, key: b, opts: { aiA: P[prof], aiB: P[OPP[b]] }, seed }));
  const r = await runMatrix(pairs, N, seed, 2); const wrs = opps.map(b => r[b].wr); const sorted = [...wrs].sort((a, b) => a - b);
  const mean = wrs.reduce((s, x) => s + x, 0) / wrs.length; const bottom5 = sorted.slice(0, 5).reduce((s, x) => s + x, 0) / 5;
  return { f: mean + 0.5 * bottom5, mean, min: sorted[0], bottom5, per: Object.fromEntries(opps.map((b, i) => [b, wrs[i]])) };
}
(async () => {
  fs.mkdirSync('results', { recursive: true });
  // choose our AI profile
  let prof = 'balanced', best = null;
  for (const pn in P) { const e = await evaluate(startMap, 40, 31000, pn); if (!best || e.f > best.f) { best = e; prof = pn; } }
  console.log(`[${START}] colors ${colors.join('/')} pool ${POOL.length} packages ${PACKAGES.length} profile ${prof}`);
  let cur = startMap, seedA = 50000; let curE = await evaluate(cur, SN, seedA, prof); const hist = [{ it: 0, desc: 'start', ...curE, per: undefined }];
  console.log(`start f=${curE.f.toFixed(3)} mean=${(curE.mean * 100).toFixed(1)} min=${(curE.min * 100).toFixed(1)}`);
  let accepted = 0;
  for (let it = 1; it <= ITERS; it++) {
    if (it % 40 === 0) { seedA += 1000; curE = await evaluate(cur, SN, seedA, prof); }
    const mu = mutate(cur); if (!mu) continue; const why = legal(mu.m); if (why || !respectsLock(mu.m)) continue;
    const e = await evaluate(mu.m, SN, seedA, prof);
    if (e.f > curE.f + 0.006) {
      const seedB = 900000 + it * 997; const [ec, eo] = [await evaluate(mu.m, CN, seedB, prof), await evaluate(cur, CN, seedB, prof)];
      if (ec.f > eo.f) { cur = mu.m; curE = e; accepted++; hist.push({ it, desc: mu.desc, f: ec.f, mean: ec.mean, min: ec.min, bottom5: ec.bottom5 }); console.log(`it ${it} ACCEPT ${mu.desc} | confirm mean ${(eo.mean * 100).toFixed(1)}->${(ec.mean * 100).toFixed(1)} min ${(eo.min * 100).toFixed(1)}->${(ec.min * 100).toFixed(1)}`); }
    }
    if (it % 25 === 0) { fs.writeFileSync(OUT, JSON.stringify({ start: START, profile: prof, it, deck: toList(cur), hist }, null, 1)); }
  }
  // re-pick profile for final deck
  let fprof = prof, fb = null; for (const pn in P) { const e = await evaluate(cur, 60, 61000, pn); if (!fb || e.f > fb.f) { fb = e; fprof = pn; } }
  fs.writeFileSync(OUT, JSON.stringify({ start: START, profile: fprof, it: ITERS, accepted, deck: toList(cur), hist }, null, 1));
  console.log(`[${START}] done: ${accepted} accepted; final profile ${fprof}`);
})();
