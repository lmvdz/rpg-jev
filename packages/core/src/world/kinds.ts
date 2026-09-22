/**
 * What a tile is physically made of: its name, in the order the grid's
 * `kinds` array indexes them, and whether it is a liquid (SPEC.md section
 * 19). Colours and textures are the renderer's business and stay in the
 * client (`packages/client/src/terrain/kinds.ts`), keyed by this same order
 * and checked against it by a test.
 */
export interface TerrainKind {
  readonly name: string;
  readonly liquid: boolean;
}

export const TERRAIN_KINDS = [
  { name: "grass", liquid: false },
  { name: "dirt", liquid: false },
  { name: "rock", liquid: false },
  { name: "sand", liquid: false },
  { name: "water", liquid: true },
  { name: "masonry", liquid: false },
  { name: "boards", liquid: false },
  { name: "forest", liquid: false },
] as const satisfies readonly TerrainKind[];

export type KindName = (typeof TERRAIN_KINDS)[number]["name"];

export function kindIndex(name: KindName): number {
  return TERRAIN_KINDS.findIndex((kind) => kind.name === name);
}

const FALLBACK: TerrainKind = TERRAIN_KINDS[0];

export function kindAt(index: number): TerrainKind {
  return TERRAIN_KINDS[index] ?? FALLBACK;
}
