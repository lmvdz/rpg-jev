# Spike M0: does Jev judge social fiction like people do?

Two live runs on 2026-09-17. After run two, three tests pass and test 1 misses narrowly. Read [FINDINGS.md](FINDINGS.md) for the interpretation and [results/REPORT.md](results/REPORT.md) for the numbers. The full brief is in [SPEC.md](../../SPEC.md), section 15.

```sh
pnpm dry      # list what would run; no network
pnpm smoke    # one live call
pnpm label    # build the reference: 108 Claude CLI calls on the subscription login
pnpm spike    # all 297 Jev calls, about $0.009
pnpm report   # rebuild results/REPORT.md from the newest run
```

About 25 handwritten inn scenarios, run against live Jev (`jev-1.13.0`), covering intent parsing, a semantic quest guard and NPC reaction choice.

| # | Test | Passes when |
| --- | --- | --- |
| 1 | Judges like the reference | Jev's distributions match a panel of generative-model labellers that saw the same scenarios, blind to Jev |
| 2 | Sensitivity | Changing one trait in state shifts the distribution in a sensible direction and size |
| 3 | Paraphrase stability | Rewording a question leaves the answer roughly unchanged |
| 4 | Knowledge isolation | In a batched scene, an NPC's answers ignore facts outside its `knows` path |

Also measured: the latency distribution, tokens per state slice, run-to-run variance.

Output: a results page with the distributions, a go or no-go per test, and first-draft thresholds.

Needs `TYPESAFE_API_KEY` in the environment.
