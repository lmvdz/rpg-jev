# Verified causal-world integration

## Branch and preserved inputs

`integration/causal-world` combines these published histories:

| Input | Pinned revision |
| --- | --- |
| `origin/poc` | `48348aa59b17ab5e91c827c8aba15d2d964e9fdb` |
| `origin/renderer/client` | `daa9b0d36a74401f6569fd668cf956450de4e3dd` |
| `origin/design/compositional-causality` | `6664d3ae96beb9953c74260c5666d446e83ba946` |

The causal-design history already includes sandbox `b94fe5c`. The integration
starts from the current `poc`, merges renderer history, then causal-design history.
Both merges were textually clean. It retains the inn fixes/recordings, current
renderer, generated graph, C0 corrections, design contract and validation archives.
It does not merge a pull request into or force-update any source branch.

## Integration fixes

### One change vocabulary, projected for the client

The merged typecheck found that the renderer maintained a stale copy of the core
change-kind union: `carried` existed in core but not in the client mirror.

`packages/client/src/play/world-link.ts` now derives non-signal kinds from
`matter.Change["kind"]`. The view still reads only presentation fields; it does
not apply world effects or reconstruct positions from event payloads.

The existing type test checks that every core change fits the client projection.
A new runtime regression passes a quiet core `carried` change and verifies that
the view uses authoritative projected positions, not the event's coordinates.
This is compatibility at the seam, not a new inventory or carried-item rendering
feature; those broader client behaviors remain separate work.

### Bound test contention, not the assertions

The combined 72-file suite twice exceeded the unchanged five-second timeout in
the CPU-heavy randomized level invariant. The same case completed in about
0.6 seconds in isolation. The complete suite passed with four workers.

`vitest.config.ts` therefore caps workers at `min(4, availableParallelism())`.
No sample, assertion, tolerance, expected-failure marker or test timeout changed.
The final gate runs the ordinary `pnpm check`, not an alternate test selection.

## Verification

- `pnpm check`: **72 files pass; 1,254 ordinary passes and 331 expected failures**.
- `pnpm exec tsc -p spikes/composition/tsconfig.json`: passes.
- `pnpm --filter @rpg-jev/client build`: production Vite build passes.
- Existing client/core port tests, C0 regressions, graph reference tests and inn
  recorded replay all participate in the combined gate.
- Ignored dependency/build output is not committed.

The first offline install lacked the existing `gl-matrix` tarball. A normal
frozen-lockfile install downloaded that public dependency; no manifest or lockfile
was changed to make installation succeed.

## Real browser workflow

`validation/integration/browser-smoke.mjs` launches the integrated Vite client and
an existing Chromium-family executable with a fresh temporary profile. It uses
Node's native WebSocket/fetch APIs and CDP, so no browser-test package was added.
It closes only the processes it starts and never invokes the editor save endpoint.

Verified in headless Chrome on the machine's NVIDIA RTX 4070 Ti WebGL2 renderer:

1. Open a fresh `?seed=1` clearing; observe a nonzero 1280×800 canvas, a running
   frame loop, completed terrain-worker work and an attached matter port.
2. Toggle the editor on and off with actual Tab key events.
3. Right-click the canvas and click **wait a while** in the pointer menu.
4. Verify the full route through world port, core and HUD: one recorded draw,
   process `drift`, hunger rising from `1` to approximately `1.045`, and updated
   world messages.
5. Check WebGL error state is zero and no runtime exceptions or console errors
   were captured.

This is an interaction smoke check, not a visual-regression or GPU-performance
certification. Forced SwiftShader attempts timed out in CDP screenshot/evaluation
commands; software-GPU behavior is not certified. The committed harness uses the
browser's normal renderer, reports its actual renderer string and does not require
a screenshot. It does not call Jev, use a personal browser profile or save a world.

Example, with output outside the repository:

```sh
node validation/integration/browser-smoke.mjs . \
  "C:/Program Files/Google/Chrome/Application/chrome.exe" \
  "$DELTA_SCRATCH_DIR/browser-smoke"
```

The browser path is platform-specific; the script does not install a browser.

## Checkout reconciliation

The older dirty `poc` worktree was audited separately in `uncommitted-sweep.md`;
all of its content is already represented in published history or the sweep archive.
Before aligning the attached checkout, preserve its exact working layout in a
named local Git stash including non-ignored untracked files. Do not reset or clean
it away. Report that stash ID and the integration branch after switching.

The integration does not complete C1–C8, remove the 331 acknowledged expected
failures, certify arbitrary future generated-rule composition, or synchronize the
external Claude Doc.
