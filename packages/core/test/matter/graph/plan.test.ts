/**
 * Chaining, tested: a goal as a row of data, the engine as its own model, and no sequence
 * written by anyone. The hand-written stages of carrying (intents.ts, `carrying`) are the
 * oracle here: the planner has to find the same steps without being told them.
 */
import { describe, expect, it } from "vitest";
import { type Goal, met, planFor } from "../../../src/matter/graph/plan.ts";
import {
  type Act,
  type Body,
  type Element,
  FRESH,
  type MatterWorld,
  POOL,
  placeOf,
  play,
  resolve,
  type Thing,
  worldOf,
} from "../../../src/matter/index.ts";

const ROWS: Element[] = [
  {
    id: "wolf",
    name: "a wolf",
    kind: "creature",
    forms: [],
    props: { mass: 3, size: 3, hardness: 1, toughness: 3 },
    body: { strength: 3, speed: 4, sight: 3, hearing: 4, smell: 5 },
  },
  {
    id: "pup",
    name: "a wolf pup",
    kind: "creature",
    forms: [],
    props: { mass: 1, size: 1 },
    body: { strength: 0, speed: 1, sight: 1, hearing: 2, smell: 2 },
  },
  {
    id: "person",
    name: "a person",
    kind: "person",
    forms: [],
    props: { mass: 3, size: 3, hardness: 1, toughness: 2 },
    body: { strength: 2, speed: 2, sight: 3, hearing: 3, smell: 1 },
  },
  {
    id: "meat",
    name: "meat",
    kind: "material",
    forms: [],
    props: { mass: 1, size: 1, toughness: 2, scent: 3 },
    moist: 3,
    serves: { hunger: 3 },
    fare: "flesh",
  },
];
const at = (id: string, element: string, where: [number, number]): Thing => ({
  id,
  element,
  place: "wood",
  where,
  state: { ...FRESH },
});
const body = (id: string, element: string, where: [number, number]): Body => ({
  id,
  element,
  place: "wood",
  where,
  needs: { hunger: 2 },
  health: 5,
  wounds: [],
  sickness: 0,
  sickensIn: 0,
});
function wood(things: Thing[], bodies: Body[]): MatterWorld {
  const empty = worldOf([...POOL, ...ROWS], [placeOf("wood", { light: 4 })]);
  const made = {
    ...empty,
    things: Object.fromEntries(things.map((t) => [t.id, t])),
    bodies: Object.fromEntries(bodies.map((b) => [b.id, b])),
  };
  return resolve(made, { process: "drift", minutes: 0 }).world;
}
const verbs = (plan: readonly Act[] | null) =>
  (plan ?? []).map((a) => (a.process === "take" && a.drop ? "drop" : a.process));

describe("a plan is found, not written", () => {
  const den = wood(
    [at("kill", "meat", [30, 0])],
    [body("she", "wolf", [2, 0]), body("pup1", "pup", [0, 0])],
  );
  const fed: Goal = { kind: "near", a: "kill", b: "pup1", within: 1.5, free: true };

  it("food beside the young, from a kill thirty tiles off: go, take, go, set down", () => {
    const plan = planFor(den, "she", fed, ["kill", "pup1"]);
    expect(verbs(plan)).toEqual(["move", "take", "move", "drop"]);
    expect(met(play(den, plan ?? []).world, fed)).toBe(true);
  });

  it("the same search, other things: it finds a way nobody wrote, and the long way when it must", () => {
    const things = (anchor: string) => [
      at("branch", "branch", [8, 3]),
      at("anchor", anchor, [-6, 0]),
    ];
    const goal: Goal = { kind: "near", a: "branch", b: "anchor", within: 1.5, free: true };
    // A branch beside a stone: the stone is nearer and can be carried, so it takes the stone to
    // the branch, in three steps. The goal never said which of them was to move.
    const stone = wood(things("stone"), [body("he", "person", [0, 0])]);
    const short = planFor(stone, "he", goal, ["branch", "anchor"]);
    expect(verbs(short)).toEqual(["move", "take", "move"]);
    expect(met(play(stone, short ?? []).world, goal)).toBe(true);
    // A branch beside an oak: nobody carries an oak, so the branch goes to it, in four.
    const oak = wood(things("oak"), [body("he", "person", [0, 0])]);
    const long = planFor(oak, "he", goal, ["branch", "anchor"]);
    expect(verbs(long)).toEqual(["move", "take", "move", "drop"]);
    expect(met(play(oak, long ?? []).world, goal)).toBe(true);
  });

  it("what already holds takes no steps, and what cannot be done has no plan", () => {
    const there = wood(
      [at("kill", "meat", [0, 1])],
      [body("she", "wolf", [2, 0]), body("pup1", "pup", [0, 0])],
    );
    expect(planFor(there, "she", fed, ["kill", "pup1"])).toEqual([]);
    // An oak is not carried anywhere by a wolf.
    const oak = wood(
      [at("oak", "oak", [10, 0])],
      [body("she", "wolf", [2, 0]), body("pup1", "pup", [0, 0])],
    );
    expect(
      planFor(oak, "she", { kind: "near", a: "oak", b: "pup1", within: 1.5, free: true }, [
        "oak",
        "pup1",
      ]),
    ).toBeNull();
  });

  it("is the same plan every time, and a shorter goal gives a shorter plan", () => {
    expect(planFor(den, "she", fed, ["kill", "pup1"])).toEqual(
      planFor(den, "she", fed, ["kill", "pup1"]),
    );
    expect(
      verbs(planFor(den, "she", { kind: "holds", body: "she", thing: "kill" }, ["kill"])),
    ).toEqual(["move", "take"]);
  });
});
