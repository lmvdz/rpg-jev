import { describe, expect, it } from "vitest";
import { GLYPH_COUNT } from "../src/glyph/font.ts";
import { buildStudy, STUDY_STATES } from "../src/scene/study.ts";
import { decodeWorld, encodeWorld } from "../src/world/format.ts";
import { loadWorld } from "../src/world/storage.ts";

describe("the repeatable visual study", () => {
  it("places every prop silhouette and material sample on a unique tile", () => {
    const world = buildStudy();
    expect(world.objects).toHaveLength(3 * STUDY_STATES.length + GLYPH_COUNT - 95);
    const occupied = new Set<number>();
    for (const object of world.objects) {
      expect(world.grid.contains(object.x, object.z)).toBe(true);
      occupied.add(world.grid.index(object.x, object.z));
    }
    expect(occupied.size).toBe(world.objects.length);
    expect(encodeWorld(decodeWorld(encodeWorld(world)))).toEqual(encodeWorld(world));
    expect(buildStudy()).toEqual(world);
  });

  it("loads explicitly without a world, draft, network, or simulated things", async () => {
    const loaded = await loadWorld(new URLSearchParams("study&seed=2&world=old"));
    expect(loaded.name).toBe("visual-study");
    expect(loaded.from).toContain("not simulated");
    expect(loaded.things).toBeUndefined();
    expect(loaded.content).toEqual(buildStudy());
  });
});
