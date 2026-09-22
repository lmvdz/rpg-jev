/**
 * The terrain the tessellator reads: a grid of tiles with heights and flags
 * (SPEC.md section 19). x runs east, z runs south, y is up. Tile (x, z)
 * covers the unit square from (x, z) to (x + 1, z + 1).
 */

/** World units per height level. */
export const LEVEL = 0.5;
/** The range of heights a tile may be given, in levels. */
export const MIN_HEIGHT = -32;
export const MAX_HEIGHT = 96;

export const SHAPE = {
  flat: 0,
  /** A slant rises from the tile's own height to its neighbour's on that side. */
  slantN: 1,
  slantE: 2,
  slantS: 3,
  slantW: 4,
  hole: 5,
} as const;

export type Shape = (typeof SHAPE)[keyof typeof SHAPE];

/** `inks` entry meaning "use the kind's own colour". */
export const NO_INK = 255;

/** Direction order used everywhere: N, E, S, W. */
export const DIR_X = [0, 1, 0, -1] as const;
export const DIR_Z = [-1, 0, 1, 0] as const;

export class TileGrid {
  readonly width: number;
  readonly depth: number;
  /** Height in levels. */
  readonly heights: Int16Array;
  /** Index into `TILE_KINDS`. */
  readonly kinds: Uint8Array;
  readonly shapes: Uint8Array;
  /** Flooded colour: a palette index that overrides the kind's floor, or `NO_INK`. */
  readonly inks: Uint8Array;
  /** The level everything outside the grid is taken to have. */
  floorLevel = -8;

  constructor(width: number, depth: number, arrays?: TileArrays) {
    if (width <= 0 || depth <= 0) throw new Error("a grid needs a positive size");
    this.width = width;
    this.depth = depth;
    const count = width * depth;
    this.heights = arrays?.heights ?? new Int16Array(count);
    this.kinds = arrays?.kinds ?? new Uint8Array(count);
    this.shapes = arrays?.shapes ?? new Uint8Array(count);
    this.inks = arrays?.inks ?? new Uint8Array(count).fill(NO_INK);
    if (this.heights.length !== count || this.kinds.length !== count) {
      throw new Error("tile arrays do not match the grid's size");
    }
  }

  contains(x: number, z: number): boolean {
    return x >= 0 && z >= 0 && x < this.width && z < this.depth;
  }

  index(x: number, z: number): number {
    return z * this.width + x;
  }

  heightAt(x: number, z: number): number {
    return this.contains(x, z) ? (this.heights[this.index(x, z)] ?? 0) : this.floorLevel;
  }

  shapeAt(x: number, z: number): number {
    return this.contains(x, z) ? (this.shapes[this.index(x, z)] ?? 0) : SHAPE.flat;
  }

  kindAt(x: number, z: number): number {
    return this.contains(x, z) ? (this.kinds[this.index(x, z)] ?? 0) : 0;
  }

  inkAt(x: number, z: number): number {
    return this.contains(x, z) ? (this.inks[this.index(x, z)] ?? NO_INK) : NO_INK;
  }

  set(x: number, z: number, tile: Partial<Tile>): void {
    if (!this.contains(x, z)) return;
    const i = this.index(x, z);
    if (tile.height !== undefined) this.heights[i] = tile.height;
    if (tile.kind !== undefined) this.kinds[i] = tile.kind;
    if (tile.shape !== undefined) this.shapes[i] = tile.shape;
    if (tile.ink !== undefined) this.inks[i] = tile.ink;
  }

  /**
   * A copy of the square at (x0, z0) with `border` extra tiles on every side,
   * which is all a chunk's tessellation reads. Tiles outside this grid come
   * out flat at `floorLevel`, exactly as the accessors above report them.
   */
  region(x0: number, z0: number, size: number, border: number): TileGrid {
    const span = size + border * 2;
    const out = new TileGrid(span, span);
    out.floorLevel = this.floorLevel;
    for (let z = 0; z < span; z++) {
      for (let x = 0; x < span; x++) {
        const sx = x0 - border + x;
        const sz = z0 - border + z;
        out.set(x, z, {
          height: this.heightAt(sx, sz),
          kind: this.kindAt(sx, sz),
          shape: this.shapeAt(sx, sz) as Shape,
          ink: this.inkAt(sx, sz),
        });
      }
    }
    return out;
  }
}

/** A grid's storage, as it crosses to the tessellation worker. */
export interface TileArrays {
  heights: Int16Array;
  kinds: Uint8Array;
  shapes: Uint8Array;
  inks: Uint8Array;
}

export interface Tile {
  height: number;
  kind: number;
  shape: Shape;
  ink: number;
}
