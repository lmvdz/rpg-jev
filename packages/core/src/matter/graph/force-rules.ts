/**
 * X2, force, as data. `tool` is what strikes and `tgt` is what is struck: a thing, or a body
 * (whose `p` is what its flesh is like), with `arm` the hardest thing the body wears, if any.
 * Two contests: an edge cuts by keenness against toughness, and only what is harder than the
 * work cuts it at all; a blow breaks by momentum against toughness and bulk, and only what is
 * not tough fractures. A collision falls on both: the tool meets the rule the work met.
 *
 * What comes off a thing is a `split`: the piece's amount is taken from its parent, so force
 * makes nothing from nothing, by construction. A test holds these rows equal to the function
 * they replaced (test/matter/graph/force-rules.test.ts).
 */
import type { Cond, Expr } from "./expr.ts";
import type { Alternative, Effect, Rule } from "./rules.ts";

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
const lte = (a: Expr, b: Expr): Cond => ({ a, is: "<=", b });
const lt = (a: Expr, b: Expr): Cond => ({ a, is: "<", b });
const yes = (path: string): Cond => gt(path, 0);
const is = (path: string): Cond => ({ ref: path, equals: true });

type Who = "tool" | "tgt" | "arm";

/** However good the tool, it goes no deeper than the arm behind it drives it. */
const driven = (x: Expr): Expr => min(x, mul("act.effort", 2));

/** Keenness against toughness. Nothing cuts what is as hard as itself. */
const cut = (who: Who): Expr =>
  when(
    { any: [lte("tool.was.edge", 0), lte("tool.p.hardness", `${who}.p.hardness`)] },
    -5,
    sub(
      add("tool.was.edge", mul("act.effort", 0.4), mul("tool.p.mass", 0.2)),
      add(mul(`${who}.p.toughness`, 0.6), mul(`${who}.p.hardness`, 0.4), 0.5),
    ),
  );

/** Momentum against toughness and bulk. A light tool taps however hard it is. */
const blow = (who: Who): Expr =>
  sub(
    add(mul("tool.p.mass", "act.effort", 0.5), mul("tool.p.hardness", 0.3)),
    add(mul(`${who}.p.toughness`, 1.2), mul(`${who}.p.size`, 0.4), 0.5),
  );

/** The dimension a cut has to cross: nothing for a sheet or a cord, the thin way of a plank. */
const thick = (who: Who): Expr =>
  when(
    { any: [is(`${who}.row.is.sheet`), is(`${who}.row.is.cord`)] },
    0,
    when(
      { any: [is(`${who}.row.is.long`), is(`${who}.row.is.flat`)] },
      max(0, sub(`${who}.p.size`, 2)),
      `${who}.p.size`,
    ),
  );

const bulk = (who: Who): Expr => pow(add(1, `${who}.p.size`), 3);
const reachOf = (who: Who): Expr => add(1, mul(`${who}.p.size`, 0.5));

export const FORCE_DERIVED: Readonly<Record<string, Expr>> = {
  // Striking a thing.
  grain: when({ all: [yes("act.along"), is("tgt.row.is.grained")] }, 1, 0),
  cutInto: driven(add(cut("tgt"), "d.grain")),
  blowInto: driven(blow("tgt")),
  cutShare: div(mul("d.cutInto", reachOf("tool")), pow(add(1, thick("tgt")), 3)),
  shaved: min(mul("tgt.was.amount", 0.5), mul("d.cutInto", 0.02, reachOf("tool"))),
  // An edge wears by how hard the work is against its own hardness, and by how it is used.
  wearRatio: max(0.2, div("tgt.p.hardness", max(1, "tool.p.hardness"))),
  wear: mul(0.05, pow("act.effort", 2), pow("d.wearRatio", 2), when(yes("act.surface"), 0.5, 1)),
  // The blow comes back on the striker, less for a blow placed with care.
  recoil: driven(
    sub(
      add(mul("tool.p.mass", "act.effort", 0.5), mul("tgt.p.hardness", 0.3)),
      add(mul("tool.p.toughness", 1.2), mul("tool.p.size", 0.4), 0.5),
    ),
  ),
  spared: mul("d.recoil", sub(1, div("act.care", 6))),
  // Striking a body.
  bare: driven(max(cut("tgt"), blow("tgt"))),
  turned: when(
    { all: [{ has: "arm.p.mass" }, lte(driven(max(cut("arm"), blow("arm"))), 0)] },
    1,
    0,
  ),
  // What is worn meets the blow first. Turned, only the shock of it reaches the body.
  into: when(yes("d.turned"), mul(max(0, blow("tgt")), 0.3), "d.bare"),
  depth: clamp(mul("d.into", 0.8), 0, 5),
  bleeding: when(
    { all: [yes("tool.was.edge"), lte("d.turned", 0)] },
    "d.depth",
    mul("d.depth", 0.3),
  ),
  heat: when(
    { has: "tool.was.burning" },
    5,
    clamp(add("tool.was.temperature", "tool.was.surfaceAbove"), 0, 5),
  ),
  exposure: mul(max(0, sub("d.heat", 3)), "act.seconds"),
  burned: clamp(mul(max(0, sub("d.heat", 3)), min(1, div("act.seconds", 3)), 2), 0, 5),
};

/** Held there, the heat closes a wound: hot enough, for long enough. */
const sealing: Cond = { all: [gte("d.heat", 4), gte("d.exposure", 6)] };
const wounds: Cond = {
  any: [
    yes("d.depth"),
    {
      all: [
        yes("d.burned"),
        { any: [lt("d.heat", 4), lt("d.exposure", 6), lte("tgt.b.bleeding", 0)] },
      ],
    },
  ],
};

/**
 * What a blow does to what is struck, whoever is which: only what is not tough fractures, a
 * small thing shatters whole, a big one spalls a piece, and what is hard and not tough breaks
 * sharp if the blow was placed with care.
 */
function breaking(
  struck: "tgt" | "tool",
  by: "tgt" | "tool",
  into: Expr,
  recoil: boolean,
): Alternative[] {
  const brittle = clamp(div(sub(3, sub(`${struck}.p.toughness`, `${struck}.was.flaw`)), 3), 0, 1);
  const share = div(mul(into, 5, brittle, reachOf(by)), bulk(struck));
  const dent = div(mul(into, 0.3, reachOf(by)), bulk(struck));
  const whole: Cond = { all: [gte(share, 2), lte(`${struck}.p.toughness`, 1)] };
  const taken = min(mul(`${struck}.was.amount`, 0.5), div(share, 5));
  const keen = when(gte(`${struck}.p.hardness`, 4), clamp(mul("act.care", 1.5), 0, 4), 0);
  const comesAway: Cond = {
    all: [
      lte(`${struck}.p.toughness`, 1),
      gt(into, 1),
      yes(`${struck}.was.integrity`),
      gt(taken, 0),
    ],
  };
  const piece = (sharp: boolean): Effect => ({
    kind: "split",
    from: struck,
    suffix: "piece",
    amount: taken,
    // The coat stays with what it was on: a piece does not come away with a second coat.
    state: { integrity: 5, edge: keen, coating: { value: null }, burning: { value: null } },
    when: { all: [comesAway, sharp ? gt(keen, 0) : lte(keen, 0)] },
    because: ["P3", "P4", "S5", "E3"],
    note: sharp ? "a piece comes away with a keen edge" : "a piece breaks off",
    less: { because: ["S14", "E4"], note: "and the thing is the less for it" },
  });
  const tough: Cond = lte(brittle, 0);
  return [
    // What is tough takes a blow without breaking; struck by something harder, it is marred.
    recoil
      ? {
          when: { all: [tough, lte(`${by}.p.hardness`, `${struck}.p.hardness`)] },
          effects: [],
          because: [],
        }
      : {
          when: { all: [tough, lte(`${by}.p.hardness`, `${struck}.p.hardness`)] },
          effects: [],
          because: ["X2", "P4"],
          note: "it takes the blow and gives",
          nothing: true,
        },
    {
      when: tough,
      effects: [
        {
          kind: "set",
          q: `${struck}.s.integrity`,
          to: sub(`${struck}.was.integrity`, dent),
          lo: 0,
          hi: 5,
        },
      ],
      because: ["X2", "P3", "P4", "S4"],
      note: "the harder thing mars it",
    },
    {
      effects: [
        {
          kind: "set",
          q: `${struck}.s.integrity`,
          to: when(whole, 0, sub(`${struck}.was.integrity`, share)),
          lo: 0,
          hi: 5,
        },
        piece(true),
        piece(false),
      ],
      because: ["X2", "P4", "P1", "P2", "S4"],
      note: { if: whole, say: "it goes to pieces", otherwise: "it gives under the blow" },
    },
  ];
}

const cuts: Cond = { all: [yes("d.cutInto"), gte("d.cutInto", "d.blowInto")] };
const cutting = (along: boolean): Alternative => ({
  when: { all: [cuts, along ? yes("act.along") : lte("act.along", 0)] },
  effects: [
    { kind: "set", q: "tgt.s.integrity", to: sub("tgt.was.integrity", "d.cutShare"), lo: 0, hi: 5 },
  ],
  because: ["X2", "S5", "P4", "P2", "S4", ...(along ? ["grained"] : [])],
  note: {
    if: gte("d.cutShare", "tgt.was.integrity"),
    say: "it parts",
    otherwise: "the edge bites into it",
  },
});

/** What flows or drifts is not struck, and strikes nothing: a blow goes through it. */
export const FORCE_STRIKES: Cond = {
  all: (["tool", "tgt"] as const).flatMap((who) => [
    { ref: `${who}.row.is.liquid`, equals: false },
    { ref: `${who}.row.is.gas`, equals: false },
  ]),
};

/** A blow or a cut on a thing. */
export const FORCE_THING_RULES: readonly Rule[] = [
  {
    id: "sound",
    says: "A blow sounds, louder for the effort and for hard meeting hard",
    about: "tgt",
    first: [
      {
        effects: [
          {
            kind: "emit",
            from: "tgt",
            channel: "sound",
            strength: clamp(
              add(1, mul("act.effort", 0.5), mul(min("tool.p.hardness", "tgt.p.hardness"), 0.4)),
              0,
              5,
            ),
            because: ["X2", "E9"],
            note: "the blow sounds",
          },
        ],
        because: [],
      },
    ],
  },
  {
    id: "wear",
    says: "An edge wears by how hard the work is against its own hardness, and less when it only works a surface",
    about: "tool",
    first: [
      {
        when: yes("tool.was.edge"),
        effects: [
          { kind: "set", q: "tool.s.edge", to: sub("tool.was.edge", "d.wear"), lo: 0, hi: 5 },
        ],
        because: ["S5", "P3", "X2"],
        note: "the edge wears",
      },
    ],
  },
  {
    id: "strike",
    says: "A keen edge harder than the work severs what is thin and scars what is thick, or shaves a surface; failing that a blow breaks what is not tough and mars what is; failing that it barely marks it",
    about: "tgt",
    first: [
      {
        // What comes off is still there: shavings, spoil, scrapings. The thing is the less for it.
        when: { all: [cuts, yes("act.surface")] },
        effects: [
          {
            kind: "split",
            from: "tgt",
            suffix: "spoil",
            amount: "d.shaved",
            state: { integrity: 5, coating: { value: null }, burning: { value: null } },
            because: ["X2", "S5", "P4", "S14", "E3"],
            note: "what comes off it lies beside it",
            less: { because: ["X2", "S14", "E4"], note: "and the thing is the less for it" },
          },
        ],
        because: [],
      },
      cutting(true),
      cutting(false),
      ...breaking("tgt", "tool", "d.blowInto", false).map((alt) => ({
        ...alt,
        when: { all: [yes("d.blowInto"), ...(alt.when ? [alt.when] : [])] },
      })),
      { effects: [], because: ["X2", "P3", "P4"], note: "it barely marks it", nothing: true },
    ],
  },
  {
    id: "recoil",
    says: "A collision falls on both: the striker meets the rule the struck thing met, by its own toughness and bulk, and a blow placed with care spares it",
    about: "tool",
    first: breaking("tool", "tgt", "d.spared", true).map((alt) => ({
      ...alt,
      when: { all: [yes("d.recoil"), ...(alt.when ? [alt.when] : [])] },
    })),
  },
  {
    id: "spark",
    says: "Hard struck hard on hard throws a spark",
    about: "tgt",
    first: [
      {
        when: { all: [gte("tgt.p.hardness", 4), gte("act.effort", 3), gte("tool.p.hardness", 4)] },
        effects: [
          {
            kind: "emit",
            from: "tgt",
            channel: "light",
            strength: 1,
            because: ["P3", "X2", "E9"],
            note: "hard on hard throws a spark",
          },
        ],
        because: [],
      },
    ],
  },
];

const wound = (seared: boolean): Alternative => ({
  when: { all: [wounds, seared ? yes("d.burned") : lte("d.burned", 0)] },
  effects: [
    {
      kind: "wound",
      on: "tgt",
      depth: "d.depth",
      bleeding: "d.bleeding",
      burned: "d.burned",
      because: ["X2", "P3", "S5", "B3", ...(seared ? ["S1", "X3"] : [])],
      note: seared ? "it sears what it touches" : "it cuts",
    },
  ],
  because: [],
});

/** A blow or a cut on a body: flesh is matter too, and its damage is a wound. */
export const FORCE_BODY_RULES: readonly Rule[] = [
  {
    id: "wound",
    says: "An edge or a blow that gets into flesh wounds it, deeper for the keener and the heavier; what is worn meets it first, and if it turns the blow only the shock gets through; a hot instrument burns as it goes",
    about: "tgt",
    first: [wound(true), wound(false)],
  },
  {
    id: "cautery",
    says: "A scorching instrument held on a bleeding wound for seconds closes it, and burns it",
    about: "tgt",
    first: [
      {
        when: sealing,
        effects: [
          {
            kind: "seal",
            on: "tgt",
            burned: "d.burned",
            because: ["S1", "B3", "X3"],
            note: "held there, the heat closes the wound",
          },
        ],
        because: [],
      },
    ],
  },
];
