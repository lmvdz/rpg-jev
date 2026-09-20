// Dependency-free: node --test packages/client/test/food-movement.native.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import { findPath } from "../src/scene/path.ts";
import { Walker } from "../src/scene/walker.ts";
import { TileGrid } from "../src/terrain/grid.ts";

test("authoritative admission happens before destination or pose moves", () => {
  const grid = new TileGrid(8, 8);
  const walker = new Walker(grid, 2, 2);
  let called = 0;
  walker.commitStep = (x, z) => {
    assert.deepEqual([x, z], [3, 2]);
    assert.deepEqual([walker.tileX, walker.tileZ, walker.x, walker.z], [2, 2, 2.5, 2.5]);
    called++;
    return true;
  };
  walker.press("d", 0);
  assert.equal(called, 1);
  assert.equal(walker.tileX, 3);
  assert.equal(walker.x, 2.5);
  for (let frame = 0; frame < 120; frame++) walker.update(1 / 60, 0);
  assert.equal(called, 1, "held keys cannot manufacture frame-dependent turns");
  assert.equal(walker.x, 3.5);
});

test("rejected authority cannot move or rewind the visual walker", () => {
  const walker = new Walker(new TileGrid(8, 8), 2, 2);
  walker.commitStep = () => false;
  walker.press("d", 0);
  walker.update(1, 0);
  assert.deepEqual([walker.tileX, walker.tileZ, walker.x, walker.z], [2, 2, 2.5, 2.5]);
});

test("a clicked cardinal route commits the identical sequence at 15 and 144 fps", () => {
  const grid = new TileGrid(8, 8);
  const path = findPath(grid, () => false, grid.index(2, 2), grid.index(5, 5), 40_000, true);
  assert.equal(path.length, 6);
  const run = (dt) => {
    const commits = [];
    const walker = new Walker(grid, 2, 2);
    walker.commitStep = (x, z) => {
      assert.equal(Math.abs(x - walker.tileX) + Math.abs(z - walker.tileZ), 1);
      commits.push([x, z]);
      return true;
    };
    walker.follow(path);
    for (let frame = 0; walker.busy && frame < 2000; frame++) walker.update(dt, 0);
    assert.equal(walker.busy, false);
    return commits;
  };
  assert.deepEqual(run(1 / 15), run(1 / 144));
});

test("legacy walking still permits eight directions", () => {
  const walker = new Walker(new TileGrid(8, 8), 2, 2);
  walker.press("pageup", 0);
  assert.deepEqual([walker.tileX, walker.tileZ], [3, 1]);
});
