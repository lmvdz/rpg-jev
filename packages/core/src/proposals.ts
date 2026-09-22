/**
 * Person-approved, filled templates use the existing debt ledger, not a second
 * scheduler. Calling admission is the authority: candidate text cannot approve
 * itself. No providers, files, RNG draws or new effect kinds belong here.
 */
import { z } from "zod";
import { type Effect, effectSchema, validateEffect } from "./effects.ts";
import { hashValue } from "./hash.ts";
import { Store } from "./log.ts";
import { failedPreconditions, type Precondition } from "./preconditions.ts";
import type { Debt, LogId, World } from "./types.ts";

export const PROPOSAL_DEBT_KIND = "proposal";
const id = z.string().min(1).max(128);
const minute = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const preconditionSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("in_room"), actor: id, room: id }),
  z.strictObject({ kind: z.literal("alive"), actor: id }),
  z.strictObject({ kind: z.literal("machine_node"), machine: id, node: id }),
  z.strictObject({ kind: z.literal("holds"), actor: id, item: id }),
  z.strictObject({ kind: z.literal("item_in"), item: id, container: id }),
  z.strictObject({ kind: z.literal("believes"), holder: id, claim: id }),
  z.strictObject({ kind: z.literal("debt_pending"), debt: id }),
]);
const contextSchema = z.strictObject({ room: id, stakeholder: id });
const proposalSchema = z.strictObject({
  version: z.literal(1),
  id,
  template: id,
  slots: z
    .record(id, z.strictObject({ kind: z.enum(["actor", "item", "room"]), id }))
    .refine((slots) => Object.keys(slots).length <= 16, "at most 16 slots"),
  effects: z.array(effectSchema).max(16),
  preconditions: z.array(preconditionSchema).max(16),
  fuse: z
    .strictObject({ due: minute, expires: minute.optional() })
    .refine(
      (fuse) => fuse.expires === undefined || fuse.expires >= fuse.due,
      "expires precedes due",
    ),
  prose: z.string().max(2000).optional(),
});

export interface Proposal {
  version: 1;
  id: string;
  template: string;
  slots: Record<string, { kind: "actor" | "item" | "room"; id: string }>;
  effects: Effect[];
  preconditions: Precondition[];
  fuse: { due: number; expires?: number };
  prose?: string;
}
export interface ProposalContext {
  room: string;
  stakeholder: string;
}
export interface ProposalResult {
  status: "admitted" | "duplicate" | "rejected" | "pending" | "fired" | "cancelled";
  debtId: string | null;
  cause: LogId | null;
  reasons: string[];
  prose?: string;
  room?: string;
}

// Bound nested effect payloads too, before traversing them with Zod/hash/JSON.
// Repeated object references are fine; cycles and non-JSON values are not.
function bounded(value: unknown, depth = 0, prose = false, budget = { left: 4096 }): boolean {
  budget.left -= 1;
  if (depth > 12 || budget.left < 0) return false;
  if (typeof value === "string") return value.length <= (prose ? 2000 : 128);
  if (value === null || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object") return false;
  if (Array.isArray(value))
    return value.length <= 16 && value.every((entry) => bounded(entry, depth + 1, false, budget));
  const entries = Object.entries(value);
  return (
    entries.length <= 32 &&
    entries.every(
      ([key, entry]) =>
        key.length <= 128 && bounded(entry, depth + 1, depth === 0 && key === "prose", budget),
    )
  );
}

function result(
  status: ProposalResult["status"],
  debtId: string | null,
  cause: LogId | null,
  reasons: string[] = [],
): ProposalResult {
  return { status, debtId, cause, reasons };
}

function drop(store: Store, debtId: string | null, reasons: string[], cause: LogId | null) {
  const logged = store.append(
    { kind: "dropped", what: debtId ?? "proposal:invalid", reasons },
    cause,
  );
  return result("rejected", debtId, logged, reasons);
}

function itemRoom(world: World, item: string): string | null {
  const seen = new Set<string>();
  let at = item;
  while (seen.size < 64 && !seen.has(at)) {
    seen.add(at);
    const place = Object.hasOwn(world.items, at) ? world.items[at]?.at : undefined;
    if (!place) return null;
    if ("room" in place) return place.room;
    if ("holder" in place) {
      const actor = Object.hasOwn(world.actors, place.holder)
        ? world.actors[place.holder]
        : undefined;
      return actor?.present && actor.alive ? actor.room : null;
    }
    at = place.inside;
  }
  return null;
}

function scopeReasons(world: World, proposal: Proposal, context: ProposalContext): string[] {
  const reasons: string[] = [];
  if (!Object.hasOwn(world.rooms, context.room))
    reasons.push(`room ${context.room} does not exist`);
  const present = (actorId: string) => {
    const actor = Object.hasOwn(world.actors, actorId) ? world.actors[actorId] : undefined;
    return actor?.alive && actor.present && actor.room === context.room;
  };
  if (!present(context.stakeholder))
    reasons.push("stakeholder is not living and present in scope room");
  for (const [name, slot] of Object.entries(proposal.slots)) {
    const validByKind = {
      actor: () => present(slot.id),
      room: () => slot.id === context.room && Object.hasOwn(world.rooms, slot.id),
      item: () => itemRoom(world, slot.id) === context.room,
    };
    const valid = validByKind[slot.kind]();
    if (!valid) reasons.push(`slot ${name}: ${slot.kind} ${slot.id} is not in scope`);
  }
  return reasons;
}

const forbidden = new Set(["advance_clock", "create_debt", "settle_debt", "thermal_settle"]);

/** Sequential preview preserves dependencies without leaking a partial batch. */
function preview(store: Store, effects: Effect[], cause: LogId | null): string[] {
  const sandbox = new Store(structuredClone(store.world), structuredClone(store.log));
  // Execution appends its stimulus before the effects; preview uses the same IDs.
  sandbox.append({ kind: "stimulus", what: "proposal:preview", data: {} }, cause);
  for (const effect of effects) {
    if (forbidden.has(effect.kind))
      return [`proposal effects cannot use lifecycle/clock kind ${effect.kind}`];
    const reasons = validateEffect(sandbox.world, effect);
    if (reasons.length > 0) return reasons;
    sandbox.commit(structuredClone(effect), cause);
  }
  return [];
}

export function admitProposal(
  store: Store,
  candidate: unknown,
  context: ProposalContext,
  cause: LogId | null = null,
): ProposalResult {
  if (!(bounded(candidate) && bounded(context)))
    return drop(store, null, ["proposal exceeds JSON payload bounds"], cause);
  const parsed = proposalSchema.safeParse(candidate);
  const scoped = contextSchema.safeParse(context);
  if (!(parsed.success && scoped.success))
    return drop(
      store,
      null,
      [
        ...(parsed.success ? [] : parsed.error.issues.map((issue) => issue.message)),
        ...(scoped.success ? [] : scoped.error.issues.map((issue) => issue.message)),
      ],
      cause,
    );
  // The bounds pass excluded undefined values, so optional keys are absent,
  // not explicitly undefined (Zod's inferred type does not distinguish these).
  const proposal = parsed.data as Proposal;
  const scope = scoped.data;
  const debtId = `proposal:${proposal.id}`;
  const fingerprint = hashValue({ proposal, context: scope });
  const existing = store.world.debts[debtId];
  if (existing) {
    if (existing.kind === PROPOSAL_DEBT_KIND && existing.data.fingerprint === fingerprint)
      return result("duplicate", debtId, existing.cause);
    return drop(store, debtId, ["proposal ID already has a different payload or context"], cause);
  }
  const reasons = [
    ...scopeReasons(store.world, proposal, scope),
    ...failedPreconditions(store.world, proposal.preconditions),
    ...preview(store, proposal.effects, cause),
  ];
  if (proposal.fuse.due < store.world.clock) reasons.push("proposal due time is in the past");
  const debt: Debt = {
    id: debtId,
    kind: PROPOSAL_DEBT_KIND,
    cause,
    stakeholder: scope.stakeholder,
    magnitude: 1,
    fuse: proposal.fuse,
    status: "pending",
    data: { proposal: JSON.stringify(proposal), context: JSON.stringify(scope), fingerprint },
  };
  reasons.push(...validateEffect(store.world, { kind: "create_debt", debt }));
  if (reasons.length > 0) return drop(store, debtId, reasons, cause);
  const admitted = store.append(
    { kind: "stimulus", what: "proposal:admitted", data: { debtId, fingerprint } },
    cause,
  );
  debt.cause = admitted;
  store.commit({ kind: "create_debt", debt }, admitted);
  return result("admitted", debtId, admitted);
}

export function cancelProposal(
  store: Store,
  debtId: string,
  reason: string,
  cause: LogId | null = null,
): ProposalResult {
  const debt = store.world.debts[debtId];
  if (!debt || debt.kind !== PROPOSAL_DEBT_KIND)
    return drop(store, debtId, ["not a proposal debt"], cause);
  if (debt.status !== "pending") return result("duplicate", debtId, debt.cause);
  const reasons = [reason.slice(0, 2000)];
  const cancelled = store.append({ kind: "dropped", what: debtId, reasons }, cause ?? debt.cause);
  store.commit({ kind: "settle_debt", id: debtId, status: "cancelled" }, cancelled);
  return result("cancelled", debtId, cancelled, reasons);
}

export function executeProposal(store: Store, debtId: string): ProposalResult {
  const debt = store.world.debts[debtId];
  if (!debt || debt.kind !== PROPOSAL_DEBT_KIND)
    return drop(store, debtId, ["not a proposal debt"], null);
  if (debt.status !== "pending") return result("duplicate", debtId, debt.cause);
  if (store.world.clock < debt.fuse.due) return result("pending", debtId, debt.cause);
  if (debt.fuse.expires !== undefined && store.world.clock > debt.fuse.expires)
    return cancelProposal(store, debtId, "proposal expired");
  let proposal: Proposal;
  let context: ProposalContext;
  try {
    const candidate: unknown = JSON.parse(debt.data.proposal ?? "");
    const scope: unknown = JSON.parse(debt.data.context ?? "");
    if (!(bounded(candidate) && bounded(scope))) throw new Error("payload bounds");
    proposal = proposalSchema.parse(candidate) as Proposal;
    context = contextSchema.parse(scope);
  } catch {
    return cancelProposal(store, debtId, "invalid stored proposal");
  }
  if (
    hashValue({ proposal, context }) !== debt.data.fingerprint ||
    debtId !== `proposal:${proposal.id}` ||
    debt.stakeholder !== context.stakeholder ||
    hashValue(debt.fuse) !== hashValue(proposal.fuse)
  )
    return cancelProposal(store, debtId, "stored proposal receipt mismatch");
  const reasons = [
    ...scopeReasons(store.world, proposal, context),
    ...failedPreconditions(store.world, proposal.preconditions),
    ...preview(store, proposal.effects, debt.cause),
  ];
  if (reasons.length > 0) return cancelProposal(store, debtId, reasons.join("; "));
  const fired = store.append(
    { kind: "stimulus", what: "proposal:fired", data: { debtId } },
    debt.cause,
  );
  for (const effect of proposal.effects) store.commit(effect, fired);
  store.commit({ kind: "settle_debt", id: debtId, status: "fired" }, fired);
  return {
    ...result("fired", debtId, fired),
    room: context.room,
    ...(proposal.prose === undefined ? {} : { prose: proposal.prose }),
  };
}
