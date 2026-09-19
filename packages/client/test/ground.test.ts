import { describe, expect, it } from "vitest";
import { INK } from "../src/palette.ts";
import { buildClearing } from "../src/scene/clearing.ts";
import { scorchAround, standInGround } from "../src/scene/ground.ts";
import { kindAt, kindIndex } from "../src/terrain/kinds.ts";
import { GROUND_CHANNELS, GroundStates } from "../src/view/ground.ts";

describe("the states of the ground", () => {
  it("keeps four levels a tile, in the bytes the shader reads", () => {
    const ground = new GroundStates(8, 4);
    ground.set(3, 2, { wet: 4, wetInk: INK.water });
    ground.set(3, 2, { snow: 2 });
    expect(ground.at(3, 2)).toEqual({ wet: 4, wetInk: INK.water, scorched: 0, snow: 2 });
    const at = (2 * 8 + 3) * GROUND_CHANNELS;
    expect([...ground.data.subarray(at, at + 4)]).toEqual([4, INK.water, 0, 2]);
  });

  it("tells oil-wet from water-wet: what wets it is part of the state", () => {
    const ground = new GroundStates(4, 4);
    ground.set(1, 1, { wet: 3, wetInk: INK.water });
    ground.set(2, 1, { wet: 3, wetInk: INK.sand });
    expect(ground.at(1, 1)).not.toEqual(ground.at(2, 1));
  });

  it("brings values into range and ignores what is off the map", () => {
    const ground = new GroundStates(4, 4);
    ground.set(1, 1, { wet: 99, wetInk: 99, scorched: -3, snow: 2.4 });
    expect(ground.at(1, 1)).toEqual({ wet: 5, wetInk: 15, scorched: 0, snow: 2 });
    ground.clean();
    ground.set(-1, 0, { wet: 5 });
    ground.set(0, 4, { wet: 5 });
    ground.set(Number.NaN, 0, { wet: 5 });
    expect(ground.dirtyTo).toBeLessThan(ground.dirtyFrom);
    expect(ground.data.every((byte) => byte === 0 || byte === 5 || byte === 15 || byte === 2)).toBe(
      true,
    );
  });

  it("marks only the rows that changed, and nothing when a set changes nothing", () => {
    const ground = new GroundStates(16, 16);
    expect(ground.dirtyTo).toBeLessThan(ground.dirtyFrom);
    ground.set(2, 9, { scorched: 3 });
    ground.set(7, 5, { wet: 1 });
    expect([ground.dirtyFrom, ground.dirtyTo]).toEqual([5, 9]);
    ground.clean();
    ground.set(2, 9, { scorched: 3 });
    expect(ground.dirtyTo).toBeLessThan(ground.dirtyFrom);
    ground.markAllDirty();
    expect([ground.dirtyFrom, ground.dirtyTo]).toEqual([0, 15]);
  });
});

describe("the stand-in for the clearing's ground", () => {
  const { grid, things } = buildClearing(1);
  const ground = standInGround(grid, things);
  const water = kindIndex("water");

  it("wets the banks with what flows past them and leaves the far meadow dry", () => {
    let banks = 0;
    let dry = 0;
    for (let z = 0; z < grid.depth; z++) {
      for (let x = 0; x < grid.width; x++) {
        const state = ground.at(x, z);
        if (grid.kindAt(x, z) === water) expect(state.wet).toBe(0);
        else if (state.wet > 0) {
          banks++;
          expect(state.wetInk).toBe(kindAt(water).floor);
        } else dry++;
      }
    }
    expect(banks).toBeGreaterThan(20);
    expect(dry).toBeGreaterThan(banks);
  });

  it("scorches the ground under what burns, more as it burns harder, and never less again", () => {
    const fire = things.find((thing) => (thing.states.burning ?? 0) > 0);
    if (!fire) throw new Error("the clearing has a fire");
    const under = ground.at(fire.x, fire.z).scorched;
    expect(under).toBe(fire.states.burning);
    expect(ground.at(fire.x + 1, fire.z).scorched).toBe(under - 2);
    scorchAround(ground, { ...fire, states: { burning: 5 } });
    expect(ground.at(fire.x, fire.z).scorched).toBe(5);
    scorchAround(ground, { ...fire, states: { burning: 1 } });
    expect(ground.at(fire.x, fire.z).scorched).toBe(5);
  });
});
