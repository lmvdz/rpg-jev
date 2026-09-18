import { describe, expect, it } from "vitest";
import { EFFECTS, effectsOf } from "../src/view/effect-rows.ts";
import {
  checkEffect,
  type EffectRow,
  EMITTER_FLOATS,
  EmitterList,
  MAX_EMITTERS,
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

describe("which effects a thing shows", () => {
  it("follows its visible states and nothing else", () => {
    expect(effectsOf({})).toHaveLength(0);
    expect(effectsOf({ growth: 3 })).toHaveLength(0);
    expect(effectsOf({ burning: 1 })).toEqual([EFFECTS.smoke]);
    expect(effectsOf({ burning: 3 })).toEqual([EFFECTS.flames, EFFECTS.smoke]);
    expect(effectsOf({ burning: 5 })).toContain(EFFECTS.sparks);
    expect(effectsOf({ temperature: 5 })).toEqual([EFFECTS.smoke]);
    expect(effectsOf({ burning: 3 })).toBe(effectsOf({ burning: 2 }));
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
    expect(first.slice(16)).toEqual([...EFFECTS.flames.frames, -1]);
    expect(list.data[EMITTER_FLOATS + 3]).not.toBe(first[3]); // neighbours are told apart
  });

  it("is quietly full, and empties for the next frame", () => {
    const list = new EmitterList();
    for (let i = 0; i < MAX_EMITTERS + 10; i++) list.add(i, 0, 0, EFFECTS.dust);
    expect(list.count).toBe(MAX_EMITTERS);
    list.begin();
    expect(list.count).toBe(0);
  });
});
