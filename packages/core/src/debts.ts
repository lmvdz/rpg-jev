/**
 * The causal debt ledger (SPEC.md section 9). The judge may decide what is
 * owed; code alone decides when it lands.
 */
import type { Debt, World } from "./types.ts";

const byDue = (a: Debt, b: Debt) => a.fuse.due - b.fuse.due || a.id.localeCompare(b.id);

/** Pending debts whose fuse has run out, in the order they fall due. */
export function dueDebts(world: World): Debt[] {
  return Object.values(world.debts)
    .filter((d) => d.status === "pending" && d.fuse.due <= world.clock && !isExpired(world, d))
    .sort(byDue);
}

/** Pending debts that slipped past their last chance and will never fire. */
export function expiredDebts(world: World): Debt[] {
  return Object.values(world.debts)
    .filter((d) => d.status === "pending" && isExpired(world, d))
    .sort(byDue);
}

function isExpired(world: World, debt: Debt): boolean {
  return debt.fuse.expires !== undefined && world.clock > debt.fuse.expires;
}

export function pendingDebts(world: World): Debt[] {
  return Object.values(world.debts)
    .filter((d) => d.status === "pending")
    .sort(byDue);
}
