/**
 * A coverage map of the engine's physics (milestone J spike, `docs/physics-coverage.md`): which
 * situation cells (`@rpg-jev/core/jepa`'s `situationCell`) the engine answers, which its domain
 * gates decline, which it always says nothing to, and which never came up. Seeds start at
 * 6,000,000,000, disjoint from every training, validation and play seed range in SPEC section 16.
 *
 * Two passes. The main pass draws scenarios the way the teacher's generator always has, one seed
 * after another. A cell that pass rarely reaches is, by definition, one an ordinary sample will
 * under-report; the stratified pass keeps drawing further seeds but keeps only what lands in a
 * cell still short of `RARE_TARGET`, so a rare cell gets more looks without inflating a common
 * one further. Neither pass steers the generator itself: every scenario is one the code engine
 * could draw on its own, `scenario.ts`'s own seeded `Rng` and all.
 *
 * Usage: node packages/predictor/scripts/coverage.ts [--scenes 200000] [--stratified 400000]
 *   [--out validation/physics-coverage]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as jepa from "@rpg-jev/core/jepa";
import * as matter from "@rpg-jev/core/matter";
import { actWords, thingWords } from "../src/words.ts";

const SEED_START = 6_000_000_000;
const RARE_TARGET = 5;
const RARE_CAP = 25;

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
function sample(from: number, n: number, see: (s: jepa.Scenario, label: Label) => void): void {
  for (let seed = from; seed < from + n; seed++) {
    const s = jepa.scenario(seed);
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
  const scenes = Number(arg("scenes", "200000"));
  const stratifiedBudget = Number(arg("stratified", "400000"));
  const outDir = arg("out", "validation/physics-coverage");
  mkdirSync(outDir, { recursive: true });

  const stats = new Map<string, CellStat>();
  sample(SEED_START, scenes, (s, label) => record(stats, s, label));

  const rareEnough = (key: string) => (stats.get(key)?.count ?? 0) < RARE_TARGET;
  let seed = SEED_START + scenes;
  const end = SEED_START + scenes + stratifiedBudget;
  for (; seed < end; seed++) {
    const s = jepa.scenario(seed);
    const cell = jepa.situationCell(s.world, s.act);
    if (!cell) continue;
    const key = jepa.cellKey(cell);
    const already = stats.get(key)?.count ?? 0;
    if (already >= RARE_TARGET && already >= RARE_CAP) continue;
    if (already >= RARE_TARGET && !rareEnough(key)) continue;
    const { changes } = matter.resolve(s.world, s.act);
    record(stats, s, labelOf(s, changes));
  }

  writeReport(outDir, scenes, stratifiedBudget, seed - SEED_START, stats);
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

function writeReport(
  outDir: string,
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

  const json = {
    version: "physics-coverage-v1",
    seedRange: [SEED_START, SEED_START + totalSeeds] as const,
    scenesInMainPass: scenes,
    stratifiedAttempts: stratified,
    cellsSampled: cells.length,
    cellUniverse: universe,
    neverSampled,
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
  writeFileSync(join(outDir, "coverage.json"), `${JSON.stringify(json, null, 2)}\n`);
  writeFileSync(join(outDir, "coverage.md"), markdownOf(json));
  const gaps = gapsOf(cells);
  writeFileSync(join(outDir, "gaps.json"), `${JSON.stringify(gaps, null, 2)}\n`);
  writeFileSync(join(outDir, "gaps.md"), gapsMarkdown(gaps));
}

function markdownOf(json: {
  seedRange: readonly [number, number];
  scenesInMainPass: number;
  stratifiedAttempts: number;
  cellsSampled: number;
  cellUniverse: number;
  neverSampled: number;
  byLabel: Record<Label, number>;
  cells: readonly { cell: jepa.SituationCell; label: Label; count: number }[];
}): string {
  const byProcess = new Map<string, Record<Label, number> & { universe: number }>();
  for (const p of jepa.PROCESSES)
    byProcess.set(p, { answered: 0, declined: 0, "only-nothing": 0, universe: universeOf(p) });
  for (const c of json.cells) {
    const row = byProcess.get(c.cell.process);
    if (row) row[c.label]++;
  }
  const rows = [...byProcess.entries()]
    .map(([p, r]) => {
      const sampled = r.answered + r.declined + r["only-nothing"];
      return `| ${p} | ${r.answered} | ${r.declined} | ${r["only-nothing"]} | ${r.universe - sampled} | ${r.universe} |`;
    })
    .join("\n");
  return [
    "# Physics coverage",
    "",
    `Seeds ${json.seedRange[0]} to ${json.seedRange[1]} (${json.scenesInMainPass} main, ${json.stratifiedAttempts} stratified budget). ${json.cellsSampled} of ${json.cellUniverse} possible situation cells reached (${json.neverSampled} never sampled).`,
    "",
    `Totals across every cell reached: ${json.byLabel.answered} answered, ${json.byLabel.declined} declined, ${json.byLabel["only-nothing"]} only-nothing.`,
    "",
    "| process | answered cells | declined cells | only-nothing cells | never-sampled cells | possible cells |",
    "| --- | --- | --- | --- | --- | --- |",
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
