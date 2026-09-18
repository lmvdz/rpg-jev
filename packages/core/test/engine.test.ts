import { describe, expect, it } from "vitest";
import {
  beliefsAsOf,
  beliefsOf,
  causeChain,
  checkInvariants,
  distort,
  dueDebts,
  EFFECT_KINDS,
  type Effect,
  EffectRejected,
  failedPreconditions,
  feasibleDistortions,
  makeClaim,
  parseLog,
  replay,
  Store,
  serializeLog,
  stanceOf,
  validateEffect,
  why,
} from "../src/index.ts";
import { tinyWorld } from "./fixture.ts";

const sawKey = makeClaim({
  subject: "player",
  predicate: "took",
  object: "key",
  place: "hall",
  when: 600,
  severity: 1,
  motive: "to_fetch_ale",
  origin: 0,
});

const { motive: _motive, ...noMotive } = sawKey;

describe("effects", () => {
  it("rejects an effect of an unknown kind", () => {
    const reasons = validateEffect(tinyWorld(), { kind: "smite", target: "ann" });
    expect(reasons.length).toBeGreaterThan(0);
  });

  it("keeps the vocabulary closed and explicit", () => {
    expect(EFFECT_KINDS).toContain("create_debt");
    expect(EFFECT_KINDS).not.toContain("smite");
  });

  it("rejects an illegal FSM transition and an unknown predicate", () => {
    const world = tinyWorld();
    expect(
      validateEffect(world, {
        kind: "set_node",
        target: { type: "machine", id: "quest" },
        to: "suspected",
      }),
    ).toEqual(["quest: suspected -> suspected is not a legal transition"]);
    expect(
      validateEffect(world, {
        kind: "add_claim",
        holder: "ann",
        claim: { ...sawKey, predicate: "levitated" },
        credence: 1,
        source: { kind: "witnessed" },
      }),
    ).toContain("predicate levitated is not in the vocabulary");
  });

  it("logs a rejected effect and leaves the world alone", () => {
    const store = new Store(tinyWorld());
    const before = structuredClone(store.world);
    expect(store.tryCommit({ kind: "pay", from: "ann", to: "bo", coins: 99 }, null)).toBeNull();
    expect(store.world).toEqual(before);
    expect(store.log.at(-1)?.kind).toBe("rejected");
    expect(() => store.commit({ kind: "move", actor: "ann", to: "moon" }, null)).toThrow(
      EffectRejected,
    );
  });

  it("never overwrites a belief row: it closes the old one and adds a new one", () => {
    const store = new Store(tinyWorld());
    store.commit(
      {
        kind: "add_claim",
        holder: "ann",
        claim: sawKey,
        credence: 1,
        source: { kind: "witnessed" },
      },
      null,
    );
    store.commit({ kind: "advance_clock", minutes: 30 }, null);
    store.commit({ kind: "update_credence", holder: "ann", claim: sawKey.id, credence: 0.3 }, null);

    const rows = store.world.edges.filter((e) => e.kind === "believes" && e.src === "ann");
    expect(rows.map((r) => [r.credence, r.valid_to])).toEqual([
      [1, 630],
      [0.3, null],
    ]);
    expect(beliefsOf(store.world, "ann")[0]?.credence).toBe(0.3);
    expect(beliefsAsOf(store.world, "ann", 610)[0]?.credence).toBe(1);
    expect(checkInvariants(store.world)).toEqual([]);
  });

  it("moves a stance only along legal transitions", () => {
    const store = new Store(tinyWorld());
    const target = { type: "stance", npc: "ann", toward: "player" } as const;
    store.commit({ kind: "set_node", target, to: "curious" }, null);
    expect(stanceOf(store.world, "ann", "player")).toBe("curious");
    expect(store.tryCommit({ kind: "set_node", target, to: "hostile" }, null)).toBeNull();
  });

  it("drops what the dead were holding", () => {
    const store = new Store(tinyWorld());
    store.commit({ kind: "transfer", item: "key", to: { holder: "ann" } }, null);
    store.commit({ kind: "damage", target: "ann", amount: 5 }, null);
    expect(store.world.actors.ann?.alive).toBe(false);
    expect(store.world.items.key?.at).toEqual({ room: "hall" });
    expect(checkInvariants(store.world)).toEqual([]);
  });
});

describe("replay", () => {
  function playSomething(): Store {
    const store = new Store(tinyWorld());
    const root = store.append(
      { kind: "input", text: "take key", via: "matcher", action: null },
      null,
    );
    store.commit({ kind: "transfer", item: "key", to: { holder: "player" } }, root);
    const seen = store.commit(
      {
        kind: "add_claim",
        holder: "ann",
        claim: sawKey,
        credence: 1,
        source: { kind: "witnessed" },
      },
      root,
    );
    const decision = store.append(
      {
        kind: "decision",
        requestId: "r1",
        sliceHash: "h1",
        source: "jev",
        answers: {
          distort: {
            type: "choice",
            choice: "none",
            confidence: 0.5,
            probabilities: { none: 0.6, exaggerate_severity: 0.4 },
          },
        },
        inputTokens: 100,
        latencyMs: 1,
      },
      seen,
    );
    store.draw("sample distort", decision);
    const retold = distort(sawKey, "exaggerate_severity", null);
    store.commit({ kind: "move", actor: "bo", to: "hall" }, decision);
    store.commit(
      {
        kind: "add_claim",
        holder: "bo",
        claim: retold,
        credence: 0.8,
        source: { kind: "told", from: "ann" },
      },
      decision,
    );
    store.commit({ kind: "advance_clock", minutes: 5 }, null);
    store.commit(
      {
        kind: "create_debt",
        debt: {
          id: "d1",
          cause: null,
          stakeholder: "bo",
          kind: "report",
          magnitude: 1,
          fuse: { due: 610 },
          status: "pending",
          data: {},
        },
      },
      decision,
    );
    return store;
  }

  it("rebuilds the identical world from the log alone", () => {
    const store = playSomething();
    const rebuilt = replay(tinyWorld(), parseLog(serializeLog(store.log)));
    expect(rebuilt).toEqual(store.world);
    expect(rebuilt.rng).toEqual(store.world.rng);
  });

  it("walks a belief back to the input that caused it", () => {
    const store = playSomething();
    const report = why(store.world, store.log, "bo", "player");
    const belief = report?.beliefs[0];
    expect(belief?.lineage.map((c) => c.severity)).toEqual([1, 2]);
    expect(belief?.chain.map((e) => e.kind)).toEqual(["effect", "decision", "effect", "input"]);
    expect(causeChain(store.log, 0)).toHaveLength(1);
  });

  it("fires debts by fuse, in order", () => {
    const store = playSomething();
    expect(dueDebts(store.world)).toEqual([]);
    store.commit({ kind: "advance_clock", minutes: 5 }, null);
    expect(dueDebts(store.world).map((d) => d.id)).toEqual(["d1"]);
    store.commit({ kind: "settle_debt", id: "d1", status: "fired" }, null);
    expect(dueDebts(store.world)).toEqual([]);
  });
});

describe("claims", () => {
  it("only offers distortions that would change the claim", () => {
    expect(feasibleDistortions(sawKey, "bo")).toEqual([
      "exaggerate_severity",
      "swap_culprit",
      "drop_motive",
    ]);
    const bare = makeClaim({ ...noMotive, severity: 3 });
    expect(feasibleDistortions(bare, null)).toEqual([]);
  });

  it("gives equal content one id, whoever says it", () => {
    const a = distort(sawKey, "drop_motive", null);
    const b = makeClaim(noMotive);
    expect(a.id).toBe(b.id);
    expect(a.derivedFrom).toBe(sawKey.id);
    expect(distort(sawKey, "swap_culprit", "bo").subject).toBe("bo");
  });
});

describe("preconditions", () => {
  it("drops a decision whose snapshot went stale", () => {
    const store = new Store(tinyWorld());
    const pre = [{ kind: "in_room", actor: "ann", room: "hall" } as const];
    expect(failedPreconditions(store.world, pre)).toEqual([]);
    store.commit({ kind: "move", actor: "ann", to: "kitchen" } satisfies Effect, null);
    expect(failedPreconditions(store.world, pre)).toEqual(["ann is no longer in hall"]);
  });
});

describe("means and ends", () => {
  it("lets a thing be tried for what it is: too hard once, harm when insisted on", async () => {
    const { attempt, endsOf, ENDS } = await import("../src/needs.ts");
    const table = { forced: { harm: 1, deed: "forced" } };
    const stew = { serves: { hunger: 3 } };
    const bread = { serves: { hunger: 1 }, consumable: true };
    const cloth = {};
    expect(attempt("eat", table, 0)).toEqual({ kind: "too_hard", need: "hunger", harm: 1 });
    expect(attempt("eat", table, 1)).toMatchObject({ kind: "harm", harm: 1 });
    expect(attempt("eat", stew, 0)).toMatchObject({
      kind: "served",
      magnitude: 3,
      consumed: false,
    });
    expect(attempt("eat", bread, 0)).toMatchObject({ kind: "served", consumed: true });
    expect(attempt("eat", cloth, 5)).toEqual({ kind: "nothing", need: "hunger" });
    expect(attempt("kick", table, 0)).toMatchObject({ kind: "harm" });
    expect(attempt("kick", cloth, 0)).toEqual({ kind: "nothing", need: null });
    // Food is for nourishment, nourishment is for work, work is for coin, coin is for safety.
    expect(endsOf("hunger")).toEqual(["hunger", "money", "safety", "rest"]);
    for (const e of Object.values(ENDS)) expect(e.enables.length).toBeGreaterThan(0);
  });
});
