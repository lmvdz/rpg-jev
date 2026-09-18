/**
 * How a row is born, rather than written: the one path every generated row
 * takes, whatever it is a row of (an effect, an actor's motion, a look).
 * Nothing here knows any thing. A kind of row says which closed questions it
 * is made of and how the answers compose; from a subject in the vocabulary's
 * own terms,
 *
 * 1. code builds one closed question per field, and computes a prior over the
 *    options from the subject's properties, out of a table of hints;
 * 2. a judge answers each question with a probability per option. Jev is such
 *    a judge: it sees the subject as state and the options as a closed set.
 *    The priors alone are a judge too: what plays before Jev has answered;
 * 3. code picks from each distribution with a logged draw, composes the row
 *    and checks it. Whatever the judge says, the result is a valid row or none.
 *
 * So the judge supplies meaning, and every number, every option list and the
 * final say stay in code. A `Book` keeps what was born under a key, asks once,
 * and replays a log without asking at all.
 */
import { Rng } from "@rpg-jev/core/rng";

export interface Question {
  field: string;
  ask: string;
  options: readonly string[];
  /** Code's own estimate, summing to 1: what the properties alone suggest. */
  prior: number[];
}

/** One row per thing code knows how to read off a subject. Weights add; they are not rules of any thing. */
export interface Hints<S> {
  when(subject: S): boolean;
  hints: readonly (readonly [field: string, option: string, weight: number])[];
}

export const LEVELS = ["0", "1", "2", "3", "4", "5"] as const;
export const YES_NO = ["no", "yes"] as const;
/** With nothing known, a level is likelier middling than extreme. */
export const LEVEL_WEIGHTS = [1, 2, 3, 3, 2, 1] as const;

/** Builds the questions of one subject against one table of hints. */
export function asker<S>(subject: S, table: readonly Hints<S>[]) {
  const live = table.filter((row) => row.when(subject));
  return (
    field: string,
    ask: string,
    options: readonly string[],
    base: readonly number[] = [],
  ): Question => {
    const weights = options.map((_, i) => base[i] ?? 1);
    for (const row of live) {
      for (const [hinted, option, weight] of row.hints) {
        const at = hinted === field ? options.indexOf(option) : -1;
        if (at >= 0) weights[at] = (weights[at] ?? 0) + weight;
      }
    }
    const total = weights.reduce((sum, w) => sum + w, 0);
    return { field, ask, options, prior: weights.map((w) => w / total) };
  };
}

/** What a row is made of: its questions, and how the chosen options become a checked row or nothing. */
export interface RowKind<S, R> {
  questions(subject: S): Question[];
  compose(chosen: ReadonlyMap<string, string>): R | null;
}

/** Answers a question with a probability per option. */
export type Judge<S> = (subject: S, question: Question) => readonly number[];

export interface Birth<R> {
  /** Null when the answer was that there is nothing to show. */
  row: R | null;
  /** What was chosen for each field and the odds it was chosen from: logged, so it is replayed and never re-asked. */
  record: { field: string; chose: string; odds: readonly number[] }[];
}

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

/** Decides a subject's row. `draw` gives numbers in [0, 1) from a logged generator. */
export function decide<S, R>(
  kind: RowKind<S, R>,
  subject: S,
  judge: Judge<S>,
  draw: () => number,
): Birth<R> {
  const record: Birth<R>["record"] = [];
  const chosen = new Map<string, string>();
  for (const asked of kind.questions(subject)) {
    const odds = judge(subject, asked);
    const chose = pick(asked.options, odds, draw());
    chosen.set(asked.field, chose);
    record.push({ field: asked.field, chose, odds });
  }
  return { row: kind.compose(chosen), record };
}

/**
 * The row a logged birth gave, without asking anyone again (rule 9). The log
 * is read as untrusted too: a record that no longer makes a row makes nothing.
 */
export function replay<S, R>(kind: RowKind<S, R>, record: Birth<R>["record"]): R | null {
  return kind.compose(new Map(record.map((line) => [line.field, line.chose])));
}

/** All of the odds on the likeliest option, the first of them when several tie. */
export function sharpen(odds: readonly number[]): number[] {
  const best = odds.indexOf(Math.max(...odds));
  return odds.map((_, i) => (i === best ? 1 : 0));
}

/** A judge wrapper that takes the likeliest option whatever is drawn: for a world that wants no dice here. */
export function likeliest<S>(judge: Judge<S>): Judge<S> {
  return (subject, asked) => {
    const sharp = sharpen(judge(subject, asked));
    return asked.options.map((_, i) => sharp[i] ?? 0);
  };
}

/** One request to a judge: every question of a birth at once, answered with odds per option. */
export type AskJudge = (
  subject: unknown,
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

export interface Entry<V> {
  /** What to show: made from the generic row at first, and from the born row once it is there. */
  value: V;
  /** False while the generic row stands in for an answer still on its way. */
  born: boolean;
}

export interface BirthLine {
  /** Which kind of row, and what it was born for. */
  book: string;
  key: string;
  /** The judge did not answer, so the priors did. Such a key may be asked about again some day. */
  fallback: boolean;
  record: Birth<unknown>["record"];
}

/** FNV-1a: a seed for a key's draws that depends on nothing but the book's seed and the key. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

export interface BookOptions<S, R, V> {
  /** The book's name in the log, which several books may share. */
  name: string;
  kind: RowKind<S, R>;
  ask: AskJudge;
  seed: number;
  /** Turns a row, or none, into what is shown. Called once for the generic row and once at birth. */
  present(row: R | null): V;
  /** The log to write births to. Books that share one keep the order things happened in. */
  log?: BirthLine[];
  /** Called when a row is born, for what must be redrawn to show it. */
  onBorn?(key: string): void;
}

/**
 * Rows of one kind, born once per key and kept. Until the judge has answered
 * for a key its generic row stands in (rule 2); a log handed back is replayed
 * and those keys are never asked about again (rule 9).
 */
export class Book<S, R, V> {
  readonly log: BirthLine[];
  readonly #entries = new Map<string, Entry<V>>();
  readonly #asked = new Set<Promise<void>>();
  readonly #options: BookOptions<S, R, V>;

  constructor(options: BookOptions<S, R, V>) {
    this.#options = options;
    this.log = options.log ?? [];
  }

  /** Takes births logged earlier: they are replayed as they were chosen, and nobody is asked. */
  restore(lines: readonly BirthLine[]): void {
    const { name, kind, present } = this.#options;
    for (const line of lines) {
      if (line.book !== name) continue;
      const row = replay(kind, line.record as Birth<R>["record"]);
      this.#entries.set(line.key, { value: present(row), born: true });
      this.log.push(line);
    }
  }

  /** The entry for a key. Keep it: it is filled in place when the row is born. */
  entry(key: string, subject: () => S, generic: R | null): Entry<V> {
    const known = this.#entries.get(key);
    if (known) return known;
    const entry: Entry<V> = { value: this.#options.present(generic), born: false };
    this.#entries.set(key, entry);
    this.#bear(key, subject(), entry);
    return entry;
  }

  /** Resolves when every question asked so far has been answered. */
  async settled(): Promise<void> {
    await Promise.all(this.#asked);
  }

  #bear(key: string, subject: S, entry: Entry<V>): void {
    const { name, kind, ask, seed, present, onBorn } = this.#options;
    const questions = kind.questions(subject);
    const rng = Rng.fromSeed(hash(`${seed}\n${name}\n${key}`));
    const settle = (answers: readonly (readonly number[])[], fallback: boolean) => {
      const odds = new Map(questions.map((asked, i) => [asked.field, answers[i] ?? []]));
      const judge: Judge<S> = (_subject, asked) => odds.get(asked.field) ?? [];
      const birth = decide(kind, subject, judge, () => rng.next());
      entry.value = present(birth.row);
      entry.born = true;
      this.log.push({ book: name, key, fallback, record: birth.record });
      onBorn?.(key);
    };
    const asked = ask(subject, questions).then(
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
