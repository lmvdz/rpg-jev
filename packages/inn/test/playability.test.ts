import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseLog } from "@rpg-jev/core";
import { describe, expect, it, vi } from "vitest";
import { Game } from "../src/game.ts";
import { journalEntries, renderJournal } from "../src/journal.ts";
import { match } from "../src/parser.ts";

const root = join(import.meta.dirname, "../../../validation/m2-playability");
const read = (folder: string, name: string) => readFileSync(join(root, folder, name), "utf8");

describe.each(["offline", "live-recovered"])("retained %s CLI workflow", (folder) => {
  it("restores the complete world and stable references without inference", () => {
    const judge = { ask: vi.fn(() => Promise.reject(new Error("replay asked a model"))) };
    const discovery = Game.resume(parseLog(read(folder, "discovery.jsonl")), judge);
    const completed = Game.resume(parseLog(read(folder, "conversation.jsonl")), judge);
    const resumed = Game.resume(parseLog(read(folder, "resume.jsonl")), judge);
    expect(resumed.world).toEqual(completed.world);
    expect(renderJournal(resumed.world)).toEqual(renderJournal(completed.world));
    for (const entry of journalEntries(discovery.world))
      expect(journalEntries(resumed.world).find((e) => e.claim.id === entry.claim.id)?.note).toBe(
        entry.note,
      );
    expect(judge.ask).not.toHaveBeenCalled();
  });

  it("resolves the exact recorded note commands from only the then-current player state", () => {
    const log = parseLog(read(folder, "conversation.jsonl"));
    const judge = { ask: vi.fn(() => Promise.reject(new Error("matching asked a model"))) };
    let checked = 0;
    for (const [index, entry] of log.entries()) {
      if (entry.kind !== "input" || !entry.text.includes(" about note ")) continue;
      const game = Game.resume(log.slice(0, index), judge);
      expect(entry.via).toBe("parsed");
      expect(match(entry.text, game.world)).toEqual({ kind: "action", action: entry.action });
      checked++;
    }
    expect(checked).toBe(2);
    expect(judge.ask).not.toHaveBeenCalled();
  });
});

it("continues the failed process's saved decisions instead of replaying its live inputs", () => {
  const saved = read("live-retry", "failed-save.jsonl");
  expect(read("live-recovered", "discovery.jsonl")).toBe(saved);
  const prefix = parseLog(saved);
  const continued = parseLog(read("live-recovered", "conversation.jsonl"));
  expect(continued.slice(0, prefix.length)).toEqual(prefix);
  expect(continued.filter((e) => e.kind === "input" && e.text === "search coat")).toHaveLength(1);
});
