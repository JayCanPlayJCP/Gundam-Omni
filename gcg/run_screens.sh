#!/bin/bash
cd /home/claude/sim
for d in BGNU_opt2 J_BGOYW_Chelmo GR_HYBRID_opt GB_HYBRID_opt; do
  node screen.js --deck $d --n 40 --copies 3 --top 25 --confirm 160 --out results/screen_$d.json > results/screen_$d.log 2>&1
done
touch results/screens_done.flag
