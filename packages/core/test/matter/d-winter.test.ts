/**
 * Batch D (held out), the winter scenarios, run through the matter engine with the rules
 * frozen. Each test asserts what the scenario says a sensible person expects. `it.fails` marks
 * an outcome the rules do not produce, with the reason in brackets; a name that starts
 * `RULE ERROR:` marks one the rules get wrong. Rows are in `rows-d-winter.ts`, written before
 * anything ran.
 *
 * Unbuilt, so no test: winter-06 (glare adding up over hours into an eye injury that shows
 * late: light only shows things, nothing accrues on a body from it, and B8 is absent),
 * winter-11 (harm from a swing between cold and hot repeated over days: a body has no hands,
 * no part has a temperature, and nothing counts what has happened to it before).
 *
 * Nothing to assert, inside scenarios that are tested: a part of a body (a chilled chest,
 * numb white fingertips, clumsy hands, slow wits: a body's cold is one number and `able`
 * lowers strength and speed only), what a body knows of its own hurt or of another's state (a
 * percept is a source, a channel and a strength), ice hidden under snow (nothing seen has a
 * property that can be hidden), a haul that slops (no contents, no hauling), frost as a thing
 * on a handle, a startled ox (its fright is a given). There is no act for putting on or taking
 * off what is worn, nor for going from one place to another: `become` and `goes` below are the
 * caller rewriting the body, as `lit` is the caller lighting a fire. A body takes no liquid
 * from `soak`, so a soaked person is a body built wet. Shivering is read as a warmth need of 1
 * or more, the level at which drift says "the cold gets in".
 *
 * Changed after the first run, and why: one test written as `it` failed. winter-07's chopping
 * asserted that ten logs each part at one stroke; the first six do and the rest do not,
 * because the engine blunts the axe (edge 4 to 1.1 in ten strokes, printed). The stroke that
 * splits a log stayed an `it`, and the pile became a `RULE ERROR` `it.fails`: an axe does not go
 * blunt in a dozen strokes into wood. One `it.fails` was failing on a check of my own encoding
 * and not on its outcome: winter-08's fever also asserted that the coat was still damp on the
 * third morning, and the engine dries a coat through in one mild night, so that line went and
 * the test now fails on the sickness alone. No row, threshold or place was changed. Every
 * other `it.fails` was written as one before anything ran; each was run once as an `it` to
 * read its numbers, and each fails for the reason in its name.
 */
import { describe, expect, it } from "vitest";
import {
  type Act,
  able,
  alight,
  type Body,
  canTake,
  effective,
  isLiquid,
  type Manner,
  type MatterWorld,
  play,
  resolve,
  routine,
  type Thing,
} from "../../src/matter/index.ts";
import { body, thing, world } from "./elements.ts";
import { EXTRA } from "./rows-d-winter.ts";

const minutes = (n: number): Act => ({ process: "drift", minutes: n });
const hours = (n: number): Act => minutes(n * 60);

/** Sets fuel burning in a world that is already built: a house that already has its fire. */
function lit(w: MatterWorld, id: string): MatterWorld {
  const fuel = w.things[id];
  return fuel ? { ...w, things: { ...w.things, [id]: alight(w, fuel) } } : w;
}

/** A thing at a spot in its place. Without one it is right here, beside whatever else is. */
const at = (t: Thing, where: readonly [number, number]): Thing => ({ ...t, where });

const someone = (id: string, place: string, set: Partial<Body> = {}): Body =>
  body(id, { element: "person", place, needs: { hunger: 1, rest: 1, warmth: 0 }, ...set });

/** The caller rewrites a body: it has changed its clothes, or lain down. No act does this. */
function become(w: MatterWorld, id: string, set: Partial<Body>): MatterWorld {
  const b = w.bodies[id];
  return b ? { ...w, bodies: { ...w.bodies, [id]: { ...b, ...set } } } : w;
}

/** The caller takes a body, and what it wears, to another place. No act does this. */
function goes(w: MatterWorld, id: string, place: string): MatterWorld {
  const moved = become(w, id, { place });
  const things = { ...moved.things };
  for (const worn of moved.bodies[id]?.wears ?? []) {
    const t = things[worn];
    if (t) things[worn] = { ...t, place };
  }
  return { ...moved, things };
}

const cold = (w: MatterWorld, id: string) => w.bodies[id]?.needs.warmth ?? 0;
const can = (w: MatterWorld, id: string) => {
  const b = w.bodies[id];
  return b ? able(w, b) : undefined;
};
const deepest = (w: MatterWorld, id: string) =>
  w.bodies[id]?.wounds.reduce((n, x) => Math.max(n, x.depth), 0) ?? 0;
const flexibility = (w: MatterWorld, id: string) => {
  const t = w.things[id];
  return t ? effective(w, t).flexibility : 0;
};

describe("winter-01: through the ice", () => {
  const pond = world(
    [
      // Thinned from beneath by the spring: a weakness nobody sees from above.
      thing("thin", "icesheet", "pond", { temperature: 0, flaw: 2 }),
      thing("sound", "icesheet", "pond", { temperature: 0 }),
      thing("water", "water", "pond", { amount: 100000, temperature: 0.5 }),
      thing("coat", "woolcoat", "pond"),
    ],
    [someone("player", "pond", { wears: ["coat"] })],
    EXTRA,
  );
  const stands = (on: string) =>
    resolve(pond, { process: "load", support: on, bearing: ["player"] }).world;

  // Home: the fire, dry wool on the peg, and the coat that went in the pond.
  const home = (wears: string[]) =>
    lit(
      world(
        [
          thing("fire", "firewood", "house", { amount: 6 }),
          thing("dry", "woolcoat", "house"),
          thing("soaked", "woolcoat", "house", { wetness: 4.2, temperature: 0.5 }),
          thing("left", "woolcoat", "house", { wetness: 4.2, temperature: 0.5 }),
        ],
        [someone("player", "house", { wears, wetness: 3, needs: { warmth: 1.5 } })],
        EXTRA,
      ),
      "fire",
    );

  it("winter-01: the ice gives way under a person where it is thin, and bears the same person where it is sound", () => {
    expect(stands("thin").things.thin?.state.integrity).toBeLessThanOrEqual(1);
    expect(stands("sound").things.sound?.state.integrity).toBe(5);
  });

  it.fails("winter-01: going through, the player is wet to the waist (load drops what it held and says no more: nothing is under the ice, and a body takes wetness from rain and from nothing else)", () => {
    expect(stands("thin").bodies.player?.wetness ?? 0).toBeGreaterThan(2);
  });

  it.fails("RULE ERROR: winter-01: going through pond ice into water is a soaking and not an injury (load.ts wounds any body a failed support held, by half its mass: a wound of depth 2 that bleeds, for going in to the waist)", () => {
    expect(stands("thin").bodies.player?.wounds.length).toBe(0);
  });

  it("winter-01: the coat that goes into the pond comes out soaked", () => {
    const after = resolve(pond, { process: "soak", liquid: "water", target: "coat", amount: 5 });
    expect(after.world.things.coat?.state.wetness).toBeGreaterThan(2.5);
  });

  it("winter-01: on the run home the wet body in wet wool loses heat much faster than a dry one in dry wool", () => {
    const run = (wetness: number, coat: number) => {
      const w = world(
        [thing("coat", "woolcoat", "pond", { wetness: coat })],
        [someone("player", "pond", { wears: ["coat"], wetness, where: [0, 0] })],
        EXTRA,
      );
      const home: Act = { process: "move", body: "player", to: [40, 0], minutes: 10 };
      return cold(play(w, [home, minutes(10)]).world, "player");
    };
    expect(run(3, 4.2)).toBeGreaterThan(run(0, 0) * 1.5);
  });

  it("winter-01: in dry wool by the fire they warm back up, over the next while and not at once", () => {
    const changed = home(["dry"]);
    expect(cold(resolve(changed, minutes(10)).world, "player")).toBeGreaterThan(1);
    expect(cold(resolve(changed, hours(1)).world, "player")).toBeLessThan(1.5);
  });

  it.fails("RULE ERROR: winter-01: staying in the soaked clothes by the fire, they grow colder and not warmer (weathered in living.ts takes the fire off the exposure first: by a fire the exposure is nothing, so wetness and wet wool multiply nothing, and the soaked body warms a hundredth a minute exactly as the dry one does)", () => {
    const stayed = resolve(home(["soaked"]), hours(1)).world;
    expect(cold(stayed, "player")).toBeGreaterThan(1.5);
  });

  it("winter-01: hung by the fire the soaked coat dries, where the same coat left across the room has barely begun", () => {
    const hung: Act = {
      process: "heat",
      source: "fire",
      target: "soaked",
      minutes: 30,
      contact: 0.5,
    };
    const after = play(home(["dry"]), [hung, hung, hung, hung]).world;
    const across = resolve(home(["dry"]), hours(2)).world;
    expect(after.things.soaked?.state.wetness).toBeLessThan(3);
    expect(across.things.left?.state.wetness).toBeGreaterThan(
      (after.things.soaked?.state.wetness ?? 9) + 1,
    );
  });
});

describe("winter-02: linen under wool in the sleet", () => {
  const yard = world(
    [thing("shirt", "linenshirt", "yard"), thing("coat", "woolcoat", "yard", { wetness: 1 })],
    [someone("player", "yard", { wears: ["shirt", "coat"] })],
    EXTRA,
  );
  // One garment on one body, out of the wet, so that the garment is as wet as the test says.
  const chill = (element: string | null, wetness: number) => {
    const w = world(
      element ? [thing("worn", element, "woodpile", { wetness })] : [],
      [someone("player", "woodpile", { wears: element ? ["worn"] : [] })],
      EXTRA,
    );
    return cold(resolve(w, minutes(30)).world, "player");
  };

  it("winter-02: the linen is wet through within a quarter of an hour of sleet", () => {
    expect(resolve(yard, minutes(15)).world.things.shirt?.state.wetness).toBeGreaterThanOrEqual(
      2.5,
    );
  });

  it.fails("winter-02: by the time the linen is wet through the wool over it is only damp (the wetness rule in drift-rules.ts wets everything in wet air by a fifth of a level a minute whatever it is: nothing is under anything, and neither weave, thickness nor oiliness slows the taking up)", () => {
    const after = resolve(yard, minutes(15)).world;
    const [shirt, coat] = [
      after.things.shirt?.state.wetness ?? 0,
      after.things.coat?.state.wetness ?? 9,
    ];
    expect(shirt - coat).toBeGreaterThan(1);
  });

  it.fails("winter-02: soaked, the linen does almost nothing to hold warmth (M1 adds to conductivity two fifths of a level for each level soaked: soaked linen still keeps off a quarter of the cold that bare skin takes)", () => {
    expect(chill("linenshirt", 4.8)).toBeGreaterThan(chill(null, 0) * 0.85);
  });

  it("winter-02: wet wool still helps where wet linen barely does, and wetness costs the linen more of its worth than it costs the wool", () => {
    const [woolWet, woolDry] = [chill("woolcoat", 4.2), chill("woolcoat", 0)];
    const [linenWet, linenDry] = [chill("linenshirt", 4.8), chill("linenshirt", 0)];
    expect(woolWet).toBeLessThan(linenWet);
    expect(woolWet - woolDry).toBeLessThan(linenWet - linenDry);
  });

  it.fails("winter-02: it is the wet layer against the skin that chills: the same soaked shirt and dry coat worn the other way round would chill less (what is worn is a sum in living.ts: no layer is next to the skin, and a body's cold has no site)", () => {
    const worn = (wears: string[]) => {
      const w = world(
        [
          thing("shirt", "linenshirt", "woodpile", { wetness: 4.8 }),
          thing("coat", "woolcoat", "woodpile"),
        ],
        [someone("player", "woodpile", { wears })],
        EXTRA,
      );
      return cold(resolve(w, minutes(30)).world, "player");
    };
    expect(worn(["shirt", "coat"])).toBeGreaterThan(worn(["coat", "shirt"]) + 0.02);
  });

  it("winter-02: by the time the wood is stacked, two hours on, they are shivering", () => {
    expect(cold(resolve(yard, hours(2)).world, "player")).toBeGreaterThanOrEqual(1);
  });

  it.fails("winter-02: soaked through, they are slower to warm back up indoors than someone as cold who came in dry (out of the cold a body warms by a flat hundredth a minute, whatever it wears and however wet it is)", () => {
    const indoors = (wetness: number, garment: number) =>
      lit(
        world(
          [
            thing("fire", "firewood", "house", { amount: 6 }),
            thing("shirt", "linenshirt", "house", { wetness: garment }),
          ],
          [someone("player", "house", { wears: ["shirt"], wetness, needs: { warmth: 1.4 } })],
          EXTRA,
        ),
        "fire",
      );
    const soaked = cold(resolve(indoors(5, 4.8), hours(1)).world, "player");
    const dry = cold(resolve(indoors(0, 0), hours(1)).world, "player");
    expect(soaked).toBeGreaterThan(dry + 0.1);
  });
});

describe("winter-03: the gap at the shutter", () => {
  const night = (place: string) =>
    lit(
      world(
        [
          at(thing("fire", "firewood", place, { amount: 6 }), [0, 0]),
          // Warped since autumn: it no longer meets its frame.
          at(thing("shutter", "shutter", place, { integrity: 4 }), [4, 4]),
          at(thing("wall", "wall", place, { temperature: 1 }), [4, 4]),
          thing("rollnear", "bedroll", place),
          thing("rollfar", "bedroll", place),
        ],
        [
          // As far from the fire as each other; one lies by the shutter.
          someone("near", place, { where: [4, 3], wears: ["rollnear"], attention: "asleep" }),
          someone("far", place, { where: [4, -3], wears: ["rollfar"], attention: "asleep" }),
        ],
        EXTRA,
      ),
      "fire",
    );

  it.fails("winter-03: the wind getting up outside comes in at the gap and the room grows colder (no drift touches a place: E13 is absent, places do not join one another, and a gap in a thing lets nothing through; a draught can only be a caller changing the room's row)", () => {
    const tight = night("nighthouse");
    const after = resolve(tight, hours(8)).world.places.nighthouse;
    const colder = (after?.temperature ?? 9) < (tight.places.nighthouse?.temperature ?? 0);
    expect(colder || (after?.wind ?? 0) > 0).toBe(true);
  });

  it("winter-03: given the draught, the banked fire does not make up for it: the sleepers are colder by morning than in the same room still", () => {
    const draughty = cold(resolve(night("draughtyhouse"), hours(8)).world, "far");
    const still = cold(resolve(night("nighthouse"), hours(8)).world, "far");
    expect(draughty).toBeGreaterThan(still);
  });

  it.fails("winter-03: whoever sleeps nearest the gap wakes cold while the one across the room is fine (a place has one wind and one temperature: only a fire has a where, so two sleepers as far from the hearth are exactly as cold)", () => {
    const morning = resolve(night("draughtyhouse"), hours(8)).world;
    expect(cold(morning, "near")).toBeGreaterThan(cold(morning, "far") + 0.1);
  });

  it.fails("winter-03: morning shows frost on the inside of the wall by the shutter (nothing comes out of the air onto a cold surface: drift wets a thing only in wet air and only as far as it drinks, and no rule makes frost)", () => {
    const wall = resolve(night("draughtyhouse"), hours(8)).world.things.wall?.state;
    expect((wall?.coating ?? null) !== null || (wall?.wetness ?? 0) > 0.5).toBe(true);
  });
});

describe("winter-04: a fire nobody feeds", () => {
  const camp = (place: string, wears: string[], logs: number) =>
    lit(
      world(
        [thing("fire", "firewood", place, { amount: logs }), thing("roll", "bedroll", place)],
        [someone("hunter", place, { wears, attention: "asleep" })],
        EXTRA,
      ),
      "fire",
    );
  const shelter = camp("shelter", ["roll"], 2);

  it("winter-04: the small fire burns on for a while unfed and is out long before dawn, leaving ash", () => {
    expect(resolve(shelter, minutes(90)).world.things.fire?.state.burning).toBeTruthy();
    const dawn = resolve(shelter, hours(8)).world;
    expect(dawn.things.fire).toBeUndefined();
    expect(dawn.things["fire.ash"]?.element).toBe("ash");
  });

  it("winter-04: the sleeper is warm while it burns, and shivering by the hour before dawn", () => {
    expect(cold(resolve(shelter, minutes(90)).world, "hunter")).toBeLessThan(0.2);
    expect(cold(resolve(shelter, hours(8)).world, "hunter")).toBeGreaterThanOrEqual(1);
  });

  it("winter-04: the wool bedroll holds some warmth: without it the same night is colder", () => {
    const bare = cold(resolve(camp("shelter", [], 2), hours(8)).world, "hunter");
    expect(cold(resolve(shelter, hours(8)).world, "hunter")).toBeLessThan(bare);
  });

  it("winter-04: they wake stiff and slow: the cold has taken from what the body can do", () => {
    const dawn = resolve(shelter, hours(8)).world;
    expect(can(dawn, "hunter")?.speed).toBeLessThan(can(shelter, "hunter")?.speed ?? 0);
    expect(can(dawn, "hunter")?.strength).toBeLessThan(can(shelter, "hunter")?.strength ?? 0);
  });

  it("winter-04: and hungrier than they lay down, with nobody having done anything", () => {
    const dawn = resolve(shelter, hours(8)).world;
    expect(dawn.bodies.hunter?.needs.hunger).toBeGreaterThan(
      shelter.bodies.hunter?.needs.hunger ?? 9,
    );
  });

  it.fails("winter-04: sharply hungry: a night spent shivering costs more than the same night spent warm (hunger in living.ts comes by the clock alone: keeping warm costs a body nothing)", () => {
    const shivered = resolve(shelter, hours(8)).world.bodies.hunter?.needs.hunger ?? 0;
    const warm = resolve(camp("hearth", ["roll"], 2), hours(8)).world.bodies.hunter?.needs.hunger;
    expect(shivered).toBeGreaterThan((warm ?? 9) + 0.2);
  });
});

describe("winter-05: bare hands on frosted iron", () => {
  const well = world(
    [
      thing("handle", "ironhandle", "wellyard", { temperature: 0 }),
      thing("line", "rope", "wellyard", { temperature: 0 }),
      thing("onIron", "hand", "wellyard", { temperature: 3 }),
      thing("onRope", "hand", "wellyard", { temperature: 3 }),
    ],
    [someone("player", "wellyard")],
    EXTRA,
  );
  const grips = (source: string, target: string): Act => ({
    process: "heat",
    source,
    target,
    minutes: 3,
  });

  it("winter-05: the frozen handle draws the warmth out of the hand that grips it, and is a little the warmer for it", () => {
    const after = resolve(well, grips("handle", "onIron")).world;
    expect(after.things.onIron?.state.temperature).toBeLessThan(2.7);
    expect(after.things.handle?.state.temperature).toBeGreaterThan(0);
  });

  it.fails("winter-05: iron takes the heat from skin far faster than rope as cold (the rate in heat-rules.ts reads the conductivity of what takes the heat and never of what gives it: cold iron and cold rope of one weight chill a hand alike)", () => {
    const after = play(well, [grips("handle", "onIron"), grips("line", "onRope")]).world;
    const [iron, rope] = [
      after.things.onIron?.state.temperature,
      after.things.onRope?.state.temperature,
    ];
    expect(iron ?? 9).toBeLessThan((rope ?? 0) - 0.2);
  });

  it.fails("winter-05: minutes of gripping it tell on the body: the fingers go numb and stop bending (heat passes between things only: a body touches nothing, has no hands, and B8 has no numbness to give it)", () => {
    const held: Act = { process: "heat", source: "handle", target: "player", minutes: 10 };
    const after = resolve(well, held).world;
    const weaker = (can(after, "player")?.strength ?? 9) < (can(well, "player")?.strength ?? 0);
    expect(weaker || (after.bodies.player?.wounds.length ?? 0) > 0).toBe(true);
  });

  it("winter-05: warmed slowly in indoor air the body comes back unhurt, and pressed against the hot stove the skin burns", () => {
    const indoors = lit(
      world(
        [
          thing("fire", "firewood", "house", { amount: 6 }),
          thing("stove", "stove", "house", { temperature: 4 }),
        ],
        [someone("player", "house", { needs: { warmth: 2 } })],
        EXTRA,
      ),
      "fire",
    );
    const slowly = resolve(indoors, hours(1)).world;
    expect(cold(slowly, "player")).toBeLessThan(2);
    expect(slowly.bodies.player?.wounds.length).toBe(0);
    const pressed: Manner = { effort: 0, care: 2, haste: 0 };
    const fast = resolve(indoors, {
      process: "force",
      instrument: "stove",
      patient: "player",
      manner: pressed,
      seconds: 5,
    }).world;
    expect(fast.bodies.player?.wounds.some((x) => x.burned > 0)).toBe(true);
  });
});

describe("winter-07: sweat, and then standing still", () => {
  const logs = Array.from({ length: 10 }, (_, i) => `log${i}`);
  const pile = world(
    [
      thing("axe", "axe", "woodpile", { edge: 4 }),
      thing("coat", "woolcoat", "woodpile"),
      thing("shirt", "linenshirt", "woodpile"),
      ...logs.map((id) => thing(id, "log", "woodpile")),
    ],
    [someone("player", "woodpile", { wears: ["coat", "shirt"], where: [0, 0] })],
    EXTRA,
  );
  const chop = (log: string): Act => ({
    process: "force",
    by: "player",
    instrument: "axe",
    patient: log,
    manner: { effort: 4, care: 2, haste: 2 },
    aim: "along",
  });
  const worked = play(pile, [...logs.map(chop), hours(1)]).world;
  const idled = resolve(pile, hours(1)).world;

  it("winter-07: the axe splits a log along the grain at a stroke", () => {
    expect(resolve(pile, chop("log0")).world.things.log0?.state.integrity).toBeLessThanOrEqual(1);
  });

  it.fails("RULE ERROR: winter-07: and goes on splitting them, a stroke a log, down the pile (wear in force.ts takes 0.29 of a level of edge for each hard stroke into wood: an axe at 4 is at 1.1 after ten strokes, the seventh log no longer parts at a stroke, and an hour of chopping is past it after fourteen)", () => {
    expect(logs.every((id) => (worked.things[id]?.state.integrity ?? 5) <= 1)).toBe(true);
  });

  it.fails("winter-07: an hour of hard chopping in a wool coat works up a sweat (what a body does costs it nothing and makes nothing: force with a `by` is a deed and no more, so nobody is ever wet or warm from work)", () => {
    expect(worked.bodies.player?.wetness ?? 0).toBeGreaterThan(0.5);
  });

  it.fails("winter-07: and tires them more than an hour stood by the pile would (tiredness in living.ts comes by the clock alone)", () => {
    expect(worked.bodies.player?.needs.rest ?? 0).toBeGreaterThan(
      idled.bodies.player?.needs.rest ?? 9,
    );
  });

  it("winter-07: resting still with a sweat-damp shirt against the skin, they chill faster than if they had never sweated", () => {
    const rests = (wetness: number, shirt: number) => {
      const w = world(
        [
          thing("coat", "woolcoat", "woodpile"),
          thing("shirt", "linenshirt", "woodpile", { wetness: shirt }),
        ],
        [someone("player", "woodpile", { wears: ["coat", "shirt"], wetness })],
        EXTRA,
      );
      return cold(resolve(w, minutes(20)).world, "player");
    };
    expect(rests(2, 2.5)).toBeGreaterThan(rests(0, 0) * 1.3);
  });

  it.fails("winter-07: moving again brings the warmth back (a body makes no heat of its own: it is warmed by a mild place and by a fire's nearness and by nothing it does)", () => {
    const chilled = become(pile, "player", { needs: { warmth: 1 } });
    const there: Act = { process: "move", body: "player", to: [20, 0], minutes: 5 };
    const back: Act = { process: "move", body: "player", to: [0, 0], minutes: 5 };
    const after = play(chilled, [
      there,
      minutes(5),
      back,
      minutes(5),
      there,
      minutes(5),
      back,
      minutes(5),
    ]);
    expect(cold(after.world, "player")).toBeLessThan(1);
  });
});

describe("winter-08: three damp days", () => {
  const rained = world(
    [thing("coat", "woolcoat", "yard")],
    [someone("player", "yard", { wears: ["coat"] })],
    EXTRA,
  );

  it("winter-08: an hour of freezing rain soaks them and chills them", () => {
    const after = resolve(rained, hours(1)).world;
    expect(after.bodies.player?.wetness).toBeGreaterThan(3);
    expect(after.things.coat?.state.wetness).toBeGreaterThan(3);
    expect(cold(after, "player")).toBeGreaterThan(0.5);
  });

  it("winter-08: in cold damp air the clothes never dry through in two days, where in a dry house they would have", () => {
    const hung = world(
      [
        thing("about", "woolcoat", "homestead", { wetness: 4.2 }),
        thing("indoors", "woolcoat", "house", { wetness: 4.2 }),
      ],
      [],
      EXTRA,
    );
    const after = resolve(hung, hours(48)).world;
    expect(after.things.about?.state.wetness).toBeGreaterThan(1);
    expect(after.things.indoors?.state.wetness).toBeLessThan(0.5);
  });

  it.fails("winter-08: three days of chores in damp clothes, with nights in a warm bed, end in a fever (B4 has one way in, which is eating: no exposure sickens, and each mild night takes the day's cold off to nothing, so nothing adds up across days)", () => {
    let w = become(rained, "player", { wetness: 4 });
    const coat = w.things.coat;
    if (coat)
      w = {
        ...w,
        things: { ...w.things, coat: { ...coat, state: { ...coat.state, wetness: 4.2 } } },
      };
    for (let day = 0; day < 3; day++) {
      w = resolve(
        become(goes(w, "player", "homestead"), "player", { attention: "alert" }),
        hours(10),
      ).world;
      w = resolve(
        become(goes(w, "player", "hearth"), "player", { attention: "asleep" }),
        hours(14),
      ).world;
    }
    expect(w.bodies.player?.sickness).toBeGreaterThan(0);
  });

  it.fails("winter-08: rest, warmth and dry bedding bring a fever down over several days (a sickness has an onset and no course: once on a body it stays, whatever the body does and wherever it lies)", () => {
    const abed = world(
      [thing("bedding", "bedroll")],
      [someone("player", "hearth", { sickness: 2, wears: ["bedding"], attention: "asleep" })],
      EXTRA,
    );
    expect(resolve(abed, hours(96)).world.bodies.player?.sickness).toBeLessThan(2);
  });
});

describe("winter-09: water from a frozen well", () => {
  const well = world(
    [
      thing("skin", "iceskin", "wellyard", { temperature: 0 }),
      thing("bucket", "bucket", "wellyard", { temperature: 0 }),
      thing("shaft", "water", "wellyard", { amount: 1000, temperature: 1 }),
      thing("drawn", "water", "wellyard", { amount: 5, temperature: 1 }),
      thing("sleeve", "woolcoat", "wellyard"),
      // The same rope: one wet and frozen on the windlass, one dry in the house.
      thing("line", "rope", "wellyard", { wetness: 2, temperature: 0 }),
      thing("spare", "rope"),
    ],
    [],
    EXTRA,
  );
  const drop = (effort: number): Act => ({
    process: "force",
    instrument: "bucket",
    patient: "skin",
    manner: { effort, care: 2, haste: 2 },
  });
  const slopped = resolve(well, {
    process: "soak",
    liquid: "drawn",
    target: "sleeve",
    amount: 0.3,
  });

  it("winter-09: breaking the ice takes real effort: a knock with the bucket leaves it whole, and hard blows over and over break it, in pieces", () => {
    expect(resolve(well, drop(1)).world.things.skin?.state.integrity).toBe(5);
    const broken = play(
      well,
      Array.from({ length: 6 }, () => drop(4)),
    ).world;
    expect(broken.things.skin?.state.integrity).toBeLessThan(3);
    const pieces = Object.values(broken.things).filter((t) => t.element === "iceskin");
    expect(pieces.length).toBeGreaterThan(1);
  });

  it.fails("winter-09: the rope, wet and frozen, is stiffer than the same rope dry (no rule reads a thing's wetness against its temperature: water in a thing never freezes, and M1 makes what is wet more pliant however cold it is)", () => {
    expect(flexibility(well, "line")).toBeLessThan(flexibility(well, "spare") - 0.5);
  });

  it("winter-09: the slop wets the sleeve, the cold does not dry it on the way back, and the bucket is still mostly full", () => {
    const back = resolve(slopped.world, minutes(10)).world;
    expect(slopped.world.things.sleeve?.state.wetness).toBeGreaterThan(1);
    expect(back.things.sleeve?.state.wetness).toBeGreaterThan(1);
    expect(back.things.drawn?.state.amount).toBeGreaterThan(4.5);
  });

  it.fails("winter-09: the splash freezes onto the wool into a stiff crust (the same: wetness has no phase, so a wet sleeve in freezing air is a wet sleeve and as pliant as ever)", () => {
    const back = resolve(slopped.world, minutes(10)).world;
    expect(flexibility(back, "sleeve")).toBeLessThan(flexibility(well, "sleeve") - 1);
  });

  it("winter-09: by morning the water in the opened well is ice again", () => {
    const shaft = well.things.shaft;
    expect(shaft ? isLiquid(well, shaft) : false).toBe(true);
    const morning = resolve(well, hours(12)).world;
    const then = morning.things.shaft;
    expect(then ? isLiquid(morning, then) : true).toBe(false);
  });
});

describe("winter-10: ice under the snow", () => {
  const path = world(
    [
      thing("glaze", "icesheet", "icypath", { temperature: 0 }),
      thing("sack", "feedsack", "icypath"),
      thing("sackhome", "feedsack"),
    ],
    [someone("player", "icypath", { where: [0, 0] })],
    EXTRA,
  );
  const fell = resolve(path, {
    process: "force",
    instrument: "glaze",
    patient: "player",
    manner: { effort: 3, care: 0, haste: 4 },
  }).world;
  const carries = (w: MatterWorld, sack: string) => {
    const b = w.bodies.player;
    return b ? canTake(w, b, sack) : false;
  };

  it.fails("winter-10: carrying the sack across the glazed path, a foot goes and they come down hard (move in living.ts reads speed and nothing else: not the footing, not P14, not what is carried; nothing falls but what a failed load was holding)", () => {
    const across = play(path, [
      { process: "take", body: "player", thing: "sack" },
      { process: "move", body: "player", to: [30, 0], minutes: 2 },
    ]).world;
    expect(across.bodies.player?.holds).toContain("sack");
    expect(across.bodies.player?.wounds.length).toBeGreaterThan(0);
  });

  it("winter-10: coming down hard on ice is a real injury", () => {
    expect(deepest(fell, "player")).toBeGreaterThan(0.5);
  });

  it.fails("winter-10: it is a twisted ankle, which swells and does not bleed (a wound is a depth, a bleeding and a burn: B3's swollen is absent, every blunt hurt bleeds at three tenths of its depth, and no hurt has a site)", () => {
    expect(deepest(fell, "player")).toBeGreaterThan(0.5);
    expect(fell.bodies.player?.wounds[0]?.bleeding).toBe(0);
  });

  it("winter-10: carrying and fast walking are out of reach, that day and the next", () => {
    expect(carries(path, "sack")).toBe(true);
    expect(carries(fell, "sack")).toBe(false);
    expect(can(fell, "player")?.speed).toBeLessThan(can(path, "player")?.speed ?? 0);
    const rested = become(goes(fell, "player", "hearth"), "player", { attention: "asleep" });
    const next = resolve(rested, hours(24)).world;
    expect(carries(next, "sackhome")).toBe(false);
    expect(can(next, "player")?.speed).toBeLessThan(can(path, "player")?.speed ?? 0);
  });
});

describe("winter-12: the goat in the house", () => {
  const room = (withGoat: boolean) =>
    lit(
      world(
        [
          at(thing("fire", "firewood", "nighthouse", { amount: 8 }), [0, 0]),
          at(thing("hay", "hay", "nighthouse", { amount: 5 }), [7, 1]),
          at(thing("floor", "floor", "nighthouse"), [4, 0]),
        ],
        [
          someone("player", "nighthouse", { where: [4, 0] }),
          ...(withGoat
            ? [
                body("goat", {
                  element: "goat",
                  place: "nighthouse",
                  where: [5, 0],
                  needs: { hunger: 3, rest: 1, warmth: 0 },
                }),
              ]
            : []),
        ],
        EXTRA,
      ),
      "fire",
    );

  it.fails("winter-12: a second warm body in the small room eases the cold for the people in it (a body gives off no heat: only what burns warms anyone, and no place is warmed by what is in it)", () => {
    const shared = cold(resolve(room(true), hours(8)).world, "player");
    const alone = cold(resolve(room(false), hours(8)).world, "player");
    expect(shared).toBeLessThan(alone);
  });

  it("winter-12: a night in the freezing barn tells on the goat, and a night in the house does not", () => {
    const inBarn = world(
      [],
      [body("goat", { element: "goat", place: "barn", needs: { hunger: 1, warmth: 0 } })],
      EXTRA,
    );
    expect(resolve(inBarn, hours(12)).world.bodies.goat?.health).toBeLessThan(5);
    expect(resolve(room(true), hours(12)).world.bodies.goat?.health).toBe(5);
  });

  it("winter-12: left loose and hungry it finds the stored hay and eats into it", () => {
    let w = resolve(room(true), minutes(0)).world;
    for (let i = 0; i < 12; i++) {
      const goat = w.bodies.goat;
      const choice = goat ? routine(w, goat) : undefined;
      if (!choice?.act) break;
      w = resolve(w, choice.act).world;
    }
    expect(w.things.hay?.state.amount ?? 0).toBeLessThan(5);
    expect(w.bodies.goat?.needs.hunger).toBeLessThan(3);
  });

  it.fails("winter-12: by morning it has fouled the floor (a body gives nothing off and leaves nothing behind: what is eaten is consumed and that is the end of it)", () => {
    const before = room(true);
    const morning = resolve(before, hours(10)).world;
    const floor = morning.things.floor?.state;
    const more = Object.keys(morning.things).length > Object.keys(before.things).length;
    expect(more || (floor?.coating ?? null) !== null || (floor?.contamination ?? 0) > 0).toBe(true);
  });
});

describe("winter-13: a child out too long", () => {
  const out = world(
    [thing("small", "woolcoat", "snowyard"), thing("big", "woolcoat", "snowyard")],
    [
      body("child", {
        element: "child",
        place: "snowyard",
        wears: ["small"],
        attention: "distracted",
        needs: { hunger: 1, rest: 1, warmth: 0 },
      }),
      someone("adult", "snowyard", { wears: ["big"] }),
    ],
    EXTRA,
  );
  const later = resolve(out, hours(2)).world;

  it.fails("winter-13: the child loses heat faster than a grown person in the same cold and the same coat (weathered in living.ts never reads the body's row: neither mass nor size enters the rate)", () => {
    expect(cold(later, "child")).toBeGreaterThan(cold(later, "adult") + 0.1);
  });

  it.fails("winter-13: after two hours in the snow the child comes in shivering hard (the rate is the grown person's, and in a wool coat that is half a level in two hours)", () => {
    expect(cold(later, "child")).toBeGreaterThanOrEqual(1);
  });

  it("winter-13: brought in by the fire the shivering eases over an hour or two, and not at once", () => {
    const inside = lit(
      world(
        [thing("fire", "firewood", "house", { amount: 6 })],
        [body("child", { element: "child", place: "house", needs: { hunger: 1, warmth: 2 } })],
        EXTRA,
      ),
      "fire",
    );
    expect(cold(resolve(inside, minutes(10)).world, "child")).toBeGreaterThan(1.5);
    expect(cold(resolve(inside, hours(3)).world, "child")).toBeLessThan(0.5);
  });
});

describe("winter-14: the ox and the hide coat", () => {
  const yard = (wears: string[]) =>
    world(
      [
        thing("rail", "rail", "barnyard"),
        thing("thick", "hidecoat", "barnyard"),
        thing("thin", "thinhide", "barnyard"),
        thing("shirt", "linenshirt", "barnyard"),
      ],
      [
        someone("player", "barnyard", { wears }),
        body("ox", { element: "ox", place: "barnyard", needs: { hunger: 1 } }),
      ],
      EXTRA,
    );
  // The ox's weight puts the player into the rail: what strikes them is the rail.
  const knocked = (wears: string[]) =>
    resolve(yard(wears), {
      process: "force",
      by: "ox",
      instrument: "rail",
      patient: "player",
      manner: { effort: 4, care: 0, haste: 4 },
    }).world;

  it("winter-14: the thick hide coat takes most of the blow: a hurt, and well under half of what the same blow does bare", () => {
    expect(deepest(knocked([]), "player")).toBeGreaterThan(2);
    expect(deepest(knocked(["thick"]), "player")).toBeGreaterThan(0.3);
    expect(deepest(knocked(["thick"]), "player")).toBeLessThan(deepest(knocked([]), "player") / 2);
  });

  it("winter-14: a linen shirt in its place would have done nothing", () => {
    expect(deepest(knocked(["shirt"]), "player")).toBeGreaterThan(2);
  });

  it.fails("winter-14: it is the thickness that spreads the blow: the same leather scraped thin would not have saved the rib (a sheet has no thickness: a blow in force.ts meets toughness and size, so a thin jerkin of the same leather turns it just as well)", () => {
    expect(deepest(knocked(["thin"]), "player")).toBeGreaterThan(
      deepest(knocked(["thick"]), "player") + 0.3,
    );
  });

  it("winter-14: the coat is intact afterwards", () => {
    expect(knocked(["thick"]).things.thick?.state.integrity).toBeGreaterThan(3);
  });

  it.fails("winter-14: what is left is a bruise, which does not bleed (a wound is a depth, a bleeding and a burn: every blunt hurt bleeds at three tenths of its depth, turned by a coat or not)", () => {
    const hurt = knocked(["thick"]).bodies.player?.wounds[0];
    expect(hurt?.depth).toBeGreaterThan(0.3);
    expect(hurt?.bleeding).toBe(0);
  });

  it("winter-14: sore and moving carefully, the next day too", () => {
    const after = knocked(["thick"]);
    expect(can(after, "player")?.speed).toBeLessThan(can(yard(["thick"]), "player")?.speed ?? 0);
    const rested = become(goes(after, "player", "hearth"), "player", { attention: "asleep" });
    const next = resolve(rested, hours(24)).world;
    expect(can(next, "player")?.speed).toBeLessThan(can(yard(["thick"]), "player")?.speed ?? 0);
  });
});

describe("winter-15: frozen fingers and the fire", () => {
  const hearthside = lit(
    world(
      [
        thing("fire", "firewood", "nighthouse", { amount: 6 }),
        thing("basin", "water", "nighthouse", { amount: 3, temperature: 3 }),
      ],
      [someone("player", "nighthouse", { needs: { warmth: 3 } })],
      EXTRA,
    ),
    "fire",
  );
  const held = (instrument: string): Act => ({
    process: "force",
    instrument,
    patient: "player",
    manner: { effort: 0, care: 0, haste: 5 },
    seconds: 10,
  });

  it.fails("winter-15: hours along the snares in that cold leave a lasting hurt on the body (cold tells on health only once the warmth need passes 4, which six hours in a wool coat does not reach, and never on a part: there are no fingers to freeze)", () => {
    const line = world(
      [thing("coat", "woolcoat", "trapline")],
      [someone("player", "trapline", { wears: ["coat"] })],
      EXTRA,
    );
    const after = resolve(line, hours(6)).world.bodies.player;
    expect((after?.health ?? 5) < 5 || (after?.wounds.length ?? 0) > 0).toBe(true);
  });

  it("winter-15: shoved right up to the flame the fingers blister, where the basin of warm water does them no harm", () => {
    const rushed = resolve(hearthside, held("fire")).world;
    expect(rushed.bodies.player?.wounds.some((x) => x.burned > 0)).toBe(true);
    expect(resolve(hearthside, held("basin")).world.bodies.player?.wounds.length).toBe(0);
  });

  it.fails("winter-15: the warm water is what would have warmed them safely (heat passes between things only: a body is warmed by a mild place and by a fire's nearness, and warm water does nothing for it)", () => {
    const bathed: Act = { process: "heat", source: "basin", target: "player", minutes: 20 };
    // Across the room from the fire, so that the fire is not what does it.
    const far = become(hearthside, "player", { where: [30, 0] });
    const lone = { ...far, things: { ...far.things } };
    const fire = lone.things.fire;
    if (fire) lone.things.fire = { ...fire, where: [0, 0] };
    const dipped = cold(play(lone, [bathed, minutes(20)]).world, "player");
    const undipped = cold(resolve(lone, minutes(20)).world, "player");
    expect(dipped).toBeLessThan(undipped);
  });
});
