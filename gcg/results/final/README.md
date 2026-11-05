# Operation Omni: final results

- **REPORT.md**: the full report (verdict, win rates under every judge, decklist, per-matchup table, play guide for the five
  hardest matchups, counter-decks, convergence, islands, census, judges, caveats). Rebuild it with
  `node collate.js && node convtable.js GP_S4_g14 && node report.js GP_S4_g14 <reference decks>`.
- **report.html**: the same report as a page with the per-matchup chart (published privately as a claude.ai artifact).
- **FINALIST_GP_S4_g14_exburst.txt**: the finalist's ExBurst paste block (`node export.js GP_S4_g14`).
- **notes.md**: hand-written verdict, play-guide and caveat text that report.js splices in.
- **cardcheck_*.md**: hand checks of every finalist card against cards.json.
- `<deck>_<judge>_<games per list>.json`: strong-judge validations (searchcheck.js, both sides searching, 26 field lists).
  Judges: k4n6 (seed 9393000), k4n6s2 (9494000), k4n6s3 (9595000), mlp2 (K4N6 + learned evaluator), k3n3, k2n2,
  fast (heuristic AI, 1000/list).
- `matchup_<deck>.json`: matchup.js analyses behind the play guide.

Verdict in one line: no deck reaches 75% against every tournament-winning list. The finalist GP_S4_g14 (Green/Purple
Zeon + IBO aggro) scores 64.8% field mean over 600 games/list with K4N6 search on both sides, worst list 45.5%.
