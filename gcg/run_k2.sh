#!/bin/bash
cd /home/claude/sim
for d in BGNU_opt2 GB_GA2 GB_GA1 J_BGOYW_Chelmo GB_HYBRID_opt BGNU_v4 GR_GA1; do SK=2 SN=2 node searchcheck.js $d 60 6262000 hyper both >> results/k2.log 2>&1; done
touch results/k2_done.flag
