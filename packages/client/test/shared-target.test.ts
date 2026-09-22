import { describe, expect, it } from "vitest";
import { sharedTarget } from "../src/play/shared-target.ts";

describe("operator-selected shared endpoint", () => {
  it("preserves existing local identity and pending-command storage", () => {
    expect(sharedTarget()).toEqual({
      uri: "ws://127.0.0.1:3057",
      database: "rpg-open-world",
      storageKey: "rpg-jev.shared.v1:ws://127.0.0.1:3057:rpg-open-world",
    });
  });

  it("canonicalizes endpoint origins and isolates credentials by endpoint and database", () => {
    const first = sharedTarget("wss://WORLD.example:443/", "first");
    expect(first.uri).toBe("wss://world.example");
    expect(first.storageKey).not.toBe(sharedTarget("wss://world.example", "second").storageKey);
    expect(first.storageKey).not.toBe(sharedTarget("wss://other.example", "first").storageKey);
    expect(sharedTarget("ws://[::1]:3058", "first").uri).toBe("ws://[::1]:3058");
  });

  it.each([
    "http://127.0.0.1:3057",
    "javascript:alert(1)",
    "ws://world.example",
    "wss://user:secret@world.example",
    "wss://world.example/path",
    "wss://world.example?token=secret",
    "wss://world.example#fragment",
    " wss://world.example",
    "not a URL",
  ])("refuses unsafe or ambiguous endpoint %s without echoing it", (endpoint) => {
    expect(() => sharedTarget(endpoint)).toThrow();
    try {
      sharedTarget(endpoint);
    } catch (error) {
      expect(String(error)).not.toContain(endpoint);
      expect(String(error)).not.toContain("secret");
    }
  });

  it.each(["", "../other", "world name", "World", "a".repeat(65)])(
    "rejects invalid database %s",
    (name) => {
      expect(() => sharedTarget(undefined, name)).toThrow("Invalid shared-world database name");
    },
  );
});
