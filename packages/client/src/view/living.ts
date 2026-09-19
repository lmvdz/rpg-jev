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
import type { Entry } from "./birth.ts";
import type { Births } from "./births.ts";
import { type RowsByLevel, showingOf } from "./effect-book.ts";
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
  entry: Entry<RowsByLevel>;
  level: number;
}

export class LivingThings {
  readonly #things: ThingView[];
  readonly #byId = new Map<string, number>();
  readonly #gone = new Set<number>();
  readonly #grid: TileGrid;
  readonly #objects: ObjectLayer;
  readonly #births: Births;
  /** The things that give light now, and the things that show an effect. */
  readonly #lit = new Few();
  readonly #showing = new Few();
  readonly #plays = new Map<number, readonly Play[]>();
  readonly #byTile = new Map<number, number>();
  /** The things that came without a look, by element: redrawn when the element's look is born. */
  readonly #unlooked = new Map<string, number[]>();

  constructor(things: ThingView[], grid: TileGrid, objects: ObjectLayer, births: Births) {
    this.#things = things;
    this.#grid = grid;
    this.#objects = objects;
    this.#births = births;
    things.forEach((thing, index) => {
      this.#know(thing, index);
    });
    births.onLook = (element) => this.redraw(this.#unlooked.get(element) ?? []);
    this.redraw(things.map((_, index) => index));
  }

  #know(thing: ThingView, index: number): void {
    this.#byTile.set(this.#grid.index(thing.x, thing.z), index);
    this.#byId.set(thing.id, index);
    if (thing.look) return;
    const same = this.#unlooked.get(thing.element);
    if (same) same.push(index);
    else this.#unlooked.set(thing.element, [index]);
  }

  /** Where a thing is in the list, by the world's id for it, or -1. */
  indexOf(id: string): number {
    return this.#byId.get(id) ?? -1;
  }

  thing(index: number): ThingView | null {
    return this.#gone.has(index) ? null : (this.#things[index] ?? null);
  }

  /** A thing has come into being. One thing to a tile: -1 if its tile is taken or off the map. */
  add(thing: ThingView): number {
    if (!this.#grid.contains(thing.x, thing.z)) return -1;
    if (this.#byTile.has(this.#grid.index(thing.x, thing.z)) || this.#byId.has(thing.id)) return -1;
    const index = this.#things.push(thing) - 1;
    this.#know(thing, index);
    this.redraw([index]);
    return index;
  }

  /** A thing is no more. Its place in the list is kept and left empty, so other things' indices hold. */
  remove(index: number): void {
    const thing = this.thing(index);
    if (!thing) return;
    const tile = this.#grid.index(thing.x, thing.z);
    this.#gone.add(index);
    this.#byTile.delete(tile);
    this.#byId.delete(thing.id);
    this.#objects.set(tile, null);
    this.#lit.set(index, false);
    this.#showing.set(index, false);
    this.#plays.delete(index);
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
      const thing = this.thing(index);
      if (!thing) continue;
      // An element row brings its look; one that came without has it born here, once.
      const base = thing.look ?? this.#births.look(thing).value;
      this.#objects.set(this.#grid.index(thing.x, thing.z), glyphLookOf(base, thing.states));
      this.#lit.set(index, lightOf(thing.states) !== null);
      const plays = showingOf(thing.states).map((showing) => ({
        entry: this.#births.effects.entry(thing, showing.happening),
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
        for (const row of play.entry.value[play.level] ?? NOTHING) emitters.add(x, y, z, row);
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
