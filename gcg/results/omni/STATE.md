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
- (filled in as stages finish; see omni.log)
