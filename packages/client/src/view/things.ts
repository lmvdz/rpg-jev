/**
 * The seam between the world and the renderer. The sandbox's things are
 * instances of elements that are born in play (docs/sandbox-direction.md), so
 * the renderer can know none of them by name. It is handed two pieces of data:
 *
 * - a look, chosen once when the element is born, from closed sets: a glyph
 *   of the atlas, a palette colour, a size, whether it sways;
 * - the states of the instance that can be seen (spikes/vocabulary: S3
 *   burning, S1 temperature, S12 growth, S14 amount), as levels.
 *
 * What a state does to the look is a rule here, written once per state and
 * never per thing: whatever burns flickers and gives light, whatever is a
 * seedling is small. A new element needs no renderer change, and a new
 * visible state is one more row.
 */

import type { ElementLook, ThingView, VisibleStates } from "@rpg-jev/core/world";
import {
  GLYPH_DAMAGED,
  GLYPH_GLOWS,
  GLYPH_SWAYS,
  GLYPH_WET,
  type GlyphLook,
  SCALE_ONE,
} from "../glyph/batch.ts";
import { INK } from "../palette.ts";

export type { ElementLook, ThingView, VisibleStates };

export interface LightView {
  radius: number;
  colour: readonly [number, number, number];
  flicker: number;
  /** How far above the thing's foot the light sits. */
  height: number;
}

const GROWTH_SIZE = [0.3, 0.45, 0.7, 1, 1, 1, 1] as const;
const FIRE: readonly [number, number, number] = [1.0, 0.62, 0.28];
const EMBER: readonly [number, number, number] = [0.9, 0.3, 0.12];

/** One rule per visible state: how it changes the glyph. */
const GLYPH_RULES: readonly ((states: VisibleStates, out: Required<GlyphLook>) => void)[] = [
  (states, out) => {
    if (states.growth === undefined) return;
    out.scale *= GROWTH_SIZE[states.growth] ?? 1;
    if (states.growth >= 5) {
      out.ink = states.growth === 6 ? INK.earth : INK.wood;
      out.flags &= ~GLYPH_SWAYS;
    }
  },
  (states, out) => {
    if (states.amount !== undefined) out.scale *= 0.55 + 0.09 * states.amount;
  },
  // Surface colour follows the most apparent decay; heat below takes precedence.
  // No absent state is inferred, and mild/hidden deterioration is not advertised.
  (states, out) => {
    if ((states.corrosion ?? 0) >= 3) out.ink = INK.wood;
    if ((states.contamination ?? 0) >= 3) out.ink = INK.pine;
    if ((states.wetness ?? 0) >= 3) out.flags |= GLYPH_WET;
    if (states.integrity !== undefined && states.integrity <= 3) out.flags |= GLYPH_DAMAGED;
  },
  (states, out) => {
    if ((states.burning ?? 0) > 0) out.flags |= GLYPH_GLOWS;
  },
  (states, out) => {
    if ((states.temperature ?? 0) >= 5 && (states.burning ?? 0) === 0) out.ink = INK.ember;
  },
];

export function glyphLookOf(look: ElementLook, states: VisibleStates): Required<GlyphLook> {
  const out = {
    glyph: look.glyph,
    ink: look.ink,
    flags: look.sways ? GLYPH_SWAYS : 0,
    scale: look.scale ?? SCALE_ONE,
  };
  for (const rule of GLYPH_RULES) rule(states, out);
  out.scale = Math.min(Math.max(Math.round(out.scale), 4), 64);
  return out;
}

/** The light a thing gives, if any: fire by how hard it burns, and a dull glow from anything scorching. */
export function lightOf(states: VisibleStates): LightView | null {
  const burning = Math.min(Math.round(states.burning ?? 0), 5);
  if (burning > 0) return FIRE_LIGHTS[burning] ?? null;
  return (states.temperature ?? 0) >= 5 ? GLOW_LIGHT : null;
}

/** Made once, so asking for a thing's light every frame allocates nothing. */
const FIRE_LIGHTS: readonly LightView[] = [0, 1, 2, 3, 4, 5].map((level) => ({
  radius: 3 + level * 1.6,
  colour: FIRE,
  flicker: 0.35,
  height: 0.6,
}));
const GLOW_LIGHT: LightView = { radius: 2.5, colour: EMBER, flicker: 0.1, height: 0.3 };
