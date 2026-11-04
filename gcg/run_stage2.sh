#!/bin/bash
cd /home/claude/sim
while [ ! -f results/arcpipe.flag ]; do sleep 5; done
[ -f results/s2_GB.done ] || { node ga2.js --colors Green,Blue --seeds GB_GA2,GB_GA1,ARC_GGEN_GB,ARC_ZEON_GB,ARC_WING_GB,J_BGOYW_Chelmo --seedfiles results/ga2_GB_b_ckpt.json --gens 8 --kids 20 --keep 6 --elite 5 --hn 24 --sn 24 --rseed 303 --out results/ga2_GB_full.json > results/ga2_GB_full.log 2>&1 && touch results/s2_GB.done; }
[ -f results/s2_GR.done ] || { node ga2.js --colors Green,Red --seeds GR_GA1,ARC_ZEON_GR,ARC_ACADEMY_GR,ARC_UNE_GR,ARC_NEOZEON_GR,GR_HYBRID_opt --gens 8 --kids 20 --keep 6 --elite 5 --hn 24 --sn 24 --rseed 404 --out results/ga2_GR_full.json > results/ga2_GR_full.log 2>&1 && touch results/s2_GR.done; }
touch results/stage2.flag
