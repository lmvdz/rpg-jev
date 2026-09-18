/**
 * The things of a grown world on screen: each drawn from its look and its
 * visible states, redrawn when a state changes, and lighting the ground when
 * it burns or glows. This is the renderer's whole side of the seam in
 * `things.ts`; where the states come from (for now `scene/drift.ts`, later
 * world state) is not its business.
 */
import type { TileGrid } from "../terrain/grid.ts";
import { groundHeight } from "../terrain/tessellate.ts";
import type { ObjectLayer } from "../world/objects.ts";
import { type EffectBook, type Entry, showingOf } from "./effect-book.ts";
import type { EffectRow, EmitterList } from "./effects.ts";
import type { LightList } from "./lights.ts";
import { glyphLookOf, lightOf, type ThingView } from "./things.ts";

const NOTHING: readonly EffectRow[] = [];

/** The few of many that are doing something now: walked every frame, changed in constant time. */
class Few {
  readonly members: number[] = [];
  readonly #at = new Map<number, number>();

  set(index: number, member: boolean): void {
    const at = this.#at.get(index);
    if (member === (at !== undefined)) return;
    if (member) {
      this.#at.set(index, this.members.length);
      this.members.push(index);
      return;
    }
    // Swap the last into the gap, as the glyph batch does.
    const last = this.members.pop();
    this.#at.delete(index);
    if (last !== undefined && last !== index && at !== undefined) {
      this.members[at] = last;
      this.#at.set(last, at);
    }
  }
}

/** One effect a thing is showing: the book's entry for its element and the happening, and how hard. */
interface Play {
  entry: Entry;
  level: number;
}

export class LivingThings {
  readonly #things: readonly ThingView[];
  readonly #grid: TileGrid;
  readonly #objects: ObjectLayer;
  readonly #book: EffectBook;
  /** The things that give light now, and the things that show an effect. */
  readonly #lit = new Few();
  readonly #showing = new Few();
  readonly #plays = new Map<number, readonly Play[]>();
  readonly #byTile = new Map<number, number>();

  constructor(
    things: readonly ThingView[],
    grid: TileGrid,
    objects: ObjectLayer,
    book: EffectBook,
  ) {
    this.#things = things;
    this.#grid = grid;
    this.#objects = objects;
    this.#book = book;
    things.forEach((thing, index) => {
      this.#byTile.set(grid.index(thing.x, thing.z), index);
    });
    this.redraw(things.map((_, index) => index));
  }

  /** The thing standing on a tile, if any: what the mouse is over, what a step would bump into. */
  thingAt(tileIndex: number): ThingView | null {
    const index = this.#byTile.get(tileIndex);
    return index === undefined ? null : (this.#things[index] ?? null);
  }

  /** As `steps.ts` asks it: is something solid on this tile. */
  readonly blocks = (tileIndex: number): boolean => this.thingAt(tileIndex)?.solid === true;

  /**
   * These things' states changed: draw them as they are now. The cost is in
   * what changed and never in how many things there are, which is the only
   * way a busy world stays cheap to show.
   */
  redraw(changed: readonly number[]): void {
    for (const index of changed) {
      const thing = this.#things[index];
      if (!thing) continue;
      const look = glyphLookOf(thing.look, thing.states);
      this.#objects.set(this.#grid.index(thing.x, thing.z), look);
      this.#lit.set(index, lightOf(thing.states) !== null);
      const plays = showingOf(thing.states).map((showing) => ({
        entry: this.#book.entry(thing, showing.happening),
        level: showing.level,
      }));
      this.#showing.set(index, plays.length > 0);
      if (plays.length > 0) this.#plays.set(index, plays);
      else this.#plays.delete(index);
    }
  }

  /**
   * Adds the effects of everything that is showing one. Which row that is was
   * settled when the state changed; a row born since is simply found in its entry.
   */
  emit(emitters: EmitterList): void {
    for (const index of this.#showing.members) {
      const thing = this.#things[index];
      const plays = this.#plays.get(index);
      if (!(thing && plays)) continue;
      const x = thing.x + 0.5;
      const z = thing.z + 0.5;
      const y = groundHeight(this.#grid, x, z);
      for (const play of plays) {
        for (const row of play.entry.rows[play.level] ?? NOTHING) emitters.add(x, y, z, row);
      }
    }
  }

  /** Offers every light to the frame's list, which keeps the nearest. Call after `lights.begin`. */
  shine(lights: LightList): void {
    for (const index of this.#lit.members) {
      const thing = this.#things[index];
      const light = thing ? lightOf(thing.states) : null;
      if (!(thing && light)) continue;
      const x = thing.x + 0.5;
      const z = thing.z + 0.5;
      const y = groundHeight(this.#grid, x, z) + light.height;
      lights.offer(x, y, z, light.radius, light.colour, light.flicker);
    }
  }
}
