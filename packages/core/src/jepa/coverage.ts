/**
 * A coverage map of the engine's physics (milestone J spike): a pure function from (world, act)
 * to a coarse situation cell, so a sampler can say which kinds of situation the engine answers,
 * which it declines through a domain gate, and which never came up. The cell is deliberately
 * small: it is not the model's observation (`observe.ts` reads the full state), it is a handful
 * of bands built from exactly what the rules in `matter/graph/*-rules.ts` and `jepa/envelope.ts`
 * read to decide anything, so a gap in the map points at a gap in a rule, not at noise.
 *
 * A cell holds:
 * - `process`: the act's process, in the model's own words (`viewOf`, `ActView`).
 * - `a`, `b`: the material class of the act's two main parties (`rolesOf`'s two named roles for
 *   that process; a tick has none of its own, so both are `"none"`).
 * - `heat`, `wet`, `whole`: the more extreme of the two parties' temperature, wetness and
 *   integrity bands (a party missing counts as unremarkable, never as extreme).
 * - `relation`: how the two parties stand to each other, in the vocabulary `observe.ts` already
 *   uses for the model's neighbours (`in`, `contains`, `touching`, `near`), or `"none"` when there
 *   is no second party to relate to.
 */
import { containerOf } from "../matter/contain.ts";
import { effective, isLiquid } from "../matter/effective.ts";
import type { Act } from "../matter/resolve.ts";
import type { MatterWorld, Thing } from "../matter/types.ts";
import { NEAR, type Process, type Role } from "./observe.ts";
import { rolesOf, viewOf } from "./scenario.ts";

export const MATERIAL_CLASSES = [
  "burning",
  "liquid",
  "gas",
  "powder",
  "hollow",
  "plant",
  "flammable",
  "inert",
  "none",
] as const;
export type MaterialClass = (typeof MATERIAL_CLASSES)[number];

export const HEAT_BANDS = ["cold", "mild", "hot", "scorching"] as const;
export type HeatBand = (typeof HEAT_BANDS)[number];

export const WET_BANDS = ["dry", "wet"] as const;
export type WetBand = (typeof WET_BANDS)[number];

export const WHOLE_BANDS = ["whole", "damaged"] as const;
export type WholeBand = (typeof WHOLE_BANDS)[number];

export const RELATION_BANDS = ["in", "contains", "touching", "near", "none"] as const;
export type RelationBand = (typeof RELATION_BANDS)[number];

export interface SituationCell {
  process: Process;
  a: MaterialClass;
  b: MaterialClass;
  heat: HeatBand;
  wet: WetBand;
  whole: WholeBand;
  relation: RelationBand;
}

/**
 * The act's two named roles, in a fixed order, for each process the generator draws
 * (`scenario.ts`'s `ACTS`). `tick` names none: time passing has no party of its own.
 */
const PAIR_ROLES: Partial<Record<Process, readonly [Role, Role]>> = {
  heat: ["source", "target"],
  soak: ["liquid", "target"],
  coat: ["substance", "target"],
  force: ["instrument", "patient"],
  contain: ["container", "content"],
  load: ["support", "content"],
};

/** The engine reads a thing's own state and effective levels, never its element's name. */
function materialClass(world: MatterWorld, thing: Thing | undefined): MaterialClass {
  if (!thing) return "none";
  if (thing.state.burning) return "burning";
  if (isLiquid(world, thing)) return "liquid";
  const forms = world.elements[thing.element]?.forms ?? [];
  if (forms.includes("gas")) return "gas";
  if (forms.includes("granular")) return "powder";
  if (forms.includes("hollow")) return "hollow";
  if (world.elements[thing.element]?.kind === "plant") return "plant";
  const coat = thing.state.coating;
  const coatBurns = (world.elements[coat?.element ?? ""]?.props.flammability ?? 0) > 0;
  if (effective(world, thing).flammability > 0 || coatBurns) return "flammable";
  return "inert";
}

/** `envelope.ts` treats a thing as one of six words on temperature; four bands is coarser still. */
function heatOf(thing: Thing): HeatBand {
  const t = Math.round(thing.state.temperature);
  if (t <= 1) return "cold";
  if (t <= 2) return "mild";
  if (t <= 4) return "hot";
  return "scorching";
}

/** `words.ts` calls a thing "wet" once its wetness passes half a level; the same line serves here. */
const wetOf = (thing: Thing): WetBand => (thing.state.wetness > 0.5 ? "wet" : "dry");

/** `words.ts` calls a thing cracked or broken once its integrity has fallen below 4.5. */
const wholeOf = (thing: Thing): WholeBand => (thing.state.integrity < 4.5 ? "damaged" : "whole");

/** The more extreme of two bands, an absent party contributing nothing to the choice. */
function worse<T extends string>(
  order: readonly T[],
  fallback: T,
  x: T | undefined,
  y: T | undefined,
): T {
  if (x === undefined && y === undefined) return fallback;
  if (x === undefined) return y as T;
  if (y === undefined) return x;
  return order.indexOf(x) >= order.indexOf(y) ? x : y;
}

/**
 * How the two parties stand to each other, mirroring `observe.ts`'s `relatedTo`: bound first (one
 * inside the other), then by tile distance, and an act's own parties are never merely absent to
 * each other (`relatedTo`'s own comment: "An act brings its parties into contact").
 */
function relationOf(world: MatterWorld, a: Thing | undefined, b: Thing | undefined): RelationBand {
  if (!(a && b)) return "none";
  if (containerOf(world, b)?.id === a.id) return "contains";
  if (containerOf(world, a)?.id === b.id) return "in";
  if (a.place !== b.place) return "touching";
  if (!(a.where && b.where)) return "touching";
  const distance = Math.max(Math.abs(a.where[0] - b.where[0]), Math.abs(a.where[1] - b.where[1]));
  if (distance <= 1) return "touching";
  if (distance <= NEAR) return "near";
  return "touching";
}

/** The two things `PAIR_ROLES` names for this process, or `[undefined, undefined]`. */
function partiesOf(act: Act): readonly [Thing["id"] | undefined, Thing["id"] | undefined] {
  const view = viewOf(act);
  const pair = view && PAIR_ROLES[view.process];
  if (!pair) return [undefined, undefined];
  const roles = rolesOf(act);
  const byRole = (role: Role) => Object.entries(roles).find(([, r]) => r === role)?.[0];
  return [byRole(pair[0]), byRole(pair[1])];
}

/**
 * The situation cell for one act on one world. `null` when the act is not one of the seven
 * processes the model ranks outcomes for (`observe.ts`'s `PROCESSES`), so a caller never bins an
 * act the model does not see.
 */
export function situationCell(world: MatterWorld, act: Act): SituationCell | null {
  const view = viewOf(act);
  if (!view) return null;
  const [idA, idB] = partiesOf(act);
  const a = idA ? world.things[idA] : undefined;
  const b = idB ? world.things[idB] : undefined;
  return {
    process: view.process,
    a: materialClass(world, a),
    b: materialClass(world, b),
    heat: worse(HEAT_BANDS, "mild", a && heatOf(a), b && heatOf(b)),
    wet: worse(WET_BANDS, "dry", a && wetOf(a), b && wetOf(b)),
    whole: worse(WHOLE_BANDS, "whole", a && wholeOf(a), b && wholeOf(b)),
    relation: relationOf(world, a, b),
  };
}

/** A stable string key, for grouping cells in a map without a custom equality function. */
export function cellKey(cell: SituationCell): string {
  return [cell.process, cell.a, cell.b, cell.heat, cell.wet, cell.whole, cell.relation].join("|");
}
