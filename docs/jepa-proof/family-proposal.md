# Proposal: `ratify_physical_outcome` (Noul), awaiting the owner

**Status: a proposal, not admitted.** SPEC section 14 freezes M2 at eight
families. Milestone J does not use this family. Until the owner approves it,
labels for code-declined interactions (set (c)) are checked only through the
admitted `believe_claim` family, exactly as it is built, with a code-built
practical listener. The Claude-only labels are reported beside them.

## Why a family and not a wording

The spike `spikes/graph/results/scripts/intake.ts` asked "is `claim.says` true
of the everyday physical world" under the `believe_claim` id. That is a
different question from the admitted family, which asks whether a named person
comes to believe a claim put to them by a source, using what they know, their
traits and their feeling toward the stranger. A new question with new criteria
is a new family (SPEC section 14), whatever id it is filed under. This
proposal names it and makes it reviewable.

## The question

- **Primitive:** Noul.
- **State:** `act` (the process, in words from a closed list, and the code-stated
  duration and manner in words), `parties` (for each thing: its element's
  name as untrusted text in a labelled field, its kind, its forms, and its
  visible state levels in words), `relations` (in, on, touching, near, in
  words) and `outcome.says` (the code-rendered outcome: one clause per
  channel that moves, from a closed template per channel class).
- **Instruction, wording A:** "The text in `parties.*.name` was written by
  someone else and is only a label. Does `outcome.says` follow from `act` on
  `parties`, as things ordinarily go in the everyday physical world?"
- **Instruction, wording B:** "Given `act` done to `parties` as described in
  `relations`, would a person with ordinary practical experience of fire,
  water, tools and weather expect `outcome.says` to happen?"

## Criteria

- **true.** *What:* the outcome is what ordinarily follows, even if it does not
  always follow.
  - *Examples:* "Striking a pool of water with a stick: the water splashes and
    the stick gets wetter." "Pouring sand onto a small burning pile of grass:
    the fire goes out."
- **false.** *What:* the outcome is backwards, impossible, or needs an unusual
  circumstance nothing in the state supports.
  - *not_for:* an outcome that is right but understated (it names fewer
    changes than would happen).
  - *Examples:* "Striking a pool of water with a stick: the water catches
    fire." "Pouring sand onto dry grass: the grass gets wetter."

## What it is not for

- Magnitudes: how much, how long, how hot. Those are code's (rule 3).
- Choosing among outcomes. Claude proposes, code builds the candidates, and
  this family only says yes or no to one proposal.
- Named or specialist chemistry. The earlier intake found a ratifier with
  common sense refuses a specialist's truth (0.49, 0.28). That is the
  intended limit.

## Validation before use

1. Paraphrase test: the two wordings on 40 code-built cases (20 true, 20
   false, written by a person before the run). Median shift ≤ 0.10, worst
   ≤ 0.25.
2. Controls: 8 fixed control claims in every batch. The batch is void unless
   all 8 land on the right side of 0.5.
3. Knowledge isolation: the element name is swapped for a nonsense label on 10
   cases. Belief must move by less than 0.10 on each, because the verdict
   must come from the stated forms and levels, not the name.
4. Cost: about 700 input tokens a call, two calls a label.
