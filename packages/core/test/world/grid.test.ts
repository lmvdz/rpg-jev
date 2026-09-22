import { describe, expect, it } from "vitest";
import { NO_INK, SHAPE, TileGrid } from "../../src/world/grid.ts";
import { cornerHeights, groundHeight } from "../../src/world/ground.ts";
import { kindIndex } from "../../src/world/kinds.ts";
import { canStep, NOTHING_BLOCKS, standable } from "../../src/world/steps.ts";

describe("the tile grid", () => {
  it("reports tiles outside itself as flat, at the floor level", () => {
    const grid = new TileGrid(4, 4);
    grid.floorLevel = -3;
    expect(grid.heightAt(-1, 0)).toBe(-3);
    expect(grid.shapeAt(10, 10)).toBe(SHAPE.flat);
    expect(grid.inkAt(10, 10)).toBe(NO_INK);
  });

  it("sets and reads back a tile", () => {
    const grid = new TileGrid(4, 4);
    grid.set(1, 2, { height: 5, kind: kindIndex("rock"), shape: SHAPE.slantN, ink: 3 });
    expect(grid.heightAt(1, 2)).toBe(5);
    expect(grid.kindAt(1, 2)).toBe(kindIndex("rock"));
    expect(grid.shapeAt(1, 2)).toBe(SHAPE.slantN);
    expect(grid.inkAt(1, 2)).toBe(3);
  });
});

describe("ground height", () => {
  it("agrees with a flat tile's own height", () => {
    const grid = new TileGrid(4, 4);
    grid.set(1, 1, { height: 4 });
    const out = new Float32Array(4);
    cornerHeights(grid, 1, 1, out);
    expect([...out]).toEqual([2, 2, 2, 2]);
    expect(groundHeight(grid, 1.5, 1.5)).toBeCloseTo(2);
  });

  it("drops a hole well below its tile", () => {
    const grid = new TileGrid(4, 4);
    grid.set(1, 1, { height: 4, shape: SHAPE.hole });
    expect(groundHeight(grid, 1.5, 1.5)).toBeLessThan(0);
  });
});

describe("the stepping rule", () => {
  it("refuses water, a hole and a step too tall", () => {
    const grid = new TileGrid(4, 4);
    grid.set(1, 0, { kind: kindIndex("water") });
    grid.set(2, 0, { shape: SHAPE.hole });
    grid.set(3, 0, { height: 10 });
    expect(standable(grid, NOTHING_BLOCKS, 1, 0)).toBe(false);
    expect(standable(grid, NOTHING_BLOCKS, 2, 0)).toBe(false);
    expect(canStep(grid, NOTHING_BLOCKS, 0, 0, 3, 0)).toBe(false);
  });

  it("refuses a diagonal step that cuts a corner it could not walk", () => {
    const grid = new TileGrid(4, 4);
    grid.set(1, 1, { kind: kindIndex("water") });
    expect(canStep(grid, NOTHING_BLOCKS, 0, 0, 1, 1)).toBe(false);
  });

  it("allows an ordinary flat step, and nothing blocks it once something stands there", () => {
    const grid = new TileGrid(4, 4);
    expect(canStep(grid, NOTHING_BLOCKS, 0, 0, 1, 0)).toBe(true);
    const blocked = (i: number) => i === grid.index(1, 0);
    expect(canStep(grid, blocked, 0, 0, 1, 0)).toBe(false);
  });
});
