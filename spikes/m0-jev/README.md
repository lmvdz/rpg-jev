# Spike M0: does Jev judge social fiction like people do?

Not started. The full brief is in [SPEC.md](../../SPEC.md), section 15.

About 25 handwritten inn scenarios, run against live Jev (`jev-1.13.0`), covering intent parsing, a semantic quest guard and NPC reaction choice.

| # | Test | Passes when |
| --- | --- | --- |
| 1 | Disagreement | Contested scenarios give spread distributions; obvious ones give concentrated ones. This one is existential. |
| 2 | Sensitivity | Changing one trait in state shifts the distribution in a sensible direction and size |
| 3 | Paraphrase stability | Rewording a question leaves the answer roughly unchanged |
| 4 | Knowledge isolation | In a batched scene, an NPC's answers ignore facts outside its `knows` path |

Also measured: the latency distribution, tokens per state slice, run-to-run variance.

Output: a results page with the distributions, a go or no-go per test, and first-draft thresholds.

Needs `TYPESAFE_API_KEY` in the environment.
