import { describe, expect, it } from "vitest";
import { GLYPH_DAMAGED, GLYPH_GLOWS, GLYPH_SWAYS, GLYPH_WET } from "../src/glyph/batch.ts";
import { INK } from "../src/palette.ts";
import { glyphLookOf } from "../src/view/things.ts";

describe("visible material treatments", () => {
  const look = { glyph: 35, ink: INK.ash, scale: 24, sways: true };

  it("does not advertise absent or mild surface states", () => {
    const fresh = glyphLookOf(look, {});
    expect(
      glyphLookOf(look, {
        wetness: 2,
        corrosion: 2,
        contamination: 2,
        integrity: 4,
      }),
    ).toEqual(fresh);
    expect(fresh).toEqual({ glyph: 35, ink: INK.ash, scale: 24, flags: GLYPH_SWAYS });
  });

  it("composes wetness, damage and burning without changing glyph geometry", () => {
    const states = Object.freeze({ wetness: 5, integrity: 1, burning: 3 });
    const result = glyphLookOf(Object.freeze(look), states);
    expect(result).toEqual({
      glyph: 35,
      ink: INK.ash,
      scale: 24,
      flags: GLYPH_SWAYS | GLYPH_WET | GLYPH_DAMAGED | GLYPH_GLOWS,
    });
    expect(glyphLookOf(look, {}).flags).toBe(GLYPH_SWAYS);
  });

  it("shows corrosion and rot with explicit colour precedence, then scorching heat", () => {
    expect(glyphLookOf(look, { corrosion: 3 }).ink).toBe(INK.wood);
    expect(glyphLookOf(look, { contamination: 3 }).ink).toBe(INK.pine);
    expect(glyphLookOf(look, { corrosion: 5, contamination: 3 }).ink).toBe(INK.pine);
    expect(
      glyphLookOf(look, {
        temperature: 5,
        corrosion: 5,
        contamination: 5,
        wetness: 5,
        integrity: 0,
      }),
    ).toEqual({
      glyph: 35,
      ink: INK.ember,
      scale: 24,
      flags: GLYPH_SWAYS | GLYPH_WET | GLYPH_DAMAGED,
    });
  });
});
