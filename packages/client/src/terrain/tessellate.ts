/**
 * The tile tessellator (SPEC.md section 19, step R1): floors, walls, slants,
 * holes and liquid surfaces from a height grid, as one static mesh per chunk.
 *
 * It is pure, so it runs in a Web Worker and under test. A chunk is built
 * from a copy of its tiles plus `TESSELLATION_BORDER` neighbours on each side
 * (`TileGrid.region`), and reads nothing else: a chunk's mesh cannot depend on
 * which chunks exist around it, which is where seams come from.
 */
import { cornerHeights, groundHeight } from "@rpg-jev/core/world";
import { DIR_X, DIR_Z, LEVEL, NO_INK, SHAPE, type TileGrid } from "./grid.ts";
import { kindAt } from "./kinds.ts";

/** A slant reads its neighbour's height and a wall reads its neighbour's slant. */
export const TESSELLATION_BORDER = 2;

/** position f32 x3, normal i8 x3, flags u8, ink u8, texture u8, shade u8, pad u8 */
export const VERTEX_BYTES = 20;
export const FLAG_LIQUID = 1;

const WALL_FOOT_SHADE = 140;
const CORNER_SHADE_STEP = 38;
const VOID_INK = 0;
const MAX_VERTICES_PER_TILE = 20;

export interface ChunkMesh {
  /** Interleaved vertices, `VERTEX_BYTES` each. Positions are relative to the chunk's origin tile. */
  readonly vertices: ArrayBuffer;
  readonly indices: Uint16Array;
  readonly vertexCount: number;
  readonly minY: number;
  readonly maxY: number;
}

/** Corner order: NW, NE, SE, SW. Edge `d` (N, E, S, W) runs from corner `d` to corner `d + 1`. */
const CORNER_X = [0, 1, 1, 0] as const;
const CORNER_Z = [0, 0, 1, 1] as const;

/**
 * Heights of a tile's four corners and the ground height at a point: shared
 * with the host (`@rpg-jev/core/world`) so the stepping rule and this mesh
 * never disagree about where the ground is.
 */
export { cornerHeights, groundHeight };

class MeshWriter {
  #floats: Float32Array;
  #bytes: Uint8Array;
  #signed: Int8Array;
  #indices: Uint16Array;
  vertexCount = 0;
  indexCount = 0;
  minY = Number.POSITIVE_INFINITY;
  maxY = Number.NEGATIVE_INFINITY;

  constructor(tileCount: number) {
    const vertices = tileCount * MAX_VERTICES_PER_TILE;
    if (vertices > 0x1_0000) throw new Error("a chunk this large overflows 16-bit indices");
    const buffer = new ArrayBuffer(vertices * VERTEX_BYTES);
    this.#floats = new Float32Array(buffer);
    this.#bytes = new Uint8Array(buffer);
    this.#signed = new Int8Array(buffer);
    this.#indices = new Uint16Array((vertices / 4) * 6);
  }

  vertex(x: number, y: number, z: number, normal: readonly number[], style: VertexStyle): void {
    const v = this.vertexCount++;
    const f = (v * VERTEX_BYTES) / 4;
    this.#floats[f] = x;
    this.#floats[f + 1] = y;
    this.#floats[f + 2] = z;
    const b = v * VERTEX_BYTES + 12;
    this.#signed[b] = Math.round((normal[0] ?? 0) * 127);
    this.#signed[b + 1] = Math.round((normal[1] ?? 0) * 127);
    this.#signed[b + 2] = Math.round((normal[2] ?? 0) * 127);
    this.#bytes[b + 3] = style.flags;
    this.#bytes[b + 4] = style.ink;
    this.#bytes[b + 5] = style.texture;
    this.#bytes[b + 6] = style.shade;
    if (y < this.minY) this.minY = y;
    if (y > this.maxY) this.maxY = y;
  }

  /** Two triangles over the last four vertices, which were given counter-clockwise. */
  quad(): void {
    const v = this.vertexCount - 4;
    const i = this.indexCount;
    this.#indices.set([v, v + 1, v + 2, v, v + 2, v + 3], i);
    this.indexCount = i + 6;
  }

  finish(): ChunkMesh {
    const empty = this.vertexCount === 0;
    return {
      vertices: this.#bytes.buffer.slice(0, this.vertexCount * VERTEX_BYTES) as ArrayBuffer,
      indices: this.#indices.slice(0, this.indexCount),
      vertexCount: this.vertexCount,
      minY: empty ? 0 : this.minY,
      maxY: empty ? 0 : this.maxY,
    };
  }
}

interface VertexStyle {
  flags: number;
  ink: number;
  texture: number;
  shade: number;
}

/** Scratch shared by one `tessellate` call; nothing here outlives it. */
interface Pass {
  readonly grid: TileGrid;
  readonly writer: MeshWriter;
  readonly originX: number;
  readonly originZ: number;
  readonly mine: Float32Array;
  readonly theirs: Float32Array;
  readonly style: VertexStyle;
  readonly normal: [number, number, number];
}

/**
 * How much the tiles around a floor corner close it in: each of the three
 * other tiles touching the corner that stands higher darkens it one step.
 */
function cornerShade(grid: TileGrid, x: number, z: number, corner: number, y: number): number {
  const sx = CORNER_X[corner] === 1 ? 1 : -1;
  const sz = CORNER_Z[corner] === 1 ? 1 : -1;
  let higher = 0;
  if (grid.heightAt(x + sx, z) * LEVEL > y + 0.01) higher++;
  if (grid.heightAt(x, z + sz) * LEVEL > y + 0.01) higher++;
  if (grid.heightAt(x + sx, z + sz) * LEVEL > y + 0.01) higher++;
  return 255 - higher * CORNER_SHADE_STEP;
}

function floorNormal(h: Float32Array, out: [number, number, number]): void {
  // Cross product of the diagonals NW->SE and NE->SW, which is exact for a slant.
  const ax = 1;
  const ay = (h[2] ?? 0) - (h[0] ?? 0);
  const az = 1;
  const bx = -1;
  const by = (h[3] ?? 0) - (h[1] ?? 0);
  const bz = 1;
  const nx = ay * bz - az * by;
  const ny = az * bx - ax * bz;
  const nz = ax * by - ay * bx;
  const sign = ny < 0 ? -1 : 1;
  const length = Math.hypot(nx, ny, nz) * sign;
  out[0] = nx / length;
  out[1] = ny / length;
  out[2] = nz / length;
}

function emitFloor(pass: Pass, x: number, z: number): void {
  const { grid, writer, mine, style, normal } = pass;
  const kind = kindAt(grid.kindAt(x, z));
  const hole = grid.shapeAt(x, z) === SHAPE.hole;
  const flooded = grid.inkAt(x, z);
  style.flags = kind.liquid && !hole ? FLAG_LIQUID : 0;
  style.texture = kind.texture;
  style.ink = flooded === NO_INK ? kind.floor : flooded;
  if (hole) style.ink = VOID_INK;
  floorNormal(mine, normal);
  // Counter-clockwise seen from above: NW, SW, SE, NE.
  for (const corner of [0, 3, 2, 1]) {
    const y = mine[corner] ?? 0;
    style.shade = cornerShade(grid, x, z, corner, y);
    writer.vertex(
      x - pass.originX + (CORNER_X[corner] ?? 0),
      y,
      z - pass.originZ + (CORNER_Z[corner] ?? 0),
      normal,
      style,
    );
  }
  writer.quad();
}

/** The wall on side `d`, from this tile's edge down to the neighbour's, if this tile stands higher. */
function emitWall(pass: Pass, x: number, z: number, d: number): void {
  const { grid, writer, mine, theirs, style, normal } = pass;
  cornerHeights(grid, x + (DIR_X[d] ?? 0), z + (DIR_Z[d] ?? 0), theirs);
  const first = d;
  const second = (d + 1) % 4;
  const topFirst = mine[first] ?? 0;
  const topSecond = mine[second] ?? 0;
  const footFirst = Math.min(topFirst, theirs[(d + 3) % 4] ?? 0);
  const footSecond = Math.min(topSecond, theirs[(d + 2) % 4] ?? 0);
  if (topFirst - footFirst <= 0 && topSecond - footSecond <= 0) return;

  const kind = kindAt(grid.kindAt(x, z));
  style.flags = 0;
  style.texture = kind.texture;
  style.ink = kind.wall;
  normal[0] = DIR_X[d] ?? 0;
  normal[1] = 0;
  normal[2] = DIR_Z[d] ?? 0;
  const x1 = x - pass.originX + (CORNER_X[first] ?? 0);
  const z1 = z - pass.originZ + (CORNER_Z[first] ?? 0);
  const x2 = x - pass.originX + (CORNER_X[second] ?? 0);
  const z2 = z - pass.originZ + (CORNER_Z[second] ?? 0);
  // Counter-clockwise seen from outside: the foot from second to first, then the top back.
  style.shade = WALL_FOOT_SHADE;
  writer.vertex(x2, footSecond, z2, normal, style);
  writer.vertex(x1, footFirst, z1, normal, style);
  style.shade = 255;
  writer.vertex(x1, topFirst, z1, normal, style);
  writer.vertex(x2, topSecond, z2, normal, style);
  writer.quad();
}

/**
 * The mesh for the `width` by `depth` tiles of `grid` starting at (x0, z0).
 * Positions are relative to (x0, z0), so a chunk is placed by one uniform.
 */
export function tessellate(
  grid: TileGrid,
  x0: number,
  z0: number,
  width: number,
  depth: number,
): ChunkMesh {
  const pass: Pass = {
    grid,
    writer: new MeshWriter(width * depth),
    originX: x0,
    originZ: z0,
    mine: new Float32Array(4),
    theirs: new Float32Array(4),
    style: { flags: 0, ink: 0, texture: 0, shade: 255 },
    normal: [0, 1, 0],
  };
  for (let z = z0; z < z0 + depth; z++) {
    for (let x = x0; x < x0 + width; x++) {
      if (!grid.contains(x, z)) continue;
      cornerHeights(grid, x, z, pass.mine);
      emitFloor(pass, x, z);
      for (let d = 0; d < 4; d++) emitWall(pass, x, z, d);
    }
  }
  return pass.writer.finish();
}
