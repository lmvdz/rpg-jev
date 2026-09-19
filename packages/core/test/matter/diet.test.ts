/**
 * Diet, properties first. What feeds whom was not a structure: a grazer would have been offered
 * meat, and prey was not food (spikes/minds/INTENTS.md). A food's row says what fare it is, an
 * eater's row says how well each fare feeds it, and one function says what this eater gets
 * from that food. No rule names an eater or a food.
 */
import { describe, expect, it } from "vitest";
import {
  type Body,
  type Bond,
  type Element,
  FRESH,
  feeds,
  type MatterWorld,
  offers,
  POOL,
  placeOf,
  resolve,
  sliceFor,
  type Thing,
  worldOf,
} from "../../src/matter/index.ts";

const senses = { sight: 3, hearing: 4, smell: 4 };
const ROWS: Element[] = [
  {
    id: "wolf",
    name: "a wolf",
    kind: "creature",
    forms: [],
    props: { mass: 3, size: 3, hardness: 1, toughness: 3 },
    body: { strength: 3, speed: 4, ...senses, eats: { flesh: 5, fruit: 1 } },
  },
  {
    id: "hind",
    name: "a hind",
    kind: "creature",
    forms: [],
    props: { mass: 4, size: 4, hardness: 1, toughness: 2 },
    body: { strength: 2, speed: 5, ...senses, eats: { leaf: 5, fruit: 3 } },
    fare: "flesh",
    serves: { hunger: 3 },
  },
  {
    id: "hare",
    name: "a hare",
    kind: "creature",
    forms: [],
    props: { mass: 1, size: 1, hardness: 0, toughness: 1 },
    body: { strength: 1, speed: 5, ...senses, eats: { leaf: 5 } },
    fare: "flesh",
    serves: { hunger: 2 },
  },
  {
    id: "bear",
    name: "a bear",
    kind: "creature",
    forms: [],
    props: { mass: 5, size: 4, hardness: 1, toughness: 4 },
    body: { strength: 5, speed: 3, ...senses, eats: { flesh: 4, fruit: 5 } },
    fare: "flesh",
    serves: { hunger: 4 },
  },
  {
    id: "anything",
    name: "a beast",
    kind: "creature",
    forms: [],
    props: { mass: 3, size: 3 },
    body: { strength: 3, speed: 3, ...senses },
  },
  {
    id: "meat",
    name: "meat",
    kind: "material",
    forms: [],
    props: { mass: 1, size: 1, toughness: 2, scent: 3 },
    moist: 3,
    serves: { hunger: 3 },
    fare: "flesh",
  },
  {
    id: "haws",
    name: "haws",
    kind: "plant",
    forms: [],
    props: { mass: 0, size: 0, toughness: 1, scent: 1 },
    serves: { hunger: 2 },
    fare: "fruit",
  },
  {
    id: "broth",
    name: "broth",
    kind: "material",
    forms: ["liquid"],
    props: { mass: 1, size: 1 },
    serves: { hunger: 2 },
  },
];

const at = (id: string, element: string, where: [number, number]): Thing => ({
  id,
  element,
  place: "wood",
  where,
  state: { ...FRESH, amount: 5 },
});
const body = (
  id: string,
  element: string,
  where: [number, number],
  hunger: number,
  set: Partial<Body> = {},
): Body => ({
  id,
  element,
  place: "wood",
  where,
  needs: { hunger, rest: 0 },
  health: 5,
  wounds: [],
  sickness: 0,
  sickensIn: 0,
  ...set,
});

function wood(things: Thing[], bodies: Body[], bonds: Bond[] = []): MatterWorld {
  const empty = worldOf([...POOL, ...ROWS], [placeOf("wood", { light: 4, noise: 1 })]);
  const made = {
    ...empty,
    things: Object.fromEntries(things.map((t) => [t.id, t])),
    bodies: Object.fromEntries(bodies.map((b) => [b.id, b])),
    bonds,
  };
  return resolve(made, { process: "drift", minutes: 0 }).world;
}
const ids = (w: MatterWorld, who: string) => offers(w, w.bodies[who] as Body).map((o) => o.id);
const hungerAfter = (element: string, food: string) => {
  const w = wood([at("food", food, [0, 0])], [body("it", element, [0, 0], 4)]);
  return (
    resolve(w, { process: "ingest", body: "it", thing: "food", amount: 1 }).world.bodies.it?.needs
      .hunger ?? 9
  );
};

describe("what feeds whom", () => {
  it("what feeds one does not feed another", () => {
    expect(hungerAfter("wolf", "meat")).toBeLessThan(4);
    expect(hungerAfter("hind", "meat")).toBe(4);
    expect(hungerAfter("hind", "haws")).toBeLessThan(4);
  });

  it("it feeds by how well the eater takes that fare, and never by more than the food gives", () => {
    expect(hungerAfter("bear", "haws")).toBeLessThan(hungerAfter("wolf", "haws"));
    expect(hungerAfter("wolf", "haws")).toBeLessThan(4);
    const w = wood([], [body("it", "bear", [0, 0], 4)]);
    for (const food of ["meat", "haws", "broth"])
      for (const eater of Object.values(w.elements).filter((e) => e.body)) {
        const gets = feeds(w, body("it", eater.id, [0, 0], 4), food).hunger ?? 0;
        expect(gets, `${eater.id} on ${food}`).toBeGreaterThanOrEqual(0);
        expect(gets, `${eater.id} on ${food}`).toBeLessThanOrEqual(
          w.elements[food]?.serves?.hunger ?? 0,
        );
      }
  });

  it("a food of no fare feeds anyone, and an eater whose row says nothing eats anything", () => {
    expect(hungerAfter("hind", "broth")).toBeLessThan(4);
    expect(hungerAfter("anything", "meat")).toBeLessThan(4);
  });
});

describe("what it is offered follows what feeds it", () => {
  const larder = [at("meat", "meat", [6, 0]), at("haws", "haws", [0, 6])];

  it("hungry, each is offered going to what feeds it and not to what does not", () => {
    const w = wood(
      larder,
      [body("hind", "hind", [0, 0], 4), body("wolf", "wolf", [0, 1], 4)],
      [
        { from: "hind", to: "wolf", kind: "pack", weight: 1 },
        { from: "wolf", to: "hind", kind: "pack", weight: 1 },
      ],
    );
    expect(ids(w, "hind")).toContain("go_to:haws");
    expect(ids(w, "hind")).not.toContain("go_to:meat");
    expect(ids(w, "wolf")[0]).toBe("go_to:meat");
  });

  it("with only what does not feed it in sight, it is still offered going to look", () => {
    const w = wood([at("meat", "meat", [6, 0])], [body("hind", "hind", [0, 0], 4)]);
    expect(ids(w, "hind")).toContain("go_to:");
    expect(ids(w, "hind").some((id) => id.endsWith(":meat"))).toBe(false);
  });

  it("the slice says what would feed it, to the one it would feed", () => {
    const w = wood(larder, [body("hind", "hind", [0, 0], 4), body("wolf", "wolf", [40, 40], 4)]);
    const said = (who: string, what: string) =>
      JSON.stringify(sliceFor(w, w.bodies[who] as Body).present.find((p) => p.what === what));
    expect(said("hind", "haws")).toMatch(/would feed it/);
    expect(said("hind", "meat")).not.toMatch(/would feed it/);
  });
});

describe("prey is food that is still alive", () => {
  const scene = (hunter: string, hunger: number, quarry: string, bonds: Bond[] = []) =>
    wood([], [body("it", hunter, [0, 0], hunger), body("other", quarry, [3, 0], 1)], bonds);

  it("hungry, beside what would feed it and is no stronger, it is offered force; fed, it is not", () => {
    expect(ids(scene("wolf", 4, "hare"), "it")).toContain("attack:other");
    expect(ids(scene("wolf", 0, "hare"), "it")).not.toContain("attack:other");
  });

  it("what does not eat flesh is never offered it, however hungry", () => {
    expect(ids(scene("hind", 5, "hare"), "it")).not.toContain("attack:other");
  });

  it("it is not offered what is much stronger than it, nor one it holds dear", () => {
    expect(ids(scene("wolf", 5, "bear"), "it")).not.toContain("attack:other");
    const dear: Bond[] = [{ from: "it", to: "other", kind: "young", weight: 5 }];
    expect(ids(scene("bear", 5, "hare", dear), "it")).not.toContain("attack:other");
  });

  it("far off, it is offered going toward it, and the quarry counts it a menace", () => {
    const w = wood([], [body("it", "wolf", [0, 0], 4), body("other", "hare", [20, 0], 1)]);
    expect(ids(w, "it")).toContain("go_to:other");
    expect(ids(w, "other")).toContain("keep_away:it");
  });

  it("its own kind is not food to it, and it is no menace to its own kind for being a flesh eater", () => {
    const w = scene("bear", 5, "bear");
    expect(ids(w, "it")).not.toContain("attack:other");
    expect(JSON.stringify(sliceFor(w, w.bodies.it as Body))).not.toMatch(
      /would feed it|make a meal/,
    );
  });

  it("what is much weaker than it does not hunt it", () => {
    const w = scene("bear", 1, "wolf");
    const said = JSON.stringify(sliceFor(w, w.bodies.it as Body));
    expect(said).not.toMatch(/make a meal/);
    // The other way about, it does.
    const hare = scene("hare", 1, "wolf");
    expect(JSON.stringify(sliceFor(hare, hare.bodies.it as Body))).toMatch(/make a meal/);
  });

  it("within a rush it is offered force, not going toward; and a little hungry is hungry enough", () => {
    expect(ids(scene("wolf", 4, "hare"), "it")).not.toContain("go_to:other");
    expect(ids(scene("wolf", 1, "hare"), "it")).toContain("attack:other");
  });

  it("more hunger never ranks the hunt lower", () => {
    const rank = (hunger: number) => {
      const i = ids(scene("wolf", hunger, "hare"), "it").indexOf("attack:other");
      return i < 0 ? 99 : i;
    };
    expect(rank(5)).toBeLessThanOrEqual(rank(3));
    expect(rank(3)).toBeLessThanOrEqual(rank(2));
  });
});
