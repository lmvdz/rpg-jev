# Branch boundaries for clearing validation

## Do not treat the `poc` working tree as the current sandbox

The original held-out clearing pass ran against `poc` at `47d59de` plus the
uncommitted files visible in the attached Delta worktree. It did not validate the
active feature branches. The branch-specific rerun must pin its own revision and
report its own results; expected failures from the older copy are not portable facts.

The [sandbox rerun](../validation/sandbox-held-out-928755f-20260720/REPORT.md)
is complete at `928755f673d2b18f4d893156df9499bc68340751`: 10 normal passes and
five failures covering four rule gaps. That target is newer than the local sandbox
revision used in the renderer inspection below. No combined renderer/sandbox
integration checkout was tested.

## Publication baseline

Before publication, both remotes were refreshed. The work was assembled on
`design/compositional-causality` from
`b94fe5c8f5377fda5e697406f1e445ab2faed78f`, the then-current sandbox tip,
preserving its newer graph, minds and generated-rule work.

The publication tree passes `pnpm check`: 50 files, 984 ordinary passes and
331 existing expected failures. The composition spike also passes its explicit
standalone TypeScript check. The historical held-out suites are archived outside
test discovery; this green gate does not assert that their defects are fixed
on this newer revision. Revalidate before starting production fixes.

## Renderer inspection

This is a read-only inspection of the locally available revisions, not a renderer
test run, browser check, remote freshness guarantee, or merge-compatibility result.

| Reference | Inspected revision |
| --- | --- |
| `renderer/client` | `9a37a94cd2dc0ec6420231ef97b1266f2d8bf317` |
| `sandbox/matter` | `e6d242248f565839e1c2d43bb9c1c5226cdc4ad6` |
| Their merge base | `fc440b26791e1d77d5f44cf2b8a0805be67ec682` |

Renderer commit `77d03da4a61218650b8de19e2d0b78c6dd6379c8` merged sandbox commit
`fc440b26791e1d77d5f44cf2b8a0805be67ec682`. Relative to the inspected sandbox tip,
the histories have eight sandbox-only commits and nineteen renderer-only commits.
The renderer therefore includes a real matter integration, but not the later
graph-schema work at the inspected sandbox tip.

The eight sandbox-only commits include:

- Structured minds, bonds, deeds, and intents.
- Routine and diet measurements against the judge.
- Diet-aware behavior.
- Drift expressed as nine data rows.
- A planner over the rule graph.

In particular, `packages/core/src/matter/graph/` is present at the inspected sandbox
tip and absent at the inspected renderer tip. Passing renderer tests at that renderer
revision would not prove compatibility with the new graph implementation.

## Existing integration seams to exercise next

The renderer revision already has tests for:

- `packages/client/test/matter-port.test.ts`: shared parser words, matter change
  compatibility, menu-to-act compilation, resolving force and heat, search draws,
  time progression, body meters, sensing, and creature positions.
- `packages/client/test/world-link.test.ts`: projecting world changes into client views.
- `packages/client/test/intents.test.ts`: available client actions.

These were inspected, not executed in this pass. Run them in an isolated integration
checkout after selecting the sandbox revision to incorporate; do not merge or switch
the developer's active renderer checkout merely to validate it.

Suggested sequence:

1. Run the held-out matter scenarios on the pinned sandbox revision as ordinary tests.
2. Distinguish genuine remaining rule gaps from fixed bugs and changed world schemas.
3. In a separate integration checkout, combine the agreed renderer and sandbox revisions.
4. Run client seam tests, typechecking, and then the browser workflow.
5. Record both input hashes and any merge resolution before claiming cross-branch coverage.
