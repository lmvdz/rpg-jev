import { vec3, vec4 } from "gl-matrix";
import { describe, expect, it } from "vitest";
import { Camera } from "../src/camera.ts";
import { pickTile } from "../src/editor/picking.ts";
import type { GlyphLook } from "../src/glyph/batch.ts";
import { glyphOfChar, glyphOfExtra } from "../src/glyph/font.ts";
import { glyphCovers, glyphViewOf, pickInPlay } from "../src/play/pick-glyph.ts";
import { TileGrid } from "../src/terrain/grid.ts";

describe("a glyph's own pixels", () => {
  const tree = glyphOfExtra("tree"); // .#. ### ### .#. .#.
  it("are what can be pointed at, with the outline around them", () => {
    expect(glyphCovers(tree, 1, 0)).toBe(true); // the trunk
    expect(glyphCovers(tree, 0, 0)).toBe(true); // beside the trunk: outline
    expect(glyphCovers(tree, -2, 0)).toBe(false);
    expect(glyphCovers(tree, 1, 6)).toBe(false);
    expect(glyphCovers(glyphOfChar(" "), 1, 2)).toBe(false);
    expect(glyphCovers(9999, 1, 2)).toBe(false);
  });
});

describe("picking in play", () => {
  const grid = new TileGrid(16, 16);
  const camera = new Camera();
  const goal = vec3.fromValues(8.5, 0, 8.5);
  camera.snapTo(goal);
  camera.update(goal, 0, 1.6);
  const view = glyphViewOf(camera, { glyphTilt: 1, glyphPixel: 0.25 });
  const tall: GlyphLook = { glyph: glyphOfExtra("tree"), ink: 1, scale: 28 };
  const treeTile = grid.index(8, 8);
  const glyphAt = (tile: number) => (tile === treeTile ? tall : null);

  /** Where pixel (ax, ay) of the tree is on screen, as the shader places it. */
  function onScreen(ax: number, ay: number): [number, number] {
    const pixel = (0.25 * 28) / 16;
    const at = vec3.fromValues(8.5, 0, 8.5);
    vec3.scaleAndAdd(at, at, camera.right, (ax - 1.5) * pixel);
    vec3.scaleAndAdd(at, at, camera.up, ay * pixel);
    const clip = vec4.transformMat4(vec4.create(), [at[0], at[1], at[2], 1], camera.viewProjection);
    return [clip[0] / clip[3], clip[1] / clip[3]];
  }

  it("finds the tree by its crown, where picking by tile finds the ground behind it", () => {
    const [x, y] = onScreen(1.5, 4.5);
    expect(pickTile(grid, camera.viewProjection, x, y)).not.toBe(treeTile);
    expect(pickInPlay(grid, view, x, y, glyphAt)).toBe(treeTile);
    const [tx, ty] = onScreen(1.5, 0.5);
    expect(pickInPlay(grid, view, tx, ty, glyphAt)).toBe(treeTile);
  });

  it("finds the ground where the glyph has no ink, even inside its card", () => {
    // Bottom corner of the card: the tree's trunk is one pixel wide, and this is two away.
    const [x, y] = onScreen(3.7, 0.5);
    const picked = pickInPlay(grid, view, x, y, glyphAt);
    expect(picked).toBe(pickTile(grid, camera.viewProjection, x, y));
    expect(picked).not.toBe(treeTile);
  });

  it("is picking by tile when nothing stands anywhere", () => {
    for (const [x, y] of [
      [0, 0],
      [0.3, -0.4],
      [-0.8, 0.7],
      [5, 5],
    ] as const) {
      expect(pickInPlay(grid, view, x, y, () => null)).toBe(
        pickTile(grid, camera.viewProjection, x, y),
      );
    }
  });
});
