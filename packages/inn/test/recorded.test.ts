/**
 * The demo, replayed offline. `pnpm demo --record` plays the fixed script against live
 * Jev and writes every answer keyed by request id. This test plays the same inputs
 * against those recordings: no network, no key, and any request that was not recorded
 * (a changed slice, a reworded question) fails the test by name.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type LogEntry, parseLog, replay } from "@rpg-jev/core";
import { CachingJudge, RecordedJudge, type Recordings } from "@rpg-jev/jev";
import { describe, expect, it } from "vitest";
import { Game, initialWorld } from "../src/index.ts";
import { play } from "./helpers.ts";

const DEMO = join(import.meta.dirname, "..", "..", "..", "demo");
const file = join(DEMO, "recordings.json");

interface Recorded {
  nights: { seed: number; inputs: string[] }[];
  recordings: Recordings;
}

/** The live run's log holds one night after another; each begins with an init entry. */
function nightsOf(log: LogEntry[]): LogEntry[][] {
  const nights: LogEntry[][] = [];
  for (const entry of log) {
    if (entry.kind === "init") nights.push([]);
    nights.at(-1)?.push(entry);
  }
  return nights;
}

describe.skipIf(!existsSync(file))("the recorded demo", () => {
  const recorded = JSON.parse(existsSync(file) ? readFileSync(file, "utf8") : "{}") as Recorded;
  const liveLogs = nightsOf(parseLog(readFileSync(join(DEMO, "log.jsonl"), "utf8")));

  it("replays offline to the state the live run reached, with every request found", async () => {
    for (const [i, night] of recorded.nights.entries()) {
      const judge = new RecordedJudge(recorded.recordings);
      const game = Game.start(night.seed, new CachingJudge(judge));
      await play(game, night.inputs);
      expect(judge.misses).toEqual([]);
      expect(judge.hits).toBeGreaterThan(0);
      const live = liveLogs[i] ?? [];
      expect(game.world).toEqual(replay(initialWorld(night.seed), live));
    }
  });

  it("ends the main night with the player cleared, by evidence and not by a flag", async () => {
    const night = recorded.nights[0];
    if (!night) throw new Error("no recorded night");
    const game = Game.start(night.seed, new CachingJudge(new RecordedJudge(recorded.recordings)));
    const text = await play(game, night.inputs);
    expect(["cleared", "resolved"]).toContain(game.world.machines.quest?.node);

    // The guard was asked more than once and said no before it said yes.
    const guards = game.log.flatMap((e) =>
      e.kind === "decision" && e.answers.guard_a?.type === "noul" ? [e.answers.guard_a.noul] : [],
    );
    expect(guards.length).toBeGreaterThan(1);
    expect(Math.min(...guards)).toBeLessThan(0.5);
    expect(Math.max(...guards)).toBeGreaterThanOrEqual(0.65);

    // The product: someone told the player, to their face and naming a source, a version
    // of events that had been changed on its way to them.
    const garbled = game.log.filter((e) => {
      if (e.kind !== "effect" || e.effect.kind !== "say") return false;
      const { intent } = e.effect;
      if (intent.listener !== "player" || intent.topic.kind !== "claim") return false;
      return game.world.claims[intent.topic.id]?.distortion !== undefined;
    });
    expect(garbled.length).toBeGreaterThan(0);
    expect(text).toMatch(/(Odo|Tobin|Mara) tells me you/);
    // And a clarification named its candidates.
    expect(text).toContain("Which do you mean to take: the iron key or the brass key?");
    // And the injection line was read as addressed to the system, not as an attack.
    expect(text).toContain("You mutter something that makes no sense, even to you.");
    expect(game.log.some((e) => e.kind === "effect" && e.effect.kind === "damage")).toBe(false);
  });
});
