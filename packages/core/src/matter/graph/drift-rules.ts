/**
 * X7, what time does to a thing, as data. Ten rows separate initial suppression, interval
 * evolution and boundary settlement. A test holds each row equal to its function reference over
 * thousands of seeded things (test/matter/graph/drift-rules.test.ts). The little helpers below
 * only spare the braces: what they return is plain data and survives JSON, which the same test
 * checks.
 */
import type { Cond, Expr } from "./expr.ts";
import type { Effect, Rule } from "./rules.ts";

const op = (name: "add" | "mul" | "sub" | "div" | "min" | "max" | "pow" | "clamp") => {
  return (...of: Expr[]): Expr => ({ op: name, of });
};
const [add, mul, sub, div] = [op("add"), op("mul"), op("sub"), op("div")];
const [min, max, pow, clamp] = [op("min"), op("max"), op("pow"), op("clamp")];
const when = (cond: Cond, then: Expr, otherwise: Expr): Expr => ({
  if: cond,
  then,
  else: otherwise,
});
const gt = (a: Expr, b: Expr): Cond => ({ a, is: ">", b });
const lte = (a: Expr, b: Expr): Cond => ({ a, is: "<=", b });
const lt = (a: Expr, b: Expr): Cond => ({ a, is: "<", b });
const gte = (a: Expr, b: Expr): Cond => ({ a, is: ">=", b });

const salty: Cond = { ref: "coat.is.granular", equals: true };

/** The derived quantities: nodes that several rules read, each said once. */
export const DRIFT_DERIVED: Readonly<Record<string, Expr>> = {
  // Integrate the fueled interval before settling burnout, then the ambient remainder.
  burningMinutes: when(
    { all: [{ has: "s.burning" }, gt("place.air", 0), gt("p.flammability", 0)] },
    max(0, min("t", "s.burning.fuel")),
    0,
  ),
  temperatureRate: div(mul(0.02, add(1, mul("p.conductivity", 0.2))), add(1, mul("p.mass", 0.3))),
  // What the air of the place holds, above an ordinary day.
  air: max(0, sub("place.moisture", 2)),
  // The water a thing can hold inside: what it drinks, and what is its own.
  inside: add(mul("p.absorbency", 0.8), "row.moist"),
  holds: min(mul("d.air", 1.6), add(1, "d.inside")),
  floor: max("d.air", "d.holds"),
  // How hard the place pulls water out of it: warmth and wind.
  exposed: add(1, max(0, sub("s.temperature", 2)), mul("place.wind", 0.3)),
  film: max(0, sub("s.wetness", "d.inside")),
  open: add(0.1, mul("p.porosity", 0.4)),
  // Bulk counts by powers: a timber takes weeks where a pot takes days.
  bulk: add(pow(1.5, sub(add("p.mass", "p.size"), 1)), mul("p.absorbency", 0.2)),
  // A coat of grains that dissolve readily draws water, and ties up what is there.
  thirst: when(salty, "coat.p.solubility", 0),
  tied: when(salty, mul(div("coat.p.solubility", 5), "s.coating.coverage"), 0),
  // Cold slows rot by degrees; it never quite stops above freezing.
  warmth: clamp(div(sub("s.temperature", 0.5), 2), 0.05, 1),
  // Rot needs water to live in, and oil is not water.
  water: when(
    { ref: "row.is.liquid", equals: true },
    1,
    clamp(div(mul("s.wetness", sub(1, div("wetWith.p.oiliness", 5))), 2), 0, 1),
  ),
  damp: mul("d.water", sub(1, "d.tied")),
  kept: when(gte(add("coat.p.cleansing", "coat.p.potency"), 3), 0.2, 1),
  // What barely perishes barely rots: the rate falls off faster than the level.
  rots: pow(div("p.perishability", 5), 1.5),
  loose: add("coat.p.solubility", when(salty, 2, 0)),
  clings: div(
    max(0, sub(add("coat.p.stickiness", mul("coat.p.perishability", 0.5)), "d.loose")),
    5,
  ),
};

/** Account from the true interval-start fuel even if an extension extinguished the flame. */
const fuelEffects = (over: Expr): readonly Effect[] => [
  { kind: "set", q: "x.fuelLeft", to: "was.burning.fuel" },
  {
    kind: "accrue",
    q: "x.fuelLeft",
    rate: -1,
    over,
    lo: 0,
    eps: 1e-9,
    spends: true,
    atLo: [
      {
        kind: "put",
        q: "s.coating",
        value: null,
        when: { ref: "was.burning.of", equals: "coating" },
      },
      { kind: "put", q: "s.burning", value: null },
    ],
  },
  // A boundary extinction must not be undone by restoring a positive remainder.
  { kind: "set", q: "s.burning.fuel", to: "x.fuelLeft", when: { has: "s.burning" } },
];

/** Already-due exhaustion and initial suppression happen before any interval evolution. */
export const DRIFT_BEFORE: readonly Rule[] = [
  {
    id: "burning-start",
    says: "Already exhausted fuel is gone; no air or no combustibility suppresses a remaining flame immediately",
    first: [
      {
        when: { all: [{ has: "s.burning" }, lte("s.burning.fuel", 0)] },
        effects: fuelEffects(0),
        because: ["S3", "X7"],
      },
      {
        when: {
          all: [{ has: "s.burning" }, { any: [lte("place.air", 0), lte("p.flammability", 0)] }],
        },
        effects: [
          { kind: "put", q: "s.burning", value: null },
          { kind: "set", q: "s.surfaceAbove", to: 0 },
        ],
        because: ["S3", "R6", "S2", "X7"],
      },
    ],
  },
];

/** Base fuel-exhaustion settlement follows both base and extension interval rows. */
export const DRIFT_DURING: readonly Rule[] = [
  {
    id: "temperature",
    says: "Temperature approaches flame heat only during the active fuel interval, then the place temperature",
    first: [
      {
        effects: [
          {
            kind: "approach",
            q: "s.temperature",
            toward: 5,
            rate: "d.temperatureRate",
            over: "d.burningMinutes",
            lo: 0,
            hi: 5,
          },
          {
            kind: "approach",
            q: "s.temperature",
            toward: "place.temperature",
            rate: "d.temperatureRate",
            over: sub("t", "d.burningMinutes"),
            lo: 0,
            hi: 5,
          },
        ],
        because: ["S1", "P7", "X7"],
      },
    ],
  },
  {
    id: "surface",
    says: "A surface that ran ahead of the bulk falls back to it within minutes",
    first: [
      {
        when: gt("s.surfaceAbove", 0),
        effects: [{ kind: "approach", q: "s.surfaceAbove", toward: 0, rate: 1 }],
        because: ["S1", "X7"],
      },
    ],
  },
  {
    id: "wetness",
    says: "A thing wets as far as it can drink in damp air, and dries in two speeds: a film within the hour, held water slowly through pores against bulk",
    first: [
      {
        when: lt("s.wetness", "d.holds"),
        effects: [
          { kind: "accrue", q: "s.wetness", rate: 0.2, lo: 0, hi: "d.holds" },
          { kind: "put", q: "s.wetWith", value: null },
        ],
        because: ["S2", "P9", "X7"],
      },
      { when: lte("s.wetness", "d.floor"), effects: [], because: [] },
      {
        // Said only as a closed form: the state is two quantities at once, a film and what is
        // held, and the structured kinds do not cover that. See the findings.
        effects: [
          {
            kind: "set",
            q: "s.wetness",
            lo: 0,
            hi: 5,
            to: max(
              "d.floor",
              add(
                max(
                  0,
                  sub(
                    sub("s.wetness", "d.film"),
                    div(mul("d.exposed", "d.open", 0.0045, "t"), "d.bulk"),
                  ),
                ),
                max(0, sub("d.film", mul("d.exposed", 0.0015, "t"))),
              ),
            ),
          },
        ],
        because: ["S2", "P1", "P9", "P10", "X7"],
      },
    ],
  },
  {
    id: "salt-draw",
    says: "A coat of something that dissolves readily draws the water out of what it covers",
    first: [
      {
        when: { all: [{ has: "s.coating" }, gte("d.thirst", 3), gt("s.wetness", 0)] },
        effects: [
          {
            kind: "accrue",
            q: "s.wetness",
            rate: mul(-1, div("d.thirst", 5), "s.coating.coverage", 0.01),
            lo: 0,
            hi: 5,
          },
        ],
        because: ["S7", "P12", "S2", "X7"],
      },
    ],
  },
  {
    id: "rot",
    says: "Living contamination grows in what is perishable, warm and damp; a cleansing coat slows it",
    first: [
      {
        when: { all: [gt("p.perishability", 0), lt("s.temperature", 4.5)] },
        effects: [
          {
            kind: "accrue",
            q: "s.contamination",
            rate: div(mul("d.rots", "d.warmth", "d.damp", "d.kept", 0.25), 60),
            lo: 0,
            hi: 5,
          },
        ],
        because: ["S9", "P15", "X7"],
      },
    ],
  },
  {
    id: "rust",
    says: "What corrodes rusts while it is wet, by how corrodible and how wet",
    first: [
      {
        when: { all: [gt("p.corrodibility", 0), gt("s.wetness", 0)] },
        effects: [
          {
            kind: "accrue",
            q: "s.corrosion",
            rate: div(mul(div("p.corrodibility", 5), div("s.wetness", 5), 0.1), 60),
            lo: 0,
            hi: 5,
          },
        ],
        because: ["S10", "P16", "S2", "X7"],
      },
    ],
  },
  {
    id: "setting",
    says: "Once dry, a thing that sets is hard for good",
    first: [
      {
        when: { all: [{ ref: "s.set", equals: false }, gt("p.setting", 0), lte("s.wetness", 0.2)] },
        effects: [{ kind: "put", q: "s.set", value: true }],
        because: ["P23", "M5", "X7"],
      },
    ],
  },
  {
    id: "bond",
    says: "A coat bonds as it dries into something that drinks, if it is the kind of thing that clings",
    first: [
      {
        when: { all: [{ has: "s.coating" }, { lacks: "s.burning" }] },
        effects: [
          {
            kind: "accrue",
            q: "s.coating.bond",
            rate: mul(div("p.absorbency", 5), "d.clings", 0.03),
            lo: 0,
            hi: 5,
          },
        ],
        because: ["S7", "P9", "P13", "P12", "X7"],
      },
    ],
  },
];

/** Fuel exhaustion is an end event, after every base and extension interval row. */
export const DRIFT_AFTER: readonly Rule[] = [
  {
    id: "burning-end",
    says: "The active interval spends its starting fuel even if the flame is extinguished at the boundary",
    first: [
      {
        when: {
          all: [
            { has: "was.burning" },
            gt("was.burning.fuel", 0),
            gt("place.air", 0),
            gt("p.flammability", 0),
          ],
        },
        effects: fuelEffects("t"),
        because: ["S3", "X7"],
      },
    ],
  },
];

/** Flattened reference order; the caller inserts extension rows before boundary settlement. */
export const DRIFT_RULES: readonly Rule[] = [...DRIFT_BEFORE, ...DRIFT_DURING, ...DRIFT_AFTER];
