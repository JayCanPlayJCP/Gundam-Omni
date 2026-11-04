'use strict';
// Card screen for one base deck (Track 2/3):
//  1) leave-out: replace 2 copies of each base card with a plain filler -> slot value (how much the deck loses)
//  2) swap-in: for each candidate card, replace the weakest slots with `copies` of the candidate -> delta vs base
// All evaluations use matched seeds against the full gauntlet with each opponent's best-response style.
// node screen.js --deck GB_HYBRID_opt --n 40 --copies 3 --top 25 --out results/screen_GB.json
const { runMatrix } = require('./run'); const D = require('./decks.json'); const C = require('./cards.json');
const EFX = require('./effects'); const P = require('./profiles'); const OPP = require('./opp_profiles.json'); const fs = require('fs');
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, x, i, arr) => (x.startsWith('--') ? acc.concat([[x.slice(2), arr[i + 1]]]) : acc), []));
const BASE = args.deck; const N = +(args.n || 40); const COPIES = +(args.copies || 3); const TOP = +(args.top || 25); const OUT = args.out || `results/screen_${BASE}.json`;
const PROF = args.prof || 'hyper'; const SEED = +(args.seed || 777000); const CONF = +(args.confirm || 160);
const opps = Object.keys(D).filter(k => k.startsWith('W_') || k.startsWith('J_'));
const toMap = (l) => { const m = {}; for (const { n, id } of l) m[id] = (m[id] || 0) + n; return m; };
const toList = (m) => Object.entries(m).filter(([, n]) => n > 0).map(([id, n]) => ({ n, id }));
const VANILLA = new Set(Object.keys(C).filter(id => (C[id].legality || '').startsWith('Vanilla')));
async function evalMap(m, n, seed) {
  const list = toList(m); const pairs = opps.map(b => ({ a: list, b, key: b, opts: { aiA: P[PROF], aiB: P[OPP[b]] }, seed }));
  const r = await runMatrix(pairs, n, seed, 2); const wrs = opps.map(b => r[b].wr); const s = [...wrs].sort((a, b) => a - b);
  return { mean: wrs.reduce((a, b) => a + b, 0) / wrs.length, b5: s.slice(0, 5).reduce((a, b) => a + b, 0) / 5, per: Object.fromEntries(opps.map((b, i) => [b, wrs[i]])) };
}
(async () => {
  const base = toMap(D[BASE].cards); const colors = [...new Set(Object.keys(base).map(id => C[id].color))];
  const filler = colors.includes('Green') ? 'GD05-027' : (colors.includes('Blue') ? 'GD01-018' : 'GD06-036');
  const t0 = Date.now(); const b = await evalMap(base, N, SEED); console.log(`base ${BASE} mean ${(b.mean * 100).toFixed(1)} b5 ${(b.b5 * 100).toFixed(1)} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  const slot = [];
  for (const id of Object.keys(base)) { if (id === filler) continue; const m = { ...base }; const k = Math.min(2, m[id]); m[id] -= k; m[filler] = (m[filler] || 0) + k; const e = await evalMap(m, N, SEED); slot.push({ id, name: C[id].name, n: base[id], loss: (b.mean - e.mean) / k }); }
  slot.sort((a, c) => a.loss - c.loss); console.log('weakest slots:', slot.slice(0, 6).map(s => `${s.name}(${s.n}) ${(s.loss * 100).toFixed(2)}`).join(', '));
  // victims: take COPIES from the weakest slots in order
  const victims = []; { let need = COPIES; for (const s of slot) { if (need <= 0) break; const k = Math.min(need, base[s.id]); victims.push([s.id, k]); need -= k; } }
  const legalAdd = (m) => { const van = Object.keys(m).filter(id => m[id] > 0 && VANILLA.has(id)); return van.length <= 1 && !(m['ST01-010'] && m['ST05-010']) && !(m['GD01-008'] && m['GD05-015']) && Object.entries(m).every(([id, n]) => n <= (id === 'ST02-016' ? 2 : 4)); };
  const cands = Object.keys(EFX).filter(id => C[id] && colors.includes(C[id].color) && ['UNIT', 'PILOT', 'COMMAND', 'BASE'].includes(C[id].type) && id !== 'GD01-020' && (base[id] || 0) + COPIES <= 4 && (args.cands !== 'auto' || EFX[id].fidelity === 'auto'));
  console.log('candidates', cands.length, 'victims', victims.map(([id, k]) => k + 'x ' + C[id].name).join(', '));
  const res = [];
  for (const id of cands) { const m = { ...base }; for (const [v, k] of victims) m[v] -= k; m[id] = (m[id] || 0) + COPIES; if (!legalAdd(m)) continue; const e = await evalMap(m, N, SEED); res.push({ id, name: C[id].name, lv: C[id].lv, type: C[id].type, fid: EFX[id].fidelity, d: e.mean - b.mean, db5: e.b5 - b.b5 }); }
  res.sort((a, c) => (c.d + 0.5 * c.db5) - (a.d + 0.5 * a.db5));
  console.log('top swaps (screen):'); for (const r of res.slice(0, TOP)) console.log(`${r.id} ${r.name} L${r.lv} ${r.type} [${r.fid}] d=${(r.d * 100).toFixed(2)} db5=${(r.db5 * 100).toFixed(2)}`);
  // confirm top 10 on fresh seeds
  const conf = []; const b2 = await evalMap(base, CONF, SEED + 5000);
  for (const r of res.slice(0, 10)) { const m = { ...base }; for (const [v, k] of victims) m[v] -= k; m[r.id] = (m[r.id] || 0) + COPIES; const e = await evalMap(m, CONF, SEED + 5000); conf.push({ ...r, cd: e.mean - b2.mean, cdb5: e.b5 - b2.b5 }); }
  conf.sort((a, c) => (c.cd + 0.5 * c.cdb5) - (a.cd + 0.5 * a.cdb5));
  console.log(`confirmed (n=${CONF}, base ${(b2.mean * 100).toFixed(1)}):`); for (const r of conf) console.log(`${r.id} ${r.name} cd=${(r.cd * 100).toFixed(2)} cdb5=${(r.cdb5 * 100).toFixed(2)}`);
  fs.writeFileSync(OUT, JSON.stringify({ base: BASE, N, COPIES, baseE: b, slot, victims, res, conf }, null, 1));
  console.log('sec', ((Date.now() - t0) / 1000).toFixed(0));
})();
