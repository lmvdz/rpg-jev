import { type InferSchema, type ReducerCtx, schema, t, table } from "spacetimedb/server";

const worldState = table(
  { name: "world_state" },
  {
    id: t.u8().primaryKey(),
    json: t.string(),
    revision: t.u32(),
    generation: t.string(),
    owner: t.identity(),
    archiver: t.identity(),
    archived: t.u64(),
  },
);
const player = table(
  { name: "player" },
  {
    identity: t.identity().primaryKey(),
    actor: t.string(),
    seq: t.u32(),
    command: t.string(),
    ok: t.bool(),
    reason: t.string(),
    lastMicros: t.i64(),
    lastRevision: t.u32().default(0),
  },
);
const viewer = table(
  { name: "viewer", public: true },
  {
    identity: t.identity().primaryKey(),
    json: t.string(),
    seq: t.u32(),
    ok: t.bool(),
    reason: t.string(),
    command: t.string(),
  },
);
const event = table(
  { name: "event", public: true },
  {
    seq: t.u64().primaryKey().autoInc(),
    reader: t.identity(),
    generation: t.string(),
    payload: t.string(),
  },
);
export const timer = table(
  { name: "timer" },
  { id: t.u64().primaryKey().autoInc(), scheduledAt: t.scheduleAt() },
);
export const db = schema({ worldState, player, viewer, event, timer });
export type Ctx = ReducerCtx<InferSchema<typeof db>>;
