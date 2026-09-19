/**
 * A look as a kind of born row (`birth.ts`): a glyph of the atlas, a palette
 * colour, a size, whether it sways. The subject is the element as it is whole
 * and mild: its kind, forms and baseline levels. Code shortlists the glyphs by
 * kind, so the judge chooses among a few that could fit and "none"; curated
 * silhouettes sit alongside letters for creatures and people. Which fits is
 * the judge's to say, since only it reads the name.
 *
 * The world's element birth will call this when it makes a row
 * (docs/sandbox-direction.md, "What a row owes the client"); until a row
 * arrives with a look, the client bears one for itself.
 */
import {
  EXTRA_GLYPHS,
  type ExtraGlyph,
  GLYPH_COUNT,
  glyphOfChar,
  glyphOfExtra,
} from "../glyph/font.ts";
import { INK } from "../palette.ts";
import {
  asker,
  type Hints,
  LEVEL_WEIGHTS,
  LEVELS,
  type Question,
  type RowKind,
  YES_NO,
} from "./birth.ts";
import type { KINDS } from "./effect-birth.ts";
import type { ElementLook } from "./things.ts";

export const LOOK_FORMS = [
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
export const LOOK_LEVELS = ["mass", "hardness"] as const;

export interface LookSubject {
  /** What the element is called: generated text, one labelled field, never parsed. */
  name: string;
  kind?: (typeof KINDS)[number];
  forms: readonly (typeof LOOK_FORMS)[number][];
  levels: Partial<Record<(typeof LOOK_LEVELS)[number], number>>;
}

const LOWER = "abcdefghijklmnopqrstuvwxyz".split("");
const UPPER = LOWER.map((letter) => letter.toUpperCase());
const MARKS = ["/", "\\", "|", "(", ")", "[", "]", "{", "}", "!", "=", "&", "$", "u", "o", "^"];
const STUFF = ["*", "%", ":", ".", "~", "=", "#"];

/** Which glyphs could stand for an element of each kind. Anything else is offered every one of them. */
const SHORTLIST: Record<(typeof KINDS)[number], readonly string[]> = {
  plant: ["tree", "pine", "bush", "reed", "stump", "branches", "mushroom", '"', ",", "%"],
  creature: ["creature", ...LOWER, ...UPPER],
  person: ["@", ...UPPER],
  material: ["rock", "stump", "branches", ...STUFF],
  thing: ["flame", "rock", "stump", "branches", "mushroom", "tool", ...MARKS],
  place: ["#", "_", "^", "~"],
};
const EVERY = [...new Set(Object.values(SHORTLIST).flat())];

const isExtra = (name: string): name is ExtraGlyph => EXTRA_GLYPHS.some((extra) => extra === name);
const glyphOf = (option: string) => (isExtra(option) ? glyphOfExtra(option) : glyphOfChar(option));

const has = (s: LookSubject, form: LookSubject["forms"][number]) => s.forms.includes(form);
const mass = (s: LookSubject) => s.levels.mass ?? 2;

const HINTS: readonly Hints<LookSubject>[] = [
  {
    when: (s) => s.kind === "plant",
    hints: [
      ["ink", "leaf", 5],
      ["ink", "grass", 2],
      ["ink", "pine", 2],
      ["sways", "yes", 4],
    ],
  },
  {
    when: (s) => s.kind === "plant" && mass(s) >= 4,
    hints: [
      ["glyph", "tree", 3],
      ["glyph", "pine", 2],
    ],
  },
  {
    when: (s) => s.kind === "plant" && mass(s) >= 2 && mass(s) < 4,
    hints: [["glyph", "bush", 3]],
  },
  {
    when: (s) => s.kind === "plant" && has(s, "long") && has(s, "hollow"),
    hints: [["glyph", "reed", 5]],
  },
  {
    when: (s) => s.kind !== "plant",
    hints: [["sways", "no", 4]],
  },
  {
    when: (s) => (s.levels.hardness ?? 0) >= 4 && s.kind !== "creature" && s.kind !== "person",
    hints: [
      ["glyph", "rock", 3],
      ["ink", "ash", 3],
      ["ink", "stone", 2],
    ],
  },
  {
    when: (s) => has(s, "liquid"),
    hints: [
      ["glyph", "~", 5],
      ["ink", "water", 4],
    ],
  },
  {
    when: (s) => has(s, "granular"),
    hints: [
      ["glyph", ":", 4],
      ["ink", "sand", 3],
    ],
  },
  {
    when: (s) => has(s, "grained"),
    hints: [["ink", "wood", 3]],
  },
  {
    when: (s) => has(s, "edged") || has(s, "pointed"),
    hints: [["glyph", "/", 4]],
  },
  {
    when: (s) => has(s, "long") && s.kind === "thing",
    hints: [["glyph", "|", 3]],
  },
  {
    when: (s) => has(s, "hollow") && s.kind === "thing",
    hints: [["glyph", "u", 4]],
  },
  {
    when: (s) => has(s, "sheet") || has(s, "flat"),
    hints: [["glyph", "=", 3]],
  },
  {
    when: (s) => has(s, "round") && s.kind === "thing",
    hints: [["glyph", "o", 3]],
  },
  {
    when: (s) => s.kind === "creature" || s.kind === "person",
    hints: [
      ["ink", "sand", 2],
      ["ink", "bone", 2],
    ],
  },
  // How big it is drawn follows how heavy it is.
  ...[0, 1, 2, 3, 4, 5].map(
    (level): Hints<LookSubject> => ({
      when: (s) => s.levels.mass === level,
      hints: [["scale", String(level), 5]],
    }),
  ),
];

export function lookQuestions(s: LookSubject): Question[] {
  const ask = asker(s, HINTS);
  const glyphs = s.kind ? SHORTLIST[s.kind] : EVERY;
  return [
    ask("glyph", "Which glyph stands for it?", ["none", ...glyphs]),
    ask("ink", "What colour is it?", Object.keys(INK)),
    ask("scale", "How big is it drawn, 0 tiny to 5 towering?", LEVELS, LEVEL_WEIGHTS),
    ask("sways", "Does it sway in the wind?", YES_NO),
  ];
}

/** Size by level, in sixteenths of a glyph pixel step. */
const SCALES = [8, 12, 16, 18, 24, 28] as const;

/** Why a look is not one, or null when it is. Looks will be generated, so they are checked. */
export function checkLook(look: ElementLook): string | null {
  const whole = (n: unknown) => typeof n === "number" && Number.isInteger(n);
  if (!(whole(look.glyph) && look.glyph >= 0 && look.glyph < GLYPH_COUNT)) {
    return "glyph is not in the atlas";
  }
  if (!(whole(look.ink) && look.ink >= 0 && look.ink < Object.keys(INK).length)) {
    return "ink is not a palette colour";
  }
  if (look.scale !== undefined && !SCALES.some((size) => size === look.scale)) {
    return "scale is not one of the sizes";
  }
  return look.sways === undefined || typeof look.sways === "boolean" ? null : "sways is yes or no";
}

function rowOf(chosen: ReadonlyMap<string, string>): ElementLook | null {
  const glyph = chosen.get("glyph");
  if (glyph === undefined || glyph === "none" || !EVERY.includes(glyph)) return null;
  const ink = INK[chosen.get("ink") as keyof typeof INK];
  const look: ElementLook = {
    glyph: glyphOf(glyph),
    ink: ink ?? INK.bone,
    scale: SCALES[Number(chosen.get("scale") ?? 2)] ?? 16,
    sways: chosen.get("sways") === "yes",
  };
  return checkLook(look) === null ? look : null;
}

export const LOOK_KIND: RowKind<LookSubject, ElementLook> = {
  questions: lookQuestions,
  compose: rowOf,
};

/** What stands for an element until its look is born, or when the judge says none fits. */
export const UNKNOWN_LOOK: ElementLook = { glyph: glyphOfChar("?"), ink: INK.bone };
