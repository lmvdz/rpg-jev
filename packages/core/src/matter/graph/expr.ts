/**
 * Rules as data, part one: quantities and the arithmetic over them. A rule row may not hold a
 * function, so what a rate or a threshold is has to be sayable in a closed, total, pure form:
 * a number, a reference to a quantity, or one of a dozen operators over those. It always
 * terminates, touches nothing, and survives JSON, so a row can be generated, ratified, stored,
 * versioned and checked without running anyone's code (docs/sandbox-direction.md, "The graph").
 *
 * A quantity is a node of the graph. Base quantities are read from the world by a path
 * (`p.mass`, `s.wetness`, `place.air`). Derived quantities are named expressions over others
 * (`d.damp`), shared by every rule that reads them.
 */
import type { MatterWorld, Place, Properties, Thing, ThingState } from "../types.ts";

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

/** What an expression is read against: one thing, where it is, and the minutes that pass. */
export interface Env {
  world: MatterWorld;
  thing: Thing;
  /** Effective properties, worked out once for the stretch (effective.ts). */
  p: Properties;
  place: Place | undefined;
  minutes: number;
  /** The state as the rules before this one have left it. */
  s: ThingState;
  derived: Readonly<Record<string, Expr>>;
  /** Derived quantities already worked out against `state` (compile.ts). Never read by a rule. */
  memo?: { state: ThingState; values: Map<string, number> };
}

/** What a place is like where the row says nothing. */
const PLACE_DEFAULTS: Record<string, number> = { air: 5, temperature: 2, moisture: 2, wind: 0 };

function walk(from: unknown, path: readonly string[]): unknown {
  let at: unknown = from;
  for (const key of path) {
    if (typeof at !== "object" || at === null) return undefined;
    at = (at as Record<string, unknown>)[key];
  }
  return at;
}

/** An element's raw levels and forms, for what coats a thing or wets it. */
function ofElement(env: Env, id: string | null | undefined, path: readonly string[]): unknown {
  const row = env.world.elements[id ?? ""];
  const [kind, key = ""] = path;
  if (kind === "p") return (row?.props as Record<string, number> | undefined)?.[key] ?? 0;
  if (kind === "is") return (row?.forms as readonly string[] | undefined)?.includes(key) ?? false;
  return (row as Record<string, unknown> | undefined)?.[kind ?? ""] ?? 0;
}

/** Where each kind of path is read from. A new source of quantities is a row here. */
const ROOTS: Record<string, (env: Env, rest: readonly string[]) => unknown> = {
  t: (env) => env.minutes,
  p: (env, rest) => walk(env.p, rest) ?? 0,
  s: (env, rest) => walk(env.s, rest),
  place: (env, rest) => walk(env.place, rest) ?? PLACE_DEFAULTS[rest[0] ?? ""] ?? 0,
  row: (env, rest) => ofElement(env, env.thing.element, rest),
  coat: (env, rest) => ofElement(env, env.s.coating?.element, rest),
  wetWith: (env, rest) => ofElement(env, env.s.wetWith, rest),
  d: (env, rest) => evaluate(env, env.derived[rest[0] ?? ""] ?? 0),
};

export function look(env: Env, path: string): unknown {
  const [root = "", ...rest] = path.split(".");
  return ROOTS[root]?.(env, rest);
}

const present = (v: unknown) => v !== null && v !== undefined && v !== false;

function numberOf(v: unknown): number {
  if (typeof v === "number") return v;
  return v === true ? 1 : 0;
}

const COMPARE = {
  "<": (a: number, b: number) => a < b,
  "<=": (a: number, b: number) => a <= b,
  ">": (a: number, b: number) => a > b,
  ">=": (a: number, b: number) => a >= b,
} as const;

export function holds(env: Env, cond: Cond): boolean {
  if ("all" in cond) return cond.all.every((c) => holds(env, c));
  if ("any" in cond) return cond.any.some((c) => holds(env, c));
  if ("has" in cond) return present(look(env, cond.has));
  if ("lacks" in cond) return !present(look(env, cond.lacks));
  if ("ref" in cond) return look(env, cond.ref) === cond.equals;
  return COMPARE[cond.is](evaluate(env, cond.a), evaluate(env, cond.b));
}

export function evaluate(env: Env, expr: Expr): number {
  if (typeof expr === "number") return expr;
  if (typeof expr === "string") return numberOf(look(env, expr));
  if ("if" in expr) return evaluate(env, holds(env, expr.if) ? expr.then : expr.else);
  return OPS[expr.op](expr.of.map((e) => evaluate(env, e)));
}
