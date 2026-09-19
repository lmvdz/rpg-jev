/**
 * Bodies, properties first. Three batch C runners said the same thing independently: a body
 * had no row, no warmth or wetness, armour worn did nothing, a failed load did nothing to what
 * it held, and nothing a body suffered changed what it could do. These hold before any
 * scenario is encoded. Then the first creature: what it can choose among is built by code
 * from what it needs and what it notices, and when nobody watches it follows its needs.
 */
import { describe, expect, it } from "vitest";
import {
  type Act,
  able,
  alight,
  type Body,
  type Element,
  FRESH,
  type MatterWorld,
  optionsFor,
  POOL,
  placeOf,
  resolve,
  routine,
  type Thing,
  worldOf,
} from "../../src/matter/index.ts";

const ROWS: Element[] = [
  {
    id: "person",
    name: "a person",
    kind: "person",
    forms: [],
    props: { mass: 3, size: 3, hardness: 1, toughness: 2 },
    body: { strength: 2, speed: 2, sight: 3, hearing: 3, smell: 1 },
  },
  {
    id: "wolf",
    name: "a wolf",
    kind: "creature",
    forms: [],
    props: { mass: 3, size: 3, hardness: 1, toughness: 3 },
    body: { strength: 3, speed: 4, sight: 3, hearing: 4, smell: 5 },
  },
  {
    id: "bear",
    name: "a bear",
    kind: "creature",
    forms: [],
    props: { mass: 4, size: 4, hardness: 2, toughness: 4 },
    body: { strength: 5, speed: 3, sight: 2, hearing: 3, smell: 5 },
  },
  {
    id: "wool",
    name: "a wool coat",
    kind: "thing",
    forms: ["sheet"],
    props: {
      mass: 1,
      size: 2,
      hardness: 0,
      toughness: 3,
      flexibility: 5,
      absorbency: 4,
      conductivity: 0,
    },
  },
  {
    id: "cuirass",
    name: "a cuirass",
    kind: "thing",
    forms: ["hollow"],
    props: { mass: 3, size: 2, hardness: 5, toughness: 4, conductivity: 5 },
  },
  {
    id: "plank",
    name: "a plank",
    kind: "thing",
    forms: ["long", "flat", "grained"],
    props: { mass: 2, size: 3, hardness: 2, toughness: 2 },
  },
  {
    id: "meat",
    name: "meat",
    kind: "material",
    forms: [],
    props: { mass: 1, size: 1, hardness: 0, toughness: 2, perishability: 5, scent: 3 },
    moist: 3,
    serves: { hunger: 3 },
  },
];

const at = (
  id: string,
  element: string,
  where: [number, number] = [0, 0],
  set: Partial<Thing["state"]> = {},
): Thing => ({
  id,
  element,
  place: "here",
  where,
  state: { ...FRESH, ...set },
});

const body = (id: string, element: string, set: Partial<Body> = {}): Body => ({
  id,
  element,
  place: "here",
  where: [0, 0],
  needs: { hunger: 1, rest: 1, warmth: 0 },
  health: 5,
  wounds: [],
  sickness: 0,
  sickensIn: 0,
  ...set,
});

function world(things: Thing[], bodies: Body[], place = {}): MatterWorld {
  const empty = worldOf([...POOL, ...ROWS], [placeOf("here", place)]);
  const made = { ...empty, things: Object.fromEntries(things.map((t) => [t.id, t])) };
  const lit = Object.values(made.things).map((t) => (t.id === "hearth" ? alight(made, t) : t));
  return {
    ...made,
    things: Object.fromEntries(lit.map((t) => [t.id, t])),
    bodies: Object.fromEntries(bodies.map((b) => [b.id, b])),
  };
}

const hours = (n: number): Act => ({ process: "drift", minutes: n * 60 });
const cold = (w: MatterWorld, id: string) => w.bodies[id]?.needs.warmth ?? 0;

describe("cold, wet and tired", () => {
  const frost = { temperature: 0, wind: 1 };

  it("a body out in the frost grows cold, and not in a mild place", () => {
    expect(
      cold(resolve(world([], [body("out", "person")], frost), hours(3)).world, "out"),
    ).toBeGreaterThan(1);
    expect(cold(resolve(world([], [body("in", "person")]), hours(3)).world, "in")).toBe(0);
  });

  it("wet is colder than dry, wind is colder than still, and a coat is warmer than none", () => {
    const after = (set: Partial<Body>, place = frost, things: Thing[] = []) =>
      cold(resolve(world(things, [body("b", "person", set)], place), hours(2)).world, "b");
    const bare = after({});
    expect(after({ wetness: 4 })).toBeGreaterThan(bare);
    expect(after({}, { temperature: 0, wind: 4 })).toBeGreaterThan(bare);
    expect(after({ wears: ["coat"] }, frost, [at("coat", "wool")])).toBeLessThan(bare);
    // A soaked coat is worth less than a dry one.
    const soaked = after({ wears: ["coat"] }, frost, [at("coat", "wool", [0, 0], { wetness: 5 })]);
    expect(soaked).toBeGreaterThan(after({ wears: ["coat"] }, frost, [at("coat", "wool")]));
  });

  it("a fire close by keeps the cold off, and a night of it unsheltered tells on the body", () => {
    const by = world(
      [at("hearth", "branch", [1, 0], { amount: 10 })],
      [body("b", "person")],
      frost,
    );
    const away = world(
      [at("hearth", "branch", [60, 0], { amount: 10 })],
      [body("b", "person")],
      frost,
    );
    expect(cold(resolve(by, hours(4)).world, "b")).toBeLessThan(
      cold(resolve(away, hours(4)).world, "b"),
    );
    const night = resolve(
      world([], [body("b", "person", { wetness: 4 })], { temperature: 0, wind: 3 }),
      hours(10),
    ).world;
    expect(night.bodies.b?.health).toBeLessThan(5);
  });

  it("hunger and tiredness come with the hours, and sleep takes tiredness off", () => {
    const day = resolve(world([], [body("b", "person")]), hours(12)).world.bodies.b;
    expect(day?.needs.hunger).toBeGreaterThan(1);
    expect(day?.needs.rest).toBeGreaterThan(1);
    const slept = resolve(
      world([], [body("b", "person", { needs: { rest: 4 }, attention: "asleep" })]),
      hours(6),
    ).world.bodies.b;
    expect(slept?.needs.rest).toBeLessThan(4);
  });
});

describe("what is worn, and what a body can still do", () => {
  const swing: Act = {
    process: "force",
    instrument: "axe",
    patient: "b",
    manner: { effort: 4, care: 2, haste: 2 },
  };
  const axe = at("axe", "blade", [0, 0], { edge: 4 });

  it("armour worn turns a blow that the same body bare would take, and is the worse for it", () => {
    const bare = resolve(world([axe], [body("b", "person")]), swing).world;
    const clad = resolve(
      world([axe, at("plate", "cuirass")], [body("b", "person", { wears: ["plate"] })]),
      swing,
    );
    const depth = (w: MatterWorld) =>
      w.bodies.b?.wounds.reduce((n, x) => Math.max(n, x.depth), 0) ?? 0;
    expect(depth(bare)).toBeGreaterThan(2);
    expect(depth(clad.world)).toBeLessThan(depth(bare) / 2);
    expect(clad.world.bodies.b?.wounds.every((x) => x.bleeding < 1)).toBe(true);
    expect(clad.changes.some((c) => c.kind === "signal" && c.channel === "sound")).toBe(true);
  });

  it("the same blow does less to a bear than to a person: a body is what its row says", () => {
    const hit = (element: string) =>
      resolve(world([axe], [body("b", element)]), swing).world.bodies.b?.wounds[0]?.depth ?? 0;
    expect(hit("bear")).toBeLessThan(hit("person"));
  });

  it("what a load held falls when it gives way, and a body that falls is hurt", () => {
    const w = world([at("board", "plank", [0, 0], { flaw: 4 })], [body("b", "person")]);
    const after = resolve(w, { process: "load", support: "board", bearing: ["b"] }).world;
    expect(after.things.board?.state.integrity).toBeLessThanOrEqual(1);
    expect(after.bodies.b?.wounds.length).toBeGreaterThan(0);
  });

  it("hurt, cold, tired and sick lower what a body can do, and never raise it", () => {
    const w = world(
      [],
      [
        body("well", "person"),
        body("hurt", "person", { health: 2, wounds: [{ depth: 3, bleeding: 2, burned: 0 }] }),
        body("cold", "person", { needs: { warmth: 4 } }),
        body("spent", "person", { needs: { rest: 5 } }),
      ],
    );
    const well = able(w, w.bodies.well as Body);
    for (const id of ["hurt", "cold", "spent"]) {
      const now = able(w, w.bodies[id] as Body);
      expect(now.strength, id).toBeLessThan(well.strength);
      expect(now.speed, id).toBeLessThanOrEqual(well.speed);
    }
    expect(well.strength).toBe(2);
  });
});

describe("the first creature", () => {
  const scene = (hunger: number, fireAt: [number, number] | null) =>
    world(
      [
        at("kill", "meat", [6, 0], { amount: 5 }),
        ...(fireAt ? [at("hearth", "branch", fireAt, { amount: 10 })] : []),
      ],
      [body("wolf", "wolf", { where: [0, 0], needs: { hunger, rest: 1, warmth: 0 } })],
      { light: 1 },
    );

  it("is offered only what code can build from what it notices and needs, and always nothing", () => {
    const w = resolve(scene(4, [20, 0]), { process: "drift", minutes: 0 }).world;
    const options = optionsFor(w, w.bodies.wolf as Body);
    const ids = options.map((o) => o.id);
    expect(ids).toContain("none");
    expect(ids).toContain("approach:kill");
    expect(ids).toContain("flee:hearth");
    expect(
      ids.every((id) => id === "none" || id === "rest" || /^(approach|flee|eat):/.test(id)),
    ).toBe(true);
    // It cannot be offered what it has not noticed.
    const blind = optionsFor(scene(4, null), scene(4, null).bodies.wolf as Body).map((o) => o.id);
    expect(blind).not.toContain("approach:kill");
  });

  it("follows its needs when nobody is watching: hungry it goes to the meat, fed it does not", () => {
    const hungry = resolve(scene(4, null), { process: "drift", minutes: 0 }).world;
    const fed = resolve(scene(0, null), { process: "drift", minutes: 0 }).world;
    expect(routine(hungry, hungry.bodies.wolf as Body).id).toBe("approach:kill");
    expect(routine(fed, fed.bodies.wolf as Body).id).not.toBe("approach:kill");
  });

  it("moves when it acts on a choice, by its speed, and eats when it gets there", () => {
    let w = resolve(scene(4, null), { process: "drift", minutes: 0 }).world;
    for (let i = 0; i < 6; i++) {
      const choice = routine(w, w.bodies.wolf as Body);
      if (!choice.act) break;
      w = resolve(w, choice.act).world;
    }
    expect(w.bodies.wolf?.needs.hunger).toBeLessThan(4);
    expect(w.things.kill?.state.amount ?? 0).toBeLessThan(5);
  });
});
