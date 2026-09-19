/**
 * The editor's tools (SPEC.md section 16, step R4), as a table. A tool says
 * what to do to one tile; where it is applied (a brush, a dragged rectangle,
 * a flooded region) is decided elsewhere, so every tool works with every one
 * of those. The right mouse button asks for a tool's opposite: lower, clear,
 * erase, or pick up what is there.
 */
import type { GlyphLook } from "../glyph/batch.ts";
import {
  DIR_X,
  DIR_Z,
  MAX_HEIGHT,
  MIN_HEIGHT,
  NO_INK,
  SHAPE,
  type Shape,
  type TileGrid,
} from "../terrain/grid.ts";
import { type EditBuilder, tileAt, type World } from "./edits.ts";

/** What the hand currently holds. Picking up with the right button writes here. */
export interface Brush {
  kind: number;
  shape: Shape;
  ink: number;
  look: GlyphLook;
  /** Side of the square brush, in tiles. */
  size: number;
}

export interface Stroke {
  world: World;
  edit: EditBuilder;
  brush: Brush;
  /** The right button: do the tool's opposite. */
  invert: boolean;
  /** Height of the first tile of the stroke, which `level` spreads. */
  anchorHeight: number;
}

export interface Tool {
  readonly name: string;
  readonly key: string;
  readonly hint: string;
  /** A flooding tool is applied to the whole connected region under the click. */
  readonly floods: boolean;
  apply(stroke: Stroke, index: number): void;
}

function clampHeight(height: number): number {
  return Math.min(Math.max(height, MIN_HEIGHT), MAX_HEIGHT);
}

function colour(stroke: Stroke, index: number): void {
  stroke.edit.setTile(index, { ink: stroke.invert ? NO_INK : stroke.brush.ink });
}

export const TOOLS: readonly Tool[] = [
  {
    name: "raise",
    key: "1",
    hint: "left raises a level, right lowers; once per tile per stroke",
    floods: false,
    apply(stroke, index) {
      if (stroke.edit.touched(index)) return;
      const height = tileAt(stroke.world.grid, index).height + (stroke.invert ? -1 : 1);
      stroke.edit.setTile(index, { height: clampHeight(height) });
    },
  },
  {
    name: "level",
    key: "2",
    hint: "spreads the height of the tile the stroke began on",
    floods: false,
    apply(stroke, index) {
      stroke.edit.setTile(index, { height: stroke.anchorHeight });
    },
  },
  {
    name: "kind",
    key: "3",
    hint: "left paints the chosen kind, right picks up the kind under the mouse",
    floods: false,
    apply(stroke, index) {
      if (stroke.invert) stroke.brush.kind = tileAt(stroke.world.grid, index).kind;
      else stroke.edit.setTile(index, { kind: stroke.brush.kind });
    },
  },
  {
    name: "shape",
    key: "4",
    hint: "left sets flat, a slant or a hole; right makes flat",
    floods: false,
    apply(stroke, index) {
      stroke.edit.setTile(index, { shape: stroke.invert ? SHAPE.flat : stroke.brush.shape });
    },
  },
  {
    name: "object",
    key: "5",
    hint: "left places the chosen glyph, right removes what stands there",
    floods: false,
    apply(stroke, index) {
      stroke.edit.setObject(index, stroke.invert ? null : stroke.brush.look);
    },
  },
  {
    name: "colour",
    key: "6",
    hint: "left paints the chosen colour over the kind's own, right gives the kind's back",
    floods: false,
    apply: colour,
  },
  {
    name: "flood",
    key: "7",
    hint: "colours the whole patch under the mouse, stopping where kind or colour changes",
    floods: true,
    apply: colour,
  },
];

/** The tiles of a square brush centred on a tile (an even brush leans south-east). */
export function brushTiles(grid: TileGrid, index: number, size: number): number[] {
  const cx = index % grid.width;
  const cz = Math.floor(index / grid.width);
  const from = -Math.floor((size - 1) / 2);
  const out: number[] = [];
  for (let dz = from; dz < from + size; dz++) {
    for (let dx = from; dx < from + size; dx++) {
      if (grid.contains(cx + dx, cz + dz)) out.push(grid.index(cx + dx, cz + dz));
    }
  }
  return out;
}

/** The tiles of the rectangle between two tiles, inclusive. */
export function rectTiles(grid: TileGrid, a: number, b: number): number[] {
  const ax = a % grid.width;
  const az = Math.floor(a / grid.width);
  const bx = b % grid.width;
  const bz = Math.floor(b / grid.width);
  const out: number[] = [];
  for (let z = Math.min(az, bz); z <= Math.max(az, bz); z++) {
    for (let x = Math.min(ax, bx); x <= Math.max(ax, bx); x++) out.push(grid.index(x, z));
  }
  return out;
}

export const FLOOD_LIMIT = 65_536;

/**
 * The patch a flood covers: tiles joined edge to edge to the start that share
 * its kind and its colour. So a flood stops at a colour already laid down,
 * which is how a painted border holds a region in.
 */
export function floodTiles(grid: TileGrid, start: number, limit = FLOOD_LIMIT): number[] {
  const kind = grid.kinds[start];
  const ink = grid.inks[start];
  const seen = new Set<number>([start]);
  const queue = [start];
  for (let head = 0; head < queue.length && queue.length < limit; head++) {
    const index = queue[head] ?? 0;
    const x = index % grid.width;
    const z = Math.floor(index / grid.width);
    for (let d = 0; d < 4; d++) {
      const nx = x + (DIR_X[d] ?? 0);
      const nz = z + (DIR_Z[d] ?? 0);
      if (!grid.contains(nx, nz)) continue;
      const next = grid.index(nx, nz);
      if (seen.has(next) || grid.kinds[next] !== kind || grid.inks[next] !== ink) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return queue;
}
