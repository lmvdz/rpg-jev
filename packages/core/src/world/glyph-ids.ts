/**
 * The glyph atlas as a closed set of ids (SPEC.md section 19): every
 * printable ASCII character, plus a fixed, append-only list of extra
 * silhouettes for props the font has no character for. A look is chosen from
 * this set alone; the pixel masks and the atlas itself are the renderer's
 * business (`packages/client/src/glyph/font.ts`), keyed by this same order.
 */
export const FIRST_CHAR = 32;
export const LAST_CHAR = 126;

/**
 * Silhouettes that no ASCII character draws well, in atlas order after "~".
 * Append only: saved worlds and born looks store these atlas indices.
 */
export const EXTRA_NAMES = [
  "tree",
  "pine",
  "bush",
  "flame",
  "rock",
  "reed",
  "stump",
  "branches",
  "mushroom",
  "tool",
  "creature",
] as const;

export type ExtraGlyph = (typeof EXTRA_NAMES)[number];

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
