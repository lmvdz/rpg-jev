/**
 * The slice compiler (SPEC.md section 13). Every state sent to the judge is
 * built from a schema with required paths, a token budget and a hash. A slice
 * that outgrows its budget is a bug that a test catches, not a slow leak.
 */
import { hashValue } from "@rpg-jev/core";
import type { Json, JsonObject } from "./judge.ts";

export interface SliceSchema<Ctx> {
  id: string;
  /** Paths such as `npcs.mara.knows` that must exist in the built state. */
  required: (ctx: Ctx) => string[];
  /** Upper bound on estimated tokens for the state this schema builds. */
  budgetTokens: number;
  build: (ctx: Ctx) => JsonObject;
}

export interface Slice {
  schema: string;
  state: JsonObject;
  hash: string;
  tokens: number;
  budgetTokens: number;
}

export class SliceError extends Error {}

/**
 * Estimated input tokens for some JSON. Fitted to the 83 distinct requests of
 * the M0 spike: tokens = 0.355 x characters, plus a fixed 240 per request and
 * 5 per question (RMS error 24 tokens). The per-request part is in
 * `estimateRequestTokens`.
 */
export function estimateTokens(value: Json): number {
  return Math.ceil(JSON.stringify(value).length * 0.355);
}

export function estimateRequestTokens(state: Json, questions: Json, questionCount: number): number {
  return estimateTokens(state) + estimateTokens(questions) + 240 + 5 * questionCount;
}

export function hasPath(state: Json, path: string): boolean {
  let at: Json | undefined = state;
  for (const key of path.split(".")) {
    if (at === null || typeof at !== "object" || Array.isArray(at)) return false;
    at = at[key];
    if (at === undefined) return false;
  }
  return true;
}

export function compileSlice<Ctx>(schema: SliceSchema<Ctx>, ctx: Ctx): Slice {
  const state = schema.build(ctx);
  const missing = schema.required(ctx).filter((path) => !hasPath(state, path));
  if (missing.length > 0)
    throw new SliceError(`slice ${schema.id} is missing ${missing.join(", ")}`);
  const tokens = estimateTokens(state);
  return {
    schema: schema.id,
    state,
    hash: hashValue(state),
    tokens,
    budgetTokens: schema.budgetTokens,
  };
}

export function overBudget(slice: Slice): boolean {
  return slice.tokens > slice.budgetTokens;
}

/** Keeps the first `max` entries of a list that code has already ranked. */
export function topRanked<T>(ranked: readonly T[], max: number): T[] {
  return ranked.slice(0, max);
}
