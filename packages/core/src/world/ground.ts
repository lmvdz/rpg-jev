/**
 * Ground height, off the same corner heights the tessellator builds its mesh
 * from (`packages/client/src/terrain/tessellate.ts`), so what stands on the
 * ground and the ground agree. Kept pure and engine-agnostic here because the
 * stepping rule (`./steps.ts`) needs it and runs on the host as well as the
 * renderer.
 */
import { DIR_X, DIR_Z, LEVEL, SHAPE, type TileGrid } from "./grid.ts";
import { kindAt } from "./kinds.ts";

const HOLE_DROP = 12 * LEVEL;
const LIQUID_DROP = 0.3 * LEVEL;

/** Heights of a tile's four corners in world units, written into `out`. */
export function cornerHeights(grid: TileGrid, x: number, z: number, out: Float32Array): void {
  const base = grid.heightAt(x, z) * LEVEL;
  const shape = grid.shapeAt(x, z);
  if (shape === SHAPE.hole) {
    out.fill(base - HOLE_DROP);
    return;
  }
  out.fill(kindAt(grid.kindAt(x, z)).liquid ? base - LIQUID_DROP : base);
  if (shape === SHAPE.flat) return;
  const d = shape - SHAPE.slantN;
  const high = Math.max(base, grid.heightAt(x + (DIR_X[d] ?? 0), z + (DIR_Z[d] ?? 0)) * LEVEL);
  out[d] = high;
  out[(d + 1) % 4] = high;
}

const groundScratch = new Float32Array(4);

/**
 * Height of the walkable surface at a point, from the same corner heights
 * the mesh is built from, so what stands on the ground and the ground agree.
 */
export function groundHeight(grid: TileGrid, x: number, z: number): number {
  const tx = Math.floor(x);
  const tz = Math.floor(z);
  cornerHeights(grid, tx, tz, groundScratch);
  const fx = x - tx;
  const fz = z - tz;
  const north = (groundScratch[0] ?? 0) * (1 - fx) + (groundScratch[1] ?? 0) * fx;
  const south = (groundScratch[3] ?? 0) * (1 - fx) + (groundScratch[2] ?? 0) * fx;
  return north * (1 - fz) + south * fz;
}
