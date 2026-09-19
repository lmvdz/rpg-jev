/**
 * A stand-in body, so the status display has something true to the hand to
 * show: walking tires, standing rests, time makes hungry, and an empty
 * stomach wears health down. The sandbox's bodies run on the needs graph in
 * world state; this only moves four numbers so the display can be judged.
 */
import { INK } from "../palette.ts";
import type { BodyView, Meter } from "../view/body.ts";

/** Per second. */
const TIRES = 0.05;
const RESTS = 0.12;
const HUNGERS = 0.004;
const STARVES = 0.01;
const MENDS = 0.003;

export class StandInBody {
  readonly view: BodyView = {
    meters: [
      { id: "health", label: "health", level: 1, ink: INK.ember },
      { id: "hunger", label: "fed", level: 0.8, ink: INK.sand },
      { id: "stamina", label: "stamina", level: 1, ink: INK.leaf },
    ],
    counts: [{ id: "money", label: "coin", value: 12 }],
  };

  #meter(id: string): Meter {
    const found = this.view.meters.find((meter) => meter.id === id);
    if (!found) throw new Error(`the stand-in body has no ${id}`);
    return found;
  }

  update(dt: number, moving: boolean): void {
    const step = Math.max(dt, 0);
    const health = this.#meter("health");
    const fed = this.#meter("hunger");
    const stamina = this.#meter("stamina");
    stamina.level += (moving ? -TIRES : RESTS) * step;
    fed.level -= HUNGERS * (moving ? 2 : 1) * step;
    health.level += (fed.level <= 0 ? -STARVES : MENDS) * step;
    for (const meter of this.view.meters) meter.level = Math.min(Math.max(meter.level, 0), 1);
  }
}
