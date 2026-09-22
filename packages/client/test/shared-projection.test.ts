import { expect, it } from "vitest";
import { GlyphBatch } from "../src/glyph/batch.ts";
import { SharedPlay } from "../src/play/shared-play.ts";
import { type SharedView, sharedThings } from "../src/play/shared-types.ts";
import { Walker } from "../src/scene/walker.ts";
import { TileGrid } from "../src/terrain/grid.ts";
import { askPriors } from "../src/view/birth.ts";
import { Births } from "../src/view/births.ts";
import { LivingThings } from "../src/view/living.ts";
import type { ThingView } from "../src/view/things.ts";
import { ObjectLayer } from "../src/world/objects.ts";

it("repeated shared projections replace remote glyphs and pick targets without accumulating", () => {
  const grid = new TileGrid(8, 8);
  const batch = new GlyphBatch(8);
  batch.add(2.5, 0, 2.5, { glyph: 1, ink: 1 });
  const objects = new ObjectLayer(grid, batch);
  const living = new LivingThings([], grid, objects, new Births(askPriors, 1));
  let receive: (view: SharedView) => void = () => {
    throw new Error("not connected");
  };
  const play = new SharedPlay(
    new Walker(grid, 2, 2),
    living,
    (onView) => {
      receive = onView;
      return {
        move: () => Promise.reject(new Error("not part of this test")),
        act: () => Promise.reject(new Error("not part of this test")),
        close: () => {
          // No real socket.
        },
      };
    },
    () => {
      // Rendering-only fixture.
    },
  );
  const thing = (id: string, x: number): ThingView => ({
    id,
    x,
    z: 2,
    element: "person",
    kind: "creature",
    name: id,
    forms: [],
    baseline: {},
    states: {},
    look: { glyph: 1, ink: 1 },
  });
  const view: SharedView = {
    actor: "self",
    revision: 1,
    tick: 1,
    sequence: 0,
    seed: 1,
    position: [2, 2],
    things: [thing("self", 2), thing("other", 3)],
    elements: {},
    body: { meters: [], counts: [] },
    aware: [],
    compiled: [],
    sought: [],
  };
  for (let i = 0; i < 20; i++) receive(view);
  expect(batch.count).toBe(2);
  expect(living.indexOf("self")).toBe(-1);
  const compact = { ...thing("other", 3) };
  delete compact.look;
  delete compact.forms;
  delete compact.baseline;
  const compactView = {
    ...view,
    things: [compact],
    elements: { person: { name: "person", look: { glyph: 1, ink: 1 }, forms: [], baseline: {} } },
  };
  expect(sharedThings(compactView)).toEqual([thing("other", 3)]);
  receive(compactView);
  expect(living.thingAt(grid.index(3, 2))).toEqual(thing("other", 3));
  expect(compact.look).toBeUndefined();
  expect(
    sharedThings({ ...compactView, things: [{ ...compact, look: { glyph: 2, ink: 2 } }] })[0]?.look,
  ).toEqual({ glyph: 2, ink: 2 });
  receive({ ...view, revision: 2, things: [thing("other", 4)] });
  expect(batch.count).toBe(2);
  expect(living.thingAt(grid.index(3, 2))).toBeNull();
  expect(objects.at(grid.index(3, 2))).toBeNull();
  expect(living.thingAt(grid.index(4, 2))?.id).toBe("other");
  receive({ ...view, revision: 3, things: [] });
  expect(batch.count).toBe(1);
  expect(living.indexOf("other")).toBe(-1);
  play.close();
});
