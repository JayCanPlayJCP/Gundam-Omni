'use strict';
// Fuzz: random legal-ish 2-color decks from the implemented pool vs random gauntlet lists; catches engine/effect exceptions.
const { playGame } = require('./sim'); const EFX = require('./effects'); const C = require('./engine').CARDS; const D = require('./decks.json'); const P = require('./profiles');
const { rngFrom } = require('./engine');
const r = rngFrom(+(process.argv[2] || 7)); const N = +(process.argv[3] || 300);
const gl = Object.keys(D).filter(k => k.startsWith('W_') || k.startsWith('J_'));
const pairs = [['Green', 'Blue'], ['Green', 'Red'], ['Blue', 'Red']];
let errs = 0; const errById = {};
for (let i = 0; i < N; i++) {
  const cols = pairs[i % 3]; const pool = Object.keys(EFX).filter(id => C[id] && cols.includes(C[id].color) && C[id].type !== 'TOKEN' && C[id].legality !== 'banned' && id !== 'GD01-020' && (EFX[id].fidelity === 'auto' || r() < 0.3));
  const deck = {}; let n = 0; while (n < 50) { const id = pool[Math.floor(r() * pool.length)]; const k = Math.min(4 - (deck[id] || 0), 50 - n, 1 + Math.floor(r() * 3)); if (k <= 0) continue; deck[id] = (deck[id] || 0) + k; n += k; }
  const list = Object.entries(deck).map(([id, n]) => ({ id, n }));
  try { playGame(list, gl[i % gl.length], 1000 + i, i % 2 === 0, { aiA: P.balanced, aiB: P.balanced }); }
  catch (e) { errs++; const k = (e.stack || '').split('\n').slice(0, 3).join(' | '); errById[k] = (errById[k] || 0) + 1; }
}
console.log('games', N, 'errors', errs); for (const [k, v] of Object.entries(errById).sort((a, b) => b[1] - a[1]).slice(0, 10)) console.log(v, k.slice(0, 400));
