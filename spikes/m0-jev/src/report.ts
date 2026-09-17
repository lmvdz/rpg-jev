/**
 * Reads a results file and a labels file (the newest of each by default) and
 * writes results/REPORT.md.
 *
 *   node src/report.ts [path/to/run.json] [path/to/labels.json]
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CRITERIA } from "./criteria.ts";
import {
  type Distribution,
  distributionOf,
  mean,
  meanDistribution,
  meanProbabilityStd,
  percentile,
  sharpen,
  spearman,
  spread,
  topLabel,
  totalVariation,
} from "./metrics.ts";
import type { CallRecord, LabelFile, Probe, ProbeMeta, RunFile } from "./probe.ts";

const ROOT = join(import.meta.dirname, "..");
const RESULTS_DIR = join(ROOT, "results");
const LABELS_DIR = join(ROOT, "labels");

function newest(dir: string, prefix: string): string | null {
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir)
    .filter((f) => f.startsWith(prefix) && f.endsWith(".json"))
    .sort();
  const last = files.at(-1);
  return last ? join(dir, last) : null;
}

const runPath = process.argv[2] ?? newest(RESULTS_DIR, "run-");
if (!runPath) throw new Error(`no run-*.json in ${RESULTS_DIR}; run "pnpm spike" first`);
const run = JSON.parse(readFileSync(runPath, "utf8")) as RunFile;

const labelsPath = process.argv[3] ?? newest(LABELS_DIR, "labels-");
const labels = labelsPath ? (JSON.parse(readFileSync(labelsPath, "utf8")) as LabelFile) : null;
const reference = new Map((labels?.items ?? []).map((item) => [item.probeId, item]));

const okCalls = run.calls.filter((c) => c.ok);
const callsByProbe = new Map<string, CallRecord[]>();
for (const call of okCalls) {
  const list = callsByProbe.get(call.probeId) ?? [];
  list.push(call);
  callsByProbe.set(call.probeId, list);
}

type ProbeOf<T extends ProbeMeta["test"]> = Probe & { meta: Extract<ProbeMeta, { test: T }> };
const probesOf = <T extends ProbeMeta["test"]>(test: T) =>
  run.probes.filter((p): p is ProbeOf<T> => p.meta.test === test);

function distributions(probeId: string, question: string): Distribution[] {
  const out: Distribution[] = [];
  for (const call of callsByProbe.get(probeId) ?? []) {
    const answer = call.answers?.[question];
    if (answer) out.push(distributionOf(answer));
  }
  return out;
}

const f = (x: number, digits = 2) => (Number.isFinite(x) ? x.toFixed(digits) : "n/a");
const signed = (x: number) => `${x >= 0 ? "+" : ""}${f(x)}`;
const short = (id: string) => id.replace(/^t\d\./, "");
const lines: string[] = [];
const out = (s = "") => lines.push(s);
const summary: [string, string, string][] = [];

// --- Test 1: agreement with the reference panel ---------------------------------
interface Judged {
  probe: ProbeOf<"judgment">;
  jev: Distribution;
  ref: Distribution;
  kind: "choice" | "noul";
}
const judged: Judged[] = [];
{
  out("## Test 1: does Jev judge like the reference panel?");
  out();
  out(
    "The reference is a panel of generative-model labellers (Claude, through the CLI), each asked what distribution human judges would give. They saw exactly what Jev saw and never saw Jev's answers. Distance is total variation (0 identical, 1 disjoint). Spread is entropy over its maximum.",
  );
  out();
  out(
    "| Scenario | Jev top | Reference top | Distance | Jev spread | Reference spread | Panel disagreement |",
  );
  out("| --- | --- | --- | --- | --- | --- | --- |");
  for (const probe of probesOf("judgment")) {
    const ds = distributions(probe.id, probe.meta.question);
    const item = reference.get(probe.id);
    if (ds.length === 0 || !item) continue;
    const jev = meanDistribution(ds);
    const ref = item.mean;
    const kind = Object.keys(ref).length === 2 && "yes" in ref ? "noul" : "choice";
    judged.push({ probe, jev, ref, kind });
    const jt = topLabel(jev);
    const rt = topLabel(ref);
    out(
      `| ${short(probe.id)} | ${jt} ${f(jev[jt] ?? 0)} | ${rt} ${f(ref[rt] ?? 0)} | ${f(totalVariation(jev, ref))} | ${f(spread(jev))} | ${f(spread(ref))} | ${f(item.panelDisagreement)} |`,
    );
  }
  const tvs = judged.map((j) => totalVariation(j.jev, j.ref));
  const meanTv = mean(tvs);
  const rho = spearman(
    judged.map((j) => spread(j.jev)),
    judged.map((j) => spread(j.ref)),
  );
  const rhoOf = (kind: "choice" | "noul") => {
    const subset = judged.filter((j) => j.kind === kind);
    return spearman(
      subset.map((j) => spread(j.jev)),
      subset.map((j) => spread(j.ref)),
    );
  };
  const clear = judged.filter((j) => (j.ref[topLabel(j.ref)] ?? 0) >= CRITERIA.referenceClearCut);
  const agree = clear.filter((j) => topLabel(j.jev) === topLabel(j.ref)).length;
  const agreement = clear.length ? agree / clear.length : Number.NaN;
  const panelNoise = mean(
    judged.map((j) => reference.get(j.probe.id)?.panelDisagreement ?? Number.NaN),
  );
  const pass = judged.length
    ? meanTv <= CRITERIA.referenceMeanTv &&
      rho >= CRITERIA.referenceSpreadCorrelation &&
      agreement >= CRITERIA.referenceTopAgreement
    : null;
  out();
  out(
    `- Mean distance from the reference: ${f(meanTv)} (need ${CRITERIA.referenceMeanTv} or less). The labellers differ from each other by ${f(panelNoise)} on average, which is the noise floor.`,
  );
  out(
    `- Rank correlation of spread, Jev against reference: ${f(rho)} over ${judged.length} scenarios (need ${CRITERIA.referenceSpreadCorrelation} or more). Choices alone ${f(rhoOf("choice"))}, Nouls alone ${f(rhoOf("noul"))}.`,
  );
  out(
    `- Same top answer on clear-cut scenarios (reference top at ${CRITERIA.referenceClearCut} or more): ${agree} of ${clear.length} (need ${CRITERIA.referenceTopAgreement * 100}%).`,
  );
  const worst = [...judged]
    .sort((a, b) => totalVariation(b.jev, b.ref) - totalVariation(a.jev, a.ref))
    .slice(0, 5);
  out();
  out("Largest disagreements:");
  out();
  for (const j of worst) {
    const show = (d: Distribution) =>
      Object.keys(d)
        .sort()
        .map((k) => `${k} ${f(d[k] ?? 0)}`)
        .join(", ");
    out(`- **${short(j.probe.id)}**: Jev ${show(j.jev)}. Reference ${show(j.ref)}.`);
  }
  out();
  out(`**${pass === null ? "NO DATA" : pass ? "GO" : "NO-GO"}**`);
  out();
  summary.push([
    "1 Judges like the reference",
    pass === null ? "NO DATA" : pass ? "GO" : "NO-GO",
    `distance ${f(meanTv)}, spread correlation ${f(rho)}, top agreement ${agree}/${clear.length}`,
  ]);
}

// --- Sharpening -----------------------------------------------------------------------
{
  out("## Sharpening before sampling");
  out();
  out(
    `Jev leaves probability on options nobody would take. "Absurd mass" is the probability Jev puts on options the reference rates under ${CRITERIA.absurdBelow}, averaged over scenarios. Sharpening drops options under a cutoff and raises the rest to a power. It should cut absurd mass without pulling Jev further from the reference.`,
  );
  out();
  out(
    "| Power | Cutoff | Absurd mass | Distance from reference | Spread kept on contested scenarios |",
  );
  out("| --- | --- | --- | --- | --- |");
  const contested = judged.filter((j) => spread(j.ref) >= 0.6);
  let best: { power: number; cutoff: number; tv: number } | null = null;
  for (const power of [1, 1.5, 2, 3]) {
    for (const cutoff of [0, 0.1, 0.15, 0.2]) {
      const sharp = judged.map((j) => ({ ...j, s: sharpen(j.jev, power, cutoff) }));
      const absurd = mean(
        sharp.map((j) =>
          Object.keys(j.s).reduce(
            (a, k) => a + ((j.ref[k] ?? 0) < CRITERIA.absurdBelow ? (j.s[k] ?? 0) : 0),
            0,
          ),
        ),
      );
      const tv = mean(sharp.map((j) => totalVariation(j.s, j.ref)));
      const kept = mean(
        contested.map((j) => spread(sharpen(j.jev, power, cutoff)) / Math.max(spread(j.jev), 1e-9)),
      );
      out(`| ${power} | ${cutoff} | ${f(absurd, 3)} | ${f(tv)} | ${f(kept * 100, 0)}% |`);
      if (absurd <= CRITERIA.absurdMassTarget && (!best || tv < best.tv))
        best = { power, cutoff, tv };
    }
  }
  out();
  out(
    best
      ? `Best setting that gets absurd mass to ${CRITERIA.absurdMassTarget} or less: power ${best.power}, cutoff ${best.cutoff} (distance from reference ${f(best.tv)}).`
      : `No setting tried gets absurd mass to ${CRITERIA.absurdMassTarget} or less.`,
  );
  out();
}

// --- Test 2 -------------------------------------------------------------------------------
{
  out("## Test 2: sensitivity");
  out();
  out(
    "One added trait should move the target answer's probability in the expected direction. An irrelevant trait (control) should barely move anything.",
  );
  out();
  out(
    "| Probe | Change | Target | Expected | Base p | New p | Shift | Distance from base | Result |",
  );
  out("| --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  let hits = 0;
  let directional = 0;
  let controlsOk = 0;
  let controls = 0;
  for (const probe of probesOf("sensitivity")) {
    if (probe.meta.role === "base") continue;
    const baseDs = distributions(`t2.${probe.meta.base}.base`, probe.meta.question);
    const ds = distributions(probe.id, probe.meta.question);
    if (baseDs.length === 0 || ds.length === 0) continue;
    const base = meanDistribution(baseDs);
    const d = meanDistribution(ds);
    const tv = totalVariation(base, d);
    if (probe.meta.role === "directional") {
      directional += 1;
      const before = base[probe.meta.target] ?? 0;
      const after = d[probe.meta.target] ?? 0;
      const shift = after - before;
      const hit = (probe.meta.direction === "up" ? shift : -shift) >= CRITERIA.sensitivityMinShift;
      if (hit) hits += 1;
      out(
        `| ${short(probe.id)} | ${probe.meta.change} | ${probe.meta.target} | ${probe.meta.direction} | ${f(before)} | ${f(after)} | ${signed(shift)} | ${f(tv)} | ${hit ? "moved as expected" : "did not"} |`,
      );
    } else {
      controls += 1;
      const ok = tv <= CRITERIA.sensitivityControlTv;
      if (ok) controlsOk += 1;
      out(
        `| ${short(probe.id)} | ${probe.meta.change} | (control) | flat | | | | ${f(tv)} | ${ok ? "stayed flat" : "moved"} |`,
      );
    }
  }
  const pass =
    directional + controls > 0
      ? hits / directional >= CRITERIA.sensitivityHitRate && controlsOk === controls
      : null;
  out();
  out(
    `Directional variants that moved as expected by ${CRITERIA.sensitivityMinShift} or more: ${hits} of ${directional} (need ${CRITERIA.sensitivityHitRate * 100}%). Controls that stayed within ${CRITERIA.sensitivityControlTv}: ${controlsOk} of ${controls}.`,
  );
  out();
  out(`**${pass === null ? "NO DATA" : pass ? "GO" : "NO-GO"}**`);
  out();
  summary.push([
    "2 Sensitivity",
    pass === null ? "NO DATA" : pass ? "GO" : "NO-GO",
    `${hits}/${directional} directional, ${controlsOk}/${controls} controls`,
  ]);
}

// --- Test 3 -------------------------------------------------------------------------------
{
  out("## Test 3: paraphrase stability");
  out();
  out(
    "Same state and criteria; only the instruction wording changes. Distance is total variation between the mean distributions of two phrasings.",
  );
  out();
  out("| Family | Top answer per phrasing | Largest distance between phrasings |");
  out("| --- | --- | --- |");
  const families = new Map<string, Distribution[]>();
  for (const probe of probesOf("paraphrase")) {
    const ds = distributions(probe.id, probe.meta.question);
    if (ds.length === 0) continue;
    const list = families.get(probe.meta.family) ?? [];
    list.push(meanDistribution(ds));
    families.set(probe.meta.family, list);
  }
  const worstPerFamily: number[] = [];
  for (const [family, ds] of families) {
    let worst = 0;
    for (let i = 0; i < ds.length; i++) {
      for (let j = i + 1; j < ds.length; j++) {
        worst = Math.max(worst, totalVariation(ds[i] as Distribution, ds[j] as Distribution));
      }
    }
    worstPerFamily.push(worst);
    const tops = ds.map((d) => `${topLabel(d)} ${f(d[topLabel(d)] ?? 0)}`).join("; ");
    out(`| ${family} | ${tops} | ${f(worst)} |`);
  }
  const median = percentile(worstPerFamily, 50);
  const worst = Math.max(...worstPerFamily, Number.NEGATIVE_INFINITY);
  const pass = worstPerFamily.length
    ? median <= CRITERIA.paraphraseMedianTv && worst <= CRITERIA.paraphraseWorstTv
    : null;
  out();
  out(
    `Median ${f(median)} (need ${CRITERIA.paraphraseMedianTv} or less), worst ${f(worst)} (need ${CRITERIA.paraphraseWorstTv} or less).`,
  );
  out();
  out(`**${pass === null ? "NO DATA" : pass ? "GO" : "NO-GO"}**`);
  out();
  summary.push([
    "3 Paraphrase",
    pass === null ? "NO DATA" : pass ? "GO" : "NO-GO",
    `median ${f(median)}, worst ${f(worst)}`,
  ]);
}

// --- Test 4 -------------------------------------------------------------------------------
{
  out("## Test 4: knowledge isolation");
  out();
  out(
    "A secret sits in one NPC's `knows`. The question is about a different NPC and says to use only that NPC's `knows`. A **knowledge leak** is movement in the direction that knowing the secret would cause. A **context shift** is movement in either direction, which means the rest of the scene is nudging the answer.",
  );
  out();
  out(
    "| Case | Watched answer | Secret absent | Secret present | Shift | Leak direction | Knowledge leak | Alone in state | Knower's answer |",
  );
  out("| --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  const cases = new Map<string, ProbeOf<"isolation">[]>();
  for (const probe of probesOf("isolation")) {
    const list = cases.get(probe.meta.caseId) ?? [];
    list.push(probe);
    cases.set(probe.meta.caseId, list);
  }
  let worstLeak = 0;
  let worstShift = 0;
  let worstBatch = 0;
  let legible = true;
  let counted = 0;
  for (const [caseId, probes] of cases) {
    const p = (variant: string, question: string, option: string) => {
      const probe = probes.find((x) => x.meta.variant === variant);
      if (!probe) return Number.NaN;
      const ds = distributions(probe.id, question);
      return ds.length ? (meanDistribution(ds)[option] ?? 0) : Number.NaN;
    };
    const meta = (probes[0] as ProbeOf<"isolation">).meta;
    const clean = p("clean", meta.question, meta.leakOption);
    const leak = p("leak", meta.question, meta.leakOption);
    const solo = p("solo", meta.question, meta.leakOption);
    const leakProbe = probes.find((x) => x.meta.variant === "leak");
    const control = leakProbe?.meta.control
      ? p("leak", leakProbe.meta.control, meta.controlOption)
      : Number.NaN;
    if (!Number.isFinite(clean) || !Number.isFinite(leak)) continue;
    counted += 1;
    const shift = leak - clean;
    const knowledge = Math.max(0, meta.leakDirection === "up" ? shift : -shift);
    worstLeak = Math.max(worstLeak, knowledge);
    worstShift = Math.max(worstShift, Math.abs(shift));
    if (Number.isFinite(solo)) worstBatch = Math.max(worstBatch, Math.abs(clean - solo));
    if (!(control >= CRITERIA.isolationControlLegible)) legible = false;
    out(
      `| ${caseId} | p(${meta.leakOption}) | ${f(clean)} | ${f(leak)} | ${signed(shift)} | ${meta.leakDirection} | ${f(knowledge)} | ${f(solo)} | ${f(control)} |`,
    );
  }
  const leakOk = worstLeak <= CRITERIA.isolationMaxKnowledgeLeak && legible;
  const shiftOk = worstShift <= CRITERIA.isolationMaxContextShift;
  const result = !counted ? "NO DATA" : !leakOk ? "NO-GO" : shiftOk ? "GO" : "CAUTION";
  out();
  out(
    `- Worst knowledge leak: ${f(worstLeak)} (need ${CRITERIA.isolationMaxKnowledgeLeak} or less). Every knower's own answer must reach ${CRITERIA.isolationControlLegible}, or the secret was not legible: ${legible ? "all legible" : "at least one was not"}.`,
  );
  out(
    `- Worst context shift: ${f(worstShift)} (want ${CRITERIA.isolationMaxContextShift} or less). Over that is CAUTION, not failure: no knowledge crossed, but the scene around an NPC moves its answer.`,
  );
  out(`- Worst gap between a batched scene and the NPC alone in the state: ${f(worstBatch)}.`);
  out();
  out(`**${result}**`);
  out();
  summary.push([
    "4 Isolation",
    result,
    `knowledge leak ${f(worstLeak)}, context shift ${f(worstShift)}`,
  ]);
}

// --- Intent accuracy ----------------------------------------------------------------------
{
  out("## Intent parsing accuracy");
  out();
  out("| Player text | Expected | Got (verb, target) | Confidence (verb, target) |");
  out("| --- | --- | --- | --- |");
  let right = 0;
  let total = 0;
  for (const probe of probesOf("intent")) {
    for (const call of callsByProbe.get(probe.id) ?? []) {
      const verb = call.answers?.verb;
      const target = call.answers?.target;
      if (verb?.type !== "choice" || target?.type !== "choice") continue;
      total += 1;
      const ok =
        verb.choice === probe.meta.expected.verb && target.choice === probe.meta.expected.target;
      if (ok) right += 1;
      if (call.rep === 0) {
        const text = (probe.state.player_input as { text: string }).text;
        out(
          `| ${text} | ${probe.meta.expected.verb}, ${probe.meta.expected.target} | ${verb.choice}, ${target.choice}${ok ? "" : " (miss)"} | ${f(verb.confidence)}, ${f(target.confidence)} |`,
        );
      }
    }
  }
  out();
  out(`${right} of ${total} calls parsed both verb and target correctly.`);
  out();
}

// --- Measurements -------------------------------------------------------------------------
{
  out("## Measurements");
  out();
  const latencies = okCalls.map((c) => c.latencyMs);
  out(
    `- **Latency** over ${okCalls.length} successful calls, one attempt each, from this machine: p50 ${f(percentile(latencies, 50), 0)} ms, p90 ${f(percentile(latencies, 90), 0)} ms, p99 ${f(percentile(latencies, 99), 0)} ms, max ${f(Math.max(...latencies), 0)} ms.`,
  );
  const tokens = okCalls.map((c) => c.inputTokens ?? 0);
  const totalTokens = tokens.reduce((a, b) => a + b, 0);
  out(
    `- **Input tokens per call:** mean ${f(mean(tokens), 0)}, max ${Math.max(...tokens)}. Total ${totalTokens}, which is $${f((totalTokens * 0.042) / 1e6, 4)} at list price.`,
  );
  for (const probe of probesOf("scale")) {
    const calls = callsByProbe.get(probe.id) ?? [];
    if (calls.length === 0) continue;
    out(
      `- **Batched scene** with ${probe.meta.npcs} NPCs and ${Object.keys(probe.questions).length} questions in one call: ${f(mean(calls.map((c) => c.inputTokens ?? 0)), 0)} input tokens, ${f(mean(calls.map((c) => c.latencyMs)), 0)} ms on average.`,
    );
  }
  const failed = run.calls.length - okCalls.length;
  const retried = run.calls.filter((c) => c.retries > 0).length;
  out(
    `- **Failures:** ${failed} of ${run.calls.length} calls failed; ${retried} needed a rate-limit retry.`,
  );
  out(
    `- **Model that answered:** ${[...new Set(okCalls.map((c) => c.model))].join(", ")} (requested ${run.requestedModel}).`,
  );

  const stds: number[] = [];
  let flips = 0;
  let repeated = 0;
  for (const probe of run.probes) {
    if (!probe.nonce || !("question" in probe.meta)) continue;
    const ds = distributions(probe.id, probe.meta.question);
    if (ds.length < 2) continue;
    repeated += 1;
    stds.push(meanProbabilityStd(ds));
    if (new Set(ds.map(topLabel)).size > 1) flips += 1;
  }
  out(
    `- **Run-to-run variance** over ${repeated} repeated probes: mean std of an answer's probability ${f(mean(stds), 4)}, worst ${f(Math.max(...stds, 0), 4)}. The top answer changed between repeats on ${flips} probes.`,
  );
  for (const probe of probesOf("determinism")) {
    const ds = distributions(probe.id, probe.meta.question);
    if (ds.length < 2) continue;
    let worst = 0;
    for (const d of ds) worst = Math.max(worst, totalVariation(ds[0] as Distribution, d));
    out(
      `- **Byte-identical requests** (${probe.id}, ${ds.length} sends): ${worst === 0 ? "identical answers every time" : `answers differed by up to ${f(worst, 4)}`}.`,
    );
  }
  out();
}

const tail = (p: string) => p.replaceAll("\\", "/").split("/").slice(-2).join("/");
const header = [
  "# Spike M0 results",
  "",
  `Run file: \`${tail(runPath)}\`, started ${run.startedAt}, SDK ${run.sdkVersion}. Reference labels: ${labelsPath ? `\`${tail(labelsPath)}\`` : "none"}.`,
  "",
  "| Test | Verdict | Key numbers |",
  "| --- | --- | --- |",
  ...summary.map(([test, v, numbers]) => `| ${test} | ${v} | ${numbers} |`),
  "",
  `Pass criteria are version ${CRITERIA.version}, fixed in \`src/criteria.ts\` before the run and copied into the run file. The reference panel is generative models standing in for human judgment; it is not human judgment.`,
  "",
];

const report = [...header, ...lines].join("\n");
writeFileSync(join(RESULTS_DIR, "REPORT.md"), report);
console.log(report);
