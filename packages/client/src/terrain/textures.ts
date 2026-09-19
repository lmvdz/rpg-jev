/**
 * The terrain textures: small greyscale patterns, one layer per `TEXTURE`
 * entry. They carry no colour. The shader multiplies them into the tile's
 * palette colour, so recolouring the world never needs new art.
 *
 * They are drawn by code from a fixed hash, so they are the same every run.
 */
import { TEXTURE, TEXTURE_COUNT } from "./kinds.ts";

export const TEXTURE_SIZE = 16;
/** Texels per world unit. A glyph pixel is two of these (`GLYPH_PIXEL`). */
export const TEXELS_PER_TILE = 8;

function hash(x: number, y: number, salt: number): number {
  let h = (x * 374761393 + y * 668265263 + salt * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 0x1_0000_0000;
}

type Painter = (x: number, y: number) => number;

function speckle(x: number, y: number): number {
  const r = hash(x, y, 1);
  if (r < 0.08) return 150;
  return r > 0.93 ? 255 : 205;
}

function grass(x: number, y: number): number {
  // A blade is two texels tall: lit where it starts, and the texel below it too.
  if (hash(x, y, 2) < 0.14 || hash(x, (y + 15) % 16, 2) < 0.14) return 255;
  return hash(x, y, 3) < 0.1 ? 160 : 200;
}

function blocks(x: number, y: number): number {
  if (y % 4 === 3) return 120;
  const course = Math.floor(y / 4);
  if ((x + course * 4) % 8 === 7) return 120;
  return hash(x, y, 4) < 0.1 ? 185 : 225;
}

function planks(x: number, y: number): number {
  if (y % 4 === 3) return 130;
  const board = Math.floor(y / 4);
  if ((x + board * 5) % 16 === 0) return 150;
  return hash(x, board, 5) < 0.3 ? 195 : 225;
}

function ripple(x: number, y: number): number {
  const start = Math.floor(hash(0, y, 6) * 16);
  const along = (x - start + 16) % 16;
  if (y % 3 === 0 && along < 4) return 255;
  return 200;
}

function grain(x: number, y: number): number {
  return hash(x, y, 7) < 0.07 ? 165 : 225;
}

const PAINTERS: Readonly<Record<number, Painter>> = {
  [TEXTURE.speckle]: speckle,
  [TEXTURE.grass]: grass,
  [TEXTURE.blocks]: blocks,
  [TEXTURE.planks]: planks,
  [TEXTURE.ripple]: ripple,
  [TEXTURE.grain]: grain,
};

/** All layers back to back, one byte per texel, ready for `texImage3D`. */
export function buildTerrainTextures(): Uint8Array {
  const layerBytes = TEXTURE_SIZE * TEXTURE_SIZE;
  const out = new Uint8Array(layerBytes * TEXTURE_COUNT);
  for (let layer = 0; layer < TEXTURE_COUNT; layer++) {
    const paint = PAINTERS[layer];
    if (!paint) throw new Error(`terrain texture ${layer} has no painter`);
    for (let y = 0; y < TEXTURE_SIZE; y++) {
      for (let x = 0; x < TEXTURE_SIZE; x++) {
        out[layer * layerBytes + y * TEXTURE_SIZE + x] = paint(x, y);
      }
    }
  }
  return out;
}
