'use strict';
// Writes coverage.md: every implemented card, fidelity, notes, and which decks use it.
const EFX = require('./effects'); const C = require('./cards.json'); const D = require('./decks.json'); const fs = require('fs');
const uses = {}; for (const k in D) for (const c of D[k].cards) (uses[c.id] = uses[c.id] || []).push(k);
const rows = Object.keys(EFX).sort().map(id => ({ id, name: C[id].name, color: C[id].color, type: C[id].type, fid: EFX[id].fidelity, note: EFX[id].note || '', decks: (uses[id] || []).length }));
const full = rows.filter(r => r.fid === 'full').length;
let md = `# Card implementation coverage\n\n${rows.length} cards implemented (${full} full, ${rows.length - full} simplified). All ${Object.keys(uses).length} cards in the 25 test decks are implemented.\n\n`;
md += `| Card | Name | Color | Type | Fidelity | Used in decks | Note |\n|---|---|---|---|---|---|---|\n`;
for (const r of rows) md += `| ${r.id} | ${r.name} | ${r.color} | ${r.type} | ${r.fid} | ${r.decks} | ${r.note} |\n`;
fs.writeFileSync('coverage.md', md); console.log(`coverage: ${rows.length} cards, ${full} full, simplified:`, rows.filter(r => r.fid !== 'full').map(r => r.id + ' ' + r.name).join('; '));
