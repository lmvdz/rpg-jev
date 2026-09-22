import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { connectShared } from "../src/play/shared-connection.ts";
import type { SharedConnection, SharedView } from "../src/play/shared-types.ts";
import { encodeSharedView } from "../src/play/shared-wire.ts";

const generated = vi.hoisted(() => ({ builder: vi.fn() }));
vi.mock("../src/shared_bindings/index.ts", () => ({
  DbConnection: { builder: generated.builder },
}));

const pendingKey = "rpg-jev.shared.v1:ws://127.0.0.1:3057:rpg-open-world:pending";
const payload = JSON.stringify({ version: 1, kind: "move", to: [3, 2] });
const request = { generation: "world-a", seq: 1, revision: 4, payload };

function projection(overrides: Partial<SharedView> = {}): SharedView {
  return {
    generation: "world-a",
    actor: "self",
    revision: 4,
    tick: 1,
    sequence: 0,
    seed: 1,
    position: [2, 2],
    things: [],
    elements: {},
    body: { meters: [], counts: [] },
    aware: [],
    compiled: [],
    sought: [],
    ...overrides,
  };
}

/** Only the generated transport is replaced; all reconciliation uses connectShared. */
function transport() {
  const identity = { toHexString: () => "test-identity" };
  let row = {
    identity,
    json: JSON.stringify(projection()),
    seq: 0,
    command: "",
    reason: "",
    ok: true,
  };
  let updated: () => void = () => undefined;
  let applied: () => void = () => undefined;
  let connected: (_conn: typeof conn, _identity: typeof identity, token: string) => void = () =>
    undefined;
  let disconnected: (_conn: typeof conn) => void = () => undefined;
  let connectError = () => undefined;
  let subscriptionError = () => undefined;
  const subscription = {
    onApplied: (callback: typeof applied) => {
      applied = callback;
      return subscription;
    },
    onError: (callback: () => undefined) => {
      subscriptionError = callback;
      return subscription;
    },
    subscribe: vi.fn(),
  };
  const conn = {
    isActive: true,
    db: {
      viewer: {
        iter: () => [row],
        onInsert: vi.fn(),
        onUpdate: (callback: typeof updated) => {
          updated = callback;
        },
      },
    },
    reducers: {
      join: vi.fn(() => Promise.resolve()),
      observe: vi.fn(() => Promise.resolve()),
      command: vi.fn((_request: typeof request) => Promise.resolve()),
    },
    subscriptionBuilder: () => subscription,
    disconnect: vi.fn(() => {
      conn.isActive = false;
      disconnected(conn);
    }),
  };
  const builder = {
    withUri: () => builder,
    withDatabaseName: () => builder,
    withCompression: () => builder,
    withToken: () => builder,
    onConnect: (callback: typeof connected) => {
      connected = callback;
      return builder;
    },
    onConnectError: (callback: () => undefined) => {
      connectError = callback;
      return builder;
    },
    onDisconnect: (callback: typeof disconnected) => {
      disconnected = callback;
      return builder;
    },
    build: () => conn,
  };
  return {
    builder,
    conn,
    open: (token = "in-memory-test-credential") => {
      connected(conn, identity, token);
      applied();
    },
    failConnect: () => connectError(),
    failSubscription: () => subscriptionError(),
    publish: (
      view: SharedView | string,
      receipt: Partial<Pick<typeof row, "seq" | "command" | "ok" | "reason">> = {},
    ) => {
      row = { ...row, json: typeof view === "string" ? view : encodeSharedView(view), ...receipt };
      updated();
    },
  };
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

function deferred() {
  let resolve: () => void = () => undefined;
  let reject: (error: Error) => void = () => undefined;
  const promise = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

let hosts: ReturnType<typeof transport>[];
let connection: SharedConnection;
let onView = vi.fn<(view: SharedView) => void>();
let onStatus = vi.fn<(message: string) => void>();

function hostAt(index: number) {
  const host = hosts[index];
  if (!host) throw new Error(`Transport ${index} has not been built`);
  return host;
}

beforeEach(() => {
  vi.useFakeTimers();
  const storage = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
  hosts = [];
  generated.builder.mockImplementation(() => {
    const host = transport();
    hosts.push(host);
    return host.builder;
  });
  onView = vi.fn();
  onStatus = vi.fn();
  connection = connectShared(onView, onStatus);
});

afterEach(() => {
  connection.close();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

async function open() {
  const host = hostAt(0);
  host.open();
  await flush();
  return host;
}

it("waits for an exact sequence and payload receipt, publishing the projection before movement resolves", async () => {
  const host = await open();
  const events: string[] = [];
  onView.mockImplementation(() => events.push("projection"));
  const moved = connection.move([3, 2]).then(() => events.push("resolved"));
  expect(host.conn.reducers.command).toHaveBeenCalledWith(request);
  expect(sessionStorage.getItem(pendingKey)).toBe(JSON.stringify(request));
  await flush();
  expect(events).toEqual([]);
  host.publish(projection(), { seq: 0, command: payload });
  await flush();
  expect(events).toEqual(["projection"]);
  const committed = projection({ sequence: 1, revision: 5, position: [3, 2] });
  host.publish(committed, { seq: 1, command: payload });
  expect(events).toEqual(["projection", "projection"]);
  await moved;
  expect(events).toEqual(["projection", "projection", "resolved"]);
  expect(onView).toHaveBeenLastCalledWith(committed);
  expect(sessionStorage.getItem(pendingKey)).toBeNull();
});

it.each([
  { seq: 1, command: `${payload} `, label: "same sequence but different exact payload" },
  { seq: 2, command: payload, label: "newer sequence even with identical payload" },
])("rejects receipt conflict: $label", async ({ seq, command }) => {
  const host = await open();
  const moved = connection.move([3, 2]);
  const rejected = expect(moved).rejects.toThrow("Receipt conflict");
  host.publish(projection({ sequence: seq }), { seq, command });
  await rejected;
  expect(sessionStorage.getItem(pendingKey)).toBeNull();
  expect(onStatus).toHaveBeenLastCalledWith(expect.stringContaining("outcome is unknown"));
});

it("does not acknowledge a matching receipt whose snapshot cannot be decoded", async () => {
  const host = await open();
  const rejected = expect(connection.move([3, 2])).rejects.toThrow("outcome is unknown");
  onView.mockClear();
  host.publish('{"wire":2}', { seq: 1, command: payload });
  await rejected;
  expect(onView).not.toHaveBeenCalled();
  expect(onStatus).toHaveBeenLastCalledWith(expect.stringContaining("invalid shared snapshot"));
  expect(sessionStorage.getItem(pendingKey)).toBe(JSON.stringify(request));
  await expect(connection.move([3, 2])).rejects.toThrow();
  expect(host.conn.reducers.command).toHaveBeenCalledTimes(1);
});

it("rejects an exact negative receipt and clears the saved command", async () => {
  const host = await open();
  const rejected = expect(connection.move([3, 2])).rejects.toThrow("blocked");
  host.publish(projection({ sequence: 1 }), {
    seq: 1,
    command: payload,
    ok: false,
    reason: "blocked",
  });
  await rejected;
  expect(sessionStorage.getItem(pendingKey)).toBeNull();
  expect(onStatus).toHaveBeenLastCalledWith("Not done: blocked");
});

it("cancels an in-flight command on generation change without replaying on reconnect", async () => {
  const host = await open();
  const rejected = expect(connection.move([3, 2])).rejects.toThrow("World generation changed");
  host.publish(projection({ generation: "world-b" }));
  await rejected;
  expect(sessionStorage.getItem(pendingKey)).toBeNull();
  host.conn.disconnect();
  await vi.advanceTimersByTimeAsync(250);
  const next = hostAt(1);
  next.publish(projection({ generation: "world-b" }));
  next.open();
  await flush();
  expect(host.conn.reducers.command).toHaveBeenCalledTimes(1);
  expect(next.conn.reducers.command).not.toHaveBeenCalled();
});

it("discards a stored command from another generation without sending it", async () => {
  sessionStorage.setItem(pendingKey, JSON.stringify({ ...request, generation: "old-world" }));
  const host = await open();
  expect(sessionStorage.getItem(pendingKey)).toBeNull();
  expect(host.conn.reducers.command).not.toHaveBeenCalled();
  expect(onStatus).toHaveBeenCalledWith("World generation changed; prior command was not retried.");
});

it("sends a recovered stored command only once on the initial connection", async () => {
  sessionStorage.setItem(pendingKey, JSON.stringify(request));
  const host = await open();
  expect(host.conn.reducers.command).toHaveBeenCalledExactlyOnceWith(request);
  host.publish(projection({ sequence: 1 }), { seq: 1, command: payload });
  expect(sessionStorage.getItem(pendingKey)).toBeNull();
  expect(onStatus).toHaveBeenLastCalledWith("Connected: recovered command acknowledged.");
});

it("clears a permanent reducer rejection and permits another command", async () => {
  const host = await open();
  host.conn.reducers.command.mockRejectedValueOnce(new Error("invalid command"));
  await expect(connection.move([3, 2])).rejects.toThrow("Host rejected the command");
  expect(sessionStorage.getItem(pendingKey)).toBeNull();
  expect(onStatus).toHaveBeenLastCalledWith(expect.stringContaining("host rejected"));
  const moved = connection.move([3, 2]);
  host.publish(projection({ sequence: 1 }), { seq: 1, command: payload });
  await moved;
  expect(host.conn.reducers.command).toHaveBeenCalledTimes(2);
});

it("retains a transport-lost request, resends it on reconnect, and awaits its receipt", async () => {
  const host = await open();
  host.conn.reducers.command.mockImplementationOnce(() => {
    host.conn.isActive = false;
    return Promise.reject(new Error("socket closed"));
  });
  const settled = vi.fn();
  const moved = connection.move([3, 2]).then(settled);
  await flush();
  expect(sessionStorage.getItem(pendingKey)).toBe(JSON.stringify(request));
  expect(settled).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(250);
  const next = hostAt(1);
  next.open();
  await flush();
  expect(next.conn.reducers.command).toHaveBeenCalledWith(request);
  expect(settled).not.toHaveBeenCalled();
  next.publish(projection({ sequence: 1 }), { seq: 1, command: payload });
  await moved;
  expect(settled).toHaveBeenCalledTimes(1);
  expect(sessionStorage.getItem(pendingKey)).toBeNull();
});

it.each([
  "{not json",
  "null",
  JSON.stringify({ ...request, seq: 0 }),
  JSON.stringify({ ...request, revision: -1 }),
  JSON.stringify({ ...request, payload: 42 }),
  JSON.stringify({ ...request, payload: "x".repeat(8193) }),
])(
  "shows a failure for malformed stored pending command %# rather than sending it",
  async (saved) => {
    sessionStorage.setItem(pendingKey, saved);
    const host = await open();
    expect(sessionStorage.getItem(pendingKey)).toBeNull();
    expect(host.conn.reducers.command).not.toHaveBeenCalled();
    expect(onStatus).toHaveBeenCalledWith(
      "Connection error: invalid saved command; it was not sent.",
    );
  },
);
it("renews projection interest while idle and stops its heartbeat on close", async () => {
  const host = await open();
  await vi.advanceTimersByTimeAsync(5_000);
  expect(host.conn.reducers.observe).toHaveBeenCalledTimes(1);
  expect(host.conn.reducers.command).not.toHaveBeenCalled();
  connection.close();
  await vi.advanceTimersByTimeAsync(15_000);
  expect(host.conn.reducers.observe).toHaveBeenCalledTimes(1);
});

it("does not renew observation after admission refusal", async () => {
  const host = hostAt(0);
  host.conn.reducers.join.mockRejectedValue(new Error("admission refused"));
  host.open();
  await flush();
  await vi.advanceTimersByTimeAsync(10_000);
  expect(host.conn.reducers.observe).not.toHaveBeenCalled();
});

it("makes a failed observation renewal visibly disconnected without sending an action", async () => {
  const host = await open();
  host.conn.reducers.observe.mockRejectedValue(new Error("connection lost"));
  await vi.advanceTimersByTimeAsync(5_000);
  expect(onStatus.mock.calls.some(([message]) => message.startsWith("Disconnected:"))).toBe(true);
  expect(host.conn.reducers.command).not.toHaveBeenCalled();
});

it("treats an expired view as uncertainty, retaining an unacknowledged command", async () => {
  const host = await open();
  const moved = connection.move([3, 2]);
  const rejectedOnClose = moved.catch(() => undefined);
  await vi.advanceTimersByTimeAsync(20_000);
  expect(
    onStatus.mock.calls.some(([message]) => message.includes("view heartbeat timed out")),
  ).toBe(true);
  expect(sessionStorage.getItem(pendingKey)).not.toBeNull();
  expect(host.conn.reducers.command).toHaveBeenCalledTimes(1);
  connection.close();
  await rejectedOnClose;
});

it("ignores late callbacks and observation failures from a replaced connection", async () => {
  const old = await open();
  const observation = deferred();
  old.conn.reducers.observe.mockReturnValue(observation.promise);
  await vi.advanceTimersByTimeAsync(5_000);
  old.conn.disconnect();
  await vi.advanceTimersByTimeAsync(250);
  const current = hostAt(1);
  current.open();
  await flush();
  const statuses = onStatus.mock.calls.length;
  const views = onView.mock.calls.length;
  old.open("stale-credential");
  old.publish(projection({ generation: "stale" }));
  old.failConnect();
  old.failSubscription();
  observation.reject(new Error("late renewal failure"));
  await flush();
  expect(onStatus).toHaveBeenCalledTimes(statuses);
  expect(onView).toHaveBeenCalledTimes(views);
  expect(sessionStorage.getItem(pendingKey.replace(":pending", ":token"))).toBe(
    "in-memory-test-credential",
  );
});

it("does not let a late command failure discard a request retried on the current connection", async () => {
  const old = await open();
  const completion = deferred();
  old.conn.reducers.command.mockReturnValue(completion.promise);
  const moved = connection.move([3, 2]);
  old.conn.disconnect();
  await vi.advanceTimersByTimeAsync(250);
  const current = hostAt(1);
  current.open();
  await flush();
  old.conn.isActive = true;
  completion.reject(new Error("obsolete refusal"));
  await flush();
  expect(sessionStorage.getItem(pendingKey)).not.toBeNull();
  current.publish(projection({ sequence: 1 }), { seq: 1, command: payload });
  await moved;
});

it("a closed instance cannot erase pending storage or publish a late view", async () => {
  const old = await open();
  const moved = connection.move([3, 2]).catch(() => undefined);
  connection.close();
  await moved;
  const saved = sessionStorage.getItem(pendingKey);
  const views = onView.mock.calls.length;
  old.publish(projection({ sequence: 1 }), { seq: 1, command: payload });
  old.open("closed-credential");
  old.failConnect();
  old.failSubscription();
  await flush();
  expect(onView).toHaveBeenCalledTimes(views);
  expect(sessionStorage.getItem(pendingKey)).toBe(saved);
  expect(sessionStorage.getItem(pendingKey.replace(":pending", ":token"))).toBe(
    "in-memory-test-credential",
  );
});
