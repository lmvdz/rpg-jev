import { describe, expect, it } from "vitest";
import { GlyphBatch } from "../src/glyph/batch.ts";
import {
  type ElementView,
  freeTileNear,
  type Seen,
  type SeenState,
  shownOf,
  type WorldChange,
  WorldLink,
} from "../src/play/world-link.ts";
import { TileGrid } from "../src/terrain/grid.ts";
import { askPriors } from "../src/view/birth.ts";
import { Births } from "../src/view/births.ts";
import { describeThing } from "../src/view/describe.ts";
import { EmitterList, OneShots } from "../src/view/effects.ts";
import { LivingThings } from "../src/view/living.ts";
import type { MotionRow } from "../src/view/motions.ts";
import type { ThingView } from "../src/view/things.ts";
import { ObjectLayer } from "../src/world/objects.ts";

const why = { because: ["X2", "P4"], note: "" };
const seen = (state: Partial<SeenState>, blaze = 0, element = "log"): Seen => ({
  element,
  state,
  blaze,
});

function scene() {
  const grid = new TileGrid(8, 8);
  const objects = new ObjectLayer(grid, new GlyphBatch(8));
  const births = new Births(askPriors, 1);
  const things: ThingView[] = [
    {
      id: "th1",
      element: "log",
      kind: "thing",
      name: "a log",
      forms: ["grained"],
      baseline: { mass: 4, hardness: 3 },
      x: 3,
      z: 3,
      look: { glyph: 1, ink: 1 },
      states: { growth: 5 },
    },
  ];
  const living = new LivingThings(things, grid, objects, births);
  const shots = new OneShots();
  const played: { row: MotionRow; at: number }[] = [];
  const elements: Record<string, ElementView> = {
    ash: { name: "ash", kind: "material", forms: ["granular"], baseline: { mass: 1 } },
  };
  const link = new WorldLink({
    grid,
    living,
    births,
    shots,
    motions: { play: (_slotOf, row, at) => played.push({ row, at }) },
    actorSlot: () => 0,
    slotAt: (tile) => objects.slotAt(tile),
    elementOf: (id) => elements[id] ?? null,
  });
  const act = { process: "force", actorTile: grid.index(3, 4), tile: grid.index(3, 3), level: 3 };
  return { grid, objects, births, living, shots, played, link, act, things };
}

describe("what the world's states show as", () => {
  it("is a rule per state, laid over what showed before", () => {
    expect(shownOf(seen({}, 2.6))).toEqual({ burning: 3 });
    expect(shownOf(seen({}), { burning: 4, growth: 3 })).toEqual({ burning: 0, growth: 3 });
    // A guttering coat of oil burns low, but it burns: it never shows as out.
    expect(shownOf(seen({}, 0.4)).burning).toBe(1);
    expect(shownOf(seen({}, 99)).burning).toBe(5);
  });

  it("shows the surface before the bulk: held in a flame, a thing glows before it is hot through", () => {
    expect(shownOf(seen({ temperature: 2, surfaceAbove: 3 })).temperature).toBe(5);
    expect(shownOf(seen({ temperature: 2, surfaceAbove: 0 })).temperature).toBe(2);
    expect(shownOf(seen({ wetness: 9, integrity: -2, amount: 2.6 }))).toEqual({
      burning: 0,
      wetness: 5,
      integrity: 0,
      amount: 3,
    });
  });

  it("gives rot no sign until anyone would notice it", () => {
    expect(shownOf(seen({ contamination: 1.2 })).contamination).toBe(0);
    expect(shownOf(seen({ contamination: 1.6, corrosion: 3 }))).toMatchObject({
      contamination: 2,
      corrosion: 3,
    });
  });
});

describe("a resolved act, shown", () => {
  it("moves both glyphs and plays what comes off the patient, with no changes at all", () => {
    const { link, act, played, shots } = scene();
    expect(link.show({ ...act, now: 10 }, [])).toEqual([]);
    expect(played.map((p) => [p.row.motion, p.at])).toEqual([
      ["lunge", 10],
      ["shake", 10.08],
    ]);
    expect(shots.playing).toBe(1);
  });

  it("draws the touched things as the world has them after, and says the world's notes in order", () => {
    const { link, act, living, things } = scene();
    const changes: WorldChange[] = [
      { ...why, kind: "state", note: "The log cracks." },
      { ...why, kind: "state" },
      { ...why, kind: "nothing", note: "Nothing else happens." },
    ];
    const after = {
      th1: seen({ integrity: 3, temperature: 2, surfaceAbove: 2 }, 0, "log"),
      nobody: null,
    };
    expect(link.show({ ...act, now: 1 }, changes, after)).toEqual([
      "The log cracks.",
      "Nothing else happens.",
    ]);
    expect(things[0]?.states).toEqual({ growth: 5, burning: 0, integrity: 3, temperature: 4 });
    expect(describeThing(living.thing(0) as ThingView)).toBe("a log: dormant, hot, cracked");
  });

  it("never rebuilds the world from the changes: with nothing handed back, nothing is redrawn", () => {
    const { link, act, things } = scene();
    link.show({ ...act, now: 1 }, [{ ...why, kind: "state", note: "It is said to crack." }]);
    expect(things[0]?.states).toEqual({ growth: 5 });
  });

  it("plays breaking when this act broke the patient, and striking when it was broken already", async () => {
    const { link, act, births } = scene();
    link.show({ ...act, now: 1 }, [], { th1: seen({ integrity: 1 }, 0, "log") });
    await births.settled();
    const kinds = () => births.log.map((line) => line.key.split("\n")[0]);
    expect(kinds()).toContain("breaks");
    expect(kinds()).not.toContain("struck");
    link.show({ ...act, now: 2 }, [], { th1: seen({ integrity: 1 }, 0, "log") });
    await births.settled();
    expect(kinds()).toContain("struck");
  });

  it("takes a thing off the map when the world no longer has it", () => {
    const { link, act, living, objects, grid } = scene();
    link.show({ ...act, now: 1 }, [{ ...why, kind: "consume" }], {
      th1: seen({ amount: 3 }, 0, "log"),
    });
    expect(living.thing(0)?.states.amount).toBe(3);
    link.show({ ...act, now: 2 }, [{ ...why, kind: "consume" }], { th1: null });
    expect(living.thing(0)).toBeNull();
    expect(living.indexOf("th1")).toBe(-1);
    expect(objects.at(grid.index(3, 3))).toBeNull();
  });

  it("finds a made thing the nearest free tile, draws it from its element, and ignores an unknown one", () => {
    const { link, act, living, grid } = scene();
    link.show({ ...act, process: "heat", now: 1 }, [{ ...why, kind: "create" }], {
      th2: seen({ amount: 2 }, 0, "ash"),
      th3: seen({}, 0, "unheard of"),
    });
    const ash = living.thing(living.indexOf("th2"));
    expect(ash).toMatchObject({ name: "ash", element: "ash", states: { amount: 2, burning: 0 } });
    expect(Math.abs((ash?.x ?? 99) - 3) + Math.abs((ash?.z ?? 99) - 3)).toBe(1);
    expect(living.indexOf("th3")).toBe(-1);
    expect(freeTileNear(grid, living, grid.index(3, 3))).not.toBe(grid.index(3, 3));
  });

  it("shows smoke as something rising from what stands there, and lets other signals pass", () => {
    const { link, act, shots } = scene();
    const emitters = new EmitterList();
    link.show({ ...act, process: "heat", now: 5 }, [
      { ...why, kind: "signal", place: "clearing", channel: "sound", strength: 4 },
    ]);
    expect(shots.playing).toBe(0);
    link.show({ ...act, process: "heat", now: 5 }, [
      { ...why, kind: "signal", place: "clearing", channel: "smoke", strength: 3 },
    ]);
    shots.emit(emitters, 5.1);
    expect(emitters.count).toBe(1);
  });

  it("shows nothing for a process it has never heard of, and still draws what it left", () => {
    const { link, act, played, things } = scene();
    link.show({ ...act, process: "transmute", now: 1 }, [{ ...why, kind: "state" }], {
      th1: seen({ wetness: 4 }, 0, "log"),
    });
    expect(played).toEqual([]);
    expect(things[0]?.states.wetness).toBe(4);
  });
});
