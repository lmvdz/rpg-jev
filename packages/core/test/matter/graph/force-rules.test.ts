/**
 * The schema test, for force. The oracle is `force()` as it was when it was functions
 * (force-oracle.ts). The rows have to say the same changes, in the same order, with the same
 * numbers: wounds, sealed wounds, armour struck, edges worn, things cut, shaved, dented, broken
 * and shattered, pieces come away, the striker broken in its turn, sound and sparks.
 */
import { describe, expect, it } from "vitest";
import { Rng } from "../../../src/index.ts";
import { force } from "../../../src/matter/force.ts";
import {
  FORCE_BODY_RULES,
  FORCE_DERIVED,
  FORCE_THING_RULES,
} from "../../../src/matter/graph/force-rules.ts";
import {
  apply,
  type Body,
  type Change,
  type ForceAct,
  FRESH,
  type MatterWorld,
  POOL,
  type Thing,
  type ThingState,
} from "../../../src/matter/index.ts";
import { ELEMENTS, world } from "../elements.ts";
import { forceOracle } from "./force-oracle.ts";

const ROWS = [
  ...POOL,
  ...ELEMENTS.filter((e) => !POOL.some((p) => p.id === e.id)),
  {
    id: "boar",
    name: "a boar",
    kind: "creature" as const,
    forms: [],
    props: { mass: 4, size: 3, hardness: 2, toughness: 4 },
  },
];
const BRITTLE = ROWS.filter((e) => (e.props.toughness ?? 0) <= 1 && !e.forms.includes("liquid"));
const HARD = ROWS.filter((e) => (e.props.hardness ?? 0) >= 4);

function some(r: Rng): { w: MatterWorld; act: ForceAct } {
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(r.next() * xs.length)] as T;
  const level = () => Math.round(r.next() * 50) / 10;
  const maybe = (p: number) => r.next() < p;
  const state = (): ThingState => ({
    ...FRESH,
    temperature: maybe(0.35) ? 3.5 + Math.round(r.next() * 15) / 10 : level(),
    surfaceAbove: maybe(0.7) ? 0 : r.next() * 2,
    wetness: maybe(0.6) ? 0 : level(),
    integrity: pick([5, 5, 5, 3, 0.5, 0]),
    edge: maybe(0.55) ? pick([1, 3, 4, 5]) : 0,
    flaw: maybe(0.8) ? 0 : pick([1, 2, 3]),
    amount: pick([0.05, 1, 1, 12]),
    burning: maybe(0.1) ? { of: "coating", fuel: 20 } : null,
    coating: maybe(0.2) ? { element: "oil", amount: 0.2, coverage: 0.8, bond: 1 } : null,
  });
  const kind = pick(["thing", "thing", "brittle", "hard", "body", "body", "armoured"] as const);
  const tool: Thing = {
    id: "tool",
    element: (kind === "hard" ? pick(HARD) : pick(ROWS)).id,
    place: "here",
    state: state(),
  };
  const pools = { thing: ROWS, brittle: BRITTLE, hard: HARD, body: ROWS, armoured: ROWS };
  const work: Thing = { id: "work", element: pick(pools[kind]).id, place: "here", state: state() };
  const worn: Thing[] =
    kind === "armoured"
      ? [
          { id: "coat", element: pick(ROWS).id, place: "here", state: state() },
          { id: "cap", element: pick(ROWS).id, place: "here", state: state() },
        ]
      : [];
  const who: Body = {
    id: "who",
    place: "here",
    ...(maybe(0.5) ? { element: pick(["boar", "stone", "nobody"]) } : {}),
    ...(worn.length > 0 ? { wears: ["coat", "cap", "missing"] } : {}),
    needs: {},
    health: 5,
    wounds: maybe(0.5)
      ? [
          { depth: 2, bleeding: pick([0, 1.5]), burned: pick([0, 4.5]) },
          { depth: 1, bleeding: pick([0, 0.4]), burned: 0 },
        ]
      : [],
    sickness: 0,
    sickensIn: 0,
  };
  const base = world([tool, work, ...worn], [who]);
  const w = {
    ...base,
    elements: Object.fromEntries(ROWS.map((e) => [e.id, e])),
    places: {
      here: {
        id: "here",
        temperature: 2,
        moisture: 2,
        wind: 1,
        air: 5,
        abundance: {},
        searched: {},
      },
    },
  };
  const manner = maybe(0.2)
    ? undefined
    : { effort: pick([0, 1, 2, 3, 4, 5]), care: pick([0, 2, 4, 5]), haste: pick([1, 2, 4]) };
  const aim = pick([undefined, undefined, "through", "along", "surface"] as const);
  // Some contact times are drawn from a range, so that thresholds are met from both sides.
  const seconds = maybe(0.4) ? Math.round(r.next() * 120) / 10 : pick([undefined, 0.3, 2, 8, 30]);
  const patient =
    kind === "body" || kind === "armoured"
      ? "who"
      : pick(["work", "work", "work", "tool", "nothing"]);
  const act: ForceAct = {
    process: "force",
    instrument: maybe(0.03) ? "nothing" : "tool",
    patient,
    ...(manner ? { manner } : {}),
    ...(aim ? { aim } : {}),
    ...(seconds === undefined ? {} : { seconds }),
  };
  return { w, act };
}

const close = (a: unknown, b: unknown): boolean => {
  if (typeof a === "number" && typeof b === "number")
    return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a));
  if (Array.isArray(a) && Array.isArray(b))
    return a.length === b.length && a.every((x, i) => close(x, b[i]));
  if (a && b && typeof a === "object" && typeof b === "object") {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    return [...keys].every((k) =>
      close((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
    );
  }
  return a === b;
};

/**
 * Everything a change says, but for what a state change lists as set: the function listed a
 * state it had worked out even when it had not moved, and a row lists what moved. What they do
 * to the world is compared by doing it.
 */
const plain = (changes: readonly Change[]) =>
  changes.map((c) => ({
    ...c,
    because: [...c.because].sort(),
    ...(c.kind === "state" ? { set: null } : {}),
  }));

const CASES = 12000;

describe("force, as data", () => {
  it("is plain data: the rows survive JSON unchanged", () => {
    for (const rows of [FORCE_THING_RULES, FORCE_BODY_RULES, FORCE_DERIVED])
      expect(JSON.parse(JSON.stringify(rows))).toEqual(rows);
  });

  it(`says the same changes as the function did, in the same order, over ${CASES} seeded blows`, () => {
    const r = Rng.fromSeed(9200);
    const seen: Record<string, number> = {};
    for (let n = 0; n < CASES; n++) {
      const { w, act } = some(r);
      const [was, now] = [plain(forceOracle(w, act)), plain(force(w, act))];
      const label = `case ${n}: ${w.things.tool?.element} on ${act.patient === "who" ? `a body (${w.bodies.who?.element ?? "person"})` : w.things.work?.element}, ${JSON.stringify(act)}\nwas ${JSON.stringify(was)}\nnow ${JSON.stringify(now)}`;
      expect(
        now.map((c) => `${c.kind}: ${c.note}`),
        label,
      ).toEqual(was.map((c) => `${c.kind}: ${c.note}`));
      expect(close(now, was), label).toBe(true);
      const [after, before] = [apply(w, force(w, act)), apply(w, forceOracle(w, act))];
      expect(close(after.things, before.things) && close(after.bodies, before.bodies), label).toBe(
        true,
      );
      for (const c of was) seen[c.note] = (seen[c.note] ?? 0) + 1;
    }
    // The comparison means something only if every outcome came up often.
    const outcomes = [
      "it cuts",
      "it sears what it touches",
      "held there, the heat closes the wound",
      "the blow sounds",
      "the edge wears",
      "it parts",
      "the edge bites into it",
      "what comes off it lies beside it",
      "it takes the blow and gives",
      "the harder thing mars it",
      "it goes to pieces",
      "it gives under the blow",
      "a piece comes away with a keen edge",
      "a piece breaks off",
      "and the thing is the less for it",
      "it barely marks it",
      "hard on hard throws a spark",
      "nothing comes of it",
      "there is nothing there to strike with",
    ];
    for (const note of outcomes)
      expect(seen[note] ?? 0, `too few cases of: ${note}`).toBeGreaterThan(40);
  });
});
