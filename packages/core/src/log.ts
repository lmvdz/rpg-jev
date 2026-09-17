/**
 * The event log is the save file (SPEC.md section 13). `Store` is the single
 * write path: an effect is validated, appended to the log, then applied.
 * Decisions and RNG draws are logged too, so a replay never asks a model.
 */
import { applyEffect, type Effect, validateEffect } from "./effects.ts";
import { Rng, type RngState } from "./rng.ts";
import type { LogId, Minute, World } from "./types.ts";

export type JudgeAnswer =
  | { type: "noul"; noul: number }
  | { type: "choice"; choice: string; confidence: number; probabilities: Record<string, number> };

interface Base {
  id: LogId;
  t: Minute;
  /** The entry that led to this one. */
  cause: LogId | null;
}

export type LogEntry = Base &
  (
    | { kind: "init"; seed: number; content: string }
    | { kind: "input"; text: string; via: string; action: unknown }
    | { kind: "stimulus"; what: string; data: Record<string, string> }
    | {
        kind: "decision";
        requestId: string;
        sliceHash: string;
        source: "jev" | "cache" | "fallback";
        answers: Record<string, JudgeAnswer>;
        inputTokens: number;
        latencyMs: number;
      }
    | { kind: "draw"; purpose: string; value: number; rng: RngState }
    | { kind: "effect"; effect: Effect }
    | { kind: "rejected"; effect: unknown; reasons: string[] }
    | { kind: "dropped"; what: string; reasons: string[] }
  );

export type LogEntryKind = LogEntry["kind"];
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type LogBody = DistributiveOmit<LogEntry, "id" | "t" | "cause">;

export class EffectRejected extends Error {
  readonly reasons: string[];
  constructor(reasons: string[]) {
    super(`effect rejected: ${reasons.join("; ")}`);
    this.reasons = reasons;
  }
}

export class Store {
  readonly world: World;
  readonly log: LogEntry[];

  constructor(world: World, log: LogEntry[] = []) {
    this.world = world;
    this.log = log;
  }

  append(body: LogBody, cause: LogId | null): LogId {
    const id = this.log.length;
    this.log.push({ ...body, id, t: this.world.clock, cause } as LogEntry);
    return id;
  }

  /** Validate, log, apply. An illegal effect is logged as rejected and changes nothing. */
  tryCommit(effect: Effect, cause: LogId | null): LogId | null {
    const reasons = validateEffect(this.world, effect);
    if (reasons.length > 0) {
      this.append({ kind: "rejected", effect, reasons }, cause);
      return null;
    }
    const id = this.append({ kind: "effect", effect }, cause);
    applyEffect(this.world, effect, id);
    return id;
  }

  /** As `tryCommit`, for effects that code built itself and that must be legal. */
  commit(effect: Effect, cause: LogId | null): LogId {
    const id = this.tryCommit(effect, cause);
    if (id === null) {
      const last = this.log[this.log.length - 1];
      throw new EffectRejected(last?.kind === "rejected" ? last.reasons : ["unknown"]);
    }
    return id;
  }

  /** One logged draw from the world's RNG, uniform in [0, 1). */
  draw(purpose: string, cause: LogId | null): number {
    const rng = Rng.fromState(this.world.rng);
    const value = rng.next();
    this.world.rng = rng.state;
    this.append({ kind: "draw", purpose, value, rng: rng.state }, cause);
    return value;
  }
}

/**
 * Rebuilds a world from its log with no model and no RNG: effects are applied
 * as recorded and each draw restores the RNG state it left behind.
 */
export function replay(initial: World, log: readonly LogEntry[]): World {
  const world = structuredClone(initial);
  for (const entry of log) {
    if (entry.kind === "effect") {
      const reasons = validateEffect(world, entry.effect);
      if (reasons.length > 0)
        throw new Error(`log entry ${entry.id} no longer validates: ${reasons.join("; ")}`);
      applyEffect(world, entry.effect, entry.id);
    } else if (entry.kind === "draw") {
      world.rng = entry.rng;
    }
  }
  return world;
}

export function serializeLog(log: readonly LogEntry[]): string {
  return log.map((e) => JSON.stringify(e)).join("\n");
}

export function parseLog(text: string): LogEntry[] {
  return text
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line) as LogEntry);
}

/** Walks `cause` pointers from an entry back to its root, nearest first. */
export function causeChain(log: readonly LogEntry[], from: LogId): LogEntry[] {
  const chain: LogEntry[] = [];
  let at: LogId | null = from;
  while (at !== null && chain.length < 64) {
    const entry: LogEntry | undefined = log[at];
    if (!entry) break;
    chain.push(entry);
    at = entry.cause;
  }
  return chain;
}
