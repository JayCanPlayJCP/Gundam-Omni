'use strict';
// Evaluate decks vs the 26-list field. Metric B = plain mean over lists; Metric A = real-share weighted (archetype proxy share split over its lists).
// node evalfield.js N seed prof deck1 deck2 ...
const { runMatrix } = require('./run'); const D = require('./decks.json'); const P = require('./profiles'); const OPP = require('./opp_profiles.json');
const ARCH = { MF: ['J_MobileFighter', 'J_MF_Kichijoji', 'J_MF_Machida', 'W_DUS_Shining', 'W_TKY3_Shining'], 'SF Blockers': ['J_SFBlockers', 'W_DC_SF', 'W_TOR_SF'], 'Char IBO/G-P Zeon': ['J_CharIBO', 'W_MNL_GPZeon', 'W_MEX_GPZeon'], 'SF IBO': ['J_SFIBO_Chiba', 'J_SFIBO_alt', 'W_TKY1_BarbSF'], Nu: ['W_LILLE_Nu', 'W_JKT_Nu', 'J_NuAggro'], 'BG OYW': ['J_BGOYW', 'J_BGOYW_Chelmo'], Kshatriya: ['J_KshatriyaBanshee'], EFF: ['J_EFFBanshee'], Wing: ['J_Wing_Omiya'], Justice: ['J_JusticeAerial'], Academy: ['W_BRIS_RWAcademy'], "Z'Gok": ['W_MKE_ZGok'], 'SF Victory': ['W_MEL_SFVictory'] };
const PROXY = { MF: 32.7, 'SF Blockers': 22.3, 'Char IBO/G-P Zeon': 21.5, 'SF IBO': 16.3, Nu: 15.3, 'BG OYW': 6.1, Kshatriya: 5.2, EFF: 5.2, Wing: 4.1, Justice: 3.1, Academy: 3, "Z'Gok": 2, 'SF Victory': 2 };
const W = {}; { const tot = Object.values(PROXY).reduce((a, b) => a + b, 0); for (const a in ARCH) for (const id of ARCH[a]) W[id] = PROXY[a] / tot / ARCH[a].length; }
const opps = Object.keys(D).filter(k => k.startsWith('W_') || k.startsWith('J_'));
async function evalDeck(deck, n, seed, prof, search) {
  const pairs = opps.map(b => ({ a: deck, b, key: b, opts: { aiA: P[prof], aiB: P[OPP[b]], searchA: search || null, searchB: search || null }, seed }));
  const r = await runMatrix(pairs, n, seed, 2); const wrs = opps.map(b => r[b].wr); const s = [...wrs].sort((a, b) => a - b);
  const mB = wrs.reduce((a, b) => a + b, 0) / wrs.length; const mA = opps.reduce((a, b) => a + W[b] * r[b].wr, 0);
  return { metricB: mB, metricA: mA, min: s[0], minOpp: opps[wrs.indexOf(s[0])], b5: s.slice(0, 5).reduce((a, b) => a + b, 0) / 5, per: Object.fromEntries(opps.map(b => [b, r[b].wr])) };
}
module.exports = { evalDeck, opps, W, ARCH };
if (require.main === module) (async () => {
  const [n, seed, prof, ...decks] = process.argv.slice(2);
  for (const d of decks) { const e = await evalDeck(d, +n, +seed, prof); console.log(`${d.padEnd(18)} B ${(e.metricB * 100).toFixed(1)}  A ${(e.metricA * 100).toFixed(1)}  b5 ${(e.b5 * 100).toFixed(1)}  min ${(e.min * 100).toFixed(1)} (${e.minOpp})`); }
})();
