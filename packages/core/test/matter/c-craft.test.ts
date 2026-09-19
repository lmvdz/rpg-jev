/**
 * Batch C, held out: a settlement's crafts over a year. Each test asserts what the scenario
 * says a sensible person expects, one material step at a time, so that a chain shows where it
 * breaks. `it.fails` marks what the rules cannot produce, or get wrong (`RULE ERROR`), with the
 * reason in brackets. Rows are in `rows-c-craft.ts`, written before anything was run.
 */
import { describe, expect, it } from "vitest";
import {
  type Act,
  alight,
  effective,
  type MatterWorld,
  play,
  resolve,
  strength,
  surfaceTemperature,
} from "../../src/matter/index.ts";
import { body, thing, world } from "./elements.ts";
import { EXTRA } from "./rows-c-craft.ts";

const heat = (source: string, target: string, minutes: number, contact = 1): Act => ({
  process: "heat",
  source,
  target,
  minutes,
  contact,
});
const hours = (n: number): Act => ({ process: "drift", minutes: n * 60 });
const days = (n: number): Act => ({ process: "drift", minutes: n * 1440 });
const bears = (support: string, bearing: string[]): Act => ({ process: "load", support, bearing });
const times = <T>(n: number, x: T): T[] => Array.from({ length: n }, () => x);
/** A world that already has a fire in it: the fuel, burning. */
const lit = (w: MatterWorld, id: string): MatterWorld => {
  const fuel = w.things[id];
  return fuel ? { ...w, things: { ...w.things, [id]: alight(w, fuel) } } : w;
};
const hardness = (w: MatterWorld, id: string) => {
  const t = w.things[id];
  return t ? effective(w, t).hardness : -1;
};
const bearsUpTo = (w: MatterWorld, id: string) => {
  const t = w.things[id];
  return t ? strength(w, t) : -1;
};
const DRIED = { wetness: 0.05, set: true };

describe("craft-01: a pot with a hidden flaw", () => {
  const pit = world(
    [thing("bank", "claybank", "claypit"), thing("spade", "spade", "claypit", { edge: 2 })],
    [],
    EXTRA,
  );

  it("craft-01 dig: half an hour at a clay-bearing pit turns clay up", () => {
    const dug = resolve(pit, {
      process: "search",
      place: "claypit",
      element: "potclay",
      minutes: 30,
      draw: 0.5,
    }).world;
    expect(dug.things["potclay.0"]?.state.amount ?? 0).toBeGreaterThanOrEqual(1);
  });

  it("fixed rule: craft-01 dig: clay dug from a wet pit comes up wet (body.ts search gives birth with FRESH wetness 0 and never reads the element's `moist`, so dug clay is bone dry, and anywhere drier than this pit it sets hard on the first drift; whatever comes into being should be born as wet as its element is)", () => {
    const dug = resolve(pit, {
      process: "search",
      place: "claypit",
      element: "potclay",
      minutes: 30,
      draw: 0.5,
    }).world;
    expect(dug.things["potclay.0"]?.state.wetness ?? 0).toBeGreaterThan(2);
  });

  it.fails("RULE ERROR: craft-01 dig: what the spade lifts out of the bank is there afterwards (force.ts `cutting` with aim surface consumes an eighth of the whole bank in one stroke and creates nothing: the clay is gone; what force takes off a thing should become a thing, as a broken-off piece does, and by the tool's reach against the thing's size)", () => {
    const dug = resolve(pit, {
      process: "force",
      instrument: "spade",
      patient: "bank",
      aim: "surface",
      manner: { effort: 3, care: 2, haste: 2 },
    }).world;
    expect(Object.keys(dug.things).length).toBeGreaterThan(2);
    expect(dug.things.bank?.state.amount ?? 0).toBeGreaterThan(0.99);
  });

  const shelf = world([thing("pot", "potclay")], [], EXTRA);

  it("craft-01 dry: a thrown pot is still damp and soft after a day in the shade, and within the week it has dried hard", () => {
    const nextDay = resolve(shelf, days(1)).world;
    expect(nextDay.things.pot?.state.wetness ?? 0).toBeGreaterThan(1);
    expect(nextDay.things.pot?.state.set).toBe(false);
    const dried = resolve(shelf, days(5)).world;
    expect(dried.things.pot?.state.wetness ?? 9).toBeLessThan(0.3);
    expect(dried.things.pot?.state.integrity).toBe(5);
    expect(hardness(dried, "pot")).toBeGreaterThan(hardness(shelf, "pot") + 1);
  });

  const kiln = lit(
    world(
      [
        thing("pot", "potclay", "hearth", DRIED),
        thing("flawed", "potclay", "hearth", { ...DRIED, flaw: 2 }),
        thing("wood", "firewood", "hearth", { amount: 30 }),
      ],
      [],
      EXTRA,
    ),
    "wood",
  );
  const fired = play(kiln, [heat("wood", "pot", 480), heat("wood", "flawed", 480)]).world;

  it("craft-01 fire: a day's firing brings the batch to full heat and a sound pot comes through whole", () => {
    expect(fired.things.pot?.state.temperature ?? 0).toBeGreaterThanOrEqual(4.5);
    expect(fired.things.pot?.state.integrity).toBe(5);
    expect(fired.things.pot?.state.set).toBe(true);
  });

  it("craft-01 latent: the flawed pot looks the same as the sound one before the firing", () => {
    const [a, b] = [kiln.things.pot, kiln.things.flawed];
    expect(a && b ? effective(kiln, b) : 1).toEqual(a && b ? effective(kiln, a) : 2);
  });

  // Derived since round two of the grown rows (graph/grown.ts): proposed by a model, ratified by Jev.
  it("craft-01 fire: the pot with the pocket in it cracks in the kiln", () => {
    expect(fired.things.flawed?.state.integrity ?? 5).toBeLessThan(5);
  });

  it("fixed rule: craft-01 fire: eight hours of firing burn firewood (heat.ts takes the minutes a burning source gives and takes nothing from its fuel, so thirty logs fire kiln after kiln and are all still there; passing the same hours as a drift instead burns the wood but cools the pots as if they were out in the yard. The minutes a fire gives should come out of its fuel)", () => {
    const before = kiln.things.wood?.state.burning?.fuel ?? 0;
    expect(fired.things.wood?.state.burning?.fuel ?? before).toBeLessThan(before - 400);
  });
});

describe("craft-02: two mistakes at the forge", () => {
  const smithy = lit(
    world(
      [
        thing("bar", "iron"),
        thing("coldbar", "iron"),
        thing("coals", "charcoal", "hearth", { amount: 20 }),
        thing("hammer", "hammer"),
        thing("chisel", "steel", "hearth", { edge: 3 }),
        thing("trough", "water", "hearth", { amount: 50 }),
        thing("sword", "steel", "hearth", { edge: 3 }),
        thing("clean", "steel", "hearth", { edge: 3 }),
      ],
      [],
      EXTRA,
    ),
    "coals",
  );
  const hot = play(smithy, [heat("coals", "bar", 30), heat("coals", "sword", 30)]).world;
  const blow = (patient: string, effort: number, care: number): Act => ({
    process: "force",
    instrument: "hammer",
    patient,
    manner: { effort, care, haste: 4 },
  });

  it("craft-02 heat: half an hour in the coals brings the bar to a working heat, where it is softer and gives more than cold iron", () => {
    expect(hot.things.bar?.state.temperature ?? 0).toBeGreaterThanOrEqual(4.5);
    expect(hardness(hot, "bar")).toBeLessThan(hardness(hot, "coldbar") - 0.5);
  });

  it.fails("RULE ERROR: craft-02 hammer: iron struck cold suffers and iron struck hot does not (force.ts `blow` and `denting` never read what heat has done to the work: twenty hard blows mar the bar at forging heat exactly as much as the cold one, 5 to 4.4, so a day's forging cracks any bar, hot or cold alike. What is softened by heat should take a blow as a change of shape without harm, and grow brittle as it cools below working heat)", () => {
    const hotStruck = play(hot, times(20, blow("bar", 4, 1))).world;
    const coldStruck = play(hot, times(20, blow("coldbar", 4, 1))).world;
    expect(hotStruck.things.bar?.state.integrity ?? 0).toBeGreaterThan(4.9);
    expect(coldStruck.things.coldbar?.state.integrity ?? 5).toBeLessThan(
      hotStruck.things.bar?.state.integrity ?? 0,
    );
  });

  const cutOff = (patient: string): Act => ({
    process: "force",
    instrument: "chisel",
    patient,
    manner: { effort: 3, care: 3, haste: 2 },
  });

  it("craft-02 reforge: a chisel bites far deeper into the bar hot than cold", () => {
    const lossHot = 5 - (resolve(hot, cutOff("bar")).world.things.bar?.state.integrity ?? 5);
    const lossCold =
      5 - (resolve(hot, cutOff("coldbar")).world.things.coldbar?.state.integrity ?? 5);
    expect(lossHot).toBeGreaterThan(lossCold * 2);
  });

  it.fails("craft-02 reforge: cutting the cracked end away leaves a shorter bar and an offcut (a cut only lowers integrity: it never parts a thing into two or takes from its amount, and the chisel is blunt after a few strokes, so the bar is never cut through at all)", () => {
    const cut = play(hot, times(30, cutOff("bar"))).world;
    expect(cut.things.bar?.state.amount ?? 1).toBeLessThan(1);
    expect(Object.keys(cut.things).length).toBeGreaterThan(Object.keys(hot.things).length);
  });

  const quenched = resolve(hot, heat("trough", "sword", 2)).world;

  it("craft-02 quench: plunged hot into the trough the blade is cold in moments, and comes out less tough than one cooled slowly", () => {
    expect(quenched.things.sword?.state.temperature ?? 5).toBeLessThan(3);
    expect(quenched.things.sword?.state.temper ?? 0).toBeGreaterThan(0);
    const [a, b] = [quenched.things.sword, quenched.things.clean];
    expect(a ? effective(quenched, a).toughness : 9).toBeLessThan(
      b ? effective(quenched, b).toughness : 0,
    );
    expect(bearsUpTo(quenched, "sword")).toBeLessThan(bearsUpTo(quenched, "clean"));
  });

  it.fails("craft-02 straighten: hammered straight cold, the blade is weaker than it was before the hammering (nothing a blow does writes S15: the hammer barely marks it and its strength is unchanged)", () => {
    const straightened = play(quenched, times(10, blow("sword", 2, 4))).world;
    expect(bearsUpTo(straightened, "sword")).toBeLessThan(bearsUpTo(quenched, "sword"));
  });
});

describe("craft-03: the hide left unsalted", () => {
  const yard = world(
    [
      thing("hide", "rawhide", "tanyard", {
        coating: { element: "fleshing", amount: 0.3, coverage: 0.9, bond: 3 },
      }),
      thing("bare", "rawhide", "tanyard"),
      thing("salted", "rawhide", "tanyard"),
      thing("cool", "rawhide", "cellar"),
      thing("scraper", "flint", "tanyard", { edge: 3 }),
      thing("salt", "salt", "tanyard", { amount: 2 }),
    ],
    [],
    EXTRA,
  );
  const scrape: Act = {
    process: "force",
    instrument: "scraper",
    patient: "hide",
    aim: "surface",
    manner: { effort: 3, care: 3, haste: 2 },
  };

  it.fails("RULE ERROR: craft-03 scrape: a flint worked over the hide takes the fat and flesh off it and leaves the hide (force.ts `cutting` with aim surface takes from the thing's own amount and never touches what coats it: twenty strokes leave an eighth of the hide, with all of its fat and flesh still on. Working a surface should lift the coat first, against its bond, and what it takes of the thing should be measured against the thing's size)", () => {
    const scraped = play(yard, times(20, scrape)).world;
    expect(scraped.things.hide?.state.amount ?? 0).toBeGreaterThan(0.8);
    expect(scraped.things.hide?.state.coating?.amount ?? 0).toBeLessThan(0.1);
  });

  const salting = resolve(yard, {
    process: "coat",
    substance: "salt",
    target: "salted",
    amount: 0.5,
    manner: { effort: 2, care: 3, haste: 1 },
  }).world;
  const later = resolve(salting, days(2)).world;

  it("craft-03 rot: two warm days turn an unsalted hide, and it stinks; the one salted that evening keeps", () => {
    expect(later.things.bare?.state.contamination ?? 0).toBeGreaterThan(3);
    expect(later.things.salted?.state.contamination ?? 5).toBeLessThan(0.5);
    const [a, b] = [later.things.bare, yard.things.bare];
    expect(a ? effective(later, a).scent : 0).toBeGreaterThan(
      (b ? effective(yard, b).scent : 5) + 1,
    );
  });

  it("craft-03 rot: the same hide in a cold cellar is less far gone after the same two days", () => {
    expect(later.things.cool?.state.contamination ?? 5).toBeLessThan(
      (later.things.bare?.state.contamination ?? 0) - 1,
    );
  });

  it.fails("RULE ERROR: craft-03 latent: what the tanner is told on coming back is that the hide has turned (report.ts names the first two things it sees in a fixed order, and drying and warming come before rot: two days that took the hide from fresh to as rotten as a thing can be are reported as `it dries, it warms`. What is said should be what changed most)", () => {
    const told = resolve(salting, days(2)).changes.find(
      (c) => c.kind === "state" && c.thing === "bare",
    );
    expect(told?.note ?? "").toContain("turns");
  });

  it.fails("craft-03 rot: the turned hide is ruined as leather: weaker than it was (M4 gives rot a smell and a harm when eaten and nothing else: no level of S9 lowers toughness or strength, and the rotten hide, having dried a little, bears more than the fresh one)", () => {
    expect(bearsUpTo(later, "bare")).toBeLessThan(bearsUpTo(yard, "bare"));
  });
});

describe("craft-04: wort soured by the hearth", () => {
  const brewhouse = world(
    [
      thing("wort", "wort", "hearthside", { amount: 20 }),
      thing("cool", "wort", "cellar", { amount: 20 }),
      thing("malt", "malt", "hearthside", { amount: 5 }),
      thing("liquor", "water", "hearthside", { amount: 20, temperature: 4 }),
    ],
    [body("brewer", { place: "hearthside" })],
    EXTRA,
  );

  it("craft-04 mash: hot water poured over the malt soaks it and warms it, and is used up", () => {
    const mashed = play(brewhouse, [
      { process: "soak", liquid: "liquor", target: "malt", amount: 10 },
      heat("liquor", "malt", 60),
    ]).world;
    expect(mashed.things.malt?.state.wetness ?? 0).toBeGreaterThan(2);
    expect(mashed.things.malt?.state.temperature ?? 0).toBeGreaterThan(3);
    expect(mashed.things.liquor?.state.amount ?? 20).toBeLessThanOrEqual(10);
  });

  it.fails("craft-04 mash: mashing makes wort (nothing makes a mixture: soaking wets the grain and the water is simply gone, and no new liquid comes into being)", () => {
    const mashed = resolve(brewhouse, {
      process: "soak",
      liquid: "liquor",
      target: "malt",
      amount: 10,
    }).world;
    expect(Object.keys(mashed.things).length).toBeGreaterThan(Object.keys(brewhouse.things).length);
  });

  const warmDays = resolve(brewhouse, days(3)).world;

  it("craft-04 ferment: what lives in the wort grows far faster by the hearth than in the cellar", () => {
    const aDay = resolve(brewhouse, days(1)).world;
    expect(aDay.things.wort?.state.contamination ?? 0).toBeGreaterThan(
      (aDay.things.cool?.state.contamination ?? 5) * 2,
    );
    expect(warmDays.things.wort?.state.contamination ?? 0).toBeGreaterThan(4);
  });

  it.fails("craft-04 ferment: worked wort is drink: it has some strength in it (M4's second half is not in effective.ts: contamination in a sugary watery thing adds no potency, and there is one S9 with no kind, so a clean ferment and a souring cannot race)", () => {
    const worked = warmDays.things.wort;
    expect(worked ? effective(warmDays, worked).potency : 0).toBeGreaterThan(0);
  });

  it("craft-04 taste: a sip tells and does no harm, and the turned batch smells of it", () => {
    const sipped = resolve(warmDays, {
      process: "ingest",
      body: "brewer",
      thing: "wort",
      amount: 0.05,
    }).world;
    expect(sipped.bodies.brewer?.sickness).toBe(0);
    const turned = warmDays.things.wort;
    expect(turned ? effective(warmDays, turned).scent : 0).toBeGreaterThan(3);
  });

  it.fails("RULE ERROR: craft-04 taste: the soured batch is fit for vinegar: a cupful does not lay the brewer low (M4 in effective.ts makes every unit of S9 noxious whatever it grew in, so a cup of sour wort is sickness 4 of 5 and two points of health the next day, and by the same rule so is any ale. What grows in a sugary liquid sours or strengthens it; what harm S9 does should depend on what it fed on)", () => {
    const drunk = resolve(warmDays, {
      process: "ingest",
      body: "brewer",
      thing: "wort",
      amount: 1,
    });
    expect(drunk.world.bodies.brewer?.sickness ?? 5).toBeLessThan(1.5);
  });
});

describe("craft-05: a slow rise and a hot oven", () => {
  it("craft-05 rise: what lives in the dough grows well under half as fast on a cold morning as on a warm one", () => {
    const rise = (at: string) =>
      resolve(world([thing("dough", "dough", at)], [], EXTRA), hours(4)).world.things.dough?.state
        .contamination ?? 0;
    expect(rise("warmbake")).toBeGreaterThan(rise("coldbake") * 2);
  });

  it.fails("craft-05 rise: risen dough is bigger than it was (S9 makes no gas and nothing scales size: an underrisen loaf and a risen one are the same loaf)", () => {
    const risen = resolve(world([thing("dough", "dough", "warmbake")], [], EXTRA), hours(4)).world;
    const [a, b] = [risen.things.dough, world([thing("dough", "dough")], [], EXTRA).things.dough];
    expect(a ? effective(risen, a).size : 0).toBeGreaterThan(b ? effective(risen, b).size : 9);
  });

  const bakehouse = lit(
    world(
      [
        thing("oven", "oven", "coldbake"),
        thing("wood", "firewood", "coldbake", { amount: 10 }),
        thing("loaf", "dough", "coldbake"),
      ],
      [],
      EXTRA,
    ),
    "wood",
  );
  const rest: Act = { process: "drift", minutes: 10 };
  /** Fired for so long, then the loaf goes straight in; or the fire is raked out and it rests. */
  const baked = (fired: number, minutes: number, rested = false) =>
    play(bakehouse, [
      heat("wood", "oven", fired),
      ...(rested ? [rest] : []),
      heat("oven", "loaf", minutes),
    ]).world.things.loaf;

  it("craft-05 bake: ten minutes in an oven stoked as hot as it goes scorches the crust and leaves the crumb raw", () => {
    const hurried = baked(240, 10);
    expect(hurried ? surfaceTemperature(hurried) : 0).toBeGreaterThanOrEqual(4.5);
    expect(hurried?.state.temperature ?? 5).toBeLessThan(4.5);
    expect(hurried?.state.set).toBe(false);
    expect(hurried?.state.surfaceAbove ?? 0).toBeGreaterThan(0.5);
  });

  it.fails("RULE ERROR: craft-05 stoke: how long the oven was stoked changes what it does to the loaf (heat.ts `shared` weighs the source's surface temperature by its whole heat capacity: an oven fifteen minutes in the flame, 3.9 through, bakes exactly as one fired for hours, 5 through, and heats the loaf hotter than its own bulk. A surface's lead is a skin: a source should give by what its bulk holds)", () => {
    const [brief, long] = [baked(15, 20), baked(240, 20)];
    expect(long?.state.temperature ?? 0).toBeGreaterThan((brief?.state.temperature ?? 0) + 0.1);
  });

  it("fixed rule: craft-05 bake: a loaf given its proper time in a properly fired oven comes out baked and not on fire (heat.ts: a thing sets, cooks and is clean at 4.5, and any source at 4.5 is `glowing` and lights whatever has dried enough to burn, so bake and blaze are one threshold. Straight from the fire the loaf is set and alight by twenty minutes and ash within hours; from a raked and rested oven, 4.6, it never reaches 4.5 and never bakes. Cooking and setting should sit well below the heat that lights a thing, and a hot wall with no flame should char, not kindle)", () => {
    const tellings = [baked(90, 45), baked(90, 45, true), baked(45, 45, true), baked(90, 90, true)];
    expect(tellings.some((loaf) => loaf?.state.set === true && loaf.state.burning === null)).toBe(
      true,
    );
  });
});

describe("craft-06: a thin place in the warp", () => {
  const loom = world(
    [
      thing("sound", "yarn"),
      thing("thin", "yarn", "hearth", { flaw: 2 }),
      thing("weight", "loomweight"),
    ],
    [],
    EXTRA,
  );

  it("craft-06 latent: the thin thread reads the same as the sound one", () => {
    const [a, b] = [loom.things.sound, loom.things.thin];
    expect(a && b ? effective(loom, b) : 1).toEqual(a && b ? effective(loom, a) : 2);
  });

  it.fails("RECALIBRATE (a level of mass became a step of four, cords bear in tension, bulk dries by powers; the assertion's magnitude was set against the old scale): craft-06 snap: under the same weight the sound thread holds and the thin one parts", () => {
    expect(resolve(loom, bears("sound", ["weight"])).world.things.sound?.state.integrity).toBe(5);
    expect(
      resolve(loom, bears("thin", ["weight"])).world.things.thin?.state.integrity,
    ).toBeLessThanOrEqual(1);
  });
});

describe("craft-07: a frame raised green", () => {
  const wood = world(
    [thing("tree", "oaktree", "frameyard"), thing("axe", "steel", "frameyard", { edge: 4 })],
    [],
    EXTRA,
  );
  const chop: Act = {
    process: "force",
    instrument: "axe",
    patient: "tree",
    manner: { effort: 4, care: 2, haste: 3 },
  };

  it("craft-07 fell: one stroke of a keen axe bites a little way into a standing oak, and does not fell it", () => {
    const after = resolve(wood, chop).world.things.tree?.state.integrity ?? 5;
    expect(after).toBeLessThan(5);
    expect(after).toBeGreaterThan(4.5);
  });

  it.fails("RULE ERROR: craft-07 fell: a morning's chopping brings the oak down (force.ts `wear` takes 0.05 x effort squared x (work hardness / tool hardness) squared from the edge at every stroke: steel on oak loses 0.29 of 5 a stroke, so a keen axe is blunt in fourteen strokes with the oak barely scarred, 4.6 of 5, and three hundred more do nothing. No tree can be felled with one sharpening. Wear should be small where the tool is much the harder, so that a tool lasts through its ordinary job)", () => {
    const felled = play(wood, times(300, chop)).world;
    expect(felled.things.tree?.state.integrity ?? 5).toBeLessThanOrEqual(1);
  });

  const frame = world(
    [
      thing("beam", "oaktimber", "frameyard"),
      thing("seasoned", "oaktimber", "frameyard", { wetness: 0.05 }),
    ],
    [],
    EXTRA,
  );

  it("craft-07 dry: nobody touches it and the green timber loses its water to the air; green, it is heavier and weaker than seasoned", () => {
    const summer = resolve(frame, days(120)).world;
    expect(summer.things.beam?.state.wetness ?? 9).toBeLessThan(0.5);
    const [green, dry] = [frame.things.beam, frame.things.seasoned];
    expect(green ? effective(frame, green).mass : 0).toBeGreaterThan(
      dry ? effective(frame, dry).mass : 9,
    );
    expect(bearsUpTo(frame, "beam")).toBeLessThan(bearsUpTo(frame, "seasoned"));
  });

  it.fails("RULE ERROR: craft-07 dry: a week after raising, a hewn oak timber is still green (drift.ts dries water held inside against a `bulk` that is linear in the levels of mass and size, which are doublings: a timber a person cannot lift is bone dry in three days, a day behind a thrown pot and two behind a hide. Seasoning takes this beam months. What water has to cross should count as the thing's bulk does, by powers)", () => {
    const week = resolve(frame, days(7)).world;
    expect(week.things.beam?.state.wetness ?? 0).toBeGreaterThan(1.5);
  });

  it.fails("craft-07 shrink: dried, the timber is narrower than it went in (P22 is on the row and M1's swelling is not in effective.ts: size never moves with wetness, so no joint works loose; and there is no relation to loosen, nor a sag short of cracked)", () => {
    const summer = resolve(frame, days(120)).world;
    const [after, before] = [summer.things.beam, frame.things.beam];
    expect(after ? effective(summer, after).size : 9).toBeLessThan(
      before ? effective(frame, before).size : 0,
    );
  });

  it.fails("RULE ERROR: craft-07 raise: the green lintel bears its own weight on the day it is raised (load.ts: wet, the timber weighs 4.36 and bears 4.35, so it gives way at once, and seasoned it bears itself with room to spare: the scenario's order reversed. It is a hair's breadth and rests on this row; but load.ts says a sound thing bears itself with room to spare, and for a big wet timber it does not)", () => {
    const raised = resolve(frame, bears("beam", ["beam"])).world;
    expect(raised.things.beam?.state.integrity).toBe(5);
  });
});

describe("craft-08: daub short of straw in a hot week", () => {
  const wall = (mix: string, at: string) =>
    world(
      [thing("panel", "wattle", at), thing("mix", mix, at, { amount: 5 }), thing("slab", mix, at)],
      [],
      EXTRA,
    );
  const daubed = (mix: string, at: string) =>
    resolve(wall(mix, at), {
      process: "coat",
      substance: "mix",
      target: "panel",
      amount: 1,
      manner: { effort: 3, care: 1, haste: 4 },
    }).world;

  it("craft-08 daub: a thick coat covers the panel and uses the mix up", () => {
    const coated = daubed("leandaub", "hotweek");
    expect(coated.things.panel?.state.coating?.coverage ?? 0).toBeGreaterThan(0.9);
    expect(coated.things.mix?.state.amount ?? 5).toBeLessThan(4.5);
  });

  it("craft-08 dry: daub dries and sets hard within the hot week, and in a mild one it is still damp", () => {
    const hot = resolve(daubed("leandaub", "hotweek"), days(7)).world;
    const mild = resolve(daubed("leandaub", "hearth"), days(7)).world;
    expect(hot.things.slab?.state.set).toBe(true);
    expect(mild.things.slab?.state.set).toBe(false);
    expect(mild.things.slab?.state.wetness ?? 0).toBeGreaterThan(0.3);
  });

  it.fails("craft-08 crack: dried fast with too little straw, the coat cracks and falls away in patches (a coat has an amount, a coverage and a bond and nothing else: no wetness, no integrity, no shrinking, so nothing ever takes a coat off but washing, and the row's toughness, which is the straw, is never read. A good mix and a lean one are the same coat)", () => {
    const lean = resolve(daubed("leandaub", "hotweek"), days(7)).world;
    expect(lean.things.panel?.state.coating?.coverage ?? 0).toBeLessThan(0.8);
  });

  it("craft-08 control: a well-mixed coat is still all there after the same week", () => {
    const good = resolve(daubed("daub", "hotweek"), days(7)).world;
    expect(good.things.panel?.state.coating?.coverage ?? 0).toBeGreaterThan(0.9);
  });

  it("craft-08 recoat: a second coat goes on over the first and costs as much mix again", () => {
    const again = resolve(resolve(daubed("daub", "hotweek"), days(7)).world, {
      process: "coat",
      substance: "mix",
      target: "panel",
      amount: 1,
    }).world;
    expect(again.things.panel?.state.coating?.amount ?? 0).toBeGreaterThan(1.5);
    expect(again.things.mix?.state.amount ?? 5).toBeLessThanOrEqual(3);
  });
});

describe("craft-09: thin thatch, a damp rafter, a heavy snow", () => {
  const roof = world(
    [
      thing("damp", "pole", "leakyroof"),
      thing("kept", "pole", "soundroof"),
      thing("snow", "snow", "leakyroof", { amount: 5 }),
      thing("rain", "water", "leakyroof", { amount: 50 }),
    ],
    [],
    EXTRA,
  );
  const wetted = resolve(roof, {
    process: "soak",
    liquid: "rain",
    target: "damp",
    amount: 2,
  }).world;
  const winter = resolve(wetted, days(120)).world;

  it("craft-09 rot: a rafter kept damp all winter rots through, and one under sound thatch does not", () => {
    expect(winter.things.damp?.state.wetness ?? 0).toBeGreaterThan(2);
    expect(winter.things.damp?.state.contamination ?? 0).toBeGreaterThan(3);
    expect(winter.things.kept?.state.contamination ?? 5).toBeLessThan(0.3);
  });

  it("craft-09 rot: it takes weeks, not days", () => {
    expect(resolve(wetted, days(3)).world.things.damp?.state.contamination ?? 5).toBeLessThan(1);
  });

  it("craft-09 sag: a sound rafter bears the heavy snowfall", () => {
    expect(resolve(winter, bears("kept", ["snow"])).world.things.kept?.state.integrity).toBe(5);
  });

  it.fails("craft-09 sag: the rotten rafter gives way under the same snow (load.ts reads wetness, corrosion, integrity and S15, and never S9: rot does not weaken what it grows in, so a rafter as rotten as a thing can be bears what a sound wet one bears)", () => {
    expect(bearsUpTo(winter, "damp")).toBeLessThan(bearsUpTo(wetted, "damp") - 0.5);
    expect(
      resolve(winter, bears("damp", ["snow"])).world.things.damp?.state.integrity,
    ).toBeLessThanOrEqual(1);
  });
});

describe("craft-10: a spark on dry thatch", () => {
  const row = (at: string, wetness: number) =>
    lit(
      world(
        [
          thing("spark", "ember", at),
          thing("first", "thatch", at, { wetness }),
          thing("next", "thatch", at, { wetness }),
          thing("far", "thatch", at, { wetness }),
          thing("well", "water", at, { amount: 100 }),
        ],
        [],
        EXTRA,
      ),
      "spark",
    );
  const dry = row("dryrow", 0.05);
  const caught = resolve(dry, heat("spark", "first", 0.5)).world;
  const spread = resolve(caught, heat("first", "next", 5, 0.5)).world;

  it("craft-10 catch: one ember lights tinder-dry thatch within the minute", () => {
    expect(caught.things.first?.state.burning).not.toBeNull();
  });

  it.fails("RULE ERROR: craft-10 catch: the same ember cannot light the same roof soaked by rain (M1 in effective.ts takes 0.8 of wetness from flammability, and soak.ts lets a thing hold no more than 1 + 0.8 x absorbency, so anything that burns readily and drinks little can never be too wet to light: thatch soaked as far as it will drink is still 1.3, takes light from one ember inside a minute, burns three times as long as dry thatch, and burns on through an hour of rain. It is the dryness that makes the scenario. How wet a thing is against how wet it can get should be what quenches it, and a wet surface should have to dry before it lights)", () => {
    const rained = resolve(row("wetrow", 0.05), {
      process: "soak",
      liquid: "well",
      target: "first",
      amount: 5,
    }).world;
    expect(resolve(rained, heat("spark", "first", 1)).world.things.first?.state.burning).toBeNull();
  });

  it("craft-10 spread: the burning roof lights the one built close against it, and not one across the lane", () => {
    expect(spread.things.next?.state.burning).not.toBeNull();
    expect(
      resolve(caught, heat("first", "far", 5, 0.1)).world.things.far?.state.burning,
    ).toBeNull();
  });

  // Derived since round two of the grown rows (graph/grown.ts): proposed by a model, ratified by Jev.
  it("craft-10 spread: the wind carries the fire to a roof it would not reach in still air", () => {
    const reach = (at: string) =>
      play(row(at, 0.05), [heat("spark", "first", 0.5), heat("first", "next", 5, 0.3)]).world.things
        .next?.state.burning ?? null;
    expect(reach("stillrow")).toBeNull();
    expect(reach("dryrow")).not.toBeNull();
  });

  it("craft-10 fight: one bucket hisses and the roof burns on; a chain of them puts it out, and the well is the lower for it", () => {
    const one = resolve(spread, { process: "soak", liquid: "well", target: "next", amount: 1 });
    expect(one.world.things.next?.state.burning).not.toBeNull();
    const chain = resolve(spread, { process: "soak", liquid: "well", target: "next", amount: 30 });
    expect(chain.world.things.next?.state.burning).toBeNull();
    expect(chain.world.things.next?.state.amount).toBe(1);
    expect(chain.world.things.well?.state.amount ?? 100).toBeLessThanOrEqual(70);
  });

  it("craft-10 aftermath: left alone, the two roofs that caught burn through to ash and the third stands", () => {
    const evening = resolve(spread, hours(6)).world;
    expect(evening.things.first).toBeUndefined();
    expect(evening.things.next).toBeUndefined();
    expect(evening.things["first.ash"]).toBeDefined();
    expect(evening.things.far?.state.integrity).toBe(5);
  });
});

describe("craft-11: a rotten rail and a goat", () => {
  const pen = world(
    [
      thing("sound", "rail"),
      thing("rotten", "rail", "hearth", { contamination: 4 }),
      thing("weak", "rail", "hearth", { flaw: 2 }),
      // A lean is part of a goat's weight.
      thing("lean", "goat", "hearth", { amount: 0.5 }),
      thing("grain", "grain", "hearth", { amount: 10 }),
    ],
    [body("goat", { needs: { hunger: 4 } })],
    EXTRA,
  );

  it("craft-11 lean: a sound rail holds a leaning goat; one with a hidden weakness gives way, and the two look alike", () => {
    expect(resolve(pen, bears("sound", ["lean"])).world.things.sound?.state.integrity).toBe(5);
    expect(
      resolve(pen, bears("weak", ["lean"])).world.things.weak?.state.integrity,
    ).toBeLessThanOrEqual(1);
    const [a, b] = [pen.things.sound, pen.things.weak];
    expect(a && b ? effective(pen, b) : 1).toEqual(a && b ? effective(pen, a) : 2);
  });

  it.fails("craft-11 lean: a rail that has rotted gives way under the goat (the scenario's weakness is rot, S9, and load.ts never reads S9: the rotten rail bears exactly what the sound one does. Only a weakness written by hand as S15 is found)", () => {
    expect(bearsUpTo(pen, "rotten")).toBeLessThan(bearsUpTo(pen, "sound"));
    expect(
      resolve(pen, bears("rotten", ["lean"])).world.things.rotten?.state.integrity,
    ).toBeLessThanOrEqual(1);
  });

  it("craft-11 eat: the goat at the sacks is fed, and the grain is the less for it", () => {
    const ate = resolve(pen, { process: "ingest", body: "goat", thing: "grain", amount: 1.5 });
    expect(ate.world.bodies.goat?.needs.hunger ?? 4).toBeLessThan(3);
    expect(ate.world.things.grain?.state.amount ?? 10).toBeLessThan(9);
  });
});

describe("craft-12: grain binned damp", () => {
  const store = (at: string) =>
    world(
      [
        thing("damp", "grain", at, { wetness: 1.5, amount: 100 }),
        thing("dry", "grain", at, { wetness: 0.05, amount: 100 }),
      ],
      [],
      EXTRA,
    );

  it.fails("RULE ERROR: craft-12 heat: shut in a bin, grain that went in damp is still damp a week later, and mouldy in six (drift.ts dries a thing by its row and the place's air and wind, and reads neither how much of it there is nor whether the place is shut: a hundred measures sealed in a bin are bone dry within the day, as a handful spread in the sun would be, and never mould. Water that leaves a thing has to go somewhere: drying should slow with the amount and stop where there is no air to take it)", () => {
    const week = resolve(store("bin"), days(7)).world;
    expect(week.things.damp?.state.wetness ?? 0).toBeGreaterThan(1);
    const opened = resolve(store("bin"), days(42)).world;
    expect(opened.things.damp?.state.contamination ?? 0).toBeGreaterThan(2);
  });

  it("craft-12 control: grain binned dry keeps through the winter", () => {
    const opened = resolve(store("bin"), days(120)).world;
    expect(opened.things.dry?.state.contamination ?? 5).toBeLessThan(0.5);
  });

  it("craft-12 mould: what spoils grain is damp, not a count of months: in a damp undercroft it is mouldy in six weeks", () => {
    const opened = resolve(store("cellar"), days(42)).world;
    expect(opened.things.damp?.state.contamination ?? 0).toBeGreaterThan(3);
  });

  it.fails("craft-12 mould: in that damp undercroft the grain that went in dry fares better than the grain that went in damp (the place's air sets both to the same wetness within minutes and they mould alike: what a thing brought with it counts for nothing once the air has had it an hour)", () => {
    const opened = resolve(store("cellar"), days(14)).world;
    expect(opened.things.dry?.state.contamination ?? 5).toBeLessThan(
      (opened.things.damp?.state.contamination ?? 0) - 0.5,
    );
  });

  // Derived since round two of the grown rows (graph/grown.ts): proposed by a model, ratified by Jev.
  it("craft-12 heat: packed close, the mouldering grain warms itself", () => {
    const opened = resolve(store("cellar"), days(42)).world;
    expect(opened.things.damp?.state.temperature ?? 0).toBeGreaterThan(1.5);
  });
});

describe("craft-13: the well rope parts", () => {
  const well = world(
    [
      thing("rope", "rope"),
      thing("worn", "rope", "hearth", { flaw: 2 }),
      thing("bucket", "bucket"),
      thing("water", "water"),
    ],
    [],
    EXTRA,
  );
  const haul = (rope: string) => bears(rope, ["bucket", "water"]);

  it.fails("RECALIBRATE (a level of mass became a step of four, cords bear in tension, bulk dries by powers; the assertion's magnitude was set against the old scale): craft-13 snap: a sound rope hauls the full bucket; one worn thin somewhere parts under it, loudly, and looked no different", () => {
    expect(resolve(well, haul("rope")).world.things.rope?.state.integrity).toBe(5);
    const parted = resolve(well, haul("worn"));
    expect(parted.world.things.worn?.state.integrity).toBeLessThanOrEqual(1);
    expect(parted.changes.some((c) => c.kind === "signal" && c.channel === "sound")).toBe(true);
    const [a, b] = [well.things.rope, well.things.worn];
    expect(a && b ? effective(well, b) : 1).toEqual(a && b ? effective(well, a) : 2);
  });

  it.fails("craft-13 fray: a year of hauls over the stone lip wears the rope thinner (a load that holds leaves no trace: nothing wears by rubbing, and no act or drift ever writes S15, so the three-hundredth haul is the first)", () => {
    const year = play(well, times(300, haul("rope"))).world;
    expect(bearsUpTo(year, "rope")).toBeLessThan(bearsUpTo(well, "rope"));
  });
});

describe("craft-14: a fever through one cup", () => {
  const cottage = world(
    [thing("foul", "water", "hearth", { contamination: 3 }), thing("cup", "water")],
    [body("kin"), body("well"), body("sick", { sickness: 3, health: 3 })],
    EXTRA,
  );

  it("craft-14 spread: water that carries sickness goes down unnoticed, and shows hours later as lost health; clean water does nothing", () => {
    const drank = resolve(cottage, { process: "ingest", body: "kin", thing: "foul", amount: 0.5 });
    expect(drank.world.bodies.kin?.health).toBe(5);
    expect(drank.world.bodies.kin?.sickensIn ?? 0).toBeGreaterThan(60);
    const nextDay = resolve(drank.world, days(1)).world;
    expect(nextDay.bodies.kin?.health ?? 5).toBeLessThan(5);
    const fine = resolve(cottage, { process: "ingest", body: "well", thing: "cup", amount: 0.5 });
    expect(fine.world.bodies.well?.sickness).toBe(0);
  });

  it.fails("craft-14 spread: the sick drinker leaves the sickness in the cup (S9 passes from a thing into a body and never back: a body has no S9 of its own to shed, so nothing a sick person touches carries it on)", () => {
    const shared = resolve(cottage, { process: "ingest", body: "sick", thing: "cup", amount: 0.3 });
    expect(shared.world.things.cup?.state.contamination ?? 0).toBeGreaterThan(0);
  });
});

describe("craft-15: an old axle, a rut, a load of pots", () => {
  const cart = world(
    [
      thing("axle", "pole"),
      thing("worn", "pole", "hearth", { flaw: 2 }),
      thing("cart", "cartbody"),
      thing("pots", "potclay", "hearth", { ...DRIED, amount: 30 }),
      thing("pot", "potclay", "hearth", DRIED),
      thing("road", "road"),
    ],
    [],
    EXTRA,
  );

  it.fails("RULE ERROR: craft-15 crack: a sound axle carries the cart and a season's pots, and the worn one gives way (load.ts `weight` adds amounts as powers of two, so thirty pots at mass 2 weigh 6.9, more than a boulder at 5, and with the cart 7.1; `strength` is a sum of levels and the stoutest long thing there can be bears 6.6. A sound oak axle, 3.9, gives way under the empty cart, 4.0, and no axle of any row carries this load. From a feather to a boulder is far more than five doublings: a level of mass should stand for a much bigger step, or strength for a smaller one)", () => {
    const sound = resolve(cart, bears("axle", ["cart", "pots"])).world;
    expect(sound.things.axle?.state.integrity).toBe(5);
    const old = resolve(cart, bears("worn", ["cart", "pots"])).world;
    expect(old.things.worn?.state.integrity).toBeLessThanOrEqual(1);
  });

  const falls = (effort: number): Act => ({
    process: "force",
    instrument: "pot",
    patient: "road",
    manner: { effort, care: 0, haste: 5 },
  });

  it("craft-15 spill: a fired pot thrown hard onto the road smashes to pieces, and one that slides off gently is whole; the road is not marked", () => {
    const thrown = resolve(cart, falls(3)).world;
    expect(thrown.things.pot?.state.integrity).toBe(0);
    expect(thrown.things["pot.piece"]).toBeDefined();
    expect(thrown.things.road?.state.integrity).toBe(5);
    expect(resolve(cart, falls(1)).world.things.pot?.state.integrity).toBe(5);
  });

  it("craft-15 spill: it is the same whether the pot is said to hit the road or the road the pot", () => {
    const struck = resolve(cart, {
      process: "force",
      instrument: "road",
      patient: "pot",
      manner: { effort: 3, care: 0, haste: 5 },
    }).world;
    expect(struck.things.pot?.state.integrity).toBe(0);
  });
});
