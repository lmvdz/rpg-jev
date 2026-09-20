/** Finite numeric corners, not exhaustive continuous-parameter accuracy. */
import {
  evolve,
  type ThermalPart,
  type ThermalPhysics,
  temperature,
} from "../../packages/core/src/thermal/physics.ts";
import { DOMAIN, initialPhysics, inspectCase } from "./sweep.ts";

const part = (
  id: string,
  slot: number,
  capacity: number,
  conductivity: number,
  kelvin: number,
): ThermalPart => ({
  id,
  label: id,
  slot,
  massKg: capacity / 1000,
  specificHeatJPerKgK: 1000,
  conductivityWPerMK: conductivity,
  energyJ: capacity * kelvin,
});

function* numericCases() {
  for (const hotC of [1, 20, 1000])
    for (const coldC of [1, 20, 1000]) {
      for (const hotK of [0.01, 1, 100])
        for (const coldK of [0.01, 1, 100]) {
          const state: ThermalPhysics = {
            columns: 3,
            rows: 3,
            parts: [part("hot", 0, hotC, hotK, 400), part("cold", 1, coldC, coldK, 250)],
            probe: { target: null, energyJ: 250, capacityJPerK: 1, conductanceWPerK: 1 },
          };
          for (const seconds of [1, 2, 60]) {
            yield { state, hotC, coldC, hotK, coldK, seconds };
          }
        }
    }
}

export function runNumericProbes() {
  let cases = 0;
  let maxEnergyErrorJ = 0;
  let maxAnalyticErrorK = 0;
  let maxNonstiffAnalyticErrorK = 0;
  let worstAnalyticCase: unknown = null;
  const failures: string[] = [];
  for (const { state, hotC, coldC, hotK, coldK, seconds } of numericCases()) {
    const after = evolve(state, seconds);
    const row = inspectCase(state, after);
    cases++;
    maxEnergyErrorJ = Math.max(maxEnergyErrorJ, row.maximumComponentEnergyErrorJ);
    failures.push(...row.failures.map((failure) => `${cases}: ${failure}`));
    const conductance = 1 / (50 / hotK + 50 / coldK);
    const equilibrium = (hotC * 400 + coldC * 250) / (hotC + coldC);
    const exact =
      equilibrium + (400 - equilibrium) * Math.exp(-conductance * (1 / hotC + 1 / coldC) * seconds);
    const hot = after.parts[0];
    if (!hot) throw new Error("missing hot part");
    const error = Math.abs(temperature(hot) - exact);
    if (error > maxAnalyticErrorK) {
      maxAnalyticErrorK = error;
      worstAnalyticCase = { hotC, coldC, hotK, coldK, seconds, exact, actual: temperature(hot) };
    }
    // Declared before execution: bench-scale or larger capacities, not stiff C=1 corners.
    if (Math.min(hotC, coldC) >= 20) {
      maxNonstiffAnalyticErrorK = Math.max(maxNonstiffAnalyticErrorK, error);
      if (error > 0.1) failures.push(`nonstiff analytic tolerance exceeded in case ${cases}`);
    }
  }
  const star = initialPhysics();
  star.parts = [4, 1, 3, 5, 7].map((slot, i) =>
    part(`star${i}`, slot, 1, 100, i === 0 ? 400 : 250),
  );
  star.probe = { target: "star0", capacityJPerK: 1, conductanceWPerK: 1, energyJ: 250 };
  const starRow = inspectCase(star, evolve(star, 60));
  failures.push(...starRow.failures.map((failure) => `max-degree star: ${failure}`));
  const repeated = initialPhysics();
  repeated.parts.forEach((cube, i) => {
    cube.slot = i;
  });
  const initialEnergy = repeated.parts.reduce(
    (sum, cube) => sum + cube.energyJ,
    repeated.probe.energyJ,
  );
  let maxCumulativeErrorJ = 0;
  for (let minute = 0; minute < 1440; minute++) {
    repeated.probe.target = [null, "A", "B"][minute % 3] ?? null;
    const next = evolve(repeated, 60);
    const row = inspectCase(repeated, next);
    failures.push(...row.failures.map((failure) => `repeated minute ${minute}: ${failure}`));
    const energy = next.parts.reduce((sum, cube) => sum + cube.energyJ, next.probe.energyJ);
    maxCumulativeErrorJ = Math.max(maxCumulativeErrorJ, Math.abs(energy - initialEnergy));
    Object.assign(repeated, next);
  }
  if (maxCumulativeErrorJ > DOMAIN.energyToleranceJ)
    failures.push("cumulative one-day energy error");
  return {
    cases,
    failures,
    maxEnergyErrorJ,
    maxAnalyticErrorK,
    maxNonstiffAnalyticErrorK,
    worstAnalyticCase,
    star: starRow,
    repeatedMinutes: 1440,
    maxCumulativeErrorJ,
    finalTemperaturesK: repeated.parts.map(temperature),
  };
}
