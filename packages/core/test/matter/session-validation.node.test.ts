import assert from "node:assert/strict";
import test from "node:test";
import { apply } from "../../src/matter/apply.ts";
import {
  createMatterSession,
  restoreMatterSession,
  serializeMatterSession,
  stepMatterSession,
} from "../../src/matter/session.ts";
import { FRESH } from "../../src/matter/types.ts";
import { clearing } from "./held-out-fixture.ts";

function fixture() {
  const world = clearing();
  world.bodies = {
    actor: {
      id: "actor",
      place: "clearing",
      where: [1, 1],
      element: "creature",
      health: 5,
      needs: { hunger: 5 },
      sickness: 0,
      sickensIn: 0,
      wounds: [],
    },
    other: {
      id: "other",
      place: "clearing",
      where: [3, 1],
      health: 5,
      needs: { hunger: 5 },
      sickness: 0,
      sickensIn: 0,
      wounds: [],
    },
  };
  world.elements.creature = {
    id: "creature",
    name: "creature",
    kind: "creature",
    forms: [],
    props: {},
    body: { strength: 2, speed: 2, sight: 2, hearing: 2, smell: 2 },
  };
  world.things = {
    food: {
      id: "food",
      element: "food",
      place: "clearing",
      where: [2, 1],
      state: { ...FRESH, amount: 3 },
    },
  };
  return createMatterSession({
    world,
    terrain: { place: "clearing", width: 5, height: 5, walkable: Array(25).fill(true) },
    controlled: ["actor"],
    autonomous: ["other"],
  });
}

/** Mutate through unknown fields to exercise the actual JSON trust boundary. */
function malformed(path: string[], value: unknown): string {
  const snapshot: unknown = JSON.parse(serializeMatterSession(fixture()));
  let target = snapshot as Record<string, unknown>;
  for (const key of path.slice(0, -1)) target = target[key] as Record<string, unknown>;
  const key = path.at(-1);
  assert.ok(key);
  target[key] = value;
  return JSON.stringify(snapshot);
}

test("admission rejects malformed body arithmetic, capability, diet and sensing state", () => {
  const cases: [string[], unknown][] = [
    [["world", "bodies", "actor", "wounds"], [{ depth: "bad", bleeding: 0 }]],
    [["world", "bodies", "actor", "wounds"], [{ depth: 1, bleeding: null, burned: 0 }]],
    [["world", "bodies", "actor", "wounds"], null],
    [["world", "bodies", "actor", "health"], 6],
    [["world", "bodies", "actor", "sickness"], -1],
    [["world", "bodies", "actor", "sickensIn"], "soon"],
    [["world", "bodies", "actor", "needs"], { hunger: null }],
    [["world", "bodies", "actor", "attention"], "awake"],
    [["world", "bodies", "actor", "rank"], "high"],
    [["world", "bodies", "actor", "tolerates"], "all"],
    [["world", "bodies", "actor", "feels"], { other: { fear: "bad", anger: 0, trust: 0 } }],
    [["world", "elements", "creature", "body", "speed"], "fast"],
    [["world", "elements", "creature", "body", "sight"], null],
    [["world", "elements", "creature", "body", "eats"], { fruit: "yes" }],
    [["world", "elements", "food", "serves"], { hunger: "all" }],
    [["world", "elements", "food", "props"], { noxiousness: "bad" }],
    [["world", "things", "food", "state", "contamination"], "bad"],
    [["world", "things", "food", "state", "burning"], { of: "self", fuel: null }],
    [
      ["world", "things", "food", "state", "coating"],
      { element: "food", amount: 1, coverage: "all", bond: 0 },
    ],
    [["world", "places", "clearing", "light"], "bright"],
    [["world", "bonds"], [{ from: "actor", to: "other", kind: "kin", weight: "dear" }]],
    [["terrain", "walkable"], "yes"],
    [["controlled"], "actor"],
  ];
  for (const [path, value] of cases)
    assert.throws(() => restoreMatterSession(malformed(path, value)), path.join("."));
});

test("creation and serialization reject nonfinite runtime state too", () => {
  const session = fixture();
  const body = session.world.bodies.actor;
  assert.ok(body);
  for (const value of [NaN, Infinity, -Infinity]) {
    body.wounds = [{ depth: value, bleeding: 0, burned: 0 }];
    assert.throws(() => createMatterSession(session));
    assert.throws(() => serializeMatterSession(session));
  }
});

test("valid wounded actors move to finite tiles and remain saveable", () => {
  const session = fixture();
  const actor = session.world.bodies.actor;
  assert.ok(actor);
  actor.wounds = [{ depth: 2, bleeding: 1, burned: 0.5 }];
  actor.sickness = 1;
  const restored = restoreMatterSession(serializeMatterSession(session));
  const result = stepMatterSession(restored, {
    actor: "actor",
    tick: restored.tick,
    action: { kind: "move", to: [1, 2] },
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.session.world.bodies.actor?.where, [1, 2]);
  assert.deepEqual(restoreMatterSession(serializeMatterSession(result.session)), result.session);
});

test("duplicate possession and invalid references are rejected before continuation", () => {
  const session = fixture();
  const actor = session.world.bodies.actor;
  const other = session.world.bodies.other;
  const food = session.world.things.food;
  assert.ok(actor && other && food);
  assert.ok(actor.where);
  food.where = actor.where;
  actor.holds = ["food", "food"];
  assert.throws(() => restoreMatterSession(JSON.stringify(session)), /possession/);
  actor.holds = ["food"];
  other.where = actor.where;
  other.holds = ["food"];
  assert.throws(() => restoreMatterSession(JSON.stringify(session)), /possession/);
  for (const path of [
    ["world", "bodies", "actor", "element"],
    ["world", "things", "food", "element"],
    ["world", "things", "food", "state", "wetWith"],
  ])
    assert.throws(() => restoreMatterSession(malformed(path, "missing")));
});

test("blocked scenery is admitted but blocked actors are not", () => {
  const session = fixture();
  const walkable = [...session.terrain.walkable];
  walkable[7] = false;
  session.terrain.walkable = walkable;
  assert.doesNotThrow(() => restoreMatterSession(JSON.stringify(session)));
  walkable[6] = false;
  assert.throws(() => restoreMatterSession(JSON.stringify(session)), /body tile/);
});

test("restore derives awareness rather than accepting forged current sensory evidence", () => {
  const session = fixture();
  const place = session.world.places.clearing;
  const actor = session.world.bodies.actor;
  assert.ok(place && actor);
  place.light = 0;
  actor.aware = { food: { channel: "sight", strength: 5 } };
  const restored = restoreMatterSession(JSON.stringify(session));
  assert.equal(restored.world.bodies.actor?.aware?.food, undefined);
  assert.equal(
    stepMatterSession(restored, {
      actor: "actor",
      tick: 0,
      action: { kind: "eat", thing: "food" },
    }).ok,
    false,
  );
});

test("percept deltas replay the committed world and snapshots continue identically", () => {
  let session = fixture();
  for (const action of [
    { kind: "take", thing: "food" },
    { kind: "move", to: [1, 2] },
    { kind: "eat", thing: "food" },
    { kind: "drop", thing: "food" },
    { kind: "wait" },
  ] as const) {
    const command = { actor: "actor", tick: session.tick, action };
    const result = stepMatterSession(session, command);
    assert.equal(result.ok, true);
    assert.deepEqual(apply(session.world, result.changes), result.session.world);
    const resumed = restoreMatterSession(serializeMatterSession(session));
    assert.deepEqual(stepMatterSession(resumed, command), result);
    session = result.session;
  }
});
