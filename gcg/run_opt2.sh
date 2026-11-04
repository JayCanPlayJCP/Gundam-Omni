#!/bin/bash
node final_validate.js W_TKY1_BarbSF 1000 > results/final_validate_b.log 2>&1
node optimize.js --deck BGNU_opt1 --iters 300 --screen 80 --confirm 250 --seed 777 --out results/opt_BGNU_opt1.json > results/opt_BGNU_opt1.log 2>&1
echo DONE > results/opt2_done.flag
