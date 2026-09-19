/**
 * X4, soak, X5's coating half, and R3, load, as data. A liquid `liq` wets a target `tgt` as far
 * as it can drink, puts out what burns if there is enough of it, carries what lives in it, and
 * lifts a coat only if it can get under it. A substance `sub` becomes a coat on `tgt`. A
 * support `sup` bears what is put on it or gives way. Tests hold each equal to the function it
 * replaced (test/matter/graph/soak-rules.test.ts).
 */
import type { Cond, Expr } from "./expr.ts";
import type { Rule, Said } from "./rules.ts";

const op = (name: "add" | "mul" | "sub" | "div" | "min" | "max" | "pow" | "clamp" | "abs") => {
  return (...of: Expr[]): Expr => ({ op: name, of });
};
const [add, mul, sub, div] = [op("add"), op("mul"), op("sub"), op("div")];
const [min, max, pow, clamp, abs] = [op("min"), op("max"), op("pow"), op("clamp"), op("abs")];
const when = (cond: Cond, then: Expr, otherwise: Expr): Expr => ({
  if: cond,
  then,
  else: otherwise,
});
const gt = (a: Expr, b: Expr): Cond => ({ a, is: ">", b });
const gte = (a: Expr, b: Expr): Cond => ({ a, is: ">=", b });
const lt = (a: Expr, b: Expr): Cond => ({ a, is: "<", b });
const lte = (a: Expr, b: Expr): Cond => ({ a, is: "<=", b });
const is = (path: string): Cond => ({ ref: path, equals: true });

/** The temperature at which P8 says it runs liquid. */
const melts = (who: string): Expr => sub(6.5, mul(`${who}.row.p.meltsAt`, 0.6));

/** What a liquid carries is a quantity: it is spread over what it lands in. */
const mixed = (state: string): Expr => {
  const total = add("tgt.was.amount", "d.used");
  return div(
    add(mul(`tgt.was.${state}`, "tgt.was.amount"), mul(`liq.was.${state}`, "d.used")),
    when(gt(total, 0), total, 1),
  );
};

export const SOAK_DERIVED: Readonly<Record<string, Expr>> = {
  used: min("act.amount", "liq.was.amount"),
  // How wet a thing can get: a film on anything, more the more it drinks, and what is its own.
  cap: add(1, mul("tgt.p.absorbency", 0.8), "tgt.row.moist"),
  wetness: clamp(min("d.cap", add("tgt.was.wetness", mul("d.used", 5))), 0, 5),
  // Like dissolves like; cleansing bridges; what dissolves readily comes away readily.
  lift: add(
    sub(5, abs(sub("liq.p.oiliness", "coat.p.oiliness"))),
    "liq.p.cleansing",
    mul("coat.p.solubility", 0.5),
  ),
};

/** Only what runs can wet anything: a liquid that is not frozen, or a solid past its melting. */
export const SOAK_WETS: { when: Cond; otherwise: Said } = {
  when: {
    any: [
      { all: [is("liq.row.is.liquid"), gt("liq.was.temperature", 0.25)] },
      {
        all: [
          { ref: "liq.row.is.liquid", equals: false },
          gt("liq.row.p.meltsAt", 0),
          gte("liq.was.temperature", melts("liq")),
        ],
      },
    ],
  },
  otherwise: { because: ["S6"], note: "there is nothing there to wet it with" },
};

const steam = {
  kind: "emit",
  from: "tgt",
  channel: "smoke",
  strength: 3,
  because: ["X3", "S6", "E9"],
  note: "steam",
} as const;

export const SOAK_RULES: readonly Rule[] = [
  {
    id: "wet",
    says: "A liquid wets a thing as far as it can drink, and what the liquid carries is spread over what it lands in",
    about: "tgt",
    first: [
      {
        effects: [
          { kind: "set", q: "tgt.s.wetness", to: "d.wetness", lo: 0, hi: 5 },
          // It is wet with what wetted it; water is what a thing is wet with when nothing is said.
          { kind: "copy", q: "tgt.s.wetWith", of: "liq.row.id" },
          {
            kind: "put",
            q: "tgt.s.wetWith",
            value: null,
            when: { ref: "liq.row.id", equals: "water" },
          },
          { kind: "set", q: "tgt.s.contamination", to: mixed("contamination"), lo: 0, hi: 5 },
          { kind: "set", q: "tgt.s.taint", to: mixed("taint"), lo: 0, hi: 5 },
        ],
        because: ["X4", "P9", "S2", "S9", "S13"],
        note: {
          if: gt("d.wetness", "tgt.was.wetness"),
          say: "it takes up the liquid",
          otherwise: "the liquid runs off it",
        },
      },
    ],
  },
  {
    id: "douse",
    says: "Enough of a liquid puts out what burns and cools it; too little hisses and it burns on; either way it steams",
    about: "tgt",
    first: [
      {
        when: { all: [{ has: "tgt.was.burning" }, gte(mul("d.used", 20), "tgt.was.burning.fuel")] },
        effects: [
          { kind: "put", q: "tgt.s.burning", value: null },
          { kind: "set", q: "tgt.s.temperature", to: min("tgt.was.temperature", 3), lo: 0, hi: 5 },
          steam,
        ],
        because: ["X4", "S3", "S14"],
        note: "the water puts it out",
      },
      {
        when: { has: "tgt.was.burning" },
        effects: [steam],
        because: ["X4", "S3", "S14"],
        note: "there is not enough water: it hisses and burns on",
      },
    ],
  },
  {
    id: "wash",
    says: "A coat lifts when the liquid can get under it: like dissolves like, cleansing bridges, and a bonded coat holds",
    about: "tgt",
    first: [
      {
        when: { all: [{ has: "tgt.was.coating" }, lt(sub("d.lift", "tgt.was.coating.bond"), 3.5)] },
        effects: [],
        because: ["P21", "P24", "S7"],
        note: "the coat does not lift: the liquid cannot get under it",
        nothing: true,
      },
      {
        when: { has: "tgt.was.coating" },
        effects: [{ kind: "put", q: "tgt.s.coating", value: null }],
        because: ["X4", "P21", "P24", "S7"],
        note: "the coat washes off",
      },
    ],
  },
  {
    id: "used",
    says: "The liquid that wets a thing is used",
    about: "liq",
    first: [
      {
        effects: [
          {
            kind: "use",
            from: "liq",
            amount: "d.used",
            because: ["E4"],
            note: "the liquid is used",
          },
        ],
        because: [],
      },
    ],
  },
];

export const COAT_DERIVED: Readonly<Record<string, Expr>> = {
  used: min("act.amount", "sub.was.amount"),
  surface: mul(0.02, pow(add(1, "tgt.p.size"), 2)),
  // Care only decides how evenly it goes on; how much there is decides how far it goes.
  even: clamp(sub(add(0.6, mul("act.care", 0.1)), mul("act.haste", 0.05)), 0.3, 1),
};

/** Only what flows can be spread: a liquid, grains, or something softened near its melting. */
export const COAT_SPREADS: { when: Cond; otherwise: Said } = {
  when: {
    any: [
      is("sub.row.is.liquid"),
      is("sub.row.is.granular"),
      { all: [gt("sub.row.p.meltsAt", 0), gte("sub.was.temperature", sub(melts("sub"), 1.5))] },
    ],
  },
  otherwise: { because: ["X5", "S6", "P8"], note: "it is too hard to spread" },
};

const laid = (more: boolean): Rule["first"][number] => {
  const amount = more ? add("d.used", "tgt.was.coating.amount") : "d.used";
  return {
    ...(more ? { when: { same: ["tgt.was.coating.element", "sub.row.id"] as const } } : {}),
    effects: [
      { kind: "put", q: "tgt.s.coating", value: { element: "", amount: 0, coverage: 0, bond: 0 } },
      { kind: "copy", q: "tgt.s.coating.element", of: "sub.row.id" },
      { kind: "set", q: "tgt.s.coating.amount", to: amount },
      {
        kind: "set",
        q: "tgt.s.coating.coverage",
        to: mul(div(amount, "d.surface"), "d.even"),
        lo: 0,
        hi: 1,
      },
      { kind: "set", q: "tgt.s.coating.bond", to: more ? "tgt.was.coating.bond" : 0 },
      { kind: "use", from: "sub", amount: "d.used", because: ["E4"], note: "it is used up" },
    ],
    because: ["X5", "S7", "S14", "P2", "M6"],
    note: "it is coated",
  };
};

export const COAT_RULES: readonly Rule[] = [
  {
    id: "coat",
    says: "A substance that spreads becomes a coat: how much of the surface it covers is how much there is against the size of the thing, more of the same adds to it, and another substance goes on over what is already there",
    about: "tgt",
    first: [
      laid(true),
      {
        // What is already on it stays on it: a second substance does not make the first vanish.
        when: {
          all: [{ has: "tgt.was.coating" }, gte("tgt.was.coating.amount", mul("d.used", 0.25))],
        },
        effects: [
          { kind: "use", from: "sub", amount: "d.used", because: ["E4"], note: "it is used up" },
        ],
        because: ["S7"],
        note: "it goes on over the coat already there",
        nothing: true,
      },
      laid(false),
    ],
  },
];

const thinForm: Cond = { any: [is("sup.row.is.sheet"), is("sup.row.is.cord")] };

export const LOAD_DERIVED: Readonly<Record<string, Expr>> = {
  sound: div("sup.was.integrity", 5),
  // The dimension a standing load has to cross: a pole or a plank spans, a slab lies on what is under it.
  span: when(
    thinForm,
    "sup.p.size",
    when(is("sup.row.is.long"), max(0, sub("sup.p.size", 2)), "sup.p.size"),
  ),
  // Only what is thin and gives bears in tension, by its toughness and not by its length.
  raw: when(
    { all: [thinForm, gte("sup.p.flexibility", 3)] },
    mul(add(mul("sup.p.toughness", 0.9), 0.5), "d.sound"),
    mul(
      add(mul("sup.p.hardness", 0.5), mul("sup.p.toughness", 0.3), mul("d.span", 0.7), 0.5),
      "d.sound",
    ),
  ),
  strength: max(0, sub(sub("d.raw", "sup.was.flaw"), mul("sup.was.corrosion", 0.5))),
  // A body that falls is hurt by its own weight.
  fall: min(5, mul("who.b.mass", 0.5)),
};

const gives: Cond = gt("act.borne", "d.strength");

export const LOAD_RULES: readonly Rule[] = [
  {
    id: "bear",
    says: "A support bears what is put on it by its hardness, its toughness and the section the load has to cross, less for what is cracked, flawed or rusted; past that it gives way, with a crack",
    about: "sup",
    first: [
      {
        when: lte("act.borne", "d.strength"),
        effects: [],
        because: ["R3", "P4", "P1"],
        note: "it holds",
        nothing: true,
      },
      {
        effects: [
          { kind: "set", q: "sup.s.integrity", to: min("sup.was.integrity", 1), lo: 0, hi: 5 },
          {
            kind: "emit",
            from: "sup",
            channel: "sound",
            strength: 4,
            because: ["X2", "E9"],
            note: "a crack as it goes",
          },
        ],
        because: ["R3", "P4", "P1", "S4", "S15", "S10", "M1"],
        note: "it gives way under the load",
      },
    ],
  },
];

/** Run once for each body that was borne. */
export const FALL_RULES: readonly Rule[] = [
  {
    id: "fall",
    says: "What a support held comes down with it, and a body that falls is hurt by its own weight",
    about: "who",
    first: [
      {
        when: gives,
        effects: [
          {
            kind: "wound",
            on: "who",
            depth: "d.fall",
            bleeding: mul("d.fall", 0.3),
            burned: 0,
            because: ["R3", "X1", "X2", "P1", "B3"],
            note: "it falls, and is hurt",
          },
        ],
        because: [],
      },
    ],
  },
];
