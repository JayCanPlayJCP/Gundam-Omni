## Islands (heuristic GA -> K2N2 check, 100 games/list -> pure search GA)

| unit | heuristic B | K2N2 check B | check worst | pure-search elite B (n/list) |
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
| GW | — | — | —  | — |
| PR | — | — | —  | — |
| WP | — | — | —  | — |
| MW | — | — | —  | — |
| MP | — | — | —  | — |

## Final validations (both sides searching; field = 26 lists)

| deck | judge | games/list | field mean | Metric A | worst | first | second |
|---|---|---|---|---|---|---|---|
| GB_GA2 | k4n6 | 200 | 56.3 | 57.6 | 36.0 W_MEX_GPZeon | 71.2 | 41.4 |
| GB_GA2 | mlp2 | 200 | 58.7 | 60.1 | 36.5 J_CharIBO | 72.6 | 44.9 |
| GB_S2_e1 | k4n6 | 200 | 60.6 | 61.7 | 37.5 J_CharIBO | 73.1 | 48.1 |
| GB_S2_e1 | mlp2 | 200 | 59.8 | 60.9 | 31.5 J_CharIBO | 73.5 | 46.0 |
| GR_GA1 | k4n6 | 200 | 50.4 | 51.2 | 34.5 W_MKE_ZGok | 67.6 | 33.2 |
| GR_GA1 | mlp2 | 200 | 49.9 | 50.8 | 29.5 J_CharIBO | 67.6 | 32.2 |
| OMNI_GB | k4n6 | 200 | 56.2 | 57.2 | 35.0 J_CharIBO | 69.7 | 42.7 |
| OMNI_GB | mlp2 | 200 | 58.9 | 59.9 | 36.5 W_MEX_GPZeon | 71.9 | 46.0 |
| OMNI_GR | k4n6 | 200 | 56.4 | 56.9 | 45.5 W_BRIS_RWAcademy | 71.8 | 41.0 |
| OMNI_GR | mlp2 | 200 | 56.1 | 56.3 | 37.5 W_BRIS_RWAcademy | 71.8 | 40.3 |
| PURE_GB_e1 | k4n6 | 200 | 59.2 | 60.6 | 35.5 J_CharIBO | 72.5 | 45.9 |
| PURE_GB_e1 | mlp2 | 200 | 61.1 | 62.6 | 39.5 W_MEL_SFVictory | 74.0 | 48.3 |

## Judge mirrors

| test | X | Y | games | X score | 95% CI |
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
| smoke_mcts | {"mcts":true,"I":24} | {"K":3,"N":3} | 4 | 50.0 | 15.0–85.0 |

## Card census highlights (3 copies swapped into the chassis's 3 weakest slots, fast AI, 40 games/list)

- **GB** (chassis GB_GA2, base 66.0): Gustav Karl Type-00 (ST08-008) +3.9; How Many Miles to the Battlefield? (GD03-108) +3.6; ReZEL (GD01-018) +3.3; Gundam Ez8 High Mobility Custom (EB01-032) +3.3; ZnO (ST11-004) +2.8; Oggo (EB01-031) +2.7; GM Custom (GD06-009) +2.7; GM Type C (GD06-014) +2.5; Re-GZ BWS (GD05-023) +2.4; GFreD (ST13-005) +2.1
- **GR** (chassis GR_GA1, base 59.6): Gundam Exia (GD04-038) +0.6; Re-GZ (GD05-019) -0.6; Gundam Throne Zwei (ST13-008) -3.2; Gundam Ez8 High Mobility Custom (EB01-032) -3.2; Messer Type-F02 Minelayer (ST08-005) -3.2; Battle of Aces (GD01-111) -3.7; Close Combat (ST03-013) -4.3; Kayra's Jegan (GD05-028) -4.6; Improved Technique (GD03-109) -4.6; Re-GZ (GD06-025) -4.6
- **BR** (chassis W_MEL_SFVictory, base 35.4): Forbidden Gundam (GD02-006) +5.9; ZnO (ST11-004) +5.1; ReZEL (GD01-018) +5.1; Gundam Throne Zwei (ST13-008) +5.1; Messer Type-F02 Minelayer (ST08-005) +5.1; Gustav Karl Type-00 (ST08-008) +4.8; Byarlant Custom (GD01-019) +4.4; Dragon Gundam (GD05-035) +4.3; Gun Blaster (GD05-009) +3.8; Kira's Strike Rouge (GD05-010) +3.7
- **GP** (chassis W_MEX_GPZeon, base 61.9): Zaku Ⅱ F2 (GD06-060) +1.8; Kapool (ST11-009) +1.6; Genoace (GD02-030) +1.3; Jenice Custom (GD02-065) +1.3; Galluss J (GD06-023) +1.3; Gundam Barbatos 5th Form (Ground Type) (GD03-066) +1.0; Gouf (GD01-036) +0.6; Heindree (GD04-031) +0.6; Zssan (GD06-031) +0.6; Maganac (ST02-005) +0.6
- **BP** (chassis W_MKE_ZGok, base 62.1): Nahel Argama (GD01-123) +4.7; Fatal Strike (ST05-014) +4.5; Byarlant Custom (GD01-019) +4.4; Exclusively Defense-Oriented Policy (GD05-105) +4.1; Pisces (GD01-021) +4.0; Jenice Custom (GD02-065) +4.0; Zaku Ⅱ F2 (EFSF) (GD06-013) +4.0; Armory One (GD04-128) +3.9; White Base (ST01-015) +3.9; GM Type C (GD06-014) +3.7
- **BW** (chassis W_TOR_SF, base 53.6): GM (ST01-005) +2.8; Demi Garrison (GD01-085) +2.8; Hizack (GD02-013) +2.8; Nemo (GD02-080) +2.8; Borjarnon (GD04-078) +2.8; Javelin (GD05-014) +2.8; Leo (GD05-077) +2.8; Graze (ST05-009) +2.8; Nemo (ST10-005) +2.8; Royal Gundam (GD05-075) +2.5
- **RW** (chassis W_BRIS_RWAcademy, base 56.8): Altron Gundam (EW) (GD06-064) +4.5; Gaplant TR-5 "Hrairoo" Unit 1 (EB01-054) +3.7; Cannon Illfuto (GD06-077) +3.7; Domon Kasshu (GD05-097) +2.8; Gundam Throne Zwei (ST13-008) +2.7; Gundam Geminass 01 (EB01-056) +2.7; Serpent (GD06-075) +2.7; Messer Type-F02 Minelayer (ST08-005) +2.7; Zaku Mariner (GD01-060) +2.5; Demi Garrison (GD01-085) +2.5
