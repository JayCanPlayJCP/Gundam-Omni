#!/bin/bash
# Every judge for one deck (deliverable: win rates under every judge): fast heuristic AI 1000/list (validate.js),
# K2N2 and K3N3 search both sides 200/list, plus K4N6 on a fresh seed (9494000). K4N6 / K4N6+mlp2 come from run_val.sh.
# bash results/final/run_judges.sh DECK   (skips outputs that exist; W workers, default 1)
cd "$(dirname "$0")/../.." || exit 1
d=$1; W=${W:-1}
f=results/final/${d}_fast_1000.json
if [ ! -f $f ]; then SIM_WORKERS=$W node validate.js $d 1000 8800000 hyper results/final/tmp_fast_$d.json >> results/final/run_val.log 2>&1 &&
  node -e "const j=require('./results/final/tmp_fast_$d.json');const per={},first={},second={};for(const [b,x] of Object.entries(j.per)){per[b]=x.wr;first[b]=x.firstWR;second[b]=x.secondWR;}require('fs').writeFileSync('$f',JSON.stringify({deck:j.deck,mode:'fast',n:j.n,B:j.metricB,A:j.metricA,min:j.min,minOpp:j.minOpp,per,first,second,S:null,seed:j.seed},null,1))" && rm -f results/final/tmp_fast_$d.json; fi
for j in k2n2 k3n3 k4n6s2; do out=results/final/${d}_${j}_200.json; [ -f $out ] && continue
  case $j in k2n2) S='{"K":2,"N":2}'; sd=9393000;; k3n3) S='{"K":3,"N":3}'; sd=9393000;; k4n6s2) S='{"K":4,"N":6}'; sd=9494000;; esac
  SOPTS="$S" SOUT=$out SIM_WORKERS=$W node searchcheck.js $d 200 $sd hyper both >> results/final/run_val.log 2>&1
done
