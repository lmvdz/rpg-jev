/**
 * From a belief to something done about it. The tests run over the class: every disposition
 * in content, every role, and the rules that hold for any reaction (a warning is given once,
 * a habit asks nobody, a role is what grants a power).
 */
import { beliefsOf, type Claim, makeClaim } from "@rpg-jev/core";
import type { JudgeRequest } from "@rpg-jev/jev";
import { describe, expect, it } from "vitest";
import { DISPOSITIONS, NPCS, PLAYER, POWERS } from "../src/content.ts";
import type { Game } from "../src/game.ts";
import { hasLine } from "../src/prose.ts";
import { canReact, considerReacting, REACTIONS } from "../src/reactions.ts";
import { choose, play, scripted, yes } from "./helpers.ts";

const reactDebts = (game: Game, who?: string) =>
  Object.values(game.world.debts).filter(
    (d) => d.kind === "react" && (who === undefined || d.stakeholder === who),
  );

const claim = (c: Partial<Claim> & Pick<Claim, "subject" | "predicate">): Claim =>
  makeClaim({ when: 19 * 60, severity: 2, origin: null, ...c });

const quiet = (pick: string[]) => (id: string, request: JudgeRequest) =>
  id === "act" ? choose(request, id, pick) : choose(request, id, ["none_of_these"]);

const stimulus = (game: Game) =>
  game.store.append({ kind: "stimulus", what: "test", data: {} }, null);

describe("every disposition in content is complete", () => {
  for (const d of DISPOSITIONS)
    it(`${d.id} offers only reactions that exist, and has words for what it says`, () => {
      for (const r of [...d.reactions, d.fallback])
        expect(Object.keys(REACTIONS), `${d.id}: ${r}`).toContain(r);
      expect(d.reactions).toContain(d.fallback);
      expect(d.because.length).toBeGreaterThan(10);
      const { who } = d;
      const holders = NPCS.filter((n) => !("actor" in who) || who.actor === n);
      for (const request of Object.values(d.says ?? {}))
        expect(
          holders.some((n) => hasLine(n, request)),
          `${d.id}: nobody has words for ${request}`,
        ).toBe(true);
    });
});

describe("a role is a power", () => {
  it("lets whoever keeps the inn answer a blow, and nobody else", () => {
    for (const keeper of NPCS) {
      const { game } = scripted(quiet(["throw_out"]));
      for (const n of NPCS) {
        const actor = game.world.actors[n];
        if (actor) actor.role = n === keeper ? "innkeeper" : "guest";
      }
      const blow = claim({ subject: PLAYER, predicate: "attacked", to: "someone" });
      for (const n of NPCS)
        considerReacting(game, n, blow, 1, { kind: "witnessed" }, stimulus(game));
      expect(reactDebts(game).map((d) => d.stakeholder)).toEqual([keeper]);
    }
  });

  it("offers a power only to a role that has it", () => {
    expect(POWERS.innkeeper).toContain("throw_out");
    const { game } = scripted(() => undefined);
    for (const n of NPCS)
      expect(canReact(game, n, "throw_out")).toBe(game.world.actors[n]?.role === "innkeeper");
  });
});

describe("a warning is a promise", () => {
  it("is given once; the second blow leaves only the door, and nobody is asked", async () => {
    const asked: string[] = [];
    const { game } = scripted((id, request) => {
      asked.push(id);
      if (id === "respond") return choose(request, id, ["shove"]);
      return quiet(["warn"])(id, request);
    });
    const first = await play(game, ["attack mara"]);
    expect(first).toContain("Once more and you sleep in the ford");
    expect(game.world.machines.quest?.node).toBe("suspected");
    expect(asked.filter((id) => id === "act")).toHaveLength(1);

    await play(game, ["attack mara"]);
    expect(asked.filter((id) => id === "act")).toHaveLength(1);
    expect(game.world.machines.quest?.node).toBe("thrown_out");
  });

  it("waits for the tale when the keeper did not see it", async () => {
    const { game } = scripted((id, request) => {
      if (id === "respond") return choose(request, id, ["shove"]);
      if (id.startsWith("stake") || id === "believes") return yes;
      if (id === "version") return choose(request, id, ["faithful"]);
      return quiet(["throw_out"])(id, request);
    });
    await play(game, ["go kitchen", "attack odo"]);
    expect(reactDebts(game, "mara")).toEqual([]);
    await play(game, ["wait 30"]);
    expect(reactDebts(game, "mara").length).toBeGreaterThan(0);
    expect(game.world.machines.quest?.node).toBe("thrown_out");
  });
});

describe("a reaction that cannot be reached yet", () => {
  it("is kept as decided and tried again, without asking twice", async () => {
    const asked: string[] = [];
    const { game } = scripted((id, request) => {
      asked.push(id);
      return quiet(["warn"])(id, request);
    });
    // Something keeps the innkeeper in the yard for a while; the stranger is in the common room.
    const cause = stimulus(game);
    const held = { id: "held_up", activity: "idle", at_location: "yard", cause: null };
    const entry = { ...held, at: game.world.clock, until: game.world.clock + 10 };
    game.commit({ kind: "apply_override", group: ["mara"], entry }, cause);
    game.runSchedules(cause);
    const blow = claim({ subject: PLAYER, predicate: "attacked", to: "tobin" });
    game.learn("mara", blow, 0.75, { kind: "told", from: "tobin" }, cause);
    const text = await play(game, ["wait 8", "wait 8", "wait 8"]);
    expect(asked.filter((id) => id === "act")).toHaveLength(1);
    expect(reactDebts(game, "mara").some((d) => d.id.endsWith("+") && d.data.only === "warn")).toBe(
      true,
    );
    expect(text).toContain("Once more and you sleep in the ford");
  });
});

describe("going to look is the same for any place", () => {
  it("goes where a trusted word points, even half believed, and finds what is there", async () => {
    const { game } = scripted(() => undefined);
    const tale = claim({ subject: "odo", predicate: "carried_bundle_to", place: "cellar" });
    considerReacting(game, "mara", tale, 0.2, { kind: "told", from: "tobin" }, stimulus(game));
    expect(reactDebts(game, "mara")).toHaveLength(1);
    await play(game, ["wait 15"]);
    const ledger = game.world.items.ledger?.at;
    expect(ledger && "holder" in ledger && ledger.holder).toBe("mara");
    expect(game.world.machines.ledger_fate?.node).toBe("returned");
    expect(game.world.machines.barrel_search?.node).toBe("searched");
  });

  it("sees what a room's fixtures show: a tale about the office finds the forced latch", async () => {
    const { game } = scripted(() => undefined);
    const tale = claim({ subject: "odo", predicate: "took", object: "ledger", place: "office" });
    considerReacting(game, "mara", tale, 0.75, { kind: "told", from: "tobin" }, stimulus(game));
    await play(game, ["wait 15"]);
    const seen = beliefsOf(game.world, "mara").map((b) => b.claim.predicate);
    expect(seen).toContain("forced_latch");
  });

  it("does not act on an untrusted word it does not believe", () => {
    const { game } = scripted(() => undefined);
    const tale = claim({ subject: "odo", predicate: "hid", place: "cellar" });
    considerReacting(game, "mara", tale, 0.2, { kind: "told", from: PLAYER }, stimulus(game));
    expect(reactDebts(game)).toEqual([]);
  });
});

describe("having it out", () => {
  it("is one debt per person, however many things point at them", () => {
    const { game } = scripted(() => undefined);
    const a = claim({ subject: "odo", predicate: "gambles" });
    const b = claim({ subject: "odo", predicate: "took", object: "ledger" });
    for (const c of [a, b])
      considerReacting(game, "mara", c, 0.75, { kind: "told", from: "tobin" }, stimulus(game));
    const owed = reactDebts(game, "mara").filter((d) => d.data.disposition === "has_it_out");
    expect(owed).toHaveLength(1);
  });

  it("a confession is everything they hold against themselves", async () => {
    const { game } = scripted((id, request) =>
      id === "reply" ? choose(request, id, ["confess"]) : undefined,
    );
    const tale = claim({ subject: "odo", predicate: "gambles" });
    game.learn("mara", tale, 0.75, { kind: "told", from: "tobin" }, stimulus(game));
    await play(game, ["wait 20"]);
    const held = beliefsOf(game.world, "mara")
      .filter((b) => b.claim.subject === "odo" && b.credence >= 0.9)
      .map((b) => b.claim.predicate);
    expect(held).toEqual(expect.arrayContaining(["took", "hid", "gambles"]));
  });
});
