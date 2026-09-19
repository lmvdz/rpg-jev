import { describe, expect, it } from "vitest";
import { EFFECTS } from "../src/view/effect-rows.ts";
import {
  checkEffect,
  type EffectRow,
  EMITTER_FLOATS,
  EmitterList,
  lifeOf,
  MAX_EMITTERS,
  MAX_ONE_SHOTS,
  OneShots,
  PARTICLES_PER_EMITTER,
} from "../src/view/effects.ts";
import {
  ActorMotions,
  checkMotion,
  MAX_MOTIONS,
  MOTIONS,
  type MotionRow,
  secondsOf,
} from "../src/view/motions.ts";

describe("the effect schema", () => {
  it("passes every row written by hand", () => {
    for (const [name, row] of Object.entries(EFFECTS)) expect(checkEffect(row), name).toBeNull();
  });

  it("refuses a row that steps outside the closed sets, since rows will be generated", () => {
    const good: EffectRow = EFFECTS.flames;
    const bad: [string, object][] = [
      ["motion", { motion: "teleport" }],
      ["easing", { easing: "bounce(9)" }],
      ["frames", { frames: [] }],
      ["frames", { frames: [1, 2, 3, 4, 5] }],
      ["atlas", { frames: [9999] }],
      ["inks", { inks: [1, 2, 99] }],
      ["levels", { speed: 6 }],
      ["levels", { life: 1.5 }],
      ["glows", { glows: "yes" }],
    ];
    for (const [expected, change] of bad) {
      expect(checkEffect({ ...good, ...change } as EffectRow)).toContain(expected);
    }
  });
});

describe("an actor's own motion", () => {
  it("passes every row written by hand and refuses what is outside the closed sets", () => {
    for (const [name, row] of Object.entries(MOTIONS)) expect(checkMotion(row), name).toBeNull();
    const good: MotionRow = MOTIONS.lunge;
    expect(checkMotion({ ...good, motion: "fly" } as unknown as MotionRow)).toContain("motion");
    expect(checkMotion({ ...good, easing: "elastic" } as unknown as MotionRow)).toContain("easing");
    expect(checkMotion({ ...good, strength: 9 })).toContain("levels");
  });

  it("is packed for the shader while it runs and forgotten when it ends", () => {
    const motions = new ActorMotions();
    motions.play(() => 7, MOTIONS.lunge, 10, 3, 4);
    motions.pack(10.05);
    expect(motions.count).toBe(1);
    const lasts = Math.fround(secondsOf(MOTIONS.lunge));
    expect([...motions.a.subarray(0, 4)]).toEqual([7, 0, 10, lasts]);
    // The direction is a unit vector, the strength is in tiles.
    expect(motions.b[0]).toBeCloseTo(0.6);
    expect(motions.b[1]).toBeCloseTo(0.8);
    expect(motions.b[2]).toBeGreaterThan(0);
    motions.pack(10 + secondsOf(MOTIONS.lunge) + 0.01);
    expect(motions.count).toBe(0);
  });

  it("follows a glyph whose slot moves, skips one that is gone, and keeps the newest", () => {
    const motions = new ActorMotions();
    let slot = 3;
    motions.play(() => slot, MOTIONS.spin, 0);
    motions.play(() => -1, MOTIONS.shake, 0);
    slot = 5;
    motions.pack(0.1);
    expect(motions.count).toBe(1);
    expect(motions.a[0]).toBe(5);
    for (let i = 0; i < MAX_MOTIONS + 3; i++) motions.play(() => 100 + i, MOTIONS.spin, 0.1);
    motions.pack(0.2);
    expect(motions.count).toBe(MAX_MOTIONS);
    expect(motions.a[(MAX_MOTIONS - 1) * 4]).toBe(100 + MAX_MOTIONS + 2);
  });
});

describe("the frame's emitters", () => {
  it("packs a row into five texels the shader reads, and turns levels into amounts", () => {
    const list = new EmitterList();
    list.add(3, 1, 4, EFFECTS.flames);
    list.add(9, 0, 9, EFFECTS.smoke);
    expect(list.count).toBe(2);
    const first = [...list.data.subarray(0, EMITTER_FLOATS)];
    expect(first.slice(0, 3)).toEqual([3, 1, 4]);
    expect(first[4]).toBe(0); // rise
    expect(first[5]).toBeLessThanOrEqual(PARTICLES_PER_EMITTER);
    expect(first[6]).toBeCloseTo(0.6); // life level 1, in seconds
    expect(first[15]).toBe(1); // glows
    expect(first.slice(16, 20)).toEqual([...EFFECTS.flames.frames, -1]);
    expect(first.slice(20)).toEqual([0, 0, 0, 0]); // a condition: no start, born over and over
    expect(list.data[EMITTER_FLOATS + 3]).not.toBe(first[3]); // neighbours are told apart
  });

  it("plays an event's rows once from its start, then forgets it, and keeps the newest", () => {
    const shots = new OneShots();
    const list = new EmitterList();
    const playing = (now: number) => {
      list.begin();
      shots.emit(list, now);
      return list.count;
    };
    shots.play(1, 0, 1, [], 5);
    expect(shots.playing).toBe(0);
    shots.play(3, 1, 4, [EFFECTS.sparks, EFFECTS.smoke], 10);
    expect(playing(10.1)).toBe(2);
    expect([...list.data.subarray(20, 22)]).toEqual([10, 1]);
    // The sparks are over by now, which the shader sees from the start time; the smoke is not.
    expect(playing(10 + lifeOf(EFFECTS.sparks) + 0.1)).toBe(2);
    expect(playing(10 + lifeOf(EFFECTS.smoke) + 0.01)).toBe(0);
    expect(shots.playing).toBe(0);
    for (let i = 0; i < MAX_ONE_SHOTS + 5; i++) shots.play(i, 0, 0, [EFFECTS.dust], 20);
    expect(shots.playing).toBe(MAX_ONE_SHOTS);
    playing(20.1);
    expect(list.data[0]).toBe(5);
  });

  it("is quietly full, and empties for the next frame", () => {
    const list = new EmitterList();
    for (let i = 0; i < MAX_EMITTERS + 10; i++) list.add(i, 0, 0, EFFECTS.dust);
    expect(list.count).toBe(MAX_EMITTERS);
    list.begin();
    expect(list.count).toBe(0);
  });
});
