import { createHash } from "node:crypto";
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readSync,
  unlinkSync,
  writeSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { decodeArchivePayload, encodeArchivePayload } from "./archive-payload.ts";
import { DATABASE, HTTP_URL, isMain, SERVER_DIR, spacetime, WS_URL } from "./cli.ts";

export type ArchiveRow = { generation: string; seq: bigint; payload: string };

// Fail closed at these operational limits rather than growing memory indefinitely.
export const MAX_ARCHIVE_EVENTS = 1_000_000;
export const MAX_ARCHIVE_LINE_BYTES = 1024 * 1024;
export const MAX_ARCHIVE_BATCH_EVENTS = 10_000;

function validateGeneration(generation: string): void {
  if (
    typeof generation !== "string" ||
    generation.length !== 64 ||
    !/^[0-9a-f]{64}$/.test(generation)
  ) {
    throw new Error("Invalid archive generation.");
  }
}

export function archivePath(directory: string, generation: string): string {
  validateGeneration(generation);
  return join(directory, `${DATABASE}-${generation}.jsonl`);
}

function parseRecord(bytes: Uint8Array, generation: string): ArchiveRow {
  const row: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  if (
    typeof row !== "object" ||
    row === null ||
    !("generation" in row) ||
    row.generation !== generation ||
    !("seq" in row) ||
    typeof row.seq !== "string" ||
    !/^(0|[1-9]\d{0,19})$/.test(row.seq) ||
    !("payload" in row) ||
    typeof row.payload !== "string"
  )
    throw new Error("Invalid archive row.");
  const seq = BigInt(row.seq);
  if (seq.toString() !== row.seq) throw new Error("Invalid archive sequence.");
  const encoding = "encoding" in row ? row.encoding : undefined;
  return { generation, seq, payload: decodeArchivePayload({ payload: row.payload, encoding }) };
}

/**
 * Single-writer, append-only journal. Corruption is fatal: never truncate a partial
 * tail or acknowledge past it. Reader identity is routing metadata, not event data.
 */
export class ArchiveJournal {
  private readonly rows = new Map<bigint, string>();
  private readonly fd: number;
  private readonly lock: string;
  private readonly generation: string;
  private high: bigint | undefined;
  private closed = false;
  private failed = false;

  constructor(directory: string, generation: string) {
    const path = archivePath(directory, generation);
    this.generation = generation;
    mkdirSync(dirname(path), { recursive: true });
    this.lock = `${path}.lock`;
    const lockFd = openSync(this.lock, "wx");
    closeSync(lockFd);
    try {
      if (existsSync(path)) {
        const reader = openSync(path, "r");
        try {
          const chunk = Buffer.alloc(64 * 1024);
          const line = Buffer.alloc(MAX_ARCHIVE_LINE_BYTES);
          let length = 0;
          while (true) {
            const count = readSync(reader, chunk);
            if (count === 0) break;
            for (let i = 0; i < count; i++) {
              if (chunk[i] === 10) {
                this.remember(parseRecord(line.subarray(0, length), generation));
                length = 0;
              } else {
                if (length >= MAX_ARCHIVE_LINE_BYTES)
                  throw new Error("Archive line limit exceeded.");
                line[length++] = chunk.readUInt8(i);
              }
            }
          }
          if (length !== 0) throw new Error("Archive has an incomplete tail.");
        } finally {
          closeSync(reader);
        }
      }
      this.fd = openSync(path, "a");
    } catch (error) {
      unlinkSync(this.lock);
      throw error;
    }
  }

  private remember(row: ArchiveRow): boolean {
    if (row.generation !== this.generation) throw new Error("Mixed archive generations.");
    if (typeof row.seq !== "bigint" || row.seq < 0n || row.seq > 0xffffffffffffffffn) {
      throw new Error("Invalid archive sequence.");
    }
    // JSON escaping distinguishes lone UTF-16 surrogates from replacement characters.
    const digest = createHash("sha256").update(JSON.stringify(row.payload), "utf8").digest("hex");
    const previous = this.rows.get(row.seq);
    if (previous !== undefined) {
      if (previous !== digest) throw new Error("Conflicting payload for an archived sequence.");
      return false;
    }
    if (row.seq < 0n || (this.high !== undefined && row.seq <= this.high)) {
      throw new Error("Archive sequences are out of order.");
    }
    if (this.rows.size >= MAX_ARCHIVE_EVENTS) throw new Error("Archive event limit exceeded.");
    this.rows.set(row.seq, digest);
    this.high = row.seq;
    return true;
  }

  /** Return an acknowledgement bound only after every supplied row is durable. */
  persist(input: Iterable<ArchiveRow>): bigint | undefined {
    if (this.closed) throw new Error("Archive is closed.");
    if (this.failed)
      throw new Error("Archive must be reopened after a failed write or integrity check.");
    try {
      const sorted: ArchiveRow[] = [];
      for (const row of input) {
        if (row.generation !== this.generation) throw new Error("Mixed archive generations.");
        if (sorted.length >= MAX_ARCHIVE_BATCH_EVENTS)
          throw new Error("Archive batch limit exceeded.");
        sorted.push(row);
      }
      sorted.sort((a, b) => {
        if (a.seq < b.seq) return -1;
        return a.seq > b.seq ? 1 : 0;
      });
      for (const row of sorted) {
        const stored = encodeArchivePayload(row.payload);
        const bytes = Buffer.from(
          `${JSON.stringify({ generation: row.generation, seq: row.seq.toString(), ...stored })}\n`,
        );
        if (bytes.length - 1 > MAX_ARCHIVE_LINE_BYTES)
          throw new Error("Archive line limit exceeded.");
        if (!this.remember(row)) continue;
        let written = 0;
        while (written < bytes.length) {
          const count = writeSync(this.fd, bytes, written, bytes.length - written);
          if (count === 0) throw new Error("Archive write made no progress.");
          written += count;
        }
      }
      // Also sync on replay: a previous process may have died between write and sync.
      fsyncSync(this.fd);
      return sorted.at(-1)?.seq;
    } catch (error) {
      // In-memory deduplication must never hide a partial/failed disk write.
      this.failed = true;
      throw error;
    }
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    closeSync(this.fd);
    unlinkSync(this.lock);
  }
}

export async function archiveLocal(): Promise<void> {
  // Generated by world:publish. Kept dynamic so journal tests need no running DB.
  const { DbConnection } = await import("../../client/src/shared_bindings/index.ts");
  let journal: ArchiveJournal | undefined;
  let generation: string | undefined;
  const persistGeneration = (input: Iterable<ArchiveRow>): bigint | undefined => {
    const iterator = input[Symbol.iterator]();
    const first = iterator.next();
    if (first.done) return undefined;
    validateGeneration(first.value.generation);
    if (!journal || generation !== first.value.generation) {
      journal?.close();
      journal = undefined;
      journal = new ArchiveJournal(join(SERVER_DIR, ".stdb", "archive"), first.value.generation);
      generation = first.value.generation;
    }
    // Preserve the peeked row even when input is a single-use iterator.
    function* rows(): Generator<ArchiveRow> {
      yield first.value;
      for (let next = iterator.next(); !next.done; next = iterator.next()) yield next.value;
    }
    return journal.persist(rows());
  };
  let token: string | undefined;
  let stopped = false;
  let disconnect: (() => void) | undefined;
  const stop = () => {
    stopped = true;
    disconnect?.();
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  try {
    while (!stopped) {
      await new Promise<void>((resolve, reject) => {
        let timer: ReturnType<typeof setInterval> | undefined;
        let conn: InstanceType<typeof DbConnection> | undefined;
        let busy = false;
        let settled = false;
        const finish = (error?: Error) => {
          if (settled) return;
          settled = true;
          clearInterval(timer);
          disconnect = undefined;
          conn?.disconnect();
          if (error) reject(error);
          else resolve();
        };
        conn = DbConnection.builder()
          .withUri(WS_URL)
          .withDatabaseName(DATABASE)
          .withToken(token)
          .onConnect((connected, identity, issued) => {
            token = issued; // Never persisted or logged.
            try {
              spacetime([
                "call",
                DATABASE,
                "register_archiver",
                JSON.stringify(`0x${identity.toHexString().replace(/^0x/, "")}`),
                "--server",
                HTTP_URL,
                "--no-config",
                "--yes",
              ]);
            } catch {
              finish(new Error("Could not register the archive reader as the local publisher."));
              return;
            }
            const drain = async () => {
              if (busy || settled || stopped) return;
              busy = true;
              let seq: bigint | undefined;
              try {
                seq = persistGeneration(connected.db.event.iter());
              } catch {
                finish(
                  new Error("Archive integrity or durable write failed; no acknowledgement sent."),
                );
                busy = false;
                return;
              }
              try {
                if (seq !== undefined) await connected.reducers.archiveThrough({ seq });
              } catch {
                // A lost acknowledgement is safe: reconnect, compare and acknowledge again.
                finish();
              } finally {
                busy = false;
              }
            };
            connected
              .subscriptionBuilder()
              .onApplied(() => {
                timer = setInterval(() => {
                  void drain();
                }, 250);
                void drain();
              })
              .onError(() => finish())
              .subscribe("SELECT * FROM event");
          })
          .onConnectError(() => finish())
          .onDisconnect(() => finish())
          .build();
        if (settled) conn.disconnect();
        else {
          disconnect = () => finish();
          if (stopped) finish();
        }
      });
      if (!stopped) await new Promise<void>((resolve) => setTimeout(resolve, 1000));
    }
  } finally {
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
    journal?.close();
  }
}

if (isMain(import.meta.url)) {
  archiveLocal().catch(() => {
    console.error(
      "Archive stopped safely. Check generated bindings, local publisher access, archive integrity, and the single-writer lock. A stale .lock after a crash must be removed only after confirming no archiver is running.",
    );
    process.exitCode = 1;
  });
}
