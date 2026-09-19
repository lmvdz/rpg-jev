/**
 * X8, the other half: what reaches a body. Things emit by what state they are in (a fire
 * gives light and smoke by how hard it burns, a carcass gives scent by how far gone it is),
 * and acts emit events (the sound of a blow). A signal is lessened by distance, by what is in
 * the way, and by what it competes with on its own channel; a body notices it, or does not,
 * by the acuity of the sense and by its attention.
 *
 * What comes out is a percept: this body, this source, this channel, this strength. A percept
 * is not a belief and does nothing by itself. It is what the next layer builds from: the
 * options a creature chooses among, the routine when nobody is watching, a claim with its
 * source when the one who noticed is a person. Deterministic: no draw. Sensing changes
 * nothing but what bodies are aware of.
 */
import { feeds } from "./diet.ts";
import { effective } from "./effective.ts";
import { blaze } from "./heat.ts";
import type { Body, Change, Channel, MatterWorld, Percept, Place, Thing } from "./types.ts";
import { clamp } from "./types.ts";

/** A signal an act made, with where it came from. */
export interface Heard {
  source: string;
  channel: Channel;
  strength: number;
}

/** What a thing gives off by the state it is in. Derived, never stored. */
export function emits(world: MatterWorld, thing: Thing): Partial<Record<Channel, number>> {
  const out: Partial<Record<Channel, number>> = {};
  const burns = blaze(world, thing);
  if (burns > 0) {
    out.light = clamp(2 + burns * 0.6);
    out.smoke = clamp(1 + burns * 0.7);
  } else if (thing.state.temperature + thing.state.surfaceAbove >= 4.5) out.light = 1.5;
  // By daylight a thing is simply seen: more easily the bigger it is, and not at all in the dark.
  const light = world.places[thing.place]?.light ?? 3;
  const size = world.elements[thing.element]?.props.size ?? 0;
  if (light > 0) out.sight = clamp((light / 5) * (2.5 + size * 0.5));
  const base = world.elements[thing.element]?.props.scent ?? 0;
  if (base > 0 || thing.state.contamination > 0) {
    const scent = effective(world, thing).scent;
    const much = 0.7 + 0.15 * Math.log2(1 + thing.state.amount);
    if (scent > 0) out.scent = clamp(scent * much);
  }
  return out;
}

const SENSE: Record<Channel, "sight" | "hearing" | "smell"> = {
  light: "sight",
  smoke: "sight",
  sound: "hearing",
  scent: "smell",
  sight: "sight",
};
/** How fast each channel thins with distance, and how much cover takes from it. */
const FALL: Record<Channel, number> = {
  light: 0.5,
  smoke: 0.5,
  sound: 0.7,
  scent: 0.8,
  sight: 0.5,
};
const HIDES: Record<Channel, number> = {
  light: 0.5,
  smoke: 0.4,
  sound: 0.2,
  scent: 0.1,
  sight: 0.6,
};

/** What a signal competes with in this place, on its own channel. */
function drowned(channel: Channel, place: Place | undefined): number {
  const light = place?.light ?? 3;
  // What is seen by daylight competes with nothing: the light is what shows it.
  if (channel === "sight") return 0;
  if (channel === "light") return light * 0.6;
  // Smoke is seen against the sky: it needs some light, and is lost in the dark.
  if (channel === "smoke") return (5 - light) * 0.4 + (place?.wind ?? 0) * 0.2;
  if (channel === "sound") return (place?.noise ?? 2) * 0.5;
  return (place?.wind ?? 0) * 0.2;
}

function distance(
  a: readonly [number, number] | undefined,
  b: readonly [number, number] | undefined,
) {
  if (!(a && b)) return 0;
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

/** How hard it is for this body to notice anything on this channel right now. */
function threshold(world: MatterWorld, body: Body, channel: Channel): number {
  const senses = world.elements[body.element ?? ""]?.body;
  const acuity = senses?.[SENSE[channel]] ?? 2;
  const attention = body.attention ?? "alert";
  // A sleeper sees nothing, and is woken by less than it would notice awake.
  if (attention === "asleep" && SENSE[channel] === "sight") return Number.POSITIVE_INFINITY;
  const dulled = { alert: 0, distracted: 1, asleep: 2 }[attention];
  return 2.5 - acuity * 0.5 + dulled;
}

/** How far above this body's threshold a signal from that thing arrives. At or below 0: unnoticed. */
export function reaches(
  world: MatterWorld,
  body: Body,
  from: { where?: readonly [number, number] | undefined },
  channel: Channel,
  strength: number,
): number {
  const place = world.places[body.place];
  const far = FALL[channel] * Math.log2(1 + distance(body.where, from.where) / 4);
  const hidden = (place?.cover ?? 0) * HIDES[channel];
  return strength - far - hidden - drowned(channel, place) - threshold(world, body, channel);
}

/** How many things a body can hold in mind at once. */
const ATTENDS = 16;

/**
 * A body attends to a handful of things, not to every tree in the wood: what gives something
 * off before what is merely there, what would feed it when it is hungry, then the strongest.
 */
function attended(world: MatterWorld, body: Body, aware: Record<string, Percept>) {
  const entries = Object.entries(aware);
  if (entries.length <= ATTENDS) return aware;
  const hungry = (body.needs.hunger ?? 0) >= 2;
  const weight = ([id, p]: [string, Percept]) => {
    const fed = (feeds(world, body, world.things[id]?.element ?? "").hunger ?? 0) > 0;
    // What lives draws the eye before what only stands there.
    const lives = id in world.bodies ? 3 : 0;
    return p.strength + (p.channel === "sight" ? 0 : 2) + (hungry && fed ? 3 : 0) + lives;
  };
  const kept = entries.sort((a, b) => weight(b) - weight(a) || a[0].localeCompare(b[0]));
  return Object.fromEntries(kept.slice(0, ATTENDS));
}

/** A body is seen by daylight by its size, and smelled by its row, as any thing is. */
function bodyEmits(world: MatterWorld, body: Body): Partial<Record<Channel, number>> {
  const out: Partial<Record<Channel, number>> = {};
  const row = world.elements[body.element ?? ""]?.props;
  const light = world.places[body.place]?.light ?? 3;
  if (light > 0) out.sight = clamp((light / 5) * (2.5 + (row?.size ?? 3) * 0.5));
  if ((row?.scent ?? 0) > 0) out.scent = clamp(row?.scent ?? 0);
  return out;
}

interface Source {
  id: string;
  place: string;
  where?: readonly [number, number] | undefined;
  channel: Channel;
  strength: number;
}

function sourcesOf(world: MatterWorld, events: readonly Heard[]): Source[] {
  const sources: Source[] = [];
  const add = (from: Thing | Body, given: Partial<Record<Channel, number>>) => {
    for (const [channel, strength] of Object.entries(given) as [Channel, number][])
      sources.push({ id: from.id, place: from.place, where: from.where, channel, strength });
  };
  for (const thing of Object.values(world.things)) add(thing, emits(world, thing));
  for (const body of Object.values(world.bodies)) add(body, bodyEmits(world, body));
  for (const e of events) {
    const from = world.things[e.source] ?? world.bodies[e.source];
    if (from) add(from, { [e.channel]: e.strength });
  }
  return sources;
}

/** What every body is aware of now: the strongest way each source reaches it, if any does. */
export function sensed(
  world: MatterWorld,
  events: readonly Heard[] = [],
): Map<string, Record<string, Percept>> {
  const sources = sourcesOf(world, events);
  const out = new Map<string, Record<string, Percept>>();
  for (const body of Object.values(world.bodies)) {
    const aware: Record<string, Percept> = {};
    for (const s of sources) {
      if (s.place !== body.place || s.id === body.id) continue;
      const strength = reaches(world, body, s, s.channel, s.strength);
      if (strength <= 0 || strength <= (aware[s.id]?.strength ?? 0)) continue;
      aware[s.id] = { channel: s.channel, strength: clamp(strength) };
    }
    out.set(body.id, attended(world, body, aware));
  }
  return out;
}

const NOTICED: Record<Channel, string> = {
  light: "sees a light",
  smoke: "sees smoke",
  sound: "hears it",
  scent: "catches a scent",
  sight: "sees it",
};

/** The changes that bring every body's awareness up to date after an act. */
export function perceive(world: MatterWorld, changes: readonly Change[]): Change[] {
  const events: Heard[] = changes.flatMap((c) =>
    c.kind === "signal" && c.source
      ? [{ source: c.source, channel: c.channel, strength: c.strength }]
      : [],
  );
  const out: Change[] = [];
  for (const [id, aware] of sensed(world, events)) {
    const was = world.bodies[id]?.aware ?? {};
    if (JSON.stringify(was) === JSON.stringify(aware)) continue;
    const fresh = Object.entries(aware).find(([source]) => !(source in was));
    out.push({
      kind: "percept",
      body: id,
      aware,
      because: ["X8", "E9", "B7"],
      note: fresh ? NOTICED[fresh[1].channel] : "what it is aware of shifts",
      ...(fresh ? {} : { quiet: true as const }),
    });
  }
  return out;
}
