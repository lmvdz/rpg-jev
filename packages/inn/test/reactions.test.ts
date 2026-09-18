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
    (d) =>
      // Born of a belief, not seeded by content for a fixed hour.
      d.kind === "react" && d.cause !== null && (who === undefined || d.stakeholder === who),
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

describe("intentions held for the night", () => {
  it("are seeded by content for people who hold that disposition", () => {
    const { game } = scripted(() => undefined);
    const seeded = Object.values(game.world.debts).filter((d) => d.kind === "react");
    expect(seeded.length).toBeGreaterThan(0);
    for (const debt of seeded) {
      const d = DISPOSITIONS.find((x) => x.id === debt.data.disposition);
      expect(d, `${debt.id}: no disposition ${debt.data.disposition}`).toBeDefined();
      const role = game.world.actors[debt.stakeholder]?.role;
      const holds = d && ("role" in d.who ? d.who.role === role : d.who.actor === debt.stakeholder);
      expect(holds, `${debt.id}: ${debt.stakeholder} does not hold it`).toBe(true);
    }
  });

  it("lapse when the belief they hang on is let go", () => {
    const { game } = scripted(() => undefined);
    const hanging = Object.values(game.world.debts).filter((d) => d.data.claim);
    expect(hanging.length).toBeGreaterThan(0);
    for (const d of hanging) game.retire(d.stakeholder, d.data.claim ?? "", stimulus(game));
    for (const d of hanging) expect(game.world.debts[d.id]?.status).toBe("cancelled");
  });
});

describe("people act on what they believe, not on what is true", () => {
  const picking = (pick: string[]) => (id: string, request: JudgeRequest) =>
    id === "act" ? choose(request, id, pick) : undefined;

  it("offers to get rid of a thing that is already gone, and learns it is gone by going", async () => {
    const offered: string[][] = [];
    const { game } = scripted((id, request) => {
      const q = request.questions[id]?.question;
      if (id === "act" && q?.type === "choice") offered.push(Object.keys(q.criteria));
      return picking(["destroy", "let_it_lie"])(id, request);
    });
    // The stranger takes the ledger early; nobody has told the one who hid it.
    await play(game, ["go kitchen", "take iron key", "go cellar", "search barrel", "take ledger"]);
    await play(game, ["go yard", "wait 60", "wait 60", "wait 60", "wait 60"]);
    const found = beliefsOf(game.world, "odo").map((b) => b.claim.predicate);
    expect(found).toContain("found_gone");
    expect(game.world.machines.ledger_fate?.node).not.toBe("burned");
    // Once he knows, getting rid of it is no longer on offer.
    const after = offered.filter((o) => o.includes("press_blame"));
    expect(after.length).toBeGreaterThan(0);
  });

  it("burns what is still there, in front of whoever is in the room", async () => {
    const { game } = scripted(picking(["destroy", "let_it_lie"]));
    await play(game, ["go kitchen", "wait 60", "wait 60", "wait 60", "wait 60"]);
    expect(game.world.machines.ledger_fate?.node).toBe("burned");
    const seen = beliefsOf(game.world, PLAYER).map((b) => b.claim.predicate);
    expect(seen).toContain("burned");
  });

  it("pressing the blame when the thing is already back in the keeper's hands is a slip", async () => {
    const { game } = scripted(picking(["press_blame", "search_person"]));
    const tale = claim({ subject: "odo", predicate: "carried_bundle_to", place: "cellar" });
    considerReacting(game, "mara", tale, 0.2, { kind: "told", from: "tobin" }, stimulus(game));
    await play(game, ["wait 60", "wait 60", "wait 60"]);
    const held = beliefsOf(game.world, "mara").map((b) => b.claim.predicate);
    expect(held).toContain("found");
    expect(held).toContain("slipped");
  });

  it("pressing the blame otherwise brings the search forward", async () => {
    const { game } = scripted(picking(["press_blame", "search_person"]));
    const text = await play(game, [
      "go kitchen",
      "take iron key",
      "go cellar",
      "search barrel",
      "take ledger",
      "go common room",
      "wait 60",
      "wait 60",
      "wait 60",
    ]);
    const urged = Object.values(game.world.debts).find((d) => d.data.urged_by === "odo");
    expect(urged?.stakeholder).toBe("mara");
    expect(game.world.debts.mara_search?.status).toBe("cancelled");
    expect(text).toContain("lifts it out of your pack");
    expect(game.world.machines.ledger_fate?.node).toBe("returned");
  });
});

describe("speaking up", () => {
  it("is owed as a tale like any other, to whoever runs the house", async () => {
    const { game } = scripted((id, request) => {
      if (id === "act")
        return choose(request, id, ["tell_the_house", "let_it_lie", "search_person"]);
      if (id === "version") return choose(request, id, ["faithful"]);
      return id.startsWith("stake") || id === "believes" ? yes : undefined;
    });
    await play(game, ["wait 60", "wait 60", "wait 60", "wait 60"]);
    const held = beliefsOf(game.world, "mara").map((b) => b.claim.predicate);
    expect(held).toContain("carried_bundle_to");
  });
});
