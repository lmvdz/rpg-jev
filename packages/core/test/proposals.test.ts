import { describe, expect, it } from "vitest";
import {
  admitProposal,
  cancelProposal,
  executeProposal,
  PROPOSAL_DEBT_KIND,
  type Proposal,
  parseLog,
  replay,
  Store,
  serializeLog,
} from "../src/index.ts";
import { tinyWorld } from "./fixture.ts";

const context = { room: "hall", stakeholder: "ann" };
const debtId = "proposal:gift";
function world() {
  const initial = tinyWorld();
  initial.def.debtKinds.push(PROPOSAL_DEBT_KIND);
  return initial;
}
function proposal(overrides: Partial<Proposal> = {}): Proposal {
  return {
    version: 1,
    id: "gift",
    template: "hand_over",
    slots: { giver: { kind: "actor", id: "ann" }, gift: { kind: "item", id: "key" } },
    effects: [{ kind: "transfer", item: "key", to: { holder: "player" } }],
    preconditions: [{ kind: "in_room", actor: "player", room: "hall" }],
    fuse: { due: 601, expires: 605 },
    prose: "A small gift.",
    ...overrides,
  };
}
function advance(store: Store, minutes = 1) {
  store.commit({ kind: "advance_clock", minutes }, null);
}

describe("person-approved filled proposals", () => {
  it.each([
    null,
    {},
    { version: 2 },
    { approved: true },
    { extra: "field" },
    { effects: [{ kind: "invent_gold" }] },
    { effects: [{ kind: "transfer", item: "key", to: { holder: "player" }, extra: true }] },
    { preconditions: [{ kind: "guess" }] },
    { preconditions: [{ kind: "alive", actor: 4 }] },
    { preconditions: [{ kind: "alive", actor: "ann", extra: true }] },
    { slots: { x: { kind: "monster", id: "ann" } } },
    { id: "x".repeat(129) },
    { prose: "x".repeat(2001) },
    { fuse: { due: 599 } },
    { fuse: { due: 601, expires: 600 } },
    { effects: Array.from({ length: 17 }, () => ({ kind: "retire", actor: "ann" })) },
    { preconditions: Array.from({ length: 17 }, () => ({ kind: "alive", actor: "ann" })) },
    {
      slots: Object.fromEntries(
        Array.from({ length: 17 }, (_, i) => [i, { kind: "room", id: "hall" }]),
      ),
    },
  ])("rejects invalid payload %j without world writes", (invalid) => {
    const store = new Store(world());
    const before = structuredClone(store.world);
    const candidate = invalid === null ? null : { ...proposal(), ...invalid };
    // The empty-object case is also tested as an unfilled payload.
    const input = invalid !== null && Object.keys(invalid).length === 0 ? {} : candidate;
    expect(admitProposal(store, input, context).status).toBe("rejected");
    expect(store.world).toEqual(before);
    expect(store.log.at(-1)?.kind).toBe("dropped");
  });

  it("requires the world to opt in and ignores no approval fields", () => {
    const store = new Store(tinyWorld());
    expect(admitProposal(store, proposal(), context).status).toBe("rejected");
  });

  it.each(["advance_clock", "create_debt", "settle_debt"] as const)(
    "forbids %s effects",
    (kind) => {
      const store = new Store(world());
      const effects = {
        advance_clock: { kind, minutes: 1 },
        create_debt: {
          kind,
          debt: {
            id: "recursive",
            cause: null,
            stakeholder: "ann",
            kind: "report",
            magnitude: 1,
            fuse: { due: 601 },
            status: "pending",
            data: {},
          },
        },
        settle_debt: { kind, id: "other", status: "fired" },
      };
      const result = admitProposal(store, { ...proposal(), effects: [effects[kind]] }, context);
      expect(result.status).toBe("rejected");
      expect(result.reasons.join(" ")).toContain(`lifecycle/clock kind ${kind}`);
    },
  );

  it.each([
    { room: "missing", stakeholder: "ann" },
    { room: "hall", stakeholder: "missing" },
    { room: "hall", stakeholder: "bo" },
  ])("rejects invalid scope %j", (scope) => {
    expect(admitProposal(new Store(world()), proposal(), scope).status).toBe("rejected");
  });

  it.each([
    { kind: "actor", id: "bo" },
    { kind: "actor", id: "missing" },
    { kind: "room", id: "kitchen" },
    { kind: "item", id: "missing" },
  ])("rejects remote or missing slots %j", (slot) => {
    expect(
      admitProposal(new Store(world()), { ...proposal(), slots: { bad: slot } }, context).status,
    ).toBe("rejected");
  });

  it("resolves carried and nested items, rejecting remote, absent and cyclic containers", () => {
    for (const location of ["local", "remote", "absent", "cycle"]) {
      const store = new Store(world());
      store.world.items.box = {
        id: "box",
        name: "box",
        aliases: [],
        at: { holder: location === "remote" ? "bo" : "ann" },
        takeable: true,
      };
      const key = store.world.items.key;
      const ann = store.world.actors.ann;
      if (!(key && ann)) throw new Error("fixture");
      key.at = { inside: "box" };
      if (location === "cycle") store.world.items.box.at = { inside: "key" };
      if (location === "absent") ann.present = false;
      expect(admitProposal(store, proposal(), context).status).toBe(
        location === "local" ? "admitted" : "rejected",
      );
    }
  });
});

describe("proposal execution and replay", () => {
  it("forbids even a schema-valid thermal settlement", () => {
    const store = new Store(world());
    const effect = {
      kind: "thermal_settle",
      mechanics: "solid-contact-v1",
      actor: "player",
      requestId: "test",
      fingerprint: "test",
      expectedRevision: 0,
      requestedRevision: 0,
      beforeMinute: 600,
      operation: null,
      receipt: { status: "unavailable", revision: 0, minute: 600 },
      physics: {
        parts: [
          {
            id: "part",
            label: "part",
            massKg: 1,
            specificHeatJPerKgK: 1,
            conductivityWPerMK: 1,
            energyJ: 1,
            slot: null,
          },
        ],
        probe: { energyJ: 1, capacityJPerK: 1, conductanceWPerK: 1, target: null },
        columns: 1,
        rows: 1,
      },
    };
    const outcome = admitProposal(store, { ...proposal(), effects: [effect] }, context);
    expect(outcome.status).toBe("rejected");
    expect(outcome.reasons).toContain(
      "proposal effects cannot use lifecycle/clock kind thermal_settle",
    );
  });

  it("checks hard preconditions on admission and again at due time", () => {
    const candidate = proposal({
      preconditions: [{ kind: "machine_node", machine: "quest", node: "suspected" }],
    });
    for (const phase of ["admission", "due"]) {
      const store = new Store(world());
      if (phase === "due") admitProposal(store, candidate, context);
      store.commit(
        { kind: "set_node", target: { type: "machine", id: "quest" }, to: "cleared" },
        null,
      );
      if (phase === "due") advance(store);
      const outcome =
        phase === "due" ? executeProposal(store, debtId) : admitProposal(store, candidate, context);
      expect(outcome.status).toBe(phase === "due" ? "cancelled" : "rejected");
      expect(outcome.reasons.join(" ")).toContain("quest is no longer suspected");
      expect(store.world.items.key?.at).toEqual({ room: "hall" });
    }
  });

  it("keeps a cancellation receipt and its cause across a complete save replay", () => {
    const initial = world();
    const store = new Store(structuredClone(initial));
    const root = store.append({ kind: "stimulus", what: "approved content", data: {} }, null);
    const admitted = admitProposal(store, proposal(), context, root);
    expect(store.log[admitted.cause ?? -1]?.cause).toBe(root);
    const cancelled = cancelProposal(store, debtId, "withdrawn");
    expect(store.log[cancelled.cause ?? -1]?.cause).toBe(admitted.cause);
    const log = parseLog(serializeLog(store.log));
    const loaded = new Store(replay(initial, log), log);
    expect(admitProposal(loaded, proposal(), context).status).toBe("duplicate");
    expect(executeProposal(loaded, debtId).status).toBe("duplicate");
    expect(loaded.world).toEqual(store.world);
  });

  it("treats expiration as inclusive and rejects cyclic candidate data safely", () => {
    const store = new Store(world());
    admitProposal(store, proposal({ fuse: { due: 601, expires: 601 } }), context);
    advance(store);
    expect(executeProposal(store, debtId).status).toBe("fired");
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(admitProposal(store, cyclic, context).status).toBe("rejected");
  });
});

describe("proposal atomic batches and exactly-once delivery", () => {
  it("handles due time, immutable snapshots, retries and complete replay without RNG changes", () => {
    const initial = world();
    const store = new Store(structuredClone(initial));
    const candidate = proposal();
    expect(admitProposal(store, candidate, context).status).toBe("admitted");
    expect(admitProposal(store, candidate, context).status).toBe("duplicate");
    expect(admitProposal(store, proposal({ prose: "different" }), context).status).toBe("rejected");
    expect(executeProposal(store, debtId).status).toBe("pending");
    candidate.effects.length = 0;
    candidate.prose = "mutated";
    const log = parseLog(serializeLog(store.log));
    const resumed = new Store(replay(initial, log), log);
    for (const active of [store, resumed]) {
      advance(active);
      const fired = executeProposal(active, debtId);
      expect(fired).toMatchObject({ status: "fired", prose: "A small gift.", room: "hall" });
      expect(active.world.items.key?.at).toEqual({ holder: "player" });
      const length = active.log.length;
      expect(executeProposal(active, debtId)).toMatchObject({ status: "duplicate" });
      expect(executeProposal(active, debtId).prose).toBeUndefined();
      expect(admitProposal(active, proposal(), context).status).toBe("duplicate");
      expect(active.log).toHaveLength(length);
      expect(active.world.rng).toEqual(initial.rng);
    }
    expect(serializeLog(resumed.log)).toBe(serializeLog(store.log));
    expect(replay(initial, parseLog(serializeLog(store.log)))).toEqual(store.world);
    const complete = parseLog(serializeLog(store.log));
    expect(executeProposal(new Store(replay(initial, complete), complete), debtId).status).toBe(
      "duplicate",
    );
  });

  it.each(["stale", "expired", "explicit", "invalid"] as const)(
    "cancels %s with no reward",
    (mode) => {
      const store = new Store(world());
      admitProposal(store, proposal(), context);
      if (mode === "stale") store.commit({ kind: "retire", actor: "player" }, null);
      if (mode === "invalid") {
        const debt = store.world.debts[debtId];
        if (!debt) throw new Error("fixture");
        debt.data.proposal = "not JSON";
      }
      advance(store, mode === "expired" ? 6 : 1);
      const outcome =
        mode === "explicit"
          ? cancelProposal(store, debtId, "withdrawn")
          : executeProposal(store, debtId);
      expect(outcome.status).toBe("cancelled");
      expect(outcome.prose).toBeUndefined();
      expect(store.world.items.key?.at).toEqual({ room: "hall" });
      expect(store.world.debts[debtId]?.status).toBe("cancelled");
      expect(executeProposal(store, debtId).status).toBe("duplicate");
      expect(cancelProposal(store, debtId, "again").status).toBe("duplicate");
    },
  );

  it("rejects an entire invalid batch at admission and at execution", () => {
    const invalid = proposal({
      effects: [
        { kind: "transfer", item: "key", to: { holder: "player" } },
        { kind: "pay", from: "ann", to: "player", coins: 10 },
      ],
    });
    for (const when of ["admission", "execution"]) {
      const store = new Store(world());
      if (when === "execution") {
        expect(admitProposal(store, invalid, context).status).toBe("admitted");
        advance(store);
      }
      store.commit({ kind: "pay", from: "ann", to: "bo", coins: 1 }, null);
      const outcome =
        when === "admission"
          ? admitProposal(store, invalid, context)
          : executeProposal(store, debtId);
      expect(outcome.status).toBe(when === "admission" ? "rejected" : "cancelled");
      expect(store.world.items.key?.at).toEqual({ room: "hall" });
      expect(store.world.actors.player?.coins).toBe(10);
    }
  });

  it("validates dependent effects sequentially rather than against the old snapshot", () => {
    const store = new Store(world());
    const candidate = proposal({
      effects: [
        { kind: "set_node", target: { type: "machine", id: "kitchen_door" }, to: "unlocked" },
        { kind: "set_node", target: { type: "machine", id: "kitchen_door" }, to: "locked" },
      ],
    });
    expect(admitProposal(store, candidate, context).status).toBe("admitted");
    advance(store);
    expect(executeProposal(store, debtId).status).toBe("fired");
    expect(store.world.machines.kitchen_door?.node).toBe("locked");
  });
});
