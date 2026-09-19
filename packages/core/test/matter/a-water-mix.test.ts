/**
 * Batch A, water and mixing, run through the matter engine. Each test asserts what the
 * scenario says a sensible person expects. `it.fails` marks an outcome the rules do not
 * produce, with the reason in brackets; a name that starts `RULE ERROR:` marks one the rules
 * get wrong. Rows are in `rows-water-mix.ts`, written before anything ran.
 *
 * Already covered in `batch-a.test.ts` and skipped here: water-08, water-10, mix-03, mix-10,
 * and mix-04 but for one case its test steps round. Unbuilt, so no test: water-01, water-02,
 * water-06, water-09, mix-05, mix-07.
 */
import { describe, expect, it } from "vitest";
import { type Act, effective, type MatterWorld, play, resolve } from "../../src/matter/index.ts";
import { body, thing, world } from "./elements.ts";
import { EXTRA } from "./rows-water-mix.ts";

const hours = (n: number): Act => ({ process: "drift", minutes: n * 60 });

/** Stands in for X1, which the engine does not have: the same thing, somewhere else. */
function carried(w: MatterWorld, id: string, to: string): MatterWorld {
  const held = w.things[id];
  return held ? { ...w, things: { ...w.things, [id]: { ...held, place: to } } } : w;
}

describe("water", () => {
  it("water-03: sun and a dry wind pull the wet out of a skin faster than still mild air does", () => {
    const lost = (at: string) => {
      const w = world([thing("skin", "leather", at, { wetness: 3 })], [], EXTRA);
      return 3 - (resolve(w, hours(4)).world.things.skin?.state.wetness ?? 3);
    };
    expect(lost("ridge")).toBeGreaterThan(lost("hearth") * 1.25);
  });

  it.fails("water-03: open water left in the sun for hours is noticeably less (drift dries wetness out of things, and no rate takes from a liquid's own amount: evaporate is in X7 and not in DRIFTS)", () => {
    const w = world([thing("water", "water", "ridge", { amount: 2 })], [], EXTRA);
    const after = resolve(w, hours(6)).world.things.water;
    expect(after?.state.amount).toBeLessThan(1.9);
  });

  const flooded = resolve(
    world([thing("bedding", "bedding", "hollow")], [], EXTRA),
    hours(8),
  ).world;
  const inTheSun = carried(flooded, "bedding", "sun");

  it("water-04: bedding lying in floodwater overnight is soaked through", () => {
    expect(flooded.things.bedding?.state.wetness).toBeGreaterThan(4);
  });

  it.fails("RECALIBRATE (a level of mass became a step of four, cords bear in tension, bulk dries by powers; the assertion's magnitude was set against the old scale): water-04: and it takes most of a sunny day to dry, not an hour or two", () => {
    const early = resolve(inTheSun, hours(2)).world.things.bedding;
    const late = resolve(inTheSun, hours(16)).world.things.bedding;
    expect(early?.state.wetness).toBeGreaterThan(2);
    expect(late?.state.wetness).toBeLessThan(1);
  });

  it("water-04: and it smells of mildew afterward, dried or not", () => {
    const after = resolve(inTheSun, hours(14)).world;
    const bedding = after.things.bedding;
    expect(bedding?.state.contamination).toBeGreaterThan(0.3);
    expect(bedding ? effective(after, bedding).scent : 0).toBeGreaterThan(0.15);
  });

  it("fixed rule: water-04: bedding kept dry indoors for a month goes as rotten as a thing can be (the contamination drift keeps 40% of its rate at wetness 0, so dryness never stops rot)", () => {
    const w = world([thing("bedding", "bedding", "hearth")], [], EXTRA);
    const month = resolve(w, hours(24 * 30)).world.things.bedding;
    expect(month?.state.contamination).toBeLessThan(0.5);
  });

  it("water-05: fouled water drunk too soon goes down like any water and tells hours later; clean water does not", () => {
    const drunk = (contamination: number) => {
      const w = world(
        [thing("hole", "water", "hearth", { amount: 50, contamination })],
        [body("dog")],
        EXTRA,
      );
      return resolve(w, { process: "ingest", body: "dog", thing: "hole" }).world;
    };
    const fouled = drunk(2);
    expect(fouled.bodies.dog?.health).toBe(5);
    expect(fouled.bodies.dog?.sickness).toBeGreaterThan(1);
    expect(fouled.bodies.dog?.sickensIn).toBeGreaterThan(60);
    expect(resolve(fouled, hours(5)).world.bodies.dog?.health).toBeLessThan(5);
    expect(drunk(0).bodies.dog?.sickness).toBe(0);
  });

  const loaf = world(
    [
      thing("loaf", "bread", "river"),
      thing("current", "water", "river", { amount: 1000, contamination: 1 }),
    ],
    [body("player")],
    EXTRA,
  );
  const sodden = play(loaf, [
    { process: "soak", liquid: "current", target: "loaf", amount: 5 },
    hours(3),
  ]).world;

  it("water-07: a loaf under river water soaks through and loses what firmness it had", () => {
    const bread = sodden.things.loaf;
    expect(bread?.state.wetness).toBeGreaterThan(3.5);
    const p = bread ? effective(sodden, bread) : undefined;
    expect(p?.toughness).toBeLessThan(0.5);
    expect(p?.hardness).toBeLessThan(0.5);
  });

  it.fails("water-07: and it is ruined as food (nothing ties wetness to integrity or to what a thing serves: a sodden loaf is whole and feeds as well as a fresh one)", () => {
    const fed = (w: MatterWorld) =>
      resolve(w, { process: "ingest", body: "player", thing: "loaf" }).world.bodies.player?.needs
        .hunger ?? 0;
    const fellApart = (sodden.things.loaf?.state.integrity ?? 5) < 5;
    expect(fellApart || fed(sodden) > fed(loaf)).toBe(true);
  });
});

describe("mixing: tar on rope", () => {
  const yard = world(
    [
      thing("rope", "rope"),
      thing("pot", "tar", "hearth", { temperature: 4.5, amount: 3 }),
      thing("trough", "water", "hearth", { amount: 40 }),
      thing("flame", "fire", "hearth", { burning: { of: "self", fuel: 600 } }),
    ],
    [],
    EXTRA,
  );
  const tarred = resolve(yard, {
    process: "coat",
    substance: "pot",
    target: "rope",
    amount: 0.5,
    manner: { effort: 2, care: 3, haste: 1 },
  }).world;
  const drench = (w: MatterWorld) =>
    resolve(w, { process: "soak", liquid: "trough", target: "rope", amount: 5 }).world.things.rope
      ?.state.wetness ?? 0;

  it("mix-01: the rope takes the tar, the pot has less, and the rope is gummy to the touch", () => {
    const rope = tarred.things.rope;
    expect(rope?.state.coating?.element).toBe("tar");
    expect(tarred.things.pot?.state.amount).toBeLessThan(3);
    expect(rope ? effective(tarred, rope).stickiness : 0).toBeGreaterThan(3);
  });

  it("mix-01: tarred, it sheds water that would soak bare rope, and water does not lift the tar", () => {
    const after = resolve(tarred, { process: "soak", liquid: "trough", target: "rope", amount: 5 });
    expect(drench(tarred)).toBeLessThan(drench(yard) / 2);
    expect(after.world.things.rope?.state.coating?.element).toBe("tar");
  });

  it.fails("mix-01: left to cool for hours, the tar hardens and is no longer gummy (a coat has no temperature: M6 lends the row's stickiness whatever, and M2 never reaches a coat)", () => {
    const cooled = resolve(tarred, hours(8)).world;
    const [hot, cold] = [tarred.things.rope, cooled.things.rope];
    const gummy = hot ? effective(tarred, hot).stickiness : 0;
    expect(cold ? effective(cooled, cold).stickiness : 9).toBeLessThan(gummy);
  });

  it.fails("mix-01: and the rope turns stiff (M6 lends surface properties only: a set coat adds no hardness and takes no flexibility)", () => {
    const cooled = resolve(tarred, hours(8)).world;
    const [bare, cold] = [yard.things.rope, cooled.things.rope];
    const limp = bare ? effective(yard, bare).flexibility : 0;
    expect(cold ? effective(cooled, cold).flexibility : 9).toBeLessThan(limp);
  });

  it("fixed rule: mix-01: a cold, hard block of tar coats the rope as well as hot tar does (coat in soak.ts never reads the substance: not its phase, its melts-at, its form or its stickiness)", () => {
    const cold = world(
      [thing("rope", "rope"), thing("block", "tar", "hearth", { temperature: 1, amount: 3 })],
      [],
      EXTRA,
    );
    const { world: after } = resolve(cold, { process: "coat", substance: "block", target: "rope" });
    expect(after.things.rope?.state.coating).toBeNull();
  });

  it("fixed rule: mix-01: a rope dipped in tar will not take a flame, where bare rope does (S2 wetness has no substance: soak makes any liquid wet like water, and M1 takes 0.8 of flammability per level of it)", () => {
    const dipped = play(yard, [
      { process: "soak", liquid: "pot", target: "rope", amount: 1 },
      { process: "heat", source: "flame", target: "rope", minutes: 2 },
    ]).world;
    expect(dipped.things.rope?.state.burning).not.toBeNull();
  });
});

describe("mixing: oil on a hinge", () => {
  const gate = world(
    [
      thing("hinge", "hinge", "hearth", { corrosion: 2 }),
      thing("tin", "oil", "hearth", { amount: 5 }),
    ],
    [],
    EXTRA,
  );
  const oilOn = (amount: number): Act => ({
    process: "coat",
    substance: "tin",
    target: "hinge",
    amount,
  });
  const oiled = resolve(gate, oilOn(0.2)).world;

  it("mix-02: a light coat of oil takes to the hinge, keeps the wet off it, and leaves less in the tin", () => {
    const [bare, slick] = [gate.things.hinge, oiled.things.hinge];
    expect(slick?.state.coating?.element).toBe("oil");
    expect(oiled.things.tin?.state.amount).toBeLessThan(5);
    const before = bare ? effective(gate, bare).corrodibility : 0;
    expect(slick ? effective(oiled, slick).corrodibility : 9).toBeLessThan(before / 2);
  });

  it.fails("mix-02: and the oil quiets the squeal (M6's surface list lends flammability, stickiness, oiliness, scent and noxiousness, and not friction)", () => {
    const [bare, slick] = [gate.things.hinge, oiled.things.hinge];
    const squeal = bare ? effective(gate, bare).friction : 0;
    expect(slick ? effective(oiled, slick).friction : 9).toBeLessThan(squeal);
  });

  it("fixed rule: mix-02: putting more oil on leaves less oil on (coat in soak.ts replaces whatever coat was there with the new amount; the old coat leaves the world)", () => {
    const more = resolve(oiled, oilOn(0.1)).world;
    expect(more.things.hinge?.state.coating?.amount).toBeGreaterThanOrEqual(0.2);
  });

  it.fails("mix-02: more than the joint can hold runs off it (a coat's amount has no ceiling from the size of what it covers, and nothing makes the run-off)", () => {
    const flooded = resolve(oiled, oilOn(3)).world;
    expect(flooded.things.hinge?.state.coating?.amount).toBeLessThan(1);
  });

  it("fixed rule: mix-02: oil poured over the hinge rusts it (S2 wetness has no substance: soak wets iron with oil as if with water, and the corrosion drift reads only that it is wet)", () => {
    const poured = play(gate, [
      { process: "soak", liquid: "tin", target: "hinge", amount: 1 },
      hours(72),
    ]).world;
    expect(poured.things.hinge?.state.corrosion).toBeLessThanOrEqual(2);
  });
});

describe("mixing: stains and salt", () => {
  it("fixed rule: mix-04: mud that dried on a shirt for a day will not wash out in a stream, exactly like blood (the bond drift in drift.ts reads only what the cloth drinks, never what the coat is: loose, soluble grit bonds as hard as a protein)", () => {
    const w = world(
      [
        thing("shirt", "cloth", "hearth", {
          coating: { element: "mud", amount: 0.1, coverage: 0.3, bond: 0 },
        }),
        thing("stream", "water", "hearth", { amount: 100 }),
      ],
      [],
      EXTRA,
    );
    const washed = play(w, [
      hours(24),
      { process: "soak", liquid: "stream", target: "shirt", amount: 1 },
    ]).world;
    expect(washed.things.shirt?.state.coating).toBeNull();
  });

  const salting = world(
    [thing("meat", "meat", "shed"), thing("sack", "salt", "shed", { amount: 2 })],
    [],
    EXTRA,
  );
  const rub = (care: number, haste: number, amount: number): Act => ({
    process: "coat",
    substance: "sack",
    target: "meat",
    amount,
    manner: { effort: 2, care, haste },
  });

  it("mix-06: left in a humid shed, meat spoils and smells within a few days", () => {
    const after = resolve(salting, hours(72)).world;
    const meat = after.things.meat;
    expect(meat?.state.contamination).toBeGreaterThan(3);
    const fresh = salting.things.meat;
    expect(meat ? effective(after, meat).scent : 0).toBeGreaterThan(
      fresh ? effective(salting, fresh).scent : 9,
    );
  });

  it("mix-06: a thin hurried rub of salt reaches less of the meat than a careful one", () => {
    const thin = resolve(salting, rub(1, 4, 0.1)).world.things.meat?.state.coating;
    const thorough = resolve(salting, rub(4, 1, 1)).world.things.meat?.state.coating;
    expect(thin?.coverage).toBeLessThan((thorough?.coverage ?? 0) - 0.2);
  });

  it("mix-06: where the salt reaches, the meat holds up (salt's row has nothing that says it slows rot: the drift reads a coat's cleansing and potency only, and never its coverage)", () => {
    const day = (w: MatterWorld) =>
      resolve(w, hours(24)).world.things.meat?.state.contamination ?? 0;
    const salted = resolve(salting, rub(4, 1, 1)).world;
    expect(day(salted)).toBeLessThan(day(salting) / 2);
  });
});

describe("mixing: glue and dye", () => {
  const mended = play(
    world(
      [
        thing("handle", "wood"),
        thing("gluepot", "glue", "hearth", { temperature: 3.5 }),
        thing("cold", "water", "hearth", { temperature: 1, amount: 20 }),
        thing("dishwater", "water", "hearth", { temperature: 4, amount: 20 }),
      ],
      [],
      EXTRA,
    ),
    [
      {
        process: "coat",
        substance: "gluepot",
        target: "handle",
        manner: { effort: 2, care: 4, haste: 1 },
      },
      hours(24 * 3),
    ],
  ).world;
  const washedIn = (liquid: string) =>
    resolve(mended, { process: "soak", liquid, target: "handle", amount: 5 }).world.things.handle
      ?.state.coating;

  it("mix-08: glue dries into the wood and bonds hard, and cold water does not shift it", () => {
    expect(mended.things.handle?.state.coating?.bond).toBeGreaterThan(3);
    expect(washedIn("cold")?.element).toBe("glue");
  });

  it.fails("mix-08: hot dishwater softens the glue and it lets go (wash reads oiliness, cleansing and bond: the water's heat against the coat's melts-at, and the coat's solubility, never reach it)", () => {
    expect(washedIn("dishwater")).toBeNull();
  });

  const table = world(
    [
      thing("berries", "berries"),
      thing("pestle", "stone"),
      thing("juice", "juice", "hearth", { amount: 1 }),
      thing("linen", "cloth"),
      thing("shirt", "cloth"),
      thing("basin", "water", "hearth", { amount: 40 }),
    ],
    [],
    EXTRA,
  );

  it("mix-09: berries crush to pieces under a stone", () => {
    const { world: after } = resolve(table, {
      process: "force",
      instrument: "pestle",
      patient: "berries",
    });
    expect(after.things.berries?.state.integrity).toBe(0);
  });

  it("mix-09: juice worked into linen dries in, and plain water never lifts it", () => {
    const dyed = play(table, [
      {
        process: "coat",
        substance: "juice",
        target: "linen",
        amount: 0.5,
        manner: { effort: 2, care: 4, haste: 1 },
      },
      hours(12),
      { process: "soak", liquid: "basin", target: "linen", amount: 5 },
    ]).world;
    expect(dyed.things.linen?.state.coating?.element).toBe("juice");
    expect(dyed.things.linen?.state.coating?.coverage).toBeGreaterThan(0.8);
  });

  it.fails("mix-09: soaking the cloth in the juice dyes it (soak wets, and carries contamination and taint; it never leaves the liquid's own substance behind as a coat, so the cloth dries clean)", () => {
    const soaked = play(table, [
      { process: "soak", liquid: "juice", target: "linen", amount: 1 },
      hours(12),
    ]).world;
    expect(soaked.things.linen?.state.coating?.element).toBe("juice");
  });

  it("fixed rule: mix-09: a few flung droplets cover a quarter of the shirt (coverage in coat is set by care and haste alone, never by the amount against the size of what it lands on; it cannot go under 0.25)", () => {
    const { world: after } = resolve(table, {
      process: "coat",
      substance: "juice",
      target: "shirt",
      amount: 0.01,
      manner: { effort: 0, care: 0, haste: 5 },
    });
    expect(after.things.shirt?.state.coating?.coverage).toBeLessThan(0.1);
  });
});
