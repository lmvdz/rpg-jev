/**
 * Milestone J inside the authority (SPEC section 16, P6): the release checkpoint, run in the
 * tick with a deadline, behind this world's mode. Off is the code engine; shadow ranks and logs
 * beside the engine's outcome; live commits the ranked outcome. Replay reads the event log.
 */
import { hashText, matter } from "@rpg-jev/core";
import * as jepa from "@rpg-jev/core/jepa";
import { parseModel, type RuntimeModel, scorerOf } from "@rpg-jev/predictor";
import CHECKPOINT from "../../../predictor/checkpoints/release/runtime.json" with { type: "json" };

/** Pre-registered: a scoring batch past this is abandoned and the tick falls back to code. */
export const DEADLINE_MS = 10;

/** The host's clock, for the deadline and telemetry only; nothing in the world reads it. */
export function clock(): number {
  const p = (globalThis as { performance?: { now(): number } }).performance;
  return p ? p.now() : Date.now();
}

let loaded: { model: RuntimeModel; scorer: ReturnType<typeof scorerOf> } | undefined;

function load() {
  if (!loaded) {
    const model = parseModel(CHECKPOINT);
    loaded = { model, scorer: scorerOf(model, { deadlineMs: DEADLINE_MS, now: clock }) };
  }
  return loaded;
}

export const checkpointId = (): string => load().model.id;

export interface Telemetry {
  scoringMs: number;
  scored: number;
  cached: number;
}

export interface Ranked {
  settle: matter.Settle;
  telemetry: Telemetry;
  /** Close the books on this reducer call. */
  finish: () => Telemetry;
}

export function isMode(mode: string): mode is jepa.Mode {
  return (jepa.MODES as readonly string[]).includes(mode);
}

export function rankedFor(mode: jepa.Mode): Ranked {
  const telemetry: Telemetry = { scoringMs: 0, scored: 0, cached: 0 };
  if (mode === "off") return { settle: matter.ENGINE, telemetry, finish: () => telemetry };
  const { model, scorer } = load();
  const before = { scored: scorer.stats.scored, cached: scorer.stats.cached };
  const timed: jepa.Scorer = (observations, legal) => {
    const started = clock();
    const scores = scorer(observations, legal);
    telemetry.scoringMs += clock() - started;
    return scores;
  };
  return {
    settle: jepa.rankedSettle(mode, timed, model.id),
    telemetry,
    finish: () => {
      telemetry.scored = scorer.stats.scored - before.scored;
      telemetry.cached = scorer.stats.cached - before.cached;
      return telemetry;
    },
  };
}

const NONE_ID = jepa.outcomeId(jepa.NONE);

/**
 * A commit note as it goes in the event log: lossless for replay but compact. The draws are
 * the event's own; the candidate sets are one hash; only choices other than nothing are listed.
 */
export function compactNote(note: unknown) {
  const n = note as jepa.RankedNote;
  const choices = n.record.choices;
  return {
    version: "jepa-note-v1c",
    mode: n.mode,
    process: n.process,
    checkpoint: n.record.checkpoint,
    fallback: n.record.fallback,
    things: n.things,
    agreed: n.agreed,
    candidates: hashText(choices.map((c) => `${c.thing}:${c.candidates}`).join("|")),
    chosen: choices.filter((c) => c.chosen !== NONE_ID).map((c) => [c.thing, c.chosen, c.engine]),
    ...(n.record.broken ? { broken: n.record.broken.slice(0, 16) } : {}),
  };
}
