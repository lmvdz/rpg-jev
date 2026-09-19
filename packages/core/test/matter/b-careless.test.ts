/**
 * Batch B, held out: careless, malice and exploit. Each test asserts what the scenario says a
 * sensible person expects. `it.fails` marks what the rules cannot produce, or get wrong
 * (`RULE ERROR`), with the reason in brackets. Rows are in `rows-b-careless.ts`.
 */
import { describe, expect, it } from "vitest";
import {
  type Act,
  effective,
  type MatterWorld,
  play,
  resolve,
  searchYield,
  strength,
  weight,
} from "../../src/matter/index.ts";
import { body, thing, world } from "./elements.ts";
import { EXTRA } from "./rows-b-careless.ts";

const alight = (fuel: number) => ({ burning: { of: "self" as const, fuel }, temperature: 5 });
const heat = (source: string, target: string, minutes: number, contact = 1): Act => ({
  process: "heat",
  source,
  target,
  minutes,
  contact,
});
const hours = (n: number): Act => ({ process: "drift", minutes: n * 60 });
const times = <T>(n: number, x: T): T[] => Array.from({ length: n }, () => x);
const total = (w: MatterWorld, element: string) =>
  Object.values(w.things)
    .filter((t) => t.element === element)
    .reduce((sum, t) => sum + t.state.amount, 0);

describe("careless-01: the campfire left alight", () => {
  const camp = world(
    [
      thing("flame", "fire", "meadow", alight(600)),
      thing("log", "firewood", "meadow"),
      thing("ember", "ember", "meadow", alight(5)),
      thing("tuft", "drygrass", "meadow"),
      thing("next", "drygrass", "meadow"),
      thing("stream", "water", "meadow", { amount: 500 }),
    ],
    [],
    EXTRA,
  );
  const cooking = resolve(camp, heat("flame", "log", 5)).world;

  it("careless-01: nobody smothers it, so the log is still alight half an hour after the player leaves, and burns to ash in the end", () => {
    expect(cooking.things.log?.state.burning).not.toBeNull();
    expect(resolve(cooking, hours(0.5)).world.things.log?.state.burning).not.toBeNull();
    const morning = resolve(cooking, hours(8)).world;
    expect(morning.things.log).toBeUndefined();
    expect(morning.things["log.ash"]).toBeDefined();
  });

  it("careless-01: the fire a few paces off does not light the grass, and one ember dropped in it does within a minute", () => {
    const near = resolve(cooking, heat("log", "tuft", 60, 0.1)).world;
    expect(near.things.tuft?.state.burning).toBeNull();
    const sparked = resolve(camp, heat("ember", "tuft", 1)).world;
    expect(sparked.things.tuft?.state.burning).not.toBeNull();
  });

  it("careless-01: burning grass lights the grass beside it, burns to ash within the hour, and the stream never takes fire", () => {
    const sparked = resolve(camp, heat("ember", "tuft", 1)).world;
    const spread = resolve(sparked, heat("tuft", "next", 1, 0.8)).world;
    expect(spread.things.next?.state.burning).not.toBeNull();
    expect(
      resolve(sparked, heat("tuft", "stream", 30)).world.things.stream?.state.burning,
    ).toBeNull();
    const after = resolve(spread, hours(1)).world;
    expect(after.things.tuft).toBeUndefined();
    expect(after.things["tuft.ash"]).toBeDefined();
  });

  it("careless-01: a meadow's worth of grass burns for longer than a tuft (fuel is worked out from the row's mass and size and never from the amount: a thousand tufts are gone in the ten minutes one is)", () => {
    const w = world(
      [
        thing("ember", "ember", "meadow", alight(5)),
        thing("tuft", "drygrass", "meadow"),
        thing("sward", "drygrass", "meadow", { amount: 1000 }),
      ],
      [],
      EXTRA,
    );
    const lit = play(w, [heat("ember", "tuft", 1), heat("ember", "sward", 1)]).world;
    const [tuft, sward] = [lit.things.tuft?.state.burning, lit.things.sward?.state.burning];
    expect(sward?.fuel ?? 0).toBeGreaterThan((tuft?.fuel ?? 0) * 2);
  });
});

describe("careless-02: asleep in wet clothes", () => {
  const camp = world(
    [
      thing("clothes", "cloth", "valley", { wetness: 0.05 }),
      thing("spare", "cloth", "valley", { wetness: 0.05 }),
      thing("stream", "water", "valley", { amount: 500, temperature: 1 }),
    ],
    [body("player", { place: "valley", needs: { hunger: 1, warmth: 1 } })],
    EXTRA,
  );
  const forded = resolve(camp, {
    process: "soak",
    liquid: "stream",
    target: "clothes",
    amount: 2,
  }).world;

  it("careless-02: the ford soaks the clothes, and wet they are heavier and pass heat far more readily", () => {
    expect(forded.things.clothes?.state.wetness).toBeGreaterThanOrEqual(4);
    const [wet, dry] = [forded.things.clothes, forded.things.spare];
    const [a, b] = [
      wet ? effective(forded, wet) : undefined,
      dry ? effective(forded, dry) : undefined,
    ];
    expect(a?.conductivity ?? 0).toBeGreaterThan((b?.conductivity ?? 9) + 1);
    expect(a?.mass ?? 0).toBeGreaterThan(b?.mass ?? 9);
  });

  it("careless-02: a cold damp night does not dry them: by morning they are still wet, and wetter than the spare set", () => {
    const morning = resolve(forded, hours(8)).world;
    expect(morning.things.clothes?.state.wetness).toBeGreaterThan(2);
    expect(morning.things.clothes?.state.wetness ?? 0).toBeGreaterThan(
      morning.things.spare?.state.wetness ?? 9,
    );
  });

  it("careless-02: the sleeper wakes colder than they lay down (nothing lets a cold place or wet clothing reach a body: time over a body only bleeds it and brings on a sickness already taken in)", () => {
    const morning = resolve(forded, hours(8)).world;
    expect(morning.bodies.player?.needs.warmth ?? 0).toBeGreaterThan(1);
  });
});

describe("careless-03: meat hung by the bed", () => {
  const hut = world(
    [
      thing("haunch", "meat", "hut", { amount: 3 }),
      thing("claws", "claw", "hut", { edge: 2 }),
      thing("door", "door", "hut"),
    ],
    [body("rats", { place: "hut", tolerates: 3 }), body("player", { place: "hut" })],
    EXTRA,
  );
  const evening = resolve(hut, hours(10)).world;

  it("careless-03: over a warm day the meat starts to spoil, and smells more than it did", () => {
    expect(evening.things.haunch?.state.contamination).toBeGreaterThan(1);
    const [fresh, stale] = [hut.things.haunch, evening.things.haunch];
    const before = fresh ? effective(hut, fresh).scent : 9;
    const after = stale ? effective(evening, stale).scent : 0;
    expect(after).toBeGreaterThan(before + 0.5);
  });

  it("careless-03: what the rats eat is gone from the haunch, and it does them no harm though it would sicken the player", () => {
    const gnawed = resolve(evening, {
      process: "ingest",
      body: "rats",
      thing: "haunch",
      amount: 2,
    });
    expect(gnawed.world.things.haunch?.state.amount).toBeCloseTo(1);
    expect(gnawed.world.bodies.rats?.sickness).toBe(0);
    const ate = resolve(evening, { process: "ingest", body: "player", thing: "haunch" }).world;
    expect(ate.bodies.player?.sickness).toBeGreaterThan(0);
  });

  it("careless-03: a night of claws does not get through the door", () => {
    const scratch: Act = {
      process: "force",
      instrument: "claws",
      patient: "door",
      manner: { effort: 3, care: 1, haste: 3 },
      aim: "surface",
    };
    const after = play(hut, times(40, scratch)).world;
    expect(after.things.door?.state.integrity).toBeGreaterThan(4);
  });

  it.fails("careless-03: and leaves its marks on it (horn is softer than the wood, so the cut is refused outright, and a blow from something so light is nothing: force has no way for a softer point to score a surface or its finish)", () => {
    const scratch: Act = {
      process: "force",
      instrument: "claws",
      patient: "door",
      manner: { effort: 3, care: 1, haste: 3 },
      aim: "surface",
    };
    const after = play(hut, times(40, scratch));
    const marked =
      (after.world.things.door?.state.integrity ?? 5) < 5 ||
      (after.world.things.door?.state.amount ?? 1) < 1;
    expect(marked).toBe(true);
  });

  it.fails("careless-03: the spoiling meat gives off a scent for a nose to find (M4 raises its effective scent and nothing emits it: drift makes no signal, and sensing and what a creature does about it are unbuilt)", () => {
    const { changes } = resolve(hut, hours(10));
    expect(changes.some((c) => c.kind === "signal" && c.channel === "scent")).toBe(true);
  });
});

describe("careless-05: new ice over a current", () => {
  const pond = world(
    [
      thing("edge", "pondice", "pond", { temperature: 0 }),
      thing("middle", "pondice", "pond", { temperature: 0, flaw: 3 }),
      thing("walker", "person", "pond"),
      thing("clothes", "cloth", "pond", { wetness: 0.05 }),
      thing("water", "water", "pond", { amount: 500, temperature: 0.5 }),
    ],
    [body("player", { place: "pond", needs: { hunger: 1, warmth: 1 } })],
    EXTRA,
  );
  const step = (support: string): Act => ({ process: "load", support, bearing: ["walker"] });

  it("careless-05: the ice bears the walker at the edge and gives way over the current, and the two look the same", () => {
    expect(resolve(pond, step("edge")).world.things.edge?.state.integrity).toBe(5);
    expect(resolve(pond, step("middle")).world.things.middle?.state.integrity).toBeLessThanOrEqual(
      1,
    );
    const [a, b] = [pond.things.edge, pond.things.middle];
    expect(a ? effective(pond, a) : 1).toEqual(b ? effective(pond, b) : 2);
  });

  it("careless-05: the water soaks the clothes and takes their warmth in a minute or two, where the air takes far longer", () => {
    const soaked = resolve(pond, {
      process: "soak",
      liquid: "water",
      target: "clothes",
      amount: 2,
    });
    expect(soaked.world.things.clothes?.state.wetness).toBeGreaterThanOrEqual(4);
    const inWater = resolve(soaked.world, heat("water", "clothes", 2)).world;
    const inAir = resolve(pond, { process: "drift", minutes: 2 }).world;
    expect(inWater.things.clothes?.state.temperature).toBeLessThan(1.2);
    expect(inAir.things.clothes?.state.temperature).toBeGreaterThan(1.8);
  });

  it.fails("careless-05: the water chills the one who fell in (heat has things for targets and no bodies: there is nothing there to heat)", () => {
    const { world: after } = resolve(pond, heat("water", "player", 5));
    expect(after.bodies.player?.needs.warmth ?? 0).toBeGreaterThan(1);
  });
});

describe("malice-01: the poisoned well", () => {
  const village = (wellAmount: number, taint: number) =>
    world(
      [
        thing("crush", "nightshade", "village", { amount: 0.2, taint }),
        thing("well", "water", "village", { amount: wellAmount }),
      ],
      [body("early", { place: "village" }), body("late", { place: "village" })],
      EXTRA,
    );
  const tip: Act = { process: "soak", liquid: "crush", target: "well", amount: 0.2 };

  it.fails("malice-01: crushed poison berries tipped into the well make its water harmful to drink (soak carries the liquid's carried taint and contamination and never the liquid's own noxiousness, so a poison poured in leaves the water clean)", () => {
    const after = resolve(village(500, 0), tip).world;
    const well = after.things.well;
    expect(well ? effective(after, well).noxiousness : 0).toBeGreaterThan(0);
  });

  it.fails("malice-01: carried as a dose, the poison passes into the water; who drinks deep sickens hours later and who sips does not (now that a dose is a quantity, a handful in a well of 500 is diluted to nothing at once; the scenario has it mix through gradually so the first to draw get the worst, which needs a well that is not one instance)", () => {
    const after = resolve(village(500, 4), tip).world;
    expect(after.things.well?.state.taint).toBeGreaterThan(0);
    const drunk = play(after, [
      { process: "ingest", body: "early", thing: "well", amount: 1 },
      { process: "ingest", body: "late", thing: "well", amount: 0.1 },
    ]).world;
    expect(drunk.bodies.early?.sickness).toBeGreaterThan(1);
    expect(drunk.bodies.early?.health).toBe(5);
    expect(drunk.bodies.early?.sickensIn).toBeGreaterThan(60);
    expect(drunk.bodies.late?.sickness).toBe(0);
    const later = resolve(drunk, hours(6)).world;
    expect(later.bodies.early?.health).toBeLessThan(5);
  });

  it("fixed rule: malice-01: a cupful of poison taints a well of 500 exactly as much as a bucket of 2 (soak.ts passes half the liquid's taint whatever the amounts on either side: there is no dilution)", () => {
    const well = resolve(village(500, 4), tip).world.things.well?.state.taint ?? 0;
    const bucket = resolve(village(2, 4), tip).world.things.well?.state.taint ?? 0;
    expect(well).toBeLessThan(bucket);
  });
});

describe("malice-02: the neighbour's wheat", () => {
  const valley = (at: string) =>
    world(
      [
        thing("torch", "fire", at, alight(600)),
        thing("edge", "wheat", at),
        thing("row", "wheat", at),
        thing("ember", "ember", at, alight(5)),
        thing("wall", "barnwall", at),
        thing("bucket", "water", at, { amount: 1 }),
      ],
      [],
      EXTRA,
    );

  it("malice-02: ripe wheat takes the torch at once, passes the fire down the row, and is ash within the hour", () => {
    const lit = resolve(valley("stillfield"), heat("torch", "edge", 0.5)).world;
    expect(lit.things.edge?.state.burning).not.toBeNull();
    const spread = resolve(lit, heat("edge", "row", 1, 0.8)).world;
    expect(spread.things.row?.state.burning).not.toBeNull();
    const after = resolve(spread, hours(1)).world;
    expect(after.things.edge).toBeUndefined();
    expect(after.things.row).toBeUndefined();
    expect(after.things["edge.ash"]).toBeDefined();
  });

  it.fails("malice-02: the wind carries the fire down the row sooner than still air does (wind reaches drying and nothing else: not heat, not burning)", () => {
    const reach = (at: string) => {
      const lit = resolve(valley(at), heat("torch", "edge", 0.5)).world;
      return resolve(lit, heat("edge", "row", 0.3, 0.3)).world.things.row?.state.burning ?? null;
    };
    expect(reach("stillfield")).toBeNull();
    expect(reach("field")).not.toBeNull();
  });

  it("malice-02: the barn wall does not catch from the fire at a distance, would from an ember left lying on it, and a bucket puts the ember out", () => {
    const w = valley("field");
    const burning = resolve(w, heat("torch", "edge", 0.5)).world;
    const near = resolve(burning, heat("edge", "wall", 10, 0.2)).world;
    expect(near.things.wall?.state.burning).toBeNull();
    const left = resolve(w, heat("ember", "wall", 4)).world;
    expect(left.things.wall?.state.burning).not.toBeNull();
    const doused = resolve(w, { process: "soak", liquid: "bucket", target: "ember", amount: 1 });
    expect(doused.world.things.ember?.state.burning).toBeNull();
    expect(
      resolve(doused.world, heat("ember", "wall", 4)).world.things.wall?.state.burning,
    ).toBeNull();
  });
});

describe("malice-03: the anchor rope cut part through", () => {
  const gorge = world(
    [
      thing("knife", "blade", "gorge", { edge: 4 }),
      thing("anchor", "hawser", "gorge"),
      thing("traveler", "person", "gorge"),
      thing("mules", "mule", "gorge", { amount: 3 }),
      thing("lead", "mule", "gorge"),
      thing("cargo", "sack", "gorge", { amount: 6 }),
    ],
    [],
    EXTRA,
  );
  const stroke: Act = {
    process: "force",
    instrument: "knife",
    patient: "anchor",
    manner: { effort: 2, care: 4, haste: 1 },
  };
  const cut = play(gorge, times(2, stroke)).world;
  const cross = (bearing: string[]): Act => ({ process: "load", support: "anchor", bearing });

  it("malice-03: two strokes of a knife weaken the rope without parting it", () => {
    const integrity = cut.things.anchor?.state.integrity ?? 0;
    expect(integrity).toBeGreaterThan(0.5);
    expect(integrity).toBeLessThan(4);
  });

  it("malice-03: the weakened rope gives way under the laden mule train", () => {
    const after = resolve(cut, cross(["mules", "cargo"])).world;
    expect(after.things.anchor?.state.integrity).toBeLessThanOrEqual(1);
  });

  it("fixed rule: malice-03: whole and sound, the anchor rope gives way under a single mule, let alone the train it carries daily (load.ts rates a cord as a beam: hardness counts 0.5 a level and toughness 0.3, so the toughest rope there is bears 4.6 against a mule's 5)", () => {
    const after = resolve(gorge, cross(["lead"])).world;
    expect(after.things.anchor?.state.integrity).toBe(5);
  });

  it.fails("malice-03: weakened, it still carries one traveler on foot (the same rule: a sound rope bears 4.6 and a person weighs 4, so any cut at all, one stroke as surely as two, drops it under a lone walker)", () => {
    const before = cut.things.anchor?.state.integrity;
    const after = resolve(cut, cross(["traveler"])).world;
    expect(after.things.anchor?.state.integrity).toBe(before);
  });
});

describe("exploit-01: searching one patch a hundred times", () => {
  const empty = world([], [], EXTRA);
  const hour = (draw: number): Act => ({
    process: "search",
    place: "patch",
    element: "stone",
    minutes: 60,
    draw,
  });

  it("exploit-01: a hundred searches on the luckiest draws there are turn up the couple of stones that were there and no more", () => {
    const { world: after, changes } = play(empty, times(100, hour(0)));
    expect(total(after, "stone")).toBeGreaterThanOrEqual(1);
    expect(total(after, "stone")).toBeLessThanOrEqual(3);
    expect(after.places.patch?.searched.stone?.found).toBe(total(after, "stone"));
    const late = changes.filter((c) => c.kind === "create").length;
    expect(late).toBeLessThanOrEqual(3);
  });

  it("exploit-01: once it has given what it had, every further search yields exactly nothing, and the time is still spent", () => {
    const spent = play(empty, times(10, hour(0))).world;
    expect(
      searchYield(spent, {
        process: "search",
        place: "patch",
        element: "stone",
        minutes: 60,
        draw: 0,
      }),
    ).toBe(0);
    const more = play(spent, times(90, hour(0)));
    expect(total(more.world, "stone")).toBe(total(spent, "stone"));
    expect(more.world.places.patch?.searched.stone?.minutes).toBe(6000);
  });

  it("exploit-01: cutting the hour into sixty glances, or searching for a year at a stretch, gets no more out of it", () => {
    const glance: Act = {
      process: "search",
      place: "patch",
      element: "stone",
      minutes: 1,
      draw: 0,
    };
    const glances = play(empty, times(6000, glance)).world;
    expect(total(glances, "stone")).toBeLessThanOrEqual(3);
    const year: Act = {
      process: "search",
      place: "patch",
      element: "stone",
      minutes: 525600,
      draw: 0,
    };
    expect(total(play(empty, times(5, year)).world, "stone")).toBeLessThanOrEqual(3);
  });

  it("exploit-01: and a day of waiting does not restock it either", () => {
    const spent = play(empty, times(10, hour(0))).world;
    const next = resolve(spent, hours(24)).world;
    expect(total(play(next, times(10, hour(0))).world, "stone")).toBe(total(spent, "stone"));
  });

  it.fails("exploit-01: the first thorough hour on a small patch finds the two or three stones lying in it (at the level that stands for a couple, an hour is worth 0.13 of a stone and ten hours 0.37: the rate knows how common a thing is and not how small the ground is)", () => {
    const first = resolve(empty, hour(0.5)).world;
    expect(total(first, "stone")).toBeGreaterThanOrEqual(2);
  });
});

describe("exploit-02: one loaf called two", () => {
  const kitchen = (hunger: number) =>
    world(
      [
        thing("loaf", "bread", "kitchen"),
        thing("knife", "blade", "kitchen", { edge: 4 }),
        thing("pestle", "stone", "kitchen"),
      ],
      [body("player", { place: "kitchen", needs: { hunger } })],
      EXTRA,
    );
  const slice: Act = { process: "force", instrument: "knife", patient: "loaf" };
  const pound: Act = {
    process: "force",
    instrument: "pestle",
    patient: "loaf",
    manner: { effort: 3, care: 2, haste: 2 },
  };
  const eatAll = (w: MatterWorld): MatterWorld =>
    play(
      w,
      Object.values(w.things)
        .filter((t) => t.element === "bread")
        .map(
          (t): Act => ({ process: "ingest", body: "player", thing: t.id, amount: t.state.amount }),
        ),
    ).world;

  it("exploit-02: however often the knife goes through it, there is one loaf's worth of bread on the table", () => {
    const cut = play(kitchen(5), times(20, slice)).world;
    expect(cut.things.loaf?.state.integrity).toBeLessThan(5);
    expect(total(cut, "bread")).toBeCloseTo(1);
  });

  it("exploit-02: two halves eaten feed exactly as one loaf eaten", () => {
    const half: Act = { process: "ingest", body: "player", thing: "loaf", amount: 0.5 };
    const halves = play(kitchen(5), [half, half]).world;
    const whole = resolve(kitchen(5), { process: "ingest", body: "player", thing: "loaf" }).world;
    expect(halves.bodies.player?.needs.hunger).toBe(whole.bodies.player?.needs.hunger);
    expect(halves.things.loaf).toBeUndefined();
    expect(total(halves, "bread")).toBe(0);
  });

  it("fixed rule: exploit-02: twenty blows on one loaf leave eleven loaves of bread (force.ts breaking creates a piece with an amount and takes nothing from what it broke off, and goes on doing it after the thing is in pieces)", () => {
    const pounded = play(kitchen(5), times(20, pound)).world;
    expect(total(pounded, "bread")).toBeLessThanOrEqual(1.01);
  });

  it("fixed rule: exploit-02: and eating the pieces takes a hunger of 5 to 0 where the one loaf takes it to 3 (the same rule: the pieces are new bread)", () => {
    const whole = eatAll(kitchen(5)).bodies.player?.needs.hunger ?? 0;
    const pieces =
      eatAll(play(kitchen(5), times(20, pound)).world).bodies.player?.needs.hunger ?? 0;
    expect(pieces).toBeGreaterThanOrEqual(whole - 0.01);
  });
});

describe("exploit-04: a hundred ingots in one pack", () => {
  const road = (ingots: number, packState = {}) =>
    world(
      [
        thing("pack", "pack", "road", packState),
        thing("supplies", "supplies", "road"),
        thing("ingots", "ingot", "road", { amount: ingots }),
      ],
      [],
      EXTRA,
    );
  const shoulder: Act = { process: "load", support: "pack", bearing: ["supplies", "ingots"] };
  const holds = (ingots: number) =>
    resolve(road(ingots), shoulder).world.things.pack?.state.integrity === 5;

  it("exploit-04: the pack holds its day's supplies, and a hundred ingots tear it", () => {
    const w = road(100);
    const light = resolve(w, { process: "load", support: "pack", bearing: ["supplies"] }).world;
    expect(light.things.pack?.state.integrity).toBe(5);
    expect(resolve(w, shoulder).world.things.pack?.state.integrity).toBeLessThanOrEqual(1);
  });

  it("exploit-04: every ingot adds to what is borne, and past the one that tears it no larger pile is ever held", () => {
    const borne = [1, 2, 5, 20, 100].map((n) => weight(road(n), ["supplies", "ingots"]));
    for (let i = 1; i < borne.length; i++) expect(borne[i] ?? 0).toBeGreaterThan(borne[i - 1] ?? 9);
    const counts = Array.from({ length: 100 }, (_, i) => i + 1);
    const first = counts.find((n) => !holds(n)) ?? 0;
    expect(first).toBeGreaterThan(0);
    expect(counts.filter((n) => n > first).every((n) => !holds(n))).toBe(true);
  });

  it("exploit-04: ten ingots weigh the same as one stack of ten: splitting the pile hides nothing", () => {
    const loose = world(
      Array.from({ length: 10 }, (_, i) => thing(`ingot${i}`, "ingot", "road")),
      [],
      EXTRA,
    );
    const ids = Object.keys(loose.things);
    expect(weight(loose, ids)).toBeCloseTo(weight(road(10), ["ingots"]));
  });

  it("exploit-04: torn, the pack no longer holds even what it held before", () => {
    const torn = resolve(road(100), shoulder).world;
    const again = resolve(torn, { process: "load", support: "pack", bearing: ["supplies"] });
    expect(again.changes.some((c) => c.note === "it holds")).toBe(false);
    expect(strength(torn, torn.things.pack ?? thing("none", "pack"))).toBeLessThan(
      strength(road(1), road(1).things.pack ?? thing("none", "pack")),
    );
  });

  it.fails("exploit-04: when the pack tears, the ingots spill (load breaks the support and says nothing to what it held: no move, no contents)", () => {
    const { changes } = resolve(road(100), shoulder);
    expect(changes.some((c) => "thing" in c && c.thing === "ingots")).toBe(true);
  });
});

describe("exploit-05: lighting a torch under water", () => {
  const stream = (at: string) =>
    world(
      [
        thing("torch", "torch", at, { wetness: 0.05 }),
        thing("water", "water", at, { amount: 500, temperature: 1 }),
        thing("sparks", "ember", at, alight(5)),
        thing("flint", "flint", at, { edge: 3 }),
        thing("striker", "steel", at),
        thing("bar", "iron", at, { temperature: 5 }),
      ],
      [],
      EXTRA,
    );
  /** The same torch, as it now is, somewhere else with fresh sparks to hand. */
  const carried = (from: MatterWorld, at: string): MatterWorld => {
    const fresh = stream(at);
    const torch = from.things.torch;
    return torch
      ? { ...fresh, things: { ...fresh.things, torch: { ...torch, place: at } } }
      : fresh;
  };
  const dunk: Act = { process: "soak", liquid: "water", target: "torch", amount: 2 };
  const shower = heat("sparks", "torch", 0.2);
  const under = resolve(stream("streambed"), dunk).world;

  it("exploit-05: held under, the torch soaks through and is far harder to light than it was", () => {
    expect(under.things.torch?.state.wetness).toBeGreaterThan(3);
    const [dry, wet] = [stream("streambed").things.torch, under.things.torch];
    const before = dry ? effective(under, dry).flammability : 0;
    expect(wet ? effective(under, wet).flammability : 9).toBeLessThan(before - 2);
  });

  it("exploit-05: a hundred showers of sparks under water never light it", () => {
    let w = under;
    for (let i = 0; i < 100; i++) {
      w = resolve(w, shower).world;
      expect(w.things.torch?.state.burning).toBeNull();
    }
  });

  it("exploit-05: nor does a flame held to it under water for an hour", () => {
    const after = resolve(under, heat("sparks", "torch", 60)).world;
    expect(after.things.torch?.state.burning).toBeNull();
  });

  it("fixed rule: exploit-05: a scorching iron held to the torch under water for an hour leaves it bone dry there (heat.ts dries by the target's temperature alone and never asks what it is sitting in: drift will not dry a thing below what its place keeps in it, heat will)", () => {
    const after = resolve(under, heat("bar", "torch", 60)).world;
    expect(after.things.torch?.state.wetness).toBeGreaterThan(3);
  });

  it("fixed rule: exploit-05: so the trick works by the back door: a hundred showers of sparks under water leave the torch hot and half dried, and carried up the bank it lights at the first spark (the same rule, and heat never reads how small its source is)", () => {
    const struck = play(under, times(100, shower)).world;
    const ashore = resolve(carried(struck, "bank"), shower).world;
    expect(ashore.things.torch?.state.burning).toBeNull();
  });

  it("exploit-05: on the bank the same sparks light a dry torch and not the soaked one", () => {
    const bank = stream("bank");
    expect(resolve(bank, shower).world.things.torch?.state.burning).not.toBeNull();
    const soaked = resolve(bank, dunk).world;
    expect(resolve(soaked, shower).world.things.torch?.state.burning).toBeNull();
  });

  it.fails("RULE ERROR: exploit-05: on the bank, fifty-five showers of sparks dry the soaked torch and light it (heat.ts takes the source's temperature and never its size or mass, so a spark warms and dries a torch as a furnace would: repetition supplies the dryness)", () => {
    const soaked = resolve(stream("bank"), dunk).world;
    const after = play(soaked, times(100, shower)).world;
    expect(after.things.torch?.state.burning).toBeNull();
  });

  it("exploit-05: all the striking throws sparks and wears the flint", () => {
    const strike: Act = {
      process: "force",
      instrument: "flint",
      patient: "striker",
      manner: { effort: 3, care: 2, haste: 3 },
    };
    const { world: after, changes } = play(stream("streambed"), times(100, strike));
    expect(changes.some((c) => c.kind === "signal" && c.channel === "light")).toBe(true);
    const flint = after.things.flint?.state;
    expect((flint?.edge ?? 3) < 3 || (flint?.integrity ?? 5) < 5).toBe(true);
    expect(after.things.torch?.state.burning).toBeNull();
  });

  it("exploit-05: out of the water it stays too wet to light for a good while, and lights once it has dried", () => {
    const soaked = resolve(stream("bank"), dunk).world;
    const soon = carried(resolve(soaked, hours(1)).world, "bank");
    expect(resolve(soon, shower).world.things.torch?.state.burning).toBeNull();
    const dried = carried(resolve(soaked, hours(168)).world, "bank");
    expect(resolve(dried, shower).world.things.torch?.state.burning).not.toBeNull();
  });
});
