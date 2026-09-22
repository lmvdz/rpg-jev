import assert from "node:assert/strict";
import fs, { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { join } from "node:path";
import test from "node:test";
import {
  ArchiveJournal,
  archivePath,
  MAX_ARCHIVE_BATCH_EVENTS,
  MAX_ARCHIVE_EVENTS,
  MAX_ARCHIVE_LINE_BYTES,
} from "../src/archive.ts";
import { DATABASE, HOST, HTTP_URL, SERVER_DIR } from "../src/cli.ts";
import { nodeImports } from "../src/publish.ts";

const generation = "a".repeat(64);
const otherGeneration = "b".repeat(64);
const event = (seq: bigint, payload: string, world = generation) => ({
  generation: world,
  seq,
  payload,
});
const record = (seq: bigint, payload: string, world = generation) =>
  `${JSON.stringify({ generation: world, seq: seq.toString(), payload })}\n`;

function fixture(run: (directory: string, path: string) => void): void {
  const root = join(SERVER_DIR, ".stdb", "test");
  mkdirSync(root, { recursive: true });
  const dir = mkdtempSync(join(root, "archive-"));
  try {
    run(dir, archivePath(dir, generation));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("workflow target is the dedicated loopback world", () => {
  assert.equal(HOST, "127.0.0.1:3057");
  assert.equal(HTTP_URL, "http://127.0.0.1:3057");
  assert.equal(DATABASE, "rpg-open-world");
});

test("binding imports get exactly one extension, including re-exports", () => {
  const source = [
    'import { A } from "./a";',
    "export * from '../types';",
    'import "./side-effect";',
    'const dynamic = import("./dynamic");',
    'export * from "./already.ts";',
    'import { Identity } from "spacetimedb";',
  ].join("\n");
  const patched = nodeImports(source);
  assert.match(patched, /from "\.\/a\.ts"/);
  assert.match(patched, /from '\.\.\/types\.ts'/);
  assert.match(patched, /import "\.\/side-effect\.ts"/);
  assert.match(patched, /import\("\.\/dynamic\.ts"\)/);
  assert.equal(nodeImports(patched), patched);
  assert.match(patched, /from "spacetimedb"/);
});

test("journal sorts bigint sequences and preserves exact payloads", () =>
  fixture((dir, path) => {
    const journal = new ArchiveJournal(dir, generation);
    try {
      const large = 9007199254740993n;
      assert.equal(
        journal.persist([event(large, '{"immutable":"\\n"}'), event(1n, "first\nline")]),
        large,
      );
      assert.equal(
        readFileSync(path, "utf8"),
        record(1n, "first\nline") + record(large, '{"immutable":"\\n"}'),
      );
    } finally {
      journal.close();
    }
  }));

test("lost acknowledgement is replayable without appending duplicates, including after restart", () =>
  fixture((dir, path) => {
    const rows = [event(1n, "one"), event(2n, "two")];
    const first = new ArchiveJournal(dir, generation);
    first.persist(rows);
    const saved = readFileSync(path, "utf8");
    assert.equal(first.persist(rows), 2n);
    first.close();
    const restarted = new ArchiveJournal(dir, generation);
    try {
      assert.equal(restarted.persist(rows), 2n);
      assert.equal(readFileSync(path, "utf8"), saved);
      assert.equal(restarted.persist([]), undefined);
    } finally {
      restarted.close();
    }
  }));

test("conflicting sequences stop the archive without replacing saved rows", () =>
  fixture((dir, path) => {
    const journal = new ArchiveJournal(dir, generation);
    try {
      journal.persist([event(4n, "original")]);
      const saved = readFileSync(path, "utf8");
      assert.throws(() => journal.persist([event(4n, "changed")]), /Conflicting/);
      assert.throws(() => journal.persist([event(4n, "original")]), /reopened/);
      assert.equal(readFileSync(path, "utf8"), saved);
    } finally {
      journal.close();
    }
  }));

test("an unseen sequence below the archived frontier is not acknowledged", () =>
  fixture((dir) => {
    const journal = new ArchiveJournal(dir, generation);
    try {
      journal.persist([event(4n, "original")]);
      assert.throws(() => journal.persist([event(3n, "late")]), /out of order/);
    } finally {
      journal.close();
    }
  }));

test("existing duplicates work; conflicts, wrong generations, invalid UTF-8 and torn tails fail closed", () =>
  fixture((dir, path) => {
    const row = record(1n, "one");
    writeFileSync(path, row + row);
    const journal = new ArchiveJournal(dir, generation);
    journal.persist([event(1n, "one")]);
    journal.close();
    assert.equal(readFileSync(path, "utf8"), row + row);
    for (const bad of [
      Buffer.from(row + record(1n, "other")),
      Buffer.from(`${row}{"seq":`),
      Buffer.from(record(1n, "one", otherGeneration)),
      Buffer.concat([Buffer.from(row.slice(0, -3)), Buffer.from([0xff]), Buffer.from('"}\n')]),
    ]) {
      writeFileSync(path, bad);
      assert.throws(() => new ArchiveJournal(dir, generation));
      assert.deepEqual(readFileSync(path), bad);
    }
  }));

test("only one process may own each generation journal", () =>
  fixture((dir) => {
    const journal = new ArchiveJournal(dir, generation);
    try {
      assert.throws(() => new ArchiveJournal(dir, generation), /EEXIST/);
    } finally {
      journal.close();
    }
    new ArchiveJournal(dir, generation).close();
  }));

test("an fsync failure returns no acknowledgement and poisons the writer until reopen", (context) =>
  fixture((dir, path) => {
    const journal = new ArchiveJournal(dir, generation);
    const sync = context.mock.method(fs, "fsyncSync", () => {
      throw new Error("simulated sync failure");
    });
    syncBuiltinESMExports();
    try {
      assert.throws(() => journal.persist([event(1n, "one")]), /sync failure/);
      assert.equal(sync.mock.callCount(), 1);
      assert.throws(() => journal.persist([event(1n, "one")]), /reopened/);
    } finally {
      sync.mock.restore();
      syncBuiltinESMExports();
      journal.close();
    }
    const reopened = new ArchiveJournal(dir, generation);
    try {
      assert.equal(reopened.persist([event(1n, "one")]), 1n);
      assert.equal(readFileSync(path, "utf8"), record(1n, "one"));
    } finally {
      reopened.close();
    }
  }));

test("partial writes are completed before fsync and acknowledgement", (context) =>
  fixture((dir, path) => {
    const journal = new ArchiveJournal(dir, generation);
    const originalWrite = fs.writeSync;
    const originalSync = fs.fsyncSync;
    let writes = 0;
    let synced = false;
    const write = context.mock.method(
      fs,
      "writeSync",
      (fd: number, buffer: Uint8Array, offset: number, length: number) => {
        writes++;
        return originalWrite(fd, buffer, offset, Math.min(length, 3));
      },
    );
    const sync = context.mock.method(fs, "fsyncSync", (fd: number) => {
      assert.equal(readFileSync(path, "utf8"), record(1n, "one"));
      originalSync(fd);
      synced = true;
    });
    syncBuiltinESMExports();
    try {
      assert.equal(journal.persist([event(1n, "one")]), 1n);
      assert.ok(writes > 1);
      assert.ok(synced);
    } finally {
      write.mock.restore();
      sync.mock.restore();
      syncBuiltinESMExports();
      journal.close();
    }
  }));

test("generations have separate files and independent sequence spaces", () =>
  fixture((dir, path) => {
    const first = new ArchiveJournal(dir, generation);
    const second = new ArchiveJournal(dir, otherGeneration);
    try {
      assert.equal(first.persist([event(1n, "old world")]), 1n);
      assert.equal(second.persist([event(1n, "new world", otherGeneration)]), 1n);
      assert.equal(readFileSync(path, "utf8"), record(1n, "old world"));
      assert.equal(
        readFileSync(archivePath(dir, otherGeneration), "utf8"),
        record(1n, "new world", otherGeneration),
      );
    } finally {
      first.close();
      second.close();
    }
  }));

test("generation is strictly canonical 64 hex characters, never a path", () =>
  fixture((dir) => {
    for (const bad of [
      "",
      "../escape",
      "a".repeat(63),
      "a".repeat(65),
      "A".repeat(64),
      "g".repeat(64),
      `${generation}\n`,
      `0x${generation}`,
    ]) {
      assert.throws(() => archivePath(dir, bad), /generation/);
      assert.throws(() => new ArchiveJournal(dir, bad), /generation/);
    }
    assert.equal(archivePath(dir, generation), join(dir, `${DATABASE}-${generation}.jsonl`));
  }));

test("mixed batches reject before writing even their valid prefix", () =>
  fixture((dir, path) => {
    const journal = new ArchiveJournal(dir, generation);
    try {
      assert.throws(
        () => journal.persist([event(1n, "valid"), event(2n, "wrong", otherGeneration)]),
        /generations/,
      );
      assert.equal(readFileSync(path, "utf8"), "");
      assert.throws(() => journal.persist([event(1n, "valid")]), /reopened/);
    } finally {
      journal.close();
    }
  }));

test("bounded batch and line sizes fail closed", () =>
  fixture((dir, path) => {
    const journal = new ArchiveJournal(dir, generation);
    try {
      assert.throws(
        () =>
          journal.persist(
            Array.from({ length: MAX_ARCHIVE_BATCH_EVENTS + 1 }, () => event(1n, "one")),
          ),
        /batch limit/,
      );
      assert.equal(readFileSync(path, "utf8"), "");
    } finally {
      journal.close();
    }
    const reopened = new ArchiveJournal(dir, generation);
    try {
      assert.throws(
        () => reopened.persist([event(1n, "x".repeat(MAX_ARCHIVE_LINE_BYTES))]),
        /line limit/,
      );
    } finally {
      reopened.close();
    }
    writeFileSync(path, "x".repeat(MAX_ARCHIVE_LINE_BYTES + 1));
    assert.throws(() => new ArchiveJournal(dir, generation), /line limit/);
  }));

test("startup streams records across read boundaries, retaining only digests", () =>
  fixture((dir, path) => {
    const payload = "🙂".repeat(20000);
    writeFileSync(path, record(1n, payload) + record(2n, "second"));
    const journal = new ArchiveJournal(dir, generation);
    try {
      assert.equal(journal.persist([event(1n, payload), event(2n, "second")]), 2n);
      const rows = (journal as unknown as { rows: Map<bigint, string> }).rows;
      assert.equal(rows.size, 2);
      for (const digest of rows.values()) assert.match(digest, /^[0-9a-f]{64}$/);
    } finally {
      journal.close();
    }
  }));

test("the unique event ceiling permits retries but refuses new sequences", () =>
  fixture((dir, path) => {
    const journal = new ArchiveJournal(dir, generation);
    try {
      journal.persist([event(1n, "one")]);
      const rows = (journal as unknown as { rows: Map<bigint, string> }).rows;
      // Exercise the boundary without allocating a million entries in the test runner.
      Object.defineProperty(rows, "size", { value: MAX_ARCHIVE_EVENTS });
      assert.equal(journal.persist([event(1n, "one")]), 1n);
      assert.throws(() => journal.persist([event(2n, "two")]), /event limit/);
      assert.equal(readFileSync(path, "utf8"), record(1n, "one"));
    } finally {
      journal.close();
    }
  }));

test("distinct lone surrogates cannot alias in payload digests", () =>
  fixture((dir) => {
    const journal = new ArchiveJournal(dir, generation);
    try {
      journal.persist([event(1n, "\ud800")]);
      assert.throws(() => journal.persist([event(1n, "\ufffd")]), /Conflicting/);
    } finally {
      journal.close();
    }
  }));

test("a failed partial write poisons retries and remains a fatal torn record on reopen", (context) =>
  fixture((dir, path) => {
    const journal = new ArchiveJournal(dir, generation);
    const originalWrite = fs.writeSync;
    let writes = 0;
    const write = context.mock.method(
      fs,
      "writeSync",
      (fd: number, buffer: Uint8Array, offset: number, length: number) => {
        if (writes++ !== 0) throw new Error("simulated write failure");
        return originalWrite(fd, buffer, offset, Math.min(length, 3));
      },
    );
    syncBuiltinESMExports();
    try {
      assert.throws(() => journal.persist([event(1n, "one")]), /write failure/);
      assert.throws(() => journal.persist([event(1n, "one")]), /reopened/);
    } finally {
      write.mock.restore();
      syncBuiltinESMExports();
      journal.close();
    }
    const torn = readFileSync(path);
    assert.throws(() => new ArchiveJournal(dir, generation), /incomplete tail/);
    assert.deepEqual(readFileSync(path), torn);
  }));
