/**
 * The 16-entry palette, as a closed set of ids (SPEC.md section 19): every
 * colour a look can be chosen from. The hex values themselves are the
 * renderer's business (`packages/client/src/palette.ts`), keyed by this same
 * name-to-index table.
 */
export const PALETTE_SIZE = 16;

export const INK = {
  void: 0,
  slate: 1,
  stone: 2,
  ash: 3,
  bone: 4,
  earth: 5,
  wood: 6,
  sand: 7,
  pine: 8,
  grass: 9,
  leaf: 10,
  deep: 11,
  water: 12,
  ember: 13,
  lamp: 14,
  violet: 15,
} as const;

export type Ink = (typeof INK)[keyof typeof INK];
