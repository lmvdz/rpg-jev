import { INK, type Ink } from "../palette.ts";

/**
 * What a tile is made of. A kind is a row of data: the tessellator and the
 * shader never ask which kind they are drawing, only what the row says.
 */
export interface TileKind {
  readonly name: string;
  readonly floor: Ink;
  readonly wall: Ink;
  /** Layer of the terrain texture array (`terrain/textures.ts`). */
  readonly texture: number;
  /** A liquid's surface sits a little below its banks and moves in the shader. */
  readonly liquid: boolean;
}

export const TEXTURE = {
  speckle: 0,
  grass: 1,
  blocks: 2,
  planks: 3,
  ripple: 4,
  grain: 5,
} as const;

export const TEXTURE_COUNT = Object.keys(TEXTURE).length;

export const TILE_KINDS = [
  { name: "grass", floor: INK.grass, wall: INK.earth, texture: TEXTURE.grass, liquid: false },
  { name: "dirt", floor: INK.wood, wall: INK.earth, texture: TEXTURE.speckle, liquid: false },
  { name: "rock", floor: INK.stone, wall: INK.slate, texture: TEXTURE.speckle, liquid: false },
  { name: "sand", floor: INK.sand, wall: INK.wood, texture: TEXTURE.grain, liquid: false },
  { name: "water", floor: INK.water, wall: INK.deep, texture: TEXTURE.ripple, liquid: true },
  { name: "masonry", floor: INK.ash, wall: INK.stone, texture: TEXTURE.blocks, liquid: false },
  { name: "boards", floor: INK.sand, wall: INK.wood, texture: TEXTURE.planks, liquid: false },
  { name: "forest", floor: INK.pine, wall: INK.earth, texture: TEXTURE.grass, liquid: false },
] as const satisfies readonly TileKind[];

export type KindName = (typeof TILE_KINDS)[number]["name"];

export function kindIndex(name: KindName): number {
  return TILE_KINDS.findIndex((kind) => kind.name === name);
}

const FALLBACK: TileKind = TILE_KINDS[0];

export function kindAt(index: number): TileKind {
  return TILE_KINDS[index] ?? FALLBACK;
}
