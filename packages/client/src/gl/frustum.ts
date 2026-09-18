/**
 * Chunk culling: the six planes of a view-projection matrix, and a test of
 * an axis-aligned box against them. Pure, and allocates nothing per call.
 */
import type { mat4 } from "gl-matrix";

export class Frustum {
  /** Six planes as (a, b, c, d): a point is inside a plane when ax + by + cz + d >= 0. */
  readonly #planes = new Float32Array(24);

  setFrom(m: mat4): void {
    const p = this.#planes;
    // Rows of the matrix: row i is (m[i], m[4 + i], m[8 + i], m[12 + i]).
    for (let axis = 0; axis < 3; axis++) {
      for (let c = 0; c < 4; c++) {
        const w = m[c * 4 + 3] ?? 0;
        const a = m[c * 4 + axis] ?? 0;
        p[axis * 8 + c] = w + a;
        p[axis * 8 + 4 + c] = w - a;
      }
    }
  }

  /** False only when the box is wholly outside one plane, so never a false cull. */
  intersectsBox(
    minX: number,
    minY: number,
    minZ: number,
    maxX: number,
    maxY: number,
    maxZ: number,
  ): boolean {
    const p = this.#planes;
    for (let i = 0; i < 24; i += 4) {
      const a = p[i] ?? 0;
      const b = p[i + 1] ?? 0;
      const c = p[i + 2] ?? 0;
      // The box corner furthest along the plane's normal.
      const x = a >= 0 ? maxX : minX;
      const y = b >= 0 ? maxY : minY;
      const z = c >= 0 ? maxZ : minZ;
      if (a * x + b * y + c * z + (p[i + 3] ?? 0) < 0) return false;
    }
    return true;
  }
}
