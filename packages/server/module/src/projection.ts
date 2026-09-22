/** Per-viewer surface projection. Never serialize another body's needs, memory or intentions. */
import { matter } from "@rpg-jev/core";
import { INK } from "../../../client/src/palette.ts";
import type { SharedView } from "../../../client/src/play/shared-types.ts";
import { type ElementView, shownOf } from "../../../client/src/play/world-link.ts";
import type { ThingView } from "../../../client/src/view/things.ts";
import { clearing, lookOf, SEED } from "./world.ts";

function elementView(element: matter.Element): ElementView {
  return {
    name: element.name,
    kind: element.kind,
    forms: element.forms,
    baseline: { mass: element.props.mass ?? 0, hardness: element.props.hardness ?? 0 },
    solid: (element.props.size ?? 0) >= 4,
    ...(element.look ? { look: element.look } : {}),
  };
}

type Visible = (source: {
  place: string;
  where?: readonly [number, number] | undefined;
}) => boolean;

// The HUD displays whole percentages; sub-pixel need drift is not public detail.
const meterLevel = (value: number) => Math.round(Math.max(0, Math.min(1, value)) * 100) / 100;

/**
 * Compare host-authored encoded snapshots without expanding their dictionaries.
 * These inputs are produced by the bounded encoder, not accepted from clients.
 */
export function shouldPublishTick(previousJson: string, nextJson: string): boolean {
  const previous: { wire?: number; revision: number; tick: number } = JSON.parse(previousJson);
  const next: { wire?: number; revision: number; tick: number } = JSON.parse(nextJson);
  if (previous.wire !== next.wire) return true;
  if (next.tick - previous.tick >= 2) return true;
  previous.revision = next.revision;
  previous.tick = next.tick;
  return JSON.stringify(previous) !== nextJson;
}

function creatures(
  world: matter.MatterWorld,
  actor: string,
  visible: Visible,
  elements: Record<string, ElementView>,
  prepared: ReadonlyMap<matter.Element, ElementView>,
): ThingView[] {
  const things: ThingView[] = [];
  for (const body of Object.values(world.bodies)) {
    if (body.id === actor || !body.where || !visible(body)) continue;
    const element = world.elements[body.element ?? ""];
    if (!element) continue;
    const presentation = prepared.get(element);
    if (!presentation) throw new Error("Missing prepared creature element");
    elements[element.id] = presentation;
    things.push({
      id: body.id,
      element: element.id,
      name: body.id.startsWith("player-") ? `Traveller ${body.id.slice(7)}` : element.name,
      kind: "creature",
      solid: false,
      x: body.where[0],
      z: body.where[1],
      states: {},
    });
  }
  return things;
}

interface Surface {
  place: string;
  where: readonly [number, number];
  thing: ThingView;
  element?: matter.Element;
}

/** Prepare only for this immutable refresh snapshot; the returned function still filters each observer. */
export function prepareProjection(
  state: matter.SharedState,
): (actor: string, revision: number, sequence: number) => SharedView {
  const { world } = state;
  const held = new Set(Object.values(world.bodies).flatMap((body) => body.holds ?? []));
  const prepared = new Map(
    Object.values(world.elements).map((element) => [element, elementView(element)] as const),
  );
  const surfaces: Surface[] = [];
  for (const thing of Object.values(world.things)) {
    if (!thing.where || held.has(thing.id)) continue;
    const element = world.elements[thing.element];
    if (!element) continue;
    const authored = lookOf(thing.id);
    surfaces.push({
      place: thing.place,
      where: thing.where,
      element,
      thing: {
        id: thing.id,
        element: element.id,
        name: authored?.name ?? element.name,
        kind: element.kind,
        solid: (element.props.size ?? 0) >= 4,
        x: thing.where[0],
        z: thing.where[1],
        states: shownOf({
          element: thing.element,
          state: thing.state,
          blaze: matter.blaze(world, thing),
        }),
      },
    });
  }
  // Static scenery with no admitted matter row remains visible scenery, not an executable thing.
  for (const thing of clearing.things) {
    if (world.elements[thing.element]) continue;
    surfaces.push({ place: "clearing", where: [thing.x, thing.z], thing });
  }
  return (actor, revision, sequence) =>
    projectPrepared(state, actor, revision, sequence, surfaces, prepared);
}

function projectPrepared(
  state: matter.SharedState,
  actor: string,
  revision: number,
  sequence: number,
  surfaces: readonly Surface[],
  prepared: ReadonlyMap<matter.Element, ElementView>,
): SharedView {
  const { world } = state;
  const hero = world.bodies[actor];
  if (!hero?.where) throw new Error("Admitted player has no position");
  const visible: Visible = (source) =>
    source.place === hero.place && matter.reaches(world, hero, source, "sight", 5) > 0;
  const things: ThingView[] = [];
  const elements: Record<string, ElementView> = {};
  for (const surface of surfaces) {
    if (!visible(surface)) continue;
    if (surface.element) {
      const presentation = prepared.get(surface.element);
      if (!presentation) throw new Error("Missing prepared material element");
      elements[surface.element.id] = presentation;
    }
    things.push({
      ...surface.thing,
      ...(surface.element ? { states: { ...surface.thing.states } } : {}),
    });
  }
  things.push(...creatures(world, actor, visible, elements, prepared));
  return {
    actor,
    revision,
    sequence,
    tick: state.tick,
    seed: SEED,
    position: [...hero.where],
    things,
    elements: Object.fromEntries(
      Object.entries(elements).map(([id, element]) => [
        id,
        { ...element, baseline: { ...element.baseline } },
      ]),
    ),
    body: {
      meters: [
        { id: "health", label: "health", level: meterLevel(hero.health / 5), ink: INK.ember },
        {
          id: "hunger",
          label: "fed",
          level: meterLevel(1 - (hero.needs.hunger ?? 0) / 5),
          ink: INK.sand,
        },
      ],
      counts: [],
    },
    aware: things.map((thing) => ({
      source: thing.id,
      name: thing.name,
      channel: "sight",
      strength: 1,
    })),
    compiled: matter.COMPILED.filter((id) => id !== "X7"),
    sought: Object.keys(world.places[hero.place]?.abundance ?? {}),
  };
}

/** Single-observer compatibility entry point; refresh loops should prepare once for all observers. */
export function project(
  state: matter.SharedState,
  actor: string,
  revision: number,
  sequence: number,
): SharedView {
  return prepareProjection(state)(actor, revision, sequence);
}
