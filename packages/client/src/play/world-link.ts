/**
 * The seam between the world's rules and what is drawn. The world resolves an
 * act into changes and into itself with those changes applied
 * (`matter.resolve` in packages/core). Only that code applies changes (rule
 * 1), so the client never rebuilds the world from the list: it is handed the
 * things the act touched as they are afterwards and draws those. The list of
 * changes says three things only: what to redraw, what to play once (a signal
 * that can be seen), and what to tell on the HUD, in the world's own words.
 *
 * It knows no thing and no element. What a state of the world shows as is a
 * rule per state; what is played for an act is a row per process. It is
 * written against a mirror of the world's types, so it does not wait on the
 * engine being importable; a type test will hold the two together when it is.
 *
 * Positions are the client's until the world has a move process (X1): the
 * world says a thing came into being, and the client finds it a tile.
 */
import type { TileGrid } from "../terrain/grid.ts";
import { kindAt } from "../terrain/kinds.ts";
import { groundHeight } from "../terrain/tessellate.ts";
import type { Births } from "../view/births.ts";
import type { Happening } from "../view/effect-birth.ts";
import type { OneShots } from "../view/effects.ts";
import type { LivingThings } from "../view/living.ts";
import type { MotionSubject } from "../view/motion-birth.ts";
import { type ActorMotions, MOTIONS } from "../view/motions.ts";
import type { ElementLook, ThingView, VisibleStates } from "../view/things.ts";

/** The part of the world's `ThingState` that can be seen. A hidden flaw, temper and taint are not here. */
export interface SeenState {
  temperature: number;
  /** How far the surface runs above the bulk: what glows before it is hot through. */
  surfaceAbove: number;
  wetness: number;
  wetWith: string | null;
  integrity: number;
  amount: number;
  corrosion: number;
  contamination: number;
}

/** A thing as it is after an act: what the world's adapter reads off `outcome.world`. */
export interface Seen {
  element: string;
  state: Partial<SeenState>;
  /**
   * How hard it burns, 0 when it does not, else up to 5 (`matter.blaze`): the
   * world derives it from what is burning, how much of the thing that covers
   * and whether it is near its end. Fuel is how long it lasts, not how hard.
   */
  blaze: number;
}

interface Why {
  because: readonly string[];
  note: string;
}

/**
 * A mirror of the world's `Change`, as far as the client reads one: its kind,
 * its words, and a signal's channel. What a change did to a thing is read off
 * the thing, never off the change.
 */
export type WorldChange = Why &
  (
    | { kind: "signal"; place: string; channel: string; strength: number }
    | { kind: "state" | "create" | "consume" | "nothing" | "body" | "wound" | "treat" | "settle" }
  );

/** What the client is told of an element: the row's name, look and what births are decided from. */
export interface ElementView {
  name: string;
  kind?: string;
  forms?: readonly string[];
  baseline?: Readonly<Record<string, number>>;
  look?: ElementLook;
  solid?: boolean;
}

/** Below this, rot gives no sign anyone would notice (it smells from about here up). */
const NOTICED = 1.5;

const level = (n: number) => Math.min(Math.max(Math.round(n), 0), 5);

/** One rule per state of the world: what it shows as. */
const SHOWN: readonly ((seen: Seen, out: VisibleStates) => void)[] = [
  (seen, out) => {
    // What burns at all shows as burning, however low.
    out.burning = seen.blaze > 0 ? Math.max(level(seen.blaze), 1) : 0;
  },
  ({ state }, out) => {
    if (state.temperature === undefined && state.surfaceAbove === undefined) return;
    // The surface is what is seen and felt first.
    out.temperature = level((state.temperature ?? 2) + (state.surfaceAbove ?? 0));
  },
  ({ state }, out) => {
    if (state.wetness !== undefined) out.wetness = level(state.wetness);
  },
  ({ state }, out) => {
    if (state.integrity !== undefined) out.integrity = level(state.integrity);
  },
  ({ state }, out) => {
    if (state.amount !== undefined) out.amount = level(state.amount);
  },
  ({ state }, out) => {
    if (state.corrosion !== undefined) out.corrosion = level(state.corrosion);
  },
  ({ state }, out) => {
    if (state.contamination === undefined) return;
    out.contamination = state.contamination >= NOTICED ? level(state.contamination) : 0;
  },
];

/** What a thing shows as, laid over what it showed before (growth is not the world's yet). */
export function shownOf(seen: Seen, before: VisibleStates = {}): VisibleStates {
  const out = { ...before };
  for (const rule of SHOWN) rule(seen, out);
  // What does not burn has no such state to show: a thing is not a fire that happens to be out.
  const { burning, ...rest } = out;
  return burning ? { ...rest, burning } : rest;
}

/** What shows of an act, by the world's name for its process: the vocabulary id, and what comes off the patient. */
const ACT_SHOWS: Readonly<
  Record<string, { process: MotionSubject["process"]; happening: Happening | null }>
> = {
  force: { process: "X2", happening: "struck" },
  heat: { process: "X3", happening: null },
  soak: { process: "X4", happening: "soaks" },
  coat: { process: "X5", happening: "soaks" },
  ingest: { process: "X6", happening: null },
  drift: { process: "X7", happening: null },
  search: { process: "X8", happening: null },
};

/** A signal that can be seen, by channel, as something happening where it rises. */
const SIGNAL_SHOWS: Readonly<Record<string, Happening>> = { smoke: "fumes" };

/** When the actor's motion lands on the patient, in seconds. */
const LANDS = 0.08;
const BROKEN = 1;

export interface LinkHost {
  grid: TileGrid;
  living: LivingThings;
  births: Births;
  shots: OneShots;
  motions: Pick<ActorMotions, "play">;
  /** The glyph slot of the actor, and of whatever stands on a tile. */
  actorSlot(): number;
  slotAt(tile: number): number;
  elementOf(id: string): ElementView | null;
}

export interface ShownAct {
  /** The world's name for the process (`force`, `soak`...). Unknown ones show nothing and break nothing. */
  process: string;
  actorTile: number;
  /** The tile acted on. */
  tile: number;
  /** How hard, 1 to 5: the manner's effort. */
  level: number;
  now: number;
}

/** The things an act touched, by id, as they are after it. Null: the thing is no more. */
export type After = Readonly<Record<string, Seen | null>>;

export class WorldLink {
  readonly #host: LinkHost;

  constructor(host: LinkHost) {
    this.#host = host;
  }

  /**
   * Shows an act and what it left behind. Returns the notes, in order, for the
   * HUD: they are the world's words and are only ever set as text.
   */
  show(act: ShownAct, changes: readonly WorldChange[], after: After = {}): string[] {
    const patient = this.#host.living.thingAt(act.tile);
    const left = patient ? after[patient.id] : undefined;
    // It broke if this act took it from more than broken to broken, or to nothing.
    const was = patient?.states.integrity ?? 5;
    const broke = left === null || (was > BROKEN && (left?.state.integrity ?? was) <= BROKEN);
    this.#play(act, patient, broke);
    for (const [id, seen] of Object.entries(after)) this.#sync(id, seen, act.tile);
    for (const change of changes) {
      if (change.kind === "signal") this.#signal(change.channel, change.strength, act);
    }
    return changes.map((change) => change.note).filter((note) => note.length > 0);
  }

  #play(act: ShownAct, patient: ThingView | null, broke: boolean): void {
    const shows = ACT_SHOWS[act.process];
    if (!shows) return;
    const { grid, births, motions, shots } = this.#host;
    const x = act.tile % grid.width;
    const z = Math.floor(act.tile / grid.width);
    const dirX = x - (act.actorTile % grid.width);
    const dirZ = z - Math.floor(act.actorTile / grid.width);
    const generic = shows.process === "X2" ? MOTIONS : null;
    const acts = births.motion(shows.process, "actor", null, generic?.lunge ?? null).value;
    const suffers = births.motion(shows.process, "patient", patient, generic?.shake ?? null).value;
    if (acts) motions.play(() => this.#host.actorSlot(), acts, act.now, dirX, dirZ);
    if (suffers) {
      motions.play(() => this.#host.slotAt(act.tile), suffers, act.now + LANDS, dirX, dirZ);
    }
    const happening = broke ? "breaks" : shows.happening;
    if (!(patient && happening)) return;
    const rows = births.effects.entry(patient, happening).value[level(act.level)] ?? [];
    const y = groundHeight(grid, x + 0.5, z + 0.5) + 0.5;
    shots.play(x + 0.5, y, z + 0.5, rows, act.now + LANDS);
  }

  /** Draws one touched thing as the world now has it: gone, changed, or new. */
  #sync(id: string, seen: Seen | null, near: number): void {
    const { living } = this.#host;
    const index = living.indexOf(id);
    const thing = living.thing(index);
    if (seen === null) {
      if (thing) living.remove(index);
      return;
    }
    if (!thing) {
      this.#create(id, seen, near);
      return;
    }
    thing.states = shownOf(seen, thing.states);
    living.redraw([index]);
  }

  /** A thing came into being. The world gives no position, so it lands on the nearest free tile. */
  #create(id: string, seen: Seen, near: number): void {
    const { grid, living, elementOf } = this.#host;
    const element = elementOf(seen.element);
    const tile = freeTileNear(grid, living, near);
    if (!element || tile < 0) return;
    const { look, kind, forms, baseline, solid } = element;
    living.add({
      id,
      element: seen.element,
      name: element.name,
      x: tile % grid.width,
      z: Math.floor(tile / grid.width),
      states: shownOf(seen),
      ...(look ? { look } : {}),
      ...(kind ? { kind } : {}),
      ...(forms ? { forms } : {}),
      ...(baseline ? { baseline } : {}),
      ...(solid === undefined ? {} : { solid }),
    });
  }

  /** A signal that can be seen rises where the act was, from whatever stands there. */
  #signal(channel: string, strength: number, act: ShownAct): void {
    const { grid, living, births, shots } = this.#host;
    const happening = SIGNAL_SHOWS[channel];
    const source = living.thingAt(act.tile);
    if (!(happening && source)) return;
    const rows = births.effects.entry(source, happening).value[level(strength)] ?? [];
    const x = (act.tile % grid.width) + 0.5;
    const z = Math.floor(act.tile / grid.width) + 0.5;
    shots.play(x, groundHeight(grid, x, z) + 0.5, z, rows, act.now);
  }
}

const SEARCH = 3;

/** The nearest tile to `near` with nothing standing on it and no liquid, or -1. */
export function freeTileNear(grid: TileGrid, living: LivingThings, near: number): number {
  const nx = near % grid.width;
  const nz = Math.floor(near / grid.width);
  let best = -1;
  let bestAway = Number.POSITIVE_INFINITY;
  for (let dz = -SEARCH; dz <= SEARCH; dz++) {
    for (let dx = -SEARCH; dx <= SEARCH; dx++) {
      const [x, z] = [nx + dx, nz + dz];
      if (!grid.contains(x, z) || living.thingAt(grid.index(x, z))) continue;
      if (kindAt(grid.kindAt(x, z)).liquid) continue;
      const away = dx * dx + dz * dz;
      if (away < bestAway) {
        bestAway = away;
        best = grid.index(x, z);
      }
    }
  }
  return best;
}
