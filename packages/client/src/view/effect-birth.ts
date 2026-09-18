/**
 * How an effect is born, rather than written. Nothing here knows any thing:
 * it is given a subject in the vocabulary's own terms (levels, forms, and
 * which process is happening), and from that
 *
 * 1. code builds one closed question per field of the row, each with a "none"
 *    or neutral option, and computes a prior over the options from the
 *    subject's properties (hot things rise and glow, liquids burst and fall);
 * 2. a judge answers each question with a probability per option. Jev is such
 *    a judge: it sees the subject as state and the options as a closed set,
 *    and returns a distribution. `priorJudge` answers with the priors alone,
 *    which is what plays before Jev has answered, and in tests;
 * 3. code picks from each distribution with a logged draw, composes the row,
 *    and checks it. Whatever the judge says, the result is a valid row or none.
 *
 * So the judge supplies meaning (does this look like sparks or like a puff),
 * and every number, every option list and the final say stay in code.
 */
import { glyphOfChar, glyphOfExtra } from "../glyph/font.ts";
import { INK } from "../palette.ts";
import { checkEffect, EASINGS, type EffectRow, MOTIONS } from "./effects.ts";

export const HAPPENINGS = ["exists", "burns", "struck", "soaks", "breaks", "grows"] as const;
export const FORMS = ["liquid", "gas", "granular", "edged", "hollow", "sheet"] as const;
export const SUBJECT_LEVELS = ["temperature", "burning", "wetness", "mass", "hardness"] as const;

export interface Subject {
  /** What it is called: generated text, shown to the judge in one labelled field and never parsed. */
  name: string;
  happening: (typeof HAPPENINGS)[number];
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

const LEVELS = ["0", "1", "2", "3", "4", "5"] as const;
const YES_NO = ["no", "yes"] as const;

export interface Question {
  field: string;
  ask: string;
  options: readonly string[];
  /** Code's own estimate, summing to 1: what the properties alone suggest. */
  prior: number[];
}

type Hint = readonly [field: string, option: string, weight: number];

/** One row per thing code knows how to read off a subject. Weights add; they are not rules of any thing. */
const HINTS: readonly { when(s: Subject): boolean; hints: readonly Hint[] }[] = [
  {
    when: (s) => s.happening === "burns" || (s.levels.burning ?? 0) > 0,
    hints: [
      ["motion", "rise", 4],
      ["shape", "flame", 4],
      ["ramp", "fire", 5],
      ["glows", "yes", 5],
      ["sizeTo", "1", 2],
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
    when: (s) => s.forms.includes("gas"),
    hints: [
      ["motion", "rise", 3],
      ["shape", "puff", 4],
      ["ramp", "smoke", 3],
      ["life", "4", 3],
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
    when: (s) => s.happening === "struck" || s.happening === "breaks",
    hints: [
      ["motion", "burst", 4],
      ["life", "1", 3],
      ["speed", "4", 2],
      ["easing", "out", 2],
    ],
  },
  {
    when: (s) => (s.levels.hardness ?? 0) >= 4 && s.happening !== "exists",
    hints: [
      ["shape", "spark", 3],
      ["shape", "shard", 2],
      ["ramp", "stone", 2],
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

function question(field: string, ask: string, options: readonly string[], s: Subject): Question {
  const weights = options.map(() => 1);
  for (const row of HINTS) {
    if (!row.when(s)) continue;
    for (const [hinted, option, weight] of row.hints) {
      const at = hinted === field ? options.indexOf(option) : -1;
      if (at >= 0) weights[at] = (weights[at] ?? 0) + weight;
    }
  }
  const total = weights.reduce((sum, w) => sum + w, 0);
  return { field, ask, options, prior: weights.map((w) => w / total) };
}

/** The closed questions for one subject: what a single request to the judge holds. */
export function effectQuestions(s: Subject): Question[] {
  const level = (field: string, ask: string) => question(field, ask, LEVELS, s);
  return [
    question("motion", "How does what comes off it move?", ["none", ...MOTIONS], s),
    question("shape", "What do the pieces look like?", Object.keys(SHAPES), s),
    question("ramp", "What colours does it pass through?", Object.keys(RAMPS), s),
    question("easing", "How does a piece change size over its life?", EASINGS, s),
    question("glows", "Does it give its own light?", YES_NO, s),
    level("rate", "How much of it is there at once, 0 none to 5 a great deal?"),
    level("life", "How long does a piece last, 0 an instant to 5 several seconds?"),
    level("spread", "How widely does it scatter, 0 not at all to 5 widely?"),
    level("speed", "How fast does it travel, 0 still to 5 very fast?"),
    level("sizeFrom", "How big is a piece when it appears, 0 a speck to 5 large?"),
    level("sizeTo", "How big is a piece when it ends, 0 a speck to 5 large?"),
  ];
}

/** Answers a question with a probability per option. Jev is one; this one trusts the priors. */
export type Judge = (subject: Subject, question: Question) => readonly number[];
export const priorJudge: Judge = (_subject, asked) => asked.prior;

function pick(options: readonly string[], odds: readonly number[], draw: number): string {
  // A judge's answer is not trusted to be well formed: bad weights count as nothing.
  const clean = options.map((_, i) => {
    const p = odds[i];
    return typeof p === "number" && Number.isFinite(p) && p > 0 ? p : 0;
  });
  const total = clean.reduce((sum, p) => sum + p, 0);
  if (total <= 0) return options[0] ?? "";
  let left = Math.min(Math.max(draw, 0), 0.999999) * total;
  for (let i = 0; i < options.length; i++) {
    left -= clean[i] ?? 0;
    if (left < 0) return options[i] ?? "";
  }
  return options.at(-1) ?? "";
}

export interface Birth {
  /** Null when the judge's answer was that it shows nothing. */
  row: EffectRow | null;
  /** What was chosen for each field and the odds it was chosen from: logged, so it is replayed and never re-asked. */
  record: { field: string; chose: string; odds: readonly number[] }[];
}

/**
 * Decides a subject's effect. `draw` gives numbers in [0, 1), from the world's
 * logged generator; pass `() => 0.5`-like constants only in tests. To take the
 * likeliest option instead of sampling, pass `likeliest`.
 */
export function decideEffect(subject: Subject, judge: Judge, draw: () => number): Birth {
  const record: Birth["record"] = [];
  const chosen = new Map<string, string>();
  for (const asked of effectQuestions(subject)) {
    const odds = judge(subject, asked);
    const chose = pick(asked.options, odds, draw());
    chosen.set(asked.field, chose);
    record.push({ field: asked.field, chose, odds });
  }
  const motion = chosen.get("motion");
  if (motion === undefined || motion === "none") return { row: null, record };
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
  return { row: checkEffect(row) === null ? row : null, record };
}

/** A judge wrapper that takes the likeliest option whatever is drawn: for a world that wants no dice here. */
export function likeliest(judge: Judge): Judge {
  return (subject, asked) => {
    const odds = judge(subject, asked);
    const best = odds.indexOf(Math.max(...odds));
    return asked.options.map((_, i) => (i === best ? 1 : 0));
  };
}
