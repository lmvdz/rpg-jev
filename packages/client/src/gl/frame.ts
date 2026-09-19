/**
 * Everything both passes need each frame, in one uniform block: one upload a
 * frame, and one upload to recolour the world (the palette is in here).
 *
 * The layout below is std140 and must match `FRAME_BLOCK` in `shaders.ts`.
 * Every member is a mat4 or a vec4, so there is no padding to get wrong.
 */
import type { Camera } from "../camera.ts";
import { PALETTE_SIZE } from "../palette.ts";
import { type LightList, MAX_LIGHTS } from "../view/lights.ts";
import { type ActorMotions, MAX_MOTIONS } from "../view/motions.ts";

const OFFSET = {
  viewProjection: 0,
  cameraRight: 16, // w: time, seconds
  cameraUp: 20, // w: how far glyphs tilt to face the camera, 0 to 1
  focus: 24,
  sunDirection: 28, // w: ambient light
  sunColor: 32,
  lightPosition: 36, // w: radius
  lightColor: 40,
  fogColor: 44,
  fog: 48, // x: start, y: end, z: world units per glyph pixel, w: outline on
  cursor: 52, // the lit rectangle of tiles: x0, z0, x1, z1; empty when x1 <= x0
  palette: 56,
  lightPositions: 56 + PALETTE_SIZE * 4, // per light: x, y, z, radius
  lightColours: 56 + PALETTE_SIZE * 4 + MAX_LIGHTS * 4, // per light: r, g, b, flicker
  counts: 56 + PALETTE_SIZE * 4 + MAX_LIGHTS * 8, // x: lights in use, y: actor motions under way
  motionsA: 60 + PALETTE_SIZE * 4 + MAX_LIGHTS * 8, // per motion: slot, motion, start, duration
  motionsB: 60 + PALETTE_SIZE * 4 + MAX_LIGHTS * 8 + MAX_MOTIONS * 4, // direction x and z, strength, easing
} as const;

const FLOATS = OFFSET.motionsB + MAX_MOTIONS * 4;
export const FRAME_BINDING = 0;

export interface Atmosphere {
  /** Points from the ground towards the sun. */
  sunDirection: [number, number, number];
  sunColor: [number, number, number];
  ambient: number;
  lightColor: [number, number, number];
  lightRadius: number;
  /** How high above the followed point the hero's light hangs. */
  lightHeight: number;
  fogColor: [number, number, number];
  fogStart: number;
  fogEnd: number;
  glyphPixel: number;
  glyphTilt: number;
  outline: boolean;
}

export const DEFAULT_ATMOSPHERE: Atmosphere = {
  sunDirection: [0.45, 0.8, 0.4],
  sunColor: [1.0, 0.95, 0.85],
  ambient: 0.42,
  lightColor: [1.0, 0.72, 0.4],
  lightRadius: 9,
  lightHeight: 1.5,
  fogColor: [0.051, 0.055, 0.078],
  fogStart: 30,
  fogEnd: 70,
  glyphPixel: 0.25,
  glyphTilt: 1,
  outline: true,
};

export class FrameUniforms {
  readonly #data = new Float32Array(FLOATS);
  #buffer: WebGLBuffer | null = null;
  #lightHeight = 0;

  init(gl: WebGL2RenderingContext): void {
    this.#buffer = gl.createBuffer();
    gl.bindBuffer(gl.UNIFORM_BUFFER, this.#buffer);
    gl.bufferData(gl.UNIFORM_BUFFER, this.#data.byteLength, gl.DYNAMIC_DRAW);
    gl.bindBufferBase(gl.UNIFORM_BUFFER, FRAME_BINDING, this.#buffer);
  }

  /** The lights of things in the world, beside the hero's own. */
  setLights(lights: LightList): void {
    this.#data.set(lights.positions, OFFSET.lightPositions);
    this.#data.set(lights.colours, OFFSET.lightColours);
    this.#data[OFFSET.counts] = lights.count;
  }

  /** The actors' own motions under way, which the glyph shader plays. */
  setMotions(motions: ActorMotions): void {
    this.#data.set(motions.a, OFFSET.motionsA);
    this.#data.set(motions.b, OFFSET.motionsB);
    this.#data[OFFSET.counts + 1] = motions.count;
  }

  /** The tiles the editor lights up, as [x0, z0, x1, z1], or null for none. */
  setCursor(rect: readonly [number, number, number, number] | null): void {
    this.#data.set(rect ?? [0, 0, 0, 0], OFFSET.cursor);
  }

  setPalette(colours: Float32Array): void {
    for (let i = 0; i < PALETTE_SIZE; i++) {
      this.#data.set(colours.subarray(i * 3, i * 3 + 3), OFFSET.palette + i * 4);
    }
  }

  setAtmosphere(a: Atmosphere): void {
    const d = this.#data;
    const length = Math.hypot(...a.sunDirection);
    for (let i = 0; i < 3; i++) d[OFFSET.sunDirection + i] = (a.sunDirection[i] ?? 0) / length;
    d[OFFSET.sunDirection + 3] = a.ambient;
    d.set(a.sunColor, OFFSET.sunColor);
    d.set(a.lightColor, OFFSET.lightColor);
    d[OFFSET.lightPosition + 3] = a.lightRadius;
    d.set(a.fogColor, OFFSET.fogColor);
    d[OFFSET.fog] = a.fogStart;
    d[OFFSET.fog + 1] = a.fogEnd;
    d[OFFSET.fog + 2] = a.glyphPixel;
    d[OFFSET.fog + 3] = a.outline ? 1 : 0;
    d[OFFSET.cameraUp + 3] = a.glyphTilt;
    this.#lightHeight = a.lightHeight;
  }

  /** Writes the camera and the clock, then uploads the block. No allocation. */
  upload(gl: WebGL2RenderingContext, camera: Camera, time: number): void {
    const d = this.#data;
    d.set(camera.viewProjection, OFFSET.viewProjection);
    d[OFFSET.cameraRight] = camera.right[0];
    d[OFFSET.cameraRight + 1] = camera.right[1];
    d[OFFSET.cameraRight + 2] = camera.right[2];
    d[OFFSET.cameraRight + 3] = time;
    d[OFFSET.cameraUp] = camera.up[0];
    d[OFFSET.cameraUp + 1] = camera.up[1];
    d[OFFSET.cameraUp + 2] = camera.up[2];
    d[OFFSET.focus] = camera.focus[0];
    d[OFFSET.focus + 1] = camera.focus[1];
    d[OFFSET.focus + 2] = camera.focus[2];
    d[OFFSET.lightPosition] = camera.focus[0];
    d[OFFSET.lightPosition + 1] = camera.focus[1] + this.#lightHeight;
    d[OFFSET.lightPosition + 2] = camera.focus[2];
    gl.bindBuffer(gl.UNIFORM_BUFFER, this.#buffer);
    gl.bufferSubData(gl.UNIFORM_BUFFER, 0, d);
  }
}
