#!/bin/bash
cd /home/claude/sim
while [ ! -f results/screens_done.flag ]; do sleep 10; done
node ga.js --colors Green,Blue --seeds BGNU_opt2,J_BGOYW_Chelmo,GB_HYBRID_opt,GB_TURNX_opt --gens 50 --pop 16 --n 40 --rseed 11 --out results/ga_GB.json > results/ga_GB.log 2>&1
node ga.js --colors Green,Red --seeds GR_HYBRID_opt,GR_MERCURY_opt,RG25_opt1,RG418_opt1 --gens 50 --pop 16 --n 40 --rseed 23 --out results/ga_GR.json > results/ga_GR.log 2>&1
touch results/ga_done.flag
