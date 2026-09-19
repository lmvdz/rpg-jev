/**
 * Whether a body can step from one tile to a neighbour. One rule, used by the
 * keys, by a clicked path and by the path finder, so they can never disagree.
 *
 * It is the client's stand-in for the world's move process (spikes/vocabulary,
 * X1), which will decide this from mass, footing and slope. For now: the
 * ground must be there, dry and not too tall a step, nothing solid may stand
 * on it, and a diagonal step may not cut across a corner it could not walk.
 */
import { LEVEL, SHAPE, type TileGrid } from "../terrain/grid.ts";
import { kindAt } from "../terrain/kinds.ts";
import { groundHeight } from "../terrain/tessellate.ts";

/** Says whether something solid stands on a tile. */
export type Blocked = (tileIndex: number) => boolean;
export const NOTHING_BLOCKS: Blocked = () => false;

/** The tallest step taken without a ramp. */
const MAX_STEP = LEVEL + 0.01;

/** The eight neighbours, orthogonal first. */
export const NEIGHBOURS: readonly (readonly [number, number])[] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
  [1, -1],
  [1, 1],
  [-1, 1],
  [-1, -1],
];

export function standable(grid: TileGrid, blocked: Blocked, x: number, z: number): boolean {
  if (!grid.contains(x, z) || grid.shapeAt(x, z) === SHAPE.hole) return false;
  return !(kindAt(grid.kindAt(x, z)).liquid || blocked(grid.index(x, z)));
}

function climbable(grid: TileGrid, fx: number, fz: number, tx: number, tz: number): boolean {
  const here = groundHeight(grid, fx + 0.5, fz + 0.5);
  const there = groundHeight(grid, tx + 0.5, tz + 0.5);
  return Math.abs(there - here) <= MAX_STEP;
}

function open(g: TileGrid, b: Blocked, fx: number, fz: number, tx: number, tz: number): boolean {
  return standable(g, b, tx, tz) && climbable(g, fx, fz, tx, tz);
}

export function canStep(
  grid: TileGrid,
  blocked: Blocked,
  fx: number,
  fz: number,
  tx: number,
  tz: number,
): boolean {
  if (!open(grid, blocked, fx, fz, tx, tz)) return false;
  if (fx === tx || fz === tz) return true;
  return open(grid, blocked, fx, fz, tx, fz) && open(grid, blocked, fx, fz, fx, tz);
}
