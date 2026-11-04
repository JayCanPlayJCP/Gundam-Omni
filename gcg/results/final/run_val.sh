#!/bin/bash
# Strong-judge validation (handoff step 3.3): each deck vs the 26 field lists, both sides searching, 200 games/list,
# common seed 9393000 (same as the reference decks), under K4N6 (hand evaluator) and K4N6 + mlp2 (learned evaluator).
# bash results/final/run_val.sh DECK1 DECK2 ...   (skips outputs that exist; W=workers, default 1)
cd "$(dirname "$0")/../.." || exit 1
for d in "$@"; do
  for j in k4n6 mlp2; do
    out=results/final/${d}_${j}_200.json; [ -f $out ] && continue
    if [ $j = k4n6 ]; then S='{"K":4,"N":6}'; else S='{"K":4,"N":6,"ev":"results/learn/mlp2.json"}'; fi
    SOPTS="$S" SOUT=$out SIM_WORKERS=${W:-1} node searchcheck.js $d 200 9393000 hyper both >> results/final/run_val.log 2>&1
  done
done
