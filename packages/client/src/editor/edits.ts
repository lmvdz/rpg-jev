/**
 * An edit is data: for each tile and each object it touched, what was there
 * before and what is there after. Doing, undoing and redoing are then the
 * same walk in two directions, and no tool needs to know how to reverse itself.
 */
import type { GlyphLook } from "../glyph/batch.ts";
import { DIR_X, DIR_Z, type Tile, type TileGrid } from "../terrain/grid.ts";
import type { ObjectLayer } from "../world/objects.ts";

export interface World {
  grid: TileGrid;
  objects: ObjectLayer;
}

export interface TileChange {
  index: number;
  before: Tile;
  after: Tile;
}

export interface ObjectChange {
  index: number;
  before: GlyphLook | null;
  after: GlyphLook | null;
}

export interface Edit {
  tiles: TileChange[];
  objects: ObjectChange[];
}

export function tileAt(grid: TileGrid, index: number): Tile {
  const x = index % grid.width;
  const z = Math.floor(index / grid.width);
  return {
    height: grid.heightAt(x, z),
    kind: grid.kindAt(x, z),
    shape: grid.shapeAt(x, z) as Tile["shape"],
    ink: grid.inkAt(x, z),
  };
}

function sameTile(a: Tile, b: Tile): boolean {
  return a.height === b.height && a.kind === b.kind && a.shape === b.shape && a.ink === b.ink;
}

/**
 * One stroke of a tool, applied to the world as it is made so the hand sees
 * what it is doing. A tile touched twice in a stroke keeps its first "before".
 */
export class EditBuilder {
  readonly #world: World;
  readonly #tiles = new Map<number, TileChange>();
  readonly #objects = new Map<number, ObjectChange>();
  #fresh: number[] = [];

  constructor(world: World) {
    this.#world = world;
  }

  touched(index: number): boolean {
    return this.#tiles.has(index) || this.#objects.has(index);
  }

  setTile(index: number, change: Partial<Tile>): void {
    const grid = this.#world.grid;
    const now = tileAt(grid, index);
    const after = { ...now, ...change };
    if (sameTile(now, after)) return;
    const known = this.#tiles.get(index);
    if (known) known.after = after;
    else this.#tiles.set(index, { index, before: now, after });
    this.#fresh.push(index);
    grid.set(index % grid.width, Math.floor(index / grid.width), after);
  }

  setObject(index: number, look: GlyphLook | null): void {
    const before = this.#world.objects.at(index);
    if (!this.#world.objects.set(index, look)) return;
    const known = this.#objects.get(index);
    if (known) known.after = look;
    else this.#objects.set(index, { index, before, after: look });
  }

  /** The tiles changed since this was last asked, for settling while the stroke is still going. */
  drain(): number[] {
    const fresh = this.#fresh;
    this.#fresh = [];
    return fresh;
  }

  /** Everything the stroke changed. */
  finish(): Edit {
    return { tiles: [...this.#tiles.values()], objects: [...this.#objects.values()] };
  }
}

export function isEmpty(edit: Edit): boolean {
  return edit.tiles.length === 0 && edit.objects.length === 0;
}

/** Applies an edit forwards or backwards. */
export function applyEdit(world: World, edit: Edit, direction: "after" | "before"): void {
  const { grid, objects } = world;
  for (const change of edit.tiles) {
    grid.set(change.index % grid.width, Math.floor(change.index / grid.width), change[direction]);
  }
  for (const change of edit.objects) objects.set(change.index, change[direction]);
}

/**
 * The tiles a change disturbed: the changed tiles and their four neighbours,
 * whose walls and slants read them. Objects on all of these are stood on the
 * ground again; the caller marks them dirty for re-meshing.
 */
export function settle(world: World, changed: readonly number[]): number[] {
  const { grid, objects } = world;
  const disturbed = new Set<number>();
  for (const index of changed) {
    const x = index % grid.width;
    const z = Math.floor(index / grid.width);
    disturbed.add(index);
    for (let d = 0; d < 4; d++) {
      const nx = x + (DIR_X[d] ?? 0);
      const nz = z + (DIR_Z[d] ?? 0);
      if (grid.contains(nx, nz)) disturbed.add(grid.index(nx, nz));
    }
  }
  for (const index of disturbed) objects.reground(index);
  return [...disturbed];
}

export class History {
  readonly #done: Edit[] = [];
  readonly #undone: Edit[] = [];
  readonly #limit: number;

  constructor(limit = 200) {
    this.#limit = limit;
  }

  push(edit: Edit): void {
    if (isEmpty(edit)) return;
    this.#done.push(edit);
    if (this.#done.length > this.#limit) this.#done.shift();
    this.#undone.length = 0;
  }

  /** Takes back the last edit and returns it, for settling. */
  undo(world: World): Edit | null {
    const edit = this.#done.pop();
    if (!edit) return null;
    applyEdit(world, edit, "before");
    this.#undone.push(edit);
    return edit;
  }

  redo(world: World): Edit | null {
    const edit = this.#undone.pop();
    if (!edit) return null;
    applyEdit(world, edit, "after");
    this.#done.push(edit);
    return edit;
  }
}
