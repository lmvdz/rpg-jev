/**
 * Solid contact as a matter process against the SI thermal fixture it ports: on seeded valid
 * fixtures, `conduct` on matter things gives every part and the probe the same energy, to the
 * bit, as `evolve` on the fixture, and the ordinal temperature follows from that energy.
 */
import { describe, expect, it } from "vitest";
import { apply } from "../../src/matter/apply.ts";
import { conduct, levelOfKelvin } from "../../src/matter/conduct.ts";
import { resolve } from "../../src/matter/resolve.ts";
import { FRESH, type MatterWorld } from "../../src/matter/types.ts";
import { Rng } from "../../src/rng.ts";
import { evolve, type ThermalPhysics, validatePhysics } from "../../src/thermal/physics.ts";

function fixture(rng: Rng): ThermalPhysics {
  const columns = 1 + Math.floor(rng.next() * 3);
  const rows = 1 + Math.floor(rng.next() * 3);
  const slots = Array.from({ length: columns * rows }, (_, i) => i);
  const count = 1 + Math.floor(rng.next() * Math.min(5, slots.length));
  const parts = Array.from({ length: count }, (_, i) => {
    const massKg = 0.01 + rng.next() * 0.4;
    const specificHeatJPerKgK = 200 + rng.next() * 1500;
    const kelvin = 260 + rng.next() * 130;
    const pick = Math.floor(rng.next() * slots.length);
    const seated = rng.next() < 0.85 && slots.length > 0;
    const slot = seated ? (slots.splice(pick, 1)[0] ?? null) : null;
    return {
      id: `p${i}`,
      label: `part ${i}`,
      massKg,
      specificHeatJPerKgK: Math.max(specificHeatJPerKgK, 1 / massKg),
      conductivityWPerMK: 0.05 + rng.next() * 90,
      energyJ: kelvin * massKg * Math.max(specificHeatJPerKgK, 1 / massKg),
      slot,
    };
  });
  const seated = parts.filter((p) => p.slot !== null);
  const capacityJPerK = 1 + rng.next() * 8;
  const target = rng.next() < 0.7 && seated.length > 0 ? (seated[0]?.id ?? null) : null;
  return {
    columns,
    rows,
    parts,
    probe: {
      energyJ: 293 * capacityJPerK,
      capacityJPerK,
      conductanceWPerK: 0.02 + rng.next() * 0.9,
      target,
    },
  };
}

function toMatter(physics: ThermalPhysics): MatterWorld {
  const world: MatterWorld = { elements: {}, things: {}, bodies: {}, places: {}, next: 0 };
  for (const part of physics.parts) {
    world.things[part.id] = {
      id: part.id,
      element: "solid",
      place: "bench",
      ...(part.slot === null
        ? {}
        : {
            where: [part.slot % physics.columns, Math.floor(part.slot / physics.columns)] as const,
          }),
      state: { ...FRESH },
      si: {
        massKg: part.massKg,
        specificHeatJPerKgK: part.specificHeatJPerKgK,
        conductivityWPerMK: part.conductivityWPerMK,
        energyJ: part.energyJ,
      },
    };
  }
  world.things.$probe = {
    id: "$probe",
    element: "probe",
    place: "bench",
    state: { ...FRESH },
    si: {
      massKg: 0,
      specificHeatJPerKgK: 0,
      conductivityWPerMK: 0,
      energyJ: physics.probe.energyJ,
      probe: {
        capacityJPerK: physics.probe.capacityJPerK,
        conductanceWPerK: physics.probe.conductanceWPerK,
        target: physics.probe.target,
      },
    },
  };
  return world;
}

describe("solid contact conduction is the thermal fixture on matter things", () => {
  it("agrees to the bit with evolve on 300 seeded fixtures", () => {
    const rng = Rng.fromSeed(293);
    let checked = 0;
    while (checked < 300) {
      const physics = fixture(rng);
      if (validatePhysics(physics).length > 0) continue;
      const seconds = 1 + Math.floor(rng.next() * 60);
      const expected = evolve(physics, seconds);
      const world = toMatter(physics);
      const after = apply(world, conduct(world, { process: "conduct", place: "bench", seconds }));
      for (const part of expected.parts) {
        const thing = after.things[part.id];
        expect(thing?.si?.energyJ).toBe(part.energyJ);
        const kelvin = part.energyJ / (part.massKg * part.specificHeatJPerKgK);
        expect(thing?.state.temperature).toBe(levelOfKelvin(kelvin));
      }
      expect(after.things.$probe?.si?.energyJ).toBe(expected.probe.energyJ);
      checked++;
    }
  });

  it("goes through resolve like any process, and refuses a time the fixture refuses", () => {
    const world = toMatter(fixture(Rng.fromSeed(1)));
    const outcome = resolve(world, { process: "conduct", place: "bench", seconds: 90 });
    expect(outcome.changes.some((c) => c.kind === "nothing")).toBe(true);
  });
});
