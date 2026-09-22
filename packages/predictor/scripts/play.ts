/**
 * Milestone J, P7: play on the live flag and collect post-training labels (brief decision 6).
 * Sessions run the shared world's live settle, the code path the server runs, on scripted and
 * randomised worlds (seeds from 5,000,000,000, disjoint from every dataset seed). Each ranked
 * transition is checked for the four signals, and every label comes from outside the model:
 *
 * - the envelope rejected the model's top choice over the full vocabulary: the engine's label;
 * - an invariant broke and the act fell back to the engine: the engine's label;
 * - the model's chosen outcome had probability below 0.5 (low confidence): the engine's label;
 * - the engine's domain gate declined the act (a gap): Claude proposes, code validates, Jev
 *   believes, as for set (c).
 *
 * Scenes whose observations match any sealed (c) observation are dropped. Writes two open
 * splits, `post` (engine labels) and `post-gap` (believed gap labels), and a summary.
 *   node --env-file=<.env> packages/predictor/scripts/play.ts --checkpoint <runtime.json>
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as jepa from "@rpg-jev/core/jepa";
import * as matter from "@rpg-jev/core/matter";
import { Rng } from "@rpg-jev/core/rng";
import { LiveJudge } from "@rpg-jev/jev";
import { believe } from "../src/believe.ts";
import { askClaudeAsync } from "../src/claude.ts";
import { encodeScene } from "../src/encode.ts";
import {
  CONTROLS,
  claimFor,
  type Proposable,
  parseProposal,
  proposable,
  proposalPrompt,
  validates,
} from "../src/label.ts";
import { parseModel, scorerOf } from "../src/runtime.ts";
import { addScene, chunkFiles, emptyChunk, FILES, sha256File } from "../src/shards.ts";

const SESSIONS_FROM = 5_000_000_000;
const RATIFY = 0.6;

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? fallback) : fallback;
}

interface Capture {
  observations: readonly Float64Array[];
  legal: readonly jepa.Legal[];
  scores: jepa.Scores | null;
}

/** The scorer, remembering what it was last shown and what it answered. */
function instrumented(inner: jepa.Scorer) {
  let last: Capture | null = null;
  const scorer: jepa.Scorer = (observations, legal) => {
    const scores = inner(observations, legal);
    last = { observations, legal, scores };
    return scores;
  };
  return { scorer, take: () => last };
}

type Signal = "rejected" | "invariant" | "low" | "gap";

/** Per thing: the envelope rejects the unmasked top choice, or the drawn outcome is unlikely. */
function thingSignals(scores: Float64Array, legal: jepa.Legal, chosen: jepa.Outcome): Signal[] {
  const out: Signal[] = [];
  let p = 1;
  let rejected = false;
  jepa.CHANNELS.forEach((c, ch) => {
    const o = jepa.CLASS_OFFSETS[ch] ?? 0;
    const flags = legal[ch] ?? [];
    let top = 0;
    let total = 0;
    for (let k = 0; k < c.classes.length; k++) {
      if ((scores[o + k] ?? 0) > (scores[o + top] ?? 0)) top = k;
      if (flags[k]) total += scores[o + k] ?? 0;
    }
    if (!flags[top]) rejected = true;
    p *= total > 0 ? (scores[o + (chosen[ch] ?? 0)] ?? 0) / total : 0;
  });
  if (rejected) out.push("rejected");
  if (p < 0.5) out.push("low");
  return out;
}

interface Transition {
  scenario: jepa.Scenario;
  signals: Signal[];
}

/** The scripted session's world: the starting pool's own elements, in a small yard. */
function scriptedWorld(seed: number): { world: matter.MatterWorld; acts: matter.Act[] } {
  const d = Rng.fromSeed(seed);
  const world = matter.worldOf(matter.POOL, [
    matter.placeOf("site", { temperature: 1 + Math.floor(d.next() * 3) }),
  ]);
  const put = (
    id: string,
    element: string,
    where: [number, number],
    state: Partial<matter.ThingState> = {},
  ) => {
    world.things[id] = { id, element, place: "site", where, state: { ...matter.FRESH, ...state } };
  };
  put("stone", "stone", [1, 1], { temperature: 1 + Math.floor(d.next() * 3) });
  put("water", "water", [2, 1], { amount: 2 + Math.floor(d.next() * 3) });
  put("oil", "oil", [3, 1], { amount: 2 });
  put("blade", "blade", [1, 2]);
  put("flint", "flint", [2, 2]);
  put("branch", "branch", [3, 2], { amount: 2 });
  world.things.branch = matter.alight(world, world.things.branch as matter.Thing);
  put("berries", "berries", [1, 3]);
  const acts: matter.Act[] = [
    { process: "heat", source: "branch", target: "blade", minutes: 5, contact: 1 },
    { process: "soak", liquid: "water", target: "stone", amount: 1 },
    { process: "force", instrument: "stone", patient: "water", manner: matter.ORDINARY },
    { process: "coat", substance: "oil", target: "blade", amount: 1, manner: matter.ORDINARY },
    { process: "force", instrument: "flint", patient: "stone", manner: matter.ORDINARY },
    { process: "soak", liquid: "stone", target: "branch", amount: 1 },
    { process: "drift", minutes: 5 },
    { process: "soak", liquid: "water", target: "branch", amount: 2 },
    { process: "coat", substance: "flint", target: "berries", amount: 1 },
    { process: "heat", source: "blade", target: "water", minutes: 3, contact: 1 },
  ];
  return { world, acts };
}

function session(
  seed: number,
  steps: number,
  scripted: boolean,
  model: ReturnType<typeof parseModel>,
): Transition[] {
  const capture = instrumented(scorerOf(model, { deadlineMs: 1e9, now: () => 0 }));
  const settle = jepa.rankedSettle("live", capture.scorer, model.id);
  const start = scripted ? scriptedWorld(seed) : null;
  let world = start ? start.world : jepa.scenario(seed).world;
  let rng = Rng.fromSeed(seed).state;
  const out: Transition[] = [];
  for (let step = 0; step < steps; step++) {
    const act = start ? start.acts[step % start.acts.length] : actFor(world, seed, step);
    const view = act && jepa.viewOf(act);
    if (!(act && view)) continue;
    const engine = matter.resolve(world, act);
    const gap = jepa.isGap(world, act, engine.changes);
    const settled = settle(world, act, rng);
    const note = settled.note as jepa.RankedNote | undefined;
    const cap = capture.take();
    const signals = new Set<Signal>();
    if (gap) signals.add("gap");
    if (note?.record.fallback === "invariant") signals.add("invariant");
    if (cap?.scores && note)
      note.record.choices.forEach((c, i) => {
        const scores = cap.scores?.[i];
        const legal = cap.legal[i];
        if (scores && legal)
          for (const s of thingSignals(scores, legal, jepa.outcomeOf(c.chosen))) signals.add(s);
      });
    if (signals.size > 0)
      out.push({ scenario: { seed: seed * 64 + step, world, act, view }, signals: [...signals] });
    world = settled.outcome.world;
    rng = settled.rng;
  }
  return out;
}

function actFor(world: matter.MatterWorld, seed: number, step: number): matter.Act | null {
  if (step % 4 === 3) return { process: "drift", minutes: [1 / 600, 1, 5, 30][step % 3] ?? 1 };
  return jepa.actFor(world, seed * 7919 + step)?.act ?? null;
}

/** Observation keys of every sealed (c) input, so play never trains on a sealed case. */
function sealedKeys(data: string): Set<string> {
  const meta = new Uint32Array(
    readFileSync(join(data, "sealed", "c-claude", "meta.u32")).buffer.slice(0),
  );
  const keys = new Set<string>();
  for (let i = 1; i < meta.length; i += 2) {
    const s = jepa.scenario(meta[i] as number);
    for (const t of Object.values(s.world.things))
      keys.add(jepa.observe(s.world, t, s.view).join(","));
  }
  return keys;
}

function touchesSealed(s: jepa.Scenario, keys: Set<string>): boolean {
  return Object.values(s.world.things).some((t) =>
    keys.has(jepa.observe(s.world, t, s.view).join(",")),
  );
}

async function labelGaps(gaps: jepa.Scenario[], ledger: string) {
  const all = gaps.map((s) => proposable(s));
  const kept: { p: Proposable; outcomes: Map<string, jepa.Outcome> }[] = [];
  const batches: Proposable[][] = [];
  for (let i = 0; i < all.length; i += 10) batches.push(all.slice(i, i + 10));
  const work = async () => {
    for (let batch = batches.shift(); batch; batch = batches.shift()) {
      const reply = await askClaudeAsync(proposalPrompt(batch));
      const parsed = reply ? parseProposal(reply, batch) : new Map();
      for (const p of batch) {
        const outcomes = parsed.get(p.seed);
        if (outcomes && validates(p, outcomes)) kept.push({ p, outcomes });
      }
      console.log(`gap proposals kept ${kept.length}/${all.length}`);
    }
  };
  await Promise.all([work(), work(), work(), work()]);
  const judge = new LiveJudge({ timeoutMs: 30_000 });
  const controls = await believe(
    judge,
    CONTROLS.map(([c]) => c),
    ledger,
    "post-controls",
  );
  const trusted = controls.every((b, i) => (CONTROLS[i]?.[1] ? b.mean > 0.5 : b.mean < 0.5));
  const claims = kept.flatMap((l) => [...l.outcomes].map(([thing, o]) => ({ l, thing, o })));
  const beliefs = await believe(
    judge,
    claims.map((c) => claimFor(c.l.p, c.thing, c.o)),
    ledger,
    "post",
  );
  const ratified = new Set<string>();
  claims.forEach((c, i) => {
    if (trusted && (beliefs[i]?.mean ?? 0) >= RATIFY) ratified.add(`${c.l.p.seed}:${c.thing}`);
  });
  return { kept, ratified, trusted, claims: claims.length };
}

function writeSplit(
  data: string,
  name: string,
  scenes: { s: jepa.Scenario; labels?: number[][] }[],
) {
  const chunk = emptyChunk();
  for (const { s, labels } of scenes) addScene(chunk, s.seed, encodeScene(s), labels);
  const dir = join(data, "open", name);
  mkdirSync(dir, { recursive: true });
  const files = chunkFiles(chunk);
  for (const f of FILES) writeFileSync(join(dir, f), files[f]);
  const manifestPath = join(data, "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const hashes = Object.fromEntries(FILES.map((f) => [f, sha256File(join(dir, f))]));
  manifest.splits[name] = {
    dir,
    sealed: false,
    scenes: chunk.scenes,
    rows: chunk.rowCount,
    samples: chunk.samples,
    files: hashes,
  };
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return { scenes: chunk.scenes, samples: chunk.samples };
}

async function main(): Promise<void> {
  const data = arg("data", "H:/rpg-jev.worktrees/jepa-data/v2");
  const model = parseModel(
    JSON.parse(
      readFileSync(
        arg("checkpoint", "packages/predictor/checkpoints/release/runtime.json"),
        "utf8",
      ),
    ),
  );
  const sessions = Number(arg("sessions", "2000"));
  const steps = Number(arg("steps", "12"));
  const maxGaps = Number(arg("gaps", "600"));
  const keys = sealedKeys(data);
  const transitions: Transition[] = [];
  for (let i = 0; i < sessions; i++)
    transitions.push(...session(SESSIONS_FROM + i, steps, i % 5 === 0, model));
  const counts = Object.fromEntries(
    (["rejected", "invariant", "low", "gap"] as Signal[]).map((s) => [
      s,
      transitions.filter((t) => t.signals.includes(s)).length,
    ]),
  );
  const clean = transitions.filter((t) => !touchesSealed(t.scenario, keys));
  const gaps = clean
    .filter((t) => t.signals.includes("gap"))
    .slice(0, maxGaps)
    .map((t) => t.scenario);
  const engine = clean.filter((t) => !t.signals.includes("gap")).map((t) => ({ s: t.scenario }));
  const post = writeSplit(data, "post", engine);
  const labelled = await labelGaps(gaps, arg("ledger", "validation/jepa-proof/jev-spend.json"));
  const gapScenes = labelled.kept
    .filter((l) =>
      Object.keys(l.p.scenario.world.things).every((id) =>
        labelled.ratified.has(`${l.p.seed}:${id}`),
      ),
    )
    .map((l) => ({
      s: l.p.scenario,
      labels: Object.keys(l.p.scenario.world.things)
        .sort()
        .map((id) => [...(l.outcomes.get(id) ?? jepa.NONE)]),
    }));
  const postGap = writeSplit(data, "post-gap", gapScenes);
  const summary = {
    checkpoint: model.id,
    sessions,
    steps,
    signals: counts,
    transitions: transitions.length,
    droppedAsSealed: transitions.length - clean.length,
    post,
    gapScenes: gaps.length,
    gapProposalsKept: labelled.kept.length,
    gapClaims: labelled.claims,
    gapRatified: labelled.ratified.size,
    controlsTrusted: labelled.trusted,
    postGap,
  };
  writeFileSync(
    arg("summary", "validation/jepa-proof/play.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
  );
  console.log(JSON.stringify(summary, null, 2));
}

await main();
