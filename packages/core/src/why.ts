/**
 * The cause debugger (SPEC.md section 13): why is this NPC in this state?
 * Every row carries the log entry that wrote it, and every log entry carries
 * its cause, so an answer is a walk, never a guess. This file returns data;
 * a client turns it into words.
 */
import { beliefsOf, currentEdge, lineage } from "./graph.ts";
import { causeChain, type LogEntry } from "./log.ts";
import { locate, type Whereabouts } from "./schedule.ts";
import type { ActorId, BeliefSource, Claim, Debt, World } from "./types.ts";

export interface WhyBelief {
  claim: Claim;
  credence: number;
  source: BeliefSource | undefined;
  /** Retellings from the first version of the claim to the one held now. */
  lineage: Claim[];
  chain: LogEntry[];
}

export interface WhyReport {
  npc: ActorId;
  stance: { toward: ActorId; node: string; chain: LogEntry[] } | null;
  beliefs: WhyBelief[];
  whereabouts: Whereabouts & { chain: LogEntry[] };
  debts: { debt: Debt; chain: LogEntry[] }[];
}

export function why(
  world: World,
  log: readonly LogEntry[],
  npc: ActorId,
  toward: ActorId,
): WhyReport | null {
  const actor = world.actors[npc];
  if (!actor) return null;

  const stanceEdge = currentEdge(world, npc, "stance", toward);
  const where = locate(world, actor, world.clock);
  const entryCause = where.entry?.cause ?? null;

  return {
    npc,
    stance: stanceEdge?.node
      ? { toward, node: stanceEdge.node, chain: causeChain(log, stanceEdge.cause_id) }
      : null,
    beliefs: beliefsOf(world, npc).map((b) => ({
      claim: b.claim,
      credence: b.credence,
      source: b.edge.source,
      lineage: lineage(world, b.claim.id),
      chain: causeChain(log, b.edge.cause_id),
    })),
    whereabouts: { ...where, chain: entryCause === null ? [] : causeChain(log, entryCause) },
    debts: Object.values(world.debts)
      .filter((d) => d.stakeholder === npc && d.status === "pending")
      .map((debt) => ({ debt, chain: debt.cause === null ? [] : causeChain(log, debt.cause) })),
  };
}
