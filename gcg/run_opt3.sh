#!/bin/bash
node optimize.js --deck GB_HYBRID --iters 260 --screen 70 --confirm 220 --seed 101 --lock GD06-105:4,GD06-019:2 --out results/opt_GB_HYBRID.json > results/opt_GB_HYBRID.log 2>&1
node optimize.js --deck GB_TURNX --iters 260 --screen 70 --confirm 220 --seed 202 --lock GD06-019:2,GD06-105:3 --out results/opt_GB_TURNX.json > results/opt_GB_TURNX.log 2>&1
node optimize.js --deck GR_HYBRID --iters 260 --screen 70 --confirm 220 --seed 303 --lock GD06-105:4 --out results/opt_GR_HYBRID.json > results/opt_GR_HYBRID.log 2>&1
node optimize.js --deck GR_MERCURY --iters 260 --screen 70 --confirm 220 --seed 404 --lock GD06-105:4 --out results/opt_GR_MERCURY.json > results/opt_GR_MERCURY.log 2>&1
echo DONE > results/opt3_done.flag
