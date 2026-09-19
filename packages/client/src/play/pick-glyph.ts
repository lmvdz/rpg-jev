/**
 * What is under the mouse in play: the glyph whose ink it is over, or else
 * the ground. A tall glyph's crown is drawn over the tiles behind it, so
 * picking by tile alone points past the tree at the grass. Here every glyph
 * standing near the ray's path is tested as the shader draws it: the same
 * card facing the camera, the same size, and the font's own pixels, so what
 * is pointed at is what is seen. The nearest glyph hit wins; the ray stops at
 * the ground it lands on, so a glyph behind a wall is not reached.
 */
import { type mat4, vec3, vec4 } from "gl-matrix";
import { walkRay } from "../editor/picking.ts";
import { GLYPH_SWAYS, type GlyphLook, SCALE_ONE } from "../glyph/batch.ts";
import { GLYPH_H, GLYPH_W, glyphRows } from "../glyph/font.ts";
import { glyphPose, glyphWind, motionReach, type PackedMotions } from "../glyph/pose.ts";
import { DIR_X, DIR_Z, type TileGrid } from "../terrain/grid.ts";
import { cornerHeights, groundHeight } from "../terrain/tessellate.ts";

/** How glyphs are drawn this frame: the camera's axes, and the frame's `glyphTilt` and `glyphPixel`. */
export interface GlyphView {
  viewProjection: mat4;
  right: vec3;
  up: vec3;
  draw: { glyphTilt: number; glyphPixel: number; outline?: boolean };
  time?: number;
  motions?: PackedMotions;
  slotAt?: (tileIndex: number) => number;
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
export function glyphCovers(glyph: number, px: number, py: number, outline = true): boolean {
  const rows = INK_ROWS[glyph];
  if (!rows) return false;
  if (rows[GLYPH_H - 1 - py]?.[px] === "#") return true;
  if (!outline) return false;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (Math.abs(dx) + Math.abs(dy) !== 1) continue;
      if (rows[GLYPH_H - 1 - (py + dy)]?.[px + dx] === "#") return true;
    }
  }
  return false;
}

/** How far around the ray's path a glyph may stand and still be under the mouse: the tallest lean that far. */
const NEAR = 2;

const upright = vec3.create();
const quad = [vec4.create(), vec4.create(), vec4.create(), vec4.create()] as const;
const standing = vec4.create();
const pose = { x: 0, y: 0, z: 0, facing: 1 };
let tested = new Uint32Array(0);
let stamp = 0;
const best = { tile: -1, depth: Number.POSITIVE_INFINITY, terrain: Number.POSITIVE_INFINITY };
const bary = { a: 0, b: 0, c: 0 };
const cornerX = [0, 1, 1, 0] as const;
const cornerZ = [0, 0, 1, 1] as const;
const heights = new Float32Array(4);
const neighbour = new Float32Array(4);

/**
 * The same four vertices as GLYPH_VERTEX. Sway is evaluated at the corners,
 * then interpolated by the rasterizer; it is not max(pixel.y, 0) per fragment.
 * The standing card lends its depth to the facing card, just as on the GPU.
 */
function place(
  view: GlyphView,
  look: GlyphLook,
  x: number,
  y: number,
  z: number,
  slot: number,
): void {
  const pixel = (view.draw.glyphPixel * (look.scale ?? SCALE_ONE)) / SCALE_ONE;
  const { right, viewProjection } = view;
  glyphPose(pose, view.motions, slot, view.time ?? 0, right);
  const wind = (look.flags ?? 0) & GLYPH_SWAYS ? glyphWind(view.time ?? 0, x, z) : 0;
  for (let i = 0; i < 4; i++) {
    const ax = (i % 2) * (GLYPH_W + 2) - 1;
    const ay = Math.floor(i / 2) * (GLYPH_H + 2) - 1;
    const lean = (wind * 0.35 * Math.max(ay, 0)) / GLYPH_H;
    const across = ((ax - GLYPH_W / 2) * pose.facing + lean) * pixel;
    const q = quad[i];
    if (!q) continue;
    vec4.set(
      q,
      x + pose.x + right[0] * across,
      y + pose.y + right[1] * across,
      z + pose.z + right[2] * across,
      1,
    );
    vec4.copy(standing, q);
    standing[1] += ay * pixel;
    q[0] += upright[0] * ay * pixel;
    q[1] += upright[1] * ay * pixel;
    q[2] += upright[2] * ay * pixel;
    vec4.transformMat4(q, q, viewProjection);
    vec4.transformMat4(standing, standing, viewProjection);
    q[2] = (standing[2] / standing[3]) * q[3];
  }
}

/** Screen barycentrics for depth; perspective-correct weights for the font. */
function triangle(a: vec4, b: vec4, c: vec4): number {
  if (a[3] <= 0 || b[3] <= 0 || c[3] <= 0) return Number.POSITIVE_INFINITY;
  const ax = a[0] / a[3],
    ay = a[1] / a[3];
  const bx = b[0] / b[3],
    by = b[1] / b[3];
  const cx = c[0] / c[3],
    cy = c[1] / c[3];
  const det = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
  if (Math.abs(det) < 1e-12) return Number.POSITIVE_INFINITY;
  const wa = ((by - cy) * (mouse.x - cx) + (cx - bx) * (mouse.y - cy)) / det;
  const wb = ((cy - ay) * (mouse.x - cx) + (ax - cx) * (mouse.y - cy)) / det;
  const wc = 1 - wa - wb;
  if (Math.min(wa, wb, wc) < -1e-7) return Number.POSITIVE_INFINITY;
  const depth = (wa * a[2]) / a[3] + (wb * b[2]) / b[3] + (wc * c[2]) / c[3];
  const inverseW = wa / a[3] + wb / b[3] + wc / c[3];
  bary.a = wa / a[3] / inverseW;
  bary.b = wb / b[3] / inverseW;
  bary.c = wc / c[3] / inverseW;
  return depth >= -1 && depth <= 1 ? depth : Number.POSITIVE_INFINITY;
}

function solve(glyph: number, outline: boolean): number {
  for (let i = 0; i < 2; i++) {
    const depth =
      i === 0 ? triangle(quad[0], quad[1], quad[2]) : triangle(quad[2], quad[1], quad[3]);
    if (!Number.isFinite(depth)) continue;
    const ax = -1 + (GLYPH_W + 2) * (i === 0 ? bary.b : bary.b + bary.c);
    const ay = -1 + (GLYPH_H + 2) * (i === 0 ? bary.c : bary.a + bary.c);
    if (glyphCovers(glyph, Math.floor(ax), Math.floor(ay), outline)) return depth;
  }
  return Number.POSITIVE_INFINITY;
}

type GlyphAt = (tileIndex: number) => GlyphLook | null;

/** The pick under way. Kept here and not in a closure, so picking every frame allocates nothing. */
const now: { grid: TileGrid | null; view: GlyphView | null; glyphAt: GlyphAt | null } = {
  grid: null,
  view: null,
  glyphAt: null,
};
const mouse = { x: 0, y: 0 };

function terrainQuad(view: GlyphView): void {
  for (const q of quad) vec4.transformMat4(q, q, view.viewProjection);
  best.terrain = Math.min(
    best.terrain,
    triangle(quad[0], quad[1], quad[2]),
    triangle(quad[0], quad[2], quad[3]),
  );
}

/** Only the tested tile's five quads, using the tessellator's corner/edge rules. */
function terrainOn(grid: TileGrid, view: GlyphView, x: number, z: number): void {
  cornerHeights(grid, x, z, heights);
  for (let i = 0; i < 4; i++) {
    const q = quad[i];
    if (q) vec4.set(q, x + (cornerX[i] ?? 0), heights[i] ?? 0, z + (cornerZ[i] ?? 0), 1);
  }
  terrainQuad(view);
  for (let d = 0; d < 4; d++) {
    cornerHeights(grid, x + (DIR_X[d] ?? 0), z + (DIR_Z[d] ?? 0), neighbour);
    const second = (d + 1) % 4;
    const topA = heights[d] ?? 0,
      topB = heights[second] ?? 0;
    const footA = Math.min(topA, neighbour[(d + 3) % 4] ?? 0);
    const footB = Math.min(topB, neighbour[(d + 2) % 4] ?? 0);
    if (topA <= footA && topB <= footB) continue;
    const ax = x + (cornerX[d] ?? 0),
      az = z + (cornerZ[d] ?? 0);
    const bx = x + (cornerX[second] ?? 0),
      bz = z + (cornerZ[second] ?? 0);
    vec4.set(quad[0], bx, footB, bz, 1);
    vec4.set(quad[1], ax, footA, az, 1);
    vec4.set(quad[2], ax, topA, az, 1);
    vec4.set(quad[3], bx, topB, bz, 1);
    terrainQuad(view);
  }
}

function testOn(x: number, z: number): void {
  const { grid, view, glyphAt } = now;
  if (!(grid && view && glyphAt && grid.contains(x, z))) return;
  const tile = grid.index(x, z);
  if (tested[tile] === stamp) return;
  tested[tile] = stamp;
  terrainOn(grid, view, x, z);
  const look = glyphAt(tile);
  if (!look) return;
  place(
    view,
    look,
    x + 0.5,
    groundHeight(grid, x + 0.5, z + 0.5),
    z + 0.5,
    view.slotAt?.(tile) ?? -1,
  );
  const depth = solve(look.glyph, view.draw.outline ?? true);
  if (depth < best.depth) {
    best.depth = depth;
    best.tile = tile;
  }
}

let reach = NEAR;
function testAround(tileX: number, tileZ: number): void {
  for (let z = tileZ - reach; z <= tileZ + reach; z++) {
    for (let x = tileX - reach; x <= tileX + reach; x++) testOn(x, z);
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
  if (tested.length !== grid.width * grid.depth) tested = new Uint32Array(grid.width * grid.depth);
  stamp = (stamp + 1) >>> 0;
  if (stamp === 0) {
    tested.fill(0);
    stamp = 1;
  }
  reach = NEAR + Math.ceil(motionReach(view.motions) + view.draw.glyphPixel * 0.42);
  best.tile = -1;
  best.depth = Number.POSITIVE_INFINITY;
  best.terrain = Number.POSITIVE_INFINITY;
  now.grid = grid;
  now.view = view;
  now.glyphAt = glyphAt;
  mouse.x = ndcX;
  mouse.y = ndcY;
  const ground = walkRay(grid, view.viewProjection, ndcX, ndcY, testAround);
  return best.tile >= 0 && best.depth <= best.terrain ? best.tile : ground;
}
