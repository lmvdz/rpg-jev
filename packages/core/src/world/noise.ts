/**
 * Smooth value noise, summed over octaves (SPEC.md section 16). It is what
 * the clearing (`./clearing.ts`) and the client's R1 test card grow their
 * terrain from, so it lives where both can reach it without a clock or I/O:
 * randomness comes only from the `Rng` handed in.
 */
import type { Rng } from "../rng.ts";

/** Smooth noise in [0, 1) from a lattice of random values, summed over octaves. */
export function makeNoise(rng: Rng): (x: number, z: number) => number {
  const size = 64;
  const lattice = new Float32Array(size * size);
  for (let i = 0; i < lattice.length; i++) lattice[i] = rng.next();
  const at = (x: number, z: number) => lattice[(z & (size - 1)) * size + (x & (size - 1))] ?? 0;
  const smooth = (t: number) => t * t * (3 - 2 * t);
  const octave = (x: number, z: number) => {
    const x0 = Math.floor(x);
    const z0 = Math.floor(z);
    const fx = smooth(x - x0);
    const fz = smooth(z - z0);
    const north = at(x0, z0) * (1 - fx) + at(x0 + 1, z0) * fx;
    const south = at(x0, z0 + 1) * (1 - fx) + at(x0 + 1, z0 + 1) * fx;
    return north * (1 - fz) + south * fz;
  };
  return (x, z) =>
    octave(x / 48, z / 48) * 0.55 +
    octave(x / 19 + 7, z / 19 + 3) * 0.28 +
    octave(x / 7 + 13, z / 7 + 29) * 0.17;
}
