/**
 * Milestone J, P4: the teacher's dataset. Grows scenes from seeds [0, --scenes) on the code
 * engine across worker threads and writes each split as flat binary files beside a manifest.
 * Splits come from SHA-256 of the seed (SPEC section 16): 5% validation, 5% (a) familiar; every
 * withheld-family scene goes to (b) and every gap scene to the gap pool, whatever its hash.
 * (a), (b) and the gap pool are sealed: this script writes them and prints only counts and
 * hashes, never a label. Usage:
 *   node packages/predictor/scripts/generate.ts --scenes 1200000 --out <dir>
 */
import { createHash } from "node:crypto";
import {
  createWriteStream,
  mkdirSync,
  readFileSync,
  type WriteStream,
  writeFileSync,
} from "node:fs";
import { availableParallelism } from "node:os";
import { join } from "node:path";
import { isMainThread, parentPort, Worker, workerData } from "node:worker_threads";
import * as jepa from "@rpg-jev/core/jepa";
import { encodeScene, N, ROW_WIDTH } from "../src/encode.ts";

export const SPLITS = ["train", "val", "a", "b", "gap"] as const;
type Split = (typeof SPLITS)[number];
export const SEALED: readonly Split[] = ["a", "b", "gap"];
const FILES = ["rows.f16", "idx.i32", "cat.u8", "num.f16", "meta.u32"] as const;
type File = (typeof FILES)[number];

/** Node's half floats: the TypeScript lib in use does not declare them yet. */
const F16 = (globalThis as unknown as { Float16Array: new (values: number[]) => ArrayBufferView })
  .Float16Array;

export function splitOf(seed: number, family: number, gap: boolean): Split {
  if (gap) return "gap";
  if (family > 0) return "b";
  const bucket = createHash("sha256").update(String(seed)).digest().readUInt32BE(0) % 100;
  if (bucket < 5) return "val";
  if (bucket < 10) return "a";
  return "train";
}

interface Counts {
  rowCount: number;
  samples: number;
  scenes: number;
  uncovered: number;
}

interface Chunk extends Counts {
  rows: number[];
  idx: number[];
  cat: number[];
  num: number[];
  meta: number[];
}

interface Writer extends Counts {
  dir: string;
  streams: Record<File, WriteStream>;
}

const empty = (): Chunk => ({
  ...{ rows: [], idx: [], cat: [], num: [], meta: [] },
  ...{ rowCount: 0, samples: 0, scenes: 0, uncovered: 0 },
});

function addScene(chunk: Chunk, seed: number, e: ReturnType<typeof encodeScene>): void {
  const base = chunk.rowCount;
  for (const row of e.rows) chunk.rows.push(...row);
  chunk.rowCount += e.rows.length;
  chunk.scenes++;
  chunk.uncovered += e.uncovered;
  const shift = (r: number) => (r < 0 ? -1 : r + base);
  for (const s of e.samples) {
    chunk.idx.push(shift(s.self), ...s.neighbours.map(shift), ...s.postNeighbours.map(shift));
    chunk.cat.push(...s.relation, ...s.role, ...s.postRelation, ...s.label);
    chunk.cat.push(s.process, s.selfRole, e.family, e.gap ? 1 : 0);
    chunk.num.push(...s.place, ...s.postPlace, ...s.act, ...s.distance, ...s.postDistance);
    chunk.meta.push(s.legal, seed);
    chunk.samples++;
  }
}

function encodeRange(from: number, to: number): Record<Split, Chunk> {
  const out = Object.fromEntries(SPLITS.map((s) => [s, empty()])) as Record<Split, Chunk>;
  for (let seed = from; seed < to; seed++) {
    const e = encodeScene(jepa.scenario(seed));
    addScene(out[splitOf(seed, e.family, e.gap)], seed, e);
  }
  return out;
}

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? fallback) : fallback;
}

function writerFor(outDir: string, split: Split): Writer {
  const dir = join(outDir, SEALED.includes(split) ? "sealed" : "open", split);
  mkdirSync(dir, { recursive: true });
  const streams = Object.fromEntries(FILES.map((f) => [f, createWriteStream(join(dir, f))]));
  return {
    dir,
    streams: streams as Record<File, WriteStream>,
    rowCount: 0,
    samples: 0,
    scenes: 0,
    uncovered: 0,
  };
}

function append(w: Writer, c: Chunk): void {
  const offset = w.rowCount;
  const bytes = (view: ArrayBufferView) =>
    Buffer.from(view.buffer, view.byteOffset, view.byteLength);
  w.streams["rows.f16"].write(bytes(new F16(c.rows)));
  w.streams["idx.i32"].write(bytes(Int32Array.from(c.idx, (r) => (r < 0 ? -1 : r + offset))));
  w.streams["cat.u8"].write(bytes(Uint8Array.from(c.cat)));
  w.streams["num.f16"].write(bytes(new F16(c.num)));
  w.streams["meta.u32"].write(bytes(Uint32Array.from(c.meta)));
  w.rowCount += c.rowCount;
  w.samples += c.samples;
  w.scenes += c.scenes;
  w.uncovered += c.uncovered;
}

/** Run chunks on worker threads; hand each result on in chunk order, so output is deterministic. */
function runChunks(
  scenes: number,
  chunkSize: number,
  onChunk: (parts: Record<Split, Chunk>) => void,
) {
  const chunks = Math.ceil(scenes / chunkSize);
  const done = new Map<number, Record<Split, Chunk>>();
  let next = 0;
  let written = 0;
  const started = Date.now();
  return new Promise<void>((resolveAll, reject) => {
    let running = 0;
    const launch = () => {
      if (next >= chunks) {
        if (running === 0) resolveAll();
        return;
      }
      const id = next++;
      running++;
      const range = { from: id * chunkSize, to: Math.min(scenes, (id + 1) * chunkSize) };
      const worker = new Worker(new URL(import.meta.url), { workerData: range });
      worker.once("message", (parts: Record<Split, Chunk>) => {
        done.set(id, parts);
        for (let ready = done.get(written); ready; ready = done.get(written)) {
          done.delete(written++);
          onChunk(ready);
          if (written % 10 === 0)
            console.log(
              `${written}/${chunks} chunks, ${Math.round((Date.now() - started) / 1000)} s`,
            );
        }
      });
      worker.once("error", reject);
      worker.once("exit", () => {
        running--;
        launch();
      });
    };
    for (let i = 0; i < Math.max(1, availableParallelism() - 2); i++) launch();
  });
}

function writeManifest(outDir: string, scenes: number, writers: Record<Split, Writer>): void {
  const sha256 = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");
  const splits = Object.fromEntries(
    SPLITS.map((split) => {
      const w = writers[split];
      const files = Object.fromEntries(FILES.map((f) => [f, sha256(join(w.dir, f))]));
      const sealed = SEALED.includes(split);
      // Coverage is a count, not a label; for sealed splits it is measured at the gate.
      const summary = { scenes: w.scenes, rows: w.rowCount, samples: w.samples };
      return [
        split,
        { dir: w.dir, sealed, ...summary, ...(sealed ? {} : { uncovered: w.uncovered }), files },
      ];
    }),
  );
  const manifest = {
    version: "jepa-dataset-v1",
    scenes,
    seeds: [0, scenes],
    observation: jepa.OBSERVATION_VERSION,
    outcomes: jepa.OUTCOMES_VERSION,
    scenario: jepa.SCENARIO_VERSION,
    layout: {
      rowWidth: ROW_WIDTH,
      idx: 1 + 2 * N,
      cat: 4 * N + 4,
      num: 12 + jepa.ACT_FEATURES.length + 2 * N,
      meta: 2,
    },
    split:
      "sha256(String(seed))[0..4] big-endian % 100: <5 val, <10 a, else train; family -> b; gap -> gap",
    splits,
  };
  writeFileSync(join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  for (const split of SPLITS) {
    const w = writers[split];
    const note = SEALED.includes(split) ? "(sealed)" : `uncovered ${w.uncovered}`;
    console.log(split, w.scenes, "scenes", w.samples, "samples", note);
  }
}

async function main(): Promise<void> {
  const scenes = Number(arg("scenes", "1200000"));
  const outDir = arg("out", "H:/rpg-jev.worktrees/jepa-data/v1");
  const writers = Object.fromEntries(SPLITS.map((s) => [s, writerFor(outDir, s)])) as Record<
    Split,
    Writer
  >;
  await runChunks(scenes, 10_000, (parts) => {
    for (const split of SPLITS) append(writers[split], parts[split]);
  });
  await Promise.all(
    SPLITS.flatMap((s) =>
      FILES.map((f) => new Promise<void>((r) => writers[s].streams[f].end(() => r()))),
    ),
  );
  writeManifest(outDir, scenes, writers);
}

if (isMainThread) await main();
else {
  const { from, to } = workerData as { from: number; to: number };
  parentPort?.postMessage(encodeRange(from, to));
}
