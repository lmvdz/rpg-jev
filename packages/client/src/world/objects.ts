/**
 * The props placed on the map: at most one glyph to a tile, standing in the
 * middle of it on the ground the tessellator drew. This keeps the glyph
 * batch's slots and the tiles in step, so the editor can place, replace and
 * remove by tile and the renderer still gets one packed buffer.
 */
import type { GlyphBatch, GlyphLook } from "../glyph/batch.ts";
import type { TileGrid } from "../terrain/grid.ts";
import { groundHeight } from "../terrain/tessellate.ts";

export interface PlacedObject {
  x: number;
  z: number;
  look: GlyphLook;
}

function sameLook(a: GlyphLook, b: GlyphLook): boolean {
  return (
    a.glyph === b.glyph &&
    a.ink === b.ink &&
    (a.flags ?? 0) === (b.flags ?? 0) &&
    (a.scale ?? 16) === (b.scale ?? 16)
  );
}

export class ObjectLayer {
  readonly #grid: TileGrid;
  readonly #batch: GlyphBatch;
  readonly #looks = new Map<number, GlyphLook>();
  readonly #slotOfTile = new Map<number, number>();
  readonly #tileOfSlot = new Map<number, number>();

  constructor(grid: TileGrid, batch: GlyphBatch) {
    this.#grid = grid;
    this.#batch = batch;
  }

  get size(): number {
    return this.#looks.size;
  }

  /** Where in the glyph batch a tile's object is drawn, or -1. It moves when other objects go. */
  slotAt(index: number): number {
    return this.#slotOfTile.get(index) ?? -1;
  }

  at(index: number): GlyphLook | null {
    return this.#looks.get(index) ?? null;
  }

  /** Places, replaces or (with null) removes the object on a tile. Returns whether anything changed. */
  set(index: number, look: GlyphLook | null): boolean {
    const had = this.#looks.get(index);
    if (look === null) return had ? this.#remove(index) : false;
    if (had && sameLook(had, look)) return false;
    const kept = { ...look };
    this.#looks.set(index, kept);
    const slot = this.#slotOfTile.get(index);
    if (slot !== undefined) {
      this.#batch.setLook(slot, kept);
      return true;
    }
    const x = (index % this.#grid.width) + 0.5;
    const z = Math.floor(index / this.#grid.width) + 0.5;
    const added = this.#batch.add(x, groundHeight(this.#grid, x, z), z, kept);
    this.#slotOfTile.set(index, added);
    this.#tileOfSlot.set(added, index);
    return true;
  }

  #remove(index: number): boolean {
    const slot = this.#slotOfTile.get(index);
    if (slot === undefined) return false;
    const movedFrom = this.#batch.remove(slot);
    this.#looks.delete(index);
    this.#slotOfTile.delete(index);
    this.#tileOfSlot.delete(slot);
    if (movedFrom >= 0) {
      // The batch filled the gap with its last instance: follow it, if it is one of ours.
      const movedTile = this.#tileOfSlot.get(movedFrom);
      this.#tileOfSlot.delete(movedFrom);
      if (movedTile !== undefined) {
        this.#tileOfSlot.set(slot, movedTile);
        this.#slotOfTile.set(movedTile, slot);
      }
    }
    return true;
  }

  /** The ground moved under this tile: stand its object on it again. */
  reground(index: number): void {
    const slot = this.#slotOfTile.get(index);
    if (slot === undefined) return;
    const x = (index % this.#grid.width) + 0.5;
    const z = Math.floor(index / this.#grid.width) + 0.5;
    this.#batch.setHeight(slot, groundHeight(this.#grid, x, z));
  }

  /** Every object, in tile order, so a saved world does not depend on the order of edits. */
  list(): PlacedObject[] {
    return [...this.#looks.keys()]
      .sort((a, b) => a - b)
      .map((index) => ({
        x: index % this.#grid.width,
        z: Math.floor(index / this.#grid.width),
        look: { ...(this.#looks.get(index) as GlyphLook) },
      }));
  }
}
