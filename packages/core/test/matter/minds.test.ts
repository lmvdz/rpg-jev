/**
 * Minds, properties first (docs/sandbox-direction.md, "Minds"; spikes/minds/INTENTS.md). The
 * first creature was a list of cases. These hold instead that a factor is a structure and
 * never a branch: a ward's needs reach its keeper, a deed moves feelings by what was done and
 * never by who did it, and what a creature is offered is built from intents as rows, with
 * nothing always among them.
 */
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  type Body,
  type Bond,
  type Element,
  FRESH,
  feltNeeds,
  INTENT_ROWS,
  type MatterWorld,
  offers,
  POOL,
  placeOf,
  resolve,
  routine,
  sliceFor,
  type Thing,
  worldOf,
} from "../../src/matter/index.ts";

const ROWS: Element[] = [
  {
    id: "wolf",
    name: "a wolf",
    kind: "creature",
    forms: [],
    props: { mass: 3, size: 3, hardness: 1, toughness: 3 },
    body: { strength: 3, speed: 4, sight: 3, hearing: 4, smell: 5 },
  },
  {
    id: "pup",
    name: "a wolf pup",
    kind: "creature",
    forms: [],
    props: { mass: 1, size: 1, hardness: 0, toughness: 1 },
    body: { strength: 0, speed: 1, sight: 1, hearing: 2, smell: 2 },
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
    id: "meat",
    name: "meat",
    kind: "material",
    forms: [],
    props: { mass: 1, size: 1, toughness: 2, perishability: 5, scent: 3 },
    moist: 3,
    serves: { hunger: 3 },
  },
];

const at = (
  id: string,
  element: string,
  where: [number, number],
  set: Partial<Thing["state"]> = {},
): Thing => ({ id, element, place: "wood", where, state: { ...FRESH, ...set } });
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
  needs: { hunger: 1, rest: 1, warmth: 0 },
  health: 5,
  wounds: [],
  sickness: 0,
  sickensIn: 0,
  ...set,
});

function wood(things: Thing[], bodies: Body[], bonds: Bond[] = [], place = {}): MatterWorld {
  const empty = worldOf([...POOL, ...ROWS], [placeOf("wood", { light: 4, noise: 1, ...place })]);
  const made = {
    ...empty,
    things: Object.fromEntries(things.map((t) => [t.id, t])),
    bodies: Object.fromEntries(bodies.map((b) => [b.id, b])),
    bonds,
  };
  // One empty act, so that everyone has noticed what there is to notice.
  return resolve(made, { process: "drift", minutes: 0 }).world;
}

const DEN: [number, number] = [0, 0];
const pups = (hunger: number) => [
  body("pup1", "pup", DEN, { needs: { hunger } }),
  body("pup2", "pup", DEN, { needs: { hunger } }),
];
const young = (from: string): Bond[] => [
  { from, to: "pup1", kind: "young", weight: 5 },
  { from, to: "pup2", kind: "young", weight: 5 },
];
const mother = (set: Partial<Body> = {}) =>
  body("she", "wolf", [2, 0], { home: { place: "wood", where: DEN }, ...set });
const ids = (w: MatterWorld, who: string) => offers(w, w.bodies[who] as Body).map((o) => o.id);

describe("1. bonds, a home and the ground", () => {
  it("a ward's hunger is felt by its keeper, by the weight of the bond, and a stranger's is not", () => {
    const w = wood([], [mother({ needs: { hunger: 1 } }), ...pups(5)], young("she"));
    const lone = wood([], [mother({ needs: { hunger: 1 } }), ...pups(5)], []);
    const felt = (x: MatterWorld) =>
      feltNeeds(x, x.bodies.she as Body).find((n) => n.need === "hunger")?.urgency ?? 0;
    expect(felt(w)).toBeGreaterThan(felt(lone) + 2);
    const weak = wood(
      [],
      [mother({ needs: { hunger: 1 } }), ...pups(5)],
      young("she").map((b) => ({ ...b, weight: 1 })),
    );
    expect(felt(weak)).toBeLessThan(felt(w));
    expect(feltNeeds(w, w.bodies.she as Body).some((n) => n.whose !== "she")).toBe(true);
    // A bond never carries more than the ward's own need.
    for (const n of feltNeeds(w, w.bodies.she as Body))
      expect(n.urgency).toBeLessThanOrEqual(w.bodies[n.whose]?.needs[n.need] ?? 0);
  });

  it("where custom says rank eats first, the lower is offered giving way, and the higher is not", () => {
    const pack: Bond[] = [
      { from: "low", to: "high", kind: "pack", weight: 3 },
      { from: "high", to: "low", kind: "pack", weight: 3 },
    ];
    const two = [
      body("high", "wolf", [3, 0], { rank: 4, needs: { hunger: 4 } }),
      body("low", "wolf", [5, 0], { rank: 1, needs: { hunger: 4 } }),
    ];
    const kill = [at("kill", "meat", [4, 0], { amount: 5 })];
    const custom = wood(kill, two, pack, { customs: [{ over: "food", first: "rank" }] });
    expect(ids(custom, "low")).toContain("defer:high");
    expect(ids(custom, "high")).not.toContain("defer:low");
    expect(ids(wood(kill, two, pack), "low")).not.toContain("defer:high");
  });
});

describe("2. deeds move feelings, by what was done", () => {
  const stone = at("stone", "stone", [6, 0]);
  const scene = (bonds: Bond[]) =>
    wood(
      [stone],
      [mother(), ...pups(1), body("man", "person", [6, 0]), body("far", "wolf", [400, 0])],
      bonds,
    );
  const throwAt = (who: string) =>
    ({
      process: "force",
      instrument: "stone",
      patient: who,
      by: "man",
      manner: { effort: 4, care: 2, haste: 2 },
    }) as const;

  it("who is struck fears and is angry at the striker, and at nobody else", () => {
    const after = resolve(scene([]), throwAt("she")).world;
    expect(after.bodies.she?.feels?.man?.fear ?? 0).toBeGreaterThan(0);
    expect(after.bodies.she?.feels?.man?.anger ?? 0).toBeGreaterThan(0);
    expect(after.bodies.she?.feels?.pup1).toBeUndefined();
  });

  it("who sees its young struck feels it by the bond; who is bound to nobody there, less; who saw nothing, not at all", () => {
    const bound = resolve(scene(young("she")), throwAt("pup1")).world.bodies;
    const unbound = resolve(scene([]), throwAt("pup1")).world.bodies;
    expect(bound.she?.feels?.man?.anger ?? 0).toBeGreaterThan(unbound.she?.feels?.man?.anger ?? 0);
    expect(bound.far?.feels?.man).toBeUndefined();
  });

  it("feelings fade with the days", () => {
    const struck = resolve(scene([]), throwAt("she")).world;
    const later = resolve(struck, { process: "drift", minutes: 60 * 24 * 10 }).world;
    expect(later.bodies.she?.feels?.man?.fear ?? 0).toBeLessThan(
      struck.bodies.she?.feels?.man?.fear ?? 0,
    );
  });
});

describe("3. intents as rows", () => {
  it("every intent in the measured list has a row, and no row is outside the list", () => {
    const listed = JSON.parse(
      readFileSync(new URL("../../../../spikes/minds/intents.json", import.meta.url), "utf8"),
    )
      .intents.map((i: { id: string }) => i.id)
      .sort();
    expect(Object.keys(INTENT_ROWS).sort()).toEqual(listed);
  });

  it("offers a handful, always with nothing among them, and nothing toward what it has not noticed", () => {
    const w = wood(
      [at("kill", "meat", [9, 0], { amount: 5 })],
      [mother({ needs: { hunger: 4 } }), ...pups(4), body("man", "person", [7, 1])],
      young("she"),
    );
    const made = offers(w, w.bodies.she as Body);
    expect(made.length).toBeLessThanOrEqual(8);
    expect(made.at(-1)?.id).toBe("none");
    const noticed = new Set(Object.keys(w.bodies.she?.aware ?? {}));
    for (const o of made) if (o.toward) expect(noticed.has(o.toward), o.id).toBe(true);
    const unseen = wood([at("kill", "meat", [900, 0])], [mother({ needs: { hunger: 5 } })]);
    expect(ids(unseen, "she").some((id) => id.endsWith(":kill"))).toBe(false);
  });

  it("the same stones, the same hunger: a mother is offered her den to guard, and a lone wolf is not", () => {
    const things = [at("kill", "meat", [9, 0], { amount: 5 })];
    const man = body("man", "person", [4, 1], { holds: ["stone"] });
    const feels = { man: { fear: 2, anger: 2, trust: 0 } };
    const dam = wood(
      things,
      [mother({ needs: { hunger: 4 }, feels }), ...pups(4), man],
      young("she"),
    );
    const lone = wood(
      things,
      [body("he", "wolf", [2, 0], { needs: { hunger: 4 }, feels }), man],
      [],
    );
    expect(ids(dam, "she")).toContain("guard:man");
    expect(ids(dam, "she")).toContain("warn_off:man");
    expect(ids(lone, "he")).not.toContain("guard:man");
    expect(ids(lone, "he")).toContain("keep_away:man");
    // And what she is offered first is not the meat.
    expect(ids(dam, "she")[0]).not.toBe("go_to:kill");
  });

  it("carrying food home is offered only to one with a ward that cannot come, and food to carry", () => {
    const food = [at("kill", "meat", [3, 0], { amount: 5 })];
    expect(
      ids(wood(food, [mother({ needs: { hunger: 2 } }), ...pups(4)], young("she")), "she"),
    ).toContain("carry_to:kill");
    expect(ids(wood(food, [mother({ needs: { hunger: 2 } })], []), "she")).not.toContain(
      "carry_to:kill",
    );
  });

  it("cornered, it is not offered a way out it does not have", () => {
    const man = body("man", "person", [4, 0], { holds: ["stone"] });
    const feels = { man: { fear: 3, anger: 1, trust: 0 } };
    const open = wood([], [body("he", "wolf", [2, 0], { feels }), man], [], { exits: 4 });
    const trapped = wood([], [body("he", "wolf", [2, 0], { feels }), man], [], { exits: 0 });
    expect(ids(open, "he")).toContain("keep_away:man");
    expect(ids(trapped, "he")).not.toContain("keep_away:man");
  });
});

describe("4. one slice builder", () => {
  it("says it all in words: no level reaches the judge as a number", () => {
    const w = wood(
      [at("kill", "meat", [9, 0], { amount: 5 })],
      [
        mother({ needs: { hunger: 5 }, wounds: [{ depth: 3, bleeding: 1, burned: 0 }] }),
        ...pups(5),
        body("man", "person", [4, 1]),
      ],
      young("she"),
    );
    const slice = sliceFor(w, w.bodies.she as Body);
    const text = JSON.stringify(slice);
    expect(text).not.toMatch(/\d/);
    expect(text).toMatch(/young|pup/);
    expect(text).toMatch(/hungry|hunger|starv/);
    expect(text.length).toBeLessThan(2400);
  });
});

describe("5. the routine is the same offers, scored", () => {
  const scene = (hunger: number, manAt: [number, number] | null) =>
    wood(
      [at("kill", "meat", [9, 0], { amount: 5 })],
      [
        body("he", "wolf", [2, 0], {
          needs: { hunger },
          feels: { man: { fear: 2, anger: 0, trust: 0 } },
        }),
        ...(manAt ? [body("man", "person", manAt, { holds: ["stone"] })] : []),
      ],
    );
  const rank = (w: MatterWorld, prefix: string) => {
    const i = ids(w, "he").findIndex((id) => id.startsWith(prefix));
    return i < 0 ? 99 : i;
  };

  it("more hunger never ranks food lower, and a nearer threat never ranks getting away lower", () => {
    expect(rank(scene(5, null), "go_to:kill")).toBeLessThanOrEqual(
      rank(scene(1, null), "go_to:kill"),
    );
    expect(rank(scene(2, [3, 0]), "keep_away:man")).toBeLessThanOrEqual(
      rank(scene(2, [40, 0]), "keep_away:man"),
    );
  });

  it("chooses the first offer, the same way every time, and nothing when there is nothing to do", () => {
    const w = scene(5, null);
    expect(routine(w, w.bodies.he as Body).id).toBe(ids(w, "he")[0]);
    expect(routine(w, w.bodies.he as Body)).toEqual(routine(w, w.bodies.he as Body));
    const idle = wood([], [body("he", "wolf", [2, 0], { needs: { hunger: 0, rest: 0 } })]);
    expect(
      ["none", "rest:", "carry_on:"].some((p) =>
        routine(idle, idle.bodies.he as Body).id.startsWith(p),
      ),
    ).toBe(true);
  });
});

describe("what the first measure against the judge taught (spikes/minds/INTENTS.md)", () => {
  const he = (set: Partial<Body>) => body("he", "wolf", [2, 0], set);

  it("what is at hand counts: as tired as it is hungry, with food a few steps off, it goes to the food first", () => {
    const w = wood(
      [at("kill", "meat", [6, 0], { amount: 5 })],
      [he({ needs: { hunger: 3, rest: 3 } })],
    );
    expect(ids(w, "he")[0]).toBe("go_to:kill");
  });

  it("fed, with food right here, it is still offered eating, and never before a need that presses", () => {
    const fed = wood(
      [at("kill", "meat", [2.5, 0], { amount: 5 })],
      [he({ needs: { hunger: 0, rest: 4 } })],
    );
    expect(ids(fed, "he")).toContain("eat_drink:kill");
    expect(ids(fed, "he")[0]).toBe("rest:");
  });

  it("with its young beside it and nothing menacing, it is offered staying over them; alone it is not", () => {
    const w = wood([], [mother(), ...pups(1)], young("she"));
    expect(ids(w, "she")).toContain("guard:pup1");
    expect(ids(wood([], [mother(), ...pups(1)], []), "she")).not.toContain("guard:pup1");
  });

  it("a need that nothing in sight would meet offers going to look, and not once something is in sight", () => {
    const hungryYoung = wood([], [mother({ needs: { hunger: 0 } }), ...pups(4)], young("she"));
    expect(ids(hungryYoung, "she")).toContain("go_to:");
    const inSight = wood(
      [at("kill", "meat", [9, 0])],
      [mother({ needs: { hunger: 0 } }), ...pups(4)],
      young("she"),
    );
    expect(ids(inSight, "she")).not.toContain("go_to:");
  });
});

describe("it scales by structure, never by case", () => {
  /** Everyone does the most pressing thing they are offered, turn about, with nobody watching. */
  function live(start: MatterWorld, turns: number) {
    let w = start;
    const did: string[] = [];
    for (let i = 0; i < turns; i++)
      for (const id of Object.keys(w.bodies).sort()) {
        const choice = routine(w, w.bodies[id] as Body);
        if (id === "she") did.push(choice.id);
        if (choice.act) w = resolve(w, choice.act).world;
      }
    return { w, did };
  }

  it("a mother with hungry young fetches the kill home and they eat, and no rule says mother", () => {
    const start = wood(
      [at("kill", "meat", [30, 0], { amount: 5 })],
      [mother({ needs: { hunger: 2 } }), ...pups(4)],
      young("she"),
    );
    const { w, did } = live(start, 30);
    expect(did).toContain("go_to:kill");
    expect(did).toContain("carry_to:kill");
    expect(w.bodies.pup1?.needs.hunger ?? 9).toBeLessThan(4);
    expect(w.bodies.pup1?.feels?.she?.trust ?? 0).toBeGreaterThan(0);
    // The same wolf with no young eats where the kill lies.
    const alone = live(
      wood([at("kill", "meat", [30, 0], { amount: 5 })], [mother({ needs: { hunger: 2 } })], []),
      30,
    );
    expect(alone.did).not.toContain("carry_to:kill");
    // It ate where the kill lay: it never took hold of it, and it is still there itself.
    expect(alone.did).not.toContain("take:kill");
    expect(apartFrom(alone.w.bodies.she, 30)).toBeLessThan(2);
  });

  it("what a creature is called changes nothing: the same rows under other names are offered the same", () => {
    const renamed = (id: string) => ({ wolf: "hind", pup: "fawn" })[id] ?? id;
    const things = [at("kill", "meat", [9, 0], { amount: 5 })];
    const man = body("man", "person", [4, 1], { holds: ["stone"] });
    const wolves = wood(things, [mother({ needs: { hunger: 4 } }), ...pups(4), man], young("she"));
    const others: MatterWorld = {
      ...wolves,
      elements: Object.fromEntries(
        Object.values(wolves.elements).map((e) => [
          renamed(e.id),
          { ...e, id: renamed(e.id), name: `a ${renamed(e.id)}` },
        ]),
      ),
      bodies: Object.fromEntries(
        Object.values(wolves.bodies).map((b) => [
          b.id,
          { ...b, element: renamed(b.element ?? "") },
        ]),
      ),
    };
    expect(ids(others, "she")).toEqual(ids(wolves, "she"));
  });

  it("no engine file names a creature", () => {
    const dir = new URL("../../src/matter/", import.meta.url);
    const named = readdirSync(dir)
      .filter((f) => f.endsWith(".ts") && f !== "pool.ts")
      .filter((f) =>
        /\b(wolf|wolves|pup|pups|mother|deer|dog|fox)\b/i.test(
          readFileSync(new URL(f, dir), "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, ""),
        ),
      );
    expect(named).toEqual([]);
  });
});

const apartFrom = (it: Thing | Body | undefined, x: number) => Math.abs((it?.where?.[0] ?? 0) - x);
