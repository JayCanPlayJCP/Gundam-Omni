'use strict';
// Self-play dataset for the learned value function.
// Plays G games between random decks from a pool (field lists + candidate lists), both sides on the same AI setting,
// and records valuefn.feats() at every turn boundary from BOTH sides (the player about to move: toMove=1; the other:
// toMove=0), labelled with that side's final result (1 win, 0 loss, 0.5 draw/turn limit).
// node selfplay.js --games 8000 --ai '{"K":4,"N":6}' --seed 1 --out results/learn/d0 [--pool field,cands|key1,key2] [--workers 3]
// -> OUT.x.f32 (rows x F float32), OUT.s.i16 (rows x SW card-identity indices, -1 padded), OUT.y.f32, OUT.g.i32 (game id), OUT.meta.json
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads'); const fs = require('fs');
const CANDS = ['GB_GA2', 'GR_GA1', 'PURE_GB_e0', 'PURE_GB_e1', 'PURE_GR_e0', 'GB_S2_e0', 'GB_S2_e1', 'OMNI_GB', 'OMNI_GR', 'BGNU_opt2', 'PAIR_BR', 'GR_S2_e0', 'ARC_ZEON_GB', 'ARC_CB_GR', 'RG25', 'BG74'];

if (!isMainThread) {
  const eng = require('./engine'); const EFX = require('./effects'); eng.setEffects(EFX);
  const { makeAI } = require('./searchai'); const { feats, sparse, NAMES, SW } = require('./valuefn'); const D = require('./decks.json'); const P = require('./profiles'); const OPP = require('./opp_profiles.json');
  const { from, to, seed, pool, ai, maxTurns } = workerData; const F = NAMES.length;
  const rows = [], ys = [], gids = [], sps = []; let games = 0;
  for (let i = from; i < to; i++) {
    const r = eng.rngFrom(seed * 7919 + i * 104729); const da = pool[Math.floor(r() * pool.length)], db = pool[Math.floor(r() * pool.length)];
    const pa = P[OPP[da] || 'hyper'], pb = P[OPP[db] || 'hyper'];
    const g = new eng.Game(D[da].cards, D[db].cards, seed * 1000003 + i, [makeAI(pa, ai), makeAI(pb, ai)], {});
    g.setup(); let p = g.players[0]; const rec = [];
    while (g.winner === null) {
      g.turn++; if (g.turn > maxTurns) { g.reason = 'turn limit'; break; }
      g.turnPlayer = p; g.takeTurn(p); if (g.winner !== null) break;
      const nx = p.opp; rec.push([nx.i, feats(g, nx, true), sparse(g, nx)], [p.i, feats(g, p, false), sparse(g, p)]);
      p = p.opp;
    }
    for (const [pi, x, sx] of rec) { rows.push(x); sps.push(sx); ys.push(g.winner === null ? 0.5 : (g.winner === pi ? 1 : 0)); gids.push(i); }
    games++;
  }
  const X = new Float32Array(rows.length * F); rows.forEach((x, k) => X.set(x, k * F));
  const S = new Int16Array(rows.length * SW).fill(-1); sps.forEach((sx, k) => sx.forEach((v, j) => { S[k * SW + j] = v; }));
  parentPort.postMessage({ X, S, y: Float32Array.from(ys), g: Int32Array.from(gids), games }, [X.buffer, S.buffer]);
} else if (require.main === module) {
  const args = Object.fromEntries(process.argv.slice(2).reduce((acc, x, i, arr) => (x.startsWith('--') ? acc.concat([[x.slice(2), arr[i + 1]]]) : acc), []));
  const D = require('./decks.json'); const { NAMES, NID, SW } = require('./valuefn');
  const G = +(args.games || 2000), seed = +(args.seed || 1), out = args.out || 'results/learn/d0', ai = JSON.parse(args.ai || '{"K":4,"N":6}');
  const workers = +(args.workers || process.env.SIM_WORKERS || 3), maxTurns = +(args.maxturns || 40);
  const field = Object.keys(D).filter(k => k.startsWith('W_') || k.startsWith('J_'));
  const spec = (args.pool || 'field,cands').split(','); let pool = [];
  for (const s of spec) { if (s === 'field') pool.push(...field, ...field); else if (s === 'cands') pool.push(...CANDS.filter(k => D[k])); else if (s.endsWith('*')) pool.push(...Object.keys(D).filter(k => k.startsWith(s.slice(0, -1)))); else if (D[s]) pool.push(s); }
  fs.mkdirSync(require('path').dirname(out), { recursive: true }); const t0 = Date.now();
  const chunk = Math.ceil(G / workers); const parts = []; let doneW = 0;
  for (let w = 0; w < workers; w++) {
    const from = w * chunk, to = Math.min(G, from + chunk); if (from >= to) { doneW++; continue; }
    const wk = new Worker(__filename, { workerData: { from, to, seed, pool, ai, maxTurns } });
    wk.on('message', (m) => parts.push(m)); wk.on('error', (e) => { console.error(e); process.exit(1); });
    wk.on('exit', () => { if (++doneW === workers) finish(); });
  }
  function finish() {
    const F = NAMES.length; const n = parts.reduce((s, m) => s + m.y.length, 0); const X = new Float32Array(n * F), S = new Int16Array(n * SW), y = new Float32Array(n), g = new Int32Array(n); let o = 0;
    for (const m of parts) { X.set(m.X, o * F); S.set(m.S, o * SW); y.set(m.y, o); g.set(m.g, o); o += m.y.length; }
    fs.writeFileSync(out + '.x.f32', Buffer.from(X.buffer)); fs.writeFileSync(out + '.y.f32', Buffer.from(y.buffer)); fs.writeFileSync(out + '.g.i32', Buffer.from(g.buffer)); fs.writeFileSync(out + '.s.i16', Buffer.from(S.buffer));
    const meta = { F, SW, NID, rows: n, games: G, seed, ai, pool: [...new Set(pool)], names: NAMES, sec: (Date.now() - t0) / 1000, created: new Date().toISOString() };
    fs.writeFileSync(out + '.meta.json', JSON.stringify(meta, null, 1));
    console.log(`selfplay ${out}: ${G} games, ${n} positions, F=${F}, ai ${JSON.stringify(ai)} (${meta.sec.toFixed(0)}s)`);
  }
}
