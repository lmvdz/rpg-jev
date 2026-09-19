/**
 * Batch A, grow and find, as far as the matter engine reaches. Growth is not built, so most
 * of grow is recorded as unbuilt in `spikes/vocabulary/results/derive/grow-find.json`; what
 * is here is what drift, soak, force, ingest and search can be asked. find-06 is covered in
 * `batch-a.test.ts`. Rows are in `rows-grow-find.ts` and were not tuned to these tests.
 */
import { describe, expect, it } from "vitest";
import {
  type Act,
  type MatterWorld,
  play,
  resolve,
  type SearchAct,
  searchOdds,
  searchYield,
} from "../../src/matter/index.ts";
import { body, placeRow, thing, world } from "./elements.ts";
import { EXTRA } from "./rows-grow-find.ts";

const DAY = 1440;

const look = (place: string, element: string, minutes: number, draw = 0.99): SearchAct => ({
  process: "search",
  place,
  element,
  minutes,
  draw,
});

const ofKind = (w: MatterWorld, element: string) =>
  Object.values(w.things).filter((t) => t.element === element);

/** How much of an element is there, whether the engine counts it as things or as an amount. */
const yieldOf = (w: MatterWorld, element: string) =>
  ofKind(w, element).reduce((sum, t) => sum + t.state.amount, 0);

/** The chance that every one of these searches, made in order, comes up empty. */
function missAll(start: MatterWorld, searches: readonly SearchAct[]): number {
  let w = start;
  let miss = 1;
  for (const s of searches) {
    miss *= 1 - searchOdds(w, s);
    w = resolve(w, s).world;
  }
  return miss;
}

const drift = (minutes: number): Act => ({ process: "drift", minutes });

describe("grow", () => {
  it("grow-01: a whole apple pushed into damp soil rots within days, faster than one on a dry shelf", () => {
    const buried = world([thing("apple", "apple", "garden")], [], EXTRA);
    const shelved = world([thing("apple", "apple", "hearth")], [], EXTRA);
    const days = (w: MatterWorld, n: number) =>
      resolve(w, drift(n * DAY)).world.things.apple?.state.contamination ?? 0;
    expect(days(buried, 1)).toBeLessThan(3);
    expect(days(buried, 5)).toBeGreaterThan(3);
    expect(days(buried, 2)).toBeGreaterThan(days(shelved, 2));
  });

  it.fails("grow-01: and weeks later the flesh is gone into the soil (contamination neither softens nor consumes what it grows in; nothing germinates, growth is unbuilt)", () => {
    const buried = world([thing("apple", "apple", "garden")], [], EXTRA);
    const month = resolve(buried, drift(30 * DAY)).world;
    expect(month.things.apple).toBeUndefined();
  });

  const bed = () =>
    world(
      [
        thing("bed", "claysoil", "beanrow"),
        thing("shirt", "cloth", "beanrow", { wetness: 4.2 }),
        thing("can", "water", "beanrow", { amount: 10 }),
      ],
      [],
      EXTRA,
    );
  const water: Act = { process: "soak", liquid: "can", target: "bed", amount: 1 };

  it("grow-02: the clay bed drinks the first can, and the second and third run off it", () => {
    const once = resolve(bed(), water);
    expect(once.world.things.bed?.state.wetness).toBeGreaterThan(3);
    const thrice = play(bed(), [water, water, water]);
    expect(thrice.world.things.bed?.state.wetness).toBe(once.world.things.bed?.state.wetness);
    expect(thrice.changes.some((c) => c.note === "the liquid runs off it")).toBe(true);
  });

  it.fails("RULE ERROR: grow-02: a waterlogged clay bed is bone dry in a day and a half, exactly as fast as a shirt on a line (drift dries everything at one rate: it reads temperature and wind, never mass, size, absorbency or porosity)", () => {
    const soaked = play(bed(), [water, water, water]).world;
    const later = resolve(soaked, drift(2 * DAY)).world;
    expect(later.things.bed?.state.wetness).toBeGreaterThan(2);
    const soon = resolve(soaked, drift(12 * 60)).world;
    expect(soon.things.bed?.state.wetness ?? 0).toBeGreaterThan(
      (soon.things.shirt?.state.wetness ?? 0) + 0.5,
    );
  });

  it.fails("grow-02: three cans leave the bed worse off than one (water a full thing cannot hold is consumed and vanishes; there is no standing water, and no roots to drown)", () => {
    const one = resolve(resolve(bed(), water).world, drift(DAY)).world;
    const three = resolve(play(bed(), [water, water, water]).world, drift(DAY)).world;
    expect(three.things.bed?.state.wetness ?? 0).toBeGreaterThan(
      one.things.bed?.state.wetness ?? 0,
    );
  });

  it("fixed rule: grow-03: seed kept two months in a dry sack on a cold shelf is rotten through, noxious and stinking (drift's damp factor never falls below 0.4, so dryness slows rot by little and stops nothing)", () => {
    const sack = world([thing("seed", "seed", "shelf")], [], EXTRA);
    const kept = resolve(sack, drift(60 * DAY)).world;
    expect(kept.things.seed?.state.wetness).toBe(0);
    expect(kept.things.seed?.state.contamination).toBeLessThan(1.5);
  });

  it("fixed rule: grow-05: seed sown in cold dry ground has rotted through by spring instead of lying dormant (the same rule: contamination grows without bound in anything perishable, however dry and cold)", () => {
    const sown = world([thing("seed", "seed", "coldbed")], [], EXTRA);
    const spring = resolve(sown, drift(90 * DAY)).world;
    expect(spring.things.seed?.state.contamination).toBeLessThan(1.5);
  });
});

const empty = world([], [], EXTRA);

describe("find: what a search turns up", () => {
  it("find-01: a glance at open turf has real odds of finding no stone, and this one finds none; a deliberate search does far better", () => {
    const glance = look("turf", "stone", 1, 0.5);
    expect(searchOdds(empty, glance)).toBeLessThan(0.2);
    const { world: after, changes } = resolve(empty, glance);
    expect(ofKind(after, "stone")).toHaveLength(0);
    expect(changes.every((c) => c.kind === "settle")).toBe(true);
    const deliberate = searchOdds(after, look("turf", "stone", 45));
    expect(deliberate).toBeGreaterThan(searchOdds(empty, glance) * 5);
    expect(deliberate).toBeGreaterThan(0.3);
    expect(deliberate).toBeLessThan(0.95);
  });

  it("find-02: in a quarry, that stone is there was never in doubt", () => {
    expect(searchOdds(empty, look("quarry", "stone", 3))).toBeGreaterThan(0.9);
    expect(searchOdds(empty, look("quarry", "stone", 3))).toBeGreaterThan(
      searchOdds(empty, look("turf", "stone", 3)) * 10,
    );
    const { world: after } = resolve(empty, look("quarry", "stone", 3, 0.5));
    expect(ofKind(after, "stone")).toHaveLength(1);
  });

  it("fixed rule: find-02: one hard hammer blow puts the whole quarry face in pieces (force.ts damage: shattering tests toughness and the blow and ignores size, though the share lost is scaled by size cubed)", () => {
    const w = world([thing("hammer", "iron"), thing("face", "bedrock", "quarry")], [], EXTRA);
    const struck = resolve(w, {
      process: "force",
      instrument: "hammer",
      patient: "face",
      manner: { effort: 3, care: 3, haste: 1 },
    });
    expect(struck.world.things.face?.state.integrity).toBeGreaterThan(3);
    expect(struck.changes.some((c) => c.kind === "create")).toBe(true);
  });

  it("fixed rule: find-02: a quarry is out of stone for good after nine blocks, and half as sure after one (body.ts searchOdds: each find takes half a level off abundance whatever the level, though the levels stand for stocks that differ by orders of magnitude)", () => {
    const worked = play(
      empty,
      Array.from({ length: 12 }, () => look("quarry", "stone", 3, 0)),
    ).world;
    expect(searchOdds(worked, look("quarry", "stone", 3))).toBeGreaterThan(0.5);
  });

  it("find-03: a glance over the leaf litter likely misses the mushrooms; most of an hour likely does not, and a thin patch promises nothing", () => {
    expect(searchOdds(empty, look("forest", "morel", 1))).toBeLessThan(0.2);
    expect(searchOdds(empty, look("forest", "morel", 45))).toBeGreaterThan(0.8);
    const thin = world([], [], {
      ...EXTRA,
      places: [...(EXTRA.places ?? []), placeRow("thin", { abundance: { morel: 1 } })],
    });
    expect(searchOdds(thin, look("thin", "morel", 45))).toBeLessThan(0.5);
    expect(searchOdds(thin, look("thin", "morel", 45))).toBeGreaterThan(0);
  });

  it.fails("RULE ERROR: find-03: most of an hour's careful search yields exactly one mushroom, where the same hour cut into glances yields several (body.ts search: found is 1 or 0 whatever the minutes, so the yield depends on how the time is cut into acts)", () => {
    const hour = resolve(empty, look("forest", "morel", 60, 0)).world;
    const glances = play(
      empty,
      Array.from({ length: 60 }, () => look("forest", "morel", 1, 0)),
    ).world;
    expect(yieldOf(hour, "morel")).toBeGreaterThan(1);
    expect(yieldOf(hour, "morel")).toBeGreaterThanOrEqual(yieldOf(glances, "morel"));
  });

  it.fails("find-03: what sits low and mottled under leaves is easier to pass over than a stone as common (search reads abundance alone: not size, cover, light or the searcher's senses)", () => {
    const both = world([], [], {
      ...EXTRA,
      places: [...(EXTRA.places ?? []), placeRow("litter", { abundance: { morel: 3, stone: 3 } })],
    });
    expect(searchOdds(both, look("litter", "morel", 1))).toBeLessThan(
      searchOdds(both, look("litter", "stone", 1)),
    );
  });

  it("find-04: no length or number of searches finds gold in a stream that never had any, and the time is spent all the same", () => {
    const tries = Array.from({ length: 10 }, () => look("stream", "gold", 120, 0));
    const { world: after } = play(empty, tries);
    expect(ofKind(after, "gold")).toHaveLength(0);
    expect(after.places.stream?.searched.gold).toEqual({ minutes: 1200, found: 0 });
    expect(searchOdds(empty, look("stream", "silver", 600))).toBe(0);
    expect(searchOdds(empty, look("stream", "stone", 10))).toBeGreaterThan(0.5);
  });

  it("find-05: damp soil by the compost gives up a worm to a few minutes' digging", () => {
    expect(searchOdds(empty, look("wormbed", "worm", 10))).toBeGreaterThan(0.9);
    const { world: after } = resolve(empty, look("wormbed", "worm", 10, 0.5));
    expect(ofKind(after, "worm")).toHaveLength(1);
  });

  it.fails("find-05: and the spade turns up a bone nobody was looking for (search settles only the element it was asked for; X8 says it settles ones not sought)", () => {
    const digs = Array.from({ length: 6 }, () => look("wormbed", "worm", 30, 0));
    const { world: after } = play(empty, digs);
    expect(ofKind(after, "bone").length).toBeGreaterThan(0);
  });
});

describe("find: time on the line, and other takers", () => {
  it("find-07: the odds build with time on the line, and no one cast is a sure thing", () => {
    const short = searchOdds(empty, look("river", "fish", 5));
    const evening = searchOdds(empty, look("river", "fish", 90));
    expect(short).toBeLessThan(0.3);
    expect(evening).toBeGreaterThan(short * 3);
    expect(evening).toBeLessThan(1);
  });

  it.fails("RULE ERROR: find-07: two hours on the line are worth less the more often the player says wait (body.ts searchOdds: ground gone over is discounted only between acts, never within one, so odds depend on how the time is cut)", () => {
    const whole = 1 - missAll(empty, [look("river", "fish", 120)]);
    const halves = 1 - missAll(empty, [look("river", "fish", 60), look("river", "fish", 60)]);
    const twelfths =
      1 -
      missAll(
        empty,
        Array.from({ length: 12 }, () => look("river", "fish", 10)),
      );
    expect(Math.abs(whole - halves)).toBeLessThan(0.03);
    expect(Math.abs(whole - twelfths)).toBeLessThan(0.03);
  });

  it("fixed rule: find-07: catch two fish, eat the first, catch a third, and only one fish is left (body.ts search names what it finds by the present count of things, so a new find overwrites an old one once anything has been consumed)", () => {
    const angler = world([], [body("player", { place: "river" })], EXTRA);
    const cast = look("river", "fish", 60, 0);
    const two = play(angler, [cast, cast]).world;
    expect(ofKind(two, "fish")).toHaveLength(2);
    const first = ofKind(two, "fish")[0];
    const ate = resolve(two, { process: "ingest", body: "player", thing: first?.id ?? "" }).world;
    expect(ofKind(ate, "fish")).toHaveLength(1);
    const third = resolve(ate, cast);
    expect(third.changes.some((c) => c.kind === "create")).toBe(true);
    expect(ofKind(third.world, "fish")).toHaveLength(2);
  });

  it.fails("find-07: a baited hook does better than a bare one (search takes no instrument and no manner)", () => {
    const bare = world([thing("hook", "blade", "river")], [], EXTRA);
    const baited = world(
      [
        thing("hook", "blade", "river", {
          coating: { element: "worm", amount: 0.2, coverage: 1, bond: 0 },
        }),
      ],
      [],
      EXTRA,
    );
    const wait = look("river", "fish", 60);
    expect(searchOdds(baited, wait)).toBeGreaterThan(searchOdds(bare, wait));
  });

  it("find-08: fish a heron took at dawn leave the pool worse for the player, and nothing at the water shows it", () => {
    const dawn = world([], [body("heron", { place: "pool", needs: { hunger: 4 } })], EXTRA);
    let w = dawn;
    for (let i = 0; i < 3; i++) {
      w = resolve(w, look("pool", "fish", 20, 0)).world;
      const caught = ofKind(w, "fish")[0];
      w = resolve(w, {
        process: "ingest",
        body: "heron",
        thing: caught?.id ?? "",
        amount: caught?.state.amount ?? 1,
      }).world;
    }
    expect(w.bodies.heron?.needs.hunger).toBeLessThan(4);
    expect(ofKind(w, "fish")).toHaveLength(0);
    const morning = look("pool", "fish", 60);
    expect(searchYield(w, morning)).toBeLessThan(searchYield(dawn, morning));
  });

  it.fails("find-08: and it happens with nobody watching (drift has no routine rate for a creature's needs, and never touches what a place holds)", () => {
    const dusk = world([], [body("heron", { place: "pool", needs: { hunger: 4 } })], EXTRA);
    const dawn = resolve(dusk, drift(8 * 60)).world;
    const morning = look("pool", "fish", 60);
    expect(searchOdds(dawn, morning)).toBeLessThan(searchOdds(dusk, morning));
  });
});
