# Operation Omni — run state (session 2, full scale)

Machine: 4 cores, 15 GB RAM, no GPU. `export SIM_WORKERS=3` (nproc-1).
Driver: `cd gcg && (setsid nohup node omni.js > results/omni_driver.out 2>&1 &)` — resumable via results/omni/*.done.
Progress: `cat results/omni/omni.log; tail results/omni/census.log results/omni/check.log`.
If the container restarts (uptime resets), processes die: relaunch the driver (it skips finished stages; the pure GA
resumes from its .tmp checkpoint). Kill safely: `for p in $(pgrep -f "node [o]mni.js"); do kill $p; done`.

Scale (constants at the top of omni.js): census 40 games/list, island GA --gens 40 --pop 20 --n 40, stronger-AI check
100 games/list (K2N2, both sides), pure stronger-AI GA --gens 25 --kids 14 --elite 6 --sn 40 on the top 5, S5 validation
K3N3 100 games/list + fast AI 1000 games/list.
Order: GB, GR, BR, mono G/B/R first; then (after results/wp_ready.flag) GP, BP, BW, RW, GW, PR, WP, mono W/P.

Important change vs session 1: search-AI rollouts were identical (KxN played as Kx1). Fixed in searchai.js; legacy:true
reproduces the old judge. So session-2 "K2N2"/"K3N3" numbers are a genuinely stronger judge than session-1's.
Session-1 Omni outputs are in results/omni_v1/ (decks OMNI0_GB, OMNI0_GR).

## Log of this session
- 06:52 driver started (all W/P cards implemented, wp_ready.flag set at launch).
- GB: census done (445 cards, chassis GB_GA2 base 66.0); island heuristic B 73.0; K2N2 check B 62.8 (100/list).
- GR: island heuristic B 64.4; K2N2 check B 56.6.
- BR: island heuristic B 62.9; K2N2 check B 44.8.
- GP: island 65.6, check 58.5. BP: 69.6 / 56.7. BW: 71.2 / 52.2. RW: 69.1 / 52.1.
- GW: 71.9 / 51.2. PR: 66.2 / 53.5. WP: 75.5 / 57.8. MW: 67.2 / 47.9. MP: island 64.2 (check running 12:09).
- S4 top 5 by K2N2 check: GB 62.8, GP 58.5, MG 58.4, WP 57.8, BP 56.7 (GR 56.6 just misses).
- Counter-deck GA vs GB_S2_e1 (step 4.5, 15 gens, K2N2 in-search; re-test K4N6 200 games seed 8282000,
  results/counter/retest_*.json): GP in-search 65.0 (n40) -> re-test 56.5 [50-63]; BP 57.1 (n240) -> 47.0 [40-54];
  RW 50.0, BW 43.0, GB 55.0, PR 57.5 in-search (re-tests running). Field lists already beat GB_S2_e1 harder:
  J_CharIBO 62.5, W_MEX_GPZeon 58.5 (K4N6 200).
- Learned-judge GA (step 4.4) started 11:54: G/B, K2N2+mlp2 both sides, gens 12 kids 10 elite 4 sn 24 (~14 min/gen).
- Reference decks, K4N6 both sides, 200/list, seed 9393000 (results/final/*_k4n6_200.json; *_mlp2_200.json = K4N6+mlp2):
  GB_S2_e1 60.6 / 59.8, PURE_GB_e1 59.2 / 61.1, GB_GA2 56.3 / 58.7, OMNI_GB 56.2 / 58.9, OMNI_GR 56.4 / 56.1, GR_GA1 50.4 / 49.9.
- Spare-core queue (SIM_WORKERS=1): results/counter/run_counter.sh GB_S2_e1 (counter-deck GA per field colour pair, step 4.5,
  preliminary target = current best), then results/learnga/run_learnga.sh (pure GA with mlp2 judge both sides, G/B, step 4.4).
  Both resumable: rerun the script (skips finished outputs).
- Noise: GB_GA2 at K2N2 100/list on 4 seeds: B 59.5 / 59.3 / 58.9 / 62.4 (range 3.5, sd ~1.6).

## Judges (results/judge/*.json, mirror.js: same deck both sides over the 26 field lists, seat-balanced)
- K4N6 vs legacy K3N3 (old judge): 57.9% / 1040 games -> K4N6 is the strongest VERIFIED judge.
- K3N3 (fixed) vs legacy 54.2% / 416; K4N6 vs K3N3 53.0% / 416, 54.2% / 832.
- Not better than K4N6: D2 46.4%, D3 46.0% (416); MCTS 48-54% (416-832) over 8 settings; K6N10 50.7% (832).
- Learned evaluator (K4N6 + valuefn): lr0 51.3, mlp0 51.8, mlp1 54.1, mlp2 54.9 + 53.6 fresh (54.0% over 2496)
  vs hand evaluate; mlp2 vs mlp1 48.2% -> iteration stopped. Below the 55% gate: reported as a secondary judge.
- Calibration: plain heuristic vs K4N6 = 24.5% (832).
