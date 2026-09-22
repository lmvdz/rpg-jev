import { describe, expect, it } from "vitest";
import { localTarget } from "../src/target.ts";

describe("local host selection", () => {
  it("retains the existing database directory by default", () => {
    expect(localTarget({})).toEqual({
      host: "127.0.0.1:3057",
      database: "rpg-open-world",
      http: "http://127.0.0.1:3057",
      ws: "ws://127.0.0.1:3057",
      dataPath: [".stdb", "data"],
    });
  });

  it("isolates a second standalone server without opening a public listener", () => {
    const target = localTarget({ RPG_WORLD_PORT: "3058", RPG_WORLD_DATABASE: "other-world" });
    expect(target.host).toBe("127.0.0.1:3058");
    expect(target.database).toBe("other-world");
    expect(target.dataPath).toEqual([".stdb", "instances", "3058", "data"]);
    expect(localTarget({ RPG_WORLD_PORT: "03058" })).toEqual(
      localTarget({ RPG_WORLD_PORT: "3058" }),
    );
  });

  it.each(["0", "-1", "65536", "3.5", "1e3", " 3057", "localhost:3057"])(
    "rejects invalid port %s",
    (port) => {
      expect(() => localTarget({ RPG_WORLD_PORT: port })).toThrow("RPG_WORLD_PORT");
    },
  );

  it.each(["../private", "world name", "", "a".repeat(65)])(
    "rejects invalid database %s",
    (database) => {
      expect(() => localTarget({ RPG_WORLD_DATABASE: database })).toThrow("RPG_WORLD_DATABASE");
    },
  );
});
