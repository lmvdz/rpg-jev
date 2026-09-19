/**
 * A proposed row is untrusted. These hold that the checker lets every row the engine runs
 * through, and stops the ways a generated row could be wrong before anything runs it.
 */
import { describe, expect, it } from "vitest";
import { DRIFT_DERIVED, DRIFT_RULES } from "../../../src/matter/graph/drift-rules.ts";
import {
  FORCE_BODY_RULES,
  FORCE_DERIVED,
  FORCE_THING_RULES,
} from "../../../src/matter/graph/force-rules.ts";
import { HEAT_DERIVED, HEAT_RULES } from "../../../src/matter/graph/heat-rules.ts";
import type { Rule } from "../../../src/matter/graph/rules.ts";
import { type Allowed, validate, validateDerived } from "../../../src/matter/graph/validate.ts";

const DRIFT: Allowed = { parties: [], act: [], derived: DRIFT_DERIVED };
const HEAT: Allowed = {
  parties: ["src", "tgt"],
  act: ["minutes", "contact"],
  derived: HEAT_DERIVED,
};

const FORCE: Allowed = {
  parties: ["tool", "tgt", "arm"],
  act: ["effort", "care", "haste", "seconds", "surface", "along"],
  derived: FORCE_DERIVED,
};

const good: Rule = {
  id: "overheated",
  says: "Held too hot for too long, what can melt takes a hidden flaw",
  first: [
    {
      when: {
        all: [
          { a: "p.meltsAt", is: ">", b: 0 },
          { a: "s.temperature", is: ">=", b: 4.8 },
        ],
      },
      effects: [{ kind: "accrue", q: "s.flaw", rate: 0.01, lo: 0, hi: 5 }],
      because: ["M2", "S15"],
    },
  ],
};
const broken = (change: (r: Record<string, unknown>) => void): unknown => {
  const copy = JSON.parse(JSON.stringify(good));
  change(copy);
  return copy;
};
const effectOf = (r: Record<string, unknown>) =>
  (r.first as { effects: Record<string, unknown>[] }[])[0]?.effects[0] as Record<string, unknown>;

describe("checking a row without running it", () => {
  it("lets through every row the engine runs, as the engine's own", () => {
    for (const rule of DRIFT_RULES)
      expect(validate(rule, { ...DRIFT, engine: true }), rule.id).toEqual([]);
    for (const rule of HEAT_RULES)
      expect(validate(rule, { ...HEAT, engine: true }), rule.id).toEqual([]);
    for (const rule of [...FORCE_THING_RULES, ...FORCE_BODY_RULES])
      expect(validate(rule, { ...FORCE, engine: true }), rule.id).toEqual([]);
    for (const [name, expr] of Object.entries(FORCE_DERIVED))
      expect(validateDerived(name, expr, FORCE), name).toEqual([]);
    for (const [name, expr] of Object.entries(DRIFT_DERIVED))
      expect(validateDerived(name, expr, DRIFT), name).toEqual([]);
    for (const [name, expr] of Object.entries(HEAT_DERIVED))
      expect(validateDerived(name, expr, HEAT), name).toEqual([]);
  });

  it("and holds a proposed row to more: the engine's rows that make fire or unmake a coat would not pass as proposals", () => {
    const stopped = [...DRIFT_RULES, ...HEAT_RULES]
      .filter((r) => validate(r, r.about ? HEAT : DRIFT).length > 0)
      .map((r) => r.id);
    expect(stopped.sort()).toEqual(["bond", "burning", "draw", "ignite", "wetness"]);
  });

  it("lets a sound proposal through", () => {
    expect(validate(good, DRIFT)).toEqual([]);
  });

  it.each([
    [
      "a quantity that does not exist",
      (r: Record<string, unknown>) => {
        effectOf(r).rate = "p.magic";
      },
      /unknown quantity/,
    ],
    [
      "a state that does not exist",
      (r: Record<string, unknown>) => {
        effectOf(r).q = "s.mana";
      },
      /not a state/,
    ],
    [
      "a write to a property",
      (r: Record<string, unknown>) => {
        effectOf(r).q = "p.hardness";
      },
      /not a state/,
    ],
    [
      "a level moved without bounds",
      (r: Record<string, unknown>) => {
        delete effectOf(r).hi;
      },
      /without bounds/,
    ],
    [
      "making matter",
      (r: Record<string, unknown>) => {
        effectOf(r).q = "s.amount";
      },
      /only the engine/,
    ],
    [
      "an operator that does not exist",
      (r: Record<string, unknown>) => {
        effectOf(r).rate = { op: "eval", of: [1] };
      },
      /unknown operator/,
    ],
    [
      "a party who is not there",
      (r: Record<string, unknown>) => {
        effectOf(r).rate = "src.p.mass";
      },
      /unknown quantity/,
    ],
    [
      "a derived quantity nobody defined",
      (r: Record<string, unknown>) => {
        effectOf(r).rate = "d.nothing";
      },
      /unknown quantity/,
    ],
    [
      "a kind of effect that does not exist",
      (r: Record<string, unknown>) => {
        effectOf(r).kind = "explode";
      },
      /unknown kind/,
    ],
    [
      "citing nothing",
      (r: Record<string, unknown>) => {
        for (const alt of r.first as { because: string[] }[]) alt.because = [];
      },
      /cites nothing/,
    ],
    [
      "saying nothing",
      (r: Record<string, unknown>) => {
        r.says = "";
      },
      /does not say/,
    ],
    [
      "a number that is not one",
      (r: Record<string, unknown>) => {
        effectOf(r).rate = "Infinity" as unknown as number;
      },
      /unknown quantity/,
    ],
  ])("stops %s", (_name, change, problem) => {
    expect(validate(broken(change), DRIFT).join("\n")).toMatch(problem);
  });

  it("stops what is not data at all", () => {
    expect(
      validate({ ...good, first: [{ ...good.first[0], when: () => true }] }, DRIFT).join("\n"),
    ).toMatch(/survive JSON|not a condition/);
    expect(validate(null, DRIFT).length).toBeGreaterThan(0);
  });
});
