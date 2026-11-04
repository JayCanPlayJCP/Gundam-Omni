#!/bin/bash
# pure stronger-AI deck search; resumable from its own checkpoint
cd /home/claude/sim
C=$1; OUT=results/pure_$C.json; SEEDS=$2; GENS=$3
SF=""; [ -f $OUT ] && { cp $OUT results/pure_${C}_ckpt.json; SF="--seedfiles results/pure_${C}_ckpt.json"; }
COL=$([ "$C" = GB ] && echo Green,Blue || echo Green,Red)
node ga2.js --pure 1 --colors $COL --seeds $SEEDS $SF --gens $GENS --kids 14 --elite 6 --sn 16 --rseed $RANDOM --out $OUT >> results/pure_$C.log 2>&1 && touch results/pure_$C.done
