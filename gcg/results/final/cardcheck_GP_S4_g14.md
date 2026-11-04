# Hand card-check: GP_S4_g14 (Green/Purple finalist)

Checked each card's implementation (`node tools/cardcheck.js GP_S4_g14 --src`) against its cards.json text.

| card | text (short) | implementation | verdict |
|---|---|---|---|
| GD01-026 Char's Zaku II x4 | During Pair + Destroyed: rested Char's Zaku II token (AP3 HP1) | destroyed(g,u,pilot): token only if it was paired | ok |
| GD01-030 Rick Dom x4 | Breach 2 | static kw | ok |
| GD01-035 Zaku II x4 | vanilla 2/2 (the deck's only vanilla 2/2 number) | `{}` | ok |
| GD02-054 Gundam Barbatos 1st Form x4 | Attack: if damaged, draw 1 | attack: u.dmg > 0 -> draw | ok |
| GD03-056 Gundam Barbatos Adapt x4 | Deploy: 1 damage to one of your Units and one enemy Unit | ownAndEnemyPing | ok |
| GD05-050 Gundam Exia Repair x3 | battle damage to enemy Lv<=4 with no paired Pilot destroys it; Destroyed: mill 2 | battleDestroyRule + destroyed mill 2 | ok |
| GD06-109 God of War Ghingnham x1 | Main: rested Turn X (Arms) 2/3 or (Legs) 3/2 token | cmd main, picks Arms vs AP>=3 boards | ok |
| ST03-006 Char's Zaku II x3 | Destroyed: top 3, take a Zeon/Neo Zeon Unit | lookTop(3, Zeon/Neo Zeon unit) | ok |
| ST03-007 Zaku I x2 | vanilla 1/2 | `{}` | ok |
| ST03-008 Zaku II x4 | Attack: AP+2 this turn | attack tAP += 2 | ok |
| ST03-011 Char Aznable x4 (pilot) | Burst to hand; Attack: AP+1, if Link Unit gains High-Maneuver | p_attack | ok |
| ST03-016 Falmel x4 (base) | Burst deploy; Deploy: shield to hand, your turn -> rested Char's Zaku II token | baseShield + token | ok |
| ST05-010 Mikazuki Augus x4 (pilot) | Burst to hand; When Paired: 1 damage to one of your Units and one enemy Unit | p_whenPaired ownAndEnemyPing | ok |
| ST11-009 Kapool x2 | Destroyed: opponent's turn and a friendly Marine Unit in play -> draw 1 | destroyed runs after the Unit left play, so it needs another Marine | ok |
| ST12-008 Efreet Schneid x3 | vanilla 4/3 | auto | ok |

Legality: 50 cards, Green/Purple, max 4 copies, no GD01-020, ST02-016 absent, ST05-010 present without ST01-010,
GD01-008/GD05-015 absent, one vanilla 2/2 number (GD01-035). ExBurst: `node export.js GP_S4_g14`.

## OMNIP_GP_e1 (final pick; 92% the same cards as GP_S4_g14)

Same card numbers as GP_S4_g14 except: Exia Repair 3 -> 4, Zaku I 2 -> 4, + 1 GD06-031 Zssan, and no Efreet Schneid / God of War Ghingnham.

| card | text | implementation | verdict |
|---|---|---|---|
| GD06-031 Zssan x1 | vanilla 3/2 (Lv2, cost 2, Ghingnham Fleet) | `{}` | ok (not a 2/2, so it does not count against the one-vanilla-2/2 rule) |

All other cards are checked above. Legality: 50 cards, Green/Purple, max 4 copies, ST05-010 without ST01-010, one vanilla 2/2 number (GD01-035).
