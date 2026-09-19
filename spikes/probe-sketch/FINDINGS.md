# Probe sketch: findings

2026-09-18. A first check of SPEC.md section 20 against real data: are the improvement loops' signals in the logs, can a logged decision become a probe, and what does a paired probe look like. 16 live calls, 33,587 input tokens, about $0.0014. Everything under `results/scripts/` is throwaway: it was run once from a scratch directory, is not linted or typechecked, and is kept only so the numbers can be traced.

## A logged decision cannot become a probe today

- A `decision` entry holds `requestId`, `sliceHash` and the answers. It holds neither the slice state nor the wire questions, though section 13 says questions are logged. Parse stimuli log `data: {}`.
- Replaying the log is not enough. `Game.resume` rebuilds the world from effects, which does not rebuild `hears`, `extra` or the option sets.
- What works is re-driving the inputs through `Game.turn` with a judge that answers by `requestId`, and tapping each request (`recover.ts`). The demo nights recover fully: 41 requests, no misses, because `demo/recordings.json` is kept in step with the code.
- The one real night does not recover. `saves/night.jsonl` has 51 decisions and misses at its second input, because the code moved on after it was played.
- Three parse decisions in that night have no `input` entry carrying their text. One reads as `tell` to Odo at 0.94.
- `playtests/inbox/` is empty, so one real night is all there is.

So a probe made from play needs the request captured when it is asked: the state and the wire questions, or at the least the parse text with a content and code version.

## Signals, over 92 decisions (one real night and the demo)

No decision fell back, came from cache or was dropped.

| Signal | Count |
| --- | --- |
| `none_of_these` wins on `verb` | 9 of 26 |
| on `states` | 24 of 26 |
| on `asks_about` | 26 of 26 |
| on `reply` | 5 of 12 |
| on `opens` | 3 of 8 |
| on `raises` | 3 of 9 |
| on `interject` | 2 of 10 |
| Top two within 0.15 on `raises` | 5 of 9 |
| on `reply` | 4 of 12 |
| on `interject` | 3 of 10 |
| on `respond` | 2 of 3 |
| Noul between 0.35 and 0.65 on `believes` | 4 of 13, all about 0.62 |
| on the guard and culprit Nouls | 4 of 8 |

- `none` on `states` and `asks_about` is almost all the speculative branch that code never reads. Ungated, that signal is about 95% noise. It must be read only when the verb makes that branch the live one.
- A real content hole, once gated: "ask mara where did they hear that" gave `asks_about` none 0.50 against `about:mara` 0.35. Where a tale came from is not something the world lets anyone ask about.
- Unparsed inputs: "think" (verb none 0.85), "summon god" (0.55), "turn around" (0.96).
- A close call that is a story coin flip and not a snag: "punch odo in the face" gave `raises` ask 0.47 against accuse 0.47.
- Live paraphrase difference on the guard is small: 0.03 and 0.00 on the guard, 0.05 and 0.03 on the culprit.
- `asks_about` offers 21 options, a long list by section 14's own rule.

## The probe type

`results/scripts/probe-type.ts`. A paired probe is a recipe for the base request, one edit, and what should move.

- **Recipe.** Rebuilding beats storing: `play` names a seed, the inputs, and the judge's scripted answers on the way there. A stored state goes stale when a renderer changes, which is the change a representation probe has to survive. `captured` is for requests taken from a real night.
- **Edit.** Two kinds, and the harness needs both. A world edit (`effects`, `learn`) goes through the game's own write path, so every renderer reacts as in play; it moves several fields and the option set at once. A representation edit (`drop_path`, `drop_line`, `renderer`) keeps the world and changes the slice; it attributes an effect to one field.
- **Expect.** The mass on a pattern over option ids, not on one id, because an edit renames options: the debt twin turns `confide:c_ef9a…` into `tell:c_ef9a…`. A direction, a minimum size above the repeat-noise floor, and whether it must hold in both wordings.
- **Score.** Whether it was met, the signed shift per wording, paraphrase distance, repeat noise, tokens for base and twin.
- `drop_line` needs a map from slice line to claim id out of `compileSlice`. Slice lines carry no provenance today, so ablating a captured slice means matching substrings.

## Three probes, run live

**A. Tobin is asked what he saw** (mass on telling `c_ef9aa3b936`)

| Request | Wording 0 | Wording 1 |
| --- | --- | --- |
| Base | 0.05 | 0.04 |
| World edit: he learns the debt was paid | 0.34 | 0.37 |
| The `owing()` circumstance line alone dropped | 0.04 | 0.05 |

The comment on `owing()` in `packages/inn/src/slices.ts` is not reproduced: dropping that one line moves nothing. All of the movement comes with the world edit, through the feeling words, the new `knows` line and the renamed option. One confound: the debt is still stated in the ablated slice, as the `knows` line "Tobin owes Odo a season's wages", so the circumstance line may simply be redundant there.

**B. Parse with `scene.people`, `scene.things` and `scene.exits` dropped** (four demo parses)

- Saves 260 to 360 tokens, 8 to 10%. No top choice flips. Repeat noise is 0.00 to 0.02 but for one `request` at 0.09.
- `target` loses 0.12 to 0.30 to `none_of_these` every time, because the instruction still says "which entry in `scene`" and Jev reads that literally. "attack mara" falls from 0.98 to 0.70, under the 0.80 bar for violence.
- So the dedupe is unsafe unless the instruction is reworded with it. The larger cost is elsewhere: the verb criteria are about 1,020 tokens, and the `UNTRUSTED` sentence is sent seven times per parse.

**C. The guard on the real "show apron to mara" slice, apron lines removed**

| Question | With | Without | Repeat noise |
| --- | --- | --- | --- |
| Culprit | 0.56 and 0.61 | 0.06 and 0.07 | 0.00 |
| Guard | 0.30 and 0.33 | 0.21 and 0.26 | about 0.06 |

The proof line carries the culprit question, as it should.

## What this changes

1. Requests are captured when asked, or play cannot feed the probe set.
2. `none` signals are gated on the branch code actually read.
3. The probe set starts from `spikes/m2-families` (handwritten states, absolute expectations) and the demo recipes, not from saved nights.
4. `compileSlice` should say which claim each line came from.
5. A comment that records a probe's finding is a claim that can go stale. The `owing()` one is the first the harness failed to reproduce.
