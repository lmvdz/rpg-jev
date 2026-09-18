/**
 * The book of born effects: what the page plays. An effect belongs to an
 * element and to something happening to it (it burns, it fumes, it is struck),
 * and it is decided once for that pair, never per instance or per occurrence:
 *
 * - the first time the pair is met, a subject is built from the element's
 *   kind, forms and baseline levels, and a judge is asked in the background;
 * - until it answers, the happening's generic row plays (rule 2);
 * - its answer is drawn from, composed, checked and logged (`birth.ts`), and
 *   from then on every instance of the element shows that row.
 *
 * How hard it is happening is the instance's business and is arithmetic, so
 * it is code: the row is played thinner at low levels.
 */
import { type AskJudge, type BirthLine, Book, type Entry } from "./birth.ts";
import {
  EFFECT_KIND,
  FORMS,
  type Happening,
  KINDS,
  SUBJECT_LEVELS,
  type Subject,
} from "./effect-birth.ts";
import { GENERIC } from "./effect-rows.ts";
import type { EffectRow } from "./effects.ts";
import type { ThingView, VisibleStates } from "./things.ts";

export interface Showing {
  happening: Happening;
  /** How hard, 1 to 5. */
  level: number;
}

const levelOf = (n: number | undefined) => Math.min(Math.max(Math.round(n ?? 0), 0), 5);

/** One rule per visible state, never per thing: what the state means is happening. */
const SHOWING_RULES: readonly ((states: VisibleStates) => Showing | null)[] = [
  (states) => {
    const burning = levelOf(states.burning);
    return burning > 0 ? { happening: "burns", level: burning } : null;
  },
  (states) => {
    const burning = levelOf(states.burning);
    if (burning > 0) return { happening: "fumes", level: burning };
    return levelOf(states.temperature) >= 5 ? { happening: "fumes", level: 1 } : null;
  },
];

/** What is happening to a thing that can be seen. Asked when its states change, not every frame. */
export function showingOf(states: VisibleStates): Showing[] {
  const out: Showing[] = [];
  for (const rule of SHOWING_RULES) {
    const showing = rule(states);
    if (showing) out.push(showing);
  }
  return out;
}

/** What is known of an element, as against an instance of it: what births are decided from. */
export type ElementFacts = Pick<ThingView, "element" | "name" | "kind" | "forms" | "baseline">;

export function kindOf(thing: ElementFacts): (typeof KINDS)[number] | undefined {
  return KINDS.find((known) => known === thing.kind);
}

/** The element's baseline levels that a birth may look at, clamped to the vocabulary's 0 to 5. */
export function baselineOf<K extends string>(
  thing: ElementFacts,
  keys: readonly K[],
): Partial<Record<K, number>> {
  const levels: Partial<Record<K, number>> = {};
  for (const key of keys) {
    const level = thing.baseline?.[key];
    if (typeof level === "number") levels[key] = levelOf(level);
  }
  return levels;
}

/** The subject of a birth: the element as it is whole and mild, and what is happening. No instance's state. */
export function subjectOf(thing: ElementFacts, happening: Happening): Subject {
  const forms = FORMS.filter((form) => thing.forms?.includes(form) === true);
  const kind = kindOf(thing);
  const levels = baselineOf(thing, SUBJECT_LEVELS);
  return { name: thing.name, happening, ...(kind ? { kind } : {}), forms, levels };
}

/** What to play at each level of the happening, 0 to 5. Made once, so playing allocates nothing. */
export type RowsByLevel = readonly (readonly EffectRow[])[];

const NONE: readonly EffectRow[] = [];

function byLevel(row: EffectRow | null): RowsByLevel {
  return [0, 1, 2, 3, 4, 5].map((level) =>
    row === null || level === 0
      ? NONE
      : [{ ...row, rate: Math.max(1, Math.round((row.rate * level) / 5)) }],
  );
}

export class EffectBook {
  readonly #book: Book<Subject, EffectRow, RowsByLevel>;

  constructor(ask: AskJudge, seed: number, log?: BirthLine[]) {
    this.#book = new Book({
      name: "effect",
      kind: EFFECT_KIND,
      ask,
      seed,
      present: byLevel,
      ...(log ? { log } : {}),
    });
  }

  /** Every birth so far, in order: what was chosen and from what odds. */
  get log(): BirthLine[] {
    return this.#book.log;
  }

  restore(lines: readonly BirthLine[]): void {
    this.#book.restore(lines);
  }

  /** The entry for an element and a happening. Keep it: it is filled in place when the row is born. */
  entry(thing: ElementFacts, happening: Happening): Entry<RowsByLevel> {
    const key = `${happening}\n${thing.element}`;
    return this.#book.entry(key, () => subjectOf(thing, happening), GENERIC[happening]);
  }

  settled(): Promise<void> {
    return this.#book.settled();
  }
}
