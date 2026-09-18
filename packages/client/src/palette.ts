/**
 * The 16-entry palette (SPEC.md section 19). Everything drawn is coloured by
 * an index into it, so one uniform upload recolours the world.
 */
export const PALETTE_SIZE = 16;

export const PALETTE_HEX = [
  "#0d0e14", // 0 void
  "#2a2d3c", // 1 slate
  "#5a5f6e", // 2 stone
  "#9aa0a8", // 3 ash
  "#e8e4d4", // 4 bone
  "#3b2a22", // 5 earth
  "#6e4a2f", // 6 wood
  "#c49a5a", // 7 sand
  "#24452f", // 8 pine
  "#4a7a3a", // 9 grass
  "#8fb84e", // 10 leaf
  "#1f3a5f", // 11 deep
  "#3f7fae", // 12 water
  "#b13e31", // 13 ember
  "#e8a23a", // 14 lamp
  "#7a4a8c", // 15 violet
] as const;

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

/** Flat RGB floats in [0, 1], ready for `uniform3fv`. */
export function paletteToFloats(hex: readonly string[] = PALETTE_HEX): Float32Array {
  if (hex.length !== PALETTE_SIZE) {
    throw new Error(`a palette has ${PALETTE_SIZE} entries, got ${hex.length}`);
  }
  const out = new Float32Array(PALETTE_SIZE * 3);
  hex.forEach((entry, i) => {
    const match = /^#([0-9a-f]{6})$/i.exec(entry);
    if (!match?.[1]) throw new Error(`not a #rrggbb colour: ${entry}`);
    const value = Number.parseInt(match[1], 16);
    out[i * 3] = ((value >> 16) & 0xff) / 255;
    out[i * 3 + 1] = ((value >> 8) & 0xff) / 255;
    out[i * 3 + 2] = (value & 0xff) / 255;
  });
  return out;
}
