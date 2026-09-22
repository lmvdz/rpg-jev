import { matter } from "@rpg-jev/core";
import { describe, expect, it } from "vitest";
import { encodeSharedView } from "../../client/src/play/shared-wire.ts";
import { project, shouldPublishTick } from "../module/src/projection.ts";
import { admitActor, initialWorld, terrainAllows } from "../module/src/world.ts";

describe("hosted clearing projection", () => {
  it("suppresses quiet tick snapshots but preserves heartbeat, presentation and control changes", () => {
    const state = admitActor(initialWorld(), "player-1").state;
    const view = { ...project(state, "player-1", 1, 0), generation: "first", pauseReason: null };
    const encoded = encodeSharedView(view);
    expect(shouldPublishTick(encoded, encodeSharedView({ ...view, revision: 2, tick: 1 }))).toBe(
      false,
    );
    expect(shouldPublishTick(encoded, encodeSharedView({ ...view, revision: 3, tick: 2 }))).toBe(
      true,
    );
    expect(shouldPublishTick(JSON.stringify(view), encoded)).toBe(true);
    for (const change of [
      { generation: "second" },
      { pauseReason: "archive-backlog" },
      { sequence: 1 },
      { position: [1, 1] as [number, number] },
      { things: [] },
    ])
      expect(shouldPublishTick(encoded, encodeSharedView({ ...view, ...change }))).toBe(true);
    const hero = state.world.bodies["player-1"];
    if (!hero) throw new Error("missing traveller");
    hero.needs.hunger = (hero.needs.hunger ?? 0) + 0.001;
    expect(project(state, "player-1", 1, 0).body).toEqual(view.body);
  });

  it("shows nearby admitted travellers but none of their private body state", () => {
    const initial = initialWorld();
    const first = admitActor(initial, "player-1");
    const second = admitActor(first.state, "player-2");
    const view = project(second.state, "player-1", 2, 0);
    expect(view.things.some((thing) => thing.id === "player-2")).toBe(true);
    expect(view.things.some((thing) => thing.id === "player-3")).toBe(false);
    expect(view.things.some((thing) => thing.id.endsWith(".hands"))).toBe(false);
    const hidden = JSON.parse(JSON.stringify(second.state)) as matter.SharedState;
    const other = hidden.world.bodies["player-2"];
    if (!other) throw new Error("missing second traveller");
    other.needs.hunger = 4;
    other.sickness = 4;
    other.aware = {};
    expect(project(hidden, "player-1", 2, 0)).toEqual(view);
  });

  it("publishes only the existing discrete surface vocabulary, never hidden material state", () => {
    const state = admitActor(initialWorld(), "player-1").state;
    const view = project(state, "player-1", 1, 0);
    const visible = view.things.find((thing) => state.world.things[thing.id]);
    if (!visible) throw new Error("missing visible material");
    const material = state.world.things[visible.id];
    if (!material) throw new Error("missing material");
    const before = JSON.stringify(state);
    expect(
      Object.keys(visible.states).every((key) =>
        [
          "burning",
          "temperature",
          "wetness",
          "integrity",
          "amount",
          "corrosion",
          "contamination",
        ].includes(key),
      ),
    ).toBe(true);
    for (const value of Object.values(visible.states)) {
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(5);
    }
    material.state = { ...material.state, flaw: 4, temper: 3, taint: 4 };
    expect(project(state, "player-1", 1, 0)).toEqual(view);
    const mutated = JSON.stringify(state);
    project(state, "player-1", 1, 0);
    expect(JSON.stringify(state)).toBe(mutated);
    expect(mutated).not.toBe(before);
  });

  it("keeps admission on the existing effect/replay path", () => {
    const initial = initialWorld();
    const result = admitActor(initial, "player-1");
    expect(matter.apply(initial.world, result.changes)).toEqual(result.state.world);
    expect(result.state.world.bodies["player-1"]?.holds).toEqual(["player-1.hands"]);
    expect(result.state.rng).toEqual(initial.rng);
  });

  it("uses the host's terrain and separates interaction reach from solid occupancy", () => {
    const state = admitActor(initialWorld(), "player-1").state;
    const from = state.world.bodies["player-1"]?.where;
    if (!from) throw new Error("missing player position");
    expect(terrainAllows(state.world, from, [-1, -1])).toBe(false);
    expect(terrainAllows(state.world, from, from, false)).toBe(true);
    expect(project(state, "player-1", 1, 0).compiled).not.toContain("X7");
  });
});
