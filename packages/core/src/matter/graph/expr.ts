/**
 * Rules as data, part one: quantities and the arithmetic over them. A rule row may not hold a
 * function, so what a rate or a threshold is has to be sayable in a closed, total, pure form:
 * a number, a path to a quantity, or one of a few operators over those. It always terminates,
 * touches nothing, and survives JSON, so a row can be generated, ratified, stored, versioned
 * and checked without running anyone's code (docs/sandbox-direction.md, "The graph").
 *
 * A quantity is a node of the graph, named by a path. A path may begin with a party (`src.`,
 * `tgt.`); without one it is about the thing the rules are run for. Then:
 *
 * - `p.mass`         an effective property, as it was when the act began
 * - `now.p.mass`     the same, worked out against the state as it is now
 * - `s.wetness`      a state, as the rules so far have left it (`s.burning.fuel` reaches inside)
 * - `was.wetness`    a state, as it was when the act began
 * - `x.surface`      a scratch quantity a rule wrote for a later rule; never part of the world
 * - `b.bleeding`     a number about a party that is a body, given by whoever built the act
 * - `place.air`      the place the party is in
 * - `row.moist`, `row.p.scent`, `row.is.liquid`   the party's own element row
 * - `coat.p.…`, `wetWith.p.…`   the row of what coats it, or of what it is wet with
 * - `act.contact`    a number the act carries; `t` the minutes that pass
 * - `d.damp`         a derived quantity: a named expression over others, said once
 */

export const OPS = {
  add: (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0),
  mul: (xs: readonly number[]) => xs.reduce((a, b) => a * b, 1),
  sub: (xs: readonly number[]) => (xs[0] ?? 0) - (xs[1] ?? 0),
  div: (xs: readonly number[]) => (xs[0] ?? 0) / (xs[1] ?? 1),
  min: (xs: readonly number[]) => Math.min(...xs),
  max: (xs: readonly number[]) => Math.max(...xs),
  pow: (xs: readonly number[]) => (xs[0] ?? 0) ** (xs[1] ?? 1),
  clamp: (xs: readonly number[]) => Math.min(xs[2] ?? 5, Math.max(xs[1] ?? 0, xs[0] ?? 0)),
} as const;
export type Op = keyof typeof OPS;

export type Expr =
  | number
  /** A path to a quantity. */
  | string
  | { readonly op: Op; readonly of: readonly Expr[] }
  | { readonly if: Cond; readonly then: Expr; readonly else: Expr };

export type Cond =
  | { readonly a: Expr; readonly is: "<" | "<=" | ">" | ">="; readonly b: Expr }
  /** The path holds something: not null, not false, not nothing. */
  | { readonly has: string }
  | { readonly lacks: string }
  | { readonly ref: string; readonly equals: string | boolean }
  | { readonly all: readonly Cond[] }
  | { readonly any: readonly Cond[] };

/** The roots a path may have once any party is taken off the front. */
export const ROOTS = [
  "p",
  "now",
  "s",
  "was",
  "x",
  "b",
  "place",
  "row",
  "coat",
  "wetWith",
  "act",
  "t",
  "d",
] as const;
