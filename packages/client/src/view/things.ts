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
import { GLYPH_GLOWS, GLYPH_SWAYS, type GlyphLook, SCALE_ONE } from "../glyph/batch.ts";
import { INK } from "../palette.ts";

export interface ElementLook {
  glyph: number;
  ink: number;
  /** Size in sixteenths of a glyph pixel step, as `GlyphLook.scale`. */
  scale?: number;
  sways?: boolean;
}

/** Levels as the vocabulary has them. Absent means the thing has no such state. */
export interface VisibleStates {
  /** S3, 0 to 5. */
  burning?: number;
  /** S1, 0 frozen to 5 scorching. */
  temperature?: number;
  /** S12: 0 seed, 1 sprout, 2 growing, 3 mature, 4 bearing, 5 dormant, 6 dead. */
  growth?: number;
  /** S14, 0 to 5: how much of a pile or a substance is left. */
  amount?: number;
  /** S2, 0 dry to 5 soaked. */
  wetness?: number;
  /** S4: 5 whole, 3 cracked, 1 broken, 0 in pieces. */
  integrity?: number;
  /** S10, 0 to 5. */
  corrosion?: number;
  /** S9, 0 to 5: rot and mould, given only once it is strong enough that anyone would notice. */
  contamination?: number;
}

export interface ThingView {
  /** Which instance this is: the world's id for the thing, which changes to it are addressed by. */
  id: string;
  /**
   * Which element this is an instance of: an id made by code. What is decided
   * once for an element (its look, the effect of what happens to it) is kept
   * under it, so every instance shows the same.
   */
  element: string;
  /** What sort of element it is (material, thing, plant, creature...), in the vocabulary's words. */
  kind?: string;
  /** The element's forms, in the vocabulary's words. Unknown ones are ignored. */
  forms?: readonly string[];
  /** The element's baseline levels (mass, hardness and the like): what it is like, not how it is now. */
  baseline?: Readonly<Record<string, number>>;
  /**
   * What the element is called. Elements are named when they are born, by a
   * generative model, so this is untrusted text: it is shown as text and
   * never read as markup or as an instruction.
   */
  name: string;
  /** Whether a body can share its tile. The world decides (size, P2); the client only obeys. */
  solid?: boolean;
  x: number;
  z: number;
  /** The element row's look. Absent when the row came without one: the client then bears one for the element. */
  look?: ElementLook;
  states: VisibleStates;
}

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
