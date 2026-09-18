import type { Camera } from "../camera.ts";
import type { GlyphBatch } from "../glyph/batch.ts";
import { paletteToFloats } from "../palette.ts";
import { EmitterList } from "../view/effects.ts";
import type { GroundStates } from "../view/ground.ts";
import { LightList } from "../view/lights.ts";
import { ActorMotions } from "../view/motions.ts";
import { EffectPass } from "./effect-pass.ts";
import { type Atmosphere, DEFAULT_ATMOSPHERE, FrameUniforms } from "./frame.ts";
import { Frustum } from "./frustum.ts";
import { GlyphPass } from "./glyph-pass.ts";
import { TerrainPass } from "./terrain-pass.ts";
import { GpuTimer } from "./timer.ts";

/**
 * Owns the WebGL2 context and everything made from it. A lost context takes
 * all of that with it, so the passes are rebuilt from nothing on restore and
 * `onRestored` tells the owner to send the meshes and glyphs again.
 */
export class Renderer {
  readonly canvas: HTMLCanvasElement;
  readonly gl: WebGL2RenderingContext;
  readonly frustum = new Frustum();
  /** A copy all the way down: the sky rewrites these colours in place every frame. */
  readonly atmosphere: Atmosphere = structuredClone(DEFAULT_ATMOSPHERE);
  /** The lights of burning and glowing things; filled by the owner each frame. */
  readonly lights = new LightList();
  /** The effects playing this frame; filled by the owner each frame, like the lights. */
  readonly emitters = new EmitterList();
  /** The actors' own motions under way. Anything may `play` one; they end by themselves. */
  readonly motions = new ActorMotions();
  onRestored: (() => void) | null = null;
  terrain: TerrainPass;
  glyphs: GlyphPass;
  effects: EffectPass;
  timer: GpuTimer;
  #frame = new FrameUniforms();
  #palette = paletteToFloats();
  #lost = false;
  #ground: GroundStates | null = null;

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2", { antialias: false, alpha: false });
    if (!gl) throw new Error("this browser has no WebGL2");
    this.canvas = canvas;
    this.gl = gl;
    this.terrain = new TerrainPass(gl);
    this.glyphs = new GlyphPass(gl);
    this.effects = new EffectPass(gl);
    this.timer = new GpuTimer(gl);
    this.#prepare();
    canvas.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      this.#lost = true;
    });
    canvas.addEventListener("webglcontextrestored", () => {
      this.terrain = new TerrainPass(gl);
      if (this.#ground) this.terrain.setGround(this.#ground);
      this.glyphs = new GlyphPass(gl);
      this.effects = new EffectPass(gl);
      this.timer = new GpuTimer(gl);
      this.#frame = new FrameUniforms();
      this.#prepare();
      this.#lost = false;
      this.onRestored?.();
    });
  }

  #prepare(): void {
    const gl = this.gl;
    this.#frame.init(gl);
    this.#frame.setPalette(this.#palette);
    this.#frame.setAtmosphere(this.atmosphere);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
  }

  /** The states of the ground to draw. Kept, so a restored context gets them again. */
  setGround(ground: GroundStates): void {
    this.#ground = ground;
    this.terrain.setGround(ground);
  }

  /** One upload recolours the world. */
  setPalette(hex: readonly string[]): void {
    this.#palette = paletteToFloats(hex);
    this.#frame.setPalette(this.#palette);
  }

  setCursor(rect: readonly [number, number, number, number] | null): void {
    this.#frame.setCursor(rect);
  }

  /** Call after changing `atmosphere`. */
  applyAtmosphere(): void {
    this.#frame.setAtmosphere(this.atmosphere);
  }

  /** Matches the drawing buffer to the canvas's size on screen. Returns the aspect ratio. */
  resize(): number {
    const { canvas } = this;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(canvas.clientWidth * ratio));
    const height = Math.max(1, Math.round(canvas.clientHeight * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    return width / height;
  }

  draw(camera: Camera, batch: GlyphBatch, time: number): void {
    if (this.#lost) return;
    const gl = this.gl;
    const fog = this.atmosphere.fogColor;
    this.timer.begin();
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(fog[0], fog[1], fog[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    this.motions.pack(time);
    this.#frame.setMotions(this.motions);
    this.#frame.setLights(this.lights);
    this.#frame.upload(gl, camera, time);
    this.frustum.setFrom(camera.viewProjection);
    this.terrain.draw(this.frustum, camera.focus[0], camera.focus[2], this.atmosphere.fogEnd);
    this.glyphs.sync(batch);
    this.glyphs.draw(batch.count);
    this.effects.draw(this.emitters, this.glyphs.atlas);
    this.timer.end();
  }

  /**
   * Milliseconds a frame really costs, CPU and GPU together: draws `frames` of
   * them back to back, waits for the GPU to finish the lot, and divides. Unlike
   * the timer query it does not depend on the display's frame cap, on the clock
   * speed an idle GPU has dropped to, or on what else the GPU is doing between
   * our commands, so it is the number to compare between machines.
   */
  measure(camera: Camera, batch: GlyphBatch, time: number, frames = 300): number {
    const gl = this.gl;
    const pixel = new Uint8Array(4);
    // A short run first, so a GPU that was idling is back at full speed.
    for (let i = 0; i < 60; i++) this.draw(camera, batch, time);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    const began = performance.now();
    for (let i = 0; i < frames; i++) this.draw(camera, batch, time);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    return (performance.now() - began) / frames;
  }
}
