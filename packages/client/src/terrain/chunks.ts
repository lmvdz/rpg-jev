/**
 * Which chunks need rebuilding, in what order, and how many a frame. Edits
 * mark chunks dirty; `pump` sends the nearest dirty ones to the worker and
 * hands back finished meshes a few at a time, so neither a big edit nor a
 * burst of new tiles turns into one long frame.
 */
import type { TileGrid } from "./grid.ts";
import { type ChunkMesh, TESSELLATION_BORDER } from "./tessellate.ts";
import type { ChunkJob, ChunkResult } from "./worker.ts";

export const CHUNK_SIZE = 32;

/** The part of a `Worker` this needs, so a test can stand in for one. */
export interface ChunkWorker {
  postMessage(job: ChunkJob, transfer: Transferable[]): void;
  onmessage: ((event: MessageEvent<ChunkResult>) => void) | null;
}

export type MeshSink = (
  key: number,
  mesh: ChunkMesh,
  originX: number,
  originZ: number,
  size: number,
) => void;

export class ChunkManager {
  readonly chunksX: number;
  readonly chunksZ: number;
  readonly #grid: TileGrid;
  readonly #worker: ChunkWorker;
  readonly #sink: MeshSink;
  readonly #dirty = new Set<number>();
  readonly #done: ChunkResult[] = [];
  #inFlight = 0;

  constructor(grid: TileGrid, worker: ChunkWorker, sink: MeshSink) {
    this.#grid = grid;
    this.#worker = worker;
    this.#sink = sink;
    this.chunksX = Math.ceil(grid.width / CHUNK_SIZE);
    this.chunksZ = Math.ceil(grid.depth / CHUNK_SIZE);
    worker.onmessage = (event) => {
      this.#inFlight--;
      this.#done.push(event.data);
    };
    this.markAllDirty();
  }

  get waiting(): number {
    return this.#dirty.size + this.#inFlight + this.#done.length;
  }

  markAllDirty(): void {
    for (let key = 0; key < this.chunksX * this.chunksZ; key++) this.#dirty.add(key);
  }

  /** A tile changed. Its neighbours' meshes read it too, so chunks within the border go as well. */
  markTileDirty(x: number, z: number): void {
    const reach = TESSELLATION_BORDER;
    const fromX = Math.max(0, Math.floor((x - reach) / CHUNK_SIZE));
    const toX = Math.min(this.chunksX - 1, Math.floor((x + reach) / CHUNK_SIZE));
    const fromZ = Math.max(0, Math.floor((z - reach) / CHUNK_SIZE));
    const toZ = Math.min(this.chunksZ - 1, Math.floor((z + reach) / CHUNK_SIZE));
    for (let cz = fromZ; cz <= toZ; cz++) {
      for (let cx = fromX; cx <= toX; cx++) this.#dirty.add(cz * this.chunksX + cx);
    }
  }

  /** Call once a frame. Builds nearest to (nearX, nearZ) first. */
  pump(nearX: number, nearZ: number, maxInFlight = 4, maxUploads = 4): void {
    for (let i = 0; i < maxUploads; i++) {
      const result = this.#done.shift();
      if (!result) break;
      const cx = result.key % this.chunksX;
      const cz = Math.floor(result.key / this.chunksX);
      this.#sink(result.key, result.mesh, cx * CHUNK_SIZE, cz * CHUNK_SIZE, CHUNK_SIZE);
    }
    while (this.#inFlight < maxInFlight && this.#dirty.size > 0) {
      const key = this.#nearestDirty(nearX, nearZ);
      this.#dirty.delete(key);
      this.#send(key);
    }
  }

  #nearestDirty(nearX: number, nearZ: number): number {
    // Starts from any dirty chunk, so a bad position costs the order and never the build.
    let best = this.#dirty.values().next().value ?? 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const key of this.#dirty) {
      const cx = (key % this.chunksX) + 0.5;
      const cz = Math.floor(key / this.chunksX) + 0.5;
      const distance = Math.hypot(cx * CHUNK_SIZE - nearX, cz * CHUNK_SIZE - nearZ);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = key;
      }
    }
    return best;
  }

  #send(key: number): void {
    const x0 = (key % this.chunksX) * CHUNK_SIZE;
    const z0 = Math.floor(key / this.chunksX) * CHUNK_SIZE;
    const region = this.#grid.region(x0, z0, CHUNK_SIZE, TESSELLATION_BORDER);
    const arrays = {
      heights: region.heights,
      kinds: region.kinds,
      shapes: region.shapes,
      inks: region.inks,
    };
    const job: ChunkJob = {
      key,
      span: region.width,
      width: Math.min(CHUNK_SIZE, this.#grid.width - x0),
      depth: Math.min(CHUNK_SIZE, this.#grid.depth - z0),
      floorLevel: this.#grid.floorLevel,
      arrays,
    };
    this.#inFlight++;
    this.#worker.postMessage(job, [
      arrays.heights.buffer,
      arrays.kinds.buffer,
      arrays.shapes.buffer,
      arrays.inks.buffer,
    ]);
  }
}
