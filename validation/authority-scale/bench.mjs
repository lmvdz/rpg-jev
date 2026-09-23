#!/usr/bin/env node
/**
 * Authority-scale benchmark (task deliverable 1).
 *
 * Reproduces, in pure Node, the same sequence the SpacetimeDB module runs per tick:
 *   parse world row -> sharedTick (drift + autonomous opportunities) -> stringify world row
 *   -> parse row again for the command reducer -> sharedAct -> stringify
 *   -> 8 per-player projections (prepareProjection + one filter pass each)
 *
 * It is not a SpacetimeDB benchmark: it isolates packages/core and packages/server/module's
 * pure helpers so the module-runtime overhead (measured separately in
 * validation/jepa-proof/results/j2-node-reference.json) is not mixed into the numbers here.
 *
 * Usage: node validation/authority-scale/bench.mjs [--things=2000] [--seed=2026] [--repeats=20]
 */
import { matter } from "../../packages/core/src/index.ts";
import { prepareProjection } from "../../packages/server/module/src/projection.ts";
import {
  admitActor,
  initialWorld,
  populated,
  terrainAllows,
} from "../../packages/server/module/src/world.ts";

function arg(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? Number(hit.slice(name.length + 3)) : fallback;
}

const THINGS = arg("things", 2000);
const SEED = arg("seed", 2026);
const REPEATS = arg("repeats", 20);

function now() {
  return performance.now();
}

function percentile(samples, p) {
  const sorted = [...samples].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[index];
}

function summarize(label, samples) {
  const total = samples.reduce((a, b) => a + b, 0);
  return {
    label,
    n: samples.length,
    meanMs: total / samples.length,
    p50Ms: percentile(samples, 50),
    p95Ms: percentile(samples, 95),
  };
}

// --- Build the 2,000-thing world exactly as `populate` would, admitting 8 players. ---
let state = initialWorld();
for (let i = 1; i <= 8; i++) {
  const step = admitActor(state, `player-${i}`);
  state = step.state;
}
const grown = populated(state, THINGS, SEED);
state = grown.state;

const actors = Object.keys(state.world.bodies)
  .filter((id) => !id.startsWith("player-"))
  .sort();

const canStep = (from, to) => terrainAllows(state.world, from, to);

const OPTIMIZED = process.argv.includes("--optimized");

const stages = {
  parseWorld: [],
  tick: [],
  stringifyWorld: [],
  parseForCommand: [],
  command: [],
  stringifyAfterCommand: [],
  prepareProjection: [],
  eightProjections: [],
  fullCycle: [],
};

let driftCache = matter.EMPTY_DRIFT_CACHE;
let seq = 1;
for (let i = 0; i < REPEATS; i++) {
  const rowJson = JSON.stringify(state);
  const fullStart = now();

  // 1. The reducer's `current(ctx).json` -> in-memory state, once per reducer call.
  let t0 = now();
  let parsed = JSON.parse(rowJson);
  stages.parseWorld.push(now() - t0);

  // 2. `advance`: one scheduled tick (drift over every thing, plus autonomous opportunities).
  // `--optimized` swaps the engine's own drift for the dirty-set prototype (`matter.driftDirty`,
  // `docs/authority-scale.md`); everything else in this benchmark is unchanged either way.
  t0 = now();
  let tickStep;
  if (OPTIMIZED) {
    const driftResult = matter.driftDirty(
      parsed.world,
      { process: "drift", minutes: 100 / 60000 },
      driftCache,
    );
    driftCache = driftResult.cache;
    const driftedWorld = matter.apply(parsed.world, driftResult.changes);
    tickStep = matter.sharedTick(
      { ...parsed, world: driftedWorld },
      actors,
      canStep,
      0,
      matter.ENGINE,
    );
  } else {
    tickStep = matter.sharedTick(parsed, actors, canStep, 100 / 60000, matter.ENGINE);
  }
  stages.tick.push(now() - t0);

  // 3. `commit`'s `JSON.stringify(step.state)` written back to the world row.
  t0 = now();
  const tickRowJson = JSON.stringify(tickStep.state);
  stages.stringifyWorld.push(now() - t0);

  // 4. The `command` reducer re-reads the row from scratch (a second parse in the same tick
  //    interval, since ticks and commands are independent reducer calls).
  t0 = now();
  parsed = JSON.parse(tickRowJson);
  stages.parseForCommand.push(now() - t0);

  // 5. One accepted player command: move the first player one legal step, mirroring
  //    `execute()`'s "move" branch.
  t0 = now();
  const body = parsed.world.bodies["player-1"];
  const [x, z] = body.where;
  const candidates = [
    [x + 1, z],
    [x - 1, z],
    [x, z + 1],
    [x, z - 1],
  ];
  const dest = candidates.find(([cx, cz]) => canStep([x, z], [cx, cz])) ?? [x, z];
  const moveStep = matter.sharedMove(parsed, "player-1", dest, canStep);
  stages.command.push(now() - t0);
  const settled = moveStep.ok ? moveStep.state : parsed;

  // 6. `commit`'s write-back after the command.
  t0 = now();
  JSON.stringify(settled);
  stages.stringifyAfterCommand.push(now() - t0);

  // 7 & 8. `refresh()`: prepare once, then one filtered view per connected player (8 of them).
  t0 = now();
  const projectFor = prepareProjection(settled);
  stages.prepareProjection.push(now() - t0);

  t0 = now();
  for (let p = 1; p <= 8; p++) {
    projectFor(`player-${p}`, tickStep.state.tick, seq);
  }
  seq += 1;
  stages.eightProjections.push(now() - t0);

  stages.fullCycle.push(now() - fullStart);

  // Advance seed state for the next repeat so later repeats are not a no-op replay.
  state = settled;
}

const thingCount = Object.keys(state.world.things).length;
console.log(`Authority-scale benchmark: ${thingCount} things, ${REPEATS} repeats, 8 players\n`);
const rows = Object.entries(stages).map(([label, samples]) => summarize(label, samples));
const widest = Math.max(...rows.map((r) => r.label.length));
console.log(
  `${"stage".padEnd(widest)}  ${"mean ms".padStart(9)}  ${"p50 ms".padStart(9)}  ${"p95 ms".padStart(9)}`,
);
for (const row of rows) {
  console.log(
    `${row.label.padEnd(widest)}  ${row.meanMs.toFixed(3).padStart(9)}  ${row.p50Ms.toFixed(3).padStart(9)}  ${row.p95Ms.toFixed(3).padStart(9)}`,
  );
}

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ things: thingCount, repeats: REPEATS, stages: rows }, null, 2));
}
