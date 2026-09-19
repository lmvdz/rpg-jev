/**
 * Rules that were not written by whoever wrote the engine: proposed by a generative model from
 * scenarios the rules could not produce, checked as data (validate.ts), ratified by the judge,
 * and let in only if every test the engine already passed still passes. They run after the base
 * rules of their process, on the same kernel, and the base rules and their oracles are untouched.
 *
 * Append-only: a row is never edited once play has been logged against it (SPEC.md rule 7).
 */
import type { Expr } from "./expr.ts";
import type { Rule } from "./rules.ts";

export interface Grown {
  readonly rules: readonly Rule[];
  readonly derived: Readonly<Record<string, Expr>>;
}

export const GROWN_DRIFT: Grown = { rules: [], derived: {} };
export const GROWN_HEAT: Grown = { rules: [], derived: {} };
