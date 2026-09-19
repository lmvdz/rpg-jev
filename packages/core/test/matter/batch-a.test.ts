/**
 * Batch A of `spikes/vocabulary`, as far as the matter engine reaches: expressible is not
 * derivable, and this is where the difference shows. Each test asserts what the scenario
 * says a sensible person expects. `it.fails` marks an outcome the rules cannot yet produce,
 * with the reason; it turns red the day they can, which is when the mark comes off.
 *
 * The rows in `elements.ts` were written once, from the vocabulary's anchors, and are not
 * tuned per scenario. No rule in `src/matter` was written for one scenario.
 */
import { describe, expect, it } from "vitest";
import {
  type Act,
  effective,
  play,
  resolve,
  searchOdds,
  strength,
} from "../../src/matter/index.ts";
import { body, thing, world } from "./elements.ts";

const flame = thing("flame", "fire", "hearth", { burning: { of: "self", fuel: 600 } });
const heatFrom = (target: string, minutes: number, contact = 1): Act => ({
  process: "heat",
  source: "flame",
  target,
  minutes,
  contact,
});

describe("fire and cold", () => {
  it("fire-07: soaked deadfall and green wood will not take a flame, however long", () => {
    const w = world([flame, thing("deadfall", "kindling", "hearth", { wetness: 4 })]);
    const { world: after } = resolve(w, heatFrom("deadfall", 3, 0.5));
    expect(after.things.deadfall?.state.burning).toBeNull();
  });

  it("fire-01: dry tinder catches where damp wood would not, then dries and lights the damp wood", () => {
    const w = world([
      flame,
      thing("tinder", "tinder"),
      thing("branch", "kindling", "hearth", { wetness: 3 }),
    ]);
    const sparks = play(w, [heatFrom("tinder", 0.2), heatFrom("branch", 0.2)]).world;
    expect(sparks.things.tinder?.state.burning).not.toBeNull();
    expect(sparks.things.branch?.state.burning).toBeNull();
    const later = resolve(sparks, {
      process: "heat",
      source: "tinder",
      target: "branch",
      minutes: 25,
    });
    expect(later.world.things.branch?.state.wetness).toBeLessThan(3);
    expect(later.world.things.branch?.state.burning).not.toBeNull();
  });

  it("fire-03: boots set close to the fire dry, and get hot rather than warm", () => {
    const w = world([flame, thing("boots", "leather", "hearth", { wetness: 3 })]);
    const near = resolve(w, heatFrom("boots", 60, 0.8)).world.things.boots;
    const far = resolve(w, heatFrom("boots", 60, 0.1)).world.things.boots;
    expect(near?.state.wetness).toBeLessThan(1.2);
    expect(near?.state.temperature).toBeGreaterThan(4);
    expect(far?.state.temperature).toBeLessThan(3.5);
  });

  it.fails("fire-03: left too close, the leather stiffens and cracks (M1's dried-fast-and-hot is not a rule yet)", () => {
    const w = world([flame, thing("boots", "leather", "hearth", { wetness: 3 })]);
    const boots = resolve(w, heatFrom("boots", 60, 0.8)).world.things.boots;
    expect(boots?.state.integrity).toBeLessThan(5);
  });

  it("water-10: a skin of water does not put out a deep fire; enough water does", () => {
    const w = world([
      thing("coals", "oak", "hearth", { burning: { of: "self", fuel: 300 } }),
      thing("skin", "water", "hearth", { amount: 2 }),
      thing("trough", "water", "hearth", { amount: 40 }),
    ]);
    const little = resolve(w, { process: "soak", liquid: "skin", target: "coals", amount: 2 });
    expect(little.world.things.coals?.state.burning).not.toBeNull();
    expect(little.changes.some((c) => c.kind === "signal" && c.channel === "smoke")).toBe(true);
    const plenty = resolve(w, { process: "soak", liquid: "trough", target: "coals", amount: 40 });
    expect(plenty.world.things.coals?.state.burning).toBeNull();
  });

  it.fails("fire-08: the steam scalds the hand that held the skin over the coals (steam is a signal, not a hot gas that meets a body)", () => {
    const w = world(
      [
        thing("coals", "oak", "hearth", { burning: { of: "self", fuel: 30 } }),
        thing("skin", "water", "hearth", { amount: 5 }),
      ],
      [body("player")],
    );
    const { world: after } = resolve(w, {
      process: "soak",
      liquid: "skin",
      target: "coals",
      amount: 5,
    });
    expect(after.bodies.player?.wounds.length).toBeGreaterThan(0);
  });

  it.fails("fire-09: banked under ash, coals keep a low heat all night and catch again when a draft reaches them (no air means out, not smouldering)", () => {
    const w = world([
      thing("coals", "oak", "pit", { burning: { of: "self", fuel: 900 }, temperature: 5 }),
    ]);
    const night = resolve(w, { process: "drift", minutes: 480 }).world;
    expect(night.things.coals?.state.temperature).toBeGreaterThan(3);
  });

  it("cold-01: rain soaks the washing again, and left wet it goes musty", () => {
    const w = world([thing("shirt", "cloth", "rain", { wetness: 0 })]);
    const hour = resolve(w, { process: "drift", minutes: 60 }).world;
    expect(hour.things.shirt?.state.wetness).toBeGreaterThan(2);
  });

  it.fails("cold-01: and the wet cloth turns musty in a day or two (cloth's row has no perishability, and nothing else says damp fibre moulds)", () => {
    const w = world([thing("shirt", "cloth", "rain", { wetness: 4 })]);
    const days = resolve(w, { process: "drift", minutes: 2880 }).world;
    expect(days.things.shirt?.state.contamination).toBeGreaterThan(0.5);
  });

  it.fails("cold-03: water freezing in a jug cracks it (contents, swell and pressure are in the vocabulary and not in the engine)", () => {
    const w = world([thing("jug", "clay", "cellar", { set: true })]);
    const frozen = resolve(w, { process: "drift", minutes: 600 }).world;
    expect(frozen.things.jug?.state.integrity).toBeLessThan(5);
  });
});

describe("water and mixing", () => {
  it("water-08: boiling makes bad water safe, and does nothing for a poison in it", () => {
    const w = world([
      flame,
      thing("pot", "water", "hearth", { contamination: 3, taint: 2, amount: 3 }),
    ]);
    const boiled = resolve(w, heatFrom("pot", 20)).world.things.pot;
    expect(boiled?.state.temperature).toBeGreaterThanOrEqual(4.5);
    expect(boiled?.state.contamination).toBe(0);
    expect(boiled?.state.taint).toBe(2);
  });

  it("mix-04: water lifts mud from a shirt and not dried blood; soap lifts the blood", () => {
    const stained = (element: string, bond: number) =>
      world([
        thing("shirt", "cloth", "hearth", {
          coating: { element, amount: 0.1, coverage: 0.3, bond },
        }),
        thing("stream", "water", "hearth", { amount: 100 }),
        thing("suds", "soapy", "hearth", { amount: 10 }),
      ]);
    const wash = (w: ReturnType<typeof stained>, liquid: string) =>
      resolve(w, { process: "soak", liquid, target: "shirt", amount: 1 }).world.things.shirt?.state
        .coating;
    expect(wash(stained("mud", 0), "stream")).toBeNull();
    expect(wash(stained("blood", 3), "stream")).not.toBeNull();
    expect(wash(stained("blood", 3), "suds")).toBeNull();
  });

  it("mix-04: and the blood bonds because it dried into something that drinks", () => {
    const w = world([
      thing("shirt", "cloth", "hearth", {
        coating: { element: "blood", amount: 0.1, coverage: 0.3, bond: 0 },
      }),
    ]);
    const dried = resolve(w, { process: "drift", minutes: 360 }).world.things.shirt;
    expect(dried?.state.coating?.bond).toBeGreaterThan(2);
  });

  it("mix-03 and tool-04: iron left in the rain, or sheathed wet, rusts; dried, or oiled, it does not", () => {
    const night = { process: "drift", minutes: 720 } as const;
    const rusted = (at: string, set = {}) =>
      resolve(world([thing("knife", "blade", at, { edge: 4, wetness: 1, ...set })]), night).world
        .things.knife?.state.corrosion ?? 0;
    expect(rusted("rain")).toBeGreaterThan(0.1);
    expect(rusted("sheath")).toBeGreaterThan(0.1);
    expect(rusted("hearth")).toBeLessThan(rusted("sheath") / 2);
    const oiled = { coating: { element: "oil", amount: 0.1, coverage: 1, bond: 0 } };
    expect(rusted("sheath", oiled)).toBe(0);
  });

  it.fails("mix-10: brine eats iron faster than plain water (what is dissolved in the wet does not reach the rate)", () => {
    const pot = (liquid: string) => {
      const w = world([
        thing("pot", "iron", "sheath"),
        thing("fill", liquid, "sheath", { amount: 5 }),
      ]);
      const wet = resolve(w, { process: "soak", liquid: "fill", target: "pot", amount: 1 }).world;
      return (
        resolve(wet, { process: "drift", minutes: 4320 }).world.things.pot?.state.corrosion ?? 0
      );
    };
    expect(pot("brine")).toBeGreaterThan(pot("water") * 1.5);
  });
});

describe("tools and building", () => {
  it("tool-01: a belt knife scars an oak, dulls, and does not fell it", () => {
    const w = world([thing("knife", "blade", "hearth", { edge: 4 }), thing("tree", "oak")]);
    const hack: Act = {
      process: "force",
      instrument: "knife",
      patient: "tree",
      manner: { effort: 3, care: 2, haste: 3 },
    };
    const after = play(
      w,
      Array.from({ length: 12 }, () => hack),
    ).world;
    expect(after.things.tree?.state.integrity).toBeGreaterThan(4);
    expect(after.things.tree?.state.integrity).toBeLessThan(5);
    expect(after.things.knife?.state.edge).toBeLessThan(3);
  });

  it("tool-03: a hammerstone shatters flint, which no knife could cut, and a keen flake comes away", () => {
    const w = world([
      thing("rock", "stone"),
      thing("knife", "blade", "hearth", { edge: 4 }),
      thing("nodule", "flint"),
    ]);
    const cut = resolve(w, { process: "force", instrument: "knife", patient: "nodule" });
    expect(cut.world.things.nodule?.state.integrity).toBeGreaterThan(4.5);
    const struck = resolve(w, {
      process: "force",
      instrument: "rock",
      patient: "nodule",
      manner: { effort: 3, care: 3, haste: 1 },
    });
    expect(struck.world.things.nodule?.state.integrity).toBe(0);
    expect(struck.world.things["nodule.piece"]?.state.edge).toBe(4);
    expect(struck.changes.some((c) => c.kind === "signal" && c.channel === "light")).toBe(true);
  });

  it("tool-03: and a careless strike shatters it into blunt chunks instead", () => {
    const w = world([thing("rock", "stone"), thing("nodule", "flint")]);
    const struck = resolve(w, {
      process: "force",
      instrument: "rock",
      patient: "nodule",
      manner: { effort: 3, care: 0, haste: 5 },
    });
    expect(struck.world.things["nodule.piece"]?.state.edge).toBe(0);
  });

  it("build-03: a thin rail snaps under a boulder", () => {
    const w = world([thing("rail", "kindling"), thing("boulder", "stone")]);
    const rail = w.things.rail;
    expect(rail ? strength(w, rail) : 9).toBeLessThan(3);
    const { world: after } = resolve(w, { process: "load", support: "rail", bearing: ["boulder"] });
    expect(after.things.rail?.state.integrity).toBeLessThanOrEqual(1);
  });

  it.fails("build-03: and a stout beam of the same wood moves it (a lever multiplies effort; load only compares mass with strength)", () => {
    const w = world([thing("beam", "oak"), thing("boulder", "gold", "hearth", { amount: 1 })]);
    const { changes } = resolve(w, { process: "load", support: "beam", bearing: ["boulder"] });
    expect(changes.some((c) => c.kind === "state" && c.thing === "boulder")).toBe(true);
  });

  it("build-07: a sound branch holds a climber and a rotten one does not, and they look the same", () => {
    const sound = world([thing("branch", "bough"), thing("climber", "iron")]);
    const rotten = world([
      thing("branch", "bough", "hearth", { flaw: 3 }),
      thing("climber", "iron"),
    ]);
    const hang: Act = { process: "load", support: "branch", bearing: ["climber"] };
    expect(resolve(sound, hang).world.things.branch?.state.integrity).toBe(5);
    expect(resolve(rotten, hang).world.things.branch?.state.integrity).toBeLessThanOrEqual(1);
    const [a, b] = [sound.things.branch, rotten.things.branch];
    expect(a && b ? effective(sound, a) : 1).toEqual(a && b ? effective(rotten, b) : 2);
  });
});

describe("food and bodies", () => {
  it("food-01: meat left out warm and damp satisfies now and sickens hours later", () => {
    const w = world(
      [thing("meat", "meat", "warm", { wetness: 2 })],
      [body("player", { place: "warm" })],
    );
    const stale = resolve(w, { process: "drift", minutes: 720 }).world;
    expect(stale.things.meat?.state.contamination).toBeGreaterThan(1.5);
    const ate = resolve(stale, { process: "ingest", body: "player", thing: "meat" }).world;
    // Hunger rises with the hours now, so it is lower than it was, not nothing.
    expect(ate.bodies.player?.needs.hunger).toBeLessThan(stale.bodies.player?.needs.hunger ?? 0);
    expect(ate.bodies.player?.health).toBe(5);
    expect(ate.bodies.player?.sickensIn).toBeGreaterThan(60);
    const later = resolve(ate, { process: "drift", minutes: 300 }).world;
    expect(later.bodies.player?.health).toBeLessThan(5);
  });

  it("food-01: eaten fresh, the same meat does no harm", () => {
    const w = world([thing("meat", "meat")], [body("player")]);
    const ate = resolve(w, { process: "ingest", body: "player", thing: "meat" }).world;
    expect(ate.bodies.player?.sickness).toBe(0);
  });

  it("food-05: bread moulds in a damp cellar over days, slower for the cold, and whatever eats it sickens", () => {
    const w = world(
      [thing("loaf", "bread", "cellar", { wetness: 2 })],
      [body("rat", { place: "cellar" })],
    );
    const day = resolve(w, { process: "drift", minutes: 1440 }).world;
    const week = resolve(w, { process: "drift", minutes: 10080 }).world;
    expect(day.things.loaf?.state.contamination).toBeLessThan(1);
    expect(week.things.loaf?.state.contamination).toBeGreaterThan(2);
    const ate = resolve(week, { process: "ingest", body: "rat", thing: "loaf" }).world;
    expect(ate.bodies.rat?.sickness).toBeGreaterThan(0);
  });

  it("food-06: a poison mushroom gives no sign, and tells hours later", () => {
    const w = world([thing("cap", "mushroom")], [body("player")]);
    const ate = resolve(w, { process: "ingest", body: "player", thing: "cap" });
    expect(ate.world.bodies.player?.health).toBe(5);
    expect(ate.world.bodies.player?.sickness).toBe(5);
    expect(ate.changes.some((c) => c.because.includes("P17"))).toBe(true);
    const later = resolve(ate.world, { process: "drift", minutes: 240 }).world;
    expect(later.bodies.player?.health).toBeLessThan(4);
  });

  it("food-03: packed in salt, fish keeps for weeks: what dissolves readily ties the water up", () => {
    const w = world([
      thing("fish", "meat", "cellar"),
      thing("salt", "salt", "cellar", { amount: 2 }),
    ]);
    const salted = resolve(w, {
      process: "coat",
      substance: "salt",
      target: "fish",
      amount: 1,
    }).world;
    const plain =
      resolve(w, { process: "drift", minutes: 20160 }).world.things.fish?.state.contamination ?? 0;
    const kept =
      resolve(salted, { process: "drift", minutes: 20160 }).world.things.fish?.state
        .contamination ?? 0;
    expect(kept).toBeLessThan(plain / 2);
  });
});

describe("finding", () => {
  it("find-06: searching the same spot again at once gives worse odds, not better", () => {
    const glance = {
      process: "search",
      place: "grass",
      element: "stone",
      minutes: 10,
      draw: 0.99,
    } as const;
    const first = searchOdds(world([]), glance);
    const again = searchOdds(resolve(world([]), glance).world, glance);
    expect(again).toBeLessThan(first);
  });

  it.fails("find-06: until the river rises overnight and reshuffles the gravel (nothing renews a searched place)", () => {
    const glance = {
      process: "search",
      place: "grass",
      element: "stone",
      minutes: 10,
      draw: 0.99,
    } as const;
    const searched = resolve(world([]), glance).world;
    const nextDay = resolve(searched, { process: "drift", minutes: 1440 }).world;
    expect(searchOdds(nextDay, glance)).toBeGreaterThan(searchOdds(searched, glance));
  });
});
