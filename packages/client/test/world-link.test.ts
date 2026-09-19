import { describe, expect, it } from "vitest";
import { GlyphBatch } from "../src/glyph/batch.ts";
import {
  type ElementView,
  freeTileNear,
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
    expect(shownOf({ burning: { fuel: 30 } })).toEqual({ burning: 3 });
    const out = shownOf({ burning: null }, { burning: 4, growth: 3 });
    expect(out).toEqual({ burning: 0, growth: 3 });
    expect(shownOf({ burning: { fuel: 9999 } }).burning).toBe(5);
    expect(shownOf({ burning: { fuel: 1 } }).burning).toBe(1);
  });

  it("shows the surface before the bulk: held in a flame, a thing glows before it is hot through", () => {
    expect(shownOf({ temperature: 2, surfaceAbove: 3 }).temperature).toBe(5);
    expect(shownOf({ temperature: 2, surfaceAbove: 0 }).temperature).toBe(2);
    expect(shownOf({ wetness: 9, integrity: -2, amount: 2.6 })).toEqual({
      wetness: 5,
      integrity: 0,
      amount: 3,
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

  it("applies a change of state to the thing it names, and says the world's notes in order", () => {
    const { link, act, living, things } = scene();
    const changes: WorldChange[] = [
      { ...why, kind: "state", thing: "th1", set: { integrity: 3 }, note: "The log cracks." },
      { ...why, kind: "state", thing: "th1", set: { surfaceAbove: 2 } },
      { ...why, kind: "state", thing: "nobody", set: { integrity: 0 } },
      { ...why, kind: "nothing", note: "Nothing else happens." },
    ];
    expect(link.show({ ...act, now: 1 }, changes)).toEqual([
      "The log cracks.",
      "Nothing else happens.",
    ]);
    expect(things[0]?.states).toEqual({ growth: 5, integrity: 3, temperature: 4 });
    expect(describeThing(living.thing(0) as ThingView)).toBe("a log: dormant, hot, cracked");
  });

  it("plays breaking and not striking when the act leaves the patient broken", async () => {
    const { link, act, births } = scene();
    link.show({ ...act, now: 1 }, [{ ...why, kind: "state", thing: "th1", set: { integrity: 1 } }]);
    await births.settled();
    const keys = births.log.map((line) => line.key.split("\n")[0]);
    expect(keys).toContain("breaks");
    expect(keys).not.toContain("struck");
  });

  it("uses a thing up, and takes it off the map when none is left", () => {
    const { link, act, living, objects, grid } = scene();
    link.show({ ...act, now: 1 }, [{ ...why, kind: "consume", thing: "th1", amount: 2 }]);
    expect(living.thing(0)?.states.amount).toBe(3);
    link.show({ ...act, now: 2 }, [{ ...why, kind: "consume", thing: "th1", amount: 3 }]);
    expect(living.thing(0)).toBeNull();
    expect(living.indexOf("th1")).toBe(-1);
    expect(objects.at(grid.index(3, 3))).toBeNull();
  });

  it("finds a made thing the nearest free tile, draws it from its element, and ignores an unknown one", () => {
    const { link, act, living, grid } = scene();
    link.show({ ...act, process: "heat", now: 1 }, [
      { ...why, kind: "create", thing: { id: "th2", element: "ash", state: { amount: 2 } } },
      { ...why, kind: "create", thing: { id: "th3", element: "unheard of", state: {} } },
    ]);
    const ash = living.thing(living.indexOf("th2"));
    expect(ash).toMatchObject({ name: "ash", element: "ash", states: { amount: 2 } });
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

  it("shows nothing for a process it has never heard of, and still applies what changed", () => {
    const { link, act, played, things } = scene();
    link.show({ ...act, process: "transmute", now: 1 }, [
      { ...why, kind: "state", thing: "th1", set: { wetness: 4 } },
    ]);
    expect(played).toEqual([]);
    expect(things[0]?.states.wetness).toBe(4);
  });
});
