/**
 * Our own 3x5 pixel font (SPEC.md section 19). Each glyph is five rows of
 * three cells, top row first, "#" for ink. The symbols are the game's actors
 * and props, so every printable ASCII character is drawn, and no two glyphs
 * are alike (a test holds both).
 */
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

/** Props that no ASCII character draws well. They follow "~" in the atlas. */
const EXTRA = {
  tree: ".#. ### ### .#. .#.",
  pine: ".#. .#. ### ### .#.",
  bush: "... .#. ### ### ...",
  flame: ".#. .#. ### #.# .#.",
  rock: "... ... .#. ### ###",
  reed: "#.# #.# #.# .#. .#.",
} as const;

export type ExtraGlyph = keyof typeof EXTRA;

export const FIRST_CHAR = 32;
export const LAST_CHAR = 126;
const EXTRA_NAMES = Object.keys(EXTRA) as ExtraGlyph[];
/** The props by name: a closed set a look can be chosen from. */
export const EXTRA_GLYPHS: readonly ExtraGlyph[] = EXTRA_NAMES;

export const GLYPH_COUNT = LAST_CHAR - FIRST_CHAR + 1 + EXTRA_NAMES.length;

/** Atlas index of a printable ASCII character; "?" stands in for anything else. */
export function glyphOfChar(char: string): number {
  const code = char.codePointAt(0) ?? 0;
  if (code < FIRST_CHAR || code > LAST_CHAR) return "?".charCodeAt(0) - FIRST_CHAR;
  return code - FIRST_CHAR;
}

export function glyphOfExtra(name: ExtraGlyph): number {
  return LAST_CHAR - FIRST_CHAR + 1 + EXTRA_NAMES.indexOf(name);
}

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
