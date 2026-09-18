import { describe, expect, it } from "vitest";
import {
  activeSpan,
  locate,
  persuadability,
  planBeat,
  pruneUnlikely,
  resolve,
  resolveBlow,
  type SpeechIntent,
  Store,
  sampleNoul,
} from "../src/index.ts";
import { entry, tinyWorld } from "./fixture.ts";

describe("schedules", () => {
  it("executes at, every and after as pure functions of time", () => {
    const supper = entry({ id: "supper", at: 1170, until: 1200 });
    const rounds = entry({ id: "rounds", every: { period: 60, offset: 1140 }, until: 10 });
    const washUp = entry({ id: "wash", after: "supper", until: 15 });
    const all = [supper, rounds, washUp];

    expect(activeSpan(supper, 1169, all)).toBeNull();
    expect(activeSpan(supper, 1170, all)).toEqual({ start: 1170, end: 1200 });
    expect(activeSpan(rounds, 1205, all)).toEqual({ start: 1200, end: 1210 });
    expect(activeSpan(rounds, 1215, all)).toBeNull();
    expect(activeSpan(washUp, 1199, all)).toBeNull();
    expect(activeSpan(washUp, 1210, all)).toEqual({ start: 1200, end: 1215 });
    expect(activeSpan(washUp, 1215, all)).toBeNull();
  });

  it("lets the highest layer win and falls back to home", () => {
    const world = tinyWorld();
    const ann = world.actors.ann;
    const schedule = world.schedules.ann;
    if (!(ann && schedule)) throw new Error("fixture");
    expect(locate(world, ann, 600).layer).toBe("home");

    schedule.role.push(entry({ id: "cook", at: 590, until: 700, at_location: "kitchen" }));
    expect(locate(world, ann, 600)).toMatchObject({ layer: "role", room: "kitchen" });

    schedule.commitments.push(entry({ id: "meet", at: 595, until: 620, at_location: "hall" }));
    expect(locate(world, ann, 600)).toMatchObject({ layer: "commitments", room: "hall" });

    schedule.overrides.push(entry({ id: "curfew", at: 0, until: 1440, at_location: "kitchen" }));
    expect(locate(world, ann, 600)).toMatchObject({ layer: "overrides", room: "kitchen" });
  });

  it("derives the needs layer from a float, with hysteresis", () => {
    const world = tinyWorld();
    const bo = world.actors.bo;
    if (!bo) throw new Error("fixture");
    bo.room = "hall";
    const schedule = world.schedules.bo;
    schedule?.role.push(entry({ id: "serve", at: 0, until: 1440, at_location: "hall" }));

    bo.needs.hunger = 0.69;
    expect(locate(world, bo, 600).layer).toBe("role");
    bo.needs.hunger = 0.7;
    expect(locate(world, bo, 600)).toMatchObject({ layer: "needs", activity: "eating" });
    // Half way through the meal he keeps eating; once satisfied he goes back to work.
    bo.activity = "eating";
    bo.needs.hunger = 0.4;
    expect(locate(world, bo, 600).layer).toBe("needs");
    bo.needs.hunger = 0.2;
    expect(locate(world, bo, 600).layer).toBe("role");
  });
});

describe("conversation scheduler", () => {
  const intent = (
    id: string,
    speaker: string,
    priority: 1 | 2 | 3,
    createdBeat = 0,
  ): SpeechIntent => ({
    id,
    speaker,
    listener: "player",
    act: "tell",
    topic: { kind: "entity", id },
    priority,
    createdBeat,
    cause: 0,
  });
  const together = () => {
    const world = tinyWorld();
    for (const a of Object.values(world.actors)) a.room = "hall";
    return world;
  };
  const idle = { busy: new Set<string>() };

  it("lets someone with an urgent stake cut across the answer", () => {
    const plan = planBeat(together(), [intent("a", "ann", 3), intent("b", "bo", 2)], idle);
    expect(plan.speak.map((t) => [t.intent.speaker, t.interrupts])).toEqual([
      ["bo", "ann"],
      ["ann", null],
    ]);
  });

  it("makes a remark wait while the floor is contested, then lets it through", () => {
    const world = together();
    const store = new Store(world);
    const remark = intent("r", "bo", 1);
    const first = planBeat(world, [intent("a", "ann", 3), remark], idle);
    expect(first.speak.map((t) => t.intent.id)).toEqual(["a"]);
    expect(first.defer).toEqual([remark]);

    store.commit({ kind: "queue_speech", intent: remark }, null);
    store.commit({ kind: "advance_clock", minutes: 1 }, null);
    expect(planBeat(world, [], idle).speak.map((t) => t.intent.id)).toEqual(["r"]);
  });

  it("drops what waited too long or lost its listener", () => {
    const world = together();
    world.conversation.beat = 9;
    const stale = planBeat(world, [intent("old", "ann", 1, 2)], idle);
    expect(stale.drop[0]?.reason).toBe("the moment passed");

    const bo = world.actors.bo;
    if (bo) bo.room = "kitchen";
    expect(planBeat(world, [intent("x", "bo", 3, 9)], idle).drop[0]?.reason).toBe(
      "no longer in the same room",
    );
  });

  it("has a busy NPC hold a remark one beat, then speak without stopping work", () => {
    const world = together();
    const busy = { busy: new Set(["bo"]) };
    const remark = intent("r", "bo", 1);
    expect(planBeat(world, [remark], busy).defer).toEqual([remark]);
    world.conversation.beat = 1;
    world.conversation.queue.push(remark);
    expect(planBeat(world, [], busy).speak[0]).toMatchObject({ whileWorking: true });
  });

  it("gives nobody the floor twice in a beat and respects the remark cooldown", () => {
    const world = together();
    const plan = planBeat(world, [intent("a", "ann", 3), intent("a2", "ann", 2)], idle);
    expect(plan.speak).toHaveLength(1);
    world.conversation.lastSpokeBeat.bo = 0;
    world.conversation.beat = 1;
    expect(planBeat(world, [intent("r", "bo", 1, 1)], idle).speak).toHaveLength(0);
  });
});

describe("numbers live in code", () => {
  it("resolves a blow from logged draws", () => {
    expect(resolveBlow(0.9, 0.5, false)).toEqual({ hit: false, damage: 0 });
    expect(resolveBlow(0.1, 0.99, true)).toEqual({ hit: true, damage: 4 });
  });

  it("clamps Noul sampling at the extremes and never sharpens a Choice", () => {
    expect(sampleNoul(0.05, 0)).toBe(false);
    expect(sampleNoul(0.95, 0.999)).toBe(true);
    expect(sampleNoul(0.5, 0.4)).toBe(true);
    expect(pruneUnlikely({ a: 0.55, b: 0.38, c: 0.07 })).toEqual({ a: 0.55, b: 0.38 });
  });

  it("builds persuadability from drives, with the judge's spread as one input", () => {
    const ann = tinyWorld().actors.ann;
    if (!ann) throw new Error("fixture");
    const torn = persuadability(ann, "reason", 0.5);
    const decided = persuadability(ann, "reason", 0.02);
    expect(torn).toBeGreaterThan(decided);
    ann.drives.fear = 0.9;
    expect(persuadability(ann, "threat", 0.5)).toBeGreaterThan(persuadability(ann, "reason", 0.5));
    expect(resolve(false, 0.6)).toBe("wavers");
    expect(resolve(false, 0.2)).toBe("refuses");
  });
});
