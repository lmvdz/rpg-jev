/**
 * The tile grid moved to `packages/core/src/world/grid.ts` (SPEC.md section
 * 19) so the host can build and read terrain without depending on the client
 * package. This re-export shim keeps the renderer's existing imports working.
 */
export {
  DIR_X,
  DIR_Z,
  LEVEL,
  MAX_HEIGHT,
  MIN_HEIGHT,
  NO_INK,
  SHAPE,
  type Shape,
  type Tile,
  type TileArrays,
  TileGrid,
} from "@rpg-jev/core/world";
