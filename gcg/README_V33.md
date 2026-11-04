# Gundam GCG simulator — V33 additions (3 Nov 2026)

New in this version
- compiler.js: strict template compiler for card text; auto-implements cards whose every clause parses (fidelity 'auto').
  Wired in effects.js; 247 more Green/Blue/Red cards playable. Unparsed cards are excluded from the optimizer pools.
- searchai.js: determinized Monte Carlo search AI (K top options x N rollouts through the opponent's turn).
- calib.js: Spearman check of simulated archetype strength vs real-world proxy (play share + 2x major wins).
- screen.js: leave-out / swap-in card screen for one deck vs the 26-list field.
- ga.js: genetic deck search (islands, crossover, packages, fresh-seed elite re-checks). --lock id:n to force cards.
- evalfield.js: Metric B (plain mean over lists) and Metric A (real-share weighted).
- validate.js: 1,000 fresh-seed games per opponent + card-level seen/not-seen stats.
- searchcheck.js: both sides on search AI (or ours only).
- fuzz.js: random-deck crash test.

Key results: results/validate_GB_GA2.json, results/search_both_*.json, results/ga_GB*.json, results/screen_*.log
Finalist list: decks.json key GB_GA2 (exports/GB_GA2_ExBurst.txt)

Typical commands
  node tests.js
  node validate.js GB_GA2 1000 8800000 hyper
  node searchcheck.js GB_GA2 80 6262000 hyper both
  node ga.js --colors Green,Blue --seeds GB_GA2,BGNU_opt2 --gens 30 --pop 14 --n 60 --out results/ga_next.json

Second round (3 Nov 2026, evening)
- effects_green.js / effects_blue.js / effects_red.js: the remaining 256 Green/Blue/Red cards (220 full, 36 simplified),
  tests_green.js / tests_blue.js / tests_red.js (80 tests). HOOKS.md documents every hook the engine and AI understand.
- engine: noBattleDmg / reduceBattleDmg / taunt / onPlaceEX / lvMod / enemyDeployRested / baseNoBattle / onAllyLinked hooks;
  0-AP attacks no longer destroy shields. ai.fight() respects battle-damage prevention.
- arcs.js (trait synergy map), shells.js (arc shells + chassis hybrids), arcpipe.js (arc pipeline), ga2.js (multi-fidelity
  GA: heuristic screen, search-AI selection, accumulated evidence per deck), tscreen.js (targeted tech screen).
  Results: results/arcpipe.log, results/ga2_GB_full.*, results/ga2_GR_full.*, results/tscreen_GB_GA2.log
