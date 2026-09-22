import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { connectShared } from "../src/play/shared-connection.ts";
import type { SharedConnection, SharedView } from "../src/play/shared-types.ts";

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
  const subscription = {
    onApplied: (callback: typeof applied) => {
      applied = callback;
      return subscription;
    },
    onError: () => subscription,
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
    onConnectError: () => builder,
    onDisconnect: (callback: typeof disconnected) => {
      disconnected = callback;
      return builder;
    },
    build: () => conn,
  };
  return {
    builder,
    conn,
    open: () => {
      connected(conn, identity, "in-memory-test-credential");
      applied();
    },
    publish: (
      view: SharedView,
      receipt: Partial<Pick<typeof row, "seq" | "command" | "ok" | "reason">> = {},
    ) => {
      row = { ...row, json: JSON.stringify(view), ...receipt };
      updated();
    },
  };
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: One suite shares an isolated transport and storage fixture.
describe("shared connection receipt reconciliation", () => {
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
    expect(onStatus).toHaveBeenCalledWith(
      "World generation changed; prior command was not retried.",
    );
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
});
