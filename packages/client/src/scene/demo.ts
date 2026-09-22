/**
 * The R1 stress scene (SPEC.md section 16): 256 by 256 tiles of hills, water
 * and woods round a small walled yard, and at least 10,000 glyphs. It is
 * made by code from a seed, so the measurement is the same scene every time.
 * It is a test card, not the game's world: that will be painted in the editor.
 */
import { Rng } from "@rpg-jev/core/rng";
import { makeNoise } from "@rpg-jev/core/world";
import { GLYPH_SWAYS, type GlyphLook } from "../glyph/batch.ts";
import { glyphOfChar, glyphOfExtra } from "../glyph/font.ts";
import { INK } from "../palette.ts";
import { DIR_X, DIR_Z, SHAPE, type Shape, TileGrid } from "../terrain/grid.ts";
import { kindIndex } from "../terrain/kinds.ts";

export const DEMO_SIZE = 256;
export const DEMO_GLYPHS = 10_000;

export interface Placement {
  /** Tile the glyph stands in the middle of. */
  x: number;
  z: number;
  look: GlyphLook;
}

export interface DemoScene {
  grid: TileGrid;
  /** The hero is first. */
  placements: Placement[];
}

const KIND = {
  grass: kindIndex("grass"),
  dirt: kindIndex("dirt"),
  rock: kindIndex("rock"),
  sand: kindIndex("sand"),
  water: kindIndex("water"),
  masonry: kindIndex("masonry"),
  boards: kindIndex("boards"),
  forest: kindIndex("forest"),
};

function kindForLevel(level: number, wooded: boolean): number {
  if (level <= 0) return KIND.water;
  if (level === 1) return KIND.sand;
  if (level >= 8) return KIND.rock;
  return wooded ? KIND.forest : KIND.grass;
}

function shapeLand(grid: TileGrid, rng: Rng): void {
  const hills = makeNoise(rng);
  const woods = makeNoise(rng);
  for (let z = 0; z < grid.depth; z++) {
    for (let x = 0; x < grid.width; x++) {
      const level = Math.floor(hills(x, z) * 22) - 7;
      const kind = kindForLevel(level, woods(x, z) > 0.55);
      grid.set(x, z, { height: Math.max(level, 0), kind });
    }
  }
}

/** Turns some one-level steps into ramps, which is what a slant is for. */
function addRamps(grid: TileGrid, rng: Rng): void {
  for (let z = 1; z < grid.depth - 1; z++) {
    for (let x = 1; x < grid.width - 1; x++) {
      const kind = grid.kindAt(x, z);
      if (kind === KIND.water || rng.next() > 0.3) continue;
      const here = grid.heightAt(x, z);
      const d = Math.floor(rng.next() * 4);
      const ahead = grid.heightAt(x + (DIR_X[d] ?? 0), z + (DIR_Z[d] ?? 0));
      if (ahead - here === 1) grid.set(x, z, { shape: (SHAPE.slantN + d) as Shape });
    }
  }
}

const YARD = { x: 112, z: 116, width: 32, depth: 24, level: 4 };
const HOUSE = { x: 120, z: 120, width: 12, depth: 9, wall: 5 };

function inRect(x: number, z: number, r: { x: number; z: number; width: number; depth: number }) {
  return x >= r.x && z >= r.z && x < r.x + r.width && z < r.z + r.depth;
}

function buildYard(grid: TileGrid): void {
  for (let z = YARD.z; z < YARD.z + YARD.depth; z++) {
    for (let x = YARD.x; x < YARD.x + YARD.width; x++) {
      grid.set(x, z, { height: YARD.level, kind: KIND.dirt, shape: SHAPE.flat });
    }
  }
  for (let z = HOUSE.z; z < HOUSE.z + HOUSE.depth; z++) {
    for (let x = HOUSE.x; x < HOUSE.x + HOUSE.width; x++) {
      const edge =
        x === HOUSE.x ||
        z === HOUSE.z ||
        x === HOUSE.x + HOUSE.width - 1 ||
        z === HOUSE.z + HOUSE.depth - 1;
      const door = z === HOUSE.z + HOUSE.depth - 1 && x === HOUSE.x + 5;
      if (edge && !door) grid.set(x, z, { height: YARD.level + HOUSE.wall, kind: KIND.masonry });
      else grid.set(x, z, { kind: KIND.boards });
    }
  }
  // A well: a hole with a low kerb round it.
  const well = { x: YARD.x + 24, z: YARD.z + 8 };
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      grid.set(well.x + dx, well.z + dz, { height: YARD.level + 1, kind: KIND.masonry });
    }
  }
  grid.set(well.x, well.z, { shape: SHAPE.hole });
  // A flooded strip of path, to show colour flooding.
  for (let z = YARD.z + YARD.depth - 4; z < YARD.z + YARD.depth; z++) {
    grid.set(HOUSE.x + 5, z, { ink: INK.sand });
  }
}

const TREE: GlyphLook = {
  glyph: glyphOfExtra("tree"),
  ink: INK.leaf,
  flags: GLYPH_SWAYS,
  scale: 22,
};
const PINE: GlyphLook = {
  glyph: glyphOfExtra("pine"),
  ink: INK.pine,
  flags: GLYPH_SWAYS,
  scale: 24,
};
const BUSH: GlyphLook = { glyph: glyphOfExtra("bush"), ink: INK.grass, flags: GLYPH_SWAYS };
const ROCK: GlyphLook = { glyph: glyphOfExtra("rock"), ink: INK.ash };
const REED: GlyphLook = { glyph: glyphOfExtra("reed"), ink: INK.leaf, flags: GLYPH_SWAYS };
const TUFT: GlyphLook = { glyph: glyphOfChar('"'), ink: INK.leaf, flags: GLYPH_SWAYS, scale: 10 };

/** What may grow on a tile of each kind, and how often. */
const GROWTH: Readonly<Record<number, readonly { look: GlyphLook; chance: number }[]>> = {
  [KIND.forest]: [
    { look: TREE, chance: 0.18 },
    { look: PINE, chance: 0.12 },
  ],
  [KIND.grass]: [
    { look: BUSH, chance: 0.02 },
    { look: TREE, chance: 0.01 },
  ],
  [KIND.rock]: [{ look: ROCK, chance: 0.06 }],
  [KIND.sand]: [{ look: REED, chance: 0.08 }],
};

function scatterGrowth(grid: TileGrid, rng: Rng, out: Placement[]): void {
  for (let z = 0; z < grid.depth; z++) {
    for (let x = 0; x < grid.width; x++) {
      if (inRect(x, z, YARD) || grid.shapeAt(x, z) !== SHAPE.flat) continue;
      let draw = rng.next();
      for (const option of GROWTH[grid.kindAt(x, z)] ?? []) {
        if (draw < option.chance) {
          out.push({ x, z, look: option.look });
          break;
        }
        draw -= option.chance;
      }
    }
  }
}

/** Grass tufts on free grass tiles until the scene holds the glyphs the gate asks for. */
function topUp(grid: TileGrid, rng: Rng, out: Placement[]): void {
  const taken = new Set(out.map((p) => p.z * grid.width + p.x));
  let tries = 0;
  while (out.length < DEMO_GLYPHS && tries++ < 2_000_000) {
    const x = Math.floor(rng.next() * grid.width);
    const z = Math.floor(rng.next() * grid.depth);
    const key = z * grid.width + x;
    if (taken.has(key) || grid.kindAt(x, z) !== KIND.grass || inRect(x, z, YARD)) continue;
    taken.add(key);
    out.push({ x, z, look: TUFT });
  }
}

const FOLK: readonly { dx: number; dz: number; char: string; ink: number }[] = [
  { dx: 3, dz: 3, char: "B", ink: INK.ember },
  { dx: 8, dz: 5, char: "m", ink: INK.bone },
  { dx: -4, dz: 12, char: "t", ink: INK.violet },
  { dx: 14, dz: 11, char: "d", ink: INK.sand },
  { dx: 17, dz: 2, char: "c", ink: INK.ash },
];

export function buildDemoScene(seed = 7): DemoScene {
  const rng = Rng.fromSeed(seed);
  const grid = new TileGrid(DEMO_SIZE, DEMO_SIZE);
  shapeLand(grid, rng);
  addRamps(grid, rng);
  buildYard(grid);

  const hero: Placement = {
    x: HOUSE.x + 5,
    z: HOUSE.z + HOUSE.depth + 2,
    look: { glyph: glyphOfChar("@"), ink: INK.lamp },
  };
  const placements: Placement[] = [hero];
  for (const folk of FOLK) {
    placements.push({
      x: HOUSE.x + folk.dx,
      z: HOUSE.z + folk.dz,
      look: { glyph: glyphOfChar(folk.char), ink: folk.ink },
    });
  }
  scatterGrowth(grid, rng, placements);
  topUp(grid, rng, placements);
  return { grid, placements };
}
