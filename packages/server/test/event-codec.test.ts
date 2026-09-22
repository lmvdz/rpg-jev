import { performance } from "node:perf_hooks";
import { matter } from "@rpg-jev/core";
import { describe, expect, it } from "vitest";
import {
  decodeEvent,
  EVENT_CODEC_LIMITS,
  EVENT_CODEC_MARKER,
  encodeEvent,
} from "../module/src/event-codec.ts";
import { admitActor, initialWorld } from "../module/src/world.ts";

function payload(step: matter.SharedStep, revision = 1): string {
  return JSON.stringify({
    version: 1,
    revision,
    kind: "tick",
    command: "",
    changes: step.changes,
    draws: step.draws,
    rng: step.state.rng,
    tick: step.state.tick,
  });
}

const envelope = (nodes: unknown[], root = nodes.length - 1, version = 1) =>
  JSON.stringify([EVENT_CODEC_MARKER, version, nodes, root]);

describe("lossless event dictionary", () => {
  it("preserves every Change shape, metadata, ordering and exact JSON", () => {
    const state = initialWorld();
    const meta = {
      because: ["cause-2", "cause-1"],
      note: 'snow ☃ " \\ \u0000',
      quiet: true as const,
    };
    const changes: matter.Change[] = [
      {
        kind: "state",
        thing: "x",
        set: { ...matter.FRESH, temperature: 2.0000000000000004 },
        ...meta,
      },
      { kind: "body", body: "player-1", set: { needs: { hunger: 1.2345678901234567 } }, ...meta },
      { kind: "wound", body: "player-1", wound: { depth: 1, bleeding: 2, burned: 0 }, ...meta },
      { kind: "treat", body: "player-1", index: 0, set: { bleeding: 0 }, ...meta },
      {
        kind: "create",
        thing: { id: "x", element: "hand", place: "clearing", state: { ...matter.FRESH } },
        ...meta,
      },
      { kind: "consume", thing: "x", amount: 0.000001, ...meta },
      { kind: "carried", thing: "x", where: [2, 3], ...meta },
      { kind: "signal", place: "clearing", channel: "sound", strength: 4, source: "x", ...meta },
      { kind: "percept", body: "player-1", aware: {}, ...meta },
      { kind: "settle", place: "clearing", element: "hand", minutes: 0.5, found: 1, ...meta },
      { kind: "nothing", because: [], note: "" },
    ];
    const original = payload(
      { state, changes, draws: [0.123456789], ok: true, reason: "test" },
      9123,
    );
    expect(decodeEvent(encodeEvent(original))).toBe(original);
    const restored = JSON.parse(decodeEvent(encodeEvent(original))) as {
      changes: matter.Change[];
    };
    expect(matter.apply(state.world, restored.changes)).toEqual(matter.apply(state.world, changes));
    for (const text of [
      '{ "version": 1, "n": -0, "n": 1e-300 }',
      '{"__proto__":{"polluted":true},"constructor":{},"prototype":{}}',
      JSON.stringify({
        values: [null, true, false, "", "\ud800", "😀", Number.MIN_VALUE, Number.MAX_VALUE],
      }),
    ])
      expect(decodeEvent(encodeEvent(text))).toBe(text);
    expect(Object.hasOwn(Object.prototype, "polluted")).toBe(false);
  });

  it("replays mixed legacy/compact events to identical world, RNG and tick", () => {
    let state = initialWorld();
    let restored = JSON.parse(
      decodeEvent(encodeEvent(JSON.stringify(state))),
    ) as matter.SharedState;
    const steps = [admitActor(state, "player-1")];
    state = steps[0]?.state ?? state;
    for (let i = 0; i < 4; i++) {
      const step = matter.sharedTick(state, [], () => true, 1 / 120);
      steps.push(step);
      state = step.state;
    }
    for (const [index, step] of steps.entries()) {
      const original = payload(step, index + 1);
      const decoded = decodeEvent(index % 2 ? original : encodeEvent(original));
      expect(decoded).toBe(original);
      const event = JSON.parse(decoded) as {
        changes: matter.Change[];
        rng: matter.SharedState["rng"];
        tick: number;
        revision: number;
      };
      expect(event.revision).toBe(index + 1);
      restored = {
        ...restored,
        world: matter.apply(restored.world, event.changes),
        rng: event.rng,
        tick: event.tick,
      };
      expect(restored).toEqual(step.state);
    }
  });

  it("rejects malformed envelopes, versions and cross-event/cyclic dependencies", () => {
    for (const text of [
      "",
      "null",
      "1",
      "[]",
      '{"n":1e999}',
      envelope([], -1),
      envelope([{}]),
      envelope([null], 0, 2),
      envelope([[0, 0]]),
      envelope([[0, 1], null]),
      envelope([[0, -1]]),
      envelope([[0, 0.5]]),
      envelope([[0, "external"]]),
      envelope([[2]]),
      envelope(["key", [1, 0]]),
      envelope([1, [1, 0, 0]]),
      envelope(["key", null, [1, 0, 1, 0, 1]]),
      envelope(["key", null, [1, 0, 1]], 0),
      JSON.stringify([EVENT_CODEC_MARKER, 1, [], 0, "extra"]),
    ])
      expect(() => decodeEvent(text), text).toThrow();
  });

  it("bounds bytes, depth, node count and expanded dependency size", () => {
    expect(() => decodeEvent(`{"x":"${"x".repeat(EVENT_CODEC_LIMITS.bytes)}"}`)).toThrow();
    expect(() => encodeEvent(`{"x":"${"😀".repeat(EVENT_CODEC_LIMITS.bytes / 4)}"}`)).toThrow();
    expect(() => decodeEvent(`{"x":${"[".repeat(65)}0${"]".repeat(65)}}`)).toThrow();
    expect(() => decodeEvent(envelope(Array(EVENT_CODEC_LIMITS.nodes + 1).fill(null)))).toThrow();
    const bomb: unknown[] = ["x"];
    for (let i = 0; i < 25; i++) bomb.push([0, i, i]);
    expect(() => decodeEvent(envelope(bomb))).toThrow();
    const deep: unknown[] = [null];
    for (let i = 0; i < 66; i++) deep.push([0, i]);
    expect(() => decodeEvent(envelope(deep))).toThrow();
  });
});

describe("event dictionary structural bounds", () => {
  it("preserves opaque keys, repeated arrays and nonaliased decoded values", () => {
    const part = JSON.parse('{"__proto__":{"polluted":true},"constructor":{},"prototype":{}}');
    const raw = JSON.stringify({ parts: Array(100).fill(part), scalarArrays: [[], [0], [1, 2]] });
    const encoded = encodeEvent(raw);
    expect(encoded.startsWith(`["${EVENT_CODEC_MARKER}"`)).toBe(true);
    expect(decodeEvent(encoded)).toBe(raw);
    const restored = JSON.parse(decodeEvent(encoded));
    expect(restored.parts[0]).not.toBe(restored.parts[1]);
    expect(Object.hasOwn(Object.prototype, "polluted")).toBe(false);
  });

  it("bounds cumulative expansion, not only root size", () => {
    // Many unused references to one 1-MiB leaf would otherwise materialize >64 MiB.
    const nodes: unknown[] = ["x".repeat(1024 * 1024)];
    for (let i = 0; i < 65; i++) nodes.push([0, 0]);
    nodes.push([1]);
    expect(() => decodeEvent(envelope(nodes))).toThrow();
    let raw = `{"value":"${"x".repeat(1024 * 1024)}"}`;
    for (let i = 0; i < 63; i++) raw = `{"next":${raw}}`;
    expect(() => encodeEvent(raw)).toThrow();
  });

  it("preserves deterministic varied JSON exactly without assuming a change schema", () => {
    for (let i = 0; i < 64; i++) {
      const repeated = {
        text: `text-${i % 4}-😀-\udfff`,
        values: [i / 7, null, true, false, { nested: [i, "state", []] }],
      };
      const raw = JSON.stringify({
        version: 1,
        revision: i,
        tick: i,
        rng: [i, -i, 2147483647, -2147483648],
        metadata: { unknownFutureField: repeated },
        changes: Array(30).fill(repeated),
      });
      expect(decodeEvent(encodeEvent(raw))).toBe(raw);
      expect(decodeEvent(raw)).toBe(raw);
    }
  });
});

describe("event codec predeclared performance evidence", () => {
  it("reports predeclared 1413-thing tick budgets: 16 warmups then 64 samples", () => {
    // Supported measurement environment: Windows, Node 25.8.2. Nearest-rank p95.
    // Same synthetic current-world tick for every sample; simulation is outside timing.
    let state = initialWorld();
    for (let i = 1; i <= 8; i++) state = admitActor(state, `player-${i}`).state;
    expect(Object.keys(state.world.things)).toHaveLength(1413);
    const raw = payload(matter.sharedTick(state, [], () => true, 1 / 120));
    const compact = encodeEvent(raw);
    expect(decodeEvent(compact)).toBe(raw);
    const encodeMs: number[] = [];
    const decodeMs: number[] = [];
    const roundTripMs: number[] = [];
    for (let i = -16; i < 64; i++) {
      const start = performance.now();
      const result = encodeEvent(raw);
      const middle = performance.now();
      decodeEvent(result);
      const end = performance.now();
      if (i >= 0) {
        encodeMs.push(middle - start);
        decodeMs.push(end - middle);
        roundTripMs.push(end - start);
      }
    }
    const p95 = (values: number[]) =>
      values.sort((a, b) => a - b)[Math.ceil(values.length * 0.95) - 1] ?? Infinity;
    const report = {
      platform: process.platform,
      node: process.version,
      originalBytes: Buffer.byteLength(raw),
      encodedBytes: Buffer.byteLength(compact),
      ratio: Buffer.byteLength(compact) / Buffer.byteLength(raw),
      encodeP95Ms: p95(encodeMs),
      decodeP95Ms: p95(decodeMs),
      roundTripP95Ms: p95(roundTripMs),
    };
    console.log("event-codec benchmark", JSON.stringify(report));
    expect(report.ratio).toBeLessThanOrEqual(0.25);
    // Timing is evidence, not a flaky CI gate. Report failures without changing budget.
    console.log(
      "event-codec <=10ms gate",
      report.encodeP95Ms <= 10 && report.decodeP95Ms <= 10 ? "PASS" : "FAIL",
    );
    console.log(
      "event-codec round-trip <=10ms gate",
      report.roundTripP95Ms <= 10 ? "PASS" : "FAIL",
    );
  });
});
