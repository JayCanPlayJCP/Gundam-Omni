#!/bin/bash
# Validation queue: validates each deck listed in results/final/queue.txt (one key per line) with run_val.sh
# (K4N6 and K4N6+mlp2, 200/list, seed 9393000), in order, one at a time. Add lines at any time; a line STOP ends it.
cd "$(dirname "$0")/../.." || exit 1
while true; do
  grep -qx STOP results/final/queue.txt 2>/dev/null && exit 0
  next=""; while read -r d; do [ -z "$d" ] && continue; [ "$d" = STOP ] && continue
    if [ ! -f results/final/${d}_k4n6_200.json ] || [ ! -f results/final/${d}_mlp2_200.json ]; then next=$d; break; fi; done < results/final/queue.txt
  if [ -z "$next" ]; then sleep 120; continue; fi
  pgrep -f "results/learnga/after.sh" > /dev/null && { sleep 60; continue; }   # don't overlap the learned-GA validation
  W=${W:-1} bash results/final/run_val.sh "$next"
done
