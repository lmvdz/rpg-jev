/**
 * Batch A, food and body, run through the matter engine. Rows come from `elements.ts` and
 * `rows-food-body.ts` and were written before anything was run. `it.fails` marks what the
 * rules cannot produce, or produce wrongly (`RULE ERROR`), with the reason in brackets.
 *
 * Already covered elsewhere and skipped here: food-01, food-03, food-05, food-06.
 * Not in reach of the engine at all, and so not tested: food-04, body-03, body-04, body-06,
 * body-07, body-09.
 */
import { describe, expect, it } from "vitest";
import { type Act, effective, type MatterWorld, play, resolve } from "../../src/matter/index.ts";
import { body, thing, world } from "./elements.ts";
import { EXTRA } from "./rows-food-body.ts";

const DAY = 1440;
const wait = (minutes: number): Act => ({ process: "drift", minutes });

/** Moving is not built (X1), so a test carries a thing to another place by hand. */
function carried(w: MatterWorld, id: string, place: string): MatterWorld {
  const held = w.things[id];
  return held ? { ...w, things: { ...w.things, [id]: { ...held, place } } } : w;
}

const needSum = (w: MatterWorld, id: string) =>
  Object.values(w.bodies[id]?.needs ?? {}).reduce((sum, n) => sum + n, 0);

describe("food", () => {
  const rack = world([thing("strips", "strips", "sun", { wetness: 3 })], [], EXTRA);

  it("food-02: thin strips hung in sun and dry air lose their moisture within days", () => {
    const dried = resolve(rack, wait(3 * DAY)).world.things.strips;
    expect(dried?.state.wetness).toBeLessThan(0.5);
  });

  it("food-02: rain soaks the half-dried strips again and undoes the drying", () => {
    const half = resolve(rack, wait(6 * 60)).world;
    const before = half.things.strips?.state.wetness ?? 9;
    expect(before).toBeLessThan(3);
    const rained = resolve(carried(half, "strips", "rain"), wait(180)).world.things.strips;
    expect(rained?.state.wetness).toBeGreaterThan(before + 1);
  });

  it("food-02: over the same hours the damp strips turn faster than the dry ones", () => {
    const start = world(
      [
        thing("damp", "strips", "warm", { wetness: 3 }),
        thing("dry", "strips", "sun", { wetness: 0.05 }),
      ],
      [],
      EXTRA,
    );
    const after = resolve(start, wait(6 * 60)).world;
    const damp = after.things.damp?.state.contamination ?? 0;
    const dry = after.things.dry?.state.contamination ?? 9;
    expect(damp).toBeGreaterThan(dry * 1.3);
  });

  it.fails("RULE ERROR: food-02: dried right through, the jerky is safe and keeps; left damp it moulds instead (drift.ts lets rot grow at four tenths of full rate in bone-dry meat, so three days of sun make jerky as rotten as anything can be, and finished and ruined batches come out the same)", () => {
    const jerky = resolve(rack, wait(3 * DAY)).world;
    expect(jerky.things.strips?.state.contamination).toBeLessThan(1.5);
    const kept = resolve(jerky, wait(14 * DAY)).world.things.strips;
    expect(kept?.state.contamination).toBeLessThan(2);
  });

  it.fails("RULE ERROR: food-02: the batch rained on and left damp ends worse than the batch that was re-hung and finished (both reach the ceiling of contamination, because dryness never stops it)", () => {
    const day = resolve(rack, wait(DAY)).world;
    const rained = resolve(carried(day, "strips", "rain"), wait(180)).world;
    const leftDamp = resolve(carried(rained, "strips", "warm"), wait(2 * DAY)).world;
    const rehung = resolve(carried(rained, "strips", "sun"), wait(2 * DAY)).world;
    const ruined = leftDamp.things.strips?.state.contamination ?? 0;
    const finished = rehung.things.strips?.state.contamination ?? 9;
    expect(ruined).toBeGreaterThan(finished + 1);
  });

  describe("food-07: a poison passing from plant to goat to milk to people", () => {
    it("the goat grazes the weed with no sign, and sickens within the day", () => {
      const w = world([thing("patch", "weed")], [body("goat")], EXTRA);
      const ate = resolve(w, { process: "ingest", body: "goat", thing: "patch" }).world;
      expect(ate.bodies.goat?.health).toBe(5);
      expect(ate.bodies.goat?.sickensIn).toBeGreaterThan(30);
      const nextDay = resolve(ate, wait(DAY)).world;
      expect(nextDay.bodies.goat?.health).toBeLessThan(5);
      expect(nextDay.bodies.goat?.health).toBeGreaterThan(1);
    });

    it("milk that carries the dose looks like milk, and whoever drinks it falls ill hours later", () => {
      const w = world([thing("pail", "milk", "hearth", { taint: 2 })], [body("family")], EXTRA);
      const drank = resolve(w, { process: "ingest", body: "family", thing: "pail" }).world;
      expect(drank.bodies.family?.health).toBe(5);
      expect(drank.bodies.family?.sickensIn).toBeGreaterThan(60);
      const evening = resolve(drank, wait(360)).world;
      expect(evening.bodies.family?.health).toBeLessThan(5);
    });

    it.fails("the toxin passes from the goat into its milk (a body keeps no dose of what it ate, and nothing produces milk from a creature)", () => {
      const w = world([thing("patch", "weed")], [body("goat")], EXTRA);
      const later = play(w, [{ process: "ingest", body: "goat", thing: "patch" }, wait(DAY)]).world;
      const tainted = Object.values(later.things).some(
        (t) => t.element === "milk" && t.state.taint > 0,
      );
      expect(tainted).toBe(true);
    });
  });

  describe("food-08: stagnant water", () => {
    const pond = world(
      [thing("pond", "water", "hearth", { contamination: 3, amount: 50 })],
      [body("player")],
    );
    const drink: Act = { process: "ingest", body: "player", thing: "pond" };

    it("meets the need at once with no sign of harm, and cramps come hours later", () => {
      const drank = resolve(pond, drink).world;
      expect(needSum(drank, "player")).toBeLessThan(needSum(pond, "player"));
      expect(drank.bodies.player?.health).toBe(5);
      expect(drank.bodies.player?.sickensIn).toBeGreaterThan(60);
      const evening = resolve(drank, wait(480)).world;
      expect(evening.bodies.player?.health).toBeLessThan(5);
    });

    it("and the same water from a clean source does no harm", () => {
      const clean = world([thing("pond", "water")], [body("player")]);
      expect(resolve(clean, drink).world.bodies.player?.sickness).toBe(0);
    });

    it("the sickness takes more out of the player than the drink put in (a sickness costs health only: it never draws a need back up, and there is no thirst among the needs)", () => {
      const evening = play(pond, [drink, wait(480)]).world;
      expect(needSum(evening, "player")).toBeGreaterThan(needSum(pond, "player"));
    });
  });

  describe("food-09: a sealed jar left to ferment", () => {
    const larder = world([thing("mash", "mash", "larder", { wetness: 4 })], [], EXTRA);

    it("the ferment keeps working with nobody tending it, and the smell of it grows", () => {
      const weeks = resolve(larder, wait(14 * DAY)).world;
      const [was, now] = [larder.things.mash, weeks.things.mash];
      expect(now?.state.contamination).toBeGreaterThan(2);
      const before = was ? effective(larder, was).scent : 9;
      const after = now ? effective(weeks, now).scent : 0;
      expect(after).toBeGreaterThan(before + 1);
    });

    it.fails("what ferments in a sugary, watery thing becomes drink (M4's second half, potency and gas, is not in effective.ts; pressure, the burst and the scavenger need contents, Load and sensing)", () => {
      const weeks = resolve(larder, wait(14 * DAY)).world;
      const mash = weeks.things.mash;
      expect(mash ? effective(weeks, mash).potency : 0).toBeGreaterThan(1);
    });
  });

  describe("food-10: eating a leather belt", () => {
    const w = world([thing("belt", "leather")], [body("player", { needs: { hunger: 4 } })]);
    const ate = resolve(w, { process: "ingest", body: "player", thing: "belt" });

    it("goes down and is gone, and does nothing for the hunger, with no list of edible things", () => {
      expect(ate.world.things.belt).toBeUndefined();
      expect(ate.world.bodies.player?.needs.hunger).toBe(4);
      expect(ate.world.bodies.player?.sickness).toBe(0);
    });

    it.fails("the tough strips sit heavy and cramp for a while (ingest reads what a thing serves and its noxiousness; nothing reads toughness against a gut)", () => {
      const later = resolve(ate.world, wait(120)).world;
      const felt =
        (later.bodies.player?.sickness ?? 0) > 0 || (later.bodies.player?.health ?? 5) < 5;
      expect(felt).toBe(true);
    });
  });
});

describe("body", () => {
  describe("body-01: an axe into the shin", () => {
    const w = world(
      [thing("axe", "steel", "hearth", { edge: 3 }), thing("strip", "cloth")],
      [body("player")],
    );
    const glance: Act = {
      process: "force",
      instrument: "axe",
      patient: "player",
      manner: { effort: 2, care: 0, haste: 3 },
    };
    const cut = resolve(w, glance).world;

    it("opens a wound that bleeds steadily, and the bleeding costs health while it runs", () => {
      const wound = cut.bodies.player?.wounds[0];
      expect(wound?.depth).toBeGreaterThan(1);
      expect(wound?.bleeding).toBeGreaterThan(1);
      const later = resolve(cut, wait(30)).world;
      expect(later.bodies.player?.health).toBeLessThan(5);
      expect(later.bodies.player?.health).toBeGreaterThan(1);
    });

    it("fixed rule: body-01: a leg wound one can walk on has not killed an hour and a half later, and a scratch never does (driftBody in drift.ts drains health by bleeding times minutes for ever: nothing clots, so this cut kills in eighty minutes and a bleed of half a level kills overnight)", () => {
      const later = resolve(cut, wait(90)).world;
      expect(later.bodies.player?.health).toBeGreaterThan(1);
      const scratch = world(
        [],
        [body("player", { wounds: [{ depth: 0.5, bleeding: 0.5, burned: 0 }] })],
      );
      expect(resolve(scratch, wait(480)).world.bodies.player?.health).toBeGreaterThan(4);
    });

    it.fails("a cloth strip wrapped tight slows the bleeding (join has only its coating half, and not onto a body; so a wrap has no strength for care to set or walking to loosen)", () => {
      const wrapped = resolve(cut, {
        process: "coat",
        substance: "strip",
        target: "player",
        manner: { effort: 3, care: 1, haste: 4 },
      }).world;
      const before = cut.bodies.player?.wounds[0]?.bleeding ?? 0;
      expect(wrapped.bodies.player?.wounds[0]?.bleeding).toBeLessThan(before);
    });
  });

  describe("body-02: the burning sword in a fight", () => {
    const start = world(
      [
        thing("sword", "steel", "hearth", { edge: 4 }),
        thing("flask", "oil"),
        thing("campfire", "fire", "hearth", { burning: { of: "self", fuel: 600 } }),
        thing("tunic", "cloth"),
      ],
      [body("attacker")],
    );
    const lit = play(start, [
      { process: "coat", substance: "flask", target: "sword" },
      { process: "heat", source: "campfire", target: "sword", minutes: 2 },
    ]).world;

    it("a passing cut opens a wound burned at the edges that still bleeds: too brief to seal", () => {
      expect(lit.things.sword?.state.burning?.of).toBe("coating");
      const after = resolve(lit, {
        process: "force",
        instrument: "sword",
        patient: "attacker",
        seconds: 0.3,
      }).world;
      const wound = after.bodies.attacker?.wounds[0];
      expect(wound?.burned).toBeGreaterThan(0);
      expect(wound?.bleeding).toBeGreaterThan(2);
    });

    it.fails("RULE ERROR: body-02: cloth the burning blade lies against for ten seconds catches light (heat.ts brings a surface up to a flame on a scale of minutes: cloth held in open flame stays unlit for well over a minute; and a burning coat does not smear onto what it touches)", () => {
      const after = resolve(lit, {
        process: "heat",
        source: "sword",
        target: "tunic",
        minutes: 10 / 60,
      }).world;
      expect(after.things.tunic?.state.burning).not.toBeNull();
    });
  });

  describe("body-05: last month's berry wine", () => {
    it.fails("RULE ERROR: body-05: a cup of what fermented in the jar for a month warms and loosens, and does not poison (effective.ts M4 turns every contamination into noxiousness, so a ferment is eaten as rot: the drinker is struck as by spoiled meat, and nothing reads potency)", () => {
      const w = world(
        [thing("wine", "mash", "larder", { wetness: 4, amount: 6 })],
        [body("player", { place: "larder" })],
        EXTRA,
      );
      const month = resolve(w, wait(30 * DAY)).world;
      expect(month.things.wine?.state.contamination).toBeGreaterThan(2);
      const drank = resolve(month, { process: "ingest", body: "player", thing: "wine" }).world;
      expect(drank.bodies.player?.sickness).toBeLessThan(2);
    });
  });

  describe("body-08: cautery with a heated knife", () => {
    const camp = world(
      [
        thing("knife", "blade", "hearth", { edge: 4 }),
        thing("campfire", "fire", "hearth", { burning: { of: "self", fuel: 600 } }),
      ],
      [body("companion", { wounds: [{ depth: 4, bleeding: 4, burned: 0 }] })],
    );
    const held = (seconds: number): Act => ({
      process: "force",
      instrument: "knife",
      patient: "companion",
      seconds,
      manner: { effort: 0, care: 4, haste: 0 },
    });
    const inFire: Act = { process: "heat", source: "campfire", target: "knife", minutes: 10 };

    it("the knife must be heated first: held cold on the wound it does nothing", () => {
      const after = resolve(camp, held(5)).world;
      expect(after.bodies.companion?.wounds[0]?.bleeding).toBe(4);
    });

    it("heated in the fire and held steady it stops the bleeding, and leaves a real burn", () => {
      const after = play(camp, [inFire, held(5)]).world;
      expect(after.things.knife?.state.temperature).toBeGreaterThan(4);
      const wound = after.bodies.companion?.wounds[0];
      expect(wound?.bleeding).toBe(0);
      expect(wound?.burned).toBeGreaterThan(2);
      expect(after.bodies.companion?.wounds).toHaveLength(1);
    });

    it("the same hot knife only touched to it does not seal it", () => {
      const after = play(camp, [inFire, held(0.3)]).world;
      expect(after.bodies.companion?.wounds[0]?.bleeding).toBe(4);
    });

    it.fails("left untended, the burn risks turning septic in the days after (a wound carries no contamination, so nothing can fester)", () => {
      const days = play(camp, [inFire, held(5), wait(4 * DAY)]).world;
      expect(days.bodies.companion?.sickness).toBeGreaterThan(0);
    });
  });

  describe("body-10: a carcass nobody touches", () => {
    const at = (place: string) =>
      world([thing("deer", "carcass", place, { wetness: 2 })], [], EXTRA);

    it("rots within the day in the warm, far faster than it would in the cold, and stinks", () => {
      const warm = resolve(at("warm"), wait(DAY)).world;
      const cold = resolve(at("cellar"), wait(DAY)).world;
      const rot = warm.things.deer?.state.contamination ?? 0;
      expect(rot).toBeGreaterThan(2);
      expect(rot).toBeGreaterThan((cold.things.deer?.state.contamination ?? 9) * 2);
      const deer = warm.things.deer;
      expect(deer ? effective(warm, deer).scent : 0).toBeGreaterThan(3.5);
    });

    it.fails("and the smell goes out into the clearing for flies and predators to find (drift emits no signal: scent is a level on the thing, and nothing senses or comes)", () => {
      const { changes } = resolve(at("warm"), wait(2 * DAY));
      expect(changes.some((c) => c.kind === "signal" && c.channel === "scent")).toBe(true);
    });
  });
});
