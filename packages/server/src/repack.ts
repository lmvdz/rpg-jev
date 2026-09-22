/**
 * Offline candidate-copy tool, NOT a live-journal replacement or checkpoint.
 * Usage: node packages/server/src/repack.ts SOURCE NEW-TARGET NEW-REPORT
 * Never changes the source. Replay must independently accept the candidate.
 * A complete copy does not prove the latest host frontier.
 */
import { createHash } from "node:crypto";
import {
  closeSync,
  existsSync,
  fstatSync,
  fsyncSync,
  linkSync,
  openSync,
  readSync,
  unlinkSync,
  writeSync,
} from "node:fs";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";
import { decodeArchivePayload, encodeArchivePayload } from "./archive-payload.ts";

export const REPACK_LIMITS = Object.freeze({
  sourceBytes: 2 * 1024 * 1024 * 1024,
  lineBytes: 1024 * 1024,
  events: 1_000_000,
  milliseconds: 120_000,
  chunkBytes: 64 * 1024,
});

export interface RepackReport {
  version: 1;
  complete: boolean;
  candidateOnly: true;
  source: string;
  target: string;
  partial: string;
  events: number;
  beforeBytes: number;
  afterBytes: number;
  generation?: string;
  firstSequence?: string;
  lastSequence?: string;
  logicalRowsSha256?: string;
  milliseconds: number;
  errorCode?: string;
}

class RepackError extends Error {}
function check(ok: boolean, code: string): asserts ok {
  if (!ok) throw new RepackError(code);
}

function writeAll(fd: number, bytes: Uint8Array): void {
  let offset = 0;
  while (offset < bytes.length) {
    const count = writeSync(fd, bytes, offset, bytes.length - offset);
    check(count > 0, "write-no-progress");
    offset += count;
  }
}

function logicalRow(bytes: Uint8Array): { generation: string; seq: string; payload: string } {
  const row: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  check(typeof row === "object" && row !== null && !Array.isArray(row), "invalid-row");
  check(
    "generation" in row &&
      typeof row.generation === "string" &&
      /^[0-9a-f]{64}$/.test(row.generation),
    "invalid-generation",
  );
  check(
    "seq" in row && typeof row.seq === "string" && /^(0|[1-9]\d{0,19})$/.test(row.seq),
    "invalid-sequence",
  );
  check(BigInt(row.seq) <= 0xffffffffffffffffn, "invalid-sequence");
  check("payload" in row && typeof row.payload === "string", "invalid-payload");
  check(
    Object.keys(row).every((key) => ["generation", "seq", "payload", "encoding"].includes(key)),
    "unknown-row-field",
  );
  const encoding = "encoding" in row ? row.encoding : undefined;
  return {
    generation: row.generation,
    seq: row.seq,
    payload: decodeArchivePayload({ payload: row.payload, encoding }),
  };
}

function copyRows(source: number, output: number, report: RepackReport, start: number): void {
  const chunk = Buffer.alloc(REPACK_LIMITS.chunkBytes);
  const line = Buffer.alloc(REPACK_LIMITS.lineBytes);
  const hash = createHash("sha256");
  let length = 0;
  let previous = -1n;
  const consume = () => {
    check(performance.now() - start <= REPACK_LIMITS.milliseconds, "time-limit");
    check(report.events < REPACK_LIMITS.events, "event-limit");
    const row = logicalRow(line.subarray(0, length));
    check(
      report.generation === undefined || row.generation === report.generation,
      "mixed-generations",
    );
    check(BigInt(row.seq) > previous, "nonincreasing-sequence");
    const stored = encodeArchivePayload(row.payload);
    const encoded = Buffer.from(
      `${JSON.stringify({ generation: row.generation, seq: row.seq, ...stored })}\n`,
    );
    check(encoded.length - 1 <= REPACK_LIMITS.lineBytes, "output-line-limit");
    writeAll(output, encoded);
    hash.update(`${JSON.stringify(row)}\n`);
    previous = BigInt(row.seq);
    report.generation = row.generation;
    report.firstSequence ??= row.seq;
    report.lastSequence = row.seq;
    report.afterBytes += encoded.length;
    report.events++;
    length = 0;
  };
  while (true) {
    check(performance.now() - start <= REPACK_LIMITS.milliseconds, "time-limit");
    const count = readSync(source, chunk);
    if (count === 0) break;
    report.beforeBytes += count;
    check(report.beforeBytes <= REPACK_LIMITS.sourceBytes, "source-size-limit");
    let offset = 0;
    while (offset < count) {
      const newline = chunk.indexOf(10, offset);
      const end = newline < 0 || newline >= count ? count : newline;
      check(length + end - offset <= REPACK_LIMITS.lineBytes, "input-line-limit");
      chunk.copy(line, length, offset, end);
      length += end - offset;
      offset = end + 1;
      if (end < count) consume();
    }
  }
  check(length === 0, "incomplete-tail");
  check(report.events > 0, "empty-archive");
  report.logicalRowsSha256 = hash.digest("hex");
}

/** Exclusive paths; failures retain a .partial candidate and a failed report when possible. */
export function repackArchive(
  sourcePath: string,
  targetPath: string,
  reportPath: string,
): RepackReport {
  const source = resolve(sourcePath);
  const target = resolve(targetPath);
  const resultPath = resolve(reportPath);
  const partial = `${target}.partial`;
  check(new Set([source, target, resultPath, partial]).size === 4, "paths-must-differ");
  for (const path of [target, resultPath, partial])
    check(!existsSync(path), "output-already-exists");
  const reportFd = openSync(resultPath, "wx");
  const start = performance.now();
  const report: RepackReport = {
    version: 1,
    complete: false,
    candidateOnly: true,
    source,
    target,
    partial,
    events: 0,
    beforeBytes: 0,
    afterBytes: 0,
    milliseconds: 0,
  };
  let input: number | undefined;
  let output: number | undefined;
  try {
    input = openSync(source, "r");
    const before = fstatSync(input);
    check(before.isFile(), "source-not-file");
    check(before.size <= REPACK_LIMITS.sourceBytes, "source-size-limit");
    output = openSync(partial, "wx");
    copyRows(input, output, report, start);
    const after = fstatSync(input);
    check(
      before.size === after.size &&
        before.mtimeMs === after.mtimeMs &&
        before.ctimeMs === after.ctimeMs &&
        report.beforeBytes === before.size,
      "source-changed",
    );
    fsyncSync(output);
    check(performance.now() - start <= REPACK_LIMITS.milliseconds, "time-limit");
    // linkSync is exclusive even if another process creates target after our preflight.
    // Staging is in the same directory/filesystem; a failed publication retains it.
    linkSync(partial, target);
    unlinkSync(partial);
    report.complete = true;
  } catch (error) {
    report.errorCode = error instanceof RepackError ? error.message : "repack-failed";
  } finally {
    if (input !== undefined) closeSync(input);
    if (output !== undefined) {
      report.afterBytes = fstatSync(output).size;
      closeSync(output);
    }
    report.milliseconds = performance.now() - start;
    try {
      writeAll(reportFd, Buffer.from(`${JSON.stringify(report, null, 2)}\n`));
      fsyncSync(reportFd);
    } finally {
      closeSync(reportFd);
    }
  }
  check(report.complete, "repack-failed-see-report");
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [source, target, report] = process.argv.slice(2);
  if (!(source && target && report) || process.argv.length !== 5) {
    console.error("Usage: node repack.ts SOURCE NEW-TARGET NEW-REPORT");
    process.exitCode = 1;
  } else {
    try {
      repackArchive(source, target, report);
      console.log("Candidate copy complete; independent replay is required.");
    } catch {
      console.error(
        "Repack failed. Existing files were not overwritten; inspect the reserved report and .partial file.",
      );
      process.exitCode = 1;
    }
  }
}
