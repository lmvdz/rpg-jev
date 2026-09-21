# Local CPU validation

Executed on Windows 10 build 26200, Python 3.11.8, PyTorch 2.14.0+cpu,
upstream `jepa-anything-core` 0.3.0 installed from immutable revision
`c6e6c88f3ef75a4ce7acd660d6fa5779d995512c`. CPU reported as Intel64 Family 6
Model 151 Stepping 2; one Torch thread. This records a bounded functional test,
not evidence for replacing Jev.

- Six Python tests passed with **zero skips**, including upstream OPF gradients,
  stop-gradient target encoder, EMA arithmetic, and subprocess training,
  checkpoint load, evaluation, JSONL inference and benchmark for both variants.
- Dependency-free Python separately passed four domain tests and explicitly
  skipped two model tests before installation.
- A paired CPU run used 500 generated episodes, seed 17, 20 epochs, defaults
  (width 32, batch 64, AdamW learning rate .001, JEPA weight .1).
  Test partition had 37 episodes / 109 intervention rows.

| Variant | Test choice accuracy | Test NLL | Outcome Brier | Forward p50 ms | Forward p95 ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| Supervised baseline | 1.000 | 0.261744 | 0.016473 | 0.0425 | 0.0550 |
| JEPA auxiliary | 1.000 | 0.260311 | 0.021544 | 0.0428 | 0.0641 |

The JEPA variant had **worse outcome Brier** in this single-seed run. Do not infer
a benefit from its slightly lower NLL. This task is intentionally simple and
all labels are deterministic synthetic rules, not Jev or human judgments.

Timing is resident batch-one forward only, 20 warmup / 200 measured calls,
excluding process startup, JSON, transfer and probability serialization. Both
variants use the same forward architecture. Observed process-lifetime peak
working set: baseline 199,319,552 bytes; JEPA 200,884,224 bytes. This includes
imports and checkpoint loading, not just model tensors.

Artifacts are local and ignored under `artifacts/cpu-run/`:
per-variant metrics/history, checkpoints, raw benchmark samples and metadata.
Benchmark checkpoint hashes:

- baseline: `c027db93050b3ffd30e3ac06cafcf16fbcc261ffaa3bb50fc4e8fe510bf15552`
- JEPA: `25511b76f49352cda1e2b9e95bebc7258fbd5dc6dc63475dbacaefae7e36e451`

The CPU wheel warned on stderr that NumPy is absent. These tests use only
PyTorch tensor operations; NumPy is intentionally not an added dependency.
No CUDA, Lambda, multi-seed statistical, actual Jev-label, or live-game
validation is claimed by this CPU report.

## RTX 4070 Ti validation

Executed separately on the visible local NVIDIA GeForce RTX 4070 Ti,
12,282 MiB reported device memory, driver 610.47, Windows, Python 3.11.8,
PyTorch **2.10.0+cu128**, CUDA runtime 12.8, same pinned core revision.
The root `.venv` was created for this run with:

```sh
python -m venv .venv
.venv/Scripts/python.exe -m pip install torch==2.10.0 --index-url https://download.pytorch.org/whl/cu128
.venv/Scripts/python.exe -m pip install -r spikes/jepa-world-model/requirements.txt
```

Both variants trained on CUDA with the same 500 episodes, seed 17, 20 epochs
and default hyperparameters as above. Test choice accuracy was 1.0 for both;
NLL/Brier reproduced the CPU results at the precision shown above. This is
only an implementation check on the toy task, not a JEPA quality improvement.

Benchmarks used 100 warmup and 1,000 measured calls per timing scope:

| Variant | Forward p50 ms | Forward p95 ms | Resident request p50 ms | Resident request p95 ms |
| --- | ---: | ---: | ---: | ---: |
| Supervised baseline | 0.3156 | 0.8462 | 0.5765 | 1.4361 |
| JEPA auxiliary | 0.2985 | 0.8185 | 0.5221 | 1.3749 |

Forward means resident tensor computation only. Resident request includes JSON
parsing, schema validation, tensor creation/transfer, forward, probabilities,
and response serialization, but excludes process startup, checkpoint loading
and interprocess transport. CUDA was synchronized around each measurement.
This is a single run, not a controlled performance comparison; the models
share their inference architecture. The earlier CPU forward measurements
were faster than CUDA for this tiny network.

Peak CUDA allocations were 8,543,232 bytes for baseline and 8,553,472 bytes
for JEPA; reserved allocator memory was 23,068,672 bytes for each. These are
PyTorch allocator measurements, **not total GPU driver/context memory**.
Peak process working sets were 954,032,128 and 955,424,768 bytes respectively.
Retained OPF/EMA parameters are included, but no second GPU checkpoint copy.

A separate single fresh-process invocation (Python/PyTorch startup, checkpoint
load, CUDA initialization, one stdin request and stdout response) took
**2,146 ms**. That is one observation, not a startup percentile. A live adapter
must keep a model resident; spawning Python per action would erase the benefit.

Verification after review fixes:

- `pnpm check`: all 50 TypeScript tests passed, plus lint and typechecking.
- Nine Python tests passed, zero skips, using the CUDA-enabled installation
  (unit tests themselves use CPU).
- All **1,486** generated intervention requests ran through CUDA inference;
  every actual response passed `parseShadowResponse` with its original request
  and an independently computed checkpoint digest.
- Tests cover target stop-gradient/EMA, ignored labels/future/text, checkpoint
  snapshot hashing and incompatible schema, changed dataset rejection and
  checkpoint-owned evaluation split seed.

Local ignored artifacts: `runs/4070ti/scenarios.jsonl`, `models/`, both
`*-benchmark.json` files (raw timing samples included), and `predictions.jsonl`.
Checkpoint SHA-256:

- baseline: `12c75beb26a6254b229ec32a0e36d7c67d17441bbdbefa4582f6e33984b686a6`
- JEPA: `8990060007f1ae32c95a60f73b9c6dbda0a41f04bf9f610fd9ab51006d0f5dfc`

No Lambda resources were provisioned or benchmarked. No project data was
uploaded. Real decision labels, unseen scenario families, multi-step rollout
quality, calibration and a live resident service remain future work.
