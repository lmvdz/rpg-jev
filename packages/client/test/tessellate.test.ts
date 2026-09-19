import { describe, expect, it } from "vitest";
import { INK } from "../src/palette.ts";
import { buildDemoScene } from "../src/scene/demo.ts";
import { LEVEL, SHAPE, TileGrid } from "../src/terrain/grid.ts";
import { kindIndex } from "../src/terrain/kinds.ts";
import {
  type ChunkMesh,
  groundHeight,
  TESSELLATION_BORDER,
  tessellate,
  VERTEX_BYTES,
} from "../src/terrain/tessellate.ts";

interface Vertex {
  position: [number, number, number];
  normal: [number, number, number];
  ink: number;
  shade: number;
}

function vertices(mesh: ChunkMesh): Vertex[] {
  const view = new DataView(mesh.vertices);
  const out: Vertex[] = [];
  for (let v = 0; v < mesh.vertexCount; v++) {
    const at = v * VERTEX_BYTES;
    out.push({
      position: [
        view.getFloat32(at, true),
        view.getFloat32(at + 4, true),
        view.getFloat32(at + 8, true),
      ],
      normal: [
        view.getInt8(at + 12) / 127,
        view.getInt8(at + 13) / 127,
        view.getInt8(at + 14) / 127,
      ],
      ink: view.getUint8(at + 16),
      shade: view.getUint8(at + 18),
    });
  }
  return out;
}

function quads(mesh: ChunkMesh): Vertex[][] {
  const all = vertices(mesh);
  const out: Vertex[][] = [];
  for (let v = 0; v < all.length; v += 4) out.push(all.slice(v, v + 4));
  return out;
}

const isFloor = (quad: Vertex[]) => (quad[0]?.normal[1] ?? 0) > 0.5;

function flat(size: number, height = 0): TileGrid {
  const grid = new TileGrid(size, size);
  grid.heights.fill(height);
  return grid;
}

describe("tessellate", () => {
  it("draws one floor per tile and no walls inside flat ground", () => {
    const mesh = tessellate(flat(4), 1, 1, 2, 2);
    expect(quads(mesh)).toHaveLength(4);
    expect(quads(mesh).every(isFloor)).toBe(true);
  });

  it("walls the world's edge down to the floor level", () => {
    const grid = flat(1, 2);
    const walls = quads(tessellate(grid, 0, 0, 1, 1)).filter((q) => !isFloor(q));
    expect(walls).toHaveLength(4);
    for (const wall of walls) {
      const ys = wall.map((v) => v.position[1]);
      expect(Math.max(...ys)).toBe(2 * LEVEL);
      expect(Math.min(...ys)).toBe(grid.floorLevel * LEVEL);
    }
  });

  it("raises four walls round a tile that stands higher, darker at the foot", () => {
    const grid = flat(3);
    grid.set(1, 1, { height: 4 });
    const walls = quads(tessellate(grid, 1, 1, 1, 1)).filter((q) => !isFloor(q));
    expect(walls).toHaveLength(4);
    for (const wall of walls) {
      const foot = wall.filter((v) => v.position[1] === 0);
      const top = wall.filter((v) => v.position[1] === 4 * LEVEL);
      expect(foot).toHaveLength(2);
      expect(top).toHaveLength(2);
      expect(foot.every((v) => v.shade < 255)).toBe(true);
      expect(top.every((v) => v.shade === 255)).toBe(true);
    }
  });

  it("winds every triangle so its face agrees with its normal", () => {
    const { grid } = buildDemoScene(3);
    const mesh = tessellate(grid, 96, 96, 32, 32);
    const all = vertices(mesh);
    let checked = 0;
    for (let i = 0; i < mesh.indices.length; i += 3) {
      const [a, b, c] = [0, 1, 2].map((k) => all[mesh.indices[i + k] ?? 0]);
      if (!(a && b && c)) throw new Error("index out of range");
      const u = b.position.map((p, k) => p - (a.position[k] ?? 0));
      const w = c.position.map((p, k) => p - (a.position[k] ?? 0));
      const face = [
        (u[1] ?? 0) * (w[2] ?? 0) - (u[2] ?? 0) * (w[1] ?? 0),
        (u[2] ?? 0) * (w[0] ?? 0) - (u[0] ?? 0) * (w[2] ?? 0),
        (u[0] ?? 0) * (w[1] ?? 0) - (u[1] ?? 0) * (w[0] ?? 0),
      ];
      const area = Math.hypot(...face);
      if (area < 1e-6) continue; // a wall that tapers to a point has one empty triangle
      const agreement = face.reduce((sum, f, k) => sum + (f / area) * (a.normal[k] ?? 0), 0);
      expect(agreement).toBeGreaterThan(0.95);
      checked++;
    }
    expect(checked).toBeGreaterThan(2000);
  });

  it("makes a slant meet the tile it climbs to, with no wall between them", () => {
    const grid = flat(3);
    grid.set(2, 1, { height: 2 });
    grid.set(1, 1, { shape: SHAPE.slantE });
    expect(groundHeight(grid, 1, 1.5)).toBeCloseTo(0);
    expect(groundHeight(grid, 1.5, 1.5)).toBeCloseTo(LEVEL);
    expect(groundHeight(grid, 1.999, 1.5)).toBeCloseTo(2 * LEVEL, 2);
    const high = quads(tessellate(grid, 2, 1, 1, 1)).filter((q) => !isFloor(q));
    // The raised tile walls its north, east and south sides, and not the side the ramp joins.
    expect(high.map((q) => q[0]?.normal)).not.toContainEqual([-1, 0, 0]);
    expect(high).toHaveLength(3);
  });

  it("closes the sides of a slant with tapering walls", () => {
    const grid = flat(3);
    grid.set(2, 1, { height: 2 });
    grid.set(1, 1, { shape: SHAPE.slantE });
    const walls = quads(tessellate(grid, 1, 1, 1, 1)).filter((q) => !isFloor(q));
    expect(walls.map((q) => q[0]?.normal[2]).sort()).toEqual([-1, 1]);
  });

  it("drops a hole's floor into the dark and walls it from every side", () => {
    const grid = flat(3, 2);
    grid.set(1, 1, { shape: SHAPE.hole });
    const hole = quads(tessellate(grid, 1, 1, 1, 1));
    expect(hole).toHaveLength(1);
    expect(hole[0]?.every((v) => v.ink === INK.void && v.position[1] < 0)).toBe(true);
    const beside = quads(tessellate(grid, 0, 1, 1, 1)).filter((q) => q[0]?.normal[0] === 1);
    expect(beside).toHaveLength(1);
  });

  it("uses a flooded colour in place of the kind's", () => {
    const grid = flat(1);
    grid.set(0, 0, { kind: kindIndex("grass"), ink: INK.violet });
    const floor = quads(tessellate(grid, 0, 0, 1, 1)).filter(isFloor);
    expect(floor[0]?.every((v) => v.ink === INK.violet)).toBe(true);
  });

  it("builds the same chunk from a bordered copy as from the whole world", () => {
    const { grid } = buildDemoScene(5);
    for (const [x0, z0] of [
      [0, 0],
      [96, 96],
      [224, 224],
      [128, 96],
    ] as const) {
      const whole = tessellate(grid, x0, z0, 32, 32);
      const region = grid.region(x0, z0, 32, TESSELLATION_BORDER);
      const alone = tessellate(region, TESSELLATION_BORDER, TESSELLATION_BORDER, 32, 32);
      expect(alone.vertexCount).toBe(whole.vertexCount);
      expect(new Uint8Array(alone.vertices)).toEqual(new Uint8Array(whole.vertices));
      expect(alone.indices).toEqual(whole.indices);
    }
  });
});
