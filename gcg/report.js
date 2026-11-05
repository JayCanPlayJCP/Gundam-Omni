'use strict';
// Final report: results/final/REPORT.md (repo) + results/final/report.html (self-contained page with the matchup chart).
// node report.js FINALIST [REF1,REF2,...]
// Reads: results/final/<deck>_<judge>_<n>.json (searchcheck.js SOUT), results/final/summary.json (collate.js),
//        results/final/matchup_<FINALIST>.json (matchup.js), results/counter/*.json, results/final/notes.md (hand-written
//        verdict / play-guide prose: sections '## verdict', '## guide <OPP>', '## caveats').
const fs = require('fs'); const D = require('./decks.json'); const C = require('./cards.json');
const { W } = require('./evalfield'); const opps = Object.keys(D).filter(k => k.startsWith('W_') || k.startsWith('J_'));
const deck = process.argv[2]; const refs = (process.argv[3] || '').split(',').filter(Boolean);
const rd = (f) => { try { return JSON.parse(fs.readFileSync(f)); } catch (e) { return null; } };
const pct = (x, d = 1) => x == null ? '—' : (x * 100).toFixed(d);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const wilson = (p, n, z = 1.96) => { const d = 1 + z * z / n, c = (p + z * z / (2 * n)) / d, h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d; return [Math.max(0, c - h), Math.min(1, c + h)]; };
const JN = { k4n6: 'K4N6 search, hand evaluator', k4n6s2: 'K4N6 search, hand evaluator, fresh seed', mlp2: 'K4N6 search + learned evaluator (mlp2)', k3n3: 'K3N3 search', k2n2: 'K2N2 search', fast: 'fast heuristic AI' };
const JORDER = ['k4n6x2', 'mlp2', 'k4n6', 'k4n6s2', 'k4n6s3', 'k3n3', 'k2n2', 'fast'];
JN.k4n6x2 = 'K4N6 search, hand evaluator (all seeds pooled)'; JN.k4n6s3 = 'K4N6 search, hand evaluator, third seed';
const sum = rd('results/final/summary.json') || { islands: [], judges: {}, finals: {}, census: {} };
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
// pool two equal-size results (same judge, different seeds) into one
const poolN = (L) => { const per = {}, first = {}, second = {}; const N = L.reduce((t, x) => t + x.n, 0); const avg = (k, o) => L.reduce((t, x) => t + x[k][o] * x.n, 0) / N;
  for (const o of opps) { per[o] = avg('per', o); if (L.every(x => x.first)) { first[o] = avg('first', o); second[o] = avg('second', o); } }
  const wr = opps.map(o => per[o]); const mn = Math.min(...wr); return { deck: L[0].deck, n: N, per, first, second, B: mean(wr), A: opps.reduce((t, o) => t + (W[o] || 1 / opps.length) * per[o], 0), min: mn, minOpp: opps[wr.indexOf(mn)], S: L[0].S, seed: L.map(x => x.seed).join('+'), seeds: L.length }; };
const finals = (d) => { const o = {}; for (const f of fs.readdirSync('results/final')) { const m = f.match(/^(.*)_([a-z0-9]+)_(\d+)\.json$/); if (!m || m[1] !== d) continue; const j = rd('results/final/' + f); if (j && j.per) o[m[2]] = { ...j, n: +m[3] }; }
  const ks = ['k4n6', 'k4n6s2', 'k4n6s3', 'k4n6s4'].filter(k => o[k]); if (ks.length > 1) o.k4n6x2 = poolN(ks.map(k => o[k]));
  return Object.fromEntries(JORDER.filter(k => o[k]).map(k => [k, o[k]]).concat(Object.entries(o).filter(([k]) => !JORDER.includes(k)))); };
const F = finals(deck); const judges = Object.keys(F); const J0 = judges[0];
const firstSecond = (j) => [j.first ? mean(opps.map(b => j.first[b])) : null, j.second ? mean(opps.map(b => j.second[b])) : null];
const mu = rd(`results/final/matchup_${deck}.json`);
// hand-written notes
const notes = {}; { const t = fs.existsSync('results/final/notes.md') ? fs.readFileSync('results/final/notes.md', 'utf8') : ''; let cur = null; for (const line of t.split('\n')) { const m = line.match(/^## (.+)$/); if (m) { cur = m[1].trim(); notes[cur] = []; } else if (cur) notes[cur].push(line); } for (const k in notes) notes[k] = notes[k].join('\n').trim(); }
// minimal markdown -> html (paragraphs, bullets, bold, code, tables)
function md(t) {
  if (!t) return ''; const inl = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`(.+?)`/g, '<code>$1</code>');
  const out = []; const lines = t.split('\n'); let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (/^\s*$/.test(l)) { i++; continue; }
    if (/^\|/.test(l)) { const rows = []; while (i < lines.length && /^\|/.test(lines[i])) rows.push(lines[i++]); const cells = (r) => r.replace(/^\||\|$/g, '').split('|').map(c => c.trim()); const h = cells(rows[0]); out.push('<div class="tw"><table><thead><tr>' + h.map(c => `<th>${inl(c)}</th>`).join('') + '</tr></thead><tbody>' + rows.slice(2).map(r => '<tr>' + cells(r).map(c => `<td>${inl(c)}</td>`).join('') + '</tr>').join('') + '</tbody></table></div>'); continue; }
    if (/^\s*- /.test(l)) { const it = []; while (i < lines.length && /^\s*- /.test(lines[i])) it.push(lines[i++].replace(/^\s*- /, '')); out.push('<ul>' + it.map(x => `<li>${inl(x)}</li>`).join('') + '</ul>'); continue; }
    if (/^### /.test(l)) { out.push(`<h4>${inl(l.slice(4))}</h4>`); i++; continue; }
    const p = []; while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^\s*- |^\||^### /.test(lines[i])) p.push(lines[i++]); out.push(`<p>${inl(p.join(' '))}</p>`);
  }
  return out.join('\n');
}
const M = []; const H = []; // markdown + html sections
const sec = (id, title, html, mdText) => { H.push(`<section id="${id}"><h2>${esc(title)}</h2>${html}</section>`); M.push(`## ${title}`, '', mdText, ''); };
const mdTable = (head, rows) => ['| ' + head.join(' | ') + ' |', '|' + head.map(() => '---').join('|') + '|', ...rows.map(r => '| ' + r.join(' | ') + ' |')].join('\n');
const htTable = (head, rows, cls = '') => `<div class="tw"><table class="${cls}"><thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => '<tr>' + r.map(c => `<td>${esc(c)}</td>`).join('') + '</tr>').join('')}</tbody></table></div>`;
const both = (head, rows, cls) => [htTable(head, rows, cls), mdTable(head, rows)];

// 1. verdict
sec('verdict', 'Verdict', md(notes.verdict || '_verdict pending_'), notes.verdict || '_verdict pending_');
// 2. headline numbers
if (J0) {
  const j = F[J0]; const [fw, sw] = firstSecond(j); const tiles = [['Field mean (Metric B)', pct(j.B) + '%', `${j.n} games per list × ${opps.length} lists`], ['Metric A (real-share weighted)', pct(j.A) + '%', 'weighted by tournament share'], ['Worst matchup', pct(j.min) + '%', j.minOpp], ['Going first / second', `${pct(fw, 0)}% / ${pct(sw, 0)}%`, 'mean over the field']];
  const rows = judges.map(k => { const x = F[k]; const [a, b] = firstSecond(x); return [JN[k] || k, String(x.n), pct(x.B), pct(x.A), `${pct(x.min)} (${x.minOpp})`, pct(a), pct(b), String(opps.filter(o => x.per[o] >= 0.75).length) + '/' + opps.length]; });
  const [th, tm] = both(['judge (both sides use it)', 'games/list', 'field mean %', 'Metric A %', 'worst %', 'first %', 'second %', 'lists ≥75%'], rows);
  sec('numbers', `Win rates of ${deck} under every judge`, `<div class="tiles">${tiles.map(t => `<div class="tile"><div class="tl">${esc(t[0])}</div><div class="tv">${esc(t[1])}</div><div class="ts">${esc(t[2])}</div></div>`).join('')}</div><p class="note">Tiles: ${esc(JN[J0] || J0)} on both sides, ${opps.length * j.n} games, seat-balanced.</p>${th}`, tm);
}
// 3. decklist
{
  const cards = [...D[deck].cards].sort((a, b) => (C[a.id].type + a.id).localeCompare(C[b.id].type + b.id));
  const paste = cards.map(c => `${c.n} x ${c.id}`).join('\n');
  const rows = cards.map(c => [String(c.n), c.id, C[c.id].name, C[c.id].type, C[c.id].color, String(C[c.id].lv ?? ''), String(C[c.id].cost ?? '')]);
  const [th, tm] = both(['n', 'card', 'name', 'type', 'colour', 'Lv', 'cost'], rows);
  sec('deck', `Decklist: ${deck}`, `<p>${esc(D[deck].label || '')}</p><div class="paste"><div class="ph"><span>ExBurst paste block (main deck, 50)</span><button type="button" onclick="navigator.clipboard&&navigator.clipboard.writeText(document.getElementById('pb').textContent).then(()=>{this.textContent='Copied'})">Copy</button></div><pre id="pb">${esc(paste)}</pre><p class="note">Resource deck (separate): 10 × R-001. Starting tokens: EXB-001 EX Base; EXR-001 EX Resource (Player Two).</p></div>${th}`, '```\n' + paste + '\n```\n\nResource deck (separate): 10 x R-001.\n\n' + tm);
}
// 4. per-matchup chart
if (J0) {
  const js = judges.slice(0, 2); const order = [...opps].sort((a, b) => F[J0].per[a] - F[J0].per[b]);
  const data = order.map(o => ({ o, s: js.map(k => { const p = F[k].per[o], n = F[k].n; const ci = wilson(p, n); return { k, p, n, lo: ci[0], hi: ci[1], f: F[k].first && F[k].first[o], sc: F[k].second && F[k].second[o] }; }) }));
  const rowsH = data.map((d, i) => `<div class="row" data-i="${i}" tabindex="0"><div class="lab">${esc(d.o)}</div><div class="track">${d.s.map((s, si) => `<span class="wh s${si + 1}" style="left:${(s.lo * 100).toFixed(2)}%;width:${((s.hi - s.lo) * 100).toFixed(2)}%"></span><span class="dot s${si + 1}" style="left:${(s.p * 100).toFixed(2)}%"></span>`).join('')}</div></div>`).join('');
  const legend = js.map((k, i) => `<span class="lg"><span class="sw s${i + 1}"></span>${esc(JN[k] || k)} (${F[k].n}/list)</span>`).join('');
  const tbl = both(['opponent', 'real share %', ...js.flatMap(k => [`${k} win %`, `${k} 95% CI`]), `${J0} first %`, `${J0} second %`], data.map(d => [d.o, pct(W[d.o]), ...d.s.flatMap(s => [pct(s.p), `${pct(s.lo, 0)}–${pct(s.hi, 0)}`]), pct(d.s[0].f, 0), pct(d.s[0].sc, 0)]));
  sec('matchups', 'Per-matchup win rates', `<div class="legend">${legend}<span class="lg"><span class="ref75"></span>75% target</span></div><div class="chart" id="chart"><div class="axis"><div class="lab"></div><div class="track">${[0, 25, 50, 75, 100].map(v => `<span class="tick" style="left:${v}%">${v}%</span>`).join('')}</div></div><div class="plot">${rowsH}<div class="refs"><div class="lab"></div><div class="track"><span class="g" style="left:25%"></span><span class="g base" style="left:50%"></span><span class="g t75" style="left:75%"></span></div></div></div><div class="tip" id="tip" role="status"></div></div><p class="note">Dots: win rate of ${esc(deck)} against each tournament-winning list, both sides on the named judge; bars: 95% Wilson interval. Sorted hardest first under ${esc(J0)}.</p><details><summary>Table view</summary>${tbl[0]}</details><script>const DATA=${JSON.stringify(data)};const JN=${JSON.stringify(Object.fromEntries(js.map(k => [k, JN[k] || k])))};</script>`, tbl[1]);
}
// 5. play guide for the 5 hardest matchups
if (J0) {
  const hard = [...opps].sort((a, b) => F[J0].per[a] - F[J0].per[b]).slice(0, 5); const parts = [], mparts = [];
  for (const o of hard) {
    const r = mu && mu.res[o]; const p = F[J0].per[o];
    let h = `<h3>${esc(o)} — ${pct(p)}% (${esc(J0)}, ${F[J0].n} games)</h3>`; let m = `### ${o} — ${pct(p)}% (${J0}, ${F[J0].n} games)\n\n`;
    if (r) {
      const reasons = Object.entries(r.reasons || {}).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} ${v}`).join(', ');
      const facts = [`Guide sample: ${r.n} games (${esc(mu.S ? JSON.stringify(mu.S) : '')} both sides, seed ${mu.seed}): ${pct(r.wr)}% overall, ${pct(r.first, 0)}% going first, ${pct(r.second, 0)}% going second, ${r.avgTurns.toFixed(1)} turns on average. Game ends: ${reasons}.`,
        `Cards that win it for us (win rate when seen minus when not seen): ${r.myBest.slice(0, 4).map(x => `${x.name} (${x.id}) ${x.d >= 0 ? '+' : ''}${pct(x.d, 0)}`).join('; ')}.`,
        `Their cards to play around: ${r.theirThreats.slice(0, 4).map(x => `${x.name} (${x.id}) ${x.d >= 0 ? '+' : ''}${pct(x.d, 0)} for them`).join('; ')}.`];
      h += '<ul>' + facts.map(f => `<li>${esc(f)}</li>`).join('') + '</ul>'; m += facts.map(f => '- ' + f).join('\n') + '\n\n';
    }
    const g = notes['guide ' + o]; if (g) { h += md(g); m += g + '\n\n'; }
    parts.push(h); mparts.push(m);
  }
  sec('guide', 'Play guide: the five hardest matchups', parts.join('\n') + '<p class="note">Card deltas are correlational (a card seen in more games of a long game is seen more often); read them as "what shows up when the matchup is won", not as causal effects.</p>', mparts.join('\n'));
}
// 6. reference decks / all finalists
{
  const ds = [deck, ...refs].filter((d, i, a) => a.indexOf(d) === i);
  const rows = []; for (const d of ds) { const f = finals(d); for (const [k, x] of Object.entries(f)) { const [a, b] = firstSecond(x); rows.push([d, JN[k] || k, String(x.n), pct(x.B), pct(x.A), `${pct(x.min)} (${x.minOpp})`, pct(a), pct(b)]); } }
  const [th, tm] = both(['deck', 'judge', 'games/list', 'field mean %', 'Metric A %', 'worst %', 'first %', 'second %'], rows);
  sec('field', 'Finalists and reference decks under the strong judges', th, tm);
}
// 7. islands
{
  const rows = sum.islands.filter(r => r.heurB != null).map(r => [r.unit, pct(r.heurB), pct(r.checkB), r.checkMin != null ? `${pct(r.checkMin)} ${r.checkMinOpp || ''}` : '—', r.pureB != null ? `${pct(r.pureB)} (${r.pureN.toFixed(0)}/list)` : '—']);
  const [th, tm] = both(['colour pair', 'heuristic GA best, fast AI %', 'K2N2 check %', 'check worst', 'pure-search GA elite %'], rows);
  sec('islands', 'Search islands (one per colour pair / mono colour)', `<p class="note">Fast-AI numbers run 10–25 points above search-AI numbers for the same deck; compare columns, not across them. 100 games/list for the checks.</p>${th}`, tm);
}
// 8. convergence
{
  const conv = fs.existsSync('results/final/convergence.md') ? fs.readFileSync('results/final/convergence.md', 'utf8') : '';
  if (conv) sec('convergence', 'Convergence across islands and judges', md(conv), conv);
}
// 9. counter-decks
{
  const rows = []; for (const f of fs.existsSync('results/counter') ? fs.readdirSync('results/counter').filter(f => /_vs_[A-Z]+\.json$/.test(f)) : []) { const j = rd('results/counter/' + f); if (!j || !j.elites) continue; const m = f.match(/^(.*)_vs_([A-Z]+)\.json$/); const e = j.elites[0]; const rt = rd(`results/counter/retest_${m[1]}_vs_${m[2]}.json`); const cross = fs.readdirSync('results/counter').filter(g => g.startsWith('retest_') && g.endsWith(`_from_${m[1]}_vs_${m[2]}.json`)).map(g => { const x = rd('results/counter/' + g); return `${pct(x.wr)} vs ${x.target}`; }).join('; '); rows.push([m[1], m[2], `${pct(e.search.B)} (${e.search.n.toFixed(0)} games, in-search)`, rt ? `${pct(rt.wr)} (${rt.n} games, fresh seeds${rt.S ? ', ' + JSON.stringify(rt.S) : ''})` : '—', cross || '—']); }
  if (rows.length) { const [th, tm] = both(['target', 'counter colours', 'best counter win % (GA, biased up)', 'best counter re-tested vs target', 'same counter vs other decks'], rows); sec('counter', 'Counter-deck search against the finalist', `${md(notes.counter || '')}${th}`, (notes.counter || '') + '\n\n' + tm); }
}
// 10. census
{
  const it = Object.entries(sum.census).map(([u, c]) => `**${u}** (chassis ${c.chassis}, base ${pct(c.base)}%): ` + c.top.slice(0, 6).map(t => `${t.name} (${t.id}) ${t.d >= 0 ? '+' : ''}${pct(t.d)}`).join('; '));
  const t = '3 copies of each pool card swapped into the chassis\'s 3 weakest slots, fast AI, 40 games per list; points of field mean gained. A single swap measured this way has about ±3 points of noise, so only the larger gains are signals. The census run before the islands ranked which cards the island GAs should try. Mono-colour units were not censused.\n\n' + it.map(x => '- ' + x).join('\n');
  sec('census', 'Card census highlights per colour pair', md(t), t);
}
// 11. judges
{
  const rows = Object.entries(sum.judges).filter(([k]) => k !== 'smoke_mcts').map(([k, j]) => [k, JSON.stringify(j.X), JSON.stringify(j.Y), String(j.games), pct(j.score), `${pct(j.ci95[0])}–${pct(j.ci95[1])}`]);
  const [th, tm] = both(['mirror test', 'X', 'Y', 'games', 'X score %', '95% CI'], rows);
  sec('judges', 'Judge strength (same deck both sides, X vs Y over the field)', `${md(notes.judges || '')}${th}`, (notes.judges || '') + '\n\n' + tm);
}
if (notes.caveats) sec('caveats', 'Method and caveats', md(notes.caveats), notes.caveats);
fs.writeFileSync('results/final/REPORT.md', `# Operation Omni — final report (${deck})\n\n` + M.join('\n'));
const CSS = `:root{--surface:#fcfcfb;--page:#f9f9f7;--ink:#0b0b0b;--ink2:#52514e;--muted:#6f6d68;--grid:#e1e0d9;--axis:#c3c2b7;--ring:rgba(11,11,11,.10);--s1:#2a78d6;--s2:#eb6834;--tgt:#008300;--code:#f0efec}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--surface:#1a1a19;--page:#0d0d0d;--ink:#f0efec;--ink2:#c3c2b7;--muted:#a3a29a;--grid:#2c2c2a;--axis:#383835;--ring:rgba(255,255,255,.10);--s1:#3987e5;--s2:#d95926;--tgt:#0ca30c;--code:#262624}}
:root[data-theme="dark"]{--surface:#1a1a19;--page:#0d0d0d;--ink:#f0efec;--ink2:#c3c2b7;--muted:#a3a29a;--grid:#2c2c2a;--axis:#383835;--ring:rgba(255,255,255,.10);--s1:#3987e5;--s2:#d95926;--tgt:#0ca30c;--code:#262624}
*{box-sizing:border-box}body{margin:0;background:var(--page);color:var(--ink);font:15px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:1040px;margin:0 auto;padding:24px 16px 64px}h1{font-size:1.6rem;margin:0 0 4px}h2{font-size:1.2rem;margin:0 0 12px}h3{font-size:1rem;margin:20px 0 6px}h4{font-size:.95rem;margin:14px 0 4px}
section{background:var(--surface);border:1px solid var(--ring);border-radius:10px;padding:18px 18px 12px;margin:16px 0}p{margin:6px 0 10px}.note{color:var(--ink2);font-size:.86rem}.sub{color:var(--ink2);margin:0}
nav{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:.88rem;margin:10px 0 0}nav a{color:var(--ink2)}
.tw{overflow-x:auto;margin:8px 0}table{border-collapse:collapse;font-size:.85rem;min-width:100%}th,td{padding:5px 8px;border-bottom:1px solid var(--grid);text-align:left;white-space:nowrap}th{color:var(--ink2);font-weight:600}td{font-variant-numeric:tabular-nums}
code,pre{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.84rem}code{background:var(--code);padding:1px 4px;border-radius:4px}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin:4px 0 8px}.tile{border:1px solid var(--ring);border-radius:8px;padding:10px 12px}.tl{color:var(--ink2);font-size:.82rem}.tv{font-size:1.7rem;font-weight:600;line-height:1.2}.ts{color:var(--muted);font-size:.8rem;overflow-wrap:anywhere}
.paste{border:1px solid var(--ring);border-radius:8px;padding:8px 12px;margin:8px 0}.ph{display:flex;justify-content:space-between;align-items:center;font-size:.85rem;color:var(--ink2)}.ph button{font:inherit;border:1px solid var(--axis);background:transparent;color:var(--ink);border-radius:6px;padding:3px 10px;cursor:pointer}pre{margin:6px 0;white-space:pre;overflow-x:auto;columns:2;column-gap:24px}
.legend{display:flex;flex-wrap:wrap;gap:6px 16px;font-size:.84rem;color:var(--ink2);margin-bottom:8px}.lg{display:inline-flex;align-items:center;gap:6px}.sw{width:10px;height:10px;border-radius:50%;display:inline-block}.sw.s1{background:var(--s1)}.sw.s2{background:var(--s2)}.ref75{width:0;height:12px;border-left:2px dashed var(--tgt);display:inline-block}
.chart{position:relative}.row,.axis,.refs{display:grid;grid-template-columns:minmax(118px,170px) 1fr;gap:8px;align-items:center}.row{height:24px;border-radius:4px;outline:none}.row:hover,.row:focus{background:var(--code)}.lab{font-size:.78rem;color:var(--ink2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:right}
.track{position:relative;height:100%;margin-right:12px}.axis{height:18px}.tick{position:absolute;transform:translateX(-50%);font-size:.72rem;color:var(--muted);font-variant-numeric:tabular-nums}
.plot{position:relative}.refs{position:absolute;inset:0;pointer-events:none}.refs .track{height:100%}.g{position:absolute;top:0;bottom:0;border-left:1px solid var(--grid)}.g.base{border-left-color:var(--axis)}.g.t75{border-left:2px dashed var(--tgt)}
.wh{position:absolute;height:2px;border-radius:1px;z-index:1}.wh.s1{top:8px;background:var(--s1);opacity:.55}.wh.s2{top:15px;background:var(--s2);opacity:.55}
.dot{position:absolute;width:10px;height:10px;border-radius:50%;transform:translateX(-50%);box-shadow:0 0 0 2px var(--surface);z-index:2}.dot.s1{top:4px;background:var(--s1)}.dot.s2{top:11px;background:var(--s2)}
.tip{position:absolute;display:none;z-index:5;background:var(--surface);color:var(--ink);border:1px solid var(--axis);border-radius:8px;padding:8px 10px;font-size:.8rem;pointer-events:none;box-shadow:0 4px 14px rgba(0,0,0,.12);max-width:280px}.tip b{display:block;margin-bottom:2px}
details{margin:8px 0}summary{cursor:pointer;color:var(--ink2);font-size:.88rem}ul{padding-left:20px;margin:6px 0 10px}li{margin:3px 0}
@media (max-width:560px){.row,.axis,.refs{grid-template-columns:96px 1fr}.tv{font-size:1.4rem}pre{columns:1}}`;
const JS = `(()=>{const tip=document.getElementById('tip');if(!tip||typeof DATA==='undefined')return;const ch=document.getElementById('chart');
const f=x=>x==null?'—':(x*100).toFixed(1)+'%';function show(r){const d=DATA[+r.dataset.i];tip.innerHTML='<b>'+d.o+'</b>'+d.s.map(s=>JN[s.k]+': '+f(s.p)+' ('+(s.lo*100).toFixed(0)+'–'+(s.hi*100).toFixed(0)+'%, n='+s.n+(s.f!=null?', first '+f(s.f)+' / second '+f(s.sc):'')+')').join('<br>');
tip.style.display='block';const cr=ch.getBoundingClientRect(),rr=r.getBoundingClientRect();let top=rr.bottom-cr.top+4;if(top+tip.offsetHeight>ch.offsetHeight)top=rr.top-cr.top-tip.offsetHeight-4;tip.style.top=top+'px';tip.style.left=Math.max(0,Math.min(ch.offsetWidth-tip.offsetWidth,rr.left-cr.left+110))+'px';}
document.querySelectorAll('.row').forEach(r=>{r.addEventListener('mouseenter',()=>show(r));r.addEventListener('focus',()=>show(r));r.addEventListener('mouseleave',()=>tip.style.display='none');r.addEventListener('blur',()=>tip.style.display='none');});})();`;
const navs = H.map(h => { const m = h.match(/<section id="([^"]+)"><h2>([^<]+)<\/h2>/); return m ? `<a href="#${m[1]}">${m[2].replace(/:.*$/, '')}</a>` : ''; }).join('');
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Operation Omni Results</title><style>${CSS}</style></head><body><main><h1>Operation Omni results</h1><p class="sub">Gundam Card Game deck search: strongest legal deck against ${opps.length} tournament-winning lists. Finalist: <strong>${esc(deck)}</strong>. Generated ${new Date().toISOString().slice(0, 10)}.</p><nav>${navs}</nav>${H.join('\n')}</main><script>${JS}</script></body></html>`;
fs.writeFileSync('results/final/report.html', html);
console.log(`wrote results/final/REPORT.md and results/final/report.html (${(html.length / 1024).toFixed(0)} KB), judges: ${judges.join(', ')}`);
