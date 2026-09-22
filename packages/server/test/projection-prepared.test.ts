import { performance } from "node:perf_hooks";
import { describe, expect, it } from "vitest";
import { prepareProjection, project } from "../module/src/projection.ts";
import { admitActor, initialWorld } from "../module/src/world.ts";
import { referenceProject } from "./projection-reference.ts";

const actors = Array.from({ length: 8 }, (_, index) => `player-${index + 1}`);
const fixture = () =>
  actors.reduce((state, actor) => admitActor(state, actor).state, initialWorld());

describe("snapshot-scoped observer-independent preparation", () => {
  it("matches the old projector for eight observers including ordering and all public fields", () => {
    const state = fixture();
    const original = JSON.stringify(state);
    const prepared = prepareProjection(state);
    for (const [index, actor] of actors.entries()) {
      const expected = referenceProject(state, actor, 12, index);
      expect(prepared(actor, 12, index)).toEqual(expected);
      expect(project(state, actor, 12, index)).toEqual(expected);
    }
    expect(JSON.stringify(state)).toBe(original);
  });

  it("preserves per-observer positions, held filtering and hidden-state isolation", () => {
    const state = fixture();
    const first = state.world.bodies["player-1"];
    const second = state.world.bodies["player-2"];
    const thing = Object.values(state.world.things).find((entry) => entry.where);
    if (!(first && second && thing)) throw new Error("missing fixture");
    first.where = [1, 1];
    second.where = [30, 30];
    second.holds = [...(second.holds ?? []), thing.id];
    second.needs.hunger = 4;
    second.sickness = 4;
    second.aware = {};
    thing.state = { ...thing.state, flaw: 4, temper: 3, taint: 4, wetness: 3 };
    const prepared = prepareProjection(state);
    for (const [index, actor] of actors.entries()) {
      expect(prepared(actor, 13, index)).toEqual(referenceProject(state, actor, 13, index));
      expect(prepared(actor, 13, index).things.some((entry) => entry.id === thing.id)).toBe(false);
    }
    const elsewhere = structuredClone(state);
    const remote = elsewhere.world.bodies["player-2"];
    if (!remote) throw new Error("missing actor");
    remote.place = "elsewhere";
    const remotePrepared = prepareProjection(elsewhere);
    for (const actor of actors)
      expect(remotePrepared(actor, 14, 0)).toEqual(referenceProject(elsewhere, actor, 14, 0));
    expect(() => prepared("missing", 1, 0)).toThrow("position");
  });

  it("does not retain prepared state between immutable refresh snapshots", () => {
    const state = fixture();
    const before = prepareProjection(state);
    const changed = structuredClone(state);
    const hero = changed.world.bodies["player-1"];
    const thing = Object.values(changed.world.things).find((entry) => entry.where);
    if (!(hero && thing)) throw new Error("missing fixture");
    hero.where = [18, 18];
    thing.state.wetness = 5;
    const after = prepareProjection(changed);
    expect(before("player-1", 1, 0)).toEqual(referenceProject(state, "player-1", 1, 0));
    expect(after("player-1", 2, 1)).toEqual(referenceProject(changed, "player-1", 2, 1));
  });

  it("does not let one returned material surface mutate later observers", () => {
    const state = fixture();
    const prepared = prepareProjection(state);
    const first = prepared("player-1", 1, 0);
    const material = first.things.find((entry) => state.world.things[entry.id]);
    if (!material) throw new Error("missing material");
    material.states.wetness = 999;
    const element = first.elements[material.element];
    if (element) element.baseline = { mass: 999 };
    expect(prepared("player-1", 1, 0)).toEqual(referenceProject(state, "player-1", 1, 0));
    expect(prepared("player-2", 1, 0)).toEqual(referenceProject(state, "player-2", 1, 0));
  });

  it("reports preparation-inclusive eight-observer cost against the frozen projector", () => {
    const state = fixture();
    const old: number[] = [];
    const prepared: number[] = [];
    for (let i = 0; i < 120; i++) {
      const start = performance.now();
      for (const actor of actors) referenceProject(state, actor, i, i);
      const middle = performance.now();
      const projectFor = prepareProjection(state);
      for (const actor of actors) projectFor(actor, i, i);
      const end = performance.now();
      if (i >= 20) {
        old.push(middle - start);
        prepared.push(end - middle);
      }
    }
    const p95 = (values: number[]) => values.sort((a, b) => a - b)[94];
    console.log(JSON.stringify({ observers: 8, oldP95: p95(old), preparedP95: p95(prepared) }));
    if (process.env.SHARED_PREPARED_BENCH === "1") {
      expect(p95(prepared)).toBeLessThanOrEqual(25);
      expect(p95(prepared)).toBeLessThanOrEqual((p95(old) ?? 0) * 0.85);
    }
  });
});
