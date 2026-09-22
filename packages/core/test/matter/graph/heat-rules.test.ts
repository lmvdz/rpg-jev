/**
 * The schema test, for an act between two things. The oracle is `heat()` as it was when it was
 * one function (heat-oracle.ts). The rows have to leave both things in the same state and say
 * the same things happened, in the same order, over thousands of seeded meetings.
 */
import { describe, expect, it } from "vitest";
import { Rng } from "../../../src/index.ts";
import { NONE } from "../../../src/matter/graph/grown.ts";
import { HEAT_DERIVED, HEAT_RULES } from "../../../src/matter/graph/heat-rules.ts";
import { touches } from "../../../src/matter/graph/rules.ts";
import { heatFrom } from "../../../src/matter/heat.ts";
import {
  apply,
  type Change,
  FRESH,
  type HeatAct,
  type MatterWorld,
  POOL,
  resolve,
  type Thing,
  type ThingState,
} from "../../../src/matter/index.ts";
import { ELEMENTS, world } from "../elements.ts";
import { heatOracle } from "./heat-oracle.ts";

const ROWS = [...POOL, ...ELEMENTS.filter((e) => !POOL.some((p) => p.id === e.id))];
const LIQUIDS = ROWS.filter((e) => e.forms.includes("liquid"));
const COATS = ["oil", "salt", "ash", "mud", "soapy", "blood"];

function some(r: Rng): { w: MatterWorld; act: HeatAct } {
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(r.next() * xs.length)] as T;
  const level = () => Math.round(r.next() * 50) / 10;
  const maybe = (p: number) => r.next() < p;
  const state = (hot: boolean): ThingState => ({
    ...FRESH,
    temperature: hot ? pick([4, 4.6, 5]) : level(),
    wetness: maybe(0.4) ? 0 : level(),
    wetWith: maybe(0.2) ? "oil" : null,
    surfaceAbove: maybe(0.6) ? 0 : r.next() * 2,
    coating: maybe(0.35)
      ? { element: pick(COATS), amount: pick([0, 0.05, 0.5]), coverage: r.next(), bond: level() }
      : null,
    contamination: maybe(0.6) ? 0 : level(),
    amount: pick([0.1, 1, 1, 30]),
    temper: pick([0, 0, 1, 2]),
    integrity: pick([5, 5, 2]),
    set: maybe(0.15),
  });
  // Half the meetings are steered to what is rare by chance: a fire, a plunge, a glowing source.
  const kind = pick(["any", "any", "fire", "plunge", "glow"] as const);
  const src: Thing = {
    id: "src",
    element: (kind === "plunge" ? pick(LIQUIDS) : pick(ROWS)).id,
    place: "here",
    state: state(kind === "glow"),
  };
  if (kind === "fire" || maybe(0.1))
    src.state = {
      ...src.state,
      burning: { of: pick(["self", "coating"] as const), fuel: pick([0.3, 4, 500]) },
    };
  if (kind === "plunge") src.state = { ...src.state, temperature: pick([0.2, 1, 2]) };
  const tgt: Thing = {
    id: "tgt",
    element: pick(ROWS).id,
    place: "here",
    state: state(kind === "plunge"),
  };
  if (maybe(0.08)) tgt.state = { ...tgt.state, burning: { of: "self", fuel: 50 } };
  const place = {
    id: "here",
    temperature: level(),
    moisture: level(),
    wind: pick([0, 1, 3]),
    air: pick([0, 5, 5, 5]),
    abundance: {},
    searched: {},
  };
  const w = {
    ...world([src, tgt]),
    elements: Object.fromEntries(ROWS.map((e) => [e.id, e])),
    places: { here: place },
  };
  const contact = pick([undefined, 1, 0.5, 0.1]);
  const act: HeatAct = {
    process: "heat",
    source: "src",
    target: "tgt",
    minutes: pick([0, 0.2, 1, 5, 60, 600]),
    ...(contact === undefined ? {} : { contact }),
  };
  return { w, act };
}

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
const said = (changes: readonly Change[]) =>
  changes.map((c) =>
    [
      c.kind === "state" ? c.thing : c.kind,
      c.note,
      [...c.because].sort().join(","),
      c.quiet === true,
    ].join(" | "),
  );

// The base rows alone: what has grown since is not what the oracle speaks for.
const heat = heatFrom(NONE);

const CASES = 6000;

/** Thousands of seeded cases, beside every other file: given room, not a deadline. */
const HEAVY = 60_000;

describe("heat between two things, as data", () => {
  it("is plain data: the rows survive JSON unchanged", () => {
    expect(JSON.parse(JSON.stringify(HEAT_RULES))).toEqual(HEAT_RULES);
    expect(JSON.parse(JSON.stringify(HEAT_DERIVED))).toEqual(HEAT_DERIVED);
  });

  it(
    `leaves both things as the function did and says the same, over ${CASES} seeded meetings`,
    () => {
      const r = Rng.fromSeed(8100);
      const seen: Record<string, number> = {};
      for (let n = 0; n < CASES; n++) {
        const { w, act } = some(r);
        const [was, now] = [heatOracle(w, act), heat(w, act)];
        const label = `case ${n}: ${w.things.src?.element} on ${w.things.tgt?.element}, ${JSON.stringify(act)}\nwas ${JSON.stringify(was)}\nnow ${JSON.stringify(now)}`;
        expect(said(now), label).toEqual(said(was));
        expect(close(apply(w, now).things, apply(w, was).things), label).toBe(true);
        for (const c of was) seen[c.note] = (seen[c.note] ?? 0) + 1;
      }
      // The comparison means something only if every outcome came up often.
      for (const note of [
        "it heats",
        "it cools",
        "it burns out",
        "it burns down",
        "it cools as it gives up its heat",
        "it warms as it takes the heat",
        "its coat takes light",
        "it takes light",
        "it cracks from the sudden cold",
        "cooled fast from hot, it comes out harder and less tough",
      ])
        expect(seen[note] ?? 0, `too few cases of: ${note}`).toBeGreaterThan(40);
    },
    HEAVY,
  );

  it("still does what the examples say: an oiled blade held in a fire takes light", () => {
    const blade: Thing = {
      id: "blade",
      element: "blade",
      place: "clearing",
      state: { ...FRESH, coating: { element: "oil", amount: 0.2, coverage: 0.9, bond: 1 } },
    };
    const fire: Thing = {
      id: "fire",
      element: "kindling",
      place: "clearing",
      state: { ...FRESH, temperature: 5, burning: { of: "self", fuel: 120 } },
    };
    const after = resolve(world([blade, fire]), {
      process: "heat",
      source: "fire",
      target: "blade",
      minutes: 1,
    });
    expect(after.world.things.blade?.state.burning?.of).toBe("coating");
  });

  it("reads and writes both parties, so the two things are joined through the rules", () => {
    const nodes = new Set(HEAT_RULES.flatMap((rule) => touches(rule, HEAT_DERIVED)));
    expect([...nodes].some((n) => n.startsWith("src."))).toBe(true);
    expect([...nodes].some((n) => n.startsWith("tgt."))).toBe(true);
  });
});
