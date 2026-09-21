import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  fsyncSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  utimesSync,
  writeFileSync,
  writeSync,
} from "node:fs";
import { join, relative } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openSession, ROOT } from "../src/session.ts";

vi.mock("node:fs", async (original) => {
  const fs = await original<typeof import("node:fs")>();
  return {
    ...fs,
    copyFileSync: vi.fn(fs.copyFileSync),
    fsyncSync: vi.fn(fs.fsyncSync),
    renameSync: vi.fn(fs.renameSync),
    writeFileSync: vi.fn(fs.writeFileSync),
  };
});

let directory: string;
let savePath: string;

beforeEach(() => {
  mkdirSync(join(ROOT, "saves"), { recursive: true });
  directory = mkdtempSync(join(ROOT, "saves", "session-test-"));
  savePath = join(directory, "night.jsonl");
});

afterEach(() => {
  vi.resetAllMocks();
  rmSync(directory, { recursive: true, force: true });
});

function session(seed: number, fresh = true) {
  return openSession({ seed, fresh, savePath, offline: true, record: false });
}

describe("inn save lifecycle", () => {
  it("preserves every night when restart archive timestamps collide", () => {
    const originals: string[] = [];
    for (const seed of [1, 2, 3]) {
      session(seed).save();
      originals.push(readFileSync(savePath, "utf8"));
      utimesSync(savePath, 1000, 1000);
    }
    const files = readdirSync(directory);
    expect(files).toHaveLength(3);
    expect(files.map((file) => readFileSync(join(directory, file), "utf8")).sort()).toEqual(
      originals.sort(),
    );
  });

  it("does not move the previous save just by opening a fresh night", () => {
    session(1).save();
    const original = readFileSync(savePath, "utf8");
    session(2);
    expect(readFileSync(savePath, "utf8")).toBe(original);
    expect(readdirSync(directory)).toEqual(["night.jsonl"]);
  });

  it("archives only once per restart and resumes the saved world without inference", async () => {
    session(1).save();
    const restarted = session(2);
    restarted.save();
    await restarted.game.turn("go kitchen");
    restarted.save();
    const loaded = session(999, false);
    expect(loaded.resumed).toBe(true);
    expect(loaded.game.world).toEqual(restarted.game.world);
    expect(loaded.game.log).toEqual(restarted.game.log);
    expect(loaded.meter.current.calls).toBe(0);
    expect(readdirSync(directory)).toHaveLength(2);
  });

  it("refuses a corrupt save without changing its bytes", () => {
    writeFileSync(savePath, "not a saved log\n");
    expect(() => session(1, false)).toThrow();
    expect(readFileSync(savePath, "utf8")).toBe("not a saved log\n");
  });

  it("can run without a save destination", () => {
    openSession({
      seed: 1,
      fresh: true,
      savePath: null,
      offline: true,
      record: false,
    }).save();
    expect(readdirSync(directory)).toEqual([]);
  });
});

const failure = new Error("injected filesystem failure");
const fail = () => {
  throw failure;
};
const interrupt = {
  write: () =>
    vi.mocked(writeFileSync).mockImplementationOnce((file) => {
      if (typeof file !== "number") throw new Error("expected a staged file descriptor");
      writeSync(file, "partial log");
      throw failure;
    }),
  flush: () => vi.mocked(fsyncSync).mockImplementationOnce(fail),
  archive: () => vi.mocked(copyFileSync).mockImplementationOnce(fail),
  replace: () => vi.mocked(renameSync).mockImplementationOnce(fail),
};

describe.each([false, true])("failed publication with fresh=%s", (fresh) => {
  it.each(["write", "flush", "replace"] as const)(
    "preserves the previous save on %s failure and permits retry",
    async (step) => {
      const original = session(1);
      original.save();
      const bytes = readFileSync(savePath, "utf8");
      const next = session(2, fresh);
      await next.game.turn("go kitchen");
      interrupt[step]();
      expect(() => next.save()).toThrow(failure);
      expect(readFileSync(savePath, "utf8")).toBe(bytes);
      expect(session(1, false).game.world).toEqual(original.game.world);
      expect(readdirSync(directory).some((file) => file.endsWith(".tmp"))).toBe(false);
      next.save();
      expect(session(1, false).game.world).toEqual(next.game.world);
      if (fresh)
        expect(
          readdirSync(directory).some(
            (file) =>
              file !== "night.jsonl" && readFileSync(join(directory, file), "utf8") === bytes,
          ),
        ).toBe(true);
    },
  );
});

it("refuses to replace a night when its required archive cannot be created", () => {
  session(1).save();
  const bytes = readFileSync(savePath, "utf8");
  const next = session(2);
  interrupt.archive();
  expect(() => next.save()).toThrow(failure);
  expect(readFileSync(savePath, "utf8")).toBe(bytes);
  expect(readdirSync(directory)).toEqual(["night.jsonl"]);
  next.save();
  expect(session(1, false).game.world).toEqual(next.game.world);
  expect(readdirSync(directory)).toHaveLength(2);
});

function play(input: string, extra: string[] = []) {
  return spawnSync(
    process.execPath,
    [
      join(ROOT, "packages/terminal/src/play.ts"),
      "--offline",
      "--plain",
      "--fast",
      `--save=${relative(join(ROOT, "saves"), savePath).replace(/\.jsonl$/, "")}`,
      ...extra,
    ],
    { cwd: ROOT, input, encoding: "utf8", timeout: 10_000 },
  );
}

it("the actual CLI saves, resumes, and archives restarted nights offline", () => {
  const first = play("go kitchen\nquit\n", ["--new", "--seed=7"]);
  expect(first.error).toBeUndefined();
  expect(first.status, first.stderr).toBe(0);
  expect(first.stdout).toContain("Saved. The log is the save");
  const world = session(1, false).game.world;
  const resumed = play("look\nquit\n");
  expect(resumed.error).toBeUndefined();
  expect(resumed.status, resumed.stderr).toBe(0);
  expect(resumed.stdout).toContain("Resumed from the log");
  expect(session(1, false).game.world).toEqual(world);
  const oldBytes = readFileSync(savePath, "utf8");
  const restarted = play("quit\n", ["--new", "--seed=8"]);
  expect(restarted.status, restarted.stderr).toBe(0);
  const archives = readdirSync(directory).filter((file) => file !== "night.jsonl");
  expect(archives).toHaveLength(1);
  expect(archives.map((file) => readFileSync(join(directory, file), "utf8"))).toEqual([oldBytes]);
});
