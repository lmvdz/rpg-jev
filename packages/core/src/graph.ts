/**
 * Queries over the bitemporal edge table (SPEC.md section 4). Decisions read
 * only current rows; closed rows serve `why` and "what did she believe then".
 */
import type { ActorId, Claim, ClaimId, Edge, EdgeKind, Minute, World } from "./types.ts";

export function currentEdge(
  world: World,
  src: string,
  kind: EdgeKind,
  dst: string,
): Edge | undefined {
  return world.edges.find(
    (e) => e.valid_to === null && e.src === src && e.kind === kind && e.dst === dst,
  );
}

export interface Belief {
  claim: Claim;
  edge: Edge;
  credence: number;
}

/** What `holder` believes now, strongest first. */
export function beliefsOf(world: World, holder: ActorId): Belief[] {
  const out: Belief[] = [];
  for (const edge of world.edges) {
    if (edge.valid_to !== null || edge.kind !== "believes" || edge.src !== holder) continue;
    const claim = world.claims[edge.dst];
    if (claim) out.push({ claim, edge, credence: edge.credence ?? 0 });
  }
  return out.sort((a, b) => b.credence - a.credence || a.claim.id.localeCompare(b.claim.id));
}

export function beliefIn(world: World, holder: ActorId, claim: ClaimId): Belief | undefined {
  return beliefsOf(world, holder).find((b) => b.claim.id === claim);
}

/**
 * What `holder` believed at `minute`, by known time: the row must have been
 * learned by then and not yet replaced. Serves "what Mara believed at nine".
 */
export function beliefsAsOf(world: World, holder: ActorId, minute: Minute): Belief[] {
  const out: Belief[] = [];
  for (const edge of world.edges) {
    if (edge.kind !== "believes" || edge.src !== holder) continue;
    if (edge.known_from > minute) continue;
    if (edge.valid_to !== null && edge.valid_to <= minute) continue;
    const claim = world.claims[edge.dst];
    if (claim) out.push({ claim, edge, credence: edge.credence ?? 0 });
  }
  return out;
}

export function stanceOf(world: World, npc: ActorId, toward: ActorId): string | undefined {
  return currentEdge(world, npc, "stance", toward)?.node;
}

/** The chain of retellings behind a claim, oldest first. */
export function lineage(world: World, claim: ClaimId): Claim[] {
  const chain: Claim[] = [];
  let at: Claim | undefined = world.claims[claim];
  while (at && chain.length < 16) {
    chain.unshift(at);
    at = at.derivedFrom !== undefined ? world.claims[at.derivedFrom] : undefined;
  }
  return chain;
}

/** Two claims are about the same matter when only the teller's changes separate them. */
export function sameMatter(a: Claim, b: Claim): boolean {
  return a.predicate === b.predicate && a.object === b.object;
}
