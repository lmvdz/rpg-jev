/**
 * The hero on the map: steps from tile to tile in eight directions, glides
 * between them, stands on the ground the tessellator drew, and can be sent
 * along a path. The game's own movement will come from world state; this is
 * the client's stand-in, and the stepping rule it obeys is in `steps.ts`.
 */
import type { TileGrid } from "../terrain/grid.ts";
import { groundHeight } from "../terrain/tessellate.ts";
import { type Blocked, canStep, NOTHING_BLOCKS } from "./steps.ts";

/**
 * Keys as (forward, right) relative to the camera. Two held together add up,
 * so up and left is a diagonal; the numpad and its neighbours give all eight.
 */
const MOVES: Readonly<Record<string, readonly [number, number]>> = {
  arrowup: [1, 0],
  w: [1, 0],
  "8": [1, 0],
  arrowdown: [-1, 0],
  s: [-1, 0],
  "2": [-1, 0],
  arrowright: [0, 1],
  d: [0, 1],
  "6": [0, 1],
  arrowleft: [0, -1],
  a: [0, -1],
  "4": [0, -1],
  home: [1, -1],
  "7": [1, -1],
  pageup: [1, 1],
  "9": [1, 1],
  end: [-1, -1],
  "1": [-1, -1],
  pagedown: [-1, 1],
  "3": [-1, 1],
};

const TILES_PER_SECOND = 9;
const clampStep = (n: number) => Math.min(Math.max(Math.round(n), -1), 1);

export class Walker {
  x: number;
  y: number;
  z: number;
  tileX: number;
  tileZ: number;
  readonly #grid: TileGrid;
  readonly #blocked: Blocked;
  readonly #held = new Set<string>();
  #path: number[] = [];

  constructor(grid: TileGrid, tileX: number, tileZ: number, blocked: Blocked = NOTHING_BLOCKS) {
    this.#grid = grid;
    this.#blocked = blocked;
    this.tileX = tileX;
    this.tileZ = tileZ;
    this.x = tileX + 0.5;
    this.z = tileZ + 0.5;
    this.y = groundHeight(grid, this.x, this.z);
  }

  get tile(): number {
    return this.#grid.index(this.tileX, this.tileZ);
  }

  /** The tiles still to walk of a path it was sent along. */
  get path(): readonly number[] {
    return this.#path;
  }

  /** Puts the hero on a tile at once. */
  jumpToTile(tileX: number, tileZ: number): void {
    this.tileX = tileX;
    this.tileZ = tileZ;
    this.x = tileX + 0.5;
    this.z = tileZ + 0.5;
    this.y = groundHeight(this.#grid, this.x, this.z);
    this.#held.clear();
    this.#path = [];
  }

  /** True when the key is a movement key. A key takes over from any path being walked. */
  press(key: string, yaw: number): boolean {
    if (!(key in MOVES)) return false;
    this.#held.add(key);
    this.#path = [];
    if (this.#arrived()) this.#stepByKeys(yaw);
    return true;
  }

  release(key: string): void {
    this.#held.delete(key);
  }

  releaseAll(): void {
    this.#held.clear();
  }

  /** Sends the hero along a path, as `findPath` gives it. */
  follow(path: readonly number[]): void {
    this.#path = [...path];
  }

  canEnter(tileX: number, tileZ: number): boolean {
    return canStep(this.#grid, this.#blocked, this.tileX, this.tileZ, tileX, tileZ);
  }

  update(dt: number, yaw: number): void {
    const goalX = this.tileX + 0.5;
    const goalZ = this.tileZ + 0.5;
    const gap = Math.hypot(goalX - this.x, goalZ - this.z);
    const reach = TILES_PER_SECOND * dt;
    if (gap <= Math.max(reach, 0)) {
      this.x = goalX;
      this.z = goalZ;
      if (this.#path.length > 0) this.#stepAlongPath();
      else if (this.#held.size > 0) this.#stepByKeys(yaw);
    } else {
      this.x += ((goalX - this.x) / gap) * reach;
      this.z += ((goalZ - this.z) / gap) * reach;
    }
    const ground = groundHeight(this.#grid, this.x, this.z);
    this.y += (ground - this.y) * Math.min(dt * 25, 1);
  }

  #arrived(): boolean {
    return this.x === this.tileX + 0.5 && this.z === this.tileZ + 0.5;
  }

  /** The world may have changed since the path was found, so each step is checked as it is taken. */
  #stepAlongPath(): void {
    const next = this.#path.shift();
    if (next === undefined) return;
    const x = next % this.#grid.width;
    const z = Math.floor(next / this.#grid.width);
    const adjacent = Math.max(Math.abs(x - this.tileX), Math.abs(z - this.tileZ)) === 1;
    if (adjacent && this.canEnter(x, z)) {
      this.tileX = x;
      this.tileZ = z;
    } else {
      this.#path = [];
    }
  }

  #stepByKeys(yaw: number): void {
    let forward = 0;
    let right = 0;
    for (const key of this.#held) {
      forward += MOVES[key]?.[0] ?? 0;
      right += MOVES[key]?.[1] ?? 0;
    }
    forward = clampStep(forward);
    right = clampStep(right);
    // The camera looks along (-sin yaw, -cos yaw); its right is (cos yaw, -sin yaw).
    const dx = clampStep(-Math.sin(yaw) * forward + Math.cos(yaw) * right);
    const dz = clampStep(-Math.cos(yaw) * forward - Math.sin(yaw) * right);
    // A diagonal that is blocked slides along whichever side is open.
    const tries: readonly (readonly [number, number])[] = [
      [dx, dz],
      [dx, 0],
      [0, dz],
    ];
    for (const [stepX, stepZ] of tries) {
      if (stepX === 0 && stepZ === 0) continue;
      if (!this.canEnter(this.tileX + stepX, this.tileZ + stepZ)) continue;
      this.tileX += stepX;
      this.tileZ += stepZ;
      return;
    }
  }
}
