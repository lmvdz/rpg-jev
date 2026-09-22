/**
 * Local command-step adapter over MatterWorld, not another simulation.
 * Each accepted command grants each autonomous actor one sequential opportunity.
 * Tick is a choice boundary, not seconds: no drift, thermal work or offline catch-up.
 */
import { apply } from "./apply.ts";
import { type FoodAct, type FoodAction, foodAct } from "./food.ts";
import { routine } from "./intents.ts";
import { PROCESSES } from "./resolve.ts";
import { perceive } from "./sense.ts";
import { type MatterTerrain, nextTile, type Tile, tileReach } from "./session-terrain.ts";
import { assertSession } from "./session-validation.ts";
import type { Body, Change, MatterWorld } from "./types.ts";

export type MatterAction = FoodAction;

export interface MatterCommand {
  actor: string;
  /** Optimistic concurrency boundary. Retries at an old tick are rejected without work. */
  tick: number;
  action: MatterAction;
}

export interface MatterSessionInput {
  world: MatterWorld;
  terrain: MatterTerrain;
  controlled: readonly string[];
  /** Array order is persisted arbitration order, not a priority inferred from names. */
  autonomous: readonly string[];
}

export interface MatterSession extends MatterSessionInput {
  version: 1;
  tick: number;
}

export interface MatterStep {
  session: MatterSession;
  ok: boolean;
  reason: string;
  /** Authoritative diagnostics, not an observer-safe narrative. */
  changes: readonly Change[];
}

export function createMatterSession(input: MatterSessionInput): MatterSession {
  const session: MatterSession = { ...structuredClone(input), version: 1, tick: 0 };
  assertSession(session);
  return { ...session, world: apply(session.world, perceive(session.world, [])) };
}

/** A command is a matter act run through the one process table, or nothing. */
export function attempt(
  session: MatterSession,
  actor: string,
  action: MatterAction,
): Change[] | null {
  const act = foodAct(session.world, session.terrain, actor, action);
  if (act === null) return null;
  if (act === "wait") return [];
  const process = PROCESSES[act.process] as (world: MatterWorld, act: FoodAct) => Change[];
  return process(session.world, act);
}

function reachableAwareness(session: MatterSession, body: Body, from: Tile) {
  // Terrain feasibility narrows noticed candidates; it never adds a hidden source.
  return Object.fromEntries(
    Object.entries(body.aware ?? {}).filter(([id]) => {
      const target = session.world.things[id] ?? session.world.bodies[id];
      return (
        target?.where &&
        (tileReach(session.terrain, from, target.where) ||
          nextTile(session.terrain, from, target.where) !== undefined)
      );
    }),
  );
}

function autonomousAction(session: MatterSession, body: Body): MatterAction | undefined {
  if ((body.needs.hunger ?? 0) <= 0 || !body.where) return undefined;
  const aware = reachableAwareness(session, body, body.where);
  const act = routine(session.world, { ...body, aware }).act;
  if (act?.process === "ingest") {
    const food = session.world.things[act.thing];
    if (!(food?.where && body.where)) return undefined;
    if (tileReach(session.terrain, body.where, food.where))
      return { kind: "eat", thing: act.thing };
    const to = nextTile(session.terrain, body.where, food.where);
    return to ? { kind: "move", to } : undefined;
  }
  if (act?.process === "take") return { kind: act.drop ? "drop" : "take", thing: act.thing };
  if (act?.process !== "move" || !act.toward || !body.where) return undefined;
  const target = session.world.things[act.toward] ?? session.world.bodies[act.toward];
  if (!target?.where) return undefined;
  const to = nextTile(session.terrain, body.where, target.where);
  return to ? { kind: "move", to } : undefined;
}

function settled(world: MatterWorld, changes: readonly Change[]) {
  const next = apply(world, changes);
  const percepts = perceive(next, changes);
  return { world: apply(next, percepts), changes: [...changes, ...percepts] };
}

/** Failed/stale commands preserve object identity and grant no autonomous opportunity. */
export function stepMatterSession(session: MatterSession, command: MatterCommand): MatterStep {
  const rejected = (reason: string): MatterStep => ({ session, ok: false, reason, changes: [] });
  if (command.tick !== session.tick) return rejected("stale");
  if (!session.controlled.includes(command.actor)) return rejected("unauthorized");
  if (session.tick >= Number.MAX_SAFE_INTEGER) return rejected("tick-limit");
  if (!["wait", "move", "take", "drop", "eat"].includes(command.action.kind))
    return rejected("unsupported");
  const changes = attempt(session, command.actor, command.action);
  if (!changes || changes.some((c) => c.kind === "nothing")) return rejected("unavailable");
  const first = settled(session.world, changes);
  let next = { ...session, world: first.world, tick: session.tick + 1 };
  const all = [...first.changes];
  for (const id of session.autonomous) {
    const body = next.world.bodies[id];
    if (!body) continue;
    const action = autonomousAction(next, body);
    const response = action ? attempt(next, id, action) : null;
    if (!response || response.some((c) => c.kind === "nothing")) continue;
    const turn = settled(next.world, response);
    all.push(...turn.changes);
    next = { ...next, world: turn.world };
  }
  return { session: next, ok: true, reason: "accepted", changes: all };
}

/** Local snapshots contain authoritative truth; do not expose them as NPC knowledge. */
export function serializeMatterSession(session: MatterSession): string {
  assertSession(session);
  return JSON.stringify(session);
}

export function restoreMatterSession(serialized: string): MatterSession {
  if (serialized.length > 4_000_000) throw new Error("Snapshot too large");
  const session: unknown = JSON.parse(serialized);
  assertSession(session);
  // Awareness is current sensory evidence, not durable memory supplied by a save.
  return { ...session, world: apply(session.world, perceive(session.world, [])) };
}
