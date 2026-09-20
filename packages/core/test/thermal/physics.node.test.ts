import assert from "node:assert/strict";
import test from "node:test";
import {
  contacts,
  evolve,
  probeTemperature,
  type ThermalPart,
  type ThermalPhysics,
  temperature,
  validatePhysics,
} from "../../src/thermal/physics.ts";

// Declared before fixtures: conservation, analytic approximation, relabeling.
function required<T>(value: T | undefined): T {
  assert.notEqual(value, undefined);
  if (value === undefined) throw new Error("missing test fixture value");
  return value;
}

const ENERGY_TOLERANCE_J = 1e-6;
const ANALYTIC_TOLERANCE_K = 0.1;
const NUMERIC_TOLERANCE_K = 1e-8;
const near = (actual: number, expected: number, tolerance: number) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
const part = (id: string, slot: number | null, kelvin = 300, capacity = 10): ThermalPart => ({
  id,
  label: id,
  massKg: capacity / 1000,
  specificHeatJPerKgK: 1000,
  conductivityWPerMK: 10,
  energyJ: capacity * kelvin,
  slot,
});
const fixture = (parts: ThermalPart[]): ThermalPhysics => ({
  parts,
  probe: { energyJ: 300, capacityJPerK: 1, conductanceWPerK: 0.1, target: null },
  columns: 3,
  rows: 3,
});
const total = (state: ThermalPhysics) =>
  state.parts.reduce((sum, p) => sum + p.energyJ, state.probe.energyJ);
const temperatures = (state: ThermalPhysics) => [
  ...state.parts.map(temperature),
  probeTemperature(state.probe),
];

test("isolated rack, gaps, diagonals and row wrap do not conduct", () => {
  for (const slot of [null, 2, 4, 8]) {
    const state = fixture([part("a", 0, 400), part("b", slot, 250)]);
    assert.deepEqual(contacts(state), []);
    assert.deepEqual(evolve(state, 60), state);
  }
  assert.deepEqual(contacts(fixture([part("a", 2), part("b", 3)])), []);
});

test("face path uses series half-cube SI resistance; equal temperatures stay equal", () => {
  const state = fixture([part("b", 1), part("a", 0)]);
  required(state.parts[0]).conductivityWPerMK = 20;
  near(required(contacts(state)[0]).conductanceWPerK, 0.0001 / (0.005 / 10 + 0.005 / 20), 1e-15);
  state.probe.target = "a";
  assert.deepEqual(evolve(state, 60), state);
});

test("two-body analytic solution and finite probe loading", () => {
  const state = fixture([part("solid", 0, 400)]);
  state.probe.target = "solid";
  const next = evolve(state, 20);
  const equilibrium = (4000 + 300) / 11;
  const decay = Math.exp(-0.1 * (1 / 10 + 1) * 20);
  near(
    temperature(required(next.parts[0])),
    equilibrium + (400 - equilibrium) * decay,
    ANALYTIC_TOLERANCE_K,
  );
  near(
    probeTemperature(next.probe),
    equilibrium + (300 - equilibrium) * decay,
    ANALYTIC_TOLERANCE_K,
  );
  assert.ok(temperature(required(next.parts[0])) < 400);
  assert.ok(probeTemperature(next.probe) > 300);
  near(total(next), total(state), ENERGY_TOLERANCE_J);
});

test("solid property substitutions follow an independent two-body analytic solution", () => {
  for (const [massKg, specificHeat, conductivity] of [
    [0.01, 1000, 10],
    [0.02, 1000, 10],
    [0.01, 2000, 10],
    [0.01, 1000, 40],
  ] as const) {
    const hot = part("hot", 0, 380);
    hot.massKg = massKg;
    hot.specificHeatJPerKgK = specificHeat;
    hot.conductivityWPerMK = conductivity;
    hot.energyJ = massKg * specificHeat * 380;
    const cold = part("cold", 1, 280, 20);
    const state = fixture([hot, cold]);
    const hotCapacity = massKg * specificHeat;
    const coldCapacity = 20;
    const equilibrium = (hotCapacity * 380 + coldCapacity * 280) / (hotCapacity + coldCapacity);
    // Independent series-resistance calculation, not the contacts helper.
    const resistance = 0.005 / (conductivity * 0.0001) + 0.005 / (10 * 0.0001);
    const decay = Math.exp(-(1 / resistance) * (1 / hotCapacity + 1 / coldCapacity) * 30);
    const next = evolve(state, 30);
    near(
      temperature(required(next.parts[0])),
      equilibrium + (380 - equilibrium) * decay,
      ANALYTIC_TOLERANCE_K,
    );
    near(
      temperature(required(next.parts[1])),
      equilibrium + (280 - equilibrium) * decay,
      ANALYTIC_TOLERANCE_K,
    );
    near(total(next), total(state), ENERGY_TOLERANCE_J);
  }
});

test("one finite donor shares simultaneously with four neighbors and a probe", () => {
  const state = fixture([
    part("donor", 4, 400, 1),
    ...[1, 3, 5, 7].map((slot) => part(`sink${slot}`, slot, 250, 1)),
  ]);
  for (const p of state.parts) p.conductivityWPerMK = 100;
  state.probe = { energyJ: 250, capacityJPerK: 1, conductanceWPerK: 1, target: "donor" };
  const next = evolve(state, 1);
  for (const sink of next.parts.slice(1)) {
    near(temperature(sink), probeTemperature(next.probe), NUMERIC_TOLERANCE_K);
  }
  near(total(next), total(state), ENERGY_TOLERANCE_J);
  assert.ok(temperature(required(next.parts[0])) >= probeTemperature(next.probe));
  assert.ok(temperatures(next).every((t) => t >= 250 && t <= 400));
});

test("same inventory different arrangement changes conduction", () => {
  const connected = fixture([part("a", 0, 400), part("b", 1, 250)]);
  const separated = structuredClone(connected);
  required(separated.parts[1]).slot = 2;
  assert.ok(temperature(required(evolve(connected, 60).parts[1])) > 250);
  assert.equal(temperature(required(evolve(separated, 60).parts[1])), 250);
});

test("identity is not material; array reorder is exact, relabeling is numerically invariant", () => {
  const state = fixture([part("a", 0, 400), part("b", 1, 250), part("c", 4, 300)]);
  state.probe.target = "b";
  const expected = evolve(state, 60);
  const reverse = structuredClone(state);
  reverse.parts.reverse();
  assert.deepEqual(evolve(reverse, 60).parts.reverse(), expected.parts);
  const renamed = structuredClone(state);
  renamed.parts.forEach((p, i) => {
    p.id = required(["z", "y", "x"][i]);
    p.label = "different";
  });
  renamed.probe.target = "y";
  temperatures(evolve(renamed, 60)).forEach((t, i) => {
    near(t, required(temperatures(expected)[i]), NUMERIC_TOLERANCE_K);
  });
});

test("pure clones, zero duration, exact replay and integer-time partitions", () => {
  const state = fixture([part("a", 0, 400), part("b", 1, 250)]);
  state.probe.target = "a";
  const before = structuredClone(state);
  Object.freeze(state.probe);
  state.parts.forEach(Object.freeze);
  Object.freeze(state.parts);
  Object.freeze(state);
  const zero = evolve(state, 0);
  assert.deepEqual(zero, state);
  assert.notEqual(zero, state);
  assert.notEqual(zero.parts, state.parts);
  assert.notEqual(zero.parts[0], state.parts[0]);
  assert.notEqual(zero.probe, state.probe);
  const whole = evolve(state, 60);
  assert.deepEqual(evolve(state, 60), whole);
  const split = evolve(evolve(state, 20), 40);
  temperatures(split).forEach((t, i) => {
    near(t, required(temperatures(whole)[i]), NUMERIC_TOLERANCE_K);
  });
  assert.deepEqual(split, whole);
  assert.deepEqual(state, before);
});

test("bounded deterministic property sweep conserves and obeys maximum principle", () => {
  for (let sample = 0; sample < 16; sample++) {
    const state = fixture(
      Array.from({ length: 9 }, (_, i) =>
        part(
          `p${i}`,
          i,
          250 + ((i * 37 + sample * 19) % 151),
          required([1, 10, 1000][(i + sample) % 3]),
        ),
      ),
    );
    state.parts.forEach((p, i) => {
      p.conductivityWPerMK = required([0.01, 1, 100][(i + sample) % 3]);
    });
    state.probe.target = `p${sample % 9}`;
    state.probe.capacityJPerK = sample % 2 ? 10 : 1;
    state.probe.energyJ = state.probe.capacityJPerK * 300;
    state.probe.conductanceWPerK = sample % 2 ? 0.01 : 1;
    const next = evolve(state, 60);
    assert.deepEqual(validatePhysics(next), []);
    near(total(next), total(state), ENERGY_TOLERANCE_J);
    const initial = temperatures(state);
    for (const t of temperatures(next)) {
      assert.ok(Number.isFinite(t) && t >= Math.min(...initial) && t <= Math.max(...initial));
    }
  }
});

test("rejects invalid bounds, nonfinite fields, identity, slots and duration", () => {
  const valid = fixture([part("a", 0), part("b", 1)]);
  const invalid: ((s: ThermalPhysics) => void)[] = [
    (s) => {
      s.columns = 0;
    },
    (s) => {
      s.rows = 4;
    },
    (s) => {
      s.rows = 1.5;
    },
    (s) => {
      required(s.parts[1]).id = "a";
    },
    (s) => {
      required(s.parts[0]).id = "";
    },
    (s) => {
      required(s.parts[0]).id = "$probe";
    },
    (s) => {
      required(s.parts[0]).slot = 0.5;
    },
    (s) => {
      required(s.parts[0]).slot = 9;
    },
    (s) => {
      required(s.parts[1]).slot = 0;
    },
    (s) => {
      required(s.parts[0]).massKg = 0.0001;
    },
    (s) => {
      required(s.parts[0]).massKg = 2;
    },
    (s) => {
      required(s.parts[0]).specificHeatJPerKgK = 99;
    },
    (s) => {
      required(s.parts[0]).specificHeatJPerKgK = 2001;
    },
    (s) => {
      required(s.parts[0]).massKg = 0.001;
      required(s.parts[0]).specificHeatJPerKgK = 100;
    },
    (s) => {
      required(s.parts[0]).massKg = 1;
      required(s.parts[0]).specificHeatJPerKgK = 2000;
    },
    (s) => {
      required(s.parts[0]).conductivityWPerMK = 0;
    },
    (s) => {
      required(s.parts[0]).conductivityWPerMK = 101;
    },
    (s) => {
      required(s.parts[0]).energyJ = 2490;
    },
    (s) => {
      required(s.parts[0]).energyJ = 4010;
    },
    (s) => {
      s.probe.target = "missing";
    },
    (s) => {
      s.probe.capacityJPerK = 0;
    },
    (s) => {
      s.probe.capacityJPerK = 11;
    },
    (s) => {
      s.probe.conductanceWPerK = 0;
    },
    (s) => {
      s.probe.conductanceWPerK = 2;
    },
    (s) => {
      s.probe.energyJ = 249;
    },
    (s) => {
      s.probe.energyJ = 401;
    },
    (s) => {
      s.parts = Array.from({ length: 10 }, (_, i) => part(`p${i}`, null));
    },
  ];
  for (const value of [NaN, Infinity, -Infinity]) {
    for (const key of [
      "massKg",
      "specificHeatJPerKgK",
      "conductivityWPerMK",
      "energyJ",
      "slot",
    ] as const) {
      invalid.push((s) => {
        required(s.parts[0])[key] = value;
      });
    }
    for (const key of ["energyJ", "capacityJPerK", "conductanceWPerK"] as const) {
      invalid.push((s) => {
        s.probe[key] = value;
      });
    }
    invalid.push((s) => {
      s.columns = value;
    });
  }
  for (const mutate of invalid) {
    const state = structuredClone(valid);
    mutate(state);
    assert.ok(validatePhysics(state).length > 0);
    assert.throws(() => evolve(state, 0), RangeError);
    assert.throws(() => contacts(state), RangeError);
  }
  for (const seconds of [-1, 61, 0.01, NaN, Infinity]) {
    assert.throws(() => evolve(valid, seconds), RangeError);
  }
});
