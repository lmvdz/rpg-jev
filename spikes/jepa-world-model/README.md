# JEPA-Anything: offline RPG world-model spike

This is a **randomly initialized, synthetic-data, shadow-only experiment**, not
a pretrained RPG model, Jev replacement, new Jev question family, or live game
integration. It writes only local experiment artifacts. No API keys, network
calls at runtime, reducers, effects, world-state writes, or player text.

## Actual upstream integration

Dependency: Gen-Verse/JEPA-Anything, immutable revision
`c6e6c88f3ef75a4ce7acd660d6fa5779d995512c`, Python subpackage
`jepa-anything-core` (not the upstream generation/orchestration CLI).
The revision's
[README](https://github.com/Gen-Verse/JEPA-Anything/blob/c6e6c88f3ef75a4ce7acd660d6fa5779d995512c/jepa-anything-core/README.md),
[OPF implementation](https://github.com/Gen-Verse/JEPA-Anything/blob/c6e6c88f3ef75a4ce7acd660d6fa5779d995512c/jepa-anything-core/src/jepa_anything_core/opf.py)
and [loss implementation](https://github.com/Gen-Verse/JEPA-Anything/blob/c6e6c88f3ef75a4ce7acd660d6fa5779d995512c/jepa-anything-core/src/jepa_anything_core/losses.py)
were inspected directly.

`Model` instantiates real upstream `OrthogonalFactorProjection(width, 4,
learnable=True)` and calls `decompose` and `analysis_basis`, passing these into
upstream `jepa_anything_objective`. Width defaults to 32; four anonymous factors
each have eight coordinates. The trainable basis uses upstream default
`soft_gram`, not a claim of exact orthogonality. The composite objective includes
factor prediction MSE, projector orthogonality, factor activity, and encoder
variance with upstream defaults (weights 1, minimum standard deviations .1).
No invented semantic names are assigned to factors.

We own the small MLPs and training loop. The online encoder maps six structured
features to a latent. A predictor consumes that latent plus the **conditioned
action** one-hot. The target encoder is an EMA copy (momentum .99, updated after
each optimizer step); future-state encoder outputs are stop-gradient, while
target-side OPF projection remains differentiable as upstream requires.

Both variants share identical initialized encoder, action-conditioned predictor,
choice head, outcome head, optimizer, rows and minibatch order. Baseline loss is
choice cross-entropy plus outcome binary cross-entropy. JEPA adds .1 times the
upstream composite latent objective. The heads are trained end-to-end, not frozen
linear probes. The OPF and EMA encoder are training-only additions and are not
required by forward inference, though checkpoints retain them for audit.

## Install (Python 3.11+, Git)

Installation downloads public dependencies; subsequent commands are local-only.
Install an appropriate PyTorch wheel first to avoid accidentally downloading
large CUDA dependencies for CPU-only use. Torch is constrained to `>=2.6,<3`;
the exact installed version and upstream package version are recorded per run.
Training and checkpoint loading verify the installed core's `direct_url.json`
commit against the pinned revision; unverified wheel/local installations fail
closed. Install through the requirements file rather than a same-version wheel.

Linux CPU, from repository root:

```sh
python -m venv spikes/jepa-world-model/.venv
spikes/jepa-world-model/.venv/bin/python -m pip install 'torch>=2.6,<3' --index-url https://download.pytorch.org/whl/cpu
spikes/jepa-world-model/.venv/bin/python -m pip install -r spikes/jepa-world-model/requirements.txt
```

On Windows use `py -3.11 -m venv spikes/jepa-world-model/.venv`, then substitute
`spikes/jepa-world-model/.venv/Scripts/python.exe` for the Linux interpreter.
On Windows RTX 4070 Ti or Linux Lambda, install a CUDA-enabled PyTorch wheel
matching the host driver using the [PyTorch selector](https://pytorch.org/get-started/locally/),
then install this requirements file. Do not infer CUDA compatibility from the GPU
name alone. All model commands accept `--device cuda:0`; CPU is default.
No credentials or cloud provisioning are required or performed.

## CPU smoke and experiment

Activate the venv (or replace `python` below with its full path).

```sh
python -m unittest discover -s spikes/jepa-world-model -p 'test_*.py'
mkdir -p spikes/jepa-world-model/artifacts
python spikes/jepa-world-model/spike.py generate --episodes 100 --seed 17 --output spikes/jepa-world-model/artifacts/data.jsonl
python spikes/jepa-world-model/spike.py train --input spikes/jepa-world-model/artifacts/data.jsonl --output spikes/jepa-world-model/artifacts/smoke --epochs 2 --seed 17
python spikes/jepa-world-model/spike.py evaluate --input spikes/jepa-world-model/artifacts/data.jsonl --checkpoint spikes/jepa-world-model/artifacts/smoke/jepa.pt --output spikes/jepa-world-model/artifacts/evaluation.json
python spikes/jepa-world-model/spike.py infer --input spikes/jepa-world-model/artifacts/data.jsonl --checkpoint spikes/jepa-world-model/artifacts/smoke/jepa.pt --output spikes/jepa-world-model/artifacts/predictions.jsonl
python spikes/jepa-world-model/spike.py benchmark --input spikes/jepa-world-model/artifacts/data.jsonl --checkpoint spikes/jepa-world-model/artifacts/smoke/jepa.pt --output spikes/jepa-world-model/artifacts/benchmark.json
```

For a larger paired experiment generate 5000 episodes, train with `--epochs 50
--batch-size 256 --device cuda:0`, and repeat seeds 17, 29 and 43 with separate
output directories. Benchmark both `baseline.pt` and `jepa.pt` with `--device
cuda:0 --warmup 100 --iterations 1000`. On very small networks CPU can be faster
than CUDA. `--threads` defaults to 1. Seeds make initializations, generation and
minibatch order repeatable; bitwise cross-device determinism is not promised.

## Task and leakage boundary

An episode is one witnessed-theft setup (some controls have no witness).
Code builds legal actions in fixed order: `none` always, `report` only when
witnessed and guard present, `confront` when witnessed, `flee` when escape open.
Every legal action generates an intervention row with synthetic next state and
outcome. A deterministic code utility supplies the preferred action label.
These labels are **not Jev judgments, human preferences, or real causal evidence**.
Action intervention here means a toy rule evaluation, not an identified
real-world causal model.

SHA-256 of split seed plus episode ID assigns approximately 70% train, 20%
validation and 10% test. All actions from the same episode stay together.
Only current features feed the encoder; future state, choice label, outcome,
IDs, split and label-source fields never enter inference tensors. Empty splits
are rejected. Best checkpoint selection uses validation NLL plus outcome Brier;
test data never contributes to optimization or checkpoint selection.
External JSONL must preserve episode identity across related rows; arbitrary
renaming of duplicate episodes defeats any group split and is the data author's
responsibility. Use the original data file for checkpoint evaluation: the CLI
uses the stored training split seed, not a fresh split seed.

## JSONL boundary

`infer --input - --output -` supports stdin/stdout; stdout contains only JSONL.
Each request:

```json
{"schema_version":1,"request_id":"r1","episode_id":"e1","features":{"witnessed":true,"guard_present":true,"escape_open":false,"courage":0.6,"loyalty":0.8,"danger":0.4},"legal_actions":["none","report","confront"],"action":"report"}
```

Feature booleans must be actual booleans; floats must be finite in [0,1].
Legal actions must exactly match code's canonical ordered list. The conditioned
action must be legal. IDs must contain 1 to 256 UTF-16 code units (matching
TypeScript string length), and request IDs must be unique per file.
Additional nonfeature fields are ignored during inference, allowing the labeled
training JSONL to be used directly. There is no free-text model input.

Response fields: `schema_version`, echoed `request_id`, `episode_id`, `action`,
`shadow_only: true`, `choice_probabilities` over legal options (including none),
`predicted_outcome` with independent `recovered`, `alarm`, `injury` probabilities,
and `checkpoint` containing `sha256`, `variant`, `upstream_revision`.
The distribution does not authorize or execute any action. Outcomes are
predictions, not state patches. Input validation failure exits nonzero.

Labeled training input additionally requires `label_source: "synthetic_rules_v1"`,
legal `choice`, `outcome` probabilities and same-schema `next_features`.

### TypeScript shadow adapter

`src/shadow.ts` exposes `buildShadowRequest` and `parseShadowResponse`.
Build requests from an NPC-local snapshot, keep their IDs unique, serialize
them to JSONL, then pass them through the offline `infer` command. Parse each
response against the retained request and an independently computed checkpoint
SHA-256, variant and pinned upstream revision. The adapter projects only the
six permitted features and rejects invalid numbers, illegal options, mismatched
identities, non-shadow output and extra response fields.

This is a file/JSON boundary, not a live service. There is deliberately no
Python process spawned per player action and no connection to reducers or the
world RNG. IDs identify retained snapshots; they must not be reused for a changed
snapshot. `pnpm check` includes adapter typechecking and 22 boundary tests.
Python model tests remain a separate command requiring the research environment.

## Artifacts and limits

Training emits both `.pt` checkpoints, per-variant metric/history JSON, and
metadata with dependency/platform/device versions, seed, options, dataset SHA-256
and exact split episode lists. Load only trusted locally produced checkpoints;
`weights_only=True` reduces but does not eliminate all malformed-file risks.
No pretrained weights are fetched.

Evaluation reports choice accuracy/NLL and mean outcome Brier across three
binary targets. Rows are correlated within episodes; these are descriptive
metrics, not independent-sample confidence intervals.

Benchmark measures **resident batch-one model forward only**, after warmup,
with CUDA synchronization before and after each timed call. It stores raw
milliseconds, p50/p95, CUDA peak allocated/reserved bytes and parameter bytes.
JSON parsing, transfer, softmax, process startup and checkpoint load are excluded,
so this is not end-to-end service latency. A separate `request_p50_ms` /
`request_p95_ms` measurement includes JSON parsing, validation, tensor creation
and transfer, forward computation, probabilities and response serialization.
It still excludes process startup, checkpoint loading and interprocess transport.
Both timing distributions and their scopes are written to the benchmark JSON.
CPU process peak memory is explicitly
measured as process-lifetime peak RSS (Windows peak working set), including
imports and checkpoint load, not just the benchmark interval. GPU allocator
peaks include the resident model (including retained training-only OPF and EMA
modules); the audit checkpoint state dictionary stays on CPU, not duplicated
on the GPU. This is not an optimized inference export.
Checkpoint provenance hashes the same immutable bytes that are deserialized,
so replacing a checkpoint path during a run cannot relabel old predictions.

Unit tests always exercise dependency-free domain rules; actual OPF gradient,
EMA, and complete CLI smoke tests skip explicitly if torch/core are missing.
No success or latency claim should be made from skipped tests. Synthetic success
does not demonstrate better NPC behavior, causal generalization, pretrained
knowledge, calibration on Jev labels, or a production speed/cost advantage.
