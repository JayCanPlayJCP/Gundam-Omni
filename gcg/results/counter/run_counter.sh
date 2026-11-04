#!/bin/bash
# Co-evolution counter-deck GA (handoff step 4.5): evolve decks of each field colour pair against ONE target deck,
# pure stronger-AI fitness (K2N2 both sides), seeded with the field lists of that pair.
# bash results/counter/run_counter.sh TARGET  (run from gcg/; resumable: skips pairs whose output exists)
cd "$(dirname "$0")/../.." || exit 1
T=${1:-GB_S2_e1}; export SIM_WORKERS=${SIM_WORKERS:-1}
run() { local tag=$1 cols=$2 seeds=$3; local out=results/counter/${T}_vs_${tag}.json
  [ -f "$out" ] && return; echo "[$(date +%T)] start $tag" >> results/counter/counter.log
  node ga2.js --pure 1 --opps $T --colors $cols --seeds $seeds --gens 15 --kids 14 --elite 6 --sn 40 --rseed $((${#tag}*131+7)) --out $out.tmp >> results/counter/${T}_${tag}.log 2>&1 && mv $out.tmp $out
  node -e "const j=require('./$out');const e=j.elites[0];console.log('[$(date +%T)] $T vs $tag counter: target loses',(e.search.B*100).toFixed(1)+'% to best counter, n='+e.search.n)" >> results/counter/counter.log; }
run GP Green,Purple W_MNL_GPZeon,W_MEX_GPZeon,J_CharIBO
run BP Blue,Purple W_MKE_ZGok,W_TKY1_BarbSF,J_SFIBO_Chiba,J_SFIBO_alt,J_EFFBanshee
run RW Red,White W_BRIS_RWAcademy,W_DUS_Shining,W_TKY3_Shining,J_MobileFighter,J_MF_Kichijoji,J_MF_Machida,J_JusticeAerial
run BW Blue,White W_DC_SF,W_TOR_SF,J_SFBlockers
run GB Green,Blue W_LILLE_Nu,W_JKT_Nu,J_NuAggro,J_BGOYW,J_BGOYW_Chelmo
run PR Purple,Red J_KshatriyaBanshee
run BR Blue,Red W_MEL_SFVictory
run GW Green,White J_Wing_Omiya
echo "[$(date +%T)] all done" >> results/counter/counter.log
