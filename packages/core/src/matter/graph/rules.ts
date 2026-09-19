/**
 * Rules as data, part two: an influence. A rule is an ordered list of alternatives, the first
 * whose conditions hold being the one that acts; an alternative is a conjunction of conditions
 * (so the graph is a hypergraph: several quantities together lead to one effect) and a list of
 * effects on quantities. An effect is one of a closed set of kinds, and the kind is what the
 * kernel knows how to carry out soundly:
 *
 * - `approach`: a quantity moves toward a target at a rate, in closed form. However the minutes
 *   are cut, the answer is the same, by construction.
 * - `accrue`: a quantity rises or falls at a rate, between bounds. A level stays a level, by
 *   construction. Reaching the lower bound may be an event with effects of its own.
 * - `set`: a quantity is given a value, or a discrete state is switched.
 *
 * Nothing here is a function. `run` is the kernel: the one piece of code that every such rule
 * shares, however many rules there come to be.
 */
import type { ThingState } from "../types.ts";
import { type Cond, type Env, type Expr, evaluate, holds } from "./expr.ts";

export type Effect = (
  | { readonly kind: "approach"; readonly q: string; readonly toward: Expr; readonly rate: Expr }
  | {
      readonly kind: "accrue";
      readonly q: string;
      /** Per minute, signed. */
      readonly rate: Expr;
      /** At or below the lower bound (within `eps`) these happen instead, and the quantity is left. */
      readonly atLo?: readonly Effect[];
      readonly eps?: number;
      /** Reaching the lower bound uses the thing up. */
      readonly spends?: true;
    }
  | { readonly kind: "set"; readonly q: string; readonly to: Expr }
  | { readonly kind: "put"; readonly q: string; readonly value: string | boolean | null }
) & {
  readonly when?: Cond;
  readonly lo?: Expr;
  readonly hi?: Expr;
};

export interface Alternative {
  readonly when?: Cond;
  readonly effects: readonly Effect[];
  /** The vocabulary ids this cites, as every change does. */
  readonly because: readonly string[];
}

export interface Rule {
  readonly id: string;
  /** What it says, for whoever ratifies it. Never read by the kernel. */
  readonly says: string;
  readonly first: readonly Alternative[];
}

export interface Ran {
  set: Partial<ThingState>;
  because: string[];
  spent?: boolean;
}

/** Write one quantity of the state by its path, copying what is on the way. */
function write(state: ThingState, path: string, value: unknown): ThingState {
  const [, key = "", inner] = path.split(".");
  const top = state as unknown as Record<string, unknown>;
  if (inner === undefined) return { ...top, [key]: value } as unknown as ThingState;
  const held = top[key];
  if (typeof held !== "object" || held === null) return state;
  return { ...top, [key]: { ...held, [inner]: value } } as unknown as ThingState;
}

function bounded(env: Env, effect: Effect, value: number): number {
  const lo = effect.lo === undefined ? Number.NEGATIVE_INFINITY : evaluate(env, effect.lo);
  const hi = effect.hi === undefined ? Number.POSITIVE_INFINITY : evaluate(env, effect.hi);
  return Math.min(hi, Math.max(lo, value));
}

interface Working {
  env: Env;
  spent: boolean;
}

type Carry<K extends Effect["kind"]> = (w: Working, e: Extract<Effect, { kind: K }>) => void;

/** How each kind of effect is carried out. A new kind is a row here, and a reason to think. */
const KINDS: { [K in Effect["kind"]]: Carry<K> } = {
  approach: (w, e) => {
    const from = evaluate(w.env, e.q);
    const to = evaluate(w.env, e.toward);
    const gone = 1 - Math.exp(-evaluate(w.env, e.rate) * w.env.minutes);
    w.env.s = write(w.env.s, e.q, bounded(w.env, e, from + (to - from) * gone));
  },
  accrue: (w, e) => {
    const next = evaluate(w.env, e.q) + evaluate(w.env, e.rate) * w.env.minutes;
    const floor = e.lo === undefined ? Number.NEGATIVE_INFINITY : evaluate(w.env, e.lo);
    if (e.atLo && next <= floor + (e.eps ?? 0)) {
      for (const then of e.atLo) carry(w, then);
      w.spent ||= e.spends === true;
      return;
    }
    w.env.s = write(w.env.s, e.q, bounded(w.env, e, next));
  },
  set: (w, e) => {
    w.env.s = write(w.env.s, e.q, bounded(w.env, e, evaluate(w.env, e.to)));
  },
  put: (w, e) => {
    w.env.s = write(w.env.s, e.q, e.value);
  },
};

function carry(w: Working, effect: Effect): void {
  if (effect.when && !holds(w.env, effect.when)) return;
  (KINDS[effect.kind] as Carry<typeof effect.kind>)(w, effect);
}

/** What one rule does to one thing over one stretch of minutes. */
export function run(rule: Rule, env: Env): Ran {
  const alt = rule.first.find((a) => !a.when || holds(env, a.when));
  if (!alt) return { set: {}, because: [] };
  const before = env.s;
  const w: Working = { env: { ...env }, spent: false };
  for (const effect of alt.effects) carry(w, effect);
  const set: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(w.env.s))
    if (value !== (before as unknown as Record<string, unknown>)[key]) set[key] = value;
  return {
    set: set as Partial<ThingState>,
    because: [...alt.because],
    ...(w.spent ? { spent: true } : {}),
  };
}

/** Every path a rule reads or writes: the nodes it touches, for drawing the graph. */
export function touches(rule: Rule, derived: Readonly<Record<string, Expr>>): string[] {
  const found = new Set<string>();
  const visit = (node: unknown): void => {
    if (typeof node === "string" && /^(p|s|place|row|coat|wetWith|d|t)(\.|$)/.test(node)) {
      if (found.has(node)) return;
      found.add(node);
      if (node.startsWith("d.")) visit(derived[node.slice(2)]);
    } else if (Array.isArray(node)) node.forEach(visit);
    else if (typeof node === "object" && node !== null) Object.values(node).forEach(visit);
  };
  visit(rule.first);
  return [...found].sort();
}
