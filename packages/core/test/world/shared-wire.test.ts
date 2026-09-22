import { describe, expect, it } from "vitest";
import type { SharedView } from "../../src/world/shared-view.ts";
import { decodeSharedView, encodeSharedView } from "../../src/world/shared-wire.ts";

const VIEW: SharedView = {
  actor: "player-1",
  revision: 1,
  tick: 0,
  sequence: 0,
  seed: 1,
  position: [3, 4],
  things: [
    { id: "a", element: "stone", name: "loose stone", x: 3, z: 4, states: { amount: 3 } },
    { id: "b", element: "stone", name: "loose stone", x: 5, z: 4, states: { amount: 3 } },
  ],
  elements: { stone: { name: "loose stone" } },
  body: { meters: [], counts: [] },
  aware: [{ source: "a", name: "loose stone", channel: "sight", strength: 1 }],
  compiled: [],
  sought: [],
};

describe("the shared view wire codec", () => {
  it("round-trips a view losslessly", () => {
    const decoded = decodeSharedView(encodeSharedView(VIEW));
    expect(decoded).toEqual(VIEW);
  });

  it("shares one presentation between identical instances", () => {
    const json = encodeSharedView(VIEW);
    const wire: { presentations: unknown[] } = JSON.parse(json);
    expect(wire.presentations.length).toBe(1);
  });

  it("rejects a snapshot with too many things", () => {
    const huge: SharedView = {
      ...VIEW,
      things: Array.from({ length: 16385 }, (_, i) => ({
        id: `t${i}`,
        element: "stone",
        name: "loose stone",
        x: 0,
        z: 0,
        states: {},
      })),
    };
    expect(() => encodeSharedView(huge)).toThrow();
  });
});
