import assert from "node:assert/strict";
import test from "node:test";
import {
  apply,
  createSharedState,
  FRESH,
  sharedAct,
  sharedMove,
  sharedTick,
} from "../../src/matter/index.ts";
import { Rng } from "../../src/rng.ts";
import { clearing, put } from "./held-out-fixture.ts";

function required<T>(value: T | undefined): T {
  assert.notEqual(value, undefined);
  return value as T;
}

const canStep = (from: readonly [number, number], to: readonly [number, number]) =>
  to.every((n) => Number.isInteger(n) && n >= 0 && n < 8) &&
  Math.abs(from[0] - to[0]) + Math.abs(from[1] - to[1]) <= 1;

function fixture() {
  const world = clearing();
  required(world.places.clearing).light = 5;
  const body = required(world.bodies.player);
  body.where = [1, 2];
  body.holds = ["player.hands"];
  world.bodies.other = {
    ...structuredClone(body),
    id: "other",
    where: [5, 2],
    holds: ["other.hands"],
  };
  for (const b of Object.values(world.bodies)) {
    put(world, `${b.id}.hands`, "pebble");
    required(world.things[`${b.id}.hands`]).where = required(b.where);
  }
  put(world, "food", "food", { amount: 3 });
  required(world.things.food).where = [4, 2];
  put(world, "oil", "oil");
  required(world.things.oil).where = [3, 2];
  put(world, "reed", "reed");
  required(world.things.reed).where = [3, 2];
  return createSharedState(world, 42);
}

test("two actors move independently; actions grant no autonomous turn", () => {
  const initial = fixture();
  const a = sharedMove(initial, "player", [2, 2], canStep);
  assert.equal(a.ok, true);
  assert.deepEqual(required(a.state.world.bodies.other).where, [5, 2]);
  const b = sharedMove(a.state, "other", [5, 3], canStep);
  assert.equal(b.ok, true);
  assert.deepEqual(required(b.state.world.bodies.player).where, [2, 2]);
  assert.deepEqual(required(b.state.world.things["other.hands"]).where, [5, 3]);
  assert.equal(b.state.tick, 0);
  assert.deepEqual(apply(initial.world, [...a.changes, ...b.changes]), b.state.world);
});

test("remote, hidden, missing, other-held and malformed operands reject without RNG changes", () => {
  const state = fixture();
  const answers = { process: "X6", patient: "t1", instrument: "none" };
  const remote = sharedAct(state, "player", answers, { t1: "food" }, canStep);
  assert.equal(remote.ok, false);
  assert.equal(remote.state, state);
  assert.deepEqual(remote.draws, []);
  for (const id of ["missing", "other.hands"]) {
    assert.equal(sharedAct(state, "player", answers, { t1: id }, canStep).state, state);
  }
  const hidden = structuredClone(state);
  required(hidden.world.things.food).where = [2, 2];
  required(hidden.world.bodies.player).aware = {};
  assert.equal(sharedAct(hidden, "player", answers, { t1: "food" }, canStep).ok, false);
  assert.equal(
    sharedAct(state, "player", { ...answers, effort: "infinite" }, {}, canStep).state,
    state,
  );
  assert.equal(
    sharedAct(
      state,
      "player",
      { process: "X8", patient: "something not in sight", instrument: "none", kind: "missing" },
      {},
      canStep,
    ).state,
    state,
  );
});

test("generic coat uses actor's new position, not a client location", () => {
  const initial = fixture();
  const answers = { process: "X5", patient: "target", instrument: "tool", amount: "some" };
  const operands = { target: "reed", tool: "oil" };
  assert.equal(sharedAct(initial, "player", answers, operands, canStep).ok, false);
  const moved = sharedMove(initial, "player", [2, 2], canStep).state;
  const result = sharedAct(moved, "player", answers, operands, canStep);
  assert.equal(result.ok, true, result.reason);
  assert.notDeepEqual(required(result.state.world.things.reed).state, FRESH);
  assert.deepEqual(apply(moved.world, result.changes), result.state.world);
});

test("unused remote browser vocabulary does not invalidate selected reachable operands", () => {
  const moved = sharedMove(fixture(), "player", [2, 2], canStep).state;
  const answers = { process: "X5", patient: "target", instrument: "tool", amount: "some" };
  const operands = { target: "reed", tool: "oil" };
  const expected = sharedAct(moved, "player", answers, operands, canStep);
  assert.equal(expected.ok, true);
  const expanded = sharedAct(
    moved,
    "player",
    answers,
    { ...operands, unused: "food", unseen: "not-present" },
    canStep,
  );
  assert.deepEqual(expanded, expected);
});

test("the host's bounded passive time advances without player input and replays from changes", () => {
  const initial = fixture();
  const next = sharedTick(initial, [], canStep, 1 / 120);
  assert.equal(next.ok, true);
  assert.equal(next.state.tick, 1);
  assert.notDeepEqual(next.state.world, initial.world);
  assert.deepEqual(apply(initial.world, next.changes), next.state.world);
  assert.deepEqual(next.state.rng, initial.rng);
  assert.equal(sharedTick(initial, [], canStep, Number.NaN).state, initial);
  assert.equal(sharedTick(initial, [], canStep, 2).state, initial);
});

test("search logs its draw and creates at stored position; replay restores world and RNG", () => {
  const state = fixture();
  required(state.world.places.clearing).abundance.pebble = 5;
  const answers = {
    process: "X8",
    patient: "something not in sight",
    instrument: "none",
    kind: "pebble",
    duration: "until it is done",
  };
  const result = sharedAct(state, "player", answers, {}, canStep);
  assert.equal(result.ok, true);
  assert.equal(result.draws.length, 1);
  const rng = Rng.fromState(state.rng);
  assert.equal(rng.next(), result.draws[0]);
  assert.deepEqual(rng.state, result.state.rng);
  assert.deepEqual(apply(state.world, result.changes), result.state.world);
  assert.deepEqual(sharedAct(state, "player", answers, {}, canStep), result);
  const created = result.changes.find((c) => c.kind === "create");
  assert.equal(created?.kind, "create");
  if (created?.kind === "create") assert.deepEqual(created.thing.where, [1, 2]);
});

test("ordered autonomous opportunities are independent and terrain validates before movement", () => {
  const state = fixture();
  const scheduled = sharedTick(state, ["player", "other"], canStep);
  assert.equal(scheduled.state.tick, 1);
  const first = sharedTick(state, ["player"], canStep);
  const second = sharedTick(first.state, ["other"], canStep);
  assert.deepEqual(second.state.world, scheduled.state.world);
  assert.deepEqual(apply(state.world, scheduled.changes), scheduled.state.world);
  assert.deepEqual(scheduled.state.rng, state.rng);
  const blocked = sharedTick(state, ["player"], () => false);
  assert.deepEqual(blocked.state.world, state.world);
  assert.equal(sharedTick(state, ["player", "player"], canStep).state, state);
});

test("bad coordinates, dead and missing actors, and caller-driven time are rejected", () => {
  const state = fixture();
  for (const to of [
    [NaN, 2],
    [1.5, 2],
    [-1, 2],
    [7, 7],
  ] as const)
    assert.equal(sharedMove(state, "player", to, canStep).state, state);
  assert.equal(sharedMove(state, "missing", [2, 2], canStep).state, state);
  required(state.world.bodies.player).health = 0;
  assert.equal(sharedMove(state, "player", [2, 2], canStep).state, state);
  assert.equal(
    sharedAct(state, "other", { process: "X7", patient: "none", instrument: "none" }, {}, canStep)
      .state,
    state,
  );
});

test("force, heat, soak and ingest retain existing compilers and log replay", () => {
  for (const [process, instrument, operands] of [
    ["X2", "bare hands", { target: "reed" }],
    ["X3", "tool", { target: "reed", tool: "oil" }],
    ["X4", "tool", { target: "reed", tool: "water" }],
    ["X6", "none", { target: "food" }],
  ] as const) {
    const initial = fixture();
    required(initial.world.bodies.player).where = [3, 2];
    required(initial.world.things["player.hands"]).where = [3, 2];
    put(initial.world, "water", "water");
    required(initial.world.things.water).where = [3, 2];
    required(initial.world.things.oil).state.temperature = 5;
    const state = createSharedState(initial.world, 42);
    const answers = {
      process,
      patient: "target",
      instrument,
    };
    const result = sharedAct(state, "player", answers, operands, canStep);
    assert.equal(result.ok, true, `${process}: ${result.reason}`);
    assert.deepEqual(apply(state.world, result.changes), result.state.world);
    assert.deepEqual(result.state.rng, state.rng);
  }
});

test("body attacks and actor hands cannot bypass visibility or possession", () => {
  const state = fixture();
  const answers = {
    process: "X2",
    patient: "other",
    instrument: "bare hands",
    duration: "until it is done",
  };
  assert.equal(sharedAct(state, "player", answers, {}, canStep).state, state);
  required(state.world.bodies.other).where = [2, 2];
  required(state.world.things["player.hands"]).element = "metal";
  required(state.world.things["player.hands"]).state.edge = 4;
  const visible = createSharedState(state.world, 1);
  const accepted = sharedAct(visible, "player", answers, {}, canStep);
  assert.equal(accepted.ok, true, accepted.reason);
  assert.deepEqual(apply(visible.world, accepted.changes), accepted.state.world);
  required(visible.world.bodies.player).holds = [];
  assert.equal(sharedAct(visible, "player", answers, {}, canStep).state, visible);
});

test("hidden food never supplies an autonomous movement target", () => {
  const state = fixture();
  required(state.world.bodies.player).aware = {};
  const result = sharedTick(state, ["player"], canStep);
  assert.deepEqual(result.state.world, state.world);
  assert.deepEqual(result.changes, []);
});
