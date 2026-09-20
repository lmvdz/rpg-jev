/**
 * Consequential state lives only in core. This adapter projects visible surfaces
 * and the controlled body's own state; it never publishes another body's needs,
 * awareness, choice weights, or intentions.
 */
import { matter } from "@rpg-jev/core";
import { INK } from "../palette.ts";
import {
  FOOD_DEPTH,
  FOOD_GOAL,
  FOOD_HERO,
  FOOD_PLACE,
  FOOD_WIDTH,
  inCamp,
  newFoodSession,
} from "../scene/food.ts";
import type { BodyView } from "../view/body.ts";
import type { ThingView } from "../view/things.ts";

export const FOOD_SAVE_KEY = "rpg-jev.food-session.v1";
export interface FoodView {
  tick: number;
  where: readonly [number, number];
  things: ThingView[];
  held: { id: string; name: string; amount: number }[];
  portions: { id: string; name: string; amount: number; x: number; z: number }[];
  atCamp: number;
  body: BodyView;
}

function sightFrom(world: matter.MatterSession["world"], hero: matter.Body) {
  return (source: matter.Thing | matter.Body): boolean => {
    const size = world.elements[source.element ?? ""]?.props.size ?? 3;
    const light = world.places[source.place]?.light ?? 3;
    return (
      source.place === hero.place &&
      matter.reaches(world, hero, source, "sight", (light / 5) * (2.5 + size * 0.5)) > 0
    );
  };
}

function visibleCreatures(
  world: matter.MatterSession["world"],
  visible: (source: matter.Body) => boolean,
): ThingView[] {
  const things: ThingView[] = [];
  for (const body of Object.values(world.bodies)) {
    if (body.id === FOOD_HERO || !body.where || !visible(body)) continue;
    const element = world.elements[body.element ?? ""];
    if (!element) continue;
    things.push({
      id: body.id,
      element: element.id,
      name: element.name,
      kind: "creature",
      solid: false,
      x: body.where[0],
      z: body.where[1],
      ...(element.look ? { look: element.look } : {}),
      states: {},
    });
  }
  return things;
}

/** The projection is also the source of menu targets: unseen things get no UI handles. */
export function foodView(session: matter.MatterSession): FoodView {
  const { world } = session;
  const hero = world.bodies[FOOD_HERO];
  if (!hero?.where) throw new Error("The saved player has no position.");
  const heldIds = new Set(hero.holds ?? []);
  const carried = new Set(Object.values(world.bodies).flatMap((body) => body.holds ?? []));
  const visible = sightFrom(world, hero);
  const things: ThingView[] = [];
  const portions: FoodView["portions"] = [];
  const held: FoodView["held"] = [];
  for (const thing of Object.values(world.things)) {
    const element = world.elements[thing.element];
    if (!element) continue;
    if (heldIds.has(thing.id))
      held.push({ id: thing.id, name: element.name, amount: thing.state.amount });
    if (carried.has(thing.id) || !thing.where || !visible(thing)) continue;
    const [x, z] = thing.where;
    if ((element.serves?.hunger ?? 0) > 0)
      portions.push({ id: thing.id, name: element.name, amount: thing.state.amount, x, z });
    things.push({
      id: thing.id,
      element: element.id,
      name: element.name,
      kind: element.kind,
      solid: (element.props.size ?? 0) >= 4,
      x,
      z,
      ...(element.look ? { look: element.look } : {}),
      states: { amount: thing.state.amount },
    });
  }
  things.push(...visibleCreatures(world, visible));
  return {
    tick: session.tick,
    where: hero.where,
    things,
    held,
    portions,
    atCamp: portions.filter((p) => inCamp(p.x, p.z)).reduce((n, p) => n + p.amount, 0),
    body: {
      meters: [
        { id: "health", label: "health", level: hero.health / 5, ink: INK.ember },
        { id: "hunger", label: "fed", level: 1 - (hero.needs.hunger ?? 0) / 5, ink: INK.sand },
      ],
      counts: [{ id: "carried", label: "carried", value: held.reduce((n, p) => n + p.amount, 0) }],
    },
  };
}

function distance(a: { x: number; z: number }, b: { x: number; z: number }): number {
  return Math.abs(a.x - b.x) + Math.abs(a.z - b.z);
}

function movementCue(was: ThingView, now: ThingView, before: FoodView, after: FoodView): string {
  const approaching = after.portions.find((portion) => {
    const previous = before.portions.find((p) => p.id === portion.id);
    return (
      previous &&
      previous.x === portion.x &&
      previous.z === portion.z &&
      distance(now, portion) < distance(was, portion)
    );
  });
  if (approaching) return `${now.name} moves closer to ${approaching.name}.`;
  const hero = { x: after.where[0], z: after.where[1] };
  if (distance(now, hero) < distance(was, hero)) return `${now.name} moves closer to you.`;
  if (distance(now, hero) > distance(was, hero)) return `${now.name} moves farther from you.`;
  return `${now.name} moves across the clearing.`;
}

/** Only compare public projections; a lost sighting is not proof of consumption. */
function observedChanges(before: FoodView, after: FoodView, action: matter.MatterAction): string[] {
  const messages: string[] = [];
  for (const thing of after.things.filter((t) => t.kind === "creature")) {
    const was = before.things.find((t) => t.id === thing.id);
    if (was && (was.x !== thing.x || was.z !== thing.z))
      messages.push(movementCue(was, thing, before, after));
  }
  const remaining = new Set([...after.portions, ...after.held].map((p) => p.id));
  for (const portion of before.portions) {
    if (remaining.has(portion.id) || (action.kind === "eat" && action.thing === portion.id))
      continue;
    messages.push(`${portion.name} is no longer visible on the ground.`);
  }
  return messages;
}

function readSession(text: string): matter.MatterSession {
  const session = matter.restoreMatterSession(text);
  const terrain = newFoodSession().terrain;
  if (
    session.terrain.place !== FOOD_PLACE ||
    session.terrain.width !== FOOD_WIDTH ||
    session.terrain.height !== FOOD_DEPTH ||
    session.controlled.join(",") !== FOOD_HERO ||
    session.autonomous.join(",") !== "forager" ||
    session.terrain.walkable.some((open, index) => open !== terrain.walkable[index])
  )
    throw new Error("This snapshot is not the shared-food clearing.");
  return session;
}

/** Snapshot IO is explicit and never uses wall-clock time or offline catch-up. */
export class FoodSession {
  #session = newFoodSession();
  view = foodView(this.#session);
  notice = `Gather ${FOOD_GOAL} food portions at camp for your journey. Food left there remains shared.`;
  failure = "";
  savedTick: number | null = null;
  dirty = true;
  paused = false;
  readonly events: string[] = [];

  constructor() {
    this.reload(true);
  }

  restart(): void {
    this.#session = newFoodSession();
    this.view = foodView(this.#session);
    this.dirty = true;
    this.paused = false;
    this.events.splice(0);
    this.notice = "New unsaved clearing. The previous saved session has not been overwritten.";
  }

  step(action: matter.MatterAction, tick = this.view.tick): boolean {
    if (this.paused) {
      this.notice = "Paused. Resume before taking another turn.";
      return false;
    }
    const before = this.view;
    const outcome = matter.stepMatterSession(this.#session, { actor: FOOD_HERO, tick, action });
    if (!outcome.ok) {
      this.notice = `Not done: ${outcome.reason}`;
      return false;
    }
    this.#session = outcome.session;
    this.view = foodView(this.#session);
    this.dirty = true;
    // Events come from observable before/after differences, never raw core notes.
    const messages = observedChanges(before, this.view, action);
    const verb = {
      move: "You walk.",
      wait: "You wait.",
      take: "You pick up a portion.",
      drop: "You put down a portion.",
      eat: "You eat a portion.",
    }[action.kind];
    this.notice = `${verb} ${messages.join(" ")}`.trim();
    this.events.unshift(`Turn ${this.view.tick}: ${this.notice}`);
    this.events.splice(8);
    return true;
  }

  save(): void {
    try {
      localStorage.setItem(FOOD_SAVE_KEY, matter.serializeMatterSession(this.#session));
      this.savedTick = this.view.tick;
      this.dirty = false;
      this.failure = "";
      this.notice = `Saved turn ${this.view.tick} in this browser (positions, needs, food and possession).`;
    } catch (error) {
      this.failure = `Save failed: ${String(error)}. Current play remains in memory.`;
    }
  }

  reload(initial = false): boolean {
    try {
      const text = localStorage.getItem(FOOD_SAVE_KEY);
      if (!text) {
        if (!initial) this.failure = "No saved food session exists. Current play was kept.";
        return false;
      }
      const restored = readSession(text);
      const view = foodView(restored);
      this.#session = restored;
      this.view = view;
      this.savedTick = view.tick;
      this.dirty = false;
      this.events.splice(0);
      this.failure = "";
      this.notice = `Restored turn ${view.tick}. No time passed while away.`;
      return true;
    } catch (error) {
      this.failure = `Restore failed: ${String(error)}. ${initial ? "A new, unsaved clearing is shown; the bad save was not overwritten." : "Current play was kept."}`;
      return false;
    }
  }

  get progress(): string {
    return `Visible food on camp ground: ${this.view.atCamp}/${FOOD_GOAL}${this.view.atCamp >= FOOD_GOAL ? " — supplied for now" : ""}`;
  }
}
