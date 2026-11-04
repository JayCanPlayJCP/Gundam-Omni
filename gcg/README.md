# GCG Sim — Gundam Card Game deck-testing engine

A from-scratch simulator for the Bandai Gundam Card Game (rules: Comprehensive Rules v1.10.0, 16 Oct 2026; card text: Bandai English database, pulled 3 Nov 2026). It plays full games between two decks with a heuristic AI on each side. It runs seeded, seat-balanced batches of 1,000+ games per matchup and reports win rates with 95% intervals plus the metrics behind them.

## Quick start (Node 18+; no dependencies)
```
node tests.js                                   # 30 rules regression tests
node quick.js RG25 J_SFBlockers,J_CharIBO 1000  # one deck vs listed opponents
node baseline.js RG25,BG74,RG418 1000           # each deck vs all 22 gauntlet lists -> results/
node roundrobin.js 200                          # every deck vs every deck (engine sanity check)
node goldfish.js RG25 10000                     # consistency with no opponent
node tune_opps.js                               # pick each opponent's best AI style -> opp_profiles.json
node optimize.js --deck RG25 --iters 220        # legality-checked deck optimizer -> results/opt_RG25.json
node coverage.js                                # coverage.md: every card's implementation status
```
To test a new list, add it to `decks.json` as `{"label": "...", "cards": [{"n": 4, "id": "GD01-030"}, ...]}`. Every card must have an entry in `effects.js`; `node tests.js` fails if one is missing.

## What each run measures
| Metric | Meaning |
|---|---|
| wr, ci95 | Game win rate and Wilson 95% interval |
| firstWR / secondWR | Win rate going first / second (each matchup is played 50/50 on the same seeds) |
| avgTurns | Total turns (both players) |
| avgHandAt6plus | Average hand size at end of main phase once you have 6+ Resources |
| pctMainPhases6plusHand0to1 | Share of those main phases ending with 0–1 cards in hand |
| reachedOpp2Shields / twoShieldConversion | How often you got the opponent to ≤2 Shields, and how often you then won within your next 2 turns |
| avgExtraCards | Cards gained beyond the normal draw (draw effects, Shields to hand, searches) |
| reasons | How games ended (battle damage, deck out, turn limit) |

## Files
- `engine.js`: rules (setup, Lv/cost, deploy, pair/link, attack/block/action/damage steps, Base/Shield/Burst, keywords, limits, win conditions).
- `effects.js`: 178 card implementations, each tagged `full` or `simplified` with a note. All 138 cards in the 25 test decks are covered, plus a 40-card Green/Red/Blue extension pack for the optimizer.
- `ai.js`: heuristic pilot (redraw, deploy/pair/command selection with one-step resource lookahead, removal targeting, attack scoring with block prediction and exposure risk, lethal-threat defense, hold-up of instant removal, Action-step responses, Burst use).
- `profiles.js` / `opp_profiles.json`: AI styles; each opponent is piloted with the style that wins most for it.
- `run.js`: seeded parallel runner (worker threads), Wilson intervals.
- `decks.json`: 22 verified gauntlet lists + RG25, BG74, RG418.

## Known limits (read before trusting a number)
- **The AI is heuristic, not optimal.** It does no search. Decks whose strength comes from sequencing and holding cards (Mobile Fighter above all) are under-played: the engine ranks Mobile Fighter below average although it was the most-played and a frequent winner in Japan. Win rates against Mobile Fighter are likely overstated.
- **The end-phase Action step is only modeled for A Miracle.** The defender's Action-step responses are modeled during battles.
- 11 cards are simplified (see `coverage.md`), none of them core to your three decks.
- No sideboards (Regionals are BO1).
- Relative comparisons between two versions of a deck on the same seeds are more reliable than absolute win rates.
