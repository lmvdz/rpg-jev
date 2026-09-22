/**
 * What no scenario states and every scenario assumes. Batch B ran through a frozen engine
 * and the rule errors it found were not twenty more cases; they were these invariants,
 * unasserted (`spikes/vocabulary/FINDINGS.md`). They are checked here over every process in
 * worlds made from a seed, so a failure names the seed and the act that broke it.
 *
 * 1. Nothing is made from nothing: amounts, heat and doses never come from nowhere.
 * 2. An outcome does not depend on how time is cut.
 * 3. A collision falls on both things by the same rule, whoever is called the striker.
 * 4. Whatever the input, every level stays a level.
 */
import { describe, expect, it } from "vitest";
import { Rng } from "../../src/index.ts";
import {
  type Act,
  type MatterWorld,
  play,
  quantity,
  resolve,
  searchYield,
  type Thing,
} from "../../src/matter/index.ts";
import { body, ELEMENTS, PLACES, thing, world } from "./elements.ts";

const SEEDS = Array.from({ length: 60 }, (_, i) => i + 1);
const pick = <T>(rng: Rng, list: readonly T[]): T =>
  list[Math.floor(rng.next() * list.length)] as T;
const level = (rng: Rng) => Math.round(rng.next() * 50) / 10;

function someThing(rng: Rng, id: string): Thing {
  const element = pick(rng, ELEMENTS).id;
  const burning = rng.next() < 0.15 ? { of: "self" as const, fuel: 5 + rng.next() * 200 } : null;
  const coated = rng.next() < 0.25;
  return thing(id, element, pick(rng, PLACES).id, {
    temperature: level(rng),
    wetness: level(rng),
    amount: 0.1 + rng.next() * 5,
    edge: rng.next() < 0.4 ? level(rng) : 0,
    integrity: 1 + rng.next() * 4,
    contamination: rng.next() < 0.3 ? level(rng) : 0,
    taint: rng.next() < 0.2 ? level(rng) : 0,
    burning,
    coating: coated
      ? {
          element: pick(rng, ["oil", "mud", "blood", "salt"]),
          amount: rng.next(),
          coverage: rng.next(),
          bond: level(rng),
        }
      : null,
  });
}

function someWorld(rng: Rng): MatterWorld {
  const things = ["a", "b", "c", "d"].map((id) => someThing(rng, id));
  const wounds = rng.next() < 0.5 ? [{ depth: level(rng), bleeding: level(rng), burned: 0 }] : [];
  return world(things, [body("body", { wounds, place: pick(rng, PLACES).id })]);
}

function someAct(rng: Rng): Act {
  const [x, y] = [pick(rng, ["a", "b", "c", "d"]), pick(rng, ["a", "b", "c", "d"])];
  const manner = { effort: level(rng), care: level(rng), haste: level(rng) };
  const acts: Act[] = [
    { process: "heat", source: x, target: y, minutes: rng.next() * 90, contact: rng.next() },
    { process: "soak", liquid: x, target: y, amount: rng.next() * 3 },
    { process: "coat", substance: x, target: y, amount: rng.next(), manner },
    {
      process: "force",
      instrument: x,
      patient: rng.next() < 0.3 ? "body" : y,
      manner,
      seconds: rng.next() * 6,
    },
    { process: "ingest", body: "body", thing: x, amount: rng.next() * 2 },
    {
      process: "search",
      place: pick(rng, PLACES).id,
      element: pick(rng, ["stone", "flint", "gold"]),
      minutes: rng.next() * 120,
      draw: rng.next(),
    },
    { process: "drift", minutes: rng.next() * 600 },
    { process: "load", support: x, bearing: [y] },
  ];
  return pick(rng, acts);
}

/** Every amount of every element in the world: in things, and in the coats on things. */
function amounts(w: MatterWorld): Map<string, number> {
  const total = new Map<string, number>();
  const add = (element: string, n: number) => total.set(element, (total.get(element) ?? 0) + n);
  for (const t of Object.values(w.things)) {
    add(t.element, t.state.amount);
    if (t.state.coating) add(t.state.coating.element, t.state.coating.amount);
  }
  return total;
}

const numbers = (w: MatterWorld): number[] => [
  ...Object.values(w.things).flatMap((t) => [
    t.state.temperature,
    t.state.wetness,
    t.state.integrity,
    t.state.edge,
    t.state.contamination,
    t.state.corrosion,
    t.state.taint,
    t.state.flaw,
    t.state.coating?.bond ?? 0,
  ]),
  ...Object.values(w.bodies).flatMap((b) => [
    b.health,
    b.sickness,
    ...b.wounds.flatMap((x) => [x.depth, x.bleeding, x.burned]),
  ]),
];

function expectLevels(w: MatterWorld, why: string): void {
  for (const n of numbers(w)) {
    expect(Number.isFinite(n), why).toBe(true);
    expect(n, why).toBeGreaterThanOrEqual(0);
    expect(n, why).toBeLessThanOrEqual(5);
  }
  for (const t of Object.values(w.things)) {
    expect(t.state.amount, why).toBeGreaterThan(0);
    expect(t.state.coating?.coverage ?? 0, why).toBeLessThanOrEqual(1);
    expect(t.state.burning?.fuel ?? 1, why).toBeGreaterThan(0);
  }
}

describe("1. nothing is made from nothing", () => {
  it("no act but a find or a burning adds to the amount of any element", () => {
    for (const seed of SEEDS) {
      const rng = Rng.fromSeed(seed);
      let w = someWorld(rng);
      for (let i = 0; i < 12; i++) {
        const act = someAct(rng);
        const before = amounts(w);
        w = resolve(w, act).world;
        const after = amounts(w);
        for (const [element, n] of after) {
          const was = before.get(element) ?? 0;
          const found = act.process === "search" && act.element === element;
          const ash = act.process === "drift" && ELEMENTS.some((e) => e.burnsTo === element);
          if (!(found || ash))
            expect(n, `seed ${seed} ${act.process}: ${element}`).toBeLessThanOrEqual(was + 1e-9);
        }
      }
    }
  });

  it("breaking a thing up never leaves more of it than there was", () => {
    const w = world([thing("rock", "stone"), thing("loaf", "bread"), thing("nodule", "flint")]);
    for (const patient of ["loaf", "nodule"]) {
      const blows = Array.from(
        { length: 40 },
        (): Act => ({
          process: "force",
          instrument: "rock",
          patient,
          manner: { effort: 4, care: 3, haste: 2 },
        }),
      );
      const after = play(w, blows).world;
      const element = w.things[patient]?.element ?? "";
      expect(amounts(after).get(element) ?? 0).toBeLessThanOrEqual(
        (amounts(w).get(element) ?? 0) + 1e-9,
      );
    }
  });

  it("what is not burning cannot give more heat than it holds", () => {
    const heatHeld = (w: MatterWorld, ids: string[]) =>
      ids.reduce((sum, id) => {
        const t = w.things[id];
        const mass = ELEMENTS.find((e) => e.id === t?.element)?.props.mass ?? 0;
        return t ? sum + t.state.temperature * quantity(mass) * t.state.amount : sum;
      }, 0);
    const w = world([
      thing("hot", "stone", "hearth", { temperature: 5 }),
      thing("pot", "water", "hearth", { amount: 20 }),
    ]);
    const act: Act = { process: "heat", source: "hot", target: "pot", minutes: 30 };
    const after = resolve(w, act).world;
    expect(heatHeld(after, ["hot", "pot"])).toBeLessThanOrEqual(heatHeld(w, ["hot", "pot"]) + 1e-6);
    expect(after.things.hot?.state.temperature).toBeLessThan(5);
    expect(after.things.pot?.state.temperature).toBeLessThan(3);
    const cup = world([
      thing("hot", "stone", "hearth", { temperature: 5 }),
      thing("pot", "water", "hearth", { amount: 0.2 }),
    ]);
    expect(resolve(cup, act).world.things.pot?.state.temperature ?? 0).toBeGreaterThan(
      after.things.pot?.state.temperature ?? 9,
    );
  });

  it("a fire burns longer the more there is to burn", () => {
    const lit = (amount: number) =>
      resolve(
        world([
          thing("flame", "fire", "hearth", { burning: { of: "self", fuel: 600 } }),
          thing("pile", "tinder", "hearth", { amount }),
        ]),
        {
          process: "heat",
          source: "flame",
          target: "pile",
          minutes: 1,
        },
      ).world.things.pile?.state.burning?.fuel ?? 0;
    expect(lit(10)).toBeGreaterThan(lit(1) * 5);
  });

  it("a carried dose is a quantity: a cupful taints a well less than it taints a bucket", () => {
    const poured = (amount: number) =>
      resolve(
        world([
          thing("vial", "water", "hearth", { taint: 5, amount: 0.2 }),
          thing("well", "water", "hearth", { amount }),
        ]),
        {
          process: "soak",
          liquid: "vial",
          target: "well",
          amount: 0.2,
        },
      ).world.things.well?.state.taint ?? 0;
    expect(poured(500)).toBeLessThan(poured(2) / 10);
    expect(poured(500) * 500).toBeLessThanOrEqual(5 * 0.2 + 1e-9);
  });
});

describe("2. an outcome does not depend on how time is cut", () => {
  const close = (a: MatterWorld, b: MatterWorld, why: string, tolerance: number) => {
    const [x, y] = [numbers(a), numbers(b)];
    expect(x.length, why).toBe(y.length);
    for (const [i, n] of x.entries())
      expect(Math.abs(n - (y[i] ?? 99)), `${why} [${i}]`).toBeLessThan(tolerance);
    for (const id of Object.keys(a.things))
      expect(a.things[id]?.state.burning === null, `${why} ${id} burning`).toBe(
        b.things[id]?.state.burning === null,
      );
  };

  it("drift: one act and many give the same world, below the hour and above it", () => {
    for (const seed of SEEDS.slice(0, 30)) {
      for (const [minutes, cuts] of [
        [45, 9],
        [60, 60],
        [600, 40],
      ] as const) {
        const w = someWorld(Rng.fromSeed(seed));
        const whole = resolve(w, { process: "drift", minutes }).world;
        const parts = play(
          w,
          Array.from({ length: cuts }, (): Act => ({ process: "drift", minutes: minutes / cuts })),
        ).world;
        close(whole, parts, `seed ${seed} drift ${minutes}/${cuts}`, 0.15);
      }
    }
  });

  it("heat: holding a thing in a flame for a minute is the same as sixty seconds of holding it", () => {
    for (const element of ["tinder", "kindling", "cloth", "oak", "steel", "leather"]) {
      const w = world([
        thing("flame", "fire", "hearth", { burning: { of: "self", fuel: 600 } }),
        thing("x", element),
      ]);
      for (const minutes of [0.5, 2, 20]) {
        const whole = resolve(w, { process: "heat", source: "flame", target: "x", minutes }).world;
        const parts = play(
          w,
          Array.from(
            { length: 30 },
            (): Act => ({ process: "heat", source: "flame", target: "x", minutes: minutes / 30 }),
          ),
        ).world;
        close(whole, parts, `${element} ${minutes} min`, 0.2);
      }
    }
  });

  it("a plunge cracks a brittle stone or it does not, however the minutes are counted", () => {
    const w = world([
      thing("trough", "water", "hearth", { amount: 50 }),
      thing("hot", "stone", "hearth", { temperature: 5 }),
    ]);
    const whole = resolve(w, {
      process: "heat",
      source: "trough",
      target: "hot",
      minutes: 5,
    }).world;
    const parts = play(
      w,
      Array.from(
        { length: 5 },
        (): Act => ({ process: "heat", source: "trough", target: "hot", minutes: 1 }),
      ),
    ).world;
    expect(parts.things.hot?.state.integrity).toBe(whole.things.hot?.state.integrity);
  });

  it("search: the yield of two hours is the same as the yield of its parts", () => {
    for (const place of ["grass", "quarry"]) {
      const whole = searchYield(world([]), {
        process: "search",
        place,
        element: "stone",
        minutes: 120,
        draw: 0.999,
      });
      let w = world([]);
      let sum = 0;
      for (let i = 0; i < 12; i++) {
        const act = {
          process: "search",
          place,
          element: "stone",
          minutes: 10,
          draw: 0.999999,
        } as const;
        sum += searchYield(w, act);
        w = resolve(w, act).world;
      }
      expect(Math.abs(sum - whole), place).toBeLessThan(0.05 + whole * 0.05);
    }
  });
});

describe("3. a collision falls on both by the same rule", () => {
  it("what a thing suffers does not depend on whether it is called the striker", () => {
    for (const [a, b] of [
      ["stone", "flint"],
      ["glass", "stone"],
      ["clay", "iron"],
      ["flint", "glass"],
    ] as const) {
      const w = world([thing("a", a), thing("b", b)]);
      const manner = { effort: 4, care: 2, haste: 2 };
      const ab = resolve(w, { process: "force", instrument: "a", patient: "b", manner }).world;
      const ba = resolve(w, { process: "force", instrument: "b", patient: "a", manner }).world;
      for (const id of ["a", "b"]) {
        const [one, other] = [
          ab.things[id]?.state.integrity ?? 0,
          ba.things[id]?.state.integrity ?? 0,
        ];
        // The mover's mass sets the blow, so the two tellings may differ in size, never in kind.
        expect(one < 5, `${a} on ${b}: ${id}`).toBe(other < 5);
      }
    }
  });
});

describe("4. whatever the input, every level stays a level", () => {
  it("after any act in any world", () => {
    for (const seed of SEEDS) {
      const rng = Rng.fromSeed(seed);
      let w = someWorld(rng);
      for (let i = 0; i < 12; i++) {
        const act = someAct(rng);
        w = resolve(w, act).world;
        expectLevels(w, `seed ${seed} step ${i} ${act.process}`);
      }
    }
  });

  it("and after nonsense: negative, endless and not-a-number", () => {
    const bad = [-5, Number.NaN, Number.POSITIVE_INFINITY, -0.0001, 1e12];
    for (const n of bad) {
      const manner = { effort: n, care: n, haste: n };
      const acts: Act[] = [
        { process: "heat", source: "a", target: "b", minutes: n, contact: n },
        { process: "soak", liquid: "a", target: "b", amount: n },
        { process: "coat", substance: "a", target: "b", amount: n, manner },
        { process: "force", instrument: "a", patient: "b", manner, seconds: n },
        { process: "force", instrument: "a", patient: "body", manner, seconds: n },
        { process: "ingest", body: "body", thing: "a", amount: n },
        { process: "search", place: "quarry", element: "stone", minutes: n, draw: n },
        { process: "drift", minutes: n },
      ];
      for (const act of acts) {
        const start = someWorld(Rng.fromSeed(7));
        const searched = resolve(start, {
          process: "search",
          place: "quarry",
          element: "stone",
          minutes: 30,
          draw: 0,
        }).world;
        const after = resolve(searched, act).world;
        expectLevels(after, `${act.process} with ${n}`);
        const [was, now] = [
          searched.places.quarry?.searched.stone,
          after.places.quarry?.searched.stone,
        ];
        expect(now?.minutes ?? 0, `${act.process} with ${n}`).toBeGreaterThanOrEqual(
          was?.minutes ?? 0,
        );
        expect(now?.found ?? 0, `${act.process} with ${n}`).toBeGreaterThanOrEqual(was?.found ?? 0);
      }
    }
  });
});
