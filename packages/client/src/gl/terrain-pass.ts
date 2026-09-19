import { TEXTURE_COUNT } from "../terrain/kinds.ts";
import type { ChunkMesh } from "../terrain/tessellate.ts";
import { VERTEX_BYTES } from "../terrain/tessellate.ts";
import { buildTerrainTextures, TEXTURE_SIZE } from "../terrain/textures.ts";
import { GROUND_CHANNELS, GroundStates } from "../view/ground.ts";
import type { Frustum } from "./frustum.ts";
import { buildProgram } from "./program.ts";
import { TERRAIN_FRAGMENT, TERRAIN_VERTEX } from "./shaders.ts";

interface Chunk {
  vao: WebGLVertexArrayObject | null;
  vertices: WebGLBuffer | null;
  indices: WebGLBuffer | null;
  indexCount: number;
  originX: number;
  originZ: number;
  size: number;
  minY: number;
  maxY: number;
}

/** The texture unit of the ground's states: 0 is the terrain textures, 1 the atlas, 2 the emitters. */
const GROUND_UNIT = 3;
/** A world with no states of the ground: one dry texel, which the shader's clamp spreads everywhere. */
const NO_GROUND = new GroundStates(1, 1);

export interface TerrainStats {
  chunksDrawn: number;
  triangles: number;
}

/** Static chunk meshes, one draw call each, culled against the view. */
export class TerrainPass {
  readonly stats: TerrainStats = { chunksDrawn: 0, triangles: 0 };
  readonly #gl: WebGL2RenderingContext;
  readonly #program: WebGLProgram;
  readonly #origin: WebGLUniformLocation | null;
  readonly #textures: WebGLTexture | null;
  readonly #chunks: (Chunk | undefined)[] = [];
  #ground: GroundStates = NO_GROUND;
  #groundTexture: WebGLTexture | null = null;

  constructor(gl: WebGL2RenderingContext) {
    this.#gl = gl;
    this.#program = buildProgram(gl, TERRAIN_VERTEX, TERRAIN_FRAGMENT);
    this.#origin = gl.getUniformLocation(this.#program, "u_origin");
    gl.useProgram(this.#program);
    gl.uniform1i(gl.getUniformLocation(this.#program, "u_textures"), 0);
    gl.uniform1i(gl.getUniformLocation(this.#program, "u_ground"), GROUND_UNIT);
    this.setGround(NO_GROUND);

    this.#textures = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.#textures);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage3D(
      gl.TEXTURE_2D_ARRAY,
      0,
      gl.R8,
      TEXTURE_SIZE,
      TEXTURE_SIZE,
      TEXTURE_COUNT,
      0,
      gl.RED,
      gl.UNSIGNED_BYTE,
      buildTerrainTextures(),
    );
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.REPEAT);
  }

  /**
   * The states of the ground, one texel a tile (`view/ground.ts`). The pass
   * keeps the object and uploads the rows that changed before it draws, so
   * whoever owns the states only ever sets them.
   */
  setGround(ground: GroundStates): void {
    const gl = this.#gl;
    gl.deleteTexture(this.#groundTexture);
    this.#ground = ground;
    this.#groundTexture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + GROUND_UNIT);
    gl.bindTexture(gl.TEXTURE_2D, this.#groundTexture);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8UI, ground.width, ground.depth);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.activeTexture(gl.TEXTURE0);
    ground.markAllDirty();
  }

  #syncGround(): void {
    const gl = this.#gl;
    const ground = this.#ground;
    gl.activeTexture(gl.TEXTURE0 + GROUND_UNIT);
    gl.bindTexture(gl.TEXTURE_2D, this.#groundTexture);
    if (ground.dirtyTo >= ground.dirtyFrom) {
      const rows = ground.dirtyTo - ground.dirtyFrom + 1;
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texSubImage2D(
        gl.TEXTURE_2D,
        0,
        0,
        ground.dirtyFrom,
        ground.width,
        rows,
        gl.RGBA_INTEGER,
        gl.UNSIGNED_BYTE,
        ground.data,
        ground.dirtyFrom * ground.width * GROUND_CHANNELS,
      );
      ground.clean();
    }
    gl.activeTexture(gl.TEXTURE0);
  }

  /** Replaces a chunk's mesh. `key` is any stable number per chunk. */
  setChunk(key: number, mesh: ChunkMesh, originX: number, originZ: number, size: number): void {
    const gl = this.#gl;
    let chunk = this.#chunks[key];
    if (!chunk) {
      chunk = {
        vao: gl.createVertexArray(),
        vertices: gl.createBuffer(),
        indices: gl.createBuffer(),
        indexCount: 0,
        originX,
        originZ,
        size,
        minY: 0,
        maxY: 0,
      };
      this.#chunks[key] = chunk;
      this.#describe(chunk);
    }
    gl.bindVertexArray(chunk.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, chunk.vertices);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.vertices, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, chunk.indices);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    chunk.indexCount = mesh.indices.length;
    chunk.minY = mesh.minY;
    chunk.maxY = mesh.maxY;
  }

  #describe(chunk: Chunk): void {
    const gl = this.#gl;
    gl.bindVertexArray(chunk.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, chunk.vertices);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, VERTEX_BYTES, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.BYTE, true, VERTEX_BYTES, 12);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 1, gl.UNSIGNED_BYTE, false, VERTEX_BYTES, 15);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 3, gl.UNSIGNED_BYTE, false, VERTEX_BYTES, 16);
    gl.bindVertexArray(null);
  }

  /** Chunks outside the view, or wholly past `fogEnd` from the focus (so solid fog), are skipped. */
  draw(frustum: Frustum, focusX: number, focusZ: number, fogEnd: number): void {
    const gl = this.#gl;
    gl.useProgram(this.#program);
    this.#syncGround();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.#textures);
    let drawn = 0;
    let triangles = 0;
    for (let i = 0; i < this.#chunks.length; i++) {
      const c = this.#chunks[i];
      if (!c || c.indexCount === 0) continue;
      const inView = frustum.intersectsBox(
        c.originX,
        c.minY,
        c.originZ,
        c.originX + c.size,
        c.maxY,
        c.originZ + c.size,
      );
      if (!inView) continue;
      const awayX = Math.max(c.originX - focusX, 0, focusX - c.originX - c.size);
      const awayZ = Math.max(c.originZ - focusZ, 0, focusZ - c.originZ - c.size);
      if (awayX * awayX + awayZ * awayZ > fogEnd * fogEnd) continue;
      gl.uniform3f(this.#origin, c.originX, 0, c.originZ);
      gl.bindVertexArray(c.vao);
      gl.drawElements(gl.TRIANGLES, c.indexCount, gl.UNSIGNED_SHORT, 0);
      drawn++;
      triangles += c.indexCount / 3;
    }
    gl.bindVertexArray(null);
    this.stats.chunksDrawn = drawn;
    this.stats.triangles = triangles;
  }
}
