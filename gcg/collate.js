'use strict';
// Collate Operation Omni results into results/final/summary.json + markdown tables (results/final/TABLES.md).
// node collate.js
const fs = require('fs'); const D = require('./decks.json'); const C = require('./cards.json');
const { W, ARCH } = require('./evalfield'); const opps = Object.keys(D).filter(k => k.startsWith('W_') || k.startsWith('J_'));
const rd = (f) => { try { return JSON.parse(fs.readFileSync(f)); } catch (e) { return null; } };
const pct = (x) => x == null ? '—' : (x * 100).toFixed(1);
const out = { islands: [], judges: {}, finals: {}, census: {} };
// islands / checks
const UNITS = ['GB', 'GR', 'BR', 'MG', 'MB', 'MR', 'GP', 'BP', 'BW', 'RW', 'GW', 'PR', 'WP', 'MW', 'MP'];
for (const u of UNITS) { const isl = rd(`results/omni/island_${u}.done`), ck = rd(`results/omni/check_${u}.done`), pu0 = fs.existsSync(`results/omni/pure_${u}.json`) ? rd(`results/omni/pure_${u}.json`) : null; const sc = !pu0 && fs.existsSync(`results/omni/screen_${u}.json`); const pu = pu0 || (sc ? rd(`results/omni/screen_${u}.json`) : null);
  out.islands.push({ unit: u, heurB: isl && isl.B, checkB: ck && ck.B, checkMin: ck && ck.min, checkMinOpp: ck && ck.minOpp, pureB: pu && pu.elites && pu.elites[0].search && pu.elites[0].search.B, pureN: pu && pu.elites && pu.elites[0].search && pu.elites[0].search.n, screen: sc }); }
// final validations: results/final/<deck>_<judge>_<n>.json written by searchcheck.js (SOUT)
for (const f of fs.readdirSync('results/final').filter(f => f.endsWith('.json') && f !== 'summary.json')) {
  const j = rd('results/final/' + f); if (!j || !j.per) continue; const m = f.replace(/\.json$/, '').match(/^(.*)_([a-z0-9]+)_(\d+)$/); if (!m) continue;
  const [, deck, judge] = m; const wrs = opps.map(b => j.per[b]); const fw = opps.map(b => j.first ? j.first[b] : null), sw = opps.map(b => j.second ? j.second[b] : null);
  const mean = (a) => a.every(x => x != null) ? a.reduce((s, x) => s + x, 0) / a.length : null;
  (out.finals[deck] || (out.finals[deck] = {}))[judge] = { n: j.n, B: j.B, A: j.A, min: j.min, minOpp: j.minOpp, first: mean(fw), second: mean(sw), per: j.per };
}
// judges
for (const f of fs.readdirSync('results/judge').filter(f => f.startsWith('mirror_'))) { const j = rd('results/judge/' + f); if (j) out.judges[j.name] = { X: j.X, Y: j.Y, games: j.games, score: j.score, ci95: j.ci95 }; }
// census highlights
for (const u of UNITS) { const j = rd(`results/census_${u}.json`); if (!j) continue; out.census[u] = { chassis: j.chassis, base: j.base, top: j.res.slice(0, 10).map(r => ({ id: r.id, name: r.name, d: r.d })), bottom: j.slots.slice(0, 5) }; }
fs.writeFileSync('results/final/summary.json', JSON.stringify(out, null, 1));
// markdown
const L = [];
L.push('## Islands (heuristic GA -> K2N2 check, 100 games/list -> pure search GA)', '', '| unit | heuristic B | K2N2 check B | check worst | pure-search elite B (n/list) |', '|---|---|---|---|---|');
for (const r of out.islands) L.push(`| ${r.unit} | ${pct(r.heurB)} | ${pct(r.checkB)} | ${pct(r.checkMin)} ${r.checkMinOpp || ''} | ${pct(r.pureB)}${r.pureN ? ' (' + r.pureN.toFixed(0) + ')' : ''} |`);
L.push('', '## Final validations (both sides searching; field = 26 lists)', '', '| deck | judge | games/list | field mean | Metric A | worst | first | second |', '|---|---|---|---|---|---|---|---|');
for (const [d, js] of Object.entries(out.finals)) for (const [jn, r] of Object.entries(js)) L.push(`| ${d} | ${jn} | ${r.n} | ${pct(r.B)} | ${pct(r.A)} | ${pct(r.min)} ${r.minOpp} | ${pct(r.first)} | ${pct(r.second)} |`);
L.push('', '## Judge mirrors', '', '| test | X | Y | games | X score | 95% CI |', '|---|---|---|---|---|---|');
for (const [k, j] of Object.entries(out.judges)) L.push(`| ${k} | ${JSON.stringify(j.X)} | ${JSON.stringify(j.Y)} | ${j.games} | ${pct(j.score)} | ${pct(j.ci95[0])}–${pct(j.ci95[1])} |`);
L.push('', '## Card census highlights (3 copies swapped into the chassis\'s 3 weakest slots, fast AI, 40 games/list)', '');
for (const [u, c] of Object.entries(out.census)) L.push(`- **${u}** (chassis ${c.chassis}, base ${pct(c.base)}): ` + c.top.map(t => `${t.name} (${t.id}) ${t.d >= 0 ? '+' : ''}${(t.d * 100).toFixed(1)}`).join('; '));
fs.writeFileSync('results/final/TABLES.md', L.join('\n') + '\n');
console.log(L.join('\n'));
