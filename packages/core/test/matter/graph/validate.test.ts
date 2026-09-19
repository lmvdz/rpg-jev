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
import {
  COAT_DERIVED,
  COAT_RULES,
  FALL_RULES,
  LOAD_DERIVED,
  LOAD_RULES,
  SOAK_DERIVED,
  SOAK_RULES,
} from "../../../src/matter/graph/soak-rules.ts";
import {
  type Allowed,
  validate,
  validateDerived,
  validateFactor,
} from "../../../src/matter/graph/validate.ts";

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
    const others: [readonly Rule[], Allowed][] = [
      [SOAK_RULES, { parties: ["tgt", "liq"], act: ["amount"], derived: SOAK_DERIVED }],
      [
        COAT_RULES,
        { parties: ["tgt", "sub"], act: ["amount", "care", "haste"], derived: COAT_DERIVED },
      ],
      [
        [...LOAD_RULES, ...FALL_RULES],
        { parties: ["sup", "who"], act: ["borne"], derived: LOAD_DERIVED },
      ],
    ];
    for (const [rules, allowed] of others) {
      for (const rule of rules)
        expect(validate(rule, { ...allowed, engine: true }), rule.id).toEqual([]);
      for (const [name, expr] of Object.entries(allowed.derived))
        expect(validateDerived(name, expr, allowed), name).toEqual([]);
    }
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
    expect(stopped.sort()).toEqual(["burning-end", "burning-start", "draw", "ignite", "wetness"]);
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
});

describe("what a proposed row may and may not do", () => {
  it("lets a proposal put a fire out, loosen a coat, use a thing up, give something off and split a piece off; and never light a fire or make matter", () => {
    const rule = (effect: Record<string, unknown>): unknown => ({
      ...good,
      first: [{ effects: [effect], because: ["S3"] }],
    });
    const said = { because: ["E9"], note: "it does" };
    const allowed = { ...DRIFT, parties: ["self"] };
    expect(validate(rule({ kind: "put", q: "s.burning", value: null }), DRIFT)).toEqual([]);
    expect(
      validate(rule({ kind: "accrue", q: "s.coating.bond", rate: -0.01, lo: 0, hi: 5 }), DRIFT),
    ).toEqual([]);
    expect(validate(rule({ kind: "use", from: "self", amount: 0.1, ...said }), allowed)).toEqual(
      [],
    );
    expect(
      validate(
        rule({ kind: "emit", from: "self", channel: "smoke", strength: 2, ...said }),
        allowed,
      ),
    ).toEqual([]);
    expect(
      validate(
        rule({ kind: "put", q: "s.burning", value: { of: "self", fuel: 99 } }),
        DRIFT,
      ).join(),
    ).toMatch(/only the engine/);
    expect(
      validate(rule({ kind: "set", q: "s.coating.amount", to: 9, lo: 0, hi: 9 }), DRIFT).join(),
    ).toMatch(/only the engine/);
    expect(
      validate(
        rule({ kind: "wound", on: "self", depth: 5, bleeding: 5, burned: 0, ...said }),
        allowed,
      ).join(),
    ).toMatch(/only the engine/);
    expect(
      validate(
        rule({ kind: "emit", from: "self", channel: "telepathy", strength: 2, ...said }),
        allowed,
      ).join(),
    ).toMatch(/no channel/);
  });

  it("checks a factor as an expression on a quantity the base rows name", () => {
    expect(
      validateFactor("rots", { op: "clamp", of: ["s.wetness", 0, 1] }, DRIFT, DRIFT_DERIVED),
    ).toEqual([]);
    expect(validateFactor("nothing", 1, DRIFT, DRIFT_DERIVED).join()).toMatch(/do not name/);
    expect(validateFactor("rots", "p.magic", DRIFT, DRIFT_DERIVED).join()).toMatch(
      /unknown quantity/,
    );
  });

  it("stops what is not data at all", () => {
    expect(
      validate({ ...good, first: [{ ...good.first[0], when: () => true }] }, DRIFT).join("\n"),
    ).toMatch(/survive JSON|not a condition/);
    expect(validate(null, DRIFT).length).toBeGreaterThan(0);
  });
});
