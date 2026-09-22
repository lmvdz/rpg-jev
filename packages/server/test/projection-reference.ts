/** Frozen pre-preparation projector: independent oracle for the refresh optimization. */
import { matter } from "@rpg-jev/core";
import { INK } from "../../client/src/palette.ts";
import type { SharedView } from "../../client/src/play/shared-types.ts";
import { type ElementView, shownOf } from "../../client/src/play/world-link.ts";
import type { ThingView } from "../../client/src/view/things.ts";
import { clearing, lookOf, SEED } from "../module/src/world.ts";

const meterLevel = (value: number) => Math.round(Math.max(0, Math.min(1, value)) * 100) / 100;
const elementView = (element: matter.Element): ElementView => ({
  name: element.name,
  kind: element.kind,
  forms: element.forms,
  baseline: { mass: element.props.mass ?? 0, hardness: element.props.hardness ?? 0 },
  solid: (element.props.size ?? 0) >= 4,
  ...(element.look ? { look: element.look } : {}),
});

export function referenceProject(
  state: matter.SharedState,
  actor: string,
  revision: number,
  sequence: number,
): SharedView {
  const { world } = state;
  const hero = world.bodies[actor];
  if (!hero?.where) throw new Error("Admitted player has no position");
  const visible = (source: { place: string; where?: readonly [number, number] | undefined }) =>
    source.place === hero.place && matter.reaches(world, hero, source, "sight", 5) > 0;
  const held = new Set(Object.values(world.bodies).flatMap((body) => body.holds ?? []));
  const things: ThingView[] = [];
  const elements: Record<string, ElementView> = {};
  for (const thing of Object.values(world.things)) {
    if (!thing.where || held.has(thing.id) || !visible(thing)) continue;
    const element = world.elements[thing.element];
    if (!element) continue;
    elements[element.id] = elementView(element);
    things.push({
      id: thing.id,
      element: element.id,
      name: lookOf(thing.id)?.name ?? element.name,
      kind: element.kind,
      solid: (element.props.size ?? 0) >= 4,
      x: thing.where[0],
      z: thing.where[1],
      states: shownOf({
        element: thing.element,
        state: thing.state,
        blaze: matter.blaze(world, thing),
      }),
    });
  }
  for (const thing of clearing.things) {
    if (world.elements[thing.element] || !visible({ place: "clearing", where: [thing.x, thing.z] }))
      continue;
    things.push({ ...thing });
  }
  for (const body of Object.values(world.bodies)) {
    if (body.id === actor || !body.where || !visible(body)) continue;
    const element = world.elements[body.element ?? ""];
    if (!element) continue;
    elements[element.id] = elementView(element);
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
  return {
    actor,
    revision,
    sequence,
    tick: state.tick,
    seed: SEED,
    position: [...hero.where],
    things,
    elements,
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
