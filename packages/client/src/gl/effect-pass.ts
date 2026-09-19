import {
  EMITTER_FLOATS,
  type EmitterList,
  MAX_EMITTERS,
  PARTICLES_PER_EMITTER,
} from "../view/effects.ts";
import { buildProgram } from "./program.ts";
import { EFFECT_FRAGMENT, EFFECT_VERTEX } from "./shaders.ts";

const TEXELS_PER_EMITTER = EMITTER_FLOATS / 4;

/**
 * Every particle of every effect in one instanced draw call. The emitters go
 * up as a small float texture, one row each; the particles themselves are
 * never stored anywhere. It borrows the glyph pass's atlas, bound at unit 1.
 */
export class EffectPass {
  readonly #gl: WebGL2RenderingContext;
  readonly #program: WebGLProgram;
  readonly #emitters: WebGLTexture | null;
  readonly #vao: WebGLVertexArrayObject | null;

  constructor(gl: WebGL2RenderingContext) {
    this.#gl = gl;
    this.#program = buildProgram(gl, EFFECT_VERTEX, EFFECT_FRAGMENT);
    gl.useProgram(this.#program);
    gl.uniform1i(gl.getUniformLocation(this.#program, "u_atlas"), 1);
    gl.uniform1i(gl.getUniformLocation(this.#program, "u_emitters"), 2);

    this.#emitters = gl.createTexture();
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.#emitters);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, TEXELS_PER_EMITTER, MAX_EMITTERS);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.activeTexture(gl.TEXTURE0);

    this.#vao = gl.createVertexArray();
    gl.bindVertexArray(this.#vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
  }

  draw(emitters: EmitterList, atlas: WebGLTexture | null): void {
    const gl = this.#gl;
    if (emitters.count === 0) return;
    gl.useProgram(this.#program);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.#emitters);
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      0,
      0,
      TEXELS_PER_EMITTER,
      emitters.count,
      gl.RGBA,
      gl.FLOAT,
      emitters.data,
    );
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, atlas);
    gl.bindVertexArray(this.#vao);
    gl.disable(gl.CULL_FACE);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, emitters.count * PARTICLES_PER_EMITTER);
    gl.enable(gl.CULL_FACE);
    gl.bindVertexArray(null);
    gl.activeTexture(gl.TEXTURE0);
  }
}
