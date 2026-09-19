/**
 * The schema test, for soak, coat and load. The oracles are the functions as they were
 * (soak-oracle.ts, load-oracle.ts). The rows have to say the same changes in the same order and
 * leave the same world, over thousands of seeded cases, with every outcome coming up often.
 */
import { describe, expect, it } from "vitest";
import { Rng } from "../../../src/index.ts";
import {
  type Act,
  apply,
  type Body,
  type Change,
  FRESH,
  type MatterWorld,
  POOL,
  resolve,
  strength,
  type Thing,
  type ThingState,
} from "../../../src/matter/index.ts";
import { load } from "../../../src/matter/load.ts";
import { coat, soak } from "../../../src/matter/soak.ts";
import { ELEMENTS, world } from "../elements.ts";
import { loadOracle, strengthOracle } from "./load-oracle.ts";
import { coatOracle, soakOracle } from "./soak-oracle.ts";

const ROWS = [
  ...POOL,
  ...ELEMENTS.filter((e) => !POOL.some((p) => p.id === e.id)),
  { id: "ox", name: "an ox", kind: "creature" as const, forms: [], props: { mass: 5, size: 4 } },
];
const LIQUIDS = ROWS.filter((e) => e.forms.includes("liquid"));
const SPREAD = ROWS.filter(
  (e) => e.forms.includes("liquid") || e.forms.includes("granular") || (e.props.meltsAt ?? 0) > 0,
);
const COATS = ["oil", "salt", "ash", "mud", "soapy", "blood"];

type Pick = <T>(xs: readonly T[]) => T;
function tools(r: Rng) {
  const pick: Pick = (xs) => xs[Math.floor(r.next() * xs.length)] as (typeof xs)[number];
  const level = () => Math.round(r.next() * 50) / 10;
  const maybe = (p: number) => r.next() < p;
  // Half of all amounts are drawn from a range, so that thresholds are met from both sides.
  const drawn = (xs: readonly number[]) =>
    maybe(0.5) ? Math.round(r.next() * 400) / 1000 : pick(xs);
  const state = (): ThingState => ({
    ...FRESH,
    temperature: maybe(0.2) ? pick([0, 0.2, 4.5, 5]) : level(),
    wetness: maybe(0.5) ? 0 : level(),
    contamination: maybe(0.6) ? 0 : level(),
    taint: maybe(0.7) ? 0 : level(),
    integrity: pick([5, 5, 3, 1, 0.4]),
    flaw: maybe(0.8) ? 0 : pick([1, 2.5]),
    corrosion: maybe(0.8) ? 0 : level(),
    amount: pick([0, 0.05, 1, 1, 20]),
    burning: maybe(0.25) ? { of: "self", fuel: pick([0.5, 10, 300]) } : null,
    coating: maybe(0.45)
      ? { element: pick(COATS), amount: drawn([0.01, 0.1, 1]), coverage: r.next(), bond: level() }
      : null,
  });
  const thing = (id: string, rows: readonly (typeof ROWS)[number][]): Thing => ({
    id,
    element: pick(rows).id,
    place: "here",
    state: state(),
  });
  const built = (things: Thing[], bodies: Body[] = []): MatterWorld => ({
    ...world(things, bodies),
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
  });
  return { pick, maybe, thing, built };
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
const plain = (changes: readonly Change[]) =>
  changes.map((c) => ({
    ...c,
    because: [...c.because].sort(),
    ...(c.kind === "state" ? { set: null } : {}),
  }));

function agree(
  w: MatterWorld,
  was: Change[],
  now: Change[],
  label: string,
  seen: Record<string, number>,
) {
  const text = `${label}\nwas ${JSON.stringify(was)}\nnow ${JSON.stringify(now)}`;
  expect(
    plain(now).map((c) => `${c.kind}: ${c.note}`),
    text,
  ).toEqual(plain(was).map((c) => `${c.kind}: ${c.note}`));
  expect(close(plain(now), plain(was)), text).toBe(true);
  const [after, before] = [apply(w, now), apply(w, was)];
  expect(close(after.things, before.things) && close(after.bodies, before.bodies), text).toBe(true);
  for (const c of was) seen[c.note] = (seen[c.note] ?? 0) + 1;
}
const often = (seen: Record<string, number>, notes: string[]) => {
  for (const note of notes)
    expect(seen[note] ?? 0, `too few cases of: ${note}`).toBeGreaterThan(40);
};

/** One seeded coating: a substance, a thing that may already be coated, and how it is put on. */
function coating(r: Rng, { pick, maybe, thing, built }: ReturnType<typeof tools>, n: number) {
  const sub = thing("sub", maybe(0.8) ? SPREAD : ROWS);
  const tgt = thing("tgt", ROWS);
  // Often what is already on it is the same stuff, so that adding to a coat comes up.
  if (tgt.state.coating && maybe(0.5))
    tgt.state = { ...tgt.state, coating: { ...tgt.state.coating, element: sub.element } };
  const manner = maybe(0.3)
    ? undefined
    : { effort: 2, care: pick([0, 2, 5]), haste: pick([0, 2, 5]) };
  const drawn = Math.round(r.next() * 400) / 1000;
  const amount = maybe(0.5) ? drawn : pick([undefined, 0, 0.01, 0.2, 3]);
  const act = {
    process: "coat" as const,
    substance: maybe(0.03) ? "gone" : "sub",
    target: maybe(0.03) ? "sub" : "tgt",
    ...(amount === undefined ? {} : { amount }),
    ...(manner ? { manner } : {}),
  };
  const label = `coat ${n}: ${sub.element} on ${tgt.element} ${JSON.stringify(act)}`;
  return { w: built([sub, tgt]), act, label };
}

const CASES = 6000;

describe("soak, coat and load, as data", () => {
  it(`soak: the same changes as the function, over ${CASES} seeded wettings`, () => {
    const r = Rng.fromSeed(9300);
    const { pick, maybe, thing, built } = tools(r);
    const seen: Record<string, number> = {};
    for (let n = 0; n < CASES; n++) {
      const w = built([thing("liq", maybe(0.85) ? LIQUIDS : ROWS), thing("tgt", ROWS)]);
      const act = {
        process: "soak" as const,
        liquid: maybe(0.03) ? "gone" : "liq",
        target: maybe(0.03) ? "liq" : "tgt",
        amount: pick([0, 0.01, 0.2, 1, 50]),
      };
      agree(
        w,
        soakOracle(w, act),
        soak(w, act),
        `soak ${n}: ${w.things.liq?.element} on ${w.things.tgt?.element} ${JSON.stringify(act)}`,
        seen,
      );
    }
    often(seen, [
      "it takes up the liquid",
      "the liquid runs off it",
      "the water puts it out",
      "there is not enough water: it hisses and burns on",
      "steam",
      "the coat does not lift: the liquid cannot get under it",
      "the coat washes off",
      "the liquid is used",
      "there is nothing there to wet it with",
    ]);
  });

  it(`coat: the same changes as the function, over ${CASES} seeded coatings`, () => {
    const r = Rng.fromSeed(9400);
    const seen: Record<string, number> = {};
    for (let n = 0; n < CASES; n++) {
      const { w, act, label } = coating(r, tools(r), n);
      agree(w, coatOracle(w, act), coat(w, act), label, seen);
    }
    often(seen, [
      "it is coated",
      "it is used up",
      "it goes on over the coat already there",
      "it is too hard to spread",
      "there is nothing there to coat",
    ]);
  });

  it(`load: the same changes and the same strength as the function, over ${CASES} seeded loads`, () => {
    const r = Rng.fromSeed(9500);
    const { pick, maybe, thing, built } = tools(r);
    const seen: Record<string, number> = {};
    const person = (id: string, element?: string): Body => ({
      id,
      place: "here",
      ...(element ? { element } : {}),
      needs: {},
      health: 5,
      wounds: [],
      sickness: 0,
      sickensIn: 0,
    });
    for (let n = 0; n < CASES; n++) {
      const things = [thing("sup", ROWS), thing("pack", ROWS), thing("crate", ROWS)];
      const w = built(things, [person("walker"), person("beast", "ox")]);
      const bearing = [
        ["pack"],
        ["walker"],
        ["walker", "pack", "crate"],
        ["beast", "walker"],
        ["crate", "ghost"],
        [],
      ][Math.floor(r.next() * 6)] as string[];
      const act = { process: "load" as const, support: maybe(0.03) ? "gone" : "sup", bearing };
      agree(
        w,
        loadOracle(w, act),
        load(w, act),
        `load ${n}: ${w.things.sup?.element} under ${bearing.join("+")}`,
        seen,
      );
      const sup = w.things.sup as Thing;
      expect(close(strength(w, sup), strengthOracle(w, sup)), `strength ${n}: ${sup.element}`).toBe(
        true,
      );
      void pick;
    }
    often(seen, [
      "it holds",
      "it gives way under the load",
      "a crack as it goes",
      "it falls, and is hurt",
      "there is nothing there to bear it",
    ]);
  });

  it("still goes through the one way in", () => {
    const { thing, built } = tools(Rng.fromSeed(1));
    const w = built([thing("liq", LIQUIDS), thing("tgt", ROWS)]);
    const act: Act = { process: "soak", liquid: "liq", target: "tgt", amount: 1 };
    expect(resolve(w, act).changes.length).toBeGreaterThan(0);
  });
});
