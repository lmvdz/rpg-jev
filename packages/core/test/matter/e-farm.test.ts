/**
 * Batch E (held out), the farm scenarios, run through the matter engine with the rules frozen.
 * Each test asserts what the scenario says a sensible person expects. `it.fails` marks an
 * outcome the rules do not produce, with the reason in brackets; a name that starts
 * `RULE ERROR:` marks one the rules get wrong. Rows are in `rows-e-farm.ts`, written before
 * anything ran.
 *
 * Unbuilt, so no test: farm-11 (a well drawn down in a drought: a place's standing water
 * falling with no rain and with use against a slow refill, E13; a bucket that comes up half
 * full, S8; a rope's reach; a thirst that heat raises, which is no need here).
 *
 * A farm here is matter that rots, dries, burns, bears and is eaten, and bodies that hunger,
 * chill, fear and choose. Nothing grows or is born (S12 and X7's breeding are absent), nothing
 * is ever dead, nothing has an inside (S8) or a depth, no place has a way into another or a
 * door on it (R6), no place is changed by what is done in it (E13), nothing is joined or set in
 * anything (R4, R10), wind carries nothing (R7), and no act costs a body effort. Parts of
 * outcomes with no act to play and no state to read are not asserted at all: milking itself,
 * milk let down or held up, and an udder going hard (farm-02: a creature produces nothing);
 * scalding and cutting up a pig, brine in the trough, taint found only by a skewer to the bone,
 * and blowfly maggots (farm-03); the open bin eaten before the sacks, a loss too small for the
 * farmer to see, and seed corn coming up thin (farm-04); the dog's barking that nobody heeds, a
 * cached hen, and hens off lay (farm-05: `call` and `express` are offers with no act, so nothing
 * that lives makes a sound); digging a post hole in stony ground, a post rocking looser each
 * day, nails springing, and cattle in the neighbour's wheat (farm-06); grain sprouting in the
 * ear (farm-07: the test asks for spoiling, which the engine gives by rot); a rapped head, and
 * fanning with the basket (farm-08: skill is not granted; tossing in still air parts nothing,
 * and is not asserted because the engine parts nothing in any air); narrow wheels cutting in
 * where broad would ride, a strained trace, and the horse's feet sinking (farm-09: load has no
 * bearing area); the bed too strong to resow and rich by midsummer, and flies (farm-10: a place
 * has no fertility); a twisted gut, and a horse that has learned latches (farm-12); a nick the
 * whetstone cannot take out, and the ragged ridge a dull blade leaves (farm-13: an edge is one
 * number, and it cuts whole or not at all); the birth, the licking dry, and the crow (farm-14);
 * butter coming only within a band of warmth, froth when too cold, grease when too hot
 * (farm-15: there is no churning, and whether a kettle of hot water overshoots is a matter of
 * amounts the scenario does not give).
 *
 * Changed after the first run, and why: no test changed kind and no assertion, row, threshold
 * or place changed. Every `it` and every `it.fails` was decided from reading the engine before
 * anything ran, and the first run was green: no `it` failed and no `it.fails` turned out to
 * pass. The engine's numbers were printed afterwards to check that each expected failure fails
 * for the reason its name gives, and two names were corrected. farm-05's sleeping hens: the
 * name said the bite fell just under what a sleeping hen hears, but a blow on a body makes no
 * sound at all (the sound rule is of things struck), so the name now says that. farm-13's
 * whetstone: the blade's edge is unchanged as expected, and the stone chips itself against the
 * steel, which the name now adds. Numbers seen: three weeks on, mow and haycock both at 2; the
 * stuck pig and the bitten hen at health 4.9 after ten minutes; the rat's teeth at edge 0 with
 * the board at 4.76; ham and flitch both at contamination 0 a fortnight on; the post's strength
 * 3.4 against a cow's 5; an hour's drizzle and a week's both leaving the stook at 3.2; dunged
 * and spared seedlings both at contamination 5 in four days; the old dung heap at noxiousness 5
 * against 3 fresh; the hidden stone seen at strength 0.5; the first lamb's cold at 2.0 within
 * the hour; the lamb two hours in the sleet at health 4.9; work and idleness leaving the same
 * tiredness to the last digit.
 */
import { describe, expect, it } from "vitest";
import {
  type Act,
  alight,
  type Body,
  bondTo,
  effective,
  emits,
  type MatterWorld,
  offers,
  play,
  reaches,
  resolve,
  routine,
  strength,
  type Thing,
} from "../../src/matter/index.ts";
import { body, thing, world } from "./elements.ts";
import { EXTRA } from "./rows-e-farm.ts";

type Spot = readonly [number, number];

const minutes = (n: number): Act => ({ process: "drift", minutes: n });
const hours = (n: number): Act => minutes(n * 60);
const days = (n: number): Act => hours(n * 24);
const times = (n: number, act: Act): Act[] => Array.from({ length: n }, () => act);

const put = (t: Thing, where: Spot): Thing => ({ ...t, where });

const who = (id: string, element: string, place: string, set: Partial<Body> = {}) =>
  body(id, { element, place, ...set });

/** Sets fuel burning in a world that is already built. */
function lit(w: MatterWorld, id: string): MatterWorld {
  const fuel = w.things[id];
  return fuel ? { ...w, things: { ...w.things, [id]: alight(w, fuel) } } : w;
}

/** One empty act, so that everyone has noticed what there is to notice. */
const noticed = (w: MatterWorld) => resolve(w, minutes(0)).world;

/** A mother and her young: the one holds the other dear. */
const bonded = (w: MatterWorld, from: string, to: string): MatterWorld => ({
  ...w,
  bonds: [...(w.bonds ?? []), { from, to, kind: "young", weight: 5 }],
});

/** What a body does when nobody is watching, played: the world after, and what it chose. */
function acts(w: MatterWorld, id: string) {
  const self = w.bodies[id];
  const choice = self ? routine(w, self) : undefined;
  const after = choice?.act ? resolve(w, choice.act).world : w;
  return { choice, world: after };
}

/** Left to itself for so many turns, where a body ends up. */
function left(w: MatterWorld, id: string, turns: number): MatterWorld {
  let at = noticed(w);
  for (let n = 0; n < turns; n++) at = acts(at, id).world;
  return at;
}

/** Whether a thing is somewhere other than where it was. */
function strayed(before: MatterWorld, after: MatterWorld, id: string): boolean {
  const [was, now] = [before.things[id], after.things[id]];
  if (!(was && now)) return false;
  const [a, b] = [was.where ?? [0, 0], now.where ?? [0, 0]];
  return now.place !== was.place || Math.hypot(a[0] - b[0], a[1] - b[1]) > 0;
}

/** How much more tired so many strokes of work leave a body than the same time spent idle. */
function wearies(w: MatterWorld, id: string, work: Act, strokes: number, span: number): number {
  const worked = play(w, [...times(strokes, work), minutes(span)]).world;
  const idle = resolve(w, minutes(span)).world;
  return (worked.bodies[id]?.needs.rest ?? 0) - (idle.bodies[id]?.needs.rest ?? 0);
}

/** How strongly what a thing smells of reaches a nose, above what that nose can notice. */
function smelt(w: MatterWorld, nose: string, source: string): number {
  const [b, t] = [w.bodies[nose], w.things[source]];
  return b && t ? reaches(w, b, t, "scent", emits(w, t).scent ?? 0) : 0;
}

const burns = (w: MatterWorld, id: string) => (w.things[id]?.state.burning ?? null) !== null;

describe("farm-01: hay carted a day too early, heating in the mow", () => {
  const bay = world(
    [
      thing("damp", "haymow", "barn", { wetness: 2 }),
      thing("sound", "haymow", "barn"),
      thing("cock", "haycock", "barn", { wetness: 2 }),
    ],
    [who("farmer", "person", "barn")],
    EXTRA,
  );
  const week = resolve(bay, days(7)).world;

  it("farm-01: put up damp, the mow is fermenting within the week, where well made hay in the same barn keeps", () => {
    expect(week.things.damp?.state.contamination).toBeGreaterThan(1);
    expect(week.things.sound?.state.contamination).toBeLessThan(0.2);
  });

  it("farm-01: the fermenting mow has a smell the farmer's nose catches, and sound hay has none he would notice", () => {
    expect(smelt(week, "farmer", "damp")).toBeGreaterThan(0);
    expect(smelt(week, "farmer", "sound")).toBeLessThanOrEqual(0);
  });

  it.fails("farm-01: fermenting, the mow warms itself: three weeks on its middle is hot (rot makes no heat: temperature in drift-rules.ts only settles toward the place, so nothing warms of itself)", () => {
    const later = resolve(bay, days(21)).world;
    expect(later.things.damp?.state.temperature).toBeGreaterThan(3);
  });

  it.fails("farm-01: the great tight mow cannot lose its heat, where a haycock of the same damp hay stays cool (rot makes no heat, so there is none for bulk to hold in: mow and cock sit at the barn's warmth alike)", () => {
    const later = resolve(bay, days(21)).world;
    const [mow, cock] = [
      later.things.damp?.state.temperature,
      later.things.cock?.state.temperature,
    ];
    expect((mow ?? 0) - (cock ?? 0)).toBeGreaterThan(1);
  });

  it("farm-01: an iron rod pushed into a heated mow comes out too hot to hold, and out of a sound one as it went in", () => {
    const mows = world(
      [
        thing("heated", "haymow", "barn", { temperature: 4.5 }),
        thing("sound", "haymow", "barn"),
        thing("rod", "iron", "barn"),
      ],
      [],
      EXTRA,
    );
    const tried = (source: string) =>
      resolve(mows, { process: "heat", source, target: "rod", minutes: 10 }).world.things.rod;
    expect(tried("heated")?.state.temperature).toBeGreaterThan(3.5);
    expect(tried("sound")?.state.temperature).toBeLessThan(2.5);
  });

  it.fails("farm-01: the heated hay is poor feed: a cow gets less from it than from sound hay (what a food serves is its row's: rot makes it harmful, M4, and never less nourishing)", () => {
    const stall = world(
      [
        thing("bad", "haymow", "barn", week.things.damp?.state ?? {}),
        thing("good", "haymow", "barn"),
      ],
      [who("a", "cow", "barn"), who("b", "cow", "barn")],
      EXTRA,
    );
    const fed = play(stall, [
      { process: "ingest", body: "a", thing: "bad" },
      { process: "ingest", body: "b", thing: "good" },
    ]).world;
    expect(fed.bodies.a?.needs.hunger ?? 0).toBeGreaterThan(fed.bodies.b?.needs.hunger ?? 9);
  });
});

describe("farm-01: the mow takes fire", () => {
  it.fails("farm-01: left alone for six weeks, the heating mow chars at the core and takes fire (nothing lights without a flame or a glowing thing put to it: no drift heats, chars or kindles)", () => {
    const bay = world([thing("damp", "haymow", "barn", { wetness: 2 })], [], EXTRA);
    expect(burns(resolve(bay, days(42)).world, "damp")).toBe(true);
  });

  it.fails("farm-01: the smouldering core, airless inside the mow, breaks into flame when it is dug out into the air (what burns with no air goes out for good in drift-rules.ts: S3's charring without air is absent, so there is nothing left to flare)", () => {
    const core = lit(
      world([thing("core", "haymow", "mowcore", { temperature: 4.5 })], [], EXTRA),
      "core",
    );
    const smothered = resolve(core, hours(1)).world;
    const dug = smothered.things.core;
    const opened = dug ? { ...smothered, things: { core: { ...dug, place: "barn" } } } : smothered;
    expect(burns(resolve(opened, minutes(5)).world, "core")).toBe(true);
  });

  it("farm-01: once the mow is alight, the thatch over it and the timbers take light from it", () => {
    const barn = lit(
      world(
        [
          thing("mow", "haymow", "barn"),
          thing("roof", "thatch", "barn"),
          thing("beams", "oak", "barn"),
        ],
        [],
        EXTRA,
      ),
      "mow",
    );
    // The bay is filled to the tie beams: the flames are on the roof.
    const reach = (target: string): Act => ({
      process: "heat",
      source: "mow",
      target,
      minutes: 10,
    });
    const spread = play(barn, [reach("roof"), reach("beams")]).world;
    expect(burns(spread, "roof")).toBe(true);
    expect(burns(spread, "beams")).toBe(true);
  });
});

describe("farm-02: milking a nervous heifer", () => {
  const byre = bonded(
    world(
      [
        put(thing("meal", "grain", "byre"), [0, 0]),
        put(thing("pail", "pail", "byre"), [0, 1]),
        put(thing("hoof", "hoof", "byre"), [0, 0]),
      ],
      [
        who("player", "person", "byre", { where: [0, 1], holds: ["meal"] }),
        // A stranger's hands frighten her; the old cow has known a hundred milkers.
        who("heifer", "cow", "byre", {
          where: [0, 0],
          feels: { player: { fear: 2, anger: 0, trust: 0 } },
        }),
        who("old", "cow", "byre", { where: [4, 0], needs: { hunger: 1 } }),
        who("calf", "calf", "byre", { where: [0, 5] }),
      ],
      EXTRA,
    ),
    "heifer",
    "calf",
  );
  const seen = noticed(byre);
  const kick = (patient: string): Act => ({
    process: "force",
    by: "heifer",
    instrument: "hoof",
    patient,
    manner: { effort: 4, care: 1, haste: 4 },
  });
  const strikesOut = (id: string) => {
    const cow = seen.bodies[id];
    const made = cow ? offers(seen, cow) : [];
    return made.some((o) => o.intent === "attack" && o.toward === "player");
  };

  it("farm-02: handled by the same stranger, the frightened heifer may strike out, and the old cow stands quiet", () => {
    expect(strikesOut("heifer")).toBe(true);
    expect(strikesOut("old")).toBe(false);
  });

  it.fails("farm-02: her kick sends the pail across the byre (force breaks or mars what it strikes and never moves it: X1's push and throw are absent, and a pail has no contents, S8, to spill)", () => {
    const after = resolve(seen, kick("pail")).world;
    expect(strayed(seen, after, "pail")).toBe(true);
  });

  it("farm-02: a kick that lands on the milker bruises a shin, and no worse", () => {
    const { changes } = resolve(seen, kick("player"));
    const wounds = changes.flatMap((c) => (c.kind === "wound" ? [c.wound] : []));
    expect(wounds.length).toBe(1);
    expect(wounds[0]?.depth).toBeGreaterThan(0);
    expect(wounds[0]?.depth).toBeLessThan(2);
  });

  it("farm-02: with meal set in the manger before her, she is a little less afraid of this person and trusts them a little more", () => {
    const after = resolve(seen, { process: "take", body: "player", thing: "meal", drop: true });
    const feels = after.world.bodies.heifer?.feels?.player;
    expect(feels?.fear).toBeLessThan(2);
    expect(feels?.trust).toBeGreaterThan(0);
  });
});

describe("farm-03: salting down the pig in a mild spell", () => {
  const trough = world(
    [
      thing("flitch", "flitch", "pantry"),
      thing("bare", "flitch", "pantry"),
      thing("ham", "ham", "pantry"),
      thing("offal", "meat", "pantry"),
      thing("cold", "meat", "coldpantry"),
      thing("salt", "salt", "pantry", { amount: 50 }),
    ],
    [],
    EXTRA,
  );
  const rub = (target: string): Act => ({
    process: "coat",
    substance: "salt",
    target,
    amount: 0.5,
    manner: { effort: 3, care: 4, haste: 1 },
  });
  const salted = play(trough, [rub("flitch"), rub("ham")]).world;
  const fortnight = resolve(salted, days(14)).world;

  it.fails("farm-03: stuck with the knife, the pig is dead within minutes (a wound bleeds health away over hours and nothing is ever dead at a stroke: a body has no vitals for a blade to reach)", () => {
    const yard = world(
      [thing("knife", "blade", "farmyard", { edge: 4 })],
      [who("player", "person", "farmyard"), who("pig", "pig", "farmyard")],
      EXTRA,
    );
    const stuck = play(yard, [
      {
        process: "force",
        by: "player",
        instrument: "knife",
        patient: "pig",
        manner: { effort: 4, care: 3, haste: 2 },
      },
      minutes(10),
    ]).world;
    expect(stuck.bodies.pig?.health ?? 5).toBeLessThanOrEqual(0);
  });

  it("farm-03: the offal will not keep: unsalted it is going off within days, where the salted flitch is sound a fortnight on", () => {
    expect(resolve(salted, days(3)).world.things.offal?.state.contamination).toBeGreaterThan(2);
    expect(fortnight.things.flitch?.state.contamination).toBeLessThan(0.5);
  });

  it("farm-03: the salt draws the water out of the meat it is rubbed into", () => {
    const three = resolve(salted, days(3)).world;
    const [dry, wet] = [three.things.flitch?.state.wetness, three.things.bare?.state.wetness];
    expect((wet ?? 0) - (dry ?? 9)).toBeGreaterThan(0.5);
  });

  it("farm-03: warmth sets the pace of spoiling: in the mild pantry unsalted meat turns far faster than in the cold one the season should have given", () => {
    const half = resolve(trough, hours(12)).world;
    const [mild, cold] = [half.things.offal, half.things.cold];
    expect(mild?.state.contamination ?? 0).toBeGreaterThan((cold?.state.contamination ?? 9) * 1.5);
  });

  it.fails("farm-03: in this mild spell the thick ham taints at the bone before the salt gets there, while the thin flitch cures sound (a coat is one coverage over the whole thing and stops rot all through at once: nothing has a depth for salt to travel in or for rot to start in)", () => {
    const [ham, flitch] = [fortnight.things.ham, fortnight.things.flitch];
    expect((ham?.state.contamination ?? 0) - (flitch?.state.contamination ?? 0)).toBeGreaterThan(1);
  });
});

describe("farm-04: rats in the granary loft", () => {
  const granary = (cat: string) =>
    world(
      [
        thing("board", "floorboard", "loft"),
        thing("bin", "grain", "loft", { amount: 40 }),
        thing("sack", "wheatsack", "loft"),
        thing("rat.hands", "gnawteeth", "loft", { edge: 3 }),
        thing("cat.hands", "fangs", cat, { edge: 3 }),
      ],
      [who("rat", "rat", "loft"), who("mate", "rat", "loft"), who("cat", "cat", cat)],
      EXTRA,
    );
  const loft = noticed(granary("cartshed"));
  const gnaw = (patient: string, effort: number): Act => ({
    process: "force",
    by: "rat",
    instrument: "rat.hands",
    patient,
    manner: { effort, care: 2, haste: 2 },
  });

  it.fails("farm-04: night after night of gnawing takes the rats up through an inch board (teeth wear like any edge and nothing that lives renews them: they are blunt within a few bites, long before the board is through)", () => {
    const after = play(loft, times(300, gnaw("board", 4))).world;
    expect(after.things.board?.state.integrity).toBeLessThanOrEqual(3);
  });

  it("farm-04: a hungry rat in the loft finds the grain by its nose and eats of it", () => {
    const { choice, world: after } = acts(loft, "rat");
    expect(choice?.intent).toBe("eat_drink");
    const grain = (w: MatterWorld) =>
      (w.things.bin?.state.amount ?? 0) + (w.things.sack?.state.amount ?? 0);
    expect(grain(after)).toBeLessThan(grain(loft));
    expect(after.bodies.rat?.needs.hunger ?? 9).toBeLessThan(loft.bodies.rat?.needs.hunger ?? 0);
  });

  it.fails("farm-04: they foul far more than they eat: the grain they have been at is tainted (eating takes an amount and leaves the rest as it was: a body gives nothing off behind it, no droppings and no urine)", () => {
    let at = loft;
    for (let n = 0; n < 5; n++) at = acts(at, "rat").world;
    const bin = at.things.bin?.state;
    expect((bin?.contamination ?? 0) + (bin?.taint ?? 0)).toBeGreaterThan(0);
  });

  it("farm-04: their teeth go through sacking easily: a corner gnawed at is soon the worse for it", () => {
    const after = play(loft, times(40, gnaw("sack", 2))).world;
    expect(after.things.sack?.state.integrity).toBeLessThan(4);
  });

  it.fails("farm-04: and grain runs out of the holed sack onto the floor (a sack of wheat is one thing: S8, contents, is absent, so a hole lets nothing out, and a cut through makes no piece)", () => {
    const after = play(loft, times(40, gnaw("sack", 2))).world;
    const spilled = Object.keys(after.things).length > Object.keys(loft.things).length;
    expect(spilled || (after.things.sack?.state.amount ?? 1) < 1).toBe(true);
  });

  it.fails("farm-04: well fed and sheltered, the pair has bred many more by the end of winter (no body is ever born: X7's breeding is absent, and a group has no count to grow)", () => {
    const spring = resolve(loft, days(120)).world;
    const rats = Object.values(spring.bodies).filter((b) => b.element === "rat");
    expect(rats.length).toBeGreaterThan(2);
  });

  it("farm-04: shut out of the loft the cat can do nothing about them, and let in, hungry, it goes for one", () => {
    const outside = loft.bodies.cat;
    const toward = (outside ? offers(loft, outside) : []).map((o) => o.toward);
    expect(toward.includes("rat") || toward.includes("mate")).toBe(false);
    const { choice } = acts(noticed(granary("loft")), "cat");
    expect(choice?.intent).toBe("attack");
    expect(["rat", "mate"]).toContain(choice?.toward);
  });
});

describe("farm-05: the fox and the open pop-hole", () => {
  const roost = (vixenAt: string, hunger: number) =>
    noticed(
      world(
        [thing("vixen.hands", "fangs", vixenAt, { edge: 3 })],
        [
          who("vixen", "fox", vixenAt, { needs: { hunger } }),
          who("hen1", "hen", "henhouse", { attention: "asleep", needs: { hunger: 1 } }),
          who("hen2", "hen", "henhouse", { attention: "asleep", needs: { hunger: 1 } }),
          who("hen3", "hen", "henhouse", { attention: "asleep", needs: { hunger: 1 } }),
        ],
        EXTRA,
      ),
    );
  const inside = roost("henhouse", 3);
  const bite: Act = {
    process: "force",
    by: "vixen",
    instrument: "vixen.hands",
    patient: "hen1",
    manner: { effort: 4, care: 1, haste: 4 },
  };

  it.fails("farm-05: the board left unslid, the vixen trying the yard gets into the henhouse (a move is within one place: there is no way from one place to another, and R6, an opening that is open or shut, is absent)", () => {
    expect(left(roost("nightyard", 3), "vixen", 5).bodies.vixen?.place).toBe("henhouse");
  });

  it("farm-05: inside with the roosting birds in the dark, the hungry vixen finds them by nose and goes for one", () => {
    const { choice } = acts(inside, "vixen");
    expect(choice?.intent).toBe("attack");
    expect(["hen1", "hen2", "hen3"]).toContain(choice?.toward);
  });

  it.fails("farm-05: she kills far more than she can eat: with her hunger gone she still goes for whatever flutters (a hunter is offered quarry only by its own hunger in intents.ts: the prey's panic is no input)", () => {
    const fed = roost("henhouse", 0);
    const vixen = fed.bodies.vixen;
    const made = vixen ? offers(fed, vixen) : [];
    expect(made.some((o) => o.intent === "attack")).toBe(true);
  });

  it.fails("farm-05: bitten through the neck, a hen is dead (a wound bleeds health away over hours and nothing is ever dead at a stroke: a body has no vitals for teeth to reach)", () => {
    const after = play(inside, [bite, minutes(10)]).world;
    expect(after.bodies.hen1?.health ?? 5).toBeLessThanOrEqual(0);
  });

  it.fails("farm-05: she carries one hen off (take holds things: a body, quick or dead, is never a thing to carry, and the dead leave no carcass)", () => {
    const after = play(inside, [bite, { process: "take", body: "vixen", thing: "hen1" }]).world;
    expect(after.bodies.vixen?.holds ?? []).toContain("hen1");
  });

  it.fails("farm-05: the birds wake in a panic, and the survivors are left in a fright of her (nothing wakes a sleeper: attention is never written, and a bite on a body makes no sound at all, the sound rule being of things struck, so no deed reaches the roosting birds)", () => {
    const after = resolve(inside, bite).world;
    expect(after.bodies.hen2?.feels?.vixen?.fear ?? 0).toBeGreaterThan(0);
  });
});

describe("farm-06: a fence post set too shallow", () => {
  const fence = world(
    [
      thing("shallow", "ashpost", "pasture"),
      thing("deep", "ashpost", "pasture"),
      // A sheep tries a fence with its nose: a small part of its weight.
      thing("nudge", "sheep", "pasture", { amount: 0.05 }),
      // A cow scratching leans all her half ton into it.
      thing("lean", "cow", "pasture"),
    ],
    [],
    EXTRA,
  );
  const pressed = (support: string, by: string) =>
    resolve(fence, { process: "load", support, bearing: [by] }).world.things[support]?.state
      .integrity;

  it("farm-06: the mended fence turns the sheep: the post bears a nose pushed against it", () => {
    expect(pressed("shallow", "nudge")).toBe(5);
  });

  it.fails("RULE ERROR: farm-06: the cow never breaks the post: it stands on the day, and when it goes it lies over whole (load knows only the support's own strength, and no pole of a bough's size bears a cow: she snaps a sound post at the first lean, there being no ground for it to give in instead)", () => {
    expect(pressed("shallow", "lean")).toBe(5);
  });

  it.fails("farm-06: set knee deep in loose earth it goes over under her, where set thigh deep and rammed it would have stood (how a post is set is no state: R4, joined to, and R10, fit, are absent, so two posts of one row are one post)", () => {
    expect(pressed("shallow", "lean")).toBeLessThanOrEqual(1);
    expect(pressed("deep", "lean")).toBe(5);
  });

  it("farm-06: green ash in the ground is sound a month on, and has rotted through within three years", () => {
    const set = world([thing("post", "ashpost", "postground")], [], EXTRA);
    expect(resolve(set, days(30)).world.things.post?.state.integrity).toBeGreaterThan(4);
    expect(resolve(set, days(3 * 365)).world.things.post?.state.integrity).toBeLessThanOrEqual(1);
  });
});

describe("farm-07: stooks in a week of warm drizzle", () => {
  const field = (place: string) =>
    world(
      [
        thing("stook", "stook", place, { wetness: 1 }),
        thing("band", "strawband", place, { wetness: 1 }),
      ],
      [],
      EXTRA,
    );
  const wetWeek = resolve(field("drizzle"), days(7)).world;
  const dryWeek = resolve(field("harvestfield"), days(7)).world;

  it.fails("RULE ERROR: farm-07: a stook sheds a shower, and it takes days of wet to soak it through (wetting in drift-rules.ts is a fifth of a level a minute for anything, up to all the place will put in it: an hour's drizzle leaves the stook as wet as the week does)", () => {
    const shower = resolve(field("drizzle"), hours(1)).world;
    expect(shower.things.stook?.state.wetness ?? 9).toBeLessThan(
      (wetWeek.things.stook?.state.wetness ?? 0) / 2,
    );
  });

  it("farm-07: the week of warm wet leaves the corn spoiled, where a dry windy week would have left it sound (by rot, S9: sprouting itself, S12, is not built)", () => {
    expect(wetWeek.things.stook?.state.contamination).toBeGreaterThan(3);
    expect(dryWeek.things.stook?.state.contamination).toBeLessThan(1);
  });

  it("farm-07: the straw bands are the weaker for the wet week", () => {
    const [wet, dry] = [wetWeek.things.band, dryWeek.things.band];
    expect(wet ? strength(wetWeek, wet) : 9).toBeLessThan(dry ? strength(dryWeek, dry) : 0);
  });

  it("farm-07: pigeons work over the fallen sheaves, and there is less grain for it", () => {
    const fallen = noticed(
      world(
        [thing("sheaves", "sheaf", "drizzle", { amount: 8 })],
        [who("pigeon", "pigeon", "drizzle")],
        EXTRA,
      ),
    );
    const { choice, world: after } = acts(fallen, "pigeon");
    expect(choice?.intent).toBe("eat_drink");
    expect(after.things.sheaves?.state.amount).toBeLessThan(8);
  });

  it("farm-07: on the dry windy day, sheaves pulled apart and stood to the air are dry by evening, and a stook left as it stood is not", () => {
    const soaked = wetWeek.things.stook?.state.wetness ?? 0;
    const reset = world(
      [
        thing("stook", "stook", "harvestfield", { wetness: soaked }),
        thing("sheaf", "sheaf", "harvestfield", { wetness: soaked }),
      ],
      [],
      EXTRA,
    );
    const evening = resolve(reset, hours(12)).world;
    const [opened, shut] = [
      evening.things.sheaf?.state.wetness,
      evening.things.stook?.state.wetness,
    ];
    expect((shut ?? 0) - (opened ?? 9)).toBeGreaterThan(0.5);
  });
});

describe("farm-08: threshing, and winnowing in still air", () => {
  const floor = (place: string) =>
    world(
      [
        thing("sheaves", "sheaf", place, { amount: 24 }),
        thing("flail", "flail", place),
        put(thing("corn", "grain", place, { amount: 6 }), [0, 0]),
        put(thing("chaff", "chaff", place, { amount: 6 }), [0, 0]),
      ],
      [who("player", "person", place)],
      EXTRA,
    );
  const thresh: Act = {
    process: "force",
    by: "player",
    instrument: "flail",
    patient: "sheaves",
    manner: { effort: 3, care: 2, haste: 2 },
  };

  it.fails("farm-08: flailed, the sheaves give up loose grain and chaff and leave threshed straw (a blow breaks what is brittle and mars what is not: a sheaf is one thing, and nothing comes apart into what it is made of)", () => {
    const before = floor("stillfloor");
    const after = play(before, times(50, thresh)).world;
    expect(Object.keys(after.things).length).toBeGreaterThan(Object.keys(before.things).length);
  });

  it.fails("farm-08: tossed in a breeze through both doors, the chaff is carried aside while the grain drops straight (wind is a level that dries and chills and carries nothing: R7 and a flow's push are absent, and buoyancy and mass are read by no rule of the air)", () => {
    const before = floor("breezyfloor");
    const after = resolve(before, minutes(10)).world;
    expect(strayed(before, after, "chaff")).toBe(true);
    expect(strayed(before, after, "corn")).toBe(false);
  });

  it.fails("farm-08: a morning at the flail leaves the thresher's arms dead (tiredness comes with the hours and nothing else: no act costs a body effort)", () => {
    expect(wearies(floor("stillfloor"), "player", thresh, 100, 240)).toBeGreaterThan(0.5);
  });
});

describe("farm-09: a loaded cart in a poached gateway", () => {
  const field = world(
    [
      thing("cart", "tipcart", "headland"),
      thing("full", "turnips", "headland"),
      thing("half", "turnips", "headland", { amount: 0.5 }),
      thing("spilt", "turnips", "gateway", { amount: 0.5 }),
      thing("firm", "turf", "headland", { wetness: 3 }),
      thing("slough", "mud", "gateway", { amount: 100, wetness: 5 }),
      thing("brush", "brushwood", "gateway", { amount: 6 }),
      thing("whip", "whip", "gateway"),
    ],
    [who("player", "person", "gateway"), who("horse", "horse", "gateway")],
    EXTRA,
  );
  const on = (support: string, bearing: string[]): Act => ({ process: "load", support, bearing });
  const held = (support: string, bearing: string[]) =>
    resolve(field, on(support, bearing)).world.things[support]?.state.integrity;
  const whipUp: Act = { process: "force", by: "player", instrument: "whip", patient: "horse" };

  it("farm-09: the firm headland bears the full load, and the gateway mud gives way under it", () => {
    expect(held("firm", ["cart", "full"])).toBe(5);
    expect(held("slough", ["cart", "full"])).toBeLessThanOrEqual(1);
  });

  it.fails("farm-09: with half the load thrown off and brushwood laid under the wheels, the cart is borne and comes out (a load rests on one support, judged alone: brushwood over mud is no one thing, and a bundle of sticks bears a cart no better than it would across a gap)", () => {
    expect(held("brush", ["cart", "half"])).toBe(5);
  });

  it("farm-09: whipped, the horse trusts the carter less and fears him more", () => {
    const feels = resolve(field, whipUp).world.bodies.horse?.feels?.player;
    expect(feels?.trust).toBeLessThan(0);
    expect(feels?.fear).toBeGreaterThan(0);
  });

  it.fails("farm-09: plunging and straining at a cart that will not move leaves the horse blown (tiredness comes with the hours and nothing else: no act costs a body effort, and straining is no act)", () => {
    expect(wearies(field, "horse", whipUp, 10, 10)).toBeGreaterThan(0.5);
  });

  it("farm-09: the turnips thrown off into the gateway are filthy with its mud", () => {
    const after = resolve(field, { process: "coat", substance: "slough", target: "spilt" }).world;
    expect(after.things.spilt?.state.coating?.element).toBe("mud");
  });

  it.fails("farm-09: the gateway is the worse for the next load: the ruts are deeper (no act touches a place: E13 is absent, and a place has no ground to rut)", () => {
    const after = resolve(field, on("slough", ["cart", "full"])).world;
    expect(after.places.gateway).not.toEqual(field.places.gateway);
  });
});

describe("farm-10: fresh hen dung on seedlings", () => {
  const bed = world(
    [
      thing("row", "seedling", "garden"),
      thing("ends", "seedling", "garden"),
      put(thing("dung", "hendung", "garden", { amount: 4 }), [0, 0]),
      thing("can", "water", "garden", { amount: 10 }),
    ],
    [who("player", "person", "garden", { where: [8, 0] })],
    EXTRA,
  );
  const spread = play(bed, [
    {
      process: "coat",
      substance: "dung",
      target: "row",
      amount: 1,
      manner: { effort: 2, care: 1, haste: 2 },
    },
    { process: "soak", liquid: "can", target: "row", amount: 1 },
  ]).world;
  const four = resolve(spread, days(4)).world;

  it("farm-10: the fresh dung stinks across the garden", () => {
    expect(smelt(noticed(bed), "player", "dung")).toBeGreaterThan(0);
  });

  it.fails("farm-10: dunged thick and watered in, the seedlings are scorched within days, far worse off than those that got none (noxiousness harms only a body that eats it: there is no route by touch or by root, P17, and a plant has no health to lose)", () => {
    const [dunged, spared] = [four.things.row?.state, four.things.ends?.state];
    const worse =
      (dunged?.contamination ?? 0) - (spared?.contamination ?? 0) > 1 ||
      (spared?.integrity ?? 5) - (dunged?.integrity ?? 5) > 1;
    expect(worse).toBe(true);
  });

  it.fails("RULE ERROR: farm-10: the seedlings that got none stay sound and grow on (what grows is dead matter to drift: S12 is absent, so living seedlings in their bed rot like cut greens left out, and are far gone in four days)", () => {
    expect(four.things.ends?.state.contamination).toBeLessThan(1);
  });

  it.fails("RULE ERROR: farm-10: heaped for six months, the same dung is milder than it was fresh (rot only ever adds noxiousness, M4: nothing mellows or is spent in rotting, so the old heap is fiercer than the new)", () => {
    const heap = world([thing("heap", "hendung", "yardend", { amount: 8 })], [], EXTRA);
    const old = resolve(heap, days(180)).world;
    const [fresh, aged] = [heap.things.heap, old.things.heap];
    expect(aged ? effective(old, aged).noxiousness : 9).toBeLessThan(
      fresh ? effective(heap, fresh).noxiousness : 0,
    );
  });
});

describe("farm-12: the cob in the feed store", () => {
  const night = (cobAt: string, hunger: number) =>
    noticed(
      world(
        [thing("oats", "grain", "feedstore", { amount: 40 })],
        [who("cob", "horse", cobAt, { needs: { hunger } })],
        EXTRA,
      ),
    );

  it.fails("farm-12: loose in the yard, the cob works the drop latch and lets himself into the feed store (a move is within one place: there is no way from one place to another, and no door or latch, R6, to be lifted)", () => {
    expect(left(night("stableyard", 3), "cob", 5).bodies.cob?.place).toBe("feedstore");
  });

  it("farm-12: with the open bin before him he goes on eating when he is full", () => {
    const full = night("feedstore", 0);
    const { choice, world: after } = acts(full, "cob");
    expect(choice?.intent).toBe("eat_drink");
    expect(after.things.oats?.state.amount).toBeLessThan(40);
  });

  it.fails("farm-12: five rations of grain at once make him ill, colic that day and founder two days on, where one ration is only his feed (harm in body.ts is noxiousness times amount: wholesome food in any excess does nothing, so no sickness is set to come on)", () => {
    const store = night("feedstore", 3);
    const gorged = play(store, [
      { process: "ingest", body: "cob", thing: "oats", amount: 5 },
      days(2),
    ]).world.bodies.cob;
    expect((gorged?.sickness ?? 0) > 0 || (gorged?.health ?? 5) < 5).toBe(true);
  });
});

describe("farm-13: mowing with a scythe", () => {
  const sward = (edge: number, wetness: number) =>
    world(
      [
        thing("scythe", "scythe", "meadow", { edge }),
        thing("grass", "grass", "meadow", { wetness }),
        put(thing("hidden", "stone", "meadow"), [2, 0]),
        thing("whet", "stone", "meadow"),
      ],
      [who("player", "person", "meadow", { where: [0, 0] })],
      EXTRA,
    );
  const [DRY, DEWY] = [3, 4];
  const swing = (patient: string): Act => ({
    process: "force",
    by: "player",
    instrument: "scythe",
    patient,
  });
  const edgeOf = (w: MatterWorld) => w.things.scythe?.state.edge ?? 0;

  /** Fresh grass for every stroke, the same blade going on: strokes until one fails to cut. */
  function strokesUntilDull(wetness: number): number {
    let edge = 4;
    for (let n = 0; n < 1000; n++) {
      const after = resolve(sward(edge, wetness), swing("grass")).world;
      if ((after.things.grass?.state.integrity ?? 5) >= 5) return n;
      edge = edgeOf(after);
    }
    return 1000;
  }

  it("farm-13: fresh whetted, the blade lays the grass at a stroke, and every stroke takes a little off the edge", () => {
    const after = resolve(sward(4, DRY), swing("grass")).world;
    expect(after.things.grass?.state.integrity).toBe(0);
    expect(edgeOf(after)).toBeLessThan(4);
  });

  it("farm-13: pushed on without whetting, after some minutes of strokes the blade no longer cuts", () => {
    const strokes = strokesUntilDull(DRY);
    expect(strokes).toBeGreaterThan(20);
    expect(strokes).toBeLessThan(1000);
  });

  it("farm-13: the blade goes further in dewy grass than in dry before it stops cutting", () => {
    expect(strokesUntilDull(DEWY)).toBeGreaterThan(strokesUntilDull(DRY));
  });

  it.fails("farm-13: a minute with the whetstone brings the edge back (no act raises S5: force only wears an edge, and a stone worked along a blade barely marks it and chips itself)", () => {
    const hone: Act = { process: "force", instrument: "whet", patient: "scythe", aim: "surface" };
    const after = play(sward(1, DRY), times(20, hone)).world;
    expect(edgeOf(after)).toBeGreaterThan(1);
  });

  it("farm-13: one stroke into the hidden stone takes more off the edge than ten through grass", () => {
    const meadow = sward(4, DRY);
    const onStone = 4 - edgeOf(resolve(meadow, swing("hidden")).world);
    const onGrass = 4 - edgeOf(resolve(meadow, swing("grass")).world);
    expect(onStone).toBeGreaterThan(onGrass * 10);
  });

  it.fails("RULE ERROR: farm-13: the stone lies hidden in the sward, and the mower does not see it (sense.ts hides a thing only by the place's cover, which hides everything there alike: R5, what covers what, is absent, so a stone under thigh high grass is seen two paces off)", () => {
    expect(noticed(sward(4, DRY)).bodies.player?.aware?.hidden).toBeUndefined();
  });

  it.fails("farm-13: an hour's mowing tires the mower more than an hour stood in the meadow (tiredness comes with the hours and nothing else: no act costs a body effort, keen blade or dull)", () => {
    expect(wearies(sward(4, DRY), "player", swing("grass"), 100, 60)).toBeGreaterThan(0.5);
  });
});

describe("farm-14: twin lambs on a night of sleet", () => {
  const slope = bonded(
    bonded(
      world(
        [],
        [
          who("ewe", "sheep", "sleetfield"),
          // Licked dry, up and sucking.
          who("first", "lamb", "sleetfield", { needs: { hunger: 1 } }),
          // Born while she was busy with the first: a few licks, still wet, unfed.
          who("second", "lamb", "sleetfield", { wetness: 4 }),
        ],
        EXTRA,
      ),
      "ewe",
      "first",
    ),
    "ewe",
    "second",
  );
  const hour = resolve(slope, hours(1)).world;
  const coldOf = (w: MatterWorld, id: string) => w.bodies[id]?.needs.warmth ?? 0;
  const chilled: Partial<Body> = { wetness: 5, needs: { hunger: 3, warmth: 3 } };

  it("farm-14: in the sleet the lamb left wet chills faster than the one licked dry", () => {
    expect(coldOf(hour, "second")).toBeGreaterThan(coldOf(hour, "first") * 1.2);
  });

  it.fails("RULE ERROR: farm-14: the first lamb, licked dry and fed, is little the worse for its first hour (sleet wets a body through at a tenth of a level a minute whatever was done for it, and nothing it sucks warms it: dry or wet at birth, both are badly chilled within the hour)", () => {
    expect(coldOf(hour, "first")).toBeLessThan(1);
  });

  it.fails("farm-14: on his round the shepherd's lantern shows him the lamb lying flat a few paces off (a light is seen and lights nothing: R8, light on, is absent, so on a dark night a lantern shows only itself)", () => {
    const round = noticed(
      lit(
        world(
          [put(thing("lantern", "lantern", "sleetfield"), [0, 0])],
          [
            who("shepherd", "person", "sleetfield", { where: [0, 0] }),
            who("second", "lamb", "sleetfield", { where: [6, 0], ...chilled }),
          ],
          EXTRA,
        ),
        "lantern",
      ),
    );
    expect(round.bodies.shepherd?.aware?.second).toBeDefined();
  });

  it("farm-14: laid by the kitchen hearth and given warm milk it is warm and fed by dawn, where left in the field it would be cold to the bone and failing", () => {
    const hearth = lit(
      world(
        [
          put(thing("fire", "firewood", "kitchen", { amount: 3 }), [1, 0]),
          thing("milk", "ewemilk", "kitchen", { temperature: 3 }),
        ],
        [who("second", "lamb", "kitchen", { where: [0, 0], ...chilled })],
        EXTRA,
      ),
      "fire",
    );
    const saved = play(hearth, [{ process: "ingest", body: "second", thing: "milk" }, hours(5)])
      .world.bodies.second;
    expect(saved?.needs.warmth ?? 9).toBeLessThan(1);
    expect(saved?.needs.hunger ?? 9).toBeLessThan(3);
    const field = world([], [who("second", "lamb", "sleetfield", chilled)], EXTRA);
    const lost = resolve(field, hours(5)).world.bodies.second;
    expect(lost?.needs.warmth ?? 0).toBeGreaterThanOrEqual(4);
    expect(lost?.health ?? 5).toBeLessThan(5);
  });

  it.fails("farm-14: found an hour later it would have been dead (cold to the bone takes health at a quarter of a level an hour in living.ts: a night of sleet does not kill, and nothing is ever dead)", () => {
    const late = resolve(slope, hours(2)).world;
    expect(late.bodies.second?.health ?? 5).toBeLessThanOrEqual(0);
  });

  it.fails("farm-14: back from the kitchen it smells wrong to the ewe, and she holds it less dear than she did (a bond is a row the world is given: nothing makes, weakens or breaks one, and scent is no part of it)", () => {
    const back = resolve(slope, hours(5)).world;
    expect(bondTo(back, "ewe", "second")).toBeLessThan(bondTo(slope, "ewe", "second"));
  });
});

describe("farm-15: churning cold cream", () => {
  it("farm-15: stood near the kitchen fire for a while, the stone cold cream comes up to the warmth of a mild day and no hotter", () => {
    const kitchen = lit(
      world(
        [
          thing("fire", "firewood", "kitchen", { amount: 3 }),
          thing("cream", "cream", "kitchen", { temperature: 1 }),
        ],
        [],
        EXTRA,
      ),
      "fire",
    );
    const warmed = resolve(kitchen, {
      process: "heat",
      source: "fire",
      target: "cream",
      minutes: 30,
      contact: 0.3,
    }).world;
    expect(warmed.things.cream?.state.temperature).toBeGreaterThanOrEqual(2);
    expect(warmed.things.cream?.state.temperature).toBeLessThanOrEqual(3);
  });

  it.fails("farm-15: two hours at the plunger leave the churner's arms aching (tiredness comes with the hours and nothing else: no act costs a body effort)", () => {
    const dairy = world(
      [thing("plunger", "plunger", "dairy"), thing("cream", "cream", "dairy", { temperature: 1 })],
      [who("player", "person", "dairy")],
      EXTRA,
    );
    const plunge: Act = {
      process: "force",
      by: "player",
      instrument: "plunger",
      patient: "cream",
    };
    expect(wearies(dairy, "player", plunge, 100, 120)).toBeGreaterThan(0.5);
  });

  it("farm-15: washed in cold water and worked with salt the butter keeps for weeks, where left as it came it has turned within the week", () => {
    const shelf = world(
      [
        thing("plain", "butter", "dairy"),
        thing("kept", "butter", "dairy"),
        thing("well", "water", "dairy", { amount: 10, temperature: 1 }),
        thing("salt", "salt", "dairy"),
      ],
      [],
      EXTRA,
    );
    const worked = play(shelf, [
      { process: "soak", liquid: "well", target: "kept", amount: 1 },
      { process: "coat", substance: "salt", target: "kept" },
    ]).world;
    expect(resolve(worked, days(7)).world.things.plain?.state.contamination).toBeGreaterThan(1.5);
    expect(resolve(worked, days(21)).world.things.kept?.state.contamination).toBeLessThan(0.5);
  });
});
