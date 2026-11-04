'use strict';
// Operation Omni driver (resumable): every colour pair and mono colour.
//  S1 census of every card in each pair's chassis -> S2 island GA per pair/mono with census priors -> S3 stronger-AI check
//  -> S4 pure stronger-AI GA on the top 3 -> S5 final validation. Markers: results/omni/<stage>_<name>.done
const { execSync } = require('child_process'); const fs = require('fs'); fs.mkdirSync('results/omni', { recursive: true });
const sh = (cmd) => execSync(cmd, { stdio: 'inherit', shell: '/bin/bash' });
const log = (s) => { fs.appendFileSync('results/omni/omni.log', `[${new Date().toTimeString().slice(0, 8)}] ${s}\n`); };
const mark = (k) => `results/omni/${k}.done`; const done = (k) => fs.existsSync(mark(k)); const set = (k, v) => fs.writeFileSync(mark(k), JSON.stringify(v || 1));
const waitWP = () => { while (!fs.existsSync('results/wp_ready.flag')) execSync('sleep 20'); };
const PAIRS = [ // name, colours, chassis, extra seeds, needs White/Purple
  ['GB', 'Green,Blue', 'GB_GA2', ['J_BGOYW_Chelmo', 'PURE_GB_e1'], 0], ['GR', 'Green,Red', 'GR_GA1', ['PURE_GR_e0', 'ARC_ZEON_GR'], 0], ['BR', 'Blue,Red', 'W_MEL_SFVictory', ['PAIR_BR'], 0],
  ['GP', 'Green,Purple', 'W_MEX_GPZeon', ['J_CharIBO', 'W_MNL_GPZeon'], 1], ['BP', 'Blue,Purple', 'W_MKE_ZGok', ['J_SFIBO_alt', 'J_SFIBO_Chiba', 'J_EFFBanshee', 'W_TKY1_BarbSF'], 1],
  ['BW', 'Blue,White', 'W_TOR_SF', ['W_DC_SF', 'J_SFBlockers'], 1], ['RW', 'Red,White', 'W_BRIS_RWAcademy', ['J_MF_Machida', 'J_MobileFighter', 'J_JusticeAerial', 'W_DUS_Shining'], 1],
  ['GW', 'Green,White', 'J_Wing_Omiya', [], 1], ['PR', 'Purple,Red', 'J_KshatriyaBanshee', [], 1], ['WP', 'White,Purple', 'MERGE_WP', [], 1],
];
const MONO = ['Green', 'Blue', 'Red', 'White', 'Purple'];
function addDeck(key, label, cards) { const D = JSON.parse(fs.readFileSync('decks.json')); D[key] = { label, cards }; fs.writeFileSync('decks.json', JSON.stringify(D, null, 1)); }
function ensureMerged(key, cols) { const D = JSON.parse(fs.readFileSync('decks.json')); if (D[key]) return; const C = require('./cards.json'); const m = {};
  for (const k in D) { if (!(k.startsWith('W_') || k.startsWith('J_') || k.startsWith('PURE_') || k.startsWith('GB_GA') || k === 'GR_GA1')) continue; for (const { id, n } of D[k].cards) if (cols.includes(C[id].color)) m[id] = Math.max(m[id] || 0, n); }
  const out = []; let t = 0; for (const id of Object.keys(m).sort((a, b) => m[b] - m[a])) { const k = Math.min(m[id], 50 - t); if (k <= 0) break; out.push({ id, n: k }); t += k; }
  if (t === 50) addDeck(key, `merged seed ${cols.join('/')}`, out); }
(async () => {
  log('start');
  // S1 + S2 + S3 per pair
  for (const [name, cols, chassis, extra, wp] of PAIRS) {
    if (wp) waitWP(); if (name === 'WP') ensureMerged('MERGE_WP', ['White', 'Purple']);
    const D = JSON.parse(fs.readFileSync('decks.json')); if (!D[chassis]) { log(`${name}: no chassis ${chassis}, skipped`); continue; }
    if (!done('census_' + name)) { sh(`node census.js ${name} ${chassis} ${cols} 12 >> results/omni/census.log 2>&1`); set('census_' + name); log(`census ${name} done`); }
    if (!done('island_' + name)) { const seeds = [chassis, ...extra.filter(s => D[s])].join(',');
      sh(`node ga.js --colors ${cols} --seeds ${seeds} --prior results/prior_census_${name}.json --gens 15 --pop 12 --n 20 --rseed ${name.charCodeAt(0) * 31 + name.charCodeAt(1)} --out results/omni/island_${name}.json > results/omni/island_${name}.log 2>&1`);
      const j = JSON.parse(fs.readFileSync(`results/omni/island_${name}.json`)); addDeck('OMNI_' + name, `Omni island ${name} (fresh B ${(j.best.B * 100).toFixed(1)})`, j.best.deck); set('island_' + name, { B: j.best.B }); log(`island ${name} heuristic B ${(j.best.B * 100).toFixed(1)}`); }
    if (!done('check_' + name)) { sh(`SK=2 SN=2 node searchcheck.js OMNI_${name} 30 7373000 hyper both >> results/omni/check.log 2>&1`); const r = JSON.parse(fs.readFileSync(`results/search_both_OMNI_${name}_k2n2.json`)); set('check_' + name, { B: r.B, min: r.min, minOpp: r.minOpp }); log(`check ${name} stronger-AI B ${(r.B * 100).toFixed(1)}`); }
  }
  // mono-colour islands
  for (const col of MONO) {
    const name = 'M' + col[0]; if (['White', 'Purple'].includes(col)) waitWP(); ensureMerged('MERGE_' + name, [col]);
    const D = JSON.parse(fs.readFileSync('decks.json')); if (!D['MERGE_' + name]) { log(`${name}: no 50-card mono seed`); continue; }
    if (!done('island_' + name)) { sh(`node ga.js --colors ${col} --seeds MERGE_${name} --gens 15 --pop 12 --n 20 --rseed ${col.length * 17} --out results/omni/island_${name}.json > results/omni/island_${name}.log 2>&1`);
      const j = JSON.parse(fs.readFileSync(`results/omni/island_${name}.json`)); addDeck('OMNI_' + name, `Omni mono ${col} (fresh B ${(j.best.B * 100).toFixed(1)})`, j.best.deck); set('island_' + name, { B: j.best.B }); log(`island ${name} heuristic B ${(j.best.B * 100).toFixed(1)}`); }
    if (!done('check_' + name)) { sh(`SK=2 SN=2 node searchcheck.js OMNI_${name} 30 7373000 hyper both >> results/omni/check.log 2>&1`); const r = JSON.parse(fs.readFileSync(`results/search_both_OMNI_${name}_k2n2.json`)); set('check_' + name, { B: r.B, min: r.min, minOpp: r.minOpp }); log(`check ${name} stronger-AI B ${(r.B * 100).toFixed(1)}`); }
  }
  // S4: pure stronger-AI GA on the top 3 islands by stronger-AI check
  const checks = [...PAIRS.map(p => p[0]), ...MONO.map(c => 'M' + c[0])].filter(n => done('check_' + n)).map(n => ({ n, ...JSON.parse(fs.readFileSync(mark('check_' + n))) })).sort((a, b) => b.B - a.B);
  log('ranking: ' + checks.map(c => `${c.n} ${(c.B * 100).toFixed(1)}`).join(', '));
  for (const c of checks.slice(0, 3)) {
    if (done('pure_' + c.n)) continue; const p = PAIRS.find(x => x[0] === c.n); const cols = p ? p[1] : MONO.find(m => 'M' + m[0] === c.n);
    const D = JSON.parse(fs.readFileSync('decks.json')); const seeds = ['OMNI_' + c.n, ...(p ? [p[2], ...p[3]] : [])].filter(s => D[s]).join(',');
    const out = `results/omni/pure_${c.n}.json`; const sf = fs.existsSync(out + ".tmp") ? `--seedfiles ${out}.ck` : ""; if (sf) fs.copyFileSync(out + ".tmp", out + ".ck");
    sh(`node ga2.js --pure 1 --colors ${cols} --seeds ${seeds} ${sf} --gens 8 --kids 14 --elite 6 --sn 16 --rseed ${c.n.charCodeAt(0) * 7} --out ${out}.tmp >> results/omni/pure_${c.n}.log 2>&1`);
    fs.renameSync(`${out}.tmp`, out); const j = JSON.parse(fs.readFileSync(out)); j.elites.slice(0, 2).forEach((e, i) => addDeck(`OMNIP_${c.n}_e${i}`, `Omni pure stronger-AI ${c.n} elite ${i}`, e.deck)); set('pure_' + c.n); log(`pure ${c.n} done: elite search B ${(j.elites[0].search.B * 100).toFixed(1)} n${j.elites[0].search.n}`);
  }
  // S5: validation of the pure elites + reference decks on a common stronger-AI check (K3N3, 100 games/list) and 1000 fast-AI games
  const D = JSON.parse(fs.readFileSync('decks.json')); const finals = Object.keys(D).filter(k => k.startsWith('OMNIP_'));
  for (const k of finals) { if (done('val_' + k)) continue; sh(`node searchcheck.js ${k} 100 9393000 hyper both >> results/omni/val.log 2>&1; node validate.js ${k} 1000 8800000 hyper >> results/omni/val.log 2>&1`); set('val_' + k); log(`validated ${k}`); }
  log('OMNI COMPLETE'); fs.writeFileSync('results/omni/COMPLETE', '1');
})();
