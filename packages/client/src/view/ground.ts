/**
 * How the ground looks apart from what it is: wet, scorched, snowed on. These
 * are states of a place (spikes/vocabulary section 4), they change far more
 * often than the land's shape does, and a tile's colour is baked into its
 * chunk's mesh. So they are kept out of the mesh: one texel per tile, read by
 * the terrain shader, and a change costs a texel and never a re-mesh.
 *
 * A texel is four levels: how wet, the palette colour of what it is wet with
 * (oil-wet and water-wet are different states, and look it), how scorched,
 * how deep in snow. What each does to the ground's colour is a rule in the
 * shader, one per state and never per kind of ground.
 */
import { PALETTE_SIZE } from "../palette.ts";

export interface GroundState {
  /** 0 dry to 5 soaked. */
  wet: number;
  /** Palette colour of what it is wet with. Means nothing while `wet` is 0. */
  wetInk: number;
  /** 0 to 5. */
  scorched: number;
  /** 0 to 5. */
  snow: number;
}

export const GROUND_CHANNELS = 4;
const level = (n: number) => Math.min(Math.max(Math.round(n), 0), 5);

export class GroundStates {
  readonly width: number;
  readonly depth: number;
  /** Row by row, four bytes a tile: wet, wetInk, scorched, snow. Uploaded as it is. */
  readonly data: Uint8Array;
  /** The rows changed since the last `clean`, first and last; `dirtyTo` below `dirtyFrom` means none. */
  dirtyFrom = 0;
  dirtyTo = -1;

  constructor(width: number, depth: number) {
    this.width = width;
    this.depth = depth;
    this.data = new Uint8Array(width * depth * GROUND_CHANNELS);
  }

  /** Changes what is given and leaves the rest. Off the map, and values out of range, are brought in or ignored. */
  set(x: number, z: number, change: Partial<GroundState>): void {
    if (!(x >= 0 && z >= 0 && x < this.width && z < this.depth)) return;
    const at = (Math.floor(z) * this.width + Math.floor(x)) * GROUND_CHANNELS;
    const { wet, wetInk, scorched, snow } = change;
    let changed = false;
    if (wet !== undefined) changed = this.#put(at, level(wet)) || changed;
    if (wetInk !== undefined) {
      const ink = Math.min(Math.max(Math.round(wetInk), 0), PALETTE_SIZE - 1);
      changed = this.#put(at + 1, ink) || changed;
    }
    if (scorched !== undefined) changed = this.#put(at + 2, level(scorched)) || changed;
    if (snow !== undefined) changed = this.#put(at + 3, level(snow)) || changed;
    if (!changed) return;
    const row = Math.floor(z);
    if (this.dirtyTo < this.dirtyFrom) {
      this.dirtyFrom = row;
      this.dirtyTo = row;
    } else {
      this.dirtyFrom = Math.min(this.dirtyFrom, row);
      this.dirtyTo = Math.max(this.dirtyTo, row);
    }
  }

  #put(at: number, value: number): boolean {
    if (this.data[at] === value) return false;
    this.data[at] = value;
    return true;
  }

  at(x: number, z: number): GroundState {
    const at = (z * this.width + x) * GROUND_CHANNELS;
    return {
      wet: this.data[at] ?? 0,
      wetInk: this.data[at + 1] ?? 0,
      scorched: this.data[at + 2] ?? 0,
      snow: this.data[at + 3] ?? 0,
    };
  }

  markAllDirty(): void {
    this.dirtyFrom = 0;
    this.dirtyTo = this.depth - 1;
  }

  clean(): void {
    this.dirtyFrom = 0;
    this.dirtyTo = -1;
  }
}
