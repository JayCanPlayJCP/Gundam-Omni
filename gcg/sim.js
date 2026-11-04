'use strict';
// Single-game entry point and batch runner core.
const eng = require('./engine');
const EFX = require('./effects');
eng.setEffects(EFX);
const { AI } = require('./ai'); const { SearchAI } = require('./searchai');
const DECKS = require('./decks.json');

function deckList(d) { return typeof d === 'string' ? DECKS[d].cards : d; }
function playGame(deckA, deckB, seed, aFirst, opts = {}) {
  const A = deckList(deckA), B = deckList(deckB);
  const aiA = opts.searchA ? new SearchAI(opts.aiA, opts.searchA) : new AI(opts.aiA), aiB = opts.searchB ? new SearchAI(opts.aiB, opts.searchB) : new AI(opts.aiB);
  const g = aFirst ? new eng.Game(A, B, seed, [aiA, aiB], opts) : new eng.Game(B, A, seed, [aiB, aiA], opts);
  g.play(opts.maxTurns || 40);
  const ai = aFirst ? 0 : 1; // index of deck A
  const sA = g.stats.p[ai], pA = g.players[ai];
  const res = g.winner === null ? 'draw' : (g.winner === ai ? 'win' : 'loss');
  const conv = sA.twoShieldTurn === null ? null : (res === 'win' && pA.turnsTaken - sA.twoShieldTurn <= 1);
  const seen = {}; { const add = (id) => { seen[id] = (seen[id] || 0) + 1; };
    for (const c of pA.hand) add(c.id); for (const c of pA.trash) add(c.id); for (const c of (pA.exile || [])) add(c.id);
    for (const u of pA.units) { if (!u.token) add(u.def.id); if (u.pilot) add(u.pilot.id); } if (pA.base && !pA.base.ex) add(pA.base.def.id);
    for (const id of (pA.brokenToTrash || [])) seen[id]--; }
  return { seen, res, first: aFirst, turns: g.turn, reason: g.reason, hands6: sA.endMainHands6, reached2: sA.twoShieldTurn !== null, conv, handAt2: sA.handAt2Shield,
    extra: sA.extraCards, oppReached2: g.stats.p[1 - ai].twoShieldTurn !== null, log: g.log };
}
module.exports = { playGame, DECKS, EFX };
