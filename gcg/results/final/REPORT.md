# Operation Omni — final report (GB_S2_e1)

## Verdict

_verdict pending_

## Win rates of GB_S2_e1 under every judge

| judge (both sides use it) | games/list | field mean % | Metric A % | worst % | first % | second % | lists ≥75% |
|---|---|---|---|---|---|---|---|
| K4N6 search, hand evaluator | 200 | 60.6 | 61.7 | 37.5 (J_CharIBO) | 73.1 | 48.1 | 3/26 |
| K4N6 search + learned evaluator (mlp2) | 200 | 59.8 | 60.9 | 31.5 (J_CharIBO) | 73.5 | 46.0 | 3/26 |

## Decklist: GB_S2_e1

```
2 x ST03-016
4 x GD05-105
3 x GD05-085
4 x ST01-010
1 x EB01-032
4 x GD01-008
1 x GD01-013
3 x GD01-019
4 x GD01-030
3 x GD05-017
3 x GD05-019
4 x GD05-027
2 x GD05-029
1 x GD06-025
4 x ST01-001
3 x ST03-007
4 x ST03-008
```

Resource deck (separate): 10 x R-001.

| n | card | name | type | colour | Lv | cost |
|---|---|---|---|---|---|---|
| 2 | ST03-016 | Falmel | BASE | Green | 3 | 2 |
| 4 | GD05-105 | Exclusively Defense-Oriented Policy | COMMAND | Blue | 2 | 1 |
| 3 | GD05-085 | Amuro Ray | PILOT | Green | 5 | 1 |
| 4 | ST01-010 | Amuro Ray | PILOT | Blue | 4 | 1 |
| 1 | EB01-032 | Gundam Ez8 High Mobility Custom | UNIT | Green | 3 | 2 |
| 4 | GD01-008 | Guntank | UNIT | Blue | 2 | 1 |
| 1 | GD01-013 | Gundam | UNIT | Blue | 4 | 2 |
| 3 | GD01-019 | Byarlant Custom | UNIT | Blue | 4 | 2 |
| 4 | GD01-030 | Rick Dom | UNIT | Green | 3 | 2 |
| 3 | GD05-017 | Nu Gundam | UNIT | Green | 7 | 5 |
| 3 | GD05-019 | Re-GZ | UNIT | Green | 4 | 3 |
| 4 | GD05-027 | Jegan | UNIT | Green | 2 | 1 |
| 2 | GD05-029 | Kayra's Re-GZ | UNIT | Green | 3 | 2 |
| 1 | GD06-025 | Re-GZ | UNIT | Green | 4 | 2 |
| 4 | ST01-001 | Gundam | UNIT | Blue | 4 | 3 |
| 3 | ST03-007 | Zaku Ⅰ | UNIT | Green | 1 | 1 |
| 4 | ST03-008 | Zaku Ⅱ | UNIT | Green | 2 | 1 |

## Per-matchup win rates

| opponent | real share % | k4n6 win % | k4n6 95% CI | mlp2 win % | mlp2 95% CI | k4n6 first % | k4n6 second % |
|---|---|---|---|---|---|---|---|
| J_CharIBO | 5.2 | 37.5 | 31–44 | 31.5 | 25–38 | 52 | 23 |
| W_MEX_GPZeon | 5.2 | 41.5 | 35–48 | 35.5 | 29–42 | 62 | 21 |
| W_MEL_SFVictory | 1.4 | 45.0 | 38–52 | 46.5 | 40–53 | 60 | 30 |
| J_EFFBanshee | 3.7 | 48.0 | 41–55 | 47.0 | 40–54 | 69 | 27 |
| J_BGOYW_Chelmo | 2.2 | 48.0 | 41–55 | 43.5 | 37–50 | 70 | 26 |
| J_BGOYW | 2.2 | 48.5 | 42–55 | 48.5 | 42–55 | 71 | 26 |
| W_MKE_ZGok | 1.4 | 51.5 | 45–58 | 45.0 | 38–52 | 70 | 33 |
| J_SFIBO_alt | 3.9 | 52.0 | 45–59 | 51.0 | 44–58 | 55 | 49 |
| W_LILLE_Nu | 3.7 | 53.5 | 47–60 | 55.5 | 49–62 | 75 | 32 |
| J_SFIBO_Chiba | 3.9 | 56.0 | 49–63 | 56.0 | 49–63 | 60 | 52 |
| W_BRIS_RWAcademy | 2.2 | 59.0 | 52–66 | 60.5 | 54–67 | 72 | 46 |
| W_JKT_Nu | 3.7 | 59.5 | 53–66 | 66.5 | 60–73 | 73 | 46 |
| W_DC_SF | 5.4 | 61.0 | 54–67 | 61.5 | 55–68 | 76 | 46 |
| J_KshatriyaBanshee | 3.7 | 62.5 | 56–69 | 58.0 | 51–65 | 83 | 42 |
| J_Wing_Omiya | 3.0 | 63.0 | 56–69 | 65.0 | 58–71 | 68 | 58 |
| J_NuAggro | 3.7 | 63.5 | 57–70 | 67.0 | 60–73 | 82 | 45 |
| W_MNL_GPZeon | 5.2 | 64.5 | 58–71 | 64.0 | 57–70 | 69 | 60 |
| W_TOR_SF | 5.4 | 68.5 | 62–75 | 72.0 | 65–78 | 77 | 60 |
| J_MF_Machida | 4.7 | 70.5 | 64–76 | 72.0 | 65–78 | 78 | 63 |
| J_SFBlockers | 5.4 | 71.5 | 65–77 | 73.5 | 67–79 | 78 | 65 |
| W_TKY1_BarbSF | 3.9 | 72.0 | 65–78 | 63.0 | 56–69 | 78 | 66 |
| J_MobileFighter | 4.7 | 73.0 | 66–79 | 75.0 | 69–80 | 80 | 66 |
| W_DUS_Shining | 4.7 | 74.5 | 68–80 | 71.5 | 65–77 | 87 | 62 |
| W_TKY3_Shining | 4.7 | 75.0 | 69–80 | 73.0 | 66–79 | 83 | 67 |
| J_MF_Kichijoji | 4.7 | 76.5 | 70–82 | 76.0 | 70–81 | 84 | 69 |
| J_JusticeAerial | 2.2 | 80.0 | 74–85 | 75.0 | 69–80 | 89 | 71 |

## Play guide: the five hardest matchups

### J_CharIBO — 37.5% (k4n6, 200 games)


### W_MEX_GPZeon — 41.5% (k4n6, 200 games)


### W_MEL_SFVictory — 45.0% (k4n6, 200 games)


### J_EFFBanshee — 48.0% (k4n6, 200 games)


### J_BGOYW_Chelmo — 48.0% (k4n6, 200 games)



## Finalists and reference decks under the strong judges

| deck | judge | games/list | field mean % | Metric A % | worst % | first % | second % |
|---|---|---|---|---|---|---|---|
| GB_S2_e1 | K4N6 search, hand evaluator | 200 | 60.6 | 61.7 | 37.5 (J_CharIBO) | 73.1 | 48.1 |
| GB_S2_e1 | K4N6 search + learned evaluator (mlp2) | 200 | 59.8 | 60.9 | 31.5 (J_CharIBO) | 73.5 | 46.0 |
| PURE_GB_e1 | K4N6 search, hand evaluator | 200 | 59.2 | 60.6 | 35.5 (J_CharIBO) | 72.5 | 45.9 |
| PURE_GB_e1 | K4N6 search + learned evaluator (mlp2) | 200 | 61.1 | 62.6 | 39.5 (W_MEL_SFVictory) | 74.0 | 48.3 |
| GB_GA2 | K4N6 search, hand evaluator | 200 | 56.3 | 57.6 | 36.0 (W_MEX_GPZeon) | 71.2 | 41.4 |
| GB_GA2 | K4N6 search + learned evaluator (mlp2) | 200 | 58.7 | 60.1 | 36.5 (J_CharIBO) | 72.6 | 44.9 |
| OMNI_GB | K4N6 search, hand evaluator | 200 | 56.2 | 57.2 | 35.0 (J_CharIBO) | 69.7 | 42.7 |
| OMNI_GB | K4N6 search + learned evaluator (mlp2) | 200 | 58.9 | 59.9 | 36.5 (W_MEX_GPZeon) | 71.9 | 46.0 |
| OMNI_GR | K4N6 search, hand evaluator | 200 | 56.4 | 56.9 | 45.5 (W_BRIS_RWAcademy) | 71.8 | 41.0 |
| OMNI_GR | K4N6 search + learned evaluator (mlp2) | 200 | 56.1 | 56.3 | 37.5 (W_BRIS_RWAcademy) | 71.8 | 40.3 |
| GR_GA1 | K4N6 search, hand evaluator | 200 | 50.4 | 51.2 | 34.5 (W_MKE_ZGok) | 67.6 | 33.2 |
| GR_GA1 | K4N6 search + learned evaluator (mlp2) | 200 | 49.9 | 50.8 | 29.5 (J_CharIBO) | 67.6 | 32.2 |

## Search islands (one per colour pair / mono colour)

| colour pair | heuristic GA best, fast AI % | K2N2 check % | check worst | pure-search GA elite % |
|---|---|---|---|---|
| GB | 73.0 | 62.8 | 38.0 J_CharIBO | — |
| GR | 64.4 | 56.6 | 33.0 W_BRIS_RWAcademy | — |
| BR | 62.9 | 44.8 | 22.0 J_SFIBO_alt | — |
| MG | 64.3 | 58.4 | 27.0 J_CharIBO | — |
| MB | 62.9 | 43.3 | 28.0 W_MEL_SFVictory | — |
| MR | 57.5 | 47.2 | 34.0 J_SFBlockers | — |
| GP | 65.6 | 58.5 | 36.0 J_CharIBO | — |
| BP | 69.6 | 56.7 | 41.0 W_BRIS_RWAcademy | — |
| BW | 71.2 | 52.2 | 40.0 W_MNL_GPZeon | — |
| RW | 69.1 | 52.1 | 36.0 J_SFBlockers | — |

## Card census highlights per colour pair

3 copies of each pool card swapped into the chassis's 3 weakest slots, fast AI, 40 games per list; points of field mean gained.

- **GB** (chassis GB_GA2, base 66.0%): Gustav Karl Type-00 (ST08-008) +3.9; How Many Miles to the Battlefield? (GD03-108) +3.6; ReZEL (GD01-018) +3.3; Gundam Ez8 High Mobility Custom (EB01-032) +3.3; ZnO (ST11-004) +2.8; Oggo (EB01-031) +2.7
- **GR** (chassis GR_GA1, base 59.6%): Gundam Exia (GD04-038) +0.6; Re-GZ (GD05-019) -0.6; Gundam Throne Zwei (ST13-008) -3.2; Gundam Ez8 High Mobility Custom (EB01-032) -3.2; Messer Type-F02 Minelayer (ST08-005) -3.2; Battle of Aces (GD01-111) -3.7
- **BR** (chassis W_MEL_SFVictory, base 35.4%): Forbidden Gundam (GD02-006) +5.9; ZnO (ST11-004) +5.1; ReZEL (GD01-018) +5.1; Gundam Throne Zwei (ST13-008) +5.1; Messer Type-F02 Minelayer (ST08-005) +5.1; Gustav Karl Type-00 (ST08-008) +4.8
- **GP** (chassis W_MEX_GPZeon, base 61.9%): Zaku Ⅱ F2 (GD06-060) +1.8; Kapool (ST11-009) +1.6; Genoace (GD02-030) +1.3; Jenice Custom (GD02-065) +1.3; Galluss J (GD06-023) +1.3; Gundam Barbatos 5th Form (Ground Type) (GD03-066) +1.0
- **BP** (chassis W_MKE_ZGok, base 62.1%): Nahel Argama (GD01-123) +4.7; Fatal Strike (ST05-014) +4.5; Byarlant Custom (GD01-019) +4.4; Exclusively Defense-Oriented Policy (GD05-105) +4.1; Pisces (GD01-021) +4.0; Jenice Custom (GD02-065) +4.0
- **BW** (chassis W_TOR_SF, base 53.6%): GM (ST01-005) +2.8; Demi Garrison (GD01-085) +2.8; Hizack (GD02-013) +2.8; Nemo (GD02-080) +2.8; Borjarnon (GD04-078) +2.8; Javelin (GD05-014) +2.8
- **RW** (chassis W_BRIS_RWAcademy, base 56.8%): Altron Gundam (EW) (GD06-064) +4.5; Gaplant TR-5 "Hrairoo" Unit 1 (EB01-054) +3.7; Cannon Illfuto (GD06-077) +3.7; Domon Kasshu (GD05-097) +2.8; Gundam Throne Zwei (ST13-008) +2.7; Gundam Geminass 01 (EB01-056) +2.7

## Judge strength (same deck both sides, X vs Y over the field)



| mirror test | X | Y | games | X score % | 95% CI |
|---|---|---|---|---|---|
| heur_vs_k4n6 | null | {"K":4,"N":6} | 832 | 24.5 | 21.7–27.5 |
| k3n3_vs_legacy | {"K":3,"N":3} | {"K":3,"N":3,"legacy":true} | 416 | 54.2 | 49.4–58.9 |
| k4n6_vs_k3n3 | {"K":4,"N":6} | {"K":3,"N":3} | 416 | 53.0 | 48.2–57.8 |
| k4n6_vs_k3n3_832 | {"K":4,"N":6} | {"K":3,"N":3} | 832 | 54.2 | 50.8–57.6 |
| k4n6_vs_legacy | {"K":4,"N":6} | {"K":3,"N":3,"legacy":true} | 1040 | 57.9 | 54.9–60.9 |
| k4n6d2_vs_k4n6 | {"K":4,"N":6,"D":2} | {"K":4,"N":6} | 416 | 46.4 | 41.7–51.2 |
| k4n6d3_vs_k4n6 | {"K":4,"N":6,"D":3} | {"K":4,"N":6} | 416 | 46.0 | 41.3–50.8 |
| k6n10_vs_k4n6 | {"K":6,"N":10} | {"K":4,"N":6} | 832 | 50.7 | 47.3–54.0 |
| lr0_vs_k4n6 | {"K":4,"N":6,"ev":"results/learn/lr0.json"} | {"K":4,"N":6} | 832 | 51.3 | 47.9–54.7 |
| mcts120c3m8_vs_k4n6 | {"mcts":true,"I":120,"C":0.3,"scale":4,"M":8} | {"K":4,"N":6} | 416 | 50.8 | 46.1–55.6 |
| mcts30_vs_k4n6 | {"mcts":true,"I":30} | {"K":4,"N":6} | 416 | 49.8 | 45.0–54.5 |
| mcts60_vs_k4n6 | {"mcts":true,"I":60} | {"K":4,"N":6} | 416 | 48.4 | 43.7–53.2 |
| mcts60c08m6 | {"mcts":true,"I":60,"C":0.08,"scale":4,"M":6} | {"K":4,"N":6} | 832 | 50.1 | 46.7–53.5 |
| mcts60c15_vs_k4n6 | {"mcts":true,"I":60,"C":0.15,"scale":4} | {"K":4,"N":6} | 416 | 53.6 | 48.8–58.3 |
| mcts60c15m6_832 | {"mcts":true,"I":60,"C":0.15,"scale":4,"M":6} | {"K":4,"N":6} | 832 | 51.1 | 47.7–54.5 |
| mcts60c15m6_vs_k4n6 | {"mcts":true,"I":60,"C":0.15,"scale":4,"M":6} | {"K":4,"N":6} | 416 | 54.4 | 49.6–59.2 |
| mcts60c25m6_832 | {"mcts":true,"I":60,"C":0.25,"scale":4,"M":6} | {"K":4,"N":6} | 832 | 51.0 | 47.6–54.3 |
| mlp0_vs_k4n6 | {"K":4,"N":6,"ev":"results/learn/mlp0.json"} | {"K":4,"N":6} | 832 | 51.8 | 48.4–55.2 |
| mlp1_vs_k4n6 | {"K":4,"N":6,"ev":"results/learn/mlp1.json"} | {"K":4,"N":6} | 832 | 54.1 | 50.7–57.4 |
| mlp2_vs_k4n6 | {"K":4,"N":6,"ev":"results/learn/mlp2.json"} | {"K":4,"N":6} | 832 | 54.9 | 51.5–58.3 |
| mlp2_vs_k4n6_fresh | {"K":4,"N":6,"ev":"results/learn/mlp2.json"} | {"K":4,"N":6} | 1664 | 53.6 | 51.2–56.0 |
| mlp2_vs_mlp1 | {"K":4,"N":6,"ev":"results/learn/mlp2.json"} | {"K":4,"N":6,"ev":"results/learn/mlp1.json"} | 832 | 48.2 | 44.8–51.6 |
