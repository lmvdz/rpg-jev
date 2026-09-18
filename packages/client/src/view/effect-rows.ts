/**
 * The first effect rows, written by hand so the schema proved itself before
 * anything generated one. They are kept as the generic effect of each
 * happening, which plays only until the element's own row is born.
 */
import { glyphOfChar, glyphOfExtra } from "../glyph/font.ts";
import { INK } from "../palette.ts";
import type { Happening } from "./effect-birth.ts";
import type { EffectRow } from "./effects.ts";

const dot = glyphOfChar(".");
const tick = glyphOfChar("'");
const star = glyphOfChar("*");

export const EFFECTS = {
  flames: {
    motion: "rise",
    frames: [glyphOfExtra("flame"), glyphOfChar("^"), tick],
    inks: [INK.lamp, INK.ember, INK.earth],
    rate: 4,
    life: 1,
    spread: 1,
    speed: 3,
    sizeFrom: 4,
    sizeTo: 1,
    easing: "out",
    glows: true,
  },
  smoke: {
    motion: "rise",
    frames: [glyphOfChar("o"), glyphOfChar("O"), glyphOfChar("~")],
    inks: [INK.slate, INK.stone, INK.ash],
    rate: 2,
    life: 4,
    spread: 2,
    speed: 2,
    sizeFrom: 2,
    sizeTo: 5,
    easing: "out",
    glows: false,
  },
  sparks: {
    motion: "burst",
    frames: [star, tick, dot],
    inks: [INK.bone, INK.lamp, INK.ember],
    rate: 3,
    life: 1,
    spread: 1,
    speed: 3,
    sizeFrom: 2,
    sizeTo: 0,
    easing: "in",
    glows: true,
  },
  splash: {
    motion: "burst",
    frames: [glyphOfChar(","), dot],
    inks: [INK.bone, INK.water, INK.deep],
    rate: 4,
    life: 1,
    spread: 1,
    speed: 2,
    sizeFrom: 2,
    sizeTo: 1,
    easing: "linear",
    glows: false,
  },
  dust: {
    motion: "drift",
    frames: [dot, glyphOfChar(":")],
    inks: [INK.sand, INK.sand, INK.earth],
    rate: 2,
    life: 1,
    spread: 1,
    speed: 1,
    sizeFrom: 1,
    sizeTo: 3,
    easing: "out",
    glows: false,
  },
  shimmer: {
    motion: "orbit",
    frames: [star, glyphOfChar("+")],
    inks: [INK.violet, INK.bone, INK.violet],
    rate: 3,
    life: 3,
    spread: 3,
    speed: 1,
    sizeFrom: 1,
    sizeTo: 2,
    easing: "pulse",
    glows: true,
  },
} as const satisfies Record<string, EffectRow>;

/**
 * What plays for a happening until a judge has answered for the element it is
 * happening to (rule 2: nothing waits on a model). This is the hand rows' only
 * use: the row an element keeps is born (`effect-book.ts`).
 */
export const GENERIC: Readonly<Record<Happening, EffectRow | null>> = {
  exists: null,
  burns: EFFECTS.flames,
  fumes: EFFECTS.smoke,
  struck: EFFECTS.sparks,
  soaks: EFFECTS.splash,
  breaks: EFFECTS.dust,
  grows: EFFECTS.shimmer,
};
