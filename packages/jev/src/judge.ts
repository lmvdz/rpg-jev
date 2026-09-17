/**
 * The judge port. Everything that asks Jev goes through `Judge.ask`, so the
 * live client, the recorded fake and the outage path are interchangeable.
 */
import { hashValue, type JudgeAnswer } from "@rpg-jev/core";

export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
export type JsonObject = { [key: string]: Json };

/** The eight M2 question families (SPEC.md section 14). No others may be asked. */
export const FAMILIES = [
  "parse_intent",
  "pick_action",
  "pick_speech_act",
  "believe_claim",
  "stake_in_claim",
  "pick_distortion",
  "quest_guard",
  "accept_offer",
] as const;
export type Family = (typeof FAMILIES)[number];

export type WireQuestion =
  | { type: "noul"; instructions: Json; criteria: { true: Json; false: Json } }
  | { type: "choice"; instructions: Json; criteria: { [label: string]: Json } };

/**
 * A question plus what code does when the judge cannot be reached. The
 * fallback is built where the question is built, because only that code knows
 * what a sensible default is (SPEC.md section 11).
 */
export interface Asked {
  family: Family;
  question: WireQuestion;
  fallback: JudgeAnswer;
}

export interface JudgeRequest {
  /** Hash of state and questions. Recorded answers are keyed by it. */
  id: string;
  sliceHash: string;
  state: JsonObject;
  questions: Record<string, Asked>;
}

export interface JudgeResponse {
  answers: Record<string, JudgeAnswer>;
  source: "jev" | "cache" | "fallback";
  inputTokens: number;
  latencyMs: number;
}

export interface Judge {
  ask(request: JudgeRequest): Promise<JudgeResponse>;
}

export class JudgeUnavailable extends Error {}

export const MODEL = "jev-1.13.0";
/** List price in US dollars per input token; output is free (SPEC.md section 11). */
export const USD_PER_INPUT_TOKEN = 0.042 / 1_000_000;

export function wireQuestions(questions: Record<string, Asked>): Record<string, WireQuestion> {
  return Object.fromEntries(Object.entries(questions).map(([id, q]) => [id, q.question]));
}

export function buildRequest(
  state: JsonObject,
  sliceHash: string,
  questions: Record<string, Asked>,
): JudgeRequest {
  const id = `${sliceHash}.${hashValue(wireQuestions(questions))}`;
  return { id, sliceHash, state, questions };
}

export function noulFallback(noul: number): JudgeAnswer {
  return { type: "noul", noul };
}

/** A fallback Choice that puts all its mass on the option code would take. */
export function choiceFallback(choice: string, labels: readonly string[]): JudgeAnswer {
  const probabilities = Object.fromEntries(labels.map((l) => [l, l === choice ? 1 : 0]));
  return { type: "choice", choice, confidence: 1, probabilities };
}

export function fallbackResponse(request: JudgeRequest): JudgeResponse {
  const answers = Object.fromEntries(
    Object.entries(request.questions).map(([id, q]) => [id, q.fallback]),
  );
  return { answers, source: "fallback", inputTokens: 0, latencyMs: 0 };
}

/**
 * Keeps the game running when the judge does not answer (SPEC.md rule 2). A
 * failure returns the code-built fallbacks, and the breaker then skips the
 * network for a while so an outage costs one timeout, not one per action.
 */
export class ResilientJudge implements Judge {
  readonly #inner: Judge;
  readonly #coolOff: number;
  #skip = 0;
  failures = 0;
  lastError: string | null = null;

  constructor(inner: Judge, coolOffCalls = 8) {
    this.#inner = inner;
    this.#coolOff = coolOffCalls;
  }

  get down(): boolean {
    return this.#skip > 0;
  }

  async ask(request: JudgeRequest): Promise<JudgeResponse> {
    if (this.#skip > 0) {
      this.#skip -= 1;
      return fallbackResponse(request);
    }
    try {
      return await this.#inner.ask(request);
    } catch (error) {
      this.failures += 1;
      this.lastError = error instanceof Error ? error.message : String(error);
      this.#skip = this.#coolOff;
      return fallbackResponse(request);
    }
  }
}

/** Never reaches anything. Stands in for "network off, key missing". */
export class OfflineJudge implements Judge {
  ask(): Promise<JudgeResponse> {
    return Promise.reject(new JudgeUnavailable("the judge is offline"));
  }
}

/** Same request in one session, same answer, no second call. */
export class CachingJudge implements Judge {
  readonly #inner: Judge;
  readonly #seen = new Map<string, JudgeResponse>();

  constructor(inner: Judge) {
    this.#inner = inner;
  }

  async ask(request: JudgeRequest): Promise<JudgeResponse> {
    const hit = this.#seen.get(request.id);
    if (hit) return { ...hit, source: "cache", inputTokens: 0, latencyMs: 0 };
    const response = await this.#inner.ask(request);
    if (response.source === "jev") this.#seen.set(request.id, response);
    return response;
  }
}
