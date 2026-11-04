'use strict';
// Arc shell generator: builds a legal 50-card starting list around one arc (trait set) in a colour pair, from
// implemented cards only, using a curve template and a simple power score. Writes decks.json keys SH_<name>
// and results/prior_<name>.json (sampling prior for the GA that favours the arc's cards).
// node shells.js            (all shells)    node shells.js CLAN_GR   (one)
const fs = require('fs'); const C = require('./cards.json'); const EFX = require('./effects');
const SHELLS = [
  { name: 'GGEN_GB', colors: ['Green', 'Blue'], traits: ['G Generation'] },
  { name: 'TITANS_GB', colors: ['Green', 'Blue'], traits: ['Titans', 'Jupitris'] },
  { name: 'LM_GB', colors: ['Green', 'Blue'], traits: ['League Militaire', 'Victory Type', 'Shrike Team'] },
  { name: 'WING_GB', colors: ['Green', 'Blue'], traits: ['Operation Meteor', 'G Team', 'OZ', 'Maganac Corps', 'White Fang'] },
  { name: 'ORB_GB', colors: ['Green', 'Blue'], traits: ['Orb', 'Earth Alliance'] },
  { name: 'AGE_GB', colors: ['Green', 'Blue'], traits: ['AGE System', 'Asuno Family', 'Earth Federation'] },
  { name: 'ZEON_GB', colors: ['Green', 'Blue'], traits: ['Zeon', 'Cyclops Team', 'Marine'] },
  { name: 'UC_GB', colors: ['Green', 'Blue'], traits: ['Londo Bell', 'White Base Team', 'Albion Squad', 'Earth Federation'] },
  { name: 'CLAN_GR', colors: ['Green', 'Red'], traits: ['Clan'] },
  { name: 'CB_GR', colors: ['Green', 'Red'], traits: ['CB', 'GN Drive', 'Trinity', 'Super Soldier'] },
  { name: 'NEOZEON_GR', colors: ['Green', 'Red'], traits: ['Neo Zeon'] },
  { name: 'ACADEMY_GR', colors: ['Green', 'Red'], traits: ['Academy', 'Dawn of Fold', 'Quiet Zero'] },
  { name: 'ZEON_GR', colors: ['Green', 'Red'], traits: ['Zeon', 'Cyclops Team'] },
  { name: 'ZAFT_GR', colors: ['Green', 'Red'], traits: ['ZAFT', 'Coordinator'] },
  { name: 'MF_GR', colors: ['Green', 'Red'], traits: ['MF', 'Shuffle Alliance', 'Gundam Fighter', 'Special Move'] },
  { name: 'UNE_GR', colors: ['Green', 'Red'], traits: ['New UNE', 'Phantom Pain', 'Gjallarhorn'] },
];
const VAN = new Set(Object.keys(C).filter(id => (C[id].legality || '').startsWith('Vanilla')));
const ok = (c, colors) => colors.includes(c.color) && ['UNIT', 'PILOT', 'COMMAND', 'BASE'].includes(c.type) && EFX[c.id] && c.id !== 'GD01-020' && !(c.legality || '').startsWith('Banned');
const hasEff = (id) => { const e = EFX[id]; return e && Object.keys(e).some(k => !['fidelity', 'note'].includes(k)); };
function power(c) {
  if (c.type === 'UNIT') return (c.ap + c.hp) / (c.cost + 1.5) + 0.12 * c.lv + (hasEff(c.id) ? 0.5 : 0) + 0.25 * ((c.skw && (c.skw.Breach || 0)) ? 1 : 0) + (c.skw && c.skw.Blocker ? 0.3 : 0) + (c.skw && c.skw['High-Maneuver'] ? 0.4 : 0);
  if (c.type === 'PILOT') return (c.ap + c.hp) * 0.4 + (hasEff(c.id) ? 0.9 : 0);
  if (c.type === 'COMMAND') return (EFX[c.id].removal ? 1.6 : 0.8) + (EFX[c.id].pilotName ? 0.4 : 0);
  return 1.0 + (hasEff(c.id) ? 0.4 : 0);
}
function build(sh) {
  const pool = Object.values(C).filter(c => ok(c, sh.colors));
  const inArc = (c) => (c.traits || []).some(t => sh.traits.includes(t)) || sh.traits.some(t => c.text.includes('(' + t + ')'));
  // link pilots of arc units
  const arcUnits = pool.filter(c => c.type === 'UNIT' && inArc(c));
  const linkNames = new Set(); for (const u of arcUnits) for (const l of (u.links || [])) if (l.name) linkNames.add(l.name);
  const isLinkPilot = (c) => (c.type === 'PILOT' && [...linkNames].some(n => c.name.includes(n))) || (c.type === 'COMMAND' && EFX[c.id].pilotName && [...linkNames].some(n => EFX[c.id].pilotName.includes(n)));
  const score = (c) => power(c) + (inArc(c) ? 1.2 : 0) + (isLinkPilot(c) ? 1.0 : 0);
  const m = {}; let tot = 0; let van = null;
  const add = (c, n) => { if (VAN.has(c.id)) { if (van && van !== c.id) return 0; van = c.id; } const capN = c.id === 'ST02-016' ? 2 : 4; const k = Math.min(n, capN - (m[c.id] || 0), 50 - tot); if (k <= 0) return 0; m[c.id] = (m[c.id] || 0) + k; tot += k; return k; };
  const slots = [[c => c.type === 'UNIT' && c.lv <= 2, 12], [c => c.type === 'UNIT' && c.lv === 3, 10], [c => c.type === 'UNIT' && c.lv === 4, 8], [c => c.type === 'UNIT' && c.lv >= 5 && c.lv <= 6, 5], [c => c.type === 'UNIT' && c.lv >= 7, 3], [c => c.type === 'PILOT' || (c.type === 'COMMAND' && EFX[c.id].pilotName), 6], [c => c.type === 'COMMAND' && !EFX[c.id].pilotName, 3], [c => c.type === 'BASE', 3]];
  for (const [f, n] of slots) { const cs = pool.filter(f).sort((a, b) => score(b) - score(a)); let left = n; for (const c of cs) { if (left <= 0) break; left -= add(c, Math.min(4, left)); } }
  const rest = pool.filter(c => c.type === 'UNIT' && c.lv <= 4).sort((a, b) => score(b) - score(a)); for (const c of rest) { if (tot >= 50) break; add(c, 4); }
  const prior = {}; for (const c of pool) if (inArc(c) || isLinkPilot(c)) prior[c.id] = 6;
  // hybrid: proven colour-pair chassis + the arc's best cards
  const CH = sh.colors.includes('Blue') ? { 'GD01-008': 4, 'GD05-027': 4, 'ST03-008': 4, 'GD01-030': 4, 'ST01-010': 4, 'ST01-001': 3, 'GD05-105': 4, 'GD01-019': 3 }
    : { 'GD05-027': 4, 'ST03-008': 4, 'GD01-030': 4, 'GD05-110': 4, 'ST03-007': 3, 'ST03-016': 2 };
  const h = {}; let ht = 0; let hv = null; for (const [id, n] of Object.entries(CH)) { if (!EFX[id]) continue; h[id] = n; ht += n; if (VAN.has(id)) hv = id; }
  const addH = (c, n) => { if (VAN.has(c.id)) { if (hv && hv !== c.id) return 0; hv = c.id; } const capN = c.id === 'ST02-016' ? 2 : 4; const k = Math.min(n, capN - (h[c.id] || 0), 50 - ht); if (k <= 0) return 0; h[c.id] = (h[c.id] || 0) + k; ht += k; return k; };
  const arcPool = pool.filter(c => inArc(c) || isLinkPilot(c)).sort((a, b) => score(b) - score(a));
  for (const c of arcPool) { if (ht >= 50) break; addH(c, c.type === 'UNIT' && c.lv >= 6 ? 2 : 3); }
  for (const c of rest) { if (ht >= 50) break; addH(c, 2); }
  return { m, tot, prior, hybrid: h, htot: ht, arcCount: Object.entries(m).filter(([id]) => inArc(C[id])).reduce((s, [, n]) => s + n, 0) };
}
if (require.main === module) {
  const D = JSON.parse(fs.readFileSync('decks.json')); const only = process.argv[2];
  for (const sh of SHELLS) { if (only && sh.name !== only) continue; const r = build(sh); if (r.tot !== 50) { console.log(sh.name, 'only', r.tot, 'cards'); continue; }
    D['SH_' + sh.name] = { label: `Arc shell ${sh.name} (${sh.traits.join('/')}) ${sh.colors.join('/')}`, cards: Object.entries(r.m).map(([id, n]) => ({ n, id })) };
    fs.writeFileSync(`results/prior_${sh.name}.json`, JSON.stringify(r.prior));
    if (r.htot === 50) D['HY_' + sh.name] = { label: `Hybrid chassis + arc ${sh.name}`, cards: Object.entries(r.hybrid).map(([id, n]) => ({ n, id })) };
    console.log(sh.name.padEnd(12), `arc cards ${r.arcCount}/50`); }
  fs.writeFileSync('decks.json', JSON.stringify(D, null, 1));
}
module.exports = { SHELLS, build };
