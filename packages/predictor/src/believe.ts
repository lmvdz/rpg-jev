/**
 * Jev's check on a proposed label, through the admitted `believe_claim` family exactly as built
 * in `@rpg-jev/jev` (SPEC section 14): each claim is heard by its own code-built listener, both
 * wordings are asked, and several listeners share one request (M0 test 4: knowledge isolation
 * holds in a batched scene). Every call is metered into a ledger that refuses to cross the
 * milestone's budget (SPEC section 16: at most $1.00; this stops at $0.95).
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { believeClaim, buildRequest, type Judge, USD_PER_INPUT_TOKEN } from "@rpg-jev/jev";
import { listener } from "./label.ts";

export const BUDGET_USD = 0.95;
const PER_REQUEST = 6;

export interface Ledger {
  calls: number;
  inputTokens: number;
  usd: number;
  runs: { at: string; purpose: string; calls: number; usd: number }[];
}

export function readLedger(path: string): Ledger {
  if (!existsSync(path)) return { calls: 0, inputTokens: 0, usd: 0, runs: [] };
  return JSON.parse(readFileSync(path, "utf8")) as Ledger;
}

export class BudgetExceeded extends Error {}

export interface Belief {
  claim: string;
  wordings: [number, number];
  mean: number;
}

type Json = Parameters<typeof buildRequest>[0];

/** Ask the judge about many claims, six listeners to a request, both wordings each. */
export async function believe(
  judge: Judge,
  claims: readonly string[],
  ledgerPath: string,
  purpose: string,
): Promise<Belief[]> {
  const ledger = readLedger(ledgerPath);
  const run = { at: new Date().toISOString(), purpose, calls: 0, usd: 0 };
  ledger.runs.push(run);
  const out: Belief[] = [];
  try {
    for (let i = 0; i < claims.length; i += PER_REQUEST) {
      const batch = claims.slice(i, i + PER_REQUEST);
      // Estimate before asking: about 700 tokens a listener, at list price.
      if (ledger.usd + batch.length * 700 * USD_PER_INPUT_TOKEN > BUDGET_USD)
        throw new BudgetExceeded(`Jev budget reached at $${ledger.usd.toFixed(4)}`);
      const state: Record<string, unknown> = {};
      const questions: Record<string, ReturnType<typeof believeClaim>> = {};
      batch.forEach((claim, j) => {
        state[`l${j}`] = listener(claim);
        questions[`l${j}v0`] = believeClaim(`l${j}`, 0.5, 0);
        questions[`l${j}v1`] = believeClaim(`l${j}`, 0.5, 1);
      });
      const response = await judge.ask(
        buildRequest(state as Json, `believe-${purpose}-${i}`, questions),
      );
      const usd = response.inputTokens * USD_PER_INPUT_TOKEN;
      ledger.calls++;
      ledger.inputTokens += response.inputTokens;
      ledger.usd += usd;
      run.calls++;
      run.usd += usd;
      batch.forEach((claim, j) => {
        const p = (id: string) => {
          const a = response.answers[id];
          return a?.type === "noul" ? a.noul : 0.5;
        };
        const wordings: [number, number] = [p(`l${j}v0`), p(`l${j}v1`)];
        out.push({ claim, wordings, mean: (wordings[0] + wordings[1]) / 2 });
      });
    }
  } finally {
    writeFileSync(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`);
  }
  return out;
}
