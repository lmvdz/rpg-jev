import assert from "node:assert/strict";
import test from "node:test";
import { ingest } from "../../src/matter/body.ts";
import {
  createMatterSession,
  FRESH,
  type MatterAction,
  type MatterSession,
  type MatterSessionInput,
  restoreMatterSession,
  serializeMatterSession,
  stepMatterSession,
} from "../../src/matter/index.ts";
import { clearing } from "./held-out-fixture.ts";

function fixture(): MatterSessionInput {
  const world = clearing();
  const place = world.places.clearing;
  if (place) place.light = 5;
  world.bodies = {
    a: {
      id: "a",
      place: "clearing",
      where: [1, 2],
      health: 5,
      needs: { hunger: 5 },
      sickness: 0,
      sickensIn: 0,
      wounds: [],
    },
    b: {
      id: "b",
      place: "clearing",
      where: [5, 2],
      health: 5,
      needs: { hunger: 5 },
      sickness: 0,
      sickensIn: 0,
      wounds: [],
    },
  };
  world.things = {
    f: {
      id: "f",
      place: "clearing",
      element: "food",
      where: [2, 2],
      state: { ...FRESH, amount: 3 },
    },
  };
  return {
    world,
    controlled: ["a"],
    autonomous: ["b"],
    terrain: { place: "clearing", width: 8, height: 6, walkable: Array(48).fill(true) },
  };
}

function step(session: MatterSession, action: MatterAction): MatterSession {
  const result = stepMatterSession(session, {
    actor: session.controlled[0] ?? "",
    tick: session.tick,
    action,
  });
  assert.equal(result.ok, true, result.reason);
  return result.session;
}

test("finite portions, possession, movement, drop, consumption and snapshot continuation", () => {
  const input = fixture();
  input.autonomous = [];
  let session = createMatterSession(input);
  session = step(session, { kind: "take", thing: "f" });
  assert.deepEqual(session.world.things.f?.where, [1, 2]);
  session = step(session, { kind: "move", to: [1, 3] });
  assert.deepEqual(session.world.things.f?.where, [1, 3]);
  const restored = restoreMatterSession(serializeMatterSession(session));
  assert.deepEqual(restored, session);
  assert.deepEqual(
    step(restored, { kind: "eat", thing: "f" }),
    step(session, { kind: "eat", thing: "f" }),
  );
  session = step(session, { kind: "drop", thing: "f" });
  assert.deepEqual(session.world.bodies.a?.holds, []);
  for (let i = 0; i < 3; i++) session = step(session, { kind: "eat", thing: "f" });
  assert.equal(session.world.things.f, undefined);
  assert.equal(session.world.bodies.a?.needs.hunger, 0);
  assert.equal(input.world.things.f?.state.amount, 3);
});

test("each successful action grants one autonomous step, never remote consumption", () => {
  let session = createMatterSession(fixture());
  session = step(session, { kind: "wait" });
  assert.deepEqual(session.world.bodies.b?.where, [4, 2]);
  assert.equal(session.world.things.f?.state.amount, 3);
  session = step(session, { kind: "wait" });
  assert.deepEqual(session.world.bodies.b?.where, [3, 2]);
  session = step(session, { kind: "eat", thing: "f" });
  assert.equal(session.world.things.f?.state.amount, 1);
  assert.equal(session.world.bodies.a?.needs.hunger, 3);
  assert.equal(session.world.bodies.b?.needs.hunger, 3);
  session = step(session, { kind: "eat", thing: "f" });
  assert.equal(session.world.things.f, undefined);
  assert.equal(session.world.bodies.b?.needs.hunger, 3);
});

test("held food is exclusive; depletion clears possession", () => {
  const input = fixture();
  const b = input.world.bodies.b;
  if (b) b.where = [3, 2];
  let session = createMatterSession(input);
  session = step(session, { kind: "take", thing: "f" });
  for (let i = 0; i < 3; i++) session = step(session, { kind: "eat", thing: "f" });
  assert.equal(session.world.bodies.b?.needs.hunger, 5);
  assert.deepEqual(session.world.bodies.a?.holds, []);
});

test("stale, unauthorized, remote, nonfinite and blocked commands grant no time or creature work", () => {
  const input = fixture();
  input.terrain.walkable = input.terrain.walkable.map((cell, i) => (i === 9 ? false : cell));
  const session = createMatterSession(input);
  const commands = [
    { actor: "a", tick: -1, action: { kind: "wait" } },
    { actor: "b", tick: 0, action: { kind: "wait" } },
    { actor: "a", tick: 0, action: { kind: "move", to: [1, 1] } },
    { actor: "a", tick: 0, action: { kind: "move", to: [NaN, 2] } },
    { actor: "a", tick: 0, action: { kind: "move", to: [5, 2] } },
    { actor: "a", tick: 0, action: { kind: "eat", thing: "absent" } },
  ] as const;
  for (const command of commands) {
    const result = stepMatterSession(session, command);
    assert.equal(result.ok, false);
    assert.equal(result.session, session);
  }
  const next = step(session, { kind: "wait" });
  assert.equal(
    stepMatterSession(next, { actor: "a", tick: 0, action: { kind: "wait" } }).reason,
    "stale",
  );
  assert.equal(
    ingest(session.world, { process: "ingest", body: "b", thing: "f" })[0]?.kind,
    "nothing",
  );
  for (const amount of [NaN, Infinity, -1, 0])
    assert.equal(
      ingest(session.world, { process: "ingest", body: "a", thing: "f", amount })[0]?.kind,
      "nothing",
    );
});

test("satiated and unsuitable eaters do not consume; hidden sources confer no knowledge", () => {
  for (const mode of ["satiated", "unsuitable", "hidden"]) {
    const input = fixture();
    const b = input.world.bodies.b;
    const food = input.world.elements.food;
    if (!(b && food)) throw new Error("fixture");
    b.where = [3, 2];
    if (mode === "satiated") b.needs.hunger = 0;
    if (mode === "unsuitable") food.serves = { warmth: 1 };
    if (mode === "hidden") {
      const place = input.world.places.clearing;
      if (place) place.light = 0;
    }
    let session = createMatterSession(input);
    for (let i = 0; i < 6; i++) session = step(session, { kind: "wait" });
    assert.equal(session.world.things.f?.state.amount, 3, mode);
    assert.deepEqual(session.world.bodies.b?.where, [3, 2], mode);
  }
});

test("blocked routes do not consume or teleport; alternate layouts use terrain paths", () => {
  const input = fixture();
  input.terrain.walkable = input.terrain.walkable.map((cell, i) => (i % 8 === 4 ? false : cell));
  let session = createMatterSession(input);
  for (let i = 0; i < 8; i++) session = step(session, { kind: "wait" });
  assert.deepEqual(session.world.bodies.b?.where, [5, 2]);
  assert.equal(session.world.things.f?.state.amount, 3);
  input.terrain.walkable = input.terrain.walkable.map((cell, i) => (i === 4 ? true : cell));
  session = createMatterSession(input);
  for (let i = 0; i < 12; i++) session = step(session, { kind: "wait" });
  assert.equal(session.world.things.f, undefined);
  assert.equal(session.world.bodies.b?.needs.hunger, 0);
});

test("renames preserve outcomes and persisted order; invalid snapshots reject", () => {
  const input = fixture();
  const b = input.world.bodies.b;
  if (!b) throw new Error("fixture");
  delete input.world.bodies.b;
  input.world.bodies.unfamiliar = { ...b, id: "unfamiliar" };
  input.autonomous = ["unfamiliar"];
  let renamed = createMatterSession(input);
  let original = createMatterSession(fixture());
  for (let i = 0; i < 6; i++) {
    renamed = step(renamed, { kind: "wait" });
    original = step(original, { kind: "wait" });
  }
  assert.deepEqual(renamed.world.bodies.unfamiliar?.needs, original.world.bodies.b?.needs);
  assert.deepEqual(renamed.world.things, original.world.things);
  const malformed = JSON.parse(serializeMatterSession(original));
  malformed.tick = -1;
  assert.throws(() => restoreMatterSession(JSON.stringify(malformed)));
  assert.throws(() => restoreMatterSession("{}"));
  const fractional = fixture();
  const food = fractional.world.things.f;
  if (food) food.state.amount = 0.5;
  assert.throws(() => createMatterSession(fractional));
});

test("unreachable food does not suppress another noticed reachable source", () => {
  const input = fixture();
  input.terrain.walkable = input.terrain.walkable.map((cell, i) => (i % 8 === 4 ? false : cell));
  input.world.things.other = {
    id: "other",
    place: "clearing",
    element: "food",
    where: [7, 2],
    state: { ...FRESH, amount: 1 },
  };
  let session = createMatterSession(input);
  session = step(session, { kind: "wait" });
  session = step(session, { kind: "wait" });
  assert.equal(session.world.things.other, undefined);
  assert.equal(session.world.things.f?.state.amount, 3);
  assert.equal(session.world.bodies.b?.needs.hunger, 3);
});
