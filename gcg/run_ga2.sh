#!/bin/bash
cd /home/claude/sim
while [ ! -f results/ga_done.flag ]; do sleep 10; done
node ga.js --colors Green,Blue --seedfiles results/ga_GB.json --seeds BGNU_opt2,J_BGOYW_Chelmo --gens 30 --pop 14 --n 60 --rseed 37 --out results/ga_GB2.json > results/ga_GB2.log 2>&1
node ga.js --colors Green,Blue --seedfiles results/ga_GB.json --seeds GB_TURNX_opt,GB_HYBRID_opt --lock GD06-019:2,GD06-085:2 --gens 30 --pop 14 --n 50 --rseed 41 --out results/ga_GB_TX.json > results/ga_GB_TX.log 2>&1
touch results/ga2_done.flag
