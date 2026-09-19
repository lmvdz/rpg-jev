import { describe, expect, it } from "vitest";
import {
  advance,
  budgets,
  capacity,
  type Material,
  type Part,
  type State,
  temperature,
} from "../model.ts";

// Illustrative authored values, not a calibrated materials database.
const metal: Material = {
  heatCapacity: 500,
  ignition: 1e6,
  fuelRate: 0,
  energyYield: 0,
  residueFraction: 0,
};
const substrate: Material = {
  heatCapacity: 1500,
  ignition: 350,
  fuelRate: 0.01,
  energyYield: 2e6,
  residueFraction: 0.2,
};
const coating: Material = {
  heatCapacity: 1000,
  ignition: 450,
  fuelRate: 0.01,
  energyYield: 2e6,
  residueFraction: 0.1,
};
const body: Material = { ...metal, heatCapacity: 3500 };
const env = { temperature: 300, exposureThreshold: 315 };

function part(id: string, material: Material, inertMass: number, fuel = 0, kelvin = 300): Part {
  return {
    id,
    material,
    inertMass,
    fuel,
    residue: 0,
    heat: material.heatCapacity * (inertMass + fuel) * kelvin,
    ambientConductance: 0,
    exposure: 0,
  };
}

function state(parts: readonly Part[], contacts: State["contacts"] = []): State {
  return { parts, contacts, escapedMass: 0, escapedHeat: 0, ambientHeat: 0 };
}

function get(value: State, id: string): Part {
  const found = value.parts.find((entry) => entry.id === id);
  if (!found) throw new Error(`Missing test part ${id}`);
  return found;
}

function coated(combustible: boolean): State {
  const core = combustible ? part("core", substrate, 0.02, 0.1) : part("core", metal, 0.2);
  return state(
    [core, part("film", coating, 0.002, 0.01, 700)],
    [{ a: "core", b: "film", conductance: 20 }],
  );
}

function grip(wrapped: boolean): State {
  const parts = [part("hot", metal, 0.2, 0, 600), part("hand", body, 0.01)];
  if (!wrapped) return state(parts, [{ a: "hot", b: "hand", conductance: 5 }]);
  return state(
    [...parts, part("wrap", { ...metal, heatCapacity: 1000 }, 0.01)],
    [
      { a: "hot", b: "wrap", conductance: 0.02 },
      { a: "wrap", b: "hand", conductance: 0.02 },
    ],
  );
}

function conserve(before: State, after: State): void {
  const initial = budgets(before);
  const final = budgets(after);
  expect(Math.abs(final.mass - initial.mass)).toBeLessThan(1e-10);
  expect(Math.abs(final.energy - initial.energy)).toBeLessThan(1e-6);
}

describe("composition, not identity", () => {
  it("burns coating on either substrate, but only the combustible substrate supplies more fuel", () => {
    const inert = advance(coated(false), env, 10).state;
    const combustible = advance(coated(true), env, 10).state;
    expect(get(inert, "film").fuel).toBe(0);
    expect(get(combustible, "film").fuel).toBe(0);
    expect(get(inert, "core").fuel).toBe(0);
    expect(get(combustible, "core").fuel).toBeLessThan(0.1);
    expect(get(combustible, "core").residue).toBeGreaterThan(0);
    expect(temperature(get(inert, "core"))).toBeGreaterThan(300);
    conserve(coated(false), inert);
    conserve(coated(true), combustible);
  });

  it("insulating contacts reduce a body's temperature and exposure without a damage callback", () => {
    const bare = get(advance(grip(false), env, 10).state, "hand");
    const wrapped = get(advance(grip(true), env, 10).state, "hand");
    expect(temperature(bare)).toBeGreaterThan(315);
    expect(bare.exposure).toBeGreaterThan(0);
    expect(temperature(wrapped)).toBeLessThan(315);
    expect(wrapped.exposure).toBe(0);
  });

  it("continued burning after coating exhaustion must consume substrate fuel", () => {
    for (const combustible of [false, true]) {
      const input = coated(combustible);
      const exhausted = advance(input, env, 2).state;
      expect(get(exhausted, "film").fuel).toBe(0);
      const later = advance(exhausted, env, 1).state;
      expect(get(later, "film").fuel).toBe(0);
      expect(get(later, "film").residue).toBe(get(exhausted, "film").residue);
      const coreFuelLoss = get(exhausted, "core").fuel - get(later, "core").fuel;
      if (combustible) expect(coreFuelLoss).toBeGreaterThan(0);
      else expect(coreFuelLoss).toBe(0);
      conserve(input, later);
    }
  });

  it("greater authored mass gives greater thermal inertia, without representing density", () => {
    const run = (mass: number) => {
      const input = state([{ ...part("p", metal, mass), ambientConductance: 1 }]);
      return get(advance(input, { ...env, temperature: 500 }, 1).state, "p");
    };
    expect(temperature(run(0.1))).toBeGreaterThan(temperature(run(1)));
    expect(capacity(run(1))).toBe(500);
  });

  it("exhausts finite fuel, accounts for residue and escaped products, and retains heat", () => {
    const input = state([part("p", coating, 0.002, 0.01, 700)]);
    const burned = advance(input, env, 2).state;
    const p = get(burned, "p");
    expect(p.fuel).toBe(0);
    expect(p.residue).toBeCloseTo(0.001, 12);
    expect(burned.escapedMass).toBeCloseTo(0.009, 12);
    expect(burned.escapedHeat).toBeGreaterThan(0);
    expect(temperature(p)).toBeGreaterThan(700);
    const later = advance(burned, env, 2).state;
    expect(get(later, "p").heat).toBe(p.heat);
    expect(later.escapedMass).toBe(burned.escapedMass);
    conserve(input, later);
  });

  it("balances ambient reservoir heating and cooling, not just isolated contacts", () => {
    for (const kelvin of [100, 700]) {
      const input = state([{ ...part("p", coating, 0.002, 0.01, kelvin), ambientConductance: 1 }]);
      const output = advance(input, env, 3).state;
      expect(Math.sign(output.ambientHeat)).toBe(Math.sign(kelvin - env.temperature));
      conserve(input, output);
    }
  });

  it("is invariant to identity renaming and contact iteration order within roundoff", () => {
    const input = state(
      [part("a", metal, 0.1, 0, 700), part("b", metal, 0.2), part("c", body, 0.01)],
      [
        { a: "a", b: "b", conductance: 2 },
        { a: "b", b: "c", conductance: 3 },
        { a: "a", b: "c", conductance: 1 },
      ],
    );
    const renamed = {
      ...input,
      parts: input.parts.map((p) => ({ ...p, id: `arbitrary-${p.id}` })).reverse(),
      contacts: input.contacts
        .map((e) => ({ ...e, a: `arbitrary-${e.b}`, b: `arbitrary-${e.a}` }))
        .reverse(),
    };
    const original = advance(input, env, 3).state;
    const changed = advance(renamed, env, 3).state;
    for (const p of original.parts) {
      expect(get(changed, `arbitrary-${p.id}`).heat).toBeCloseTo(p.heat, 8);
    }
    conserve(input, original);
  });

  it("keeps whole versus non-grid-aligned split intervals within declared example tolerances", () => {
    const input = coated(true);
    const whole = advance(input, env, 3).state;
    const split = advance(advance(input, env, 1.337).state, env, 1.663).state;
    for (const p of whole.parts) {
      const other = get(split, p.id);
      expect(Math.abs(temperature(other) - temperature(p))).toBeLessThan(5);
      expect(Math.abs(other.fuel - p.fuel)).toBeLessThan(0.0002);
    }
    conserve(input, whole);
    conserve(input, split);
  });

  it("does not mutate any input record", () => {
    const input = coated(true);
    const snapshot = structuredClone(input);
    for (const p of input.parts) {
      Object.freeze(p.material);
      Object.freeze(p);
    }
    for (const edge of input.contacts) Object.freeze(edge);
    Object.freeze(input.parts);
    Object.freeze(input.contacts);
    Object.freeze(input);
    advance(input, env, 3);
    expect(input).toEqual(snapshot);
  });
});

describe("numerical and input boundaries", () => {
  it("clamps the final partial burn and never releases energy from already exhausted fuel", () => {
    const input = state([part("p", coating, 0.01, 0.000025, 700)]);
    const output = advance(input, env, 0.01).state;
    expect(get(output, "p").fuel).toBe(0);
    expect(get(output, "p").residue).toBeCloseTo(0.0000025, 14);
    expect(output.escapedMass).toBeCloseTo(0.0000225, 14);
    const later = advance(output, env, 0.01).state;
    expect(get(later, "p").heat).toBe(get(output, "p").heat);
    conserve(input, later);
  });

  it("samples ignition at substep start, not immediately when an exchange crosses it", () => {
    const input = state(
      [part("a", metal, 1, 0, 700), part("b", coating, 0.01, 0.01, 449)],
      [{ a: "a", b: "b", conductance: 100 }],
    );
    const first = advance(input, env, 0.01).state;
    expect(temperature(get(first, "b"))).toBeGreaterThan(450);
    expect(get(first, "b").fuel).toBe(0.01);
    const second = advance(first, env, 0.01).state;
    expect(get(second, "b").fuel).toBeCloseTo(0.0099, 14);
    conserve(input, second);
  });

  it("zero dt changes nothing, even on burning and hot parts", () => {
    const input = coated(true);
    expect(advance(input, env, 0)).toEqual({ state: input, steps: 0 });
  });

  it("zero conductance cannot heat another part; zero fuel cannot release chemical heat", () => {
    const input = state(
      [part("a", coating, 0.01, 0, 700), part("b", body, 0.01)],
      [{ a: "a", b: "b", conductance: 0 }],
    );
    const output = advance(input, env, 1).state;
    expect(get(output, "a").heat).toBe(get(input, "a").heat);
    expect(get(output, "b")).toEqual(get(input, "b"));
    expect(output.escapedHeat).toBe(0);
    conserve(input, output);
  });

  it("uses stability-limited steps without overshoot on stiff connected parts", () => {
    const input = state(
      [part("a", metal, 0.001, 0, 700), part("b", metal, 0.001)],
      [{ a: "a", b: "b", conductance: 100 }],
    );
    const output = advance(input, env, 1);
    expect(output.steps).toBe(400);
    for (const p of output.state.parts) {
      expect(temperature(p)).toBeGreaterThanOrEqual(300);
      expect(temperature(p)).toBeLessThanOrEqual(700);
    }
    conserve(input, output.state);
  });

  it("rejects excessive work or interval rather than silently skipping time", () => {
    const input = state([{ ...part("p", metal, 0.001), ambientConductance: 1e9 }]);
    expect(() => advance(input, env, 1)).toThrow("Work bound");
    expect(() => advance(coated(false), env, 10.001)).toThrow("Interval");
    expect(advance(coated(false), env, 10).steps).toBe(1000);
  });

  it("rejects invalid numbers, topology, material fractions and zero capacities", () => {
    for (const dt of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => advance(coated(false), env, dt)).toThrow();
    }
    const p = part("p", metal, 1);
    for (const patch of [
      { fuel: -1 },
      { heat: Number.NaN },
      { inertMass: 0 },
      { ambientConductance: -1 },
      { material: { ...metal, residueFraction: 1.1 } },
      { material: { ...metal, heatCapacity: 0 } },
    ]) {
      expect(() => advance(state([{ ...p, ...patch }]), env, 1)).toThrow();
    }
    expect(() => advance(state([p, p]), env, 1)).toThrow("Duplicate");
    expect(() => advance(state([p], [{ a: "p", b: "absent", conductance: 1 }]), env, 1)).toThrow(
      "endpoints",
    );
    expect(() => advance(state([]), env, 1)).toThrow("count");
    expect(() =>
      advance(state(Array.from({ length: 33 }, (_, n) => ({ ...p, id: `${n}` }))), env, 1),
    ).toThrow("count");
  });
});
