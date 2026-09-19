import { vec3, vec4 } from "gl-matrix";
import { describe, expect, it } from "vitest";
import { Camera } from "../src/camera.ts";
import { pickTile } from "../src/editor/picking.ts";
import { GLYPH_SWAYS, GlyphBatch, type GlyphLook } from "../src/glyph/batch.ts";
import { glyphOfChar, glyphOfExtra } from "../src/glyph/font.ts";
import { glyphPose } from "../src/glyph/pose.ts";
import { glyphCovers, glyphViewOf, pickInPlay } from "../src/play/pick-glyph.ts";
import { TileGrid } from "../src/terrain/grid.ts";
import { ACTOR_MOTIONS, ActorMotions, type MotionRow } from "../src/view/motions.ts";
import { ObjectLayer } from "../src/world/objects.ts";

/** Independent shader point: sway is linear between bottom -1 and top 6. */
function projectedPixel(
  camera: Camera,
  look: GlyphLook,
  ax: number,
  ay: number,
  time: number,
  x: number,
  y: number,
  z: number,
  facing: number,
) {
  const wind = (look.flags ?? 0) & GLYPH_SWAYS ? Math.sin(time * 1.6 + 12.5 * 2.2) : 0;
  const lean = (((wind * 0.35 * 6) / 5) * (ay + 1)) / 7;
  const world = vec3.fromValues(12.5 + x, y, 12.5 + z);
  vec3.scaleAndAdd(world, world, camera.right, ((ax - 1.5) * facing + lean) * 0.25);
  vec3.scaleAndAdd(world, world, camera.up, ay * 0.25);
  const clip = vec4.transformMat4(vec4.create(), [...world, 1], camera.viewProjection);
  return [clip[0] / clip[3], clip[1] / clip[3]] as const;
}

describe("a glyph's own pixels", () => {
  const tree = glyphOfExtra("tree"); // .#. ### ### .#. .#.
  it("are what can be pointed at, with the outline around them", () => {
    expect(glyphCovers(tree, 1, 0)).toBe(true); // the trunk
    expect(glyphCovers(tree, 0, 0)).toBe(true); // beside the trunk: outline
    expect(glyphCovers(tree, -2, 0)).toBe(false);
    expect(glyphCovers(tree, 1, 6)).toBe(false);
    expect(glyphCovers(tree, 0, -1)).toBe(false); // diagonal neighbours are not outline
    expect(glyphCovers(tree, 0, 0, false)).toBe(false);
    expect(glyphCovers(glyphOfChar(" "), 1, 2)).toBe(false);
    expect(glyphCovers(9999, 1, 2)).toBe(false);
  });
});

describe("the animated card, not its resting hitbox", () => {
  const grid = new TileGrid(24, 24);
  const camera = new Camera();
  const goal = vec3.fromValues(12.5, 0, 12.5);
  camera.snapTo(goal);
  camera.update(goal, 0, 1.6);
  const tile = grid.index(12, 12);
  const look: GlyphLook = { glyph: glyphOfExtra("tree"), ink: 1, flags: GLYPH_SWAYS };
  const at = (index: number) => (index === tile ? look : null);

  function point(ax: number, ay: number, time: number, x = 0, y = 0, z = 0, facing = 1) {
    return projectedPixel(camera, look, ax, ay, time, x, y, z, facing);
  }

  it("follows sway at both extremes, and does not accept old ink or an empty corner", () => {
    const view = glyphViewOf(camera, { glyphTilt: 1, glyphPixel: 0.25, outline: false });
    for (const phase of [Math.PI / 2, Math.PI * 1.5]) {
      view.time = (phase + Math.PI * 10 - 12.5 * 2.2) / 1.6;
      const x = phase < Math.PI ? 1.95 : 1.05;
      const p = point(x, 4.5, view.time);
      expect(pickInPlay(grid, view, ...p, at)).toBe(tile);
      const rest = glyphViewOf(camera, view.draw);
      rest.time = (Math.PI * 10 - 12.5 * 2.2) / 1.6;
      expect(pickInPlay(grid, rest, ...p, at)).not.toBe(tile);
      const empty = point(3.5, 0.5, view.time);
      expect(pickInPlay(grid, view, ...empty, at)).toBe(
        pickTile(grid, camera.viewProjection, ...empty),
      );
    }
  });

  it.each(ACTOR_MOTIONS)("follows %s, including spin's narrowed and mirrored ink", (motion) => {
    look.flags = 0;
    const motions = new ActorMotions();
    const row: MotionRow = { motion, easing: "linear", strength: 5, duration: 5 };
    motions.play(() => 7, row, 0, 1, 0);
    const view = glyphViewOf(camera, { glyphTilt: 1, glyphPixel: 0.25, outline: false });
    view.time = 0.19;
    view.motions = motions;
    view.slotAt = () => 7;
    motions.pack(view.time);
    const e = view.time;
    const strength = motions.b[2] ?? 0;
    const wave = Math.sin((e * Math.round(Math.PI * 100_000)) / 100_000);
    const shake = Math.sin(e * 50) * strength * 0.5 * (1 - e);
    const x = {
      lunge: strength * wave,
      hop: 0,
      recoil: -strength * (1 - e),
      shake: camera.right[0] * shake,
      spin: 0,
    }[motion];
    const y = motion === "hop" ? strength * 2 * wave : 0;
    const z = motion === "shake" ? camera.right[2] * shake : 0;
    const facing = motion === "spin" ? Math.cos(e * 6.28318 * Math.floor(strength * 6)) : 1;
    const ink = point(1.5, 4.5, 0, x, y, z, facing);
    expect(pickInPlay(grid, view, ...ink, at)).toBe(tile);
    const empty = point(3.5, 0.5, 0, x, y, z, facing);
    expect(pickInPlay(grid, view, ...empty, at)).toBe(
      pickTile(grid, camera.viewProjection, ...empty),
    );
    look.flags = GLYPH_SWAYS;
  });

  it("expands candidates for simultaneous hops beyond the resting neighbourhood", () => {
    look.flags = 0;
    const motions = new ActorMotions();
    for (let i = 0; i < 4; i++) {
      motions.play(() => 3, { motion: "hop", easing: "linear", strength: 5, duration: 5 }, 0);
    }
    motions.pack(0.5);
    const view = glyphViewOf(camera, { glyphTilt: 1, glyphPixel: 0.25 });
    view.time = 0.5;
    view.motions = motions;
    view.slotAt = () => 3;
    const ink = point(1.5, 4.5, 0, 0, 6.4);
    expect(pickInPlay(grid, view, ...ink, at)).toBe(tile);
    look.flags = GLYPH_SWAYS;
  });

  it("mirrors asymmetric ink during a spin and rejects its resting width when edge-on", () => {
    const motions = new ActorMotions();
    motions.play(() => 7, { motion: "spin", easing: "linear", strength: 1, duration: 5 }, 0);
    const view = glyphViewOf(camera, { glyphTilt: 1, glyphPixel: 0.25, outline: false });
    view.motions = motions;
    view.slotAt = () => 7;
    look.flags = 0;
    look.glyph = glyphOfChar("L");
    view.time = 0.5;
    motions.pack(view.time);
    const mirrored = point(0.5, 3.5, 0, 0, 0, 0, -1);
    expect(pickInPlay(grid, view, ...mirrored, at)).toBe(tile);
    const resting = point(0.5, 3.5, 0);
    expect(pickInPlay(grid, view, ...resting, at)).not.toBe(tile);
    view.time = 0.25;
    motions.pack(view.time);
    expect(pickInPlay(grid, view, ...resting, at)).toBe(
      pickTile(grid, camera.viewProjection, ...resting),
    );
    look.flags = GLYPH_SWAYS;
    look.glyph = glyphOfExtra("tree");
  });

  it("uses the live object slot after packed instances are removed", () => {
    const batch = new GlyphBatch(4);
    const objects = new ObjectLayer(grid, batch);
    objects.set(0, look);
    objects.set(tile, look);
    const motions = new ActorMotions();
    motions.play(
      () => objects.slotAt(tile),
      { motion: "hop", easing: "linear", strength: 5, duration: 5 },
      0,
    );
    objects.set(0, null);
    motions.pack(0.5);
    expect(motions.a[0]).toBe(0);
    const view = glyphViewOf(camera, { glyphTilt: 1, glyphPixel: 0.25 });
    view.time = 0.5;
    view.motions = motions;
    view.slotAt = (index) => objects.slotAt(index);
    const ink = point(1.5, 4.5, 0.5, 0, 1.6);
    expect(pickInPlay(grid, view, ...ink, (index) => objects.at(index))).toBe(tile);
  });

  it("does not pick a nearby glyph through a raised wall", () => {
    const blocked = new TileGrid(24, 24);
    for (let z = 13; z < 24; z++) {
      for (let x = 0; x < 24; x++) blocked.set(x, z, { height: 8 });
    }
    const view = glyphViewOf(camera, { glyphTilt: 1, glyphPixel: 0.25 });
    const ink = point(1.5, 2.5, 0);
    expect(pickInPlay(blocked, view, ...ink, at)).toBe(
      pickTile(blocked, camera.viewProjection, ...ink),
    );
    expect(pickInPlay(blocked, view, ...ink, at)).not.toBe(tile);
  });
});

describe("packed pose lifetime", () => {
  it.each([
    ["linear", 0.3],
    ["in", 0.09],
    ["out", 0.51],
    ["inOut", 0.216],
    ["pulse", Math.sin((0.3 * Math.round(Math.PI * 100_000)) / 100_000)],
  ] as const)("uses the shader's %s easing", (easing, eased) => {
    const motions = new ActorMotions();
    motions.play(() => 4, { motion: "recoil", easing, strength: 5, duration: 5 }, 0, 1, 0);
    motions.pack(0.3);
    const pose = { x: 0, y: 0, z: 0, facing: 1 };
    glyphPose(pose, motions, 4, 0.3, [1, 0, 0]);
    expect(pose.x).toBeCloseTo(-0.8 * (1 - eased), 6);
    expect(pose.y).toBe(0);
    expect(pose.z).toBe(0);
    expect(pose.facing).toBe(1);
  });

  it("is identity before start, after expiry and for another slot", () => {
    const motions = new ActorMotions();
    motions.play(() => 4, { motion: "hop", easing: "linear", strength: 5, duration: 5 }, 2);
    motions.pack(2);
    const pose = { x: 1, y: 1, z: 1, facing: 0 };
    for (const [slot, time] of [
      [4, 1],
      [4, 3],
      [9, 2.5],
    ] as const) {
      glyphPose(pose, motions, slot, time, [1, 0, 0]);
      expect(pose).toEqual({ x: 0, y: 0, z: 0, facing: 1 });
    }
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
