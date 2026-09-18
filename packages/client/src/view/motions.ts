/**
 * How an actor's own glyph moves when it does something: the third sibling
 * of the look and the effect, and a row over closed sets like them. An
 * ability carries one (docs/sandbox-direction.md, "Skills and abilities"), it
 * is decided once when the ability is born, and no field is free text.
 *
 * The glyph shader plays it (`GLYPH_VERTEX`): a play is a slot, a start time
 * and the row's numbers, so nothing is stepped on the CPU while it runs. A
 * frame takes a few at once, as it does lights.
 */
import { EASINGS, type Easing } from "./effects.ts";

export const ACTOR_MOTIONS = ["lunge", "hop", "recoil", "shake", "spin"] as const;
export type ActorMotion = (typeof ACTOR_MOTIONS)[number];

export interface MotionRow {
  motion: ActorMotion;
  easing: Easing;
  /** Levels, 0 to 5: how far, and for how long. */
  strength: number;
  duration: number;
}

const isLevel = (n: unknown) => typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 5;

/** Why a row is not a motion, or null when it is one. */
export function checkMotion(row: MotionRow): string | null {
  if (!ACTOR_MOTIONS.includes(row.motion)) return "motion is not one of the actor motions";
  if (!EASINGS.includes(row.easing)) return "easing is not one of the easings";
  return isLevel(row.strength) && isLevel(row.duration) ? null : "levels run from 0 to 5";
}

const TILES = [0, 0.1, 0.2, 0.35, 0.5, 0.8] as const;
const SECONDS = [0.1, 0.18, 0.3, 0.45, 0.7, 1] as const;

export const secondsOf = (row: MotionRow): number => SECONDS[row.duration] ?? 0.3;

/** Written by hand, so the set proves itself before anything generates one. */
export const MOTIONS = {
  lunge: { motion: "lunge", easing: "out", strength: 3, duration: 1 },
  hop: { motion: "hop", easing: "linear", strength: 3, duration: 2 },
  recoil: { motion: "recoil", easing: "out", strength: 2, duration: 2 },
  shake: { motion: "shake", easing: "linear", strength: 2, duration: 3 },
  spin: { motion: "spin", easing: "inOut", strength: 2, duration: 4 },
} as const satisfies Record<string, MotionRow>;

export const MAX_MOTIONS = 8;

interface Play {
  slotOf: () => number;
  row: MotionRow;
  start: number;
  dirX: number;
  dirZ: number;
}

/**
 * The motions under way. `play` is called when something happens; `pack` each
 * frame writes those still running for the shader and forgets the finished.
 */
export class ActorMotions {
  /** Per motion: glyph slot, motion, start (seconds), duration (seconds). */
  readonly a = new Float32Array(MAX_MOTIONS * 4);
  /** Per motion: direction x, direction z, strength (tiles), easing. */
  readonly b = new Float32Array(MAX_MOTIONS * 4);
  count = 0;
  #plays: Play[] = [];

  /**
   * `slotOf` finds the actor's glyph each frame, since slots move when glyphs
   * are removed. The direction is towards what the act is aimed at.
   */
  play(slotOf: () => number, row: MotionRow, now: number, dirX = 0, dirZ = 0): void {
    const length = Math.hypot(dirX, dirZ) || 1;
    this.#plays.push({ slotOf, row, start: now, dirX: dirX / length, dirZ: dirZ / length });
    // The newest are kept: an actor that acts again is showing its latest act.
    if (this.#plays.length > MAX_MOTIONS) this.#plays.shift();
  }

  pack(now: number): void {
    if (this.#plays.some((play) => now - play.start >= secondsOf(play.row))) {
      this.#plays = this.#plays.filter((play) => now - play.start < secondsOf(play.row));
    }
    this.count = 0;
    for (const play of this.#plays) {
      const slot = play.slotOf();
      if (slot < 0) continue;
      const at = this.count * 4;
      this.a[at] = slot;
      this.a[at + 1] = ACTOR_MOTIONS.indexOf(play.row.motion);
      this.a[at + 2] = play.start;
      this.a[at + 3] = secondsOf(play.row);
      this.b[at] = play.dirX;
      this.b[at + 1] = play.dirZ;
      this.b[at + 2] = TILES[play.row.strength] ?? 0;
      this.b[at + 3] = EASINGS.indexOf(play.row.easing);
      this.count++;
    }
  }
}
