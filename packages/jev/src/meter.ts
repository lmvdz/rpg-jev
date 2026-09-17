/**
 * Calls, tokens, cost and latency (SPEC.md section 13, telemetry). The meter
 * wraps a judge; the client marks where each player action starts.
 */
import { type Judge, type JudgeRequest, type JudgeResponse, USD_PER_INPUT_TOKEN } from "./judge.ts";

export interface ActionCost {
  label: string;
  calls: number;
  fallbacks: number;
  cached: number;
  questions: number;
  inputTokens: number;
  latencyMs: number;
  usd: number;
}

const blank = (label: string): ActionCost => ({
  label,
  calls: 0,
  fallbacks: 0,
  cached: 0,
  questions: 0,
  inputTokens: 0,
  latencyMs: 0,
  usd: 0,
});

export class Meter implements Judge {
  readonly #inner: Judge;
  readonly actions: ActionCost[] = [];
  readonly callLatencies: number[] = [];
  #current: ActionCost = blank("(before play)");

  constructor(inner: Judge) {
    this.#inner = inner;
  }

  begin(label: string): void {
    this.#current = blank(label);
    this.actions.push(this.#current);
  }

  get current(): ActionCost {
    return this.#current;
  }

  async ask(request: JudgeRequest): Promise<JudgeResponse> {
    const response = await this.#inner.ask(request);
    const c = this.#current;
    if (response.source === "jev") {
      c.calls += 1;
      c.questions += Object.keys(request.questions).length;
      c.inputTokens += response.inputTokens;
      c.latencyMs += response.latencyMs;
      c.usd += response.inputTokens * USD_PER_INPUT_TOKEN;
      this.callLatencies.push(response.latencyMs);
    } else if (response.source === "cache") c.cached += 1;
    else c.fallbacks += 1;
    return response;
  }

  totals(): ActionCost {
    const total = blank("total");
    for (const a of this.actions) {
      total.calls += a.calls;
      total.fallbacks += a.fallbacks;
      total.cached += a.cached;
      total.questions += a.questions;
      total.inputTokens += a.inputTokens;
      total.latencyMs += a.latencyMs;
      total.usd += a.usd;
    }
    return total;
  }
}

export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] ?? 0;
}
