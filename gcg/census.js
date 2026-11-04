'use strict';
// Card census for one colour pair: (1) leave-out screen of the chassis to find its 3 weakest slots, (2) every implemented
// card of the pair's colours swapped in for those slots (3 copies), all on shared seeds vs the 26-list field (fast AI).
// node census.js NAME CHASSIS Colour1,Colour2 [n]  -> results/census_NAME.json  (+ results/prior_census_NAME.json)
const { runMatrix } = require('./run'); const D = require('./decks.json'); const C = require('./cards.json'); const EFX = require('./effects');
const P = require('./profiles'); const OPP = require('./opp_profiles.json'); const fs = require('fs');
const [name, chassis, colStr, nStr] = process.argv.slice(2); const COLS = colStr.split(','); const N = +(nStr || 12); const SEED = 6060000;
const opps = Object.keys(D).filter(k => k.startsWith('W_') || k.startsWith('J_'));
const VAN = new Set(Object.keys(C).filter(id => (C[id].legality || '').startsWith('Vanilla')));
const base = {}; for (const { n, id } of D[chassis].cards) base[id] = (base[id] || 0) + n;
const toList = (m) => Object.entries(m).filter(([, n]) => n > 0).map(([id, n]) => ({ n, id }));
async function evalMany(maps, n) { const pairs = []; maps.forEach((m, i) => { const l = toList(m); for (const b of opps) pairs.push({ a: l, b, key: i + '|' + b, seed: SEED, opts: { aiA: P.hyper, aiB: P[OPP[b]] } }); });
  const r = await runMatrix(pairs, n, SEED, 2); return maps.map((m, i) => opps.reduce((s, b) => s + r[i + '|' + b].wr, 0) / opps.length); }
(async () => {
  const t0 = Date.now(); const filler = COLS.includes('Green') ? 'GD05-027' : COLS.includes('Blue') ? 'GD01-018' : COLS.includes('Red') ? 'GD06-036' : null;
  const ids = Object.keys(base);
  // 1) leave-out: replace 2 copies of each card with 2 copies of the pair's commonest cheap unit already in the deck (or a filler)
  const cheap = ids.filter(id => C[id].type === 'UNIT' && C[id].lv <= 2).sort((a, b) => base[b] - base[a])[0] || filler || ids[0];
  const lo = ids.filter(id => id !== cheap).map(id => { const m = { ...base }; const k = Math.min(2, m[id]); m[id] -= k; m[cheap] = (m[cheap] || 0) + k; return { id, k, m }; });
  const [b0, ...loW] = await evalMany([base, ...lo.map(x => x.m)], N * 2);
  const slots = lo.map((x, i) => ({ id: x.id, loss: (b0 - loW[i]) / x.k })).sort((a, b) => a.loss - b.loss);
  const victims = []; { let need = 3; for (const s of slots) { if (need <= 0) break; const k = Math.min(need, base[s.id]); victims.push([s.id, k]); need -= k; } }
  // 2) census over every implemented card in the pair's colours
  const pool = Object.keys(EFX).filter(id => C[id] && COLS.includes(C[id].color) && ['UNIT', 'PILOT', 'COMMAND', 'BASE'].includes(C[id].type) && id !== 'GD01-020' && !(C[id].legality || '').startsWith('Banned'));
  const vanIn = Object.keys(base).find(id => VAN.has(id));
  const cand = pool.filter(id => (base[id] || 0) + 3 <= (id === 'ST02-016' ? 2 : 4) && !(VAN.has(id) && vanIn && vanIn !== id) && !(id === 'ST05-010' && base['ST01-010']) && !(id === 'ST01-010' && base['ST05-010']) && !(id === 'GD05-015' && base['GD01-008']) && !(id === 'GD01-008' && base['GD05-015']));
  const maps = cand.map(id => { const m = { ...base }; for (const [v, k] of victims) m[v] -= k; m[id] = (m[id] || 0) + 3; return m; });
  const res = []; const CH = 60;
  for (let i = 0; i < maps.length; i += CH) { const w = await evalMany(maps.slice(i, i + CH), N); w.forEach((x, j) => res.push({ id: cand[i + j], name: C[cand[i + j]].name, color: C[cand[i + j]].color, type: C[cand[i + j]].type, lv: C[cand[i + j]].lv, wr: x, d: x - b0 })); }
  res.sort((a, b) => b.d - a.d);
  const prior = {}; for (const r of res) if (r.d > 0) prior[r.id] = Math.min(12, r.d * 150);
  fs.writeFileSync(`results/census_${name}.json`, JSON.stringify({ name, chassis, cols: COLS, N, base: b0, victims, slots, res }, null, 1));
  fs.writeFileSync(`results/prior_census_${name}.json`, JSON.stringify(prior));
  console.log(`${name} chassis ${chassis} base ${(b0 * 100).toFixed(1)} victims ${victims.map(v => v.join('x')).join(' ')} cards ${res.length} positive ${Object.keys(prior).length} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  console.log('top: ' + res.slice(0, 12).map(r => `${r.name} ${(r.d * 100).toFixed(1)}`).join(' | '));
})();
