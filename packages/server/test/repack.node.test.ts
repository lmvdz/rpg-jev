import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs, {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import test from "node:test";
import { decodeArchivePayload, encodeArchivePayload } from "../src/archive-payload.ts";
import { SERVER_DIR } from "../src/cli.ts";
import { REPACK_LIMITS, repackArchive } from "../src/repack.ts";

const generation = "a".repeat(64);
const row = (seq: string, payload = "quiet drift".repeat(10000)) => ({ generation, seq, payload });
const line = (value: unknown) => `${JSON.stringify(value)}\n`;

function fixture(run: (source: string, target: string, report: string) => void): void {
  const root = join(SERVER_DIR, ".stdb", "test");
  mkdirSync(root, { recursive: true });
  const directory = mkdtempSync(join(root, "repack-"));
  try {
    run(
      join(directory, "source.jsonl"),
      join(directory, "candidate.jsonl"),
      join(directory, "report.json"),
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test("mixed copy preserves logical rows/hash, accepts physical gaps, and never alters source", () =>
  fixture((source, target, reportPath) => {
    const logical = [row("1"), row("2049", "\ud800"), row("2050", "😀".repeat(20000))];
    const before = logical
      .map((value, i) =>
        line(i === 2 ? { ...value, ...encodeArchivePayload(value.payload) } : value),
      )
      .join("");
    writeFileSync(source, before);
    const report = repackArchive(source, target, reportPath);
    assert.equal(report.complete, true);
    assert.equal(report.candidateOnly, true);
    assert.equal(report.events, 3);
    assert.equal(report.beforeBytes, Buffer.byteLength(before));
    assert.equal(report.afterBytes, statSync(target).size);
    assert.ok(report.afterBytes < report.beforeBytes);
    assert.equal(report.firstSequence, "1");
    assert.equal(report.lastSequence, "2050");
    assert.equal(
      report.logicalRowsSha256,
      createHash("sha256").update(logical.map(line).join("")).digest("hex"),
    );
    assert.equal(readFileSync(source, "utf8"), before);
    const restored = readFileSync(target, "utf8")
      .trimEnd()
      .split("\n")
      .map((text) => {
        const value = JSON.parse(text);
        return {
          generation: value.generation,
          seq: value.seq,
          payload: decodeArchivePayload(value),
        };
      });
    assert.deepEqual(restored, logical);
    assert.deepEqual(JSON.parse(readFileSync(reportPath, "utf8")), report);
    assert.equal(existsSync(`${target}.partial`), false);
  }));

test("existing source/target/report/partial are never overwritten", () => {
  for (const existing of ["target", "report", "partial"] as const)
    fixture((source, target, report) => {
      writeFileSync(source, line(row("1")));
      const protectedPath = { target, report, partial: `${target}.partial` }[existing];
      writeFileSync(protectedPath, "protected");
      assert.throws(() => repackArchive(source, target, report), /already-exists/);
      assert.equal(readFileSync(protectedPath, "utf8"), "protected");
      assert.equal(readFileSync(source, "utf8"), line(row("1")));
      assert.throws(() => repackArchive(source, source, report), /paths-must-differ/);
    });
});

test("invalid rows, encoding, generation, order, UTF-8 and incomplete tails leave failed copies", () => {
  const invalid = [
    "",
    line(row("2")) + line(row("1")),
    line(row("1")) + line(row("1")),
    line({ ...row("1"), seq: "01" }),
    line({ ...row("1"), seq: "18446744073709551616" }),
    line(row("1")) + line({ ...row("2"), generation: "b".repeat(64) }),
    line({ ...row("1"), encoding: "future" }),
    line({ ...row("1"), extra: true }),
    line({ ...row("1"), encoding: "gzip-base64-v1", payload: "invalid" }),
    `${line(row("1"))}{"secret":"never print this`,
    Buffer.concat([Buffer.from('{"payload":"'), Buffer.from([0xff]), Buffer.from('"}\n')]),
  ];
  for (const content of invalid)
    fixture((source, target, reportPath) => {
      writeFileSync(source, content);
      assert.throws(() => repackArchive(source, target, reportPath));
      assert.equal(existsSync(target), false);
      assert.equal(existsSync(`${target}.partial`), true);
      const report = JSON.parse(readFileSync(reportPath, "utf8"));
      assert.equal(report.complete, false);
      assert.equal(typeof report.errorCode, "string");
      assert.ok(!JSON.stringify(report).includes("never print this"));
      assert.deepEqual(readFileSync(source), Buffer.from(content));
    });
});

test("input line bound rejects rather than truncating; source byte bound checked before reading", (context) => {
  fixture((source, target, reportPath) => {
    writeFileSync(source, "x".repeat(REPACK_LIMITS.lineBytes + 1));
    assert.throws(() => repackArchive(source, target, reportPath));
    assert.equal(JSON.parse(readFileSync(reportPath, "utf8")).errorCode, "input-line-limit");
  });
  fixture((source, target, reportPath) => {
    writeFileSync(source, line(row("1")));
    const original = fs.fstatSync;
    const stat = context.mock.method(fs, "fstatSync", (fd: number) => {
      const result = original(fd);
      result.size = REPACK_LIMITS.sourceBytes + 1;
      return result;
    });
    syncBuiltinESMExports();
    try {
      assert.throws(() => repackArchive(source, target, reportPath));
      assert.equal(JSON.parse(readFileSync(reportPath, "utf8")).errorCode, "source-size-limit");
      assert.equal(existsSync(`${target}.partial`), false);
    } finally {
      stat.mock.restore();
      syncBuiltinESMExports();
    }
  });
});

test("publication cannot overwrite a racing target and fsync failure cannot publish", (context) => {
  fixture((source, target, reportPath) => {
    writeFileSync(source, line(row("1")));
    const original = fs.linkSync;
    const link = context.mock.method(fs, "linkSync", (from: string, to: string) => {
      writeFileSync(to, "another writer", { flag: "wx" });
      return original(from, to);
    });
    syncBuiltinESMExports();
    try {
      assert.throws(() => repackArchive(source, target, reportPath));
      assert.equal(readFileSync(target, "utf8"), "another writer");
      assert.equal(JSON.parse(readFileSync(reportPath, "utf8")).complete, false);
      assert.equal(existsSync(`${target}.partial`), true);
    } finally {
      link.mock.restore();
      syncBuiltinESMExports();
    }
  });
  fixture((source, target, reportPath) => {
    writeFileSync(source, line(row("1")));
    const original = fs.fsyncSync;
    let calls = 0;
    const sync = context.mock.method(fs, "fsyncSync", (fd: number) => {
      if (calls++ === 0) throw new Error("injected fsync failure");
      return original(fd);
    });
    syncBuiltinESMExports();
    try {
      assert.throws(() => repackArchive(source, target, reportPath));
      assert.equal(existsSync(target), false);
      assert.equal(existsSync(`${target}.partial`), true);
      assert.equal(JSON.parse(readFileSync(reportPath, "utf8")).complete, false);
    } finally {
      sync.mock.restore();
      syncBuiltinESMExports();
    }
  });
});

test("CLI requires new paths and emits no malformed payload content", () =>
  fixture((source, target, report) => {
    writeFileSync(source, '{"private":"must never appear');
    const cli = join(SERVER_DIR, "src", "repack.ts");
    const failed = spawnSync(process.execPath, [cli, source, target, report], { encoding: "utf8" });
    assert.equal(failed.status, 1);
    assert.ok(!`${failed.stdout}${failed.stderr}`.includes("must never appear"));
    const missing = spawnSync(process.execPath, [cli], { encoding: "utf8" });
    assert.equal(missing.status, 1);
  }));

test("time and source-change bounds prevent publication", (context) => {
  fixture((source, target, reportPath) => {
    writeFileSync(source, line(row("1")));
    let calls = 0;
    const clock = context.mock.method(performance, "now", () =>
      calls++ === 0 ? 0 : REPACK_LIMITS.milliseconds + 1,
    );
    try {
      assert.throws(() => repackArchive(source, target, reportPath));
      assert.equal(JSON.parse(readFileSync(reportPath, "utf8")).errorCode, "time-limit");
      assert.equal(existsSync(target), false);
    } finally {
      clock.mock.restore();
    }
  });
  fixture((source, target, reportPath) => {
    writeFileSync(source, line(row("1")));
    const original = fs.fstatSync;
    let calls = 0;
    const stat = context.mock.method(fs, "fstatSync", (fd: number) => {
      const result = original(fd);
      if (calls++ === 1) result.size++;
      return result;
    });
    syncBuiltinESMExports();
    try {
      assert.throws(() => repackArchive(source, target, reportPath));
      assert.equal(JSON.parse(readFileSync(reportPath, "utf8")).errorCode, "source-changed");
      assert.equal(existsSync(target), false);
    } finally {
      stat.mock.restore();
      syncBuiltinESMExports();
    }
  });
});

test("short writes complete and output is synced before exclusive publication", (context) =>
  fixture((source, target, reportPath) => {
    writeFileSync(source, line(row("1")));
    const originalWrite = fs.writeSync;
    const originalSync = fs.fsyncSync;
    const originalLink = fs.linkSync;
    let synced = false;
    const write = context.mock.method(
      fs,
      "writeSync",
      (fd: number, bytes: Uint8Array, offset: number, length: number) =>
        originalWrite(fd, bytes, offset, Math.min(length, 7)),
    );
    const sync = context.mock.method(fs, "fsyncSync", (fd: number) => {
      originalSync(fd);
      synced = true;
    });
    const link = context.mock.method(fs, "linkSync", (from: string, to: string) => {
      assert.equal(synced, true);
      return originalLink(from, to);
    });
    syncBuiltinESMExports();
    try {
      assert.equal(repackArchive(source, target, reportPath).complete, true);
      assert.ok(write.mock.callCount() > 2);
      assert.equal(
        decodeArchivePayload(JSON.parse(readFileSync(target, "utf8"))),
        row("1").payload,
      );
    } finally {
      write.mock.restore();
      sync.mock.restore();
      link.mock.restore();
      syncBuiltinESMExports();
    }
  }));
