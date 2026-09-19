/**
 * The seam between the world's rules and what is drawn. The world resolves an
 * act into changes (`matter.resolve` in packages/core: every change says what
 * it did, `because` of which vocabulary ids, and a `note` in words); this turns
 * those changes into the things on screen, and shows the act itself: the
 * actor's motion, the patient's, and what comes off the patient.
 *
 * It knows no thing and no element. What a kind of change does is a row of a
 * table; what a state of the world shows as is a rule per state. It is written
 * against a mirror of the world's types, so it does not wait on the engine
 * being importable; a type test will hold the two together when it is.
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

/** The part of the world's `ThingState` that can be seen. A hidden flaw, by its nature, is not here. */
export interface SeenState {
  temperature: number;
  /** How far the surface runs above the bulk: what glows before it is hot through. */
  surfaceAbove: number;
  wetness: number;
  wetWith: string | null;
  burning: { fuel: number } | null;
  integrity: number;
  amount: number;
  corrosion: number;
  contamination: number;
}

/** Below this, rot gives no sign anyone would notice (it smells from about here up). */
const NOTICED = 1.5;

interface Why {
  because: readonly string[];
  note: string;
}

/** A mirror of the world's `Change`. Kinds the client draws nothing for are still told on the HUD. */
export type WorldChange = Why &
  (
    | { kind: "state"; thing: string; set: Partial<SeenState> }
    | { kind: "create"; thing: { id: string; element: string; state: Partial<SeenState> } }
    | { kind: "consume"; thing: string; amount: number }
    | { kind: "signal"; place: string; channel: string; strength: number }
    | { kind: "nothing" | "body" | "wound" | "treat" | "settle" }
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

const level = (n: number) => Math.min(Math.max(Math.round(n), 0), 5);

/** Minutes of fuel past which a fire shows one level higher. Arithmetic, so it is here and not judged. */
const FUEL_STEPS = [0, 5, 15, 60, 180] as const;

/** One rule per state of the world: what it shows as. Absent from `seen` means leave what shows alone. */
const SHOWN: readonly ((seen: Partial<SeenState>, out: VisibleStates) => void)[] = [
  (seen, out) => {
    if (seen.burning === undefined) return;
    const fuel = seen.burning?.fuel ?? 0;
    out.burning = fuel > 0 ? FUEL_STEPS.filter((step) => fuel > step).length : 0;
  },
  (seen, out) => {
    if (seen.temperature === undefined && seen.surfaceAbove === undefined) return;
    // The surface is what is seen and felt first.
    out.temperature = level((seen.temperature ?? 2) + (seen.surfaceAbove ?? 0));
  },
  (seen, out) => {
    if (seen.wetness !== undefined) out.wetness = level(seen.wetness);
  },
  (seen, out) => {
    if (seen.integrity !== undefined) out.integrity = level(seen.integrity);
  },
  (seen, out) => {
    if (seen.amount !== undefined) out.amount = level(seen.amount);
  },
  (seen, out) => {
    if (seen.corrosion !== undefined) out.corrosion = level(seen.corrosion);
  },
  (seen, out) => {
    if (seen.contamination === undefined) return;
    out.contamination = seen.contamination >= NOTICED ? level(seen.contamination) : 0;
  },
];

/** What a thing's seen state shows as, laid over what it showed before (growth is not the world's yet). */
export function shownOf(seen: Partial<SeenState>, before: VisibleStates = {}): VisibleStates {
  const out = { ...before };
  for (const rule of SHOWN) rule(seen, out);
  return out;
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

export class WorldLink {
  readonly #host: LinkHost;
  /** What is known of each thing's seen state, since a change names only what changed. */
  readonly #seen = new Map<string, Partial<SeenState>>();
  /** The clock of the act being shown, in seconds. */
  #now = 0;

  constructor(host: LinkHost) {
    this.#host = host;
  }

  /**
   * Shows an act and applies what it changed. Returns the notes, in order, for
   * the HUD: they are the world's words and are only ever set as text.
   */
  show(act: ShownAct, changes: readonly WorldChange[]): string[] {
    this.#now = act.now;
    const patient = this.#host.living.thingAt(act.tile);
    const broke = changes.some(
      (change) =>
        change.kind === "state" &&
        change.thing === patient?.id &&
        (change.set.integrity ?? 5) <= BROKEN,
    );
    this.#play(act, patient, broke);
    for (const change of changes) this.#apply(change, act.tile);
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

  #apply(change: WorldChange, near: number): void {
    const handle = HANDLERS[change.kind];
    if (handle) handle(this, change, near);
  }

  /** A thing's seen state changed: remember it whole, and show it. */
  setSeen(id: string, set: Partial<SeenState>): void {
    const { living } = this.#host;
    const seen = { ...this.#seen.get(id), ...set };
    this.#seen.set(id, seen);
    const index = living.indexOf(id);
    const thing = living.thing(index);
    if (!thing) return;
    thing.states = shownOf(seen, thing.states);
    living.redraw([index]);
  }

  /** Some of a thing was used up: it shows less, and when none is left it is gone. */
  consume(id: string, amount: number): void {
    const { living } = this.#host;
    const index = living.indexOf(id);
    const thing = living.thing(index);
    if (!thing) return;
    const left = (this.#seen.get(id)?.amount ?? thing.states.amount ?? 5) - amount;
    if (left > 0) this.setSeen(id, { amount: left });
    else {
      living.remove(index);
      this.#seen.delete(id);
    }
  }

  /** A thing came into being. The world gives no position, so it lands on the nearest free tile. */
  create(made: { id: string; element: string; state: Partial<SeenState> }, near: number): void {
    const { grid, living, elementOf } = this.#host;
    const element = elementOf(made.element);
    const tile = freeTileNear(grid, living, near);
    if (!element || tile < 0) return;
    this.#seen.set(made.id, made.state);
    const { look, kind, forms, baseline, solid } = element;
    living.add({
      id: made.id,
      element: made.element,
      name: element.name,
      x: tile % grid.width,
      z: Math.floor(tile / grid.width),
      states: shownOf(made.state),
      ...(look ? { look } : {}),
      ...(kind ? { kind } : {}),
      ...(forms ? { forms } : {}),
      ...(baseline ? { baseline } : {}),
      ...(solid === undefined ? {} : { solid }),
    });
  }

  /** A signal that can be seen rises where the act was, from whatever stands there. */
  signal(channel: string, strength: number, near: number): void {
    const { grid, living, births, shots } = this.#host;
    const happening = SIGNAL_SHOWS[channel];
    const source = living.thingAt(near);
    if (!(happening && source)) return;
    const rows = births.effects.entry(source, happening).value[level(strength)] ?? [];
    const x = (near % grid.width) + 0.5;
    const z = Math.floor(near / grid.width) + 0.5;
    shots.play(x, groundHeight(grid, x, z) + 0.5, z, rows, this.#now);
  }
}

/** What each kind of change does to what is drawn. A kind with no row is told on the HUD and draws nothing. */
const HANDLERS: Readonly<
  Partial<Record<WorldChange["kind"], (link: WorldLink, change: WorldChange, near: number) => void>>
> = {
  state: (link, change) => {
    if (change.kind === "state") link.setSeen(change.thing, change.set);
  },
  consume: (link, change) => {
    if (change.kind === "consume") link.consume(change.thing, change.amount);
  },
  create: (link, change, near) => {
    if (change.kind === "create") link.create(change.thing, near);
  },
  signal: (link, change, near) => {
    if (change.kind === "signal") link.signal(change.channel, change.strength, near);
  },
};

const SEARCH = 3;

/** The nearest tile to `near` with nothing standing on it, nearest first, or -1. */
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
