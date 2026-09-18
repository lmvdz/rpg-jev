import { type GlyphBatch, INSTANCE_BYTES } from "../glyph/batch.ts";
import { buildGlyphAtlas } from "../glyph/font.ts";
import { buildProgram } from "./program.ts";
import { GLYPH_FRAGMENT, GLYPH_VERTEX } from "./shaders.ts";

/** All glyphs in one instanced draw call. Ink or nothing: no blending, so no sorting. */
export class GlyphPass {
  readonly #gl: WebGL2RenderingContext;
  readonly #program: WebGLProgram;
  readonly #atlas: WebGLTexture | null;
  readonly #vao: WebGLVertexArrayObject | null;
  readonly #instances: WebGLBuffer | null;
  #allocated = 0;

  constructor(gl: WebGL2RenderingContext) {
    this.#gl = gl;
    this.#program = buildProgram(gl, GLYPH_VERTEX, GLYPH_FRAGMENT);
    gl.useProgram(this.#program);
    gl.uniform1i(gl.getUniformLocation(this.#program, "u_atlas"), 1);

    const atlas = buildGlyphAtlas();
    this.#atlas = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.#atlas);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.R8,
      atlas.width,
      atlas.height,
      0,
      gl.RED,
      gl.UNSIGNED_BYTE,
      atlas.pixels,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    this.#vao = gl.createVertexArray();
    gl.bindVertexArray(this.#vao);
    const corners = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, corners);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    this.#instances = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.#instances);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, INSTANCE_BYTES, 0);
    gl.vertexAttribDivisor(1, 1);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 4, gl.UNSIGNED_BYTE, false, INSTANCE_BYTES, 12);
    gl.vertexAttribDivisor(2, 1);
    gl.bindVertexArray(null);
  }

  /** The font's texture, which the effect pass draws its particles from too. */
  get atlas(): WebGLTexture | null {
    return this.#atlas;
  }

  /** Uploads what changed in the batch: all of it when it has grown, otherwise only the changed pages. */
  sync(batch: GlyphBatch): void {
    const gl = this.#gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.#instances);
    if (this.#allocated === batch.bytes.byteLength) {
      this.#syncing = batch;
      batch.forEachDirtyRun(this.#uploadRun);
    } else {
      gl.bufferData(gl.ARRAY_BUFFER, batch.bytes, gl.DYNAMIC_DRAW);
      this.#allocated = batch.bytes.byteLength;
    }
    batch.clean();
  }

  #syncing: GlyphBatch | null = null;
  /** Made once, so a frame's uploads allocate no closure. */
  readonly #uploadRun = (fromSlot: number, toSlot: number): void => {
    const bytes = this.#syncing?.bytes;
    if (!bytes) return;
    const from = fromSlot * INSTANCE_BYTES;
    const length = (toSlot - fromSlot) * INSTANCE_BYTES;
    this.#gl.bufferSubData(this.#gl.ARRAY_BUFFER, from, bytes, from, length);
  };

  draw(count: number): void {
    const gl = this.#gl;
    if (count === 0) return;
    gl.useProgram(this.#program);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.#atlas);
    gl.bindVertexArray(this.#vao);
    // Glyphs face the camera whichever way it turns, so neither side is a back.
    gl.disable(gl.CULL_FACE);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
    gl.enable(gl.CULL_FACE);
    gl.bindVertexArray(null);
  }
}
