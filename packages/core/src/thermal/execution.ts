/** Supported structural changes derive contacts; callers cannot supply an edge. */
import type { Operation } from "./contract.ts";
import { evolve, type ThermalPhysics } from "./physics.ts";

function seat(physics: ThermalPhysics, operation: Extract<Operation, { kind: "seat" }>): boolean {
  const part = physics.parts.find((candidate) => candidate.id === operation.part);
  if (!part || physics.probe.target === part.id) return false;
  if (operation.slot !== null) {
    if (operation.slot >= physics.columns * physics.rows) return false;
    if (physics.parts.some((other) => other.id !== part.id && other.slot === operation.slot))
      return false;
  }
  part.slot = operation.slot;
  return true;
}

function dock(physics: ThermalPhysics, target: string | null): boolean {
  if (target !== null && !physics.parts.some((part) => part.id === target && part.slot !== null))
    return false;
  physics.probe.target = target;
  return true;
}

export function perform(physics: ThermalPhysics, operation: Operation): ThermalPhysics | null {
  const next = structuredClone(physics);
  if (operation.kind === "seat" && !seat(next, operation)) return null;
  if (operation.kind === "dock" && !dock(next, operation.target)) return null;
  if (operation.kind === "wait") return evolve(next, 60);
  return next;
}
