# Operation Omni — run state (for resuming after a restart or context compaction)

Driver: `cd /home/claude/sim && (setsid nohup node omni.js > results/omni_driver.out 2>&1 &)` — resumable via results/omni/*.done.
Check progress: `cat results/omni/omni.log; tail results/omni/census.log results/omni/check.log`.
If the container restarts (uptime resets), processes die: just relaunch the driver (it skips finished stages).
Kill safely: `for p in $(pgrep -f "node [o]mni.js"); do kill $p; done` (never `pkill -f` with a pattern in the shell's own command line).

White/Purple: two subagents are writing effects_white.js / effects_purple.js (+ tests_white.js / tests_purple.js, fuzz_wp.js).
When BOTH have reported done and `node tools/remaining.js White` and `... Purple` print 0 lines and all tests pass,
create the flag: `touch results/wp_ready.flag` — the driver waits for it before the W/P pairs and mono W/P.

Reference numbers on the common final check (K3N3 search both sides, 100 games/list, seed 9393000):
GB_GA2 60.7 · GB_S2_e1 62.1 · GB_S2_e0 61.5 · PURE_GB_e0 61.5 · PURE_GB_e1 62.0 · PURE_GR_e0 53.7 · PURE_GR_e1 53.9.
Fast AI (1000 games/list): GB_GA2 70.5 · GB_S2_e1 68.6 · GR_GA1 62.7.
Noise: same deck reordered scored 47.3–54.6 vs 6 Zeon lists at 480 games (K2N2).

User goal: the most powerful deck from the entire card list, any colour/strategy; beat the competitive field by a big margin
(75%+). Doc: https://claude.ai/artifact/WMmgjvZGsCSCe9yMN3ew66 (Operation 75 report) — update with Omni results when done.
