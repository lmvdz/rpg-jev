# Full uncommitted-content sweep

## Result

Audited **all 189 tracked modifications and non-ignored untracked files** in the
attached `poc` worktree before adding these sweep records.

| Classification before preservation | Files |
| --- | ---: |
| Exact Git blob at the same path on a current origin tip | 128 |
| Exact Git blob at another path on a current origin tip | 14 |
| Exact Git blob reachable from origin history, but not one of the inspected tips | 43 |
| Unpublished document variants, preserved by this sweep | 4 |
| **Total** | **189** |

There is **no unpublished renderer, matter, test or spike implementation** in
this snapshot. Most of the dirty tree is a mixed-age copy of work already published
on other branches. Committing it as new feature work would regress or duplicate
those branches, not recover missing implementation.

The per-file inventory is
[`validation/worktree-sweep/inventory.json`](../validation/worktree-sweep/inventory.json).
It records Git-normalized content hashes, current-tip matches, origin-history
classification, and preservation paths. Local-only commits are not counted as
publication evidence.

## Revisions and scope

- Attached HEAD: `47d59debd1dadfa518ec480d40aa39ee6a2cec99`, branch `poc`.
- Refreshed `origin/poc`: `48348aa59b17ab5e91c827c8aba15d2d964e9fdb`;
  the attached branch is eight commits behind.
- Renderer: `9a37a94cd2dc0ec6420231ef97b1266f2d8bf317`.
- Sandbox: `b94fe5c8f5377fda5e697406f1e445ab2faed78f`.
- Published causal-design/C0 work before this sweep:
  `8af0b5b5aec9cd598d987a5c0221c8451cc08c14`.
- S0 was also checked as an available origin tip; all inspected ref hashes are in
  the inventory.

The 189 files comprise 63 renderer files, 38 matter source/tests, 46 vocabulary
files, eight probe-sketch files, four composition-spike files, five documents,
15 C0 staging files, four prior validation files and six root/package files.

Ignored paths were enumerated separately: only dependency `node_modules/`
directories were present. They were not opened as user content, staged or committed.
This is an audit of the attached worktree, not every external developer checkout.

## Disposition by logical area

### Renderer: use its existing branch, not the dirty directory

All 63 client files are published: 44 match the renderer tip and 19 match older
renderer commits. The dirty directory is also missing 19 files present at the
tip, including later world-port, birth and ground integrations.

The dirty root `package.json`, `pnpm-lock.yaml` and core RNG export configuration
match the renderer branch. They belong with that renderer history, not an isolated
dependency commit on the older `poc` base.

### Matter and experiments: preserve the newer generated graph

The 92 matter/vocabulary/probe files all match published blobs. The current local
matter snapshot predates the generated graph and much of its newer tests.
The original held-out test is already preserved at its historical validation path;
it must not replace the current ordinary regression suite.

### Causal work and C0 staging: already committed, except delivery metadata

The composition experiment, causal documents, pinned validation and 13 C0 payload
files are already present on the published task branch, sometimes at their
canonical production paths rather than the staging paths used by this worktree.
The unique C0 handoff report and manifest are preserved as archival records, not
as another copy of the source payload.

### Four unique document variants

| Original working path | Preservation path |
| --- | --- |
| `SPEC.md` | `validation/worktree-sweep/SPEC.poc-working.md` |
| `docs/sandbox-direction.md` | `validation/worktree-sweep/sandbox-direction.poc-working.md` |
| `validation/c0-work/README.md` | `validation/worktree-sweep/c0-delivery/README.md` |
| `validation/c0-work/manifest.json` | `validation/worktree-sweep/c0-delivery/manifest.json` |

The first two combine older branch material with later local documentation changes.
They are preserved exactly as Git content, but are not promoted over the current
specification or the newer minds/graph findings. The archive README marks that
boundary explicitly.

## Method and verification

1. Fetch origin and record the branch tips and original working-tree status.
2. Enumerate modified/untracked paths with Git's ignore rules.
3. Hash each working file with its Git path/filter context.
4. Compare against current tip trees, including alternate canonical paths.
5. Check remaining hashes with `git rev-list --objects --remotes=origin`.
6. Independently audit renderer and matter/spike groups and inspect the unique
   document differences.
7. Preserve the four unique Git contents; recheck every original working hash and
   each archive hash before publication.
8. Run the combined branch gate and publish preservation/accounting separately
   from production feature changes.

No source branch was rewritten, no dependency directory was committed, and no old
source snapshot was installed over a newer implementation.

## Content accounted for is not the same as a reconciled checkout

The original worktree is still a dirty, mixed-version `poc` snapshot. This sweep
accounts for and preserves its content; it does not claim that `git status` there
is clean or that the renderer and latest sandbox are integrated.

Cleaning that checkout safely requires selecting its intended final branch.
The recommended next step is a dedicated integration branch assembled from current
`poc`, renderer and causal-design histories, with conflict resolution and full
verification. That is a separate integration operation, not permission to reset,
delete or blindly commit this snapshot merely to hide dirty status.
