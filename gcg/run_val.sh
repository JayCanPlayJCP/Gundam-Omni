#!/bin/bash
cd /home/claude/sim
for d in "$@"; do
  [ -f results/validate_$d.json ] || node validate.js $d 1000 8800000 hyper >> results/val.log 2>&1
  [ -f results/search_both_$d.json ] || node searchcheck.js $d 100 9393000 hyper both >> results/val.log 2>&1
done
touch results/val_$1.flag
