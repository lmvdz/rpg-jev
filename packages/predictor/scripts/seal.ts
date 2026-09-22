/**
 * Record the sealed sets (SPEC section 16, milestone J): the SHA-256 of every file of (a), (b),
 * the gap pool, (c) and the Claude-only (c), recomputed from disk, with the dataset's versions
 * and the commit that generated it. Written before any training; the gate run checks it.
 *   node packages/predictor/scripts/seal.ts --data <dataset> --out validation/jepa-proof/sealed.json
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { sha256File } from "../src/shards.ts";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? fallback) : fallback;
}

const data = arg("data", "H:/rpg-jev.worktrees/jepa-data/v2");
const out = arg("out", "validation/jepa-proof/sealed.json");
const manifest = JSON.parse(readFileSync(join(data, "manifest.json"), "utf8"));
const splits: Record<string, unknown> = {};
for (const [name, split] of Object.entries(
  manifest.splits as Record<
    string,
    { sealed: boolean; dir: string; scenes: number; samples: number; files: Record<string, string> }
  >,
)) {
  if (!split.sealed) continue;
  const files = Object.fromEntries(
    Object.keys(split.files).map((f) => [f, sha256File(join(split.dir, f))]),
  );
  const matches = Object.entries(files).every(([f, h]) => split.files[f] === h);
  if (!matches) throw new Error(`sealed split ${name} changed since it was written`);
  splits[name] = { scenes: split.scenes, samples: split.samples, files };
}
const record = {
  version: "jepa-sealed-v1",
  sealed_at: new Date().toISOString(),
  dataset: data,
  generator_commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  observation: manifest.observation,
  outcomes: manifest.outcomes,
  scenario: manifest.scenario,
  scenes: manifest.scenes,
  split_rule: manifest.split,
  open: Object.fromEntries(
    Object.entries(
      manifest.splits as Record<
        string,
        { sealed: boolean; samples: number; files: Record<string, string> }
      >,
    )
      .filter(([, s]) => !s.sealed)
      .map(([n, s]) => [n, { samples: s.samples, files: s.files }]),
  ),
  sealed: splits,
  rule: "No training, selection or tuning code may read a sealed file. train/gate.py opens them once, at the gate run.",
};
writeFileSync(out, `${JSON.stringify(record, null, 2)}\n`);
console.log("sealed", Object.keys(splits).join(", "));
