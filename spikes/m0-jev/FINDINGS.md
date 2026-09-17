# Spike M0: findings

Two live runs against `jev-1.13.0` on 2026-09-17. Run two supersedes run one. The generated numbers are in [results/REPORT.md](results/REPORT.md) (run two) and [results/REPORT-run1.md](results/REPORT-run1.md). This page is the interpretation.

## Verdict after run two

Three of four tests pass. Test 1 misses two of its three bars narrowly. The spec already says what follows from a test 1 failure (persuasion by spread becomes a code-owned value), so M0 is settled enough to move on, with the design changes listed below.

| Test | Result | Numbers |
| --- | --- | --- |
| 1 Judges like the reference panel | NO-GO, narrowly | Distance 0.21 (bar 0.20). Spread correlation 0.57 (bar 0.60). Same top answer on clear-cut scenarios: 16 of 16 (bar 80%) |
| 2 Sensitivity | GO | 8 of 8 traits moved the answer as expected; 3 of 3 controls stayed flat |
| 3 Paraphrase | GO | Median 0.08, worst 0.09 |
| 4 Isolation | GO | Knowledge leak 0.00 in all 6 cases; worst context shift 0.14 |

Run two made 297 Jev calls with no failures, for $0.0085. Criteria version 2 was fixed in `src/criteria.ts` before the run and is copied into the run file.

## How the reference was built

Run one compared Jev with my own contested or obvious tags, and several of those tags were wrong. Run two has no human labels. A panel of four generative-model labellers (two Claude Opus samples, two Claude Sonnet samples, through the Claude CLI on the subscription login) was asked what distribution human judges would give for each of 27 scenarios. Each labeller saw exactly what Jev saw, ran with no tools in an empty directory, and never saw Jev's answers or my tags.

Limits of that reference:

- It is generative models standing in for people, not people. The labellers disagree with each other by 0.09 on average and by up to 0.23 on contested scenes, so a Jev distance of 0.21 is about twice the noise floor.
- The scenarios were written by a Claude model and labelled by Claude models. A shared bias would not show up.
- Language models tend to predict kinder behaviour than people show. Most of Jev's disagreements run the other way (see below), so part of the gap may be the reference, not Jev.

## What is now solid

- **Knowledge isolation holds.** Across six cases, including four whose unaffected answer sat between 0.28 and 0.53, a secret in another NPC's `knows` never moved the watched NPC toward what knowing it would cause. The knower's own answer was 0.90 to 1.00 every time, so the secrets were legible. A batched scene and the same NPC alone in the state differed by at most 0.03.
- **Scene batching is affordable.** Six NPCs and six questions in one call cost 1,716 input tokens and took 217 ms. That is about $0.00007 a scene.
- **Personality in state works**, both runs. "Greedy" moved `turn_him_in` from 0.47 to 0.77; "a hearth is sanctuary" moved `hide_him` from 0.31 to 0.85; irrelevant traits moved nothing by more than 0.06.
- **Wording is not fragile**, both runs.
- **When the answer is clear, Jev gets it.** On all 16 scenarios where the panel put 0.6 or more on one answer, Jev picked the same one, at distances of 0.02 to 0.13.
- **Intent parsing was 12 of 12 in both runs**, including the prompt-injection line.
- **Latency:** p50 163 ms, p90 218 ms, p99 462 ms. **Tokens:** mean 681 a call.
- **Jev is not deterministic.** Byte-identical requests differed by up to 0.04 (run one) and 0.02 (run two). Run-to-run std of a probability is about 0.011.

## Where Jev and the panel part ways

1. **On contested Choices, Jev is more decided than the panel.** Tobin and the rude merchant's purse: Jev `keep_it` 0.91, panel 0.50. A pilgrim's purse, owner still in the yard: Jev `keep_it` 0.80, panel `return_it` 0.49. Turning out a family for a better-paying guest: Jev accepts at 0.59, panel refuses at 0.57. In each, Jev leans toward material self-interest. This is the pattern that may be partly the panel's kindness bias.
2. **Feasibility.** Tobin with the owner watching: Jev `return_it` 0.47, panel 0.88. Restating the impossible option in code ("openly keeps it though the owner is watching") raised Jev to 0.60, against 0.90 from the panel. Pruning helps and does not close the gap.
3. **Ambiguous references go to "none", not to a split.** "Grab the key" with two keys: Jev `none_of_these` 0.67; the panel split 0.43 and 0.40 between the keys. Stable across both runs and all three phrasings.
4. **Spread tracks the panel only moderately** (rank correlation 0.57; Choices 0.56, Nouls 0.67).

## Design consequences

- **Persuasion by spread is demoted**, as section 15 of the spec planned for this outcome. Persuadability becomes a code-owned value built from drives. Jev's spread is one input to it, not the mechanism.
- **Do not power-sharpen before sampling.** I recommended this after run one, and run two says it is wrong. The 0.13 on an absurd option was one scenario; averaged over 27, absurd mass is 0.039. Every sharpening setting moved Jev further from the panel and flattened contested scenes (power 2 keeps only 57% of their spread). At most, drop options under 0.10 before sampling, which costs 0.01 of fit.
- **Feasibility stays with code**, and is not enough alone. Where a scene has a strong social constraint (being watched, being among friends), put it in the state as a stated fact the question points at, and test that family before relying on it.
- **Clarification trigger:** `none_of_these` wins the target while the verb is certain and the leftover mass sits on two or more things of one kind.
- **Quest guards look usable:** p(yes) 0.91 when satisfied, 0.20 to 0.25 when not yet, 0.06 when clearly not.
- **Lean on traits.** Because sensitivity is strong and reliable, the main lever for making an NPC less self-interested than Jev's default is an explicit trait, not a better question.

## What stays open

- Whether real people side with Jev or with the panel on the contested scenes. Only human labels can settle that, and we chose not to collect them.
- Jev's base rate on one isolation question is odd: a stablehand offered generous silver to groom a horse takes it at only 0.32. It did not leak knowledge, but it shifted by 0.14 with unrelated scene content. Questions that sit at an unexplained middling value are the ones to watch for context shift.
- Twenty-seven scenarios in one inn is a small sample. The catalog families not covered here (speech-act choice, distortion choice, accept offer) still need their own probes before M2 relies on them.
