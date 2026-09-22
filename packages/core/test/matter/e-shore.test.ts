/**
 * Batch E (held out), the shore scenarios, run through the matter engine with the rules
 * frozen. Each test asserts what the scenario says a sensible person expects. `it.fails` marks
 * an outcome the rules do not produce, with the reason in brackets; a name that starts
 * `RULE ERROR:` marks one the rules get wrong. Rows are in `rows-e-shore.ts`, written before
 * anything ran.
 *
 * Unbuilt, so no test: shore-01 (a boat floated off by a spring tide: a water level that climbs
 * on its own calendar, a thing lifted when the water reaches it, and wind and ebb carrying it
 * away: a place's level, P11 and R7 are all absent, and nothing else happens in it), shore-09
 * (shipworm eating planks from inside over a summer: no creature lives in a thing or feeds on
 * one, no drift reads what has settled on a thing, and nothing makes S15), shore-13 (fresh water
 * lying over salt under dune sand: no hole is dug in a place, and a place has no depths for a
 * hole to reach).
 *
 * A shore here is a damp windy place with a body of seawater to wet things with: the tide does
 * not rise or fall (no drift touches a place), nothing floats (P11 is read by no rule), nothing
 * is under, in or fastened to anything (R2, R4 and R5 are absent), and time plays no creature's
 * routine. Where a scenario says the tide floats a boat, the test asks the only bearing the
 * engine has, a load on the sea, and says so. Grit inside a cockle is given the nearest state
 * there is, a coat of sand. A pot set on a hard fire is in the flame: contact 1. Parts of
 * outcomes with no act to play and no state to read are not asserted at all: the taste and
 * colour of the salt and the scale baked on the pot (shore-04), gulls tearing and fouling what
 * they do not carry off (shore-05), holes that fill with water (shore-06), salt colouring the
 * flame (shore-07), rot uneven through one net, and mending it (shore-08), how long a limpet
 * stays clamped, and stewing it tender (shore-10), the oar cracking as a lever and the anchor
 * bedded down the beach (shore-11), the tang splitting the handle (shore-12), the abandoned
 * net lifted by the tide (shore-15).
 *
 * Changed after the first run, and why: one encoding, and no row, threshold or place. Every
 * `it` and every `it.fails` was decided from reading the engine before anything ran. On the
 * first run every `it.fails` failed as expected and one `it` failed: "kept the night and cooked
 * next day, they are good eating" asked for the player's hunger to end under 1, forgetting that
 * sixteen hours of waiting make the player hungrier before the meal. That was the encoding's
 * mistake, not the engine's: the test now asks that the meal take hunger down from what it was
 * that morning, and it passes. The engine's numbers were then printed to check that each
 * expected failure fails for the reason its name gives (thirty-four cockles in an hour's
 * raking; cockles at contamination 2 after the night and 5 after two days, 0 once cooked; an
 * armful of sticks alight for 45 minutes; the soaked log alight after 30 minutes on the fire
 * and at wetness 1.3 after a day up the beach; both nets at contamination 5 after the week,
 * the spread one held at wetness 1.6, the rotten one at 3.39 of strength against 3.50; the
 * saw's first stroke taking 0.04 off the rib and 0.24 off its own edge; the same rust, 1.15 in
 * three days, by the sea and inland). Three reasons in test names were corrected to the
 * printed numbers, with no assertion changed: the gull makes off at the third stone, not the
 * fourth or fifth; the rotted net keeps all but a thirtieth of its strength, not nineteen parts
 * in twenty; the saw's first stroke takes under a twentieth of a level.
 */
import { describe, expect, it } from "vitest";
import {
  type Act,
  able,
  alight,
  blaze,
  canTake,
  effective,
  type Manner,
  type MatterWorld,
  play,
  resolve,
  routine,
  searchYield,
  strength,
  type Thing,
} from "../../src/matter/index.ts";
import { body, thing, world } from "./elements.ts";
import { EXTRA } from "./rows-e-shore.ts";

const minutes = (n: number): Act => ({ process: "drift", minutes: n });
const hours = (n: number): Act => minutes(n * 60);
const days = (n: number): Act => hours(n * 24);

/** Sets fuel burning in a world that is already built. */
function lit(w: MatterWorld, id: string): MatterWorld {
  const fuel = w.things[id];
  return fuel ? { ...w, things: { ...w.things, [id]: alight(w, fuel) } } : w;
}

const at = (t: Thing, where: readonly [number, number]): Thing => ({ ...t, where });

/** The sea, to wet things with. */
const sea = (place: string) => thing("sea", "seawater", place, { amount: 100000 });

const wets = (liquid: string, target: string, amount: number): Act => ({
  process: "soak",
  liquid,
  target,
  amount,
});

/** In the flame, or in a pot set on it. */
const heats = (source: string, target: string, n: number): Act => ({
  process: "heat",
  source,
  target,
  minutes: n,
  contact: 1,
});

const strikes = (instrument: string, patient: string, manner: Manner, by?: string): Act => ({
  process: "force",
  instrument,
  patient,
  manner,
  ...(by ? { by } : {}),
});

const times = (n: number, act: Act): Act[] => Array.from({ length: n }, () => act);

/** A minute in which everybody takes in what is around them. */
const noticed = (w: MatterWorld): MatterWorld => resolve(w, minutes(1)).world;

/** The body does what it would do with nobody watching, once. */
function acts(w: MatterWorld, id: string): MatterWorld {
  const who = w.bodies[id];
  const act = who ? routine(w, who).act : undefined;
  return act ? resolve(w, act).world : w;
}

const gap = (a: readonly [number, number] | undefined, b: readonly [number, number]) =>
  Math.hypot((a?.[0] ?? 0) - b[0], (a?.[1] ?? 0) - b[1]);

/** Whether a thing is somewhere other than where it was. */
function strayed(before: MatterWorld, after: MatterWorld, id: string): boolean {
  const [was, now] = [before.things[id], after.things[id]];
  if (!(was && now)) return false;
  return now.place !== was.place || gap(now.where, was.where ?? [0, 0]) > 0;
}

/**
 * Whether the sea bears it up. The engine has no floating: the nearest it has is a load, with
 * the water as what bears it.
 */
function borne(w: MatterWorld, ids: string[]): boolean {
  const after = resolve(w, { process: "load", support: "sea", bearing: ids }).world;
  return after.things.sea?.state.integrity === 5;
}

const rakes = (place: string, n: number) =>
  searchYield(world([], [], EXTRA), {
    process: "search",
    place,
    element: "cockle",
    minutes: n,
    draw: 0,
  });

describe("shore-02: cockles raked, cooked at once, or kept a night in seawater", () => {
  const shore = world(
    [
      thing("fire", "driftsticks", "foreshore", { amount: 3 }),
      thing("catch", "cockle", "foreshore", { amount: 30 }),
      thing("bucket", "seawater", "foreshore", { amount: 2 }),
      thing("grit", "sand", "foreshore", { amount: 0.2 }),
    ],
    [body("player", { place: "foreshore", element: "person" })],
    EXTRA,
  );
  const eat: Act = { process: "ingest", body: "player", thing: "catch", amount: 30 };
  const cookedAndEaten = (w: MatterWorld) =>
    play(lit(w, "fire"), [heats("fire", "catch", 30), eat]).world.bodies.player;
  const keptFor = (n: number) => play(shore, [wets("bucket", "catch", 1), hours(n)]).world;

  it("shore-02: on the bed the rake comes up full, and a few paces off it comes up almost empty", () => {
    expect(rakes("offbed", 60)).toBeLessThan(1);
    expect(rakes("cocklebed", 60)).toBeGreaterThan(rakes("offbed", 60) * 20);
  });

  it.fails("shore-02: an hour's raking on the bed fills the basket (search comes on things one at a time and takes no instrument: the richest ground gives some thirty in an hour, and a rake that gathers by the hundred is nothing to it)", () => {
    expect(rakes("cocklebed", 60)).toBeGreaterThan(200);
  });

  it("shore-02: cooked at once they are good food", () => {
    const fed = cookedAndEaten(shore);
    expect(fed?.needs.hunger ?? 9).toBeLessThan(1);
    expect(fed?.sickness).toBe(0);
  });

  it.fails("shore-02: the grit is inside them: a rinse does not shift it, and a night alive in clean seawater does (nothing is inside a creature, S8 being absent, and nothing a thing does of itself is a drift: the nearest state is a coat of sand, which the first wetting lifts)", () => {
    const gritty = resolve(shore, { process: "coat", substance: "grit", target: "catch" }).world;
    expect(gritty.things.catch?.state.coating?.element).toBe("sand");
    const rinsed = resolve(gritty, wets("bucket", "catch", 0.1)).world;
    expect(rinsed.things.catch?.state.coating).not.toBeNull();
    const purged = play(gritty, [wets("bucket", "catch", 1), hours(16)]).world;
    expect(purged.things.catch?.state.coating).toBeNull();
  });

  it("shore-02: kept the night in a bucket of clean seawater and cooked next day, they are good eating", () => {
    const morning = keptFor(16);
    const fed = cookedAndEaten(morning);
    // The night has made the player hungrier: the meal is what it takes off that.
    expect(fed?.needs.hunger ?? 9).toBeLessThan((morning.bodies.player?.needs.hunger ?? 0) - 2);
    expect(fed?.sickness).toBe(0);
  });

  it.fails("RULE ERROR: shore-02: alive in cool clean seawater, they have not begun to spoil by morning (no thing is alive: rot in drift-rules.ts reads perishability, warmth and damp, so a live cockle in water goes off in a night as dead meat does)", () => {
    expect(keptFor(16).things.catch?.state.contamination ?? 9).toBeLessThan(1);
  });

  it.fails("shore-02: left a second day, they foul the still water they lie in (nothing is in anything: what rots in a bucket does not reach the water, and water has nothing in it to go bad)", () => {
    expect(keptFor(48).things.bucket?.state.contamination ?? 0).toBeGreaterThan(1);
  });

  it.fails("RULE ERROR: shore-02: dead and gone bad by the second day, cooked among the rest they make a person very ill (heat at 4.5 sets contamination to nothing in heat-rules.ts, and rot leaves no taint behind it: boiling makes anything wholesome)", () => {
    expect(cookedAndEaten(keptFor(48))?.sickness ?? 0).toBeGreaterThan(1);
  });
});

describe("shore-03: cut off by the tide", () => {
  const point = world(
    [],
    [body("player", { place: "ledges", element: "person", where: [0, 0] })],
    EXTRA,
  );
  const round: Act = { process: "move", body: "player", to: [100, 0], minutes: 15 };
  const back: Act = { process: "move", body: "player", to: [0, 0], minutes: 15 };
  const cove = world(
    [thing("hold", "shalehold", "cove")],
    [body("player", { place: "cove", element: "person", needs: { hunger: 1 } })],
    EXTRA,
  );

  it("shore-03: at low water the player walks round the point to the cove in a quarter of an hour", () => {
    const there = resolve(point, round).world;
    expect(gap(there.bodies.player?.where, [100, 0])).toBeLessThan(1.5);
  });

  it.fails("shore-03: two hours later the ledges are under surging water and the way back is shut (no drift touches a place: there is no water level to rise over ground of any height, E13 being absent, and a move is only a going that nothing bars)", () => {
    const later = play(point, [round, hours(2)]).world;
    expect(later.places.ledges).not.toEqual(point.places.ledges);
    const tried = resolve(later, back).world;
    expect(gap(tried.bodies.player?.where, [0, 0])).toBeGreaterThan(50);
  });

  it("shore-03: the rotten cliff will not go: a hold pulls out under the player's weight, and they come down hurt", () => {
    const { world: after, changes } = resolve(cove, {
      process: "load",
      support: "hold",
      bearing: ["player"],
    });
    expect(after.things.hold?.state.integrity).toBeLessThanOrEqual(1);
    expect(changes.some((c) => c.kind === "wound")).toBe(true);
  });

  it("shore-03: the wait into the dark for the next low water is a cold and hungry one", () => {
    const after = resolve(cove, hours(6.5)).world;
    expect(after.bodies.player?.needs.warmth ?? 0).toBeGreaterThan(2);
    expect(after.bodies.player?.needs.hunger ?? 0).toBeGreaterThan(1.5);
  });
});

describe("shore-04: boiling seawater down for salt", () => {
  const camp = world(
    [
      thing("fire", "driftsticks", "beachcamp", { amount: 12 }),
      thing("brine", "seawater", "beachcamp", { amount: 2 }),
      thing("pot", "ironpot", "beachcamp"),
      thing("fat", "grease", "beachcamp"),
    ],
    [],
    EXTRA,
  );
  const boiled = (n: number) => resolve(lit(camp, "fire"), heats("fire", "brine", n)).world;

  it("shore-04: set on a hard driftwood fire, the two gallons come to the boil", () => {
    expect(boiled(30).things.brine?.state.temperature).toBeGreaterThanOrEqual(4.5);
  });

  it.fails("shore-04: kept boiling for hours, the water leaves as steam and the pot boils down (heat warms a target and dries what is wet: the amount of a liquid never falls, X7's evaporate being absent)", () => {
    expect(boiled(240).things.brine?.state.amount ?? 9).toBeLessThan(1);
  });

  it.fails("shore-04: and what was dissolved in it is left behind, a little salt for all that sea (a liquid carries contamination and taint and nothing dissolved: no mixture, no solute, so no salt comes out of any sea)", () => {
    const left = Object.values(boiled(240).things).filter((t) => t.element === "salt");
    expect(left.length).toBeGreaterThan(0);
  });

  it.fails("shore-04: the fire eats an armful of driftwood every quarter of an hour (fuel in heat.ts is bulk over flammability: an armful of dry sticks lasts three quarters of an hour; the direction is right and the count is three times too long)", () => {
    const one = lit(world([thing("armful", "driftsticks", "beachcamp")], [], EXTRA), "armful");
    const later = resolve(one, minutes(25)).world;
    expect(later.things.armful?.state.burning ?? null).toBeNull();
  });

  it("shore-04: left salt-wet in the damp the iron pot shows rust by morning, and scoured and greased it does not", () => {
    const bare = play(camp, [wets("brine", "pot", 1), hours(12)]).world;
    const grease: Act = {
      process: "coat",
      substance: "fat",
      target: "pot",
      amount: 0.3,
      manner: { effort: 2, care: 4, haste: 2 },
    };
    const greased = play(camp, [grease, hours(12)]).world;
    const rust = bare.things.pot?.state.corrosion ?? 0;
    expect(rust).toBeGreaterThan(0.1);
    expect(greased.things.pot?.state.corrosion ?? 9).toBeLessThan(rust / 3);
  });
});

describe("shore-05: gulls at an unwatched basket of herring", () => {
  const wary = { fear: 2, anger: 0, trust: 0 };
  const gull = (id: string, where: readonly [number, number]) =>
    body(id, {
      place: "strand",
      element: "gull",
      where,
      needs: { hunger: 3 },
      feels: { fisherman: wary, boy: wary },
    });
  const fisherman = (where: readonly [number, number], set = {}) =>
    body("fisherman", { place: "strand", element: "person", where, ...set });
  const basket = at(thing("basket", "herring", "strand", { amount: 40 }), [0, 0]);
  const back = fisherman([0, 20], { attention: "distracted" });
  const strandOf = (things: Thing[], bodies = [gull("gull", [-10, 0]), back]) =>
    noticed(world([basket, ...things], bodies, EXTRA));

  it("shore-05: with the fisherman's back turned, a hungry gull comes in to the open basket and takes a herring", () => {
    const after = acts(acts(strandOf([]), "gull"), "gull");
    expect(after.things.basket?.state.amount).toBe(39);
    expect(after.bodies.gull?.needs.hunger ?? 9).toBeLessThan(1);
  });

  it.fails("RULE ERROR: shore-05: with the wet sacking over the basket, the gulls do not see the fish (sense.ts hides a thing only by the place's cover, which hides everything there alike: R5, what covers what, is absent, so the gull sees the herring through the sacking)", () => {
    const covered = strandOf([at(thing("sacking", "cloth", "strand", { wetness: 3 }), [0, 0])]);
    expect(covered.bodies.gull?.aware?.basket).toBeUndefined();
  });

  it.fails("shore-05: a boy set beside the basket keeps the gulls off it (a person a pace from the food menaces a wary gull by a level or so, which a herring outweighs three times over; and who is looking where is read by nothing, so the turned back counted for nothing either)", () => {
    const boy = body("boy", { place: "strand", element: "person", where: [1, 0] });
    const watched = strandOf([], [gull("gull", [-10, 0]), back, boy]);
    const bird = watched.bodies.gull;
    expect(bird ? routine(watched, bird).toward : "").not.toBe("basket");
  });

  it.fails("shore-05: its cries and the flash of fish bring in the gulls that had not seen the basket (eating makes no signal, and what one body is seen to be doing tells another nothing: a far gull goes on looking where it was)", () => {
    const two = strandOf([], [gull("gull", [-10, 0]), gull("far", [300, 0]), back]);
    const after = acts(acts(two, "gull"), "gull");
    const far = after.bodies.far;
    expect(["basket", "gull"]).toContain(far ? routine(after, far).toward : "");
  });

  it.fails("shore-05: a stone thrown at it sends a gull off the basket (to be struck at is a deed and moves fear by under a level: against a hunger of 3 with the fish at its feet, the first stone leaves eating ahead of making off, the second leaves them level, and only the third sends it off)", () => {
    const near = fisherman([0, 5], { holds: ["pebble"] });
    const there = strandOf([thing("pebble", "pebble", "strand")], [gull("gull", [-1, 0]), near]);
    const thrown = strikes("pebble", "gull", { effort: 3, care: 2, haste: 4 }, "fisherman");
    const after = resolve(there, thrown).world;
    const bird = after.bodies.gull;
    expect(bird ? routine(after, bird).intent : "").toBe("keep_away");
  });
});

describe("shore-06: a gale strips the beach down to an old wreck", () => {
  const beach = (place: string) =>
    world(
      [
        thing("rib", "wreckrib", place),
        thing("anchor", "anchor", place),
        thing("saw", "saw", place, { edge: 3 }),
        sea(place),
      ],
      [body("villager", { place, element: "person", where: [0, 0] })],
      EXTRA,
    );

  it.fails("RULE ERROR: shore-06: before the gale the wreck lies under the sand, and nobody walking the beach sees it (nothing lies at a depth in the ground: sense.ts hides a thing only by the place's cover, so the villager sees the buried ribs as plainly as the dunes)", () => {
    const calm = noticed(beach("wreckbeach"));
    expect(calm.bodies.villager?.aware?.rib).toBeUndefined();
  });

  it.fails("shore-06: three days of gale drag the sand off and drop the beach by a man's height, and weeks of gentle swell bring it back (no drift touches a place: E13 is absent, and a place has no level for waves to lower or raise)", () => {
    const after = resolve(beach("galebeach"), days(3)).world;
    expect(after.places.galebeach).not.toEqual(beach("galebeach").places.galebeach);
  });

  it("shore-06: the anchor is not to be shifted by hand", () => {
    const shore = beach("wreckbeach");
    const villager = shore.bodies.villager;
    expect(villager ? canTake(shore, villager, "anchor") : true).toBe(false);
    const tried = resolve(shore, { process: "take", body: "villager", thing: "anchor" }).world;
    expect(tried.bodies.villager?.holds ?? []).not.toContain("anchor");
  });

  it.fails("shore-06: in a tide's work a saw takes the top off a sodden rib (a saw is an edge like a knife's: its first stroke takes under a twentieth of a level off the rib and a quarter of a level off its own keenness, and it is blunt before the oak is scarred; no tool works by many small teeth over hours)", () => {
    const sodden = resolve(beach("wreckbeach"), wets("sea", "rib", 5)).world;
    const stroke = strikes("saw", "rib", { effort: 3, care: 3, haste: 2 });
    const sawn = play(sodden, times(40, stroke)).world;
    expect(sawn.things.rib?.state.integrity ?? 9).toBeLessThanOrEqual(1);
  });
});

describe("shore-07: a driftwood fire on a windy strand", () => {
  const strand = world(
    [
      thing("flame", "tinder", "duskstrand"),
      thing("sticks", "driftsticks", "duskstrand"),
      thing("log", "driftlog", "duskstrand"),
      thing("fire", "driftsticks", "duskstrand", { amount: 5 }),
      at(thing("cloak", "woolcloak", "duskstrand"), [2, 0]),
      sea("duskstrand"),
    ],
    [],
    EXTRA,
  );
  const soaked = resolve(strand, wets("sea", "log", 5)).world;
  const onTheFire = (n: number) => resolve(lit(soaked, "fire"), heats("fire", "log", n)).world;

  it("shore-07: the bleached dry sticks catch quickly from the tinder", () => {
    const after = resolve(lit(strand, "flame"), heats("flame", "sticks", 2)).world;
    expect(after.things.sticks?.state.burning).not.toBeNull();
  });

  it("shore-07: the sea-soaked log put on the fire does not take light as the sticks did", () => {
    expect(onTheFire(10).things.log?.state.burning).toBeNull();
  });

  it.fails("RULE ERROR: shore-07: nor will it burn tonight: after an hour on a well-fed fire it is scorched and steaming and still unlit (heat-rules.ts dries by warmth alone, a twentieth of a level a minute whatever the bulk, down to what the air keeps in it: a soaked trunk is dry enough to light within the hour)", () => {
    expect(onTheFire(60).things.log?.state.burning).toBeNull();
  });

  it.fails("shore-07: and it half smothers the small fire it is put on (a source that burns pays only in minutes of fuel: nothing wet laid on a fire takes from it, and dousing is a liquid's)", () => {
    const before = lit(soaked, "fire");
    const after = onTheFire(10);
    const [was, now] = [before.things.fire, after.things.fire];
    expect(now ? blaze(after, now) : 9).toBeLessThan((was ? blaze(before, was) : 0) - 0.3);
  });

  it("shore-07: the small stuff burns fast: an armful is gone in a fraction of the time a dry log lasts", () => {
    const [sticks, log] = [strand.things.sticks, strand.things.log];
    const lasts = (t: Thing | undefined) => (t ? alight(strand, t).state.burning?.fuel : 0) ?? 0;
    expect(lasts(sticks)).toBeGreaterThan(0);
    expect(lasts(sticks)).toBeLessThan(lasts(log) / 3);
  });

  it.fails("shore-07: in the wind it throws sparks that pinhole the cloak lying downwind (a fire gives light, smoke and warmth: it throws nothing, fire does not spread by itself, and wind has a strength and no direction to carry anything in)", () => {
    const after = resolve(lit(strand, "fire"), hours(1)).world;
    const cloak = after.things.cloak?.state;
    expect((cloak?.integrity ?? 5) < 5 || (cloak?.burning ?? null) !== null).toBe(true);
  });
});

describe("shore-07: wet wood and dry, and the wind on the pot", () => {
  const potOver = (place: string) => {
    const w = world(
      [
        thing("fire", "driftsticks", place, { amount: 5 }),
        thing("potwater", "water", place, { amount: 2 }),
      ],
      [],
      EXTRA,
    );
    return resolve(lit(w, "fire"), heats("fire", "potwater", 20)).world.things.potwater?.state;
  };
  /** A log as it is after lying somewhere, brought to a flame and held in it. */
  const takesLight = (state: Thing["state"] | undefined) => {
    const w = world(
      [thing("flame", "tinder", "duskstrand"), thing("log", "driftlog", "duskstrand", state ?? {})],
      [],
      EXTRA,
    );
    const after = resolve(lit(w, "flame"), heats("flame", "log", 3)).world;
    return (after.things.log?.state.burning ?? null) !== null;
  };
  const lain = (place: string, act: Act, set: Partial<Thing["state"]> = {}) =>
    resolve(world([thing("log", "driftlog", place, set)], [], EXTRA), act).world.things.log?.state;

  it.fails("shore-07: unsheltered, most of its heat blows away and the pot is far slower to boil than in a scrape behind stones (heat-rules.ts reads contact, conductivity and mass: wind is read by nothing in heat)", () => {
    const [windy, sheltered] = [potOver("duskstrand"), potOver("scrape")];
    expect(windy?.temperature ?? 9).toBeLessThan((sheltered?.temperature ?? 0) - 0.2);
  });

  it("shore-07: the same wood burns or will not by where it has lain: a week at the tide line leaves it soaked and dead to a flame, a week at the top of the beach leaves it dry and ready", () => {
    const [low, high] = [lain("tideline", days(7)), lain("beachtop", days(7))];
    expect((low?.wetness ?? 0) - (high?.wetness ?? 9)).toBeGreaterThan(2);
    expect(takesLight(low)).toBe(false);
    expect(takesLight(high)).toBe(true);
  });

  it.fails("shore-07: a soaked log needs weeks above the tides: a day up there does not make it fuel (drying in drift-rules.ts takes the film off in six hours and a third of a level a day after: a day on, a sea-soaked trunk lights from tinder in a minute; the direction is right and the count is weeks too short)", () => {
    const wet = lain("tideline", days(7));
    expect(takesLight(lain("beachtop", days(28), wet))).toBe(true);
    expect(takesLight(lain("beachtop", days(1), wet))).toBe(false);
  });
});

describe("shore-08: a wet net left in a heap", () => {
  const left = (place: string) =>
    resolve(world([thing("net", "hempnet", place), sea(place)], [], EXTRA), wets("sea", "net", 5))
      .world;
  const heaped = left("netheap");
  const week = resolve(heaped, days(7)).world;

  it("shore-08: heaped wet in the warm, within the week the hemp is rotten and stinks", () => {
    const net = week.things.net;
    expect(net?.state.contamination ?? 0).toBeGreaterThan(3);
    expect(net ? effective(week, net).scent : 0).toBeGreaterThan(2);
  });

  it.fails("RULE ERROR: shore-08: spread on the poles in the wind it dries, and keeps (drift-rules.ts keeps whatever drinks at 1.6 of wetness in damp air for ever, and rot reads that as damp enough: in muggy weather nothing dries on a pole, and the spread net rots as the heap does)", () => {
    const spread = resolve(left("poles"), days(7)).world;
    expect(spread.things.net?.state.contamination ?? 9).toBeLessThan(1);
  });

  it.fails("shore-08: the rotting heap heats a little (contamination makes no heat: temperature in drift-rules.ts settles toward the place and reads nothing that lives in the thing)", () => {
    expect(week.things.net?.state.temperature ?? 0).toBeGreaterThan(3.2);
  });

  it.fails("shore-08: and the rotted net tears under a heavy catch that a sound wet net would hold (rot-weakens in grown.ts takes seven hundredths of a level of integrity a day from hemp once the rot is far gone: after the week the net has all but a thirtieth of its strength; the direction is right and the count is far too small)", () => {
    const [sound, rotten] = [heaped.things.net, week.things.net];
    expect(rotten ? strength(week, rotten) : 9).toBeLessThan(
      (sound ? strength(heaped, sound) : 0) * 0.7,
    );
  });
});

describe("shore-10: limpets", () => {
  const rock = world(
    [
      thing("touched", "limpet", "rocks"),
      thing("fresh", "limpet", "rocks"),
      thing("knife", "blade", "rocks", { edge: 4 }),
      thing("heel", "bootheel", "rocks"),
    ],
    [body("player", { place: "rocks", element: "person", where: [0, 0] })],
    EXTRA,
  );
  const pry = strikes("knife", "touched", { effort: 3, care: 2, haste: 2 });
  const pried = play(rock, [pry, pry]).world;

  it.fails("shore-10: a limpet that has been touched clamps down, and fingers will not shift it (nothing holds to anything, R4 being absent, and a thing has no alarm to take: the hand picks it off the rock like a pebble)", () => {
    const pulled = resolve(rock, { process: "take", body: "player", thing: "touched" }).world;
    expect(pulled.bodies.player?.holds ?? []).not.toContain("touched");
  });

  it("shore-10: the knife worked at it chips the shell to pieces, and is the worse for it", () => {
    expect(pried.things.touched?.state.integrity ?? 9).toBeLessThanOrEqual(3);
    expect(pried.things.knife?.state.edge ?? 9).toBeLessThan(4);
  });

  it.fails("shore-10: levered under the rim, the thin blade snaps its tip (force is a cut or a blow: nothing pries, R3's lever being absent, and a blade is one integrity with no tip to lose)", () => {
    expect(pried.things.knife?.state.integrity ?? 5).toBeLessThan(5);
  });

  it.fails("RULE ERROR: shore-10: one sharp sideways knock from a boot heel brings an unwarned limpet off whole (a blow only breaks or mars: with nothing fastened there is nothing to knock loose, and the heel that should free it smashes the shell)", () => {
    const knock = strikes("heel", "fresh", { effort: 3, care: 3, haste: 4 });
    expect(resolve(rock, knock).world.things.fresh?.state.integrity).toBe(5);
  });
});

describe("shore-11: a heavy boat at dead low water", () => {
  const sand = world(
    [
      thing("boat", "heavyboat", "flatsand"),
      thing("poles", "bough", "flatsand", { amount: 4 }),
      thing("oar", "oar", "flatsand"),
      sea("flatsand"),
    ],
    [body("player", { place: "flatsand", element: "person", where: [0, 0] })],
    EXTRA,
  );
  const drag: Act = { process: "take", body: "player", thing: "boat" };
  const down: Act = { process: "move", body: "player", to: [30, 0], minutes: 60 };

  it("shore-11: one person cannot drag her", () => {
    expect(resolve(sand, drag).world.bodies.player?.holds ?? []).not.toContain("boat");
  });

  it.fails("shore-11: levered up with the oar onto round poles, she is shoved thirty paces in an hour (take is mass against strength and nothing else: no lever, R3's being absent, no rollers, friction being read by no rule, so what cannot be lifted cannot be moved at all)", () => {
    const after = play(sand, [drag, down]).world;
    expect(strayed(sand, after, "boat")).toBe(true);
  });

  it.fails("shore-11: in three hours the tide reaches her and floats her (no drift touches a place, so the sea never comes; and buoyancy, P11, is read by no rule: the only bearing is load, and water bears nothing)", () => {
    const later = resolve(sand, hours(3)).world;
    expect(borne(later, ["boat"])).toBe(true);
  });

  it.fails("shore-11: an hour of that work leaves the player spent, where an hour's waiting does not (tiredness comes with the hours and nothing else: no act costs a body anything)", () => {
    const worked = play(sand, [...times(10, drag), hours(1)]).world;
    const waited = resolve(sand, hours(1)).world;
    expect(worked.bodies.player?.needs.rest ?? 0).toBeGreaterThan(
      (waited.bodies.player?.needs.rest ?? 0) + 0.5,
    );
  });
});

describe("shore-12: a knife left out in the salt air", () => {
  const station = world(
    [
      thing("bare", "blade", "station", { edge: 4 }),
      thing("kept", "blade", "station", { edge: 4 }),
      thing("fishoil", "oil", "station"),
      thing("scour", "sand", "station"),
      thing("stone", "whetstone", "station"),
      thing("inland", "blade", "inland", { edge: 4 }),
      thing("rain", "water", "inland"),
      sea("station"),
    ],
    [],
    EXTRA,
  );
  const leftOut = play(station, [wets("sea", "bare", 1), wets("rain", "inland", 1)]).world;
  const after = (n: number) => resolve(leftOut, days(n)).world;

  it("shore-12: left on the thwart wet with seawater, the knife has a bloom of rust by morning, is rough with it in three days, and is ruined in three weeks", () => {
    expect(after(0.5).things.bare?.state.corrosion ?? 0).toBeGreaterThan(0.1);
    expect(after(3).things.bare?.state.corrosion ?? 0).toBeGreaterThan(1);
    expect(after(21).things.bare?.state.corrosion ?? 0).toBeGreaterThanOrEqual(4);
  });

  it("shore-12: the knife wiped with oil is bright all season", () => {
    const oiled = play(station, [
      { process: "coat", substance: "fishoil", target: "kept" },
      days(120),
    ]).world;
    expect(oiled.things.kept?.state.corrosion ?? 9).toBeLessThan(0.1);
  });

  it.fails("shore-12: salt makes it far faster than the same damp would inland (rust in drift-rules.ts reads corrodibility and wetness: what the wet has in it does not reach the rate, and seawater is water to it)", () => {
    const later = after(3);
    expect(later.things.bare?.state.corrosion ?? 0).toBeGreaterThan(
      (later.things.inland?.state.corrosion ?? 9) * 2,
    );
  });

  it.fails("shore-12: in three days the edge is pitted (rust is a number of its own: nothing reads corrosion but load, so a blade rusted rough is as keen as it was)", () => {
    expect(after(3).things.bare?.state.edge ?? 9).toBeLessThan(4);
  });

  it.fails("shore-12: caught in the first week, wet sand and an hour on the whetstone get the rust off (nothing lowers corrosion: cleansing lifts coats, working a surface needs an edge harder than the work, and no act scours)", () => {
    const rusted = after(3);
    const rub: Act = {
      process: "force",
      instrument: "stone",
      patient: "bare",
      manner: { effort: 3, care: 3, haste: 2 },
      aim: "surface",
    };
    const scoured = play(rusted, [
      { process: "coat", substance: "scour", target: "bare" },
      ...times(5, rub),
    ]).world;
    expect(scoured.things.bare?.state.corrosion ?? 9).toBeLessThan(
      rusted.things.bare?.state.corrosion ?? 0,
    );
  });
});

describe("shore-14: a long line left for the tide", () => {
  const digs = (n: number) =>
    searchYield(world([], [], EXTRA), {
      process: "search",
      place: "wormflat",
      element: "lugworm",
      minutes: n,
      draw: 0,
    });
  const bait = at(thing("bait", "lugworm", "coveredflat", { amount: 40 }), [0, 0]);
  const feeder = (id: string, element: string) =>
    body(id, { place: "coveredflat", element, where: [1, 0], needs: { hunger: 3 } });
  const under = (who: string, element: string) =>
    noticed(world([bait], [feeder(who, element)], EXTRA));

  it("shore-14: digging forty lugworm takes a good part of the low water, and the flat gives them", () => {
    expect(digs(20)).toBeLessThan(40);
    expect(digs(150)).toBeGreaterThanOrEqual(40);
  });

  it("shore-14: a crab that comes on a baited hook strips it", () => {
    const after = acts(under("crab", "crab"), "crab");
    expect(after.things.bait?.state.amount).toBe(39);
  });

  it.fails("shore-14: left covered for nine hours, the line is worked on by whatever feeds there, and comes back with baits gone (drift moves no creature: a routine is offered and never played by time, principle 4's rate in code being absent, so the hungry crab sits by forty worms all tide)", () => {
    const later = resolve(under("crab", "crab"), hours(9)).world;
    expect(later.things.bait?.state.amount ?? 40).toBeLessThan(40);
  });

  it.fails("shore-14: a flatfish that takes a bait is hooked and held there (eating is only eating: nothing is fastened to anything, R4 being absent, so the fish that took the worm swims off)", () => {
    const took = acts(under("fish", "flatfish"), "fish");
    expect(took.things.bait?.state.amount).toBe(39);
    const off = resolve(took, { process: "move", body: "fish", to: [50, 0], minutes: 1 }).world;
    expect(gap(off.bodies.fish?.where, [0, 0])).toBeLessThan(2);
  });

  it.fails("shore-14: arriving an hour after the line dries, the gulls have had the catch (the same: time plays no creature's routine, so a hungry gull stands an hour beside stranded fish)", () => {
    const dried = noticed(
      world(
        [at(thing("catch", "flatfish", "wormflat", { amount: 6 }), [0, 0])],
        [body("gull", { place: "wormflat", element: "gull", where: [3, 0], needs: { hunger: 3 } })],
        EXTRA,
      ),
    );
    const later = resolve(dried, hours(1)).world;
    expect(later.things.catch?.state.amount ?? 6).toBeLessThan(6);
  });
});

describe("shore-15: treading on a weever", () => {
  const shrimper = (set = {}) =>
    body("shrimper", { place: "warmshallows", element: "person", where: [0, 0], ...set });
  const shallows = (who = shrimper()) =>
    noticed(
      world(
        [
          thing("spines", "spines", "warmshallows", { edge: 4 }),
          thing("shoes", "leather", "warmshallows"),
          thing("kettle", "water", "warmshallows", { temperature: 4 }),
        ],
        [who, body("weever", { place: "warmshallows", element: "weever", where: [0.5, 0] })],
        EXTRA,
      ),
    );
  const tread = strikes("spines", "shrimper", { effort: 2, care: 1, haste: 2 });
  const stung = resolve(shallows(), tread);

  it.fails("RULE ERROR: shore-15: the fish lies buried in the sand and the shrimper does not see it (sense.ts hides a thing only by the place's cover, which clear shallows have none of: R5 is absent, so the buried weever is seen as plainly as the net)", () => {
    expect(shallows().bodies.shrimper?.aware?.weever).toBeUndefined();
  });

  it.fails("shore-15: the weever does not move away from the feet coming at it: it trusts its spines (whatever is weaker than what it has noticed makes off: no row says a creature stands on its hiding or its arms, and hiding never outweighs flight)", () => {
    const w = shallows();
    const fish = w.bodies.weever;
    expect(fish ? routine(w, fish).intent : "keep_away").not.toBe("keep_away");
  });

  it("shore-15: trodden on with a bare foot, the spines go in", () => {
    expect(stung.changes.some((c) => c.kind === "wound" && c.wound.depth > 0)).toBe(true);
  });

  it.fails("RULE ERROR: shore-15: shod, the spines do not reach the foot (what is worn either turns a blow whole or takes nothing off it: in force-rules.ts a point keen enough to get into leather wounds as deep through a shoe as through bare skin)", () => {
    const shod = resolve(shallows(shrimper({ wears: ["shoes"] })), tread);
    expect(shod.changes.some((c) => c.kind === "wound")).toBe(false);
  });

  it.fails("shore-15: the pain and sickness are out of all proportion to the prick (a wound is a depth, a bleeding and a burn: what is noxious on the point does not pass in through it, X6's route by a wound being absent, and a body has no pain)", () => {
    expect(stung.world.bodies.shrimper?.sickness ?? 0).toBeGreaterThan(0);
  });

  it("shore-15: he hobbles: stung, he goes slower than he did", () => {
    const [was, now] = [shallows().bodies.shrimper, stung.world.bodies.shrimper];
    expect(now ? able(stung.world, now).speed : 9).toBeLessThan(
      was ? able(shallows(), was).speed : 0,
    );
  });

  it.fails("shore-15: the foot held in water as hot as he can bear, the pain breaks within a quarter of an hour (heat has things for targets and never a body, and there is no venom in him for heat to spoil)", () => {
    const ailing = shallows(shrimper({ sickness: 2 }));
    const held = resolve(ailing, heats("kettle", "shrimper", 15)).world;
    expect(held.bodies.shrimper?.sickness ?? 9).toBeLessThan(2);
  });
});
