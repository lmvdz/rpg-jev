/**
 * The schema test (docs/sandbox-direction.md, "The graph"): can rules that are functions today
 * be said as data, with no function in a row? The oracle is the engine we already trust. Each
 * data rule is held equal to the function it would replace, over thousands of seeded things in
 * every state, and the rows are held to be plain data by sending them through JSON first.
 */
import { describe, expect, it } from "vitest";
import { Rng } from "../../../src/index.ts";
import { DRIFT_DERIVED, DRIFT_RULES } from "../../../src/matter/graph/drift-rules.ts";
import type { Expr } from "../../../src/matter/graph/expr.ts";
import { envOf, readyAll } from "../../../src/matter/graph/kernel.ts";
import { type Rule, touches } from "../../../src/matter/graph/rules.ts";
import { effective, FRESH, POOL, type Thing, type ThingState } from "../../../src/matter/index.ts";
import { ELEMENTS, world } from "../elements.ts";
import { type Ctx, DRIFTS } from "./drift-oracle.ts";

// What is interpreted is what came back from JSON: nothing in a row can be a function.
const RULES: Rule[] = JSON.parse(JSON.stringify(DRIFT_RULES));
const DERIVED: Record<string, Expr> = JSON.parse(JSON.stringify(DRIFT_DERIVED));

const READY = readyAll(RULES, DERIVED);

const ROWS = [...POOL, ...ELEMENTS.filter((e) => !POOL.some((p) => p.id === e.id))];
const COATS = ["oil", "salt", "ash", "mud", "soapy", "blood"];

/** Rules with a narrow gate get half their cases steered to it, so that they fire often enough to be compared. */
const STEER: Record<string, { rows?: (typeof ROWS)[number][]; coat?: string }> = {
  setting: { rows: ROWS.filter((e) => (e.props.setting ?? 0) > 0) },
  "salt-draw": { coat: "salt" },
};

function some(r: Rng, steer: (typeof STEER)[string] = {}): { ctx: Ctx; state: ThingState } {
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(r.next() * xs.length)] as T;
  const level = () => Math.round(r.next() * 50) / 10;
  const maybe = (p: number) => r.next() < p;
  const state: ThingState = {
    ...FRESH,
    temperature: level(),
    wetness: maybe(0.3) ? 0 : level(),
    wetWith: maybe(0.2) ? "oil" : null,
    surfaceAbove: maybe(0.5) ? 0 : r.next() * 2,
    burning: maybe(0.3)
      ? { of: pick(["self", "coating"] as const), fuel: pick([0.5, 3, 40, 900]) }
      : null,
    coating: maybe(steer.coat ? 0.9 : 0.4)
      ? { element: steer.coat ?? pick(COATS), amount: r.next(), coverage: r.next(), bond: level() }
      : null,
    contamination: maybe(0.5) ? 0 : level(),
    corrosion: maybe(0.5) ? 0 : level(),
    amount: pick([0.2, 1, 7]),
    set: maybe(0.2),
  };
  const thing: Thing = { id: "it", element: pick(steer.rows ?? ROWS).id, place: "here", state };
  const place = {
    id: "here",
    temperature: level(),
    moisture: level(),
    wind: pick([0, 1, 3]),
    air: pick([0, 5, 5]),
    abundance: {},
    searched: {},
  };
  const w = {
    ...world([thing]),
    elements: Object.fromEntries(ROWS.map((e) => [e.id, e])),
    places: { here: place },
  };
  const minutes = pick([0, 0.5, 5, 60, 1440, 100000]);
  return { ctx: { world: w, thing, p: effective(w, thing), place, minutes }, state };
}

const CASES = 3000;
const close = (a: unknown, b: unknown): boolean => {
  if (typeof a === "number" && typeof b === "number")
    return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a));
  if (a && b && typeof a === "object" && typeof b === "object") {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    return [...keys].every((k) =>
      close((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
    );
  }
  return a === b;
};

describe("the nine rules of drift, as data", () => {
  it("are nine, in the order the functions ran in, and survive JSON unchanged", () => {
    expect(RULES.length).toBe(DRIFTS.length);
    expect(RULES).toEqual(DRIFT_RULES);
  });

  RULES.forEach((rule, i) => {
    it(`${rule.id}: the row does what the function did, over ${CASES} seeded things`, () => {
      const r = Rng.fromSeed(7000 + i);
      let acted = 0;
      for (let n = 0; n < CASES; n++) {
        const { ctx, state } = some(r, n % 2 === 0 ? STEER[rule.id] : undefined);
        const was = (DRIFTS[i] as (typeof DRIFTS)[number])(ctx, state);
        const party = { thing: ctx.thing, p: ctx.p, place: ctx.place, s: state, was: state, x: {} };
        const ran = (READY[i] as (typeof READY)[number])(
          envOf(ctx.world, { self: party }, ctx.minutes),
        );
        const now = { set: ran?.sets.self ?? {}, because: ran?.because ?? [], spent: ran?.spent };
        const label = `${rule.id} case ${n}: ${ctx.thing.element}, ${ctx.minutes} minutes`;
        expect(
          close({ ...state, ...now.set }, { ...state, ...was.set }),
          `${label}\n${JSON.stringify({ now: now.set, was: was.set })}`,
        ).toBe(true);
        expect([...now.because].sort(), label).toEqual([...was.because].sort());
        expect(now.spent === true, label).toBe(was.spent === true);
        if (Object.keys(was.set).length > 0) acted++;
      }
      // The comparison means something only if the rule fired often.
      expect(acted, `${rule.id} acted in too few cases`).toBeGreaterThan(CASES / 20);
    });
  });

  it("names every quantity it touches, so the rules are a graph and not a list", () => {
    const edges = RULES.flatMap((rule) => touches(rule, DERIVED).map((node) => [rule.id, node]));
    const nodes = new Set(edges.map(([, node]) => node));
    expect(nodes.size).toBeGreaterThan(20);
    // Two rules that share a quantity are joined through it: rot and rust both read wetness.
    const reads = (id: string) => new Set(touches(RULES.find((x) => x.id === id) as Rule, DERIVED));
    expect(reads("rot").has("s.wetness") && reads("rust").has("s.wetness")).toBe(true);
  });
});
