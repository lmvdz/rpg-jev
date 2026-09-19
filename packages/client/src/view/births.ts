/**
 * Everything the page has had born: effects, actors' motions and looks, each
 * a book of its own kind (`birth.ts`) and all writing one log in the order
 * things happened. One judge answers for all three.
 */
import { type AskJudge, type BirthLine, Book, type Entry } from "./birth.ts";
import { baselineOf, EffectBook, type ElementFacts, kindOf } from "./effect-book.ts";
import {
  LOOK_FORMS,
  LOOK_KIND,
  LOOK_LEVELS,
  type LookSubject,
  UNKNOWN_LOOK,
} from "./look-birth.ts";
import { MOTION_KIND, type MotionSubject } from "./motion-birth.ts";
import type { MotionRow } from "./motions.ts";
import type { ElementLook } from "./things.ts";

/** The element as it is whole: what a look is decided from. */
export function lookSubjectOf(thing: ElementFacts): LookSubject {
  const forms = LOOK_FORMS.filter((form) => thing.forms?.includes(form) === true);
  const kind = kindOf(thing);
  return {
    name: thing.name,
    ...(kind ? { kind } : {}),
    forms,
    levels: baselineOf(thing, LOOK_LEVELS),
  };
}

export class Births {
  /** Every birth so far, of every kind, in order: what was chosen and from what odds. */
  readonly log: BirthLine[] = [];
  readonly effects: EffectBook;
  /** Told when an element's look is born, so what shows it can be redrawn. */
  onLook: ((element: string) => void) | null = null;
  readonly #motions: Book<MotionSubject, MotionRow, MotionRow | null>;
  readonly #looks: Book<LookSubject, ElementLook, ElementLook>;

  constructor(ask: AskJudge, seed: number) {
    const { log } = this;
    this.effects = new EffectBook(ask, seed, log);
    this.#motions = new Book({
      name: "motion",
      kind: MOTION_KIND,
      ask,
      seed,
      log,
      present: (row) => row,
    });
    this.#looks = new Book({
      name: "look",
      kind: LOOK_KIND,
      ask,
      seed,
      log,
      present: (row) => row ?? UNKNOWN_LOOK,
      onBorn: (element) => this.onLook?.(element),
    });
  }

  /** Takes a log from an earlier session: each book replays its own lines, and nobody is asked. */
  restore(lines: readonly BirthLine[]): void {
    const mine = this.log.splice(0);
    this.effects.restore(lines);
    this.#motions.restore(lines);
    this.#looks.restore(lines);
    // Each book appended its own lines; put them back in the order they were logged.
    this.log.splice(0, this.log.length, ...mine, ...lines);
  }

  /**
   * How a glyph moves for its part in a process. `body` is the element whose
   * glyph it is, or null for a body that is no element's instance (the hero,
   * until the world has bodies). An ability will name its own row; until
   * abilities exist this is born per process, part and element.
   */
  motion(
    process: MotionSubject["process"],
    part: MotionSubject["part"],
    body: ElementFacts | null,
    generic: MotionRow | null,
  ): Entry<MotionRow | null> {
    const key = `${part}\n${process}\n${body?.element ?? ""}`;
    const subject = (): MotionSubject => ({
      name: body?.name ?? "",
      process,
      part,
      levels: body ? baselineOf(body, ["mass"]) : {},
    });
    return this.#motions.entry(key, subject, generic);
  }

  /** The look of an element that came without one. A question mark stands in until it is born. */
  look(thing: ElementFacts): Entry<ElementLook> {
    return this.#looks.entry(thing.element, () => lookSubjectOf(thing), null);
  }

  async settled(): Promise<void> {
    await Promise.all([this.effects.settled(), this.#motions.settled(), this.#looks.settled()]);
  }
}
