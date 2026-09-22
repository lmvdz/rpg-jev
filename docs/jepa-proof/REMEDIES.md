# J1 remedies, pre-registered

Written 2026-09-22, after J1's single run failed and before either remedy was trained. The J1 result is `validation/jepa-proof/j1.json`.

## The failure

On the withheld families (b), averaged over seeds 17, 29 and 43:

| Check | JEPA | Supervised | Pass? |
| --- | --- | --- | --- |
| Top-1 ≥ 70% | 91.9% | 92.8% | yes |
| Top-1 above the majority rate (76.95%) | 91.9% | — | yes |
| Brier lower than supervised | 0.1354 | 0.1197 | **no** |
| Envelope rejects the top choice < 5% | 0.04% | 0.15% | yes |

The JEPA arm composes to unseen families, but it is less well calibrated than the supervised baseline. The gap is largest on heat × liquid (B1): top-1 86.9% against 89.0%.

## Rules for both remedies

- The brief allows at most two, each from its list (more data diversity, model capacity, relational structure).
- Each is decided here, before it runs, and changes nothing else.
- Each trains both arms on seeds 17, 29 and 43 with 20 epochs, keeps each run's best validation-NLL epoch, and runs J1 once by the same `gate.py`.
- The sealed sets are not used to choose anything: no seed filtering, epoch picking or coefficient changes.
- If R1 passes J1, R2 is not run. If both fail, J1 is reported as failed with all three results.
- The integrated checkpoint for P6–P8 stays the validation-selected JEPA seed of the original run (jepa-43). A remedy that passes is reported as the candidate for the next integration, not swapped in silently.

## R1: model capacity

Both arms are widened, and still capacity-matched within 10%:

| Setting | Before | R1 |
| --- | --- | --- |
| Latent | 32 | 64 |
| Encoder hidden | 64 | 128 |
| Supervised trunk | 64 | 128 |
| JEPA factors | K = 4, r = 8 | K = 8, r = 8 |
| JEPA factor-head hidden | 20 | 20 |

This gives about 59,700 parameters for supervised and 59,900 for JEPA. Everything else is unchanged: the data, the loss, EMA 0.996, the OPF weights 0.10 / 0.05 / 0.02, AdamW at lr 1e-3, batch 1,024.

The rationale: OPF splits the latent into factors each predicted separately, and at 4 × 8 each factor has little room. Doubling K at a fixed r lets factors specialise, which is the mechanism the paper credits for transfer.

## R2: data diversity

1,200,000 more scenes from fresh seeds [1,200,000, 2,400,000), from the same generator (`jepa-scenario-v2`) and the same split rule:
- Only their train bucket is added to training.
- Their validation and (a) buckets are excluded, and so are their withheld-family and gap scenes. None of these are used anywhere.

The original sizes and every other setting are unchanged.

The rationale: composition to unseen families may be limited by how many distinct element and state combinations the seen families cover. This doubles them.
