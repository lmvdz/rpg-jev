# rpg-jev

`SPEC.md` is the source of truth. Read the relevant section before designing or building anything, and update it when a decision changes. A living copy exists as a Claude Doc (link at the top of `SPEC.md`); keep the two in sync.

## Rules that are easy to break

The ten constitutional rules in `SPEC.md` section 2 bind every change. The ones most often at risk:

- Only code writes world state. Generative models propose, Jev ratifies.
- Every number lives in code. Jev judges meaning, never arithmetic, counts or dates.
- Jev chooses only among closed, code-built option sets that include a "none" option.
- Effect kinds are code. Generative models only fill templates built from existing kinds.
- Player text and generated text are untrusted: one labeled state field, never in instructions or criteria.
- Decisions are logged and replayed, never re-inferred.
- Unobserved time is code. No Jev calls for regions nobody is in.

## Working with Jev

Use the `typesafe:typesafe-ai` skill for any Jev work and read the live docs at https://docs.typesafe.ai (append `.md` to a page path). Pin `jev-1.13.0`. New question families need criteria, `not_for`, examples and a paraphrase test, and M2 is frozen at the eight families in `SPEC.md` section 14.

## Order of work

Spikes M0 and S0 come first. Do not start the village, the author thread or renderer steps beyond R2 until both have numbers.

## Commands

- `pnpm check`: lint, typecheck and tests. Run it before calling work done.
- `pnpm format`: apply Biome fixes.

## Conventions

- TypeScript strict, erasable syntax only (no enums, namespaces or parameter properties), `.ts` extensions in relative imports.
- `packages/core` stays pure: no I/O, no clock, no `Math.random`. Randomness comes from `Rng`.
- Add a package only when its milestone starts.
- The lint is strict on purpose and `pnpm check` fails on it: no function over 25 cognitive complexity or 120 lines, no nested ternaries, no `any`, no non-null assertions, nothing unused. A `switch` over kinds that grows with every kind is the shape to replace with a table of handlers. Do not add `biome-ignore`; restructure. Read `.claude/skills/world-design/SKILL.md` before changing how the inn behaves: engine code must not gain character names (a test ratchets the count), and coverage tests in `packages/inn/test/coverage.test.ts` require every verb, thing, deed, voice and activity to be complete.
- Never write keys into the repo. `.env` is git-ignored and holds `TYPESAFE_API_KEY`.
- Do not use an Anthropic API key. Generative calls go through the Claude CLI on the subscription login.
