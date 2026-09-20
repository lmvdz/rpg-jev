/** Finite engineering enumeration, never a player exercise or a second solver. */
import { stableStringify } from "../../packages/core/src/hash.ts";
import { benchWorld } from "../../packages/core/src/thermal/fixture.ts";
import {
  evolve,
  probeTemperature,
  type ThermalPhysics,
  temperature,
  validatePhysics,
} from "../../packages/core/src/thermal/physics.ts";

export const DOMAIN = {
  version: "thermal-sweep-v1",
  slots: 9,
  cubes: 4,
  placements: 5509,
  placementProbeCases: 24553,
  seconds: 60,
  energyToleranceJ: 1e-6,
  temperatureToleranceK: 1e-8,
  numericBasis: "thermal-bench-v1 initial properties, energies and probe; no numeric retuning",
} as const;

export interface CaseResult {
  slots: (number | null)[];
  probeTarget: string | null;
  temperaturesK: number[];
  probeK: number;
  displayK: number;
  maximumComponentEnergyErrorJ: number;
  totalEnergyErrorJ: number;
  failures: string[];
}

export function* placements(
  slots: number = DOMAIN.slots,
  cubes: number = DOMAIN.cubes,
  prefix: (number | null)[] = [],
): Generator<(number | null)[]> {
  if (prefix.length === cubes) {
    yield prefix;
    return;
  }
  for (const slot of [null, ...Array.from({ length: slots }, (_, index) => index)]) {
    if (slot !== null && prefix.includes(slot)) continue;
    yield* placements(slots, cubes, [...prefix, slot]);
  }
}

export function initialPhysics(): ThermalPhysics {
  const thermal = benchWorld().thermal;
  if (!thermal) throw new Error("bench fixture is missing");
  return thermal.physics;
}

/** Independent geometric/component oracle; never calls the production contacts helper. */
function components(state: ThermalPhysics): number[][] {
  const n = state.parts.length;
  const linked = (a: number, b: number) => {
    if (b === n) return state.parts[a]?.id === state.probe.target;
    const first = state.parts[a]?.slot;
    const second = state.parts[b]?.slot;
    if (first == null || second == null) return false;
    const sameRow = Math.floor(first / state.columns) === Math.floor(second / state.columns);
    return (
      (sameRow && Math.abs(first - second) === 1) || Math.abs(first - second) === state.columns
    );
  };
  const groups = Array.from({ length: n + 1 }, (_, index) => [index]);
  for (let a = 0; a < n; a++) {
    for (let b = a + 1; b <= n; b++) {
      if (!linked(a, b)) continue;
      const first = groups.find((group) => group.includes(a));
      const second = groups.find((group) => group.includes(b));
      if (first && second && first !== second) {
        first.push(...second);
        second.length = 0;
      }
    }
  }
  return groups.filter((group) => group.length > 0);
}

const energies = (state: ThermalPhysics) => [
  ...state.parts.map((part) => part.energyJ),
  state.probe.energyJ,
];
const temperatures = (state: ThermalPhysics) => [
  ...state.parts.map(temperature),
  probeTemperature(state.probe),
];
const value = (array: readonly number[], index: number) => {
  const result = array[index];
  if (result === undefined) throw new Error("missing oracle node");
  return result;
};

function fixedProperties(state: ThermalPhysics): string {
  const fixed = structuredClone(state);
  for (const part of fixed.parts) part.energyJ = 0;
  fixed.probe.energyJ = 0;
  return stableStringify(fixed);
}

export function inspectCase(before: ThermalPhysics, after: ThermalPhysics): CaseResult {
  const failures = validatePhysics(after);
  if (fixedProperties(before) !== fixedProperties(after))
    failures.push("solver changed non-energy properties");
  const startEnergy = energies(before);
  const endEnergy = energies(after);
  const startTemperatures = temperatures(before);
  const endTemperatures = temperatures(after);
  const totalEnergyErrorJ = Math.abs(
    startEnergy.reduce((sum, value) => sum + value, 0) -
      endEnergy.reduce((sum, value) => sum + value, 0),
  );
  if (totalEnergyErrorJ > DOMAIN.energyToleranceJ) failures.push("total energy changed");
  let maximumComponentEnergyErrorJ = 0;
  for (const group of components(before)) {
    const sum = (values: number[]) =>
      group.reduce((total, index) => total + value(values, index), 0);
    const error = Math.abs(sum(startEnergy) - sum(endEnergy));
    maximumComponentEnergyErrorJ = Math.max(maximumComponentEnergyErrorJ, error);
    if (error > DOMAIN.energyToleranceJ) failures.push(`component ${group}: energy error ${error}`);
    const low = Math.min(...group.map((index) => value(startTemperatures, index)));
    const high = Math.max(...group.map((index) => value(startTemperatures, index)));
    if (
      high - low > DOMAIN.temperatureToleranceK &&
      !group.some((index) => value(startEnergy, index) !== value(endEnergy, index))
    )
      failures.push(`component ${group}: unequal connected temperatures produced no exchange`);
    for (const index of group) {
      const end = value(endTemperatures, index);
      if (end < low - DOMAIN.temperatureToleranceK || end > high + DOMAIN.temperatureToleranceK)
        failures.push(`node ${index}: temperature escaped initial component extrema`);
      if (group.length === 1 && value(startEnergy, index) !== value(endEnergy, index))
        failures.push(`isolated node ${index} changed energy`);
    }
  }
  return {
    slots: before.parts.map((part) => part.slot),
    probeTarget: before.probe.target,
    temperaturesK: after.parts.map(temperature),
    probeK: probeTemperature(after.probe),
    displayK: Math.round(probeTemperature(after.probe)),
    maximumComponentEnergyErrorJ,
    totalEnergyErrorJ,
    failures,
  };
}

export function runSweep(onCase: (row: CaseResult) => void) {
  const initial = initialPhysics();
  let layouts = 0;
  let cases = 0;
  let failedCases = 0;
  let maximumComponentEnergyErrorJ = 0;
  let maximumTotalEnergyErrorJ = 0;
  let maxImmediateSensorDifferenceK = 0;
  let maxSensorDifferenceAfterMinuteK = 0;
  const receiverRangeK = [Infinity, -Infinity];
  for (const slots of placements()) {
    layouts++;
    const state = structuredClone(initial);
    state.parts.forEach((part, index) => {
      part.slot = slots[index] ?? null;
    });
    for (const target of [
      null,
      ...state.parts.filter((part) => part.slot !== null).map((part) => part.id),
    ]) {
      state.probe.target = target;
      const snapshot = stableStringify(state);
      const after = evolve(state, DOMAIN.seconds);
      const row = inspectCase(state, after);
      if (stableStringify(state) !== snapshot) row.failures.push("solver mutated input");
      cases++;
      if (row.failures.length > 0) failedCases++;
      maximumComponentEnergyErrorJ = Math.max(
        maximumComponentEnergyErrorJ,
        row.maximumComponentEnergyErrorJ,
      );
      maximumTotalEnergyErrorJ = Math.max(maximumTotalEnergyErrorJ, row.totalEnergyErrorJ);
      const recipient = value(row.temperaturesK, 1);
      receiverRangeK[0] = Math.min(value(receiverRangeK, 0), recipient);
      receiverRangeK[1] = Math.max(value(receiverRangeK, 1), recipient);
      const index = state.parts.findIndex((part) => part.id === target);
      if (index >= 0) {
        maxImmediateSensorDifferenceK = Math.max(
          maxImmediateSensorDifferenceK,
          Math.abs(value(temperatures(state), index) - probeTemperature(state.probe)),
        );
        maxSensorDifferenceAfterMinuteK = Math.max(
          maxSensorDifferenceAfterMinuteK,
          Math.abs(value(row.temperaturesK, index) - row.probeK),
        );
      }
      onCase(row);
    }
  }
  return {
    layouts,
    cases,
    failedCases,
    maximumComponentEnergyErrorJ,
    maximumTotalEnergyErrorJ,
    receiverRangeK,
    maxImmediateSensorDifferenceK,
    maxSensorDifferenceAfterMinuteK,
  };
}
