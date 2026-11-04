'use strict';
const STATKEYS = { ap: ['ap', 'p_ap', 'aura_ap', 'p_aura_ap'], hp: ['hp', 'p_hp', 'aura_hp', 'p_aura_hp'] }; // constant keys (string concat in the hot path was ~30% of search time)
// Gundam Card Game simulator — core rules engine.
// Rules follow Comprehensive Rules v1.10.0 (16 Oct 2026). See README for simplifications.
const CARDS = require('./cards.json');
const TOKEN = {};
for (const id in CARDS) if (id.startsWith('T-')) TOKEN[CARDS[id].name] = CARDS[id];

// ---------- RNG ----------
class RNG { constructor(seed) { this.a = seed >>> 0; }
  next() { let a = this.a | 0; a = (a + 0x6D2B79F5) | 0; this.a = a >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; } }
function rngFrom(seed) { const r = new RNG(seed); const f = () => r.next(); f.state = r; return f; }
function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
  return arr;
}

// ---------- static keyword parse (unconditional keywords only) ----------
function staticKw(def) {
  const out = {};
  if (def.id.startsWith('T-')) { Object.assign(out, def.kw); return out; }
  for (const seg of def.text.split(' / ')) {
    const m = seg.trim().match(/^<([A-Za-z\- ]+?)(?: (\d+))?>/);
    if (m) out[m[1]] = m[2] ? +m[2] : 1;
  }
  return out;
}
for (const id in CARDS) CARDS[id].skw = staticKw(CARDS[id]);

let UID = 0;
class Unit {
  constructor(def, owner, token) {
    this.uid = ++UID; this.def = def; this.owner = owner; this.token = !!token;
    this.dmg = 0; this.rested = false; this.sick = true; this.pilot = null; this.linked = false;
    this.tAP = 0; this.tHP = 0; this.tKw = {}; this.bAP = 0; this.bKw = {};
    this.noReady = false; this.once = new Set(); this.flags = {};
    this.attackActiveFilter = null; // fn(enemyUnit) -> bool, this turn
  }
  get name() { return this.def.name; }
}

class Game {
  constructor(deckA, deckB, seed, ais, opts = {}) {
    this.rng = rngFrom(seed); this.seed = seed; this.turn = 0; this.winner = null; this.reason = '';
    this.opts = opts; this.log = opts.log ? [] : null; this.inBattle = null;
    this.players = [0, 1].map(i => this.makePlayer(i, i === 0 ? deckA : deckB, ais[i]));
    this.players[0].opp = this.players[1]; this.players[1].opp = this.players[0];
    this.stats = { turns: 0, p: [this.newStats(), this.newStats()] };
  }
  newStats() { return { endMainHands6: [], twoShieldTurn: null, twoShieldOwnTurnsAfter: null, cardsDrawn: 0, extraCards: 0, unitsDeployed: 0, tokens: 0, attacks: 0, shieldsBroken: 0, firstLv6Turn: null, handAt2Shield: null }; }
  makePlayer(i, deck, ai) {
    const cards = [];
    for (const { n, id } of deck) { const d = CARDS[id]; if (!d) throw new Error('unknown card ' + id); for (let k = 0; k < n; k++) cards.push(d); }
    return { i, ai, deck: shuffle(cards, this.rng), hand: [], trash: [], exile: [], shields: [], base: null, units: [],
      res: 0, resRested: 0, ex: 0, resDeck: 10, turnsTaken: 0, flags: {}, specialMoveThisTurn: false };
  }
  L(...a) { if (this.log) this.log.push(`T${this.turn} ` + a.join(' ')); }

  // ---------- setup ----------
  setup() {
    for (const p of this.players) {
      this.drawN(p, 5, true);
      if (p.ai.mulligan(this, p)) { p.deck.push(...p.hand); p.hand = []; this.drawN(p, 5, true); shuffle(p.deck, this.rng); this.L(`P${p.i} redraw`); }
    }
    for (const p of this.players) { p.shields = p.deck.splice(0, 6); p.base = { def: { id: 'EXB', name: 'EX Base', hp: 3, traits: [], text: '' }, dmg: 0, ex: true }; }
    this.players[1].ex = 1;
  }
  // ---------- resources ----------
  level(p) { return p.res + p.ex; }
  avail(p) { return p.res - p.resRested + p.ex; }
  pay(p, n) {
    if (this.avail(p) < n) return false;
    const fromNormal = Math.min(n, p.res - p.resRested); p.resRested += fromNormal; p.ex -= (n - fromNormal); if (p.flags) p.flags.lastPayEX = (n - fromNormal) > 0; return true;
  }
  canPlay(p, def, costOverride) { const c = costOverride ?? this.costOf(p, def); return this.level(p) >= this.effLv(p, def) && this.avail(p) >= c; }
  effLv(p, def) { const e = EFFECTS[def.id]; return def.lv + (e && e.lvMod ? e.lvMod(this, p) : 0); }
  costOf(p, def) { const e = this.E(def); let c = def.cost; if (e && e.costMod) c += e.costMod(this, p); return Math.max(0, c); }
  E(def) { return EFFECTS[def.id]; }

  // ---------- card movement ----------
  drawN(p, n, setup) {
    for (let k = 0; k < n; k++) {
      if (p.deck.length === 0) { if (!setup) this.lose(p, 'deck out'); return; }
      p.hand.push(p.deck.shift()); if (!setup) this.stats.p[p.i].cardsDrawn++;
    }
  }
  draw(p, n = 1) { this.drawN(p, n); if (!this.stats) return; this.stats.p[p.i].extraCards += n; }
  discard(p, n, pred) {
    let done = 0;
    for (let k = 0; k < n; k++) {
      const cands = p.hand.filter(c => !pred || pred(c)); if (!cands.length) break;
      const c = p.ai.pickDiscard(this, p, cands); p.hand.splice(p.hand.indexOf(c), 1); p.trash.push(c); done++;
    }
    return done;
  }
  addShieldToHand(p) { if (p.shields.length) { p.hand.push(p.shields.shift()); this.stats.p[p.i].extraCards++; return true; } return false; }
  lose(p, why) { if (this.winner === null) { this.winner = p.opp.i; this.reason = why; this.L(`P${p.i} loses: ${why}`); } }

  // ---------- stats ----------
  // g._m: optional per-unit memo (Map unit -> {}) that the AI switches on only while it scores options on a frozen state
  // (no battle in progress, nothing mutated between set and clear). Default null = no caching.
  ap(u) {
    const m = this._m; let c; if (m) { c = m.get(u); if (c && c.ap !== undefined) return c.ap; }
    let v = u.def.ap + (u.pilot ? u.pilot.ap : 0) + u.tAP + u.bAP;
    v += this.staticMod(u, 'ap'); v = Math.max(0, v);
    if (m) { if (!c) m.set(u, c = {}); c.ap = v; }
    return v;
  }
  hp(u) {
    const m = this._m; let c; if (m) { c = m.get(u); if (c && c.hp !== undefined) return c.hp; }
    const v = u.def.hp + (u.pilot ? u.pilot.hp : 0) + u.tHP + this.staticMod(u, 'hp');
    if (m) { if (!c) m.set(u, c = {}); c.hp = v; }
    return v;
  }
  hpLeft(u) { return this.hp(u) - u.dmg; }
  staticMod(u, stat) {
    let v = 0; const g = this; const K = STATKEYS[stat] || [stat, 'p_' + stat, 'aura_' + stat, 'p_aura_' + stat]; const kP = K[1], kA = K[2], kPA = K[3];
    const e = EFFECTS[u.def.id]; if (e && e[stat]) v += e[stat](g, u);
    if (u.pilot) { const pe = EFFECTS[u.pilot.id]; if (pe && pe[kP]) v += pe[kP](g, u); }
    for (const o of u.owner.units) { const oe = EFFECTS[o.def.id]; if (o !== u && oe && oe[kA]) v += oe[kA](g, o, u); if (o.pilot) { const pe2 = EFFECTS[o.pilot.id]; if (pe2 && pe2[kPA]) v += pe2[kPA](g, o, u); } }
    if (u.owner.base) { const be = EFFECTS[u.owner.base.def.id]; if (be && be[kA]) v += be[kA](g, u.owner.base, u); }
    return v;
  }
  kw(u, k) {
    const m = this._m; let c; if (m) { c = m.get(u); if (c && c.kw && c.kw[k] !== undefined) return c.kw[k]; }
    const v = this.kw0(u, k);
    if (m) { if (!c) m.set(u, c = {}); (c.kw || (c.kw = {}))[k] = v; }
    return v;
  }
  kw0(u, k) {
    let v = u.def.skw[k] || 0;
    v = Math.max(v, u.tKw[k] || 0, u.bKw[k] || 0);
    if (k === 'Breach' || k === 'Repair') v = (u.def.skw[k] || 0) + (u.tKw[k] || 0) + (u.bKw[k] || 0);
    const e = EFFECTS[u.def.id]; if (e && e.kw) v += e.kw(this, u, k) || 0;
    for (const o of u.owner.units) { if (o === u) continue; const oe = EFFECTS[o.def.id]; if (oe && oe.aura_kw) v += oe.aura_kw(this, o, u, k) || 0; }
    if (u.pilot) { const pe = EFFECTS[u.pilot.id]; if (pe && pe.p_kw) v += pe.p_kw(this, u, k) || 0; }
    return v;
  }
  // kwVals(u, ks): same values as ks.map(k => this.kw0(u, k)) with one pass over the allies (hot path of AI unitValue)
  kwVals(u, ks) {
    const out = new Array(ks.length); const e = EFFECTS[u.def.id]; const ek = e && e.kw;
    for (let i = 0; i < ks.length; i++) { const k = ks[i]; let v;
      if (k === 'Breach' || k === 'Repair') v = (u.def.skw[k] || 0) + (u.tKw[k] || 0) + (u.bKw[k] || 0); else v = Math.max(u.def.skw[k] || 0, u.tKw[k] || 0, u.bKw[k] || 0);
      if (ek) v += ek(this, u, k) || 0; out[i] = v; }
    for (const o of u.owner.units) { if (o === u) continue; const oe = EFFECTS[o.def.id]; if (oe && oe.aura_kw) for (let i = 0; i < ks.length; i++) out[i] += oe.aura_kw(this, o, u, ks[i]) || 0; }
    if (u.pilot) { const pe = EFFECTS[u.pilot.id]; if (pe && pe.p_kw) for (let i = 0; i < ks.length; i++) out[i] += pe.p_kw(this, u, ks[i]) || 0; }
    return out;
  }
  traits(u) {
    const t = new Set(u.def.traits);
    for (const o of u.owner.units) { const oe = EFFECTS[o.def.id]; if (oe && oe.aura_traits) oe.aura_traits(this, o, u, t); }
    return t;
  }
  hasTrait(u, tr) { return this.traits(u).has(tr); }
  cardHasTrait(def, tr) { return def.traits.includes(tr); }
  isLinkPilot(unitDef, pilot) {
    if (!unitDef.links || !unitDef.links.length) return false;
    const pnames = [pilot.pname || pilot.name]; const pe = EFFECTS[pilot.id]; if (pe && pe.alsoNamed) pnames.push(pe.alsoNamed);
    for (const l of unitDef.links) {
      if (l.name && pnames.some(n => n.includes(l.name))) return true;
      if (l.trait && (pilot.traits || []).includes(l.trait)) return true;
    }
    return false;
  }

  // ---------- deploy / pair ----------
  deployUnit(p, def, opts = {}) {
    if (p.units.length >= 6) { const victim = p.ai.pickOverflowTrash(this, p); this.removeUnit(victim, 'trash', false); }
    const u = new Unit(def, p, opts.token); if (opts.rested) u.rested = true;
    if (!opts.token && def.lv <= 3 && this.players.some(pl => pl.units.some(x => x.linked && EFFECTS[x.def.id] && EFFECTS[x.def.id].kikeroga))) u.rested = true;
    for (const o of p.opp.units) { const oe = EFFECTS[o.def.id]; if (oe && oe.enemyDeployRested && oe.enemyDeployRested(this, o, def)) u.rested = true; }
    p.units.push(u); this.stats.p[p.i].unitsDeployed++; if (opts.token) this.stats.p[p.i].tokens++;
    this.L(`P${p.i} deploys ${def.name}${opts.token ? ' (token)' : ''}`);
    if (!opts.token) {
      const e = EFFECTS[def.id]; if (e && e.deploy) e.deploy(this, u);
      this.fireAllies(p, 'onAllyDeploy', u);
    }
    return u;
  }
  deployToken(p, name, opts = {}) { const d = TOKEN[name]; if (!d) throw new Error('token ' + name); return this.deployUnit(p, d, { token: true, rested: opts.rested }); }
  fireAllies(p, hook, arg) { for (const o of [...p.units]) { const e = EFFECTS[o.def.id]; if (e && e[hook] && o !== arg) e[hook](this, o, arg); } }
  pair(u, pilotDef) {
    if (u.pilot) return false;
    u.pilot = pilotDef; u.linked = this.isLinkPilot(u.def, pilotDef);
    this.L(`P${u.owner.i} pairs ${pilotDef.pname || pilotDef.name} -> ${u.def.name}${u.linked ? ' [LINK]' : ''}`);
    const ue = EFFECTS[u.def.id], pe = EFFECTS[pilotDef.id];
    if (ue && ue.whenPaired) ue.whenPaired(this, u, pilotDef);
    if (pe && pe.p_whenPaired && this.alive(u)) pe.p_whenPaired(this, u);
    if (u.linked && this.alive(u)) { if (ue && ue.whenLinked) ue.whenLinked(this, u); if (pe && pe.p_whenLinked && this.alive(u)) pe.p_whenLinked(this, u); const pb = u.owner.base && EFFECTS[u.owner.base.def.id]; if (pb && pb.onAllyLinked && this.alive(u)) pb.onAllyLinked(this, u.owner, u); if (this.alive(u)) this.fireAllies(u.owner, 'onAllyLinked', u); }
    this.fireAllies(u.owner, 'onAllyPaired', u);
    return true;
  }
  alive(u) { return u.owner.units.includes(u); }
  canAttackThisTurn(u) {
    if (u.rested) return false;
    if (u.sick && !u.linked && !u.flags.hasteThisTurn && !u.flags.hasteUnitsOnly) return false;
    if (u.token && /or attack\./.test(u.def.text)) return false;
    const e = EFFECTS[u.def.id]; if (e && e.cannotAttack && e.cannotAttack(this, u)) return false;
    return true;
  }
  canAttackPlayer(u) { const e = EFFECTS[u.def.id]; if (e && e.noAttackPlayer) return false; return !/can't choose the enemy player as its attack target/.test(u.def.text); }

  // ---------- removal ----------
  removeUnit(u, dest, destroyed, cause) {
    const p = u.owner; const i = p.units.indexOf(u); if (i < 0) return;
    p.units.splice(i, 1);
    const pilot = u.pilot; u.pilot = null;
    const toZone = (def) => {
      if (dest === 'hand') p.hand.push(def); else if (dest === 'bottom') p.deck.push(def); else if (dest === 'exile') p.exile.push(def); else p.trash.push(def);
    };
    if (!u.token) toZone(u.def);
    if (pilot) { const pd = pilot.cmdPilot ? CARDS[pilot.id] : pilot; toZone(pd); }
    this.L(`P${p.i} ${u.def.name} -> ${dest}${destroyed ? ' (destroyed)' : ''}`);
    if (destroyed) {
      const e = EFFECTS[u.def.id]; if (e && e.destroyed) e.destroyed(this, u, pilot, cause);
      if (pilot) { const pe = EFFECTS[pilot.id]; if (pe && pe.p_destroyed) pe.p_destroyed(this, u, pilot, cause); }
      this.fireAllies(p, 'onAllyDestroyed', u);
    }
  }
  destroy(u, cause) { if (this.alive(u)) this.removeUnit(u, 'trash', true, cause); }
  bounce(u) { if (this.alive(u)) this.removeUnit(u, 'hand', false); }
  toBottom(u) { if (this.alive(u)) this.removeUnit(u, 'bottom', false); }
  effectDamage(src, target, n) {
    if (!this.alive(target) || n <= 0) return false;
    let d = n; const enemy = src && src.i !== target.owner.i;
    const e = EFFECTS[target.def.id];
    if (enemy && e && e.reduceEffectDmg) d = e.reduceEffectDmg(this, target, d);
    if (enemy && target.owner.base) { const be = EFFECTS[target.owner.base.def.id]; if (be && be.protectEffect) d = be.protectEffect(this, target, d); }
    if (target.flags.reduce1) d = Math.max(0, d - 1);
    if (enemy && target.flags.reduceNext > 0) { const r = Math.min(d, target.flags.reduceNext); d -= r; target.flags.reduceNext = 0; }
    if (d <= 0) return false;
    target.dmg += d;
    if (this.hpLeft(target) <= 0) { this.destroy(target, { effect: true, by: src }); if (src && enemy) this.onEffectKill(src, target); return true; }
    return false;
  }
  onEffectKill(srcP, victim) {
    // Suletta Mercury: while a unit of srcP is attacking, enemy destroyed with effect damage -> draw
    const b = this.inBattle; if (b && b.attacker.owner === srcP && this.alive(b.attacker) && b.attacker.pilot) {
      const pe = EFFECTS[b.attacker.pilot.id]; if (pe && pe.p_onEffectKillWhileAttacking) pe.p_onEffectKillWhileAttacking(this, b.attacker);
    }
  }
  heal(u, n) { u.dmg = Math.max(0, u.dmg - n); }
  restUnit(u) { if (this.alive(u)) u.rested = true; }

  // ---------- shield area damage ----------
  damageShieldArea(attackerP, defP, n, opts = {}) {
    // deals n damage to first card in shield area. returns 'base'|'shield'|null
    if (defP.base) {
      const be = EFFECTS[defP.base.def.id]; if (opts.effect && be && be.immuneEffect) return 'base';
      defP.base.dmg += n; if (defP.base.dmg >= (defP.base.def.hp)) this.destroyBase(defP);
      return 'base';
    }
    if (defP.shields.length) { this.breakShield(attackerP, defP); return 'shield'; }
    return null;
  }
  destroyBase(p) {
    const b = p.base; p.base = null; if (!b.ex) p.trash.push(b.def);
    this.L(`P${p.i} base ${b.def.name} destroyed`);
    const be = EFFECTS[b.def.id]; if (be && be.baseDestroyed) be.baseDestroyed(this, p);
  }
  breakShield(attackerP, defP) {
    const c = defP.shields.shift(); if (!c) return;
    this.stats.p[attackerP.i].shieldsBroken++;
    this.L(`P${defP.i} shield broken: ${c.name}`);
    const e = EFFECTS[c.id];
    if (c.burst && defP.ai.useBurst(this, defP, c)) {
      if (e && e.burst) { const kept = e.burst(this, defP, c); if (kept === 'kept') return; }
      else if (/【Burst】Add this card to your hand/.test(c.text)) { defP.hand.push(c); this.stats.p[defP.i].extraCards++; return; }
      else if (/【Burst】Deploy this card/.test(c.text)) { this.deployBase(defP, c); return; }
    }
    defP.trash.push(c); (defP.brokenToTrash || (defP.brokenToTrash = [])).push(c.id);
  }
  deployBase(p, def) {
    if (p.base) { if (!p.base.ex) p.trash.push(p.base.def); }
    p.base = { def, dmg: 0, ex: false, rested: false };
    this.L(`P${p.i} base ${def.name}`);
    this.addShieldToHand(p);
    const e = EFFECTS[def.id]; if (e && e.baseDeploy) e.baseDeploy(this, p);
  }
  placeEX(p, n = 1) { const room = Math.min(n, 5 - p.ex); if (room > 0) { p.ex += room; if (this.players) this.fireAllies(p, 'onPlaceEX', null); } }

  // ---------- combat ----------
  attack(u, target) { // target: 'player' or Unit
    const A = u.owner, D = A.opp; if (!this.alive(u) || this.winner !== null) return;
    u.rested = true; this.stats.p[A.i].attacks++; A.flags.turn.attacked = true;
    const b = { attacker: u, target, blocked: false }; this.inBattle = b;
    this.L(`P${A.i} ${u.def.name}(${this.ap(u)}/${this.hpLeft(u)}) attacks ${target === 'player' ? 'player' : target.def.name}`);
    // attack step
    const e = EFFECTS[u.def.id]; if (e && e.attack) e.attack(this, u, b);
    if (u.pilot && this.alive(u)) { const pe = EFFECTS[u.pilot.id]; if (pe && pe.p_attack) pe.p_attack(this, u, b); }
    if (this.alive(u)) this.fireAllies(A, 'onAllyAttack', u);
    if (!this.alive(u) || this.winner !== null) return this.endBattle(b);
    if (b.target !== 'player' && !this.alive(b.target)) return this.endBattle(b);
    // block step
    if (!this.kw(u, 'High-Maneuver')) {
      const blk = D.ai.chooseBlock(this, D, u, b.target);
      if (blk) { blk.rested = true; b.target = blk; b.blocked = true; this.L(`P${D.i} blocks with ${blk.def.name}`); }
    }
    // action step: standby player first, then attacker
    D.ai.actionStep(this, D, b, 'defend'); if (this.winner !== null) return this.endBattle(b);
    if (this.alive(u)) A.ai.actionStep(this, A, b, 'attack');
    if (!this.alive(u) || this.winner !== null) return this.endBattle(b);
    if (b.target !== 'player' && !this.alive(b.target)) return this.endBattle(b);
    // damage step
    if (b.target === 'player') {
      if (b.shieldProtect) return this.endBattle(b);
      const supp = this.kw(u, 'Suppression');
      const ap = this.ap(u);
      if (ap <= 0) return this.endBattle(b); // 0 damage destroys nothing
      if (!D.base && !D.shields.length) { this.lose(D, 'battle damage'); return this.endBattle(b); }
      const hits = [];
      if (D.base) hits.push('base'); for (let k = 0; k < D.shields.length; k++) hits.push('shield');
      const n = supp ? 2 : 1; const todo = hits.slice(0, n);
      let shieldHits = todo.filter(x => x === 'shield').length;
      const bse = D.base && EFFECTS[D.base.def.id]; const baseImm = bse && bse.baseNoBattle && bse.baseNoBattle(this, D, u);
      if (todo[0] === 'base' && baseImm) { /* base can't receive this battle damage */ } else if (todo[0] === 'base') { D.base.dmg += ap; if (D.base.dmg >= D.base.def.hp) { this.destroyBase(D); if (this.alive(u)) this.onBattleDestroyCard(u, null); } }
      // shields hit simultaneously (top first)
      const broke = []; for (let k = 0; k < shieldHits; k++) broke.push(D.shields.shift());
      for (const c of broke) { D.shields.unshift(c); this.breakShield(A, D); if (this.alive(u)) this.onBattleDestroyCard(u, null); }
    } else {
      this.fightUnits(u, b.target, b);
    }
    return this.endBattle(b);
  }
  fightUnits(a, t, b) {
    const A = a.owner;
    const fs = this.kw(a, 'First Strike');
    const apA = this.ap(a), apT = this.ap(t);
    // Exia Repair style: destroy on battle damage
    const eA = EFFECTS[a.def.id], eT = EFFECTS[t.def.id];
    let killT = false, killA = false;
    const applyTo = (victim, src, n) => {
      // Qubeley Mk-II redirect
      const ve = EFFECTS[victim.def.id];
      if (ve && ve.redirect) { const r = ve.redirect(this, victim, n, b); if (r) { this.redirectDamage(r, n); return false; } }
      if (victim.flags.noBattleFrom2 && this.ap(src) <= 2) return false;
      if (this.noBattleDmg(victim, src, b)) return false;
      n = this.reduceBattleDmg(victim, n, src); if (n <= 0) return false;
      victim.dmg += n; const se = EFFECTS[src.def.id];
      if (se && se.battleDestroyRule && se.battleDestroyRule(this, src, victim)) return true;
      return this.hpLeft(victim) <= 0;
    };
    if (fs) {
      killT = applyTo(t, a, apA);
      if (!killT) killA = applyTo(a, t, apT);
    } else {
      killT = applyTo(t, a, apA); killA = applyTo(a, t, apT);
    }
    if (killT && this.alive(t)) { this.destroy(t, { battle: true, by: a }); this.onBattleKill(a, t); }
    if (killA && this.alive(a)) { this.destroy(a, { battle: true, by: t }); }
  }
  noBattleDmg(v, src, b) {
    const e = EFFECTS[v.def.id]; if (e && e.noBattleDmg && e.noBattleDmg(this, v, src, b)) return true;
    if (v.pilot) { const pe = EFFECTS[v.pilot.id]; if (pe && pe.p_noBattleDmg && pe.p_noBattleDmg(this, v, src, b)) return true; }
    if (v.flags.nbd && v.flags.nbd(this, v, src, b)) return true;
    for (const o of v.owner.units) { if (o === v) continue; const oe = EFFECTS[o.def.id]; if (oe && oe.aura_noBattleDmg && oe.aura_noBattleDmg(this, o, v, src, b)) return true; }
    return false;
  }
  reduceBattleDmg(v, n, src) {
    const e = EFFECTS[v.def.id]; if (e && e.reduceBattleDmg) n = e.reduceBattleDmg(this, v, n, src);
    if (v.pilot) { const pe = EFFECTS[v.pilot.id]; if (pe && pe.p_reduceBattleDmg) n = pe.p_reduceBattleDmg(this, v, n, src); }
    if (v.flags.reduceNext > 0) { const r = Math.min(n, v.flags.reduceNext); n -= r; v.flags.reduceNext = 0; }
    return n;
  }
  redirectDamage(r, n) {
    if (r.base) { const p = r.base; p.base.dmg += n; if (p.base.dmg >= p.base.def.hp) this.destroyBase(p); }
    else if (this.alive(r.unit)) { r.unit.dmg += n; if (this.hpLeft(r.unit) <= 0) this.destroy(r.unit, { battle: true }); }
  }
  onBattleKill(a, victim) {
    const A = a.owner;
    if (this.winner === null && this.turnPlayer === A) {
      const br = this.alive(a) ? this.kw(a, 'Breach') : (a.lastBreach || 0);
      if (br > 0) this.damageShieldArea(A, A.opp, br);
    }
    if (this.alive(a)) {
      const e = EFFECTS[a.def.id]; if (e && e.onBattleKill) e.onBattleKill(this, a, victim);
      if (a.pilot) { const pe = EFFECTS[a.pilot.id]; if (pe && pe.p_onBattleKill) pe.p_onBattleKill(this, a, victim); }
      this.onBattleDestroyCard(a, victim);
    }
    if (this.turnPlayer === A) this.fireAllies(A, 'onAllyBattleKill', a);
  }
  onBattleDestroyCard(a, victim) { if (a.flags.sfDraw && this.turnPlayer === a.owner) this.draw(a.owner, 1); }
  // damage-step-only battle (Nu Gundam, Qubeley)
  damageOnlyBattle(a, t) {
    if (!this.alive(a) || !this.alive(t)) return;
    const b = { attacker: a, target: t, effectBattle: true }; const prev = this.inBattle; this.inBattle = b;
    a.lastBreach = this.kw(a, 'Breach');
    this.fightUnits(a, t, b); this.inBattle = prev; this.clearBattle(b);
  }
  clearBattle(b) { for (const p of this.players) for (const x of p.units) { x.bAP = 0; x.bKw = {}; } }
  endBattle(b) { this.inBattle = null; this.clearBattle(b); }

  // ---------- turn loop ----------
  play(maxTurns = 40) {
    this.setup();
    let p = this.players[0];
    while (this.winner === null) {
      this.turn++; if (this.turn > maxTurns) { this.reason = 'turn limit'; break; }
      this.turnPlayer = p; this.takeTurn(p); if (this.winner !== null) break;
      p = p.opp;
    }
    this.stats.turns = this.turn;
    return this.winner;
  }
  takeTurn(p) {
    p.turnsTaken++; p.specialMoveThisTurn = false; p.flags.turn = {};
    // start phase
    // The-O style effects mark units that won't be set as active
    for (const o of p.opp.units) { const oe = EFFECTS[o.def.id]; if (oe && oe.onOppStart) oe.onOppStart(this, o, p); }
    for (const u of p.units) { u.sick = false; u.once.clear(); if (u.noReady) { u.noReady = false; continue; } u.rested = false; }
    p.resRested = 0; if (p.base) p.base.rested = false;
    // draw
    this.drawN(p, 1); if (this.winner !== null) return;
    // resource
    if (p.resDeck > 0) { p.resDeck--; p.res++; }
    if (this.level(p) >= 6 && this.stats.p[p.i].firstLv6Turn === null) this.stats.p[p.i].firstLv6Turn = p.turnsTaken;
    // two-shield tracking (for the opponent of p: p's own turns after opp reached <=2 shields)
    this.trackTwo(p);
    // main
    p.ai.mainPhase(this, p);
    if (this.winner !== null) return;
    this.endPhase(p);
  }
  endPhase(p) {
    if (this.level(p) >= 6) this.stats.p[p.i].endMainHands6.push(p.hand.length);
    // end phase
    for (const u of [...p.units]) {
      const r = this.kw(u, 'Repair'); if (r) this.heal(u, r);
      const e = EFFECTS[u.def.id]; if (e && e.endTurn) e.endTurn(this, u);
    }
    if (p.opp.ai.endPhaseAction) p.opp.ai.endPhaseAction(this, p.opp, p);
    while (p.hand.length > 10) { const c = p.ai.pickDiscard(this, p, p.hand); p.hand.splice(p.hand.indexOf(c), 1); p.trash.push(c); }
    for (const pl of this.players) for (const u of pl.units) { u.tAP = 0; u.tHP = 0; u.tKw = {}; u.attackActiveFilter = null; u.flags.sfDraw = false; u.flags.hasteThisTurn = false; u.flags.reduce1 = false; u.flags.noBattleFrom2 = false; u.flags.hasteUnitsOnly = false; u.flags.nbd = null; u.flags.reduceNext = 0; u.flags.taunt = false; }
  }
  clone(aiFor) {
    const g = Object.create(Game.prototype);
    g.seed = this.seed; g.turn = this.turn; g.winner = this.winner; g.reason = this.reason; g.opts = {}; g.log = null; g.inBattle = null;
    const r = rngFrom(0); r.state.a = this.rng.state.a; g.rng = r;
    g.stats = { turns: this.stats.turns, p: this.stats.p.map(x => Object.assign({}, x, { endMainHands6: [] })) };
    g.players = this.players.map(p => Object.assign({}, p, { deck: [...p.deck], hand: [...p.hand], trash: [...p.trash], exile: [...p.exile], shields: [...p.shields],
      base: p.base ? Object.assign({}, p.base) : null, units: [], flags: Object.assign({}, p.flags, { turn: Object.assign({}, p.flags.turn || {}), cyclonePair: null }), ai: aiFor ? aiFor(p.i) : p.ai }));
    this.players.forEach((p, i) => { g.players[i].units = p.units.map(u => { const n = Object.assign(Object.create(Unit.prototype), u); n.owner = g.players[i]; n.tKw = Object.assign({}, u.tKw); n.bKw = Object.assign({}, u.bKw); n.once = new Set(u.once); n.flags = Object.assign({}, u.flags); return n; }); });
    g.players[0].opp = g.players[1]; g.players[1].opp = g.players[0];
    g.turnPlayer = this.turnPlayer ? g.players[this.turnPlayer.i] : null;
    return g;
  }
  trackTwo(p) {
    const s = this.stats.p[p.i]; const o = p.opp;
    if (s.twoShieldTurn === null && o.shields.length <= 2) { s.twoShieldTurn = p.turnsTaken; s.handAt2Shield = p.hand.length; }
  }
}

let EFFECTS = {};
function setEffects(e) { EFFECTS = e; }
module.exports = { Game, Unit, CARDS, TOKEN, setEffects, rngFrom, shuffle, RNG, get EFFECTS() { return EFFECTS; } };
