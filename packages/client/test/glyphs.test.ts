import { describe, expect, it } from "vitest";
import { GlyphBatch, INSTANCE_BYTES } from "../src/glyph/batch.ts";
import {
  ATLAS_COLS,
  buildGlyphAtlas,
  CELL_H,
  CELL_W,
  EXTRA_GLYPHS,
  GLYPH_COUNT,
  GLYPH_H,
  GLYPH_W,
  glyphOfChar,
  glyphOfExtra,
  glyphRows,
} from "../src/glyph/font.ts";
import { PALETTE_HEX, PALETTE_SIZE, paletteToFloats } from "../src/palette.ts";

describe("the font", () => {
  it("draws every ASCII character and curated silhouette at exactly 3 by 5", () => {
    expect([GLYPH_W, GLYPH_H]).toEqual([3, 5]);
    const glyphs = glyphRows();
    expect(glyphs).toHaveLength(GLYPH_COUNT);
    for (const rows of glyphs) {
      expect(rows).toHaveLength(GLYPH_H);
      for (const row of rows) expect(row).toMatch(new RegExp(`^[#.]{${GLYPH_W}}$`));
    }
  });

  it("has no two glyphs alike, because the symbols are the actors", () => {
    const seen = new Map<string, number>();
    glyphRows().forEach((rows, index) => {
      const key = rows.join("");
      expect(seen.get(key), `glyph ${index} repeats glyph ${seen.get(key)}`).toBeUndefined();
      seen.set(key, index);
    });
  });

  it("puts each glyph's ink in its own atlas cell", () => {
    const atlas = buildGlyphAtlas();
    expect(atlas.width).toBe(ATLAS_COLS * CELL_W);
    const at = glyphOfChar("L");
    const left = (at % ATLAS_COLS) * CELL_W;
    const top = Math.floor(at / ATLAS_COLS) * CELL_H;
    // "L": the bottom row is full, the top row is one pixel on the left.
    expect(atlas.pixels[(top + 4) * atlas.width + left + 2]).toBe(255);
    expect(atlas.pixels[top * atlas.width + left]).toBe(255);
    expect(atlas.pixels[top * atlas.width + left + 1]).toBe(0);
    const inked = atlas.pixels.reduce((n, p) => n + (p === 255 ? 1 : 0), 0);
    const drawn = glyphRows().reduce((n, rows) => n + rows.join("").split("#").length - 1, 0);
    expect(inked).toBe(drawn);
  });

  it("falls back to a question mark and finds the extra glyphs after ASCII", () => {
    expect(glyphOfChar("é")).toBe(glyphOfChar("?"));
    for (let code = 32; code <= 126; code++) {
      expect(glyphOfChar(String.fromCharCode(code))).toBe(code - 32);
    }
    // These indices are persisted, not offsets relative to a growing glyph count.
    expect(["tree", "pine", "bush", "flame", "rock", "reed"]).toEqual(EXTRA_GLYPHS.slice(0, 6));
    expect(glyphOfExtra("tree")).toBe(95);
    expect(glyphOfExtra("pine")).toBe(96);
    expect(glyphOfExtra("bush")).toBe(97);
    expect(glyphOfExtra("flame")).toBe(98);
    expect(glyphOfExtra("rock")).toBe(99);
    expect(glyphOfExtra("reed")).toBe(100);
  });

  it("appends recognizable silhouettes without changing the hero mark", () => {
    const glyphs = glyphRows();
    expect(glyphs[glyphOfChar("@")]).toEqual([".##", "#.#", "#.#", "#..", ".##"]);
    const curated = [
      ["stump", "... ... ### #.# ###"],
      ["branches", "... #.. .## ##. #.#"],
      ["mushroom", ".#. ### ### .#. ###"],
      ["tool", "### ##. .#. .#. .#."],
      ["creature", "#.# ### .#. ### #.#"],
    ] as const;
    curated.forEach(([name, mask], offset) => {
      expect(glyphOfExtra(name)).toBe(101 + offset);
      expect(glyphs[glyphOfExtra(name)]?.join(" ")).toBe(mask);
    });
  });
});

describe("the palette", () => {
  it("has sixteen colours as floats", () => {
    const floats = paletteToFloats();
    expect(PALETTE_HEX).toHaveLength(PALETTE_SIZE);
    expect(floats).toHaveLength(PALETTE_SIZE * 3);
    expect([...floats].every((f) => f >= 0 && f <= 1)).toBe(true);
    expect(() => paletteToFloats(["#fff"])).toThrow();
  });
});

describe("the glyph batch", () => {
  it("packs instances and tracks the span that changed", () => {
    const batch = new GlyphBatch(8);
    for (let i = 0; i < 5; i++) batch.add(i, 0, i, { glyph: i, ink: 3 });
    expect(batch.bytes[2 * INSTANCE_BYTES + 12]).toBe(2);
    expect(batch.bytes[2 * INSTANCE_BYTES + 15]).toBe(16);
    expect([batch.dirtyFrom, batch.dirtyTo]).toEqual([0, 5]);
    batch.clean();
    batch.move(3, 9, 9, 9);
    batch.setInk(1, 7);
    expect([batch.dirtyFrom, batch.dirtyTo]).toEqual([1, 4]);
    expect(new Float32Array(batch.bytes.buffer, 3 * INSTANCE_BYTES, 3)).toEqual(
      new Float32Array([9, 9, 9]),
    );
  });

  it("grows when it is full and keeps what it held", () => {
    const batch = new GlyphBatch(1);
    for (let i = 0; i < 5; i++) batch.add(i, 0, 0, { glyph: i, ink: 0 });
    expect(batch.count).toBe(5);
    expect(batch.capacity).toBeGreaterThanOrEqual(5);
    expect([0, 1, 2, 3, 4].map((i) => batch.bytes[i * INSTANCE_BYTES + 12])).toEqual([
      0, 1, 2, 3, 4,
    ]);
  });

  it("fills a removed slot with the last instance and says which one moved", () => {
    const batch = new GlyphBatch(4);
    for (let i = 0; i < 4; i++) batch.add(i, 0, 0, { glyph: 10 + i, ink: 0 });
    batch.clean();
    expect(batch.remove(1)).toBe(3);
    expect(batch.count).toBe(3);
    expect(batch.bytes[INSTANCE_BYTES + 12]).toBe(13);
    expect([batch.dirtyFrom, batch.dirtyTo]).toEqual([1, 2]);
    expect(batch.remove(2)).toBe(-1);
    expect(() => batch.remove(7)).toThrow();
  });
});
