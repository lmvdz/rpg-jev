/**
 * The renderer's pixel masks, colours and textures are keyed by closed-set
 * ids the host also uses (`@rpg-jev/core/world`): a glyph index, a palette
 * index and a terrain kind index. These tests hold the client's tables to
 * the same order as core's, so a look chosen by the host always draws right.
 */

import { EXTRA_NAMES, INK, TERRAIN_KINDS } from "@rpg-jev/core/world";
import { describe, expect, it } from "vitest";
import { EXTRA_GLYPHS, glyphOfExtra, glyphRows } from "../src/glyph/font.ts";
import { INK as CLIENT_INK, PALETTE_HEX } from "../src/palette.ts";
import { TILE_KINDS } from "../src/terrain/kinds.ts";

describe("the glyph atlas agrees with the core glyph ids", () => {
  it("draws exactly the extra silhouettes core names, in core's order", () => {
    expect(EXTRA_GLYPHS).toEqual(EXTRA_NAMES);
  });

  it("draws a mask for every extra glyph at its core index", () => {
    const rows = glyphRows();
    for (const name of EXTRA_NAMES) expect(rows[glyphOfExtra(name)]).toBeDefined();
  });
});

describe("the palette agrees with core's ink table", () => {
  it("is the same object client callers already use", () => {
    expect(CLIENT_INK).toBe(INK);
  });

  it("has one hex colour per ink id, in ink index order", () => {
    for (const name of Object.keys(INK) as (keyof typeof INK)[]) {
      expect(PALETTE_HEX[INK[name]]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

describe("the client's tile kinds agree with core's terrain kinds", () => {
  it("has the same names, in the same order, with the same liquid flags", () => {
    expect(TILE_KINDS.map((kind) => ({ name: kind.name, liquid: kind.liquid }))).toEqual(
      TERRAIN_KINDS.map((kind) => ({ name: kind.name, liquid: kind.liquid })),
    );
  });
});
