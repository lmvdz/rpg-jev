/** Authored input, not rules: five discrete portions in a small shared clearing. */
import { matter } from "@rpg-jev/core";
import { glyphOfChar, glyphOfExtra } from "../glyph/font.ts";
import { INK } from "../palette.ts";
import { TileGrid } from "../terrain/grid.ts";
import { kindIndex } from "../terrain/kinds.ts";

export const FOOD_PLACE = "food-clearing";
export const FOOD_WIDTH = 20;
export const FOOD_DEPTH = 16;
export const FOOD_HERO = "hero";
export const FOOD_GOAL = 2;
export const inCamp = (x: number, z: number) => x >= 4 && x <= 6 && z >= 7 && z <= 9;

function groundAt(x: number, z: number): Parameters<typeof kindIndex>[0] {
  if (x === 0 || z === 0 || x === FOOD_WIDTH - 1 || z === FOOD_DEPTH - 1) return "water";
  if (inCamp(x, z)) return "dirt";
  if (x < 3 || x > 16) return "forest";
  return "grass";
}

export function foodGrid(): TileGrid {
  const grid = new TileGrid(FOOD_WIDTH, FOOD_DEPTH);
  for (let z = 0; z < FOOD_DEPTH; z++) {
    for (let x = 0; x < FOOD_WIDTH; x++) {
      grid.set(x, z, {
        height: 0,
        kind: kindIndex(groundAt(x, z)),
      });
    }
  }
  return grid;
}

export function newFoodSession(): matter.MatterSession {
  const world = matter.worldOf(matter.POOL, [
    matter.placeOf(FOOD_PLACE, { light: 5, cover: 0, wind: 0, abundance: {} }),
  ]);
  world.elements.traveller = {
    id: "traveller",
    name: "you",
    kind: "creature",
    forms: [],
    props: { size: 3, mass: 3 },
    body: { strength: 3, speed: 2, sight: 5, smell: 2, hearing: 2 },
  };
  world.elements.forager = {
    id: "forager",
    name: "a small forager",
    kind: "creature",
    forms: [],
    props: { size: 1, mass: 1 },
    body: { strength: 1, speed: 3, sight: 4, smell: 5, hearing: 3, eats: { fruit: 5 } },
    look: { glyph: glyphOfChar("r"), ink: INK.sand, scale: 18, sways: false },
  };
  const berries = world.elements.berries;
  if (!berries) throw new Error("The food fixture needs the berries element.");
  world.elements.berries = {
    ...berries,
    name: "a berry portion",
    serves: { hunger: 1 },
    look: { glyph: glyphOfChar("*"), ink: INK.ember, scale: 22, sways: false },
  };
  const whole = { place: FOOD_PLACE, health: 5, wounds: [], sickness: 0, sickensIn: 0 };
  world.bodies.hero = {
    ...whole,
    id: FOOD_HERO,
    element: "traveller",
    where: [6, 8],
    needs: { hunger: 2, rest: 0, warmth: 0 },
    holds: [],
  };
  world.bodies.forager = {
    ...whole,
    id: "forager",
    element: "forager",
    where: [13, 8],
    needs: { hunger: 3, rest: 0 },
    holds: [],
  };
  const portions = [
    [8, 8],
    [9, 7],
    [10, 8],
    [10, 9],
    [8, 10],
  ] as const;
  portions.forEach((where, i) => {
    const id = `portion-${i + 1}`;
    world.things[id] = {
      id,
      element: "berries",
      place: FOOD_PLACE,
      where,
      state: { ...matter.FRESH, amount: 1 },
    };
  });
  world.elements.camp = {
    id: "camp",
    name: "the camp shelter",
    kind: "thing",
    forms: [],
    props: { size: 4, mass: 4, hardness: 3 },
    look: { glyph: glyphOfChar("^"), ink: INK.lamp, scale: 25, sways: false },
  };
  world.things.camp = {
    id: "camp",
    element: "camp",
    place: FOOD_PLACE,
    where: [4, 8],
    state: { ...matter.FRESH },
  };
  world.elements.copse = {
    id: "copse",
    name: "an oak",
    kind: "plant",
    forms: [],
    props: { size: 4, mass: 4, hardness: 3 },
    look: { glyph: glyphOfExtra("tree"), ink: INK.leaf, scale: 25, sways: true },
  };
  const trees = [
    [2, 4],
    [3, 12],
    [15, 3],
    [17, 10],
    [11, 13],
  ] as const;
  trees.forEach((where, i) => {
    const id = `tree-${i}`;
    world.things[id] = {
      id,
      element: "copse",
      place: FOOD_PLACE,
      where,
      state: { ...matter.FRESH },
    };
  });
  const walkable = Array.from({ length: FOOD_WIDTH * FOOD_DEPTH }, (_, i) => {
    const x = i % FOOD_WIDTH;
    const z = Math.floor(i / FOOD_WIDTH);
    return (
      x > 0 &&
      z > 0 &&
      x < FOOD_WIDTH - 1 &&
      z < FOOD_DEPTH - 1 &&
      !Object.values(world.things).some(
        (t) => t.element !== "berries" && t.where?.[0] === x && t.where?.[1] === z,
      )
    );
  });
  return matter.createMatterSession({
    world,
    terrain: { place: FOOD_PLACE, width: FOOD_WIDTH, height: FOOD_DEPTH, walkable },
    controlled: [FOOD_HERO],
    autonomous: ["forager"],
  });
}
