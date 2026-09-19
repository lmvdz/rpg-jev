/**
 * Batch D (held out), the river scenarios, run through the matter engine with the rules
 * frozen. Each test asserts what the scenario says a sensible person expects. `it.fails` marks
 * an outcome the rules do not produce, with the reason in brackets; a name that starts
 * `RULE ERROR:` marks one the rules get wrong. Rows are in `rows-d-river.ts`, written before
 * anything ran.
 *
 * Unbuilt, so no test: river-04 (poling against a current: steering, a pole wedged by fit, a
 * boat swung and carried by the flow), river-07 (a weir gathering drift, water backing up behind
 * it, fewer fish carried in: flow, a place's level and a group's count), river-09 (a mill race
 * silting as it slows: flow, and a place's depth changed by drift), river-13 (a pier undercut by
 * scour over years: erosion of a place, and a structure resting on it).
 *
 * A river here is a body of water to soak things with and a damp place: nothing flows (R7 and
 * a place's flow strength are absent), nothing floats (P11 is read by no rule), a hull has no
 * inside (S8), nothing rubs (P14 is read by no rule) and nothing is joined to anything (R4).
 * Where a scenario says a thing floats, the test asks the only bearing the engine has, a load
 * on the water, and says so. Parts of outcomes with no act to play and no state to read are not
 * asserted at all: pushing a hull over mud and paddling it (river-01), packing moss into seams
 * (river-02), chop coming aboard against bailing (river-03), a stone slipping off wet cloth
 * (river-10), the push of the water on a cart and an ox's footing (river-11), a raft tilting and
 * a barrel sliding off it, and lashing logs into one thing (river-14), balance lost reaching
 * from a boat, and breath lost under water (river-15).
 *
 * Changed after the first run, and why: nothing. Every `it` and every `it.fails` was decided
 * from reading the engine before anything ran, and the first run was green: no `it` failed and
 * no `it.fails` turned out to pass. The engine's numbers were printed afterwards to check that
 * each expected failure fails for the reason its name gives (four days on, both hulls at
 * wetness 1.6; a trunk at 2.6 after fifteen minutes under water and after ninety days; a body
 * a tenth of a level wet after a minute in the river; the sunken branch seen at strength 0.9).
 * No row, threshold or place was changed.
 */
import { describe, expect, it } from "vitest";
import {
  type Act,
  able,
  alight,
  effective,
  emits,
  type MatterWorld,
  play,
  resolve,
  strength,
  weight,
} from "../../src/matter/index.ts";
import { body, thing, world } from "./elements.ts";
import { EXTRA } from "./rows-d-river.ts";

const minutes = (n: number): Act => ({ process: "drift", minutes: n });
const hours = (n: number): Act => minutes(n * 60);
const days = (n: number): Act => hours(n * 24);

/** Sets fuel burning in a world that is already built. */
function lit(w: MatterWorld, id: string): MatterWorld {
  const fuel = w.things[id];
  return fuel ? { ...w, things: { ...w.things, [id]: alight(w, fuel) } } : w;
}

/** The river, to wet things with. */
const river = (place: string) => thing("river", "water", place, { amount: 100000, temperature: 1 });

const wets = (target: string, amount: number): Act => ({
  process: "soak",
  liquid: "river",
  target,
  amount,
});

/**
 * Whether the water bears it up. The engine has no floating: the nearest it has is a load,
 * with the water as what bears it.
 */
function borne(w: MatterWorld, ids: string[]): boolean {
  const after = resolve(w, { process: "load", support: "river", bearing: ids }).world;
  return after.things.river?.state.integrity === 5;
}

/** Whether a thing is somewhere other than where it was. */
function strayed(before: MatterWorld, after: MatterWorld, id: string): boolean {
  const [was, now] = [before.things[id], after.things[id]];
  if (!(was && now)) return false;
  const [a, b] = [was.where ?? [0, 0], now.where ?? [0, 0]];
  return now.place !== was.place || Math.hypot(a[0] - b[0], a[1] - b[1]) > 0;
}

describe("river-01: a dugout cut from a green log", () => {
  const bank = world(
    [
      thing("green", "greenhull", "lowriver"),
      thing("dry", "dryhull", "lowriver"),
      river("lowriver"),
    ],
    [body("player", { place: "lowriver", element: "person", where: [0, 0] })],
    EXTRA,
  );

  it.fails("river-01: pushed into the water, the dugout floats (buoyancy, P11, is read by no rule: the only bearing is load, by hardness and section, and water bears nothing heavier than a feather; how low a hull rides cannot be said at all)", () => {
    expect(borne(bank, ["green"])).toBe(true);
  });

  it("river-01: cut green, the hull is heavier than the same hull of dry timber", () => {
    expect(weight(bank, ["green"]) - weight(bank, ["dry"])).toBeGreaterThan(0.25);
  });

  it.fails("river-01: leaning out brings the water over the gunwale (a move is only a going: no balance, no freeboard, and a hull has no inside for water to come into)", () => {
    const after = resolve(bank, {
      process: "move",
      body: "player",
      to: [1, 0],
      minutes: 0.1,
    }).world;
    const shipped =
      (after.things.green?.state.wetness ?? 0) - (bank.things.green?.state.wetness ?? 0);
    expect(shipped > 0 || (after.bodies.player?.wetness ?? 0) > 0).toBe(true);
  });

  it("river-01: over some days in the sun the wood loses some of the water it was cut with, and is lighter", () => {
    const after = resolve(bank, days(4)).world;
    expect(after.things.green?.state.wetness ?? 9).toBeLessThan(
      (bank.things.green?.state.wetness ?? 0) - 0.5,
    );
    expect(weight(bank, ["green"]) - weight(after, ["green"])).toBeGreaterThan(0.1);
  });

  it.fails("river-01: though after those days it is still heavier than the hull of dry timber beside it (drying in drift-rules.ts stops at a floor the place keeps in a thing, and wetting fills the dry hull to that same floor within minutes: four days on, sap and seasoning weigh the same)", () => {
    const after = resolve(bank, days(4)).world;
    expect(weight(after, ["green"]) - weight(after, ["dry"])).toBeGreaterThan(0.1);
  });
});

describe("river-02: caulking with moss and pitch", () => {
  const yard = lit(
    world(
      [
        thing("boat", "plankboat", "landing"),
        thing("bare", "plankboat", "landing"),
        thing("pitch", "pitch", "landing"),
        thing("fire", "firewood", "landing", { amount: 3 }),
        river("landing"),
      ],
      [],
      EXTRA,
    ),
    "fire",
  );
  const smear: Act = { process: "coat", substance: "pitch", target: "boat", amount: 1 };
  // In a pot over the fire, not in the flame.
  const melt: Act = { process: "heat", source: "fire", target: "pitch", minutes: 30, contact: 0.5 };
  const caulked = play(yard, [melt, smear]).world;

  it("river-02: cold pitch will not smear; melted over the fire it goes on along the seams", () => {
    expect(resolve(yard, smear).world.things.boat?.state.coating).toBeNull();
    expect(caulked.things.boat?.state.coating?.element).toBe("pitch");
    expect(caulked.things.boat?.state.coating?.coverage).toBeGreaterThan(0.5);
  });

  it("river-02: back in the water the pitch stays on, and the pitched planking takes up far less of the river than it did bare", () => {
    const launched = play(caulked, [wets("boat", 20), wets("bare", 20)]).world;
    expect(launched.things.boat?.state.coating?.element).toBe("pitch");
    expect(
      (launched.things.bare?.state.wetness ?? 0) - (launched.things.boat?.state.wetness ?? 9),
    ).toBeGreaterThan(1);
  });

  it.fails("river-02: and the caulked boat floats (buoyancy, P11, is read by no rule, and a hull has no inside to keep dry: S8 and R6 are absent)", () => {
    expect(borne(caulked, ["boat"])).toBe(true);
  });

  it.fails("river-02: over the following days the brittle pitch works loose along a seam (a coat's bond only rises as it dries: nothing flexes, no drift wears a coat, and a coat is one coverage with no seam to fail at)", () => {
    const before = caulked.things.boat?.state.coating?.coverage ?? 0;
    const after = resolve(caulked, days(6)).world;
    expect(after.things.boat?.state.coating?.coverage ?? before).toBeLessThan(before);
  });
});

describe("river-03: an overloaded ferry", () => {
  const crossing = world(
    [
      thing("raft", "ferryraft", "landing"),
      thing("s1", "grainsack", "landing"),
      thing("s2", "grainsack", "landing"),
      thing("s3", "grainsack", "landing"),
      river("landing"),
    ],
    [
      body("p1", { place: "landing", element: "person" }),
      body("p2", { place: "landing", element: "person" }),
    ],
    EXTRA,
  );
  const aboard = ["s1", "s2", "s3", "p1", "p2"];

  it("river-03: each sack and each passenger adds to what the raft carries", () => {
    const loads = aboard.map((_, i) => weight(crossing, aboard.slice(0, i + 1)));
    loads.slice(1).forEach((load, i) => {
      expect(load).toBeGreaterThan(loads[i] ?? 9);
    });
  });

  it.fails("river-03: the raft floats light, rides lower with each of them, and swamps overloaded (buoyancy, P11, is read by no rule: there is no freeboard for a load to take away, so no load is too much and none is borne)", () => {
    expect(borne(crossing, ["raft"])).toBe(true);
    expect(borne(crossing, ["raft", ...aboard])).toBe(false);
  });

  it("river-03: the grain the water reaches is soaked, and heavier", () => {
    const after = resolve(crossing, wets("s1", 20)).world;
    expect(after.things.s1?.state.wetness).toBeGreaterThan(2.5);
    expect(weight(after, ["s1"]) - weight(crossing, ["s1"])).toBeGreaterThan(0.3);
  });
});

describe("river-05: a mooring line on a rough piling", () => {
  const stage = world(
    [
      thing("line", "rope", "landing"),
      thing("post", "piling", "landing"),
      thing("boat", "plankboat", "landing"),
      // The current's pull on a moored boat is part of its weight, not all of it.
      thing("tug", "plankboat", "landing", { amount: 0.25 }),
    ],
    [],
    EXTRA,
  );
  const tugs: Act = { process: "load", support: "line", bearing: ["tug"] };

  it("river-05: tied off, the line holds the boat against the current's tug", () => {
    expect(resolve(stage, tugs).world.things.line?.state.integrity).toBe(5);
  });

  it.fails("river-05: days of rubbing on the piling's rough edge fray it through, and it parts under the same tug (friction, P14, is read by no rule, and no drift wears what rubs: X7's wear by rubbing is absent)", () => {
    const worn = resolve(stage, days(6)).world;
    expect(resolve(worn, tugs).world.things.line?.state.integrity).toBeLessThanOrEqual(1);
  });

  it.fails("river-05: unmoored, the boat is carried off downstream with nobody there (nothing flows: R7 and a place's flow strength are absent, so what is loose on a river stays where it is)", () => {
    // Nothing ties the boat to the line in the first place (R4 is absent): it is loose already.
    const later = resolve(stage, hours(6)).world;
    expect(strayed(stage, later, "boat")).toBe(true);
  });
});

describe("river-06: a net on a sunken branch", () => {
  const stretch = world(
    [
      thing("net", "net", "reach"),
      thing("catch", "fish", "reach", { amount: 12 }),
      // A steady haul is part of a person's weight; thrown back against a snag it is all of it.
      thing("pull", "person", "reach", { amount: 0.5 }),
      thing("heave", "person", "reach"),
      thing("knife", "blade", "reach", { edge: 4 }),
      thing("snag", "bough", "reach"),
      river("reach"),
    ],
    [body("player", { place: "reach", element: "person" })],
    EXTRA,
  );
  const cast = resolve(stretch, wets("net", 5)).world;
  const hauls = (bearing: string): Act => ({ process: "load", support: "net", bearing: [bearing] });
  const torn = resolve(cast, hauls("heave")).world;
  const cut: Act = { process: "force", instrument: "knife", patient: "net" };

  it("river-06: the wet net bears its catch and a steady haul, and caught fast it tears when the haul is all the player's weight", () => {
    expect(resolve(cast, hauls("catch")).world.things.net?.state.integrity).toBe(5);
    expect(resolve(cast, hauls("pull")).world.things.net?.state.integrity).toBe(5);
    expect(torn.things.net?.state.integrity).toBeLessThanOrEqual(1);
  });

  it("river-06: a knife parts the caught mesh at a stroke", () => {
    expect(resolve(torn, cut).world.things.net?.state.integrity).toBe(0);
  });

  it.fails("river-06: the corner cut away stays on the branch, and the net is the less for it (a cut through lowers integrity and never divides: only a blow or a shaving makes a piece, and nothing is caught on anything)", () => {
    const after = resolve(torn, cut).world;
    const nets = Object.values(after.things).filter((t) => t.element === "net");
    expect(nets.length > 1 || (after.things.net?.state.amount ?? 1) < 1).toBe(true);
  });

  it.fails("RULE ERROR: river-06: the branch lies under the water and is not seen from the surface (sense.ts hides a thing only by the place's cover, which hides everything there alike: R5, what covers what, is absent, so the player sees the sunken branch as plainly as the bank)", () => {
    const after = resolve(stretch, minutes(1)).world;
    expect(after.bodies.player?.aware?.snag).toBeUndefined();
  });
});

describe("river-08: a branch in the mill wheel", () => {
  const works = world(
    [
      thing("tooth", "geartooth", "mill"),
      thing("shaft", "axle", "mill"),
      thing("wheel", "waterwheel", "mill"),
      // The head of water held against the stopped wheel.
      thing("head", "water", "mill", { amount: 2 }),
    ],
    [],
    EXTRA,
  );
  const strain: Act = { process: "load", support: "tooth", bearing: ["head"] };

  it("river-08: of the axle and the gearing under one strain, the wooden tooth is the weaker", () => {
    const [tooth, shaft] = [works.things.tooth, works.things.shaft];
    expect(tooth ? strength(works, tooth) : 9).toBeLessThan(shaft ? strength(works, shaft) : 0);
  });

  it.fails("river-08: the current keeps pushing on the jammed wheel, and a tooth that held at first cracks in the end (load is a check at a moment: no strain builds under a standing load, and no flow is there to push)", () => {
    expect(resolve(works, strain).world.things.tooth?.state.integrity).toBe(5);
    const later = resolve(works, hours(12)).world;
    expect(resolve(later, strain).world.things.tooth?.state.integrity).toBeLessThanOrEqual(3);
  });

  it.fails("river-08: a turning wheel is heard, so that its silence tells the miller (emits in sense.ts reads burning, heat, daylight and scent: nothing that runs gives off sound, and nothing turns)", () => {
    const wheel = works.things.wheel;
    expect((wheel ? emits(works, wheel).sound : 0) ?? 0).toBeGreaterThan(0);
  });
});

describe("river-10: fulling cloth in the shallows", () => {
  const bed = world(
    [
      thing("cloth", "cloth", "shallows"),
      thing("dirt", "mud", "shallows", { amount: 0.2 }),
      thing("feet", "foot", "shallows"),
      river("shallows"),
    ],
    [],
    EXTRA,
  );
  const dirty = resolve(bed, { process: "coat", substance: "dirt", target: "cloth" }).world;
  const inRiver = resolve(dirty, wets("cloth", 5)).world;

  it("river-10: worked in the river, the dirt comes out of the cloth", () => {
    expect(dirty.things.cloth?.state.coating?.element).toBe("mud");
    expect(inRiver.things.cloth?.state.coating).toBeNull();
  });

  it.fails("river-10: trodden against the gravel, the weave is tighter than it was (force has a striker and a struck and no bed to work a thing against, and porosity is the row's: no act or modifier moves it)", () => {
    const tread: Act = { process: "force", instrument: "feet", patient: "cloth", aim: "surface" };
    const trodden = play(
      inRiver,
      Array.from({ length: 10 }, () => tread),
    ).world;
    const [was, now] = [inRiver.things.cloth, trodden.things.cloth];
    expect(now ? effective(trodden, now).porosity : 9).toBeLessThan(
      was ? effective(inRiver, was).porosity : 0,
    );
  });

  it.fails("river-10: the end the stone let go of is carried off downstream (nothing flows: R7 and a place's flow strength are absent, so the current neither tugs nor carries)", () => {
    const later = resolve(inRiver, minutes(10)).world;
    expect(strayed(inRiver, later, "cloth")).toBe(true);
  });
});

describe("river-11: the ford the day after rain", () => {
  const ford = world(
    [thing("sacks", "grainsack", "ford", { amount: 4 }), river("ford")],
    [],
    EXTRA,
  );
  const under = resolve(ford, wets("sacks", 20)).world;

  it.fails("river-11: overnight, rain upstream leaves the ford higher and faster than it was (no drift touches a place: E13 is absent, a place has no depth or flow to change, and nothing upstream is anywhere)", () => {
    const morning = resolve(ford, hours(12)).world;
    expect(morning.places.ford).not.toEqual(ford.places.ford);
  });

  it.fails("river-11: partway over, the water drags the cart and its load off the ford's line (nothing flows: R7 and a place's flow strength are absent)", () => {
    const later = resolve(ford, minutes(10)).world;
    expect(strayed(ford, later, "sacks")).toBe(true);
  });

  it("river-11: the grain sacks the water reached are soaked, and heavier", () => {
    expect(under.things.sacks?.state.wetness).toBeGreaterThan(2.5);
    expect(weight(under, ["sacks"]) - weight(ford, ["sacks"])).toBeGreaterThan(0.3);
  });

  it("river-11: and the soaked load is ruined: set down wet it has gone bad within days, where dry grain keeps", () => {
    const wet = under.things.sacks?.state ?? {};
    const store = world(
      [thing("wet", "grainsack", "farbank", wet), thing("dry", "grainsack", "farbank")],
      [],
      EXTRA,
    );
    const later = resolve(store, days(3)).world;
    expect(later.things.wet?.state.contamination).toBeGreaterThan(1);
    expect(later.things.dry?.state.contamination).toBeLessThan(0.2);
  });
});

describe("river-12: river ice, thick by the bank and thin further out", () => {
  const frozen = world(
    [
      thing("bank", "riverice", "frozenriver", { temperature: 0 }),
      thing("out", "riverice", "frozenriver", { temperature: 0, flaw: 2 }),
      thing("axe", "handaxe", "frozenriver", { edge: 3 }),
      thing("pail", "bucket", "frozenriver"),
      thing("line", "rope", "frozenriver"),
    ],
    [
      body("player", { place: "frozenriver", element: "person", wetness: 5 }),
      body("companion", { place: "frozenriver", element: "person" }),
    ],
    EXTRA,
  );
  const stands = (support: string, who: string): Act => ({
    process: "load",
    support,
    bearing: [who],
  });
  const chop: Act = {
    process: "force",
    instrument: "axe",
    patient: "bank",
    manner: { effort: 3, care: 2, haste: 2 },
  };
  const holed = play(frozen, [chop, chop, chop]).world;
  const inWater = world([], [body("player", { place: "underice", element: "person" })], EXTRA);

  it("river-12: the ice by the bank bears the player, the thin ice further out gives way under them, and the same thin ice bears a bucket", () => {
    expect(resolve(frozen, stands("bank", "player")).world.things.bank?.state.integrity).toBe(5);
    expect(
      resolve(frozen, stands("out", "player")).world.things.out?.state.integrity,
    ).toBeLessThanOrEqual(1);
    expect(resolve(frozen, stands("out", "pail")).world.things.out?.state.integrity).toBe(5);
  });

  it("river-12: a few blows of the hand axe break through it", () => {
    expect(holed.things.bank?.state.integrity).toBeLessThanOrEqual(1);
  });

  it.fails("RULE ERROR: river-12: with a hole cut in it for water, the thick ice still bears the one who cut it (integrity is one number for the whole thing: a hole in a sheet is the sheet broken, and it drops whoever stands anywhere on it)", () => {
    const { changes } = resolve(holed, stands("bank", "player"));
    expect(changes.some((c) => c.kind === "wound")).toBe(false);
  });

  it.fails("river-12: through the ice, the player is soaked at once (soak has things for targets: a body is wetted only by a wet place, a tenth of a level a minute, as rain does it)", () => {
    const after = resolve(inWater, minutes(1)).world;
    expect(after.bodies.player?.wetness ?? 0).toBeGreaterThan(3);
  });

  it.fails("river-12: and minutes in the ice water sap their strength (weathered in living.ts reads the air of the place and the body's wetness: there is no being in the water, so an ice river chills like cold wet air, a tenth of a level in five minutes)", () => {
    const soaked = world(
      [],
      [body("player", { place: "underice", element: "person", wetness: 5 })],
      EXTRA,
    );
    const after = resolve(soaked, minutes(5)).world;
    const player = after.bodies.player;
    expect(player ? able(after, player).strength : 9).toBeLessThan(1.5);
  });

  it("river-12: the companion's rope bears the player's weight on the pull", () => {
    expect(resolve(frozen, stands("line", "player")).world.things.line?.state.integrity).toBe(5);
  });

  it("river-12: out on the bank and soaked, the player loses warmth far faster than the dry companion beside them", () => {
    const after = resolve(frozen, minutes(30)).world;
    const dry = after.bodies.companion?.needs.warmth ?? 0;
    expect(dry).toBeGreaterThan(0);
    expect(after.bodies.player?.needs.warmth ?? 0).toBeGreaterThan(dry * 2);
  });
});

describe("river-14: a raft with one waterlogged log", () => {
  const sunkFor = (act: Act) =>
    resolve(world([thing("old", "log", "backwater")], [], EXTRA), act).world.things.old?.state;
  const season = sunkFor(days(90));
  const camp = world(
    [thing("old", "log", "camp", season ?? {}), thing("fresh", "log", "camp"), river("camp")],
    [],
    EXTRA,
  );

  it("river-14: the log that lay sunk a season has taken on water, and is heavier than its fellows", () => {
    expect(weight(camp, ["old"]) - weight(camp, ["fresh"])).toBeGreaterThan(0.25);
  });

  it.fails("RULE ERROR: river-14: it took the season to fill the wood through, and a quarter of an hour under water does not (wetting in drift-rules.ts is a fifth of a level a minute for anything, up to all it can hold, where drying goes by powers of bulk: a trunk is waterlogged in thirteen minutes)", () => {
    const quarter = sunkFor(minutes(15));
    expect(quarter?.wetness ?? 9).toBeLessThan((season?.wetness ?? 0) / 2);
  });

  it.fails("river-14: the dry logs float and the waterlogged one gives almost no lift (buoyancy, P11, is read by no rule, so what a log has soaked up takes nothing from it; a raft is no one thing either, R4 being absent, to ride low at a corner)", () => {
    expect(borne(camp, ["fresh"])).toBe(true);
    expect(borne(camp, ["old"])).toBe(false);
  });
});

describe("river-15: overboard in fast water", () => {
  const water = world(
    [thing("oar", "oar", "bend"), thing("line", "rope", "bend"), river("bend")],
    [
      body("player", { place: "bend", element: "person", wetness: 5 }),
      body("companion", { place: "bend", element: "person" }),
    ],
    EXTRA,
  );

  it.fails("river-15: the oar is carried off downstream and is gone (nothing flows: R7 and a place's flow strength are absent, so what is dropped in fast water stays beside the boat)", () => {
    const later = resolve(water, minutes(10)).world;
    expect(strayed(water, later, "oar")).toBe(true);
  });

  it("river-15: the thrown rope, wet, bears the player hauled back to the boat", () => {
    const hauled = play(water, [
      wets("line", 5),
      { process: "load", support: "line", bearing: ["player"] },
    ]).world;
    expect(hauled.things.line?.state.integrity).toBe(5);
  });

  it.fails("river-15: pulled out soaked, the player is chilled, on a mild day (weathered in living.ts takes exposure from the air of the place alone: a mild place costs a body nothing however wet it is, and the river's cold is no input)", () => {
    const after = resolve(water, minutes(20)).world;
    expect(after.bodies.player?.needs.warmth ?? 0).toBeGreaterThan(0.5);
  });

  it.fails("river-15: and spent by minutes of fighting the current (tiredness comes with the hours and nothing else: no exertion, and no air need for the water to cut off)", () => {
    const after = resolve(water, minutes(5)).world;
    expect(after.bodies.player?.needs.rest ?? 0).toBeGreaterThan(1);
  });
});
