// Native TS stripping with the repository's existing core dependencies.
// The hook avoids importing unrelated inn/thermal entry points.
// node --test packages/client/test/food-session.native.test.mjs
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";

const matterUrl = new URL("../../core/src/matter/index.ts", import.meta.url).href;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@rpg-jev/core")
      return {
        url: `data:text/javascript,${encodeURIComponent(`export * as matter from ${JSON.stringify(matterUrl)};`)}`,
        shortCircuit: true,
      };
    return nextResolve(specifier, context);
  },
});
const { FoodSession, FOOD_SAVE_KEY, foodView } = await import("../src/play/food-session.ts");
const { foodGrid, newFoodSession } = await import("../src/scene/food.ts");
const { Walker } = await import("../src/scene/walker.ts");

function storage() {
  const values = new Map();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    },
  });
  return values;
}

test("food goes from ground to hands to actual camp ground, not an inventory score", () => {
  storage();
  const food = new FoodSession();
  assert.equal(food.view.portions.length, 5);
  assert.equal(food.step({ kind: "move", to: [7, 8] }), true);
  assert.equal(food.step({ kind: "take", thing: "portion-1" }), true);
  assert.equal(food.view.held.length, 1);
  assert.equal(food.view.atCamp, 0);
  assert.equal(food.step({ kind: "move", to: [6, 8] }), true);
  assert.equal(food.step({ kind: "drop", thing: "portion-1" }), true);
  assert.equal(food.view.held.length, 0);
  assert.equal(food.view.atCamp, 1);
});

test("save/reload restores clock, own needs, possession and visible autonomous position", () => {
  const values = storage();
  const food = new FoodSession();
  food.step({ kind: "move", to: [7, 8] });
  food.step({ kind: "take", thing: "portion-1" });
  food.save();
  const saved = structuredClone(food.view);
  assert(values.has(FOOD_SAVE_KEY));
  food.step({ kind: "eat", thing: "portion-1" });
  assert.equal(food.view.held.length, 0);
  assert.notDeepEqual(food.view.body, saved.body);
  assert.equal(food.reload(), true);
  assert.deepEqual(food.view, saved);
  assert.deepEqual(new FoodSession().view, saved, "startup restores without offline turns");
});

test("stale menu ticks and paused commands do not advance time", () => {
  storage();
  const food = new FoodSession();
  const oldTick = food.view.tick;
  food.step({ kind: "wait" });
  const before = structuredClone(food.view);
  assert.equal(food.step({ kind: "wait" }, oldTick), false);
  assert.deepEqual(food.view, before);
  food.paused = true;
  assert.equal(food.step({ kind: "wait" }), false);
  assert.deepEqual(food.view, before);
});

test("snapshot failures are visible and cannot replace the current session", () => {
  const values = storage();
  const food = new FoodSession();
  const before = structuredClone(food.view);
  values.set(FOOD_SAVE_KEY, '{"version":999}');
  assert.equal(food.reload(), false);
  assert.match(food.failure, /Restore failed/);
  assert.deepEqual(food.view, before);
  globalThis.localStorage.setItem = () => {
    throw new Error("quota");
  };
  food.save();
  assert.match(food.failure, /Save failed.*quota/);
  assert.deepEqual(food.view, before);
});

test("private creature-state twins have identical player projections", () => {
  const session = newFoodSession();
  const other = structuredClone(session);
  other.world.bodies.forager.needs.hunger = 0;
  other.world.bodies.forager.feels = { hero: { fear: 5, anger: 4, trust: -4 } };
  other.world.bodies.forager.doing = "secret-intention";
  assert.deepEqual(foodView(other), foodView(session));
  assert(!JSON.stringify(foodView(other)).includes("secret-intention"));
});

test("render rates produce identical complete simulation state, not merely equal paths", () => {
  const run = (fps) => {
    const values = storage();
    const food = new FoodSession();
    const grid = foodGrid();
    const walker = new Walker(grid, ...food.view.where);
    walker.commitStep = (x, z) => food.step({ kind: "move", to: [x, z] });
    const walk = (x, z) => {
      walker.follow([grid.index(x, z)]);
      let frames = 0;
      while (walker.busy && frames++ < fps * 10) walker.update(1 / fps, 0);
      assert.equal(walker.busy, false);
    };
    walk(7, 8);
    assert(food.step({ kind: "take", thing: "portion-1" }));
    walk(6, 8);
    assert(food.step({ kind: "drop", thing: "portion-1" }));
    assert(food.step({ kind: "wait" }));
    food.save();
    return JSON.parse(values.get(FOOD_SAVE_KEY));
  };
  assert.deepEqual(run(15), run(144));
});

test("allowing the creature to feed leaves a finite remainder without a scripted reward", () => {
  storage();
  const food = new FoodSession();
  for (let i = 0; i < 16; i++) assert(food.step({ kind: "wait" }));
  assert.equal(food.view.portions.length, 2);
  const remainder = structuredClone(food.view.portions);
  for (let i = 0; i < 4; i++) assert(food.step({ kind: "wait" }));
  assert.deepEqual(food.view.portions, remainder);
  assert.equal(food.view.atCamp, 0);
});
