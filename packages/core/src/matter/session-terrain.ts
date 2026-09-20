/** A bounded, code-owned tile map. Coordinates are integer tile indices, not SI metres. */
export interface MatterTerrain {
  place: string;
  width: number;
  height: number;
  walkable: readonly boolean[];
}

export type Tile = readonly [number, number];

export function containsTile(terrain: MatterTerrain, where: Tile | undefined): where is Tile {
  if (where?.length !== 2 || !where.every(Number.isInteger)) return false;
  const [x, y] = where;
  return x >= 0 && y >= 0 && x < terrain.width && y < terrain.height;
}

export function openTile(terrain: MatterTerrain, where: Tile | undefined): where is Tile {
  return (
    containsTile(terrain, where) && terrain.walkable[where[1] * terrain.width + where[0]] === true
  );
}

export const tileDistance = (a: Tile, b: Tile) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);

/** Cardinal reach does not pass diagonally through walls. */
export function tileReach(terrain: MatterTerrain, a: Tile, b: Tile): boolean {
  return openTile(terrain, a) && openTile(terrain, b) && tileDistance(a, b) <= 1;
}

const DIRECTIONS: readonly Tile[] = [
  [0, -1],
  [-1, 0],
  [1, 0],
  [0, 1],
];

/** One deterministic shortest-path step; never commits a speculative move then repairs it. */
export function nextTile(terrain: MatterTerrain, from: Tile, target: Tile): Tile | undefined {
  const queue: { at: Tile; first?: Tile }[] = [{ at: from }];
  const visited = new Set([`${from}`]);
  for (let i = 0; i < queue.length; i++) {
    const entry = queue[i];
    if (!entry) break;
    if (tileReach(terrain, entry.at, target)) return entry.first;
    for (const [dx, dy] of DIRECTIONS) {
      const at: Tile = [entry.at[0] + dx, entry.at[1] + dy];
      if (!openTile(terrain, at) || visited.has(`${at}`)) continue;
      visited.add(`${at}`);
      queue.push({ at, first: entry.first ?? at });
    }
  }
  return undefined;
}
