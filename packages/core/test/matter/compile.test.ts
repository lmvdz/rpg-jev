/**
 * The typed act, end to end without a judge: answers in the shape the nine closed questions
 * of the client produce, compiled and resolved over the starting pool. The burning sword and
 * the stone are played here from answers alone.
 */
import { describe, expect, it } from "vitest";
import {
  type Answers,
  alight,
  BARE_HANDS,
  blaze,
  COMPILED,
  type Compiling,
  compile,
  FRESH,
  type MatterWorld,
  NONE,
  POOL,
  placeOf,
  resolve,
  type Thing,
  UNSEEN,
  worldOf,
} from "../../src/matter/index.ts";

const at = (id: string, element: string, set: Partial<Thing["state"]> = {}): Thing => ({
  id,
  element,
  place: "clearing",
  state: { ...FRESH, ...set },
});

function clearing(): MatterWorld {
  const empty = worldOf(POOL, [placeOf("clearing", { abundance: { stone: 2, flint: 1 } })]);
  const things = [
    at("c1-7", "blade", { edge: 4 }),
    at("c1-9", "oil"),
    at("c1-12", "branch", { amount: 8 }),
    at("c1-20", "branch"),
    at("c1-31", "berries"),
    at("hands", "hand"),
  ];
  const hero = {
    id: "hero",
    place: "clearing",
    needs: { hunger: 3 },
    health: 5,
    wounds: [],
    sickness: 0,
    sickensIn: 0,
  };
  const made = {
    ...empty,
    things: Object.fromEntries(things.map((t) => [t.id, t])),
    bodies: { hero },
  };
  const hearth = made.things["c1-12"];
  // A fire is fuel, burning: the hearth is a pile of branches set alight.
  return hearth ? { ...made, things: { ...made.things, "c1-12": alight(made, hearth) } } : made;
}

const BLANK: Answers = {
  process: NONE,
  patient: NONE,
  instrument: NONE,
  effort: "a quick look",
  aim: NONE,
  care: NONE,
  haste: NONE,
  duration: NONE,
  amount: NONE,
};

const asked = (answers: Partial<Answers>, draw = 0.5): Compiling => ({
  answers: { ...BLANK, ...answers },
  operands: { t1: "c1-7", t2: "c1-9", t3: "c1-12", t4: "c1-20", t5: "c1-31" },
  actor: "hero",
  hands: "hands",
  place: "clearing",
  draw,
});

function does(world: MatterWorld, answers: Partial<Answers>, draw?: number): MatterWorld {
  const act = compile(world, asked(answers, draw));
  return act ? resolve(world, act).world : world;
}

describe("the act compiler", () => {
  it("plays the burning sword from answers alone", () => {
    const oiled = does(clearing(), {
      process: "X5",
      patient: "t1",
      instrument: "t2",
      care: "with care",
    });
    expect(oiled.things["c1-7"]?.state.coating?.element).toBe("oil");
    const lit = does(oiled, {
      process: "X3",
      patient: "t1",
      instrument: "t3",
      duration: "a while",
    });
    expect(lit.things["c1-7"]?.state.burning?.of).toBe("coating");
    const later = does(lit, { process: "X7", duration: "a while" });
    expect(later.things["c1-7"]?.state.burning).toBeNull();
    expect(later.things["c1-7"]?.state.coating).toBeNull();
  });

  it("says how hard a thing burns, for whoever draws it: a lit blade less than a burning tree", () => {
    const w = clearing();
    const oiled = does(w, { process: "X5", patient: "t1", instrument: "t2" });
    const lit = does(oiled, {
      process: "X3",
      patient: "t1",
      instrument: "t3",
      duration: "a while",
    });
    const blade = lit.things["c1-7"];
    const fire = lit.things["c1-12"];
    const tree = at("tree", "pine", { burning: { of: "self", fuel: 400 } });
    expect(blade ? blaze(lit, blade) : 0).toBeGreaterThan(0.5);
    expect(blade ? blaze(lit, blade) : 9).toBeLessThan(blaze(lit, tree));
    expect(fire ? blaze(lit, fire) : 0).toBeGreaterThan(0);
    expect(blaze(lit, at("cold", "stone"))).toBe(0);
    const guttering = at("low", "branch", { burning: { of: "self", fuel: 0.5 } });
    expect(blaze(lit, guttering)).toBeLessThan(
      blaze(lit, at("high", "branch", { burning: { of: "self", fuel: 60 } })),
    );
  });

  it("keeps a hearth alight through a wait, and says what time did once, not once a step", () => {
    const w = clearing();
    expect(w.things["c1-12"]?.state.burning?.fuel).toBeGreaterThan(240);
    const act = compile(w, asked({ process: "X7", duration: "until it is done" }));
    const waited = act ? resolve(w, act) : null;
    expect(waited?.world.things["c1-12"]?.state.burning).not.toBeNull();
    const about = (id: string) =>
      waited?.changes.filter((c) => c.kind === "state" && c.thing === id) ?? [];
    expect(about("c1-12")).toHaveLength(1);
    expect(about("c1-12")[0]?.note).toContain("it burns down");
    // A cold dry blade did nothing worth saying, and is not said.
    expect(about("c1-7")).toHaveLength(0);
    expect(waited?.changes.filter((c) => !c.quiet).length).toBeLessThan(6);
  });

  it("finds branches in a wood at a glance, again and again: a clearing is many patches", () => {
    const small = clearing();
    const place = small.places.clearing;
    const wood = place
      ? { ...small, places: { clearing: { ...place, extent: 40, abundance: { branch: 4 } } } }
      : small;
    let at = wood;
    let found = 0;
    for (const draw of [0.11, 0.92, 0.53, 0.49]) {
      const before = Object.keys(at.things).length;
      at = does(
        at,
        { process: "X8", patient: UNSEEN, kind: "branch", effort: "a quick look" },
        draw,
      );
      if (Object.keys(at.things).length > before) found += 1;
    }
    expect(found).toBeGreaterThanOrEqual(3);
  });

  it("looks for a stone: a glance finds nothing, a long search finds one and makes it real", () => {
    const sought = { process: "X8", patient: UNSEEN, kind: "stone" };
    const glance = does(clearing(), { ...sought, effort: "what is at hand" }, 0.9);
    expect(Object.values(glance.things).some((t) => t.element === "stone")).toBe(false);
    const thorough = does(clearing(), { ...sought, effort: "a thorough search" }, 0.2);
    expect(Object.values(thorough.things).some((t) => t.element === "stone")).toBe(true);
    expect(thorough.places.clearing?.searched.stone?.minutes).toBe(60);
  });

  it("eats, waits, and works with bare hands", () => {
    const fed = does(clearing(), { process: "X6", patient: "t5", amount: "all of it" });
    expect(fed.bodies.hero?.needs.hunger).toBeLessThan(3);
    expect(fed.things["c1-31"]).toBeUndefined();
    const struck = compile(
      clearing(),
      asked({ process: "X2", patient: "t4", instrument: BARE_HANDS }),
    );
    expect(struck).toMatchObject({ process: "force", instrument: "hands", patient: "c1-20" });
    const waited = compile(clearing(), asked({ process: "X7", duration: "until it is done" }));
    expect(waited).toEqual({ process: "drift", minutes: 240 });
  });

  it("reads aim, care and haste, and carries them to the rules", () => {
    const act = compile(
      clearing(),
      asked({
        process: "X2",
        patient: "t4",
        instrument: "t1",
        aim: "on the surface",
        care: "with care",
        haste: "unhurried",
        effort: "a thorough search",
      }),
    );
    expect(act).toMatchObject({ aim: "surface", manner: { effort: 4, care: 4, haste: 0 } });
  });

  it("compiles to nothing, never an error, when the answers name nothing that can be done", () => {
    const w = clearing();
    const nothing: Partial<Answers>[] = [
      {},
      { process: "X1", patient: "t1" },
      { process: "X9", patient: "t1" },
      { process: "X3", patient: "t1" },
      { process: "X5", patient: "t9", instrument: "t2" },
      { process: "X8", patient: UNSEEN },
      { process: "X8", patient: UNSEEN, kind: "dragon" },
      { process: "nonsense" },
    ];
    for (const answers of nothing) expect(compile(w, asked(answers))).toBeNull();
    expect(COMPILED).toEqual(["X2", "X3", "X4", "X5", "X6", "X7", "X8"]);
  });
});
