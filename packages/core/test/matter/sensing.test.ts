/**
 * Sensing, invariants first (docs/sandbox-direction.md, "Sensing"). The engine emitted signals
 * and nothing received them, and that is where every chain in batch B broke. These hold
 * before any scenario is encoded: what a body notices comes from something, more of it is
 * never noticed less, and noticing changes nothing but what the body is aware of.
 */
import { describe, expect, it } from "vitest";
import { Rng } from "../../src/index.ts";
import {
  type Act,
  alight,
  type Body,
  type Element,
  FRESH,
  type MatterWorld,
  POOL,
  placeOf,
  play,
  resolve,
  sensed,
  type Thing,
  worldOf,
} from "../../src/matter/index.ts";

const CREATURES: Element[] = [
  {
    id: "wolf",
    name: "a wolf",
    kind: "creature",
    forms: [],
    props: { mass: 3, size: 3, hardness: 1, toughness: 3 },
    body: { strength: 3, speed: 4, sight: 3, hearing: 4, smell: 5 },
  },
  {
    id: "person",
    name: "a person",
    kind: "person",
    forms: [],
    props: { mass: 3, size: 3, hardness: 1, toughness: 2 },
    body: { strength: 2, speed: 2, sight: 3, hearing: 3, smell: 1 },
  },
  {
    id: "carrion",
    name: "a carcass",
    kind: "material",
    forms: [],
    props: { mass: 3, size: 2, hardness: 0, toughness: 2, perishability: 5, scent: 2 },
    moist: 3,
  },
];

const thing = (id: string, element: string, where: [number, number], set = {}): Thing => ({
  id,
  element,
  place: "wood",
  where,
  state: { ...FRESH, ...set },
});

const body = (
  id: string,
  element: string,
  where: [number, number],
  set: Partial<Body> = {},
): Body => ({
  id,
  element,
  place: "wood",
  where,
  needs: {},
  health: 5,
  wounds: [],
  sickness: 0,
  sickensIn: 0,
  ...set,
});

function wood(things: Thing[], bodies: Body[], place = {}): MatterWorld {
  const empty = worldOf(
    [...POOL, ...CREATURES],
    [placeOf("wood", { light: 1, noise: 1, ...place })],
  );
  const made = { ...empty, things: Object.fromEntries(things.map((t) => [t.id, t])) };
  const lit = Object.values(made.things).map((t) => (t.id === "pyre" ? alight(made, t) : t));
  return {
    ...made,
    things: Object.fromEntries(lit.map((t) => [t.id, t])),
    bodies: Object.fromEntries(bodies.map((b) => [b.id, b])),
  };
}

const pyre = (where: [number, number]) => thing("pyre", "branch", where, { amount: 6 });
const aware = (w: MatterWorld, who: string, of: string) => sensed(w).get(who)?.[of]?.strength ?? 0;

describe("what a body notices", () => {
  it("a fire is seen across a wood at night, hardly at noon, and not by a sleeper", () => {
    const night = wood([pyre([0, 0])], [body("wolf", "wolf", [30, 0])]);
    const noon = wood([pyre([0, 0])], [body("wolf", "wolf", [30, 0])], { light: 5 });
    const asleep = wood([pyre([0, 0])], [body("wolf", "wolf", [30, 0], { attention: "asleep" })]);
    expect(aware(night, "wolf", "pyre")).toBeGreaterThan(0);
    expect(aware(noon, "wolf", "pyre")).toBeLessThan(aware(night, "wolf", "pyre"));
    expect(sensed(asleep).get("wolf")?.pyre?.channel).not.toBe("light");
  });

  it("a carcass is smelt further each day, by a wolf long before a person", () => {
    const start = wood(
      [thing("stag", "carrion", [0, 0], { wetness: 3 })],
      [body("wolf", "wolf", [40, 0]), body("walker", "person", [40, 0])],
    );
    const days = (n: number) => resolve(start, { process: "drift", minutes: n * 1440 }).world;
    expect(aware(start, "wolf", "stag")).toBe(0);
    expect(aware(days(3), "wolf", "stag")).toBeGreaterThan(0);
    expect(aware(days(3), "walker", "stag")).toBe(0);
    expect(
      resolve(start, { process: "drift", minutes: 4320 }).world.bodies.wolf?.aware?.stag?.channel,
    ).toBe("scent");
  });

  it("a blow is heard by who is near, and the hearing is recorded on the body by the act itself", () => {
    const w = wood(
      [thing("rock", "stone", [0, 0]), thing("flint", "flint", [0, 0])],
      [body("near", "person", [3, 0]), body("far", "person", [400, 0])],
    );
    const act: Act = {
      process: "force",
      instrument: "rock",
      patient: "flint",
      manner: { effort: 4, care: 2, haste: 2 },
    };
    const after = resolve(w, act);
    expect(after.world.bodies.near?.aware?.flint?.channel).toBe("sound");
    expect(after.world.bodies.far?.aware?.flint).toBeUndefined();
    expect(after.changes.some((c) => c.kind === "percept" && c.body === "near")).toBe(true);
  });
});

describe("the invariants of sensing", () => {
  const SEEDS = Array.from({ length: 40 }, (_, i) => i + 1);
  const at = (rng: Rng): [number, number] => [
    Math.round(rng.next() * 60),
    Math.round(rng.next() * 60),
  ];

  function some(
    rng: Rng,
    set: { light?: number; cover?: number; noise?: number } = {},
  ): MatterWorld {
    const things = [
      pyre(at(rng)),
      thing("stag", "carrion", at(rng), { contamination: rng.next() * 5, wetness: 3 }),
      thing("stone", "stone", at(rng)),
    ];
    return wood(things, [body("wolf", "wolf", at(rng)), body("walker", "person", at(rng))], {
      light: set.light ?? Math.round(rng.next() * 5),
      noise: set.noise ?? Math.round(rng.next() * 5),
      cover: set.cover ?? Math.round(rng.next() * 5),
    });
  }

  it("1. no percept without a source that emits on that channel", () => {
    for (const seed of SEEDS) {
      const w = some(Rng.fromSeed(seed));
      for (const [, percepts] of sensed(w))
        for (const [source, p] of Object.entries(percepts)) {
          expect(source in w.things, `seed ${seed}: ${source}`).toBe(true);
          expect(source, `seed ${seed}: a cold stone emits nothing`).not.toBe("stone");
          expect(p.strength).toBeGreaterThan(0);
        }
    }
  });

  it("2. nearer is never noticed less, and more in the way is never noticed more", () => {
    for (const seed of SEEDS) {
      const rng = Rng.fromSeed(seed);
      const far = wood([pyre([0, 0])], [body("wolf", "wolf", [50, 0])], { light: 2, cover: 2 });
      const near = wood([pyre([0, 0])], [body("wolf", "wolf", [Math.round(rng.next() * 49), 0])], {
        light: 2,
        cover: 2,
      });
      const hidden = wood([pyre([0, 0])], [body("wolf", "wolf", [50, 0])], { light: 2, cover: 5 });
      expect(aware(near, "wolf", "pyre"), `seed ${seed}`).toBeGreaterThanOrEqual(
        aware(far, "wolf", "pyre"),
      );
      expect(aware(hidden, "wolf", "pyre")).toBeLessThanOrEqual(aware(far, "wolf", "pyre"));
    }
  });

  it("3. what an alert body misses a distracted one misses, and a sleeper misses what that one does", () => {
    for (const seed of SEEDS) {
      const base = some(Rng.fromSeed(seed));
      const as = (attention: NonNullable<Body["attention"]>) => {
        const wolf = base.bodies.wolf;
        return wolf ? { ...base, bodies: { ...base.bodies, wolf: { ...wolf, attention } } } : base;
      };
      for (const source of ["pyre", "stag"]) {
        const [alert, distracted, asleep] = [as("alert"), as("distracted"), as("asleep")].map((w) =>
          aware(w, "wolf", source),
        );
        expect(alert, `seed ${seed} ${source}`).toBeGreaterThanOrEqual(distracted ?? 0);
        expect(distracted, `seed ${seed} ${source}`).toBeGreaterThanOrEqual(asleep ?? 0);
      }
    }
  });

  it("4. a brighter or louder surrounding never makes a weak signal easier to notice", () => {
    for (const seed of SEEDS) {
      const dim = some(Rng.fromSeed(seed), { light: 1, noise: 1 });
      const bright = some(Rng.fromSeed(seed), { light: 5, noise: 5 });
      expect(aware(bright, "wolf", "pyre"), `seed ${seed}`).toBeLessThanOrEqual(
        aware(dim, "wolf", "pyre"),
      );
    }
  });

  it("5. sensing changes nothing but what bodies are aware of", () => {
    for (const seed of SEEDS.slice(0, 15)) {
      const w = some(Rng.fromSeed(seed));
      const after = resolve(w, { process: "drift", minutes: 0 }).world;
      expect(after.things).toEqual(w.things);
      expect(after.places).toEqual(w.places);
      for (const [id, b] of Object.entries(after.bodies)) {
        const { aware: _now, ...rest } = b;
        const { aware: _was, ...before } = w.bodies[id] ?? b;
        expect(rest).toEqual(before);
      }
    }
  });

  it("6. the same world sensed twice is the same, and a wait cut in parts ends noticing the same", () => {
    for (const seed of SEEDS.slice(0, 15)) {
      const w = some(Rng.fromSeed(seed));
      expect([...sensed(w)]).toEqual([...sensed(w)]);
      const whole = resolve(w, { process: "drift", minutes: 120 }).world;
      const parts = play(
        w,
        Array.from({ length: 12 }, (): Act => ({ process: "drift", minutes: 10 })),
      ).world;
      for (const id of Object.keys(whole.bodies))
        expect(Object.keys(parts.bodies[id]?.aware ?? {}).sort(), `seed ${seed} ${id}`).toEqual(
          Object.keys(whole.bodies[id]?.aware ?? {}).sort(),
        );
    }
  });
});
