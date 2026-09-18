// Spike S0 module. Table shapes follow SPEC section 4 and stay portable: plain
// scalar columns, string kinds, i64 game-minutes for bitemporal bounds, JSON text
// for payloads. Nothing here needs a SpacetimeDB-only type except the fuse table's
// `scheduledAt`, which the fallback would replace with a due-time column and a timer.
import { ScheduleAt } from "spacetimedb";
import { type InferSchema, Range, type ReducerCtx, schema, t, table } from "spacetimedb/server";

/** `valid_to` of an edge that is still open. A sentinel keeps the column indexable and portable. */
const OPEN = 9_223_372_036_854_775_807n;

const eventLog = table(
  { name: "event_log", public: true },
  {
    seq: t.u64().primaryKey().autoInc(),
    at: t.timestamp(),
    kind: t.string(),
    causeId: t.u64().index("btree"),
    payload: t.string(),
  },
);

const entity = table(
  {
    name: "entity",
    public: true,
    indexes: [{ accessor: "by_xy", algorithm: "btree", columns: ["x", "y"] }],
  },
  {
    id: t.u64().primaryKey(),
    kind: t.string(),
    x: t.i32(),
    y: t.i32(),
    cell: t.u32().index("btree"),
    version: t.u64(),
    drive: t.f64(),
    sentMs: t.f64(),
  },
);

const edge = table(
  {
    name: "edge",
    public: true,
    indexes: [
      { accessor: "by_src_kind", algorithm: "btree", columns: ["src", "kind"] },
      { accessor: "by_valid_to", algorithm: "btree", columns: ["validTo"] },
    ],
  },
  {
    id: t.u64().primaryKey().autoInc(),
    src: t.u64(),
    dst: t.u64(),
    kind: t.string(),
    validFrom: t.i64(),
    validTo: t.i64(),
    knownFrom: t.i64(),
    causeId: t.u64(),
  },
);

const decisionRequest = table(
  { name: "decision_request", public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    actor: t.u64(),
    family: t.string(),
    options: t.string(),
    snapshotVersion: t.u64(),
    status: t.string().index("btree"),
    requestedAt: t.timestamp(),
    clientTag: t.string(),
  },
);

const fuse = table(
  { name: "fuse" },
  {
    scheduledId: t.u64().primaryKey().autoInc(),
    scheduledAt: t.scheduleAt(),
    batch: t.u32(),
    debtId: t.u64(),
    dueMicros: t.i64(),
    spin: t.u32(),
    fail: t.bool(),
  },
);

const fuseFired = table(
  { name: "fuse_fired", public: true },
  {
    seq: t.u64().primaryKey().autoInc(),
    batch: t.u32().index("btree"),
    debtId: t.u64(),
    dueMicros: t.i64(),
    firedMicros: t.i64(),
  },
);

// The alternative to one scheduled row per debt: debts are ordinary rows, and one repeating
// reducer drains whatever is due, in (due, id) order, a bounded number per tick.
const debt = table(
  {
    name: "debt",
    indexes: [{ accessor: "by_due", algorithm: "btree", columns: ["dueMicros", "id"] }],
  },
  {
    id: t.u64().primaryKey().autoInc(),
    dueMicros: t.i64(),
    batch: t.u32(),
    debtId: t.u64(),
  },
);

const drainTimer = table(
  { name: "drain_timer" },
  {
    scheduledId: t.u64().primaryKey().autoInc(),
    scheduledAt: t.scheduleAt(),
    limit: t.u32(),
  },
);

const queryResult = table(
  { name: "query_result", public: true },
  {
    tag: t.string().primaryKey(),
    rows: t.u32(),
    scanned: t.u32(),
  },
);

const spacetimedb = schema({
  eventLog,
  entity,
  edge,
  decisionRequest,
  fuse,
  fuseFired,
  debt,
  drainTimer,
  queryResult,
});
export default spacetimedb;

type Ctx = ReducerCtx<InferSchema<typeof spacetimedb>>;

/** The single write path for world state: append to the log, then project. */
function commit(ctx: Ctx, kind: string, causeId: bigint, payload: string): bigint {
  return ctx.db.eventLog.insert({ seq: 0n, at: ctx.timestamp, kind, causeId, payload }).seq;
}

function cellOf(x: number, y: number): number {
  return (Math.floor(y / 32) << 16) | Math.floor(x / 32);
}

// ---------------------------------------------------------------- item 1: one write path

export const applyEffect = spacetimedb.reducer(
  { kind: t.string(), target: t.u64(), amount: t.f64(), causeId: t.u64() },
  (ctx, { kind, target, amount, causeId }) => {
    const row = ctx.db.entity.id.find(target);
    if (!row) throw new Error(`no entity ${target}`);
    if (kind !== "shift_drive") throw new Error(`unknown effect kind ${kind}`);
    if (Math.abs(amount) > 0.25) throw new Error("step out of bounds");
    commit(ctx, kind, causeId, JSON.stringify({ target: target.toString(), amount }));
    ctx.db.entity.id.update({ ...row, drive: row.drive + amount, version: row.version + 1n });
  },
);

export const ping = spacetimedb.reducer({ n: t.u32() }, (ctx, { n }) => {
  ctx.db.queryResult.tag.delete("ping");
  ctx.db.queryResult.insert({ tag: "ping", rows: n, scanned: 0 });
});

// ---------------------------------------------------------------- item 4: entities near a position

export const seedEntities = spacetimedb.reducer(
  { start: t.u64(), count: t.u32(), side: t.u32() },
  (ctx, { start, count, side }) => {
    for (let i = 0; i < count; i++) {
      const x = ctx.random.integerInRange(0, side - 1);
      const y = ctx.random.integerInRange(0, side - 1);
      ctx.db.entity.insert({
        id: start + BigInt(i),
        kind: "npc",
        x,
        y,
        cell: cellOf(x, y),
        version: 0n,
        drive: 0,
        sentMs: 0,
      });
    }
  },
);

export const clearEntities = spacetimedb.reducer((ctx) => {
  for (const row of [...ctx.db.entity.iter()]) ctx.db.entity.id.delete(row.id);
});

export const moveEntity = spacetimedb.reducer(
  { id: t.u64(), x: t.i32(), y: t.i32(), sentMs: t.f64() },
  (ctx, { id, x, y, sentMs }) => {
    const row = ctx.db.entity.id.find(id);
    if (!row) throw new Error(`no entity ${id}`);
    commit(ctx, "move", 0n, JSON.stringify({ id: id.toString(), x, y }));
    ctx.db.entity.id.update({
      ...row,
      x,
      y,
      cell: cellOf(x, y),
      version: row.version + 1n,
      sentMs,
    });
  },
);

// ---------------------------------------------------------------- item 3: request and commit

export const requestDecision = spacetimedb.reducer(
  { actor: t.u64(), clientTag: t.string() },
  (ctx, { actor, clientTag }) => {
    const row = ctx.db.entity.id.find(actor);
    if (!row) throw new Error(`no entity ${actor}`);
    ctx.db.decisionRequest.insert({
      id: 0n,
      actor,
      family: "pick_action",
      options: JSON.stringify(["greet", "ignore", "none_of_these"]),
      snapshotVersion: row.version,
      status: "pending",
      requestedAt: ctx.timestamp,
      clientTag,
    });
  },
);

export const commitDecision = spacetimedb.reducer(
  { requestId: t.u64(), choice: t.string(), judgeMs: t.f64() },
  (ctx, { requestId, choice, judgeMs }) => {
    const req = ctx.db.decisionRequest.id.find(requestId);
    if (req?.status !== "pending") return;
    const actor = ctx.db.entity.id.find(req.actor);
    const tag = req.clientTag;
    // Hard precondition, re-checked in code at commit: the actor has not changed since the snapshot.
    if (!actor || actor.version !== req.snapshotVersion) {
      const seen = actor ? actor.version.toString() : "gone";
      const want = req.snapshotVersion.toString();
      commit(ctx, "decision_dropped", requestId, JSON.stringify({ tag, want, seen, judgeMs }));
      ctx.db.decisionRequest.id.update({ ...req, status: "dropped" });
      return;
    }
    commit(ctx, "shift_drive", requestId, JSON.stringify({ tag, choice, judgeMs }));
    ctx.db.entity.id.update({ ...actor, drive: actor.drive + 0.1, version: actor.version + 1n });
    ctx.db.decisionRequest.id.update({ ...req, status: "committed" });
  },
);

// ---------------------------------------------------------------- item 2: fuses

export const fireFuse = spacetimedb.reducer(
  { onSchedule: fuse },
  { timer: fuse.rowType },
  (ctx, { timer }) => {
    let acc = 0;
    for (let i = 0; i < timer.spin; i++) acc = (acc + i * 31) % 1_000_003;
    if (timer.fail) throw new Error(`fuse ${timer.debtId} failed on purpose (${acc})`);
    ctx.db.fuseFired.insert({
      seq: 0n,
      batch: timer.batch,
      debtId: timer.debtId,
      dueMicros: timer.dueMicros,
      firedMicros: ctx.timestamp.microsSinceUnixEpoch,
    });
  },
);

export const scheduleFuses = spacetimedb.reducer(
  {
    batch: t.u32(),
    count: t.u32(),
    delayMicros: t.i64(),
    staggerMicros: t.i64(),
    intervalMicros: t.i64(),
    spin: t.u32(),
    failEvery: t.u32(),
  },
  (ctx, { batch, count, delayMicros, staggerMicros, intervalMicros, spin, failEvery }) => {
    const base = ctx.timestamp.microsSinceUnixEpoch + delayMicros;
    for (let i = 0; i < count; i++) {
      const due = base + BigInt(i) * staggerMicros;
      ctx.db.fuse.insert({
        scheduledId: 0n,
        scheduledAt:
          intervalMicros > 0n ? ScheduleAt.interval(intervalMicros) : ScheduleAt.time(due),
        batch,
        debtId: BigInt(i),
        dueMicros: intervalMicros > 0n ? 0n : due,
        spin,
        fail: failEvery > 0 && i % failEvery === 0,
      });
    }
  },
);

export const cancelFuses = spacetimedb.reducer({ batch: t.u32() }, (ctx, { batch }) => {
  for (const row of [...ctx.db.fuse.iter()]) {
    if (row.batch === batch) ctx.db.fuse.scheduledId.delete(row.scheduledId);
  }
});

export const createDebts = spacetimedb.reducer(
  { batch: t.u32(), count: t.u32(), delayMicros: t.i64() },
  (ctx, { batch, count, delayMicros }) => {
    const dueMicros = ctx.timestamp.microsSinceUnixEpoch + delayMicros;
    for (let i = 0; i < count; i++) {
      ctx.db.debt.insert({ id: 0n, dueMicros, batch, debtId: BigInt(i) });
    }
  },
);

export const drainDebts = spacetimedb.reducer(
  { onSchedule: drainTimer },
  { timer: drainTimer.rowType },
  (ctx, { timer }) => {
    const now = ctx.timestamp.microsSinceUnixEpoch;
    const due: { id: bigint; batch: number; debtId: bigint; dueMicros: bigint }[] = [];
    const upTo = new Range<bigint>({ tag: "unbounded" }, { tag: "included", value: now });
    for (const row of ctx.db.debt.by_due.filter(upTo)) {
      due.push(row);
      if (due.length >= timer.limit) break;
    }
    for (const row of due) {
      ctx.db.debt.id.delete(row.id);
      ctx.db.fuseFired.insert({
        seq: 0n,
        batch: row.batch,
        debtId: row.debtId,
        dueMicros: row.dueMicros,
        firedMicros: now,
      });
    }
  },
);

export const startDrain = spacetimedb.reducer(
  { intervalMicros: t.i64(), limit: t.u32() },
  (ctx, { intervalMicros, limit }) => {
    for (const row of [...ctx.db.drainTimer.iter()])
      ctx.db.drainTimer.scheduledId.delete(row.scheduledId);
    ctx.db.drainTimer.insert({
      scheduledId: 0n,
      scheduledAt: ScheduleAt.interval(intervalMicros),
      limit,
    });
  },
);

export const stopDrain = spacetimedb.reducer((ctx) => {
  for (const row of [...ctx.db.drainTimer.iter()])
    ctx.db.drainTimer.scheduledId.delete(row.scheduledId);
});

export const clearFired = spacetimedb.reducer((ctx) => {
  for (const row of [...ctx.db.fuseFired.iter()]) ctx.db.fuseFired.seq.delete(row.seq);
});

// ---------------------------------------------------------------- items 5 and 6: bitemporal edges

/**
 * Seeds belief histories. Each (src, dst) pair gets `versions` rows: all but the last are closed,
 * and each row becomes known a few minutes after it became valid.
 */
export const seedEdges = spacetimedb.reducer(
  { srcStart: t.u64(), srcCount: t.u32(), claims: t.u32(), versions: t.u32() },
  (ctx, { srcStart, srcCount, claims, versions }) => {
    for (let s = 0; s < srcCount; s++) {
      const src = srcStart + BigInt(s);
      for (let c = 0; c < claims; c++) {
        for (let v = 0; v < versions; v++) {
          const from = BigInt(v * 1000 + c);
          ctx.db.edge.insert({
            id: 0n,
            src,
            dst: BigInt(c),
            kind: "believes",
            validFrom: from,
            validTo: v === versions - 1 ? OPEN : BigInt((v + 1) * 1000 + c),
            knownFrom: from + 30n,
            causeId: 0n,
          });
        }
      }
    }
  },
);

/** Close-and-insert, the only way an edge changes (SPEC section 4). */
export const churnEdges = spacetimedb.reducer(
  { srcStart: t.u64(), srcCount: t.u32(), dst: t.u64(), now: t.i64() },
  (ctx, { srcStart, srcCount, dst, now }) => {
    for (let s = 0; s < srcCount; s++) {
      const src = srcStart + BigInt(s);
      for (const row of [...ctx.db.edge.by_src_kind.filter([src, "believes"])]) {
        if (row.dst === dst && row.validTo === OPEN) {
          ctx.db.edge.id.update({ ...row, validTo: now });
        }
      }
      ctx.db.edge.insert({
        id: 0n,
        src,
        dst,
        kind: "believes",
        validFrom: now,
        validTo: OPEN,
        knownFrom: now,
        causeId: 0n,
      });
    }
  },
);

/** "What did `src` believe at time T, as known at time K", through the (src, kind) index. */
export const queryBelief = spacetimedb.reducer(
  { tag: t.string(), src: t.u64(), at: t.i64(), knownAt: t.i64(), repeat: t.u32() },
  (ctx, { tag, src, at, knownAt, repeat }) => {
    let rows = 0;
    let scanned = 0;
    for (let r = 0; r < repeat; r++) {
      const who = src + BigInt(r);
      for (const row of ctx.db.edge.by_src_kind.filter([who, "believes"])) {
        scanned++;
        if (row.validFrom <= at && at < row.validTo && row.knownFrom <= knownAt) rows++;
      }
    }
    ctx.db.queryResult.tag.delete(tag);
    ctx.db.queryResult.insert({ tag, rows, scanned });
  },
);

/** The same question with no usable index: a full scan. The contrast case. */
export const queryBeliefScan = spacetimedb.reducer(
  { tag: t.string(), dst: t.u64(), at: t.i64(), knownAt: t.i64() },
  (ctx, { tag, dst, at, knownAt }) => {
    let rows = 0;
    let scanned = 0;
    for (const row of ctx.db.edge.iter()) {
      scanned++;
      if (row.dst === dst && row.validFrom <= at && at < row.validTo && row.knownFrom <= knownAt) {
        rows++;
      }
    }
    ctx.db.queryResult.tag.delete(tag);
    ctx.db.queryResult.insert({ tag, rows, scanned });
  },
);

/** Archival: closed rows older than `before` leave the hot table. A worker has already copied them out. */
export const archiveClosed = spacetimedb.reducer(
  { before: t.i64(), limit: t.u32() },
  (ctx, { before, limit }) => {
    let n = 0;
    const doomed: bigint[] = [];
    for (const row of ctx.db.edge.by_valid_to.filter(
      new Range({ tag: "unbounded" }, { tag: "excluded", value: before }),
    )) {
      doomed.push(row.id);
      n++;
      if (n >= limit) break;
    }
    for (const id of doomed) ctx.db.edge.id.delete(id);
    ctx.db.queryResult.tag.delete("archive");
    ctx.db.queryResult.insert({ tag: "archive", rows: n, scanned: n });
  },
);

export const clearEdges = spacetimedb.reducer((ctx) => {
  for (const row of [...ctx.db.edge.iter()]) ctx.db.edge.id.delete(row.id);
});

// ---------------------------------------------------------------- procedures (not depended on)

/** The belief query as a procedure: unlike a reducer, it returns its answer to the caller. */
export const beliefCount = spacetimedb.procedure(
  { src: t.u64(), at: t.i64(), knownAt: t.i64() },
  t.u32(),
  (ctx, { src, at, knownAt }) =>
    ctx.withTx((tx) => {
      let rows = 0;
      for (const row of tx.db.edge.by_src_kind.filter([src, "believes"])) {
        if (row.validFrom <= at && at < row.validTo && row.knownFrom <= knownAt) rows++;
      }
      return rows;
    }),
);
