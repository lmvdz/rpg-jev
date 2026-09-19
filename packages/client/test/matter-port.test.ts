import { matter } from "@rpg-jev/core";
import { describe, expect, it } from "vitest";
import { GlyphBatch } from "../src/glyph/batch.ts";
import {
  type Answers,
  BARE_HANDS,
  buildActRequest,
  GROUND,
  NONE,
  UNSEEN,
} from "../src/play/act-request.ts";
import { intentsFor } from "../src/play/intents.ts";
import { matterPort } from "../src/play/matter-port.ts";
import { type WorldChange, WorldLink } from "../src/play/world-link.ts";
import { perform, told } from "../src/play/world-port.ts";
import { TileGrid } from "../src/terrain/grid.ts";
import { askPriors } from "../src/view/birth.ts";
import { Births } from "../src/view/births.ts";
import { OneShots } from "../src/view/effects.ts";
import { LivingThings } from "../src/view/living.ts";
import type { ThingView } from "../src/view/things.ts";
import { ObjectLayer } from "../src/world/objects.ts";

const grid = new TileGrid(9, 9);
const made = (element: string, x: number, z: number, states = {}): ThingView => ({
  id: `${element}@${x},${z}`,
  element,
  name: `a ${element}`,
  x,
  z,
  look: { glyph: 1, ink: 1 },
  states,
});

function scene() {
  const things = [
    made("branch", 5, 4),
    made("fire", 3, 4, { burning: 4 }),
    made("oil", 4, 3),
    made("rat", 4, 5),
  ];
  const port = matterPort(things, 7);
  const births = new Births(askPriors, 1);
  const objects = new ObjectLayer(grid, new GlyphBatch(8));
  const living = new LivingThings(things, grid, objects, births);
  const link = new WorldLink({
    grid,
    living,
    births,
    shots: new OneShots(),
    motions: { play: () => undefined },
    actorSlot: () => 0,
    slotAt: (tile) => objects.slotAt(tile),
    elementOf: port.elementOf,
  });
  const request = (x: number, z: number) =>
    buildActRequest("", {
      grid,
      actorTile: grid.index(4, 4),
      targetTile: grid.index(x, z),
      thingAt: (tile) => living.thingAt(tile),
      sought: port.sought(),
    });
  return { things, port, living, link, request };
}

const at = { actorTile: grid.index(4, 4), targetTile: grid.index(5, 4), now: 1 };

describe("the words the client and the engine share", () => {
  it("are the same words", () => {
    expect([NONE, GROUND, UNSEEN, BARE_HANDS]).toEqual([
      matter.NONE,
      matter.GROUND,
      matter.UNSEEN,
      matter.BARE_HANDS,
    ]);
  });

  it("and the engine's changes are changes as the client reads them", () => {
    const read = (changes: readonly matter.Change[]): readonly WorldChange[] => changes;
    expect(read([])).toEqual([]);
  });
});

describe("the clearing as a world of matter", () => {
  it("holds the scattered things of elements in the pool, hands and a body, and nothing it has no row for", () => {
    const { port } = scene();
    expect(Object.keys(port.world.things).sort()).toEqual([
      "branch@5,4",
      "fire@3,4",
      "hands",
      "oil@4,3",
    ]);
    expect(port.world.things["fire@3,4"]?.state.burning).toMatchObject({ of: "self" });
    expect(port.world.bodies.hero).toBeDefined();
    expect(port.sought()).toContain("stone");
    expect(port.compiled).toContain("X2");
    expect(port.elementOf("branch")).toMatchObject({ kind: "thing", name: expect.any(String) });
    expect(port.elementOf("no such")).toBeNull();
  });

  it("offers a menu from what the engine compiles, and every row compiles or comes to nothing cleanly", () => {
    const { port, request } = scene();
    const asked = request(5, 4);
    const intents = intentsFor(asked, port.compiled);
    expect(intents.map((intent) => intent.label)).toContain("heat a branch with a fire");
    for (const intent of intents) {
      const outcome = scene().port.act(intent.answers, asked.things);
      if (outcome) expect(outcome.process).toEqual(expect.any(String));
    }
  });

  it("resolves a blow through the engine and hands back the branch as the world now has it", () => {
    const { port, request } = scene();
    const asked = request(5, 4);
    const strike = intentsFor(asked, port.compiled)[0]?.answers as Answers;
    const outcome = port.act({ ...strike, haste: "in a rush" }, asked.things);
    expect(outcome?.process).toBe("force");
    for (const [id, seen] of Object.entries(outcome?.after ?? {})) {
      expect(seen?.state ?? null).toEqual(port.world.things[id]?.state ?? null);
    }
    for (const change of outcome?.changes ?? []) expect(change.because.length).toBeGreaterThan(0);
  });

  it("sets a branch alight from the fire, and the page shows it burning by its blaze", () => {
    const { port, request, link, living } = scene();
    const asked = request(5, 4);
    const heat = intentsFor(asked, port.compiled).find((i) => i.answers.process === "X3");
    const long = { ...(heat?.answers as Answers), duration: "until it is done" };
    const said = perform(port, link, asked, long, at);
    expect(said.length).toBeGreaterThan(0);
    const branch = port.world.things["branch@5,4"];
    const shown = living.thing(living.indexOf("branch@5,4"))?.states.burning ?? 0;
    const blaze = branch?.state.burning ? matter.blaze(port.world, branch) : 0;
    expect(shown).toBe(blaze > 0 ? Math.max(1, Math.round(blaze)) : 0);
    expect(branch?.state.temperature).toBeGreaterThan(2);
  });

  it("logs the draw a search was given, and a found thing appears on the map", () => {
    const { port, request, link, living } = scene();
    const asked = request(6, 6);
    const look = intentsFor(asked, port.compiled).find((i) => i.answers.kind === "stone");
    const thorough = { ...(look?.answers as Answers), effort: "a thorough search" };
    const count = () => Object.keys(port.world.things).length;
    const had = count();
    for (let tries = 0; tries < 6 && count() === had; tries++) {
      perform(port, link, asked, thorough, { ...at, targetTile: grid.index(6, 6) });
    }
    expect(port.draws.length).toBeGreaterThan(0);
    expect(port.draws[0]?.process).toBe("search");
    const found = Object.values(port.world.things).find((thing) => thing.id.startsWith("stone."));
    if (found) expect(living.indexOf(found.id)).toBeGreaterThanOrEqual(0);
  });

  it("lets time pass over everything at once: nothing new is lit, the hands stay undrawn, the HUD stays short", () => {
    const { port, request, link, living, things } = scene();
    const asked = request(6, 6);
    const wait = intentsFor(asked, port.compiled).find((i) => i.answers.process === "X7");
    const outcome = port.act(wait?.answers as Answers, asked.things);
    expect(outcome?.process).toBe("drift");
    expect(Object.keys(outcome?.after ?? {})).not.toContain("hands");
    const said = perform(port, link, asked, wait?.answers as Answers, at);
    expect(said.split("; ").length).toBeLessThanOrEqual(4);
    expect(living.indexOf("hands")).toBe(-1);
    // Whether the hearth outlasts the wait is the engine's to say; that nothing else catches is ours.
    const lit = things.filter((thing) => thing.states.burning !== undefined);
    expect(lit.every((thing) => thing.element === "fire")).toBe(true);
    expect(told(["a", "a", "b", "c", "d", "e"])).toBe("a; b; c; and 2 more");
    expect(told([])).toBe("Nothing seems to change.");
  });

  it("comes to nothing for what the engine cannot do yet: a thing with no row, and moving", () => {
    const { port, request } = scene();
    const rat = request(4, 5);
    const strike = intentsFor(rat, port.compiled)[0]?.answers as Answers;
    expect(port.act(strike, rat.things)).toBeNull();
    expect(port.act({ ...strike, process: "X1" }, rat.things)).toBeNull();
  });
});
