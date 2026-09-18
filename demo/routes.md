# Quest routes across seeds

Live `jev-1.13.0`, seeds 1 to 10. The quest opens when both wordings of either guard reach 0.65: Mara no longer believes it was the stranger, or she is satisfied it was Odo, which entails the first. "Guard" is the better of the two each time they were asked. Nothing in the engine knows these routes exist.

| Route | Cleared or resolved | Outcomes | Highest guard value per run | An NPC said a garbled claim to the player's face | Garbled claims Mara held at the end |
| --- | --- | --- | --- | --- | --- |
| evidence | 9 of 10 | resolved, resolved, resolved, resolved, resolved, resolved, resolved, resolved, suspected, resolved | 0.70, 0.68, 0.65, 0.72, 0.70, 0.70, 0.69, 0.68, not asked, 0.68 | 3 of 10 runs | 1, 0, 1, 0, 1, 1, 1, 1, 0, 0 |
| witness | 6 of 10 | resolved, suspected, suspected, resolved, resolved, resolved, resolved, suspected, resolved, suspected | 0.69, not asked, not asked, 0.91, 0.92, 0.70, 0.92, not asked, 0.91, not asked | 1 of 10 runs | 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 |
| expose | 10 of 10 | cleared, cleared, cleared, cleared, cleared, cleared, cleared, cleared, cleared, cleared | 0.85, 0.86, 0.86, 0.86, 0.87, 0.86, 0.85, 0.85, 0.82, 0.87 | 7 of 10 runs | 1, 1, 2, 1, 1, 2, 2, 1, 0, 0 |
| bare_return | 0 of 10 | suspected, suspected, suspected, suspected, suspected, suspected, suspected, suspected, suspected, suspected | 0.49, 0.59, 0.60, 0.53, 0.49, 0.48, 0.59, 0.57, 0.44, 0.47 | 4 of 10 runs | 1, 1, 2, 1, 1, 2, 2, 1, 0, 0 |
| denial | 0 of 10 | suspected, suspected, suspected, suspected, suspected, suspected, suspected, suspected, suspected, suspected | not asked, not asked, not asked, not asked, not asked, not asked, not asked, not asked, not asked, not asked | 0 of 10 runs | 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 |
| threat | 0 of 10 | suspected, suspected, suspected, suspected, suspected, suspected, suspected, suspected, suspected, suspected | not asked, not asked, not asked, not asked, not asked, not asked, not asked, not asked, not asked, not asked | 0 of 10 runs | 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 |

60 runs, 847 judge calls, $0.0457.
