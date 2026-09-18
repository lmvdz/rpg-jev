/**
 * The book of born effects: what the page plays. An effect belongs to an
 * element and to something happening to it (it burns, it fumes, it is struck),
 * and it is decided once for that pair, never per instance or per occurrence:
 *
 * - the first time the pair is met, a subject is built from the element's
 *   forms and baseline levels, and a judge is asked in the background;
 * - until it answers, the happening's generic row plays (rule 2);
 * - its answer is drawn from with a generator seeded by the pair, composed,
 *   checked and logged (`effect-birth.ts`), and from then on every instance
 *   of the element shows that row. A log that is handed back is replayed, and
 *   those pairs are never asked about again (rule 9).
 *
 * How hard it is happening is the instance's business and is arithmetic, so
 * it is code: the row is played thinner at low levels.
 */
import { Rng } from "@rpg-jev/core/rng";
import {
  type Birth,
  decideEffect,
  effectQuestions,
  FORMS,
  type Happening,
  KINDS,
  type Question,
  replayEffect,
  SUBJECT_LEVELS,
  type Subject,
  sharpen,
} from "./effect-birth.ts";
import { GENERIC } from "./effect-rows.ts";
import type { EffectRow } from "./effects.ts";
import type { ThingView, VisibleStates } from "./things.ts";

/** One request to a judge: every question of a birth at once, answered with odds per option. */
export type AskJudge = (
  subject: Subject,
  questions: readonly Question[],
) => Promise<readonly (readonly number[])[]>;

/** The judge that is always there: code's own priors, taken at their likeliest. */
export const askPriors: AskJudge = (_subject, questions) =>
  Promise.resolve(questions.map((asked) => sharpen(asked.prior)));

/** The same judge, late: to see the generic row hand over to the born one. */
export function delayed(ask: AskJudge, milliseconds: number): AskJudge {
  return (subject, questions) =>
    new Promise((resolve, reject) => {
      setTimeout(() => ask(subject, questions).then(resolve, reject), milliseconds);
    });
}

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

export type ElementFacts = Pick<ThingView, "element" | "name" | "kind" | "forms" | "baseline">;

/** The subject of a birth: the element as it is whole and mild, and what is happening. No instance's state. */
export function subjectOf(thing: ElementFacts, happening: Happening): Subject {
  const levels: Subject["levels"] = {};
  for (const key of SUBJECT_LEVELS) {
    const level = thing.baseline?.[key];
    if (typeof level === "number") levels[key] = levelOf(level);
  }
  const forms = FORMS.filter((form) => thing.forms?.includes(form) === true);
  const kind = KINDS.find((known) => known === thing.kind);
  return { name: thing.name, happening, ...(kind ? { kind } : {}), forms, levels };
}

export interface Entry {
  /** What to play at each level of the happening, 0 to 5. Made once, so playing allocates nothing. */
  rows: readonly (readonly EffectRow[])[];
  /** False while the generic row stands in for an answer still on its way. */
  born: boolean;
}

export interface BirthLine {
  element: string;
  happening: Happening;
  /** The judge did not answer, so the priors did. Such a pair may be asked again some day. */
  fallback: boolean;
  record: Birth["record"];
}

const NONE: readonly EffectRow[] = [];

function byLevel(row: EffectRow | null): readonly (readonly EffectRow[])[] {
  return [0, 1, 2, 3, 4, 5].map((level) =>
    row === null || level === 0
      ? NONE
      : [{ ...row, rate: Math.max(1, Math.round((row.rate * level) / 5)) }],
  );
}

/** FNV-1a: a seed for a pair's draws that depends on nothing but the world's seed and the pair. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

const keyOf = (element: string, happening: Happening) => `${happening}\n${element}`;

export class EffectBook {
  /** Every birth so far, in order: what was chosen and from what odds. */
  readonly log: BirthLine[] = [];
  readonly #entries = new Map<string, Entry>();
  readonly #asked = new Set<Promise<void>>();
  readonly #ask: AskJudge;
  readonly #seed: number;

  constructor(ask: AskJudge, seed: number) {
    this.#ask = ask;
    this.#seed = seed;
  }

  /** Takes births logged earlier: they are replayed as they were chosen, and nobody is asked. */
  restore(lines: readonly BirthLine[]): void {
    for (const line of lines) {
      const row = replayEffect(line.record);
      this.#entries.set(keyOf(line.element, line.happening), { rows: byLevel(row), born: true });
      this.log.push(line);
    }
  }

  /** The entry for an element and a happening. Keep it: it is filled in place when the row is born. */
  entry(thing: ElementFacts, happening: Happening): Entry {
    const key = keyOf(thing.element, happening);
    const known = this.#entries.get(key);
    if (known) return known;
    const entry: Entry = { rows: byLevel(GENERIC[happening]), born: false };
    this.#entries.set(key, entry);
    this.#bear(thing, happening, entry);
    return entry;
  }

  /** Resolves when every question asked so far has been answered. */
  async settled(): Promise<void> {
    await Promise.all(this.#asked);
  }

  #bear(thing: ElementFacts, happening: Happening, entry: Entry): void {
    const subject = subjectOf(thing, happening);
    const questions = effectQuestions(subject);
    const rng = Rng.fromSeed(hash(`${this.#seed}\n${keyOf(thing.element, happening)}`));
    const settle = (answers: readonly (readonly number[])[], fallback: boolean) => {
      const odds = new Map(questions.map((asked, i) => [asked.field, answers[i] ?? []]));
      const birth = decideEffect(
        subject,
        (_subject, asked) => odds.get(asked.field) ?? [],
        () => rng.next(),
      );
      entry.rows = byLevel(birth.row);
      entry.born = true;
      this.log.push({ element: thing.element, happening, fallback, record: birth.record });
    };
    const asked = this.#ask(subject, questions).then(
      (answers) => settle(answers, false),
      () =>
        settle(
          questions.map((q) => sharpen(q.prior)),
          true,
        ),
    );
    this.#asked.add(asked);
    asked.finally(() => this.#asked.delete(asked));
  }
}
