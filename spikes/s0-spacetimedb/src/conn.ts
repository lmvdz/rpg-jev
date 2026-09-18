// Connection helpers shared by the benches. Depends on the generated bindings (`pnpm deploy:local`).
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Identity } from "spacetimedb";
import { DATABASE, WS_URL } from "./lib/cli.ts";
import { forgetToken, loadToken, registerWorker, saveToken } from "./lib/credentials.ts";
import { DbConnection, type SubscriptionHandle } from "./module_bindings/index.ts";

export type WireCounter = {
  messages: number;
  bytes: number;
  sentMessages: number;
  sentBytes: number;
};

const counters: WireCounter[] = [];

function byteLength(data: unknown): number {
  if (data instanceof ArrayBuffer) return data.byteLength;
  if (ArrayBuffer.isView(data)) return data.byteLength;
  if (typeof data === "string") return Buffer.byteLength(data);
  return 0;
}

const NativeWebSocket = globalThis.WebSocket;

/** Counts frames and payload bytes on the wire, below the SDK's decompression. */
class CountingWebSocket extends NativeWebSocket {
  readonly counter: WireCounter = { messages: 0, bytes: 0, sentMessages: 0, sentBytes: 0 };

  constructor(...args: ConstructorParameters<typeof NativeWebSocket>) {
    super(...args);
    counters.push(this.counter);
    this.addEventListener("message", (event) => {
      this.counter.messages++;
      this.counter.bytes += byteLength(event.data);
    });
  }

  override send(data: Parameters<WebSocket["send"]>[0]): void {
    this.counter.sentMessages++;
    this.counter.sentBytes += byteLength(data);
    super.send(data);
  }
}

globalThis.WebSocket = CountingWebSocket;

export type ConnectOptions = {
  compression?: "none" | "gzip" | "brotli";
  confirmedReads?: boolean;
  /**
   * Connect as a named, registered worker: reuse that name's local token and have the owner
   * register its identity. Without it the connection is a fresh anonymous identity: a player.
   */
  as?: string;
};

export type Connected = { conn: DbConnection; wire: WireCounter; identity: Identity };

function open(options: ConnectOptions, token: string | undefined): Promise<Connected> {
  return new Promise((resolve, reject) => {
    const before = counters.length;
    let builder = DbConnection.builder()
      .withUri(WS_URL)
      .withDatabaseName(DATABASE)
      .withToken(token)
      .withCompression(options.compression ?? "none")
      .onConnect((conn, identity, issued) => {
        const wire = counters[before];
        if (!wire) {
          reject(new Error("no socket was opened"));
          return;
        }
        if (options.as) {
          saveToken(options.as, issued);
          registerWorker(identity.toHexString(), options.as);
        }
        resolve({ conn, wire, identity });
      })
      .onConnectError((_ctx, error) => reject(error));
    if (options.confirmedReads !== undefined) {
      builder = builder.withConfirmedReads(options.confirmedReads);
    }
    builder.build();
  });
}

export async function connect(options: ConnectOptions = {}): Promise<Connected> {
  const token = options.as ? loadToken(options.as) : undefined;
  if (!(options.as && token)) return open(options, undefined);
  try {
    return await open(options, token);
  } catch {
    // A token from a server whose data was wiped no longer verifies. Start over as a new identity.
    forgetToken(options.as);
    return open(options, undefined);
  }
}

/** Resolves when the server has sent the initial rows. */
export function subscribe(conn: DbConnection, queries: string[]): Promise<SubscriptionHandle> {
  return new Promise((resolve, reject) => {
    const handle: SubscriptionHandle = conn
      .subscriptionBuilder()
      .onApplied(() => resolve(handle))
      .onError((ctx) =>
        reject(ctx.event ?? new Error(`subscription failed: ${queries.join("; ")}`)),
      )
      .subscribe(queries);
  });
}

export function unsubscribe(handle: SubscriptionHandle): Promise<void> {
  return new Promise((resolve) => {
    handle.unsubscribeThen(() => resolve());
  });
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function waitFor(
  condition: () => boolean,
  timeoutMs: number,
  label: string,
): Promise<boolean> {
  const deadline = performance.now() + timeoutMs;
  while (!condition()) {
    if (performance.now() > deadline) {
      console.warn(`timed out after ${timeoutMs} ms waiting for ${label}`);
      return false;
    }
    await sleep(5);
  }
  return true;
}

export function saveResult(name: string, data: unknown): void {
  const dir = join(import.meta.dirname, "..", "results");
  mkdirSync(dir, { recursive: true });
  const json = JSON.stringify(
    data,
    (_key, value) => (typeof value === "bigint" ? value.toString() : value),
    2,
  );
  writeFileSync(join(dir, `${name}.json`), `${json}\n`);
  console.log(`wrote results/${name}.json`);
}
