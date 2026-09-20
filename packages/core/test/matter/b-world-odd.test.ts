/**
 * Batch B (held out), the world and the odd-tool scenarios, run through the matter engine with
 * the rules frozen. Each test asserts what the scenario says a sensible person expects.
 * `it.fails` marks an outcome the rules do not produce, with the reason in brackets; a name
 * that starts `RULE ERROR:` marks one the rules get wrong. Rows are in `rows-b-world-odd.ts`,
 * written before anything ran.
 *
 * Unbuilt, so no test: world-08, odd-01, odd-06. The last block is not a scenario: it checks
 * that a drift over a long gap gives one answer however the gap is cut into acts.
 *
 * Changed after the first run, and why: five outcomes written as `it` did not derive and
 * became `it.fails` once the engine's numbers were printed (world-04 the top rail, odd-02 the
 * crack, odd-03 the dent, odd-04 the pack, odd-05 the paste). odd-02 gained the same crash told
 * with the shield as the striker, and the drift block gained its two sub-hour cases. No row,
 * threshold or place was changed in that pass. Shared-food reach validation later
 * required placing eaters at the source; the dietary assertions remain unchanged.
 */
import { describe, expect, it } from "vitest";
import {
  type Act,
  type Change,
  effective,
  isLiquid,
  type Manner,
  type MatterWorld,
  type Place,
  play,
  resolve,
  strength,
} from "../../src/matter/index.ts";
import { body, thing, world } from "./elements.ts";
import { EXTRA } from "./rows-b-world-odd.ts";

const minutes = (n: number): Act => ({ process: "drift", minutes: n });
const hours = (n: number): Act => minutes(n * 60);
const days = (n: number): Act => hours(n * 24);

/** Stands in for E13 and the weather, which the engine does not have: a place's state changes. */
function turned(w: MatterWorld, id: string, set: Partial<Place>): MatterWorld {
  const place = w.places[id];
  return place ? { ...w, places: { ...w.places, [id]: { ...place, ...set } } } : w;
}

const loudest = (changes: readonly Change[]) =>
  Math.max(
    0,
    ...changes.map((c) => (c.kind === "signal" && c.channel === "sound" ? c.strength : 0)),
  );

describe("world-01: a clearing goes into winter", () => {
  const clearing = world(
    [
      thing("pond", "water", "winter", { amount: 5000, temperature: 3 }),
      thing("cup", "water", "winter", { amount: 1, temperature: 3 }),
    ],
    [],
    EXTRA,
  );

  it("world-01: over six weeks of winter the pond comes down to freezing", () => {
    const after = resolve(clearing, days(42)).world.things.pond;
    expect(after?.state.temperature).toBeLessThan(1);
  });

  // Derived since round two of the grown rows (graph/grown.ts): proposed by a model, ratified by Jev.
  it("fixed rule: what was wrong was: world-01: after one frosty night a pond is as cold as a cupful left beside it, frozen through", () => {
    const night = resolve(clearing, hours(10)).world.things;
    const pond = night.pond?.state.temperature ?? 0;
    const cup = night.cup?.state.temperature ?? 0;
    expect(pond - cup).toBeGreaterThan(0.5);
  });

  it("fixed rule: world-01: water frozen hard is still a liquid (isLiquid in effective.ts answers true for the `liquid` form without reading temperature, so S6 never follows S1 downward)", () => {
    const frozen = resolve(clearing, days(3)).world;
    expect(frozen.things.cup?.state.temperature).toBeLessThan(0.5);
    expect(frozen.things.cup ? isLiquid(frozen, frozen.things.cup) : true).toBe(false);
  });

  it.fails("world-01: the frozen pond bears more than open water does (no modifier hardens what has frozen: M2 only softens toward melting)", () => {
    const frozen = resolve(clearing, days(42)).world;
    const open = clearing.things.pond;
    const iced = frozen.things.pond;
    expect(iced && open ? strength(frozen, iced) - strength(clearing, open) : 0).toBeGreaterThan(
      0.5,
    );
  });
});

describe("world-02: a river works at a clay bank", () => {
  const summer = world([thing("bank", "claybank", "drybank")], [], EXTRA);
  const rains = (w: MatterWorld) => turned(w, "drybank", { moisture: 5, temperature: 2 });
  const hardness = (w: MatterWorld) => (w.things.bank ? effective(w, w.things.bank).hardness : 9);

  it("world-02: a wet season soaks the clay bank and leaves it softer than it was", () => {
    const wet = resolve(rains(summer), days(14)).world;
    expect(wet.things.bank?.state.wetness).toBeGreaterThan(2.5);
    expect(hardness(wet)).toBeLessThan(0.7);
  });

  it.fails("RULE ERROR: world-02: a bank that dried out over the summer is set for good like a fired pot, and a month of rain no longer softens it (the setting drift in drift.ts sets anything with P23 once it is dry; drying should harden reversibly by M1 and only firing should set for good)", () => {
    const dried = resolve(summer, days(30)).world;
    const wet = resolve(rains(dried), days(30)).world;
    expect(hardness(wet)).toBeLessThan(1);
  });
});

describe("world-03: a carcass in a dry gully", () => {
  const gully = world(
    [thing("deer", "carcass", "gully", { amount: 20 })],
    [body("crow", { tolerates: 4, place: "gully" }), body("walker", { place: "gully" })],
    EXTRA,
  );
  const dayOld = resolve(gully, days(1)).world;
  const scent = (w: MatterWorld) => (w.things.deer ? effective(w, w.things.deer).scent : 0);

  it("world-03: within a day the carcass reeks far more than fresh, which is what draws the scavengers", () => {
    expect(scent(dayOld) - scent(gully)).toBeGreaterThan(1);
  });

  it("world-03: a carrion eater takes day-old flesh without harm, and a person who did would be sick", () => {
    const eats = (who: string) =>
      resolve(dayOld, { process: "ingest", body: who, thing: "deer", amount: 1 }).world.bodies[who];
    expect(eats("crow")?.sickness).toBe(0);
    expect(eats("walker")?.sickness).toBeGreaterThan(1);
  });

  it.fails("world-03: after two weeks of rot there is less flesh than there was (rot raises S9 and nothing turns it into loss of substance: no drift takes from amount)", () => {
    const after = resolve(gully, days(14)).world.things.deer;
    expect(after?.state.amount ?? 0).toBeLessThan(16);
  });
});

describe("world-04: a fence in a rainy autumn", () => {
  const fence = world(
    [
      thing("low", "rail", "dampground"),
      thing("top", "rail", "pasture"),
      thing("kept", "rail", "hearth"),
      // A lean is part of a goat's weight.
      thing("goat", "goat", "pasture", { amount: 0.5 }),
    ],
    [],
    EXTRA,
  );
  const autumn = resolve(fence, days(42)).world;
  const leansOn = (w: MatterWorld, rail: string) =>
    resolve(w, { process: "load", support: rail, bearing: ["goat"] }).world.things[rail];

  it("world-04: six weeks in ground that never dries leave the low rail wet through and rotting, while a rail kept dry is sound", () => {
    expect(autumn.things.low?.state.wetness).toBeGreaterThan(2);
    expect(autumn.things.low?.state.contamination).toBeGreaterThan(2);
    expect(autumn.things.kept?.state.contamination).toBeLessThan(0.3);
  });

  it.fails("RULE ERROR: world-04: a rail up in the wind, in air one step damper than mild, is as rotten as a thing can be inside a month, four days behind the one in standing wet (in drift.ts damp air holds a thing at wetness 1.6 for good and the rot rate's damp term is full from wetness 2; rot should need a thing near as wet as it can get, and hold off while it dries between wettings)", () => {
    expect(autumn.things.top?.state.contamination).toBeLessThan(1);
  });

  it("world-04: a sound rail holds a leaning goat", () => {
    expect(leansOn(fence, "kept")?.state.integrity).toBe(5);
  });

  // Derived since round two of the grown rows (graph/grown.ts): proposed by a model, ratified by Jev.
  it("world-04: the rotten rail gives way when the goat leans on it", () => {
    expect(leansOn(autumn, "low")?.state.integrity).toBeLessThan(3);
  });
});

describe("world-05: a rat in the well", () => {
  const village = world(
    [
      thing("rat", "rat", "well"),
      thing("wellwater", "water", "well", { amount: 500 }),
      thing("fouled", "water", "well", { amount: 500, contamination: 2 }),
      thing("stream", "water", "hearth", { amount: 500 }),
    ],
    [body("villager")],
    EXTRA,
  );

  it("world-05: the drowned rat rots within days, cold as the well is", () => {
    const after = resolve(village, days(4)).world;
    expect(after.things.rat?.state.contamination).toBeGreaterThan(2);
    const rat = after.things.rat;
    expect(rat ? effective(after, rat).scent : 0).toBeGreaterThan(3);
  });

  it.fails("world-05: the water the rat lies in turns foul (soak carries S9 from the liquid into what it wets and never the other way, and nothing says a thing lies in a liquid)", () => {
    const after = play(village, [
      { process: "soak", liquid: "wellwater", target: "rat", amount: 1 },
      days(4),
    ]).world;
    expect(after.things.wellwater?.state.contamination).toBeGreaterThan(0.5);
  });

  it("world-05: fouled water goes down like any water and tells hours later; the stream's does not", () => {
    const drinks = (from: string) => {
      const atSource = {
        ...village,
        bodies: {
          villager: body("villager", { place: village.things[from]?.place ?? "hearth" }),
        },
      };
      return resolve(atSource, { process: "ingest", body: "villager", thing: from }).world;
    };
    const drunk = drinks("fouled");
    expect(drunk.bodies.villager?.health).toBe(5);
    expect(drunk.bodies.villager?.sickensIn).toBeGreaterThan(60);
    expect(resolve(drunk, hours(6)).world.bodies.villager?.health).toBeLessThan(5);
    expect(drinks("stream").bodies.villager?.sickness).toBe(0);
  });
});

describe("world-06: a pine across the path", () => {
  it("world-06: three weeks of rain leave the fallen trunk wet, its wood softer, and rot begun", () => {
    const fell = world([thing("trunk", "pinetrunk", "rain")], [], EXTRA);
    const after = resolve(fell, days(21)).world;
    const trunk = after.things.trunk;
    expect(trunk?.state.wetness).toBeGreaterThan(2);
    expect(trunk ? effective(after, trunk).hardness : 9).toBeLessThan(1.8);
    expect(trunk?.state.contamination).toBeGreaterThan(0.5);
  });
});

describe("world-07: a grass fire", () => {
  const alight = { burning: { of: "self" as const, fuel: 240 }, temperature: 5 };
  const field = world(
    [
      thing("tree", "deadtree", "grassland", alight),
      thing("grass", "drygrass", "grassland"),
      thing("scrub", "scrub", "grassland"),
      thing("soaked", "deadtree", "downpour", alight),
      thing("rain", "water", "grassland", { amount: 1000 }),
    ],
    [],
    EXTRA,
  );
  const lick = (target: string, mins: number, contact = 1): Act => ({
    process: "heat",
    source: "tree",
    target,
    minutes: mins,
    contact,
  });

  it("world-07: the burning tree lights the dry grass at its foot in moments", () => {
    const after = resolve(field, lick("grass", 0.5, 0.6)).world;
    expect(after.things.grass?.state.burning).toBeTruthy();
  });

  it("world-07: flame takes the dry grass sooner than the damper scrub, which still goes in the end", () => {
    const brief = play(field, [lick("grass", 0.1), lick("scrub", 0.1)]).world;
    expect(brief.things.grass?.state.burning).toBeTruthy();
    expect(brief.things.scrub?.state.burning).toBeFalsy();
    expect(resolve(field, lick("scrub", 10)).world.things.scrub?.state.burning).toBeTruthy();
  });

  it("world-07: the grass is gone to ash within the half hour and the tree burns on for hours", () => {
    const after = play(field, [lick("grass", 0.5, 0.6), minutes(30)]).world;
    expect(after.things.grass).toBeUndefined();
    expect(after.things["grass.ash"]?.element).toBe("ash");
    expect(after.things.tree?.state.burning).toBeTruthy();
    expect(resolve(field, hours(6)).world.things.tree).toBeUndefined();
  });

  it("world-07: a cloudburst's worth of water puts the tree out, and a bucketful does not", () => {
    const poured = (amount: number) =>
      resolve(field, { process: "soak", liquid: "rain", target: "tree", amount }).world.things.tree;
    expect(poured(50)?.state.burning).toBeNull();
    expect(poured(1)?.state.burning).toBeTruthy();
  });

  // Derived since round two of the grown rows (graph/grown.ts): proposed by a model, ratified by Jev.
  it("fixed rule: what was wrong was: world-07: a tree alight in a two-hour downpour is soaked through and burns on to the end of its fuel", () => {
    const after = resolve(field, hours(2)).world.things.soaked;
    expect(after?.state.burning).toBeNull();
  });
});

describe("odd-02: a shield for a sled", () => {
  const crash: Manner = { effort: 4, care: 0, haste: 5 };
  const slope = world(
    [thing("shield", "shield", "winter"), thing("rock", "outcrop", "winter")],
    [],
    EXTRA,
  );
  const after = resolve(slope, {
    process: "force",
    instrument: "rock",
    patient: "shield",
    manner: crash,
  }).world;

  // A collision has no striker, and force needs one: the same crash told the other way round.
  const reversed = resolve(slope, {
    process: "force",
    instrument: "shield",
    patient: "rock",
    manner: crash,
  }).world;

  it.fails("odd-02: with the outcrop as what strikes, the wood comes off worse than the rock (a collision now falls on both, and the rock chips on the wood: one level of hardness separates wood from rock and also hammerstone from flint, so hardness and toughness alone cannot tell the two apart)", () => {
    expect(after.things.shield?.state.integrity).toBeLessThan(5);
    expect(after.things.rock?.state.integrity).toBe(5);
  });

  it.fails("RULE ERROR: odd-02: with the shield as what strikes, the wood is untouched and knocks a piece off the outcrop (in force.ts `recoil` harms only a brittle striker and `breaking` never asks which is harder; a collision should fall on both, each by its own hardness and toughness)", () => {
    expect(reversed.things.shield?.state.integrity).toBeLessThan(5);
    expect(reversed.things.rock?.state.integrity).toBe(5);
  });

  it.fails("odd-02: hard enough to crack the wood, whichever way it is told (what is tough is only ever marred, by a share cut down by the cube of its size: no single blow cracks it, and S4 has no step between whole and cracked)", () => {
    const worst = Math.min(
      after.things.shield?.state.integrity ?? 5,
      reversed.things.shield?.state.integrity ?? 5,
    );
    expect(worst).toBeLessThanOrEqual(4);
  });
});

describe("odd-03: a cooking pot for a helmet", () => {
  const falls: Manner = { effort: 3, care: 0, haste: 3 };
  const lane = world(
    [
      thing("stone", "stone"),
      thing("pot", "ironpot"),
      thing("jar", "clay", "hearth", { set: true }),
    ],
    [body("player")],
    EXTRA,
  );
  const drops = (on: string) =>
    resolve(lane, { process: "force", instrument: "stone", patient: on, manner: falls });

  it("odd-03: a fist-sized stone from the wall on a bare head is a real injury", () => {
    expect(drops("player").world.bodies.player?.wounds[0]?.depth).toBeGreaterThan(1);
  });

  it("odd-03: the iron pot takes the same stone and stays whole, where a fired clay one goes to pieces", () => {
    expect(drops("pot").world.things.pot?.state.integrity).toBeGreaterThan(4);
    expect(drops("jar").world.things.jar?.state.integrity).toBeLessThanOrEqual(1);
  });

  it("odd-03: and the blow on the iron rings loud", () => {
    expect(loudest(drops("pot").changes)).toBeGreaterThanOrEqual(3.5);
  });

  it.fails("odd-03: the pot takes a visible dent (a blow that does not break a tough thing mars it only if the striker is the harder, and stone is no harder than iron: there is no deformation, S4 has no bent step)", () => {
    expect(drops("pot").world.things.pot?.state.integrity).toBeLessThan(5);
  });
});

describe("odd-04: a bone point for a needle", () => {
  const camp = world(
    [
      thing("sliver", "legbone"),
      thing("point", "legbone", "hearth", { edge: 3 }),
      thing("steel", "needle", "hearth", { edge: 3 }),
      thing("whet", "whetstone"),
      thing("pack", "leather"),
    ],
    [],
    EXTRA,
  );
  const stitch = (instrument: string): Act => ({ process: "force", instrument, patient: "pack" });
  const stitches = (instrument: string, n: number) =>
    play(
      camp,
      Array.from({ length: n }, () => stitch(instrument)),
    ).world;

  // Derived since round two of the grown rows (graph/grown.ts): proposed by a model, ratified by Jev.
  it("odd-04: grinding the sliver on the whetstone brings it to a point", () => {
    const ground = play(camp, [
      { process: "force", instrument: "whet", patient: "sliver", aim: "surface" },
      { process: "force", instrument: "sliver", patient: "whet", aim: "surface" },
    ]).world;
    expect(ground.things.sliver?.state.edge).toBeGreaterThan(0.5);
  });

  it("odd-04: a pointed sliver of bone goes through leather as a needle does, and an unpointed one does not", () => {
    const pierced = resolve(camp, stitch("point")).world.things.pack?.state.integrity ?? 5;
    expect(pierced).toBeLessThan(5);
    expect(pierced).toBeGreaterThan(3);
    expect(resolve(camp, stitch("sliver")).world.things.pack?.state.integrity).toBe(5);
  });

  it("odd-04: thirty stitches on, the bone point is duller and still a point, and a steel needle has lost less", () => {
    const bone = stitches("point", 30).things.point?.state.edge ?? 0;
    const steel = stitches("steel", 30).things.steel?.state.edge ?? 0;
    expect(bone).toBeLessThan(2.9);
    expect(bone).toBeGreaterThan(1.5);
    expect(steel).toBeGreaterThan(bone);
  });

  // Derived since round two of the grown rows (graph/grown.ts): proposed by a model, ratified by Jev.
  it("fixed rule: what was wrong was: odd-04: seven needle holes take a leather pack from whole to in pieces", () => {
    expect(stitches("point", 30).things.pack?.state.integrity).toBeGreaterThan(3);
  });
});

describe("odd-05: ash for soap", () => {
  const greasy = { coating: { element: "grease", amount: 0.1, coverage: 0.8, bond: 0 } };
  const hearthside = world(
    [
      thing("pot", "ironpot", "hearth", greasy),
      thing("water", "water", "hearth", { amount: 5 }),
      thing("paste", "ashpaste", "hearth", { amount: 2 }),
      thing("ash", "ash", "hearth", { amount: 2 }),
    ],
    [],
    EXTRA,
  );
  const washed = (liquid: string) =>
    resolve(hearthside, { process: "soak", liquid, target: "pot", amount: 1 }).world.things.pot;

  it("odd-05: plain water leaves the grease where it is", () => {
    expect(washed("water")?.state.coating?.element).toBe("grease");
  });

  it.fails("odd-05: the ash paste lifts grease that water would not (`wash` in soak.ts is one threshold and all or nothing: a cleansing of 3 against an oiliness of 5 comes to 3 where 3.5 is wanted, scrubbing is no input, and so a mild cleanser does nothing where it should do part)", () => {
    const left = washed("paste")?.state.coating;
    expect(left === null || (left?.coverage ?? 1) < 0.5).toBe(true);
  });

  it("fixed rule: odd-05: dry ash dusted over the grease erases it (coat in soak.ts replaces S7 outright when the element differs; a second coat should lie over or mix with the first)", () => {
    const dusted = resolve(hearthside, { process: "coat", substance: "ash", target: "pot" }).world;
    const pot = dusted.things.pot;
    expect(pot ? effective(dusted, pot).oiliness : 0).toBeGreaterThan(2);
  });
});

describe("odd-07: a coin for a screwdriver", () => {
  const bench = world([thing("coin", "coin"), thing("screw", "screw")], [], EXTRA);
  const wrench: Manner = { effort: 5, care: 2, haste: 2 };
  const after = resolve(bench, {
    process: "force",
    instrument: "coin",
    patient: "screw",
    manner: wrench,
  }).world;

  it("odd-07: copper leaves a steel screw unmarked", () => {
    expect(after.things.screw?.state.integrity).toBe(5);
  });

  it.fails("odd-07: forced hard against a screw that will not turn, the coin is what gives (recoil in force.ts harms only a brittle striker and wear only an edge: a soft, tough thing never deforms, and S4 has no bent step)", () => {
    expect(after.things.coin?.state.integrity).toBeLessThan(5);
  });
});

describe("a long drift is the same answer in one act or many", () => {
  const cases = [
    { name: "the pond cooling", id: "pond", element: "water", at: "winter", total: 658 },
    {
      name: "the carcass rotting and drying",
      id: "deer",
      element: "carcass",
      at: "gully",
      total: 658,
    },
    {
      name: "the low rail soaking and rotting",
      id: "low",
      element: "rail",
      at: "dampground",
      total: 9870,
    },
    { name: "the clay bank drying", id: "bank", element: "claybank", at: "drybank", total: 9870 },
    { name: "the trunk in the rain", id: "trunk", element: "pinetrunk", at: "rain", total: 9870 },
  ];
  const cut = (total: number, each: number) =>
    Array.from({ length: total / each }, () => minutes(each));

  for (const c of cases)
    it(`${c.name}: one act, 47-minute acts and 7-minute acts agree`, () => {
      const start = world([thing(c.id, c.element, c.at, { temperature: 3 })], [], EXTRA);
      const whole = resolve(start, minutes(c.total)).world.things[c.id]?.state;
      for (const each of [47, 7]) {
        const parts = play(start, cut(c.total, each)).world.things[c.id]?.state;
        expect(parts?.temperature).toBeCloseTo(whole?.temperature ?? -9, 1);
        expect(parts?.wetness).toBeCloseTo(whole?.wetness ?? -9, 1);
        expect(parts?.contamination).toBeCloseTo(whole?.contamination ?? -9, 1);
        expect(parts?.set).toBe(whole?.set);
      }
    });

  it("a season is the same in one act, in days and in weeks", () => {
    const start = world(
      [thing("low", "rail", "dampground"), thing("bank", "claybank", "drybank")],
      [],
      EXTRA,
    );
    const whole = resolve(start, days(84)).world.things;
    const daily = play(
      start,
      Array.from({ length: 84 }, () => days(1)),
    ).world.things;
    const weekly = play(
      start,
      Array.from({ length: 12 }, () => days(7)),
    ).world.things;
    // A long gap takes long strides (a year unwatched must not cost a hundred thousand steps),
    // so one act and many agree closely, not exactly.
    for (const cut of [daily, weekly])
      for (const id of Object.keys(whole)) {
        const [x, y] = [whole[id]?.state, cut[id]?.state];
        for (const key of ["wetness", "contamination", "temperature", "corrosion"] as const)
          expect(Math.abs((x?.[key] ?? 0) - (y?.[key] ?? 9)), `${id} ${key}`).toBeLessThan(0.25);
        expect(x?.set).toBe(y?.set);
      }
    // Three long drifts: about a second alone, and several when every other file runs beside it.
  }, 30_000);

  // Not from a scenario: the two places where cutting time finer than the hour changes the answer.
  it("fixed rule: drift: a bleeding wound costs half as much blood again in one act as it does watched minute by minute (driftBody charges the whole step at the bleeding it began with; the loss should be the closed-form sum under the clotting line)", () => {
    const hurt = world(
      [],
      [body("deer", { wounds: [{ depth: 1, bleeding: 2, burned: 0 }] })],
      EXTRA,
    );
    const whole = resolve(hurt, minutes(600)).world.bodies.deer?.health ?? 0;
    const watched = play(hurt, cut(600, 1)).world.bodies.deer?.health ?? 0;
    expect(Math.abs(whole - watched)).toBeLessThan(0.1);
  });

  it("fixed rule: drift: a bar whose oil burns for 59 minutes of an hour ends that hour unwarmed in one act and hot in sixty (the burning rate runs first and puts the fire out for the whole step, so the temperature rate never sees it; a step should be cut where the fuel ends)", () => {
    const oil = { element: "oil", amount: 0.5, coverage: 1, bond: 0 };
    const lit = { coating: oil, burning: { of: "coating" as const, fuel: 59 } };
    const oiled = world([thing("bar", "iron", "hearth", lit)], [], EXTRA);
    const whole = resolve(oiled, minutes(60)).world.things.bar?.state.temperature ?? 0;
    const watched = play(oiled, cut(60, 1)).world.things.bar?.state.temperature ?? 0;
    expect(Math.abs(whole - watched)).toBeLessThan(0.3);
  });

  it("world-05: the sickness from the well comes on the same, watched minute by minute or not at all", () => {
    const drunk = resolve(
      world(
        [thing("fouled", "water", "well", { amount: 5, contamination: 2 })],
        [body("villager")],
        EXTRA,
      ),
      { process: "ingest", body: "villager", thing: "fouled" },
    ).world;
    const whole = resolve(drunk, minutes(301)).world.bodies.villager;
    const watched = play(drunk, cut(301, 7)).world.bodies.villager;
    expect(watched?.health).toBeCloseTo(whole?.health ?? -9, 1);
    expect(watched?.sickensIn).toBe(whole?.sickensIn);
  });
});
