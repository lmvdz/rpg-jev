/**
 * X7, drift: what time does. Every rate reads its conditions (principle 3), and each is in
 * closed form over the minutes that passed, so a gap nobody watched is simulated by this
 * same code (SPEC.md rule 10). A kind of drift is a row in `DRIFTS`.
 */
import { apply } from "./apply.ts";
import { faded } from "./deeds.ts";
import { effective } from "./effective.ts";
import { weathered } from "./living.ts";
import { report } from "./report.ts";
import type { Body, Change, MatterWorld, Place, Properties, Thing, ThingState } from "./types.ts";
import { clamp, FRESH } from "./types.ts";

export interface DriftAct {
  process: "drift";
  minutes: number;
}

interface Ctx {
  world: MatterWorld;
  thing: Thing;
  p: Properties;
  place: Place | undefined;
  minutes: number;
}

type Drift = (
  ctx: Ctx,
  state: ThingState,
) => { set: Partial<ThingState>; because: string[]; spent?: boolean };

const NONE = { set: {}, because: [] as string[] };

const DRIFTS: readonly Drift[] = [
  // Burning uses up its fuel. It goes out where there is no air and when what burns is too
  // wet to burn, and then what has not burned is still there: only spent fuel is gone.
  ({ p, place, minutes }, s) => {
    if (!s.burning) return NONE;
    const out = (place?.air ?? 5) <= 0 || p.flammability <= 0;
    if (out) return { set: { burning: null, surfaceAbove: 0 }, because: ["S3", "R6", "S2", "X7"] };
    const fuel = s.burning.fuel - minutes;
    if (fuel > 1e-9) return { set: { burning: { ...s.burning, fuel } }, because: ["S3", "X7"] };
    const coatGone = s.burning.of === "coating" ? { coating: null } : {};
    return { set: { burning: null, ...coatGone }, because: ["S3", "X7"], spent: true };
  },
  // A surface that ran ahead of the bulk falls back to it within minutes.
  ({ minutes }, s) => {
    if (s.surfaceAbove <= 0) return NONE;
    return { set: { surfaceAbove: s.surfaceAbove * Math.exp(-minutes) }, because: ["S1", "X7"] };
  },
  // Temperature settles toward the place; a thing whose coat burns is heated by it.
  ({ p, place, minutes }, s) => {
    const toward = s.burning ? 5 : (place?.temperature ?? 2);
    const rate = (0.02 * (1 + p.conductivity * 0.2)) / (1 + p.mass * 0.3);
    const temperature = clamp(
      s.temperature + (toward - s.temperature) * (1 - Math.exp(-rate * minutes)),
    );
    return { set: { temperature }, because: ["S1", "P7", "X7"] };
  },
  // Wetness moves toward what the air holds. In rain a thing wets again as far as it can
  // drink. Drying goes in two speeds: a film on the surface is gone within the hour, and
  // water held inside (soaked in, or the thing's own) leaves slowly, through pores, against
  // bulk. So wet steel dries before it rusts much, cloth takes a day, and flesh takes days.
  ({ world, thing, p, place, minutes }, s) => {
    const air = Math.max(0, (place?.moisture ?? 2) - 2);
    const inside = p.absorbency * 0.8 + (world.elements[thing.element]?.moist ?? 0);
    const holds = Math.min(air * 1.6, 1 + inside);
    if (s.wetness < holds)
      return {
        set: { wetness: Math.min(holds, s.wetness + 0.2 * minutes), wetWith: null },
        because: ["S2", "P9", "X7"],
      };
    // In rain or damp air nothing dries below what that air keeps in it.
    const floor = Math.max(air, holds);
    if (s.wetness <= floor) return NONE;
    const exposed = 1 + Math.max(0, s.temperature - 2) + (place?.wind ?? 0) * 0.3;
    const film = Math.max(0, s.wetness - inside);
    const filmLeft = Math.max(0, film - exposed * 0.0015 * minutes);
    const open = 0.1 + p.porosity * 0.4;
    // Bulk counts by powers: a timber takes weeks where a pot takes days.
    const bulk = 1.5 ** (p.mass + p.size - 1) + p.absorbency * 0.2;
    const heldLeft = Math.max(0, s.wetness - film - (exposed * open * 0.0045 * minutes) / bulk);
    return {
      set: { wetness: Math.max(floor, heldLeft + filmLeft) },
      because: ["S2", "P1", "P9", "P10", "X7"],
    };
  },
  // A coat of something that dissolves readily draws the water out of what it covers.
  ({ world, minutes }, s) => {
    const coat = s.coating ? world.elements[s.coating.element] : undefined;
    const thirst = coat?.forms.includes("granular") ? (coat.props.solubility ?? 0) : 0;
    if (!s.coating || thirst < 3 || s.wetness <= 0) return NONE;
    const drawn = (thirst / 5) * s.coating.coverage * 0.01 * minutes;
    return { set: { wetness: Math.max(0, s.wetness - drawn) }, because: ["S7", "P12", "S2", "X7"] };
  },
  // Living contamination grows in what is perishable, warm and damp; a cleansing coat slows it.
  ({ world, thing, p, minutes }, s) => {
    if (p.perishability <= 0 || s.temperature >= 4.5) return NONE;
    // Cold slows it by degrees; it never quite stops above freezing.
    const warmth = clamp((s.temperature - 0.5) / 2, 0.05, 1);
    // It needs water to live in: what is dried through keeps, whatever it is.
    const oily = world.elements[s.wetWith ?? ""]?.props.oiliness ?? 0;
    const flows = world.elements[thing.element]?.forms.includes("liquid") ?? false;
    const water = flows ? 1 : clamp((s.wetness * (1 - oily / 5)) / 2, 0, 1);
    // A coat of something that dissolves readily ties the water up: it is there and not to be had.
    const salt = s.coating ? world.elements[s.coating.element] : undefined;
    const tied = salt?.forms.includes("granular")
      ? ((salt.props.solubility ?? 0) / 5) * (s.coating?.coverage ?? 0)
      : 0;
    const damp = water * (1 - tied);
    const coat = s.coating ? world.elements[s.coating.element]?.props : undefined;
    const kept = (coat?.cleansing ?? 0) + (coat?.potency ?? 0) >= 3 ? 0.2 : 1;
    // What barely perishes barely rots: the rate falls off faster than the level.
    const feeds = (p.perishability / 5) ** 1.5;
    const growth = feeds * warmth * damp * kept * 0.25 * (minutes / 60);
    return {
      set: { contamination: clamp(s.contamination + growth) },
      because: ["S9", "P15", "X7"],
    };
  },
  // Rust: corrodible, wet, and not kept off by an oily coat (already in the effective level).
  ({ p, minutes }, s) => {
    if (p.corrodibility <= 0 || s.wetness <= 0) return NONE;
    const growth = (p.corrodibility / 5) * (s.wetness / 5) * 0.1 * (minutes / 60);
    return { set: { corrosion: clamp(s.corrosion + growth) }, because: ["S10", "P16", "S2", "X7"] };
  },
  // Setting: once dry, a thing that sets is hard for good.
  ({ p }, s) => {
    if (s.set || p.setting <= 0 || s.wetness > 0.2) return NONE;
    return { set: { set: true }, because: ["P23", "M5", "X7"] };
  },
  // A coat bonds as it dries into something that drinks, if it is the kind of thing that
  // clings: sticky or perishable. What dissolves, or is only grains, stays loose.
  ({ world, p, minutes }, s) => {
    if (!s.coating || s.burning) return NONE;
    const coat = world.elements[s.coating.element];
    const c = coat?.props ?? {};
    const loose = (c.solubility ?? 0) + (coat?.forms.includes("granular") ? 2 : 0);
    const clings = Math.max(0, (c.stickiness ?? 0) + (c.perishability ?? 0) * 0.5 - loose) / 5;
    const bond = clamp(s.coating.bond + (p.absorbency / 5) * clings * 0.03 * minutes);
    return { set: { coating: { ...s.coating, bond } }, because: ["S7", "P9", "P13", "P12", "X7"] };
  },
];

function driftThing(world: MatterWorld, thing: Thing, minutes: number): Change[] {
  const ctx: Ctx = {
    world,
    thing,
    p: effective(world, thing),
    place: world.places[thing.place],
    minutes,
  };
  let state = thing.state;
  let spent = false;
  const because = new Set<string>();
  for (const drift of DRIFTS) {
    const step = drift(ctx, state);
    spent ||= step.spent === true;
    state = { ...state, ...step.set };
    for (const id of step.because) because.add(id);
  }
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

/** One stretch of time, short enough that the order the rates run in does not matter. */
function step(world: MatterWorld, minutes: number): Change[] {
  return [
    ...Object.values(world.things).flatMap((t) => driftThing(world, t, minutes)),
    ...Object.values(world.bodies).flatMap((b) => driftBody(world, b, minutes)),
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
export function drift(world: MatterWorld, act: DriftAct): Change[] {
  const because = new Map<string, Set<string>>();
  let at = world;
  let left = act.minutes;
  while (left > 1e-9) {
    // Short steps near at hand, longer ones across a long gap: a year unwatched is a few
    // thousand steps, not a hundred thousand. A step never straddles an event.
    const span = Math.max(1e-6, Math.min(left, nextEvent(at), Math.max(STEP, left / 500)));
    const made = step(at, span);
    for (const change of made) {
      if (change.kind !== "state") continue;
      const ids = because.get(change.thing) ?? new Set<string>();
      for (const id of change.because) ids.add(id);
      because.set(change.thing, ids);
    }
    at = apply(at, made);
    left -= span;
  }
  // Said once: what is different now, not what each step did (report.ts).
  return report(world, at, because);
}
