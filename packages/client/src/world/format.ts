/**
 * A painted world as a file: the tile arrays, run-length encoded (a painted
 * map is mostly runs), and the placed objects. It is JSON so that a world
 * kept in the repository diffs and merges as text where it can.
 *
 * A file is read as untrusted: every size and index is checked before use.
 */
import type { GlyphLook } from "../glyph/batch.ts";
import { GLYPH_COUNT } from "../glyph/font.ts";
import { PALETTE_SIZE } from "../palette.ts";
import { MAX_HEIGHT, MIN_HEIGHT, NO_INK, SHAPE, TileGrid } from "../terrain/grid.ts";
import { TILE_KINDS } from "../terrain/kinds.ts";
import type { PlacedObject } from "./objects.ts";

export const WORLD_VERSION = 1;
const MAX_SIDE = 4096;

export interface WorldFile {
  version: number;
  width: number;
  depth: number;
  floorLevel: number;
  /** Each array as [run, value, run, value, ...]. */
  heights: number[];
  kinds: number[];
  shapes: number[];
  inks: number[];
  /** Each object as [x, z, glyph, ink, flags, scale]. */
  objects: number[][];
  /** The tile the hero starts on, as [x, z]. */
  start: number[];
}

export function encodeRuns(values: ArrayLike<number>): number[] {
  const out: number[] = [];
  let i = 0;
  while (i < values.length) {
    const value = values[i] ?? 0;
    let run = 1;
    while (i + run < values.length && values[i + run] === value) run++;
    out.push(run, value);
    i += run;
  }
  return out;
}

export function decodeRuns(
  runs: unknown,
  into: Int16Array | Uint8Array,
  name: string,
  allowed: (value: number) => boolean = () => true,
): void {
  if (!Array.isArray(runs) || runs.length % 2 !== 0) throw new Error(`${name} is not a run list`);
  let at = 0;
  for (let i = 0; i < runs.length; i += 2) {
    const run = runs[i];
    const value = runs[i + 1];
    if (!(Number.isInteger(run) && Number.isInteger(value)) || run <= 0 || !allowed(value)) {
      throw new Error(`${name} has a bad run at ${i}`);
    }
    if (at + run > into.length) throw new Error(`${name} is longer than the map`);
    into.fill(value, at, at + run);
    at += run;
  }
  if (at !== into.length) throw new Error(`${name} is shorter than the map`);
}

export interface WorldContent {
  grid: TileGrid;
  objects: PlacedObject[];
  /** The tile the hero starts on. */
  start: [number, number];
}

export function encodeWorld(world: Readonly<WorldContent>): WorldFile {
  const { grid, objects } = world;
  return {
    version: WORLD_VERSION,
    width: grid.width,
    depth: grid.depth,
    floorLevel: grid.floorLevel,
    start: [world.start[0], world.start[1]],
    heights: encodeRuns(grid.heights),
    kinds: encodeRuns(grid.kinds),
    shapes: encodeRuns(grid.shapes),
    inks: encodeRuns(grid.inks),
    objects: objects.map((o) => [
      o.x,
      o.z,
      o.look.glyph,
      o.look.ink,
      o.look.flags ?? 0,
      o.look.scale ?? 16,
    ]),
  };
}

function side(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > MAX_SIDE) {
    throw new Error(`the world's ${name} must be a whole number from 1 to ${MAX_SIDE}`);
  }
  return value;
}

function decodeObject(row: unknown, grid: TileGrid): PlacedObject {
  if (!Array.isArray(row) || row.length !== 6 || !row.every((n) => Number.isInteger(n))) {
    throw new Error("an object is not six whole numbers");
  }
  const [x, z, glyph, ink, flags, scale] = row as number[];
  const look: GlyphLook = {
    glyph: glyph ?? 0,
    ink: ink ?? 0,
    flags: flags ?? 0,
    scale: scale ?? 16,
  };
  const inRange =
    grid.contains(x ?? -1, z ?? -1) &&
    look.glyph >= 0 &&
    look.glyph < GLYPH_COUNT &&
    look.ink >= 0 &&
    look.ink < PALETTE_SIZE &&
    (look.flags ?? 0) >= 0 &&
    (look.flags ?? 0) <= 255 &&
    (look.scale ?? 16) >= 1 &&
    (look.scale ?? 16) <= 255;
  if (!inRange) throw new Error(`an object at (${x}, ${z}) is out of range`);
  return { x: x ?? 0, z: z ?? 0, look };
}

function decodeStart(value: unknown, grid: TileGrid): [number, number] {
  const middle: [number, number] = [Math.floor(grid.width / 2), Math.floor(grid.depth / 2)];
  if (!Array.isArray(value) || value.length !== 2) return middle;
  const [x, z] = value as unknown[];
  const onMap =
    Number.isInteger(x) && Number.isInteger(z) && grid.contains(x as number, z as number);
  return onMap ? [x as number, z as number] : middle;
}

export function decodeWorld(data: unknown): WorldContent {
  if (typeof data !== "object" || data === null) throw new Error("not a world file");
  const file = data as Partial<Record<keyof WorldFile, unknown>>;
  if (file.version !== WORLD_VERSION) throw new Error(`cannot read world version ${file.version}`);
  const grid = new TileGrid(side(file.width, "width"), side(file.depth, "depth"));
  if (typeof file.floorLevel === "number" && Number.isInteger(file.floorLevel)) {
    grid.floorLevel = file.floorLevel;
  }
  decodeRuns(file.heights, grid.heights, "heights", (h) => h >= MIN_HEIGHT && h <= MAX_HEIGHT);
  decodeRuns(file.kinds, grid.kinds, "kinds", (k) => k >= 0 && k < TILE_KINDS.length);
  decodeRuns(file.shapes, grid.shapes, "shapes", (s) => s >= SHAPE.flat && s <= SHAPE.hole);
  decodeRuns(file.inks, grid.inks, "inks", (i) => i === NO_INK || (i >= 0 && i < PALETTE_SIZE));
  if (!Array.isArray(file.objects)) throw new Error("the world has no object list");
  return {
    grid,
    objects: file.objects.map((row) => decodeObject(row, grid)),
    start: decodeStart(file.start, grid),
  };
}
