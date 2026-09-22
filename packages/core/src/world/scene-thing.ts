/**
 * The seam between the world and the renderer (SPEC.md section 19,
 * docs/sandbox-direction.md). The sandbox's things are instances of elements
 * that are born in play, so nothing here knows an element by name: a look is
 * chosen once from closed sets (`./glyph-ids.ts`, `./ink.ts`), and what is
 * seen of an instance is a handful of levels (spikes/vocabulary: S3 burning,
 * S1 temperature, S12 growth, S14 amount...).
 *
 * This is data only: what a state does to a look, and the mesh a look draws,
 * are the renderer's rules (`packages/client/src/view/things.ts`).
 */

export interface ElementLook {
  glyph: number;
  ink: number;
  /** Size in sixteenths of a glyph pixel step, as the renderer's `GlyphLook.scale`. */
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
