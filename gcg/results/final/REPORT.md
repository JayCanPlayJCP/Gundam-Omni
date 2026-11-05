# Operation Omni — final report (GP_S4_g14)

## Verdict

**No deck reaches 75% against every tournament-winning list, and nothing in the data suggests one exists in this card pool.** The strongest legal deck found is **GP_S4_g14**, a Green/Purple Zeon + Iron-Blooded Orphans aggro list. With the strongest verified judge (K4N6 search) playing both sides, it scores:
- **64.8%** field mean (Metric B) over 600 games against each of the 26 lists (three seeds: 65.5 / 65.3 / 63.4)
- **66.1%** weighted by real tournament share (Metric A)
- **67.8%** with the learned evaluator added (K4N6 + mlp2, 200 games/list)

It beats only **6 of 26 lists at 75% or better**, and it is **below 50% against 4**: W_BRIS_RWAcademy 45.5, J_SFIBO_alt 46.2, J_SFIBO_Chiba 46.5 and W_MKE_ZGok 49.8. It is a seat-dependent deck: 79% going first and 51% going second.

Four findings show that 75% is out of reach in this card pool:
- **Every route converges below 66%.** The search covered 15 colour units (10 pairs, 5 mono) with census, island GA and a stronger-AI check. The top five (Green/Blue, Green/Purple, mono Green, White/Purple, Blue/Purple) then got a 25-generation pure search GA, and Green/Red and mono Purple were screened as well. A separate GA judged by the learned evaluator was also run. Every deck re-tested under K4N6 lands between 50% and 65%: Green/Purple 63–65, Green/Blue 59–61, White/Purple 56–58, Blue/Purple 56–57, mono Green 57.
- **The ceiling, deck by deck.** Take the best result any of the 17 validated decks achieved against each list separately. That ceiling is generous, because it picks the luckiest of 17 noisy estimates. Even that reaches 75% against only 8 of the 26 lists, and it tops out at **55%** against J_SFIBO_alt and J_CharIBO. A single deck would have to beat that ceiling everywhere.
- **The best deck has hard counters.** A counter-deck GA found a Blue/Purple list that beats it 62.5% and a Red/White list at 58.5% (fresh seeds, K4N6, 200 games). Three tournament lists already hold it to 45–47%. The counters are narrow: the Blue/Purple one scores only 38.0% against the whole field (K4N6, 200 games/list). They only pay off in a meta that is mostly Green/Purple.
- **Weak judges flatter.** Under the fast heuristic AI (the judge the earlier sessions relied on), the White/Purple finalist reaches a 75.0% field mean over 1000 games per list. Even there its worst list is at 58.3%, and only 16 of 26 lists are at 75% or better. With search AIs on both sides, the same deck falls to 56.6%. Green/Blue drops from 70.6% to 60%. Green/Purple is the only archetype that holds or gains under search (63% fast, 65% K4N6). A stronger judge than K4N6 would most likely push win rates further toward 50%, not up toward 75%.

**What the search did find.** The best deck is a refined version of a real tournament list, J_CharIBO (86% the same cards). J_CharIBO itself scores 63.9% under K4N6 (200/list), so the search's improvement, about +1 point, is within noise. Green/Purple aggro is the strongest archetype in this field. Green/Blue (the session-1 favourite) is about 4 points behind once both sides search properly. The handoff's earlier ranking, based on the fast heuristic AI, put Green/Blue ahead. Under search AIs that does not hold.

## Win rates of GP_S4_g14 under every judge

| judge (both sides use it) | games/list | field mean % | Metric A % | worst % | first % | second % | lists ≥75% |
|---|---|---|---|---|---|---|---|
| K4N6 search, hand evaluator (all seeds pooled) | 600 | 64.8 | 66.1 | 45.5 (W_BRIS_RWAcademy) | 78.6 | 50.9 | 6/26 |
| K4N6 search + learned evaluator (mlp2) | 200 | 67.8 | 68.9 | 46.5 (J_CharIBO) | 80.0 | 55.7 | 8/26 |
| K4N6 search, hand evaluator | 200 | 65.5 | 67.0 | 43.5 (J_SFIBO_alt) | 79.1 | 52.0 | 8/26 |
| K4N6 search, hand evaluator, fresh seed | 200 | 65.3 | 66.4 | 45.5 (W_BRIS_RWAcademy) | 80.4 | 50.2 | 5/26 |
| K4N6 search, hand evaluator, third seed | 200 | 63.4 | 64.8 | 43.0 (W_BRIS_RWAcademy) | 76.2 | 50.7 | 3/26 |
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
| W_BRIS_RWAcademy | 2.2 | 45.5 | 42–50 | 51.0 | 44–58 | 59 | 32 |
| J_SFIBO_alt | 3.9 | 46.2 | 42–50 | 49.5 | 43–56 | 54 | 39 |
| J_SFIBO_Chiba | 3.9 | 46.5 | 43–51 | 48.5 | 42–55 | 54 | 39 |
| W_MKE_ZGok | 1.4 | 49.8 | 46–54 | 59.0 | 52–66 | 74 | 25 |
| W_MEL_SFVictory | 1.4 | 52.0 | 48–56 | 60.5 | 54–67 | 68 | 36 |
| J_CharIBO | 5.2 | 52.3 | 48–56 | 46.5 | 40–53 | 71 | 33 |
| W_MEX_GPZeon | 5.2 | 53.3 | 49–57 | 55.5 | 49–62 | 73 | 33 |
| W_TKY1_BarbSF | 3.9 | 58.3 | 54–62 | 66.0 | 59–72 | 67 | 50 |
| J_BGOYW_Chelmo | 2.2 | 59.3 | 55–63 | 56.0 | 49–63 | 79 | 40 |
| W_MNL_GPZeon | 5.2 | 63.7 | 60–67 | 71.0 | 64–77 | 70 | 57 |
| J_EFFBanshee | 3.7 | 63.7 | 60–67 | 68.5 | 62–75 | 83 | 44 |
| W_LILLE_Nu | 3.7 | 65.0 | 61–69 | 76.0 | 70–81 | 84 | 46 |
| J_JusticeAerial | 2.2 | 67.7 | 64–71 | 71.5 | 65–77 | 84 | 51 |
| W_DUS_Shining | 4.7 | 68.5 | 65–72 | 67.5 | 61–74 | 83 | 54 |
| W_DC_SF | 5.4 | 68.8 | 65–72 | 69.0 | 62–75 | 82 | 56 |
| J_BGOYW | 2.2 | 70.8 | 67–74 | 66.5 | 60–73 | 86 | 55 |
| J_KshatriyaBanshee | 3.7 | 71.3 | 68–75 | 72.0 | 65–78 | 88 | 54 |
| J_Wing_Omiya | 3.0 | 71.7 | 68–75 | 63.0 | 56–69 | 78 | 65 |
| W_TOR_SF | 5.4 | 72.8 | 69–76 | 74.0 | 68–80 | 86 | 60 |
| J_MobileFighter | 4.7 | 74.3 | 71–78 | 80.5 | 74–85 | 87 | 62 |
| W_JKT_Nu | 3.7 | 75.2 | 72–78 | 85.0 | 79–89 | 87 | 63 |
| J_MF_Machida | 4.7 | 75.3 | 72–79 | 75.0 | 69–80 | 89 | 62 |
| J_NuAggro | 3.7 | 75.8 | 72–79 | 86.0 | 81–90 | 89 | 63 |
| J_MF_Kichijoji | 4.7 | 77.0 | 73–80 | 80.5 | 74–85 | 90 | 64 |
| W_TKY3_Shining | 4.7 | 77.5 | 74–81 | 83.5 | 78–88 | 89 | 66 |
| J_SFBlockers | 5.4 | 81.3 | 78–84 | 81.5 | 76–86 | 89 | 74 |

## Play guide: the five hardest matchups

### W_BRIS_RWAcademy — 45.5% (k4n6x2, 600 games)

- Guide sample: 200 games ({"K":4,"N":6} both sides, seed 6161000): 46.5% overall, 59% going first, 34% going second, 15.9 turns on average. Game ends: battle damage 200.
- Cards that win it for us (win rate when seen minus when not seen): Zaku Ⅱ (ST03-008) +69; Char's Zaku Ⅱ (GD01-026) +64; Gundam Barbatos Adapt (GD03-056) +60; Rick Dom (GD01-030) +59.
- Their cards to play around: Gundam Lfrith (GD01-086) +39 for them; Overflowing Affection (GD01-118) +35 for them; Darkness Finger (GD05-110) +33 for them; Gundam Aerial (ST13-006) +32 for them.

**The worst matchup (46.5% here, 46.8% over 400 validation games), and badly seat-dependent (59 first / 34 second).** Red/White blockers plus removal: Gundam Lfrith (2/4 Blocker), Overflowing Affection (draw 2, discard 1), Darkness Finger (2 damage at instant speed), Gundam Aerial (pings on attack and as an Action) and Aegis/Justice. They win the long game (15.9 turns on average).
- Do not play into a stalled board. Rick Dom's Breach 2 and Char Aznable's High-Maneuver on a Link Unit (Char's Zaku II) are how damage gets past Lfrith.
- Lfrith has 4 HP. A Barbatos Adapt or Mikazuki ping plus a 3-AP attacker kills it in one turn.
- Keep the 4-AP+ attackers (Efreet Schneid, Zaku II attacking for 3) for the turn you can attack the player with two or more Units, so Darkness Finger cannot stop all the damage.


### J_SFIBO_alt — 46.2% (k4n6x2, 600 games)

- Guide sample: 200 games ({"K":4,"N":6} both sides, seed 6161000): 49.5% overall, 52% going first, 47% going second, 14.9 turns on average. Game ends: battle damage 200.
- Cards that win it for us (win rate when seen minus when not seen): Zaku Ⅱ (GD01-035) +66; Zaku Ⅱ (ST03-008) +64; Char's Zaku Ⅱ (GD01-026) +62; Gundam Barbatos Adapt (GD03-056) +54.
- Their cards to play around: Gundam Gusion Rebake (GD02-055) +35 for them; Gundam Barbatos Adapt (GD03-056) +33 for them; Graze Custom (ST05-004) +26 for them; Axis (GD05-129) +16 for them.

Same plan as against J_SFIBO_Chiba, with more Axis (base: shield to hand, then recursion) in their list. Axis showed up in 170 of 200 games and swings their win rate +16 points, so expect one extra shield and plan the lethal turn a turn later. Gusion Rebake's Blocker is the card that stops the race: attack with your biggest Unit into it, or ping it first.


### J_SFIBO_Chiba — 46.5% (k4n6x2, 600 games)

- Guide sample: 200 games ({"K":4,"N":6} both sides, seed 6161000): 50.0% overall, 54% going first, 46% going second, 14.8 turns on average. Game ends: battle damage 200.
- Cards that win it for us (win rate when seen minus when not seen): Zaku Ⅱ (ST03-008) +59; Gundam Barbatos Adapt (GD03-056) +55; Zaku Ⅱ (GD01-035) +55; Char's Zaku Ⅱ (GD01-026) +52.
- Their cards to play around: Graze Custom (ST05-004) +39 for them; Gundam Gusion Rebake (GD02-055) +34 for them; Gundam Barbatos Lupus (GD03-050) +29 for them; Gundam Flauros (Ryusei-Go) (GD05-060) +28 for them.

**Plan: win the first four turns.** This Blue/Purple Tekkadan + Strike Freedom list is the closest thing to a mirror in speed, and it is the matchup least affected by who goes first (54 / 46). Their dangerous draws are cheap Purple bodies that come down early: Graze Custom (2/2 for 1), Gusion Rebake (Blocker; Deploy: 1 damage to one of your Units), Flauros (Ryusei-Go) (Deploy/Attack: destroy a Lv.2-or-lower Unit) and, late, Barbatos Lupus (exiles Tekkadan from trash for 2 damage).
- Mulligan any hand without two Lv.1–3 Units. In this matchup the cheap Zeon/IBO units decide it: games where Zaku II, Char's Zaku II or Barbatos Adapt show up were won 85–89%, games where they did not about 30–34%.
- Your Lv.2 Zaku IIs are Flauros targets. Once they have 4 resources, prefer adding Lv.3 bodies (Char's Zaku II, Rick Dom, Barbatos 1st Form).
- Use Barbatos Adapt / Mikazuki pings to finish a 2-HP Graze Custom, or to set up Exia Repair: it destroys an unpaired Lv.4-or-lower Unit it damages in battle.
- Push shields before Barbatos Lupus (Lv.7) comes online. Long games favour them.


### W_MKE_ZGok — 49.8% (k4n6x2, 600 games)

- Guide sample: 200 games ({"K":4,"N":6} both sides, seed 6161000): 55.5% overall, 75% going first, 36% going second, 13.7 turns on average. Game ends: battle damage 200.
- Cards that win it for us (win rate when seen minus when not seen): Zaku Ⅱ (GD01-035) +62; Char's Zaku Ⅱ (GD01-026) +61; Zaku Ⅱ (ST03-008) +60; Gundam Barbatos Adapt (GD03-056) +55.
- Their cards to play around: Char's Z'Gok (ST11-001) +54 for them; Guntank (GD01-008) +51 for them; Gundam Leopard (ST11-007) +49 for them; Kapool (ST11-009) +46 for them.

**Fine going first (75%), poor going second (36%).** Blue/Purple Marines: Char's Z'Gok (Deploy: bottoms a Lv.2-or-lower Unit if another Marine is in play; untargetable with two other Marines), Guntank (1 damage to a rested Unit), Gundam Leopard (4/3 for 2) and Kapool.
- Kill the cheap Marine enablers (Kapool, Leopard, Daughseat, Zock) before Z'Gok lands. Otherwise Z'Gok both removes a Zaku and cannot be attacked.
- Rested Units die to Guntank. Going second, attack only when the attack trades or reaches the player; don't leave a 2-HP Unit rested for nothing.


### W_MEL_SFVictory — 52.0% (k4n6x2, 600 games)



## Finalists and reference decks under the strong judges

| deck | judge | games/list | field mean % | Metric A % | worst % | first % | second % |
|---|---|---|---|---|---|---|---|
| GP_S4_g14 | K4N6 search, hand evaluator (all seeds pooled) | 600 | 64.8 | 66.1 | 45.5 (W_BRIS_RWAcademy) | 78.6 | 50.9 |
| GP_S4_g14 | K4N6 search + learned evaluator (mlp2) | 200 | 67.8 | 68.9 | 46.5 (J_CharIBO) | 80.0 | 55.7 |
| GP_S4_g14 | K4N6 search, hand evaluator | 200 | 65.5 | 67.0 | 43.5 (J_SFIBO_alt) | 79.1 | 52.0 |
| GP_S4_g14 | K4N6 search, hand evaluator, fresh seed | 200 | 65.3 | 66.4 | 45.5 (W_BRIS_RWAcademy) | 80.4 | 50.2 |
| GP_S4_g14 | K4N6 search, hand evaluator, third seed | 200 | 63.4 | 64.8 | 43.0 (W_BRIS_RWAcademy) | 76.2 | 50.7 |
| GP_S4_g14 | K3N3 search | 200 | 64.5 | 66.1 | 43.5 (W_BRIS_RWAcademy) | 77.7 | 51.3 |
| GP_S4_g14 | K2N2 search | 200 | 65.1 | 66.4 | 46.0 (W_BRIS_RWAcademy) | 77.3 | 53.0 |
| GP_S4_g14 | fast heuristic AI | 1000 | 61.9 | 63.2 | 26.4 (W_BRIS_RWAcademy) | 68.9 | 54.9 |
| OMNIP_GP_e1 | K4N6 search, hand evaluator (all seeds pooled) | 600 | 64.8 | 66.2 | 45.3 (W_BRIS_RWAcademy) | 78.1 | 51.5 |
| OMNIP_GP_e1 | K4N6 search + learned evaluator (mlp2) | 200 | 69.0 | 70.4 | 46.5 (W_BRIS_RWAcademy) | 82.2 | 55.8 |
| OMNIP_GP_e1 | K4N6 search, hand evaluator | 200 | 65.1 | 66.7 | 42.5 (W_BRIS_RWAcademy) | 78.4 | 51.9 |
| OMNIP_GP_e1 | K4N6 search, hand evaluator, fresh seed | 200 | 64.8 | 66.1 | 43.5 (J_SFIBO_Chiba) | 78.8 | 50.8 |
| OMNIP_GP_e1 | K4N6 search, hand evaluator, third seed | 200 | 64.4 | 65.7 | 45.0 (W_BRIS_RWAcademy) | 77.0 | 51.8 |
| OMNIP_GP_e1 | K3N3 search | 200 | 65.6 | 67.0 | 44.0 (W_BRIS_RWAcademy) | 78.8 | 52.4 |
| OMNIP_GP_e1 | K2N2 search | 200 | 67.2 | 68.5 | 43.0 (W_BRIS_RWAcademy) | 78.2 | 56.1 |
| OMNIP_GP_e1 | fast heuristic AI | 1000 | 62.9 | 64.2 | 23.9 (W_BRIS_RWAcademy) | 70.0 | 55.7 |
| OMNIP_GP_e0 | K4N6 search + learned evaluator (mlp2) | 200 | 67.9 | 69.4 | 46.0 (W_BRIS_RWAcademy) | 79.8 | 55.9 |
| OMNIP_GP_e0 | K4N6 search, hand evaluator | 200 | 63.1 | 64.8 | 41.0 (W_BRIS_RWAcademy) | 76.8 | 49.5 |
| J_CharIBO | K4N6 search + learned evaluator (mlp2) | 200 | 66.5 | 67.6 | 42.5 (J_SFIBO_alt) | 80.6 | 52.4 |
| J_CharIBO | K4N6 search, hand evaluator | 200 | 63.9 | 65.1 | 40.5 (J_SFIBO_Chiba) | 77.5 | 50.3 |
| LGA_GB_e0 | K4N6 search + learned evaluator (mlp2) | 200 | 63.0 | 64.1 | 40.0 (W_MEX_GPZeon) | 76.3 | 49.8 |
| LGA_GB_e0 | K4N6 search, hand evaluator | 200 | 61.4 | 62.5 | 39.0 (J_CharIBO) | 74.1 | 48.8 |
| LGA_GB_e1 | K4N6 search + learned evaluator (mlp2) | 200 | 60.8 | 62.3 | 37.5 (W_MEX_GPZeon) | 73.0 | 48.6 |
| LGA_GB_e1 | K4N6 search, hand evaluator | 200 | 60.4 | 61.6 | 32.0 (J_CharIBO) | 74.1 | 46.7 |
| GB_S2_e1 | K4N6 search + learned evaluator (mlp2) | 200 | 59.8 | 60.9 | 31.5 (J_CharIBO) | 73.5 | 46.0 |
| GB_S2_e1 | K4N6 search, hand evaluator | 200 | 60.6 | 61.7 | 37.5 (J_CharIBO) | 73.1 | 48.1 |
| PURE_GB_e1 | K4N6 search + learned evaluator (mlp2) | 200 | 61.1 | 62.6 | 39.5 (W_MEL_SFVictory) | 74.0 | 48.3 |
| PURE_GB_e1 | K4N6 search, hand evaluator | 200 | 59.2 | 60.6 | 35.5 (J_CharIBO) | 72.5 | 45.9 |
| OMNIP_GB_e0 | K4N6 search + learned evaluator (mlp2) | 200 | 62.1 | 63.6 | 38.5 (W_MEL_SFVictory) | 75.1 | 49.0 |
| OMNIP_GB_e0 | K4N6 search, hand evaluator | 200 | 60.1 | 61.4 | 38.0 (J_CharIBO) | 73.3 | 47.0 |
| OMNIP_GB_e1 | K4N6 search + learned evaluator (mlp2) | 200 | 61.3 | 62.5 | 35.5 (W_MEX_GPZeon) | 73.9 | 48.6 |
| OMNIP_GB_e1 | K4N6 search, hand evaluator | 200 | 60.5 | 61.6 | 37.5 (W_MEX_GPZeon) | 73.2 | 47.8 |
| OMNIP_WP_e0 | K4N6 search + learned evaluator (mlp2) | 200 | 56.9 | 56.9 | 45.5 (W_LILLE_Nu) | 72.4 | 41.4 |
| OMNIP_WP_e0 | K4N6 search, hand evaluator | 200 | 58.2 | 58.0 | 47.0 (W_JKT_Nu) | 73.0 | 43.4 |
| OMNIP_WP_e1 | K4N6 search + learned evaluator (mlp2) | 200 | 54.7 | 55.2 | 46.5 (J_BGOYW_Chelmo) | 70.8 | 38.7 |
| OMNIP_WP_e1 | K4N6 search, hand evaluator | 200 | 56.6 | 56.7 | 45.5 (W_LILLE_Nu) | 74.0 | 39.2 |
| OMNIP_BP_e0 | K4N6 search + learned evaluator (mlp2) | 200 | 59.8 | 60.7 | 43.0 (J_CharIBO) | 75.7 | 43.8 |
| OMNIP_BP_e0 | K4N6 search, hand evaluator | 200 | 57.4 | 57.9 | 41.5 (J_SFIBO_Chiba) | 73.7 | 41.0 |
| OMNIP_BP_e1 | K4N6 search + learned evaluator (mlp2) | 200 | 59.0 | 60.0 | 44.0 (W_BRIS_RWAcademy) | 75.9 | 42.0 |
| OMNIP_BP_e1 | K4N6 search, hand evaluator | 200 | 56.2 | 57.2 | 41.0 (J_SFIBO_alt) | 72.3 | 40.1 |
| OMNIP_MG_e0 | K4N6 search + learned evaluator (mlp2) | 200 | 58.0 | 58.5 | 32.5 (W_MEX_GPZeon) | 73.3 | 42.7 |
| OMNIP_MG_e0 | K4N6 search, hand evaluator | 200 | 57.0 | 58.0 | 30.5 (J_CharIBO) | 71.9 | 42.2 |
| OMNIP_MG_e1 | K4N6 search + learned evaluator (mlp2) | 200 | 57.6 | 58.3 | 26.0 (J_CharIBO) | 72.8 | 42.4 |
| OMNIP_MG_e1 | K4N6 search, hand evaluator | 200 | 56.6 | 57.3 | 27.5 (J_CharIBO) | 71.6 | 41.6 |
| CTR_GP_S4_g14_BP | K4N6 search + learned evaluator (mlp2) | 200 | 37.2 | 36.9 | 18.0 (W_MNL_GPZeon) | 49.0 | 25.4 |
| CTR_GP_S4_g14_BP | K4N6 search, hand evaluator | 200 | 38.0 | 37.4 | 18.5 (W_BRIS_RWAcademy) | 48.8 | 27.1 |
| GB_GA2 | K4N6 search + learned evaluator (mlp2) | 200 | 58.7 | 60.1 | 36.5 (J_CharIBO) | 72.6 | 44.9 |
| GB_GA2 | K4N6 search, hand evaluator | 200 | 56.3 | 57.6 | 36.0 (W_MEX_GPZeon) | 71.2 | 41.4 |
| OMNI_GB | K4N6 search + learned evaluator (mlp2) | 200 | 58.9 | 59.9 | 36.5 (W_MEX_GPZeon) | 71.9 | 46.0 |
| OMNI_GB | K4N6 search, hand evaluator | 200 | 56.2 | 57.2 | 35.0 (J_CharIBO) | 69.7 | 42.7 |
| OMNI_GR | K4N6 search + learned evaluator (mlp2) | 200 | 56.1 | 56.3 | 37.5 (W_BRIS_RWAcademy) | 71.8 | 40.3 |
| OMNI_GR | K4N6 search, hand evaluator | 200 | 56.4 | 56.9 | 45.5 (W_BRIS_RWAcademy) | 71.8 | 41.0 |
| GR_GA1 | K4N6 search + learned evaluator (mlp2) | 200 | 49.9 | 50.8 | 29.5 (J_CharIBO) | 67.6 | 32.2 |
| GR_GA1 | K4N6 search, hand evaluator | 200 | 50.4 | 51.2 | 34.5 (W_MKE_ZGok) | 67.6 | 33.2 |

## Search islands (one per colour pair / mono colour)

| colour pair | heuristic GA best, fast AI % | K2N2 check % | check worst | pure-search GA elite % |
|---|---|---|---|---|
| GB | 73.0 | 62.8 | 38.0 J_CharIBO | 65.7 (80/list) |
| GR | 64.4 | 56.6 | 33.0 W_BRIS_RWAcademy | 57.8 (168/list, reduced-scale screen) |
| BR | 62.9 | 44.8 | 22.0 J_SFIBO_alt | — |
| MG | 64.3 | 58.4 | 27.0 J_CharIBO | 57.6 (120/list) |
| MB | 62.9 | 43.3 | 28.0 W_MEL_SFVictory | — |
| MR | 57.5 | 47.2 | 34.0 J_SFBlockers | — |
| GP | 65.6 | 58.5 | 36.0 J_CharIBO | 68.8 (40/list) |
| BP | 69.6 | 56.7 | 41.0 W_BRIS_RWAcademy | 62.4 (40/list) |
| BW | 71.2 | 52.2 | 40.0 W_MNL_GPZeon | — |
| RW | 69.1 | 52.1 | 36.0 J_SFBlockers | — |
| GW | 71.9 | 51.2 | 34.0 W_MEX_GPZeon | — |
| PR | 66.2 | 53.5 | 29.0 W_BRIS_RWAcademy | — |
| WP | 75.5 | 57.8 | 38.0 W_BRIS_RWAcademy | 60.3 (40/list) |
| MW | 67.2 | 47.9 | 28.0 W_BRIS_RWAcademy | — |
| MP | 64.2 | 56.1 | 33.0 W_BRIS_RWAcademy | 55.5 (144/list, reduced-scale screen) |

## Convergence across islands and judges

Every deck that was validated under the strong judges, both sides searching, 200 games per list per seed.

| deck | produced by | colours | K4N6 field mean (games/list) | K4N6 + mlp2 | card overlap with finalist |
|---|---|---|---|---|---|
| OMNIP_GP_e1 | Omni pure GA (K2N2 judge), GP elite 1 | Green/Purple | 64.8 (600) | 69.0 | 92% |
| **GP_S4_g14** | Omni pure GA (K2N2 judge), G/P, gen 14 | Green/Purple | 64.8 (600) | 67.8 | 100% |
| J_CharIBO | tournament list (field) | Green/Purple | 63.9 (200) | 66.5 | 86% |
| OMNIP_GP_e0 | Omni pure GA (K2N2 judge), GP elite 0 | Green/Purple | 63.1 (200) | 67.9 | 90% |
| LGA_GB_e0 | pure GA with learned judge (K2N2+mlp2), G/B elite 0 | Blue/Green | 61.4 (200) | 63.0 | 24% |
| GB_S2_e1 | session-1 stage-2 GA (legacy judge), G/B | Blue/Green | 60.6 (200) | 59.8 | 24% |
| OMNIP_GB_e1 | Omni pure GA (K2N2 judge), GB elite 1 | Blue/Green | 60.5 (200) | 61.3 | 28% |
| LGA_GB_e1 | pure GA with learned judge (K2N2+mlp2), G/B elite 1 | Blue/Green | 60.4 (200) | 60.8 | 26% |
| OMNIP_GB_e0 | Omni pure GA (K2N2 judge), GB elite 0 | Blue/Green | 60.1 (200) | 62.1 | 26% |
| PURE_GB_e1 | session-1 pure GA (legacy judge), G/B | Blue/Green | 59.2 (200) | 61.1 | 26% |
| OMNIP_WP_e0 | Omni pure GA (K2N2 judge), WP elite 0 | Purple/White | 58.2 (200) | 56.9 | 20% |
| OMNIP_BP_e0 | Omni pure GA (K2N2 judge), BP elite 0 | Blue/Purple | 57.4 (200) | 59.8 | 18% |
| OMNIP_MG_e0 | Omni pure GA (K2N2 judge), MG elite 0 | Green | 57.0 (200) | 58.0 | 40% |
| OMNIP_WP_e1 | Omni pure GA (K2N2 judge), WP elite 1 | Purple/White | 56.6 (200) | 54.7 | 22% |
| OMNIP_MG_e1 | Omni pure GA (K2N2 judge), MG elite 1 | Green | 56.6 (200) | 57.6 | 40% |
| OMNI_GR | Omni island GA (fast AI judge), GR | Green/Red | 56.4 (200) | 56.1 | 28% |
| GB_GA2 | session-1 heuristic GA, G/B | Blue/Green | 56.3 (200) | 58.7 | 24% |
| OMNIP_BP_e1 | Omni pure GA (K2N2 judge), BP elite 1 | Blue/Purple | 56.2 (200) | 59.0 | 18% |
| OMNI_GB | Omni island GA (fast AI judge), GB | Blue/Green | 56.2 (200) | 58.9 | 28% |
| GR_GA1 | session-1 heuristic GA, G/R | Green/Red | 50.4 (200) | 49.9 | 26% |
| CTR_GP_S4_g14_BP | CTR_GP_S4_g14_BP | Blue/Purple | 38.0 (200) | 37.2 | 20% |

The two strong judges agree on the order: Spearman rank correlation 0.87 over 21 decks. They put the same colour pair on top, and the learned evaluator's numbers run 1–4 points higher.


## Counter-deck search against the finalist

The counter-deck GA evolves decks of one colour pair against a single target, seeded with the tournament lists of that pair. It uses K2N2 on both sides, 15 generations, 40 games per evaluation. The best counter of each pair was then re-tested on fresh seeds with K4N6 at 200 games. The GA's own estimate is inflated by selection (picking the luckiest of many kids), and the re-tests show it: 6 to 17 points high.

Against the finalist, two counters clearly beat it after re-testing (K4N6, 200 games each): a **Blue/Purple** list wins 62.5% (95% CI 56–69) and a **Red/White** list 58.5% (52–65). The Blue/Purple one is a refined version of the SFIBO tournament lists (68–72% card overlap) that adds 4 Widespread Annihilation (destroy all Lv.4-or-lower Units, which is the whole Green/Purple deck). Blue/Red (57.0%) is next. The remaining pairs did not clearly beat it (Green/Purple 54.5, Blue/White 52.5, Green/White 45.5, Purple/Red 41.0, Green/Blue 40.5). So the finalist drops to 37.5% against its best counter-deck, and it already sits at 46–47% against three tournament lists. An opponent who expects Green/Purple can prepare a deck that beats it. That deck is a specialist, though: the Blue/Purple counter scores only 38.0% against the field as a whole (K4N6, 200 games per list; 37.2% with mlp2).

**Finalist choice.** GP_S4_g14 and OMNIP_GP_e1 are tied on the field: 64.76% vs 64.79% over 600 games per list, K4N6, three seeds. OMNIP_GP_e1 is 1–2 points higher under each secondary judge (200 games per list each, none significant alone). The same eight counter-decks, re-tested against OMNIP_GP_e1, beat it harder: Blue/Purple 70.5% (CI 64–76) instead of 62.5%, and 2 points more on average. GP_S4_g14 is therefore the finalist, for robustness. OMNIP_GP_e1 is an equal-strength alternative against the current field.

| target | counter colours | best counter win % (GA, biased up) | best counter re-tested vs target | same counter vs other decks |
|---|---|---|---|---|
| GB_S2_e1 | BP | 57.1 (240 games, in-search) | 47.0 (200 games, fresh seeds, {"K":4,"N":6}) | — |
| GB_S2_e1 | BW | 43.0 (200 games, in-search) | 36.5 (200 games, fresh seeds, {"K":4,"N":6}) | — |
| GB_S2_e1 | GB | 55.0 (40 games, in-search) | 46.0 (200 games, fresh seeds, {"K":4,"N":6}) | — |
| GB_S2_e1 | GP | 65.0 (40 games, in-search) | 56.5 (200 games, fresh seeds, {"K":4,"N":6}) | — |
| GB_S2_e1 | PR | 57.5 (40 games, in-search) | 40.5 (200 games, fresh seeds, {"K":4,"N":6}) | — |
| GB_S2_e1 | RW | 50.0 (40 games, in-search) | 40.5 (200 games, fresh seeds, {"K":4,"N":6}) | — |
| GP_S4_g14 | BP | 65.0 (160 games, in-search) | 62.5 (200 games, fresh seeds, {"K":4,"N":6}) | 70.5 vs OMNIP_GP_e1 |
| GP_S4_g14 | BR | 62.5 (40 games, in-search) | 57.0 (200 games, fresh seeds, {"K":4,"N":6}) | 61.0 vs OMNIP_GP_e1 |
| GP_S4_g14 | BW | 63.3 (120 games, in-search) | 52.5 (200 games, fresh seeds, {"K":4,"N":6}) | 52.5 vs OMNIP_GP_e1 |
| GP_S4_g14 | GB | 52.5 (40 games, in-search) | 40.5 (200 games, fresh seeds, {"K":4,"N":6}) | 34.5 vs OMNIP_GP_e1 |
| GP_S4_g14 | GP | 60.0 (40 games, in-search) | 54.5 (200 games, fresh seeds, {"K":4,"N":6}) | 59.0 vs OMNIP_GP_e1 |
| GP_S4_g14 | GW | 62.5 (40 games, in-search) | 45.5 (200 games, fresh seeds, {"K":4,"N":6}) | 50.5 vs OMNIP_GP_e1 |
| GP_S4_g14 | PR | 47.5 (80 games, in-search) | 41.0 (200 games, fresh seeds, {"K":4,"N":6}) | 40.5 vs OMNIP_GP_e1 |
| GP_S4_g14 | RW | 70.0 (120 games, in-search) | 58.5 (200 games, fresh seeds, {"K":4,"N":6}) | 59.5 vs OMNIP_GP_e1 |

## Card census highlights per colour pair

3 copies of each pool card swapped into the chassis's 3 weakest slots, fast AI, 40 games per list; points of field mean gained. A single swap measured this way has about ±3 points of noise, so only the larger gains are signals. The census run before the islands ranked which cards the island GAs should try. Mono-colour units were not censused.

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
