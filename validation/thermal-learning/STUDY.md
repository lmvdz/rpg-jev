# First participant check: evidence before expansion

Status: executable protocol, **no participant results yet**. Do not substitute
the scripted tests, an assistant walkthrough or a `transfer` label for learning.
Read the engineering report separately; do not give its hidden values or worked
predictions to a participant.

Superseded as the immediate next task: [automate mechanism validation, then select
an in-world interaction](AUTOMATION.md). This protocol remains historical optional
research tooling, not a request that players enumerate the bench's possibilities.

## Goal and setup

First determine whether a newcomer can inspect the fixture, formulate an
expectation, test it and explain what the readings do or do not establish,
without a facilitator choosing the successful arrangement.

Use already-provisioned dependencies; no installation or live model call is part
of the study. Launch from the repository root:

```sh
node packages/terminal/src/play.ts --bench --provenance=participant
```

The equivalent normal package command is `pnpm play --bench --provenance=participant`.
Do not invoke a package-manager bootstrap in an unprovisioned checkout without
authorization. The default world resumes rather than resets. For a separately
recorded test fixture, use an explicit unused `--save=<path>`; this is a new test
session, not a respawn mechanic. Record any facilitator help outside the normal
interface and identify it in the participant's note.

An unprovisioned agent checkout can instead use an explicitly selected existing
checkout's core dependency read-only, without installing or linking anything:

```sh
node validation/thermal-learning/run.mjs --dependency-root=<existing-provisioned-checkout> --provenance=participant
```

The launcher resolves only zod from that checkout; all application code still
comes from this worktree. A missing dependency is an error, not a download.
The tested machine's existing dependency root was `H:/rpg-jev`.

The introduction supplies apparatus/operating facts. Treat those facts as given
instruction, not as discoveries. It does not reveal starting temperatures,
conductivities, capacities, successful layouts, or a graded answer.

## Participant sequence

1. **Prior familiarity:** use `prior <statement> | <reason>` before experimenting.
   Say what you already expect from similar real-world experience, what the
   orientation told you, and whether you have seen this setup or report before.
2. **Notice:** use `look`, `help`, `dock` and `read`. Ask the participant to describe
   the visible arrangement and what a recorded probe reading refers to.
3. **Predict:** before the next intervention, use `predict <expectation> | <reason>`.
   Include an expected contrast and an alternative explanation if one is plausible.
   “I don't know” is permitted; an absent reason is retained as unstated.
4. **Intervene and observe:** let the participant choose among admitted controls.
   Use `read` explicitly; `look` and `history` never secretly take a new reading.
   Ask which observations support the explanation and what remains inconclusive.
5. **Revise or retain:** use `revise <account> | <reason>`. A changed explanation
   is not required, and the software does not grade the statement as true.
6. **Transfer:** before a new arrangement, use `transfer <prediction> | <reason>`.
   Ask the participant to use their observations to select a layout they have
   not tested, with a changed goal—for example preserving a measured difference
   rather than producing a change. Do not prescribe the layout or material.
   Record why it is unfamiliar to this person; the phase label cannot prove that.
7. **Follow through:** test that prediction and record the resulting interpretation.
   If the finite world no longer provides a useful contrast, record “inconclusive”
   and stop. Do not secretly reset, reheat, reveal truth or tune the mechanism.

The journal snapshots available evidence and arrangement at note time. Only the
last 32 acquired readings are included per note, with omission counts; retain
the full trusted save for audit. A note may be retrospective despite its label:
check its actual order against interventions. `retry` repeats the original request;
issuing a fresh `wait` is another physical minute.

## What would count, and what would not

- **Usable surface evidence:** controls understood without syntax coaching;
  historical probe readings not confused with current target truth; notes and
  observations remain attributable across save/reload.
- **Candidate learning evidence:** an initially discriminating or mistaken
  explanation changes in response to identified observations; a reasoned
  prediction is recorded before an unfamiliar intervention; the same relationship
  explains the contrast without a supplied recipe.
- **Prior knowledge:** a correct explanation already present in the first note.
  Useful play, but not newly learned here.
- **Copying/instruction:** facilitator/report/script supplied the explanation or
  arrangement. Report that influence; do not count it as self-directed transfer.
- **Lucky success:** an outcome happens to match without a prospective reason or
  discriminating comparison. Not sufficient learning evidence.
- **Inconclusive:** insufficient contrast, sensor ambiguity, unsupported mechanism,
  missing prospective record, or no evidence that the arrangement was unfamiliar.

No single trial establishes general efficacy or fun. Stop expansion if a newcomer
cannot obtain a useful contrast, needs hidden diagnostics, or relies on an
unexplained manipulation trick. First revise the apparatus explanation, evidence
granularity or admission—not the participant's record or numerical tolerances.
