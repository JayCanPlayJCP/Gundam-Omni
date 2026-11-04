#!/bin/bash
# Handoff step 4.4: pure search GA with the learned evaluator (mlp2) on BOTH sides, best pair (Green/Blue),
# seeded with the four best G/B lists. Waits for the counter-deck queue to finish first (shares the spare core).
cd "$(dirname "$0")/../.." || exit 1
export SIM_WORKERS=${SIM_WORKERS:-1}
while ! grep -q "all done" results/counter/counter.log 2>/dev/null; do sleep 60; done
out=results/learnga/pure_GB_mlp2.json; [ -f $out ] && exit 0
sf=""; [ -f $out.tmp ] && cp $out.tmp $out.ck && sf="--seedfiles $out.ck"
node ga2.js --pure 1 --colors Green,Blue --seeds GB_S2_e1,PURE_GB_e1,OMNI_GB,GB_GA2 $sf --gens 12 --kids 10 --elite 4 --sn 24 \
  --sopts '{"K":2,"N":2,"ev":"results/learn/mlp2.json"}' --rseed 4404 --out $out.tmp >> results/learnga/pure_GB_mlp2.log 2>&1 && mv $out.tmp $out
