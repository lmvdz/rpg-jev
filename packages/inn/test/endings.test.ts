import { serializeLog } from "@rpg-jev/core";
import { OfflineJudge } from "@rpg-jev/jev";
import { describe, expect, it } from "vitest";
import { Game } from "../src/game.ts";
import { ENDINGS } from "../src/prose.ts";

const custody = [
  [{ holder: "player" }, "You still carry the ledger"],
  [{ holder: "mara" }, "The ledger is in her possession"],
  [{ holder: "odo" }, "Neither you nor Mara has the ledger in hand"],
  [{ inside: "barrel" }, "Neither you nor Mara has the ledger in hand"],
  [{ room: "cellar" }, "Neither you nor Mara has the ledger in hand"],
  [{ room: "ashes" }, "Neither you nor Mara has the ledger in hand"],
] as const;

describe.each(["resolved", "cleared"])("%s is a state summary, not a scene", (quest) => {
  for (const room of ["common_room", "cellar", "yard"])
    for (const [at, expected] of custody)
      it(`${room}, ${JSON.stringify(at)}: current custody wins over past return`, () => {
        const game = Game.start(1, new OfflineJudge());
        game.commit(
          { kind: "set_node", target: { type: "machine", id: "quest" }, to: quest },
          null,
        );
        game.commit({ kind: "advance_clock", minutes: 240 }, null);
        game.commit({ kind: "advance_clock", minutes: 60 }, null);
        game.commit({ kind: "move", actor: "mara", to: room }, null);
        game.commit(
          { kind: "set_node", target: { type: "machine", id: "ledger_fate" }, to: "found" },
          null,
        );
        game.commit(
          { kind: "set_node", target: { type: "machine", id: "ledger_fate" }, to: "returned" },
          null,
        );
        game.commit({ kind: "transfer", item: "ledger", to: at }, null);
        const before = serializeLog(game.log);
        const world = structuredClone(game.world);
        const text = game.ending();
        expect(text).toContain("not what your character has seen or heard");
        expect(text).toContain(expected);
        expect(text).not.toMatch(/says|pours|slides|put it on|ledger is lost/);
        expect(serializeLog(game.log)).toBe(before);
        expect(game.world).toEqual(world);
        expect(Game.resume(game.log, new OfflineJudge()).ending()).toBe(text);
      });
});

describe("all terminal outcomes", () => {
  it("reports the owner's actual custody even without a return flag", () => {
    const game = Game.start(1, new OfflineJudge());
    game.commit(
      { kind: "set_node", target: { type: "machine", id: "quest" }, to: "resolved" },
      null,
    );
    game.commit({ kind: "transfer", item: "ledger", to: { holder: "mara" } }, null);
    expect(game.world.machines.ledger_fate?.node).toBe("hidden");
    expect(game.ending()).toContain("The ledger is in her possession");
  });

  it.each(Object.keys(ENDINGS))("%s is explicitly outside character knowledge", (key) => {
    expect(ENDINGS[key]).toContain("Epilogue — a world-state summary");
    expect(ENDINGS[key]).not.toMatch(/says|pours|slides|bars the door|sends Tobin|bed's paid/);
  });

  it("does not end a merely cleared night early", () => {
    const game = Game.start(1, new OfflineJudge());
    game.commit(
      { kind: "set_node", target: { type: "machine", id: "quest" }, to: "cleared" },
      null,
    );
    expect(game.ending()).toBeNull();
  });
});
