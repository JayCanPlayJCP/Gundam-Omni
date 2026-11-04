# GCG Sim results — 3 Nov 2026

**Bottom line:** no deck reached 75% against every opponent. The best line found, BG74 rebuilt around the Nu Gundam engine (`BGNU_opt2`), wins 63.6% of games against the 22 verified tournament lists. Its worst matchup is 43.7%. A second optimization round on that line did not move it (round one 65.0%, round two 63.6% on different seeds, within noise), so the current card pool and AI have plateaued around 63–65%.

All numbers below come from fresh seeds (not used during optimization): 1,000 games per matchup, 500 going first and 500 second. Each opponent is piloted with the AI style that wins most for it. Each 1,000-game cell has a 95% interval of about ±3 points.

## Field results by version
| Deck (piloting style) | Field mean | Worst matchup | Matchups ≥75% | Going 1st / 2nd | Hand at 6+ Resources | Main phases ending with 0–1 cards | Win within 2 turns of opp at ≤2 Shields |
|---|---|---|---|---|---|---|---|
| RG25 as built (balanced) | 36.8% | 16.0% | 0/22 | 47 / 26 | 0.87 | 76% | 49% |
| RG25 as built (aggro) | 49.1% | 26.5% | 0/22 | 59 / 39 | 0.80 | 79% | 54% |
| RG25 optimized (aggro) | 54.9% | 33.8% | 2/22 | 66 / 44 | 1.52 | 54% | 56% |
| BG74 as built (balanced) | 37.2% | 18.5% | 0/22 | 48 / 27 | 0.69 | 84% | 47% |
| BG74 as built (hyper) | 50.0% | 30.6% | 2/22 | 58 / 42 | 0.75 | 83% | 54% |
| BG74 optimized (hyper) | 58.6% | 39.2% | 2/22 | 65 / 52 | 1.02 | 72% | 62% |
| RG418 as built (balanced) | 35.4% | 17.0% | 0/22 | 46 / 25 | 1.03 | 73% | 49% |
| RG418 optimized (hyper) | 49.8% | 34.0% | 2/22 | 61 / 39 | 1.54 | 55% | 55% |
| **BG74 → Nu line, `BGNU_opt2` (hyper)** | **63.6%** | **43.7%** | 3/22 | 74 / 53 | 1.56 | 53% | 63% |
| Barbatos/SF exploratory, `BPSF_opt1` (tempo) | 62.3% | 41.8% | 4/22 | 70 / 55 | 3.02 | 21% | 63% |

Robustness check: when every opponent uses the style that is *worst* for us, `BGNU_opt2` still averages 62.7%, BG74 optimized 57.4% and RG25 optimized 54.2%. The gains do not depend on one opponent style.

Per-opponent win rates are in `results/matrix_table.md`; raw data is in `results/final_matrix.json`.

## What changed, and why it matches the real winners
- **More Pilots, more Bases.** The optimizer added Pilots to every line (RG25 5→8, the Nu line 12) and Bases (RG25 2→4, RG418 2→5, Nu line 5). That is the same gap Part 0.5 of the V32 prompt found between your decks and the 22 winners.
- **Link Units arrive on time.** With no opponent, `BGNU_opt2` has a Link Unit in play by turn 5 in 86% of games, against 22% for BG74 as built.
- **The hand lasts.** Hand size at 6+ Resources roughly doubled (0.7–0.9 → about 1.5). The share of late main phases ending with 0–1 cards fell from 76–84% to about 53%. Getting the opponent to two Shields and winning within two turns rose from 47–49% to 63%.
- **Piloting matters as much as the list.** Playing your current lists more aggressively (attack the player whenever a hit lands; accept losing a Unit on the crack-back) adds about 12 points by itself in this engine.

## Where the remaining gap is (`BGNU_opt2`)
- Hardest: G/P Zeon (Char IBO 43.7%, Mexico City 45.0%), Brisbane Academy (52.3%), Milwaukee Z'Gok (54.5%) and the Lille Nu mirror (55.7%).
- Best: Mobile Fighter lists (75.7–83.2%), the matchups the engine is least able to trust; see limits.

## Recommended lists
`exports/BGNU_opt2_ExBurst.txt` is the strongest line. It stays in BG74's colors and shares its Londo Bell core. `exports/BG74_opt1_ExBurst.txt` keeps BG74's command package if you want to stay closer to your build. Every export passes the ban list, both banned pairs and the vanilla rule.

## Limits that bound these numbers
1. The AI is heuristic. The engine ranks Mobile Fighter below average although it is the most-played deck in Japan and a frequent winner, so wins against it are probably overstated. Absolute numbers are less reliable than comparisons between versions of a deck on the same seeds.
2. The search could only use the 178 implemented cards: the 138 in the test decks plus a 40-card Green/Red/Blue extension. Cards outside that set were never tried.
3. 75% against every tournament-winning list is far above what any deck reaches in this engine; the best real lists average 55–62% against this field. A more useful gate: ≥60% field mean, ≥45% worst matchup, confirmed in real games.
