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

type PreconditionKind = Precondition["kind"];

/** One checker per precondition kind: null means the precondition still holds. */
const checkers: {
  [K in PreconditionKind]: (world: World, p: Extract<Precondition, { kind: K }>) => string | null;
} = {
  in_room: (world, p) =>
    world.actors[p.actor]?.room === p.room ? null : `${p.actor} is no longer in ${p.room}`,
  alive: (world, p) => {
    const a = world.actors[p.actor];
    return a?.alive && a.present ? null : `${p.actor} is dead or gone`;
  },
  machine_node: (world, p) =>
    world.machines[p.machine]?.node === p.node ? null : `${p.machine} is no longer ${p.node}`,
  holds: (world, p) => {
    const at = world.items[p.item]?.at;
    return !(at && "holder" in at) || at.holder !== p.actor
      ? `${p.actor} no longer holds ${p.item}`
      : null;
  },
  item_in: (world, p) => {
    const at = world.items[p.item]?.at;
    return !(at && "inside" in at) || at.inside !== p.container
      ? `${p.item} is no longer in ${p.container}`
      : null;
  },
  believes: (world, p) =>
    currentEdge(world, p.holder, "believes", p.claim)
      ? null
      : `${p.holder} no longer holds ${p.claim}`,
  debt_pending: (world, p) =>
    world.debts[p.debt]?.status === "pending" ? null : `debt ${p.debt} is settled`,
};

/** Reasons the preconditions no longer hold; empty means the decision is still fresh. */
export function failedPreconditions(
  world: World,
  preconditions: readonly Precondition[],
): string[] {
  const failed: string[] = [];
  for (const p of preconditions) {
    const check = checkers[p.kind] as (world: World, p: Precondition) => string | null;
    const reason = check(world, p);
    if (reason) failed.push(reason);
  }
  return failed;
}
