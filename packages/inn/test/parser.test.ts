import { describe, expect, it } from "vitest";
import { initialWorld } from "../src/content.ts";
import { BACK, match, resolveAnswer, scopeOf } from "../src/parser.ts";

function inKitchen() {
  const world = initialWorld(1);
  const player = world.actors.player;
  if (player) player.room = "kitchen";
  return world;
}

describe("the deterministic matcher", () => {
  it("reads the obvious verbs without a model", () => {
    const world = inKitchen();
    expect(match("go to the common room", world)).toMatchObject({
      kind: "action",
      action: { verb: "go", room: "common_room" },
    });
    expect(match("look", world)).toMatchObject({ action: { verb: "look" } });
    expect(match("take the brass key", world)).toMatchObject({
      action: { verb: "take", item: "brass_key" },
    });
    expect(match("talk to Odo", world)).toMatchObject({
      action: { verb: "say", act: "greet", to: "odo" },
    });
    expect(match("search the coat", world)).toMatchObject({
      action: { verb: "examine", target: "coat" },
    });
    expect(match("inspect kitchen", world)).toMatchObject({
      action: { verb: "examine", target: "kitchen" },
    });
    expect(match("examine cellar", world)).toMatchObject({
      action: { verb: "examine", target: "cellar" },
    });
    expect(match("inspect common room", world)).toMatchObject({
      action: { verb: "examine", target: "common_room" },
    });
    expect(match("ask odo about tobin", world)).toMatchObject({
      action: { verb: "say", act: "ask", topic: { kind: "entity", id: "tobin" } },
    });
  });

  it("answers an ambiguous noun with a question that names the candidates", () => {
    const asked = match("grab the key", inKitchen());
    expect(asked.kind).toBe("clarify");
    if (asked.kind !== "clarify") return;
    expect(asked.question).toBe("Which do you mean to take: the iron key or the brass key?");
    expect(asked.question).not.toMatch(/rephrase/i);

    const answer = resolveAnswer("the iron one", asked.candidates);
    expect(answer).toEqual({ kind: "one", id: "iron_key" });
    expect(asked.complete("iron_key")).toEqual({ verb: "take", item: "iron_key" });
    expect(resolveAnswer("that one", asked.candidates).kind).toBe("none");
  });

  it("hands free text on to the judge and says who is missing when someone is", () => {
    const world = inKitchen();
    expect(match("tell odo I know what he carried down those steps", world).kind).toBe("unmatched");
    expect(match("talk to mara", world)).toEqual({ kind: "error", message: "Mara is not here." });
    expect(match("go cellar", world)).toMatchObject({ action: { verb: "go", room: "cellar" } });
    expect(match("go office", world)).toMatchObject({ kind: "error" });
  });

  it("scopes what can be acted on to what is actually there", () => {
    const scope = scopeOf(inKitchen());
    expect(scope.people.map((p) => p.id)).toEqual(["odo"]);
    expect(scope.things.map((t) => t.id).sort()).toEqual([
      "brass_key",
      "coat",
      "iron_key",
      "onion",
      "pot",
    ]);
    // The markers exist but stay out of scope until the coat has been searched.
    expect(scope.things.some((t) => t.id === "markers")).toBe(false);
  });

  // Lines from the first outside playtest (2026-09-17) that the game fumbled.
  it("reads what the first playtester actually typed", () => {
    const world = inKitchen();
    expect(match("go to celler", world)).toMatchObject({ action: { verb: "go", room: "cellar" } });
    expect(match("go back", world)).toMatchObject({ action: { verb: "go", room: BACK } });
    expect(match("kill odo", world)).toMatchObject({ action: { verb: "attack", target: "odo" } });
    for (const mine of ["check backpack", "check pockets", "look in my bag"])
      expect(match(mine, world)).toMatchObject({ action: { verb: "inventory" } });
    const all = match("take everything", world);
    expect(all.kind).toBe("action");
    if (all.kind !== "action" || all.action.verb !== "take") return;
    expect(all.action.item.split(",").sort()).toEqual(["brass_key", "iron_key", "onion"]);
    expect(match("take onion", world)).toMatchObject({
      action: { verb: "take", item: "onion" },
    });
  });
});

describe("answering a clarification", () => {
  // Third playtest: "tel mara she's fat" was taken as the answer "that Mara took the ledger".
  it("takes only answers made of the candidates' words", () => {
    const candidates = [
      { id: "blame:mara", name: "that Mara took the ledger", aliases: [], kind: "thing" as const },
      { id: "c1", name: "that you went through Odo's coat", aliases: [], kind: "thing" as const },
    ];
    expect(resolveAnswer("tel mara she's fat", candidates).kind).toBe("none");
    expect(resolveAnswer("the coat one", candidates)).toEqual({ kind: "one", id: "c1" });
  });
});

describe("any verb on anything", () => {
  it("reads eat, sit, hide and kick against whatever is here", () => {
    const world = initialWorld(1);
    expect(match("eat the table", world)).toMatchObject({
      action: { verb: "attempt", how: "eat", target: { id: "table", place: "item" } },
    });
    // Bread and ale both serve: the game asks which, naming them.
    expect(match("eat", world).kind).toBe("clarify");
    // In kitchen, pot and onion both serve hunger, so it clarifies as well.
    expect(match("eat", inKitchen()).kind).toBe("clarify");
    const onlyPot = inKitchen();
    delete onlyPot.items.onion;
    expect(match("eat", onlyPot)).toMatchObject({
      action: { verb: "attempt", how: "eat", target: { id: "pot" } },
    });
    expect(match("sit down", world)).toMatchObject({
      action: { verb: "attempt", how: "sit", target: { id: "bench" } },
    });
    expect(match("kick the bench", world)).toMatchObject({
      action: { verb: "attempt", how: "kick" },
    });
    expect(match("bite mara", world)).toMatchObject({ action: { verb: "attack", target: "mara" } });
    expect(match("why stew", inKitchen())).toMatchObject({
      action: { verb: "why_thing", id: "pot" },
    });
    expect(match("why mara", world)).toMatchObject({ action: { verb: "why", npc: "mara" } });
  });
});
