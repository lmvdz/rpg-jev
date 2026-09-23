/**
 * X7, drift: what time does. Every rate reads its conditions (principle 3), and each is in
 * closed form over the minutes that passed, so a gap nobody watched is simulated by this
 * same code (SPEC.md rule 10). What time does to a thing is ten base rows of data
 * (graph/drift-rules.ts) carried out by one kernel (graph/kernel.ts); no rule is a function.
 */
import { apply } from "./apply.ts";
import { enclosure } from "./contain.ts";
import { faded } from "./deeds.ts";
import { DRIFT_AFTER, DRIFT_BEFORE, DRIFT_DERIVED, DRIFT_DURING } from "./graph/drift-rules.ts";
import { grownFor } from "./graph/grown.ts";
import { envOf, Kernel, partyOf, ready } from "./graph/kernel.ts";
import { weathered } from "./living.ts";
import { report } from "./report.ts";
import type { Body, Change, MatterWorld, Thing } from "./types.ts";
import { clamp, FRESH } from "./types.ts";

export interface DriftAct {
  process: "drift";
  minutes: number;
}

/** The rows, made ready once (graph/kernel.ts). */
const GROWN = grownFor("drift");
const KERNEL = Kernel.with(DRIFT_DERIVED, GROWN);
// `was` remains the true interval-start snapshot through every phase. Existing admitted
// weather rows sample extinction at the endpoint; extension writes remain sequential,
// not globally deferred. Fuel settlement follows, then the next step rebuilds properties.
const RULES = [...DRIFT_BEFORE, ...DRIFT_DURING, ...GROWN.rules, ...DRIFT_AFTER].map((rule) =>
  ready(KERNEL, rule),
);

function driftThing(world: MatterWorld, thing: Thing, minutes: number): Change[] {
  const env = envOf(world, { self: partyOf(world, thing) }, minutes);
  let spent = false;
  const because = new Set<string>();
  // What the rows made besides moving a state: what was used up, split off or given off.
  const made: Change[] = [];
  // Each rule is a row (graph/drift-rules.ts), and sees the state the rows before it left.
  for (const rule of RULES) {
    const step = rule(env);
    if (!step) continue;
    spent ||= step.spent === true;
    for (const id of step.because) because.add(id);
    made.push(...step.made);
  }
  const state = env.parties.self?.s ?? thing.state;
  const changes: Change[] = [
    {
      kind: "state",
      thing: thing.id,
      set: state,
      because: [...because],
      note: "time passes over it",
    },
  ];
  const burntOut = thing.state.burning?.of === "self" && spent;
  const ash = world.elements[thing.element]?.burnsTo;
  if (burntOut) {
    changes.push({
      kind: "consume",
      thing: thing.id,
      amount: thing.state.amount,
      because: ["S3", "E4"],
      note: "it has burned away",
    });
    if (ash)
      changes.push({
        kind: "create",
        thing: {
          id: `${thing.id}.ash`,
          element: ash,
          place: thing.place,
          state: { ...FRESH, temperature: 3 },
        },
        because: ["S3", "E3"],
        note: "what is left of it",
      });
  }
  changes.push(...made);
  return changes;
}

/**
 * Bleeding drains health and lessens of itself, quickly for a shallow wound and slowly for a
 * deep one, which is why a scratch closes and a gash needs binding. A sickness shows once
 * its delay has run.
 */
function driftBody(world: MatterWorld, body: Body, minutes: number): Change[] {
  // Each wound bleeds along a falling line until it stops; the loss is the area under it.
  const lost = body.wounds.reduce((sum, w) => {
    const rate = 0.03 / (1 + w.depth);
    const runs = Math.min(minutes, w.bleeding / rate);
    return sum + w.bleeding * runs - (rate * runs ** 2) / 2;
  }, 0);
  const due = body.sickness > 0 && body.sickensIn > 0 && body.sickensIn <= minutes + 1e-9;
  const lived = weathered(world, body, minutes);
  const health = clamp(
    (lived.health ?? body.health) - lost * 0.004 - (due ? body.sickness * 0.5 : 0),
  );
  const sickensIn = Math.max(0, body.sickensIn - minutes);
  const changes: Change[] = [];
  body.wounds.forEach((w, index) => {
    if (w.bleeding <= 0) return;
    const clotted = Math.max(0, w.bleeding - (0.03 * minutes) / (1 + w.depth));
    changes.push({
      kind: "treat",
      body: body.id,
      index,
      set: { bleeding: clotted },
      because: ["B3", "X7"],
      note: clotted > 0 ? "the bleeding slows" : "the bleeding stops",
    });
  });
  changes.push({
    kind: "body",
    body: body.id,
    set: {
      ...lived,
      health,
      sickensIn,
      ...(body.feels ? { feels: faded(body.feels, minutes) } : {}),
    },
    because: ["B2", "B3", "B4", "X7"],
    note: due ? "the sickness comes on" : "time passes over the body",
  });
  return changes;
}

/**
 * One stretch of time, short enough that the order the rates run in does not matter.
 * `active`, when given, is the only things and bodies whose rules are re-run: each rule
 * reads only its own party and place (never another thing), so a party left out keeps
 * its exact prior state and `report` (below) sees it as unchanged, byte for byte. This
 * is what lets a dirty set skip the entities that a cache already knows are at rest
 * (`drift-dirty.ts`), without this function's own behaviour changing when no set is given.
 */
function step(world: MatterWorld, minutes: number, active?: ReadonlySet<string>): Change[] {
  return [
    ...Object.values(world.things)
      .filter((t) => !active || active.has(t.id))
      .flatMap((t) => driftThing(world, t, minutes)),
    ...Object.values(world.bodies)
      .filter((b) => !active || active.has(b.id))
      .flatMap((b) => driftBody(world, b, minutes)),
  ];
}

const STEP = 5;

/** Minutes until the next thing happens that a step must not straddle. */
function nextEvent(world: MatterWorld): number {
  const fuels = Object.values(world.things).flatMap((t) =>
    t.state.burning ? [t.state.burning.fuel] : [],
  );
  const onsets = Object.values(world.bodies).flatMap((b) => (b.sickensIn > 0 ? [b.sickensIn] : []));
  return Math.min(Number.POSITIVE_INFINITY, ...fuels, ...onsets);
}

/**
 * Time is walked in short steps, cut where something happens (a fire burns out, a sickness
 * comes on), so that the answer does not depend on how the caller counted the minutes. Each
 * step is closed form, and it is all code (SPEC.md rule 10).
 */
export function drift(world: MatterWorld, act: DriftAct, active?: ReadonlySet<string>): Change[] {
  const because = new Map<string, Set<string>>();
  const given = new Map<string, Extract<Change, { kind: "signal" }>>();
  let at = world;
  let left = act.minutes;
  while (left > 1e-9) {
    // Short steps near at hand, longer ones across a long gap: a year unwatched is a few
    // thousand steps, not a hundred thousand. A step never straddles an event.
    const span = Math.max(1e-6, Math.min(left, nextEvent(at), Math.max(STEP, left / 500)));
    const drifted = step(at, span, active);
    at = apply(at, drifted);
    // What is held in a container meets it: nothing at all when no container holds anything.
    const held = enclosure(at, span);
    at = apply(at, held);
    const made = [...drifted, ...held];
    for (const change of made) {
      if (change.kind !== "state") continue;
      const ids = because.get(change.thing) ?? new Set<string>();
      for (const id of change.because) ids.add(id);
      because.set(change.thing, ids);
    }
    for (const change of made) {
      if (change.kind !== "signal") continue;
      const key = `${change.source ?? change.place}:${change.channel}`;
      if ((given.get(key)?.strength ?? 0) < change.strength) given.set(key, change);
    }
    left -= span;
  }
  // Said once: what is different now, not what each step did (report.ts); and what was given
  // off along the way, each once, at its strongest.
  return [...report(world, at, because), ...given.values()];
}
