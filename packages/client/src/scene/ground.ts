/**
 * A stand-in for the states of places, until the world sends them: ground
 * beside a liquid is wet with that liquid, and ground under and around what
 * burns is scorched. Neither names a kind of ground or a thing; both are
 * rough guesses at what the world's own rules (soak, heat) will say.
 */
import type { TileGrid } from "../terrain/grid.ts";
import { kindAt } from "../terrain/kinds.ts";
import { GroundStates } from "../view/ground.ts";
import type { ThingView } from "../view/things.ts";

/** How wet the ground is at one tile and at two tiles from a liquid. */
const SOAKS = [0, 3, 1] as const;
const REACH = SOAKS.length - 1;

function wetFrom(grid: TileGrid, x: number, z: number, ground: GroundStates): void {
  const liquid = kindAt(grid.kindAt(x, z));
  for (let dz = -REACH; dz <= REACH; dz++) {
    for (let dx = -REACH; dx <= REACH; dx++) {
      const [nx, nz] = [x + dx, z + dz];
      if (!grid.contains(nx, nz) || kindAt(grid.kindAt(nx, nz)).liquid) continue;
      const wet = SOAKS[Math.max(Math.abs(dx), Math.abs(dz))] ?? 0;
      if (wet > ground.at(nx, nz).wet) ground.set(nx, nz, { wet, wetInk: liquid.floor });
    }
  }
}

/** Scorches the ground under a burning thing by how hard it burns, and less around it. */
export function scorchAround(ground: GroundStates, thing: ThingView): void {
  const burning = thing.states.burning ?? 0;
  if (burning <= 0) return;
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      const [x, z] = [thing.x + dx, thing.z + dz];
      if (x < 0 || z < 0 || x >= ground.width || z >= ground.depth) continue;
      const scorched = dx === 0 && dz === 0 ? burning : burning - 2;
      if (scorched > ground.at(x, z).scorched) ground.set(x, z, { scorched });
    }
  }
}

export function standInGround(grid: TileGrid, things: readonly ThingView[]): GroundStates {
  const ground = new GroundStates(grid.width, grid.depth);
  for (let z = 0; z < grid.depth; z++) {
    for (let x = 0; x < grid.width; x++) {
      if (kindAt(grid.kindAt(x, z)).liquid) wetFrom(grid, x, z, ground);
    }
  }
  for (const thing of things) scorchAround(ground, thing);
  return ground;
}
