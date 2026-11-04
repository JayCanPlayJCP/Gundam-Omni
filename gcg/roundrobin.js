'use strict';
const { runMatrix } = require('./run'); const D = require('./decks.json'); const fs = require('fs');
const n = +(process.argv[2] || 200); const ids = Object.keys(D);
const pairs = []; for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) pairs.push({ a: ids[i], b: ids[j], key: `${ids[i]}|${ids[j]}` });
runMatrix(pairs, n, 424242, 2).then(r => {
  const score = {}; for (const id of ids) score[id] = { w: 0, n: 0 };
  for (const k in r) { const [a, b] = k.split('|'); score[a].w += r[k].win; score[a].n += r[k].n; score[b].w += r[k].loss; score[b].n += r[k].n; }
  fs.mkdirSync('results', { recursive: true }); fs.writeFileSync('results/roundrobin.json', JSON.stringify(r));
  const rows = ids.map(id => [id, score[id].w / score[id].n]).sort((a, b) => b[1] - a[1]);
  for (const [id, wr] of rows) console.log(id.padEnd(22), (wr * 100).toFixed(1) + '%');
});
