# Bounded clearing snapshot experiment

This is an offline optimization of the existing SpacetimeDB clearing, not a
replacement runtime or a live latency pass. The fixed live accepted-command
p95 budget is still 250 ms. Previously retained protocol p95 was 280.780 ms;
the separately observed cold-browser command was 792 ms.

## Predeclared offline budgets

Before benchmarking the candidate: at least 30% fewer snapshot bytes,
encoding p95 <=10 ms, decoding p95 <=10 ms, projection plus encoding
p95 <=25 ms. Timing enforcement is opt-in (`SHARED_WIRE_BENCH=1`) to avoid
turning machine contention into a flaky correctness test.

## Profile and choice

The original one-viewer clearing projection contains 1,406 visible things and
374,980 UTF-8 JSON bytes. Things account for 271,743 bytes, awareness for
101,724 bytes, and element metadata for only 1,176 bytes. Initial measured
projection p95 was 3.147 ms and stringify p95 1.257 ms.

Element-only deduplication therefore cannot meaningfully shrink the remaining
payload. Removing only canonical sight awareness would save about 27%, below
the predeclared byte target. A self-contained presentation dictionary plus
instance tuples and lossless canonical-awareness elision reduces the complete
snapshot to **35,079 bytes (90.65% reduction)**. No AOI, visibility, physics,
tick cadence, discrete state vocabulary or receipt identity changes.

On Windows / Node 25.8.2 / pnpm 11.15.1, 20 warmup iterations followed by 100
samples (nearest-rank p95):

| Measurement | Milliseconds |
| --- | ---: |
| Projection | 1.104 |
| Original stringify | 0.516 |
| Dictionary encode including stringify | 1.094 |
| Dictionary parse and expand | 0.366 |
| Projection plus dictionary encoding | 1.961 |

An earlier candidate run measured encode 0.995 ms, decode 0.369 ms, combined
2.312 ms. These local CPU figures are not transaction/publication costs, browser
cold-start timing or a live command acknowledgement measurement. Full-check
contention can produce different timings; there is no live latency claim.

## Wire and failure contract

`packages/client/src/play/shared-wire.ts` exports `encodeSharedView` and
`decodeSharedView`. Each version-1 snapshot carries its own dictionary and
ordered instance tuples. The dictionary holds every non-position/non-ID
presentation field, including visible states and per-instance overrides;
different presentations get different entries. Awareness is derived only when
it exactly matches the existing all-sight list; otherwise it is sent verbatim.
All other public/control fields pass through unchanged. No private world
data enters the helper. Legacy full JSON remains readable.

The helper rejects more than 16,384 instances/presentations or 8,388,608 JSON
UTF-16 code units of conservative encoded-plus-expanded content; it preflights
that bound before allocating instances and never truncates. Legacy and compact
views validate required public/body/element/awareness shapes. Unknown versions,
malformed surfaces and invalid dictionary references fail visibly. Expanded
instances have independent nested state/look/forms/baseline values. These are
codec resource bounds, not visibility cuts. The
client does not settle a successful receipt from an undecodable snapshot,
clears its usable view, and retains the saved command for later reconciliation.

After hardening, another offline run measured encode p95 **2.166 ms**, decode
**2.423 ms**, and projection-plus-encode **3.448 ms**, still within the declared
budgets. Earlier faster results above predate the extra validation and cloning.

## Integrated publication

`module/src/index.ts` publishes `encodeSharedView(view)`. Quiet-tick comparison
uses those already-encoded host-authored snapshots, ignoring only revision/tick
and retaining the two-tick heartbeat. It does not expand and encode the same
dictionary repeatedly for every admitted actor.
Do not encode authoritative world state or archived effects with this codec.

API harnesses use `decodeSharedView(row.json)`. The receipt row schema is unchanged. Reload the
browser client when publishing the wire version; an older client without this
decoder cannot consume the compact format.

## Reproduce

```sh
SHARED_WIRE_BENCH=1 pnpm exec vitest run packages/server/test/projection-cost.test.ts
pnpm exec vitest run packages/server/test/projection-wire.test.ts packages/server/test/projection.test.ts packages/client/test/shared-connection.test.ts
pnpm check
```

The focused tests compare full public values and expanded renderer presentation,
exercise heartbeat suppression after decoding, retain noncanonical awareness and
instance overrides, check codec bounds, and exercise receipt reconciliation over
encoded snapshots. The parent owns real protocol/browser validation and the
unchanged live 250 ms gate.

Final offline `pnpm check` passed: lint, all package typechecks, 86 Vitest
files / 1,461 passing tests / 331 existing expected failures, plus 26 food,
43 thermal/terminal and 55 shared/archive/replay native tests. A preceding
full run failed the existing thermal CLI test with Windows `EPERM` renaming
its temporary `bench.jsonl.pending`; the unchanged test passed on the final
rerun. That failure is retained here rather than treated as a codec failure
or hidden by the subsequent pass. Concurrent workspace validation was running;
the parent owns the final integrated check and quiet/live measurements.
