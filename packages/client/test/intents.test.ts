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
import { answersFit, intentsFor } from "../src/play/intents.ts";
import { type WorldChange, WorldLink } from "../src/play/world-link.ts";
import { perform, type WorldPort } from "../src/play/world-port.ts";
import { TileGrid } from "../src/terrain/grid.ts";
import { askPriors } from "../src/view/birth.ts";
import { Births } from "../src/view/births.ts";
import { OneShots } from "../src/view/effects.ts";
import { LivingThings } from "../src/view/living.ts";
import type { ThingView } from "../src/view/things.ts";
import { ObjectLayer } from "../src/world/objects.ts";

const look = { glyph: 1, ink: 1 };
const grid = new TileGrid(9, 9);
const made = (id: string, x: number, more: Partial<ThingView>): ThingView => ({
  id,
  element: id,
  name: `a ${id}`,
  x,
  z: 4,
  look,
  states: {},
  ...more,
});
const things = [
  made("branch", 5, { forms: ["long", "grained"] }),
  made("fire", 3, { states: { burning: 4 } }),
  made("oil", 4, { z: 3, forms: ["liquid"] }),
  made("stump", 8, {}),
];
const scene = (sought: readonly string[] = ["stone", "flint"]) => ({
  grid,
  actorTile: grid.index(4, 4),
  targetTile: grid.index(5, 4),
  thingAt: (tile: number) => things.find((thing) => grid.index(thing.x, thing.z) === tile) ?? null,
  sought,
});
const COMPILED = ["X2", "X3", "X4", "X5", "X6", "X7", "X8"];

describe("the request the world's compiler reads", () => {
  const request = buildActRequest("whittle the branch", scene());

  it("asks a tenth question, what kind is sought, from the closed set the world gives", () => {
    expect(request.questions).toHaveLength(10);
    expect(request.questions.at(-1)).toMatchObject({
      field: "kind",
      options: [NONE, "stone", "flint"],
    });
    expect(buildActRequest("x", scene([])).questions.at(-1)?.options).toEqual([NONE]);
  });

  it("pins the special words and keeps which thing each operand id stands for, outside the state", () => {
    expect([NONE, GROUND, UNSEEN, BARE_HANDS]).toEqual([
      "none",
      "the ground at the target",
      "something not in sight",
      "bare hands",
    ]);
    const paired = request.state.inReach.map((operand) => [
      operand.name,
      request.things[operand.id],
    ]);
    expect(paired.sort()).toEqual([
      ["a branch", "branch"],
      ["a fire", "fire"],
      ["a oil", "oil"],
    ]);
    expect(JSON.stringify(request.state)).not.toContain('"things"');
    const oil = request.state.inReach.find((operand) => operand.name === "a oil");
    expect(oil?.forms).toEqual(["liquid"]);
  });
});

describe("the menu's intents", () => {
  const request = buildActRequest("", scene());
  const intents = intentsFor(request, COMPILED);

  it("are built from roles and what can be seen: fire heats, a liquid soaks and coats, a solid strikes", () => {
    expect(intents.map((intent) => intent.label)).toEqual([
      "strike a branch",
      "strike a branch with a fire",
      "heat a branch with a fire",
      "soak a branch with a oil",
      "coat a branch with a oil",
      "eat a branch",
      "wait a while",
      "look around for stone",
      "look around for flint",
    ]);
    const heat = intents[2]?.answers;
    expect(heat).toMatchObject({ process: "X3", patient: "t1" });
    expect(request.things[heat?.instrument ?? ""]).toBe("fire");
    expect(intents[0]?.answers.instrument).toBe(BARE_HANDS);
    const search = { process: "X8", patient: UNSEEN, kind: "flint" };
    expect(intents.at(-1)?.answers).toMatchObject(search);
  });

  it("are always answers the request's own questions offer", () => {
    for (const intent of intents) expect(answersFit(request, intent.answers)).toBe(true);
    const forged: Answers = { ...(intents[0]?.answers as Answers), patient: "t99" };
    expect(answersFit(request, forged)).toBe(false);
  });

  it("say a thing once when two alike are in reach", () => {
    const both = [...things, made("fire", 5, { z: 5, id: "fire2" })];
    const thingAt = (tile: number) =>
      both.find((thing) => grid.index(thing.x, thing.z) === tile) ?? null;
    const twin = { ...scene(), thingAt };
    const labels = intentsFor(buildActRequest("", twin), COMPILED).map((intent) => intent.label);
    expect(labels.filter((label) => label === "heat a branch with a fire")).toHaveLength(1);
  });

  it("offer only what the world compiles, and nothing with no world", () => {
    expect(intentsFor(request, ["X7"]).map((intent) => intent.label)).toEqual(["wait a while"]);
    expect(intentsFor(request, [])).toEqual([]);
    const ground = buildActRequest("", { ...scene([]), targetTile: grid.index(6, 6) });
    expect(intentsFor(ground, COMPILED).map((intent) => intent.label)).toEqual(["wait a while"]);
  });
});

describe("answers taken into the world", () => {
  const births = new Births(askPriors, 1);
  const objects = new ObjectLayer(grid, new GlyphBatch(8));
  const living = new LivingThings(structuredClone(things), grid, objects, births);
  const link = new WorldLink({
    grid,
    living,
    births,
    shots: new OneShots(),
    motions: { play: () => undefined },
    actorSlot: () => 0,
    slotAt: (tile) => objects.slotAt(tile),
    elementOf: () => null,
  });
  const request = buildActRequest("", scene());
  const strike = intentsFor(request, COMPILED)[0]?.answers as Answers;
  const at = { actorTile: grid.index(4, 4), targetTile: grid.index(5, 4), now: 1 };
  const why = { because: ["X2"], note: "" };

  it("hands the world the answers and the operand map, and shows what comes back", () => {
    const seen: unknown[] = [];
    const port: WorldPort = {
      compiled: COMPILED,
      sought: () => [],
      elementOf: () => null,
      act: (answers, operands) => {
        seen.push(answers.process, operands[answers.patient]);
        const changes: WorldChange[] = [
          { ...why, kind: "state", thing: "branch", set: { integrity: 3 }, note: "It cracks." },
        ];
        return { process: "force", changes };
      },
    };
    expect(perform(port, link, request, strike, at)).toBe("It cracks.");
    expect(seen).toEqual(["X2", "branch"]);
    expect(living.thing(living.indexOf("branch"))?.states.integrity).toBe(3);
  });

  it("says so when there is no world, when the answers are not the request's, and when they come to nothing", () => {
    const nothing: WorldPort = {
      compiled: [],
      sought: () => [],
      elementOf: () => null,
      act: () => null,
    };
    expect(perform(null, link, request, strike, at)).toContain("No world");
    const far = buildActRequest("", { ...scene(), targetTile: grid.index(8, 4) });
    const reach = intentsFor(far, COMPILED)[0]?.answers as Answers;
    expect(perform(nothing, link, far, reach, at)).toBe("That is too far away.");
    expect(perform(nothing, link, request, { ...strike, process: "X99" }, at)).toContain("not");
    expect(perform(nothing, link, request, strike, at)).toBe("That comes to nothing.");
    const quiet = { ...nothing, act: () => ({ process: "drift", changes: [] }) };
    expect(perform(quiet, link, request, strike, at)).toBe("Nothing seems to change.");
  });
});
