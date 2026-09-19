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
import { noticed, perform, told } from "../src/play/world-port.ts";
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

function scene(canStand = true, more: ThingView[] = []) {
  const stands = ([x, z]: readonly [number, number]) => canStand && grid.contains(x, z);
  const things = [
    ...more,
    made("branch", 5, 4),
    // A fire is a pile of branches alight: fuel burning, and no element of its own.
    { ...made("branch", 3, 4, { burning: 4, amount: 5 }), name: "a fire" },
    made("oil", 4, 3),
    { ...made("rat", 4, 6), kind: "creature", baseline: { mass: 1, hardness: 1 } },
  ];
  const port = matterPort(things, { tiles: 96 * 96, seed: 7, canStand: (tile) => stands(tile) });
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
      "branch@3,4",
      "branch@5,4",
      "hands",
      "oil@4,3",
    ]);
    expect(port.world.things["branch@3,4"]?.state).toMatchObject({
      burning: { of: "self" },
      temperature: 5,
    });
    expect(port.world.things["branch@5,4"]?.state.burning).toBeNull();
    expect(port.world.places.clearing?.extent).toBe(230);
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

  it("turns up a branch in a wood with a few quick looks: the menu's search leaves its length to the effort", () => {
    const { port, request } = scene();
    const asked = request(6, 6);
    const look = intentsFor(asked, port.compiled).find((i) => i.answers.kind === "branch");
    expect(look?.answers.duration).toBe(NONE);
    const had = Object.keys(port.world.things).length;
    for (let glance = 0; glance < 4; glance++) port.act(look?.answers as Answers, asked.things);
    expect(Object.keys(port.world.things).length).toBeGreaterThan(had);
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
    // The hearth outlasts the wait, and nothing else catches.
    const lit = things.filter((thing) => thing.states.burning !== undefined);
    expect(lit.map((thing) => thing.id)).toEqual(["branch@3,4"]);
    expect(port.world.things["branch@3,4"]?.state.burning).not.toBeNull();
    expect(told(["a", "a", "b", "c", "d", "e"])).toBe("a; b; c; and 2 more");
    expect(told([])).toBe("Nothing seems to change.");
  });

  it("tells the world where things and the hero are and how light it is, and hears back what the hero notices", () => {
    const { port, request } = scene();
    expect(port.world.things["branch@3,4"]?.where).toEqual([3, 4]);
    const asked = request(6, 6);
    const wait = intentsFor(asked, port.compiled).find((i) => i.answers.process === "X7");
    port.act(wait?.answers as Answers, asked.things, { where: [4, 4], hour: 23 });
    expect(port.world.bodies.hero?.where).toEqual([4, 4]);
    expect(port.world.places.clearing?.light).toBe(0);
    const night = port.aware?.() ?? [];
    // Beside a fire at night the hero is aware of it, and never of his own hands.
    expect(night.some((one) => one.source === "branch@3,4")).toBe(true);
    expect(night.some((one) => one.source === "hands")).toBe(false);
    expect([...night].sort((a, b) => b.strength - a.strength)).toEqual(night);
    expect(noticed(night)).toContain("you notice");
    port.act(wait?.answers as Answers, asked.things, { where: [4, 4], hour: 12 });
    expect(port.world.places.clearing?.light).toBe(5);
    expect(noticed([])).toBe("");
  });
});

describe("the bodies of that world", () => {
  it("shows the hero's body as rows, and a long wait leaves him hungrier and more tired", () => {
    const { port, request } = scene();
    const view = port.body?.();
    expect(view?.meters.map((meter) => meter.label)).toEqual(["health", "fed", "rested", "warm"]);
    const fed = () => view?.meters.find((meter) => meter.id === "hunger")?.level ?? 0;
    const before = fed();
    const asked = request(6, 6);
    const wait = intentsFor(asked, port.compiled).find((i) => i.answers.process === "X7");
    port.act({ ...(wait?.answers as Answers), duration: "until it is done" }, asked.things);
    expect(port.body?.()).toBe(view);
    expect(fed()).toBeLessThan(before);
    for (const meter of view?.meters ?? []) {
      expect(meter.level).toBeGreaterThanOrEqual(0);
      expect(meter.level).toBeLessThanOrEqual(1);
    }
  });

  it("gives a creature on the map a body that acts by its needs, and draws it where it went", () => {
    const { port, request, link, living } = scene();
    const rat = port.world.bodies["rat@4,6"];
    expect(rat).toMatchObject({ element: "rat", where: [4, 6] });
    expect(port.world.elements.rat).toMatchObject({ kind: "creature", body: { speed: 4 } });
    const asked = request(6, 6);
    const wait = intentsFor(asked, port.compiled).find((i) => i.answers.process === "X7");
    for (let turn = 0; turn < 3; turn++) perform(port, link, asked, wait?.answers as Answers, at);
    const where = port.world.bodies["rat@4,6"]?.where ?? [4, 6];
    const drawnAt = living.thing(living.indexOf("rat@4,6"));
    expect([drawnAt?.x, drawnAt?.z]).toEqual([Math.round(where[0]), Math.round(where[1])]);
  });

  it("sends a hungry creature to food it can smell, a tile at a time, and the map follows it", () => {
    // Fresh berries give off nothing a nose can find; these have gone off, and smell.
    const ripe = made("berries", 8, 6, { contamination: 4 });
    const { port, request, link, living } = scene(true, [ripe]);
    const asked = request(6, 6);
    const wait = intentsFor(asked, port.compiled).find((i) => i.answers.process === "X7");
    const away = () => {
      const rat = living.thing(living.indexOf("rat@4,6"));
      return Math.abs((rat?.x ?? 0) - 8) + Math.abs((rat?.z ?? 0) - 6);
    };
    const began = away();
    for (let turn = 0; turn < 4; turn++) perform(port, link, asked, wait?.answers as Answers, at);
    expect(away()).toBeLessThan(began);
  });

  it("puts a creature back when the map says it cannot stand where it went", () => {
    const { port, request } = scene(false, [made("berries", 8, 6, { contamination: 4 })]);
    const asked = request(6, 6);
    const wait = intentsFor(asked, port.compiled).find((i) => i.answers.process === "X7");
    for (let turn = 0; turn < 3; turn++) {
      const outcome = port.act(wait?.answers as Answers, asked.things);
      expect(outcome?.moved).toEqual({});
    }
    const where = port.world.bodies["rat@4,6"]?.where ?? [0, 0];
    expect([Math.round(where[0]), Math.round(where[1])]).toEqual([4, 6]);
  });

  it("comes to nothing for what the engine cannot do yet: a thing with no row, and moving", () => {
    const { port, request } = scene();
    const rat = request(4, 6);
    const strike = intentsFor(rat, port.compiled)[0]?.answers as Answers;
    expect(port.act(strike, rat.things)).toBeNull();
    expect(port.act({ ...strike, process: "X1" }, rat.things)).toBeNull();
  });
});
