/**
 * A coverage map of the engine's physics (milestone J spike, `docs/physics-coverage.md`): which
 * situation cells (`@rpg-jev/core/jepa`'s `situationCell`) the engine answers, which its domain
 * gates decline, which it always says nothing to, and which never came up, of the cells
 * `coverage.ts`'s `possible` says the engine could ever reach.
 *
 * Two generators, `--generator v1` (`jepa.scenario`, the teacher every sealed JEPA dataset was
 * built from, the default) or `--generator v3` (`jepa.scenarioV3`, stratified over `possible`
 * cells directly). Each has its own default seed start, both at or above 6,000,000,000 and
 * disjoint from every training, validation and play seed range in SPEC section 16 and from each
 * other; `v3`'s output files carry a `-v3` suffix so a `v1` re-run never overwrites them.
 *
 * Two passes. The main pass draws scenarios the way the chosen generator always has, one seed
 * after another. A cell that pass rarely reaches is, by definition, one an ordinary sample will
 * under-report; the stratified pass keeps drawing further seeds but keeps only what lands in a
 * cell still short of `RARE_TARGET`, so a rare cell gets more looks without inflating a common
 * one further. Neither pass steers the generator itself: every scenario is one it could draw
 * unassisted, its own seeded `Rng` and all.
 *
 * Usage: node packages/predictor/scripts/coverage.ts [--generator v1|v3] [--scenes 200000]
 *   [--stratified 400000] [--seed-start N] [--out validation/physics-coverage]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as jepa from "@rpg-jev/core/jepa";
import * as matter from "@rpg-jev/core/matter";
import { actWords, thingWords } from "../src/words.ts";

const RARE_TARGET = 5;
const RARE_CAP = 25;

type GeneratorName = "v1" | "v3";

const GENERATORS: Record<GeneratorName, (seed: number) => jepa.Scenario> = {
  v1: jepa.scenario,
  v3: jepa.scenarioV3,
};

/** Both at or above the spike's own 6,000,000,000 range, and disjoint from each other. */
const DEFAULT_SEED_START: Record<GeneratorName, number> = {
  v1: 6_000_000_000,
  v3: 6_500_000_000,
};

type Label = "answered" | "declined" | "only-nothing";

interface Example {
  seed: number;
  place: string;
  act: string;
  things: string[];
}

interface CellStat {
  cell: jepa.SituationCell;
  count: number;
  answered: number;
  declined: number;
  onlyNothing: number;
  example?: Example;
  declinedExample?: Example;
}

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? fallback) : fallback;
}

/** What a labeller reading the report would want to see: the place, the act, every thing. */
function exampleOf(s: jepa.Scenario): Example {
  const place = s.world.places.site;
  return {
    seed: s.seed,
    place: place
      ? `temperature ${place.temperature}, moisture ${place.moisture}, wind ${place.wind}`
      : "an ordinary place",
    act: actWords(s.act),
    things: Object.values(s.world.things)
      .sort((a, b) => (a.id < b.id ? -1 : 1))
      .map((t) => `${t.id}: ${thingWords(s.world, t)}`),
  };
}

function labelOf(s: jepa.Scenario, changes: readonly matter.Change[]): Label {
  if (changes.some((c) => c.kind !== "nothing")) return "answered";
  return jepa.isGap(s.world, s.act, changes) ? "declined" : "only-nothing";
}

/** One pass of scenarios from `from` up to (not including) `from + n`, each fed to `see`. */
function sample(
  generate: (seed: number) => jepa.Scenario,
  from: number,
  n: number,
  see: (s: jepa.Scenario, label: Label) => void,
): void {
  for (let seed = from; seed < from + n; seed++) {
    const s = generate(seed);
    const { changes } = matter.resolve(s.world, s.act);
    see(s, labelOf(s, changes));
  }
}

function record(stats: Map<string, CellStat>, s: jepa.Scenario, label: Label): void {
  const cell = jepa.situationCell(s.world, s.act);
  if (!cell) return;
  const key = jepa.cellKey(cell);
  let stat = stats.get(key);
  if (!stat) {
    stat = { cell, count: 0, answered: 0, declined: 0, onlyNothing: 0 };
    stats.set(key, stat);
  }
  stat.count++;
  if (label === "answered") {
    stat.answered++;
    stat.example ??= exampleOf(s);
  } else if (label === "declined") {
    stat.declined++;
    stat.declinedExample ??= exampleOf(s);
  } else {
    stat.onlyNothing++;
    stat.example ??= exampleOf(s);
  }
}

function main(): void {
  const generatorName = arg("generator", "v1") as GeneratorName;
  const generate = GENERATORS[generatorName];
  if (!generate) throw new Error(`unknown --generator ${generatorName} (want v1 or v3)`);
  const scenes = Number(arg("scenes", "200000"));
  const stratifiedBudget = Number(arg("stratified", "400000"));
  const outDir = arg("out", "validation/physics-coverage");
  const seedStart = Number(arg("seed-start", String(DEFAULT_SEED_START[generatorName])));
  mkdirSync(outDir, { recursive: true });

  const stats = new Map<string, CellStat>();
  sample(generate, seedStart, scenes, (s, label) => record(stats, s, label));

  const rareEnough = (key: string) => (stats.get(key)?.count ?? 0) < RARE_TARGET;
  let seed = seedStart + scenes;
  const end = seedStart + scenes + stratifiedBudget;
  for (; seed < end; seed++) {
    const s = generate(seed);
    const cell = jepa.situationCell(s.world, s.act);
    if (!cell) continue;
    const key = jepa.cellKey(cell);
    const already = stats.get(key)?.count ?? 0;
    if (already >= RARE_TARGET && already >= RARE_CAP) continue;
    if (already >= RARE_TARGET && !rareEnough(key)) continue;
    const { changes } = matter.resolve(s.world, s.act);
    record(stats, s, labelOf(s, changes));
  }

  writeReport(outDir, generatorName, seedStart, scenes, stratifiedBudget, seed - seedStart, stats);
}

function labelOfCell(stat: CellStat): Label {
  if (stat.answered > 0) return "answered";
  return stat.declined > 0 ? "declined" : "only-nothing";
}

/**
 * How many cells `situationCell` can produce for one process, so "never-sampled" means something:
 * `tick` names no parties, so it can only ever land on the one cell of the unremarkable defaults
 * (`coverage.ts`'s `worse` fallback). Every other process the generator draws always finds two
 * distinct parties (`scenario.ts`'s `two`), so `MATERIAL_CLASSES` minus `"none"` on each of two
 * roles, the four bands, and `RELATION_BANDS` minus `"none"` (an act's two parties always relate
 * somehow) give the rest their size.
 */
function universeOf(process: string): number {
  if (process === "tick") return 1;
  const classes = jepa.MATERIAL_CLASSES.length - 1;
  const relations = jepa.RELATION_BANDS.length - 1;
  return (
    classes *
    classes *
    jepa.HEAT_BANDS.length *
    jepa.WET_BANDS.length *
    jepa.WHOLE_BANDS.length *
    relations
  );
}

/** `coverage.ts`'s `possible`, applied once and grouped by process: the honest denominator, as
 * opposed to `universeOf`'s raw combinatorial one, which still counts cells nothing can reach. */
const POSSIBLE_CELLS = jepa.possibleCells();
const POSSIBLE_KEYS = new Set(POSSIBLE_CELLS.map(jepa.cellKey));

function possibleUniverseOf(process: string): number {
  return POSSIBLE_CELLS.filter((c) => c.process === process).length;
}

function outFile(outDir: string, base: string, generatorName: GeneratorName): string {
  const name = generatorName === "v1" ? base : base.replace(/\.(json|md)$/, "-v3.$1");
  return join(outDir, name);
}

function writeReport(
  outDir: string,
  generatorName: GeneratorName,
  seedStart: number,
  scenes: number,
  stratified: number,
  totalSeeds: number,
  stats: Map<string, CellStat>,
): void {
  const cells = [...stats.values()].sort((a, b) => b.count - a.count);
  const byLabel = { answered: 0, declined: 0, "only-nothing": 0 } as Record<Label, number>;
  for (const stat of cells) byLabel[labelOfCell(stat)]++;

  const universe = jepa.PROCESSES.reduce((n, p) => n + universeOf(p), 0);
  const neverSampled = universe - cells.length;
  // Every cell a generator can ever reach is, by construction, one `possible` admits; this is a
  // sanity check that stays 0, not a count expected to move.
  const possibleCellsSampled = cells.filter((c) => POSSIBLE_KEYS.has(jepa.cellKey(c.cell))).length;
  const impossibleCellsSampled = cells.length - possibleCellsSampled;

  const json = {
    version: `physics-coverage-${generatorName}`,
    generator: generatorName,
    seedRange: [seedStart, seedStart + totalSeeds] as const,
    scenesInMainPass: scenes,
    stratifiedAttempts: stratified,
    cellsSampled: cells.length,
    cellUniverse: universe,
    neverSampled,
    possibleUniverse: POSSIBLE_KEYS.size,
    possibleCellsSampled,
    neverSampledPossible: POSSIBLE_KEYS.size - possibleCellsSampled,
    impossibleCellsSampled,
    byLabel,
    // Examples live in gaps.json, only for the cells that made the ranked list: a full example
    // per cell here would make this file thousands of times bigger than the counts warrant.
    cells: cells.map((stat) => ({
      key: jepa.cellKey(stat.cell),
      cell: stat.cell,
      label: labelOfCell(stat),
      count: stat.count,
      answered: stat.answered,
      declined: stat.declined,
      onlyNothing: stat.onlyNothing,
    })),
  };
  writeFileSync(
    outFile(outDir, "coverage.json", generatorName),
    `${JSON.stringify(json, null, 2)}\n`,
  );
  writeFileSync(outFile(outDir, "coverage.md", generatorName), markdownOf(json));
  const gaps = gapsOf(cells);
  writeFileSync(outFile(outDir, "gaps.json", generatorName), `${JSON.stringify(gaps, null, 2)}\n`);
  writeFileSync(outFile(outDir, "gaps.md", generatorName), gapsMarkdown(gaps));
}

function markdownOf(json: {
  generator: GeneratorName;
  seedRange: readonly [number, number];
  scenesInMainPass: number;
  stratifiedAttempts: number;
  cellsSampled: number;
  cellUniverse: number;
  neverSampled: number;
  possibleUniverse: number;
  possibleCellsSampled: number;
  neverSampledPossible: number;
  impossibleCellsSampled: number;
  byLabel: Record<Label, number>;
  cells: readonly { cell: jepa.SituationCell; label: Label; count: number }[];
}): string {
  const byProcess = new Map<
    string,
    Record<Label, number> & { universe: number; possible: number }
  >();
  for (const p of jepa.PROCESSES)
    byProcess.set(p, {
      answered: 0,
      declined: 0,
      "only-nothing": 0,
      universe: universeOf(p),
      possible: possibleUniverseOf(p),
    });
  for (const c of json.cells) {
    const row = byProcess.get(c.cell.process);
    if (row) row[c.label]++;
  }
  const rows = [...byProcess.entries()]
    .map(([p, r]) => {
      const sampled = r.answered + r.declined + r["only-nothing"];
      return `| ${p} | ${r.answered} | ${r.declined} | ${r["only-nothing"]} | ${r.possible - sampled} | ${r.possible} | ${r.universe} |`;
    })
    .join("\n");
  return [
    `# Physics coverage (${json.generator})`,
    "",
    `Seeds ${json.seedRange[0]} to ${json.seedRange[1]} (${json.scenesInMainPass} main, ${json.stratifiedAttempts} stratified budget).`,
    "",
    `${json.possibleCellsSampled} of ${json.possibleUniverse} possible situation cells reached ` +
      `(${json.neverSampledPossible} never sampled). Against the raw combinatorial space before ` +
      `impossible cells (gas, and a structural container outside \`liquid\`/\`hollow\`/\`burning\`) ` +
      `are excluded: ${json.cellsSampled} of ${json.cellUniverse} (${json.neverSampled} never sampled). ` +
      `${json.impossibleCellsSampled} sampled cells were outside \`possible\` (expected: 0).`,
    "",
    `Totals across every cell reached: ${json.byLabel.answered} answered, ${json.byLabel.declined} declined, ${json.byLabel["only-nothing"]} only-nothing.`,
    "",
    "| process | answered cells | declined cells | only-nothing cells | never-sampled (of possible) | possible cells | raw combinatorial cells |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    rows,
    "",
    "See `gaps.md` for the ranked gap list and `coverage.json`/`gaps.json` for full detail.",
    "",
  ].join("\n");
}

/**
 * How plausible it is that a declined or only-nothing cell should answer, from what the cell
 * itself says: a burning party (+2, fire is the most consequential state to ignore), a liquid or
 * powder party (+1 each, force/soak/coat's own gates are about exactly these), heat at hot or
 * scorching (+1) and a wet or damaged party (+1 each) all say "this is not an inert corner of the
 * space". The rank multiplies that by how often the sampler actually reached the cell (log-scaled,
 * so a one-off draw does not outrank a cell the generator visits constantly).
 */
function plausibility(cell: jepa.SituationCell): number {
  let score = 0;
  if (cell.a === "burning" || cell.b === "burning") score += 2;
  if (cell.a === "liquid" || cell.b === "liquid") score += 1;
  if (cell.a === "powder" || cell.b === "powder") score += 1;
  if (cell.heat === "hot" || cell.heat === "scorching") score += 1;
  if (cell.wet === "wet") score += 1;
  if (cell.whole === "damaged") score += 1;
  return score;
}

function gapsOf(cells: readonly CellStat[]) {
  return cells
    .filter((stat) => labelOfCell(stat) !== "answered")
    .map((stat) => ({
      key: jepa.cellKey(stat.cell),
      cell: stat.cell,
      label: labelOfCell(stat),
      count: stat.count,
      plausibility: plausibility(stat.cell),
      rank: plausibility(stat.cell) * Math.log1p(stat.count),
      example: stat.declinedExample ?? stat.example,
    }))
    .sort((a, b) => b.rank - a.rank)
    .slice(0, 30);
}

function gapsMarkdown(gaps: ReturnType<typeof gapsOf>): string {
  const rows = gaps.map((g, i) => {
    const ex = g.example;
    const scene = ex ? `${ex.act} ${ex.things.join("; ")}` : "(no example captured)";
    return [
      `## ${i + 1}. ${g.cell.process}: ${g.cell.a} × ${g.cell.b}, ${g.label}`,
      "",
      `Situation: ${g.cell.heat} heat, ${g.cell.wet}, ${g.cell.whole}, ${g.cell.relation}. Seen ${g.count} times, plausibility ${g.plausibility}, rank ${g.rank.toFixed(2)}.`,
      "",
      `Example (seed ${ex?.seed ?? "?"}): ${scene}`,
      "",
    ].join("\n");
  });
  return ["# Ranked physics coverage gaps", "", ...rows].join("\n");
}

main();
