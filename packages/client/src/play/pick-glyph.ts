/**
 * What is under the mouse in play: the glyph whose ink it is over, or else
 * the ground. A tall glyph's crown is drawn over the tiles behind it, so
 * picking by tile alone points past the tree at the grass. Here every glyph
 * standing near the ray's path is tested as the shader draws it: the same
 * card facing the camera, the same size, and the font's own pixels, so what
 * is pointed at is what is seen. The nearest glyph hit wins; the ray stops at
 * the ground it lands on, so a glyph behind a wall is not reached.
 *
 * Not followed: sway and an actor's motion, which move a glyph by a fraction
 * of a pixel or for a fraction of a second.
 */
import { type mat4, vec3, vec4 } from "gl-matrix";
import { walkRay } from "../editor/picking.ts";
import { type GlyphLook, SCALE_ONE } from "../glyph/batch.ts";
import { GLYPH_H, GLYPH_W, glyphRows } from "../glyph/font.ts";
import type { TileGrid } from "../terrain/grid.ts";
import { groundHeight } from "../terrain/tessellate.ts";

/** How glyphs are drawn this frame: the camera's axes, and the frame's `glyphTilt` and `glyphPixel`. */
export interface GlyphView {
  viewProjection: mat4;
  right: vec3;
  up: vec3;
  draw: { glyphTilt: number; glyphPixel: number };
}

/** The camera rewrites its matrix and axes in place, so this is made once and read every frame. */
export function glyphViewOf(
  camera: Pick<GlyphView, "viewProjection" | "right" | "up">,
  draw: GlyphView["draw"],
): GlyphView {
  return { viewProjection: camera.viewProjection, right: camera.right, up: camera.up, draw };
}

const INK_ROWS = glyphRows();

/** Whether a glyph has ink at a pixel, counted from its bottom left, or beside it: the outline is part of it. */
export function glyphCovers(glyph: number, px: number, py: number): boolean {
  const rows = INK_ROWS[glyph];
  if (!rows) return false;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (rows[GLYPH_H - 1 - (py + dy)]?.[px + dx] === "#") return true;
    }
  }
  return false;
}

/** How far around the ray's path a glyph may stand and still be under the mouse: the tallest lean that far. */
const NEAR = 2;

const upright = vec3.create();
const a = vec4.create();
const b = vec4.create();
const c = vec4.create();
const tested = new Set<number>();
const best = { tile: -1, depth: Number.POSITIVE_INFINITY };

/**
 * Tests one glyph. The shader places pixel (ax, ay) of a glyph at
 * A + ax B + ay C in clip space; the mouse fixes x/w and y/w, which leaves two
 * linear equations in ax and ay.
 */
function place(view: GlyphView, look: GlyphLook, x: number, y: number, z: number): void {
  const pixel = (view.draw.glyphPixel * (look.scale ?? SCALE_ONE)) / SCALE_ONE;
  const { right, viewProjection } = view;
  const half = (GLYPH_W / 2) * pixel;
  vec4.set(a, x - right[0] * half, y - right[1] * half, z - right[2] * half, 1);
  vec4.set(b, right[0] * pixel, right[1] * pixel, right[2] * pixel, 0);
  vec4.set(c, upright[0] * pixel, upright[1] * pixel, upright[2] * pixel, 0);
  vec4.transformMat4(a, a, viewProjection);
  vec4.transformMat4(b, b, viewProjection);
  vec4.transformMat4(c, c, viewProjection);
}

function solve(ndcX: number, ndcY: number, glyph: number): number {
  const m00 = b[0] - ndcX * b[3];
  const m01 = c[0] - ndcX * c[3];
  const m10 = b[1] - ndcY * b[3];
  const m11 = c[1] - ndcY * c[3];
  const det = m00 * m11 - m01 * m10;
  if (Math.abs(det) < 1e-12) return Number.POSITIVE_INFINITY;
  const r0 = ndcX * a[3] - a[0];
  const r1 = ndcY * a[3] - a[1];
  const ax = (r0 * m11 - m01 * r1) / det;
  const ay = (m00 * r1 - r0 * m10) / det;
  const depth = a[3] + ax * b[3] + ay * c[3];
  if (depth <= 0 || !glyphCovers(glyph, Math.floor(ax), Math.floor(ay))) {
    return Number.POSITIVE_INFINITY;
  }
  return depth;
}

type GlyphAt = (tileIndex: number) => GlyphLook | null;

/** The pick under way. Kept here and not in a closure, so picking every frame allocates nothing. */
const now: { grid: TileGrid | null; view: GlyphView | null; glyphAt: GlyphAt | null } = {
  grid: null,
  view: null,
  glyphAt: null,
};
const mouse = { x: 0, y: 0 };

function testOn(x: number, z: number): void {
  const { grid, view, glyphAt } = now;
  if (!(grid && view && glyphAt && grid.contains(x, z))) return;
  const tile = grid.index(x, z);
  if (tested.has(tile)) return;
  tested.add(tile);
  const look = glyphAt(tile);
  if (!look) return;
  place(view, look, x + 0.5, groundHeight(grid, x + 0.5, z + 0.5), z + 0.5);
  const depth = solve(mouse.x, mouse.y, look.glyph);
  if (depth < best.depth) {
    best.depth = depth;
    best.tile = tile;
  }
}

function testAround(tileX: number, tileZ: number): void {
  for (let z = tileZ - NEAR; z <= tileZ + NEAR; z++) {
    for (let x = tileX - NEAR; x <= tileX + NEAR; x++) testOn(x, z);
  }
}

/**
 * The index of the tile whose glyph is under a point of the view, or else of
 * the ground there, or -1. `glyphAt` gives what stands on a tile.
 */
export function pickInPlay(
  grid: TileGrid,
  view: GlyphView,
  ndcX: number,
  ndcY: number,
  glyphAt: GlyphAt,
): number {
  vec3.lerp(upright, vec3.set(upright, 0, 1, 0), view.up, view.draw.glyphTilt);
  vec3.normalize(upright, upright);
  tested.clear();
  best.tile = -1;
  best.depth = Number.POSITIVE_INFINITY;
  now.grid = grid;
  now.view = view;
  now.glyphAt = glyphAt;
  mouse.x = ndcX;
  mouse.y = ndcY;
  const ground = walkRay(grid, view.viewProjection, ndcX, ndcY, testAround);
  return best.tile >= 0 ? best.tile : ground;
}
