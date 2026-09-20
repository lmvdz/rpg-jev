/** Deterministic bounded engineering run. No saves, player input or model calls. */
import { createHash } from "node:crypto";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  writeFileSync,
  writeSync,
} from "node:fs";
import { resolve } from "node:path";
import { runContrasts } from "./contrasts.ts";
import { runNumericProbes } from "./numeric-probes.ts";
import { runSettlementProbes } from "./settlement-probes.ts";
import { DOMAIN, runSweep } from "./sweep.ts";

// Capture the validation entry points and their local dependency closure before evolution.
const sourceFiles = [
  "packages/core/src/thermal/physics.ts",
  "packages/core/src/thermal/fixture.ts",
  "packages/core/src/thermal/attempt.ts",
  "packages/core/src/thermal/settlement.ts",
  "packages/core/src/log.ts",
  "packages/core/src/effects.ts",
  "validation/thermal-learning/sweep.ts",
  "validation/thermal-learning/contrasts.ts",
  "validation/thermal-learning/numeric-probes.ts",
  "validation/thermal-learning/settlement-probes.ts",
  "validation/thermal-learning/validate.ts",
  "validation/thermal-learning/run.mjs",
  "packages/core/src/claims.ts",
  "packages/core/src/graph.ts",
  "packages/core/src/hash.ts",
  "packages/core/src/rng.ts",
  "packages/core/src/thermal/contract.ts",
  "packages/core/src/thermal/execution.ts",
  "packages/core/src/thermal/study-record.ts",
  "packages/core/src/types.ts",
  "packages/terminal/src/thermal-journal.ts",
  "packages/terminal/src/thermal-session.ts",
  "packages/terminal/src/thermal-surface.ts",
];
const root = resolve(import.meta.dirname, "..", "..");
const sources = Object.fromEntries(
  sourceFiles.map((path) => [
    path,
    createHash("sha256")
      .update(readFileSync(resolve(root, path)))
      .digest("hex"),
  ]),
);

const selected = process.argv.find((arg) => arg.startsWith("--out="))?.slice(6);
if (!selected)
  throw new Error("Supply --out=<new output directory>; no existing report is overwritten.");
const directory = resolve(selected);
if (existsSync(directory))
  throw new Error("Output directory already exists; choose a new run directory.");
mkdirSync(directory, { recursive: true });
const casesPath = resolve(directory, "cases.jsonl");
const file = openSync(casesPath, "wx");
const digest = createHash("sha256");
let sweep: ReturnType<typeof runSweep>;
try {
  sweep = runSweep((row) => {
    const line = `${JSON.stringify(row)}\n`;
    digest.update(line);
    writeSync(file, line);
  });
} finally {
  closeSync(file);
}
const contrasts = runContrasts();
const numeric = runNumericProbes();
const settlement = runSettlementProbes();
const complete =
  sweep.layouts === DOMAIN.placements &&
  sweep.cases === DOMAIN.placementProbeCases &&
  numeric.cases === 243 &&
  settlement.scenarios === 79;
const passed =
  complete &&
  sweep.failedCases === 0 &&
  contrasts.failures.length === 0 &&
  numeric.failures.length === 0 &&
  settlement.failures.length === 0;
const report = {
  passed,
  complete,
  node: process.version,
  domain: DOMAIN,
  sources,
  casesSha256: digest.digest("hex"),
  sweep,
  contrasts,
  numeric,
  settlement,
  limits: [
    "Complete placements/dockings only for the four-cube fixture; not all numeric values or action sequences.",
    "Endpoint accounting and stability do not establish arbitrary-time analytic accuracy.",
    "An isolated rack is ideal insulation, not outdoor cooling or bodily warmth.",
    "Engineering evidence only; no player learning, fun or in-world consequence established.",
  ],
};
writeFileSync(resolve(directory, "report.json"), `${JSON.stringify(report, null, 2)}\n`, {
  flag: "wx",
});
console.log(JSON.stringify(report, null, 2));
if (!passed) process.exitCode = 1;
