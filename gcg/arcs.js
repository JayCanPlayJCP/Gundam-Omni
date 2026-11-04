'use strict';
// Arc (trait) synergy map for Green/Blue/Red cards GD01-GD06 (+ST/EB legal): members, payoffs that name the trait, link pilots, implementation coverage.
const C = require('./cards.json'); const EFX = require('./effects');
const COLS = ['Green', 'Blue', 'Red'];
const pool = Object.values(C).filter(c => COLS.includes(c.color) && ['UNIT', 'PILOT', 'COMMAND', 'BASE'].includes(c.type) && !(c.legality || '').startsWith('Banned'));
const arcs = {};
const A = (t) => arcs[t] || (arcs[t] = { trait: t, members: [], payoffs: [], colors: {} });
for (const c of pool) for (const t of (c.traits || [])) { const a = A(t); a.members.push(c); a.colors[c.color[0]] = (a.colors[c.color[0]] || 0) + 1; }
for (const c of pool) { const refs = new Set([...c.text.matchAll(/\(([A-Z][A-Za-z0-9 .'\-]+?)\)/g)].map(m => m[1]).filter(t => arcs[t])); for (const t of refs) arcs[t].payoffs.push(c); }
const rows = Object.values(arcs).filter(a => a.members.length >= 4).map(a => {
  const impl = a.members.filter(c => EFX[c.id]).length; const pimpl = a.payoffs.filter(c => EFX[c.id]).length;
  const units = a.members.filter(c => c.type === 'UNIT'); const hi = units.filter(c => c.lv >= 5).length; const pil = a.members.filter(c => c.type === 'PILOT').length;
  return { trait: a.trait, n: a.members.length, cols: Object.entries(a.colors).map(([k, v]) => k + v).join(' '), payoffs: a.payoffs.length, impl, pimpl, units: units.length, hi, pil, cmds: a.members.filter(c => c.type === 'COMMAND').length };
}).sort((x, y) => y.payoffs - x.payoffs);
console.log('arc'.padEnd(24), 'cards', 'colors'.padEnd(14), 'payoffs', 'impl', 'payImpl', 'units', 'Lv5+', 'pilots', 'cmds');
for (const r of rows) console.log(r.trait.padEnd(24), String(r.n).padEnd(5), r.cols.padEnd(14), String(r.payoffs).padEnd(7), String(r.impl).padEnd(4), String(r.pimpl).padEnd(7), String(r.units).padEnd(5), String(r.hi).padEnd(4), String(r.pil).padEnd(6), r.cmds);
module.exports = { arcs };
