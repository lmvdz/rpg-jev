/**
 * Schedules are data that code executes for free (SPEC.md section 7). Four
 * layers, highest priority first: overrides, commitments, needs, role. An
 * entry uses only `at`, `every`, `after`, `until` and `at_location`, so where
 * an NPC is follows from the time and its own stored state, never from
 * another NPC.
 */
import type { Actor, Layer, Minute, RoomId, Schedule, ScheduleEntry, World } from "./types.ts";
import { NEEDS } from "./types.ts";

export interface Span {
  start: Minute;
  end: Minute;
}

/** The span of `entry` that covers `t`, if it is active then. */
export function activeSpan(
  entry: ScheduleEntry,
  t: Minute,
  siblings: readonly ScheduleEntry[],
  depth = 0,
): Span | null {
  if (entry.at !== undefined) {
    return t >= entry.at && t < entry.until ? { start: entry.at, end: entry.until } : null;
  }
  if (entry.every !== undefined) {
    const { period, offset } = entry.every;
    if (t < offset) return null;
    const start = offset + Math.floor((t - offset) / period) * period;
    return t < start + entry.until ? { start, end: start + entry.until } : null;
  }
  if (entry.after !== undefined && depth < 8) {
    const previous = siblings.find((s) => s.id === entry.after);
    if (!previous) return null;
    // Find the most recent end of the entry this one follows.
    const end = lastEnd(previous, t, siblings, depth + 1);
    if (end === null) return null;
    return t >= end && t < end + entry.until ? { start: end, end: end + entry.until } : null;
  }
  return null;
}

function lastEnd(
  entry: ScheduleEntry,
  t: Minute,
  siblings: readonly ScheduleEntry[],
  depth: number,
): Minute | null {
  if (entry.at !== undefined) return entry.until <= t ? entry.until : null;
  if (entry.every !== undefined) {
    const { period, offset } = entry.every;
    if (t < offset + entry.until) return null;
    const start = offset + Math.floor((t - offset - entry.until) / period) * period;
    return start + entry.until;
  }
  if (entry.after !== undefined && depth < 8) {
    const previous = siblings.find((s) => s.id === entry.after);
    if (!previous) return null;
    const end = lastEnd(previous, t, siblings, depth + 1);
    return end !== null && end + entry.until <= t ? end + entry.until : null;
  }
  return null;
}

/** The needs layer is derived: a need over its threshold yields its entry. */
export function needEntries(world: World, actor: Actor): ScheduleEntry[] {
  const out: ScheduleEntry[] = [];
  for (const need of NEEDS) {
    const rule = world.def.needs[need];
    if (!rule) continue;
    const level = actor.needs[need];
    // Hysteresis: start above the threshold, keep going until satisfied.
    const underway = actor.activity === rule.entry.activity && level > rule.satisfied;
    if (level >= rule.threshold || underway) out.push(rule.entry);
  }
  return out;
}

export interface Whereabouts {
  room: RoomId;
  activity: string;
  layer: Layer | "home";
  entry: ScheduleEntry | null;
}

/** Where the schedule puts this NPC at time `t`. */
export function locate(world: World, actor: Actor, t: Minute): Whereabouts {
  const schedule: Schedule | undefined = world.schedules[actor.id];
  if (!schedule) return { room: actor.room, activity: "idle", layer: "home", entry: null };
  const layers: [Layer, readonly ScheduleEntry[]][] = [
    ["overrides", schedule.overrides],
    ["commitments", schedule.commitments],
    ["needs", needEntries(world, actor)],
    ["role", schedule.role],
  ];
  for (const [layer, entries] of layers) {
    for (const entry of entries) {
      // A need has no clock: it is active for as long as the float says so.
      if (layer === "needs" || activeSpan(entry, t, entries))
        return { room: entry.at_location, activity: entry.activity, layer, entry };
    }
  }
  return {
    room: schedule.home.at_location,
    activity: schedule.home.activity,
    layer: "home",
    entry: null,
  };
}

/** True when the entry can never be active again, so drift can drop it. */
export function isSpent(entry: ScheduleEntry, t: Minute): boolean {
  return entry.at !== undefined && t >= entry.until;
}
