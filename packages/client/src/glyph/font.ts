/**
 * Our own 3x5 pixel font (SPEC.md section 19). Each glyph is five rows of
 * three cells, top row first, "#" for ink. The symbols are the game's actors
 * and props, so every printable ASCII character is drawn, and no two glyphs
 * are alike (a test holds both).
 *
 * The atlas index of a glyph is a closed-set id (`@rpg-jev/core/world`), so a
 * born look can name a glyph without the world package knowing a pixel mask.
 * This file only draws the masks, in that same order; a test checks they agree.
 */
import {
  EXTRA_GLYPHS,
  EXTRA_NAMES,
  type ExtraGlyph,
  FIRST_CHAR,
  GLYPH_COUNT,
  glyphOfChar,
  glyphOfExtra,
  LAST_CHAR,
} from "@rpg-jev/core/world";

export {
  EXTRA_GLYPHS,
  EXTRA_NAMES,
  type ExtraGlyph,
  FIRST_CHAR,
  GLYPH_COUNT,
  glyphOfChar,
  glyphOfExtra,
  LAST_CHAR,
};

export const GLYPH_W = 3;
export const GLYPH_H = 5;

const ASCII: Readonly<Record<string, string>> = {
  " ": "... ... ... ... ...",
  "!": ".#. .#. .#. ... .#.",
  '"': "#.# #.# ... ... ...",
  "#": "#.# ### #.# ### #.#",
  $: ".## ##. ### .## ##.",
  "%": "#.. ..# .#. #.. ..#",
  "&": ".#. #.# .#. #.# .##",
  "'": ".#. .#. ... ... ...",
  "(": "..# .#. .#. .#. ..#",
  ")": "#.. .#. .#. .#. #..",
  "*": "... #.# .#. #.# ...",
  "+": "... .#. ### .#. ...",
  ",": "... ... ... .#. #..",
  "-": "... ... ### ... ...",
  ".": "... ... ... ... .#.",
  "/": "..# ..# .#. #.. #..",
  "0": "### #.# #.# #.# ###",
  "1": ".#. ##. .#. .#. ###",
  "2": "### ..# ### #.. ###",
  "3": "### ..# .## ..# ###",
  "4": "#.# #.# ### ..# ..#",
  "5": "### #.. ### ..# ###",
  "6": "### #.. ### #.# ###",
  "7": "### ..# ..# .#. .#.",
  "8": "### #.# ### #.# ###",
  "9": "### #.# ### ..# ###",
  ":": "... .#. ... .#. ...",
  ";": "... .#. ... .#. #..",
  "<": "..# .#. #.. .#. ..#",
  "=": "... ### ... ### ...",
  ">": "#.. .#. ..# .#. #..",
  "?": "### ..# .#. ... .#.",
  "@": ".## #.# #.# #.. .##",
  A: ".#. #.# ### #.# #.#",
  B: "##. #.# ##. #.# ##.",
  C: ".## #.. #.. #.. .##",
  D: "##. #.# #.# #.# ##.",
  E: "### #.. ##. #.. ###",
  F: "### #.. ##. #.. #..",
  G: ".## #.. #.# #.# .##",
  H: "#.# #.# ### #.# #.#",
  I: "### .#. .#. .#. ###",
  J: "..# ..# ..# #.# .#.",
  K: "#.# #.# ##. #.# #.#",
  L: "#.. #.. #.. #.. ###",
  M: "#.# ### ### #.# #.#",
  N: "##. #.# #.# #.# #.#",
  O: ".#. #.# #.# #.# .#.",
  P: "##. #.# ##. #.. #..",
  Q: ".#. #.# #.# ### .##",
  R: "##. #.# ##. #.# #.#",
  S: ".## #.. .#. ..# ##.",
  T: "### .#. .#. .#. .#.",
  U: "#.# #.# #.# #.# ###",
  V: "#.# #.# #.# #.# .#.",
  W: "#.# #.# ### ### #.#",
  X: "#.# #.# .#. #.# #.#",
  Y: "#.# #.# .#. .#. .#.",
  Z: "### ..# .#. #.. ###",
  "[": "##. #.. #.. #.. ##.",
  "\\": "#.. #.. .#. ..# ..#",
  "]": ".## ..# ..# ..# .##",
  "^": ".#. #.# ... ... ...",
  _: "... ... ... ... ###",
  "`": "#.. .#. ... ... ...",
  a: "... .## #.# #.# .##",
  b: "#.. ##. #.# #.# ##.",
  c: "... .## #.. #.. .##",
  d: "..# .## #.# #.# .##",
  e: "... .#. ### #.. .##",
  f: "..# .#. ### .#. .#.",
  g: "... .## #.# .## ##.",
  h: "#.. ##. #.# #.# #.#",
  i: ".#. ... .#. .#. .#.",
  j: "..# ... ..# #.# .#.",
  k: "#.. #.# ##. #.# #.#",
  l: "##. .#. .#. .#. .##",
  m: "... ### ### #.# #.#",
  n: "... ##. #.# #.# #.#",
  o: "... .#. #.# #.# .#.",
  p: "... ##. #.# ##. #..",
  q: "... .## #.# .## ..#",
  r: "... .## #.. #.. #..",
  s: "... .## ##. .## ##.",
  t: ".#. ### .#. .#. ..#",
  u: "... #.# #.# #.# .##",
  v: "... #.# #.# #.# .#.",
  w: "... #.# #.# ### ###",
  x: "... #.# .#. .#. #.#",
  y: "... #.# .## ..# ##.",
  z: "... ### .## ##. ###",
  "{": ".## .#. ##. .#. .##",
  "|": ".#. .#. .#. .#. .#.",
  "}": "##. .#. .## .#. ##.",
  "~": "... .## ##. ... ...",
};

/**
 * Silhouettes that no ASCII character draws well. They follow "~" in the
 * atlas, in `EXTRA_NAMES` order (`@rpg-jev/core/world`): the closed set of
 * ids is pinned there, and a test checks this object has exactly those keys.
 */
const EXTRA: Readonly<Record<ExtraGlyph, string>> = {
  tree: ".#. ### ### .#. .#.",
  pine: ".#. .#. ### ### .#.",
  bush: "... .#. ### ### ...",
  flame: ".#. .#. ### #.# .#.",
  rock: "... ... .#. ### ###",
  reed: "#.# #.# #.# .#. .#.",
  stump: "... ... ### #.# ###",
  branches: "... #.. .## ##. #.#",
  mushroom: ".#. ### ### .#. ###",
  tool: "### ##. .#. .#. .#.",
  creature: "#.# ### .#. ### #.#",
};

/** The rows of every glyph in atlas order. */
export function glyphRows(): string[][] {
  const rows: string[][] = [];
  for (let code = FIRST_CHAR; code <= LAST_CHAR; code++) {
    const char = String.fromCharCode(code);
    const drawn = ASCII[char];
    if (drawn === undefined) throw new Error(`the font has no glyph for "${char}"`);
    rows.push(drawn.split(" "));
  }
  for (const name of EXTRA_NAMES) rows.push(EXTRA[name].split(" "));
  return rows;
}

export const ATLAS_COLS = 16;
/** One empty cell of padding right of and below each glyph, so nothing bleeds. */
export const CELL_W = GLYPH_W + 1;
export const CELL_H = GLYPH_H + 1;

export interface GlyphAtlas {
  readonly width: number;
  readonly height: number;
  /** One byte per pixel, 255 for ink, texture row 0 first. */
  readonly pixels: Uint8Array;
}

export function buildGlyphAtlas(): GlyphAtlas {
  const glyphs = glyphRows();
  const width = ATLAS_COLS * CELL_W;
  const height = Math.ceil(glyphs.length / ATLAS_COLS) * CELL_H;
  const pixels = new Uint8Array(width * height);
  glyphs.forEach((rows, index) => {
    const left = (index % ATLAS_COLS) * CELL_W;
    const top = Math.floor(index / ATLAS_COLS) * CELL_H;
    rows.forEach((row, y) => {
      for (let x = 0; x < GLYPH_W; x++) {
        if (row[x] === "#") pixels[(top + y) * width + left + x] = 255;
      }
    });
  });
  return { width, height, pixels };
}
