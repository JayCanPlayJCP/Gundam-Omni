#!/bin/bash
# Reference decks under the strongest verified judge (K4N6, hand evaluate) and the learned judge (K4N6 + mlp2),
# both sides searching, 200 games per field list, common seed 9393000.
cd "$(dirname "$0")/../.."
for d in GB_GA2 OMNI_GB PURE_GB_e1 GB_S2_e1 GR_GA1 OMNI_GR; do
  for j in k4n6 mlp2; do
    out=results/final/${d}_${j}_200.json; [ -f $out ] && continue
    if [ $j = k4n6 ]; then S='{"K":4,"N":6}'; else S='{"K":4,"N":6,"ev":"results/learn/mlp2.json"}'; fi
    SOPTS="$S" SOUT=$out SIM_WORKERS=${W:-2} node searchcheck.js $d 200 9393000 hyper both
  done
done
