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
| plan | yes, in a box that is thrown away | A file-by-file plan, a sibling case, whether a re-record is owed | Throws away anything written to disk; checks the planned files against the bounds |
| build | yes, in a box | Carry out the plan on a copy of the issue's tree | Checks changed paths, runs `pnpm check`, commits; up to `max_build_attempts` |
| review | no | Approve, revise or reject against the tests of generality | Pushes and opens the pull request on approve (or updates the one already open); at `max_open_pull_requests` it waits |
| pr | no | For one reviewer's finding: answer it, fix it, or pass it to a person; and the reply to post | Posts the reply under the finding; sends `fix` back to build; stops at `person` |

## Watching the pull request

Opening a pull request is not the end of the loop's work, because automated reviewers and
people comment on it. While an issue is at `stage:pr`, each pass:

1. Looks the pull request up by its branch. Merged: nothing to do, and GitHub closes the issue.
   Closed without merging: that is a person's no, the issue goes to `stage:human`, and the loop
   will not reopen it.
2. Reads the repository's own gate in CI (`sdlc.gate_check`, the `check` job). If it failed,
   the issue goes back to build with that as the note, counted against `max_build_attempts`.
   Other apps' checks are not chased: what they have to say arrives as review comments.
3. Reads the review threads and keeps those it owes an answer: opened by someone listed in
   `sdlc.trusted_reviewers`, and not yet replied to by the account the loop runs as. Anyone can
   comment on a public pull request, so anyone not listed is left for a person. **One answer
   per thread, ever**, so the loop and a review bot cannot go round in circles.
4. For each, a model with no tools gives a verdict from a closed list and the reply to post.
   `answer`: the reply is posted and that is all. `fix`: the reply is posted and the finding
   goes to the build stage as its note, then through review again, and the push updates the
   same pull request. `person`: the reply says so and the issue goes to `stage:human`. The
   prompt sends anything about security, credentials, workflows, dependencies or the loop
   itself to `person`, and forbids claiming a fix or asking for a merge.
5. A reviewer's words reach the model without hidden markup or folded sections, which is where
   review bots put prompts meant for coding agents.

It never merges, never resolves or dismisses a thread, and never pushes to the base branch.
If the loop runs as the repository owner, the owner's own review comments count as the loop's
and are not answered; run it as a separate account if that matters.

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

## The sandbox

Plan and build give the model a tool, and `prime-agent`'s tool is a Python interpreter. The
gate runs test files a model wrote. So the rule is: **nothing a model touched is ever executed
on the host.** The host does git and GitHub; everything else happens in a Podman container.

- **A tree goes in, a patch comes out.** The issue's tree is streamed into the container with
  `git archive`: no `.git`, no remotes, no host path mounted, ever. The agent works on that
  copy. What comes back is one text patch. Code applies it to the real worktree, checks the
  changed paths against the bounds, and only then gates and commits.
- **The gate runs in a second container with no network at all**: only a loopback interface,
  no DNS. The tree exactly as it stands goes in, dependencies install offline from a store
  baked into the image, without lifecycle scripts, and `pnpm check` runs there.
- **The agent's container can reach one thing**: the model router. It sits on a closed network
  whose only other member is a relay, a 20-line TCP pipe to one port on the host. Measured from
  inside: the relay answers, the internet does not resolve, and the host's port is unreachable
  except through the relay.
- **Every container** drops all capabilities, cannot gain privileges, has a read-only root,
  runs as uid 1000, and is bounded in processes, memory and CPU. Tests check that no container
  is ever created with a host path, a device, a socket or host networking.
- **The one secret inside is the router's key**, read from the agent CLI's config on the host,
  written into the container, and gone with it. The image holds no `gh`, no ssh, no curl and
  no credential helper.

```bash
pnpm sdlc sandbox-build     # build the image; again whenever pnpm-lock.yaml changes
```

The image is built from `sdlc/sandbox/Containerfile` with both base images pinned by digest.
Its build context is assembled in `.sdlc/sandbox-context` (ignored), because the agent CLI is
not on the public registry and is packed from the local install. The agent's Python
environment is built at image build time, since a box has no network to build it with. The
image is about 1.6 GB: most of it is that environment and the agent's own dependencies, not
this repository. Opening a box and installing takes about 4 seconds; `pnpm check` inside it
takes about 6.

On Windows, Podman runs its containers in a VM. Use the Hyper-V provider
(`provider = "hyperv"` under `[machine]` in `%APPDATA%\containers\containers.conf`): a WSL2
machine shares a kernel with your other distributions and mounts your drives. Creating and
starting a Hyper-V machine needs an elevated shell; running containers does not.

## The switches, in `playtests/loop.json`

| Key | Default | What it allows |
| --- | --- | --- |
| `enabled` | `false` | Any pass at all. Read at the start of every pass, so turning it off stops a running loop at the next one |
| `sdlc.allow_tool_stages` | `false` | The plan and build stages. With it off, issues are triaged and then held at `stage:plan` |
| `sdlc.sandbox` | `podman` | Where those stages and the gate run. Without this block the tool stages stay shut even if allowed |

`sdlc.sandbox.kind` may be `none` for a machine that is itself disposable (a CI job), but then
the tool stages run only if `accept` holds one exact sentence, which is in
`packages/terminal/src/sdlc/sandbox.ts`. There is no quiet way to run them unsandboxed.

Every model process, in every stage, is started without environment variables that look like
credentials (`TOKEN`, `SECRET`, `PASSWORD`, `API_KEY` and the like), unless `sdlc.agent.env_keep`
names one the model CLI needs. That is hygiene for runners whose environment holds tokens, such
as a CI job, and for the stages that run on the host.

The rest of the `sdlc` block: `base_branch`, `worktree_root`, `trusted_authors`,
`trusted_reviewers`, `gate_check`, `max_build_attempts`, and per stage the `prime-agent` provider and model, with the build
stage's turn, token and time limits. The loop's own files, its prompts and `.claude` are in
`may_not_change`, so a build cannot rewrite the loop.

## What is not proven

- `status`, `init`, `tick --dry-run` and the refusal while switched off have been run. `init`
  created the labels on the repository.
- Triage ran once, against a made-up issue, with no writes to GitHub: 14 seconds, 9.4k tokens,
  a parseable answer, and an injected instruction in the player text was ignored. Its choice
  of class was debatable, so the cheap model's triage quality is unknown.
- The pull-request stage's reads (finding the pull request, the gate's result, the review
  threads, which of them are owed an answer) were run against this loop's own pull request and
  gave the right answers. Its model call and its posting of replies have never run. The first
  round of review-bot findings on that pull request was handled by hand, which is where the
  stage's rules come from.
- The build stage ran once, end to end, in the sandbox, on a hand-written plan ("append this
  sentence to a doc"): the agent changed the file in its box, the patch came out and applied,
  the bounds passed, the gate passed in a box with no network, and the loop committed. It took
  143 seconds with `auto/coding`. The same trial with `auto/coding:cheap` produced reasoning and
  no tool call; the unchanged tree passed the agent's own gate, and the loop correctly counted
  it as a failed attempt ("the agent changed nothing"). So the cheap model's fitness for build
  is doubtful, on a sample of one.
- Plan and review have never run. A real issue has never gone through. Nothing is known about whether a cheap model can
  carry a plan through this repository's lint and tests.
- The pure half (`flow.ts`: the stage table, snag keys, bounds, reading a model's answer) has
  15 tests. The half that drives `git`, `gh` and `prime-agent` has none.
