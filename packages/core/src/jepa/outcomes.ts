/**
 * The outcome vocabulary (`jepa-outcomes-v1`, SPEC section 16, milestone J): what can happen to
 * one thing, as one class on each of eight channels of its state. Classes are code; the model
 * never names a magnitude. "Nothing happens" is `same` on every channel.
 */
import type { Thing } from "../matter/types.ts";

export const OUTCOMES_VERSION = "jepa-outcomes-v1";

export const CHANNELS = [
  { name: "heat", classes: ["cooler", "same", "warmer"] },
  { name: "wet", classes: ["drier", "same", "wetter"] },
  { name: "fire", classes: ["same", "lit", "out"] },
  { name: "whole", classes: ["same", "damaged"] },
  { name: "coat", classes: ["same", "gained", "lost"] },
  { name: "rot", classes: ["less", "same", "more"] },
  { name: "rust", classes: ["same", "more"] },
  { name: "amount", classes: ["same", "less", "gone"] },
] as const;

export type Channel = (typeof CHANNELS)[number]["name"];
export type ClassOf<C extends Channel> = Extract<
  (typeof CHANNELS)[number],
  { name: C }
>["classes"][number];

/** One class index per channel, in `CHANNELS` order. */
export type Outcome = readonly number[];

/** The index of `same` on each channel. */
export const SAME: readonly number[] = CHANNELS.map((c) =>
  (c.classes as readonly string[]).indexOf("same"),
);

export const NONE: Outcome = SAME;

/** Every class of every channel, flat: the model's logits come in this order. */
export const CLASS_NAMES: readonly string[] = CHANNELS.flatMap((c) =>
  c.classes.map((k) => `${c.name}.${k}`),
);

/** Where each channel's classes start in `CLASS_NAMES`. */
export const CLASS_OFFSETS: readonly number[] = CHANNELS.map((_, i) =>
  CHANNELS.slice(0, i).reduce((n, c) => n + c.classes.length, 0),
);

export const VOCABULARY_SIZE = CHANNELS.reduce((n, c) => n * c.classes.length, 1);

/** Mixed-radix id of an outcome, channel 0 most significant. */
export function outcomeId(outcome: Outcome): number {
  return CHANNELS.reduce((id, c, i) => id * c.classes.length + (outcome[i] ?? 0), 0);
}

export function outcomeOf(id: number): Outcome {
  const out: number[] = [];
  let rest = id;
  for (let i = CHANNELS.length - 1; i >= 0; i--) {
    const n = CHANNELS[i]?.classes.length ?? 1;
    out[i] = rest % n;
    rest = Math.floor(rest / n);
  }
  return out;
}

export const classIndex = <C extends Channel>(channel: C, name: ClassOf<C>): number => {
  const c = CHANNELS.find((x) => x.name === channel);
  return (c?.classes as readonly string[] | undefined)?.indexOf(name) ?? -1;
};

/** A level has moved when it changes by more than this. */
export const MOVED = 0.05;

function signed(before: number, after: number, down: number, up: number, same: number) {
  if (after > before + MOVED) return up;
  if (after < before - MOVED) return down;
  return same;
}

function coatClass(before: Thing, after: Thing): number {
  const [b, a] = [before.state.coating, after.state.coating];
  if (!b && a) return 1;
  if (b && !a) return 2;
  if (!(b && a)) return 0;
  if (a.element !== b.element || a.amount > b.amount + MOVED) return 1;
  if (a.amount < b.amount - MOVED) return 2;
  return 0;
}

/** What happened to a thing, read off its state before and after. Absent after: it is gone. */
export function classify(before: Thing, after: Thing | undefined): Outcome {
  if (!after) return SAME.map((s, i) => (CHANNELS[i]?.name === "amount" ? 2 : s));
  const [b, a] = [before.state, after.state];
  let fire = 0;
  if (!b.burning && a.burning) fire = 1;
  else if (b.burning && !a.burning) fire = 2;
  return [
    signed(b.temperature, a.temperature, 0, 2, 1),
    signed(b.wetness, a.wetness, 0, 2, 1),
    fire,
    a.integrity < b.integrity - MOVED ? 1 : 0,
    coatClass(before, after),
    signed(b.contamination, a.contamination, 0, 2, 1),
    a.corrosion > b.corrosion + MOVED ? 1 : 0,
    a.amount < b.amount - 1e-6 ? 1 : 0,
  ];
}

const WORDS: Record<string, string> = {
  "heat.cooler": "it gets cooler",
  "heat.warmer": "it gets warmer",
  "wet.drier": "it gets drier",
  "wet.wetter": "it gets wetter",
  "fire.lit": "it catches fire",
  "fire.out": "its fire goes out",
  "whole.damaged": "it is damaged",
  "coat.gained": "it gets coated",
  "coat.lost": "its coating comes off",
  "rot.less": "it gets cleaner of rot",
  "rot.more": "it rots or grows mould",
  "rust.more": "it rusts or corrodes",
  "amount.less": "some of it is used up or lost",
  "amount.gone": "it is used up entirely",
};

/** The outcome in plain words, one clause per channel that moves. Code renders; no model does. */
export function describeOutcome(outcome: Outcome): string {
  const clauses = CHANNELS.flatMap((c, i) => {
    const k = outcome[i] ?? 0;
    if (k === SAME[i]) return [];
    return [WORDS[`${c.name}.${c.classes[k]}`] ?? `${c.name} ${c.classes[k]}`];
  });
  return clauses.length === 0 ? "nothing happens to it" : clauses.join(", ");
}
