# The development loop (`pnpm sdlc`)

A program that carries a snag from a playtest log to a pull request, one stage at a time, with
a cheap model filling in each stage through the `prime-agent` CLI. It is the second runner for
the playtest loop described in [`playtest-loop.md`](playtest-loop.md): the first is a Claude
Code session following `.claude/commands/playtest-loop.md`; this one is plain code that calls
a model only where judgment is needed. Both use the same switch, the same limits, the same
GitHub ledger and the same method (`.claude/skills/world-design/SKILL.md`).

**It is switched off, and it has never run past triage.** Read "What is not proven" before
switching it on.

## Code owns the workflow

- **GitHub is the memory.** An issue labelled `sdlc` is managed. Its stage is a label
  (`stage:triage`, `stage:plan`, `stage:build`, `stage:review`, `stage:pr`, `stage:human`), its
  class is a label (`class:parser`, `class:question`, `class:content`, `class:mechanism`,
  `class:unclear`), and what each stage concluded is a comment. A pass keeps no memory of its
  own, so any machine can run the next one.
- **The next stage is a table** (`packages/terminal/src/sdlc/flow.ts`), keyed by stage and
  outcome. A missing mechanism or an unclear snag goes to `stage:human` and stops: the loop
  does not design. A plan that needs files outside its bounds stops. Three failed builds stop.
- **Local files are the workbench.** `.sdlc/` (git-ignored) holds each prompt sent, each reply,
  the attempt count, a journal of every model call with its tokens and time, and a lock so two
  passes cannot run at once.
- **Each issue is built in a worktree of its own**, under `../rpg-jev.worktrees/issue-<n>`, on
  branch `sdlc/<n>-<slug>` cut from the base branch. The main checkout is never touched.
  Worktrees have no `.env`, so a pass cannot spend the judge budget: a change that breaks the
  recorded replay becomes a draft pull request with "re-record owed".
- **The gate is run by the loop, not reported by the model.** After a build the loop itself
  checks the changed paths against `may_change` and `may_not_change`, runs `pnpm check`, and
  only then commits. Only the loop commits, pushes and opens pull requests. It never merges.
- **Only trusted authors' issues are worked on** (`sdlc.trusted_authors`). The repository is
  public and anyone can open an issue.
- **Intake files only nights that were handed in** (`pnpm friction --submit`, into
  `playtests/inbox/`), because an issue quotes what the player typed, in public.

## Stages

| Stage | Model has tools | What it is asked | What code does with the answer |
| --- | --- | --- | --- |
| triage | no | Walk the snag up the world-design ladder; name the class | Takes the class from a closed list; routes `mechanism` and `unclear` to a person |
| plan | yes, read-only by instruction | A file-by-file plan, a sibling case, whether a re-record is owed | Throws away anything written to disk; checks the planned files against the bounds |
| build | yes | Carry out the plan in the issue's worktree | Checks changed paths, runs `pnpm check`, commits; up to `max_build_attempts` |
| review | no | Approve, revise or reject against the tests of generality | Pushes and opens the pull request on approve; at `max_open_pull_requests` it waits |

## Commands

```bash
pnpm sdlc status            # the switch, the models, and where every managed issue stands
pnpm sdlc init              # create the labels on GitHub (safe to repeat)
pnpm sdlc intake            # file an issue for each new snag in the nights handed in
pnpm sdlc tick --dry-run    # show what one pass would do; works with the switch off
pnpm sdlc tick              # one pass: move up to max_snags_per_run issues one stage forward
pnpm sdlc run --every=15    # a pass every 15 minutes, until stopped or switched off
pnpm sdlc clean             # remove the worktrees of closed issues
```

## The two switches, in `playtests/loop.json`

| Key | Default | What it allows |
| --- | --- | --- |
| `enabled` | `false` | Any pass at all. Read at the start of every pass, so turning it off stops a running loop at the next one |
| `sdlc.allow_tool_stages` | `false` | The plan and build stages. With it off, issues are triaged and then held at `stage:plan` |

They are separate on purpose. `prime-agent`'s only tool is a Python REPL with no sandbox, so in
plan and build the model can do anything the account running the loop can do: read files
outside the worktree, use the network, use the GitHub login. The bounds, the gate and the
review stop a bad change from being *proposed*. They do not stop a bad command from being
*run*. Turning `allow_tool_stages` on is accepting that, or having first put the loop somewhere
it does not matter: a container or VM with no credentials beyond a repository-scoped token.

The rest of the `sdlc` block: `base_branch`, `worktree_root`, `trusted_authors`,
`max_build_attempts`, and per stage the `prime-agent` provider and model, with the build
stage's turn, token and time limits. The loop's own files, its prompts and `.claude` are in
`may_not_change`, so a build cannot rewrite the loop.

## What is not proven

- `status`, `init`, `tick --dry-run` and the refusal while switched off have been run. `init`
  created the labels on the repository.
- Triage ran once, against a made-up issue, with no writes to GitHub: 14 seconds, 9.4k tokens,
  a parseable answer, and an injected instruction in the player text was ignored. Its choice
  of class was debatable, so the cheap model's triage quality is unknown.
- Plan, build and review have never run. Nothing is known about whether a cheap model can
  carry a plan through this repository's lint and tests.
- The pure half (`flow.ts`: the stage table, snag keys, bounds, reading a model's answer) has
  15 tests. The half that drives `git`, `gh` and `prime-agent` has none.
