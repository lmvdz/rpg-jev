/** Browser transport only: commands out, caller-filtered host projections in. */
import { DbConnection } from "../shared_bindings/index.ts";
import type { Answers } from "./act-request.ts";
import type { SharedConnection, SharedView } from "./shared-types.ts";

const URI = "ws://127.0.0.1:3057";
const DATABASE = "rpg-open-world";
const KEY = `rpg-jev.shared.v1:${URI}:${DATABASE}`;
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
  #timer: ReturnType<typeof setTimeout> | null = null;
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
    this.#onStatus("Connecting to the local shared world…");
    try {
      this.#conn = DbConnection.builder()
        .withUri(URI)
        .withDatabaseName(DATABASE)
        .withCompression("none")
        .withToken(sessionStorage.getItem(`${KEY}:token`) ?? undefined)
        .onConnect((conn, identity, token) => {
          this.#identity = identity.toHexString();
          this.#sentSequence = 0;
          sessionStorage.setItem(`${KEY}:token`, token);
          this.#delay = 250;
          conn.db.viewer.onInsert(() => this.#read());
          conn.db.viewer.onUpdate(() => this.#read());
          conn
            .subscriptionBuilder()
            .onApplied(() => {
              this.#read();
              void conn.reducers
                .join({})
                .then(() => {
                  this.#read();
                  if (
                    this.#pending &&
                    this.#pending.request.seq === (this.#view?.sequence ?? -1) + 1
                  )
                    this.#send(this.#pending.request);
                })
                .catch((error: unknown) => {
                  this.#onStatus(`Connection error: admission refused (${String(error)})`);
                });
            })
            .onError(() => this.#reconnect("subscription failed"))
            .subscribe(["SELECT * FROM viewer"]);
        })
        .onConnectError(() => this.#reconnect("host unavailable"))
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

  #read(): void {
    const row = [...(this.#conn?.db.viewer.iter() ?? [])].find(
      (entry) => entry.identity.toHexString() === this.#identity,
    );
    if (!row) return;
    const view: SharedView = JSON.parse(row.json);
    if (view.generation !== this.#view?.generation) this.#sentSequence = 0;
    this.#view = view;
    this.#onView(view);
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
      if (!conn.isActive) {
        this.#reconnect("command acknowledgement lost");
        return;
      }
      const pending = this.#pending;
      if (pending?.request.seq !== request.seq) return;
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
    if (this.#timer !== null) clearTimeout(this.#timer);
    this.#pending?.reject(new Error("Disconnected; saved command will reconcile on reconnect"));
    this.#conn?.disconnect();
  }
}

export function connectShared(
  onView: (view: SharedView) => void,
  onStatus: (message: string) => void,
): SharedConnection {
  return new Connection(onView, onStatus);
}
