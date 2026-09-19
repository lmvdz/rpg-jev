/**
 * Batch B, held out: the "clever" chains, which cross domains in several steps. Each test
 * asserts one step of a chain that is in the engine's reach, as the scenario's outcome says a
 * sensible person expects it. `it.fails` marks what the rules cannot produce, or get wrong
 * (`RULE ERROR`), with the reason in brackets. Steps that turn on unbuilt mechanisms have no
 * test; `spikes/vocabulary/results/derive/b-clever.json` says where each chain breaks.
 * Rows are in `rows-b-clever.ts`.
 */
import { describe, expect, it } from "vitest";
import {
  type Act,
  type Change,
  type Channel,
  effective,
  isLiquid,
  type MatterWorld,
  play,
  resolve,
  searchYield,
  type ThingState,
} from "../../src/matter/index.ts";
import { body, thing, world } from "./elements.ts";
import { EXTRA } from "./rows-b-clever.ts";

const lit = { burning: { of: "self", fuel: 600 } } as const;
const heat = (source: string, target: string, minutes: number, contact = 1): Act => ({
  process: "heat",
  source,
  target,
  minutes,
  contact,
});
const hours = (n: number): Act => ({ process: "drift", minutes: n * 60 });

/** The same world with one thing's state overwritten: a test's way of saying "and now it is". */
function put(w: MatterWorld, id: string, set: Partial<ThingState>): MatterWorld {
  const t = w.things[id];
  if (!t) return w;
  return { ...w, things: { ...w.things, [id]: { ...t, state: { ...t.state, ...set } } } };
}

const signals = (changes: readonly Change[], channel: Channel) =>
  changes.filter((c) => c.kind === "signal" && c.channel === channel);

describe("clever-01: smoking a hive with damp wood", () => {
  const under = world(
    [
      thing("flame", "fire", "hearth", lit),
      thing("dry", "bough", "hearth", { wetness: 0.05 }),
      thing("damp", "bough", "hearth", { wetness: 2 }),
    ],
    [],
    EXTRA,
  );

  it("clever-01 step 1: damp wood is slow to catch where dry wood takes at once, and catches in the end", () => {
    const soon = play(under, [heat("flame", "dry", 0.5), heat("flame", "damp", 0.5)]).world;
    expect(soon.things.dry?.state.burning).not.toBeNull();
    expect(soon.things.damp?.state.burning).toBeNull();
    const later = resolve(under, heat("flame", "damp", 10)).world;
    expect(later.things.damp?.state.burning).not.toBeNull();
  });

  it("clever-01 step 1: once lit, the damp wood burns slower than the same wood dry", () => {
    const w = play(under, [heat("flame", "dry", 10), heat("flame", "damp", 10)]).world;
    const [dry, damp] = [w.things.dry?.state.burning, w.things.damp?.state.burning];
    expect(damp?.fuel ?? 0).toBeGreaterThan(dry?.fuel ?? Number.POSITIVE_INFINITY);
  });

  it.fails("clever-01 step 1: damp wood burning gives off smoke (S3 'gives light and smoke' is in the vocabulary; burning emits no signal on any channel, so the chain has no smoke to drift at step 2)", () => {
    const caught = resolve(under, heat("flame", "damp", 10));
    const burned = resolve(caught.world, { process: "drift", minutes: 10 });
    expect(signals([...caught.changes, ...burned.changes], "smoke").length).toBeGreaterThan(0);
  });
});

describe("clever-03: boiling water in a hide with hot stones", () => {
  const camp = world(
    [
      thing("flame", "fire", "hearth", lit),
      thing("stones", "cobble", "hearth", { amount: 4 }),
      thing("pot", "water", "hearth", { amount: 8 }),
      thing("hide", "rawhide", "hearth", { wetness: 4 }),
      thing("dryhide", "rawhide", "hearth", { wetness: 0.05 }),
      thing("tongs", "greenwood", "hearth"),
    ],
    [body("player")],
    EXTRA,
  );
  const fired = resolve(camp, heat("flame", "stones", 30)).world;
  const stoneHeat = fired.things.stones?.state.temperature ?? 0;

  it("clever-03 step 1: stones heat through in the fire over some minutes, not at once, and do not burn", () => {
    const brief = resolve(camp, heat("flame", "stones", 1)).world;
    expect(brief.things.stones?.state.temperature).toBeLessThan(3);
    expect(stoneHeat).toBeGreaterThan(4);
    expect(fired.things.stones?.state.burning).toBeNull();
    expect(fired.things.stones?.state.integrity).toBe(5);
  });

  it("clever-03 step 2: a hot stone burns a bare hand, and green wood tongs do not catch from carrying it", () => {
    const held = resolve(fired, {
      process: "force",
      instrument: "stones",
      patient: "player",
      seconds: 3,
      manner: { effort: 0, care: 2, haste: 2 },
    }).world;
    expect(held.bodies.player?.wounds[0]?.burned).toBeGreaterThan(1);
    const carried = resolve(fired, heat("stones", "tongs", 1)).world;
    expect(carried.things.tongs?.state.burning).toBeNull();
  });

  /** One minute of the stones warming the water, then one of the water cooling the stones. */
  // One act: the engine now draws the source down as the target warms (it did not when this
  // was first written, and the exchange was told from both sides by hand).
  const exchange: Act[] = [heat("stones", "pot", 2)];

  it.fails("RECALIBRATE (a level of mass became a step of four, cords bear in tension, bulk dries by powers; the assertion's magnitude was set against the old scale): clever-03 step 3: dropped in, the stones give up their heat fast and the water gains some", () => {
    const w = play(fired, exchange).world;
    expect(w.things.pot?.state.temperature).toBeGreaterThan(2.1);
    expect(w.things.stones?.state.temperature).toBeLessThan(stoneHeat - 1);
  });

  /** A batch: fresh hot stones in, three minutes of exchange, and out again. */
  const batch = (w: MatterWorld) =>
    play(put(w, "stones", { temperature: stoneHeat, integrity: 5 }), [
      ...exchange,
      ...exchange,
      ...exchange,
    ]).world;

  it("clever-03 step 5: one batch does not boil the water; several batches do", () => {
    let w = batch(fired);
    expect(w.things.pot?.state.temperature).toBeLessThan(4);
    let batches = 1;
    while ((w.things.pot?.state.temperature ?? 0) < 4.5 && batches < 40) {
      w = batch(w);
      batches += 1;
    }
    expect(batches).toBeGreaterThanOrEqual(2);
    expect(batches).toBeLessThanOrEqual(15);
  });

  it("fixed rule: clever-03 step 3: one stone left in a hide full of water does not bring it near the boil; the engine takes it to 4.9 (heat never draws the source down and reads no amounts: a source is an endless reservoir unless the caller cools it by hand)", () => {
    const one = put(fired, "stones", { amount: 1 });
    const left = resolve(one, heat("stones", "pot", 30)).world;
    expect(left.things.pot?.state.temperature).toBeLessThan(3.5);
  });

  it("clever-03 step 5: a cupful with four stones in it heats faster than a hide full with one (no amounts in heat: the two come out the same to the last digit)", () => {
    const cup = batch(put(fired, "pot", { amount: 0.5 }));
    const full = batch(put(put(fired, "pot", { amount: 8 }), "stones", { amount: 1 }));
    expect(cup.things.pot?.state.temperature ?? 0).toBeGreaterThan(
      full.things.pot?.state.temperature ?? 9,
    );
  });

  it("clever-03 step 3: a hot stone with a hidden flaw, left in the water, cracks", () => {
    const flawed = resolve(put(fired, "stones", { flaw: 2 }), heat("pot", "stones", 5)).world;
    expect(flawed.things.stones?.state.integrity).toBeLessThan(5);
  });

  it.fails("clever-03 step 3: and a sound one beside it does not (shock reads toughness and the size of the drop, never S15: every stone of this row cracks on every plunge, where the scenario makes it the one with the flaw)", () => {
    const sound = resolve(fired, heat("pot", "stones", 5)).world;
    expect(sound.things.stones?.state.integrity).toBe(5);
  });

  it("fixed rule: clever-03 step 3: the same five minutes in the water crack the stone the same however the time is cut; the engine cracks it in one act of five minutes and never in five acts of one (shock tests the drop within a single act against 2, so a caller who steps by the minute has unbreakable stones)", () => {
    const once = resolve(fired, heat("pot", "stones", 5)).world;
    const sliced = play(
      fired,
      Array.from({ length: 5 }, () => heat("pot", "stones", 1)),
    ).world;
    expect(sliced.things.stones?.state.integrity).toBe(once.things.stones?.state.integrity);
  });

  it("clever-03 step 4: soaked, the hide does not take light in a flame that lights the same hide dry", () => {
    const wet = resolve(fired, heat("flame", "hide", 2)).world;
    expect(wet.things.hide?.state.burning).toBeNull();
    const dry = resolve(fired, heat("flame", "dryhide", 2)).world;
    expect(dry.things.dryhide?.state.burning).not.toBeNull();
  });

  const boiling = put(fired, "pot", { temperature: 4.6 });

  it("fixed rule: clever-03 step 4: the hide holding boiling water for an hour stays wet and unburnt; the engine dries it to 0 and sets it alight (heat dries its target whatever the source is, water included, and ignition asks only how hot the source is, so hot water is a flame)", () => {
    const after = resolve(boiling, heat("pot", "hide", 60)).world;
    expect(after.things.hide?.state.wetness).toBeGreaterThan(2);
    expect(after.things.hide?.state.burning).toBeNull();
  });

  it("fixed rule: clever-03 step 4: hot water poured round dry kindling does not light it; in the engine it does (the same rule: a liquid source at 4.2 is past kindling's ignition point of 3.8)", () => {
    const hot = world(
      [
        thing("pot", "water", "hearth", { temperature: 4.2 }),
        thing("sticks", "kindling", "hearth", { wetness: 0.05 }),
      ],
      [],
      EXTRA,
    );
    const after = resolve(hot, heat("pot", "sticks", 5)).world;
    expect(after.things.sticks?.state.burning).toBeNull();
  });
});

describe("clever-04: the burning sword and the wolf", () => {
  const dusk = world(
    [
      thing("flame", "fire", "hearth", lit),
      thing("sword", "iron", "hearth", { edge: 3 }),
      thing("skin", "oil"),
      thing("drop", "oil", "hearth", { amount: 0.05, burning: { of: "self", fuel: 1 } }),
    ],
    [body("wolf"), body("player")],
    EXTRA,
  );
  const oiled = resolve(dusk, { process: "coat", substance: "skin", target: "sword" }).world;
  const held = resolve(oiled, heat("flame", "sword", 0.5));
  const swing: Act = { process: "force", instrument: "sword", patient: "wolf", seconds: 0.3 };

  it("clever-04 steps 1 and 2: the oiled blade catches quickly, it is the coat that burns, and bare iron never does", () => {
    expect(oiled.things.skin?.state.amount).toBeLessThan(1);
    expect(held.world.things.sword?.state.burning?.of).toBe("coating");
    const bare = resolve(dusk, heat("flame", "sword", 30)).world;
    expect(bare.things.sword?.state.burning).toBeNull();
  });

  it("clever-04 step 3: alight it sears, but it cuts no deeper than the same sword unlit", () => {
    const burning = resolve(held.world, swing).world.bodies.wolf?.wounds[0];
    const plain = resolve(dusk, swing).world.bodies.wolf?.wounds[0];
    expect(burning?.burned).toBeGreaterThan(0);
    expect(plain?.burned).toBe(0);
    expect(burning?.depth).toBeCloseTo(plain?.depth ?? -1, 5);
  });

  it.fails("clever-04 step 2: alight, the sword gives off light (burning emits no signal, so there is nothing for the wolf to see at step 3)", () => {
    const burned = resolve(held.world, { process: "drift", minutes: 1 });
    expect(signals([...held.changes, ...burned.changes], "light").length).toBeGreaterThan(0);
  });

  it("clever-04 step 4: a drop of burning oil on the arm burns it without cutting", () => {
    const dripped = resolve(dusk, {
      process: "force",
      instrument: "drop",
      patient: "player",
      seconds: 2,
      manner: { effort: 0, care: 0, haste: 2 },
    }).world;
    const wound = dripped.bodies.player?.wounds[0];
    expect(wound?.burned).toBeGreaterThan(0);
    expect(wound?.depth).toBe(0);
  });

  it("clever-04 step 5: the coat burns down in a few minutes and leaves the same sword: no coat, edge and hardness as before", () => {
    const fuel = held.world.things.sword?.state.burning?.fuel ?? 0;
    expect(fuel).toBeGreaterThan(1);
    expect(fuel).toBeLessThan(10);
    const after = resolve(held.world, { process: "drift", minutes: 15 }).world;
    const sword = after.things.sword;
    expect(sword?.state.burning).toBeNull();
    expect(sword?.state.coating).toBeNull();
    expect(sword?.state.edge).toBe(3);
    const before = dusk.things.sword;
    expect(sword ? effective(after, sword).hardness : -1).toBe(
      before ? effective(dusk, before).hardness : -2,
    );
  });

  it.fails("clever-04 step 5: when the flame dies the blade is hot to the touch (three minutes of its own coat burning lifts the iron from 2.3 to 2.5: drift warms a burning thing at the slow ambient rate, as if the flame were the weather)", () => {
    const fuel = held.world.things.sword?.state.burning?.fuel ?? 0;
    const spent = resolve(held.world, { process: "drift", minutes: Math.ceil(fuel) }).world;
    expect(spent.things.sword?.state.burning).toBeNull();
    expect(spent.things.sword?.state.temperature).toBeGreaterThan(3.5);
  });
});

describe("clever-05: a deadfall on a stick", () => {
  const run = world(
    [thing("slab", "slab", "hearth"), thing("prop", "stick", "hearth")],
    [body("fox")],
    EXTRA,
  );

  it.fails("RULE ERROR: clever-05 step 1: a sound thin stick props the tipped stone; the engine snaps it (load strength reads every long support as a beam borne across its thin dimension, 2.1 against 3; a prop is loaded along its length)", () => {
    // Tipped on edge, the ground bears half of it.
    const tipped = put(run, "slab", { amount: 0.5 });
    const set = resolve(tipped, { process: "load", support: "prop", bearing: ["slab"] });
    expect(set.world.things.prop?.state.integrity).toBe(5);
  });

  const fall: Act = {
    process: "force",
    instrument: "slab",
    patient: "fox",
    seconds: 1,
    manner: { effort: 3, care: 0, haste: 5 },
  };

  it("clever-05 step 5: the stone coming down on the fox crushes rather than cuts: a deep wound that bleeds little", () => {
    const wound = resolve(run, fall).world.bodies.fox?.wounds[0];
    expect(wound?.depth).toBeGreaterThan(2);
    expect(wound?.bleeding).toBeLessThan(wound?.depth ?? 0);
  });

  it.fails("clever-05 step 5: and it kills the fox outright (a wound takes health only by bleeding, and a crush bleeds little: depth 2.8 leaves health 4.8; bodies have no size either, so a fox and a smaller animal are the same flesh)", () => {
    const after = play(run, [fall, hours(1)]).world;
    expect(after.bodies.fox?.health).toBeLessThanOrEqual(1);
  });
});

describe("clever-06: a charcoal pit", () => {
  const stack = world(
    [thing("flame", "fire", "hearth", lit), thing("wood", "splitwood", "hearth")],
    [],
    EXTRA,
  );
  const alight = resolve(stack, heat("flame", "wood", 3)).world;

  it("clever-06 step 1: split wood takes light and, left in the open air, burns away in an hour or two to ash", () => {
    const fuel = alight.things.wood?.state.burning?.fuel ?? 0;
    expect(fuel).toBeGreaterThanOrEqual(30);
    expect(fuel).toBeLessThanOrEqual(180);
    const after = resolve(alight, hours(4)).world;
    expect(after.things.wood).toBeUndefined();
    expect(after.things["wood.ash"]?.element).toBe("ash");
  });

  /** Earth and turf over the pit: the same burning wood, in a place with no air. */
  const sealed = (() => {
    const wood = alight.things.wood;
    if (!wood) return alight;
    const halfBurned = {
      ...wood,
      place: "pit",
      state: { ...wood.state, burning: { of: "self" as const, fuel: 30 }, temperature: 4.5 },
    };
    return { ...alight, things: { ...alight.things, wood: halfBurned } };
  })();

  it("clever-06 step 2: sealed from the air, the wood stops flaming", () => {
    const after = resolve(sealed, hours(12)).world;
    expect(after.things.wood?.state.burning ?? null).toBeNull();
  });

  it("fixed rule: clever-06 step 3: the wood that had not yet burned is still there in the morning; the engine turns it all to ash at once (drift sets fuel to 0 when air is 0, then reads going out as burned away: smothering consumes the fuel it should save)", () => {
    const after = resolve(sealed, hours(12)).world;
    expect(after.things.wood).toBeDefined();
    expect(after.things["wood.ash"]).toBeUndefined();
  });
});

describe("clever-07: a smoke signal", () => {
  const top = world(
    [
      thing("kindling", "kindling", "hilltop", { wetness: 0.05 }),
      thing("spark", "fire", "hilltop", { burning: { of: "self", fuel: 5 } }),
      thing("green", "greenwood", "hilltop"),
    ],
    [],
    EXTRA,
  );
  const going = resolve(top, heat("spark", "kindling", 0.25));

  it("clever-07 step 1: dry kindling catches fast", () => {
    expect(going.world.things.kindling?.state.burning).not.toBeNull();
  });

  it("clever-07 step 2: green branches thrown on do not flame as the kindling did; they have to dry first", () => {
    const thrown = resolve(going.world, heat("kindling", "green", 0.25)).world;
    expect(thrown.things.green?.state.burning).toBeNull();
    expect(thrown.things.green?.state.wetness).toBeGreaterThan(2);
  });

  it.fails("clever-07 step 2: and while they dry on the fire they pour smoke (burning and drying emit no signal; with no smoke there is nothing for wind to bend at steps 3 and 4)", () => {
    const thrown = resolve(going.world, heat("kindling", "green", 10));
    const burned = resolve(thrown.world, { process: "drift", minutes: 10 });
    expect(signals([...thrown.changes, ...burned.changes], "smoke").length).toBeGreaterThan(0);
  });
});

describe("clever-08: a carcass as a decoy", () => {
  const clearing = world(
    [thing("deer", "carcass", "hearth")],
    [body("wolf", { needs: { hunger: 4 }, tolerates: 3 })],
    EXTRA,
  );
  const nextNight = resolve(clearing, hours(24)).world;

  it("clever-08 step 2: a day on, the carcass smells stronger than it did fresh", () => {
    const [fresh, old] = [clearing.things.deer, nextNight.things.deer];
    expect(old ? effective(nextNight, old).scent : 0).toBeGreaterThan(
      fresh ? effective(clearing, fresh).scent : 9,
    );
  });

  it.fails("RECALIBRATE (hunger now rises with the hours, so a body that waits a day before it eats is less sated than this assumed): clever-08 step 4: the wolf that feeds on it is sated, is not made ill by day-old meat, and the carcass is less", () => {
    const fed = resolve(nextNight, { process: "ingest", body: "wolf", thing: "deer", amount: 0.5 });
    expect(fed.world.bodies.wolf?.needs.hunger).toBeLessThanOrEqual(2.5);
    expect(fed.world.bodies.wolf?.sickness).toBeLessThan(1);
    expect(fed.world.things.deer?.state.amount).toBeLessThan(1);
  });
});

describe("clever-09: a frayed rope sold as sound", () => {
  const camp = world(
    [
      thing("good", "rope", "hearth"),
      thing("frayed", "rope", "hearth", { flaw: 2 }),
      thing("haul", "slab", "hearth"),
    ],
    [],
    EXTRA,
  );

  it("clever-09 step 1: the weak strands do not show: the frayed rope reads the same as a sound one", () => {
    const [a, b] = [camp.things.good, camp.things.frayed];
    expect(a && b ? effective(camp, b) : 1).toEqual(a && b ? effective(camp, a) : 2);
  });

  it("clever-09 step 4: under a heavy load the sound rope holds and the frayed one snaps, loudly", () => {
    const held = resolve(camp, { process: "load", support: "good", bearing: ["haul"] });
    expect(held.world.things.good?.state.integrity).toBe(5);
    const snapped = resolve(camp, { process: "load", support: "frayed", bearing: ["haul"] });
    expect(snapped.world.things.frayed?.state.integrity).toBeLessThanOrEqual(1);
    expect(signals(snapped.changes, "sound").length).toBeGreaterThan(0);
  });
});

describe("clever-10: water in a crack on a freezing night", () => {
  const quarry = world(
    [
      thing("rock", "boulder", "frostnight", { flaw: 1 }),
      thing("jug", "water", "frostnight", { amount: 2 }),
    ],
    [],
    EXTRA,
  );
  const poured = resolve(quarry, { process: "soak", liquid: "jug", target: "rock", amount: 1 });
  const morning = resolve(poured.world, hours(10)).world;

  it("clever-10 steps 1 and 2: the rock takes the water, by morning rock and water are at freezing, and one night does not split it", () => {
    expect(poured.world.things.rock?.state.wetness).toBeGreaterThan(0);
    expect(morning.things.rock?.state.temperature).toBeLessThan(0.5);
    expect(morning.things.jug?.state.temperature).toBeLessThan(0.5);
    expect(morning.things.rock?.state.integrity).toBeGreaterThan(1);
  });

  // Derived since round two of the grown rows (graph/grown.ts): proposed by a model, ratified by Jev.
  it("fixed rule: what was wrong was: clever-10 step 2: the water poured into the crack is still in it, frozen, in the morning; the engine has dried the rock to 0", () => {
    expect(morning.things.rock?.state.wetness).toBeGreaterThan(0);
  });

  it("clever-10 step 2: water left out through a freezing night is ice (a `liquid` element is liquid at every temperature: nothing freezes)", () => {
    const jug = morning.things.jug;
    expect(jug ? isLiquid(morning, jug) : true).toBe(false);
  });

  // Derived since round two of the grown rows (graph/grown.ts): proposed by a model, ratified by Jev.
  it("clever-10 step 3: by morning the crack is wider", () => {
    const rock = morning.things.rock;
    const worse = (rock?.state.flaw ?? 0) > 1 || (rock?.state.integrity ?? 5) < 5;
    expect(worse).toBe(true);
  });
});

describe("clever-11: a clay plug in a waterskin", () => {
  const dig = (place: string) =>
    searchYield(world([], [], EXTRA), {
      process: "search",
      place,
      element: "riverclay",
      minutes: 10,
      draw: 0.5,
    });

  it("clever-11 step 1: ten minutes at the bank turns up clay; the same on the trail turns up none", () => {
    expect(dig("bank")).toBeGreaterThanOrEqual(1);
    expect(dig("trail")).toBe(0);
  });

  const pressed = world(
    [thing("plug", "riverclay", "sun"), thing("skin", "leather", "sun")],
    [],
    EXTRA,
  );

  it("clever-11 step 3: an hour in the sun it is still soft; within a day it has dried hard and set", () => {
    const soon = resolve(pressed, hours(1)).world;
    expect(soon.things.plug?.state.set).toBe(false);
    const dried = resolve(pressed, hours(24)).world;
    const [wet, hard] = [pressed.things.plug, dried.things.plug];
    expect(hard?.state.set).toBe(true);
    expect(hard ? effective(dried, hard).hardness : 0).toBeGreaterThan(
      wet ? effective(pressed, wet).hardness : 9,
    );
  });

  it("clever-11 step 5: set, the plug is stiff where the leather round it still flexes: the mismatch the scenario's failure comes from", () => {
    const dried = resolve(pressed, hours(24)).world;
    const [plug, skin] = [dried.things.plug, dried.things.skin];
    expect(plug ? effective(dried, plug).flexibility : 9).toBeLessThanOrEqual(1);
    expect(skin ? effective(dried, skin).flexibility : 0).toBeGreaterThanOrEqual(3);
  });

  it("clever-11 step 4: filling the skin again does not soften the set plug", () => {
    const dried = resolve(pressed, hours(24)).world;
    const filled = world(
      [thing("plug", "riverclay", "sun", dried.things.plug?.state), thing("fill", "water")],
      [],
      EXTRA,
    );
    const wetted = resolve(filled, { process: "soak", liquid: "fill", target: "plug", amount: 1 });
    const [before, after] = [filled.things.plug, wetted.world.things.plug];
    expect(after ? effective(wetted.world, after).hardness : 0).toBe(
      before ? effective(filled, before).hardness : 9,
    );
  });
});

describe("clever-14: meat kept in a cold stream", () => {
  const kept = (place: string) => world([thing("meat", "meat", place)], [body("player")], EXTRA);
  const rot = (place: string, h: number) =>
    resolve(kept(place), hours(h)).world.things.meat?.state.contamination ?? 0;
  const hoursTo = (place: string, level: number) => {
    let h = 0;
    while (rot(place, h) < level && h < 400) h += 4;
    return h;
  };

  it("clever-14 step 3: in the stream it lasts at least twice as long as in the warm camp air", () => {
    expect(hoursTo("stream", 2.5)).toBeGreaterThanOrEqual(hoursTo("warmcamp", 2.5) * 2);
  });

  it("clever-14 step 5: it is still breaking down: after two days it is turning but not gone, and smells more than fresh", () => {
    const twoDays = resolve(kept("stream"), hours(48)).world;
    const meat = twoDays.things.meat;
    expect(meat?.state.contamination).toBeGreaterThan(1);
    expect(meat?.state.contamination).toBeLessThan(3.5);
    const fresh = kept("stream").things.meat;
    expect(meat ? effective(twoDays, meat).scent : 0).toBeGreaterThan(
      fresh ? effective(kept("stream"), fresh).scent : 9,
    );
  });

  it("clever-14 step 5: the same meat hung in camp is spoiled outright by then, and so is the stream's after a week", () => {
    expect(rot("warmcamp", 48)).toBeGreaterThanOrEqual(4);
    expect(rot("stream", 168)).toBeGreaterThanOrEqual(4);
  });

  it("clever-14 step 5: at two days it is edible: cooked through, it feeds and does not sicken", () => {
    const twoDays = resolve(kept("stream"), hours(48)).world;
    const meat = twoDays.things.meat;
    const atFire = meat
      ? world(
          [thing("meat", "meat", "hearth", meat.state), thing("flame", "fire", "hearth", lit)],
          [body("player")],
          EXTRA,
        )
      : twoDays;
    const eaten = play(atFire, [
      heat("flame", "meat", 45),
      { process: "ingest", body: "player", thing: "meat" },
    ]).world;
    expect(eaten.bodies.player?.needs.hunger).toBeLessThan(3);
    expect(eaten.bodies.player?.sickness).toBe(0);
  });
});
