/**
 * Rules as data, part two: an influence. A rule is an ordered list of alternatives, the first
 * whose conditions hold being the one that acts; an alternative is a conjunction of conditions
 * (so the graph is a hypergraph: several quantities together lead to one effect) and a list of
 * effects on quantities. An effect is one of a closed set of kinds, and the kind is what the
 * kernel (`kernel.ts`) knows how to carry out soundly:
 *
 * - `approach`: a quantity moves toward a target at a rate, in closed form. However the minutes
 *   are cut, the answer is the same, by construction.
 * - `accrue`: a quantity rises or falls at a rate, between bounds. A level stays a level, by
 *   construction. Reaching the lower bound may be an event with effects of its own.
 * - `set`: a quantity is given a value. `put`: a discrete state is switched, or a small record
 *   is laid down whole.
 * - `emit`: something is given off that others may notice. It changes nothing.
 * - `split`: part of a thing comes away as a thing of its own. What the piece has, the parent
 *   loses: nothing is made from nothing, by construction.
 * - `wound`, `seal`: what force and heat do to a body.
 *
 * Nothing here is a function.
 */
import type { Channel } from "../types.ts";
import { type Cond, type Expr, ROOTS } from "./expr.ts";

/** What a change says of itself: the vocabulary it rests on, and what someone would say. */
export interface Said {
  readonly because: readonly string[];
  readonly note: string;
}

export type Literal =
  | string
  | boolean
  | null
  | { readonly [key: string]: string | number | boolean | null };

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
  | { readonly kind: "put"; readonly q: string; readonly value: Literal }
  | ({
      readonly kind: "emit";
      /** The party it comes from. */
      readonly from: string;
      readonly channel: Channel;
      readonly strength: Expr;
    } & Said)
  | ({
      readonly kind: "split";
      readonly from: string;
      /** The piece is named after its parent: `<parent>.<suffix>`. */
      readonly suffix: string;
      /** How much comes away. It is taken from the parent. */
      readonly amount: Expr;
      /** How the piece differs from what its parent was: the rest it inherits. */
      readonly state: Readonly<Record<string, Expr | { readonly value: Literal }>>;
      /** What is said of the parent being the less for it. */
      readonly less: Said;
    } & Said)
  | ({
      readonly kind: "wound";
      readonly on: string;
      readonly depth: Expr;
      readonly bleeding: Expr;
      readonly burned: Expr;
    } & Said)
  /** Every wound that bleeds is closed, and burned by so much more. */
  | ({ readonly kind: "seal"; readonly on: string; readonly burned: Expr } & Said)
) & {
  readonly when?: Cond;
  readonly lo?: Expr;
  readonly hi?: Expr;
  /** The minutes it runs for, where that is not simply the minutes that pass. */
  readonly over?: Expr;
};

export interface Alternative {
  readonly when?: Cond;
  readonly effects: readonly Effect[];
  /** The vocabulary ids this cites, as every change does. None: nothing is said to have happened. */
  readonly because: readonly string[];
  /** Nothing came of it, and that is worth saying: the change is a `nothing`, with this note. */
  readonly nothing?: true;
  /** What someone standing there would say happened: one thing, or one of two by a condition. */
  readonly note?: string | { readonly if: Cond; readonly say: string; readonly otherwise: string };
  readonly quiet?: true;
}

export interface Rule {
  readonly id: string;
  /** What it says, for whoever ratifies it. Never read by the kernel. */
  readonly says: string;
  /** The party whose change this is said to be. Absent: the one the rules are run for. */
  readonly about?: string;
  readonly first: readonly Alternative[];
}

const PATH = new RegExp(`^([a-z]+\\.)?(${ROOTS.join("|")})(\\.|$)`);

/** Every path a rule reads or writes: the nodes it touches, for drawing the graph. */
export function touches(rule: Rule, derived: Readonly<Record<string, Expr>>): string[] {
  const found = new Set<string>();
  const visit = (node: unknown): void => {
    if (typeof node === "string" && PATH.test(node)) {
      if (found.has(node)) return;
      found.add(node);
      if (node.startsWith("d.")) visit(derived[node.slice(2)]);
    } else if (Array.isArray(node)) node.forEach(visit);
    else if (typeof node === "object" && node !== null) Object.values(node).forEach(visit);
  };
  visit(rule.first);
  return [...found].sort();
}
