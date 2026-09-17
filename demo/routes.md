# Quest routes across seeds

Live `jev-1.13.0`, seeds 1 to 10, 2026-09-17. The quest opens when both wordings of either guard reach 0.65: Mara no longer believes it was the stranger, or she is satisfied it was Odo, which entails the first. In this run the "guard" column shows only the first guard (the lower of its two wordings, at its highest in the run). That is why the evidence route shows values under 0.65 beside "resolved": it opens through the second guard. The harness now reports the better of the two. Nothing in the engine knows these routes exist.

| Route | Cleared or resolved | Outcomes | Highest guard value per run | An NPC said a garbled claim to the player's face | Garbled claims Mara held at the end |
| --- | --- | --- | --- | --- | --- |
| evidence | 9 of 10 | resolved, resolved, resolved, resolved, resolved, resolved, resolved, resolved, suspected, resolved | 0.64, 0.59, 0.50, 0.63, 0.61, 0.67, 0.63, 0.63, not asked, 0.61 | 4 of 10 runs | 1, 0, 1, 0, 1, 1, 1, 1, 0, 0 |
| witness | 6 of 10 | resolved, suspected, suspected, resolved, resolved, resolved, resolved, suspected, resolved, suspected | 0.73, not asked, not asked, 0.92, 0.92, 0.68, 0.92, not asked, 0.93, not asked | 1 of 10 runs | 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 |
| expose | 10 of 10 | cleared, cleared, cleared, cleared, cleared, cleared, cleared, cleared, cleared, cleared | 0.89, 0.87, 0.85, 0.89, 0.86, 0.86, 0.82, 0.87, 0.85, 0.86 | 7 of 10 runs | 1, 2, 2, 1, 1, 2, 2, 1, 0, 0 |
| bare_return | 0 of 10 | suspected, suspected, suspected, suspected, suspected, suspected, suspected, suspected, suspected, suspected | 0.59, 0.58, 0.57, 0.48, 0.48, 0.50, 0.54, 0.48, 0.48, 0.44 | 5 of 10 runs | 1, 2, 2, 1, 1, 2, 2, 1, 0, 0 |
| denial | 0 of 10 | suspected, suspected, suspected, suspected, suspected, suspected, suspected, suspected, suspected, suspected | not asked, not asked, not asked, not asked, not asked, not asked, not asked, not asked, not asked, not asked | 0 of 10 runs | 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 |
| threat | 0 of 10 | suspected, suspected, suspected, suspected, suspected, suspected, suspected, suspected, suspected, suspected | not asked, not asked, not asked, not asked, not asked, not asked, not asked, not asked, not asked, not asked | 0 of 10 runs | 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 |

60 runs, 837 judge calls, $0.0437.
