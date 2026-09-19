/**
 * A fixed visual comparison, not a simulated world. Columns compare the same
 * glyph under visible states; rows change only the glyph and its backdrop.
 */
import { GLYPH_COUNT, glyphOfChar, glyphOfExtra } from "../glyph/font.ts";
import { INK } from "../palette.ts";
import { TileGrid } from "../terrain/grid.ts";
import { kindIndex } from "../terrain/kinds.ts";
import { glyphLookOf, type VisibleStates } from "../view/things.ts";
import type { WorldContent } from "../world/format.ts";

export const STUDY_STATES: readonly { name: string; states: VisibleStates }[] = [
  { name: "fresh", states: {} },
  { name: "wet", states: { wetness: 5 } },
  { name: "cracked", states: { integrity: 2 } },
  { name: "corroded", states: { corrosion: 4 } },
  { name: "rotten", states: { contamination: 4 } },
  { name: "scorching", states: { temperature: 5 } },
  { name: "wet + cracked", states: { wetness: 5, integrity: 2 } },
];

export function buildStudy(): WorldContent {
  const grid = new TileGrid(32, 32);
  grid.kinds.fill(kindIndex("forest"));
  const objects: WorldContent["objects"] = [];
  const glyphs = [glyphOfExtra("tree"), glyphOfExtra("rock"), glyphOfChar("@")];
  const grounds = [kindIndex("masonry"), kindIndex("forest"), kindIndex("sand")];
  for (let row = 0; row < glyphs.length; row++) {
    const z = 10 + row * 3;
    for (let dz = 0; dz < 3; dz++) {
      for (let x = 4; x <= 27; x++) grid.kinds[grid.index(x, z + dz)] = grounds[row] ?? 0;
    }
    for (const [column, sample] of STUDY_STATES.entries()) {
      objects.push({
        x: 6 + column * 3,
        z: z + 1,
        look: glyphLookOf({ glyph: glyphs[row] ?? 0, ink: INK.ash, scale: 24 }, sample.states),
      });
    }
  }
  // All prop silhouettes in atlas order; appending one adds it here automatically.
  for (let glyph = 95; glyph < GLYPH_COUNT; glyph++) {
    const n = glyph - 95;
    objects.push({
      x: 5 + (n % 12) * 2,
      z: 5 + Math.floor(n / 12) * 3,
      look: { glyph, ink: INK.leaf, scale: 24 },
    });
  }
  return { grid, objects, start: [16, 20] };
}
