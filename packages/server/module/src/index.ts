import { matter } from "@rpg-jev/core";
import { ScheduleAt } from "spacetimedb";
import { SenderError, t } from "spacetimedb/server";
import { project, shouldPublishTick } from "./projection.ts";
import { type Ctx, db, timer } from "./tables.ts";
import { admitActor, initialWorld, MAX_PLAYERS, terrainAllows } from "./world.ts";

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
  for (const player of ctx.db.player.iter()) {
    const previous = ctx.db.viewer.identity.find(player.identity);
    const view = { ...project(state, player.actor, revision, player.seq), generation, pauseReason };
    if (scheduled && previous && !shouldPublishTick(JSON.parse(previous.json), view)) continue;
    const row = {
      identity: player.identity,
      seq: player.seq,
      ok: player.ok,
      reason: player.reason,
      command: player.command,
      json: JSON.stringify(view),
    };
    if (previous) ctx.db.viewer.identity.update(row);
    else ctx.db.viewer.insert(row);
  }
}

function commit(ctx: Ctx, step: matter.SharedStep, kind: string, command = ""): void {
  const row = current(ctx);
  const revision = row.revision + 1;
  ctx.db.event.insert({
    seq: 0n,
    reader: row.archiver,
    generation: row.generation,
    payload: JSON.stringify({
      version: 1,
      revision,
      kind,
      command,
      changes: step.changes,
      draws: step.draws,
      rng: step.state.rng,
      tick: step.state.tick,
    }),
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
    payload: JSON.stringify({ version: 1, kind: "initial", state }),
  });
  ctx.db.timer.insert({ id: 0n, scheduledAt: ScheduleAt.interval(500_000n) });
});

export const join = db.reducer((ctx) => {
  const row = current(ctx);
  const state: matter.SharedState = JSON.parse(row.json);
  if (ctx.db.player.identity.find(ctx.sender)) {
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
  });
  commit(ctx, admitActor(state, actor), "join", actor);
});

function execute(state: matter.SharedState, actor: string, payload: string): matter.SharedStep {
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
    const result = reason
      ? { state, ok: false, reason, changes: [], draws: [] }
      : execute(state, player.actor, payload);
    ctx.db.player.identity.update({
      ...player,
      seq,
      command: payload,
      ok: result.ok,
      reason: result.reason,
      lastMicros: ctx.timestamp.microsSinceUnixEpoch,
      lastRevision: result.ok ? row.revision + 1 : player.lastRevision,
    });
    if (result.ok) commit(ctx, result, "command", `${player.actor}:${seq}:${payload}`);
    else refresh(ctx, state, row.revision);
  },
);

export const advance = db.reducer({ onSchedule: timer }, { timer: timer.rowType }, (ctx) => {
  if (!ctx.sender.equals(ctx.databaseIdentity)) throw new SenderError("Scheduler only");
  if (ctx.db.event.count() >= HOT_LIMIT) return;
  const state: matter.SharedState = JSON.parse(current(ctx).json);
  const actors = Object.keys(state.world.bodies)
    .filter((id) => !id.startsWith("player-"))
    .sort();
  const step = matter.sharedTick(
    state,
    actors,
    (from, to) => terrainAllows(state.world, from, to),
    1 / 120,
  );
  commit(ctx, step, "tick");
});

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
