## verdict
_pending: written when the pure-search GAs and the final validations finish._

## judges
Every number in this report comes from both seats playing the same AI. The "judge" is that AI. A stronger judge plays closer to a human expert, so its numbers are the ones to trust. A judge only counted as stronger if it beat the previous one by 55% or more over 400+ games, with the same deck on both sides across the 26 field lists and seats balanced.

- **K4N6** (search: for each decision, the top 4 options × 6 determinized rollouts, hand-written evaluator) is the strongest **verified** judge. It beats the session-1 judge (K3N3 with the rollout bug) 57.9% over 1040 games.
- Nothing tried beat K4N6 by the 55% gate: 2-turn rollouts (D2 46.4%, D3 46.0%), real MCTS/UCT over own-turn action sequences (48–54% over eight settings), and wider/deeper flat search (K6N10 50.7%). Flat search saturates at about K4N6 in this simulator.
- The learned evaluator (an MLP value function trained on self-play positions) adds about +4 points: K4N6+mlp2 vs K4N6 scored 54.0% over 2496 games, just under the gate. So it is reported as a **secondary judge** next to K4N6, never instead of it.
- Calibration: the fast heuristic AI wins only 24.5% against K4N6 (832 games). Fast-AI win rates run 10–25 points above search-AI ones for the same deck.

## counter
The counter-deck GA evolves decks of one colour pair against a single target, seeded with the tournament lists of that pair. It uses K2N2 on both sides, 15 generations, 40 games per evaluation. The best counter of each pair was then re-tested on fresh seeds with K4N6 at 200 games. The GA's own estimate is inflated by selection (picking the luckiest of many kids), and the re-tests show it: 6 to 17 points high.

## caveats
- **Simulator, not the real game.** Card effects are implemented by hand (full or simplified) or compiled from the official text. Finalist cards were hand-checked against cards.json (see cardcheck_*.md). The AIs make mistakes no strong human would. A real expert pilot could change any matchup by more than the noise level.
- **Noise.** At 100 games per list a field mean has sd about 1.6 points (four seeds of GB_GA2 at K2N2: 59.5 / 59.3 / 58.9 / 62.4). At 200 per list it is about 1.1 points. A single matchup at 200 games has a 95% interval of about ±7 points. Differences between decks under 3 points of field mean are not meaningful.
- **Winner's curse.** GA elites are re-measured on fresh seeds before they are reported. Numbers taken from inside a search are marked as such.
- **Field.** The 26 tournament-winning lists on file (W_* regional winners, J_* Japanese shop/CS winners). Newer lists could not be added: this container's network policy blocked the deck-list sites. Each opponent plays the piloting style that suits it best (opp_profiles.json). Metric A weights opponents by their real tournament share.
- **Real-game log.** The handoff mentions GB_GA2_game_log.xlsx for recalibration. It was not in the upload, so the simulator was not re-calibrated against real games.
