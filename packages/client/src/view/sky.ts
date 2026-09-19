/**
 * The sky by the hour: where the sun stands, what colour it and the ambient
 * light are, and the colour distance fades to. A table of a few moments,
 * blended, written into the renderer's atmosphere in place.
 *
 * The hour comes from the world's clock. This only says what that hour looks like.
 */
import type { Atmosphere } from "../gl/frame.ts";

interface Moment {
  hour: number;
  sun: readonly [number, number, number];
  ambient: number;
  fog: readonly [number, number, number];
}

const NIGHT_FOG = [0.02, 0.025, 0.05] as const;
const DAY_FOG = [0.051, 0.055, 0.078] as const;

/** Sorted by hour, first at 0 and last at 24 so every hour lies between two. */
const MOMENTS: readonly Moment[] = [
  { hour: 0, sun: [0.1, 0.13, 0.25], ambient: 0.16, fog: NIGHT_FOG },
  { hour: 5, sun: [0.1, 0.13, 0.25], ambient: 0.16, fog: NIGHT_FOG },
  { hour: 7, sun: [1.0, 0.62, 0.38], ambient: 0.3, fog: [0.09, 0.06, 0.07] },
  { hour: 10, sun: [1.0, 0.95, 0.85], ambient: 0.42, fog: DAY_FOG },
  { hour: 16, sun: [1.0, 0.95, 0.85], ambient: 0.42, fog: DAY_FOG },
  { hour: 19, sun: [1.0, 0.5, 0.3], ambient: 0.28, fog: [0.08, 0.045, 0.06] },
  { hour: 21, sun: [0.1, 0.13, 0.25], ambient: 0.16, fog: NIGHT_FOG },
  { hour: 24, sun: [0.1, 0.13, 0.25], ambient: 0.16, fog: NIGHT_FOG },
];

const mix = (a: number, b: number, t: number) => a + (b - a) * t;

export function applySky(hour: number, into: Atmosphere): void {
  const h = ((hour % 24) + 24) % 24;
  let next = 1;
  while (next < MOMENTS.length - 1 && (MOMENTS[next]?.hour ?? 24) <= h) next++;
  const a = MOMENTS[next - 1] as Moment;
  const b = MOMENTS[next] as Moment;
  const t = (h - a.hour) / (b.hour - a.hour);
  for (let i = 0; i < 3; i++) {
    into.sunColor[i] = mix(a.sun[i] ?? 0, b.sun[i] ?? 0, t);
    into.fogColor[i] = mix(a.fog[i] ?? 0, b.fog[i] ?? 0, t);
  }
  into.ambient = mix(a.ambient, b.ambient, t);
  // The sun (by night the moon) crosses from east to west, highest at noon (midnight).
  const arc = ((h >= 6 && h < 18 ? h - 6 : (h + 6) % 12) / 12) * Math.PI;
  into.sunDirection[0] = Math.cos(arc);
  into.sunDirection[1] = Math.max(Math.sin(arc), 0.15);
  into.sunDirection[2] = 0.35;
}
