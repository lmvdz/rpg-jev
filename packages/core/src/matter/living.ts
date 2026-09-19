/**
 * What it is to be a body in a place. A body grows cold by how cold the place is, faster wet
 * than dry and in wind than in still air, slower for what it wears (a soaked coat is worth
 * less than a dry one, which the modifier rules already say) and slower still by a fire.
 * Hunger and tiredness come with the hours. What a body has suffered lowers what it can do.
 *
 * Then the first creature. What it may choose among is built by code from what it notices and
 * what it needs, always with nothing among the options (SPEC.md rule 4); the judge chooses
 * when someone is watching, and `routine` chooses when nobody is (rule 10).
 */
import { effective } from "./effective.ts";
import { blaze } from "./heat.ts";
import type { Act } from "./resolve.ts";
import type { Body, BodyRow, Change, MatterWorld, Thing } from "./types.ts";
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
  /** A thing to go toward, or to go away from. */
  toward?: string;
  away?: string;
  minutes: number;
}

/** Tiles a minute, for each level of speed. A body covers ground by what it can still do. */
const PACE = 4;

export function move(world: MatterWorld, act: MoveAct): Change[] {
  const body = world.bodies[act.body];
  const target = world.things[act.toward ?? act.away ?? ""];
  if (!(body && target)) return [{ kind: "nothing", because: [], note: "there is nowhere to go" }];
  const from = body.where ?? [0, 0];
  const to = target.where ?? [0, 0];
  const gap = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const stride = able(world, body).speed * PACE * act.minutes;
  // Toward, it stops beside the thing; away, it keeps going.
  const go = act.toward ? Math.min(stride, Math.max(0, gap - 1)) : -stride;
  const [dx, dz] = gap > 0 ? [(to[0] - from[0]) / gap, (to[1] - from[1]) / gap] : [1, 0];
  const where: [number, number] = [from[0] + dx * go, from[1] + dz * go];
  return [
    {
      kind: "body",
      body: body.id,
      set: { where },
      because: ["X1", "B1"],
      note: act.toward ? "it goes toward it" : "it makes off",
    },
  ];
}

export interface Option {
  id: string;
  description: string;
  act?: Act;
}

const feeds = (world: MatterWorld, thing: Thing) =>
  (world.elements[thing.element]?.serves?.hunger ?? 0) > 0;

/**
 * What this body could do now, built from what it is aware of. It cannot be offered what it
 * has not noticed, and it is always offered nothing.
 */
export function optionsFor(world: MatterWorld, body: Body): Option[] {
  const options: Option[] = [];
  for (const id of Object.keys(body.aware ?? {}).sort()) {
    const thing = world.things[id];
    if (!thing) continue;
    if (thing.state.burning)
      options.push({
        id: `flee:${id}`,
        description: "get away from the fire",
        act: { process: "move", body: body.id, away: id, minutes: 1 },
      });
    if (!feeds(world, thing)) continue;
    const near = apart(body.where, thing.where) <= 1.5;
    options.push(
      near
        ? {
            id: `eat:${id}`,
            description: "eat what is here",
            act: { process: "ingest", body: body.id, thing: id, amount: 1 },
          }
        : {
            id: `approach:${id}`,
            description: "go toward what smells of food",
            act: { process: "move", body: body.id, toward: id, minutes: 1 },
          },
    );
  }
  options.push({ id: "rest", description: "stay and rest" });
  options.push({ id: "none", description: "none of these" });
  return options;
}

/** What it does when nobody is watching: its needs decide, in code, among the same options. */
export function routine(world: MatterWorld, body: Body): Option {
  const options = optionsFor(world, body);
  const nothing: Option = { id: "none", description: "none of these" };
  const first = (prefix: string) => options.find((o) => o.id.startsWith(prefix));
  const strongest = Math.max(0, ...Object.values(body.aware ?? {}).map((p) => p.strength));
  if ((body.needs.hunger ?? 0) >= 3) return first("eat:") ?? first("approach:") ?? nothing;
  if ((body.needs.rest ?? 0) >= 3) return first("rest") ?? nothing;
  if (strongest >= 2) return first("flee:") ?? nothing;
  return nothing;
}
