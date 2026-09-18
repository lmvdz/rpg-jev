/**
 * The point the camera follows while editing: it glides over the map under
 * the arrow keys, relative to the way the camera faces, faster the further
 * out the camera is, and rides on the ground so the view keeps its distance.
 */
import type { TileGrid } from "../terrain/grid.ts";
import { groundHeight } from "../terrain/tessellate.ts";

/** Keys as (forward, right). */
const PANS: Readonly<Record<string, readonly [number, number]>> = {
  arrowup: [1, 0],
  w: [1, 0],
  arrowdown: [-1, 0],
  s: [-1, 0],
  arrowright: [0, 1],
  d: [0, 1],
  arrowleft: [0, -1],
  a: [0, -1],
};

export class Rover {
  x: number;
  y: number;
  z: number;
  readonly #grid: TileGrid;
  readonly #held = new Set<string>();

  constructor(grid: TileGrid, x: number, z: number) {
    this.#grid = grid;
    this.x = x;
    this.z = z;
    this.y = groundHeight(grid, x, z);
  }

  /** True when the key is one of the rover's. */
  press(key: string): boolean {
    if (!(key in PANS)) return false;
    this.#held.add(key);
    return true;
  }

  release(key: string): void {
    this.#held.delete(key);
  }

  releaseAll(): void {
    this.#held.clear();
  }

  jumpTo(x: number, z: number): void {
    this.x = x;
    this.z = z;
    this.y = groundHeight(this.#grid, x, z);
  }

  update(dt: number, yaw: number, cameraDistance: number): void {
    let forward = 0;
    let right = 0;
    for (const key of this.#held) {
      forward += PANS[key]?.[0] ?? 0;
      right += PANS[key]?.[1] ?? 0;
    }
    if (forward === 0 && right === 0) return;
    const reach = (cameraDistance * 0.9 * Math.max(dt, 0)) / Math.hypot(forward, right);
    // The camera looks along (-sin yaw, -cos yaw); its right is (cos yaw, -sin yaw).
    const x = this.x + (-Math.sin(yaw) * forward + Math.cos(yaw) * right) * reach;
    const z = this.z + (-Math.cos(yaw) * forward - Math.sin(yaw) * right) * reach;
    this.jumpTo(
      Math.min(Math.max(x, 0), this.#grid.width - 0.001),
      Math.min(Math.max(z, 0), this.#grid.depth - 0.001),
    );
  }
}
