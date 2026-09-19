/**
 * Batch A, fire and cold: the scenarios `batch-a.test.ts` does not already cover (it has
 * fire-01, 03, 07, 08, 09 and cold-01, 03). Each test asserts what the scenario says a
 * sensible person expects. `it.fails` marks what the rules cannot produce, or get wrong
 * (`RULE ERROR`), with the reason in brackets. Rows are in `rows-fire-cold.ts`.
 */
import { describe, expect, it } from "vitest";
import { type Act, effective, play, resolve } from "../../src/matter/index.ts";
import { body, thing, world } from "./elements.ts";
import { EXTRA } from "./rows-fire-cold.ts";

const lit = { burning: { of: "self", fuel: 600 } } as const;
const heat = (source: string, target: string, minutes: number, contact = 1): Act => ({
  process: "heat",
  source,
  target,
  minutes,
  contact,
});
const hours = (n: number): Act => ({ process: "drift", minutes: n * 60 });

describe("fire-02: a field set alight", () => {
  const field = (at: string) =>
    world(
      [
        thing("torch", "fire", at, lit),
        thing("grass", "grass", at),
        thing("hay", "hay", at),
        thing("hedge", "hedge", at),
      ],
      [],
      EXTRA,
    );

  it("fire-02: dry grass takes the torch, carries the fire to the hay against it, and burns down to ash", () => {
    const alight = resolve(field("stillfield"), heat("torch", "grass", 2)).world;
    expect(alight.things.grass?.state.burning).not.toBeNull();
    const spread = resolve(alight, heat("grass", "hay", 3, 0.8)).world;
    expect(spread.things.hay?.state.burning).not.toBeNull();
    const after = resolve(alight, hours(1)).world;
    expect(after.things.grass).toBeUndefined();
    expect(after.things["grass.ash"]).toBeDefined();
  });

  it("fixed rule: fire-02: the hedge never catches, however long the grass fire burns against it (ignitionPoint(2) is 5.1, above the hottest surface there is, so nothing at flammability 2 can ever be lit)", () => {
    const alight = resolve(field("stillfield"), heat("torch", "grass", 2)).world;
    const later = resolve(alight, heat("grass", "hedge", 30)).world;
    expect(later.things.hedge?.state.burning).not.toBeNull();
  });

  it("fixed rule: fire-02: nor does a dry oak log laid in a fire for an hour (the same rule: the shared oak and leather rows are unlightable)", () => {
    const w = world([thing("flame", "fire", "hearth", lit), thing("log", "oak")]);
    const later = resolve(w, heat("flame", "log", 60)).world;
    expect(later.things.log?.state.burning).not.toBeNull();
  });

  // Derived since round two of the grown rows (graph/grown.ts): proposed by a model, ratified by Jev.
  it("fire-02: a strong wind carries the flame to the hay sooner than still air does", () => {
    const reach = (at: string) => {
      const alight = resolve(field(at), heat("torch", "grass", 2)).world;
      return resolve(alight, heat("grass", "hay", 1.5, 0.3)).world.things.hay?.state.burning;
    };
    expect(reach("stillfield")).toBeNull();
    expect(reach("hillside")).not.toBeNull();
  });
});

describe("fire-04: the overheated blade", () => {
  const smithy = world([
    thing("forge", "fire", "hearth", lit),
    thing("bar", "blade", "hearth"),
    thing("hammer", "iron"),
    thing("trough", "water", "hearth", { amount: 40 }),
    thing("work", "steel"),
  ]);
  const hot = resolve(smithy, heat("forge", "bar", 10)).world;

  it("fire-04: in the forge the blade gets hot, and hot it is softer and bends where cold it would not", () => {
    const [cold, glowing] = [smithy.things.bar, hot.things.bar];
    expect(glowing?.state.temperature).toBeGreaterThan(4);
    const [before, after] = [
      cold ? effective(smithy, cold) : undefined,
      glowing ? effective(hot, glowing) : undefined,
    ];
    expect(after?.hardness).toBeLessThan(before?.hardness ?? 0);
    expect(after?.flexibility).toBeGreaterThan(before?.flexibility ?? 9);
  });

  const blow: Act = {
    process: "force",
    instrument: "hammer",
    patient: "bar",
    manner: { effort: 3, care: 3, haste: 2 },
  };

  it("fixed rule: fire-04: eight hammer blows at the anvil leave the blade broken, not straightened (force has only integrity to take from: a blow that gets into something tough breaks it instead of bending it)", () => {
    const worked = play(
      hot,
      Array.from({ length: 8 }, () => blow),
    ).world;
    expect(worked.things.bar?.state.integrity).toBeGreaterThan(4);
  });

  it.fails("fire-04: the hammer moves hot iron as it does not move cold (M2's softening lowers hardness, and a blow is resisted by toughness and bulk alone; there is no bent or straightened to change)", () => {
    expect(resolve(hot, blow).changes).not.toEqual(resolve(smithy, blow).changes);
  });

  it("fire-04: left in the water till it is cold, it comes out harder to bend and less tough", () => {
    const quenched = resolve(hot, heat("trough", "bar", 10)).world;
    const bar = quenched.things.bar;
    expect(bar?.state.temper).toBeGreaterThan(0);
    expect(bar ? effective(quenched, bar).toughness : 9).toBeLessThan(3);
  });

  it("fixed rule: fire-04: plunged in the trough for half a minute the blade is still hot and has not hardened (heat passes into water no faster than into air: nothing about a liquid source raises the rate)", () => {
    const quenched = resolve(hot, heat("trough", "bar", 0.5)).world;
    expect(quenched.things.bar?.state.temperature).toBeLessThan(3.5);
    expect(quenched.things.bar?.state.temper).toBeGreaterThan(0);
  });

  it.fails("fire-04: held too long in the forge it takes a hidden flaw (M2's 'held too hot: S15' is in the vocabulary and not in heat)", () => {
    const overheated = resolve(smithy, heat("forge", "bar", 90)).world;
    expect(overheated.things.bar?.state.flaw).toBeGreaterThan(0);
  });

  it("fire-04: a quenched blade with that flaw looks the same as a sound one, and fails days later under hard use", () => {
    const made = (flaw: number) => {
      const quenched = resolve(hot, heat("trough", "bar", 10)).world;
      const bar = quenched.things.bar;
      const flawed = bar ? { ...bar, state: { ...bar.state, flaw } } : undefined;
      const w = flawed ? { ...quenched, things: { ...quenched.things, bar: flawed } } : quenched;
      return resolve(w, hours(72)).world;
    };
    const [sound, bad] = [made(0), made(2)];
    const [a, b] = [sound.things.bar, bad.things.bar];
    expect(a && b ? effective(sound, a) : 1).toEqual(a && b ? effective(bad, b) : 2);
    // Hard use is a blow. A flaw is found by a blow as surely as by a load.
    const use: Act = {
      process: "force",
      instrument: "work",
      patient: "bar",
      manner: { effort: 4, care: 2, haste: 3 },
    };
    const held = resolve(sound, use).world.things.bar?.state.integrity ?? 0;
    const broke = resolve(bad, use).world.things.bar?.state.integrity ?? 5;
    expect(held).toBeGreaterThanOrEqual(4);
    expect(broke).toBeLessThanOrEqual(3);
  });
});

describe("fire-05: the fox, the fat and the pelt", () => {
  const camp = world(
    [
      thing("coals", "oak", "hearth", { burning: { of: "self", fuel: 300 }, temperature: 5 }),
      thing("spill", "fat", "hearth", { temperature: 3, amount: 0.3 }),
      thing("pelt", "pelt", "hearth", { wetness: 2 }),
    ],
    [],
    EXTRA,
  );

  it("fire-05: fat spilled onto the coals takes light", () => {
    const flared = resolve(camp, heat("coals", "spill", 2)).world;
    expect(flared.things.spill?.state.burning).not.toBeNull();
  });

  it("fixed rule: fire-05: hung on its rack above the banked coals all evening, the pelt bursts into flame with no flare at all (contact slows heating and never bounds it: at any distance a thing ends as hot as the fire)", () => {
    const evening = resolve(camp, heat("coals", "pelt", 180, 0.2)).world;
    expect(evening.things.pelt?.state.burning).toBeNull();
    expect(evening.things.pelt?.state.temperature).toBeLessThan(4);
  });

  it.fails("fire-05: a half-minute flare right under it catches the fur (a surface comes up to any flame at one fixed rate, so the best tinder needs most of a minute and dry fur two; and the damp of the hide counts against the fur until the whole pelt is warm)", () => {
    const flared = resolve(camp, heat("coals", "spill", 2)).world;
    const licked = resolve(flared, heat("spill", "pelt", 0.5)).world;
    expect(licked.things.pelt?.state.burning).not.toBeNull();
  });
});

describe("fire-06: a spark in the oil", () => {
  const smithy = world(
    [
      thing("forge", "fire", "hearth", lit),
      thing("hammer", "iron"),
      thing("anvil", "iron"),
      thing("puddle", "oil", "hearth", { amount: 0.3 }),
      thing("floor", "dirt"),
    ],
    [body("smith")],
    EXTRA,
  );
  const strike: Act = {
    process: "force",
    instrument: "hammer",
    patient: "anvil",
    manner: { effort: 3, care: 2, haste: 2 },
  };

  it("fire-06: a hard strike of iron on iron throws a spark", () => {
    const { changes } = resolve(smithy, strike);
    expect(changes.some((c) => c.kind === "signal" && c.channel === "light")).toBe(true);
  });

  it.fails("fire-06: and the spark lights the oil lying by the anvil (a spark is a light signal: it is not a hot thing, it lands nowhere and meets no surface)", () => {
    const { world: after } = resolve(smithy, strike);
    expect(after.things.puddle?.state.burning).not.toBeNull();
  });

  it("fixed rule: fire-06: lying across the smithy from the forge all afternoon, the puddle lights by itself (the same rule as the pelt: contact scales the rate and not the balance, so distance only delays)", () => {
    const afternoon = resolve(smithy, heat("forge", "puddle", 240, 0.05)).world;
    expect(afternoon.things.puddle?.state.burning).toBeNull();
  });

  it("fire-06: set alight, the oil flashes and is gone in minutes, singes whoever stands in it, and leaves the earth floor unlit", () => {
    const flash = resolve(smithy, heat("forge", "puddle", 2)).world;
    expect(flash.things.puddle?.state.burning).not.toBeNull();
    const burned = resolve(flash, {
      process: "force",
      instrument: "puddle",
      patient: "smith",
      seconds: 0.5,
      manner: { effort: 0, care: 0, haste: 0 },
    }).world.bodies.smith?.wounds[0];
    expect(burned?.burned).toBeGreaterThan(0);
    expect(burned?.burned).toBeLessThan(2);
    expect(burned?.depth).toBe(0);
    const floor = resolve(flash, heat("puddle", "floor", 8)).world;
    expect(floor.things.floor?.state.burning).toBeNull();
    const after = resolve(flash, hours(0.5)).world;
    expect(after.things.puddle).toBeUndefined();
  });
});

describe("fire-10: a fire in a closed shelter", () => {
  const hut = world(
    [thing("flame", "fire", "shelter", lit), thing("sticks", "kindling", "shelter")],
    [body("player", { place: "shelter" })],
    EXTRA,
  );

  it("fire-10: with little air and not none, dry kindling lights and burns on", () => {
    const burning = play(hut, [
      heat("flame", "sticks", 3),
      { process: "drift", minutes: 10 },
    ]).world;
    expect(burning.things.sticks?.state.burning).not.toBeNull();
  });

  it.fails("fire-10: and its smoke gathers where it cannot get out (burning makes no smoke, a place's air is never changed, and no body breathes)", () => {
    const alight = resolve(hut, heat("flame", "sticks", 3)).world;
    const { world: after, changes } = resolve(alight, { process: "drift", minutes: 10 });
    const smoke = changes.some((c) => c.kind === "signal" && c.channel === "smoke");
    expect(smoke || (after.places.shelter?.air ?? 1) < 1).toBe(true);
  });
});

describe("cold-02: the lantern in the pass", () => {
  const lantern = (at: string) =>
    world(
      [
        thing("lantern", "cloth", at, {
          coating: { element: "oil", amount: 1, coverage: 1, bond: 0 },
          burning: { of: "coating", fuel: 120 },
        }),
      ],
      [],
      EXTRA,
    );

  it("cold-02: out of the wind the small flame burns on", () => {
    const after = resolve(lantern("lee"), { process: "drift", minutes: 5 }).world;
    expect(after.things.lantern?.state.burning).not.toBeNull();
  });

  // Derived since round two of the grown rows (graph/grown.ts): proposed by a model, ratified by Jev.
  it("cold-02: a gust through the pass snuffs it", () => {
    const after = resolve(lantern("pass"), { process: "drift", minutes: 1 }).world;
    expect(after.things.lantern?.state.burning).toBeNull();
  });
});

describe("cold-04: the cache under the snow", () => {
  it("cold-04: roots in a frozen pit are fine after five days, where in a mild damp one they have begun to go", () => {
    const kept = (at: string) =>
      resolve(world([thing("roots", "root", at)], [], EXTRA), hours(120)).world.things.roots?.state
        .contamination ?? 9;
    expect(kept("frost")).toBeLessThan(0.5);
    expect(kept("frost")).toBeLessThan(kept("pitmild") / 3);
  });
});

describe("cold-05: young ice", () => {
  const river = (set: { flaw?: number; amount?: number }) =>
    world([thing("sheet", "ice", "frost", set), thing("walker", "person", "frost")], [], EXTRA);
  const cross: Act = { process: "load", support: "sheet", bearing: ["walker"] };

  it("cold-05: ice with a thin place nobody can see gives way under a walker, with a crack", () => {
    const thin = river({ flaw: 2 });
    const sound = river({});
    const [a, b] = [thin.things.sheet, sound.things.sheet];
    expect(a && b ? effective(thin, a) : 1).toEqual(a && b ? effective(sound, b) : 2);
    const { world: after, changes } = resolve(thin, cross);
    expect(after.things.sheet?.state.integrity).toBeLessThanOrEqual(1);
    expect(changes.some((c) => c.kind === "signal" && c.channel === "sound")).toBe(true);
  });

  it("fixed rule: cold-05: thick sound midwinter ice gives way under the same walker (strength is led by toughness and ignores how much there is, so nothing brittle bears a person however thick)", () => {
    const { world: after } = resolve(river({ amount: 5 }), cross);
    expect(after.things.sheet?.state.integrity).toBe(5);
  });

  it.fails("RULE ERROR: cold-05: and so does a stone step (the same rule on a shared row: hard, not tough, and it breaks under a person standing on it)", () => {
    const w = world([thing("step", "stone"), thing("walker", "person")], [], EXTRA);
    const { world: after } = resolve(w, { process: "load", support: "step", bearing: ["walker"] });
    expect(after.things.step?.state.integrity).toBe(5);
  });
});

describe("cold-06: fording and walking on wet", () => {
  it("cold-06: the ford soaks the clothes, wet cloth passes heat as dry cloth does not, and hours on in cool air they are still wet", () => {
    const w = world(
      [thing("clothes", "cloth", "cool"), thing("stream", "water", "cool", { amount: 100 })],
      [body("player", { place: "cool" })],
      EXTRA,
    );
    const dry = w.things.clothes;
    const forded = resolve(w, { process: "soak", liquid: "stream", target: "clothes", amount: 1 });
    const wet = forded.world.things.clothes;
    expect(wet?.state.wetness).toBeGreaterThan(4);
    expect(wet ? effective(forded.world, wet).conductivity : 0).toBeGreaterThan(
      (dry ? effective(w, dry).conductivity : 0) + 1,
    );
    const camp = resolve(forded.world, hours(4)).world.things.clothes;
    expect(camp?.state.wetness).toBeGreaterThan(2);
    expect(camp?.state.wetness).toBeLessThan(wet?.state.wetness ?? 0);
  });
});

describe("cold-08: the struck oak and the dry grass", () => {
  const hilltop = (at: string) =>
    world(
      [thing("split", "oak", at, { temperature: 5, integrity: 3 }), thing("grass", "grass", at)],
      [],
      EXTRA,
    );

  it("cold-08: dry grass against the smoking wood can catch from it", () => {
    const after = resolve(hilltop("stillfield"), heat("split", "grass", 10, 0.8)).world;
    expect(after.things.grass?.state.burning).not.toBeNull();
  });

  it("cold-08: ten minutes of rain first, and it does not (rain wets by drift at a twentieth of a level a minute, and the hot wood is cooled no faster for being rained on)", () => {
    const rained = resolve(hilltop("rain"), { process: "drift", minutes: 10 }).world;
    const after = resolve(rained, heat("split", "grass", 10, 0.8)).world;
    expect(after.things.grass?.state.burning).toBeNull();
  });
});

describe("cold-10: the ploughed field after rain", () => {
  it("cold-10: two days of rain leave ploughed soil soaked, heavy and far softer than the packed path beside it", () => {
    const w = world([thing("field", "tilth", "rain"), thing("path", "dirt", "rain")], [], EXTRA);
    const after = resolve(w, hours(48)).world;
    const [field, path] = [after.things.field, after.things.path];
    expect(field?.state.wetness).toBeGreaterThan(4);
    expect(field?.state.wetness).toBeGreaterThan((path?.state.wetness ?? 9) + 1);
    const [soft, firm] = [
      field ? effective(after, field) : undefined,
      path ? effective(after, path) : undefined,
    ];
    expect(soft?.hardness).toBeLessThan((firm?.hardness ?? 0) - 1);
    const dryField = w.things.field;
    expect(soft?.mass).toBeGreaterThan(dryField ? effective(w, dryField).mass + 1 : 9);
  });

  it("cold-10: and the mud cakes the boots", () => {
    const w = world([
      thing("mud", "mud", "rain", { amount: 5 }),
      thing("boots", "leather", "rain"),
    ]);
    const caked = resolve(w, { process: "coat", substance: "mud", target: "boots", amount: 1 });
    expect(caked.world.things.boots?.state.coating?.element).toBe("mud");
  });
});
