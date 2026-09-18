/**
 * The effect as a kind of born row (`birth.ts` is the path every such row
 * takes). Nothing here knows any thing: the subject arrives in the
 * vocabulary's own terms (levels, forms, kind, and which process is
 * happening), and the hints say what those suggest: hot things rise and glow,
 * liquids burst and fall, what is struck sheds motes.
 */
import { glyphOfChar, glyphOfExtra } from "../glyph/font.ts";
import { INK } from "../palette.ts";
import {
  asker,
  type Birth,
  decide,
  type Hints,
  type Judge as JudgeOf,
  LEVEL_WEIGHTS,
  LEVELS,
  type Question,
  type RowKind,
  replay,
  YES_NO,
} from "./birth.ts";
import { checkEffect, EASINGS, type EffectRow, MOTIONS } from "./effects.ts";

export { likeliest, type Question, sharpen } from "./birth.ts";

export const HAPPENINGS = [
  "exists",
  "burns",
  "fumes",
  "struck",
  "soaks",
  "breaks",
  "grows",
] as const;
export type Happening = (typeof HAPPENINGS)[number];
export const FORMS = ["liquid", "gas", "granular", "grained", "edged", "hollow", "sheet"] as const;
export const KINDS = ["material", "thing", "plant", "creature", "person", "place"] as const;
export const SUBJECT_LEVELS = ["temperature", "burning", "wetness", "mass", "hardness"] as const;

export interface Subject {
  /** What it is called: generated text, shown to the judge in one labelled field and never parsed. */
  name: string;
  happening: Happening;
  /** What sort of element it is, in the vocabulary's closed list. Absent when it is not known. */
  kind?: (typeof KINDS)[number];
  forms: readonly (typeof FORMS)[number][];
  levels: Partial<Record<(typeof SUBJECT_LEVELS)[number], number>>;
}

/** Families the judge chooses among, so that frames and colours arrive as sets that belong together. */
export const SHAPES = {
  flame: [glyphOfExtra("flame"), glyphOfChar("^"), glyphOfChar("'")],
  puff: [glyphOfChar("o"), glyphOfChar("O"), glyphOfChar("~")],
  spark: [glyphOfChar("*"), glyphOfChar("'"), glyphOfChar(".")],
  drop: [glyphOfChar(","), glyphOfChar(".")],
  mote: [glyphOfChar("."), glyphOfChar(":")],
  shard: [glyphOfChar("/"), glyphOfChar("\\"), glyphOfChar(".")],
  leaf: [glyphOfChar('"'), glyphOfChar(",")],
} as const;

export const RAMPS = {
  fire: [INK.lamp, INK.ember, INK.earth],
  smoke: [INK.slate, INK.stone, INK.ash],
  water: [INK.bone, INK.water, INK.deep],
  earth: [INK.sand, INK.sand, INK.earth],
  stone: [INK.ash, INK.stone, INK.slate],
  growth: [INK.leaf, INK.grass, INK.pine],
  strange: [INK.violet, INK.bone, INK.violet],
} as const;

const comesApart = (s: Subject) => s.happening === "struck" || s.happening === "breaks";

const HINTS: readonly Hints<Subject>[] = [
  {
    when: (s) => s.happening === "burns" || (s.levels.burning ?? 0) > 0,
    hints: [
      ["motion", "rise", 4],
      ["shape", "flame", 4],
      ["ramp", "fire", 5],
      ["glows", "yes", 5],
      ["easing", "out", 2],
      ["rate", "4", 3],
      ["life", "1", 3],
      ["spread", "1", 2],
      ["speed", "3", 2],
      ["sizeFrom", "4", 3],
      ["sizeTo", "1", 3],
    ],
  },
  {
    when: (s) => (s.levels.temperature ?? 2) >= 4,
    hints: [
      ["motion", "rise", 2],
      ["glows", "yes", 1],
      ["ramp", "fire", 1],
    ],
  },
  {
    when: (s) => s.forms.includes("gas") || s.happening === "fumes",
    hints: [
      ["motion", "rise", 3],
      ["shape", "puff", 4],
      ["ramp", "smoke", 3],
      ["easing", "out", 2],
      ["rate", "2", 2],
      ["life", "4", 3],
      ["sizeFrom", "2", 2],
      ["sizeTo", "5", 3],
      ["speed", "1", 2],
    ],
  },
  {
    when: (s) => s.forms.includes("liquid") || s.happening === "soaks",
    hints: [
      ["motion", "burst", 3],
      ["motion", "fall", 2],
      ["shape", "drop", 4],
      ["ramp", "water", 4],
    ],
  },
  {
    when: comesApart,
    hints: [
      ["motion", "burst", 4],
      ["shape", "mote", 2],
      ["ramp", "earth", 2],
      ["rate", "3", 2],
      ["life", "1", 3],
      ["speed", "3", 2],
      ["sizeTo", "1", 2],
      ["easing", "out", 2],
    ],
  },
  {
    when: (s) => (s.levels.hardness ?? 0) >= 4 && s.happening !== "exists",
    hints: [
      ["shape", "spark", 3],
      ["shape", "shard", 2],
      ["ramp", "stone", 3],
    ],
  },
  {
    when: (s) => s.forms.includes("grained") && comesApart(s),
    hints: [
      ["shape", "shard", 3],
      ["ramp", "earth", 2],
    ],
  },
  {
    when: (s) => s.kind === "plant" && (comesApart(s) || s.happening === "grows"),
    hints: [
      ["shape", "leaf", 3],
      ["ramp", "growth", 3],
      ["motion", "fall", 2],
    ],
  },
  {
    when: (s) => s.forms.includes("granular"),
    hints: [
      ["motion", "drift", 3],
      ["shape", "mote", 4],
      ["ramp", "earth", 4],
    ],
  },
  {
    when: (s) => s.happening === "grows",
    hints: [
      ["motion", "orbit", 2],
      ["shape", "leaf", 4],
      ["ramp", "growth", 4],
      ["easing", "pulse", 2],
    ],
  },
  {
    when: (s) => (s.levels.mass ?? 0) >= 4,
    hints: [
      ["motion", "fall", 2],
      ["speed", "1", 1],
    ],
  },
  {
    when: (s) => s.happening === "exists" && (s.levels.burning ?? 0) === 0,
    hints: [["motion", "none", 6]],
  },
];

/** The closed questions for one subject: what a single request to the judge holds. */
export function effectQuestions(s: Subject): Question[] {
  const ask = asker(s, HINTS);
  const level = (field: string, text: string) => ask(field, text, LEVELS, LEVEL_WEIGHTS);
  return [
    ask("motion", "How does what comes off it move?", ["none", ...MOTIONS]),
    ask("shape", "What do the pieces look like?", Object.keys(SHAPES)),
    ask("ramp", "What colours does it pass through?", Object.keys(RAMPS)),
    ask("easing", "How does a piece change size over its life?", EASINGS),
    ask("glows", "Does it give its own light?", YES_NO),
    level("rate", "How much of it is there at once, 0 none to 5 a great deal?"),
    level("life", "How long does a piece last, 0 an instant to 5 several seconds?"),
    level("spread", "How widely does it scatter, 0 not at all to 5 widely?"),
    level("speed", "How fast does it travel, 0 still to 5 very fast?"),
    level("sizeFrom", "How big is a piece when it appears, 0 a speck to 5 large?"),
    level("sizeTo", "How big is a piece when it ends, 0 a speck to 5 large?"),
  ];
}

function rowOf(chosen: ReadonlyMap<string, string>): EffectRow | null {
  const motion = chosen.get("motion");
  if (motion === undefined || motion === "none") return null;
  const level = (field: string) => Number(chosen.get(field) ?? 0);
  const row: EffectRow = {
    motion: motion as EffectRow["motion"],
    frames: SHAPES[chosen.get("shape") as keyof typeof SHAPES] ?? SHAPES.mote,
    inks: RAMPS[chosen.get("ramp") as keyof typeof RAMPS] ?? RAMPS.earth,
    easing: (chosen.get("easing") ?? "linear") as EffectRow["easing"],
    glows: chosen.get("glows") === "yes",
    rate: Math.max(level("rate"), 1),
    life: level("life"),
    spread: level("spread"),
    speed: level("speed"),
    sizeFrom: level("sizeFrom"),
    sizeTo: level("sizeTo"),
  };
  // The last word is code's: a row that is not an effect is no effect.
  return checkEffect(row) === null ? row : null;
}

export const EFFECT_KIND: RowKind<Subject, EffectRow> = {
  questions: effectQuestions,
  compose: rowOf,
};

export type Judge = JudgeOf<Subject>;
export const priorJudge: Judge = (_subject, asked) => asked.prior;

/**
 * Decides a subject's effect. `draw` gives numbers in [0, 1), from the world's
 * logged generator; pass constants only in tests. To take the likeliest option
 * instead of sampling, wrap the judge in `likeliest`.
 */
export const decideEffect = (subject: Subject, judge: Judge, draw: () => number) =>
  decide(EFFECT_KIND, subject, judge, draw);

export const replayEffect = (record: Birth<EffectRow>["record"]) => replay(EFFECT_KIND, record);
