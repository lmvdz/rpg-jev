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
import { checkLook } from "../view/look-birth.ts";
import type { ThingView } from "../view/things.ts";
import type { Answers } from "./act-request.ts";
import type { After, ElementView, Seen } from "./world-link.ts";
import type { Outcome, WorldPort } from "./world-port.ts";

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
  const { temperature, amount, wetness, integrity } = thing.states;
  return {
    ...matter.FRESH,
    // What is fresh is not bone dry: whether it rots or burns depends on it.
    wetness: wetness ?? element.moist ?? matter.FRESH.wetness,
    ...(temperature === undefined ? {} : { temperature }),
    ...(amount === undefined ? {} : { amount }),
    ...(integrity === undefined ? {} : { integrity }),
  };
}

function worldFrom(things: readonly ThingView[], tiles: number): matter.MatterWorld {
  const extent = Math.max(1, Math.round(tiles / TILES_PER_PATCH));
  const place = matter.placeOf(PLACE, { abundance: ABUNDANCE, extent });
  const world = matter.worldOf(matter.POOL, [place]);
  for (const thing of things) {
    const element = world.elements[thing.element];
    // A thing of no element in the pool (a creature, until bodies have rows) is not the world's yet.
    if (!element) continue;
    const state = stateOf(thing, element);
    const made = { id: thing.id, element: thing.element, place: PLACE, state };
    // A fire is not an element: it is fuel, burning, for as long as there is of it.
    world.things[thing.id] = (thing.states.burning ?? 0) > 0 ? matter.alight(world, made) : made;
  }
  world.things[HANDS] = { id: HANDS, element: "hand", place: PLACE, state: { ...matter.FRESH } };
  world.bodies[ACTOR] = {
    id: ACTOR,
    place: PLACE,
    needs: {},
    health: 5,
    wounds: [],
    sickness: 0,
    sickensIn: 0,
  };
  return world;
}

/** The ids of the things a change is about. What happened to them is read off the world, not the change. */
function touchedBy(change: matter.Change): string[] {
  // Nothing a person standing there would notice: the world applied it, and there is nothing to redraw.
  if (change.quiet) return [];
  if (change.kind === "state" || change.kind === "consume") return [change.thing];
  return change.kind === "create" ? [change.thing.id] : [];
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

export interface MatterPort extends WorldPort {
  /** The world as it stands. Replaced whole by each resolved act. */
  readonly world: matter.MatterWorld;
  /** Every draw handed to the engine, with the act it was for: logged, so an act can be replayed. */
  readonly draws: { process: string; draw: number }[];
}

/** `tiles` is how much ground the things are scattered over: the one place's extent follows from it. */
export function matterPort(things: readonly ThingView[], tiles: number, seed: number): MatterPort {
  const rng = Rng.fromSeed(seed);
  let world = worldFrom(things, tiles);
  const draws: MatterPort["draws"] = [];

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
    act(answers: Answers, operands): Outcome | null {
      const draw = rng.next();
      const compiling = { answers, operands: { ...operands }, actor: ACTOR, hands: HANDS };
      const act = matter.compile(world, { ...compiling, place: PLACE, draw });
      if (!act) return null;
      draws.push({ process: act.process, draw });
      const outcome = matter.resolve(world, act);
      world = outcome.world;
      const after: Record<string, Seen | null> = {};
      for (const id of outcome.changes.flatMap(touchedBy).filter(drawn)) after[id] = seenOf(id);
      return { process: act.process, changes: outcome.changes, after: after satisfies After };
    },
  };
}
