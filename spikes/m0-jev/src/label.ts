/**
 * Builds the reference for test 1: a panel of generative-model labellers, each
 * asked what distribution human judges would give for a scenario. The labellers
 * see exactly what Jev sees (state, instructions, options) and nothing else.
 * They never see Jev's answers or our own labels.
 *
 *   node src/label.ts            label every judgment probe
 *   node src/label.ts --dry      list what would be labelled
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { askClaude } from "./claude-cli.ts";
import { type Distribution, meanDistribution, totalVariation } from "./metrics.ts";
import type { LabelFile, LabelItem, Probe } from "./probe.ts";
import { allProbes } from "./probes.ts";

const PANEL = [
  { model: "opus", samples: 2 },
  { model: "sonnet", samples: 2 },
];
const CONCURRENCY = 4;
const LABELS_DIR = join(import.meta.dirname, "..", "labels");

const SYSTEM = [
  "You are a careful judge of how ordinary people behave and how they read language.",
  "You will get a situation as JSON, a question about it, and answer options.",
  "Estimate the probability distribution that a large panel of thoughtful human judges would give over the options.",
  "For a question about what a character does, that is the share of real people in the character's position, with those traits and circumstances, who would take each option.",
  "For a question about what a piece of text means, it is the share of readers who would pick each option.",
  "Judge what people actually do and mean, not what would be ideal.",
  "Be calibrated: use values near 0 or 1 when nearly everyone would agree, and spread the values when people would genuinely differ.",
  "Reply only through the structured output, with a probability for every option, summing to 1.",
].join(" ");

interface Task {
  probe: Probe;
  question: string;
  instructions: unknown;
  options: Record<string, unknown>;
}

function taskFor(probe: Probe): Task | null {
  if (probe.meta.test !== "judgment") return null;
  const question = probe.meta.question;
  const q = probe.questions[question];
  if (!q) throw new Error(`${probe.id}: no question ${question}`);
  if (q.type === "score") throw new Error(`${probe.id}: Score questions are not labelled`);
  const options: Record<string, unknown> =
    q.type === "noul"
      ? {
          yes: q.criteria?.true ?? "The answer is yes",
          no: q.criteria?.false ?? "The answer is no",
        }
      : q.criteria;
  return { probe, question, instructions: q.instructions ?? null, options };
}

function schemaFor(options: Record<string, unknown>): object {
  const labels = Object.keys(options);
  return {
    type: "object",
    properties: {
      probabilities: {
        type: "object",
        properties: Object.fromEntries(labels.map((l) => [l, { type: "number" }])),
        required: labels,
        additionalProperties: false,
      },
    },
    required: ["probabilities"],
    additionalProperties: false,
  };
}

function normalise(raw: Record<string, number>, labels: string[]): Distribution {
  const clipped = labels.map((l) => Math.max(0, Number(raw[l] ?? 0)));
  const total = clipped.reduce((a, b) => a + b, 0);
  if (!(total > 0)) throw new Error("labeller returned no probability mass");
  return Object.fromEntries(labels.map((l, i) => [l, (clipped[i] as number) / total]));
}

const tasks = allProbes.map(taskFor).filter((t): t is Task => t !== null);
const perTask = PANEL.reduce((a, p) => a + p.samples, 0);

if (process.argv.includes("--dry")) {
  console.log(
    `${tasks.length} scenarios x ${perTask} labellers = ${tasks.length * perTask} Claude CLI calls`,
  );
  for (const t of tasks) console.log(`  ${t.probe.id} / ${t.question}`);
  process.exit(0);
}

interface Job {
  task: Task;
  model: string;
}
const jobs: Job[] = tasks.flatMap((task) =>
  PANEL.flatMap((p) => Array.from({ length: p.samples }, () => ({ task, model: p.model }))),
);

const samples = new Map<string, { model: string; probabilities: Distribution }[]>();
let done = 0;
let failed = 0;

async function worker(): Promise<void> {
  for (;;) {
    const job = jobs.shift();
    if (!job) return;
    const { task, model } = job;
    const labels = Object.keys(task.options);
    const prompt = JSON.stringify(
      { situation: task.probe.state, question: task.instructions, options: task.options },
      null,
      2,
    );
    try {
      let result: Awaited<ReturnType<typeof askClaude<{ probabilities: Record<string, number> }>>>;
      try {
        result = await askClaude({
          model,
          system: SYSTEM,
          prompt,
          schema: schemaFor(task.options),
        });
      } catch {
        // One retry: CLI calls occasionally fail on startup contention.
        result = await askClaude({
          model,
          system: SYSTEM,
          prompt,
          schema: schemaFor(task.options),
        });
      }
      const list = samples.get(task.probe.id) ?? [];
      list.push({ model, probabilities: normalise(result.output.probabilities, labels) });
      samples.set(task.probe.id, list);
    } catch (error) {
      failed += 1;
      console.error(
        `${task.probe.id} [${model}] FAILED: ${error instanceof Error ? error.message : error}`,
      );
    }
    done += 1;
    if (done % 10 === 0 || jobs.length === 0) console.log(`${done} labelling calls done`);
  }
}

console.log(`${tasks.length} scenarios, ${jobs.length} Claude CLI calls, ${CONCURRENCY} at a time`);
const startedAt = new Date();
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

const items: LabelItem[] = [];
for (const task of tasks) {
  const list = samples.get(task.probe.id) ?? [];
  if (list.length === 0) continue;
  const distributions = list.map((s) => s.probabilities);
  let pairs = 0;
  let disagreement = 0;
  for (let i = 0; i < distributions.length; i++) {
    for (let j = i + 1; j < distributions.length; j++) {
      disagreement += totalVariation(
        distributions[i] as Distribution,
        distributions[j] as Distribution,
      );
      pairs += 1;
    }
  }
  items.push({
    probeId: task.probe.id,
    question: task.question,
    samples: list,
    mean: meanDistribution(distributions),
    panelDisagreement: pairs ? disagreement / pairs : 0,
  });
}

const file: LabelFile = {
  createdAt: startedAt.toISOString(),
  panel: PANEL,
  system: SYSTEM,
  items,
};
mkdirSync(LABELS_DIR, { recursive: true });
const stamp = startedAt.toISOString().replace(/[-:]/g, "").replace(/\..+/, "");
const path = join(LABELS_DIR, `labels-${stamp}.json`);
writeFileSync(path, `${JSON.stringify(file, null, 2)}\n`);
console.log(
  `\nLabelled ${items.length} of ${tasks.length} scenarios; ${failed} calls failed. Wrote ${path}`,
);
