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
 * written against a presentation projection of the world's types. Change kinds
 * come from the engine; adding one must not leave a stale client-side vocabulary.
 *
 * Positions are the client's until the world has a move process (X1): the
 * world says a thing came into being, and the client finds it a tile.
 */
import type { matter } from "@rpg-jev/core";
import { type ElementView, type Seen, type SeenState, shownOf } from "@rpg-jev/core/world";
import type { TileGrid } from "../terrain/grid.ts";
import { kindAt } from "../terrain/kinds.ts";
import { groundHeight } from "../terrain/tessellate.ts";
import type { Births } from "../view/births.ts";
import type { Happening } from "../view/effect-birth.ts";
import type { OneShots } from "../view/effects.ts";
import type { LivingThings } from "../view/living.ts";
import type { MotionSubject } from "../view/motion-birth.ts";
import { type ActorMotions, MOTIONS } from "../view/motions.ts";
import type { ThingView } from "../view/things.ts";

export { type ElementView, type Seen, type SeenState, shownOf };

interface Why {
  because: readonly string[];
  note: string;
  /** Nothing a person standing there would notice: the world applied it, and it is neither said nor drawn. */
  quiet?: true;
}

/**
 * A mirror of the world's `Change`, as far as the client reads one: its kind,
 * its words, and a signal's channel. What a change did to a thing is read off
 * the thing, never off the change.
 */
export type WorldChange = Why &
  (
    | { kind: "signal"; place: string; channel: string; strength: number; source?: string }
    | { kind: Exclude<matter.Change["kind"], "signal"> }
  );

const level = (n: number) => Math.min(Math.max(Math.round(n), 0), 5);

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
  show(
    act: ShownAct,
    changes: readonly WorldChange[],
    after: After = {},
    moved: Readonly<Record<string, readonly [number, number]>> = {},
  ): string[] {
    const patient = this.#host.living.thingAt(act.tile);
    const left = patient ? after[patient.id] : undefined;
    // It broke if this act took it from more than broken to broken, or to nothing.
    const was = patient?.states.integrity ?? 5;
    const broke = left === null || (was > BROKEN && (left?.state.integrity ?? was) <= BROKEN);
    this.#play(act, patient, broke);
    for (const [id, seen] of Object.entries(after)) this.#sync(id, seen, act.tile);
    // What went somewhere by its own choice is drawn where it is now.
    const { living } = this.#host;
    for (const [id, [x, z]] of Object.entries(moved)) living.move(living.indexOf(id), x, z);
    const noticed = changes.filter((change) => !change.quiet);
    for (const change of noticed) {
      if (change.kind === "signal") this.#signal(change, act);
    }
    return noticed.map((change) => change.note).filter((note) => note.length > 0);
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

  /** A signal that can be seen rises from the thing it came from, or else from what the act was done to. */
  #signal(signal: { channel: string; strength: number; source?: string }, act: ShownAct): void {
    const { grid, living, births, shots } = this.#host;
    const happening = SIGNAL_SHOWS[signal.channel];
    const named = living.thing(living.indexOf(signal.source ?? ""));
    const source = named ?? living.thingAt(act.tile);
    if (!(happening && source)) return;
    const rows = births.effects.entry(source, happening).value[level(signal.strength)] ?? [];
    const [x, z] = [source.x + 0.5, source.z + 0.5];
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
