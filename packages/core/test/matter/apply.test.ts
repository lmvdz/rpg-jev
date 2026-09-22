import { describe, expect, it } from "vitest";
import { apply } from "../../src/matter/apply.ts";
import { type Change, FRESH, type MatterWorld, type Thing } from "../../src/matter/types.ts";
import { referenceApply } from "./apply-reference.ts";

type Input = {
  [K in Change["kind"]]: Omit<Extract<Change, { kind: K }>, "because" | "note">;
}[Change["kind"]];
const change = (input: Input): Change => ({ ...input, because: [], note: "" });
const thing = (id: string): Thing => ({
  id,
  element: "food",
  place: "room",
  state: { ...FRESH, amount: 3 },
});

function fixture(): MatterWorld {
  return {
    elements: {},
    things: { food: thing("food"), untouched: thing("untouched") },
    bodies: {
      actor: {
        id: "actor",
        place: "room",
        needs: { hunger: 2 },
        health: 5,
        wounds: [{ depth: 2, bleeding: 1, burned: 0 }],
        sickness: 0,
        sickensIn: 0,
        holds: ["food", "untouched", "food"],
      },
      observer: {
        id: "observer",
        place: "room",
        needs: {},
        health: 5,
        wounds: [],
        sickness: 0,
        sickensIn: 0,
      },
    },
    places: {
      room: {
        id: "room",
        temperature: 2,
        moisture: 2,
        wind: 0,
        air: 5,
        abundance: {},
        searched: { food: { minutes: 2, found: 1 } },
      },
    },
    next: 7,
  };
}

function freeze(value: unknown): void {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return;
  for (const nested of Object.values(value)) freeze(nested);
  Object.freeze(value);
}

/** Check every prefix, not only a final state that could hide ordering errors. */
function equivalent(world: MatterWorld, changes: Change[]): MatterWorld {
  const before = structuredClone(world);
  freeze(world);
  freeze(changes);
  for (let length = 0; length <= changes.length; length++) {
    const prefix = changes.slice(0, length);
    const expected = referenceApply(world, prefix);
    const actual = apply(world, prefix);
    expect(actual).toStrictEqual(expected);
    expect(actual === world).toBe(expected === world);
    for (const table of ["things", "bodies", "places", "elements"] as const) {
      expect(Object.keys(actual[table])).toEqual(Object.keys(expected[table]));
      expect(actual[table] === world[table]).toBe(expected[table] === world[table]);
      for (const id of Object.keys(world[table])) {
        expect(actual[table][id] === world[table][id]).toBe(
          expected[table][id] === world[table][id],
        );
      }
    }
  }
  expect(world).toStrictEqual(before);
  return apply(world, changes);
}

const ordered: Input[] = [
  {
    kind: "state",
    thing: "food",
    set: { temperature: 4, coating: { element: "oil", amount: 1, coverage: 1, bond: 0 } },
  },
  { kind: "state", thing: "food", set: { wetness: 2 } },
  { kind: "body", body: "actor", set: { health: 4, needs: { hunger: 1 } } },
  { kind: "body", body: "actor", set: { sickness: 2 } },
  { kind: "wound", body: "actor", wound: { depth: 3, bleeding: 2, burned: 0 } },
  { kind: "treat", body: "actor", index: 1, set: { bleeding: 0 } },
  { kind: "treat", body: "actor", index: 99, set: { depth: 0 } },
  { kind: "percept", body: "actor", aware: { food: { channel: "scent", strength: 3 } } },
  { kind: "percept", body: "actor", aware: {} },
  { kind: "settle", place: "room", element: "food", minutes: 3, found: 2 },
  { kind: "settle", place: "room", element: "food", minutes: 4, found: 1 },
  { kind: "settle", place: "room", element: "new", minutes: 1, found: 0 },
  { kind: "create", thing: thing("food") },
  { kind: "state", thing: "food.7", set: { amount: 2 } },
  { kind: "carried", thing: "food.7", where: [1, 2] },
  { kind: "body", body: "observer", set: { holds: ["food", "food.7"] } },
  { kind: "consume", thing: "food", amount: 1 },
  { kind: "consume", thing: "food", amount: 2 },
  { kind: "state", thing: "food", set: { amount: 10 } },
  { kind: "create", thing: thing("food") },
  { kind: "create", thing: thing("food") },
  { kind: "consume", thing: "food.7", amount: 10 },
  { kind: "consume", thing: "food.7", amount: 1 },
  { kind: "signal", place: "room", channel: "sound", strength: 3 },
  { kind: "nothing" },
];

describe("matter apply copy-on-write equivalence", () => {
  it("preserves all change kinds, dependent ordering, payloads and untouched records", () => {
    const result = equivalent(fixture(), ordered.map(change));
    expect(result.bodies.actor?.holds).toEqual(["untouched"]);
    expect(result.bodies.observer?.holds).toEqual([]);
    expect(result.things["food.9"]?.id).toBe("food.9");
    expect(result.next).toBe(10);
  });

  it("keeps no-op invocations identical, including missing targets and invalid consumption", () => {
    const inputs: Input[] = [
      { kind: "state", thing: "missing", set: {} },
      { kind: "body", body: "missing", set: {} },
      { kind: "wound", body: "missing", wound: { depth: 1, bleeding: 1, burned: 0 } },
      { kind: "treat", body: "missing", index: 0, set: {} },
      { kind: "percept", body: "missing", aware: {} },
      { kind: "carried", thing: "missing", where: [0, 0] },
      { kind: "settle", place: "missing", element: "food", minutes: 1, found: 1 },
      { kind: "consume", thing: "missing", amount: 1 },
      ...[0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY].map(
        (amount): Input => ({ kind: "consume", thing: "food", amount }),
      ),
      { kind: "signal", place: "room", channel: "sound", strength: 1 },
      { kind: "nothing" },
    ];
    const world = fixture();
    expect(equivalent(world, inputs.map(change))).toBe(world);
  });

  it("matches deterministic reordered batches and remains safe across invocations", () => {
    for (let offset = 0; offset < ordered.length; offset++) {
      const inputs = [...ordered.slice(offset), ...ordered.slice(0, offset)];
      const next = equivalent(fixture(), inputs.map(change));
      equivalent(next, inputs.toReversed().map(change));
    }
  });

  it("retains deletion/reinsertion order, collision behavior and special own-property ids", () => {
    const world = fixture();
    world.things = {
      ...world.things,
      ["__proto__"]: thing("__proto__"),
      "food.7": thing("food.7"),
    };
    equivalent(world, [
      change({ kind: "state", thing: "__proto__", set: { wetness: 1 } }),
      change({ kind: "create", thing: thing("food") }),
      change({ kind: "consume", thing: "__proto__", amount: 3 }),
      change({ kind: "consume", thing: "food", amount: 3 }),
      change({ kind: "create", thing: thing("food") }),
      change({ kind: "create", thing: thing("__proto__") }),
    ]);
  });

  it("copies each table only once even for repeated updates", () => {
    const world = fixture();
    const reads = { things: 0, bodies: 0, places: 0 };
    for (const table of ["things", "bodies", "places"] as const) {
      const source = world[table];
      Object.defineProperty(world, table, {
        value: new Proxy(source, {
          ownKeys(target) {
            reads[table]++;
            return Reflect.ownKeys(target);
          },
        }),
      });
    }
    apply(world, [...ordered, ...ordered, ...ordered].map(change));
    expect(reads).toEqual({ things: 1, bodies: 1, places: 1 });
  });
});
