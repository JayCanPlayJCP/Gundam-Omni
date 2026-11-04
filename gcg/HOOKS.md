# Card-effect hooks reference (engine.js / ai.js / effects.js)

Register a card: `F('GD04-020', 'full' | 'simplified', { ...hooks, note: 'what is simplified' })`.
`g` = Game, `u` = Unit (u.def card, u.owner player, u.pilot pilot def or null, u.linked, u.rested, u.sick, u.dmg,
u.tAP/u.bAP turn/battle AP mods, u.tHP, u.tKw / u.bKw {Keyword: n} turn/battle keywords, u.once Set (cleared each own
start phase), u.flags {}, u.token, u.noReady=true -> skips next untap). `p` = player (p.units, p.hand, p.deck (top = [0]),
p.trash, p.exile, p.shields, p.base {def,dmg,ex,rested}, p.opp, p.ai, p.res/p.resRested/p.resDeck/p.ex, p.flags.turn {}).
`c` / `def` = card record from cards.json (id, name, color, type, lv, cost, ap, hp, traits[], links[], text, skw{}).
Keywords printed on the card (<Blocker>, <Breach N>, <Repair N>, <High-Maneuver>, <First Strike>, <Suppression>) are
already parsed into def.skw by the engine: do NOT re-implement them.

## Game helpers
g.ap(u) g.hp(u) g.hpLeft(u) g.kw(u,'Breach') g.hasTrait(u,'Zeon') g.level(p) g.avail(p) g.pay(p,n) g.canPlay(p,def)
g.draw(p,n) g.discard(p,n,pred) g.addShieldToHand(p) g.placeEX(p,n) g.heal(u,n) g.restUnit(u) g.effectDamage(srcPlayer,u,n)
g.destroy(u,{effect:true,by:p}) g.bounce(u) (to hand; pilot too) g.toBottom(u) g.deployUnit(p, def, {rested, token})
g.deployToken(p, 'Token Name', {rested}) (name must exist in engine TOKEN: cards with id 'T-...') g.pair(u, pilotDef)
g.damageShieldArea(attackerP, defenderP, n, {effect:true}) g.fireAllies(p,'hookName',arg) g.turnPlayer (player whose turn)
g.inBattle = current battle b {attacker, target ('player' | Unit), blocked} g.rng() random [0,1)
Resource: place rested resource = `if (p.resDeck > 0) { p.resDeck--; p.res++; p.resRested++; }`; set one active = `p.resRested = Math.max(0, p.resRested - 1)`.
p.flags.lastPayEX = true if the last g.pay used an EX Resource.

## Effects.js helpers (passed as H to color files)
H.dmgPick(g,p,n,filter) H.restPick(g,p,filter) H.bouncePick(g,p,filter,'hand'|'bottom') H.destroyPick(g,p,filter)
H.apDownPick(g,p,n,filter,ctx) H.lookTop(g,p,n,pred) (reveal 1 matching -> hand, rest random bottom)
H.lookOneTopOrBottom(g,p) H.tr(g,u,trait) H.yourTurn(g,p) H.cmd(obj) (marks a Command) H.baseShield(obj) (marks a Base;
the engine already adds the shield to hand on deploy) H.grantActive(g,p,fa,fe,self,all) (u.attackActiveFilter for best/all
friendly units matching fa(g,x,self) against enemies matching fe(g,t)). Filters take the enemy unit: `u => g.hpLeft(u) <= 3`.

## Unit hooks (on the Unit's own card)
deploy(g,u) attack(g,u,b) destroyed(g,u,pilot,cause{battle|effect,by}) whenPaired(g,u,pilotDef) whenLinked(g,u)
onBattleKill(g,u,victim) (any turn; check g.turnPlayer===u.owner for "during your turn") endTurn(g,u) (own end phase)
onOppStart(g,u,oppPlayer) onCommand(g,u,cmdCard) (you played a Command) onPlaceEX(g,u)
onAllyDeploy(g,u,newUnit) onAllyPaired(g,u,unit) onAllyLinked(g,u,unit) onAllyDestroyed(g,u,unit) onAllyAttack(g,u,attacker)
onAllyBattleKill(g,u,killer)
static: ap(g,u) hp(g,u) kw(g,u,k) -> extra amount; aura_ap(g,self,other) aura_hp aura_kw(g,self,other,k) aura_traits(g,self,other,set)
defence: reduceEffectDmg(g,u,d)->d  reduceBattleDmg(g,u,n,src)->n  noBattleDmg(g,u,src,b)->bool  aura_noBattleDmg(g,self,v,src,b)
redirect(g,u,n,b) battleDestroyRule(g,src,victim) untargetable(g,u) cannotAttack noAttackPlayer:true permActive(g,enemy)->bool
taunt rules: selfTaunt(g,u)->bool (enemies must attack this rested Unit), tauntOthers(g,self,t) (enemies must attack rested t),
u.flags.taunt=true (this turn). enemyDeployRested(g,self,def)->bool (enemy units deploy rested).
cost/level: costMod(g,p)->delta  lvMod(g,p)->delta (card in hand).
activated: activate:{cost, once, can(g,p,u), score(g,p,u) (AI value; >~0.3 to use), run(g,p,u), postCombat}
temporary per-turn flags on a unit (cleared at end phase): u.flags.nbd = (g,v,src,b)=>bool (no battle damage),
u.flags.reduceNext = n (next damage reduced), u.attackActiveFilter = t=>bool, u.tKw.X, u.tAP.
AI valuation hints (optional, numbers ~ cards of value): ai_deploy(g,p,null) ai_whenPaired(g,p,u) ai_whenLinked(g,p,u).

## Pilot hooks (on the Pilot card; u = the Unit it is paired with)
p_whenPaired(g,u) p_whenLinked(g,u) p_attack(g,u,b) p_destroyed(g,u,pilot,cause) p_onBattleKill(g,u,victim)
p_ap(g,u) p_hp(g,u) p_kw(g,u,k) p_aura_ap(g,self,other) p_noBattleDmg(g,u,src,b) p_reduceBattleDmg(g,u,n,src) alsoNamed:'Name'

## Command fields (wrap with H.cmd)
main(g,p) canMain(g,p) score(g,p) (AI value for main use; ~1 = a card) actionToo:true (Main/Action) actionOnly:true (Action only;
set canMain:()=>false and main(){}), removal:{kind:'damage'|'hand'|'destroy'|'bottom', n, f:(g,u)=>bool} (AI uses it as
targeted removal on attack/defense), apDown:n, battlePump:n with action(g,p,b,role,unit) (combat trick),
defAction:{can(g,p,b), value(g,p,b,threat,myLoss), run(g,p,b)} (used by the defender in the action step; b.shieldProtect=true
cancels damage to the player), burst(g,p,c) (return 'kept' if the card did not go to trash), pilotName:'X' (【Pilot】[X]),
specialMove:true, endPhaseDraw:n.

## Base fields (wrap with H.baseShield)
baseDeploy(g,p) baseDestroyed(g,p) aura_ap(g,base,u) aura_kw protectEffect(g,u,d) baseNoBattle(g,ownerP,attacker)->bool
onAllyLinked(g,p,u) activate:{cost, once, restBase, can(g,p), score(g,p), run(g,p)} burst default = deploy.

## Rules reminders
1v1: "enemy players" = 1. Shields have no HP: any damage to a shield destroys it. Tokens vanish when they leave play.
Units can only attack the player or a RESTED enemy unit unless an effect allows active targets.

## Optional hooks added for White (all default to the old behaviour when absent)
engine: u.flags.noAtkT = g.turn ("It can't attack during this turn") and u.flags.noAtkPlayerT = g.turn ("can't choose the
enemy player as its attack target during this turn"); unit playerTargetOk:true (its text's "can't choose the enemy player"
clause is conditional, so canAttackPlayer skips the text regex); pilot p_reduceEffectDmg(g,u,d,real) (enemy effect damage);
pilot p_onBlock(g,u,b) (this Unit activated <Blocker>); unit guardArea(g,self,attacker,kind) / pilot p_guardArea, kind
'base'|'shield' -> true = that card can't receive this battle damage; unit grantFirstStrike(g,self,attacker) (the attacker
fighting this Unit deals damage first); unit onBattleDamage(g,self,src,victim) on every Unit of src's owner after a damage
step in which src dealt battle damage > 0; pilot p_onDestroyShieldArea(g,u) (battle damage destroyed a shield area card).
ai: unit battleAct / pilot p_battleAct {cost, once, can(g,p,u,b,role), value(g,p,u,b,role), run(g,p,u,b,role)} =
【Activate･Action】 used in the battle action step (both roles; once = per turn); pilot p_activate {cost, once, postCombat,
can(g,p,u), score(g,p,u), run(g,p,u)} = Pilot 【Activate･Main】 (candidate kind 'pact', u = the paired Unit).
