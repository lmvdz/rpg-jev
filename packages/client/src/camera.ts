/**
 * The camera (SPEC.md section 19, step R0): perspective with an isometric
 * lean, meaning a narrow field of view seen from far off and high up, so
 * parallel lines stay nearly parallel but height still reads as depth. It
 * follows a point on a critically damped spring.
 *
 * Nothing here allocates after construction (the renderer's per-frame rule).
 */
import { mat4, vec3 } from "gl-matrix";

export interface CameraSettings {
  /** Vertical field of view, radians. */
  fovY: number;
  /** Angle below the horizon the camera looks down at, radians. */
  pitch: number;
  /** Turn about the vertical axis, radians. 0 looks north (towards -z). */
  yaw: number;
  /** Distance from the followed point to the eye. */
  distance: number;
  /** Seconds the follow takes to close most of a gap. */
  followTime: number;
  near: number;
  far: number;
}

export const DEFAULT_CAMERA: CameraSettings = {
  fovY: (28 * Math.PI) / 180,
  pitch: (52 * Math.PI) / 180,
  yaw: 0,
  distance: 46,
  followTime: 0.25,
  near: 1,
  far: 400,
};

/**
 * One step of a critically damped spring from `current` towards `goal`:
 * it never overshoots and does not depend on the frame rate. `velocity` is
 * carried between calls. (The closed form from Game Programming Gems 4.)
 */
export function dampTowards(current: vec3, velocity: vec3, goal: vec3, time: number, dt: number) {
  const omega = 2 / Math.max(time, 1e-4);
  const x = omega * dt;
  const decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  for (let i = 0; i < 3; i++) {
    const gap = (current[i] ?? 0) - (goal[i] ?? 0);
    const push = ((velocity[i] ?? 0) + omega * gap) * dt;
    velocity[i] = ((velocity[i] ?? 0) - omega * push) * decay;
    current[i] = (goal[i] ?? 0) + (gap + push) * decay;
  }
}

export class Camera {
  readonly settings: CameraSettings;
  /** Where the camera is looking now: the followed point, damped. */
  readonly focus = vec3.create();
  readonly eye = vec3.create();
  readonly right = vec3.create();
  readonly up = vec3.create();
  readonly view = mat4.create();
  readonly projection = mat4.create();
  readonly viewProjection = mat4.create();
  readonly #velocity = vec3.create();
  readonly #worldUp = vec3.fromValues(0, 1, 0);

  constructor(settings: CameraSettings = DEFAULT_CAMERA) {
    this.settings = { ...settings };
  }

  /** Puts the camera on a point at once, with no glide. */
  snapTo(goal: vec3): void {
    vec3.copy(this.focus, goal);
    vec3.zero(this.#velocity);
  }

  update(goal: vec3, dt: number, aspect: number): void {
    const s = this.settings;
    dampTowards(this.focus, this.#velocity, goal, s.followTime, dt);
    const flat = Math.cos(s.pitch) * s.distance;
    this.eye[0] = this.focus[0] + Math.sin(s.yaw) * flat;
    this.eye[1] = this.focus[1] + Math.sin(s.pitch) * s.distance;
    this.eye[2] = this.focus[2] + Math.cos(s.yaw) * flat;
    mat4.lookAt(this.view, this.eye, this.focus, this.#worldUp);
    // The clip range follows the zoom. A fixed far plane cuts the map off at the
    // followed point once the camera is that far out, and a near plane that
    // moves out with it keeps the depth buffer's precision where the ground is.
    const near = Math.max(s.near, s.distance * 0.05);
    const far = Math.max(s.far, s.distance * 3 + 100);
    mat4.perspective(this.projection, s.fovY, aspect, near, far);
    mat4.multiply(this.viewProjection, this.projection, this.view);
    // The view matrix's rows are the camera's axes in world space.
    vec3.set(this.right, this.view[0], this.view[4], this.view[8]);
    vec3.set(this.up, this.view[1], this.view[5], this.view[9]);
  }
}
