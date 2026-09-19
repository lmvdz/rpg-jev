/**
 * What it is to be a body in a place. A body grows cold by how cold the place is, faster wet
 * than dry and in wind than in still air, slower for what it wears (a soaked coat is worth
 * less than a dry one, which the modifier rules already say) and slower still by a fire.
 * Hunger and tiredness come with the hours. What a body has suffered lowers what it can do.
 *
 * Then what a body does with itself: it goes somewhere, and it takes hold of things or sets
 * them down. What it may choose to do is `intents.ts`.
 */
import { effective } from "./effective.ts";
import { blaze } from "./heat.ts";
import type { Body, BodyRow, Change, MatterWorld } from "./types.ts";
import { clamp } from "./types.ts";

const ORDINARY_BODY: BodyRow = { strength: 2, speed: 2, sight: 2, hearing: 2, smell: 2 };

const apart = (
  a: readonly [number, number] | undefined,
  b: readonly [number, number] | undefined,
) => (a && b ? Math.hypot(a[0] - b[0], a[1] - b[1]) : 0);

/** How much the things a body wears keep the cold off: poor conductors, and less when wet. */
function insulation(world: MatterWorld, body: Body): number {
  return (body.wears ?? []).reduce((sum, id) => {
    const worn = world.things[id];
    return worn ? sum + (5 - effective(world, worn).conductivity) / 5 : sum;
  }, 0);
}

/** The warmth that reaches a body from what burns near it. */
function fireside(world: MatterWorld, body: Body): number {
  return Object.values(world.things).reduce((sum, t) => {
    if (t.place !== body.place || !t.state.burning) return sum;
    return sum + blaze(world, t) / (1 + apart(body.where, t.where) / 2);
  }, 0);
}

/** What the hours and the place do to a body's needs, wetness and health, over a short step. */
export function weathered(world: MatterWorld, body: Body, minutes: number): Partial<Body> {
  const place = world.places[body.place];
  const needs = { ...body.needs };
  // A mild place costs a body nothing; below that, the colder the more.
  const exposure = Math.max(0, 2 - (place?.temperature ?? 2) - fireside(world, body));
  const wet = 1 + (body.wetness ?? 0) * 0.3;
  const wind = 1 + (place?.wind ?? 0) * 0.25;
  const rate = (exposure * wet * wind * 0.006) / (1 + insulation(world, body) * 1.5);
  const cold = needs.warmth ?? 0;
  needs.warmth = clamp(exposure > 0 ? cold + rate * minutes : cold - 0.01 * minutes);
  needs.hunger = clamp((needs.hunger ?? 0) + 0.0015 * minutes);
  const asleep = body.attention === "asleep";
  needs.rest = clamp((needs.rest ?? 0) + (asleep ? -0.006 : 0.002) * minutes);
  // Rain wets who stands in it; out of it a body dries.
  const raining = (place?.moisture ?? 2) >= 4;
  const wetness = clamp((body.wetness ?? 0) + (raining ? 0.1 : -0.01) * minutes);
  // Cold to the bone tells on the body.
  const harm = (needs.warmth ?? 0) >= 4 ? 0.004 * minutes : 0;
  return { needs, wetness, health: clamp(body.health - harm) };
}

/** What a body can do now: its row, lowered by hurt, cold, tiredness and sickness. Derived. */
export function able(world: MatterWorld, body: Body): BodyRow {
  const row = world.elements[body.element ?? ""]?.body ?? ORDINARY_BODY;
  const bleeding = body.wounds.reduce((n, w) => n + w.bleeding, 0);
  const hurt = body.wounds.reduce((n, w) => n + w.depth, 0);
  const factor =
    (body.health / 5) *
    (1 - Math.min(0.6, bleeding * 0.1 + hurt * 0.05)) *
    (1 - (body.needs.warmth ?? 0) / 8) *
    (1 - Math.max(0, (body.needs.rest ?? 0) - 2) / 6) *
    (1 - body.sickness * 0.08);
  const lowered = (level: number) => Math.round(level * clamp(factor, 0, 1) * 100) / 100;
  return { ...row, strength: lowered(row.strength), speed: lowered(row.speed) };
}

export interface MoveAct {
  process: "move";
  body: string;
  /** A thing or a body to go toward, or to go away from; or a spot to make for. */
  toward?: string;
  away?: string;
  to?: readonly [number, number];
  minutes: number;
}

/** Tiles a minute, for each level of speed. A body covers ground by what it can still do. */
const PACE = 4;

function aimOf(world: MatterWorld, act: MoveAct): readonly [number, number] | null {
  if (act.to) return act.to;
  const id = act.toward ?? act.away ?? "";
  const target = world.things[id] ?? world.bodies[id];
  return target ? (target.where ?? [0, 0]) : null;
}

export function move(world: MatterWorld, act: MoveAct): Change[] {
  const body = world.bodies[act.body];
  const to = aimOf(world, act);
  if (!(body && to)) return [{ kind: "nothing", because: [], note: "there is nowhere to go" }];
  const from = body.where ?? [0, 0];
  const gap = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const stride = able(world, body).speed * PACE * act.minutes;
  // Toward, it stops beside the thing; away, it keeps going.
  const go = act.away ? -stride : Math.min(stride, Math.max(0, gap - 1));
  const [dx, dz] = gap > 0 ? [(to[0] - from[0]) / gap, (to[1] - from[1]) / gap] : [1, 0];
  const where: [number, number] = [from[0] + dx * go, from[1] + dz * go];
  const carried: Change[] = (body.holds ?? []).map((thing) => ({
    kind: "carried",
    thing,
    where,
    because: ["X1"],
    note: "what it holds goes with it",
    quiet: true,
  }));
  return [
    {
      kind: "body",
      body: body.id,
      set: { where },
      because: ["X1", "B1"],
      note: act.away ? "it makes off" : "it goes toward it",
    },
    ...carried,
  ];
}

export interface TakeAct {
  process: "take";
  body: string;
  thing: string;
  /** Set it down where it stands. */
  drop?: true;
}

/** What one body can take hold of: within reach, and no heavier than it is strong. */
export function canTake(world: MatterWorld, body: Body, thingId: string): boolean {
  const thing = world.things[thingId];
  if (!thing || thing.place !== body.place || apart(body.where, thing.where) > 1.5) return false;
  return effective(world, thing).mass <= able(world, body).strength + 1;
}

export function take(world: MatterWorld, act: TakeAct): Change[] {
  const body = world.bodies[act.body];
  const holds = body?.holds ?? [];
  if (body && act.drop && holds.includes(act.thing)) {
    const set = { holds: holds.filter((id) => id !== act.thing) };
    return [{ kind: "body", body: body.id, set, because: ["X1"], note: "it sets it down" }];
  }
  if (!body || act.drop || holds.includes(act.thing) || !canTake(world, body, act.thing))
    return [{ kind: "nothing", because: ["X1", "P1"], note: "it cannot take hold of that" }];
  const set = { holds: [...holds, act.thing] };
  return [{ kind: "body", body: body.id, set, because: ["X1", "P1"], note: "it takes hold of it" }];
}
