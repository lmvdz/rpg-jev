# Family probes: generated results

Run 2026-09-17T21:56:12.670Z against `jev-1.13.0`. 12 calls, 9846 input tokens.
Each probe was asked in both wordings, 2 times each. "Shift" is the distance between the two wordings' mean answers.

| Probe | Question | Game wording (mean) | Paraphrase shift | Expectation | Met |
| --- | --- | --- | --- | --- | --- |
| distort-tobin-secret-alone | version | faithful 0.90, keep_quiet 0.07, exaggerate_severity 0.04 | 0.07 |  |  |
| distort-tobin-secret-alone-afraid | version | faithful 0.73, keep_quiet 0.24, exaggerate_severity 0.02 | 0.19 |  |  |
| distort-tobin-secret-overheard | version | keep_quiet 0.59, faithful 0.35, exaggerate_severity 0.05 | 0.38 | keep_quiet >= 0.5 | yes |

## Paraphrase shift by family

| Family | Questions | Median | Worst |
| --- | --- | --- | --- |
| pick_distortion | 3 | 0.19 | 0.38 |

Latency: median 200 ms, worst 338 ms. Mean tokens per call: 821.
