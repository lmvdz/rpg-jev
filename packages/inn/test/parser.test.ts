import { describe, expect, it } from "vitest";
import { initialWorld } from "../src/content.ts";
import { match, resolveAnswer, scopeOf } from "../src/parser.ts";

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
    expect(scope.things.map((t) => t.id).sort()).toEqual(["brass_key", "coat", "iron_key"]);
    // The markers exist but stay out of scope until the coat has been searched.
    expect(scope.things.some((t) => t.id === "markers")).toBe(false);
  });
});
