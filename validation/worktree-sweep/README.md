# Preserved working-tree variants

This directory preserves exact document variants from the older attached `poc`
working tree. These are historical records, **not replacement versions** of the
current specification, sandbox design, or production source.

- `SPEC.poc-working.md`: the local combination of older renderer notes and the
  newer causal design/status changes.
- `sandbox-direction.poc-working.md`: the older local proposal with causal-design
  edits; it lacks the newer minds/graph sections already published elsewhere.
- `c0-delivery/README.md` and `c0-delivery/manifest.json`: the original handoff
  report and baseline manifest. Their source payloads are already committed at
  canonical `packages/core/...` paths on the causal-design branch. Instructions
  referring to `validation/c0-work/` describe the original staging environment.

Do not execute archived relative imports or copy these documents over newer
branch versions. The commit-sweep report identifies canonical branches and hashes.
