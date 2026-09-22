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

M2 is the real gate: if it is not fun, live generation will not fix it (`SPEC.md` section 16). M0 and S0 both have numbers.

## Commands

- `pnpm check`: lint, typecheck and tests. Run it before calling work done.
- `pnpm format`: apply Biome fixes.

## Git hygiene: sync, commit and push

- Start each task by checking the branch, worktree status and configured remotes, then fetching the source remote. Bring the task branch up to date with its upstream and intended integration base before building on it. Do not assume `main` is the active integration branch; do not publish to Delta's `local` backlink.
- Finish every task with its changes verified, committed in logical groups and pushed to the intended source branch. CAP means **Commit and Push**, not just commit. This is part of completing the task, not an optional follow-up.
- Use one concern per commit, dependencies first. Separate unrelated fixes, features, refactors and documentation; stage explicit paths or hunks instead of blindly staging everything. Use `<emoji> type(scope): subject`, with a lowercase imperative subject and no trailing period (for example, `🐛 fix(inn): recognize turn-around commands`). Do not add generated-by or AI co-author footers.
- Run `pnpm check` on the final combined changes before publishing. Fetch again before pushing; if the base moved, integrate safely and rerun verification. Verify afterward that the intended remote branch contains the commits and that the task worktree is clean. Report the branch, commit IDs, checks and any remaining divergence.
- Never achieve a clean tree by discarding, overwriting or blindly committing someone else's work. Preserve unrelated edits, unfinished experiments, ignored local records and unpublished commits in other worktrees. Never commit secrets, bypass a failing gate, force-push or rewrite shared history just to satisfy this rule.
- If conflicts, failing checks, permissions, unclear ownership or an unavailable remote prevent completion, stop and report exactly what is uncommitted, unpushed or out of date and why. Do not claim the task is done. An explicit request to leave work uncommitted or unpushed takes precedence.
- Respect workflow ownership: sandboxed SDLC stages return patches to the runner, which owns commits and pushes. Subagents whose parent owns integration return their changes to that parent. Publishing a task branch does not authorize merging its PR or deleting branches or worktrees.

## Conventions

- TypeScript strict, erasable syntax only (no enums, namespaces or parameter properties), `.ts` extensions in relative imports.
- `packages/core` stays pure: no I/O, no clock, no `Math.random`. Randomness comes from `Rng`.
- Add a package only when its milestone starts.
- The lint is strict on purpose and `pnpm check` fails on it: no function over 25 cognitive complexity or 120 lines, no nested ternaries, no `any`, no non-null assertions, nothing unused. A `switch` over kinds that grows with every kind is the shape to replace with a table of handlers. Do not add `biome-ignore`; restructure. Read `.claude/skills/world-design/SKILL.md` before changing how the inn behaves: engine code must not gain character names (a test ratchets the count), and coverage tests in `packages/inn/test/coverage.test.ts` require every verb, thing, deed, voice and activity to be complete.
- Never write keys into the repo. `.env` is git-ignored and holds `TYPESAFE_API_KEY`.
- Do not use an Anthropic API key. Claude calls go through the Claude CLI on the subscription login; the development loop (`pnpm sdlc`) reaches its models through the router named in `playtests/loop.json`.
