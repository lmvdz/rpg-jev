/**
 * The effect schema: what an effect is, as a row over closed sets. It is the
 * look's sibling. An effect is decided once, when an element or a reaction is
 * born, by choosing each field below from its closed set (a choice a judge
 * can ratify); it is never decided per occurrence, and no field is free text
 * or code. One fixed shader plays every row (`gl/shaders.ts`), so an effect
 * nobody has seen before costs what any other does and can do nothing the
 * shader cannot.
 *
 * Levels run 0 to 5 like the rest of the vocabulary. What a level means in
 * seconds or tiles is arithmetic, so it is here in code (`packEffect`).
 */
import { GLYPH_COUNT } from "../glyph/font.ts";
import { PALETTE_SIZE } from "../palette.ts";

export const MOTIONS = ["rise", "fall", "burst", "drift", "orbit", "cling"] as const;
export const EASINGS = ["linear", "in", "out", "inOut", "pulse"] as const;
export type Motion = (typeof MOTIONS)[number];
export type Easing = (typeof EASINGS)[number];
export const MAX_FRAMES = 4;
export const PARTICLES_PER_EMITTER = 12;

export interface EffectRow {
  motion: Motion;
  /** One to four glyphs of the atlas, shown in order over a particle's life. */
  frames: readonly number[];
  /** Palette colours at birth, in mid life and at the end. */
  inks: readonly [number, number, number];
  /** Levels, 0 to 5. */
  rate: number;
  life: number;
  spread: number;
  speed: number;
  /** Size at birth and at the end, as levels, and how it gets from one to the other. */
  sizeFrom: number;
  sizeTo: number;
  easing: Easing;
  /** Gives its own light, as a glowing glyph does. */
  glows: boolean;
}

const isLevel = (n: unknown) => typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 5;
const within = (n: unknown, size: number) =>
  typeof n === "number" && Number.isInteger(n) && n >= 0 && n < size;

/** Why a row is not an effect, or null when it is one. Rows will be generated, so they are checked. */
export function checkEffect(row: EffectRow): string | null {
  if (!MOTIONS.includes(row.motion)) return "motion is not one of the motions";
  if (!EASINGS.includes(row.easing)) return "easing is not one of the easings";
  const frames = row.frames;
  if (!Array.isArray(frames) || frames.length === 0 || frames.length > MAX_FRAMES) {
    return `an effect has 1 to ${MAX_FRAMES} frames`;
  }
  if (!frames.every((glyph) => within(glyph, GLYPH_COUNT))) return "a frame is not in the atlas";
  if (row.inks.length !== 3 || !row.inks.every((ink) => within(ink, PALETTE_SIZE))) {
    return "inks are three palette colours";
  }
  const levels = [row.rate, row.life, row.spread, row.speed, row.sizeFrom, row.sizeTo];
  if (!levels.every(isLevel)) return "levels run from 0 to 5";
  return typeof row.glows === "boolean" ? null : "glows is yes or no";
}

/** Floats per emitter: five texels of four. The layout is read by `EFFECT_VERTEX`. */
export const EMITTER_FLOATS = 20;

const PARTICLES = [0, 2, 4, 6, 9, PARTICLES_PER_EMITTER] as const;
const SECONDS = [0.3, 0.6, 1, 1.6, 2.5, 4] as const;
const TILES = [0, 0.15, 0.3, 0.6, 1, 1.6] as const;
const TILES_PER_SECOND = [0, 0.3, 0.6, 1.1, 1.8, 3] as const;
/** Size as a multiple of the frame's glyph pixel. */
const SIZES = [0.15, 0.3, 0.45, 0.65, 0.9, 1.2] as const;

/** Writes an emitter at `offset`: where it is, a seed that tells it from its neighbours, and its row. */
export function packEffect(
  out: Float32Array,
  offset: number,
  x: number,
  y: number,
  z: number,
  row: EffectRow,
): void {
  out[offset] = x;
  out[offset + 1] = y;
  out[offset + 2] = z;
  out[offset + 3] = (x * 12.9898 + z * 78.233) % 97;
  out[offset + 4] = MOTIONS.indexOf(row.motion);
  out[offset + 5] = PARTICLES[row.rate] ?? 0;
  out[offset + 6] = SECONDS[row.life] ?? 1;
  out[offset + 7] = TILES[row.spread] ?? 0;
  out[offset + 8] = TILES_PER_SECOND[row.speed] ?? 0;
  out[offset + 9] = SIZES[row.sizeFrom] ?? 0.5;
  out[offset + 10] = SIZES[row.sizeTo] ?? 0.5;
  out[offset + 11] = EASINGS.indexOf(row.easing);
  out[offset + 12] = row.inks[0];
  out[offset + 13] = row.inks[1];
  out[offset + 14] = row.inks[2];
  out[offset + 15] = row.glows ? 1 : 0;
  for (let f = 0; f < MAX_FRAMES; f++) out[offset + 16 + f] = row.frames[f] ?? -1;
}

export const MAX_EMITTERS = 256;

/** The emitters of a frame, packed for one upload. Gathering them allocates nothing. */
export class EmitterList {
  readonly data = new Float32Array(MAX_EMITTERS * EMITTER_FLOATS);
  count = 0;

  begin(): void {
    this.count = 0;
  }

  /** Quietly full at `MAX_EMITTERS`: the ones offered first are the ones kept. */
  add(x: number, y: number, z: number, row: EffectRow): void {
    if (this.count >= MAX_EMITTERS) return;
    packEffect(this.data, this.count * EMITTER_FLOATS, x, y, z, row);
    this.count++;
  }
}
