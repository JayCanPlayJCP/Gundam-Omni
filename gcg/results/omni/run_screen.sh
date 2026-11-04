#!/bin/bash
# Screening beyond the handoff's top 5 (GR 56.6, MP 56.1 by K2N2 check): reduced-scale pure GA on the spare core
# (gens 12, kids 10, elite 4, sn 24; same seeds as omni.js would use). Promote to full scale only if the elite beats ~63 in-search.
cd "$(dirname "$0")/../.." || exit 1
export SIM_WORKERS=${SIM_WORKERS:-1}
run() { local n=$1 cols=$2 seeds=$3; local out=results/omni/screen_${n}.json; [ -f $out ] && return
  local sf=""; [ -f $out.tmp ] && cp $out.tmp $out.ck && sf="--seedfiles $out.ck"
  node ga2.js --pure 1 --colors $cols --seeds $seeds $sf --gens 12 --kids 10 --elite 4 --sn 24 --rseed $(( $(printf '%d' "'${n:0:1}") * 7 )) --out $out.tmp >> results/omni/screen_${n}.log 2>&1 && mv $out.tmp $out
  node -e "const fs=require('fs');const D=JSON.parse(fs.readFileSync('decks.json'));const j=require('./$out');j.elites.slice(0,2).forEach((e,i)=>{D['SCR_${n}_e'+i]={label:'Screen pure GA ${n} elite '+i+'; in-search '+(e.search.B*100).toFixed(1)+' n'+e.search.n.toFixed(0),cards:e.deck};});fs.writeFileSync('decks.json',JSON.stringify(D,null,1));console.log('[$(date +%T)] screen ${n}: elite in-search',(j.elites[0].search.B*100).toFixed(1),'n',j.elites[0].search.n)" >> results/omni/screen.log; }
run GR Green,Red OMNI_GR,GR_GA1,PURE_GR_e0,ARC_ZEON_GR
run MP Purple OMNI_MP
