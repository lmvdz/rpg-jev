/**
 * X3, heat between two things, as data. `src` gives and `tgt` takes; what `heat.ts` did in one
 * function is four rules here: the target warms (and dries, and its surface runs ahead), the
 * source pays for it (in fuel if it burns, in its own heat if it does not), the target may take
 * light, and a plunge may crack or temper it. A test holds these equal to the function they
 * replaced (test/matter/graph/heat-rules.test.ts).
 */
import type { Cond, Expr } from "./expr.ts";
import type { Rule } from "./rules.ts";

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
const gte = (a: Expr, b: Expr): Cond => ({ a, is: ">=", b });
const lt = (a: Expr, b: Expr): Cond => ({ a, is: "<", b });
const lte = (a: Expr, b: Expr): Cond => ({ a, is: "<=", b });
const yes = (path: string): Cond => gt(path, 0);

/** S6: what flows freezes only at the bottom of the scale, and what is solid melts at its point. */
const flows = (who: "src" | "tgt"): Expr =>
  when(
    { ref: `${who}.row.is.liquid`, equals: true },
    when(gt(`${who}.was.temperature`, 0.25), 1, 0),
    when(
      {
        all: [
          gt(`${who}.row.p.meltsAt`, 0),
          gte(`${who}.was.temperature`, sub(6.5, mul(`${who}.row.p.meltsAt`, 0.6))),
        ],
      },
      1,
      0,
    ),
  );

const fire: Cond = { has: "src.was.burning" };

export const HEAT_DERIVED: Readonly<Record<string, Expr>> = {
  srcFlows: flows("src"),
  liquid: max("d.srcFlows", flows("tgt")),
  // How much heat each holds: a level of mass is a step of four, and amount counts. What burns
  // gives far more than it holds, but still by its size.
  held: mul(pow(4, "src.p.mass"), "src.was.amount", when(fire, 20, 1)),
  holds: mul(pow(4, "tgt.p.mass"), "tgt.was.amount"),
  // What burns gives only for as long as its fuel lasts.
  minutes: when(fire, min("act.minutes", "src.was.burning.fuel"), "act.minutes"),
  power: when(fire, min(1, div("d.held", "d.holds")), 1),
  // A flame is scorching whatever the fuel is; otherwise the surface leads the bulk.
  srcSurface: when(fire, 5, clamp(add("src.was.temperature", "src.was.surfaceAbove"), 0, 5)),
  // The balance the two would come to, weighted by how much each holds.
  shared: when(
    fire,
    5,
    div(
      add(mul("d.held", "d.srcSurface"), mul("d.holds", "tgt.was.temperature")),
      add("d.held", "d.holds"),
    ),
  ),
  around: "tgt.place.temperature",
  // How close the two are weighs the balance against the place.
  to: add("d.around", mul(sub("d.shared", "d.around"), "act.contact")),
  // Plunged in a liquid, a thing gives up its heat many times faster than in air.
  rate: div(
    mul(
      add(0.1, mul("tgt.p.conductivity", 0.06)),
      "act.contact",
      "d.power",
      when(yes("d.liquid"), 8, 1),
    ),
    add(1, mul("tgt.p.mass", 0.3)),
  ),
  reach: add("d.around", mul(sub("d.srcSurface", "d.around"), "act.contact")),
  surfaceRate: mul(add(1, mul("tgt.p.flammability", 1.5)), "act.contact"),
  // Warmth dries; a liquid wets rather than dries; nothing dries below what its place keeps in it.
  warm: max(0, sub(div(add("tgt.was.temperature", "tgt.s.temperature"), 2), 2.5)),
  dried: when(yes("d.srcFlows"), 0, mul("d.warm", 0.05, "d.minutes")),
  air: max(0, sub("tgt.place.moisture", 2)),
  inside: add(mul("tgt.p.absorbency", 0.8), "tgt.row.moist"),
  keptWet: max("d.air", min(mul("d.air", 1.6), add(1, "d.inside"))),
  // What the target gained, which is what the source gave.
  given: mul("d.holds", sub("tgt.s.temperature", "tgt.was.temperature")),
  // Lighting: only what burns or glows can light a thing, and hot water cannot.
  glowing: when({ all: [lte("d.liquid", 0), gte("d.srcSurface", 4.5)] }, 1, 0),
  own: clamp(sub("tgt.row.p.flammability", "tgt.s.wetness"), 0, 5),
  burnRate: max(1, "tgt.now.p.flammability"),
  fuelCoat: div(mul("tgt.s.coating.amount", 60), "d.burnRate"),
  fuelSelf: div(
    mul(add(1, "tgt.now.p.mass"), add(1, "tgt.now.p.size"), 20, "tgt.s.amount"),
    "d.burnRate",
  ),
  // Shock: the gap at the moment of the plunge.
  gap: sub("tgt.was.temperature", "src.was.temperature"),
};

const lights: Cond = {
  all: [
    { lacks: "tgt.s.burning" },
    { any: [fire, yes("d.glowing")] },
    gt("tgt.place.air", 0),
    gt("tgt.now.p.flammability", 0),
    gte("tgt.x.surface", sub(5, mul("tgt.now.p.flammability", 0.3))),
  ],
};
const coatLights: Cond = { all: [{ has: "tgt.s.coating" }, gt("tgt.now.p.flammability", "d.own")] };
const plunged: Cond = { all: [gte("d.gap", 2), yes("d.liquid")] };

export const HEAT_RULES: readonly Rule[] = [
  {
    id: "warm",
    says: "Two things in contact share heat toward a balance weighted by how much each holds; the surface runs ahead of the bulk; warmth dries; great heat cleanses and sets",
    about: "tgt",
    first: [
      {
        effects: [
          {
            kind: "approach",
            q: "tgt.s.temperature",
            toward: "d.to",
            rate: "d.rate",
            over: "d.minutes",
            lo: 0,
            hi: 5,
          },
          {
            kind: "set",
            q: "tgt.x.surface",
            to: add("tgt.was.temperature", "tgt.was.surfaceAbove"),
          },
          {
            kind: "approach",
            q: "tgt.x.surface",
            toward: "d.reach",
            rate: "d.surfaceRate",
            over: "d.minutes",
          },
          {
            kind: "set",
            q: "tgt.s.wetness",
            to: max(min("tgt.was.wetness", "d.keptWet"), sub("tgt.was.wetness", "d.dried")),
            lo: 0,
            hi: 5,
          },
          {
            kind: "set",
            q: "tgt.s.surfaceAbove",
            to: max(0, sub(clamp("tgt.x.surface", 0, 5), "tgt.s.temperature")),
          },
          {
            kind: "set",
            q: "tgt.s.contamination",
            to: 0,
            lo: 0,
            hi: 5,
            when: gte("tgt.s.temperature", 4.5),
          },
          {
            kind: "put",
            q: "tgt.s.set",
            value: true,
            when: {
              all: [
                { ref: "tgt.s.set", equals: false },
                gt("tgt.p.setting", 0),
                gte("tgt.s.temperature", 4.5),
              ],
            },
          },
        ],
        because: ["X3", "P7", "P1", "S14", "S1", "S2"],
        note: {
          if: gt("tgt.s.temperature", "tgt.was.temperature"),
          say: "it heats",
          otherwise: "it cools",
        },
      },
    ],
  },
  {
    id: "draw",
    says: "What the target gains the source gives: in minutes of fuel if it burns, in its own heat if it does not",
    about: "src",
    first: [
      {
        when: { all: [fire, lte(sub("src.was.burning.fuel", "d.minutes"), 1e-9)] },
        effects: [
          {
            kind: "put",
            q: "src.s.coating",
            value: null,
            when: { ref: "src.s.burning.of", equals: "coating" },
          },
          { kind: "put", q: "src.s.burning", value: null },
        ],
        because: ["S3", "S14", "X3"],
        note: "it burns out",
      },
      {
        when: fire,
        effects: [
          { kind: "set", q: "src.s.burning.fuel", to: sub("src.was.burning.fuel", "d.minutes") },
        ],
        because: ["S3", "S14", "X3"],
        note: "it burns down",
        quiet: true,
      },
      {
        when: { any: [gt("d.given", 0), lt("d.given", 0)] },
        effects: [
          {
            kind: "set",
            q: "src.s.temperature",
            to: sub("src.was.temperature", div("d.given", "d.held")),
            lo: 0,
            hi: 5,
          },
        ],
        because: ["X3", "P1", "S14", "S1"],
        note: {
          if: gt("d.given", 0),
          say: "it cools as it gives up its heat",
          otherwise: "it warms as it takes the heat",
        },
      },
    ],
  },
  {
    id: "ignite",
    says: "A surface hot enough for how readily it burns takes light from what burns or glows, where there is air; the coat lights first if it burns more readily",
    about: "tgt",
    first: [
      {
        when: { all: [lights, coatLights, gt("d.fuelCoat", 0)] },
        effects: [
          { kind: "put", q: "tgt.s.burning", value: { of: "coating", fuel: 0 } },
          { kind: "set", q: "tgt.s.burning.fuel", to: "d.fuelCoat" },
        ],
        because: ["P6", "S1", "R6", "M6"],
        note: "its coat takes light",
      },
      // A coat that would light but has nothing left to burn: nothing takes light.
      { when: { all: [lights, coatLights] }, effects: [], because: [] },
      {
        when: { all: [lights, gt("d.fuelSelf", 0)] },
        effects: [
          { kind: "put", q: "tgt.s.burning", value: { of: "self", fuel: 0 } },
          { kind: "set", q: "tgt.s.burning.fuel", to: "d.fuelSelf" },
        ],
        because: ["P6", "S1", "R6", "S3"],
        note: "it takes light",
      },
    ],
  },
  {
    id: "shock",
    says: "Plunged from hot into a cold liquid, what is not tough cracks, and what can melt tempers",
    about: "tgt",
    first: [
      {
        when: { all: [plunged, lte("tgt.p.toughness", 1.5), lte("tgt.p.meltsAt", 0)] },
        effects: [
          { kind: "set", q: "tgt.s.integrity", to: min("tgt.was.integrity", 3), lo: 0, hi: 5 },
        ],
        because: ["P4", "S1", "X3"],
        note: "it cracks from the sudden cold",
      },
      {
        when: { all: [plunged, gt("tgt.p.meltsAt", 0), gte("tgt.was.temperature", 4)] },
        effects: [{ kind: "set", q: "tgt.s.temper", to: clamp(add("tgt.was.temper", 1), 0, 2) }],
        because: ["M2", "S1", "X3"],
        note: "cooled fast from hot, it comes out harder and less tough",
      },
    ],
  },
];
