/**
 * The first effect rows, written by hand so the schema proves itself before
 * anything generates one, and the rules that say which a thing shows. As with
 * looks, a rule belongs to a visible state and never to a thing: whatever
 * burns flames and smokes. When element and reaction rows carry an `effect`
 * of their own, it is played beside these.
 */
import { glyphOfChar, glyphOfExtra } from "../glyph/font.ts";
import { INK } from "../palette.ts";
import type { EffectRow } from "./effects.ts";
import type { VisibleStates } from "./things.ts";

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

const NONE: readonly EffectRow[] = [];
const SMOULDER: readonly EffectRow[] = [EFFECTS.smoke];
const FIRE: readonly EffectRow[] = [EFFECTS.flames, EFFECTS.smoke];
const BLAZE: readonly EffectRow[] = [EFFECTS.flames, EFFECTS.smoke, EFFECTS.sparks];

/** The effects a thing's visible states call for. The lists are made once, so asking allocates nothing. */
export function effectsOf(states: VisibleStates): readonly EffectRow[] {
  const burning = states.burning ?? 0;
  if (burning >= 4) return BLAZE;
  if (burning >= 2) return FIRE;
  if (burning > 0 || (states.temperature ?? 0) >= 5) return SMOULDER;
  return NONE;
}
