/**
 * The world's seeded RNG (SPEC.md section 13). Its whole state is four
 * integers, so it can be written to the event log and restored exactly.
 * Algorithm: sfc32.
 */
export type RngState = readonly [number, number, number, number];

export class Rng {
  #a: number;
  #b: number;
  #c: number;
  #d: number;

  private constructor(state: RngState) {
    [this.#a, this.#b, this.#c, this.#d] = state;
  }

  static fromSeed(seed: number): Rng {
    const rng = new Rng([0x9e3779b9, 0x243f6a88, 0xb7e15162, seed >>> 0]);
    // Warm up so that nearby seeds diverge.
    for (let i = 0; i < 15; i++) rng.nextUint32();
    return rng;
  }

  static fromState(state: RngState): Rng {
    return new Rng(state);
  }

  get state(): RngState {
    return [this.#a, this.#b, this.#c, this.#d];
  }

  nextUint32(): number {
    const t = (((this.#a + this.#b) | 0) + this.#d) | 0;
    this.#d = (this.#d + 1) | 0;
    this.#a = this.#b ^ (this.#b >>> 9);
    this.#b = (this.#c + (this.#c << 3)) | 0;
    this.#c = (this.#c << 21) | (this.#c >>> 11);
    this.#c = (this.#c + t) | 0;
    return t >>> 0;
  }

  /** Uniform float in [0, 1). */
  next(): number {
    return this.nextUint32() / 0x1_0000_0000;
  }

  /**
   * Samples a key from a probability map, such as a Jev Choice distribution.
   * Keys are visited in sorted order so the result never depends on the
   * order the API returned them in.
   */
  sample<K extends string>(probabilities: Readonly<Record<K, number>>): K {
    const keys = (Object.keys(probabilities) as K[]).sort();
    if (keys.length === 0) throw new Error("cannot sample an empty distribution");
    let total = 0;
    for (const key of keys) total += probabilities[key];
    if (!(total > 0)) throw new Error("distribution has no positive mass");

    let remaining = this.next() * total;
    for (const key of keys) {
      remaining -= probabilities[key];
      if (remaining < 0) return key;
    }
    // Floating-point leftovers: fall back to the last key.
    return keys[keys.length - 1] as K;
  }
}
