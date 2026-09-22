/** The inn adapter renders only newly fired, locally observable consequences. */
import {
  cancelProposal,
  type Debt,
  executeProposal,
  type LogId,
  PROPOSAL_DEBT_KIND,
  type World,
} from "@rpg-jev/core";
import type { Game } from "./game.ts";

export function fireProposal(g: Game, debt: Debt): Promise<void> {
  const result = executeProposal(g.store, debt.id);
  if (result.status === "fired" && result.room === g.playerRoom && result.prose)
    g.say(result.prose.replace(/[\p{Cc}\p{Cf}]/gu, " "));
  return Promise.resolve();
}

export function cancelScheduled(g: Game, debt: Debt, cause: LogId, reason: string): void {
  if (debt.kind === PROPOSAL_DEBT_KIND) {
    cancelProposal(g.store, debt.id, reason, cause);
  } else {
    g.commit({ kind: "settle_debt", id: debt.id, status: "cancelled" }, cause);
  }
}

/** A long wait must not leap over a proposal's entire valid execution window. */
export function proposalStep(world: World, maximum: number): number {
  let step = maximum;
  for (const debt of Object.values(world.debts)) {
    if (debt.kind !== PROPOSAL_DEBT_KIND || debt.status !== "pending") continue;
    const until = debt.fuse.due - world.clock;
    if (until > 0) step = Math.min(step, until);
  }
  return step;
}

/** A loaded boundary save can contain work already due at its current minute. */
export function hasDueProposal(world: World): boolean {
  return Object.values(world.debts).some(
    (debt) =>
      debt.kind === PROPOSAL_DEBT_KIND && debt.status === "pending" && debt.fuse.due <= world.clock,
  );
}
