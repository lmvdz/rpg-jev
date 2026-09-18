/**
 * Runs the family probes against live Jev and writes results plus a table.
 *
 *   node src/run.ts --dry          list the probes and a rough cost; no network
 *   node src/run.ts                everything, both wordings, REPEATS times each
 *   node src/run.ts --only=speech  probes whose id starts with the given text
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { hashValue, type JudgeAnswer } from "@rpg-jev/core";
import {
  buildRequest,
  estimateRequestTokens,
  type Json,
  LiveJudge,
  USD_PER_INPUT_TOKEN,
  type Variant,
  wireQuestions,
} from "@rpg-jev/jev";
import { PROBES, type Probe } from "./probes.ts";

const REPEATS = 2;
const RESULTS = join(import.meta.dirname, "..", "results");
const args = process.argv.slice(2);
const only = args.find((a) => a.startsWith("--only="))?.slice(7);
const probes = PROBES.filter((p) => !only || p.id.startsWith(only));

const requestFor = (probe: Probe, variant: Variant) =>
  buildRequest(probe.state, hashValue(probe.state), probe.questions(variant));

if (args.includes("--dry")) {
  let tokens = 0;
  for (const p of probes)
    for (const v of [0, 1] as const) {
      const r = requestFor(p, v);
      const wire = wireQuestions(r.questions) as unknown as Json;
      tokens += REPEATS * estimateRequestTokens(r.state, wire, Object.keys(r.questions).length);
    }
  console.log(`${probes.length} probes, ${probes.length * 2 * REPEATS} calls`);
  console.log(`about ${tokens} tokens, $${(tokens * USD_PER_INPUT_TOKEN).toFixed(4)}`);
  process.exit(0);
}

/** Probability of `option` in an answer; for a Noul, "yes" is the noul itself. */
function mass(answer: JudgeAnswer | undefined, option: string): number {
  if (!answer) return Number.NaN;
  if (answer.type === "noul") return option === "yes" ? answer.noul : 1 - answer.noul;
  return answer.probabilities[option] ?? 0;
}

/** Total variation distance between two answers to the same question. */
function distance(a: JudgeAnswer | undefined, b: JudgeAnswer | undefined): number {
  if (!(a && b)) return Number.NaN;
  if (a.type === "noul" && b.type === "noul") return Math.abs(a.noul - b.noul);
  if (a.type !== "choice" || b.type !== "choice") return Number.NaN;
  const keys = new Set([...Object.keys(a.probabilities), ...Object.keys(b.probabilities)]);
  let sum = 0;
  for (const k of keys) sum += Math.abs((a.probabilities[k] ?? 0) - (b.probabilities[k] ?? 0));
  return sum / 2;
}

function mean(answers: (JudgeAnswer | undefined)[]): JudgeAnswer | undefined {
  const present = answers.filter((a): a is JudgeAnswer => a !== undefined);
  const first = present[0];
  if (!first) return undefined;
  if (first.type === "noul") {
    const nouls = present.map((a) => (a.type === "noul" ? a.noul : 0));
    return { type: "noul", noul: nouls.reduce((x, y) => x + y, 0) / nouls.length };
  }
  const probabilities: Record<string, number> = {};
  for (const a of present)
    if (a.type === "choice")
      for (const [k, p] of Object.entries(a.probabilities))
        probabilities[k] = (probabilities[k] ?? 0) + p / present.length;
  const choice = Object.entries(probabilities).sort((x, y) => y[1] - x[1])[0]?.[0] ?? "";
  return { type: "choice", choice, confidence: 0, probabilities };
}

const judge = new LiveJudge({ timeoutMs: 10_000 });
const started = new Date();
const rows: {
  probe: string;
  family: string;
  variant: Variant;
  rep: number;
  tokens: number;
  latencyMs: number;
  answers: Record<string, JudgeAnswer>;
}[] = [];

for (const probe of probes)
  for (const variant of [0, 1] as const)
    for (let rep = 0; rep < REPEATS; rep++) {
      const response = await judge.ask(requestFor(probe, variant));
      rows.push({
        probe: probe.id,
        family: probe.family,
        variant,
        rep,
        tokens: response.inputTokens,
        latencyMs: response.latencyMs,
        answers: response.answers,
      });
      console.log(`${probe.id} v${variant}#${rep}  ${response.latencyMs} ms`);
    }

const fmt = (answer: JudgeAnswer | undefined): string => {
  if (!answer) return "-";
  if (answer.type === "noul") return `yes ${answer.noul.toFixed(2)}`;
  return Object.entries(answer.probabilities)
    .sort((a, b) => b[1] - a[1])
    .filter(([, p]) => p >= 0.005)
    .map(([k, p]) => `${k} ${p.toFixed(2)}`)
    .join(", ");
};

const lines = [
  "# Family probes: generated results",
  "",
  `Run ${started.toISOString()} against \`jev-1.13.0\`. ${rows.length} calls, ${rows.reduce((a, r) => a + r.tokens, 0)} input tokens.`,
  "Each probe was asked in both wordings, " +
    `${REPEATS} times each. "Shift" is the distance between the two wordings' mean answers.`,
  "",
  "| Probe | Question | Game wording (mean) | Paraphrase shift | Expectation | Met |",
  "| --- | --- | --- | --- | --- | --- |",
];
const shifts: Record<string, number[]> = {};
for (const probe of probes) {
  const of = (v: Variant) => rows.filter((r) => r.probe === probe.id && r.variant === v);
  const ids = Object.keys(probe.questions(0));
  for (const q of ids) {
    const a = mean(of(0).map((r) => r.answers[q]));
    const b = mean(of(1).map((r) => r.answers[q]));
    const shift = distance(a, b);
    shifts[probe.family] = [...(shifts[probe.family] ?? []), shift];
    let expectation = "";
    let met = "";
    if (probe.expect?.question === q) {
      const p = mass(a, probe.expect.option);
      const { min, max } = probe.expect;
      expectation = `${probe.expect.option} ${min === undefined ? `<= ${max}` : `>= ${min}`}`;
      met = (min === undefined || p >= min) && (max === undefined || p <= max) ? "yes" : "NO";
    }
    lines.push(
      `| ${probe.id} | ${q} | ${fmt(a)} | ${shift.toFixed(2)} | ${expectation} | ${met} |`,
    );
  }
}
lines.push(
  "",
  "## Paraphrase shift by family",
  "",
  "| Family | Questions | Median | Worst |",
  "| --- | --- | --- | --- |",
);
for (const [family, values] of Object.entries(shifts)) {
  const sorted = [...values].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  lines.push(
    `| ${family} | ${values.length} | ${median.toFixed(2)} | ${(sorted.at(-1) ?? 0).toFixed(2)} |`,
  );
}
const latencies = rows.map((r) => r.latencyMs).sort((a, b) => a - b);
lines.push(
  "",
  `Latency: median ${latencies[Math.floor(latencies.length / 2)]} ms, worst ${latencies.at(-1)} ms. Mean tokens per call: ${Math.round(rows.reduce((a, r) => a + r.tokens, 0) / rows.length)}.`,
  "",
);

mkdirSync(RESULTS, { recursive: true });
const stamp = started.toISOString().replace(/[-:]/g, "").replace(/\..+/, "");
writeFileSync(
  join(RESULTS, `run-${stamp}.json`),
  `${JSON.stringify({ started, rows }, null, 1)}\n`,
);
writeFileSync(join(RESULTS, "REPORT.md"), lines.join("\n"));
console.log(`\nWrote results/REPORT.md and results/run-${stamp}.json`);
