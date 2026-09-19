/**
 * Which tile is under the mouse: a ray from the camera walked across the
 * grid a tile at a time, stopping at the first tile whose top it has dropped
 * below. That is a hit on the tile's floor or on one of its walls, and a
 * wall belongs to the tile that stands behind it, which is the one you mean.
 *
 * It reads the same corner heights as the mesh, so what you point at is what
 * is drawn. Pure, and quick enough to run on every mouse move.
 */
import { mat4, vec3 } from "gl-matrix";
import type { TileGrid } from "../terrain/grid.ts";
import { cornerHeights } from "../terrain/tessellate.ts";

const inverse = mat4.create();
const near = vec3.create();
const far = vec3.create();
const corners = new Float32Array(4);
const span: [number, number] = [0, 1];
const edgesX: [number, number] = [0, 0];
const edgesZ: [number, number] = [0, 0];

function tileTop(grid: TileGrid, x: number, z: number): number {
  cornerHeights(grid, x, z, corners);
  return Math.max(corners[0] ?? 0, corners[1] ?? 0, corners[2] ?? 0, corners[3] ?? 0);
}

/** The part [from, to] of the ray's 0..1 span that lies over 0..size on one axis, or null. */
function clipAxis(origin: number, step: number, size: number, span: [number, number]): boolean {
  if (Math.abs(step) < 1e-9) return origin >= 0 && origin < size;
  const a = (0 - origin) / step;
  const b = (size - origin) / step;
  span[0] = Math.max(span[0], Math.min(a, b));
  span[1] = Math.min(span[1], Math.max(a, b));
  return span[0] < span[1];
}

/** How far along the ray the next tile edge on one axis is, and how far apart edges are. */
function edgeSteps(at: number, tile: number, step: number, t: number, out: [number, number]): void {
  if (Math.abs(step) < 1e-9) {
    out[0] = out[1] = Number.POSITIVE_INFINITY;
    return;
  }
  const edge = step > 0 ? tile + 1 : tile;
  out[0] = t + (edge - at) / step;
  out[1] = Math.abs(1 / step);
}

/**
 * The index of the tile under a point of the view, or -1 for none.
 * `ndcX` and `ndcY` run from -1 to 1, left to right and bottom to top.
 */
export function pickTile(grid: TileGrid, viewProjection: mat4, ndcX: number, ndcY: number): number {
  return walkRay(grid, viewProjection, ndcX, ndcY, null);
}

/**
 * As `pickTile`, telling `visit` of every tile the ray passes over on its way,
 * the one it lands on included: what stands on those may be in front of it.
 */
export function walkRay(
  grid: TileGrid,
  viewProjection: mat4,
  ndcX: number,
  ndcY: number,
  visit: ((x: number, z: number) => void) | null,
): number {
  if (!mat4.invert(inverse, viewProjection)) return -1;
  vec3.transformMat4(near, vec3.set(near, ndcX, ndcY, -1), inverse);
  vec3.transformMat4(far, vec3.set(far, ndcX, ndcY, 1), inverse);
  const dx = far[0] - near[0];
  const dy = far[1] - near[1];
  const dz = far[2] - near[2];

  span[0] = 0;
  span[1] = 1;
  if (!clipAxis(near[0], dx, grid.width, span)) return -1;
  if (!clipAxis(near[2], dz, grid.depth, span)) return -1;

  let t = span[0] + 1e-7;
  let x = Math.min(Math.max(Math.floor(near[0] + dx * t), 0), grid.width - 1);
  let z = Math.min(Math.max(Math.floor(near[2] + dz * t), 0), grid.depth - 1);
  edgeSteps(near[0] + dx * t, x, dx, t, edgesX);
  edgeSteps(near[2] + dz * t, z, dz, t, edgesZ);
  let nextX = edgesX[0];
  let nextZ = edgesZ[0];
  const everyX = edgesX[1];
  const everyZ = edgesZ[1];

  for (let steps = grid.width + grid.depth + 2; steps > 0 && grid.contains(x, z); steps--) {
    visit?.(x, z);
    const leave = Math.min(nextX, nextZ, span[1]);
    const lowest = Math.min(near[1] + dy * t, near[1] + dy * leave);
    if (lowest <= tileTop(grid, x, z)) return grid.index(x, z);
    if (leave >= span[1]) return -1;
    t = leave;
    if (nextX < nextZ) {
      x += dx > 0 ? 1 : -1;
      nextX += everyX;
    } else {
      z += dz > 0 ? 1 : -1;
      nextZ += everyZ;
    }
  }
  return -1;
}
