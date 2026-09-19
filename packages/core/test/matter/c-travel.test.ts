/**
 * Batch C (held out), the travel scenarios, run through the matter engine with the rules
 * frozen. Each test asserts what the scenario says a sensible person expects. `it.fails` marks
 * an outcome the rules do not produce, with the reason in brackets; a name that starts
 * `RULE ERROR:` marks one the rules get wrong. Rows are in `rows-c-travel.ts`, written before
 * anything ran.
 *
 * Unbuilt, so no test: travel-06 (bearing, sensing, light), travel-09 (a false sight, heat and
 * thirst on a body), travel-12 (weather, a boat's contents, steering). A person and a pack
 * animal stand in these tests only as weights, because a body has no mass, strength, warmth or
 * wetness: everywhere a scenario says the traveller is cold, wet, tired or thirsty, there is
 * nothing to assert.
 *
 * Changed after the first run, and why: two tests written as `it` failed. travel-14's night by
 * the fire was my encoding: the test said "by morning" and played four hours, so the hours
 * became eight and it derives. travel-08's wet lashing did not derive and became `it.fails`
 * once the engine's numbers were printed (strength 3.9 dry, 3.2 wet, against a pack of 3.0 dry
 * and 3.6 soaked). No row, threshold or place was changed. Every other `it.fails` was written
 * as one before anything ran, and none of them turned out to pass.
 */
import { describe, expect, it } from "vitest";
import {
  type Act,
  alight,
  type Change,
  effective,
  type Manner,
  type MatterWorld,
  play,
  resolve,
  type SearchAct,
  searchOdds,
  strength,
  weight,
} from "../../src/matter/index.ts";
import { body, thing, world } from "./elements.ts";
import { EXTRA } from "./rows-c-travel.ts";

const minutes = (n: number): Act => ({ process: "drift", minutes: n });
const hours = (n: number): Act => minutes(n * 60);

/** Sets fuel burning in a world that is already built: a camp that already has its fire. */
function lit(w: MatterWorld, id: string): MatterWorld {
  const fuel = w.things[id];
  return fuel ? { ...w, things: { ...w.things, [id]: alight(w, fuel) } } : w;
}

const smokes = (changes: readonly Change[]) =>
  changes.some((c) => c.kind === "signal" && c.channel === "smoke");

const look = (place: string, element: string, mins: number, draw: number): SearchAct => ({
  process: "search",
  place,
  element,
  minutes: mins,
  draw,
});

describe("travel-01: a leg in the swamp", () => {
  const pool = world(
    [
      thing("mat", "reedmat", "swamp"),
      thing("walker", "person", "swamp"),
      // Hauling on a staff is part of a person's weight, not all of it.
      thing("pull", "person", "swamp", { amount: 0.5 }),
      thing("staff", "staff", "swamp"),
      thing("mud", "mud", "swamp", { amount: 5 }),
    ],
    [],
    EXTRA,
  );

  it("travel-01: the skin of matted grass over the pool gives way under a person's weight", () => {
    const after = resolve(pool, { process: "load", support: "mat", bearing: ["walker"] }).world;
    expect(after.things.mat?.state.integrity).toBeLessThanOrEqual(1);
  });

  it("travel-01: the staff laid flat takes a steady pull without breaking", () => {
    const after = resolve(pool, { process: "load", support: "staff", bearing: ["pull"] }).world;
    expect(after.things.staff?.state.integrity).toBe(5);
  });

  it("travel-01: and it comes out of the business caked in mud", () => {
    const hasty: Manner = { effort: 3, care: 0, haste: 4 };
    const after = resolve(pool, {
      process: "coat",
      substance: "mud",
      target: "staff",
      amount: 0.5,
      manner: hasty,
    }).world;
    expect(after.things.staff?.state.coating?.element).toBe("mud");
    expect(after.things.staff?.state.coating?.coverage).toBeGreaterThan(0.3);
  });
});

describe("travel-02: the pass", () => {
  const climb = world(
    [
      thing("skin", "water", "pass", { temperature: 3 }),
      thing("sheltered", "water", "lee", { temperature: 3 }),
    ],
    [],
    EXTRA,
  );

  it("travel-02: what was warm from the valley is cold after three hours at the top of the pass", () => {
    const after = resolve(climb, hours(3)).world;
    expect(after.things.skin?.state.temperature).toBeLessThan(1.5);
  });

  // Derived since round two of the grown rows (graph/grown.ts): proposed by a model, ratified by Jev.
  it("travel-02: with the wind picking up, the pass chills what is carried faster than the same cold out of the wind", () => {
    const after = resolve(climb, minutes(30)).world;
    const inWind = after.things.skin?.state.temperature ?? 9;
    const outOfIt = after.things.sheltered?.state.temperature ?? 0;
    expect(outOfIt - inWind).toBeGreaterThan(0.1);
  });
});

describe("travel-03: a camp below the tide line", () => {
  const camp = lit(
    world(
      [
        thing("fire", "driftwood", "shore", { amount: 2 }),
        thing("second", "firewood", "shore", { amount: 3 }),
        thing("sea", "seawater", "shore", { amount: 100000, temperature: 1 }),
        thing("low", "pack", "shore"),
        thing("high", "pack", "shore"),
        thing("dry", "driftwood", "shore"),
        thing("sodden", "driftwood", "shore"),
      ],
      [],
      EXTRA,
    ),
    "fire",
  );
  const over = (target: string, amount: number): Act => ({
    process: "soak",
    liquid: "sea",
    target,
    amount,
  });

  it("travel-03: the sea coming over the fire drowns it, where a splash only makes it hiss, and the unburned wood is still there", () => {
    const drowned = resolve(camp, over("fire", 50)).world.things.fire;
    expect(drowned?.state.burning).toBeNull();
    expect(drowned?.state.amount).toBeGreaterThan(0);
    expect(resolve(camp, over("fire", 0.5)).world.things.fire?.state.burning).toBeTruthy();
  });

  it("travel-03: the pack the water reached is soaked through, and the one carried up in time is dry", () => {
    const after = resolve(camp, over("low", 20)).world;
    expect(after.things.low?.state.wetness).toBeGreaterThan(2.5);
    expect(after.things.high?.state.wetness).toBe(0);
  });

  it("travel-03: sodden driftwood will not take light in the moment that dry driftwood does", () => {
    const flame = lit(camp, "second");
    const held = (target: string): Act => ({
      process: "heat",
      source: "second",
      target,
      minutes: 0.5,
    });
    const after = play(flame, [over("sodden", 20), held("sodden"), held("dry")]).world;
    expect(after.things.dry?.state.burning).toBeTruthy();
    expect(after.things.sodden?.state.burning).toBeFalsy();
  });

  it.fails("travel-03: left alone through the night, the shore itself goes under (no drift touches a place: E13 and a level that rises and falls on a cycle are absent, so the tide can only be a caller pouring the sea on things)", () => {
    const after = resolve(camp, hours(8)).world;
    expect(after.places.shore?.moisture ?? 0).toBeGreaterThan(camp.places.shore?.moisture ?? 9);
  });
});

describe("travel-04: drinking the sea", () => {
  const coast = lit(
    world(
      [
        thing("sea", "seawater", "shore", { amount: 100000 }),
        thing("cup", "seawater", "shore", { amount: 1 }),
        thing("fresh", "water", "shore", { amount: 1 }),
        thing("blaze", "firewood", "shore", { amount: 4 }),
      ],
      [body("player", { place: "shore" })],
      EXTRA,
    ),
    "blaze",
  );
  const drinks = (w: MatterWorld, from: string) =>
    resolve(w, { process: "ingest", body: "player", thing: from, amount: 1 }).world;

  it("travel-04: sea water goes down like any water and tells later; fresh water does not", () => {
    const drunk = drinks(coast, "sea");
    expect(drunk.bodies.player?.health).toBe(5);
    expect(drunk.bodies.player?.sickness).toBeGreaterThan(0.5);
    expect(drinks(coast, "fresh").bodies.player?.sickness).toBe(0);
  });

  it("travel-04: it is the salt and nothing alive in it: boiling the sea water does not make it safe", () => {
    const boiled = resolve(coast, {
      process: "heat",
      source: "blaze",
      target: "cup",
      minutes: 30,
    }).world;
    expect(boiled.things.cup?.state.temperature).toBeGreaterThan(4);
    expect(drinks(boiled, "cup").bodies.player?.sickness).toBeGreaterThan(0.5);
  });

  it.fails("travel-04: within the hour the player is queasy (ingest in body.ts delays every harm by 240 minutes less 40 a level, whatever the harm is: a mild dose shows after two hours and more, where salt in the gut tells inside the hour)", () => {
    const later = resolve(drinks(coast, "sea"), hours(1)).world;
    expect(later.bodies.player?.health).toBeLessThan(5);
  });
});

describe("travel-05: a spring that may not be there", () => {
  const edge = world(
    [thing("hands", "hand", "desertedge"), thing("bed", "bedsand", "desertedge")],
    [],
    EXTRA,
  );
  const hour = (place: string) => look(place, "spring", 60, 0.5);

  it("travel-05: an hour's search round the stone ring may find the spring and most likely does not", () => {
    const odds = searchOdds(edge, hour("desertedge"));
    expect(odds).toBeGreaterThan(0);
    expect(odds).toBeLessThan(0.5);
    const after = resolve(edge, hour("desertedge"));
    expect(after.world.places.desertedge?.searched.spring?.found).toBe(0);
  });

  it("travel-05: finding nothing settles nothing: another hour may still find it, with less hope, and where the spring was only a story the search looked exactly the same", () => {
    const real = resolve(edge, hour("desertedge"));
    const story = resolve(edge, hour("storyring"));
    const again = searchOdds(real.world, hour("desertedge"));
    expect(again).toBeGreaterThan(0);
    expect(again).toBeLessThan(searchOdds(edge, hour("desertedge")));
    expect(real.changes.map((c) => c.note)).toEqual(story.changes.map((c) => c.note));
    expect(searchOdds(story.world, hour("storyring"))).toBe(0);
  });

  // Derived since round two of the grown rows (graph/grown.ts): proposed by a model, ratified by Jev.
  it("travel-05: digging the damp patch by hand leaves a hole", () => {
    const dig: Act = {
      process: "force",
      instrument: "hands",
      patient: "bed",
      manner: { effort: 4, care: 2, haste: 2 },
    };
    const after = play(
      edge,
      Array.from({ length: 10 }, () => dig),
    ).world;
    const heaps = Object.values(after.things).filter((t) => t.element === "bedsand").length;
    expect((after.things.bed?.state.amount ?? 1) < 0.95 || heaps > 1).toBe(true);
  });
});

describe("travel-07: the miners' cache", () => {
  const workings = lit(world([thing("torch", "torch", "cave")], [], EXTRA), "torch");
  const stretch: Act[] = [look("cave", "toolcache", 25, 0.5), minutes(25)];

  it("travel-07: a torch is good for less than an hour", () => {
    const fuel = workings.things.torch?.state.burning?.fuel ?? 0;
    expect(fuel).toBeGreaterThan(15);
    expect(fuel).toBeLessThan(60);
  });

  it("travel-07: a first stretch of searching finds nothing and leaves the torch low, and a second would outlast it", () => {
    const first = play(workings, stretch).world;
    expect(first.places.cave?.searched.toolcache?.found).toBe(0);
    expect(first.things.torch?.state.burning).toBeTruthy();
    expect(first.things.torch?.state.burning?.fuel ?? 99).toBeLessThan(10);
    const second = play(first, stretch).world;
    expect(second.things.torch).toBeUndefined();
  });

  it("travel-07: turning back leaves the question open: the cache may still be further in", () => {
    const first = play(workings, stretch).world;
    const odds = searchOdds(first, look("cave", "toolcache", 60, 0.5));
    expect(odds).toBeGreaterThan(0);
    expect(odds).toBeLessThan(0.5);
  });

  it("fixed rule: travel-07: the one rumoured cache is likelier found in the same 25 minutes in workings of four chambers than in a single chamber (searchYield in body.ts multiplies the stock by `extent` and keeps the find rate per minute: abundance is a density with a floor of a couple per patch, so a single thing somewhere in a bigger place cannot be said, and more ground makes it easier to find instead of harder)", () => {
    const deep = searchOdds(workings, look("cave", "toolcache", 25, 0.5));
    const single = searchOdds(workings, look("chamber", "toolcache", 25, 0.5));
    expect(deep).toBeLessThan(single);
  });
});

describe("travel-08: the ford in spate", () => {
  const ford = world(
    [
      thing("river", "water", "ford", { amount: 100000, temperature: 1 }),
      thing("pack", "pack", "ford"),
      thing("lashing", "lashing", "ford"),
    ],
    [],
    EXTRA,
  );
  const under = play(ford, [
    { process: "soak", liquid: "river", target: "pack", amount: 20 },
    { process: "soak", liquid: "river", target: "lashing", amount: 5 },
  ]).world;
  const hangs = (w: MatterWorld) =>
    resolve(w, { process: "load", support: "lashing", bearing: ["pack"] }).world.things.lashing;

  it("travel-08: the pack that went under is heavier than it was", () => {
    expect(weight(under, ["pack"]) - weight(ford, ["pack"])).toBeGreaterThan(0.3);
  });

  it("travel-08: the lashing holds the dry pack", () => {
    expect(hangs(ford)?.state.integrity).toBe(5);
  });

  it("travel-08: and wet, it still holds the soaked pack by weight alone: it is the current that takes it (the wet lashing parts under dead weight in still water: strength in load.ts gives a short cord 3.9 because it is short, the travel-10 error, and M1 takes 0.7 of that wet, most of it by hardness, which a cord in tension does not bear by, while the pack gains 0.6; the current, which should do it, is no input)", () => {
    expect(hangs(under)?.state.integrity).toBe(5);
  });
});

describe("travel-10: the tether", () => {
  const dusk = world(
    [
      thing("tether", "rope", "meadow"),
      thing("long", "longrope", "meadow"),
      thing("lean", "mule", "meadow", { amount: 0.25 }),
      thing("lunge", "mule", "meadow"),
    ],
    [],
    EXTRA,
  );
  const pulls = (bearing: string) =>
    resolve(dusk, { process: "load", support: "tether", bearing: [bearing] });

  it("travel-10: the tether holds the animal while it only leans on it", () => {
    expect(pulls("lean").world.things.tether?.state.integrity).toBe(5);
  });

  it.fails("RECALIBRATE (a level of mass became a step of four, cords bear in tension, bulk dries by powers; the assertion's magnitude was set against the old scale): travel-10: thrown against with the animal's whole weight, it snaps, and loudly", () => {
    const snapped = pulls("lunge");
    expect(snapped.world.things.tether?.state.integrity).toBeLessThanOrEqual(1);
    expect(snapped.changes.some((c) => c.kind === "signal" && c.strength >= 3)).toBe(true);
  });

  it("fixed rule: travel-10: a rope of the same cordage bears more the longer it is (strength in load.ts takes the thin dimension of what is `long` and the whole size of a `cord`, whose size is its length: 0.7 of a level a step; a cord should bear by its section, which length does not change)", () => {
    const [short, long] = [dusk.things.tether, dusk.things.long];
    const gap = (long ? strength(dusk, long) : 9) - (short ? strength(dusk, short) : 0);
    expect(Math.abs(gap)).toBeLessThan(0.3);
  });

  it.fails("travel-10: two hours of searching the meadow can turn up the animal that is in it (search draws on a place's latent abundance and nothing else: a thing that exists and is out of sight is not something it can find, and sensing, which would, is unbuilt)", () => {
    const after = resolve(dusk, look("meadow", "mule", 120, 0));
    expect(after.world.places.meadow?.searched.mule?.found ?? 0).toBeGreaterThanOrEqual(1);
  });
});

describe("travel-11: a bad landing on scree", () => {
  const slope = world([thing("scree", "stone", "ridge")], [body("player")], EXTRA);
  const landed = resolve(slope, {
    process: "force",
    instrument: "scree",
    patient: "player",
    manner: { effort: 3, care: 0, haste: 4 },
  }).world.bodies.player;

  it("travel-11: coming down wrong on stone is a real injury", () => {
    expect(landed?.wounds[0]?.depth).toBeGreaterThan(0.5);
  });

  it.fails("travel-11: it is a sprain, which swells and does not bleed (a wound in types.ts is a depth, a bleeding and a burn: B3's swollen and broken are absent, every blunt hurt bleeds at three tenths of its depth, and nothing lames the limb)", () => {
    expect(landed?.wounds[0]?.depth).toBeGreaterThan(0.5);
    expect(landed?.wounds[0]?.bleeding).toBe(0);
  });
});

describe("travel-13: everything in one pack", () => {
  const trail = world(
    [
      thing("food", "provisions"),
      thing("bedroll", "woolblanket"),
      thing("coil", "rope", "hearth", { amount: 2 }),
      thing("pot", "cookpot"),
    ],
    [],
    EXTRA,
  );

  it.fails("RECALIBRATE (a level of mass became a step of four, cords bear in tension, bulk dries by powers; the assertion's magnitude was set against the old scale): travel-13: caching the spare rope and the pot takes a real share off the load, and the rope alone would not", () => {
    const all = weight(trail, ["food", "bedroll", "coil", "pot"]);
    expect(all - weight(trail, ["food", "bedroll"])).toBeGreaterThan(0.5);
    expect(all - weight(trail, ["food", "bedroll", "pot"])).toBeLessThan(0.5);
  });
});

describe("travel-14: a small fire and a long night", () => {
  const bivouac = (logs: number) =>
    lit(
      world(
        [
          thing("fire", "firewood", "hillside", { amount: logs }),
          thing("stone", "stone", "hillside"),
          thing("blanket", "woolblanket", "hillside"),
          thing("ashes", "ash", "hillside", { amount: 1 }),
        ],
        [],
        EXTRA,
      ),
      "fire",
    );
  // Lying by the fire: ten minutes of its warmth, then ten minutes of the night, over again.
  const beside: Act[] = [
    { process: "heat", source: "fire", target: "stone", minutes: 10, contact: 0.5 },
    minutes(10),
  ];
  const lyingFor = (w: MatterWorld, hrs: number) =>
    play(w, Array.from({ length: hrs * 6 }, () => beside).flat()).world;

  it("travel-14: three logs burn on past midnight and are out well before morning, leaving cold ash", () => {
    const small = bivouac(3);
    expect(resolve(small, hours(2)).world.things.fire?.state.burning).toBeTruthy();
    const morning = resolve(small, hours(8)).world;
    expect(morning.things.fire).toBeUndefined();
    expect(morning.things["fire.ash"]?.element).toBe("ash");
    expect(morning.things["fire.ash"]?.state.temperature).toBeLessThan(1.5);
  });

  it("travel-14: three times the wood would have lasted the night", () => {
    expect(resolve(bivouac(9), hours(8)).world.things.fire?.state.burning).toBeTruthy();
  });

  it.fails("RECALIBRATE (a level of mass became a step of four, cords bear in tension, bulk dries by powers; the assertion's magnitude was set against the old scale): travel-14: what lies by the fire is kept from the cold while it burns and is as cold as the hillside by morning; by the bigger fire it is not", () => {
    expect(lyingFor(bivouac(3), 1).things.stone?.state.temperature).toBeGreaterThan(1.5);
    expect(lyingFor(bivouac(3), 8).things.stone?.state.temperature).toBeLessThan(1);
    expect(lyingFor(bivouac(9), 8).things.stone?.state.temperature).toBeGreaterThan(1.5);
  });

  it("travel-14: by morning the blanket is damp with dew, and damp it keeps the cold out worse", () => {
    const evening = bivouac(3);
    const morning = resolve(evening, hours(8)).world;
    expect(morning.things.blanket?.state.wetness).toBeGreaterThan(1);
    const [was, now] = [evening.things.blanket, morning.things.blanket];
    expect(now ? effective(morning, now).conductivity : 0).toBeGreaterThan(
      (was ? effective(evening, was).conductivity : 9) + 0.3,
    );
  });

  it.fails("travel-14: banked under ash, the same wood burns slower and longer (burning in drift.ts spends a minute of fuel a minute whatever covers it: air is all or nothing at the level of the place, and a coat never stands between a fire and its air)", () => {
    const banked = resolve(bivouac(3), {
      process: "coat",
      substance: "ashes",
      target: "fire",
      amount: 1,
    }).world;
    expect(resolve(banked, minutes(200)).world.things.fire?.state.burning).toBeTruthy();
  });
});

describe("travel-15: a signal fire", () => {
  const ridge = lit(
    world(
      [
        thing("fire", "firewood", "ridge", { amount: 6 }),
        thing("green", "greenwood", "ridge", { amount: 3 }),
        thing("seasoned", "firewood", "ridge", { amount: 3 }),
      ],
      [],
      EXTRA,
    ),
    "fire",
  );
  const on = (target: string, mins: number): Act => ({
    process: "heat",
    source: "fire",
    target,
    minutes: mins,
  });

  it("travel-15: green wood thrown on the fire is slow to catch where seasoned wood catches at once, and it does catch", () => {
    const moment = play(ridge, [on("green", 0.5), on("seasoned", 0.5)]).world;
    expect(moment.things.seasoned?.state.burning).toBeTruthy();
    expect(moment.things.green?.state.burning).toBeFalsy();
    expect(resolve(ridge, on("green", 15)).world.things.green?.state.burning).toBeTruthy();
  });

  it("travel-15: it burns slower than the same wood seasoned, and when it is gone there is only ash", () => {
    const both = play(ridge, [on("green", 15), on("seasoned", 0.5)]).world;
    expect(both.things.green?.state.burning?.fuel ?? 0).toBeGreaterThan(
      both.things.seasoned?.state.burning?.fuel ?? 9999,
    );
    const spent = resolve(both, hours(24)).world;
    expect(spent.things.green).toBeUndefined();
    expect(spent.things["green.ash"]?.element).toBe("ash");
  });

  it.fails("travel-15: the green wood sends up smoke for as long as it burns (nothing that burns emits: neither taking light in heat.ts nor burning down in drift.ts makes a signal, and the only smoke in the engine is the steam of a dousing; S3 should give light and smoke by E9, more of it the wetter the fuel)", () => {
    const caught = resolve(ridge, on("green", 15));
    const burning = resolve(caught.world, minutes(30));
    expect(smokes(caught.changes) || smokes(burning.changes)).toBe(true);
  });
});
