/**
 * Runs the M0 probes against live Jev and writes one results file.
 *
 *   node src/run.ts --dry               list what would run; no network
 *   node src/run.ts --smoke             one call, printed
 *   node src/run.ts                     everything
 *   node src/run.ts --only=isolation    one or more tests, comma-separated
 *   node src/run.ts --repeats=15        override every probe's repeat count
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { AuthenticationError, RateLimitError, TypeSafeClient, VERSION } from "@typesafe-ai/sdk";
import { CRITERIA } from "./criteria.ts";
import type { AnswerJson, CallRecord, Probe, RunFile } from "./probe.ts";
import { allProbes } from "./probes.ts";

const MODEL = "jev-1.13.0";
const RESULTS_DIR = join(import.meta.dirname, "..", "results");

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const option = (name: string) =>
  args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

const only = option("only")?.split(",");
const repeatsOverride = option("repeats") ? Number(option("repeats")) : null;

let probes = allProbes.filter((p) => !only || only.includes(p.meta.test));
if (flag("smoke")) probes = probes.slice(0, 1);
const repeatsOf = (p: Probe) => (flag("smoke") ? 1 : (repeatsOverride ?? p.repeats));

function summarise(): void {
  const byTest = new Map<string, { probes: number; calls: number }>();
  let chars = 0;
  for (const p of probes) {
    const entry = byTest.get(p.meta.test) ?? { probes: 0, calls: 0 };
    entry.probes += 1;
    entry.calls += repeatsOf(p);
    byTest.set(p.meta.test, entry);
    chars += (JSON.stringify(p.state).length + JSON.stringify(p.questions).length) * repeatsOf(p);
  }
  let totalCalls = 0;
  for (const [test, { probes: n, calls }] of byTest) {
    console.log(
      `${test.padEnd(14)} ${String(n).padStart(3)} probes  ${String(calls).padStart(4)} calls`,
    );
    totalCalls += calls;
  }
  const tokens = Math.round(chars / 4);
  console.log(
    `${"total".padEnd(14)} ${String(probes.length).padStart(3)} probes  ${String(totalCalls).padStart(4)} calls`,
  );
  console.log(
    `rough input size: ${tokens} tokens, about $${((tokens * 0.042) / 1e6).toFixed(4)} at list price`,
  );
}

if (flag("dry")) {
  summarise();
  process.exit(0);
}

/** Offline stand-in for Jev: random answers of the right shape, to exercise the pipeline. */
function fakeAnswers(probe: Probe): Record<string, AnswerJson> {
  const answers: Record<string, AnswerJson> = {};
  for (const [id, question] of Object.entries(probe.questions)) {
    if (question.type === "noul") {
      answers[id] = { type: "noul", noul: Math.random() };
      continue;
    }
    const labels = Array.isArray(question.criteria)
      ? question.criteria.map((_, i) => String(i))
      : Object.keys(question.criteria);
    const weights = labels.map(() => Math.random() ** 3);
    const total = weights.reduce((a, b) => a + b, 0);
    const probabilities = Object.fromEntries(labels.map((l, i) => [l, (weights[i] ?? 0) / total]));
    const top = labels.reduce((a, b) =>
      (probabilities[b] ?? 0) > (probabilities[a] ?? 0) ? b : a,
    );
    answers[id] =
      question.type === "choice"
        ? { type: "choice", choice: top, confidence: probabilities[top] ?? 0, probabilities }
        : { type: "score", score: Number(top), confidence: probabilities[top] ?? 0, probabilities };
  }
  return answers;
}

if (flag("fake")) {
  const calls: CallRecord[] = probes.flatMap((probe) =>
    Array.from({ length: repeatsOf(probe) }, (_, rep) => ({
      probeId: probe.id,
      rep,
      ok: true,
      latencyMs: 100 + Math.random() * 300,
      retries: 0,
      requestId: null,
      model: "fake",
      inputTokens: Math.round(JSON.stringify(probe.state).length / 4),
      answers: fakeAnswers(probe),
      error: null,
    })),
  );
  const now = new Date().toISOString();
  const run: RunFile = {
    startedAt: now,
    finishedAt: now,
    requestedModel: "fake",
    criteria: { ...CRITERIA },
    sdkVersion: VERSION,
    probes,
    calls,
  };
  mkdirSync(RESULTS_DIR, { recursive: true });
  const file = join(RESULTS_DIR, "fake.json");
  writeFileSync(file, `${JSON.stringify(run, null, 2)}\n`);
  console.log(`Wrote ${calls.length} fake calls to ${file}. These are random numbers, not Jev.`);
  process.exit(0);
}

if (!process.env.TYPESAFE_API_KEY) {
  console.error(
    "TYPESAFE_API_KEY is not set. Put it in H:\\rpg-jev\\.env or export it, then re-run.",
  );
  process.exit(1);
}

// Retries are handled here, not in the SDK, so a recorded latency is one attempt.
const client = new TypeSafeClient({ defaultModel: MODEL, retry: { maxRetries: 0 } });

async function callOnce(probe: Probe, rep: number): Promise<CallRecord> {
  const state = probe.nonce ? { ...probe.state, _run: `${probe.id}#${rep}` } : probe.state;
  const record: CallRecord = {
    probeId: probe.id,
    rep,
    ok: false,
    latencyMs: 0,
    retries: 0,
    requestId: null,
    model: null,
    inputTokens: null,
    answers: null,
    error: null,
  };
  for (;;) {
    const started = performance.now();
    try {
      const { data, requestId } = await client
        .systemOne({ state, questions: probe.questions, model: MODEL })
        .withResponse();
      record.latencyMs = performance.now() - started;
      record.ok = true;
      record.requestId = requestId ?? null;
      record.model = data.model;
      record.inputTokens = data.usage.input_tokens;
      record.answers = data.answers as unknown as Record<string, AnswerJson>;
      return record;
    } catch (error) {
      if (error instanceof AuthenticationError) throw error;
      if (error instanceof RateLimitError && record.retries < 3) {
        record.retries += 1;
        await new Promise((r) => setTimeout(r, error.retryAfterMs ?? 2000 * record.retries));
        continue;
      }
      record.latencyMs = performance.now() - started;
      record.error = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      return record;
    }
  }
}

summarise();
console.log("");

const startedAt = new Date();
const calls: CallRecord[] = [];
let failures = 0;

// Sequential on purpose: latency numbers stay honest and we sit far below rate limits.
for (const probe of probes) {
  for (let rep = 0; rep < repeatsOf(probe); rep++) {
    const record = await callOnce(probe, rep);
    calls.push(record);
    if (!record.ok) failures += 1;
    const status = record.ok ? `${record.latencyMs.toFixed(0)} ms` : `FAILED ${record.error}`;
    console.log(`${probe.id}#${rep}  ${status}`);
    if (flag("smoke")) console.log(JSON.stringify(record.answers, null, 2));
    if (failures >= 10 && failures === calls.length) {
      console.error("First 10 calls all failed; stopping.");
      process.exit(1);
    }
  }
}

const run: RunFile = {
  startedAt: startedAt.toISOString(),
  finishedAt: new Date().toISOString(),
  requestedModel: MODEL,
  criteria: { ...CRITERIA },
  sdkVersion: VERSION,
  probes,
  calls,
};

if (!flag("smoke")) {
  mkdirSync(RESULTS_DIR, { recursive: true });
  const stamp = startedAt.toISOString().replace(/[-:]/g, "").replace(/\..+/, "");
  const file = join(RESULTS_DIR, `run-${stamp}.json`);
  writeFileSync(file, `${JSON.stringify(run, null, 2)}\n`);
  console.log(`\n${calls.length} calls, ${failures} failed. Wrote ${file}`);
  console.log("Next: pnpm report");
}
