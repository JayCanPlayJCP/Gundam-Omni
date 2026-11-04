'use strict';
// Open-colour pipeline: per colour pair -> heuristic GA from that pair's champion lists (or a merged seed) -> stronger-AI check.
// Resumable via results/pair_<name>.done.   node pairpipe.js BR GP ...
const { execSync } = require('child_process'); const fs = require('fs'); const D0 = require('./decks.json'); const C = require('./cards.json');
const PAIRS = {
  BR: ['Blue,Red', ['W_MEL_SFVictory']], BP: ['Blue,Purple', ['J_EFFBanshee', 'J_SFIBO_Chiba', 'J_SFIBO_alt', 'W_MKE_ZGok', 'W_TKY1_BarbSF']],
  BW: ['Blue,White', ['J_SFBlockers', 'W_DC_SF', 'W_TOR_SF']], GP: ['Green,Purple', ['J_CharIBO', 'W_MEX_GPZeon', 'W_MNL_GPZeon']],
  GW: ['Green,White', ['J_Wing_Omiya']], PR: ['Purple,Red', ['J_KshatriyaBanshee']],
  RW: ['Red,White', ['J_JusticeAerial', 'J_MF_Kichijoji', 'J_MF_Machida', 'J_MobileFighter', 'W_BRIS_RWAcademy', 'W_DUS_Shining', 'W_TKY3_Shining']],
  WP: ['White,Purple', ['MERGE_WP']],
};
// merged seed for a pair with no champion list: the pair's cards from champion lists of neighbouring pairs
function merged(cols) { const m = {}; for (const k in D0) { if (!(k.startsWith('W_') || k.startsWith('J_'))) continue; for (const { id, n } of D0[k].cards) if (cols.includes(C[id].color)) m[id] = Math.max(m[id] || 0, n); }
  const ids = Object.keys(m).sort((a, b) => m[b] - m[a]); const out = {}; let t = 0; for (const id of ids) { const k = Math.min(m[id], 50 - t); if (k <= 0) break; out[id] = k; t += k; } return Object.entries(out).map(([id, n]) => ({ n, id })); }
for (const name of process.argv.slice(2)) {
  const [cols, seeds] = PAIRS[name]; const done = `results/pair_${name}.done`; if (fs.existsSync(done)) continue; const t0 = Date.now();
  if (seeds[0] === 'MERGE_WP') { const D = JSON.parse(fs.readFileSync('decks.json')); D.MERGE_WP = { label: 'merged White/Purple seed', cards: merged(cols.split(',')) }; fs.writeFileSync('decks.json', JSON.stringify(D, null, 1)); }
  execSync(`node ga.js --colors ${cols} --seeds ${seeds.join(',')} --gens 15 --pop 12 --n 20 --rseed ${name.charCodeAt(0) * 13} --out results/pairga_${name}.json > results/pairga_${name}.log 2>&1`);
  const j = JSON.parse(fs.readFileSync(`results/pairga_${name}.json`)); const D = JSON.parse(fs.readFileSync('decks.json'));
  D['PAIR_' + name] = { label: `Open-colour search ${name} after heuristic GA (fresh B ${(j.best.B * 100).toFixed(1)})`, cards: j.best.deck }; fs.writeFileSync('decks.json', JSON.stringify(D, null, 1));
  execSync(`SK=2 SN=2 node searchcheck.js PAIR_${name} 30 7373000 hyper both >> results/pairpipe.log 2>&1`);
  fs.writeFileSync(done, '1'); fs.appendFileSync('results/pairpipe.log', `${name} heuristic fresh B ${(j.best.B * 100).toFixed(1)} A ${(j.best.A * 100).toFixed(1)} (${((Date.now() - t0) / 1000).toFixed(0)}s)\n`);
}
