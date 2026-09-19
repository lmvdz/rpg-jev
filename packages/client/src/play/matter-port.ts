/**
 * The world behind the clearing: a `MatterWorld` (packages/core/src/matter)
 * made from the element pool and the things the generator scattered, behind
 * the port the client talks to (`world-port.ts`). An act is compiled from the
 * answers and resolved by the engine, the world is replaced by the one the
 * engine returns, and every thing a change names is read back off that world.
 * Nothing here applies a change or decides an outcome.
 *
 * Stand-ins, until the world is the server's: the whole clearing is one
 * place whose extent is its area, what it has an abundance of is written
 * here, and whether a thing fills its tile is read off its size.
 */
import { matter } from "@rpg-jev/core";
import { Rng } from "@rpg-jev/core/rng";
import { INK } from "../palette.ts";
import type { BodyView } from "../view/body.ts";
import { checkLook } from "../view/look-birth.ts";
import type { ThingView } from "../view/things.ts";
import type { Answers } from "./act-request.ts";
import type { After, ElementView, Seen } from "./world-link.ts";
import type { Outcome, Standing, WorldPort } from "./world-port.ts";

const PLACE = "clearing";
const ACTOR = "hero";
const HANDS = "hands";
/** What can be found here by looking, as the place's latent abundance (a Score per element). */
const ABUNDANCE = { stone: 2, flint: 1, branch: 3, berries: 1 };
/** How many tiles make one patch of ground a person goes over in half an hour: the place's extent. */
const TILES_PER_PATCH = 40;
/** From this size up a thing fills its tile (P2). */
const FILLS_TILE = 4;

/** The engine's state for a thing as the client first shows it: fresh, then what can be seen. */
function stateOf(thing: ThingView, element: matter.Element): matter.ThingState {
  const { temperature, amount, wetness, integrity, contamination, corrosion } = thing.states;
  return {
    ...matter.FRESH,
    // What is fresh is not bone dry: whether it rots or burns depends on it.
    wetness: wetness ?? element.moist ?? matter.FRESH.wetness,
    ...(temperature === undefined ? {} : { temperature }),
    ...(amount === undefined ? {} : { amount }),
    ...(integrity === undefined ? {} : { integrity }),
    ...(contamination === undefined ? {} : { contamination }),
    ...(corrosion === undefined ? {} : { corrosion }),
  };
}

function worldFrom(things: readonly ThingView[], tiles: number): matter.MatterWorld {
  const extent = Math.max(1, Math.round(tiles / TILES_PER_PATCH));
  const place = matter.placeOf(PLACE, { abundance: ABUNDANCE, extent });
  const world = matter.worldOf(matter.POOL, [place]);
  for (const thing of things) {
    const element = world.elements[thing.element];
    if (!element) {
      // The pool has no creatures yet: one on the map brings a row made from what it is like.
      if (thing.kind === "creature") embody(world, thing);
      continue;
    }
    const state = stateOf(thing, element);
    // Positions are the client's: sensing needs to know how far off a thing is.
    const where = [thing.x, thing.z] as const;
    const made = { id: thing.id, element: thing.element, place: PLACE, state, where };
    // A fire is not an element: it is fuel, burning, for as long as there is of it.
    world.things[thing.id] = (thing.states.burning ?? 0) > 0 ? matter.alight(world, made) : made;
  }
  world.things[HANDS] = { id: HANDS, element: "hand", place: PLACE, state: { ...matter.FRESH } };
  world.bodies[ACTOR] = { ...WHOLE, id: ACTOR, needs: { hunger: 1, rest: 1, warmth: 0 } };
  return world;
}

/** A body as it is whole and well. */
const WHOLE = { place: PLACE, health: 5, wounds: [], sickness: 0, sickensIn: 0 };

/**
 * A creature on the map becomes a body of the world, so that it notices and
 * acts. Its row is a stand-in made from the thing's own kind, forms and
 * baseline levels, naming nothing: the small are quick and keen-nosed, the
 * heavy are strong. Born rows will replace it.
 */
function embody(world: matter.MatterWorld, thing: ThingView): void {
  const mass = Math.min(Math.max(Math.round(thing.baseline?.mass ?? 2), 0), 5);
  world.elements[thing.element] ??= {
    id: thing.element,
    name: thing.name,
    kind: "creature",
    forms: [],
    props: { mass, size: mass, hardness: thing.baseline?.hardness ?? 1 },
    body: { strength: mass, speed: 5 - mass, sight: 2, hearing: 3, smell: 5 - mass },
  };
  world.bodies[thing.id] = {
    ...WHOLE,
    id: thing.id,
    element: thing.element,
    where: [thing.x, thing.z],
    // Hungry enough to go looking: a creature at rest on a full belly shows nothing.
    needs: { hunger: 3, rest: 0 },
  };
}

/** The ids of the things a change is about. What happened to them is read off the world, not the change. */
function touchedBy(change: matter.Change): string[] {
  // Nothing a person standing there would notice: the world applied it, and there is nothing to redraw.
  if (change.quiet) return [];
  if (change.kind === "state" || change.kind === "consume") return [change.thing];
  return change.kind === "create" ? [change.thing.id] : [];
}

/** How light the place is at an hour of the day, 0 dark to 5 noon: up from five, down by seven at night. */
const lightAt = (hour: number) =>
  Math.round(5 * Math.max(0, Math.sin((Math.PI * (hour - 5)) / 14)));

/**
 * What the client owns and the world needs is set before each act: where the
 * hero stands and how light it is. These are inputs the world has no process
 * for yet (move, a clock), not outcomes; outcomes are the engine's alone.
 */
function stood(world: matter.MatterWorld, standing: Standing): matter.MatterWorld {
  const hero = world.bodies[ACTOR];
  const place = world.places[PLACE];
  if (!(hero && place)) return world;
  return {
    ...world,
    bodies: { ...world.bodies, [ACTOR]: { ...hero, where: standing.where } },
    places: { ...world.places, [PLACE]: { ...place, light: lightAt(standing.hour) } },
  };
}

/** The hands are a thing so that they can strike, and are never drawn: they are the actor's. */
const drawn = (id: string) => id !== HANDS;

function elementView(element: matter.Element): ElementView {
  const { mass, hardness, size } = element.props;
  const look = element.look && checkLook(element.look) === null ? element.look : null;
  return {
    name: element.name,
    kind: element.kind,
    forms: element.forms,
    baseline: { mass: mass ?? 0, hardness: hardness ?? 0 },
    solid: (size ?? 0) >= FILLS_TILE,
    ...(look ? { look } : {}),
  };
}

/** How a need is shown: the word for having it met, and the bar's colour. One row per need, as data. */
const NEED_ROWS: Readonly<Record<string, { label: string; ink: number }>> = {
  hunger: { label: "fed", ink: INK.sand },
  rest: { label: "rested", ink: INK.leaf },
  warmth: { label: "warm", ink: INK.lamp },
};

/** Writes a body's health and needs into the rows the status display shows, in place: a need is a want, so a full bar is none of it. */
function statusOf(body: matter.Body, view: BodyView): void {
  const levels: [string, string, number, number][] = [
    ["health", "health", body.health / 5, INK.ember],
    ...Object.entries(body.needs)
      .filter(([need]) => need in NEED_ROWS)
      .map(([need, want]): [string, string, number, number] => {
        const row = NEED_ROWS[need] ?? { label: need, ink: INK.bone };
        return [need, row.label, 1 - (want ?? 0) / 5, row.ink];
      }),
    ...(body.wetness === undefined
      ? []
      : [["wetness", "dry", 1 - body.wetness / 5, INK.water] as [string, string, number, number]]),
  ];
  for (const [id, label, level, ink] of levels) {
    const meter = view.meters.find((known) => known.id === id);
    if (meter) meter.level = level;
    else view.meters.push({ id, label, level, ink });
  }
}

type Tile = readonly [number, number];
const tileOf = (where: Tile): Tile => [Math.round(where[0]), Math.round(where[1])];

interface Turn {
  world: matter.MatterWorld;
  changes: matter.Change[];
  moved: Record<string, Tile>;
}

/**
 * Every other body takes its turn after the hero's act: what it does is
 * chosen by its needs from the closed options the world built from what it
 * has noticed (`matter.routine`, no judge), and resolved by the engine. Where
 * a body can stand is the map's to say, so a move onto a tile it cannot stand
 * on is put back: positions are the client's until the world knows the ground.
 */
function othersAct(world: matter.MatterWorld, canStand: (tile: Tile) => boolean): Turn {
  const turn: Turn = { world, changes: [], moved: {} };
  for (const id of Object.keys(world.bodies)) {
    const body = turn.world.bodies[id];
    if (!body || id === ACTOR) continue;
    const chosen = matter.routine(turn.world, body);
    if (!chosen.act) continue;
    const outcome = matter.resolve(turn.world, chosen.act);
    turn.world = outcome.world;
    turn.changes.push(...outcome.changes);
    const went = outcome.world.bodies[id]?.where;
    if (!(went && body.where)) continue;
    const [from, to] = [tileOf(body.where), tileOf(went)];
    if (from[0] === to[0] && from[1] === to[1]) continue;
    if (canStand(to)) turn.moved[id] = to;
    else {
      const stays = { ...outcome.world.bodies[id], where: body.where } as matter.Body;
      turn.world = { ...turn.world, bodies: { ...turn.world.bodies, [id]: stays } };
    }
  }
  return turn;
}

export interface MatterPort extends WorldPort {
  /** The world as it stands. Replaced whole by each resolved act. */
  readonly world: matter.MatterWorld;
  /** Every draw handed to the engine, with the act it was for: logged, so an act can be replayed. */
  readonly draws: { process: string; draw: number }[];
}

export interface MatterPortOptions {
  /** How much ground the things are scattered over: the one place's extent follows from it. */
  tiles: number;
  seed: number;
  /** Whether a body can stand on a tile: the map's to say. Absent, anywhere. */
  canStand?(tile: Tile): boolean;
}

export function matterPort(things: readonly ThingView[], options: MatterPortOptions): MatterPort {
  const rng = Rng.fromSeed(options.seed);
  const canStand = options.canStand ?? (() => true);
  let world = worldFrom(things, options.tiles);
  const draws: MatterPort["draws"] = [];
  const status: BodyView = { meters: [], counts: [] };
  const hero = world.bodies[ACTOR];
  if (hero) statusOf(hero, status);

  const seenOf = (id: string): Seen | null => {
    const thing = world.things[id];
    if (!thing) return null;
    return { element: thing.element, state: thing.state, blaze: matter.blaze(world, thing) };
  };

  return {
    get world() {
      return world;
    },
    draws,
    compiled: matter.COMPILED,
    sought: () => Object.keys(world.places[PLACE]?.abundance ?? {}),
    elementOf: (id) => {
      const element = world.elements[id];
      return element ? elementView(element) : null;
    },
    aware() {
      const all = Object.entries(world.bodies[ACTOR]?.aware ?? {});
      const aware = all.filter(([source]) => drawn(source));
      const named = aware.map(([source, percept]) => {
        const element = world.things[source]?.element ?? "";
        const name = world.elements[element]?.name ?? "something";
        return { source, name, channel: percept.channel, strength: percept.strength };
      });
      return named.sort((a, b) => b.strength - a.strength);
    },
    act(answers: Answers, operands, standing): Outcome | null {
      if (standing) world = stood(world, standing);
      const draw = rng.next();
      const compiling = { answers, operands: { ...operands }, actor: ACTOR, hands: HANDS };
      const act = matter.compile(world, { ...compiling, place: PLACE, draw });
      if (!act) return null;
      draws.push({ process: act.process, draw });
      const outcome = matter.resolve(world, act);
      const others = othersAct(outcome.world, canStand);
      world = others.world;
      const changes = [...outcome.changes, ...others.changes];
      const after: Record<string, Seen | null> = {};
      for (const id of changes.flatMap(touchedBy).filter(drawn)) after[id] = seenOf(id);
      const body = world.bodies[ACTOR];
      if (body) statusOf(body, status);
      return { process: act.process, changes, after: after satisfies After, moved: others.moved };
    },
    body: () => status,
  };
}
