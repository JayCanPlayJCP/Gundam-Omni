'use strict';
// Learned value function for the search AIs.
//   feats(g, me, meToMove) -> Float64Array of position features from `me`'s side (names in NAMES)
//   load(path) -> { prob(g, me), score(g, me) } using a model JSON written by train_lr.js / train_mlp.py:
//     { type: 'lr', names, mu, sd, w, b }  or  { type: 'mlp', names, mu, sd, layers: [{ W: [[...]], b: [...] }, ...] }
//     (hidden layers ReLU, final layer one logit). Inputs are standardized with mu/sd.
// In search leaves the searching player is always the one to move next (rollouts end after the opponent's turn),
// so score() calls feats(g, me, true). Self-play data (selfplay.js) records both sides at every turn boundary.
const { AI } = require('./ai'); const EFX = require('./effects');
const H = new AI({});

const SIDE = ['shields', 'base', 'baseHP', 'life', 'units', 'sumAP', 'sumHP', 'boardV', 'lv12', 'lv34', 'lv56', 'lv7', 'blockers', 'activeBlk', 'rested',
  'linked', 'paired', 'tokens', 'hm', 'supp', 'breach', 'repair', 'fs', 'maxAP', 'attackers', 'hand', 'hUnit', 'hPilot', 'hCmd', 'hBase', 'hRemoval',
  'hPlayable', 'hHighLv', 'level', 'ex', 'resDeck', 'deck', 'trash', 'danger'];
const GLOB = ['toMove', 'turn', 'handEval', 'lifeDiff', 'boardDiff', 'myPush', 'oppPush', 'myClock', 'oppClock'];
const NAMES = [...SIDE.map(s => 'm_' + s), ...SIDE.map(s => 'o_' + s), ...GLOB];

function life(p) { return p.shields.length + (p.base ? Math.max(0, p.base.def.hp - p.base.dmg) / 3 : 0); }
function sideFeats(g, p, out, o) {
  const us = p.units; let sap = 0, shp = 0, bv = 0, l12 = 0, l34 = 0, l56 = 0, l7 = 0, blk = 0, ablk = 0, rest = 0, lk = 0, pr = 0, tok = 0, hm = 0, sp = 0, br = 0, rp = 0, fs = 0, mx = 0, att = 0;
  for (const u of us) {
    const ap = g.ap(u), hp = Math.max(0, g.hpLeft(u)); sap += ap; shp += hp; bv += H.unitValue(g, u); if (ap > mx) mx = ap;
    const lv = u.def.lv; if (lv <= 2) l12++; else if (lv <= 4) l34++; else if (lv <= 6) l56++; else l7++;
    const [kB, kH, kS, kBr, kR, kF] = g.kwVals(u, ['Blocker', 'High-Maneuver', 'Suppression', 'Breach', 'Repair', 'First Strike']);
    if (kB) { blk++; if (!u.rested) ablk++; } if (u.rested) rest++; if (u.linked) lk++; if (u.pilot) pr++; if (u.token) tok++;
    if (kH) hm++; if (kS) sp++; br += kBr; rp += kR; if (kF) fs++;
    if (ap > 0 && !(EFX[u.def.id] && (EFX[u.def.id].cannotAttack || EFX[u.def.id].noAttackPlayer))) att++;
  }
  const lvl = g.level(p); let hu = 0, hpi = 0, hc = 0, hb = 0, hr = 0, hpl = 0, hhi = 0;
  for (const c of p.hand) { if (c.type === 'UNIT') hu++; else if (c.type === 'PILOT') hpi++; else if (c.type === 'COMMAND') { hc++; if (EFX[c.id] && (EFX[c.id].removal || EFX[c.id].defAction)) hr++; } else hb++; if (c.lv <= lvl + 1) hpl++; else hhi++; }
  const L = life(p); const baseOn = p.base ? 1 : 0; const bhp = p.base ? Math.max(0, p.base.def.hp - p.base.dmg) : 0;
  const v = [p.shields.length, baseOn, bhp, L, us.length, sap, shp, bv, l12, l34, l56, l7, blk, ablk, rest, lk, pr, tok, hm, sp, br, rp, fs, mx, att,
    p.hand.length, hu, hpi, hc, hb, hr, hpl, hhi, lvl, p.ex, p.resDeck, p.deck.length, p.trash.length, L <= 1 ? 2 : L <= 2 ? 1 : 0];
  for (let i = 0; i < v.length; i++) out[o + i] = v[i];
  return { L, bv, att, ablk, sap };
}
function feats(g, me, meToMove) {
  const out = new Float64Array(NAMES.length); const S = SIDE.length; const op = me.opp;
  const a = sideFeats(g, me, out, 0), b = sideFeats(g, op, out, S);
  const handEval = 2.4 * (a.L - b.L) + (a.bv - b.bv) + 0.55 * (me.hand.length - op.hand.length) + 0.25 * (g.level(me) - g.level(op)) - (a.L <= 1 ? 4 : a.L <= 2 ? 2 : 0) + (b.L <= 1 ? 4 : b.L <= 2 ? 2 : 0);
  const layers = (L, blk) => Math.ceil(L) + blk + 1; // shields/base + blockers + the final hit
  const g0 = 2 * S;
  out[g0] = meToMove ? 1 : 0; out[g0 + 1] = Math.min(g.turn, 40) / 10; out[g0 + 2] = handEval; out[g0 + 3] = a.L - b.L; out[g0 + 4] = a.bv - b.bv;
  out[g0 + 5] = a.att - layers(b.L, b.ablk); out[g0 + 6] = b.att - layers(a.L, a.ablk);
  out[g0 + 7] = a.sap / (b.L + 1); out[g0 + 8] = b.sap / (a.L + 1);
  return out;
}
const CACHE = new Map();
function load(path) {
  if (typeof path === 'string' && CACHE.has(path)) return CACHE.get(path);
  const r = load0(path); if (typeof path === 'string') CACHE.set(path, r); return r;
}
function load0(path) {
  const M = typeof path === 'string' ? JSON.parse(require('fs').readFileSync(path)) : path;
  if (M.names.join() !== NAMES.join()) throw new Error('valuefn: feature names differ from model ' + (M.file || path));
  const F = NAMES.length; const mu = M.mu, sd = M.sd;
  const logit = (x) => {
    const z = new Float64Array(F); for (let i = 0; i < F; i++) z[i] = (x[i] - mu[i]) / sd[i];
    if (M.type === 'lr') { let s = M.b; for (let i = 0; i < F; i++) s += M.w[i] * z[i]; return s; }
    let h = z; for (let l = 0; l < M.layers.length; l++) { const { W, b } = M.layers[l]; const o = new Float64Array(b.length);
      for (let j = 0; j < b.length; j++) { let s = b[j]; const Wj = W[j]; for (let i = 0; i < h.length; i++) s += Wj[i] * h[i]; o[j] = (l < M.layers.length - 1 && s < 0) ? 0 : s; } h = o; }
    return h[0];
  };
  const prob = (g, me) => 1 / (1 + Math.exp(-logit(feats(g, me, true))));
  return { M, prob, score: (g, me) => 20 * (prob(g, me) - 0.5) };
}
module.exports = { feats, load, NAMES };
