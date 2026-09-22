/**
 * Containment: a thing in a hollow thing. The inside of a container is a place of its own
 * (`<container>.inside`), so every rule that reads a place (air for a flame, damp for drying,
 * warmth for cooling) already applies to what is in it: a sealed container has no air, and a
 * flame in it goes out by the same drift row that puts out a flame anywhere without air.
 *
 * The semantics follow the flat holder module (`../containment`): a closed holder admits
 * nothing and gives nothing up, what does not fit is refused, and nothing is made or lost
 * in a transfer. `test/matter/contain-oracle.test.ts` holds the two to the same verdicts.
 */
import { effective, isLiquid } from "./effective.ts";
import { heat } from "./heat.ts";
import { placeOf } from "./pool.ts";
import { quantity } from "./scale.ts";
import type { Change, MatterWorld, Place, Thing } from "./types.ts";

export interface ContainAct {
  process: "contain";
  how: "put" | "remove" | "seal" | "unseal" | "pour";
  container: string;
  /** What is put in, taken out or poured. Not read by seal or unseal. */
  thing?: string;
  /** For pour: how much of the liquid's amount goes in. */
  amount?: number;
}

const INSIDE = ".inside";

export const interiorOf = (container: string): string => `${container}${INSIDE}`;

/** The container a thing is in, or undefined when it is not in one. */
export function containerOf(world: MatterWorld, thing: Pick<Thing, "place">): Thing | undefined {
  if (!thing.place.endsWith(INSIDE)) return undefined;
  return world.things[thing.place.slice(0, -INSIDE.length)];
}

/** Whether the inside of a container is closed off: no air gets in or out. */
export function sealed(world: MatterWorld, container: string): boolean {
  const inside = world.places[interiorOf(container)];
  return !!inside && inside.air <= 0;
}

export const contentsOf = (world: MatterWorld, container: string): Thing[] =>
  Object.values(world.things).filter((t) => t.place === interiorOf(container));

const nothing = (note: string): Change[] => [
  { kind: "nothing", because: ["X1", "R2", "R10"], note },
];

function hollow(world: MatterWorld, thing: Thing | undefined): thing is Thing {
  return !!thing && !!world.elements[thing.element]?.forms.includes("hollow");
}

/** Whether `inner` is `outer` or anywhere inside it: a box cannot go into what it holds. */
function within(world: MatterWorld, inner: Thing, outer: Thing): boolean {
  let at: Thing | undefined = inner;
  for (let depth = 0; at && depth < 64; depth++) {
    if (at.id === outer.id) return true;
    at = containerOf(world, at);
  }
  return false;
}

/** How much room a thing takes: a level of size is a step of four (scale.ts), times amount. */
function volumeOf(world: MatterWorld, thing: Thing, amount = thing.state.amount): number {
  return quantity(effective(world, thing).size - 1) * amount;
}

/**
 * It fits when there is room beside what is there. A solid must also be smaller than the
 * container to pass its mouth; a liquid takes the shape it is poured into.
 */
function fits(world: MatterWorld, container: Thing, thing: Thing, amount?: number): boolean {
  const room = effective(world, container).size;
  if (!isLiquid(world, thing) && effective(world, thing).size >= room) return false;
  const used = contentsOf(world, container.id).reduce((sum, t) => sum + volumeOf(world, t), 0);
  return used + volumeOf(world, thing, amount) <= quantity(room - 1) + 1e-9;
}

function interior(world: MatterWorld, container: Thing, set: Partial<Place> = {}): Change {
  const outer = world.places[container.place];
  const id = interiorOf(container.id);
  const was = world.places[id];
  const place: Place = {
    ...(was ??
      placeOf(id, {
        temperature: container.state.temperature,
        moisture: outer?.moisture ?? 2,
        wind: 0,
        air: outer?.air ?? 5,
        light: 0,
      })),
    ...set,
  };
  return { kind: "room", place, because: ["R2", "R6"], note: "the inside of it", quiet: true };
}

function release(world: MatterWorld, thing: string): Change[] {
  return Object.values(world.bodies)
    .filter((b) => b.holds?.includes(thing))
    .map((b) => ({
      kind: "body" as const,
      body: b.id,
      set: { holds: (b.holds ?? []).filter((h) => h !== thing) },
      because: ["X1", "R2"],
      note: "it is let go",
      quiet: true as const,
    }));
}

function put(world: MatterWorld, container: Thing, thing: Thing | undefined): Change[] {
  if (!thing || thing.id === container.id) return nothing("there is nothing there to put in");
  if (thing.place === interiorOf(container.id)) return nothing("it is in there already");
  if (within(world, container, thing)) return nothing("it cannot go inside itself");
  const from = containerOf(world, thing);
  if (sealed(world, container.id) || (from && sealed(world, from.id)))
    return nothing("it is closed");
  if (!fits(world, container, thing)) return nothing("it does not fit");
  return [
    interior(world, container),
    ...release(world, thing.id),
    {
      kind: "enclose",
      thing: thing.id,
      place: interiorOf(container.id),
      ...(container.where ? { where: container.where } : {}),
      because: ["X1", "R2"],
      note: "it goes in",
    },
  ];
}

function remove(world: MatterWorld, container: Thing, thing: Thing | undefined): Change[] {
  if (!thing || thing.place !== interiorOf(container.id)) return nothing("it is not in there");
  if (sealed(world, container.id)) return nothing("it is closed");
  return [
    {
      kind: "enclose",
      thing: thing.id,
      place: container.place,
      ...(container.where ? { where: container.where } : {}),
      because: ["X1", "R2"],
      note: "it comes out",
    },
  ];
}

function closeOff(world: MatterWorld, container: Thing, close: boolean): Change[] {
  if (sealed(world, container.id) === close) return nothing(close ? "it is closed" : "it is open");
  const outer = world.places[container.place];
  return [interior(world, container, { air: close ? 0 : (outer?.air ?? 5) })];
}

/** Some of a liquid goes in: the part poured is a thing of its own; nothing is made or lost. */
function pour(world: MatterWorld, container: Thing, liquid: Thing | undefined, amount: number) {
  if (!(liquid && isLiquid(world, liquid))) return nothing("there is nothing there to pour");
  if (!(amount > 0)) return nothing("none of it is poured");
  const from = containerOf(world, liquid);
  if (from && sealed(world, from.id)) return nothing("it is closed");
  if (from?.id === container.id) return nothing("it is in there already");
  if (amount > liquid.state.amount + 1e-9) return nothing("there is not that much");
  if (Math.abs(amount - liquid.state.amount) <= 1e-9) return put(world, container, liquid);
  if (sealed(world, container.id)) return nothing("it is closed");
  if (!fits(world, container, liquid, amount)) return nothing("it does not fit");
  const part: Thing = {
    ...liquid,
    id: `${liquid.id}.poured`,
    place: interiorOf(container.id),
    state: { ...liquid.state, amount },
  };
  if (container.where) part.where = container.where;
  else delete part.where;
  return [
    interior(world, container),
    {
      kind: "consume",
      thing: liquid.id,
      amount,
      because: ["X4", "R2"],
      note: "some is poured off",
    },
    { kind: "create", thing: part, because: ["X4", "R2"], note: "it is poured in" },
  ] satisfies Change[];
}

export function contain(world: MatterWorld, act: ContainAct): Change[] {
  const container = world.things[act.container];
  if (!hollow(world, container)) return nothing("there is nothing there to hold it");
  const thing = act.thing === undefined ? undefined : world.things[act.thing];
  if (act.how === "put") return put(world, container, thing);
  if (act.how === "remove") return remove(world, container, thing);
  if (act.how === "pour") return pour(world, container, thing, act.amount ?? 0);
  return closeOff(world, container, act.how === "seal");
}

/**
 * What time does to what is held: the inside of a container is as warm as the container, and
 * what burns in it heats the container through the same heat rows as any flame held to a
 * thing. Nothing here when no container holds anything, so a world without one is unchanged.
 */
export function enclosure(world: MatterWorld, minutes: number): Change[] {
  const changes: Change[] = [];
  for (const place of Object.values(world.places)) {
    const container = containerOf(world, { place: place.id });
    if (!container) continue;
    const held = contentsOf(world, container.id);
    if (held.length === 0) continue;
    if (Math.abs(place.temperature - container.state.temperature) > 1e-9)
      changes.push(interior(world, container, { temperature: container.state.temperature }));
    for (const thing of held) {
      if (!thing.state.burning) continue;
      const exchanged = heat(world, {
        process: "heat",
        source: thing.id,
        target: container.id,
        minutes,
        contact: 0.5,
      });
      changes.push(...exchanged.filter((c) => c.kind !== "nothing"));
    }
  }
  return changes;
}
