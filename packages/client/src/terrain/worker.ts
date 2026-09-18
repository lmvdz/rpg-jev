/**
 * Chunk rebuilds happen here, off the frame (a performance rule in SPEC.md
 * section 19). The worker keeps no world of its own: each job carries the
 * tiles it needs, so there is no second copy of the grid to fall out of step.
 */
import { type TileArrays, TileGrid } from "./grid.ts";
import { type ChunkMesh, TESSELLATION_BORDER, tessellate } from "./tessellate.ts";

export interface ChunkJob {
  key: number;
  /** Side of the square of tiles sent: the chunk plus its border. */
  span: number;
  /** The part of the chunk that lies inside the world. */
  width: number;
  depth: number;
  floorLevel: number;
  arrays: TileArrays;
}

export interface ChunkResult {
  key: number;
  mesh: ChunkMesh;
}

interface WorkerScope {
  onmessage: ((event: MessageEvent<ChunkJob>) => void) | null;
  postMessage(message: ChunkResult, transfer: Transferable[]): void;
}

const scope = self as unknown as WorkerScope;

scope.onmessage = (event) => {
  const job = event.data;
  const grid = new TileGrid(job.span, job.span, job.arrays);
  grid.floorLevel = job.floorLevel;
  const mesh = tessellate(grid, TESSELLATION_BORDER, TESSELLATION_BORDER, job.width, job.depth);
  scope.postMessage({ key: job.key, mesh }, [mesh.vertices, mesh.indices.buffer]);
};
