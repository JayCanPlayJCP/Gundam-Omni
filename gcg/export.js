'use strict';
// node export.js DECKID [style] -> prints ExBurst-compatible main deck + resource/token note
const D = require('./decks.json'); const C = require('./cards.json');
const id = process.argv[2]; const style = process.argv[3] || '';
const cards = [...D[id].cards].sort((a, b) => (C[a.id].type + a.id).localeCompare(C[b.id].type + b.id));
const tokens = new Set(); for (const c of cards) for (const m of C[c.id].text.matchAll(/\[([^\]]+)\]\(\(/g)) tokens.add(m[1]);
let s = `${id}${style ? ' | piloting style: ' + style : ''}\nMAIN DECK (50) — paste only this section into ExBurst\n`;
for (const c of cards) s += `${c.n} x ${c.id}\n`;
s += `\nRESOURCE DECK (10, separate): 10 x R-001\nSTARTING TOKENS: EXB-001 EX Base; EXR-001 EX Resource (Player Two)\nUNIT TOKENS this list can create: ${[...tokens].join(', ') || 'none'}\n\nREADABLE LIST\n`;
for (const t of ['UNIT', 'PILOT', 'COMMAND', 'BASE']) { const g = cards.filter(c => C[c.id].type === t); if (!g.length) continue; s += `${t} (${g.reduce((x, c) => x + c.n, 0)})\n`; for (const c of g) s += `  ${c.n}x ${c.id} ${C[c.id].name}\n`; }
console.log(s);
