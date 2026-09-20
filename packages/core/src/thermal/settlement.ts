/** Atomic Store effect validation/application. Replay applies recorded quantities. */
import { stableStringify } from "../hash.ts";
import type { World } from "../types.ts";
import { MECHANICS, operationSchema, type ThermalSettlement } from "./contract.ts";
import { perform } from "./execution.ts";
import { probeTemperature, validatePhysics } from "./physics.ts";

export function thermalAccess(world: World, actor: string): boolean {
  const person = world.actors[actor];
  return Boolean(
    world.thermal && person?.alive && person.present && person.room === world.thermal.room,
  );
}

function energy(physics: ThermalSettlement["physics"]): number {
  return physics.parts.reduce((sum, part) => sum + part.energyJ, physics.probe.energyJ);
}

function unchangedDefinition(world: World, effect: ThermalSettlement): boolean {
  const before = world.thermal?.physics;
  if (!before) return false;
  const withoutDynamics = (physics: ThermalSettlement["physics"]) => ({
    ...physics,
    parts: physics.parts.map(({ energyJ: _energy, slot: _slot, ...part }) => part),
    probe: { ...physics.probe, energyJ: 0, target: null },
  });
  return (
    stableStringify(withoutDynamics(before)) === stableStringify(withoutDynamics(effect.physics))
  );
}

function validateContinuation(world: World, effect: ThermalSettlement, errors: string[]): void {
  const before = world.thermal?.physics;
  if (!before) return;
  const committed = effect.receipt.status === "committed";
  const waiting = committed && effect.operation?.kind === "wait";
  if (effect.receipt.minute !== world.clock + Number(waiting))
    errors.push("thermal clock must settle exactly one minute only for wait");
  if (effect.receipt.revision !== effect.expectedRevision + Number(committed))
    errors.push("thermal revision does not match settlement");
  if (!unchangedDefinition(world, effect)) errors.push("thermal definitions cannot change");
  if (Math.abs(energy(before) - energy(effect.physics)) > 1e-6)
    errors.push("closed thermal energy account does not balance");
  if (!committed && stableStringify(before) !== stableStringify(effect.physics))
    errors.push("failed attempt cannot change physics");
  if (!waiting) {
    const energies = (p: ThermalSettlement["physics"]) => [
      ...p.parts.map((part) => part.energyJ),
      p.probe.energyJ,
    ];
    if (JSON.stringify(energies(before)) !== JSON.stringify(energies(effect.physics)))
      errors.push("only elapsed time exchanges energy");
  }
}

function validateRequestBinding(effect: ThermalSettlement, errors: string[]): void {
  try {
    const input = JSON.parse(effect.fingerprint);
    const parsed = operationSchema.safeParse(input.operation);
    const operation = parsed.success ? parsed.data : null;
    const expected = stableStringify({
      expectedRevision: effect.requestedRevision,
      operation: input.operation,
    });
    if (
      effect.fingerprint !== expected ||
      stableStringify(operation) !== stableStringify(effect.operation)
    )
      errors.push("thermal receipt identity does not match its request");
  } catch {
    errors.push("thermal request identity is not canonical JSON");
  }
}

export function validateThermalSettlement(
  world: World,
  effect: ThermalSettlement,
  errors: string[],
): void {
  const thermal = world.thermal;
  if (!thermal || thermal.mechanics !== MECHANICS) {
    errors.push("thermal mechanics unavailable");
    return;
  }
  if (!thermalAccess(world, effect.actor)) errors.push("thermal actor lacks access");
  if (effect.expectedRevision !== thermal.revision || effect.beforeMinute !== world.clock)
    errors.push("thermal settlement frontier changed");
  validateRequestBinding(effect, errors);
  errors.push(...validatePhysics(effect.physics));
  validateContinuation(world, effect, errors);
  if (errors.length === 0) validateComputedSettlement(world, effect, errors);
}

/** Live submissions are checked against code-owned effects, not just balanced totals. */
function validateComputedSettlement(
  world: World,
  effect: ThermalSettlement,
  errors: string[],
): void {
  const before = world.thermal?.physics;
  if (!before) return;
  let expectedStatus = "unsupported";
  let physics = before;
  if (effect.requestedRevision !== effect.expectedRevision) expectedStatus = "stale";
  else if (effect.operation) {
    const next = perform(before, effect.operation);
    expectedStatus = next ? "committed" : "infeasible";
    if (next) physics = next;
  }
  if (
    effect.receipt.status !== expectedStatus ||
    stableStringify(effect.physics) !== stableStringify(physics)
  )
    errors.push("thermal settlement does not follow admitted operation");
  const reading = expectedStatus === "committed" && effect.operation?.kind === "read";
  const expectedObservation = reading
    ? {
        minute: world.clock,
        target: physics.probe.target,
        probeKelvin: Math.round(probeTemperature(physics.probe)),
        resolutionKelvin: 1,
      }
    : undefined;
  if (JSON.stringify(effect.receipt.observation) !== JSON.stringify(expectedObservation))
    errors.push("thermal observation is not eligible");
}

/** Trusted stored effects are replayed, not numerically re-solved or re-observed. */
export function validateRecordedThermal(
  world: World,
  effect: ThermalSettlement,
  errors: string[],
): void {
  if (!world.thermal || world.thermal.mechanics !== effect.mechanics) {
    errors.push("recorded thermal mechanics unavailable");
    return;
  }
  if (world.thermal.revision !== effect.expectedRevision || world.clock !== effect.beforeMinute)
    errors.push("recorded thermal frontier does not match");
  validateRequestBinding(effect, errors);
  errors.push(...validatePhysics(effect.physics));
  validateContinuation(world, effect, errors);
}

export function applyThermalSettlement(world: World, effect: ThermalSettlement): void {
  if (!world.thermal) throw new Error("thermal state missing during projection");
  world.thermal.physics = structuredClone(effect.physics);
  world.thermal.revision = effect.receipt.revision;
  world.clock = effect.receipt.minute;
}
