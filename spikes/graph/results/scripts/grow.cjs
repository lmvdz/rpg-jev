// Writes graph/grown.ts from an intake's accepted rows. The rows go in as a JSON string: they
// are data, and the engine parses them as data.
const fs = require("node:fs");
const root = "H:/rpg-jev.worktrees/sandbox-matter";
const round = process.argv[2] ?? "round-1";
const empty = process.argv[3] === "empty";
const grown = empty
  ? { drift: { rules: [], derived: {} }, heat: { rules: [], derived: {} } }
  : JSON.parse(fs.readFileSync(`${root}/spikes/graph/results/proposals/${round}.grown.json`, "utf8"));
const lit = (v) => JSON.stringify(JSON.stringify(v));
const out = `/**
 * Rules that were not written by whoever wrote the engine: proposed by a generative model from
 * scenarios the rules could not produce, checked as data (validate.ts), ratified by the judge,
 * and let in only if every test the engine already passed still passes. They run after the base
 * rules of their process, on the same kernel, and the base rules and their oracles are untouched.
 *
 * The rows are JSON and are kept as JSON: nothing here is code. This file is written by the
 * intake (spikes/graph), from \`${round}\`. Append-only: a row is never edited once play has
 * been logged against it (SPEC.md rule 7).
 */
import type { Expr } from "./expr.ts";
import type { Rule } from "./rules.ts";

export interface Grown {
  readonly rules: readonly Rule[];
  readonly derived: Readonly<Record<string, Expr>>;
}

const DRIFT = ${lit(grown.drift)};
const HEAT = ${lit(grown.heat)};

export const GROWN_DRIFT: Grown = JSON.parse(DRIFT);
export const GROWN_HEAT: Grown = JSON.parse(HEAT);
`;
fs.writeFileSync(`${root}/packages/core/src/matter/graph/grown.ts`, out);
console.log(`drift ${grown.drift.rules.length} rules, heat ${grown.heat.rules.length} rules`);
