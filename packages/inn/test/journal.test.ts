import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type BeliefSource, type Claim, makeClaim, parseLog, serializeLog } from "@rpg-jev/core";
import { ScriptedJudge } from "@rpg-jev/jev";
import { describe, expect, it } from "vitest";
import { C_ODO_GAMBLES, C_ODO_HID, C_TOBIN_SAW, MARA, ODO, PLAYER, TOBIN } from "../src/content.ts";
import { Game } from "../src/game.ts";
import { renderJournal } from "../src/journal.ts";
import { HELP, match } from "../src/parser.ts";
import { CountingJudge, choose, play, scripted } from "./helpers.ts";

function learn(game: Game, claim: Claim, source: BeliefSource, credence = 1): number {
  return game.commit({ kind: "add_claim", holder: PLAYER, claim, source, credence }, null);
}

describe("the player's journal", () => {
  it.each(["journal", "notes", "leads", "JOURNAL", "please read my notes"])(
    "matches %s without semantic inference",
    (text) => {
      const { game } = scripted(() => undefined);
      expect(match(text, game.world)).toEqual({ kind: "action", action: { verb: "journal" } });
    },
  );

  it("is discoverable and does not invent clues for a new character", () => {
    const { game } = scripted(() => undefined);
    expect(HELP).toContain("journal");
    expect(renderJournal(game.world)).toContain("No clues recorded yet");
    expect(renderJournal(game.world)).not.toMatch(/gambl|bundle|apron|hid the ledger/i);
  });

  it("recalls evidence earned through ordinary exploration, not just carried items", async () => {
    const { game } = scripted(() => undefined);
    await play(game, ["go kitchen", "search coat", "examine markers"]);
    const text = (await game.turn("journal")).join("\n");
    expect(text).toContain("Odo owes money to river gamblers");
    expect(text).toContain("You witnessed this");
    expect(text).not.toContain("hid the ledger");
    expect(game.world.items.markers?.at).not.toEqual({ holder: PLAYER });
  });

  it.each([
    [{ kind: "witnessed" }, "You witnessed this"],
    [{ kind: "shown", from: TOBIN }, "Tobin showed you evidence"],
    [{ kind: "told", from: TOBIN }, "Tobin told you"],
    [{ kind: "inferred" }, "Your own inference, not an observation"],
  ] satisfies [BeliefSource, string][])("keeps the source of %j distinct", (source, words) => {
    const { game } = scripted(() => undefined);
    learn(game, C_ODO_GAMBLES, source, 0.5);
    const text = renderJournal(game.world);
    expect(text).toContain(words);
    expect(text).toContain("your character half believes it");
    expect(text).toContain("not a verdict on what really happened");
  });

  it("shows current credence, including rejection, rather than obsolete confidence", () => {
    const { game } = scripted(() => undefined);
    const cause = learn(game, C_TOBIN_SAW, { kind: "told", from: TOBIN }, 0.8);
    game.commit(
      { kind: "update_credence", holder: PLAYER, claim: C_TOBIN_SAW.id, credence: 0 },
      cause,
    );
    const text = renderJournal(game.world);
    expect(text).toContain("does not believe it");
    expect(text).not.toContain("thinks it likely");
    expect(text.match(/carried something/g)).toHaveLength(1);
  });
});

describe("journal provenance and whereabouts", () => {
  it("keeps last-known whereabouts stale when someone moves out of sight", () => {
    const { game } = scripted(() => undefined);
    const claim = makeClaim({
      subject: ODO,
      predicate: "is_in",
      place: "kitchen",
      when: game.world.clock - 10,
      severity: 1,
      origin: null,
    });
    learn(game, claim, { kind: "told", from: TOBIN });
    const before = renderJournal(game.world);
    game.commit({ kind: "move", actor: ODO, to: "cellar" }, null);
    expect(renderJournal(game.world)).toBe(before);
    expect(before).toContain("Whereabouts account: Odo was in the kitchen");
    expect(before).toContain("account of 18:50");
    expect(before).toContain("may have moved since");
    expect(before).not.toContain("cellar");
  });

  it("keeps conflicting whereabouts accounts and their times without claiming either is current", () => {
    const { game } = scripted(() => undefined);
    for (const [place, minutesAgo] of [
      ["kitchen", 10],
      ["yard", 2],
    ] as const) {
      const claim = makeClaim({
        subject: ODO,
        predicate: "is_in",
        place,
        when: game.world.clock - minutesAgo,
        severity: 1,
        origin: null,
      });
      learn(game, claim, { kind: "told", from: TOBIN }, minutesAgo === 10 ? 0.9 : 0.5);
    }
    const journal = renderJournal(game.world);
    expect(journal).toContain("Odo was in the kitchen (account of 18:50)");
    expect(journal).toContain("Odo was in the stable yard (account of 18:58)");
    expect(journal.match(/Whereabouts account:/g)).toHaveLength(2);
    expect(journal).not.toContain("Last-known");
  });

  it("recalls whereabouts learned by asking a present NPC, not by reading the target's position", async () => {
    const { game } = scripted((id, request) => choose(request, id, ["tell", "none_of_these"]));
    const claim = makeClaim({
      subject: ODO,
      predicate: "is_in",
      place: "kitchen",
      when: game.world.clock - 10,
      severity: 1,
      origin: null,
    });
    // A speaker's memory is fixture data; the player must earn it through ordinary speech.
    game.commit(
      { kind: "add_claim", holder: MARA, claim, source: { kind: "witnessed" }, credence: 1 },
      null,
    );
    expect(renderJournal(game.world)).not.toContain("Odo was in");
    await game.turn("ask mara where odo");
    const journal = (await game.turn("journal")).join("\n");
    expect(journal).toContain("Mara told you");
    expect(journal).toContain("Odo was in the kitchen");
    game.commit({ kind: "move", actor: ODO, to: "cellar" }, null);
    expect((await game.turn("journal")).join("\n")).toBe(journal);
  });

  it("keeps the recorded source when later evidence strengthens the same belief", async () => {
    const { game } = scripted(() => undefined);
    learn(game, C_ODO_GAMBLES, { kind: "told", from: TOBIN }, 0.5);
    await play(game, ["go kitchen", "search coat", "examine markers"]);
    const text = renderJournal(game.world);
    expect(text).toContain("Tobin told you; your character is certain of it");
    expect(text.match(/owes money to river gamblers/g)).toHaveLength(1);
  });
});

describe("journal isolation and replay", () => {
  it("does not follow a rumor's private lineage or reveal hidden-state changes", () => {
    const { game } = scripted(() => undefined);
    const rumor = {
      ...C_ODO_GAMBLES,
      derivedFrom: C_ODO_HID.id,
      distortion: "drop_motive" as const,
    };
    learn(game, rumor, { kind: "told", from: TOBIN });
    const before = renderJournal(game.world);
    const hidden = structuredClone(game.world);
    hidden.claims[C_ODO_HID.id] = { ...C_ODO_HID, place: "office", motive: "SECRET MOTIVE" };
    const actor = hidden.actors[ODO];
    if (!actor) throw new Error("fixture is missing actor");
    actor.room = "office";
    actor.drives.suspicion = 0.99;
    hidden.edges = hidden.edges.filter((edge) => edge.src === PLAYER);
    hidden.debts = {};
    expect(renderJournal(hidden)).toBe(before);
    expect(before).not.toMatch(/SECRET|garbled|drop_motive|hid the ledger|office/);
  });

  it("logs the command but changes no world state, RNG, time, effects or judge calls", async () => {
    const judge = new CountingJudge(new ScriptedJudge(() => undefined));
    const game = Game.start(1, judge);
    learn(game, C_ODO_GAMBLES, { kind: "witnessed" });
    const world = structuredClone(game.world);
    const logLength = game.log.length;
    for (const text of ["journal", "notes", "leads"]) await game.turn(text);
    expect(game.world).toEqual(world);
    expect(judge.calls).toBe(0);
    expect(game.log.slice(logLength).map((entry) => entry.kind)).toEqual([
      "input",
      "input",
      "input",
    ]);
  });

  it.each(["look", "inventory", "help", "quit"])(
    "preserves the existing zero-time behavior of %s",
    async (text) => {
      const judge = new CountingJudge(new ScriptedJudge(() => undefined));
      const game = Game.start(1, judge);
      const world = structuredClone(game.world);
      await game.turn(text);
      expect(game.world).toEqual(world);
      expect(judge.calls).toBe(0);
      expect(game.log.map((entry) => entry.kind)).toEqual(["init", "input"]);
    },
  );

  it("restores the same journal from the actual JSONL save with no inference", async () => {
    const { game } = scripted(() => undefined);
    await play(game, ["go kitchen", "search coat", "examine markers"]);
    const judge = new CountingJudge(new ScriptedJudge(() => undefined));
    const resumed = Game.resume(parseLog(serializeLog(game.log)), judge);
    expect(await resumed.turn("journal")).toEqual(await game.turn("journal"));
    expect(resumed.world).toEqual(game.world);
    expect(judge.calls).toBe(0);
  });

  it("renders earned evidence and testimony from the existing live-recorded night", () => {
    const log = parseLog(
      readFileSync(join(import.meta.dirname, "../../../demo/log.jsonl"), "utf8"),
    );
    const nextNight = log.findIndex((entry, index) => index > 0 && entry.kind === "init");
    const firstNight = nextNight < 0 ? log : log.slice(0, nextNight);
    const judge = new CountingJudge(new ScriptedJudge(() => undefined));
    const game = Game.resume(firstNight, judge);
    const text = renderJournal(game.world);
    expect(text).toContain("You witnessed this");
    expect(text).toMatch(/(Mara|Odo|Tobin) told you/);
    expect(text).toContain("not a verdict on what really happened");
    expect(judge.calls).toBe(0);
  });
});
