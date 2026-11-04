'use strict';
// Convergence report: do independent searches (islands, GA runs, judges) land on the same deck?
// node convergence.js KEY1,KEY2,... [--core 0.6] -> prints a pairwise card-overlap matrix (shared copies / 50),
// the shared core (cards in >= core fraction of the decks, with mean copies) and each deck's colour pair.
// Also prints, for every judge in results/final, the ranking of the decks it validated (field mean B).
const fs = require('fs'); const D = require('./decks.json'); const C = require('./cards.json');
const args = process.argv.slice(2); const keys = (args[0] || '').split(',').filter(k => D[k]);
const coreFrac = +(args[args.indexOf('--core') + 1] || 0.6) || 0.6;
const cnt = (k) => { const m = {}; for (const x of D[k].cards) { const id = typeof x === 'string' ? x : x.id; m[id] = (m[id] || 0) + (typeof x === 'string' ? 1 : x.n); } return m; };
const M = Object.fromEntries(keys.map(k => [k, cnt(k)]));
const cols = (k) => [...new Set(Object.keys(M[k]).map(id => C[id] && C[id].color))].sort().join('/');
const ov = (a, b) => Object.keys(M[a]).reduce((s, id) => s + Math.min(M[a][id], M[b][id] || 0), 0) / 50;
const short = (k) => k.length > 12 ? k.slice(0, 12) : k;
const L = [];
L.push('### Card overlap (shared copies / 50)', '', '| deck | colours | ' + keys.map(short).join(' | ') + ' |', '|---|---|' + keys.map(() => '---').join('|') + '|');
for (const a of keys) L.push(`| ${a} | ${cols(a)} | ` + keys.map(b => a === b ? '—' : (ov(a, b) * 100).toFixed(0)).join(' | ') + ' |');
const all = {}; for (const k of keys) for (const [id, n] of Object.entries(M[k])) (all[id] || (all[id] = [])).push(n);
const core = Object.entries(all).filter(([, v]) => v.length >= coreFrac * keys.length).map(([id, v]) => ({ id, name: C[id] ? C[id].name : id, in: v.length, mean: v.reduce((a, b) => a + b, 0) / keys.length })).sort((a, b) => b.in - a.in || b.mean - a.mean);
L.push('', `### Shared core (in >= ${(coreFrac * 100).toFixed(0)}% of the ${keys.length} decks; mean copies over all of them)`, '', '| card | name | decks | mean copies |', '|---|---|---|---|');
for (const c of core) L.push(`| ${c.id} | ${c.name} | ${c.in}/${keys.length} | ${c.mean.toFixed(1)} |`);
L.push('', `Core copies: ${core.reduce((s, c) => s + c.mean, 0).toFixed(1)} of 50.`);
// judge rankings from results/final/<deck>_<judge>_<n>.json
const rk = {};
for (const f of fs.readdirSync('results/final').filter(f => /_\d+\.json$/.test(f))) { const m = f.replace(/\.json$/, '').match(/^(.*)_([a-z0-9]+)_(\d+)$/); if (!m) continue; const j = JSON.parse(fs.readFileSync('results/final/' + f)); if (!j.per) continue; (rk[m[2]] || (rk[m[2]] = [])).push({ deck: m[1], B: j.B, n: +m[3] }); }
L.push('', '### Ranking under each judge (field mean B, games/list)', '');
for (const [jn, v] of Object.entries(rk)) { v.sort((a, b) => b.B - a.B); L.push(`- **${jn}**: ` + v.map(x => `${x.deck} ${(x.B * 100).toFixed(1)} (${x.n})`).join(' > ')); }
console.log(L.join('\n'));
if (args.includes('--out')) fs.writeFileSync(args[args.indexOf('--out') + 1], L.join('\n') + '\n');
