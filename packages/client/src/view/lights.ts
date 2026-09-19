/**
 * The lights of a frame. In the sandbox a light is not a fixture: anything
 * burning gives light (docs/sandbox-direction.md), so there may be many, and
 * the shader takes only a few. This keeps the nearest few to the followed
 * point, in fixed storage, so gathering them allocates nothing.
 */
export const MAX_LIGHTS = 8;

export class LightList {
  /** Per light: x, y, z, radius. */
  readonly positions = new Float32Array(MAX_LIGHTS * 4);
  /** Per light: r, g, b, flicker (0 steady to 1 guttering). */
  readonly colours = new Float32Array(MAX_LIGHTS * 4);
  readonly #distances = new Float32Array(MAX_LIGHTS);
  count = 0;
  #nearX = 0;
  #nearZ = 0;

  /** Empties the list; the lights offered next are ranked by distance from this point. */
  begin(nearX: number, nearZ: number): void {
    this.count = 0;
    this.#nearX = nearX;
    this.#nearZ = nearZ;
  }

  /** Takes the light if there is room, or if it is nearer than the furthest one held. */
  offer(
    x: number,
    y: number,
    z: number,
    radius: number,
    colour: readonly [number, number, number],
    flicker: number,
  ): void {
    const distance = Math.hypot(x - this.#nearX, z - this.#nearZ) - radius;
    let slot = this.count;
    if (this.count === MAX_LIGHTS) {
      slot = 0;
      for (let i = 1; i < MAX_LIGHTS; i++) {
        if ((this.#distances[i] ?? 0) > (this.#distances[slot] ?? 0)) slot = i;
      }
      if (distance >= (this.#distances[slot] ?? 0)) return;
    } else {
      this.count++;
    }
    this.#distances[slot] = distance;
    const at = slot * 4;
    this.positions[at] = x;
    this.positions[at + 1] = y;
    this.positions[at + 2] = z;
    this.positions[at + 3] = radius;
    this.colours[at] = colour[0];
    this.colours[at + 1] = colour[1];
    this.colours[at + 2] = colour[2];
    this.colours[at + 3] = flicker;
  }
}
