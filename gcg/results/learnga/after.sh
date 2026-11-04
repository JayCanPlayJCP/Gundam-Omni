#!/bin/bash
# After the learned-judge GA: store its top 2 elites as decks LGA_GB_e0/e1 and validate them (K4N6 and K4N6+mlp2, 200/list).
cd "$(dirname "$0")/../.." || exit 1
while [ ! -f results/learnga/pure_GB_mlp2.json ]; do sleep 60; done
node -e "const fs=require('fs');const D=JSON.parse(fs.readFileSync('decks.json'));const j=require('./results/learnga/pure_GB_mlp2.json');j.elites.slice(0,2).forEach((e,i)=>{D['LGA_GB_e'+i]={label:'Learned-judge (K2N2+mlp2 both sides) pure GA G/B elite '+i+'; in-search '+(e.search.B*100).toFixed(1)+' n'+e.search.n.toFixed(0),cards:e.deck};});fs.writeFileSync('decks.json',JSON.stringify(D,null,1));"
W=1 bash results/final/run_val.sh LGA_GB_e0 LGA_GB_e1
