'use strict';
// Hand-check helper: for every card in a deck, print official text, implementation fidelity / note and where it lives.
// node tools/cardcheck.js DECKKEY [--src]   (--src also prints the implementing source line(s))
const path = require('path'); const fs = require('fs'); const root = path.join(__dirname, '..');
const D = require(path.join(root, 'decks.json')); const C = require(path.join(root, 'cards.json')); const EFX = require(path.join(root, 'effects'));
const [key, flag] = process.argv.slice(2); const deck = D[key]; if (!deck) { console.error('no deck ' + key); process.exit(1); }
const files = ['effects.js', 'effects_green.js', 'effects_blue.js', 'effects_red.js', 'effects_white.js', 'effects_purple.js'].filter(f => fs.existsSync(path.join(root, f)));
const where = (id) => { for (const f of files) { const L = fs.readFileSync(path.join(root, f), 'utf8').split('\n'); const i = L.findIndex(l => l.includes(`F('${id}'`)); if (i >= 0) return { f, line: i + 1, src: L.slice(i, i + 4).join('\n') }; } return null; };
console.log(`${key}: ${deck.label}`);
for (const { n, id } of deck.cards) {
  const c = C[id]; const e = EFX[id]; const w = where(id);
  console.log(`\n${n}x ${id} ${c.name} [${c.color} ${c.type} Lv${c.lv} cost${c.cost} ${c.ap}/${c.hp}] ${(c.traits || []).join(',')}`);
  console.log(`   text: ${c.text.replace(/\s+/g, ' ')}`);
  console.log(`   impl: ${e ? e.fidelity : 'MISSING'}${e && e.note ? ' — ' + e.note : ''}${w ? `  (${w.f}:${w.line})` : e ? '  (auto-compiled)' : ''}`);
  if (flag === '--src' && w) console.log(w.src.split('\n').map(l => '      ' + l.slice(0, 400)).join('\n'));
}
