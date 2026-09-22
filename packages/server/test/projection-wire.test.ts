import { describe, expect, it } from "vitest";
import { sharedThings } from "../../client/src/play/shared-types.ts";
import { decodeSharedView, encodeSharedView } from "../../client/src/play/shared-wire.ts";
import { project, shouldPublishTick } from "../module/src/projection.ts";
import { admitActor, initialWorld } from "../module/src/world.ts";

const state = admitActor(admitActor(initialWorld(), "player-1").state, "player-2").state;
const view = {
  ...project(state, "player-1", 10, 3),
  generation: "generation",
  pauseReason: "archive-backlog",
};

describe("lossless bounded public snapshot wire", () => {
  it("preserves presentation, knowledge, receipt identity, and heartbeat comparison", () => {
    const decoded = decodeSharedView(encodeSharedView(view));
    expect(decoded).toEqual(view);
    expect(sharedThings(decoded)).toEqual(sharedThings(view));
    expect(
      shouldPublishTick(
        encodeSharedView(decoded),
        encodeSharedView({ ...view, tick: view.tick + 1 }),
      ),
    ).toBe(false);
    expect(
      shouldPublishTick(
        encodeSharedView(decoded),
        encodeSharedView({ ...view, sequence: view.sequence + 1 }),
      ),
    ).toBe(true);
    expect(decodeSharedView(JSON.stringify(view))).toEqual(view);
  });

  it("retains noncanonical awareness and arbitrary instance-specific presentation", () => {
    const first = view.things[0];
    if (!first) throw new Error("missing fixture thing");
    const changed = {
      ...view,
      aware: [],
      things: [
        first,
        { ...first, id: "different", name: "untrusted <text>", states: { burning: 3 } },
      ],
    };
    expect(decodeSharedView(encodeSharedView(changed))).toEqual(changed);
  });

  it("is self-contained, does not mutate source, and allows empty snapshots", () => {
    const original = JSON.stringify(view);
    const wire = encodeSharedView(view);
    decodeSharedView(encodeSharedView({ ...view, things: [], aware: [] }));
    expect(decodeSharedView(wire)).toEqual(view);
    expect(JSON.stringify(view)).toBe(original);
    const empty = { ...view, things: [], aware: [] };
    expect(decodeSharedView(encodeSharedView(empty))).toEqual(empty);
  });

  it("does not alias nested presentations between instances", () => {
    const source = {
      id: "one",
      element: "stone",
      name: "stone",
      x: 1,
      z: 2,
      states: { burning: 1 },
      forms: ["round"],
      baseline: { mass: 2 },
      look: { glyph: 1, ink: 2 },
    };
    const sample = { ...view, things: [source, { ...source, id: "two" }], aware: [] };
    const decoded = decodeSharedView(encodeSharedView(sample));
    const first = decoded.things[0];
    const second = decoded.things[1];
    if (!(first && second)) throw new Error("missing instance");
    first.states.burning = 4;
    if (first.look) first.look.ink = 4;
    expect(second).toEqual(sample.things[1]);
    expect(first.forms).not.toBe(second.forms);
    expect(first.baseline).not.toBe(second.baseline);
  });

  it("preflights expansion bombs before any per-instance clones", () => {
    const wire = JSON.parse(encodeSharedView(view));
    const bomb = {
      ...wire,
      presentations: [
        {
          name: "large",
          element: "stone",
          states: {},
          publicExtension: "x".repeat(1024 * 1024),
        },
      ],
      instances: Array.from({ length: 16384 }, (_, i) => [`thing-${i}`, 1, 2, 0]),
    };
    const json = JSON.stringify(bomb);
    expect(json.length).toBeLessThan(8 * 1024 * 1024);
    expect(() => decodeSharedView(json)).toThrow("expanded JSON bound");
  });

  it.each([
    { presentations: [{}] },
    { presentations: [{ name: "stone", element: "stone", states: null }] },
    { instances: [["one", null, 2, 0]] },
    { instances: Array(16385).fill(["one", 1, 2, 0]) },
    { aware: [{}] },
    { body: {} },
    { elements: { stone: { name: "stone", forms: null } } },
  ])("rejects malformed compact surfaces %#", (change) => {
    const wire = JSON.parse(encodeSharedView(view));
    expect(() => decodeSharedView(JSON.stringify({ ...wire, ...change }))).toThrow("snapshot");
  });

  it.each([
    [],
    {},
    { ...view, things: Array(16385).fill(view.things[0]) },
    { ...view, things: [{}] },
    { ...view, things: [{ ...view.things[0], states: null }] },
    { ...view, things: [{ ...view.things[0], forms: [1] }] },
    { ...view, things: [{ ...view.things[0], look: {} }] },
    { ...view, things: [{ ...view.things[0], x: null }] },
    { ...view, body: { meters: [null], counts: [] } },
    { ...view, elements: { stone: null } },
    { ...view, aware: [null] },
    { ...view, position: [1] },
    { ...view, compiled: null },
    { ...view, sequence: -1 },
  ])("rejects malformed legacy surfaces %#", (sample) => {
    expect(() => decodeSharedView(JSON.stringify(sample))).toThrow("snapshot");
  });

  it("rejects unsupported, oversized and invalid dictionary references without partial views", () => {
    const wire = JSON.parse(encodeSharedView(view));
    expect(() => decodeSharedView(JSON.stringify({ ...wire, wire: 2 }))).toThrow("version");
    expect(() => decodeSharedView(" ".repeat(8 * 1024 * 1024 + 1))).toThrow("bound");
    expect(() => decodeSharedView("null")).toThrow("snapshot");
    expect(() =>
      decodeSharedView(JSON.stringify({ ...wire, instances: [["missing", 1, 2, 99999]] })),
    ).toThrow("presentation");
    expect(() =>
      decodeSharedView(JSON.stringify({ ...wire, instances: [["missing", 1, 2, -1]] })),
    ).toThrow("instance");
    const first = view.things[0];
    if (!first) throw new Error("missing fixture thing");
    expect(() => encodeSharedView({ ...view, things: Array(16385).fill(first) })).toThrow("bound");
  });
});
