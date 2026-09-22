/**
 * Commit (milestone J, P3): the model ranks, code commits (SPEC rule 1). For each affected thing
 * the envelope's legal classes and the model's probabilities give one outcome, drawn with one
 * logged draw. Code then realises it: on each channel where the chosen class is the class the
 * engine reached, the engine's own numbers; otherwise the code-owned canonical step for that
 * class. Invariants are checked after every draw, and a broken one hands the whole act back to
 * the engine. The record (draws, candidate hashes, chosen outcomes, checkpoint) is enough to
 * replay the world byte for byte without the model.
 */
import { containerOf } from "../matter/contain.ts";
import { effective } from "../matter/effective.ts";
import { fuelFor } from "../matter/heat.ts";
import { type Act, type Outcome as EngineOutcome, resolve } from "../matter/resolve.ts";
import type { Change, MatterWorld, Thing, ThingState } from "../matter/types.ts";
import { clamp, FRESH } from "../matter/types.ts";
import type { Rng } from "../rng.ts";
import { candidateHash, isLegal, type Legal, legal } from "./envelope.ts";
import {
  type ActView,
  featureMemo,
  neighbourhood,
  observe,
  type Related,
  relatedTo,
} from "./observe.ts";
import {
  CHANNELS,
  CLASS_OFFSETS,
  classify,
  type Outcome,
  outcomeId,
  outcomeOf,
} from "./outcomes.ts";

/** Per thing, a probability for every class of every channel, in `CLASS_NAMES` order. */
export type Scores = readonly Float64Array[];

/**
 * The model, as the commit sees it: observations in, class probabilities out, or null when it
 * missed its deadline or is switched off. The commit never learns what is behind it.
 */
export type Scorer = (
  observations: readonly Float64Array[],
  legal: readonly Legal[],
) => Scores | null;

export interface Choice {
  thing: string;
  /** The envelope's candidate set, as a stable hash. */
  candidates: string;
  draw: number;
  chosen: number;
  engine: number;
}

export type Fallback = "none" | "deadline" | "invariant" | "off";

export interface CommitRecord {
  version: "jepa-commit-v1";
  checkpoint: string;
  fallback: Fallback;
  choices: Choice[];
  /** What broke, when an invariant handed the act back to the engine. */
  broken?: string[];
}

export interface Committed {
  world: MatterWorld;
  changes: Change[];
  record: CommitRecord;
  /** The engine's own outcome, for shadow logging. */
  engine: EngineOutcome;
}

/** One outcome from per-channel probabilities restricted to the legal classes, from one draw. */
export function drawOutcome(scores: Float64Array, legalSet: Legal, draw: number): Outcome {
  const out: number[] = [];
  let u = Math.min(Math.max(draw, 0), 1 - 1e-12);
  CHANNELS.forEach((channel, i) => {
    const offset = CLASS_OFFSETS[i] ?? 0;
    const flags = legalSet[i] ?? [];
    const weights = channel.classes.map((_, k) =>
      flags[k] ? Math.max(0, scores[offset + k] ?? 0) : 0,
    );
    const total = weights.reduce((a, b) => a + b, 0);
    const legalKs = channel.classes.map((_, k) => k).filter((k) => flags[k]);
    if (!(total > 0)) {
      out.push(legalKs[0] ?? 0);
      return;
    }
    let acc = 0;
    let chosen = legalKs[legalKs.length - 1] ?? 0;
    for (const k of legalKs) {
      const p = (weights[k] ?? 0) / total;
      if (u < acc + p) {
        chosen = k;
        u = p > 0 ? (u - acc) / p : 0;
        break;
      }
      acc += p;
    }
    out.push(chosen);
  });
  return out;
}

const ORDINAL: readonly (keyof ThingState)[] = [
  "temperature",
  "wetness",
  "surfaceAbove",
  "integrity",
  "edge",
  "contamination",
  "corrosion",
  "taint",
  "flaw",
  "temper",
];

interface Realising {
  before: MatterWorld;
  act: Act;
  thing: Thing;
  engine: Thing | undefined;
  engineClass: Outcome;
  chosen: Outcome;
}

type Fields = Partial<ThingState>;
type Channel = (r: Realising, k: number) => Fields;

const matches = (r: Realising, i: number) => r.chosen[i] === r.engineClass[i] && !!r.engine;
const step = (value: number, by: number) => clamp(value + by);

/** Where a gained coat comes from: the act's substance, or its liquid. */
function coatSource(r: Realising): string | undefined {
  const act = r.act;
  if (act.process === "coat" && act.target === r.thing.id) return act.substance;
  if (act.process === "soak" && act.target === r.thing.id) return act.liquid;
  return undefined;
}

const CANONICAL: Record<(typeof CHANNELS)[number]["name"], Channel> = {
  heat: (r, k) => ({ temperature: step(r.thing.state.temperature, k - 1) }),
  wet: (r, k) => {
    const wetness = step(r.thing.state.wetness, k - 1);
    return { wetness, wetWith: wetness > 0 ? r.thing.state.wetWith : null };
  },
  fire: (r, k) => {
    if (k === 2) return { burning: null };
    if (k === 0) return { burning: r.thing.state.burning };
    const burning = fuelFor(r.before, r.thing, effective(r.before, r.thing));
    return burning.fuel > 0 ? { burning } : { burning: r.thing.state.burning };
  },
  whole: (r, k) => ({
    integrity: k === 1 ? step(r.thing.state.integrity, -2) : r.thing.state.integrity,
  }),
  coat: (r, k) => {
    if (k === 2) return { coating: null };
    const source = k === 1 ? coatSource(r) : undefined;
    const from = source === undefined ? undefined : r.before.things[source];
    if (!from) return { coating: r.thing.state.coating };
    return { coating: { element: from.element, amount: 1, coverage: 0.5, bond: 0 } };
  },
  rot: (r, k) => ({ contamination: step(r.thing.state.contamination, k - 1) }),
  rust: (r, k) => ({ corrosion: step(r.thing.state.corrosion, k) }),
  amount: (r, k) => ({ amount: k === 1 ? r.thing.state.amount * 0.5 : r.thing.state.amount }),
};

const ENGINE_FIELDS: Record<(typeof CHANNELS)[number]["name"], (keyof ThingState)[]> = {
  heat: ["temperature", "surfaceAbove"],
  wet: ["wetness", "wetWith"],
  fire: ["burning"],
  whole: ["integrity"],
  coat: ["coating"],
  rot: ["contamination"],
  rust: ["corrosion"],
  amount: ["amount"],
};

/** The realised state of one thing that is still there, channel by channel. */
function realisedState(r: Realising): ThingState {
  // What no channel ranks (edge, taint, temper, set...) is the engine's, or unchanged.
  const state: ThingState = { ...FRESH, ...(r.engine?.state ?? r.thing.state) };
  CHANNELS.forEach((channel, i) => {
    const k = r.chosen[i] ?? 0;
    const fields: Fields = matches(r, i)
      ? Object.fromEntries(ENGINE_FIELDS[channel.name].map((f) => [f, r.engine?.state[f]]))
      : CANONICAL[channel.name](r, k);
    Object.assign(state, fields);
  });
  return state;
}

/** The thing a created thing was made from: the longest existing id it extends. */
function parentOf(world: MatterWorld, id: string): string | undefined {
  let best: string | undefined;
  for (const other of Object.keys(world.things))
    if (id.startsWith(`${other}.`) && (!best || other.length > best.length)) best = other;
  return best;
}

const AMOUNT = CHANNELS.findIndex((c) => c.name === "amount");
const GONE = 2;

/** The world with every chosen outcome realised on top of the engine's. */
export function realise(
  before: MatterWorld,
  act: Act,
  engine: EngineOutcome,
  chosen: ReadonlyMap<string, Outcome>,
): MatterWorld {
  const things: Record<string, Thing> = {};
  const kept = new Set<string>();
  for (const thing of Object.values(before.things)) {
    const after = engine.world.things[thing.id];
    const pick = chosen.get(thing.id);
    if (!pick) {
      if (after) things[thing.id] = after;
      continue;
    }
    const engineClass = classify(thing, after);
    const r: Realising = { before, act, thing, engine: after, engineClass, chosen: pick };
    if (pick[AMOUNT] === GONE) continue;
    const base = after ?? thing;
    things[thing.id] = { ...base, state: realisedState(r) };
    if ((engineClass[AMOUNT] ?? 0) === (pick[AMOUNT] ?? 0)) kept.add(thing.id);
  }
  for (const made of Object.values(engine.world.things)) {
    if (before.things[made.id]) continue;
    const parent = parentOf(before, made.id);
    // A thing the engine made from another is kept only if that other met the engine's fate.
    if (!(parent && chosen.has(parent)) || kept.has(parent)) things[made.id] = made;
  }
  spill(before, things);
  return { ...engine.world, things };
}

/** What was in a container that is gone falls out where the container stood. */
function spill(before: MatterWorld, things: Record<string, Thing>): void {
  for (const [id, thing] of Object.entries(things)) {
    const container = containerOf(before, thing);
    if (!container || things[container.id]) continue;
    const out: Thing = { ...thing, place: container.place };
    if (container.where) out.where = container.where;
    things[id] = out;
  }
}

/** What must hold after any draw, whatever the model scored. Empty when all is well. */
export function invariants(before: MatterWorld, after: MatterWorld): string[] {
  return Object.values(after.things).flatMap((thing) =>
    CHECKS.flatMap((check) => check(before, after, thing)).map((what) => `${thing.id}: ${what}`),
  );
}

type Check = (before: MatterWorld, after: MatterWorld, thing: Thing) => string[];

const CHECKS: readonly Check[] = [
  (_b, _a, thing) =>
    ORDINAL.filter((key) => {
      const v = thing.state[key];
      return typeof v !== "number" || !Number.isFinite(v) || v < -1e-9 || v > 5 + 1e-9;
    }).map((key) => `${key} out of range`),
  (before, _a, thing) => {
    const amount = thing.state.amount;
    if (!(Number.isFinite(amount) && amount > 0)) return ["no amount"];
    const was = before.things[thing.id];
    return was && amount > was.state.amount + 1e-9 ? ["amount grew"] : [];
  },
  (_b, after, thing) => {
    if (!after.places[thing.place]) return ["in no place"];
    const lost = thing.place.endsWith(".inside") && !containerOf(after, thing);
    return lost ? ["in a container that is not there"] : [];
  },
  (_b, after, thing) => {
    const burning = thing.state.burning;
    if (!burning) return [];
    if (!(burning.fuel > 0)) return ["burns with no fuel"];
    const own = after.elements[thing.element]?.props.flammability ?? 0;
    const coat = after.elements[thing.state.coating?.element ?? ""]?.props.flammability ?? 0;
    const none = own <= 0 && coat <= 0 && effective(after, thing).flammability <= 0;
    return none ? ["burns with nothing to burn"] : [];
  },
];

/** The changes that take `before` to `after`, for the event log: states whole, ends, beginnings. */
export function changesBetween(
  before: MatterWorld,
  after: MatterWorld,
  engine: readonly Change[],
): Change[] {
  const thingKinds = new Set(["state", "consume", "create", "enclose", "energy", "carried"]);
  const changes: Change[] = engine.filter((c) => !thingKinds.has(c.kind));
  for (const thing of Object.values(after.things)) {
    const was = before.things[thing.id];
    if (!was) changes.push({ kind: "create", thing, because: ["J"], note: "it comes to be" });
    else if (JSON.stringify(was) !== JSON.stringify(thing)) {
      if (was.place !== thing.place)
        changes.push({
          kind: "enclose",
          thing: thing.id,
          place: thing.place,
          ...(thing.where ? { where: thing.where } : {}),
          because: ["J"],
          note: "",
          quiet: true,
        });
      changes.push({ kind: "state", thing: thing.id, set: thing.state, because: ["J"], note: "" });
    }
  }
  for (const id of Object.keys(before.things))
    if (!after.things[id])
      changes.push({
        kind: "consume",
        thing: id,
        amount: before.things[id]?.state.amount ?? 0,
        because: ["J"],
        note: "it is gone",
      });
  return changes;
}

export interface Prepared {
  things: Thing[];
  related: Related[][];
  legal: Legal[];
  observations: Float64Array[];
}

/** Everything the model is shown for one act: the affected things, in id order. */
export function prepare(world: MatterWorld, view: ActView): Prepared {
  const things = Object.values(world.things).sort((a, b) => (a.id < b.id ? -1 : 1));
  const near = neighbourhood(world);
  // The act's parties are always candidates: the act brings them into contact.
  const parties = Object.keys(view.roles).flatMap((id) => world.things[id] ?? []);
  const features = featureMemo(world);
  const related = things.map((t) =>
    relatedTo(world, t, view.roles, new Set([...near(t), ...parties])),
  );
  return {
    things,
    related,
    legal: things.map((t, i) => legal(world, t, view, related[i])),
    observations: things.map((t, i) => observe(world, t, view, related[i], features)),
  };
}

function engineOnly(engine: EngineOutcome, checkpoint: string, fallback: Fallback): Committed {
  return {
    world: engine.world,
    changes: engine.changes,
    record: { version: "jepa-commit-v1", checkpoint, fallback, choices: [] },
    engine,
  };
}

/**
 * One act or tick, ranked by the model and committed by code. With no scores (switched off,
 * or late) the engine's outcome is committed and the record says why (rule 2).
 */
export function commit(
  world: MatterWorld,
  act: Act,
  view: ActView,
  scorer: Scorer | null,
  rng: Rng,
  checkpoint: string,
): Committed {
  const engine = resolve(world, act);
  if (!scorer) return engineOnly(engine, checkpoint, "off");
  const prepared = prepare(world, view);
  const scores = scorer(prepared.observations, prepared.legal);
  if (!scores || scores.length !== prepared.things.length)
    return engineOnly(engine, checkpoint, "deadline");
  const chosen = new Map<string, Outcome>();
  const choices: Choice[] = prepared.things.map((thing, i) => {
    const legalSet = prepared.legal[i] as Legal;
    const draw = rng.next();
    const pick = drawOutcome(scores[i] as Float64Array, legalSet, draw);
    chosen.set(thing.id, pick);
    return {
      thing: thing.id,
      candidates: candidateHash(legalSet),
      draw,
      chosen: outcomeId(pick),
      engine: outcomeId(classify(thing, engine.world.things[thing.id])),
    };
  });
  return settle(world, act, engine, chosen, choices, checkpoint, prepared.legal);
}

function settle(
  world: MatterWorld,
  act: Act,
  engine: EngineOutcome,
  chosen: ReadonlyMap<string, Outcome>,
  choices: Choice[],
  checkpoint: string,
  legalSets: readonly Legal[],
): Committed {
  const illegal = choices.filter((c, i) => !isLegal(legalSets[i] ?? [], outcomeOf(c.chosen)));
  const after = realise(world, act, engine, chosen);
  const broken = [
    ...illegal.map((c) => `${c.thing}: outside the envelope`),
    ...invariants(world, after),
  ];
  if (broken.length > 0) {
    const fell = engineOnly(engine, checkpoint, "invariant");
    return { ...fell, record: { ...fell.record, choices, broken } };
  }
  return {
    world: after,
    changes: changesBetween(world, after, engine.changes),
    record: { version: "jepa-commit-v1", checkpoint, fallback: "none", choices },
    engine,
  };
}

/** Replay from the log: the engine (code) and the recorded choices, never the model (rule 9). */
export function replay(world: MatterWorld, act: Act, record: CommitRecord): MatterWorld {
  const engine = resolve(world, act);
  if (record.fallback !== "none") return engine.world;
  const chosen = new Map(record.choices.map((c) => [c.thing, outcomeOf(c.chosen)] as const));
  return realise(world, act, engine, chosen);
}
