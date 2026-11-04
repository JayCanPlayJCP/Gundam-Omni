# GCG Sim, round 2: Green/Blue and Green/Red with Turn X and Grace Under Pressure (3 Nov 2026)

**Bottom line:** no Green/Blue or Green/Red deck reached 75% against all 22 tournament lists. The best deck that keeps the cores you asked for is **G/R Grace (`GR_HYBRID_opt`) at 58.9%**, worst matchup 38.5%. The **G/B Turn X + Grace hybrid (`GB_HYBRID_opt`) is the deck that solves the Blocker problem**: it averages 74.7% against the five Blocker-heavy lists, but it loses to fast Green/Purple Zeon (36.2%). The strongest Green/Blue list found keeps neither engine (Nu, `BGNU_opt2`, 63.6%).

Engine changes this round: 44 more cards (222 total) covering the Ghingnham/Turn X package, token support, Blocker removal (Wheel Spoke Formation, Strategic Arms, R-Jarja, Gyan, Big Zam), Academy/Grace (Calibarn GD05-018, Aerial Rebuild GD04-024, Lauda Neill, Quiet Zero) and Blue High-Maneuver/rest tools. Rules added: Turn X's forced targeting, token copying, Kikeroga's deploy-rested lock, Pilot auras. 38 rules tests pass.

Each track was optimized for 260 iterations with its core locked: the optimizer could not cut Grace or Turn X below the stated count. All numbers below come from fresh seeds: 1,000 games per matchup, half going first, against opponents on their best AI style.

## Results
| Deck (core locked) | Field mean | Worst | vs 5 Blocker lists | vs G/P Zeon | vs Nu/aggro | Hand at 6+ Res. | Late main phases with 0–1 cards |
|---|---|---|---|---|---|---|---|
| RG25 as built (aggro play) | 49.1% | 26.5% | 36.7% | 45.0% | 62.4% | 0.80 | 79% |
| BG74 as built (hyper play) | 50.0% | 30.6% | 51.7% | 39.0% | 52.1% | 0.75 | 83% |
| **G/R Grace hybrid** (Grace ×4) | **58.9%** | **38.5%** | 62.7% | 48.2% | 57.0% | 1.70 | 47% |
| **G/B Turn X + Grace hybrid** (Grace ×4, Turn X ×2) | 57.1% | 23.0% | **74.7%** | 36.2% | 45.8% | 2.07 | 39% |
| G/B Turn X tokens (Turn X ×2, Grace ×3) | 47.1% | 21.2% | — | — | — | 1.98 | 40% |
| G/R Mercury / Academy (Grace ×4) | 49.5% | 22.9% | — | — | — | 1.74 | 47% |
| Reference: G/B Nu, no lock | 63.6% | 43.7% | 67.1% | 53.6% | 60.6% | 1.56 | 53% |

The Blocker group is the DC, Toronto and Melbourne Strike Freedom lists, SF Blockers (JP) and Justice/Aerial. The G/P Zeon group is Char IBO, Mexico City and Manila.

## What the engine says about each of your problems
- **Blockers:** fixed in the G/B hybrid (36.7% → 74.7% against the Blocker lists). Turn X forces enemy attacks onto your rested tokens. Grace's Calibarn token can't be blocked, and Amuro Ray ST01-010 rests a Blocker when paired.
- **Pilot pairing:** both hybrids run 8–11 Pilots, and each Pilot has a Link target in the deck:
    - Amuro GD05-085 → Nu Gundam or Re-GZ.
    - Kayra Su → Kayra's Re-GZ.
    - Vidar → Gundam Vidar.
    - Gym Ghingnham → Turn X.
    - Amuro ST01-010 → ST01-001 Gundam.
- **Running out of cards:** hand size at 6+ Resources more than doubled (about 0.8 → 1.7–2.1). Late main phases ending with 0–1 cards fell from about 80% to 39–47%.
- **Late game:** the top end is now Nu Gundam (Lv7, Breach 5), Turn X (Lv8), Grace tokens and Quiet Zero, instead of Lv3–5 Units only.

## Why the dedicated Turn X and Academy decks lose
Turn X is Lv8: it lands on your 8th turn, and the average game here is decided around turn 7 per player. The token shells (God of War tokens arrive rested, Turn X (Top) is a 2/2 for 3) fall too far behind fast decks before Turn X arrives. Keeping 2 Turn X as the top of an efficient curve works; building the whole deck around it does not. Academy's low-level Units (Heindree, Chuchu, Demi Barding) are 3/2s that lose early trades.

## The matchup that caps every Green deck
Green/Purple Zeon (Char IBO, Mexico City): none of the Green decks tested tops 45% against either list. That deck's cheap Units (Exia Repair, Barbatos) trade evenly into 2/2–3/3 Green Units and its bodies replace themselves. Fixing it likely needs more early interaction (Red pings, Gundam Exia GD04-038) rather than late power.

## Recommended lists
- `exports/GR_HYBRID_opt_ExBurst.txt` — the most even deck in your colors with Grace ×4.
- `exports/GB_HYBRID_opt_ExBurst.txt` — the anti-Blocker deck for a Strike Freedom-heavy room.

Both pass the ban list, both banned pairs and the vanilla rule.

## Limits
The AI is heuristic and under-plays Mobile Fighter, so the 75–83% results against Mobile Fighter are likely high. Comparisons between versions on the same seeds are more reliable than absolute numbers. 75% against every tournament-winning list is above anything this engine has produced for any deck in any colors. The best real lists run 55–62% against this field.
