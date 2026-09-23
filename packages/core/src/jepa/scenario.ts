/**
 * The teacher's scenario generator (milestone J, P4). From a seed alone it grows a small scene
 * on the code engine: elements drawn from closed ranges (nothing named selects a rule), a place,
 * a few things in states, some of them in containers, and one act or a stretch of time. The
 * engine resolves it; every thing in the scene is a labelled transition. Pure: all chance comes
 * from the seeded `Rng`.
 */
import { apply } from "../matter/apply.ts";
import { interiorOf } from "../matter/contain.ts";
import { effective } from "../matter/effective.ts";
import { alight, POOL, placeOf, worldOf } from "../matter/pool.ts";
import type { Act } from "../matter/resolve.ts";
import {
  type Element,
  FORMS,
  type Form,
  FRESH,
  type MatterWorld,
  PROPERTY_KEYS,
  type Properties,
  type Thing,
} from "../matter/types.ts";
import { Rng } from "../rng.ts";
import type { ActView, Role } from "./observe.ts";

export const SCENARIO_VERSION = "jepa-scenario-v2";

export interface Scenario {
  seed: number;
  world: MatterWorld;
  act: Act;
  view: ActView;
}

const PLACE = "site";

export class Draw {
  readonly rng: Rng;
  constructor(rng: Rng) {
    this.rng = rng;
  }
  unit = () => this.rng.next();
  int = (lo: number, hi: number) => lo + Math.floor(this.rng.next() * (hi - lo + 1));
  level = () => this.int(0, 5);
  chance = (p: number) => this.rng.next() < p;
  pick = <T>(items: readonly T[]): T => items[Math.floor(this.rng.next() * items.length)] as T;
}

type Archetype = "solid" | "liquid" | "powder" | "container" | "plant" | "fuel";
const ARCHETYPES: readonly Archetype[] = [
  "solid",
  "liquid",
  "powder",
  "container",
  "plant",
  "fuel",
];

function props(d: Draw, set: Partial<Properties>): Partial<Properties> {
  const out: Partial<Properties> = {};
  for (const key of PROPERTY_KEYS) if (d.chance(0.45)) out[key] = d.level();
  return { ...out, ...set };
}

const ELEMENT_SHAPES: Record<Archetype, (d: Draw) => Omit<Element, "id" | "name">> = {
  solid: (d) => ({
    kind: d.pick(["material", "thing"] as const),
    forms: d.pick<Form[]>([
      ["round"],
      ["edged"],
      ["long", "grained"],
      ["flat"],
      ["edged", "pointed"],
    ]),
    props: props(d, { size: d.int(1, 4), mass: d.int(1, 4), hardness: d.int(1, 5) }),
  }),
  liquid: (d) => ({
    kind: "material",
    forms: ["liquid"],
    props: props(d, { size: d.int(1, 2), mass: 1, hardness: 0, toughness: 0, meltsAt: 0 }),
  }),
  powder: (d) => ({
    kind: "material",
    forms: ["granular"],
    props: props(d, { size: d.int(0, 2), mass: d.int(0, 2), hardness: d.int(0, 3) }),
  }),
  container: (d) => ({
    kind: "thing",
    forms: d.pick<Form[]>([["hollow", "round"], ["hollow", "flat"], ["hollow"]]),
    props: props(d, { size: d.int(2, 4), mass: d.int(1, 3), hardness: d.int(1, 5) }),
  }),
  plant: (d) => ({
    kind: "plant",
    forms: d.pick<Form[]>([["cord"], ["long", "grained"], []]),
    props: props(d, { size: d.int(1, 3), perishability: d.int(1, 5), flammability: d.int(1, 4) }),
    moist: d.int(0, 3),
  }),
  fuel: (d) => ({
    kind: "material",
    forms: d.pick<Form[]>([["cord"], ["grained", "long"], ["granular"]]),
    props: props(d, { size: d.int(1, 3), mass: d.int(0, 3), flammability: d.int(3, 5) }),
  }),
};

function element(d: Draw, id: string, archetype: Archetype): Element {
  const shape = ELEMENT_SHAPES[archetype](d);
  const forms = [...new Set(shape.forms)].filter((f) => FORMS.includes(f));
  return {
    id,
    name: `element ${id}`,
    ...shape,
    forms,
    ...(d.chance(0.5) ? { burnsTo: "ash" } : {}),
  };
}

function stateOf(d: Draw, liquid: boolean) {
  const wet = d.chance(0.3) ? d.int(1, 5) : 0;
  return {
    ...FRESH,
    temperature: d.chance(0.7) ? 2 : d.level(),
    wetness: wet,
    wetWith: wet > 0 && d.chance(0.25) ? "oil" : null,
    integrity: d.chance(0.75) ? 5 : d.int(1, 5),
    contamination: d.chance(0.8) ? 0 : d.int(1, 5),
    corrosion: d.chance(0.85) ? 0 : d.int(1, 4),
    amount: liquid ? d.int(1, 4) : d.int(1, 3),
  };
}

function coatOf(d: Draw, world: MatterWorld, thing: Thing): Thing {
  const coats = Object.values(world.elements).filter(
    (e) => e.forms.includes("liquid") || e.forms.includes("granular"),
  );
  if (coats.length === 0) return thing;
  const coat = d.pick(coats);
  const coating = { element: coat.id, amount: d.int(1, 3), coverage: d.unit(), bond: d.int(0, 3) };
  return { ...thing, state: { ...thing.state, coating } };
}

function thingOf(d: Draw, world: MatterWorld, id: string, e: Element): Thing {
  const liquid = e.forms.includes("liquid");
  let thing: Thing = {
    id,
    element: e.id,
    place: PLACE,
    where: [d.int(0, 3), d.int(0, 3)],
    state: stateOf(d, liquid),
  };
  if (!liquid && d.chance(0.12)) thing = coatOf(d, world, thing);
  // Only what can burn is set alight: its own stuff or its coat must take a flame.
  const probe = { ...world, things: { ...world.things, [id]: thing } };
  if (effective(probe, thing).flammability > 0 && d.chance(0.3)) thing = alight(world, thing);
  return thing;
}

function contained(d: Draw, world: MatterWorld): MatterWorld {
  const containers = Object.values(world.things).filter(
    (t) => world.elements[t.element]?.forms.includes("hollow") && !t.place.endsWith(".inside"),
  );
  let next = world;
  for (const container of containers) {
    if (!d.chance(0.6)) continue;
    const size = world.elements[container.element]?.props.size ?? 0;
    const inner = Object.values(next.things).filter(
      (t) =>
        t.id !== container.id &&
        t.place === PLACE &&
        (next.elements[t.element]?.props.size ?? 0) < size &&
        !next.elements[t.element]?.forms.includes("hollow"),
    );
    if (inner.length === 0) continue;
    const thing = d.pick(inner);
    const id = interiorOf(container.id);
    const inside = placeOf(id, { temperature: container.state.temperature, wind: 0, light: 0 });
    if (d.chance(0.35)) inside.air = 0;
    next = apply(next, [
      { kind: "room", place: inside, because: [], note: "" },
      {
        kind: "enclose",
        thing: thing.id,
        place: id,
        because: [],
        note: "",
        ...(container.where ? { where: container.where } : {}),
      },
    ]);
  }
  return next;
}

function worldFor(d: Draw): MatterWorld {
  const count = d.int(2, 6);
  const elements: Element[] = [...POOL.filter((e) => e.id === "ash")];
  const archetypes = Array.from({ length: count }, () => d.pick(ARCHETYPES));
  for (const [i, archetype] of archetypes.entries())
    elements.push(
      d.chance(0.25) ? { ...d.pick(POOL), id: `e${i}` } : element(d, `e${i}`, archetype),
    );
  const place = placeOf(PLACE, {
    temperature: d.chance(0.6) ? 2 : d.level(),
    moisture: d.chance(0.6) ? 2 : d.level(),
    wind: d.int(0, 3),
    air: d.chance(0.9) ? d.int(2, 5) : 0,
    light: d.level(),
  });
  let world = worldOf(elements, [place]);
  for (let i = 0; i < count; i++) {
    const e = elements[i + 1] as Element;
    world.things[`t${i}`] = thingOf(d, world, `t${i}`, e);
  }
  world = contained(d, world);
  return world;
}

const manner = (d: Draw) => ({ effort: d.int(0, 5), care: d.int(0, 5), haste: d.int(0, 5) });

type ActMaker = (d: Draw, w: MatterWorld, ids: readonly string[]) => Scenario["act"] | null;

/**
 * Two distinct parties. The first is drawn from those that suit it (`fit`) most of the time,
 * and from anything otherwise, so the engine also meets acts its domain gates decline (the gap).
 */
function two(
  d: Draw,
  ids: readonly string[],
  fit: (id: string) => boolean = () => true,
  fitted = 0.85,
): [string, string] | null {
  if (ids.length < 2) return null;
  const suited = ids.filter(fit);
  const a = d.pick(suited.length > 0 && d.chance(fitted) ? suited : ids);
  const b = d.pick(ids.filter((id) => id !== a));
  return [a, b];
}

const formOf = (w: MatterWorld, id: string) => w.elements[w.things[id]?.element ?? ""]?.forms ?? [];
const liquid = (w: MatterWorld) => (id: string) => formOf(w, id).includes("liquid");
const spreads = (w: MatterWorld) => (id: string) =>
  formOf(w, id).includes("liquid") || formOf(w, id).includes("granular");
const solid = (w: MatterWorld) => (id: string) => !formOf(w, id).includes("liquid");

const ACTS: Record<ActView["process"], ActMaker> = {
  // Play ticks are a tenth or a half of a second: the model must know how little they change.
  tick: (d) => ({ process: "drift", minutes: d.pick([1 / 600, 1 / 120, 1, 5, 15, 30, 60, 240]) }),
  heat: (d, _w, ids) => {
    const p = two(d, ids);
    return (
      p && {
        process: "heat",
        source: p[0],
        target: p[1],
        minutes: d.int(1, 30),
        contact: d.pick([0.1, 0.3, 0.6, 1]),
      }
    );
  },
  soak: (d, w, ids) => {
    const p = two(d, ids, liquid(w));
    return p && { process: "soak", liquid: p[0], target: p[1], amount: d.int(1, 3) };
  },
  coat: (d, w, ids) => {
    const p = two(d, ids, spreads(w));
    return (
      p && {
        process: "coat",
        substance: p[0],
        target: p[1],
        amount: d.int(1, 3),
        manner: manner(d),
      }
    );
  },
  force: (d, w, ids) => {
    const p = two(d, ids, solid(w), 0.9);
    return (
      p && {
        process: "force",
        instrument: p[0],
        patient: p[1],
        manner: manner(d),
        aim: d.pick(["through", "along", "surface"] as const),
      }
    );
  },
  contain: (d, w, ids) => {
    const hollow = ids.filter((id) =>
      w.elements[w.things[id]?.element ?? ""]?.forms.includes("hollow"),
    );
    if (hollow.length === 0) return null;
    const container = d.pick(hollow);
    const how = d.pick(["put", "remove", "seal", "unseal", "pour"] as const);
    const thing = d.pick(ids.filter((id) => id !== container));
    return { process: "contain", how, container, ...(thing ? { thing } : {}), amount: d.int(1, 3) };
  },
  load: (d, _w, ids) => {
    const p = two(d, ids);
    return p && { process: "load", support: p[0], bearing: [p[1]] };
  },
};

const MIX: readonly ActView["process"][] = [
  "tick",
  "tick",
  "heat",
  "heat",
  "heat",
  "soak",
  "soak",
  "coat",
  "coat",
  "force",
  "force",
  "force",
  "contain",
  "contain",
  "load",
];

/** The roles an act gives its parties, for the observation. */
export function rolesOf(act: Act): Record<string, Role> {
  if (act.process === "heat")
    return fromPairs([
      [act.source, "source"],
      [act.target, "target"],
    ]);
  if (act.process === "soak")
    return fromPairs([
      [act.liquid, "liquid"],
      [act.target, "target"],
    ]);
  if (act.process === "coat")
    return fromPairs([
      [act.substance, "substance"],
      [act.target, "target"],
    ]);
  if (act.process === "force")
    return fromPairs([
      [act.instrument, "instrument"],
      [act.patient, "patient"],
    ]);
  if (act.process === "contain")
    return fromPairs([
      [act.container, "container"],
      [act.thing, "content"],
    ]);
  if (act.process === "load")
    return fromPairs([
      [act.support, "support"],
      ...act.bearing.map((b) => [b, "content"] as const),
    ]);
  return {};
}

function fromPairs(pairs: readonly (readonly [string | undefined, Role])[]): Record<string, Role> {
  const out: Record<string, Role> = {};
  for (const [id, role] of pairs) if (id) out[id] = role;
  return out;
}

/** The act as the model sees it: its process, roles and code-stated numbers. */
export function viewOf(act: Act): ActView | null {
  const roles = rolesOf(act);
  switch (act.process) {
    case "drift":
      return { process: "tick", roles, minutes: act.minutes };
    case "heat":
      return { process: "heat", roles, minutes: act.minutes, contact: act.contact ?? 1 };
    case "soak":
      return { process: "soak", roles, minutes: 1, amount: act.amount };
    case "coat":
      return { process: "coat", roles, minutes: 1, amount: act.amount ?? 1, ...act.manner };
    case "force":
      return { process: "force", roles, minutes: 0, ...act.manner };
    case "contain":
      return { process: "contain", roles, minutes: 0, how: act.how, amount: act.amount ?? 0 };
    case "load":
      return { process: "load", roles, minutes: 0 };
    default:
      return null;
  }
}

/** One scenario from one seed. The same seed always grows the same scene and act. */
export function scenario(seed: number): Scenario {
  const d = new Draw(Rng.fromSeed(seed));
  for (;;) {
    const world = worldFor(d);
    const ids = Object.keys(world.things).sort();
    const act = ACTS[d.pick(MIX)](d, world, ids);
    const view = act && viewOf(act);
    if (act && view) return { seed, world, act, view };
  }
}

/**
 * Another act on a world that already exists, as the generator would draw it: what a player
 * does next in a randomised play session (milestone J, P7). Null when nothing fits this draw.
 */
export function actFor(world: MatterWorld, seed: number): { act: Act; view: ActView } | null {
  const d = new Draw(Rng.fromSeed(seed));
  const ids = Object.keys(world.things).sort();
  const act = ACTS[d.pick(MIX)](d, world, ids);
  const view = act && viewOf(act);
  return act && view ? { act, view } : null;
}
