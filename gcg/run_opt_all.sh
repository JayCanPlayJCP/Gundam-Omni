#!/bin/bash
for d in RG25 BG74 RG418 W_LILLE_Nu W_TKY1_BarbSF; do
  node optimize.js --deck $d --iters 220 --screen 60 --confirm 200 --seed $RANDOM --out results/opt_$d.json > results/opt_$d.log 2>&1
done
echo ALLDONE > results/opt_done.flag
