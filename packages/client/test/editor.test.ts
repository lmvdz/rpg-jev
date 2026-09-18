import { vec3 } from "gl-matrix";
import { describe, expect, it } from "vitest";
import { Camera } from "../src/camera.ts";
import { tileAt } from "../src/editor/edits.ts";
import { pickTile } from "../src/editor/picking.ts";
import { Rover } from "../src/editor/rover.ts";
import { EditorSession } from "../src/editor/session.ts";
import { brushTiles, floodTiles, rectTiles, TOOLS, type Tool } from "../src/editor/tools.ts";
import { GlyphBatch, INSTANCE_BYTES } from "../src/glyph/batch.ts";
import { INK } from "../src/palette.ts";
import { LEVEL, NO_INK, SHAPE, TileGrid } from "../src/terrain/grid.ts";
import { kindIndex } from "../src/terrain/kinds.ts";
import { decodeRuns, decodeWorld, encodeRuns, encodeWorld } from "../src/world/format.ts";
import { ObjectLayer } from "../src/world/objects.ts";
import { demoContent } from "../src/world/storage.ts";

function tool(name: string): Tool {
  const found = TOOLS.find((candidate) => candidate.name === name);
  if (!found) throw new Error(`no tool called ${name}`);
  return found;
}

function session(size = 8) {
  const grid = new TileGrid(size, size);
  const batch = new GlyphBatch(4);
  const made = new EditorSession({ grid, objects: new ObjectLayer(grid, batch) });
  const changed: number[][] = [];
  made.onChanged = (tiles) => changed.push([...tiles]);
  return { grid, batch, session: made, changed };
}

/** A camera looking at a tile's middle, and the pick through the middle of the screen. */
function pickAtCentre(grid: TileGrid, x: number, z: number, yaw = 0): number {
  const camera = new Camera();
  camera.settings.yaw = yaw;
  const goal = vec3.fromValues(x + 0.5, grid.heightAt(x, z) * LEVEL, z + 0.5);
  camera.snapTo(goal);
  camera.update(goal, 0.016, 16 / 9);
  return pickTile(grid, camera.viewProjection, 0, 0);
}

describe("picking", () => {
  it("finds the tile in the middle of the view, from any side", () => {
    const grid = new TileGrid(32, 32);
    for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      expect(pickAtCentre(grid, 12, 20, yaw)).toBe(grid.index(12, 20));
    }
  });

  it("gives a wall to the tile that stands behind it", () => {
    const grid = new TileGrid(32, 32);
    // A tower just south of the aim point blocks the ray on its way down.
    grid.set(10, 12, { height: 30 });
    expect(pickAtCentre(grid, 10, 10)).toBe(grid.index(10, 12));
  });

  it("looks into a hole and sees its floor", () => {
    const grid = new TileGrid(32, 32);
    grid.set(10, 10, { shape: SHAPE.hole });
    const picked = pickAtCentre(grid, 10, 10);
    // Aimed at where the ground would be, the ray carries on north into the pit's far wall.
    expect([grid.index(10, 10), grid.index(10, 9), grid.index(10, 8)]).toContain(picked);
  });

  it("finds nothing off the map", () => {
    const grid = new TileGrid(8, 8);
    const camera = new Camera();
    const goal = vec3.fromValues(500, 0, 500);
    camera.snapTo(goal);
    camera.update(goal, 0.016, 1);
    expect(pickTile(grid, camera.viewProjection, 0, 0)).toBe(-1);
  });
});

describe("where a tool lands", () => {
  const grid = new TileGrid(8, 8);

  it("brushes a square, clipped at the map's edge", () => {
    expect(brushTiles(grid, grid.index(3, 3), 1)).toEqual([grid.index(3, 3)]);
    expect(brushTiles(grid, grid.index(3, 3), 3)).toHaveLength(9);
    expect(brushTiles(grid, grid.index(0, 0), 3)).toHaveLength(4);
  });

  it("drags a rectangle either way round", () => {
    const a = grid.index(1, 2);
    const b = grid.index(4, 3);
    expect(rectTiles(grid, a, b)).toHaveLength(8);
    expect(rectTiles(grid, b, a)).toEqual(rectTiles(grid, a, b));
  });

  it("floods a patch and stops at another kind or a colour already laid", () => {
    const map = new TileGrid(6, 6);
    for (let z = 0; z < 6; z++) map.set(3, z, { kind: kindIndex("water") });
    expect(floodTiles(map, map.index(0, 0))).toHaveLength(18);
    expect(floodTiles(map, map.index(5, 5))).toHaveLength(12);
    for (let x = 0; x < 3; x++) map.set(x, 2, { ink: INK.ember });
    expect(floodTiles(map, map.index(0, 0))).toHaveLength(6);
    expect(floodTiles(map, map.index(1, 2))).toHaveLength(3);
  });
});

describe("an editing session", () => {
  it("raises each tile once a stroke, however often the brush crosses it", () => {
    const { grid, session: s } = session();
    s.brush.size = 3;
    s.begin(grid.index(3, 3), false, false);
    s.moveTo(grid.index(4, 3));
    s.moveTo(grid.index(3, 3));
    s.end();
    expect(grid.heightAt(3, 3)).toBe(1);
    expect(grid.heightAt(5, 3)).toBe(1);
    expect(grid.heightAt(6, 3)).toBe(0);
  });

  it("leaves no gaps when the mouse jumps", () => {
    const { grid, session: s } = session();
    s.begin(grid.index(0, 0), false, false);
    s.moveTo(grid.index(6, 3));
    s.end();
    const raised = [...grid.heights].filter((h) => h === 1).length;
    expect(raised).toBe(7);
  });

  it("does the opposite with the right button", () => {
    const { grid, session: s } = session();
    s.begin(grid.index(2, 2), true, false);
    s.end();
    expect(grid.heightAt(2, 2)).toBe(-1);
    s.tool = tool("kind");
    grid.set(5, 5, { kind: kindIndex("sand") });
    s.begin(grid.index(5, 5), true, false);
    s.end();
    expect(s.brush.kind).toBe(kindIndex("sand"));
  });

  it("applies a rectangle when the button comes up, as one step", () => {
    const { grid, session: s } = session();
    s.tool = tool("kind");
    s.brush.kind = kindIndex("rock");
    s.begin(grid.index(1, 1), false, true);
    s.moveTo(grid.index(3, 2));
    expect(grid.kindAt(2, 2)).toBe(0);
    expect(s.cursor()).toEqual([1, 1, 4, 3]);
    s.end();
    expect(grid.kindAt(2, 2)).toBe(kindIndex("rock"));
    s.undo();
    expect(grid.kindAt(2, 2)).toBe(0);
    expect(grid.kindAt(1, 1)).toBe(0);
  });

  it("levels to the height the stroke began on", () => {
    const { grid, session: s } = session();
    grid.set(1, 1, { height: 5 });
    s.tool = tool("level");
    s.begin(grid.index(1, 1), false, false);
    s.moveTo(grid.index(4, 1));
    s.end();
    expect([1, 2, 3, 4].map((x) => grid.heightAt(x, 1))).toEqual([5, 5, 5, 5]);
  });

  it("floods with one click and gives the colour back with the other button", () => {
    const { grid, session: s } = session(4);
    s.tool = tool("flood");
    s.brush.ink = INK.violet;
    s.begin(grid.index(0, 0), false, false);
    expect(s.busy).toBe(false);
    expect([...grid.inks].every((ink) => ink === INK.violet)).toBe(true);
    s.begin(grid.index(0, 0), true, false);
    expect([...grid.inks].every((ink) => ink === NO_INK)).toBe(true);
  });

  it("undoes and redoes whole strokes, and forgets the redo after a new one", () => {
    const { grid, session: s } = session();
    s.begin(grid.index(1, 1), false, false);
    s.end();
    s.begin(grid.index(1, 1), false, false);
    s.end();
    expect(grid.heightAt(1, 1)).toBe(2);
    s.undo();
    expect(grid.heightAt(1, 1)).toBe(1);
    s.redo();
    expect(grid.heightAt(1, 1)).toBe(2);
    s.undo();
    s.begin(grid.index(2, 2), false, false);
    s.end();
    s.redo();
    expect(grid.heightAt(1, 1)).toBe(1);
  });

  it("reports the changed tiles and their neighbours for re-meshing", () => {
    const { grid, session: s, changed } = session();
    s.begin(grid.index(3, 3), false, false);
    s.end();
    expect(changed[0]?.sort((a, b) => a - b)).toEqual(
      [
        grid.index(3, 2),
        grid.index(2, 3),
        grid.index(3, 3),
        grid.index(4, 3),
        grid.index(3, 4),
      ].sort((a, b) => a - b),
    );
  });
});

describe("objects", () => {
  it("places, replaces and removes by tile, keeping the batch packed", () => {
    const { grid, batch, session: s } = session();
    batch.add(0, 0, 0, { glyph: 1, ink: 1 }); // the hero, not the layer's
    s.tool = tool("object");
    for (const x of [1, 2, 3]) {
      s.begin(grid.index(x, 1), false, false);
      s.end();
    }
    expect(batch.count).toBe(4);
    s.begin(grid.index(1, 1), true, false);
    s.end();
    expect(batch.count).toBe(3);
    expect(s.world.objects.at(grid.index(1, 1))).toBeNull();
    // The tile whose glyph was moved into the gap can still be found and removed.
    s.begin(grid.index(3, 1), true, false);
    s.end();
    expect(batch.count).toBe(2);
    expect(s.world.objects.list().map((o) => o.x)).toEqual([2]);
    s.undo();
    s.undo();
    expect(s.world.objects.list().map((o) => o.x)).toEqual([1, 2, 3]);
    expect(batch.bytes[12]).toBe(1);
  });

  it("stands an object on the ground again when the ground moves", () => {
    const { grid, batch, session: s } = session();
    s.tool = tool("object");
    s.begin(grid.index(2, 2), false, false);
    s.end();
    s.tool = tool("raise");
    s.begin(grid.index(2, 2), false, false);
    s.end();
    expect(new Float32Array(batch.bytes.buffer, 0, 3)[1]).toBeCloseTo(LEVEL);
    expect(batch.bytes.byteLength % INSTANCE_BYTES).toBe(0);
  });
});

describe("the rover", () => {
  it("moves with the camera's facing and stays on the map", () => {
    const grid = new TileGrid(16, 16);
    const rover = new Rover(grid, 8, 8);
    rover.press("arrowup");
    rover.update(0.1, 0, 10);
    expect(rover.z).toBeLessThan(8);
    expect(rover.x).toBeCloseTo(8);
    rover.update(100, 0, 10);
    expect(rover.z).toBe(0);
    rover.releaseAll();
    rover.update(1, 0, 10);
    expect(rover.z).toBe(0);
    expect(rover.press("x")).toBe(false);
  });
});

describe("the world file", () => {
  it("packs runs and unpacks them", () => {
    const values = new Int16Array([3, 3, 3, -2, -2, 7]);
    expect(encodeRuns(values)).toEqual([3, 3, 2, -2, 1, 7]);
    const back = new Int16Array(6);
    decodeRuns(encodeRuns(values), back, "heights");
    expect(back).toEqual(values);
  });

  it("round-trips the test card through JSON", () => {
    const content = demoContent(3);
    const text = JSON.stringify(encodeWorld(content));
    expect(text.length).toBeLessThan(600_000);
    const back = decodeWorld(JSON.parse(text));
    expect(back.grid.heights).toEqual(content.grid.heights);
    expect(back.grid.kinds).toEqual(content.grid.kinds);
    expect(back.grid.shapes).toEqual(content.grid.shapes);
    expect(back.grid.inks).toEqual(content.grid.inks);
    expect(back.start).toEqual(content.start);
    expect(back.objects).toHaveLength(content.objects.length);
    expect(tileAt(back.grid, 500)).toEqual(tileAt(content.grid, 500));
  });

  it("refuses a file that is not what it says", () => {
    const good = encodeWorld(demoContent(3));
    expect(() => decodeWorld(null)).toThrow();
    expect(() => decodeWorld({ ...good, version: 9 })).toThrow();
    expect(() => decodeWorld({ ...good, width: 1e9 })).toThrow();
    expect(() => decodeWorld({ ...good, heights: [5, 0] })).toThrow("shorter");
    expect(() => decodeWorld({ ...good, kinds: [256 * 256, 200] })).toThrow();
    expect(() => decodeWorld({ ...good, inks: [256 * 256 + 1, 255] })).toThrow("longer");
    expect(() => decodeWorld({ ...good, objects: [[999, 0, 1, 1, 0, 16]] })).toThrow(
      "out of range",
    );
    expect(() => decodeWorld({ ...good, objects: [[1, 1, 1, 99, 0, 16]] })).toThrow("out of range");
    expect(decodeWorld({ ...good, start: "nonsense" }).start).toEqual([128, 128]);
  });
});
