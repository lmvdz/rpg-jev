import { matter } from "@rpg-jev/core";
import { encodeSharedView } from "@rpg-jev/core/world";
import { ScheduleAt } from "spacetimedb";
import { SenderError, t } from "spacetimedb/server";
import { offSettle } from "./drift-cache.ts";
import { encodeEvent } from "./event-codec.ts";
import { clock, compactNote, isMode, rankedFor } from "./jepa.ts";
import { isObserving, observesUntil, VIEW_LEASE_MICROS } from "./observers.ts";
import { prepareProjection, shouldPublishTick } from "./projection.ts";
import { type Ctx, db, timer } from "./tables.ts";
import { admitActor, initialWorld, MAX_PLAYERS, populated, terrainAllows } from "./world.ts";

export default db;
export const privateViews = db.clientVisibilityFilter.sql(
  "SELECT * FROM viewer WHERE identity = :sender",
);
export const privateEvents = db.clientVisibilityFilter.sql(
  "SELECT * FROM event WHERE reader = :sender",
);
const HOT_LIMIT = 512n;
const COMMAND_LIMIT = 8192;

function current(ctx: Ctx) {
  const row = ctx.db.worldState.id.find(0);
  if (!row) throw new SenderError("World not initialized");
  return row;
}

function refresh(ctx: Ctx, state: matter.SharedState, revision: number, scheduled = false): void {
  const generation = current(ctx).generation;
  const pauseReason = ctx.db.event.count() >= HOT_LIMIT ? "archive-backlog" : null;
  const projectFor = prepareProjection(state);
  for (const player of ctx.db.player.iter()) {
    if (!isObserving(player.viewUntilMicros, ctx.timestamp.microsSinceUnixEpoch)) continue;
    const previous = ctx.db.viewer.identity.find(player.identity);
    const view = { ...projectFor(player.actor, revision, player.seq), generation, pauseReason };
    const json = encodeSharedView(view);
    if (scheduled && previous && !shouldPublishTick(previous.json, json)) continue;
    const row = {
      identity: player.identity,
      seq: player.seq,
      ok: player.ok,
      reason: player.reason,
      command: player.command,
      json,
    };
    if (previous) ctx.db.viewer.identity.update(row);
    else ctx.db.viewer.insert(row);
  }
}

function commit(ctx: Ctx, step: matter.SharedStep, kind: string, command = ""): void {
  const row = current(ctx);
  const revision = row.revision + 1;
  const base = {
    revision,
    kind,
    command,
    changes: step.changes,
    draws: step.draws,
    rng: step.state.rng,
    tick: step.state.tick,
  };
  // Version 2 carries milestone J's commit notes: what the model chose, never re-run on replay.
  const event = step.notes?.length
    ? { version: 2, ...base, jepa: step.notes.map(compactNote) }
    : { version: 1, ...base };
  ctx.db.event.insert({
    seq: 0n,
    reader: row.archiver,
    generation: row.generation,
    payload: encodeEvent(JSON.stringify(event)),
  });
  ctx.db.worldState.id.update({ ...row, revision, json: JSON.stringify(step.state) });
  refresh(ctx, step.state, revision, kind === "tick");
}

export const init = db.init((ctx) => {
  const state = initialWorld();
  ctx.db.worldState.insert({
    id: 0,
    json: JSON.stringify(state),
    revision: 0,
    generation: ctx.databaseIdentity.toHexString(),
    owner: ctx.sender,
    archiver: ctx.sender,
    archived: 0n,
  });
  ctx.db.event.insert({
    seq: 0n,
    reader: ctx.sender,
    generation: ctx.databaseIdentity.toHexString(),
    payload: encodeEvent(JSON.stringify({ version: 1, kind: "initial", state })),
  });
  ctx.db.timer.insert({ id: 0n, scheduledAt: ScheduleAt.interval(DEFAULT_TICK_MICROS) });
  ctx.db.jepaConfig.insert({ id: 0, mode: "off", tickMicros: DEFAULT_TICK_MICROS });
});

const DEFAULT_TICK_MICROS = 500_000n;

/** This world's milestone J mode and tick; a world published before J has none and is off. */
function jepaConfig(ctx: Ctx) {
  const row = ctx.db.jepaConfig.id.find(0);
  const mode = row && isMode(row.mode) ? row.mode : "off";
  return { mode, tickMicros: row?.tickMicros ?? DEFAULT_TICK_MICROS };
}

/** Owner only: turn the model off, to shadow or live, and set the tick (50 ms to 2 s). */
export const configureJepa = db.reducer(
  { mode: t.string(), tickMicros: t.u64() },
  (ctx, { mode, tickMicros }) => {
    if (!ctx.sender.equals(current(ctx).owner)) throw new SenderError("Owner only");
    if (!isMode(mode)) throw new SenderError("Unknown mode");
    if (tickMicros < 50_000n || tickMicros > 2_000_000n) throw new SenderError("Tick out of range");
    const row = { id: 0, mode, tickMicros };
    if (ctx.db.jepaConfig.id.find(0)) ctx.db.jepaConfig.id.update(row);
    else ctx.db.jepaConfig.insert(row);
    for (const timerRow of ctx.db.timer.iter()) ctx.db.timer.id.delete(timerRow.id);
    ctx.db.timer.insert({ id: 0n, scheduledAt: ScheduleAt.interval(tickMicros) });
  },
);

/** Owner only: grow the world to `total` things (J2's load), as a logged event like any other. */
export const populate = db.reducer({ total: t.u32(), seed: t.u32() }, (ctx, { total, seed }) => {
  if (!ctx.sender.equals(current(ctx).owner)) throw new SenderError("Owner only");
  if (total > 5000) throw new SenderError("At most 5,000 things");
  const state: matter.SharedState = JSON.parse(current(ctx).json);
  commit(ctx, populated(state, total, seed), "populate", `${total}:${seed}`);
});

export const join = db.reducer((ctx) => {
  const row = current(ctx);
  const state: matter.SharedState = JSON.parse(row.json);
  const existing = ctx.db.player.identity.find(ctx.sender);
  if (existing) {
    ctx.db.player.identity.update({
      ...existing,
      viewUntilMicros: observesUntil(ctx.timestamp.microsSinceUnixEpoch),
    });
    refresh(ctx, state, row.revision);
    return;
  }
  if (ctx.db.player.count() >= BigInt(MAX_PLAYERS))
    throw new SenderError("World admission is full");
  if (ctx.db.event.count() >= HOT_LIMIT)
    throw new SenderError("Archive backlog; host must recover it");
  const actor = `player-${Number(ctx.db.player.count()) + 1}`;
  ctx.db.player.insert({
    identity: ctx.sender,
    actor,
    seq: 0,
    command: "",
    ok: true,
    reason: "joined",
    lastMicros: 0n,
    lastRevision: row.revision + 1,
    viewUntilMicros: observesUntil(ctx.timestamp.microsSinceUnixEpoch),
  });
  commit(ctx, admitActor(state, actor), "join", actor);
});

/** Renew interest in projections only; this cannot admit, move or advance an actor. */
export const observe = db.reducer((ctx) => {
  const player = ctx.db.player.identity.find(ctx.sender);
  if (!player) throw new SenderError("Join the world first");
  const now = ctx.timestamp.microsSinceUnixEpoch;
  if (player.viewUntilMicros > now + VIEW_LEASE_MICROS - 2_000_000n) return;
  ctx.db.player.identity.update({ ...player, viewUntilMicros: observesUntil(now) });
  const row = current(ctx);
  refresh(ctx, JSON.parse(row.json), row.revision);
});

function execute(
  state: matter.SharedState,
  actor: string,
  payload: string,
  settle: matter.Settle,
): matter.SharedStep {
  const reject = (reason: string): matter.SharedStep => ({
    state,
    ok: false,
    reason,
    changes: [],
    draws: [],
  });
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return reject("invalid-json");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    return reject("invalid-command");
  const command = parsed as Record<string, unknown>;
  if (command.version !== 1) return reject("unsupported-version");
  if (command.kind === "move" && Object.keys(command).sort().join() === "kind,to,version") {
    const to = command.to;
    if (!Array.isArray(to) || to.length !== 2 || !to.every(Number.isSafeInteger))
      return reject("invalid-destination");
    return matter.sharedMove(state, actor, to as [number, number], (from, dest) =>
      terrainAllows(state.world, from, dest),
    );
  }
  if (
    command.kind !== "act" ||
    Object.keys(command).sort().join() !== "answers,kind,operands,version"
  )
    return reject("unsupported-command");
  return matter.sharedAct(
    state,
    actor,
    command.answers as Record<string, string>,
    command.operands as Record<string, string>,
    (from, to) => terrainAllows(state.world, from, to, false),
    settle,
  );
}

export const command = db.reducer(
  { seq: t.u32(), revision: t.u32(), generation: t.string(), payload: t.string() },
  (ctx, { seq, revision, generation, payload }) => {
    const player = ctx.db.player.identity.find(ctx.sender);
    if (!player) throw new SenderError("Join the world first");
    if (generation !== current(ctx).generation)
      throw new SenderError("World generation changed; command not applied");
    if (payload.length > COMMAND_LIMIT) throw new SenderError("Command too large");
    if (seq === player.seq && payload === player.command) return;
    if (seq !== player.seq + 1) throw new SenderError("Stale or out-of-order sequence");
    const row = current(ctx);
    const state: matter.SharedState = JSON.parse(row.json);
    let reason = "";
    // Unrelated host ticks must not invalidate every player intent. The caller
    // must have observed its own last action; all selected targets are rechecked
    // against current state by core before committing this new intent.
    if (revision < player.lastRevision || revision > row.revision) reason = "stale-view";
    else if (ctx.db.event.count() >= HOT_LIMIT) reason = "archive-backlog";
    else if (ctx.timestamp.microsSinceUnixEpoch - player.lastMicros < 50_000n)
      reason = "rate-limited";
    const ranked = rankedFor(jepaConfig(ctx).mode);
    const result = reason
      ? { state, ok: false, reason, changes: [], draws: [] }
      : execute(state, player.actor, payload, ranked.settle);
    ctx.db.player.identity.update({
      ...player,
      seq,
      command: payload,
      ok: result.ok,
      reason: result.reason,
      lastMicros: ctx.timestamp.microsSinceUnixEpoch,
      lastRevision: result.ok ? row.revision + 1 : player.lastRevision,
      viewUntilMicros: observesUntil(ctx.timestamp.microsSinceUnixEpoch),
    });
    if (result.ok) commit(ctx, result, "command", `${player.actor}:${seq}:${payload}`);
    else refresh(ctx, state, row.revision);
  },
);

export const advance = db.reducer({ onSchedule: timer }, { timer: timer.rowType }, (ctx) => {
  if (!ctx.sender.equals(ctx.databaseIdentity)) throw new SenderError("Scheduler only");
  if (ctx.db.event.count() >= HOT_LIMIT) return;
  const started = clock();
  const state: matter.SharedState = JSON.parse(current(ctx).json);
  const actors = Object.keys(state.world.bodies)
    .filter((id) => !id.startsWith("player-"))
    .sort();
  const config = jepaConfig(ctx);
  const ranked = rankedFor(config.mode);
  // Off carries a dirty-set cache over drift (docs/authority-scale.md); the model's own modes
  // still rank the drift step every tick, unchanged, so the cache only applies where it cannot
  // change what gets ranked.
  const settle = config.mode === "off" ? offSettle(current(ctx).generation) : ranked.settle;
  // Passive time is as long as the tick, in game minutes.
  const minutes = Number(config.tickMicros) / 60_000_000;
  const step = matter.sharedTick(
    state,
    actors,
    (from, to) => terrainAllows(state.world, from, to),
    minutes,
    settle,
  );
  commit(ctx, step, "tick");
  telemetry(ctx, config.mode, step, ranked.finish(), clock() - started);
});

const RING = 4096;

/** Milestone J telemetry: timings and counts only, a ring of the latest ticks. */
function telemetry(
  ctx: Ctx,
  mode: string,
  step: matter.SharedStep,
  t: { scoringMs: number; scored: number; cached: number },
  tickMs: number,
): void {
  const note = step.notes?.[0] as
    | { record: { fallback: string }; agreed: number; things: number }
    | undefined;
  const row = {
    slot: step.state.tick % RING,
    tick: step.state.tick,
    mode,
    things: Object.keys(step.state.world.things).length,
    scoringMicros: Math.round(t.scoringMs * 1000),
    tickMicros: Math.round(tickMs * 1000),
    fallback: note?.record.fallback ?? "off",
    agreed: note?.agreed ?? 0,
    draws: step.draws.length,
    scored: t.scored,
    cached: t.cached,
  };
  if (ctx.db.jepaTick.slot.find(row.slot)) ctx.db.jepaTick.slot.update(row);
  else ctx.db.jepaTick.insert(row);
}

export const registerArchiver = db.reducer({ identity: t.identity() }, (ctx, { identity }) => {
  const row = current(ctx);
  if (!ctx.sender.equals(row.owner)) throw new SenderError("Owner only");
  ctx.db.worldState.id.update({ ...row, archiver: identity });
  for (const event of ctx.db.event.iter()) ctx.db.event.seq.update({ ...event, reader: identity });
});

export const archiveThrough = db.reducer({ seq: t.u64() }, (ctx, { seq }) => {
  const row = current(ctx);
  if (!ctx.sender.equals(row.archiver)) throw new SenderError("Archive worker only");
  if (seq <= row.archived) return;
  const pending = [...ctx.db.event.iter()].sort((a, b) => (a.seq < b.seq ? -1 : 1));
  if (!pending.some((event) => event.seq === seq))
    throw new SenderError("Unknown archive frontier");
  for (const event of pending) if (event.seq <= seq) ctx.db.event.seq.delete(event.seq);
  ctx.db.worldState.id.update({ ...row, archived: seq });
});
