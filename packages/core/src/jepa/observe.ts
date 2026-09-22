/**
 * What the world model observes (milestone J, SPEC section 16): one thing, the place it is in,
 * the act or tick, and up to eight related things, each by relation (in, contains, touching,
 * near) and distance. Never tiles, cells or pixels: `where` is read only to say what touches
 * and how far, so a client in another engine feeds the same model through the same server.
 * Every feature is a number in [0, 1]; the layout is versioned (`OBSERVATION_VERSION`), and a
 * checkpoint names the version it was trained on.
 */
import { containerOf } from "../matter/contain.ts";
import { effective, isLiquid } from "../matter/effective.ts";
import { FORMS, type Kind, type MatterWorld, PROPERTY_KEYS, type Thing } from "../matter/types.ts";

export const OBSERVATION_VERSION = "jepa-observation-v1";

export const KINDS: readonly Kind[] = ["material", "thing", "plant", "creature", "person", "place"];

/** The processes the model ranks outcomes for. `tick` is time passing (drift). */
export const PROCESSES = ["tick", "heat", "soak", "coat", "force", "contain", "load"] as const;
export type Process = (typeof PROCESSES)[number];

/** What part a thing plays in an act. A bystander is affected by being near. */
export const ROLES = [
  "bystander",
  "source",
  "target",
  "instrument",
  "patient",
  "liquid",
  "substance",
  "container",
  "content",
  "support",
] as const;
export type Role = (typeof ROLES)[number];

export const HOWS = ["put", "remove", "seal", "unseal", "pour"] as const;

export const RELATIONS = ["in", "contains", "touching", "near"] as const;
export type Relation = (typeof RELATIONS)[number];

/** How many related things one observation carries, nearest and closest-bound first. */
export const NEIGHBOURS = 8;
/** Farthest a thing is still near, in tiles (Chebyshev). */
export const NEAR = 3;

/** The act as the model sees it: code-stated numbers only, and each party's role. */
export interface ActView {
  process: Process;
  roles: Readonly<Record<string, Role>>;
  minutes: number;
  contact?: number;
  amount?: number;
  effort?: number;
  care?: number;
  haste?: number;
  how?: (typeof HOWS)[number];
}

const level = (x: number) => Math.min(1, Math.max(0, x / 5));
const logScaled = (x: number, top: number) =>
  Math.min(1, Math.log1p(Math.max(0, x)) / Math.log1p(top));
const oneHot = <T>(options: readonly T[], value: T | undefined) =>
  options.map((o) => (o === value ? 1 : 0));

const STATE_NAMES = [
  "temperature",
  "wetness",
  "wet_oily",
  "surface_above",
  "burning",
  "burning_coat",
  "fuel",
  "integrity",
  "edge",
  "coated",
  "coat_amount",
  "coat_coverage",
  "coat_flammability",
  "contamination",
  "corrosion",
  "taint",
  "amount",
  "flaw",
  "temper",
  "set",
  "liquid_now",
] as const;

export const THING_FEATURES: readonly string[] = [
  ...PROPERTY_KEYS.map((k) => `p.${k}`),
  ...FORMS.map((f) => `form.${f}`),
  ...KINDS.map((k) => `kind.${k}`),
  ...STATE_NAMES.map((s) => `s.${s}`),
];

export const PLACE_FEATURES = ["temperature", "moisture", "wind", "air", "light", "enclosed"];

export const ACT_FEATURES: readonly string[] = [
  ...PROCESSES.map((p) => `process.${p}`),
  ...ROLES.map((r) => `role.${r}`),
  ...HOWS.map((h) => `how.${h}`),
  "minutes",
  "contact",
  "amount",
  "effort",
  "care",
  "haste",
];

export const NEIGHBOUR_FEATURES: readonly string[] = [
  "present",
  ...RELATIONS.map((r) => `rel.${r}`),
  "distance",
  ...ROLES.map((r) => `role.${r}`),
  ...THING_FEATURES,
];

export const OBSERVATION_WIDTH =
  THING_FEATURES.length +
  PLACE_FEATURES.length +
  ACT_FEATURES.length +
  NEIGHBOURS * NEIGHBOUR_FEATURES.length;

/** A thing's own row: what it is made of (its effective levels), its forms, kind and state. */
export function thingFeatures(world: MatterWorld, thing: Thing): number[] {
  const element = world.elements[thing.element];
  const p = effective(world, thing);
  const s = thing.state;
  const coatElement = s.coating ? world.elements[s.coating.element] : undefined;
  const forms = element?.forms ?? [];
  return [
    ...PROPERTY_KEYS.map((k) => level(p[k])),
    ...FORMS.map((f) => (forms.includes(f) ? 1 : 0)),
    ...oneHot(KINDS, element?.kind),
    level(s.temperature),
    level(s.wetness),
    s.wetWith === null ? 0 : 1,
    level(s.surfaceAbove),
    s.burning ? 1 : 0,
    s.burning?.of === "coating" ? 1 : 0,
    logScaled(s.burning?.fuel ?? 0, 2000),
    level(s.integrity),
    level(s.edge),
    s.coating ? 1 : 0,
    logScaled(s.coating?.amount ?? 0, 16),
    Math.min(1, Math.max(0, s.coating?.coverage ?? 0)),
    level(coatElement?.props.flammability ?? 0),
    level(s.contamination),
    level(s.corrosion),
    level(s.taint),
    logScaled(s.amount, 64),
    level(s.flaw),
    level(s.temper),
    s.set ? 1 : 0,
    isLiquid(world, thing) ? 1 : 0,
  ];
}

export function placeFeatures(world: MatterWorld, thing: Thing): number[] {
  const place = world.places[thing.place];
  return [
    level(place?.temperature ?? 2),
    level(place?.moisture ?? 2),
    level(place?.wind ?? 0),
    level(place?.air ?? 5),
    level(place?.light ?? 3),
    containerOf(world, thing) ? 1 : 0,
  ];
}

export function actFeatures(act: ActView, role: Role): number[] {
  return [
    ...oneHot(PROCESSES, act.process),
    ...oneHot(ROLES, role),
    ...oneHot(HOWS, act.how),
    logScaled(act.minutes, 600),
    Math.min(1, Math.max(0, act.contact ?? 0)),
    logScaled(act.amount ?? 0, 16),
    level(act.effort ?? 0),
    level(act.care ?? 0),
    level(act.haste ?? 0),
  ];
}

export interface Related {
  thing: Thing;
  relation: Relation;
  /** Tiles, Chebyshev; 0 for what is in or holds the thing. */
  distance: number;
}

const chebyshev = (a: readonly [number, number], b: readonly [number, number]) =>
  Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));

function relationOf(world: MatterWorld, self: Thing, other: Thing): Related | undefined {
  if (containerOf(world, self)?.id === other.id)
    return { thing: other, relation: "in", distance: 0 };
  if (containerOf(world, other)?.id === self.id)
    return { thing: other, relation: "contains", distance: 0 };
  if (other.place !== self.place) return undefined;
  // In one container, or in one place with no positions: side by side.
  if (!(self.where && other.where)) return { thing: other, relation: "touching", distance: 0 };
  const distance = chebyshev(self.where, other.where);
  if (distance <= 1) return { thing: other, relation: "touching", distance };
  if (distance <= NEAR) return { thing: other, relation: "near", distance };
  return undefined;
}

/**
 * The things related to one thing, bound first (in, contains), then by distance, then by id so
 * the order is the same on every host. A party to the act always makes the cut.
 */
export function relatedTo(
  world: MatterWorld,
  self: Thing,
  roles: Readonly<Record<string, Role>> = {},
  candidates: Iterable<Thing> = Object.values(world.things),
): Related[] {
  const found: Related[] = [];
  for (const other of candidates) {
    if (other.id === self.id) continue;
    const party = !!roles[other.id] && roles[other.id] !== "bystander";
    // An act brings its parties into contact, wherever they stood before it.
    const related =
      relationOf(world, self, other) ??
      (party ? { thing: other, relation: "touching" as const, distance: 1 } : undefined);
    if (related) found.push(related);
  }
  const rank = (r: Related) =>
    (roles[r.thing.id] && roles[r.thing.id] !== "bystander" ? 0 : 100) +
    RELATIONS.indexOf(r.relation) * 10 +
    r.distance;
  found.sort((a, b) => rank(a) - rank(b) || (a.thing.id < b.thing.id ? -1 : 1));
  return found.slice(0, NEIGHBOURS);
}

function neighbourFeatures(world: MatterWorld, related: Related, role: Role): number[] {
  return [
    1,
    ...oneHot(RELATIONS, related.relation),
    Math.min(1, related.distance / NEAR),
    ...oneHot(ROLES, role),
    ...thingFeatures(world, related.thing),
  ];
}

const EMPTY_NEIGHBOUR: readonly number[] = NEIGHBOUR_FEATURES.map(() => 0);

/** The observation of one thing under one act, flat, `OBSERVATION_WIDTH` long. */
export function observe(
  world: MatterWorld,
  thing: Thing,
  act: ActView,
  related: readonly Related[] = relatedTo(world, thing, act.roles),
): Float64Array {
  const out = new Float64Array(OBSERVATION_WIDTH);
  let at = 0;
  const write = (values: readonly number[]) => {
    out.set(values, at);
    at += values.length;
  };
  write(thingFeatures(world, thing));
  write(placeFeatures(world, thing));
  write(actFeatures(act, act.roles[thing.id] ?? "bystander"));
  for (let i = 0; i < NEIGHBOURS; i++) {
    const r = related[i];
    write(r ? neighbourFeatures(world, r, act.roles[r.thing.id] ?? "bystander") : EMPTY_NEIGHBOUR);
  }
  return out;
}
