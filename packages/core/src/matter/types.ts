/**
 * Matter: the closed vocabulary of `spikes/vocabulary/VOCABULARY.md` (version 1) as types.
 * An element is a row of levels. A thing is an instance of an element that carries state.
 * Nothing here knows about stones or swords; it knows about hardness and heat.
 *
 * Levels run from 0 to 5 so that each one is a Score question the judge can ratify in one
 * hop. Code compares levels and does all arithmetic (SPEC.md rule 3). Pure: no clock, no
 * randomness; a draw is passed in by whoever logged it.
 */
import type { Need } from "../types.ts";

/** P1 to P24, by word. The ids are kept in `PROPERTIES` for citing. */
export const PROPERTY_KEYS = [
  "mass",
  "size",
  "hardness",
  "toughness",
  "flexibility",
  "flammability",
  "conductivity",
  "meltsAt",
  "absorbency",
  "porosity",
  "buoyancy",
  "solubility",
  "stickiness",
  "friction",
  "perishability",
  "corrodibility",
  "noxiousness",
  "potency",
  "scent",
  "oiliness",
  "swell",
  "setting",
  "cleansing",
] as const;
export type PropertyKey = (typeof PROPERTY_KEYS)[number];
export type Properties = Record<PropertyKey, number>;

export const FORMS = [
  "hollow",
  "flat",
  "long",
  "pointed",
  "edged",
  "round",
  "sheet",
  "cord",
  "granular",
  "liquid",
  "gas",
  "grained",
] as const;
export type Form = (typeof FORMS)[number];

export type Kind = "material" | "thing" | "plant" | "creature" | "person" | "place";

/** The baseline: what the element is like whole, dry, mild and full grown (principle 1). */
export interface Element {
  id: string;
  name: string;
  kind: Kind;
  forms: readonly Form[];
  /** Levels 0 to 5. A property left out is 0. */
  props: Partial<Properties>;
  /** P20: what it gives toward each need, −3 to 3 (needs.ts). */
  serves?: Partial<Record<Need, number>>;
  /** The water it holds when fresh, 0 to 5: a thing of this element is born this wet. */
  moist?: number;
  /** What is left when it has burned. Absent: nothing worth naming. */
  burnsTo?: string;
  /** How it is drawn: closed choices, made once when the element is born (SPEC.md section 19). */
  look?: Look;
  /** What it gives off while it exists. The client picks among its own by visible state. */
  effect?: EffectRow;
  /** The body row, for what lives: levels 0 to 5. A thing that is not alive has none. */
  body?: BodyRow;
}

/** What a living thing can do and notice (vocabulary section 1, the body row). */
export interface BodyRow {
  strength: number;
  speed: number;
  sight: number;
  hearing: number;
  smell: number;
}

/** What a body is aware of from one source: the channel it came by, and how strongly. */
export interface Percept {
  channel: Channel;
  strength: number;
}

/** The client's glyph atlas and 16-entry palette are closed sets, so a look can be ratified. */
export interface Look {
  glyph: number;
  /** Palette index, 0 to 15. */
  ink: number;
  scale: number;
  sways: boolean;
}

export const EFFECT_MOTIONS = ["rise", "fall", "burst", "drift", "orbit", "cling"] as const;
export const EASINGS = ["linear", "in", "out", "inOut", "pulse"] as const;
export const ACTOR_MOTIONS = ["lunge", "hop", "recoil", "shake", "spin"] as const;

/**
 * A particle effect, as closed choices and levels: a mirror of the client's `EffectRow`
 * (packages/client/src/view/effects.ts, which validates with `checkEffect`). One fixed shader
 * plays every row; no shader text is ever generated (SPEC.md rule 5).
 */
export interface EffectRow {
  motion: (typeof EFFECT_MOTIONS)[number];
  /** One to four glyph atlas indices, shown in order over a particle's life. */
  frames: number[];
  /** Palette 0 to 15: at birth, mid life, end. */
  inks: [number, number, number];
  easing: (typeof EASINGS)[number];
  /** Levels 0 to 5; the client turns them into particles, seconds and tiles. */
  rate: number;
  life: number;
  spread: number;
  speed: number;
  sizeFrom: number;
  sizeTo: number;
  glows: boolean;
}

/** What the actor's own glyph does, for an ability row: a mirror of the client's `MotionRow`. */
export interface MotionRow {
  motion: (typeof ACTOR_MOTIONS)[number];
  easing: (typeof EASINGS)[number];
  strength: number;
  duration: number;
}

/** S7: a substance on the surface. Its surface properties show through (M6). */
export interface Coating {
  element: string;
  amount: number;
  /** 0 to 1. */
  coverage: number;
  /** 0 to 5; rises as it dries into something absorbent. */
  bond: number;
}

/** What is burning: the thing itself, or only what coats it. */
export interface Burning {
  of: "self" | "coating";
  /** Minutes of fuel left at the present rate. */
  fuel: number;
}

export interface ThingState {
  /** S1: 0 frozen, 1 cold, 2 mild, 3 warm, 4 hot, 5 scorching. */
  temperature: number;
  /** S2: 0 dry to 5 soaked. */
  wetness: number;
  /** Which liquid it is wet with. Null is water. Oil is not water: it neither rusts nor quenches. */
  wetWith: string | null;
  /** How far the surface runs above the bulk: a thing held in a flame is hot outside first. */
  surfaceAbove: number;
  /** S3. */
  burning: Burning | null;
  /** S4: 5 whole, 3 cracked, 1 broken, 0 in pieces. */
  integrity: number;
  /** S5: keenness, 0 to 5. */
  edge: number;
  /** S7. */
  coating: Coating | null;
  /** S9: living rot, mould and sickness, 0 to 5. */
  contamination: number;
  /** S10. */
  corrosion: number;
  /** S13: a carried dose of noxiousness that is not alive; heat does not remove it. */
  taint: number;
  /** S14. */
  amount: number;
  /** S15: a hidden weakness, found by load and never by looking. */
  flaw: number;
  /** M2: hardness gained, and toughness lost, by cooling fast from hot. */
  temper: number;
  /** M5: it has set for good. */
  set: boolean;
}

export interface Thing {
  id: string;
  element: string;
  place: string;
  /** Where in the place, in tiles. Absent is right here: nothing built before positions changes. */
  where?: readonly [number, number];
  state: ThingState;
}

/** B3. */
export interface Wound {
  depth: number;
  bleeding: number;
  burned: number;
}

export interface Body {
  id: string;
  place: string;
  where?: readonly [number, number];
  /** The row of what it is: its hide and bulk, its strength, its senses. Absent is a person. */
  element?: string;
  /** B7. Absent is alert. */
  attention?: "alert" | "distracted" | "asleep";
  /** What it is aware of now, by source. Written only by sensing. */
  aware?: Record<string, Percept>;
  /** How wet it is, 0 to 5. Absent is dry. */
  wetness?: number;
  /** The things it wears, by id: what keeps the cold off, and what a blow meets first. */
  wears?: string[];
  needs: Partial<Record<Need, number>>;
  /** B2: 0 to 5. */
  health: number;
  wounds: Wound[];
  /** B4: 0 to 5, with `sickensIn` minutes still to run before it shows. */
  sickness: number;
  sickensIn: number;
  /** How much living contamination this eater shrugs off, 0 to 5. A carrion eater's is high. */
  tolerates?: number;
}

/** What a search has settled about a kind of thing in a place (E11). */
export interface Searched {
  minutes: number;
  found: number;
}

export interface Place {
  id: string;
  /** Place states (section 4), 0 to 5. */
  temperature: number;
  moisture: number;
  wind: number;
  /** R6 for the place as a whole: 0 sealed, 5 open air. */
  air: number;
  /** Latent abundance per element, a Score settled once per kind of place. */
  abundance: Record<string, number>;
  searched: Record<string, Searched>;
  /** How light it is (0 dark, 5 noon), how loud, and how much stands in the way. Absent is middling, quiet, open. */
  light?: number;
  noise?: number;
  cover?: number;
  /**
   * How much ground the place is, in patches a person can go over in half an hour. Absent is
   * one. A whole clearing held as one place is many: going over some of it leaves the rest.
   */
  extent?: number;
}

export interface MatterWorld {
  elements: Record<string, Element>;
  things: Record<string, Thing>;
  bodies: Record<string, Body>;
  places: Record<string, Place>;
  /** A counter for the ids of things that come into being; never the present count of things. */
  next: number;
}

/** Principle 5: how the actor acts. Each 0 to 5; 2 is an ordinary try. */
export interface Manner {
  effort: number;
  care: number;
  haste: number;
}

export const ORDINARY: Manner = { effort: 2, care: 2, haste: 2 };

/** What a thing gives off, and `sight`: what is simply seen, by daylight, giving nothing off. */
export type Channel = "light" | "sound" | "scent" | "smoke" | "sight";

/** The effect kinds of section 6. Every change says which vocabulary ids caused it. */
export type Change = (
  | { kind: "state"; thing: string; set: Partial<ThingState> }
  | { kind: "body"; body: string; set: Partial<Omit<Body, "id" | "wounds">> }
  | { kind: "wound"; body: string; wound: Wound }
  | { kind: "treat"; body: string; index: number; set: Partial<Wound> }
  | { kind: "create"; thing: Thing }
  | { kind: "consume"; thing: string; amount: number }
  | { kind: "signal"; place: string; channel: Channel; strength: number; source?: string }
  | { kind: "percept"; body: string; aware: Record<string, Percept> }
  | { kind: "settle"; place: string; element: string; minutes: number; found: number }
  | { kind: "nothing" }
) & {
  because: string[];
  note: string;
  /** Nothing a person standing there would notice. Apply it; do not say it or redraw for it. */
  quiet?: true;
};

export const clamp = (x: number, lo = 0, hi = 5) => Math.min(hi, Math.max(lo, x));

export const FRESH: ThingState = {
  temperature: 2,
  wetness: 0,
  wetWith: null,
  surfaceAbove: 0,
  burning: null,
  integrity: 5,
  edge: 0,
  coating: null,
  contamination: 0,
  corrosion: 0,
  taint: 0,
  amount: 1,
  flaw: 0,
  temper: 0,
  set: false,
};
