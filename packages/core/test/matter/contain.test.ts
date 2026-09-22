import { describe, expect, it } from "vitest";
import { apply } from "../../src/matter/apply.ts";
import { containerOf, contentsOf, interiorOf, sealed } from "../../src/matter/contain.ts";
import { alight, placeOf, worldOf } from "../../src/matter/pool.ts";
import { resolve } from "../../src/matter/resolve.ts";
import { type Element, FRESH, type MatterWorld, type Thing } from "../../src/matter/types.ts";

const ELEMENTS: Element[] = [
  {
    id: "pot",
    name: "a clay pot",
    kind: "thing",
    forms: ["hollow", "round"],
    props: { mass: 2, size: 3, hardness: 3, toughness: 1, conductivity: 1 },
  },
  {
    id: "box",
    name: "a wooden box",
    kind: "thing",
    forms: ["hollow", "flat"],
    props: { mass: 2, size: 3, hardness: 2, toughness: 3, flammability: 3 },
    burnsTo: "ash",
  },
  {
    id: "tinder",
    name: "tinder",
    kind: "material",
    forms: ["cord"],
    props: { mass: 0, size: 1, flammability: 5 },
    burnsTo: "ash",
  },
  { id: "rock", name: "a rock", kind: "material", forms: ["round"], props: { mass: 4, size: 4 } },
  { id: "water", name: "water", kind: "material", forms: ["liquid"], props: { mass: 1, size: 1 } },
  { id: "ash", name: "ash", kind: "material", forms: ["granular"], props: { size: 0 } },
];

const thing = (id: string, element: string, state: Partial<Thing["state"]> = {}): Thing => ({
  id,
  element,
  place: "yard",
  where: [3, 4],
  state: { ...FRESH, ...state },
});

function yard(...things: Thing[]): MatterWorld {
  const world = worldOf(ELEMENTS, [placeOf("yard")]);
  for (const t of things) world.things[t.id] = t;
  return world;
}

const put = (container: string, what: string) =>
  ({ process: "contain", how: "put", container, thing: what }) as const;

describe("containment as a matter process", () => {
  it("puts a thing in, where it is in the container's inside, and takes it out again", () => {
    const world = yard(thing("pot", "pot"), thing("tinder", "tinder"));
    const inside = resolve(world, put("pot", "tinder")).world;
    const tinder = inside.things.tinder as Thing;
    expect(tinder.place).toBe(interiorOf("pot"));
    expect(containerOf(inside, tinder)?.id).toBe("pot");
    expect(contentsOf(inside, "pot").map((t) => t.id)).toEqual(["tinder"]);
    const out = resolve(inside, {
      process: "contain",
      how: "remove",
      container: "pot",
      thing: "tinder",
    });
    expect(out.world.things.tinder?.place).toBe("yard");
  });

  it("refuses what is not hollow, what does not fit, and a box into what it holds", () => {
    const world = yard(thing("pot", "pot"), thing("rock", "rock"), thing("box", "box"));
    const nothing = (w: MatterWorld, act: Parameters<typeof resolve>[1]) =>
      resolve(w, act).changes.some((c) => c.kind === "nothing");
    expect(nothing(world, put("rock", "pot"))).toBe(true);
    expect(nothing(world, put("pot", "rock"))).toBe(true);
    const small = yard(thing("pot", "pot"), thing("cup", "pot", { amount: 1 }));
    small.elements.cup = { ...(ELEMENTS[0] as Element), id: "cup", props: { size: 2 } };
    (small.things.cup as Thing).element = "cup";
    const inPot = resolve(small, put("pot", "cup")).world;
    expect(nothing(inPot, put("cup", "pot"))).toBe(true);
  });

  it("a sealed container admits nothing and gives nothing up", () => {
    const world = yard(thing("pot", "pot"), thing("tinder", "tinder"), thing("t2", "tinder"));
    const inside = resolve(world, put("pot", "tinder")).world;
    const closed = resolve(inside, { process: "contain", how: "seal", container: "pot" }).world;
    expect(sealed(closed, "pot")).toBe(true);
    expect(closed.places[interiorOf("pot")]?.air).toBe(0);
    const out = resolve(closed, {
      process: "contain",
      how: "remove",
      container: "pot",
      thing: "tinder",
    });
    expect(out.changes.some((c) => c.kind === "nothing")).toBe(true);
    expect(resolve(closed, put("pot", "t2")).changes.some((c) => c.kind === "nothing")).toBe(true);
    const open = resolve(closed, { process: "contain", how: "unseal", container: "pot" }).world;
    expect(sealed(open, "pot")).toBe(false);
  });

  it("a flame in a sealed pot goes out by the drift row for a place without air", () => {
    let world = yard(thing("pot", "pot"), thing("tinder", "tinder", { amount: 3 }));
    world.things.tinder = alight(world, world.things.tinder as Thing);
    world = resolve(world, put("pot", "tinder")).world;
    const burning = resolve(world, { process: "drift", minutes: 1 }).world;
    expect(burning.things.tinder?.state.burning).not.toBeNull();
    world = resolve(world, { process: "contain", how: "seal", container: "pot" }).world;
    const smothered = resolve(world, { process: "drift", minutes: 1 }).world;
    expect(smothered.things.tinder?.state.burning).toBeNull();
  });

  it("what burns in an open container heats the container", () => {
    let world = yard(thing("pot", "pot"), thing("tinder", "tinder", { amount: 3 }));
    world.things.tinder = alight(world, world.things.tinder as Thing);
    world = resolve(world, put("pot", "tinder")).world;
    const after = resolve(world, { process: "drift", minutes: 5 }).world;
    expect(after.things.pot?.state.temperature).toBeGreaterThan(FRESH.temperature + 0.05);
  });

  it("pouring part of a liquid conserves the amount", () => {
    const world = yard(thing("pot", "pot"), thing("water", "water", { amount: 3 }));
    const poured = resolve(world, {
      process: "contain",
      how: "pour",
      container: "pot",
      thing: "water",
      amount: 1,
    }).world;
    const total = Object.values(poured.things)
      .filter((t) => t.element === "water")
      .reduce((sum, t) => sum + t.state.amount, 0);
    expect(total).toBeCloseTo(3);
    expect(contentsOf(poured, "pot").map((t) => t.state.amount)).toEqual([1]);
  });

  it("a world with no container drifts exactly as before", () => {
    const world = yard(thing("rock", "rock", { temperature: 4 }), thing("w", "water"));
    const changes = resolve(world, { process: "drift", minutes: 30 }).changes;
    expect(changes.some((c) => c.kind === "room")).toBe(false);
    expect(apply(world, changes).things.rock?.state.temperature).toBeLessThan(4);
  });
});
