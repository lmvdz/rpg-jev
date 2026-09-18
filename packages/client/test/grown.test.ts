import { describe, expect, it } from "vitest";
import { DEFAULT_ATMOSPHERE } from "../src/gl/frame.ts";
import { GLYPH_GLOWS, GLYPH_SWAYS, GlyphBatch } from "../src/glyph/batch.ts";
import { INK } from "../src/palette.ts";
import { buildClearing, CLEARING_SIZE } from "../src/scene/clearing.ts";
import { Drift } from "../src/scene/drift.ts";
import { kindIndex } from "../src/terrain/kinds.ts";
import { askPriors, EffectBook } from "../src/view/effect-book.ts";
import { LightList, MAX_LIGHTS } from "../src/view/lights.ts";
import { LivingThings } from "../src/view/living.ts";
import { applySky } from "../src/view/sky.ts";
import { glyphLookOf, lightOf, type ThingView } from "../src/view/things.ts";
import { ObjectLayer } from "../src/world/objects.ts";

const WATER = kindIndex("water");

describe("a look from data", () => {
  const sapling = { glyph: 95, ink: INK.leaf, scale: 24, sways: true };

  it("draws a seedling small, a grown plant whole, and a dead one bare and still", () => {
    expect(glyphLookOf(sapling, { growth: 0 }).scale).toBeLessThan(10);
    expect(glyphLookOf(sapling, { growth: 3 })).toEqual({
      glyph: 95,
      ink: INK.leaf,
      flags: GLYPH_SWAYS,
      scale: 24,
    });
    const dead = glyphLookOf(sapling, { growth: 6 });
    expect([dead.ink, dead.flags]).toEqual([INK.earth, 0]);
  });

  it("makes whatever burns glow and give light, by how hard it burns", () => {
    const anything = { glyph: 40, ink: INK.bone };
    expect(glyphLookOf(anything, { burning: 2 }).flags & GLYPH_GLOWS).toBe(GLYPH_GLOWS);
    expect(glyphLookOf(anything, {}).flags & GLYPH_GLOWS).toBe(0);
    expect(lightOf({})).toBeNull();
    expect(lightOf({ burning: 5 })?.radius).toBeGreaterThan(lightOf({ burning: 1 })?.radius ?? 0);
    // Scorching but not alight: it shows red and glows a little.
    expect(glyphLookOf(anything, { temperature: 5 }).ink).toBe(INK.ember);
    expect(lightOf({ temperature: 5 })?.radius).toBeLessThan(lightOf({ burning: 1 })?.radius ?? 0);
  });
});

describe("the frame's lights", () => {
  it("keeps the nearest when there are more than the shader takes", () => {
    const lights = new LightList();
    lights.begin(0, 0);
    for (let i = 20; i >= 1; i--) lights.offer(i * 10, 0, 0, 1, [1, 1, 1], 0);
    expect(lights.count).toBe(MAX_LIGHTS);
    const xs = [...lights.positions].filter((_, at) => at % 4 === 0).sort((a, b) => a - b);
    expect(xs).toEqual([10, 20, 30, 40, 50, 60, 70, 80]);
    lights.begin(0, 0);
    expect(lights.count).toBe(0);
  });
});

describe("the sky", () => {
  it("is dark at night, bright at noon, and warm at the ends of the day", () => {
    const sky = structuredClone(DEFAULT_ATMOSPHERE);
    applySky(12, sky);
    const noon = sky.ambient;
    expect(sky.sunDirection[1]).toBeGreaterThan(0.9);
    applySky(2, sky);
    expect(sky.ambient).toBeLessThan(noon / 2);
    applySky(19, sky);
    expect(sky.sunColor[0]).toBeGreaterThan(sky.sunColor[2] * 2);
    applySky(24 + 12, sky);
    expect(sky.ambient).toBe(noon);
    expect(DEFAULT_ATMOSPHERE.ambient).toBe(noon);
  });
});

describe("the clearing", () => {
  const clearing = buildClearing(1);
  const { grid, things } = clearing;

  it("is the same for the same seed and different for another", () => {
    expect(buildClearing(1).grid.heights).toEqual(grid.heights);
    expect(buildClearing(1).things).toEqual(things);
    expect(buildClearing(2).grid.heights).not.toEqual(grid.heights);
  });

  it("has a stream from the north edge to the south that never runs uphill", () => {
    let last = Number.POSITIVE_INFINITY;
    for (let z = 0; z < CLEARING_SIZE; z++) {
      const beds: number[] = [];
      for (let x = 0; x < CLEARING_SIZE; x++) {
        if (grid.kindAt(x, z) === WATER) beds.push(grid.heightAt(x, z));
      }
      expect(beds.length, `row ${z} has water`).toBeGreaterThan(0);
      expect(Math.max(...beds)).toBeLessThanOrEqual(last);
      last = Math.min(...beds);
    }
  });

  it("has meadow, woods and a quarry, a fire on dry ground, and one thing to a tile", () => {
    for (const name of ["grass", "forest", "rock", "sand"] as const) {
      expect(grid.kinds.includes(kindIndex(name)), name).toBe(true);
    }
    const fires = things.filter((thing) => (thing.states.burning ?? 0) > 0);
    expect(fires).toHaveLength(1);
    expect(grid.kindAt(clearing.hearth[0], clearing.hearth[1])).not.toBe(WATER);
    expect(grid.kindAt(clearing.start[0], clearing.start[1])).not.toBe(WATER);
    const tiles = new Set(things.map((thing) => grid.index(thing.x, thing.z)));
    expect(tiles.size).toBe(things.length);
    expect(things.length).toBeGreaterThan(300);
  });

  it("keeps changing, and what changes is redrawn and relit", () => {
    const copy: ThingView[] = structuredClone(things);
    const batch = new GlyphBatch(16);
    const objects = new ObjectLayer(grid, batch);
    const living = new LivingThings(copy, grid, objects, new EffectBook(askPriors, 1));
    expect(batch.count).toBe(copy.length);
    const drift = new Drift(copy, 3);
    let changes = 0;
    for (let step = 0; step < 400; step++) {
      const changed = drift.step();
      changes += changed.length;
      living.redraw(changed);
    }
    expect(changes).toBeGreaterThan(100);
    expect(copy).not.toEqual(things);
    expect(batch.count).toBe(copy.length);
    const lights = new LightList();
    lights.begin(clearing.hearth[0], clearing.hearth[1]);
    living.shine(lights);
    expect(lights.count).toBe(1);
  });

  it("stops lighting the ground when the fire goes out, and starts again when it is relit", () => {
    const copy: ThingView[] = structuredClone(things);
    const book = new EffectBook(askPriors, 1);
    const living = new LivingThings(copy, grid, new ObjectLayer(grid, new GlyphBatch(16)), book);
    const fire = copy.findIndex((thing) => (thing.states.burning ?? 0) > 0);
    const lights = new LightList();
    const count = () => {
      lights.begin(0, 0);
      living.shine(lights);
      return lights.count;
    };
    (copy[fire] as ThingView).states.burning = 0;
    living.redraw([fire]);
    expect(count()).toBe(0);
    (copy[fire] as ThingView).states.burning = 3;
    (copy[0] as ThingView).states.burning = 1;
    living.redraw([fire, 0, fire]);
    expect(count()).toBe(2);
  });
});

describe("a world that changes a little everywhere", () => {
  it("uploads the pages that changed and not the whole buffer", () => {
    const batch = new GlyphBatch(100_000);
    for (let i = 0; i < 100_000; i++) batch.add(i, 0, 0, { glyph: 1, ink: 1 });
    batch.clean();
    for (const slot of [5, 300, 301, 99_999]) batch.setInk(slot, 2);
    const runs: [number, number][] = [];
    batch.forEachDirtyRun((from, to) => runs.push([from, to]));
    expect(runs).toEqual([
      [0, 512],
      [99_840, 100_000],
    ]);
    batch.clean();
    batch.forEachDirtyRun(() => {
      throw new Error("nothing changed");
    });
    batch.markAllDirty();
    runs.length = 0;
    batch.forEachDirtyRun((from, to) => runs.push([from, to]));
    expect(runs).toEqual([[0, 100_000]]);
  });
});
