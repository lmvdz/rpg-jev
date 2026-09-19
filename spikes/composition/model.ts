export interface Material {
  readonly heatCapacity: number;
  readonly ignition: number;
  readonly fuelRate: number;
  readonly energyYield: number;
  readonly residueFraction: number;
}

export interface Part {
  readonly id: string;
  readonly material: Material;
  readonly inertMass: number;
  readonly fuel: number;
  readonly residue: number;
  readonly heat: number;
  readonly ambientConductance: number;
  readonly exposure: number;
}

export interface Contact {
  readonly a: string;
  readonly b: string;
  readonly conductance: number;
}

export interface State {
  readonly parts: readonly Part[];
  readonly contacts: readonly Contact[];
  readonly escapedMass: number;
  readonly escapedHeat: number;
  readonly ambientHeat: number;
}

export interface Environment {
  readonly temperature: number;
  readonly exposureThreshold: number;
}

export const limits = {
  parts: 32,
  contacts: 128,
  interval: 10,
  step: 0.01,
  steps: 10_000,
} as const;

export function capacity(part: Part): number {
  return part.material.heatCapacity * (part.inertMass + part.fuel + part.residue);
}

export function temperature(part: Part): number {
  return part.heat / capacity(part);
}

export function budgets(state: State): { mass: number; energy: number } {
  return state.parts.reduce(
    (total, part) => ({
      mass: total.mass + part.inertMass + part.fuel + part.residue,
      energy: total.energy + part.heat + part.fuel * part.material.energyYield,
    }),
    { mass: state.escapedMass, energy: state.escapedHeat + state.ambientHeat },
  );
}

function scalar(value: number, label: string, positive = false): void {
  if (!Number.isFinite(value) || value < 0 || value > 1e9 || (positive && value === 0)) {
    throw new Error(`Invalid ${label}`);
  }
}

function validatePart(part: Part): void {
  if (typeof part.id !== "string" || part.id.length === 0 || part.id.length > 128) {
    throw new Error("Invalid part id");
  }
  scalar(part.inertMass, "inert mass", true);
  scalar(part.material.heatCapacity, "heat capacity", true);
  scalar(part.material.ignition, "ignition");
  scalar(part.material.fuelRate, "fuel rate");
  scalar(part.material.energyYield, "energy yield");
  scalar(part.material.residueFraction, "residue fraction");
  if (part.material.residueFraction > 1) throw new Error("Invalid residue fraction");
  scalar(part.fuel, "fuel");
  scalar(part.residue, "residue");
  scalar(part.heat, "heat");
  scalar(part.exposure, "exposure");
  scalar(part.ambientConductance, "ambient conductance");
  if (!Number.isFinite(temperature(part))) throw new Error("Invalid derived temperature");
}

function validate(state: State, env: Environment, dt: number): void {
  scalar(dt, "interval");
  if (dt > limits.interval) throw new Error("Interval exceeds bound");
  scalar(env.temperature, "ambient temperature");
  scalar(env.exposureThreshold, "exposure threshold");
  scalar(state.escapedMass, "escaped mass");
  scalar(state.escapedHeat, "escaped heat");
  scalar(Math.abs(state.ambientHeat), "ambient heat");
  if (state.parts.length === 0 || state.parts.length > limits.parts) {
    throw new Error("Part count exceeds bounds");
  }
  if (state.contacts.length > limits.contacts) throw new Error("Contact count exceeds bound");
  const ids = new Set<string>();
  for (const part of state.parts) {
    validatePart(part);
    if (ids.has(part.id)) throw new Error("Duplicate part");
    ids.add(part.id);
  }
  for (const contact of state.contacts) {
    if (!(ids.has(contact.a) && ids.has(contact.b)) || contact.a === contact.b) {
      throw new Error("Invalid contact endpoints");
    }
    scalar(contact.conductance, "contact conductance");
  }
}

function stepCount(state: State, dt: number): number {
  let step = limits.step as number;
  for (const part of state.parts) {
    const conductance = state.contacts.reduce(
      (sum, edge) => sum + (edge.a === part.id || edge.b === part.id ? edge.conductance : 0),
      part.ambientConductance,
    );
    // Inert mass is a conservative lower bound on capacity, even after all fuel escapes.
    if (conductance > 0) {
      step = Math.min(step, (0.5 * part.inertMass * part.material.heatCapacity) / conductance);
    }
  }
  const count = Math.ceil(dt / step);
  if (!Number.isFinite(count) || count > limits.steps) throw new Error("Work bound exceeded");
  return count;
}

function exchange(state: State, env: Environment, dt: number): State {
  const temperatures = new Map(state.parts.map((part) => [part.id, temperature(part)]));
  const changes = new Map(state.parts.map((part) => [part.id, 0]));
  for (const edge of state.contacts) {
    const a = temperatures.get(edge.a);
    const b = temperatures.get(edge.b);
    if (a === undefined || b === undefined) throw new Error("Missing endpoint");
    const heat = edge.conductance * (a - b) * dt;
    changes.set(edge.a, (changes.get(edge.a) ?? 0) - heat);
    changes.set(edge.b, (changes.get(edge.b) ?? 0) + heat);
  }
  let ambientHeat = state.ambientHeat;
  const parts = state.parts.map((part) => {
    const before = temperature(part);
    const ambient = part.ambientConductance * (before - env.temperature) * dt;
    ambientHeat += ambient;
    return {
      ...part,
      heat: part.heat + (changes.get(part.id) ?? 0) - ambient,
      exposure: part.exposure + Math.max(0, before - env.exposureThreshold) * dt,
    };
  });
  return { ...state, parts, ambientHeat };
}

function combust(state: State, dt: number): State {
  let escapedMass = state.escapedMass;
  let escapedHeat = state.escapedHeat;
  const parts = state.parts.map((part) => {
    const material = part.material;
    if (temperature(part) < material.ignition || part.fuel === 0) return part;
    const consumed = Math.min(part.fuel, material.fuelRate * dt);
    const residue = consumed * material.residueFraction;
    const escaped = consumed - residue;
    const carriedHeat = escaped * material.heatCapacity * temperature(part);
    escapedMass += escaped;
    escapedHeat += carriedHeat;
    return {
      ...part,
      fuel: part.fuel - consumed,
      residue: part.residue + residue,
      heat: part.heat - carriedHeat + consumed * material.energyYield,
    };
  });
  return { ...state, parts, escapedMass, escapedHeat };
}

/** Pure, bounded evolution. The supplied input and all its nested records remain untouched. */
export function advance(
  state: State,
  env: Environment,
  dt: number,
): { state: State; steps: number } {
  validate(state, env, dt);
  if (dt === 0) return { state, steps: 0 };
  const steps = stepCount(state, dt);
  let next = state;
  for (let index = 0; index < steps; index += 1) {
    // Thresholds see the start of each substep; exchange sees the post-burn snapshot.
    next = exchange(combust(next, dt / steps), env, dt / steps);
  }
  validate(next, env, 0);
  return { state: next, steps };
}
