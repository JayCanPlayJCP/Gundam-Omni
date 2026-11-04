# Operation Omni — final report (GP_S4_g14)

## Verdict

_pending: written when the pure-search GAs and the final validations finish._

## Win rates of GP_S4_g14 under every judge

| judge (both sides use it) | games/list | field mean % | Metric A % | worst % | first % | second % | lists ≥75% |
|---|---|---|---|---|---|---|---|
| K4N6 search, hand evaluator (all seeds pooled) | 400 | 65.4 | 66.7 | 46.3 (J_SFIBO_Chiba) | 79.8 | 51.1 | 7/26 |
| K4N6 search + learned evaluator (mlp2) | 200 | 67.8 | 68.9 | 46.5 (J_CharIBO) | 80.0 | 55.7 | 8/26 |
| K4N6 search, hand evaluator | 200 | 65.5 | 67.0 | 43.5 (J_SFIBO_alt) | 79.1 | 52.0 | 8/26 |
| K4N6 search, hand evaluator, fresh seed | 200 | 65.3 | 66.4 | 45.5 (W_BRIS_RWAcademy) | 80.4 | 50.2 | 5/26 |
| K3N3 search | 200 | 64.5 | 66.1 | 43.5 (W_BRIS_RWAcademy) | 77.7 | 51.3 | 6/26 |
| K2N2 search | 200 | 65.1 | 66.4 | 46.0 (W_BRIS_RWAcademy) | 77.3 | 53.0 | 6/26 |
| fast heuristic AI | 1000 | 61.9 | 63.2 | 26.4 (W_BRIS_RWAcademy) | 68.9 | 54.9 | 7/26 |

## Decklist: GP_S4_g14

```
4 x ST03-016
1 x GD06-109
4 x ST03-011
4 x ST05-010
4 x GD01-026
4 x GD01-030
4 x GD01-035
4 x GD02-054
4 x GD03-056
3 x GD05-050
3 x ST03-006
2 x ST03-007
4 x ST03-008
2 x ST11-009
3 x ST12-008
```

Resource deck (separate): 10 x R-001.

| n | card | name | type | colour | Lv | cost |
|---|---|---|---|---|---|---|
| 4 | ST03-016 | Falmel | BASE | Green | 3 | 2 |
| 1 | GD06-109 | God of War Ghingnham | COMMAND | Green | 4 | 1 |
| 4 | ST03-011 | Char Aznable | PILOT | Green | 3 | 1 |
| 4 | ST05-010 | Mikazuki Augus | PILOT | Purple | 4 | 1 |
| 4 | GD01-026 | Char's Zaku Ⅱ | UNIT | Green | 3 | 2 |
| 4 | GD01-030 | Rick Dom | UNIT | Green | 3 | 2 |
| 4 | GD01-035 | Zaku Ⅱ | UNIT | Green | 2 | 1 |
| 4 | GD02-054 | Gundam Barbatos 1st Form | UNIT | Purple | 3 | 2 |
| 4 | GD03-056 | Gundam Barbatos Adapt | UNIT | Purple | 4 | 2 |
| 3 | GD05-050 | Gundam Exia Repair | UNIT | Purple | 2 | 1 |
| 3 | ST03-006 | Char's Zaku Ⅱ | UNIT | Green | 3 | 2 |
| 2 | ST03-007 | Zaku Ⅰ | UNIT | Green | 1 | 1 |
| 4 | ST03-008 | Zaku Ⅱ | UNIT | Green | 2 | 1 |
| 2 | ST11-009 | Kapool | UNIT | Purple | 1 | 1 |
| 3 | ST12-008 | Efreet Schneid | UNIT | Purple | 4 | 2 |

## Per-matchup win rates

| opponent | real share % | k4n6x2 win % | k4n6x2 95% CI | mlp2 win % | mlp2 95% CI | k4n6x2 first % | k4n6x2 second % |
|---|---|---|---|---|---|---|---|
| J_SFIBO_Chiba | 3.9 | 46.3 | 41–51 | 48.5 | 42–55 | 54 | 39 |
| J_SFIBO_alt | 3.9 | 46.3 | 41–51 | 49.5 | 43–56 | 52 | 41 |
| W_BRIS_RWAcademy | 2.2 | 46.8 | 42–52 | 51.0 | 44–58 | 62 | 32 |
| W_MKE_ZGok | 1.4 | 49.0 | 44–54 | 59.0 | 52–66 | 76 | 23 |
| W_MEX_GPZeon | 5.2 | 51.7 | 47–57 | 55.5 | 49–62 | 73 | 31 |
| J_CharIBO | 5.2 | 52.0 | 47–57 | 46.5 | 40–53 | 72 | 33 |
| W_MEL_SFVictory | 1.4 | 52.5 | 48–57 | 60.5 | 54–67 | 69 | 37 |
| W_TKY1_BarbSF | 3.9 | 58.8 | 54–63 | 66.0 | 59–72 | 67 | 51 |
| J_BGOYW_Chelmo | 2.2 | 60.8 | 56–65 | 56.0 | 49–63 | 81 | 41 |
| W_MNL_GPZeon | 5.2 | 64.3 | 59–69 | 71.0 | 64–77 | 72 | 57 |
| J_EFFBanshee | 3.7 | 65.5 | 61–70 | 68.5 | 62–75 | 84 | 47 |
| W_LILLE_Nu | 3.7 | 67.0 | 62–71 | 76.0 | 70–81 | 86 | 49 |
| J_JusticeAerial | 2.2 | 68.8 | 64–73 | 71.5 | 65–77 | 87 | 51 |
| W_DUS_Shining | 4.7 | 69.5 | 65–74 | 67.5 | 61–74 | 84 | 55 |
| W_DC_SF | 5.4 | 70.0 | 65–74 | 69.0 | 62–75 | 84 | 56 |
| J_Wing_Omiya | 3.0 | 71.5 | 67–76 | 63.0 | 56–69 | 80 | 64 |
| J_BGOYW | 2.2 | 72.3 | 68–76 | 66.5 | 60–73 | 87 | 58 |
| J_KshatriyaBanshee | 3.7 | 72.5 | 68–77 | 72.0 | 65–78 | 90 | 55 |
| J_MobileFighter | 4.7 | 74.0 | 69–78 | 80.5 | 74–85 | 88 | 60 |
| W_TOR_SF | 5.4 | 75.0 | 71–79 | 74.0 | 68–80 | 90 | 61 |
| J_MF_Machida | 4.7 | 76.0 | 72–80 | 75.0 | 69–80 | 91 | 61 |
| W_JKT_Nu | 3.7 | 76.3 | 72–80 | 85.0 | 79–89 | 87 | 66 |
| W_TKY3_Shining | 4.7 | 77.3 | 73–81 | 83.5 | 78–88 | 91 | 64 |
| J_NuAggro | 3.7 | 77.8 | 73–82 | 86.0 | 81–90 | 90 | 66 |
| J_MF_Kichijoji | 4.7 | 78.3 | 74–82 | 80.5 | 74–85 | 93 | 64 |
| J_SFBlockers | 5.4 | 81.5 | 77–85 | 81.5 | 76–86 | 91 | 73 |

## Play guide: the five hardest matchups

### J_SFIBO_Chiba — 46.3% (k4n6x2, 400 games)

- Guide sample: 200 games ({"K":4,"N":6} both sides, seed 6161000): 50.0% overall, 54% going first, 46% going second, 14.8 turns on average. Game ends: battle damage 200.
- Cards that win it for us (win rate when seen minus when not seen): Zaku Ⅱ (ST03-008) +59; Gundam Barbatos Adapt (GD03-056) +55; Zaku Ⅱ (GD01-035) +55; Char's Zaku Ⅱ (GD01-026) +52.
- Their cards to play around: Graze Custom (ST05-004) +39 for them; Gundam Gusion Rebake (GD02-055) +34 for them; Gundam Barbatos Lupus (GD03-050) +29 for them; Gundam Flauros (Ryusei-Go) (GD05-060) +28 for them.

**Plan: win the first four turns.** This Blue/Purple Tekkadan + Strike Freedom list is the closest thing to a mirror in speed, and it is the matchup least affected by who goes first (54 / 46). Their dangerous draws are cheap Purple bodies that come down early: Graze Custom (2/2 for 1), Gusion Rebake (Blocker; Deploy: 1 damage to one of your Units), Flauros (Ryusei-Go) (Deploy/Attack: destroy a Lv.2-or-lower Unit) and, late, Barbatos Lupus (exiles Tekkadan from trash for 2 damage).
- Mulligan any hand without two Lv.1–3 Units. In this matchup the cheap Zeon/IBO units decide it: games where Zaku II, Char's Zaku II or Barbatos Adapt show up were won 85–89%, games where they did not about 30–34%.
- Your Lv.2 Zaku IIs are Flauros targets. Once they have 4 resources, prefer adding Lv.3 bodies (Char's Zaku II, Rick Dom, Barbatos 1st Form).
- Use Barbatos Adapt / Mikazuki pings to finish a 2-HP Graze Custom, or to set up Exia Repair: it destroys an unpaired Lv.4-or-lower Unit it damages in battle.
- Push shields before Barbatos Lupus (Lv.7) comes online. Long games favour them.


### J_SFIBO_alt — 46.3% (k4n6x2, 400 games)

- Guide sample: 200 games ({"K":4,"N":6} both sides, seed 6161000): 49.5% overall, 52% going first, 47% going second, 14.9 turns on average. Game ends: battle damage 200.
- Cards that win it for us (win rate when seen minus when not seen): Zaku Ⅱ (GD01-035) +66; Zaku Ⅱ (ST03-008) +64; Char's Zaku Ⅱ (GD01-026) +62; Gundam Barbatos Adapt (GD03-056) +54.
- Their cards to play around: Gundam Gusion Rebake (GD02-055) +35 for them; Gundam Barbatos Adapt (GD03-056) +33 for them; Graze Custom (ST05-004) +26 for them; Axis (GD05-129) +16 for them.

Same plan as against J_SFIBO_Chiba, with more Axis (base: shield to hand, then recursion) in their list. Axis showed up in 170 of 200 games and swings their win rate +16 points, so expect one extra shield and plan the lethal turn a turn later. Gusion Rebake's Blocker is the card that stops the race: attack with your biggest Unit into it, or ping it first.


### W_BRIS_RWAcademy — 46.8% (k4n6x2, 400 games)

- Guide sample: 200 games ({"K":4,"N":6} both sides, seed 6161000): 46.5% overall, 59% going first, 34% going second, 15.9 turns on average. Game ends: battle damage 200.
- Cards that win it for us (win rate when seen minus when not seen): Zaku Ⅱ (ST03-008) +69; Char's Zaku Ⅱ (GD01-026) +64; Gundam Barbatos Adapt (GD03-056) +60; Rick Dom (GD01-030) +59.
- Their cards to play around: Gundam Lfrith (GD01-086) +39 for them; Overflowing Affection (GD01-118) +35 for them; Darkness Finger (GD05-110) +33 for them; Gundam Aerial (ST13-006) +32 for them.

**The worst matchup (46.5% here, 46.8% over 400 validation games), and badly seat-dependent (59 first / 34 second).** Red/White blockers plus removal: Gundam Lfrith (2/4 Blocker), Overflowing Affection (draw 2, discard 1), Darkness Finger (2 damage at instant speed), Gundam Aerial (pings on attack and as an Action) and Aegis/Justice. They win the long game (15.9 turns on average).
- Do not play into a stalled board. Rick Dom's Breach 2 and Char Aznable's High-Maneuver on a Link Unit (Char's Zaku II) are how damage gets past Lfrith.
- Lfrith has 4 HP. A Barbatos Adapt or Mikazuki ping plus a 3-AP attacker kills it in one turn.
- Keep the 4-AP+ attackers (Efreet Schneid, Zaku II attacking for 3) for the turn you can attack the player with two or more Units, so Darkness Finger cannot stop all the damage.


### W_MKE_ZGok — 49.0% (k4n6x2, 400 games)

- Guide sample: 200 games ({"K":4,"N":6} both sides, seed 6161000): 55.5% overall, 75% going first, 36% going second, 13.7 turns on average. Game ends: battle damage 200.
- Cards that win it for us (win rate when seen minus when not seen): Zaku Ⅱ (GD01-035) +62; Char's Zaku Ⅱ (GD01-026) +61; Zaku Ⅱ (ST03-008) +60; Gundam Barbatos Adapt (GD03-056) +55.
- Their cards to play around: Char's Z'Gok (ST11-001) +54 for them; Guntank (GD01-008) +51 for them; Gundam Leopard (ST11-007) +49 for them; Kapool (ST11-009) +46 for them.

**Fine going first (75%), poor going second (36%).** Blue/Purple Marines: Char's Z'Gok (Deploy: bottoms a Lv.2-or-lower Unit if another Marine is in play; untargetable with two other Marines), Guntank (1 damage to a rested Unit), Gundam Leopard (4/3 for 2) and Kapool.
- Kill the cheap Marine enablers (Kapool, Leopard, Daughseat, Zock) before Z'Gok lands. Otherwise Z'Gok both removes a Zaku and cannot be attacked.
- Rested Units die to Guntank. Going second, attack only when the attack trades or reaches the player; don't leave a 2-HP Unit rested for nothing.


### W_MEX_GPZeon — 51.7% (k4n6x2, 400 games)

- Guide sample: 200 games ({"K":4,"N":6} both sides, seed 6161000): 51.0% overall, 66% going first, 36% going second, 13.3 turns on average. Game ends: battle damage 200.
- Cards that win it for us (win rate when seen minus when not seen): Gundam Barbatos 1st Form (GD02-054) +58; Zaku Ⅱ (GD01-035) +48; Char's Zaku Ⅱ (ST03-006) +48; Gundam Barbatos Adapt (GD03-056) +46.
- Their cards to play around: Char's Zaku Ⅱ (GD01-026) +45 for them; Char's Zaku Ⅱ (ST03-006) +45 for them; Zaku Ⅰ (ST03-007) +43 for them; Gundam Barbatos Adapt (GD03-056) +43 for them.

**A tempo mirror (Green/Purple Zeon).** The same cheap Zeon units decide both sides. Barbatos 1st Form (Attack: if damaged, draw 1) was the biggest swing card for us: every game in which it was seen was won (30 games).
- Trade early and keep attacking with a damaged Barbatos 1st Form to draw. Card advantage, not board size, breaks the mirror.
- Their Char's Zaku II tokens (from Falmel and Char's Zaku II) are 3/1s: any ping kills them.



## Finalists and reference decks under the strong judges

| deck | judge | games/list | field mean % | Metric A % | worst % | first % | second % |
|---|---|---|---|---|---|---|---|
| GP_S4_g14 | K4N6 search, hand evaluator (all seeds pooled) | 400 | 65.4 | 66.7 | 46.3 (J_SFIBO_Chiba) | 79.8 | 51.1 |
| GP_S4_g14 | K4N6 search + learned evaluator (mlp2) | 200 | 67.8 | 68.9 | 46.5 (J_CharIBO) | 80.0 | 55.7 |
| GP_S4_g14 | K4N6 search, hand evaluator | 200 | 65.5 | 67.0 | 43.5 (J_SFIBO_alt) | 79.1 | 52.0 |
| GP_S4_g14 | K4N6 search, hand evaluator, fresh seed | 200 | 65.3 | 66.4 | 45.5 (W_BRIS_RWAcademy) | 80.4 | 50.2 |
| GP_S4_g14 | K3N3 search | 200 | 64.5 | 66.1 | 43.5 (W_BRIS_RWAcademy) | 77.7 | 51.3 |
| GP_S4_g14 | K2N2 search | 200 | 65.1 | 66.4 | 46.0 (W_BRIS_RWAcademy) | 77.3 | 53.0 |
| GP_S4_g14 | fast heuristic AI | 1000 | 61.9 | 63.2 | 26.4 (W_BRIS_RWAcademy) | 68.9 | 54.9 |
| OMNIP_GP_e1 | K4N6 search, hand evaluator (all seeds pooled) | 400 | 65.0 | 66.4 | 45.5 (W_BRIS_RWAcademy) | 78.6 | 51.3 |
| OMNIP_GP_e1 | K4N6 search + learned evaluator (mlp2) | 200 | 69.0 | 70.4 | 46.5 (W_BRIS_RWAcademy) | 82.2 | 55.8 |
| OMNIP_GP_e1 | K4N6 search, hand evaluator | 200 | 65.1 | 66.7 | 42.5 (W_BRIS_RWAcademy) | 78.4 | 51.9 |
| OMNIP_GP_e1 | K4N6 search, hand evaluator, fresh seed | 200 | 64.8 | 66.1 | 43.5 (J_SFIBO_Chiba) | 78.8 | 50.8 |
| OMNIP_GP_e1 | K3N3 search | 200 | 65.6 | 67.0 | 44.0 (W_BRIS_RWAcademy) | 78.8 | 52.4 |
| OMNIP_GP_e1 | K2N2 search | 200 | 67.2 | 68.5 | 43.0 (W_BRIS_RWAcademy) | 78.2 | 56.1 |
| OMNIP_GP_e1 | fast heuristic AI | 1000 | 62.9 | 64.2 | 23.9 (W_BRIS_RWAcademy) | 70.0 | 55.7 |

## Search islands (one per colour pair / mono colour)

| colour pair | heuristic GA best, fast AI % | K2N2 check % | check worst | pure-search GA elite % |
|---|---|---|---|---|
| GB | 73.0 | 62.8 | 38.0 J_CharIBO | 65.7 (80/list) |
| GR | 64.4 | 56.6 | 33.0 W_BRIS_RWAcademy | — |
| BR | 62.9 | 44.8 | 22.0 J_SFIBO_alt | — |
| MG | 64.3 | 58.4 | 27.0 J_CharIBO | — |
| MB | 62.9 | 43.3 | 28.0 W_MEL_SFVictory | — |
| MR | 57.5 | 47.2 | 34.0 J_SFBlockers | — |
| GP | 65.6 | 58.5 | 36.0 J_CharIBO | 68.8 (40/list) |
| BP | 69.6 | 56.7 | 41.0 W_BRIS_RWAcademy | — |
| BW | 71.2 | 52.2 | 40.0 W_MNL_GPZeon | — |
| RW | 69.1 | 52.1 | 36.0 J_SFBlockers | — |
| GW | 71.9 | 51.2 | 34.0 W_MEX_GPZeon | — |
| PR | 66.2 | 53.5 | 29.0 W_BRIS_RWAcademy | — |
| WP | 75.5 | 57.8 | 38.0 W_BRIS_RWAcademy | — |
| MW | 67.2 | 47.9 | 28.0 W_BRIS_RWAcademy | — |
| MP | 64.2 | 56.1 | 33.0 W_BRIS_RWAcademy | — |

## Convergence across islands and judges

### Card overlap (shared copies / 50)

| deck | colours | GP_S4_g14 | OMNIP_GP_e0 | OMNIP_GP_e1 | J_CharIBO | GB_S2_e1 | PURE_GB_e1 | OMNIP_GB_e0 | LGA_GB_e0 |
|---|---|---|---|---|---|---|---|---|---|
| GP_S4_g14 | Green/Purple | — | 90 | 92 | 86 | 24 | 26 | 26 | 24 |
| OMNIP_GP_e0 | Green/Purple | 90 | — | 98 | 86 | 26 | 30 | 30 | 28 |
| OMNIP_GP_e1 | Green/Purple | 92 | 98 | — | 88 | 26 | 30 | 30 | 28 |
| J_CharIBO | Green/Purple | 86 | 86 | 88 | — | 20 | 22 | 22 | 20 |
| GB_S2_e1 | Blue/Green | 24 | 26 | 26 | 20 | — | 92 | 90 | 92 |
| PURE_GB_e1 | Blue/Green | 26 | 30 | 30 | 22 | 92 | — | 98 | 96 |
| OMNIP_GB_e0 | Blue/Green | 26 | 30 | 30 | 22 | 90 | 98 | — | 94 |
| LGA_GB_e0 | Blue/Green | 24 | 28 | 28 | 20 | 92 | 96 | 94 | — |

### Shared core (in >= 60% of the 8 decks; mean copies over all of them)

| card | name | decks | mean copies |
|---|---|---|---|
| ST03-008 | Zaku Ⅱ | 8/8 | 4.0 |
| GD01-030 | Rick Dom | 8/8 | 3.9 |
| ST03-016 | Falmel | 8/8 | 3.3 |
| ST03-007 | Zaku Ⅰ | 7/8 | 3.1 |
| GD05-017 | Nu Gundam | 5/8 | 1.3 |

Core copies: 15.5 of 50.

### Ranking under each judge (field mean B, games/list)

- **k4n6**: GP_S4_g14 65.5 (200) > OMNIP_GP_e1 65.1 (200) > J_CharIBO 63.9 (200) > OMNIP_GP_e0 63.1 (200) > LGA_GB_e0 61.4 (200) > GB_S2_e1 60.6 (200) > OMNIP_GB_e1 60.5 (200) > LGA_GB_e1 60.4 (200) > OMNIP_GB_e0 60.1 (200) > PURE_GB_e1 59.2 (200) > OMNI_GR 56.4 (200) > GB_GA2 56.3 (200) > OMNI_GB 56.2 (200) > GR_GA1 50.4 (200)
- **mlp2**: OMNIP_GP_e1 69.0 (200) > OMNIP_GP_e0 67.9 (200) > GP_S4_g14 67.8 (200) > J_CharIBO 66.5 (200) > LGA_GB_e0 63.0 (200) > OMNIP_GB_e0 62.1 (200) > OMNIP_GB_e1 61.3 (200) > PURE_GB_e1 61.1 (200) > LGA_GB_e1 60.8 (200) > GB_S2_e1 59.8 (200) > OMNI_GB 58.9 (200) > GB_GA2 58.7 (200) > OMNI_GR 56.1 (200) > GR_GA1 49.9 (200)
- **k4n6s2**: GP_S4_g14 65.3 (200)


## Counter-deck search against the finalist

The counter-deck GA evolves decks of one colour pair against a single target, seeded with the tournament lists of that pair. It uses K2N2 on both sides, 15 generations, 40 games per evaluation. The best counter of each pair was then re-tested on fresh seeds with K4N6 at 200 games. The GA's own estimate is inflated by selection (picking the luckiest of many kids), and the re-tests show it: 6 to 17 points high.

Against the finalist, two counters clearly beat it after re-testing (K4N6, 200 games each): a **Blue/Purple** list wins 62.5% (95% CI 56–69) and a **Red/White** list 58.5% (52–65). The Blue/Purple one is a refined version of the SFIBO tournament lists (68–72% card overlap) that adds 4 Widespread Annihilation (destroy all Lv.4-or-lower Units, which is the whole Green/Purple deck). Blue/Red (57.0%) is next. The remaining pairs did not clearly beat it (Green/Purple 54.5, Blue/White 52.5, Green/White 45.5, Purple/Red 41.0, Green/Blue 40.5). So the finalist drops to 37.5% against its best counter-deck, and it already sits at 46–47% against three tournament lists. An opponent who expects Green/Purple can prepare a deck that beats it.

| target | counter colours | best counter win % (GA, biased up) | best counter re-tested |
|---|---|---|---|
| GB_S2_e1 | BP | 57.1 (240 games, in-search) | 47.0 (200 games, fresh seeds, {"K":4,"N":6}) |
| GB_S2_e1 | BW | 43.0 (200 games, in-search) | 36.5 (200 games, fresh seeds, {"K":4,"N":6}) |
| GB_S2_e1 | GB | 55.0 (40 games, in-search) | 46.0 (200 games, fresh seeds, {"K":4,"N":6}) |
| GB_S2_e1 | GP | 65.0 (40 games, in-search) | 56.5 (200 games, fresh seeds, {"K":4,"N":6}) |
| GB_S2_e1 | PR | 57.5 (40 games, in-search) | 40.5 (200 games, fresh seeds, {"K":4,"N":6}) |
| GB_S2_e1 | RW | 50.0 (40 games, in-search) | 40.5 (200 games, fresh seeds, {"K":4,"N":6}) |
| GP_S4_g14 | BP | 65.0 (160 games, in-search) | 62.5 (200 games, fresh seeds, {"K":4,"N":6}) |
| GP_S4_g14 | BR | 62.5 (40 games, in-search) | 57.0 (200 games, fresh seeds, {"K":4,"N":6}) |
| GP_S4_g14 | BW | 63.3 (120 games, in-search) | 52.5 (200 games, fresh seeds, {"K":4,"N":6}) |
| GP_S4_g14 | GB | 52.5 (40 games, in-search) | 40.5 (200 games, fresh seeds, {"K":4,"N":6}) |
| GP_S4_g14 | GP | 60.0 (40 games, in-search) | 54.5 (200 games, fresh seeds, {"K":4,"N":6}) |
| GP_S4_g14 | GW | 62.5 (40 games, in-search) | 45.5 (200 games, fresh seeds, {"K":4,"N":6}) |
| GP_S4_g14 | PR | 47.5 (80 games, in-search) | 41.0 (200 games, fresh seeds, {"K":4,"N":6}) |
| GP_S4_g14 | RW | 70.0 (120 games, in-search) | 58.5 (200 games, fresh seeds, {"K":4,"N":6}) |

## Card census highlights per colour pair

3 copies of each pool card swapped into the chassis's 3 weakest slots, fast AI, 40 games per list; points of field mean gained.

- **GB** (chassis GB_GA2, base 66.0%): Gustav Karl Type-00 (ST08-008) +3.9; How Many Miles to the Battlefield? (GD03-108) +3.6; ReZEL (GD01-018) +3.3; Gundam Ez8 High Mobility Custom (EB01-032) +3.3; ZnO (ST11-004) +2.8; Oggo (EB01-031) +2.7
- **GR** (chassis GR_GA1, base 59.6%): Gundam Exia (GD04-038) +0.6; Re-GZ (GD05-019) -0.6; Gundam Throne Zwei (ST13-008) -3.2; Gundam Ez8 High Mobility Custom (EB01-032) -3.2; Messer Type-F02 Minelayer (ST08-005) -3.2; Battle of Aces (GD01-111) -3.7
- **BR** (chassis W_MEL_SFVictory, base 35.4%): Forbidden Gundam (GD02-006) +5.9; ZnO (ST11-004) +5.1; ReZEL (GD01-018) +5.1; Gundam Throne Zwei (ST13-008) +5.1; Messer Type-F02 Minelayer (ST08-005) +5.1; Gustav Karl Type-00 (ST08-008) +4.8
- **GP** (chassis W_MEX_GPZeon, base 61.9%): Zaku Ⅱ F2 (GD06-060) +1.8; Kapool (ST11-009) +1.6; Genoace (GD02-030) +1.3; Jenice Custom (GD02-065) +1.3; Galluss J (GD06-023) +1.3; Gundam Barbatos 5th Form (Ground Type) (GD03-066) +1.0
- **BP** (chassis W_MKE_ZGok, base 62.1%): Nahel Argama (GD01-123) +4.7; Fatal Strike (ST05-014) +4.5; Byarlant Custom (GD01-019) +4.4; Exclusively Defense-Oriented Policy (GD05-105) +4.1; Pisces (GD01-021) +4.0; Jenice Custom (GD02-065) +4.0
- **BW** (chassis W_TOR_SF, base 53.6%): GM (ST01-005) +2.8; Demi Garrison (GD01-085) +2.8; Hizack (GD02-013) +2.8; Nemo (GD02-080) +2.8; Borjarnon (GD04-078) +2.8; Javelin (GD05-014) +2.8
- **RW** (chassis W_BRIS_RWAcademy, base 56.8%): Altron Gundam (EW) (GD06-064) +4.5; Gaplant TR-5 "Hrairoo" Unit 1 (EB01-054) +3.7; Cannon Illfuto (GD06-077) +3.7; Domon Kasshu (GD05-097) +2.8; Gundam Throne Zwei (ST13-008) +2.7; Gundam Geminass 01 (EB01-056) +2.7
- **GW** (chassis J_Wing_Omiya, base 55.4%): Kayra's Re-GZ (GD05-029) +7.0; Rick Dom (GD01-030) +7.0; Gaplant TR-5 "Hrairoo" Unit 1 (EB01-054) +7.0; Cannon Illfuto (GD06-077) +7.0; Royal Gundam (GD05-075) +6.8; Zowort (ST01-009) +6.8
- **PR** (chassis J_KshatriyaBanshee, base 56.7%): GOOhN (GD01-062) +2.6; Jenice Custom (GD02-065) +2.6; Dra-C (Sleeves) (ST03-005) +2.6; Shuji's Hideout (GD02-126) +2.0; GN Armor Type-E (GD04-063) +1.7; Zaku Ⅱ F2 (GD06-060) +1.6
- **WP** (chassis MERGE_WP, base 62.5%): Altron Gundam (EW) (GD06-064) +2.0; Mikazuki Augus (ST05-010) +1.3; Legend Gundam (GD06-050) +1.2; Zeheart Galette (GD03-094) +0.8; Gaplant TR-5 "Hrairoo" Unit 1 (EB01-054) +0.7; Cannon Illfuto (GD06-077) +0.7

## Judge strength (same deck both sides, X vs Y over the field)

Every number in this report comes from both seats playing the same AI. The "judge" is that AI. A stronger judge plays closer to a human expert, so its numbers are the ones to trust. A judge only counted as stronger if it beat the previous one by 55% or more over 400+ games, with the same deck on both sides across the 26 field lists and seats balanced.

- **K4N6** (search: for each decision, the top 4 options × 6 determinized rollouts, hand-written evaluator) is the strongest **verified** judge. It beats the session-1 judge (K3N3 with the rollout bug) 57.9% over 1040 games.
- Nothing tried beat K4N6 by the 55% gate: 2-turn rollouts (D2 46.4%, D3 46.0%), real MCTS/UCT over own-turn action sequences (48–54% over eight settings), and wider/deeper flat search (K6N10 50.7%). Flat search saturates at about K4N6 in this simulator.
- The learned evaluator (an MLP value function trained on self-play positions) adds about +4 points: K4N6+mlp2 vs K4N6 scored 54.0% over 2496 games, just under the gate. So it is reported as a **secondary judge** next to K4N6, never instead of it.
- Calibration: the fast heuristic AI wins only 24.5% against K4N6 (832 games). Fast-AI win rates run 10–25 points above search-AI ones for the same deck.

| mirror test | X | Y | games | X score % | 95% CI |
|---|---|---|---|---|---|
| heur_vs_k4n6 | null | {"K":4,"N":6} | 832 | 24.5 | 21.7–27.5 |
| k3n3_vs_legacy | {"K":3,"N":3} | {"K":3,"N":3,"legacy":true} | 416 | 54.2 | 49.4–58.9 |
| k4n6_vs_k3n3 | {"K":4,"N":6} | {"K":3,"N":3} | 416 | 53.0 | 48.2–57.8 |
| k4n6_vs_k3n3_832 | {"K":4,"N":6} | {"K":3,"N":3} | 832 | 54.2 | 50.8–57.6 |
| k4n6_vs_legacy | {"K":4,"N":6} | {"K":3,"N":3,"legacy":true} | 1040 | 57.9 | 54.9–60.9 |
| k4n6d2_vs_k4n6 | {"K":4,"N":6,"D":2} | {"K":4,"N":6} | 416 | 46.4 | 41.7–51.2 |
| k4n6d3_vs_k4n6 | {"K":4,"N":6,"D":3} | {"K":4,"N":6} | 416 | 46.0 | 41.3–50.8 |
| k6n10_vs_k4n6 | {"K":6,"N":10} | {"K":4,"N":6} | 832 | 50.7 | 47.3–54.0 |
| lr0_vs_k4n6 | {"K":4,"N":6,"ev":"results/learn/lr0.json"} | {"K":4,"N":6} | 832 | 51.3 | 47.9–54.7 |
| mcts120c3m8_vs_k4n6 | {"mcts":true,"I":120,"C":0.3,"scale":4,"M":8} | {"K":4,"N":6} | 416 | 50.8 | 46.1–55.6 |
| mcts30_vs_k4n6 | {"mcts":true,"I":30} | {"K":4,"N":6} | 416 | 49.8 | 45.0–54.5 |
| mcts60_vs_k4n6 | {"mcts":true,"I":60} | {"K":4,"N":6} | 416 | 48.4 | 43.7–53.2 |
| mcts60c08m6 | {"mcts":true,"I":60,"C":0.08,"scale":4,"M":6} | {"K":4,"N":6} | 832 | 50.1 | 46.7–53.5 |
| mcts60c15_vs_k4n6 | {"mcts":true,"I":60,"C":0.15,"scale":4} | {"K":4,"N":6} | 416 | 53.6 | 48.8–58.3 |
| mcts60c15m6_832 | {"mcts":true,"I":60,"C":0.15,"scale":4,"M":6} | {"K":4,"N":6} | 832 | 51.1 | 47.7–54.5 |
| mcts60c15m6_vs_k4n6 | {"mcts":true,"I":60,"C":0.15,"scale":4,"M":6} | {"K":4,"N":6} | 416 | 54.4 | 49.6–59.2 |
| mcts60c25m6_832 | {"mcts":true,"I":60,"C":0.25,"scale":4,"M":6} | {"K":4,"N":6} | 832 | 51.0 | 47.6–54.3 |
| mlp0_vs_k4n6 | {"K":4,"N":6,"ev":"results/learn/mlp0.json"} | {"K":4,"N":6} | 832 | 51.8 | 48.4–55.2 |
| mlp1_vs_k4n6 | {"K":4,"N":6,"ev":"results/learn/mlp1.json"} | {"K":4,"N":6} | 832 | 54.1 | 50.7–57.4 |
| mlp2_vs_k4n6 | {"K":4,"N":6,"ev":"results/learn/mlp2.json"} | {"K":4,"N":6} | 832 | 54.9 | 51.5–58.3 |
| mlp2_vs_k4n6_fresh | {"K":4,"N":6,"ev":"results/learn/mlp2.json"} | {"K":4,"N":6} | 1664 | 53.6 | 51.2–56.0 |
| mlp2_vs_mlp1 | {"K":4,"N":6,"ev":"results/learn/mlp2.json"} | {"K":4,"N":6,"ev":"results/learn/mlp1.json"} | 832 | 48.2 | 44.8–51.6 |

## Method and caveats

- **Simulator, not the real game.** Card effects are implemented by hand (full or simplified) or compiled from the official text. Finalist cards were hand-checked against cards.json (see cardcheck_*.md). The AIs make mistakes no strong human would. A real expert pilot could change any matchup by more than the noise level.
- **Noise.** At 100 games per list a field mean has sd about 1.6 points (four seeds of GB_GA2 at K2N2: 59.5 / 59.3 / 58.9 / 62.4). At 200 per list it is about 1.1 points. A single matchup at 200 games has a 95% interval of about ±7 points. Differences between decks under 3 points of field mean are not meaningful.
- **Winner's curse.** GA elites are re-measured on fresh seeds before they are reported. Numbers taken from inside a search are marked as such.
- **Field.** The 26 tournament-winning lists on file (W_* regional winners, J_* Japanese shop/CS winners). Newer lists could not be added: this container's network policy blocked the deck-list sites. Each opponent plays the piloting style that suits it best (opp_profiles.json). Metric A weights opponents by their real tournament share.
- **Real-game log.** The handoff mentions GB_GA2_game_log.xlsx for recalibration. It was not in the upload, so the simulator was not re-calibrated against real games.
