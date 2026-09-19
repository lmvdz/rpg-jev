/**
 * The beast and folk scenarios of batch A, as far as the matter engine reaches. Almost all of
 * what these scenarios turn on (sensing, creature choices, groups, giving, telling) is not
 * built, and those parts have no test here: see `spikes/vocabulary/results/derive/beast-folk.json`.
 * What is tested is the matter inside them: food eaten, fires burning down, carcasses rotting
 * into scent, cords snapping, sacks torn, flesh gored and pecked.
 *
 * Rows were written once from the anchors (`rows-beast-folk.ts`) and not tuned.
 */
import { describe, expect, it } from "vitest";
import { type Act, effective, play, resolve } from "../../src/matter/index.ts";
import { body, thing, world } from "./elements.ts";
import { EXTRA } from "./rows-beast-folk.ts";

const hours = (n: number): Act => ({ process: "drift", minutes: n * 60 });
const repeat = (act: Act, times: number): Act[] => Array.from({ length: times }, () => act);

/** A log lit from a brand, so that how long it burns is the engine's number and not ours. */
function litLog(at: string) {
  const start = world(
    [
      thing("brand", "fire", at, { burning: { of: "self", fuel: 10 } }),
      thing("log", "firewood", at),
      thing("spare", "firewood", at),
    ],
    [],
    EXTRA,
  );
  return resolve(start, { process: "heat", source: "brand", target: "log", minutes: 3 }).world;
}

describe("beasts 01 to 04: a sack, a scrap, a tusk and a snare", () => {
  it("beast-01: the low embers die in the night with nobody feeding them", () => {
    const w = world(
      [thing("embers", "firewood", "camp", { burning: { of: "self", fuel: 40 }, temperature: 5 })],
      [],
      EXTRA,
    );
    const night = resolve(w, hours(6)).world;
    expect(night.things.embers).toBeUndefined();
    expect(night.things["embers.ash"]?.state.burning ?? null).toBeNull();
    expect(night.things["embers.ash"]?.state.temperature).toBeLessThan(3);
  });

  it("beast-01: the dried meat feeds the fox, keeps overnight, and the sack is left empty", () => {
    const w = world(
      [thing("meat", "jerky", "camp", { amount: 1 })],
      [body("fox", { place: "camp", needs: { hunger: 4 } })],
      EXTRA,
    );
    const kept = resolve(w, hours(10)).world;
    expect(kept.things.meat?.state.contamination).toBeLessThan(0.5);
    const fed = resolve(kept, { process: "ingest", body: "fox", thing: "meat" }).world;
    expect(fed.things.meat).toBeUndefined();
    expect(fed.bodies.fox?.needs.hunger).toBeLessThan(2);
    expect(fed.bodies.fox?.sickness).toBeLessThan(0.5);
  });

  it("fixed rule: beast-01: a fox worrying a cloth sack with its teeth leaves it all but whole (damage divides by the cube of the sack's overall size, as if a sheet were a block)", () => {
    const w = world(
      [thing("teeth", "tooth", "camp", { edge: 3 }), thing("sack", "cloth", "camp")],
      [],
      EXTRA,
    );
    const bite: Act = {
      process: "force",
      instrument: "teeth",
      patient: "sack",
      manner: { effort: 3, care: 1, haste: 4 },
    };
    const torn = play(w, repeat(bite, 5)).world;
    expect(torn.things.sack?.state.integrity).toBeLessThanOrEqual(3);
  });

  it("fixed rule: beast-01: nor is it the tooth's row: a keen steel knife slashed across the same sack takes a twentieth off it (same rule; shared rows only)", () => {
    const w = world(
      [thing("knife", "blade", "camp", { edge: 4 }), thing("sack", "cloth", "camp")],
      [],
      EXTRA,
    );
    const slashed = resolve(w, { process: "force", instrument: "knife", patient: "sack" }).world;
    expect(slashed.things.sack?.state.integrity).toBeLessThanOrEqual(3);
  });

  it("beast-02: one thrown scrap just gets eaten: it is gone, and the thin wolf is still hungry", () => {
    const w = world(
      [thing("strip", "meat", "clearing", { amount: 0.3 })],
      [body("wolf", { place: "clearing", needs: { hunger: 4 } })],
      EXTRA,
    );
    const { world: after, changes } = resolve(w, {
      process: "ingest",
      body: "wolf",
      thing: "strip",
    });
    expect(after.things.strip).toBeUndefined();
    expect(after.bodies.wolf?.needs.hunger).toBeLessThan(4);
    expect(after.bodies.wolf?.needs.hunger).toBeGreaterThan(2.5);
    expect(after.bodies.wolf?.sickness).toBe(0);
    expect(changes.filter((c) => c.kind === "body")).toHaveLength(1);
  });

  it("beast-03: the cornered boar's tusk opens a real wound, and it costs the player health", () => {
    const w = world(
      [thing("tusks", "tusk", "clearing", { edge: 2 })],
      [body("player", { place: "clearing" })],
      EXTRA,
    );
    const gored = resolve(w, {
      process: "force",
      instrument: "tusks",
      patient: "player",
      manner: { effort: 5, care: 0, haste: 5 },
    }).world;
    const wound = gored.bodies.player?.wounds[0];
    expect(wound?.depth).toBeGreaterThan(1.5);
    expect(wound?.bleeding).toBeGreaterThan(1);
    const soon = resolve(gored, { process: "drift", minutes: 20 }).world;
    expect(soon.bodies.player?.health).toBeLessThan(5);
    expect(soon.bodies.player?.health).toBeGreaterThan(2);
  });

  it("beast-04: a snare of thin cord holds a rabbit and snaps when a bolting deer runs through it", () => {
    const w = world(
      [
        thing("snare", "snareline", "clearing"),
        thing("rabbit", "rabbit", "clearing"),
        thing("doe", "deer", "clearing"),
      ],
      [],
      EXTRA,
    );
    const caught = resolve(w, { process: "load", support: "snare", bearing: ["rabbit"] }).world;
    expect(caught.things.snare?.state.integrity).toBe(5);
    const run = resolve(w, { process: "load", support: "snare", bearing: ["doe"] });
    expect(run.world.things.snare?.state.integrity).toBeLessThanOrEqual(1);
  });
});

describe("beasts 05 and 06: a fire left alone, and a nest robbed", () => {
  it("beast-05: left unfed the fire is out within hours; fed in time, it is still burning", () => {
    const lit = litLog("camp");
    const fuel = lit.things.log?.state.burning?.fuel ?? 0;
    expect(fuel).toBeGreaterThan(30);
    expect(fuel).toBeLessThan(240);
    expect(
      resolve(lit, { process: "drift", minutes: 20 }).world.things.log?.state.burning,
    ).not.toBeNull();
    const asleep = resolve(lit, hours(5)).world;
    expect(Object.values(asleep.things).some((t) => t.state.burning)).toBe(false);
    expect(asleep.things["log.ash"]).toBeDefined();
    const tended = play(lit, [
      { process: "drift", minutes: 30 },
      { process: "heat", source: "log", target: "spare", minutes: 3 },
      { process: "drift", minutes: 40 },
    ]).world;
    expect(tended.things.log).toBeUndefined();
    expect(tended.things.spare?.state.burning).not.toBeNull();
  });

  it.fails("beast-05: and its light sinks as the fuel runs down, which is what lets the wolves in (burning is on or off: S3 gives no light, no level, and no signal by drift)", () => {
    const lit = litLog("camp");
    const { changes } = resolve(lit, { process: "drift", minutes: 20 });
    expect(changes.some((c) => c.kind === "signal" && c.channel === "light")).toBe(true);
  });

  it("beast-06: eggs lifted gently stay whole; one grabbed hard breaks", () => {
    const w = world(
      [thing("hand", "hand", "clearing"), thing("egg", "egg", "clearing")],
      [],
      EXTRA,
    );
    const take = (effort: number) =>
      resolve(w, {
        process: "force",
        instrument: "hand",
        patient: "egg",
        manner: { effort, care: 2, haste: 2 },
      }).world.things.egg?.state.integrity;
    expect(take(0)).toBe(5);
    expect(take(3)).toBeLessThanOrEqual(1);
  });

  it("beast-06: what is left of the broken egg smells more by evening than it did at noon", () => {
    const w = world([thing("egg", "egg", "clearing", { integrity: 0, wetness: 1 })], [], EXTRA);
    const scent = (at: typeof w) => {
      const egg = at.things.egg;
      return egg ? effective(at, egg).scent : 0;
    };
    const evening = resolve(w, hours(8)).world;
    expect(scent(evening)).toBeGreaterThan(scent(w));
  });

  it.fails("beast-06: and it is the yolk on the ground the fox smells, not the whole eggs (breaking a shell opens nothing: integrity reaches neither scent nor the rate of rot, and there are no contents)", () => {
    const w = world(
      [
        thing("whole", "egg", "clearing", { wetness: 1 }),
        thing("broken", "egg", "clearing", { integrity: 0, wetness: 1 }),
      ],
      [],
      EXTRA,
    );
    const evening = resolve(w, hours(8)).world;
    const [whole, broken] = [evening.things.whole, evening.things.broken];
    const a = whole ? effective(evening, whole).scent : 0;
    const b = broken ? effective(evening, broken).scent : 0;
    expect(b).toBeGreaterThan(a);
  });

  it("beast-06: a small bird's dive leaves a minor wound, far short of a goring", () => {
    const w = world(
      [
        thing("beak", "beak", "clearing", { edge: 1 }),
        thing("tusks", "tusk", "clearing", { edge: 2 }),
      ],
      [body("player", { place: "clearing" }), body("other", { place: "clearing" })],
      EXTRA,
    );
    const fierce = { effort: 4, care: 0, haste: 5 };
    const pecked = resolve(w, {
      process: "force",
      instrument: "beak",
      patient: "player",
      manner: fierce,
    }).world.bodies.player?.wounds[0];
    const gored = resolve(w, {
      process: "force",
      instrument: "tusks",
      patient: "other",
      manner: fierce,
    }).world.bodies.other?.wounds[0];
    expect(pecked?.depth).toBeGreaterThan(0);
    expect(pecked?.depth).toBeLessThan(1);
    expect(gored?.depth).toBeGreaterThan((pecked?.depth ?? 0) * 2);
  });

  it("fixed rule: beast-06: the peck never stops bleeding, and the player is dead of it by next morning (driftBody drains health by bleeding at a constant rate for ever: nothing clots)", () => {
    const w = world(
      [thing("beak", "beak", "clearing", { edge: 1 })],
      [body("player", { place: "clearing" })],
      EXTRA,
    );
    const pecked = resolve(w, {
      process: "force",
      instrument: "beak",
      patient: "player",
      manner: { effort: 4, care: 0, haste: 5 },
    }).world;
    const morning = resolve(pecked, hours(18)).world;
    expect(morning.bodies.player?.health).toBeGreaterThan(4);
  });
});

describe("beasts 09 and 10: carcasses", () => {
  it("beast-09: a half-eaten carcass two days cached smells far more than fresh meat: the smell finds the cache", () => {
    const w = world([thing("carcass", "meat", "clearing", { amount: 15 })], [], EXTRA);
    const scent = (at: typeof w) => {
      const carcass = at.things.carcass;
      return carcass ? effective(at, carcass).scent : 0;
    };
    const cached = resolve(w, hours(48)).world;
    expect(scent(w)).toBeLessThanOrEqual(2);
    expect(scent(cached)).toBeGreaterThanOrEqual(4);
  });

  it("beast-10: the dead stag's scent builds over days, and the scavengers eat it most of the way down", () => {
    const w = world(
      [thing("stag", "meat", "clearing", { amount: 40, temperature: 3 })],
      [
        body("crows", { place: "clearing", needs: { hunger: 4 } }),
        body("foxes", { place: "clearing", needs: { hunger: 4 } }),
        body("wolves", { place: "clearing", needs: { hunger: 4 } }),
      ],
      EXTRA,
    );
    const scent = (at: typeof w) => {
      const stag = at.things.stag;
      return stag ? effective(at, stag).scent : 0;
    };
    const day1 = resolve(w, hours(24)).world;
    const day4 = resolve(day1, hours(72)).world;
    expect(scent(day1)).toBeGreaterThan(scent(w));
    expect(scent(day4)).toBeGreaterThan(scent(day1));
    expect(scent(day4)).toBeGreaterThanOrEqual(4.5);
    const eaten = play(w, [
      hours(24),
      { process: "ingest", body: "crows", thing: "stag", amount: 2 },
      hours(24),
      { process: "ingest", body: "foxes", thing: "stag", amount: 4 },
      hours(48),
      { process: "ingest", body: "wolves", thing: "stag", amount: 28 },
    ]).world;
    expect(eaten.things.stag?.state.amount).toBeLessThan(10);
    expect(eaten.bodies.wolves?.needs.hunger).toBe(0);
  });

  it.fails("RULE ERROR: beast-10: the wolf that eats from the four-day carcass sickens like a person would and loses health (ingest gives every body the same harm from contamination; no eater's row)", () => {
    const w = world(
      [thing("stag", "meat", "clearing", { amount: 40 })],
      [body("wolf", { place: "clearing", needs: { hunger: 4 } })],
      EXTRA,
    );
    const fed = play(w, [
      hours(96),
      { process: "ingest", body: "wolf", thing: "stag", amount: 1 },
      hours(12),
    ]).world;
    expect(fed.bodies.wolf?.health).toBeGreaterThan(4.5);
  });
});

describe("folk: what is matter in them", () => {
  it.fails("RULE ERROR: folk-02: the sound plank breaks under a standing person (load sets strength by overall size, with no span or support, so anything wooden smaller than a person fails under one)", () => {
    const w = world(
      [thing("board", "plank", "street"), thing("player", "person", "street")],
      [],
      EXTRA,
    );
    const stood = resolve(w, { process: "load", support: "board", bearing: ["player"] }).world;
    expect(stood.things.board?.state.integrity).toBe(5);
  });

  it.fails("folk-02: a loose board that holds still creaks under shifted weight, and that is what gives the player away (a load that holds is silent: no looseness of a join, R4, and nothing sounds)", () => {
    const w = world(
      [thing("board", "oak", "street"), thing("player", "person", "street")],
      [],
      EXTRA,
    );
    const { world: after, changes } = resolve(w, {
      process: "load",
      support: "board",
      bearing: ["player"],
    });
    expect(after.things.board?.state.integrity).toBe(5);
    expect(changes.some((c) => c.kind === "signal" && c.channel === "sound")).toBe(true);
  });

  it("folk-04: bread and cheese put in front of a hungry traveller leave them fed", () => {
    const w = world(
      [thing("loaf", "bread", "street"), thing("wedge", "cheese", "street")],
      [body("player", { place: "street", needs: { hunger: 4, rest: 4 } })],
      EXTRA,
    );
    const fed = play(w, [
      { process: "ingest", body: "player", thing: "loaf" },
      { process: "ingest", body: "player", thing: "wedge" },
    ]).world;
    expect(fed.bodies.player?.needs.hunger).toBeLessThanOrEqual(1);
    expect(fed.bodies.player?.needs.rest).toBe(4);
    expect(fed.bodies.player?.sickness).toBe(0);
    expect(fed.things.loaf).toBeUndefined();
  });

  it.fails("RULE ERROR: folk-10: one stroke of a keen knife does not part a purse string (the same cube-of-size rule: a short cord resists a cut like a lump eight times a seed)", () => {
    const w = world(
      [thing("knife", "blade", "street", { edge: 4 }), thing("strings", "thong", "street")],
      [],
      EXTRA,
    );
    const cut = resolve(w, { process: "force", instrument: "knife", patient: "strings" }).world;
    expect(cut.things.strings?.state.integrity).toBeLessThanOrEqual(1);
  });

  it("fixed rule: folk-10: and with shared rows only: twenty strokes of the same knife do not part a rope", () => {
    const w = world(
      [thing("knife", "blade", "street", { edge: 4 }), thing("line", "rope", "street")],
      [],
      EXTRA,
    );
    const stroke: Act = { process: "force", instrument: "knife", patient: "line" };
    const cut = play(w, repeat(stroke, 20)).world;
    expect(cut.things.line?.state.integrity).toBeLessThanOrEqual(1);
  });
});
