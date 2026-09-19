/**
 * CPU counterpart of GLYPH_VERTEX's deterministic pose. Read the packed frame
 * motions, not the live play queue: slot numbers and float precision then agree.
 * Keep the constants/formulas here in step with ACTOR_MOTION in gl/shaders.ts.
 */
import type { vec3 } from "gl-matrix";
import type { ActorMotions } from "../view/motions.ts";

export type PackedMotions = Pick<ActorMotions, "a" | "b" | "count">;
export interface GlyphPose {
  x: number;
  y: number;
  z: number;
  facing: number;
}

// The shader's five-decimal literal, deliberately not the full JS precision.
const PI = Math.round(Math.PI * 100_000) / 100_000;
const easings = [
  (a: number) => a,
  (a: number) => a * a,
  (a: number) => 1 - (1 - a) * (1 - a),
  (a: number) => a * a * (3 - 2 * a),
  (a: number) => Math.sin(a * PI),
] as const;

interface Motion {
  pose: GlyphPose;
  right: vec3;
  age: number;
  eased: number;
  strength: number;
  x: number;
  z: number;
}

const handlers = [
  (m: Motion) => {
    const by = m.strength * Math.sin(m.eased * PI);
    m.pose.x += m.x * by;
    m.pose.z += m.z * by;
  },
  (m: Motion) => {
    m.pose.y += m.strength * 2 * Math.sin(m.eased * PI);
  },
  (m: Motion) => {
    const by = m.strength * (1 - m.eased);
    m.pose.x -= m.x * by;
    m.pose.z -= m.z * by;
  },
  (m: Motion) => {
    const by = Math.sin(m.age * 50) * m.strength * 0.5 * (1 - m.age);
    m.pose.x += m.right[0] * by;
    m.pose.y += m.right[1] * by;
    m.pose.z += m.right[2] * by;
  },
  (m: Motion) => {
    m.pose.facing *= Math.cos(m.eased * 6.28318 * Math.max(1, Math.floor(m.strength * 6)));
  },
];

const scratch: Motion = {
  pose: { x: 0, y: 0, z: 0, facing: 1 },
  right: [0, 0, 0],
  age: 0,
  eased: 0,
  strength: 0,
  x: 0,
  z: 0,
};

/** Writes caller-owned scratch, including the identity when no motion applies. */
export function glyphPose(
  out: GlyphPose,
  motions: PackedMotions | undefined,
  slot: number,
  time: number,
  right: vec3,
): void {
  out.x = out.y = out.z = 0;
  out.facing = 1;
  scratch.pose = out;
  scratch.right = right;
  if (!motions || slot < 0) return;
  for (let i = 0; i < motions.count * 4; i += 4) {
    const age = (Math.fround(time) - (motions.a[i + 2] ?? 0)) / (motions.a[i + 3] ?? 1);
    if (motions.a[i] !== slot || age < 0 || age >= 1) continue;
    scratch.age = age;
    scratch.eased = (easings[motions.b[i + 3] ?? 0] ?? easings[0])(age);
    scratch.strength = motions.b[i + 2] ?? 0;
    scratch.x = motions.b[i] ?? 0;
    scratch.z = motions.b[i + 1] ?? 0;
    handlers[motions.a[i + 1] ?? 0]?.(scratch);
  }
}

/** A conservative bound, including simultaneous motions on the same slot. */
export function motionReach(motions: PackedMotions | undefined): number {
  let reach = 0;
  if (!motions) return reach;
  for (let i = 0; i < motions.count * 4; i += 4) {
    reach += 2 * (motions.b[i + 2] ?? 0);
  }
  return reach;
}

export function glyphWind(time: number, x: number, z: number): number {
  return Math.sin(Math.fround(time) * 1.6 + x * 0.9 + z * 1.3);
}
