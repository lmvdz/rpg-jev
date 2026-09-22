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
import { createWriteStream, mkdirSync, type WriteStream, writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { join } from "node:path";
import { isMainThread, parentPort, Worker, workerData } from "node:worker_threads";
import * as jepa from "@rpg-jev/core/jepa";
import { encodeScene, N, ROW_WIDTH } from "../src/encode.ts";
import {
  addScene,
  type Chunk,
  type Counts,
  chunkFiles,
  emptyChunk,
  FILES,
  type ShardFile,
  sha256File,
} from "../src/shards.ts";

export const SPLITS = ["train", "val", "a", "b", "gap"] as const;
type Split = (typeof SPLITS)[number];
export const SEALED: readonly Split[] = ["a", "b", "gap"];

export function splitOf(seed: number, family: number, gap: boolean): Split {
  if (gap) return "gap";
  if (family > 0) return "b";
  const bucket = createHash("sha256").update(String(seed)).digest().readUInt32BE(0) % 100;
  if (bucket < 5) return "val";
  if (bucket < 10) return "a";
  return "train";
}

interface Writer extends Counts {
  dir: string;
  streams: Record<ShardFile, WriteStream>;
}

function encodeRange(from: number, to: number): Record<Split, Chunk> {
  const out = Object.fromEntries(SPLITS.map((s) => [s, emptyChunk()])) as Record<Split, Chunk>;
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
  const counts = { rowCount: 0, samples: 0, scenes: 0, uncovered: 0 };
  return { dir, streams: streams as Record<ShardFile, WriteStream>, ...counts };
}

function append(w: Writer, c: Chunk): void {
  const files = chunkFiles(c, w.rowCount);
  for (const f of FILES) w.streams[f].write(files[f]);
  w.rowCount += c.rowCount;
  w.samples += c.samples;
  w.scenes += c.scenes;
  w.uncovered += c.uncovered;
}

/** Run chunks on worker threads; hand each result on in chunk order, so output is deterministic. */
function runChunks(
  first: number,
  scenes: number,
  size: number,
  onChunk: (parts: Record<Split, Chunk>) => void,
) {
  const chunks = Math.ceil(scenes / size);
  const done = new Map<number, Record<Split, Chunk>>();
  let next = 0;
  let written = 0;
  const started = Date.now();
  const deliver = () => {
    for (let ready = done.get(written); ready; ready = done.get(written)) {
      done.delete(written++);
      onChunk(ready);
      if (written % 10 === 0)
        console.log(`${written}/${chunks} chunks, ${Math.round((Date.now() - started) / 1000)} s`);
    }
  };
  return new Promise<void>((resolveAll, reject) => {
    let running = 0;
    const launch = () => {
      if (next >= chunks) {
        if (running === 0) resolveAll();
        return;
      }
      const id = next++;
      running++;
      const range = { from: first + id * size, to: first + Math.min(scenes, (id + 1) * size) };
      const worker = new Worker(new URL(import.meta.url), { workerData: range });
      worker.once("message", (parts: Record<Split, Chunk>) => {
        done.set(id, parts);
        deliver();
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

function writeManifest(
  outDir: string,
  first: number,
  scenes: number,
  writers: Record<Split, Writer>,
): void {
  const splits = Object.fromEntries(
    SPLITS.map((split) => {
      const w = writers[split];
      const files = Object.fromEntries(FILES.map((f) => [f, sha256File(join(w.dir, f))]));
      const sealed = SEALED.includes(split);
      // Coverage is a count, not a label; for sealed splits it is measured at the gate.
      const summary = { scenes: w.scenes, rows: w.rowCount, samples: w.samples };
      const coverage = sealed ? {} : { uncovered: w.uncovered };
      return [split, { dir: w.dir, sealed, ...summary, ...coverage, files }];
    }),
  );
  const manifest = {
    version: "jepa-dataset-v1",
    scenes,
    seeds: [first, first + scenes],
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
    split: "sha256(String(seed))[0..4] BE % 100: <5 val, <10 a, else train; family: b; gap: gap",
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
  // Seeds [from, from + scenes): fresh seeds for more data under the same split rule.
  const first = Number(arg("from", "0"));
  const outDir = arg("out", "H:/rpg-jev.worktrees/jepa-data/v1");
  const writers = Object.fromEntries(SPLITS.map((s) => [s, writerFor(outDir, s)]));
  const bySplit = writers as Record<Split, Writer>;
  await runChunks(first, scenes, 10_000, (parts) => {
    for (const split of SPLITS) append(bySplit[split], parts[split]);
  });
  const ends = SPLITS.flatMap((s) =>
    FILES.map((f) => new Promise<void>((r) => bySplit[s].streams[f].end(() => r()))),
  );
  await Promise.all(ends);
  writeManifest(outDir, first, scenes, bySplit);
}

if (isMainThread) await main();
else {
  const { from, to } = workerData as { from: number; to: number };
  parentPort?.postMessage(encodeRange(from, to));
}
