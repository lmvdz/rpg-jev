/**
 * A decision is made on a snapshot and carries structured preconditions
 * (SPEC.md section 4). At commit, code re-checks them against the world as it
 * is now; a stale decision is dropped, never applied.
 */
import { currentEdge } from "./graph.ts";
import type { World } from "./types.ts";

export type Precondition =
  | { kind: "in_room"; actor: string; room: string }
  | { kind: "alive"; actor: string }
  | { kind: "machine_node"; machine: string; node: string }
  | { kind: "holds"; actor: string; item: string }
  | { kind: "item_in"; item: string; container: string }
  | { kind: "believes"; holder: string; claim: string }
  | { kind: "debt_pending"; debt: string };

/** Reasons the preconditions no longer hold; empty means the decision is still fresh. */
export function failedPreconditions(
  world: World,
  preconditions: readonly Precondition[],
): string[] {
  const failed: string[] = [];
  for (const p of preconditions) {
    switch (p.kind) {
      case "in_room":
        if (world.actors[p.actor]?.room !== p.room)
          failed.push(`${p.actor} is no longer in ${p.room}`);
        break;
      case "alive": {
        const a = world.actors[p.actor];
        if (!a?.alive || !a.present) failed.push(`${p.actor} is dead or gone`);
        break;
      }
      case "machine_node":
        if (world.machines[p.machine]?.node !== p.node)
          failed.push(`${p.machine} is no longer ${p.node}`);
        break;
      case "holds": {
        const at = world.items[p.item]?.at;
        if (!at || !("holder" in at) || at.holder !== p.actor)
          failed.push(`${p.actor} no longer holds ${p.item}`);
        break;
      }
      case "item_in": {
        const at = world.items[p.item]?.at;
        if (!at || !("inside" in at) || at.inside !== p.container)
          failed.push(`${p.item} is no longer in ${p.container}`);
        break;
      }
      case "believes":
        if (!currentEdge(world, p.holder, "believes", p.claim))
          failed.push(`${p.holder} no longer holds ${p.claim}`);
        break;
      case "debt_pending":
        if (world.debts[p.debt]?.status !== "pending") failed.push(`debt ${p.debt} is settled`);
        break;
    }
  }
  return failed;
}
