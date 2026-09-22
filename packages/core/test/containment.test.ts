import { describe, expect, it } from "vitest";
import {
  type Action,
  type Attempt,
  applyContainment,
  buildContainmentOptions,
  decodeContainmentState,
  type Holder,
  MAX_OPTIONS,
  observableContainment,
  resolveContainment,
  type State,
} from "../src/containment/index.ts";

function holder(id: string, quantityMl = 0, capacityMl = 1000): Holder {
  return {
    id,
    label: id,
    look: { glyph: 0, ink: 1 },
    capacityMl,
    portable: true,
    open: true,
    placement: { kind: "ground", x: 0, z: 1 },
    contents: quantityMl ? { material: "liquid", quantityMl } : null,
    version: 0,
  };
}
function fixture(): State {
  return {
    actors: [{ id: "a", x: 0, z: 0, version: 0, carrySlots: 1 }],
    materials: [{ id: "liquid", label: "Water" }],
    holders: [holder("source", 1000), holder("destination")],
  };
}
function attempt(state: State, action: Action): Attempt {
  return {
    actor: "a",
    action,
    versions: Object.fromEntries([...state.actors, ...state.holders].map((r) => [r.id, r.version])),
  };
}
function run(state: State, action: Action): State {
  const result = resolveContainment(state, attempt(state, action), {
    canStep: () => true,
    canPlace: () => true,
  });
  expect(result.status).toBe("applied");
  return applyContainment(state, result.effects);
}
const pour: Action = {
  kind: "transfer",
  source: "source",
  destination: "destination",
  quantityMl: 250,
};

describe("containment mechanisms", () => {
  it("runs every command, with exclusive placement and conserved contents", () => {
    let state = fixture();
    expect(resolveContainment(state, attempt(state, { kind: "none" })).status).toBe("noop");
    state = run(state, { kind: "opening", holder: "source", open: false });
    expect(state.holders[0]?.open).toBe(false);
    state = run(state, { kind: "opening", holder: "source", open: true });
    state = run(state, pour);
    expect(state.holders.map((h) => h.contents?.quantityMl)).toEqual([750, 250]);
    state = run(state, { kind: "take", holder: "destination" });
    expect(state.holders[1]?.placement).toEqual({ kind: "held", actor: "a" });
    state = run(state, { kind: "move", x: 1, z: 0 });
    state = run(state, { kind: "place", holder: "destination", x: 2, z: 1 });
    expect(state.holders[1]?.placement).toEqual({ kind: "ground", x: 2, z: 1 });
  });
  it("empties the source exactly, never partially transfers or creates material", () => {
    const state = run(fixture(), { ...pour, quantityMl: 1000 });
    expect(state.holders[0]?.contents).toBeNull();
    const small = fixture();
    small.holders[1] = holder("destination", 0, 200);
    expect(resolveContainment(small, attempt(small, pour)).reason).toBe("capacity");
    expect(
      resolveContainment(fixture(), attempt(fixture(), { ...pour, quantityMl: 1001 })).reason,
    ).toBe("insufficient");
    const source = holder("source", 999);
    expect(() =>
      applyContainment(fixture(), [
        { kind: "holder_updated", beforeVersion: 0, after: { ...source, version: 1 } },
      ]),
    ).toThrow("conserved");
  });
  it("requires actor and every touched version and rejects missing targets", () => {
    const state = fixture();
    for (const versions of [
      {},
      { a: 0 },
      { a: 0, source: 0 },
      { a: 0, source: 1, destination: 0 },
    ]) {
      expect(resolveContainment(state, { actor: "a", action: pour, versions }).reason).toBe(
        "stale",
      );
    }
    expect(
      resolveContainment(state, attempt(state, { kind: "take", holder: "missing" })).reason,
    ).toBe("access");
    const effects = resolveContainment(state, attempt(state, pour)).effects;
    expect(() => applyContainment(applyContainment(state, effects), effects)).toThrow("version");
    expect(() => applyContainment(state, [...effects, ...effects])).toThrow("version");
  });
  it("requires terrain approval for adjacent movement; placement has a separate guard", () => {
    const state = fixture();
    const move = attempt(state, { kind: "move", x: 1, z: 0 });
    expect(resolveContainment(state, move).status).toBe("unsupported");
    expect(resolveContainment(state, move, { canStep: () => false }).reason).toBe("blocked");
    const diagonal = attempt(state, { kind: "move", x: 1, z: 1 });
    expect(resolveContainment(state, diagonal).status).toBe("unsupported");
    expect(resolveContainment(state, diagonal, { canStep: () => true }).status).toBe("applied");
    expect(resolveContainment(state, diagonal, { canStep: () => false }).reason).toBe("blocked");
    for (const x of [0, 2]) {
      expect(resolveContainment(state, attempt(state, { kind: "move", x, z: 0 })).reason).toBe(
        "invalid_step",
      );
    }
    const held = run(state, { kind: "take", holder: "source" });
    const place = attempt(held, { kind: "place", holder: "source", x: 0, z: 0 });
    expect(resolveContainment(held, place).status).toBe("unsupported");
    expect(resolveContainment(held, place, { canPlace: () => false }).reason).toBe("blocked");
  });
  it("protects other actors' possessions, reach, portability and carrying limits", () => {
    const state = fixture();
    state.actors.push({ id: "b", x: 0, z: 0, version: 0, carrySlots: 1 });
    state.holders[0] = { ...holder("source", 1000), placement: { kind: "held", actor: "b" } };
    expect(resolveContainment(state, attempt(state, pour)).reason).toBe("access");
    expect(observableContainment(state, "a").holders.map((h) => h.id)).toEqual(["destination"]);
    const held = run(fixture(), { kind: "take", holder: "source" });
    expect(
      resolveContainment(held, attempt(held, { kind: "take", holder: "destination" })).reason,
    ).toBe("carry_full");
    state.holders[0] = { ...holder("source"), portable: false };
    expect(
      resolveContainment(state, attempt(state, { kind: "take", holder: "source" })).reason,
    ).toBe("not_portable");
    state.holders[0] = { ...holder("source"), placement: { kind: "ground", x: 2, z: 0 } };
    expect(
      resolveContainment(state, attempt(state, { kind: "take", holder: "source" })).reason,
    ).toBe("access");
  });
  it("does not reveal closed contents through views, options or rejection reasons", () => {
    const empty = fixture();
    empty.holders[0] = { ...holder("source"), open: false };
    const full = fixture();
    full.holders[0] = { ...holder("source", 1000), open: false };
    full.materials.push({ id: "secret", label: "Secret material" });
    expect(observableContainment(empty, "a")).toEqual(observableContainment(full, "a"));
    expect(buildContainmentOptions(observableContainment(empty, "a"))).toEqual(
      buildContainmentOptions(observableContainment(full, "a")),
    );
    expect(resolveContainment(empty, attempt(empty, pour))).toEqual(
      resolveContainment(full, attempt(full, pour)),
    );
    expect(resolveContainment(full, attempt(full, pour)).reason).toBe("access");
  });
  it("uses bounded visible quantities and supplies executable version records", () => {
    const state = fixture();
    state.holders[1] = holder("destination", 0, 600);
    const options = buildContainmentOptions(observableContainment(state, "a"));
    expect(options[0]?.action.kind).toBe("none");
    const transfers = options.filter((o) => o.action.kind === "transfer");
    expect(transfers.map((o) => o.action.kind === "transfer" && o.action.quantityMl)).toEqual([
      100, 250, 600,
    ]);
    for (const option of transfers)
      expect(resolveContainment(state, { actor: "a", ...option }).status).toBe("applied");
  });
  it("is independent of content labels and does not mutate inputs or leak references", () => {
    const state = fixture();
    const before = structuredClone(state);
    const result = resolveContainment(state, attempt(state, pour));
    applyContainment(state, result.effects);
    const view = observableContainment(state, "a");
    view.actor.x = 100;
    const decoded = decodeContainmentState(state);
    const first = decoded.holders[0];
    if (first) first.look.ink = 4;
    expect(state).toEqual(before);
    state.materials = [{ id: "liquid", label: "Renamed substance" }];
    state.holders = state.holders.map((h) => ({ ...h, label: "Renamed vessel" }));
    expect(
      resolveContainment(state, attempt(state, pour)).effects.map(
        (e) => e.kind === "holder_updated" && e.after.contents,
      ),
    ).toEqual(result.effects.map((e) => e.kind === "holder_updated" && e.after.contents));
  });
});

describe("bounded containment menus", () => {
  it("keeps observations and offers stable across storage iteration order", () => {
    const state = fixture();
    const reversed = { ...state, holders: [...state.holders].reverse() };
    const before = observableContainment(state, "a");
    const after = observableContainment(reversed, "a");
    expect(after).toEqual(before);
    expect(buildContainmentOptions({ ...after, holders: [...after.holders].reverse() })).toEqual(
      buildContainmentOptions(before),
    );
  });

  it("caps dense menus deterministically without mutating the view", () => {
    const state = fixture();
    state.holders = Array.from({ length: 256 }, (_, i) => holder(`vessel-${i}`, 500));
    const view = observableContainment(state, "a");
    const before = structuredClone(view);
    const options = buildContainmentOptions(view);
    expect(options).toHaveLength(MAX_OPTIONS);
    expect(options[0]?.action.kind).toBe("none");
    expect(options.filter((o) => o.action.kind === "opening")).toHaveLength(256);
    const firstTransfer = options.findIndex((o) => o.action.kind === "transfer");
    expect(options.slice(firstTransfer).every((o) => o.action.kind === "transfer")).toBe(true);
    expect(buildContainmentOptions(view)).toEqual(options);
    expect(view).toEqual(before);
  });
});

describe("strict bounded containment decoding", () => {
  it.each([
    null,
    {},
    { ...fixture(), extra: true },
    { ...fixture(), actors: [{ id: "a", x: 0.5, z: 0, version: 0, carrySlots: 1 }] },
    { ...fixture(), holders: [holder("a")] },
    { ...fixture(), holders: [{ ...holder("x"), capacityMl: 0 }] },
    { ...fixture(), holders: [{ ...holder("x"), look: { glyph: 106, ink: 0 } }] },
    { ...fixture(), holders: [{ ...holder("x"), label: " bad " }] },
    { ...fixture(), holders: [{ ...holder("x"), label: "bad\ntext" }] },
    {
      ...fixture(),
      holders: [{ ...holder("x"), contents: { material: "unknown", quantityMl: 1 } }],
    },
    { ...fixture(), holders: [{ ...holder("x"), placement: { kind: "held", actor: "missing" } }] },
    { ...fixture(), holders: Array.from({ length: 257 }, (_, n) => holder(`h${n}`)) },
  ])("rejects malformed unknown state %#", (input) => {
    expect(() => decodeContainmentState(input)).toThrow();
  });
  it("rejects unsupported mixtures and malformed action quantities", () => {
    const state = fixture();
    state.materials.push({ id: "oil", label: "Oil" });
    state.holders[1] = { ...holder("destination"), contents: { material: "oil", quantityMl: 1 } };
    expect(resolveContainment(state, attempt(state, pour)).status).toBe("unsupported");
    for (const quantityMl of [0, -1, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(resolveContainment(state, attempt(state, { ...pour, quantityMl })).reason).toBe(
        "invalid_attempt",
      );
    }
  });
});
