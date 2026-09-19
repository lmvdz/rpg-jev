import { describe, expect, it } from "vitest";
import { buildDemoScene, DEMO_GLYPHS, DEMO_SIZE } from "../src/scene/demo.ts";
import { Walker } from "../src/scene/walker.ts";
import { CHUNK_SIZE, ChunkManager, type ChunkWorker } from "../src/terrain/chunks.ts";
import { SHAPE, TileGrid } from "../src/terrain/grid.ts";
import { kindIndex } from "../src/terrain/kinds.ts";
import { TESSELLATION_BORDER, tessellate } from "../src/terrain/tessellate.ts";
import type { ChunkJob, ChunkResult } from "../src/terrain/worker.ts";

/** Does a worker's job at once, in this thread. */
function inlineWorker(): ChunkWorker & { jobs: number[] } {
  const worker: ChunkWorker & { jobs: number[] } = {
    jobs: [],
    onmessage: null,
    postMessage(job: ChunkJob) {
      worker.jobs.push(job.key);
      const grid = new TileGrid(job.span, job.span, job.arrays);
      grid.floorLevel = job.floorLevel;
      const mesh = tessellate(grid, TESSELLATION_BORDER, TESSELLATION_BORDER, job.width, job.depth);
      worker.onmessage?.({ data: { key: job.key, mesh } } as MessageEvent<ChunkResult>);
    },
  };
  return worker;
}

describe("the stress scene", () => {
  it("is the size and holds the glyphs the R1 gate names", () => {
    const scene = buildDemoScene();
    expect(scene.grid.width).toBe(DEMO_SIZE);
    expect(scene.placements.length).toBeGreaterThanOrEqual(DEMO_GLYPHS);
  });

  it("is the same scene for the same seed", () => {
    const a = buildDemoScene(11);
    const b = buildDemoScene(11);
    expect(a.grid.heights).toEqual(b.grid.heights);
    expect(a.placements).toEqual(b.placements);
    expect(buildDemoScene(12).grid.heights).not.toEqual(a.grid.heights);
  });
});

describe("the chunk manager", () => {
  it("builds every chunk, nearest first, a few a frame", () => {
    const grid = new TileGrid(70, 40);
    const worker = inlineWorker();
    const built: number[] = [];
    const chunks = new ChunkManager(grid, worker, (key, mesh, x, z) => {
      built.push(key);
      expect(mesh.vertexCount).toBeGreaterThan(0);
      expect([x, z]).toEqual([(key % 3) * CHUNK_SIZE, Math.floor(key / 3) * CHUNK_SIZE]);
    });
    expect([chunks.chunksX, chunks.chunksZ]).toEqual([3, 2]);
    for (let frame = 0; frame < 10 && chunks.waiting > 0; frame++) chunks.pump(69, 39, 2, 2);
    expect(built.sort()).toEqual([0, 1, 2, 3, 4, 5]);
    expect(worker.jobs[0]).toBe(5);
  });

  it("still builds when it is told a position that is not a number", () => {
    const built: number[] = [];
    const chunks = new ChunkManager(new TileGrid(64, 64), inlineWorker(), (key) => built.push(key));
    for (let frame = 0; frame < 10 && chunks.waiting > 0; frame++) chunks.pump(Number.NaN, 0);
    expect(built.sort()).toEqual([0, 1, 2, 3]);
  });

  it("rebuilds the neighbour too when an edit is near a chunk's edge", () => {
    const worker = inlineWorker();
    const chunks = new ChunkManager(new TileGrid(64, 64), worker, () => undefined);
    while (chunks.waiting > 0) chunks.pump(0, 0);
    worker.jobs.length = 0;
    chunks.markTileDirty(16, 16);
    chunks.markTileDirty(31, 5);
    while (chunks.waiting > 0) chunks.pump(0, 0);
    expect(worker.jobs.sort()).toEqual([0, 1]);
  });
});

describe("the walker", () => {
  function yard(): TileGrid {
    const grid = new TileGrid(5, 5);
    grid.set(2, 1, { height: 3 });
    grid.set(3, 2, { kind: kindIndex("water") });
    grid.set(1, 2, { shape: SHAPE.hole });
    grid.set(2, 3, { height: 1 });
    return grid;
  }

  it("climbs a step but not a wall, and keeps out of water and holes", () => {
    const walker = new Walker(yard(), 2, 2);
    expect(walker.canEnter(2, 1)).toBe(false);
    expect(walker.canEnter(3, 2)).toBe(false);
    expect(walker.canEnter(1, 2)).toBe(false);
    expect(walker.canEnter(2, 3)).toBe(true);
    expect(walker.canEnter(2, 9)).toBe(false);
  });

  it("stays where it is through a frame that runs backwards", () => {
    // The browser's first frame timestamp can precede the clock read at load.
    const walker = new Walker(yard(), 2, 2);
    walker.update(-0.004, 0);
    expect([walker.x, walker.y, walker.z]).toEqual([2.5, 0, 2.5]);
  });

  it("walks away from the camera on up, whichever way the camera faces", () => {
    const north = new Walker(new TileGrid(9, 9), 4, 4);
    north.press("arrowup", 0);
    expect([north.tileX, north.tileZ]).toEqual([4, 3]);
    const turned = new Walker(new TileGrid(9, 9), 4, 4);
    turned.press("arrowup", Math.PI / 2);
    expect([turned.tileX, turned.tileZ]).toEqual([3, 4]);
    for (let i = 0; i < 60; i++) north.update(1 / 60, 0);
    expect(north.z).toBeLessThan(3.5);
  });
});
