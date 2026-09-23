/**
 * A stratified scenario generator (physics coverage follow-up, `docs/physics-coverage.md`): from
 * a seed, it targets one situation cell `coverage.ts`'s `possible` says the engine could reach,
 * then builds a world and act for it through exactly the same engine types and construction
 * helpers `scenario.ts`'s teacher generator uses (elements, `apply`, `interiorOf`, the `Draw`
 * dice), so nothing here can produce a state the engine could not otherwise hold. It never reads
 * or writes `scenario()`'s own output; `scenario-pin.test.ts` pins that generator's output, over
 * a seed from every named range in SPEC section 16, from before this file existed.
 *
 * `scenario()` draws two parties mostly from a `fit` bias (`two`'s 85-90% preference) over
 * whatever a randomly built world happens to contain, so its coverage of the 12,769-cell possible
 * universe is a side effect of what six element archetypes and a handful of chances land on. This
 * generator instead treats the cell itself as the input: `possibleCells()` names every reachable
 * combination of process, both parties' material class, the worse heat/wet/whole band and their
 * relation, one is picked per seed, and the world is built backwards from it — the two named
 * parties first, in whatever shape reaches that class and band, related the way the cell asks,
 * then a couple of ordinarily drawn bystanders so the scene is not a sterile pair.
 */
import { apply } from "../matter/apply.ts";
import { interiorOf } from "../matter/contain.ts";
import { alight, placeOf, worldOf } from "../matter/pool.ts";
import type { Act } from "../matter/resolve.ts";
import {
  type Element,
  FRESH,
  type Kind,
  type MatterWorld,
  type Properties,
  type Thing,
} from "../matter/types.ts";
import { Rng } from "../rng.ts";
import {
  type HeatBand,
  type MaterialClass,
  possibleCells,
  type RelationBand,
  type SituationCell,
  type WetBand,
  type WholeBand,
} from "./coverage.ts";
import { type ActView, HOWS } from "./observe.ts";
import { Draw, type Scenario, viewOf } from "./scenario.ts";

export const SCENARIO_V3_VERSION = "jepa-scenario-v3";

const PLACE = "site";

type BaseClass = Exclude<MaterialClass, "gas" | "none" | "burning">;

interface Shape {
  forms: Element["forms"];
  kind: Kind;
  props: Partial<Properties>;
  moist?: number;
}

/** One element shape per non-burning class, each carrying only what its own class needs. */
const BASE_SHAPES: Record<BaseClass, (d: Draw) => Shape> = {
  liquid: (d) => ({ forms: ["liquid"], kind: "material", props: { mass: 1, size: d.int(1, 2) } }),
  powder: (d) => ({
    forms: ["granular"],
    kind: "material",
    props: { mass: d.int(0, 2), size: d.int(0, 2) },
  }),
  hollow: (d) => ({
    forms: ["hollow"],
    kind: "thing",
    props: { size: d.int(2, 4), mass: d.int(1, 3), hardness: d.int(1, 5) },
  }),
  plant: (d) => ({
    forms: [],
    kind: "plant",
    props: { flammability: d.int(1, 4), size: d.int(1, 3) },
    moist: d.int(0, 3),
  }),
  flammable: (d) => ({ forms: [], kind: "material", props: { flammability: d.int(1, 5) } }),
  inert: (d) => ({ forms: [], kind: "material", props: { hardness: d.int(1, 5) } }),
};

/**
 * Bases a `"burning"` party may light from: the same flammability precondition `scenario.ts`'s
 * own `thingOf` already asks of `alight` before it uses it, never a shape the engine could not
 * ignite in the first place.
 */
const BURNABLE_BASES: readonly BaseClass[] = ["flammable", "plant", "powder", "hollow"];

/** `effective.ts`'s `meltingPoint` bottoms out at 3.5 (level 5): the lowest that still melts. */
const MELTED_HOLLOW_MELTS_AT = 5;

/**
 * The shape one party needs. A party that structurally contains the other (`containerRole`)
 * always keeps a hollow form (`coverage.ts`'s `CONTAINER_CLASSES`), even when its *class* reads
 * `"liquid"` (melted) or `"burning"` (alight): both are the same hollow thing, just melted or lit.
 */
function shapeFor(d: Draw, cls: MaterialClass, containerRole: boolean): Shape {
  if (containerRole) {
    const hollow = BASE_SHAPES.hollow(d);
    if (cls === "liquid")
      return { ...hollow, props: { ...hollow.props, meltsAt: MELTED_HOLLOW_MELTS_AT } };
    if (cls === "burning")
      return { ...hollow, props: { ...hollow.props, flammability: d.int(1, 5) } };
    return hollow;
  }
  if (cls === "burning") {
    const base = BASE_SHAPES[d.pick(BURNABLE_BASES)](d);
    const flammability = Math.max(base.props.flammability ?? 0, d.int(1, 4));
    return { ...base, props: { ...base.props, flammability } };
  }
  return BASE_SHAPES[cls as BaseClass](d);
}

const HEAT_TEMPERATURES: Record<HeatBand, number> = { cold: 1, mild: 2, hot: 4, scorching: 5 };

function stateFor(cls: MaterialClass, heat: HeatBand, wet: WetBand, whole: WholeBand) {
  return {
    ...FRESH,
    temperature: HEAT_TEMPERATURES[heat],
    wetness: wet === "wet" ? 3 : 0,
    integrity: whole === "damaged" ? 2 : 5,
    amount: 2,
    ...(cls === "burning" ? { burning: { of: "self" as const, fuel: 30 } } : {}),
  };
}

interface Party {
  element: Element;
  thing: Thing;
}

function partyFor(
  d: Draw,
  id: string,
  cls: MaterialClass,
  cell: SituationCell,
  container: boolean,
): Party {
  const shape = shapeFor(d, cls, container);
  const element: Element = {
    id: `${id}-el`,
    name: `element ${id}`,
    kind: shape.kind,
    forms: shape.forms,
    props: shape.props,
    ...(shape.moist === undefined ? {} : { moist: shape.moist }),
    burnsTo: "ash",
  };
  const thing: Thing = {
    id,
    element: element.id,
    place: PLACE,
    where: [0, 0],
    state: stateFor(cls, cell.heat, cell.wet, cell.whole),
  };
  return { element, thing };
}

/** One thing structurally inside another, exactly as `scenario.ts`'s own `contained` sets it up. */
function enclose(
  world: MatterWorld,
  container: Thing,
  content: Thing,
): { world: MatterWorld; container: Thing; content: Thing } {
  const insideId = interiorOf(container.id);
  const inside = placeOf(insideId, { temperature: container.state.temperature, wind: 0, light: 0 });
  const next = apply(world, [
    { kind: "room", place: inside, because: [], note: "" },
    { kind: "enclose", thing: content.id, place: insideId, because: [], note: "" },
  ]);
  return { world: next, container, content: next.things[content.id] as Thing };
}

/** Places the two named parties the way the target cell's `relation` asks, `a`'s and `b`'s own
 * identity kept: `"contains"` and `"in"` enclose one in the other; `touching`/`near` set tiles. */
function situate(
  world: MatterWorld,
  a: Thing,
  b: Thing,
  relation: RelationBand,
  d: Draw,
): { world: MatterWorld; a: Thing; b: Thing } {
  if (relation === "contains") {
    const r = enclose(world, a, b);
    return { world: r.world, a: r.container, b: r.content };
  }
  if (relation === "in") {
    const r = enclose(world, b, a);
    return { world: r.world, a: r.content, b: r.container };
  }
  const distance = relation === "near" ? 2 : 0;
  const next: MatterWorld = { ...world, things: { ...world.things } };
  const at0 = [0, 0] as const;
  const at1 = [d.chance(0.5) ? distance : -distance, 0] as const;
  const aThing = { ...a, where: at0 };
  const bThing = { ...b, where: at1 };
  next.things[a.id] = aThing;
  next.things[b.id] = bThing;
  return { world: next, a: aThing, b: bThing };
}

/** An ordinarily built bystander thing, drawn the same loose way `scenario.ts`'s own `element`
 * and `stateOf` do, so a targeted cell's world is not only ever the two parties it names. */
function bystander(d: Draw, id: string): Party {
  const classes = Object.keys(BASE_SHAPES) as readonly BaseClass[];
  const shape = BASE_SHAPES[d.pick(classes)](d);
  const element: Element = {
    id: `${id}-el`,
    name: `element ${id}`,
    kind: shape.kind,
    forms: shape.forms,
    props: shape.props,
    ...(shape.moist === undefined ? {} : { moist: shape.moist }),
    ...(d.chance(0.5) ? { burnsTo: "ash" } : {}),
  };
  const wet = d.chance(0.3) ? d.int(1, 5) : 0;
  const thing: Thing = {
    id,
    element: element.id,
    place: PLACE,
    where: [d.int(0, 3), d.int(0, 3)],
    state: {
      ...FRESH,
      temperature: d.level(),
      wetness: wet,
      integrity: d.chance(0.75) ? 5 : d.int(1, 5),
      amount: d.int(1, 3),
    },
  };
  return { element, thing: d.chance(0.15) ? alight(worldOf([element], []), thing) : thing };
}

const manner = (d: Draw) => ({ effort: d.int(0, 5), care: d.int(0, 5), haste: d.int(0, 5) });

/** One `Act` per process, from the two already-placed parties. Mirrors `scenario.ts`'s own
 * `ACTS`, minus the party selection: the cell already decided who plays which role. */
const ACT_MAKERS: Record<
  Exclude<SituationCell["process"], "tick">,
  (a: string, b: string, d: Draw) => Act
> = {
  heat: (a, b, d) => ({
    process: "heat",
    source: a,
    target: b,
    minutes: d.int(1, 30),
    contact: d.pick([0.1, 0.3, 0.6, 1]),
  }),
  soak: (a, b, d) => ({ process: "soak", liquid: a, target: b, amount: d.int(1, 3) }),
  coat: (a, b, d) => ({
    process: "coat",
    substance: a,
    target: b,
    amount: d.int(1, 3),
    manner: manner(d),
  }),
  force: (a, b, d) => ({
    process: "force",
    instrument: a,
    patient: b,
    manner: manner(d),
    aim: d.pick(["through", "along", "surface"] as const),
  }),
  contain: (a, b, d) => ({
    process: "contain",
    how: d.pick(HOWS),
    container: a,
    thing: b,
    amount: d.int(1, 3),
  }),
  load: (a, b) => ({ process: "load", support: a, bearing: [b] }),
};

const TICK_MINUTES: readonly number[] = [1 / 600, 1 / 120, 1, 5, 15, 30, 60, 240];

function placeOfWorld(d: Draw) {
  return placeOf(PLACE, {
    temperature: d.level(),
    moisture: d.level(),
    wind: d.int(0, 3),
    air: d.chance(0.9) ? d.int(2, 5) : 0,
    light: d.level(),
  });
}

function tickScenario(seed: number, d: Draw): Scenario {
  const extras = [bystander(d, "t0"), bystander(d, "t1")];
  const world = worldOf(
    extras.map((p) => p.element),
    [placeOfWorld(d)],
  );
  for (const p of extras) world.things[p.thing.id] = p.thing;
  const act: Act = { process: "drift", minutes: d.pick(TICK_MINUTES) };
  const view = viewOf(act) as ActView;
  return { seed, world, act, view };
}

/**
 * The party `partyFor` must keep hollow-formed whatever class it targets: `a` for `"contains"`,
 * `b` for `"in"`. Only the *relation* forces this, never the process on its own: `contain`'s own
 * container role (`a`) is free to be any class when the two parties merely touch or stand near
 * (not yet enclosed) — the process's own `hollow()` gate declines it at resolve time, a real,
 * sampleable "only-nothing" cell the old generator never drew (`coverage.ts`'s `possible` docs).
 */
function containerRoleOf(cell: SituationCell): "a" | "b" | null {
  if (cell.relation === "contains") return "a";
  if (cell.relation === "in") return "b";
  return null;
}

function scenarioFor(seed: number, d: Draw, cell: SituationCell): Scenario {
  if (cell.process === "tick") return tickScenario(seed, d);
  const roleContainer = containerRoleOf(cell);
  const builtA = partyFor(d, "t0", cell.a, cell, roleContainer === "a");
  const builtB = partyFor(d, "t1", cell.b, cell, roleContainer === "b");
  const bystanders = Array.from({ length: d.int(0, 2) }, (_, i) => bystander(d, `t${i + 2}`));
  const elements = [builtA.element, builtB.element, ...bystanders.map((p) => p.element)];
  let world = worldOf(elements, [placeOfWorld(d)]);
  for (const p of [builtA, builtB, ...bystanders]) world.things[p.thing.id] = p.thing;
  const situated = situate(world, builtA.thing, builtB.thing, cell.relation, d);
  world = situated.world;
  const act = ACT_MAKERS[cell.process](situated.a.id, situated.b.id, d);
  const view = viewOf(act);
  if (!view) throw new Error(`scenarioV3: ${cell.process} produced no observable act`);
  return { seed, world, act, view };
}

const CELLS = possibleCells();

/**
 * One scenario from one seed, stratified over `coverage.ts`'s possible situation cells rather
 * than `scenario()`'s own archetype mix. The same seed always grows the same scene, act and
 * target cell; a seed picks a cell uniformly, so a rare cell gets the same odds as a common one.
 */
export function scenarioV3(seed: number): Scenario {
  const d = new Draw(Rng.fromSeed(seed));
  const cell = CELLS[d.int(0, CELLS.length - 1)] as SituationCell;
  return scenarioFor(seed, d, cell);
}
