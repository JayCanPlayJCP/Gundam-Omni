## verdict
**No deck reaches 75% against every tournament-winning list, and nothing in the data suggests one exists in this card pool.** The strongest legal deck found is **GP_S4_g14**, a Green/Purple Zeon + Iron-Blooded Orphans aggro list. With the strongest verified judge (K4N6 search) playing both sides, it scores:
- **64.8%** field mean (Metric B) over 600 games against each of the 26 lists (three seeds: 65.5 / 65.3 / 63.4)
- **66.1%** weighted by real tournament share (Metric A)
- **67.8%** with the learned evaluator added (K4N6 + mlp2, 200 games/list)

It beats only **6 of 26 lists at 75% or better**, and it is **below 50% against 4**: W_BRIS_RWAcademy 45.5, J_SFIBO_alt 46.2, J_SFIBO_Chiba 46.5 and W_MKE_ZGok 49.8. It is a seat-dependent deck: 79% going first and 51% going second.

The evidence that 75% is out of reach, not just unfound:
- **Every route converges below 66%.** The search covered 15 colour units (10 pairs, 5 mono) with census, island GA and a stronger-AI check, then a 25-generation pure search GA on the top five. Green/Red and mono Purple were screened as well. A separate GA judged by the learned evaluator was also run. Every deck re-tested under K4N6 lands between 50% and 65%: the Green/Purple decks at 63–65, Green/Blue at 59–61, White/Purple 58, mono Green 57.
- **The ceiling, deck by deck.** Take the best result any of the 17 validated decks achieved against each list separately — a generous ceiling, since it picks the luckiest of 17 noisy estimates. Even that reaches 75% against only 8 of the 26 lists, and it tops out at **55%** against J_SFIBO_alt and J_CharIBO. A single deck would have to beat that ceiling everywhere.
- **The best deck has hard counters.** A counter-deck GA found a Blue/Purple list that beats it 62.5% and a Red/White list at 58.5% (fresh seeds, K4N6, 200 games). Three tournament lists already hold it to 45–47%. The counters are narrow: the Blue/Purple one scores only 38.0% against the whole field (K4N6, 200 games/list). They only pay off in a meta that is mostly Green/Purple.
- **Stronger play compresses edges.** The same decks score 10–25 points higher with the fast AI than with search AIs. A stronger judge would most likely push win rates further toward 50%, not up toward 75%.

**What the search did find.** The best deck is a refined version of a real tournament list, J_CharIBO (86% the same cards). J_CharIBO itself scores 63.9% under K4N6 (200/list), so the search's improvement, about +1 point, is within noise. Green/Purple aggro is the strongest archetype in this field. Green/Blue (the session-1 favourite) is about 4 points behind once both sides search properly. The handoff's earlier ranking, based on the fast heuristic AI, put Green/Blue ahead. Under search AIs that does not hold.

## judges
Every number in this report comes from both seats playing the same AI. The "judge" is that AI. A stronger judge plays closer to a human expert, so its numbers are the ones to trust. A judge only counted as stronger if it beat the previous one by 55% or more over 400+ games, with the same deck on both sides across the 26 field lists and seats balanced.

- **K4N6** (search: for each decision, the top 4 options × 6 determinized rollouts, hand-written evaluator) is the strongest **verified** judge. It beats the session-1 judge (K3N3 with the rollout bug) 57.9% over 1040 games.
- Nothing tried beat K4N6 by the 55% gate: 2-turn rollouts (D2 46.4%, D3 46.0%), real MCTS/UCT over own-turn action sequences (48–54% over eight settings), and wider/deeper flat search (K6N10 50.7%). Flat search saturates at about K4N6 in this simulator.
- The learned evaluator (an MLP value function trained on self-play positions) adds about +4 points: K4N6+mlp2 vs K4N6 scored 54.0% over 2496 games, just under the gate. So it is reported as a **secondary judge** next to K4N6, never instead of it.
- Calibration: the fast heuristic AI wins only 24.5% against K4N6 (832 games). Fast-AI win rates run 10–25 points above search-AI ones for the same deck.

## counter
The counter-deck GA evolves decks of one colour pair against a single target, seeded with the tournament lists of that pair. It uses K2N2 on both sides, 15 generations, 40 games per evaluation. The best counter of each pair was then re-tested on fresh seeds with K4N6 at 200 games. The GA's own estimate is inflated by selection (picking the luckiest of many kids), and the re-tests show it: 6 to 17 points high.

Against the finalist, two counters clearly beat it after re-testing (K4N6, 200 games each): a **Blue/Purple** list wins 62.5% (95% CI 56–69) and a **Red/White** list 58.5% (52–65). The Blue/Purple one is a refined version of the SFIBO tournament lists (68–72% card overlap) that adds 4 Widespread Annihilation (destroy all Lv.4-or-lower Units, which is the whole Green/Purple deck). Blue/Red (57.0%) is next. The remaining pairs did not clearly beat it (Green/Purple 54.5, Blue/White 52.5, Green/White 45.5, Purple/Red 41.0, Green/Blue 40.5). So the finalist drops to 37.5% against its best counter-deck, and it already sits at 46–47% against three tournament lists. An opponent who expects Green/Purple can prepare a deck that beats it. That deck is a specialist, though: the Blue/Purple counter scores only 38.0% against the field as a whole (K4N6, 200 games per list; 37.2% with mlp2).

**Finalist choice.** GP_S4_g14 and OMNIP_GP_e1 are tied on the field: 64.76% vs 64.79% over 600 games per list, K4N6, three seeds. OMNIP_GP_e1 is 1–2 points higher under each secondary judge (200 games per list each, none significant alone). The same eight counter-decks, re-tested against OMNIP_GP_e1, beat it harder: Blue/Purple 70.5% (CI 64–76) instead of 62.5%, and 2 points more on average. GP_S4_g14 is therefore the finalist, for robustness. OMNIP_GP_e1 is an equal-strength alternative against the current field.

## guide J_SFIBO_Chiba
**Plan: win the first four turns.** This Blue/Purple Tekkadan + Strike Freedom list is the closest thing to a mirror in speed, and it is the matchup least affected by who goes first (54 / 46). Their dangerous draws are cheap Purple bodies that come down early: Graze Custom (2/2 for 1), Gusion Rebake (Blocker; Deploy: 1 damage to one of your Units), Flauros (Ryusei-Go) (Deploy/Attack: destroy a Lv.2-or-lower Unit) and, late, Barbatos Lupus (exiles Tekkadan from trash for 2 damage).
- Mulligan any hand without two Lv.1–3 Units. In this matchup the cheap Zeon/IBO units decide it: games where Zaku II, Char's Zaku II or Barbatos Adapt show up were won 85–89%, games where they did not about 30–34%.
- Your Lv.2 Zaku IIs are Flauros targets. Once they have 4 resources, prefer adding Lv.3 bodies (Char's Zaku II, Rick Dom, Barbatos 1st Form).
- Use Barbatos Adapt / Mikazuki pings to finish a 2-HP Graze Custom, or to set up Exia Repair: it destroys an unpaired Lv.4-or-lower Unit it damages in battle.
- Push shields before Barbatos Lupus (Lv.7) comes online. Long games favour them.

## guide J_SFIBO_alt
Same plan as against J_SFIBO_Chiba, with more Axis (base: shield to hand, then recursion) in their list. Axis showed up in 170 of 200 games and swings their win rate +16 points, so expect one extra shield and plan the lethal turn a turn later. Gusion Rebake's Blocker is the card that stops the race: attack with your biggest Unit into it, or ping it first.

## guide W_BRIS_RWAcademy
**The worst matchup (46.5% here, 46.8% over 400 validation games), and badly seat-dependent (59 first / 34 second).** Red/White blockers plus removal: Gundam Lfrith (2/4 Blocker), Overflowing Affection (draw 2, discard 1), Darkness Finger (2 damage at instant speed), Gundam Aerial (pings on attack and as an Action) and Aegis/Justice. They win the long game (15.9 turns on average).
- Do not play into a stalled board. Rick Dom's Breach 2 and Char Aznable's High-Maneuver on a Link Unit (Char's Zaku II) are how damage gets past Lfrith.
- Lfrith has 4 HP. A Barbatos Adapt or Mikazuki ping plus a 3-AP attacker kills it in one turn.
- Keep the 4-AP+ attackers (Efreet Schneid, Zaku II attacking for 3) for the turn you can attack the player with two or more Units, so Darkness Finger cannot stop all the damage.

## guide W_MKE_ZGok
**Fine going first (75%), poor going second (36%).** Blue/Purple Marines: Char's Z'Gok (Deploy: bottoms a Lv.2-or-lower Unit if another Marine is in play; untargetable with two other Marines), Guntank (1 damage to a rested Unit), Gundam Leopard (4/3 for 2) and Kapool.
- Kill the cheap Marine enablers (Kapool, Leopard, Daughseat, Zock) before Z'Gok lands. Otherwise Z'Gok both removes a Zaku and cannot be attacked.
- Rested Units die to Guntank. Going second, attack only when the attack trades or reaches the player; don't leave a 2-HP Unit rested for nothing.

## guide W_MEX_GPZeon
**A tempo mirror (Green/Purple Zeon).** The same cheap Zeon units decide both sides. Barbatos 1st Form (Attack: if damaged, draw 1) was the biggest swing card for us: every game in which it was seen was won (30 games).
- Trade early and keep attacking with a damaged Barbatos 1st Form to draw. Card advantage, not board size, breaks the mirror.
- Their Char's Zaku II tokens (from Falmel and Char's Zaku II) are 3/1s: any ping kills them.

## caveats
- **Simulator, not the real game.** Card effects are implemented by hand (full or simplified) or compiled from the official text. Finalist cards were hand-checked against cards.json (see cardcheck_*.md). The AIs make mistakes no strong human would. A real expert pilot could change any matchup by more than the noise level.
- **Noise.** At 100 games per list a field mean has sd about 1.6 points (four seeds of GB_GA2 at K2N2: 59.5 / 59.3 / 58.9 / 62.4). At 200 per list it is about 1.1 points. A single matchup at 200 games has a 95% interval of about ±7 points. Differences between decks under 3 points of field mean are not meaningful.
- **Winner's curse.** GA elites are re-measured on fresh seeds before they are reported. Numbers taken from inside a search are marked as such.
- **Field.** The 26 tournament-winning lists on file (W_* regional winners, J_* Japanese shop/CS winners). Newer lists could not be added: this container's network policy blocked the deck-list sites. Each opponent plays the piloting style that suits it best (opp_profiles.json). Metric A weights opponents by their real tournament share.
- **Real-game log.** The handoff mentions GB_GA2_game_log.xlsx for recalibration. It was not in the upload, so the simulator was not re-calibrated against real games.
