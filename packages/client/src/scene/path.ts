/**
 * The way from one tile to another: A* over the eight neighbours, by the one
 * stepping rule in `steps.ts`, with a diagonal costing the square root of two.
 * When the goal itself cannot be stood on (a tree, water, a wall), the way
 * ends on the nearest tile beside it, which is what clicking on a thing means.
 */
import type { TileGrid } from "../terrain/grid.ts";
import { type Blocked, canStep, NEIGHBOURS, standable } from "./steps.ts";

const DIAGONAL = Math.SQRT2;

/** A binary heap of tile indices, smallest score first. */
class Frontier {
  readonly #tiles: number[] = [];
  readonly #scores: Float32Array;

  constructor(scores: Float32Array) {
    this.#scores = scores;
  }

  get size(): number {
    return this.#tiles.length;
  }

  #score(at: number): number {
    return this.#scores[this.#tiles[at] ?? 0] ?? 0;
  }

  #swap(a: number, b: number): void {
    const held = this.#tiles[a] ?? 0;
    this.#tiles[a] = this.#tiles[b] ?? 0;
    this.#tiles[b] = held;
  }

  push(tile: number): void {
    let at = this.#tiles.push(tile) - 1;
    while (at > 0) {
      const parent = (at - 1) >> 1;
      if (this.#score(parent) <= this.#score(at)) break;
      this.#swap(at, parent);
      at = parent;
    }
  }

  pop(): number {
    const top = this.#tiles[0] ?? -1;
    const last = this.#tiles.pop();
    if (this.#tiles.length > 0 && last !== undefined) {
      this.#tiles[0] = last;
      let at = 0;
      for (;;) {
        const left = at * 2 + 1;
        let least = at;
        if (left < this.#tiles.length && this.#score(left) < this.#score(least)) least = left;
        if (left + 1 < this.#tiles.length && this.#score(left + 1) < this.#score(least)) {
          least = left + 1;
        }
        if (least === at) break;
        this.#swap(at, least);
        at = least;
      }
    }
    return top;
  }
}

function octile(grid: TileGrid, a: number, b: number): number {
  const dx = Math.abs((a % grid.width) - (b % grid.width));
  const dz = Math.abs(Math.floor(a / grid.width) - Math.floor(b / grid.width));
  return Math.max(dx, dz) + (DIAGONAL - 1) * Math.min(dx, dz);
}

/**
 * The tiles to walk through, ending at `to` or beside it, not including
 * `from`. Null when there is no way, or none within `maxVisited` tiles.
 */
export function findPath(
  grid: TileGrid,
  blocked: Blocked,
  from: number,
  to: number,
  maxVisited = 40_000,
  cardinal = false,
): number[] | null {
  if (from === to || to < 0) return null;
  const beside = !standable(grid, blocked, to % grid.width, Math.floor(to / grid.width));
  // Already standing beside the thing that was clicked: there is nowhere to go.
  if (beside && octile(grid, from, to) < 1.5) return [];
  const count = grid.width * grid.depth;
  const score = new Float32Array(count);
  const search: Search = {
    grid,
    blocked,
    to,
    cost: new Float32Array(count).fill(Number.POSITIVE_INFINITY),
    score,
    cameFrom: new Int32Array(count).fill(-1),
    done: new Uint8Array(count),
    frontier: new Frontier(score),
    cardinal,
  };
  search.cost[from] = 0;
  search.frontier.push(from);

  for (let visited = 0; search.frontier.size > 0 && visited < maxVisited; visited++) {
    const tile = search.frontier.pop();
    if (search.done[tile]) continue;
    search.done[tile] = 1;
    if (tile === to || (beside && octile(grid, tile, to) < 1.5)) {
      const path: number[] = [];
      for (let at = tile; at !== from && at >= 0; at = search.cameFrom[at] ?? -1) path.push(at);
      return path.reverse();
    }
    expand(search, tile);
  }
  return null;
}

interface Search {
  grid: TileGrid;
  blocked: Blocked;
  to: number;
  cost: Float32Array;
  score: Float32Array;
  cameFrom: Int32Array;
  done: Uint8Array;
  frontier: Frontier;
  cardinal: boolean;
}

/** Offers each neighbour a tile can step to, where this way to it is the cheapest yet. */
function expand(search: Search, tile: number): void {
  const { grid, cost } = search;
  const x = tile % grid.width;
  const z = Math.floor(tile / grid.width);
  for (const [dx, dz] of NEIGHBOURS) {
    if (search.cardinal && dx !== 0 && dz !== 0) continue;
    if (!canStep(grid, search.blocked, x, z, x + dx, z + dz)) continue;
    const next = grid.index(x + dx, z + dz);
    const reached = (cost[tile] ?? 0) + (dx !== 0 && dz !== 0 ? DIAGONAL : 1);
    if (search.done[next] || reached >= (cost[next] ?? 0)) continue;
    cost[next] = reached;
    search.cameFrom[next] = tile;
    search.score[next] = reached + octile(grid, next, search.to);
    search.frontier.push(next);
  }
}
