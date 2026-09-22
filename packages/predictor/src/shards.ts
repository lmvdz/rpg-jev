/**
 * The dataset's binary layout (milestone J): per split, five flat files that `train/data.py`
 * reads back. A chunk is built in memory, then written in one go or appended to streams.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { Encoded } from "./encode.ts";

export const sha256File = (path: string) =>
  createHash("sha256").update(readFileSync(path)).digest("hex");

export const FILES = ["rows.f16", "idx.i32", "cat.u8", "num.f16", "meta.u32"] as const;
export type ShardFile = (typeof FILES)[number];

/** Node's half floats: the TypeScript lib in use does not declare them yet. */
const F16 = (globalThis as unknown as { Float16Array: new (values: number[]) => ArrayBufferView })
  .Float16Array;

export interface Counts {
  rowCount: number;
  samples: number;
  scenes: number;
  uncovered: number;
}

export interface Chunk extends Counts {
  rows: number[];
  idx: number[];
  cat: number[];
  num: number[];
  meta: number[];
}

export const emptyChunk = (): Chunk => ({
  ...{ rows: [], idx: [], cat: [], num: [], meta: [] },
  ...{ rowCount: 0, samples: 0, scenes: 0, uncovered: 0 },
});

/** Add one encoded scene. `labels` replaces the engine's labels, by sample, when given. */
export function addScene(
  chunk: Chunk,
  seed: number,
  e: Encoded,
  labels?: readonly (readonly number[])[],
): void {
  const base = chunk.rowCount;
  for (const row of e.rows) chunk.rows.push(...row);
  chunk.rowCount += e.rows.length;
  chunk.scenes++;
  chunk.uncovered += e.uncovered;
  const shift = (r: number) => (r < 0 ? -1 : r + base);
  e.samples.forEach((s, i) => {
    chunk.idx.push(shift(s.self), ...s.neighbours.map(shift), ...s.postNeighbours.map(shift));
    chunk.cat.push(...s.relation, ...s.role, ...s.postRelation, ...(labels?.[i] ?? s.label));
    chunk.cat.push(s.process, s.selfRole, e.family, e.gap ? 1 : 0);
    chunk.num.push(...s.place, ...s.postPlace, ...s.act, ...s.distance, ...s.postDistance);
    chunk.meta.push(s.legal, seed);
    chunk.samples++;
  });
}

const bytes = (view: ArrayBufferView) => Buffer.from(view.buffer, view.byteOffset, view.byteLength);

/** The chunk as file contents, its row indices shifted by `offset` rows already written. */
export function chunkFiles(c: Chunk, offset = 0): Record<ShardFile, Buffer> {
  return {
    "rows.f16": bytes(new F16(c.rows)),
    "idx.i32": bytes(Int32Array.from(c.idx, (r) => (r < 0 ? -1 : r + offset))),
    "cat.u8": bytes(Uint8Array.from(c.cat)),
    "num.f16": bytes(new F16(c.num)),
    "meta.u32": bytes(Uint32Array.from(c.meta)),
  };
}
