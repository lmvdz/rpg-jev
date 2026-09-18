/**
 * A stand-in for the world's own clock, so the clearing changes while the
 * player stands still: plants move through their stages, die back and come
 * again, and the fire burns down and is fed. The sandbox's drift process
 * (spikes/vocabulary, X7) will do this from world state, in closed form. This
 * only nudges the visible states at random so the renderer has change to show.
 */
import { Rng } from "@rpg-jev/core/rng";
import type { ThingView } from "../view/things.ts";

const NUDGES_PER_STEP = 5;
/** After bearing (4) a plant mostly stays, sometimes goes dormant (5), dies (6), and reseeds (0). */
const LEAVES_STAGE_CHANCE = [1, 0.7, 0.5, 0.3, 0.04, 0.2, 0.3] as const;

export class Drift {
  readonly #things: readonly ThingView[];
  readonly #rng: Rng;

  constructor(things: readonly ThingView[], seed: number) {
    this.#things = things;
    this.#rng = Rng.fromSeed(seed);
  }

  /** Nudges a few things and returns which, by index, so their looks can be redrawn. */
  step(): number[] {
    const changed: number[] = [];
    for (let i = 0; i < NUDGES_PER_STEP && this.#things.length > 0; i++) {
      const index = Math.floor(this.#rng.next() * this.#things.length);
      const states = this.#things[index]?.states;
      if (states && this.#nudge(states)) changed.push(index);
    }
    return changed;
  }

  #nudge(states: ThingView["states"]): boolean {
    if (states.burning !== undefined) {
      states.burning = states.burning <= 2 ? 5 : states.burning - 1;
      return true;
    }
    if (states.growth === undefined) return false;
    if (this.#rng.next() > (LEAVES_STAGE_CHANCE[states.growth] ?? 0)) return false;
    states.growth = (states.growth + 1) % 7;
    return true;
  }
}
