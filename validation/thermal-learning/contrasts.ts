/** Predeclared contrasting probes; all evolution uses production code. */
import { stableStringify } from "../../packages/core/src/hash.ts";
import {
  evolve,
  type ThermalPhysics,
  temperature,
} from "../../packages/core/src/thermal/physics.ts";
import { DOMAIN, initialPhysics, inspectCase } from "./sweep.ts";

function arranged(slots: (number | null)[]): ThermalPhysics {
  const state = initialPhysics();
  state.parts.forEach((part, index) => {
    part.slot = slots[index] ?? null;
  });
  return state;
}

function oneMinute(state: ThermalPhysics) {
  const after = evolve(state, 60);
  return { state: after, row: inspectCase(state, after) };
}

function worstDifference(a: ThermalPhysics, b: ThermalPhysics): number {
  const left = [...a.parts.map(temperature), a.probe.energyJ / a.probe.capacityJPerK];
  const right = [...b.parts.map(temperature), b.probe.energyJ / b.probe.capacityJPerK];
  return Math.max(...left.map((value, index) => Math.abs(value - (right[index] ?? Infinity))));
}

function transformedErrors(state: ThermalPhysics, whole: ThermalPhysics): number[] {
  const errors: number[] = [];
  for (const mirror of [false, true])
    for (let turns = 0; turns < 4; turns++) {
      const transformed = structuredClone(state);
      for (const part of transformed.parts) {
        if (part.slot === null) continue;
        if (mirror) part.slot = Math.floor(part.slot / 3) * 3 + 2 - (part.slot % 3);
        for (let turn = 0; turn < turns; turn++)
          part.slot = (part.slot % 3) * 3 + 2 - Math.floor(part.slot / 3);
      }
      errors.push(worstDifference(whole, evolve(transformed, 60)));
    }
  return errors;
}

export function runContrasts() {
  const failures: string[] = [];
  const result = (name: string, state: ThermalPhysics) => {
    const { state: after, row } = oneMinute(state);
    failures.push(...row.failures.map((failure) => `${name}: ${failure}`));
    return { name, after, row };
  };
  const disconnected = result("separated", arranged([0, 2, null, null]));
  const conductive = result("conductive bridge", arranged([0, 2, null, 1]));
  const resistive = result("low-conductivity bridge", arranged([0, 2, 1, null]));
  const direct = result("direct contact", arranged([0, 1, null, null]));
  const loaded = arranged([0, 1, null, null]);
  loaded.probe.target = "B";
  const withProbe = result("direct contact plus probe", loaded);
  const receiver = (entry: typeof conductive) => entry.row.temperaturesK[1] ?? NaN;
  if (!(receiver(conductive) > receiver(resistive) && receiver(resistive) > receiver(disconnected)))
    failures.push("property/contact contrast absent or reversed");
  if (!(receiver(withProbe) < receiver(direct))) failures.push("probe did not load receiver");
  if (!((conductive.row.temperaturesK[0] ?? Infinity) < 370))
    failures.push("donor was not depleted");
  const held = structuredClone(conductive.after);
  held.parts.forEach((part) => {
    part.slot = null;
  });
  const beforeStorage = stableStringify(held);
  for (let minute = 0; minute < 60; minute++) Object.assign(held, evolve(held, 60));
  if (stableStringify(held) !== beforeStorage) failures.push("isolated rack acquired ambient loss");
  const state = arranged([0, 2, 1, 4]);
  state.probe.target = "A";
  const whole = evolve(state, 60);
  const split = evolve(evolve(state, 17), 43);
  if (stableStringify(whole) !== stableStringify(split)) failures.push("17+43 partition not exact");
  const transformErrorsK = transformedErrors(state, whole);
  const renamed = structuredClone(state);
  renamed.parts.forEach((part, index) => {
    part.id = `renamed-${9 - index}`;
    part.label = "arbitrary";
  });
  renamed.probe.target = renamed.parts[0]?.id ?? null;
  const renameErrorK = worstDifference(whole, evolve(renamed, 60));
  const reversed = structuredClone(state);
  reversed.parts.reverse();
  const reverseResult = evolve(reversed, 60);
  reverseResult.parts.reverse();
  if (stableStringify(whole) !== stableStringify(reverseResult))
    failures.push("part order changed outcome");
  if (Math.max(renameErrorK, ...transformErrorsK) > DOMAIN.temperatureToleranceK)
    failures.push("rename or equivalent bench transform exceeded tolerance");
  const equal = arranged([0, 1, 3, 4]);
  equal.parts.forEach((part) => {
    part.energyJ = part.massKg * part.specificHeatJPerKgK * 300;
  });
  equal.probe.energyJ = equal.probe.capacityJPerK * 300;
  equal.probe.target = "A";
  if (stableStringify(equal) !== stableStringify(evolve(equal, 60)))
    failures.push("equal-temperature drift");
  if (stableStringify(state) !== stableStringify(evolve(state, 0)))
    failures.push("zero-duration effect");
  return {
    failures,
    renameErrorK,
    transformErrorsK,
    exactPartition: stableStringify(whole) === stableStringify(split),
    isolatedRackUnchangedAfterMinutes: 60,
    comparisons: [disconnected, conductive, resistive, direct, withProbe].map(({ name, row }) => ({
      name,
      ...row,
    })),
  };
}
