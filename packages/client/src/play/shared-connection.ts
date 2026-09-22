/** Browser transport only: commands out, caller-filtered host projections in. */
import { OBSERVE_INTERVAL_MS, VIEW_LEASE_MICROS } from "../../../server/module/src/observers.ts";
import { DbConnection } from "../shared_bindings/index.ts";
import type { Answers } from "./act-request.ts";
import { sharedTarget } from "./shared-target.ts";
import type { SharedConnection, SharedView } from "./shared-types.ts";
import { decodeSharedView } from "./shared-wire.ts";

const {
  uri: URI,
  database: DATABASE,
  storageKey: KEY,
} = sharedTarget(import.meta.env?.VITE_WORLD_SERVER, import.meta.env?.VITE_WORLD_DATABASE);
interface Request {
  generation: string;
  seq: number;
  revision: number;
  payload: string;
}
interface Pending {
  request: Request;
  resolve: () => void;
  reject: (error: Error) => void;
}

class Connection implements SharedConnection {
  #conn: DbConnection | null = null;
  #view: SharedView | null = null;
  #identity = "";
  #pending: Pending | null = null;
  #closed = false;
  #attempt = 0;
  #timer: ReturnType<typeof setTimeout> | null = null;
  #heartbeat: ReturnType<typeof setInterval> | null = null;
  #lastViewAt = 0;
  #delay = 250;
  #sentSequence = 0;
  readonly #onView: (view: SharedView) => void;
  readonly #onStatus: (message: string) => void;

  constructor(onView: (view: SharedView) => void, onStatus: (message: string) => void) {
    this.#onView = onView;
    this.#onStatus = onStatus;
    this.#connect();
  }

  #connect(): void {
    if (this.#closed) return;
    const attempt = ++this.#attempt;
    this.#onStatus("Connecting to the shared world…");
    try {
      this.#conn = DbConnection.builder()
        .withUri(URI)
        .withDatabaseName(DATABASE)
        .withCompression("none")
        .withToken(sessionStorage.getItem(`${KEY}:token`) ?? undefined)
        .onConnect((conn, identity, token) => {
          if (this.#closed || attempt !== this.#attempt) {
            conn.disconnect();
            return;
          }
          this.#identity = identity.toHexString();
          this.#sentSequence = 0;
          sessionStorage.setItem(`${KEY}:token`, token);
          this.#delay = 250;
          conn.db.viewer.onInsert(() => this.#read(conn));
          conn.db.viewer.onUpdate(() => this.#read(conn));
          conn
            .subscriptionBuilder()
            .onApplied(() => {
              if (this.#closed || this.#conn !== conn) return;
              void conn.reducers
                .join({})
                .then(() => {
                  if (this.#closed || this.#conn !== conn) return;
                  this.#read(conn);
                  this.#startHeartbeat(conn);
                  if (
                    this.#pending &&
                    this.#pending.request.seq === (this.#view?.sequence ?? -1) + 1
                  )
                    this.#send(this.#pending.request);
                })
                .catch((error: unknown) => {
                  if (this.#closed || this.#conn !== conn) return;
                  this.#onStatus(`Connection error: admission refused (${String(error)})`);
                });
            })
            .onError(() => {
              if (!this.#closed && this.#conn === conn) this.#reconnect("subscription failed");
            })
            .subscribe(["SELECT * FROM viewer"]);
        })
        .onConnectError(() => {
          if (!this.#closed && attempt === this.#attempt) this.#reconnect("host unavailable");
        })
        .onDisconnect((conn) => {
          if (this.#conn === conn) this.#reconnect("connection lost");
        })
        .build();
    } catch (error) {
      this.#onStatus(`Connection error: ${String(error)}`);
    }
  }

  #reconnect(reason: string): void {
    if (this.#closed || this.#timer !== null) return;
    this.#stopHeartbeat();
    this.#view = null;
    this.#onStatus(`Disconnected: ${reason}. Reconnecting; pending commands will be reconciled.`);
    this.#timer = setTimeout(() => {
      const old = this.#conn;
      this.#conn = null;
      old?.disconnect();
      this.#timer = null;
      this.#connect();
    }, this.#delay);
    this.#delay = Math.min(5000, this.#delay * 2);
  }

  #startHeartbeat(conn: DbConnection): void {
    if (this.#closed || this.#conn !== conn) return;
    this.#stopHeartbeat();
    this.#heartbeat = setInterval(() => {
      if (this.#closed || this.#conn !== conn) return;
      if (this.#view && Date.now() - this.#lastViewAt > Number(VIEW_LEASE_MICROS / 1000n)) {
        this.#reconnect("view heartbeat timed out");
        return;
      }
      void conn.reducers.observe({}).catch(() => {
        if (!this.#closed && this.#conn === conn) this.#reconnect("observation renewal failed");
      });
    }, OBSERVE_INTERVAL_MS);
  }

  #stopHeartbeat(): void {
    if (this.#heartbeat !== null) clearInterval(this.#heartbeat);
    this.#heartbeat = null;
  }

  #read(conn: DbConnection): void {
    if (this.#closed || this.#conn !== conn) return;
    const row = [...conn.db.viewer.iter()].find(
      (entry) => entry.identity.toHexString() === this.#identity,
    );
    if (!row) return;
    let view: SharedView;
    try {
      view = decodeSharedView(row.json);
    } catch (error) {
      this.#view = null;
      this.#onStatus(`Connection error: invalid shared snapshot (${String(error)})`);
      this.#pending?.reject(new Error("Invalid shared snapshot; command outcome is unknown."));
      this.#pending = null;
      return;
    }
    if (view.generation !== this.#view?.generation) this.#sentSequence = 0;
    this.#view = view;
    this.#lastViewAt = Date.now();
    this.#onView(view);
    if (this.#closed || this.#conn !== conn) return;
    if (view.pauseReason)
      this.#onStatus(
        `Connection error: host paused (${view.pauseReason}); restore the archive worker.`,
      );
    const pending = this.#pending;
    if (pending && pending.request.generation !== view.generation) {
      this.#pending = null;
      sessionStorage.removeItem(`${KEY}:pending`);
      pending.reject(new Error("World generation changed; prior command was not retried."));
      this.#onStatus("World generation changed; prior command was not retried.");
      return;
    }
    if (pending && row.seq >= pending.request.seq) {
      this.#pending = null;
      sessionStorage.removeItem(`${KEY}:pending`);
      if (row.seq !== pending.request.seq || row.command !== pending.request.payload) {
        const reason =
          "Receipt conflict: this session advanced elsewhere; this command's outcome is unknown.";
        this.#onStatus(reason);
        pending.reject(new Error(reason));
        return;
      }
      this.#onStatus(
        row.ok ? "Connected: the host committed your action." : `Not done: ${row.reason}`,
      );
      if (row.ok) pending.resolve();
      else pending.reject(new Error(row.reason));
      return;
    }
    if (!pending) this.#recover(view, row);
  }

  #recover(view: SharedView, row: { seq: number; command: string; reason: string }): void {
    const saved = sessionStorage.getItem(`${KEY}:pending`);
    if (!saved) return;
    let request: Request;
    try {
      request = JSON.parse(saved);
      if (
        !Number.isSafeInteger(request.seq) ||
        request.seq < 1 ||
        !Number.isSafeInteger(request.revision) ||
        request.revision < 0 ||
        typeof request.payload !== "string" ||
        request.payload.length > 8192
      )
        throw new Error("Invalid saved command");
    } catch {
      this.#onStatus("Connection error: invalid saved command; it was not sent.");
      sessionStorage.removeItem(`${KEY}:pending`);
      return;
    }
    if (request.generation !== view.generation) {
      sessionStorage.removeItem(`${KEY}:pending`);
      this.#onStatus("World generation changed; prior command was not retried.");
      return;
    }
    if (request.seq <= row.seq) {
      sessionStorage.removeItem(`${KEY}:pending`);
      const matched = request.seq === row.seq && request.payload === row.command;
      this.#onStatus(
        matched
          ? `Connected: recovered command ${request.seq} (${row.reason}).`
          : "Receipt conflict: prior command outcome is unknown; it was not retried.",
      );
    } else if (request.seq === row.seq + 1) {
      this.#pending = {
        request,
        resolve: () => this.#onStatus("Connected: recovered command acknowledged."),
        reject: (error) => this.#onStatus(`Not done: ${error.message}`),
      };
      this.#send(request);
    } else {
      sessionStorage.removeItem(`${KEY}:pending`);
      this.#onStatus("Connection error: saved command sequence cannot be reconciled.");
    }
  }

  #send(request: Request): void {
    const conn = this.#conn;
    if (!conn?.isActive) return;
    if (this.#sentSequence === request.seq) return;
    this.#sentSequence = request.seq;
    void conn.reducers.command(request).catch((error: unknown) => {
      if (this.#closed || this.#conn !== conn) return;
      if (!conn.isActive) {
        this.#reconnect("command acknowledgement lost");
        return;
      }
      const pending = this.#pending;
      if (pending?.request !== request) return;
      this.#pending = null;
      this.#sentSequence = 0;
      sessionStorage.removeItem(`${KEY}:pending`);
      this.#onStatus(`Not done: host rejected the command (${String(error)})`);
      pending.reject(new Error("Host rejected the command"));
    });
  }

  #submit(command: unknown): Promise<void> {
    if (!(this.#view && this.#conn?.isActive)) return Promise.reject(new Error("Disconnected"));
    if (this.#pending) return Promise.reject(new Error("A command is awaiting the host"));
    const request = {
      generation: this.#view.generation ?? "",
      seq: this.#view.sequence + 1,
      revision: this.#view.revision,
      payload: JSON.stringify(command),
    };
    if (request.payload.length > 8192) return Promise.reject(new Error("Command too large"));
    return new Promise((resolve, reject) => {
      sessionStorage.setItem(`${KEY}:pending`, JSON.stringify(request));
      this.#pending = { request, resolve, reject };
      this.#onStatus("Waiting for the authoritative host…");
      this.#send(request);
    });
  }

  move(to: readonly [number, number]): Promise<void> {
    return this.#submit({ version: 1, kind: "move", to });
  }

  act(answers: Answers, operands: Readonly<Record<string, string>>): Promise<void> {
    return this.#submit({ version: 1, kind: "act", answers, operands });
  }

  close(): void {
    this.#closed = true;
    this.#attempt++;
    this.#stopHeartbeat();
    if (this.#timer !== null) clearTimeout(this.#timer);
    this.#pending?.reject(new Error("Disconnected; saved command will reconcile on reconnect"));
    this.#pending = null;
    const conn = this.#conn;
    this.#conn = null;
    conn?.disconnect();
  }
}

export function connectShared(
  onView: (view: SharedView) => void,
  onStatus: (message: string) => void,
): SharedConnection {
  return new Connection(onView, onStatus);
}
