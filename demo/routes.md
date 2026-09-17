# Quest routes across seeds

Live `jev-1.13.0`, seeds 1 to 5. "Guard" is the lower of the guard's two wordings each time it was asked; it opens when both reach 0.65. Nothing in the engine knows these routes exist.

| Route | Cleared or resolved | Outcomes | Highest guard value per run |
| --- | --- | --- | --- |
| evidence | 4 of 5 | suspected, cleared, resolved, cleared, cleared | 0.57, 0.69, 0.65, 0.69, 0.67 |
| witness | 5 of 5 | resolved, resolved, resolved, resolved, resolved | 0.92, 0.92, 0.92, 0.92, 0.92 |
| expose | 4 of 5 | cleared, cleared, suspected, cleared, cleared | 0.87, 0.85, 0.50, 0.85, 0.90 |
| bare_return | 0 of 5 | suspected, suspected, suspected, suspected, suspected | 0.57, 0.47, 0.58, 0.58, 0.49 |
| denial | 0 of 5 | suspected, suspected, suspected, suspected, suspected | not asked, not asked, not asked, not asked, not asked |
| threat | 0 of 5 | suspected, suspected, suspected, suspected, suspected | not asked, not asked, not asked, not asked, not asked |

30 runs, 423 judge calls, $0.0222.
