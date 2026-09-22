/**
 * Person-approved M2 content. This is a checked-in source, not an import,
 * player command or generative-author inbox. Names and timings belong here.
 */
import {
  admitProposal,
  PROPOSAL_DEBT_KIND,
  type Proposal,
  type ProposalContext,
  type Store,
  type World,
} from "@rpg-jev/core";
import { CONTENT_VERSION, initialWorld, PLAYER } from "./content.ts";

export const HANDWRITTEN_CONTENT_VERSION = `${CONTENT_VERSION}+handwritten-1`;

const SUPPER = [
  { id: "supper-bread", server: "mara", item: "bread", room: "common_room", after: 3 },
  { id: "supper-onion", server: "odo", item: "onion", room: "kitchen", after: 4 },
  { id: "supper-tankard", server: "mara", item: "tankard", room: "common_room", after: 6 },
] as const;

/** The save selects its initial content; changing current files never re-admits a saved queue. */
export function worldForContent(seed: number, content: string): World {
  if (content !== CONTENT_VERSION && content !== HANDWRITTEN_CONTENT_VERSION)
    throw new Error(`save is for ${content}, this build does not support that content`);
  const world = initialWorld(seed);
  if (content === HANDWRITTEN_CONTENT_VERSION) {
    world.def.debtKinds.push(PROPOSAL_DEBT_KIND);
    const guest = world.actors[PLAYER];
    if (!guest) throw new Error("approved supper guest is missing");
    guest.needs.hunger = 0.55;
    for (const row of SUPPER) {
      const item = world.items[row.item];
      if (!item) throw new Error(`approved supper item ${row.item} is missing`);
      item.at = { holder: row.server };
    }
  }
  return world;
}

/** One template, three filled instances; it cannot mint an effect kind from prose. */
export function supperProposals(world: World): { proposal: Proposal; context: ProposalContext }[] {
  return SUPPER.map((row) => ({
    context: { room: row.room, stakeholder: row.server },
    proposal: {
      version: 1,
      id: row.id,
      template: "set-out-item-1",
      slots: {
        server: { kind: "actor", id: row.server },
        item: { kind: "item", id: row.item },
        room: { kind: "room", id: row.room },
      },
      effects: [{ kind: "transfer", item: row.item, to: { room: row.room } }],
      preconditions: [
        { kind: "alive", actor: row.server },
        { kind: "in_room", actor: row.server, room: row.room },
        { kind: "holds", actor: row.server, item: row.item },
      ],
      fuse: { due: world.clock + row.after, expires: world.clock + row.after + 1 },
      prose: `${world.actors[row.server]?.name} sets out ${world.items[row.item]?.name} within reach.`,
    },
  }));
}

export function admitSupper(store: Store): void {
  for (const { proposal, context } of supperProposals(store.world)) {
    const result = admitProposal(store, proposal, context, 0);
    if (result.status !== "admitted")
      throw new Error(`approved proposal ${proposal.id} rejected: ${result.reasons.join("; ")}`);
  }
}
