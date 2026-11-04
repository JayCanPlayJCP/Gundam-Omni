# Hand card-check: GB_S2_e1 (current best; Green/Blue core shared by all G/B finalists)

Checked each card's implementation (`node tools/cardcheck.js GB_S2_e1 --src`) against its cards.json text.

| card | text (short) | implementation | verdict |
|---|---|---|---|
| EB01-032 Gundam Ez8 HMC | vanilla 4/3 Lv3 cost 2 | `{}` | ok |
| GD01-008 Guntank | Deploy: 1 damage to a rested enemy Unit | dmgPick(1, rested) | ok |
| GD01-013 Gundam | vanilla 3/4 | auto | ok |
| GD01-019 Byarlant Custom | gains Blocker while 4+ enemy Units | compiler e.kw on enemy count; skw has no static Blocker | ok (tested: 0 enemies -> no Blocker, 4 -> Blocker) |
| GD01-030 Rick Dom | Breach 2 | static kw | ok |
| GD05-017 Nu Gundam | Breach 5; When Paired: exile 3 Londo Bell from trash -> damage-step-only battle | whenPaired + damageOnlyBattle (sets lastBreach) | ok; AI always takes the optional exile when a target exists |
| GD05-019 Re-GZ | Destroyed: top 3, take a Londo Bell Unit | lookTop(3, LB unit) | ok |
| GD05-027 Jegan | vanilla 2/2 (the deck's only vanilla 2/2 number) | `{}` | ok |
| GD05-029 Kayra's Re-GZ | Deploy: look at top, top or bottom | lookOneTopOrBottom | ok |
| GD05-085 Amuro Ray (pilot) | Burst to hand; your turn, battle kill -> recover 2 HP | p_onBattleKill + yourTurn | ok |
| GD05-105 Exclusively Defense-Oriented Policy | Burst = Main; Main/Action bounce enemy Lv<=3 | bouncePick(lv<=3), actionToo | ok |
| GD06-025 Re-GZ | vanilla 3/4 | auto | ok |
| ST01-001 Gundam | Repair 2; During Pair: your turn, all your Units AP+1 | aura_ap (others, o !== u) + ap (self) | ok (no double count) |
| ST01-010 Amuro Ray (pilot) | Burst to hand; When Paired: rest enemy with <=5 HP | restPick(hpLeft <= 5) | ok |
| ST03-007 Zaku I | vanilla 1/2 | `{}` | ok |
| ST03-008 Zaku II | Attack: AP+2 this turn | attack tAP += 2 | ok |
| ST03-016 Falmel (base) | Burst deploy; Deploy: shield to hand, your turn -> rested Char's Zaku II token | baseShield (engine deployBase) + token | ok |

Legality: 50 cards, Green/Blue, max 4 copies, no GD01-020, no ST05-010 (with ST01-010) and no GD05-015 (with GD01-008), one vanilla 2/2 number (GD05-027).
