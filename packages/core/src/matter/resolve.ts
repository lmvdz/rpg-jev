/**
 * The one way in. A caller says what is being done to what; the module decides what it
 * means and what follows. A process is a row in `PROCESSES`, so the interface does not grow
 * when the world does. There are no errors, only outcomes, one of which is nothing.
 */
import { apply } from "./apply.ts";
import { type IngestAct, ingest, type SearchAct, search } from "./body.ts";
import { type DriftAct, drift } from "./drift.ts";
import { type ForceAct, force } from "./force.ts";
import { type HeatAct, heat } from "./heat.ts";
import { type MoveAct, move } from "./living.ts";
import { type LoadAct, load } from "./load.ts";
import { perceive } from "./sense.ts";
import { type CoatAct, coat, type SoakAct, soak } from "./soak.ts";
import type { Change, MatterWorld } from "./types.ts";

export type Act =
  | HeatAct
  | SoakAct
  | CoatAct
  | ForceAct
  | IngestAct
  | SearchAct
  | DriftAct
  | LoadAct
  | MoveAct;

type Process<K extends Act["process"]> = (
  world: MatterWorld,
  act: Extract<Act, { process: K }>,
) => Change[];

export const PROCESSES: { [K in Act["process"]]: Process<K> } = {
  heat,
  soak,
  coat,
  force,
  ingest,
  search,
  drift,
  load,
  move,
};

/** What each number an act may carry is allowed to be. Anything else is brought into range. */
const RANGES: Record<string, readonly [number, number]> = {
  minutes: [0, 5_000_000],
  amount: [0, 1_000_000],
  contact: [0, 1],
  seconds: [0, 3600],
  draw: [0, 0.999999],
  effort: [0, 5],
  care: [0, 5],
  haste: [0, 5],
};

/** No act reaches a rule with a number that is negative, endless or not a number. */
function inRange<T>(value: T): T {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return value;
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value)) {
    const range = RANGES[key];
    if (typeof v === "number" && range)
      out[key] = Number.isFinite(v) ? Math.min(range[1], Math.max(range[0], v)) : range[0];
    else out[key] = inRange(v);
  }
  return out as T;
}

export interface Outcome {
  world: MatterWorld;
  changes: Change[];
}

export function resolve(world: MatterWorld, act: Act): Outcome {
  const process = PROCESSES[act.process] as Process<typeof act.process>;
  const changes = process(world, inRange(act));
  const after = apply(world, changes);
  // Whatever the act did, some of it reaches someone (sense.ts).
  const noticed = perceive(after, changes);
  return { world: apply(after, noticed), changes: [...changes, ...noticed] };
}

/** Several acts in order, each on the world the last one left. */
export function play(world: MatterWorld, acts: readonly Act[]): Outcome {
  let outcome: Outcome = { world, changes: [] };
  for (const act of acts) {
    const next = resolve(outcome.world, act);
    outcome = { world: next.world, changes: [...outcome.changes, ...next.changes] };
  }
  return outcome;
}
