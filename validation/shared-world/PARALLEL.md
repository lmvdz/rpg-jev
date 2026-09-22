# Parallel follow-through

This run addresses the unresolved shared-world work in independent tracks.
Parallel work does not waive milestone prerequisites or security/product choices.
The authoritative integration base remains `b0f2fea` and its descendants on
`feat/open-world-browser`. Other uncommitted runtimes are sources for selective
ports, not replacement authorities.

## Tracks and acceptance

| Track | Bounded work | Gate that remains distinct |
| --- | --- | --- |
| Responsiveness | Lossless, self-contained public snapshot encoding; unchanged meaning, visibility, receipts and world timing | Real two-browser workflow and the unchanged 250 ms protocol p95 |
| Archive cost | Lossless event-local dictionary, legacy decoding and mixed-log replay; no omitted quiet effects or destructive rewrite | <=25% representative tick bytes and <=10 ms individual encode/decode p95; long-running hosting cost requires its own operator budget |
| Hosting configuration | Explicit local port/database, isolated standalone data directory, validated browser build endpoint and endpoint-scoped credentials | Not public deployment, TLS operations, clean-machine installation or full independent hosting acceptance |
| Identity/recovery | Compare operator recovery with player-held recovery credentials | Owner choice required; no unapproved identity system or automatic admission |
| JEPA integration | Reconcile the actual runtime and checkpoint contracts | Native observer/teacher integration and a compatible, quality-validated artifact; no fabricated forecasts |
| Iroh/Matrix | Check current browser/operational limits against the retained SDK | Adoption requires benefit evidence; neither becomes mandatory |
| Character visits | Preserve the copy-visit recommendation and decision register | W1/W2 plus explicit identity, consent and visitor-mode approval before W3 implementation |

Performance work is developed concurrently, but final live measurements run
without another build/test job started by this thread. Concurrent development
measurements are retained and are not silently promoted to controlled results.

## Implemented and exercised

- Self-contained snapshot dictionaries retain all public values, with expanded
  resource bounds and validation before allocation. The representative view
  shrinks from 374,980 to 35,079 bytes.
- Material presentation is prepared once per refresh, then filtered separately
  for every observer. No unfiltered scene is published and no persistent cache
  changes authority.
- A caller-owned 15-second **projection-interest lease**, renewed every five
  seconds, prevents abandoned sessions from generating full views forever.
  Expiry does not remove a character, revoke admission, stop simulation or
  change a receipt. Rejoining/renewing obtains a current projection. Client
  timeouts retain unknown commands for exact reconciliation.
- Late callbacks are fenced to their originating connection/attempt; a closed
  instance cannot erase another instance's pending storage. Regression tests
  exercise late rows, connect/subscription errors, command failures and renewals.
- Event-local dictionaries preserve exact event JSON. Optional per-record gzip
  happens only in the Node archive worker, with native inflation limits and
  fsync-before-ack unchanged. The representative complete archive row is 12,061
  bytes versus 388,279 original event bytes (**3.106%**).
- Explicit local endpoint/database configuration was exercised on port 3058
  with separate standalone data. Browser tokens/pending commands remain scoped
  by canonical endpoint and database. Insecure remote browser configuration was
  refused by the actual Vite build.

### Live results and unsuccessful attempts

All results below are retained under `results/parallel/`.

| Workload/build | Accepted-command p95 | Result against 250 ms |
| --- | ---: | --- |
| New configured world, two admissions | 37.558 ms | Pass; not like-for-like with the old eight-admission population |
| Retained world, compact wire | 307.813 ms | Fail |
| Retained world, encoded heartbeat comparison | 253.902 ms | Fail |
| Retained world, prepared projections | 254.312 ms | Fail |
| Retained world, eight admissions / two active observers, publication leases | **188.148 ms** | **Pass** |

The final retained-world protocol also passed caller isolation, unauthorized
archive operations, invalid/stale commands, retries, independent time, expired
projection renewal without admission loss, and persistent host restart.

Both real browser workflows passed keyboard/menu/reload with no console or
WebGL errors. Single cold movement samples were **206 ms** on the configured
world and **462 ms** on the retained world. These do not establish a browser
p95; the retained cold path remains slower than desired.

The event codec's size budget passed. Individual encode/decode p95 met 10 ms
in quieter runs (7.645 / 3.281 ms after the ASCII fast path), but earlier loaded
runs failed and combined round-trip remained 10.954 ms. No robust all-load
10 ms claim is made. Archive gzip separately measured 1.126 / 0.216 ms p95
with the predeclared 16 warmups and 64 samples.

### Retained-history handling

The original archive is not pruned or overwritten. It eventually exceeded the
replay tool's fixed 1 GiB input bound; the refusal is retained as
`retained-replay-size-refusal.json`. The bound was not raised to make that run
pass. A separate, non-destructive streaming repack creates a new compressed
candidate for replay, with its own declared 2 GiB / 120-second limits and a
logical-row hash. It is not a live checkpoint or automatic history replacement.

Compression alone does not establish indefinite retention, affordable
multi-world hosting or disaster recovery. Operator storage/retention budgets
and clean-machine recovery still belong to W1.

## Runtime and JEPA ownership

The later foundation work has movement/timing improvements but a different
Store-based authority, command schema and clock. The current world keeps its
committed SpacetimeDB authority and broad matter execution path. Do not merge
either sibling tree wholesale.

The existing inn/shared-graph checkpoints do not cover ordinal matter, food
quantities, injury or general physical consequences. The existing
“Integrate JEPA forecasting with authoritative world” thread should consume the
current authority and selectively recover control behavior. Its native
observation/teacher work must not be duplicated with another simulated world.

Model adaptation needs versioned observations, legal interventions, explicit
time/horizon semantics, replay-validated action-versus-none records and measured
quality against a matched supervised baseline. Until compatible coverage exists,
unsupported forecasts must remain explicit. No inference may block play or
write effects. Recoverable infrastructure is not evidence of model competence.

## Networking research

Current official Iroh documentation describes browser operation as relay-only,
without direct UDP/hole punching, and requires application-specific Rust/WASM
bindings rather than a ready npm browser package:
https://docs.iroh.computer/languages/wasm-browser

Public relay availability and production service/operating terms are separate
from protocol capability:
https://www.iroh.computer/docs/tour/2-relays

These are documentation findings, **not a measured transport comparison**.
They provide no reason to replace the functioning SpacetimeDB browser adapter
while its existing performance/storage gates remain open. Iroh already uses
QUIC; adding another QUIC layer is not part of this work.

Matrix offers community/chat/invitation APIs:
https://spec.matrix.org/latest/client-server-api/

Room membership is not game admission, and a Matrix credential is not a
character identity. Optional community integration must not enter simulation
authority, carry private visit exports implicitly, or become a play prerequisite.
No Matrix login, SDK, homeserver or directory is introduced here.

## Explicit blockers, not implementation claims

- Account recovery needs the owner's choice between operator recovery and
  player-held credentials. The recommendation is player-held credentials for
  portable identity, with world admission remaining operator-controlled.
- Internet hosting needs an operator target, supported platform/device and cost
  budgets, provider/payment authorization, TLS/security operations and a second
  machine for the W1 demonstration. No external deployment is authorized by
  merely preparing endpoint configuration.
- Copy visits remain recommended, not approved. Source continuity, bounded
  identity/history/belief disclosure, consent/retention and contract changes must
  be decided before implementing cross-world admissions.
- Trusted progression, exclusive assets and executable mods retain their
  separate gates. Signatures do not make another operator honest.
