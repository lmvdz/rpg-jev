/**
 * Coverage over classes, not cases (the world-design skill). Each test iterates a table the
 * engine reads and checks every row has everything the engine will ask of it: every verb
 * against every kind of thing, every thing described, every deed sayable and felt, every
 * voice present, every activity for something. A row added without its counterpart fails
 * here, before any player finds the gap.
 */
import { attempt, FORCE_VERBS, makeClaim, NEED_VERBS, NEEDS, SPEECH_ACTS } from "@rpg-jev/core";
import { OfflineJudge } from "@rpg-jev/jev";
import { describe, expect, it } from "vitest";
import { ACTIVITY_SERVES, initialWorld, NPCS, PLAYER, WRONGDOING } from "../src/content.ts";
import { Game } from "../src/game.ts";
import { match } from "../src/parser.ts";
import { lookAtItem, renderTurn } from "../src/prose.ts";
import { ACTIVITY, claimClause } from "../src/words.ts";

const world = initialWorld(1);
const VERBS = [...Object.keys(NEED_VERBS), ...FORCE_VERBS];

describe("every verb, against every kind of thing", () => {
  const serving = Object.fromEntries(NEEDS.map((n) => [n, 2]));
  const kinds = {
    serving: { serves: serving },
    inert: {},
    hard: { forced: { harm: 1, deed: "forced" } },
    hardAndServing: { serves: serving, forced: { harm: 2, deed: "forced" } },
  };
  // One row per kind of thing: what a verb that serves a need must resolve to against it.
  // `null` means the kind puts no further constraint beyond being one of the four outcomes.
  const EXPECTED_KIND: Record<
    keyof typeof kinds,
    (need: string | undefined, insistence: number) => ReturnType<typeof attempt>["kind"] | null
  > = {
    serving: (need) => (need ? "served" : null),
    inert: () => "nothing",
    hard: (need, insistence) => {
      if (!need) return "harm";
      return insistence > 0 ? "harm" : "too_hard";
    },
    hardAndServing: (need) => (need ? "served" : null),
  };
  for (const verb of VERBS)
    it(`${verb} resolves on every kind of thing, first try and insisted on`, () => {
      const need = NEED_VERBS[verb];
      for (const [name, thing] of Object.entries(kinds))
        for (const insistence of [0, 1, 3]) {
          const out = attempt(verb, thing, insistence);
          expect(["served", "nothing", "too_hard", "harm"], `${verb} on ${name}`).toContain(
            out.kind,
          );
          const expected = EXPECTED_KIND[name as keyof typeof kinds](need, insistence);
          if (expected) expect(out.kind, `${verb} on ${name}`).toBe(expected);
        }
    });

  it("is read by the matcher on a thing here, on a person, and alone", () => {
    for (const verb of VERBS) {
      const onThing = match(`${verb} the table`, world);
      expect(onThing.kind, `${verb} the table`).toBe("action");
      const onPerson = match(`${verb} mara`, world);
      expect(["action", "error"], `${verb} mara`).toContain(onPerson.kind);
      const alone = match(verb, world);
      expect(["action", "clarify", "error"], verb).toContain(alone.kind);
      expect(alone.kind === "error" ? alone.message : "").not.toMatch(/undefined|\{/);
    }
  });

  it("can reach every need that anything serves", () => {
    const reachable = new Set(Object.values(NEED_VERBS));
    for (const thing of [...Object.values(world.items), ...Object.values(world.rooms)])
      for (const [need, magnitude] of Object.entries(thing.serves ?? {}))
        if ((magnitude ?? 0) > 0)
          expect(reachable, `${thing.id} serves ${need} but no verb reaches for it`).toContain(
            need,
          );
  });
});

describe("every thing is described", () => {
  for (const item of Object.values(world.items))
    it(`${item.id} can be named, looked at, and tried`, () => {
      expect(item.aliases.length).toBeGreaterThan(0);
      expect(lookAtItem(item.id)).not.toBe("Nothing remarkable.");
      // What cannot be carried off will be kicked, climbed or bitten; it must say what that costs.
      if (!item.takeable) expect(item.forced, `${item.id} has no forced`).toBeDefined();
    });
  for (const room of Object.values(world.rooms))
    it(`${room.id} can be named`, () => {
      if (room.exits.length > 0) expect(room.aliases.length).toBeGreaterThan(0);
    });
});

describe("every deed can be said at every severity, and is felt", () => {
  for (const predicate of world.def.predicates)
    it(`${predicate} has words at severities 1 to 3`, () => {
      for (const severity of [1, 2, 3] as const) {
        const claim = makeClaim({
          subject: PLAYER,
          predicate,
          object: "ledger",
          to: "mara",
          place: "cellar",
          when: 0,
          severity,
          origin: null,
        });
        const words = claimClause(world, claim);
        expect(words, `${predicate}@${severity}`).not.toMatch(/[{}]|undefined/);
        expect(words.length).toBeGreaterThan(3);
      }
    });

  for (const predicate of WRONGDOING)
    it(`${predicate} moves someone who witnesses it`, () => {
      const game = Game.start(1, new OfflineJudge());
      const cause = game.store.append({ kind: "stimulus", what: "test", data: {} }, null);
      const before = { ...game.world.actors.mara?.drives };
      const claim = makeClaim({
        subject: PLAYER,
        predicate,
        object: "ledger",
        to: "mara",
        when: 0,
        severity: 2,
        origin: null,
      });
      game.learn("mara", claim, 1, { kind: "witnessed" }, cause);
      expect(game.world.actors.mara?.drives).not.toEqual(before);
    });
});

describe("every voice", () => {
  for (const npc of NPCS)
    for (const act of SPEECH_ACTS)
      it(`${npc} can ${act}`, () => {
        const line = renderTurn(world, {
          intent: {
            id: "t",
            speaker: npc,
            listener: PLAYER,
            act,
            topic: { kind: "none" },
            priority: 3,
            createdBeat: 0,
            cause: 0,
          },
          interrupts: null,
          whileWorking: false,
        });
        expect(line, `${npc} ${act}`).not.toMatch(/"\.\.\."|[{}]|undefined/);
      });
});

describe("every activity is for something", () => {
  const used = new Set(
    [...JSON.stringify(initialWorld(1)).matchAll(/"activity":"([a-z_]+)"/g)].map((m) => m[1]),
  );
  for (const activity of used)
    it(`${activity} has words and a purpose`, () => {
      expect(ACTIVITY[activity ?? ""], `${activity} has no words`).toBeDefined();
      expect(ACTIVITY_SERVES[activity ?? ""], `${activity} serves nothing`).toBeDefined();
    });
  for (const activity of Object.keys(ACTIVITY))
    it(`${activity} is for something`, () => {
      expect(ACTIVITY_SERVES[activity], `${activity} serves nothing`).toBeDefined();
    });
});
