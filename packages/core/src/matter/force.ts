/**
 * X2, force. Two contests, and they are not the same contest.
 *
 * An **edge cuts** by keenness against the fibres' toughness, and only what is harder than
 * the work can cut it at all. What a cut must cross is the thin dimension, so a cord parts in
 * a few strokes and an oak takes a scar. A **blow breaks** by momentum (mass times the arm
 * behind it) against toughness and bulk, and only what is not tough fractures: a blow on
 * something tough is taken up, not broken. A small brittle thing shatters whole, a big one
 * spalls a piece, and hard brittle pieces come away keen if the blow was careful.
 *
 * Contact time is an input: a hot blade that slices sears, and one that is held seals. Flesh
 * is matter too; a body is a patient whose damage is a wound. Synergies no comparison gives
 * are rows in `REACTIONS`, which name properties and thresholds, never a thing.
 */
import { baseline, effective } from "./effective.ts";
import {
  FORCE_BODY_RULES,
  FORCE_DERIVED,
  FORCE_STRIKES,
  FORCE_THING_RULES,
} from "./graph/force-rules.ts";
import { type Grown, grownFor } from "./graph/grown.ts";
import {
  changesOf,
  type Env,
  envOf,
  Kernel,
  type Party,
  partyOf,
  type Ready,
  ready,
} from "./graph/kernel.ts";
import type { Body, Change, EffectRow, Manner, MatterWorld, Properties, Thing } from "./types.ts";
import { FRESH, ORDINARY } from "./types.ts";

export interface ForceAct {
  process: "force";
  /** The body that does it, if one does: what makes the act a deed (deeds.ts). */
  by?: string;
  instrument: string;
  /** A thing id or a body id. */
  patient: string;
  manner?: Manner;
  /** How long the instrument stays in contact. A cut is a fraction of a second. */
  seconds?: number;
  /** Through it (the default), along its grain, or working its surface. */
  aim?: "through" | "along" | "surface";
}

/** What living flesh is like, as levels: soft, and tougher than it is hard. */
const FLESH = { hardness: 1, toughness: 2, size: 2 };

/** The hardest, toughest thing a body wears: what a blow has to get through. */
function wornBy(world: MatterWorld, wears: readonly string[] | undefined): Thing | null {
  let best: Thing | null = null;
  let score = -1;
  for (const id of wears ?? []) {
    const worn = world.things[id];
    if (!worn || worn.state.integrity <= 1) continue;
    const p = effective(world, worn);
    if (p.hardness + p.toughness <= score) continue;
    score = p.hardness + p.toughness;
    best = worn;
  }
  return best;
}

/** A body as a party to a blow: what its flesh is like, by its own row if it has one. */
function fleshParty(world: MatterWorld, body: Body): Party {
  const row = world.elements[body.element ?? ""]?.props;
  const levels = row
    ? {
        hardness: row.hardness ?? FLESH.hardness,
        toughness: row.toughness ?? FLESH.toughness,
        size: row.size ?? FLESH.size,
      }
    : FLESH;
  const thing: Thing = {
    id: body.id,
    element: body.element ?? "",
    place: body.place,
    state: FRESH,
  };
  const p = { ...baseline(undefined), ...levels };
  const bleeding = body.wounds.filter((w) => w.bleeding > 0).length;
  return {
    thing,
    p,
    place: world.places[body.place],
    s: FRESH,
    was: FRESH,
    x: {},
    b: { bleeding },
  };
}

export interface Reaction {
  id: string;
  /** Minimum effective levels of the instrument. */
  instrument: Partial<Properties>;
  /** Minimum surface temperature of the instrument. */
  temperature: number;
  /** Minimum heat exposure: degrees above warm, times seconds of contact. */
  exposure: number;
  /** What it does, from a closed set the engine knows how to carry out. */
  does: "seal_wounds" | "spark";
  /** How it is shown when it happens, if it is. */
  effect?: EffectRow;
  because: string[];
  note: string;
}

export const REACTIONS: readonly Reaction[] = [
  {
    id: "cautery",
    instrument: {},
    temperature: 4,
    exposure: 6,
    does: "seal_wounds",
    because: ["S1", "B3", "X3"],
    note: "held there, the heat closes the wound",
  },
  {
    id: "spark",
    instrument: { hardness: 4 },
    temperature: 0,
    exposure: 0,
    does: "spark",
    because: ["P3", "X2", "E9"],
    note: "hard on hard throws a spark",
  },
];

function actOf(act: ForceAct): Record<string, number> {
  const manner = act.manner ?? ORDINARY;
  return {
    effort: manner.effort,
    care: manner.care,
    haste: manner.haste,
    seconds: act.seconds ?? 0.3,
    surface: act.aim === "surface" ? 1 : 0,
    along: act.aim === "along" ? 1 : 0,
  };
}

function run(rules: readonly Ready[], env: Env): Change[] {
  return rules.flatMap((rule) => {
    const ran = rule(env);
    return ran ? changesOf(env, ran) : [];
  });
}

/** Force, from the base rows and whatever has grown beside them: on things, and on bodies. */
export function forceFrom(onThing: Grown, onBody: Grown) {
  const KERNEL = Kernel.with(FORCE_DERIVED, onThing, onBody);
  const ON_THING = [...FORCE_THING_RULES, ...onThing.rules].map((rule) => ready(KERNEL, rule));
  const ON_BODY = [...FORCE_BODY_RULES, ...onBody.rules].map((rule) => ready(KERNEL, rule));
  const STRIKES = KERNEL.test(FORCE_STRIKES);

  /** A blow or a cut on a thing: nothing, if there is nothing there or either of them flows. */
  function strike(world: MatterWorld, act: ForceAct, tool: Thing, patient: Thing | undefined) {
    if (!patient || patient.id === tool.id) return [];
    const parties = { tgt: partyOf(world, patient), tool: partyOf(world, tool) };
    const env = envOf(world, parties, 0, actOf(act));
    return STRIKES(env) ? run(ON_THING, env) : [];
  }

  /**
   * Force is rows of data (graph/force-rules.ts). A body is wounded through what it wears, what
   * it wears is struck as a thing, and a thing is struck as a thing.
   */
  function force(world: MatterWorld, act: ForceAct): Change[] {
    const tool = world.things[act.instrument];
    if (!tool)
      return [{ kind: "nothing", because: [], note: "there is nothing there to strike with" }];
    const body = world.bodies[act.patient];
    const worn = wornBy(world, body?.wears);
    const changes: Change[] = [];
    if (body) {
      const arm = worn ? { arm: partyOf(world, worn) } : {};
      const parties = { tgt: fleshParty(world, body), tool: partyOf(world, tool), ...arm };
      changes.push(...run(ON_BODY, envOf(world, parties, 0, actOf(act))));
    }
    if (worn) changes.push(...strike(world, act, tool, worn));
    changes.push(...strike(world, act, tool, world.things[act.patient]));
    if (changes.length > 0) return changes;
    return [{ kind: "nothing", because: ["X2"], note: "nothing comes of it" }];
  }

  return force;
}

export const force = forceFrom(grownFor("strike"), grownFor("wound"));
