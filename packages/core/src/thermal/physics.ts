/**
 * Bounded SI lumped solid conduction, not a general material or runtime engine.
 * Each solid is an isothermal 0.01 m cube held by an ideal insulating fixture.
 * Full faces of occupied Manhattan-neighbor slots touch; rack parts do not.
 * No ambient exchange, radiation, internal gradients, contact resistance, phase
 * change, attachment inference, or temperature-dependent material properties.
 *
 * Simultaneous explicit Euler uses a fixed 0.01 s absolute grid (6000 steps max).
 * C >= 1 J/K and sum(G) <= 5 W/K make each update a convex temperature average.
 * This guarantees no overshoot, not arbitrary analytic accuracy. Tests declare
 * 1e-6 J conservation and 0.1 K analytic tolerance for nonstiff fixtures.
 * Integer-duration partitions use the same operations; no RNG or hidden clock.
 */
export interface ThermalPart {
  id: string;
  label: string;
  massKg: number;
  specificHeatJPerKgK: number;
  conductivityWPerMK: number;
  energyJ: number;
  slot: number | null;
}

export interface ThermalProbe {
  energyJ: number;
  capacityJPerK: number;
  conductanceWPerK: number;
  target: string | null;
}

export interface ThermalPhysics {
  parts: ThermalPart[];
  probe: ThermalProbe;
  columns: number;
  rows: number;
}

export interface ThermalContact {
  a: string;
  b: string;
  conductanceWPerK: number;
}

export function temperature(part: ThermalPart): number {
  return part.energyJ / (part.massKg * part.specificHeatJPerKgK);
}

export function probeTemperature(probe: ThermalProbe): number {
  return probe.energyJ / probe.capacityJPerK;
}

/** Admission checks for structured physics data; temperatures are kelvin. */
export function validatePhysics(state: ThermalPhysics): string[] {
  const errors: string[] = [];
  const bounded = (name: string, value: number, low: number, high: number) => {
    if (!Number.isFinite(value) || value < low || value > high) {
      errors.push(`${name} must be finite in [${low}, ${high}]`);
    }
  };
  for (const axis of ["columns", "rows"] as const) {
    bounded(axis, state[axis], 1, 3);
    if (!Number.isInteger(state[axis])) errors.push(`${axis} must be integer`);
  }
  if (state.parts.length > 9) errors.push("at most 9 parts plus one probe");
  const ids = new Set<string>();
  const slots = new Set<number>();
  for (const part of state.parts) {
    if (typeof part.id !== "string" || !part.id.trim() || part.id === "$probe") {
      errors.push("part ID must be nonempty and not reserved $probe");
    }
    if (ids.has(part.id)) errors.push(`duplicate part ID: ${part.id}`);
    ids.add(part.id);
    if (typeof part.label !== "string") errors.push("part label must be a string");
    bounded(`${part.id} mass`, part.massKg, 0.001, 1);
    bounded(`${part.id} specific heat`, part.specificHeatJPerKgK, 100, 2000);
    bounded(`${part.id} capacity`, part.massKg * part.specificHeatJPerKgK, 1, 1000);
    bounded(`${part.id} conductivity`, part.conductivityWPerMK, 0.01, 100);
    bounded(`${part.id} temperature`, temperature(part), 250, 400);
    if (part.slot !== null) {
      bounded(`${part.id} slot`, part.slot, 0, state.columns * state.rows - 1);
      if (!Number.isInteger(part.slot)) errors.push("slot must be integer or null");
      if (slots.has(part.slot)) errors.push(`duplicate occupied slot: ${part.slot}`);
      slots.add(part.slot);
    }
  }
  bounded("probe capacity", state.probe.capacityJPerK, 1, 10);
  bounded("probe conductance", state.probe.conductanceWPerK, 0.01, 1);
  bounded("probe temperature", probeTemperature(state.probe), 250, 400);
  if (
    state.probe.target !== null &&
    !state.parts.some((part) => part.id === state.probe.target && part.slot !== null)
  ) {
    errors.push("probe target must identify a seated part or be null");
  }
  return errors;
}

function assertValid(state: ThermalPhysics): void {
  const errors = validatePhysics(state);
  if (errors.length > 0) throw new RangeError(errors.join("; "));
}

function compareIds(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/** Derives all and only physical paths; $probe is a reserved endpoint ID. */
export function contacts(state: ThermalPhysics): ThermalContact[] {
  assertValid(state);
  const result: ThermalContact[] = [];
  const parts = [...state.parts].sort((a, b) => compareIds(a.id, b.id));
  for (const [i, a] of parts.entries()) {
    if (a.slot === null) continue;
    for (const b of parts.slice(i + 1)) {
      if (b.slot === null) continue;
      const distance =
        Math.abs((a.slot % state.columns) - (b.slot % state.columns)) +
        Math.abs(Math.floor(a.slot / state.columns) - Math.floor(b.slot / state.columns));
      if (distance === 1) {
        result.push({
          a: a.id,
          b: b.id,
          conductanceWPerK: 0.0001 / (0.005 / a.conductivityWPerMK + 0.005 / b.conductivityWPerMK),
        });
      }
    }
  }
  if (state.probe.target !== null) {
    result.push({
      a: "$probe",
      b: state.probe.target,
      conductanceWPerK: state.probe.conductanceWPerK,
    });
  }
  return result.sort((a, b) => compareIds(a.a, b.a) || compareIds(a.b, b.b));
}

/** Returns a fresh snapshot, retaining caller part order and all identity fields. */
export function evolve(state: ThermalPhysics, seconds: number): ThermalPhysics {
  assertValid(state);
  if (!Number.isInteger(seconds) || seconds < 0 || seconds > 60) {
    throw new RangeError("seconds must be an integer in [0, 60]");
  }
  const next = {
    ...state,
    parts: state.parts.map((part) => ({ ...part })),
    probe: { ...state.probe },
  };
  if (seconds === 0) return next;
  const nodes = [
    { id: "$probe", body: next.probe, capacity: next.probe.capacityJPerK, delta: 0 },
    ...next.parts.map((part) => ({
      id: part.id,
      body: part,
      capacity: part.massKg * part.specificHeatJPerKgK,
      delta: 0,
    })),
  ].sort((a, b) => compareIds(a.id, b.id));
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const edges = contacts(state).map((edge) => {
    const a = byId.get(edge.a);
    const b = byId.get(edge.b);
    if (!(a && b)) throw new Error("validated contact endpoint missing");
    return { a, b, conductance: edge.conductanceWPerK };
  });
  for (let step = 0; step < seconds * 100; step++) {
    for (const node of nodes) node.delta = 0;
    for (const edge of edges) {
      const { a, b } = edge;
      const transfer =
        edge.conductance * (a.body.energyJ / a.capacity - b.body.energyJ / b.capacity) * 0.01;
      a.delta -= transfer;
      b.delta += transfer;
    }
    for (const node of nodes) node.body.energyJ += node.delta;
  }
  return next;
}
