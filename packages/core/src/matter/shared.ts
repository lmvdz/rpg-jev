/**
 * Pure ordinal-tile shared clearing transitions. Authentication, receipts, scheduling,
 * persistence and observer-safe projection belong to the host, not this kernel.
 * Client actions never grant autonomous opportunities or advance shared time.
 */
import { Rng, type RngState } from "../rng.ts";
import { apply } from "./apply.ts";
import { search } from "./body.ts";
import { type Answers, BARE_HANDS, COMPILED, compile, NONE, UNSEEN } from "./compile.ts";
import { routine } from "./intents.ts";
import { able } from "./living.ts";
import { type Act, type Outcome, resolve } from "./resolve.ts";
import { perceive } from "./sense.ts";
import { type Tile, tileDistance } from "./session-terrain.ts";
import type { Body, Change, MatterWorld } from "./types.ts";

export interface SharedState {
  version: 1;
  world: MatterWorld;
  rng: RngState;
  /** Scheduled opportunity boundary, not elapsed seconds or client sequence. */
  tick: number;
}

/** Trusted terrain predicate; must reject blocked/out-of-bounds endpoints.
 * Accept equal endpoints for reach checks as well as cardinal steps.
 */
export type CanStep = (from: Tile, to: Tile) => boolean;

export interface SharedStep {
  state: SharedState;
  ok: boolean;
  reason: string;
  /** Authoritative log data, not an observer-safe public projection. */
  changes: Change[];
  draws: number[];
  /** What a settle other than the engine logged (milestone J's commit records). */
  notes?: unknown[];
}

/** What settling one act produced: the outcome, the RNG after it, its draws, and a log note. */
export interface Settled {
  outcome: Outcome;
  rng: RngState;
  draws: number[];
  note?: unknown;
}

/**
 * How an act becomes changes. The code engine by default. A world may instead rank physical
 * outcomes with a learned model (milestone J, SPEC section 16), which draws from the world's
 * RNG, reports its draws and leaves a note to log; replay reads the log, never the model.
 */
export type Settle = (world: MatterWorld, act: Act, rng: RngState) => Settled;

export const ENGINE: Settle = (world, act, rng) => ({
  outcome: resolve(world, act),
  rng,
  draws: [],
});

export function createSharedState(world: MatterWorld, seed: number): SharedState {
  // The shared host persists this JSON envelope. Use its same representation in
  // memory; SpacetimeDB's JS runtime does not provide structuredClone.
  const copy: MatterWorld = JSON.parse(JSON.stringify(world));
  return {
    version: 1,
    world: apply(copy, perceive(copy, [])),
    rng: Rng.fromSeed(seed).state,
    tick: 0,
  };
}

function rejected(state: SharedState, reason: string): SharedStep {
  return { state, ok: false, reason, changes: [], draws: [] };
}

function tile(value: unknown): value is Tile {
  return Array.isArray(value) && value.length === 2 && value.every(Number.isSafeInteger);
}

function actorOf(state: SharedState, actor: string): Body | undefined {
  const body = Object.hasOwn(state.world.bodies, actor) ? state.world.bodies[actor] : undefined;
  return body && tile(body.where) && body.health > 0 && body.attention !== "asleep"
    ? body
    : undefined;
}

function available(world: MatterWorld, body: Body, id: string, canStep: CanStep): boolean {
  const thing = Object.hasOwn(world.things, id) ? world.things[id] : undefined;
  const other = Object.hasOwn(world.bodies, id) ? world.bodies[id] : undefined;
  const target = thing ?? other;
  if (!(target && tile(target.where) && body.where) || target.place !== body.place) return false;
  if (
    Object.values(world.bodies).some((other) => other.id !== body.id && other.holds?.includes(id))
  )
    return false;
  const held = body.holds?.includes(id);
  return (
    !!(held || body.aware?.[id]) &&
    tileDistance(body.where, target.where) <= 1 &&
    canStep(body.where, target.where)
  );
}

function commit(
  state: SharedState,
  act: Act,
  rng = state.rng,
  draws: number[] = [],
  settle: Settle = ENGINE,
): SharedStep {
  const settled = settle(state.world, act, rng);
  const outcome = settled.outcome;
  if (outcome.changes.some((c) => c.kind === "nothing")) return rejected(state, "unavailable");
  return {
    state: { ...state, world: outcome.world, rng: settled.rng },
    ok: true,
    reason: "accepted",
    changes: outcome.changes,
    draws: [...draws, ...settled.draws],
    ...(settled.note === undefined ? {} : { notes: [settled.note] }),
  };
}

export function sharedMove(
  state: SharedState,
  actor: string,
  to: Tile,
  canStep: CanStep,
): SharedStep {
  const body = actorOf(state, actor);
  if (!body?.where) return rejected(state, "actor-unavailable");
  if (!tile(to) || tileDistance(body.where, to) !== 1 || !canStep(body.where, to))
    return rejected(state, "invalid-step");
  const speed = able(state.world, body).speed;
  if (!(Number.isFinite(speed) && speed > 0)) return rejected(state, "immobile");
  return commit(state, { process: "move", body: actor, to, minutes: 2 / (speed * 4) });
}

const CHOICES: Record<string, readonly string[]> = {
  effort: [NONE, "what is at hand", "a quick look", "a thorough search"],
  aim: [NONE, "through it", "along the grain", "on the surface"],
  care: [NONE, "carelessly", "ordinarily", "with care"],
  haste: [NONE, "unhurried", "ordinarily", "in a rush"],
  duration: [NONE, "a moment", "a while", "until it is done"],
  amount: [NONE, "a little", "some", "all of it"],
};

function record(value: unknown, limit: number): value is Record<string, string> {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length <= limit &&
    Object.entries(value).every(
      ([key, v]) => key.length <= 128 && typeof v === "string" && v.length <= 256,
    )
  );
}

function validAnswers(answers: Record<string, string>): boolean {
  const fields = ["process", "patient", "instrument", "kind", ...Object.keys(CHOICES)];
  return (
    Object.keys(answers).every((k) => fields.includes(k)) &&
    Object.entries(CHOICES).every(([key, choices]) => {
      const answer = answers[key];
      return answer === undefined || choices.includes(answer);
    })
  );
}

function actTargets(act: Act): string[] {
  switch (act.process) {
    case "force":
      return [act.instrument, act.patient];
    case "heat":
      return [act.source, act.target];
    case "soak":
      return [act.liquid, act.target];
    case "coat":
      return [act.substance, act.target];
    case "ingest":
    case "take":
      return [act.thing];
    default:
      return [];
  }
}

function validOperands(
  world: MatterWorld,
  body: Body,
  answers: Record<string, string>,
  operands: Record<string, string>,
  canStep: CanStep,
): boolean {
  const hands = `${body.id}.hands`;
  const hasHands = body.holds?.includes(hands) && available(world, body, hands, canStep);
  const validOption = (option: string | undefined, patient: boolean) => {
    if (option === NONE) return true;
    if (patient && option === UNSEEN) return answers.process === "X8";
    if (option === BARE_HANDS) return hasHands;
    if (!option) return false;
    return (
      Object.hasOwn(operands, option) ||
      (patient &&
        answers.process === "X2" &&
        Object.hasOwn(world.bodies, option) &&
        available(world, body, option, canStep))
    );
  };
  const fallback = answers.process === "X2" && answers.instrument === NONE;
  return !!(
    validOption(answers.patient, true) &&
    validOption(answers.instrument, false) &&
    (!fallback || hasHands)
  );
}

export function sharedAct(
  state: SharedState,
  actor: string,
  answers: Record<string, string>,
  operands: Record<string, string>,
  canStep: CanStep,
  settle: Settle = ENGINE,
): SharedStep {
  const body = actorOf(state, actor);
  if (!body?.where) return rejected(state, "actor-unavailable");
  if (!(record(answers, 10) && record(operands, 64))) return rejected(state, "malformed");
  if (!canStep(body.where, body.where)) return rejected(state, "invalid-position");
  // Waiting is a scheduler concern: a player cannot accelerate every body's decay.
  if (!COMPILED.includes(answers.process ?? "") || answers.process === "X7")
    return rejected(state, "unsupported");
  if (!validAnswers(answers)) return rejected(state, "malformed");
  if (!validOperands(state.world, body, answers, operands, canStep))
    return rejected(state, "operand-unavailable");
  if (answers.kind && answers.kind !== NONE && !Object.hasOwn(state.world.elements, answers.kind))
    return rejected(state, "malformed");
  const normalized = Object.fromEntries(Object.keys(CHOICES).map((k) => [k, NONE]));
  const rng = Rng.fromState(state.rng);
  const draws = answers.process === "X8" ? [rng.next()] : [];
  const act = compile(state.world, {
    answers: { ...normalized, ...answers } as unknown as Answers,
    operands,
    actor,
    hands: `${actor}.hands`,
    place: body.place,
    draw: draws[0] ?? 0,
  });
  if (!act) return rejected(state, "unsupported");
  if (act.process === "force") act.by = actor;
  const targets = actTargets(act);
  if (!targets.every((id) => available(state.world, body, id, canStep)))
    return rejected(state, "operand-unavailable");
  if (act.process === "search") {
    // Locate creations before sensing, not a post-commit spatial repair.
    const where = body.where;
    const physical = search(state.world, act).map(
      (c): Change => (c.kind === "create" ? { ...c, thing: { ...c.thing, where } } : c),
    );
    const after = apply(state.world, physical);
    const noticed = perceive(after, physical);
    return {
      state: { ...state, rng: rng.state, world: apply(after, noticed) },
      ok: true,
      reason: "accepted",
      changes: [...physical, ...noticed],
      draws,
    };
  }
  return commit(state, act, rng.state, draws, settle);
}

function opportunity(next: SharedState, id: string, canStep: CanStep): SharedStep | undefined {
  const body = actorOf(next, id);
  if (!body?.where) return;
  const act = routine(next.world, body).act;
  if (!act) return;
  let result: SharedStep | undefined;
  if (act.process === "move") {
    const targetId = act.toward ?? act.away;
    // A remembered bond or authoritative target location is not sensory evidence.
    if (!(targetId && body.aware?.[targetId])) return;
    const target = next.world.things[targetId] ?? next.world.bodies[targetId];
    if (!tile(target?.where) || target.place !== body.place) return;
    const from = body.where;
    const where = target.where;
    const candidates: Tile[] = [
      [from[0], from[1] - 1],
      [from[0] - 1, from[1]],
      [from[0] + 1, from[1]],
      [from[0], from[1] + 1],
    ];
    const direction = act.away ? -1 : 1;
    const gap = tileDistance(from, where);
    const legal = candidates.filter(
      (to) => canStep(from, to) && direction * (tileDistance(to, where) - gap) < 0,
    );
    legal.sort((a, b) => direction * (tileDistance(a, where) - tileDistance(b, where)));
    if (legal[0]) result = sharedMove(next, id, legal[0], canStep);
  } else {
    const ids = actTargets(act);
    if (ids.length > 0 && ids.every((target) => available(next.world, body, target, canStep)))
      result = commit(next, act);
  }
  return result;
}

/** One bounded opportunity per unique id, in persisted caller order. No RNG in routine. */
export function sharedTick(
  state: SharedState,
  autonomousIds: readonly string[],
  canStep: CanStep,
  minutes = 0,
  settle: Settle = ENGINE,
): SharedStep {
  if (
    !Array.isArray(autonomousIds) ||
    autonomousIds.length > 256 ||
    autonomousIds.some((id) => typeof id !== "string") ||
    new Set(autonomousIds).size !== autonomousIds.length ||
    !Number.isFinite(minutes) ||
    minutes < 0 ||
    minutes > 1
  )
    return rejected(state, "invalid-schedule");
  if (state.tick >= Number.MAX_SAFE_INTEGER) return rejected(state, "tick-limit");
  let next = state;
  const changes: Change[] = [];
  const draws: number[] = [];
  const notes: unknown[] = [];
  if (minutes > 0) {
    // Passive time is the one step a world may rank with a learned model (milestone J).
    const drift = settle(next.world, { process: "drift", minutes }, next.rng);
    next = { ...next, world: drift.outcome.world, rng: drift.rng };
    changes.push(...drift.outcome.changes);
    draws.push(...drift.draws);
    if (drift.note !== undefined) notes.push(drift.note);
  }
  for (const id of autonomousIds) {
    const result = opportunity(next, id, canStep);
    if (result?.ok) {
      next = result.state;
      changes.push(...result.changes);
    }
  }
  return {
    state: { ...next, tick: state.tick + 1 },
    ok: true,
    reason: "accepted",
    changes,
    draws,
    ...(notes.length > 0 ? { notes } : {}),
  };
}
