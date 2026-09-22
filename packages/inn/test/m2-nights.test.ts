import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseLog } from "@rpg-jev/core";
import { CachingJudge, RecordedJudge, type Recordings } from "@rpg-jev/jev";
import { describe, expect, it } from "vitest";
import { Game } from "../src/game.ts";

const evidence = join(import.meta.dirname, "../../../validation/m2/before");
interface Night {
  seed: number;
  inputs: string[];
  recordings: Recordings;
}

describe("complete live-recorded M2 nights", () => {
  it.each([
    ["evidence", "resolved"],
    ["witness", "resolved"],
    ["denial", "condemned"],
  ])("%s reaches its recorded ending without a provider", async (route, ending) => {
    const directory = join(evidence, route);
    const night = JSON.parse(readFileSync(join(directory, "recordings.json"), "utf8")) as Night;
    const log = parseLog(readFileSync(join(directory, "log.jsonl"), "utf8"));
    const judge = new RecordedJudge(night.recordings);
    const game = Game.start(night.seed, new CachingJudge(judge));
    const transcript: string[] = [];
    for (const text of night.inputs) transcript.push(...(await game.turn(text)));
    expect(judge.misses).toEqual([]);
    expect(judge.hits).toBeGreaterThan(0);
    expect(game.over).toBe(true);
    expect(game.world.machines.quest?.node).toBe(ending);
    expect(transcript.join("\n")).toContain("***");
    const beforeResume = judge.hits;
    const resumed = Game.resume(log, judge);
    expect(resumed.world).toEqual(game.world);
    expect(resumed.over).toBe(true);
    expect(judge.hits).toBe(beforeResume);
  });
});
