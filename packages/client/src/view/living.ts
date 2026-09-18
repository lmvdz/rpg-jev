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
import { effectsOf } from "./effect-rows.ts";
import type { EmitterList } from "./effects.ts";
import type { LightList } from "./lights.ts";
import { glyphLookOf, lightOf, type ThingView } from "./things.ts";

export class LivingThings {
  readonly #things: readonly ThingView[];
  readonly #grid: TileGrid;
  readonly #objects: ObjectLayer;
  /** Indices of the things that give light now, and where each sits in that list. */
  readonly #lit: number[] = [];
  readonly #litAt = new Map<number, number>();
  readonly #byTile = new Map<number, number>();

  constructor(things: readonly ThingView[], grid: TileGrid, objects: ObjectLayer) {
    this.#things = things;
    this.#grid = grid;
    this.#objects = objects;
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
      this.#setLit(index, lightOf(thing.states) !== null);
    }
  }

  #setLit(index: number, lit: boolean): void {
    const at = this.#litAt.get(index);
    if (lit === (at !== undefined)) return;
    if (lit) {
      this.#litAt.set(index, this.#lit.length);
      this.#lit.push(index);
      return;
    }
    // Swap the last into the gap, as the glyph batch does.
    const last = this.#lit.pop();
    this.#litAt.delete(index);
    if (last !== undefined && last !== index && at !== undefined) {
      this.#lit[at] = last;
      this.#litAt.set(last, at);
    }
  }

  /** Adds the effects of everything that is showing one. The same few things that give light, for now. */
  emit(emitters: EmitterList): void {
    for (const index of this.#lit) {
      const thing = this.#things[index];
      if (!thing) continue;
      const x = thing.x + 0.5;
      const z = thing.z + 0.5;
      const y = groundHeight(this.#grid, x, z);
      for (const row of effectsOf(thing.states)) emitters.add(x, y, z, row);
    }
  }

  /** Offers every light to the frame's list, which keeps the nearest. Call after `lights.begin`. */
  shine(lights: LightList): void {
    for (const index of this.#lit) {
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
