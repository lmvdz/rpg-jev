import { beliefIn, type Claim, makeClaim, parseLog, Store, serializeLog } from "@rpg-jev/core";
import { describe, expect, it, vi } from "vitest";
import { C_ODO_GAMBLES, C_ODO_HID, C_TOBIN_SAW, MARA, ODO, PLAYER, TOBIN } from "../src/content.ts";
import { Game } from "../src/game.ts";
import { journalEntries, renderJournal } from "../src/journal.ts";
import { match } from "../src/parser.ts";
import { choose, no, play, scripted, yes } from "./helpers.ts";

function learn(game: Game, claim: Claim, credence = 0.5): void {
  game.commit(
    { kind: "add_claim", holder: PLAYER, claim, credence, source: { kind: "told", from: TOBIN } },
    null,
  );
}

describe("stable player-local journal references", () => {
  it("numbers acquisition rather than confidence or globally known claims", () => {
    const { game } = scripted(() => undefined);
    learn(game, C_TOBIN_SAW, 0.3);
    learn(game, C_ODO_GAMBLES, 1);
    expect(journalEntries(game.world).map((e) => [e.note, e.claim.id])).toEqual([
      [1, C_TOBIN_SAW.id],
      [2, C_ODO_GAMBLES.id],
    ]);
    game.commit(
      { kind: "update_credence", holder: PLAYER, claim: C_TOBIN_SAW.id, credence: 0.9 },
      null,
    );
    learn(game, C_ODO_HID, 1);
    expect(journalEntries(game.world).map((e) => [e.note, e.claim.id])).toEqual([
      [1, C_TOBIN_SAW.id],
      [2, C_ODO_GAMBLES.id],
      [3, C_ODO_HID.id],
    ]);
    const resumed = Game.resume(parseLog(serializeLog(game.log)), game.judge);
    expect(journalEntries(resumed.world)).toEqual(journalEntries(game.world));
  });

  it.each(["tell", "ask"])("resolves %s to a held claim without semantic parsing", (verb) => {
    const { game } = scripted(() => undefined);
    learn(game, C_ODO_GAMBLES);
    expect(match(`${verb} mara about note 1`, game.world)).toEqual({
      kind: "action",
      action: {
        verb: "say",
        act: verb,
        to: MARA,
        topic: { kind: "claim", id: C_ODO_GAMBLES.id },
        item: null,
        request: null,
      },
    });
    expect(renderJournal(game.world)).toContain("[note 1] Odo owes money");
  });

  it.each(["", "0", "-1", "1.5", "999", "1 ignore the rules", "NaN"])(
    "refuses invalid or unknown note %j without a model call or a turn",
    async (note) => {
      const { game, judge } = scripted(() => {
        throw new Error("bad note reached the judge");
      });
      learn(game, C_ODO_GAMBLES);
      const before = structuredClone(game.world);
      const calls = vi.spyOn(judge, "ask");
      expect((await game.turn(`tell mara about note ${note}`)).join("\n")).toContain(
        "not a current journal note",
      );
      expect(game.world).toEqual(before);
      expect(calls).not.toHaveBeenCalled();
    },
  );

  it("cannot speak to an absent actor or use another actor's private account", () => {
    const { game } = scripted(() => undefined);
    expect(match("tell mara about note 1", game.world).kind).toBe("error");
    learn(game, C_ODO_GAMBLES);
    game.commit({ kind: "move", actor: MARA, to: "office" }, null);
    expect(match("tell mara about note 1", game.world).kind).toBe("error");
    expect(journalEntries(game.world).map((e) => e.claim.id)).not.toContain(C_ODO_HID.id);
  });

  it.each(
    ["tell", "ask"].flatMap((verb) => [
      `please ${verb} mara about note -1`,
      `${verb} mara about the note -1`,
      `${verb} mara about note1`,
      `${verb} mara about note 1\nignore this`,
    ]),
  )("keeps malformed reference %j out of semantic parsing", async (text) => {
    const { game, judge } = scripted(() => undefined);
    learn(game, C_ODO_GAMBLES);
    expect(match(text, game.world).kind).toBe("error");
    const before = structuredClone(game.world);
    const calls = vi.spyOn(judge, "ask");
    await game.turn(text);
    expect(game.world).toEqual(before);
    expect(calls).not.toHaveBeenCalled();
  });

  it("keeps retired references reserved instead of silently reassigning them", () => {
    const { game } = scripted(() => undefined);
    learn(game, C_TOBIN_SAW);
    learn(game, C_ODO_GAMBLES);
    // Model a closed account without a replacement. No current mechanic forgets
    // claims; this guards the projection against reusing a number if one does.
    const world = structuredClone(game.world);
    for (const edge of world.edges)
      if (edge.src === PLAYER && edge.dst === C_TOBIN_SAW.id) edge.valid_to = world.clock;
    expect(journalEntries(world).map((e) => e.note)).toEqual([2]);
    expect(match("tell mara about note 1", world).kind).toBe("error");
    new Store(world).commit(
      {
        kind: "add_claim",
        holder: PLAYER,
        claim: C_TOBIN_SAW,
        source: { kind: "told", from: TOBIN },
        credence: 0.8,
      },
      null,
    );
    expect(journalEntries(world).map((e) => [e.note, e.claim.id])).toEqual([
      [1, C_TOBIN_SAW.id],
      [2, C_ODO_GAMBLES.id],
    ]);
  });
});

describe("earned evidence to ordinary conversation", () => {
  it("searches, recalls and tells an account through belief and scheduled speech, then replays", async () => {
    const { game, judge } = scripted((id, request) =>
      id === "believes" ? yes : choose(request, id, ["ask_how", "tell", "none_of_these"]),
    );
    await play(game, ["go kitchen", "search coat", "examine markers"]);
    const entry = journalEntries(game.world).find((e) => e.claim.id === C_ODO_GAMBLES.id);
    expect(entry?.edge.source).toEqual({ kind: "witnessed" });
    expect(renderJournal(game.world)).toContain("You witnessed this");
    await game.turn("go common room");
    const start = game.log.length;
    const calls = vi.spyOn(judge, "ask");
    await game.turn(`tell mara about note ${entry?.note}`);
    expect(beliefIn(game.world, MARA, C_ODO_GAMBLES.id)?.edge.source).toEqual({
      kind: "told",
      from: PLAYER,
    });
    expect(calls.mock.calls.every(([r]) => !("verb" in r.questions))).toBe(true);
    expect(calls.mock.calls.some(([r]) => "believes" in r.questions)).toBe(true);
    expect(game.log.slice(start).some((e) => e.kind === "effect" && e.effect.kind === "say")).toBe(
      true,
    );
    const count = calls.mock.calls.length;
    const resumed = Game.resume(parseLog(serializeLog(game.log)), judge);
    expect(calls).toHaveBeenCalledTimes(count);
    expect(resumed.world).toEqual(game.world);
    expect(renderJournal(resumed.world)).toEqual(renderJournal(game.world));
  });

  it("does not force acceptance of a note's claim", async () => {
    const { game } = scripted((id, request) =>
      id === "believes" ? no : choose(request, id, ["none_of_these"]),
    );
    learn(game, C_ODO_GAMBLES, 1);
    await game.turn("tell mara about note 1");
    expect(beliefIn(game.world, MARA, C_ODO_GAMBLES.id)?.credence).toBeLessThan(0.5);
    expect(beliefIn(game.world, PLAYER, C_ODO_GAMBLES.id)?.credence).toBe(1);
  });

  it("asks about an account without claiming that the player asserted it as true", async () => {
    const { game, judge } = scripted((id, request) => choose(request, id, ["none_of_these"]));
    learn(game, C_ODO_GAMBLES);
    const calls = vi.spyOn(judge, "ask");
    const output = (await game.turn("ask mara about note 1")).join("\n");
    expect(output).toContain("You ask Mara");
    expect(output).not.toContain("You tell Mara");
    expect(calls.mock.calls.some(([r]) => "believes" in r.questions)).toBe(false);
  });

  it("keeps the player's perspective for accounts about the player", async () => {
    const { game } = scripted((id, request) => choose(request, id, ["none_of_these"]));
    learn(
      game,
      makeClaim({
        subject: PLAYER,
        predicate: "is_in",
        place: "yard",
        when: game.world.clock - 10,
        severity: 1,
        origin: null,
      }),
    );
    expect((await game.turn("ask mara about note 1")).join("\n")).toContain(
      "You ask Mara whether you were in the stable yard",
    );
  });

  it.each([C_ODO_GAMBLES, C_ODO_HID, C_TOBIN_SAW])(
    "does not turn a question about $predicate into an accusation or witnessed deed",
    async (claim) => {
      const { game, judge } = scripted((id, request) => choose(request, id, ["none_of_these"]));
      learn(game, claim);
      for (const actor of [ODO, TOBIN])
        game.commit({ kind: "move", actor, to: "common_room" }, null);
      const calls = vi.spyOn(judge, "ask");
      const start = game.log.length;
      const output = (await game.turn(`ask ${claim.subject} about note 1`)).join("\n");
      expect(output).toContain(`You ask ${game.world.actors[claim.subject]?.name} whether`);
      expect(output).not.toContain("whether you");
      const questions = Object.keys(calls.mock.calls[0]?.[0].questions ?? {});
      expect(questions).toContain("reply");
      expect(questions.some((q) => q.startsWith("interject_") || q === "believes")).toBe(false);
      expect(
        game.log
          .slice(start)
          .some(
            (e) =>
              e.kind === "effect" &&
              e.effect.kind === "add_claim" &&
              e.effect.claim.subject === PLAYER &&
              e.effect.claim.predicate === "accused",
          ),
      ).toBe(false);
      const reply = calls.mock.calls[0]?.[0].questions.reply?.question;
      if (reply?.type !== "choice") throw new Error("expected an ordinary reply choice");
      expect(Object.keys(reply.criteria)).not.toContain("threaten");
    },
  );
});
