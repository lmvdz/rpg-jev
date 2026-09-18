/**
 * The one effect vocabulary (SPEC.md sections 2 and 4). Effect kinds are code:
 * a proposal that names an unknown kind fails the schema. Every change to the
 * world goes validate -> log -> apply, and nothing else writes world state.
 */
import { z } from "zod";
import { claimId } from "./claims.ts";
import { currentEdge } from "./graph.ts";
import {
  type BeliefSource,
  type Claim,
  type Debt,
  DRIVES,
  type Drive,
  type LogId,
  NEEDS,
  type Need,
  type Place,
  type ScheduleEntry,
  SPEECH_ACTS,
  type SpeechIntent,
  type World,
} from "./types.ts";

export type NodeTarget =
  | { type: "machine"; id: string }
  | { type: "stance"; npc: string; toward: string };

export type Effect =
  | { kind: "shift_drive"; npc: string; drive: Drive; delta: number }
  | { kind: "shift_need"; npc: string; need: Need; delta: number }
  | { kind: "set_node"; target: NodeTarget; to: string }
  | { kind: "add_claim"; holder: string; claim: Claim; credence: number; source: BeliefSource }
  | { kind: "update_credence"; holder: string; claim: string; credence: number }
  | { kind: "add_commitment"; npc: string; entry: ScheduleEntry }
  | { kind: "apply_override"; group: string[]; entry: ScheduleEntry }
  | { kind: "rewrite_routine"; npc: string; entries: ScheduleEntry[] }
  | { kind: "change_role"; npc: string; role: string }
  | { kind: "create_debt"; debt: Debt }
  | { kind: "settle_debt"; id: string; status: "fired" | "cancelled" }
  | { kind: "transfer"; item: string; to: Place }
  | { kind: "pay"; from: string; to: string; coins: number }
  | { kind: "damage"; target: string; amount: number }
  | { kind: "move"; actor: string; to: string; activity?: string }
  | { kind: "retire"; actor: string }
  | { kind: "advance_clock"; minutes: number }
  | { kind: "queue_speech"; intent: SpeechIntent }
  | { kind: "say"; intent: SpeechIntent }
  | { kind: "drop_speech"; id: string; reason: string };

export type EffectKind = Effect["kind"];

/** Largest single change to a drive or need. Keeps one event from rewriting a mind. */
export const MAX_STEP = 0.3;

const id = z.string().min(1);
const minute = z.number().int().min(0);
const unit = z.number().min(0).max(1);
const step = z.number().min(-MAX_STEP).max(MAX_STEP);

const place = z.union([
  z.strictObject({ room: id }),
  z.strictObject({ holder: id }),
  z.strictObject({ inside: id }),
]);

const scheduleEntry = z
  .strictObject({
    id,
    activity: id,
    at_location: id,
    at: minute.optional(),
    every: z.strictObject({ period: z.number().int().min(1), offset: minute }).optional(),
    after: id.optional(),
    until: minute,
    busy: z.boolean().optional(),
    cause: z.number().int().nullable(),
  })
  .refine((e) => [e.at, e.every, e.after].filter((v) => v !== undefined).length === 1, {
    message: "a schedule entry starts by exactly one of at, every and after",
  });

const claim = z.strictObject({
  id,
  subject: id,
  predicate: id,
  object: id.optional(),
  to: id.optional(),
  place: id.optional(),
  when: minute,
  severity: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  motive: id.optional(),
  origin: z.number().int().nullable(),
  derivedFrom: id.optional(),
  distortion: id.optional(),
});

const beliefSource = z.union([
  z.strictObject({ kind: z.literal("witnessed") }),
  z.strictObject({ kind: z.literal("told"), from: id }),
  z.strictObject({ kind: z.literal("shown"), from: id }),
  z.strictObject({ kind: z.literal("inferred") }),
]);

const topic = z.union([
  z.strictObject({ kind: z.literal("claim"), id }),
  z.strictObject({ kind: z.literal("entity"), id }),
  z.strictObject({ kind: z.literal("whereabouts"), id }),
  z.strictObject({ kind: z.literal("request"), id }),
  z.strictObject({ kind: z.literal("none") }),
]);

const speechIntent = z.strictObject({
  id,
  speaker: id,
  listener: id,
  act: z.enum(SPEECH_ACTS),
  topic,
  priority: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  createdBeat: z.number().int().min(0),
  cause: z.number().int(),
});

const debt = z.strictObject({
  id,
  cause: z.number().int().nullable(),
  stakeholder: id,
  kind: id,
  magnitude: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  fuse: z.strictObject({ due: minute, expires: minute.optional() }),
  status: z.literal("pending"),
  data: z.record(z.string(), z.string()),
});

const nodeTarget = z.union([
  z.strictObject({ type: z.literal("machine"), id }),
  z.strictObject({ type: z.literal("stance"), npc: id, toward: id }),
]);

export const effectSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("shift_drive"), npc: id, drive: z.enum(DRIVES), delta: step }),
  z.strictObject({ kind: z.literal("shift_need"), npc: id, need: z.enum(NEEDS), delta: step }),
  z.strictObject({ kind: z.literal("set_node"), target: nodeTarget, to: id }),
  z.strictObject({
    kind: z.literal("add_claim"),
    holder: id,
    claim,
    credence: unit,
    source: beliefSource,
  }),
  z.strictObject({ kind: z.literal("update_credence"), holder: id, claim: id, credence: unit }),
  z.strictObject({ kind: z.literal("add_commitment"), npc: id, entry: scheduleEntry }),
  z.strictObject({
    kind: z.literal("apply_override"),
    group: z.array(id).min(1),
    entry: scheduleEntry,
  }),
  z.strictObject({
    kind: z.literal("rewrite_routine"),
    npc: id,
    entries: z.array(scheduleEntry),
  }),
  z.strictObject({ kind: z.literal("change_role"), npc: id, role: id }),
  z.strictObject({ kind: z.literal("create_debt"), debt }),
  z.strictObject({
    kind: z.literal("settle_debt"),
    id,
    status: z.enum(["fired", "cancelled"]),
  }),
  z.strictObject({ kind: z.literal("transfer"), item: id, to: place }),
  z.strictObject({
    kind: z.literal("pay"),
    from: id,
    to: id,
    coins: z.number().int().min(1),
  }),
  z.strictObject({
    kind: z.literal("damage"),
    target: id,
    amount: z.number().int().min(1).max(10),
  }),
  z.strictObject({ kind: z.literal("move"), actor: id, to: id, activity: id.optional() }),
  z.strictObject({ kind: z.literal("retire"), actor: id }),
  z.strictObject({
    kind: z.literal("advance_clock"),
    minutes: z.number().int().min(1).max(240),
  }),
  z.strictObject({ kind: z.literal("queue_speech"), intent: speechIntent }),
  z.strictObject({ kind: z.literal("say"), intent: speechIntent }),
  z.strictObject({ kind: z.literal("drop_speech"), id, reason: z.string() }),
]);

export const EFFECT_KINDS: readonly EffectKind[] = effectSchema.options.map(
  (o) => o.shape.kind.value,
);

function liveActor(world: World, actor: string, errors: string[], what = "actor"): void {
  const a = world.actors[actor];
  if (!a) errors.push(`${what} ${actor} does not exist`);
  else if (!(a.alive && a.present)) errors.push(`${what} ${actor} is dead or gone`);
}

function placeExists(world: World, to: Place, errors: string[]): void {
  if ("room" in to && !world.rooms[to.room]) errors.push(`room ${to.room} does not exist`);
  if ("holder" in to) liveActor(world, to.holder, errors, "holder");
  if ("inside" in to && !world.items[to.inside]) errors.push(`container ${to.inside} is missing`);
}

function entryOk(world: World, entry: ScheduleEntry, errors: string[]): void {
  if (!world.rooms[entry.at_location]) errors.push(`room ${entry.at_location} does not exist`);
}

type Validator<K extends EffectKind> = (
  world: World,
  effect: Extract<Effect, { kind: K }>,
  errors: string[],
) => void;

// Drives, needs, commitments, routines and roles are all read off the NPC mind.
function validateNpcEffect(
  world: World,
  effect: Extract<
    Effect,
    { kind: "shift_drive" | "shift_need" | "add_commitment" | "rewrite_routine" | "change_role" }
  >,
  errors: string[],
): void {
  liveActor(world, effect.npc, errors, "npc");
  // Needs belong to every body, player included; schedules and roles are NPC minds.
  if (effect.kind !== "shift_need" && world.actors[effect.npc]?.kind === "player")
    errors.push("the player has no NPC mind");
  if (effect.kind === "add_commitment") entryOk(world, effect.entry, errors);
  if (effect.kind === "rewrite_routine") for (const e of effect.entries) entryOk(world, e, errors);
  if (effect.kind === "change_role" && !world.def.roles.includes(effect.role))
    errors.push(`role ${effect.role} is not a known role`);
}

function validateApplyOverride(
  world: World,
  effect: Extract<Effect, { kind: "apply_override" }>,
  errors: string[],
): void {
  for (const npc of effect.group) liveActor(world, npc, errors, "npc");
  entryOk(world, effect.entry, errors);
}

function validateSetNode(
  world: World,
  effect: Extract<Effect, { kind: "set_node" }>,
  errors: string[],
): void {
  const { target, to } = effect;
  let fsm: string;
  let from: string | undefined;
  if (target.type === "machine") {
    const machine = world.machines[target.id];
    if (!machine) {
      errors.push(`machine ${target.id} does not exist`);
      return;
    }
    fsm = machine.fsm;
    from = machine.node;
  } else {
    liveActor(world, target.npc, errors, "npc");
    if (!world.actors[target.toward]) errors.push(`actor ${target.toward} does not exist`);
    fsm = "stance";
    from = currentEdge(world, target.npc, "stance", target.toward)?.node;
  }
  const table = world.def.fsms[fsm];
  if (!table) errors.push(`fsm ${fsm} is not defined`);
  else if (!(to in table)) errors.push(`${to} is not a node of ${fsm}`);
  else if (from !== undefined && !table[from]?.includes(to))
    errors.push(`${fsm}: ${from} -> ${to} is not a legal transition`);
}

function validateAddClaim(
  world: World,
  effect: Extract<Effect, { kind: "add_claim" }>,
  errors: string[],
): void {
  liveActor(world, effect.holder, errors, "holder");
  const { claim: c } = effect;
  if (!world.def.predicates.includes(c.predicate))
    errors.push(`predicate ${c.predicate} is not in the vocabulary`);
  if (c.motive !== undefined && !world.def.motives.includes(c.motive))
    errors.push(`motive ${c.motive} is not in the vocabulary`);
  if (!world.actors[c.subject]) errors.push(`claim subject ${c.subject} does not exist`);
  if (c.to !== undefined && !world.actors[c.to])
    errors.push(`claim names ${c.to}, who does not exist`);
  if (c.place !== undefined && !world.rooms[c.place])
    errors.push(`claim place ${c.place} does not exist`);
  if (c.derivedFrom !== undefined && !world.claims[c.derivedFrom])
    errors.push(`claim ${c.derivedFrom} to derive from does not exist`);
  const existing = world.claims[c.id];
  // The same content can be reached by two retelling paths; only the content must agree.
  if (existing && claimId(existing) !== claimId(c))
    errors.push(`claim ${c.id} already exists with different content`);
  if (currentEdge(world, effect.holder, "believes", c.id))
    errors.push(`${effect.holder} already holds ${c.id}; use update_credence`);
  if ("from" in effect.source && !world.actors[effect.source.from])
    errors.push(`source ${effect.source.from} does not exist`);
}

function validateUpdateCredence(
  world: World,
  effect: Extract<Effect, { kind: "update_credence" }>,
  errors: string[],
): void {
  if (!currentEdge(world, effect.holder, "believes", effect.claim))
    errors.push(`${effect.holder} holds no current belief in ${effect.claim}`);
}

function validateCreateDebt(
  world: World,
  effect: Extract<Effect, { kind: "create_debt" }>,
  errors: string[],
): void {
  if (world.debts[effect.debt.id]) errors.push(`debt ${effect.debt.id} already exists`);
  if (!world.actors[effect.debt.stakeholder])
    errors.push(`stakeholder ${effect.debt.stakeholder} does not exist`);
  if (!world.def.debtKinds.includes(effect.debt.kind))
    errors.push(`debt kind ${effect.debt.kind} is not known`);
}

function validateSettleDebt(
  world: World,
  effect: Extract<Effect, { kind: "settle_debt" }>,
  errors: string[],
): void {
  if (world.debts[effect.id]?.status !== "pending") errors.push(`debt ${effect.id} is not pending`);
}

function validateTransfer(
  world: World,
  effect: Extract<Effect, { kind: "transfer" }>,
  errors: string[],
): void {
  if (!world.items[effect.item]) errors.push(`item ${effect.item} does not exist`);
  placeExists(world, effect.to, errors);
  if ("inside" in effect.to && effect.to.inside === effect.item)
    errors.push("an item cannot contain itself");
}

function validatePay(
  world: World,
  effect: Extract<Effect, { kind: "pay" }>,
  errors: string[],
): void {
  liveActor(world, effect.from, errors, "payer");
  liveActor(world, effect.to, errors, "payee");
  const payer = world.actors[effect.from];
  if (payer && payer.coins < effect.coins)
    errors.push(`${effect.from} has only ${payer.coins} coins`);
}

function validateDamage(
  world: World,
  effect: Extract<Effect, { kind: "damage" }>,
  errors: string[],
): void {
  liveActor(world, effect.target, errors, "target");
}

function validateMove(
  world: World,
  effect: Extract<Effect, { kind: "move" }>,
  errors: string[],
): void {
  liveActor(world, effect.actor, errors);
  if (!world.rooms[effect.to]) errors.push(`room ${effect.to} does not exist`);
}

function validateRetire(
  world: World,
  effect: Extract<Effect, { kind: "retire" }>,
  errors: string[],
): void {
  if (!world.actors[effect.actor]?.present) errors.push(`${effect.actor} is not in the world`);
}

function validateAdvanceClock(): void {
  // No preconditions: the clock always may advance.
}

function validateSpeech(
  world: World,
  effect: Extract<Effect, { kind: "queue_speech" | "say" }>,
  errors: string[],
): void {
  const { intent } = effect;
  liveActor(world, intent.speaker, errors, "speaker");
  liveActor(world, intent.listener, errors, "listener");
  if (intent.topic.kind === "claim" && !world.claims[intent.topic.id])
    errors.push(`topic claim ${intent.topic.id} does not exist`);
  if (effect.kind === "queue_speech" && world.conversation.queue.some((q) => q.id === intent.id))
    errors.push(`speech ${intent.id} is already queued`);
}

function validateDropSpeech(
  world: World,
  effect: Extract<Effect, { kind: "drop_speech" }>,
  errors: string[],
): void {
  if (!world.conversation.queue.some((q) => q.id === effect.id))
    errors.push(`speech ${effect.id} is not queued`);
}

const validators: { [K in EffectKind]: Validator<K> } = {
  shift_drive: validateNpcEffect,
  shift_need: validateNpcEffect,
  set_node: validateSetNode,
  add_claim: validateAddClaim,
  update_credence: validateUpdateCredence,
  add_commitment: validateNpcEffect,
  apply_override: validateApplyOverride,
  rewrite_routine: validateNpcEffect,
  change_role: validateNpcEffect,
  create_debt: validateCreateDebt,
  settle_debt: validateSettleDebt,
  transfer: validateTransfer,
  pay: validatePay,
  damage: validateDamage,
  move: validateMove,
  retire: validateRetire,
  advance_clock: validateAdvanceClock,
  queue_speech: validateSpeech,
  say: validateSpeech,
  drop_speech: validateDropSpeech,
};

/**
 * Schema plus preconditions. Returns the reasons an effect is illegal in this
 * world; an empty list means it may be logged and applied.
 */
export function validateEffect(world: World, candidate: unknown): string[] {
  const parsed = effectSchema.safeParse(candidate);
  if (!parsed.success) return parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
  const effect = parsed.data as Effect;
  const errors: string[] = [];
  const validate = validators[effect.kind] as (
    world: World,
    effect: Effect,
    errors: string[],
  ) => void;
  validate(world, effect, errors);
  return errors;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, Math.round(n * 1000) / 1000));

function closeEdge(world: World, src: string, kind: "believes" | "stance", dst: string): void {
  const edge = currentEdge(world, src, kind, dst);
  if (edge) edge.valid_to = world.clock;
}

type Applier<K extends EffectKind> = (
  world: World,
  effect: Extract<Effect, { kind: K }>,
  entryId: LogId,
) => void;

function applyShiftDrive(world: World, effect: Extract<Effect, { kind: "shift_drive" }>): void {
  const a = world.actors[effect.npc] as NonNullable<(typeof world.actors)[string]>;
  a.drives[effect.drive] = clamp01(a.drives[effect.drive] + effect.delta);
}

function applyShiftNeed(world: World, effect: Extract<Effect, { kind: "shift_need" }>): void {
  const a = world.actors[effect.npc] as NonNullable<(typeof world.actors)[string]>;
  a.needs[effect.need] = clamp01(a.needs[effect.need] + effect.delta);
}

function applySetNode(
  world: World,
  effect: Extract<Effect, { kind: "set_node" }>,
  entryId: LogId,
): void {
  if (effect.target.type === "machine") {
    const machine = world.machines[effect.target.id];
    if (machine) machine.node = effect.to;
  } else {
    closeEdge(world, effect.target.npc, "stance", effect.target.toward);
    world.edges.push({
      src: effect.target.npc,
      dst: effect.target.toward,
      kind: "stance",
      valid_from: world.clock,
      valid_to: null,
      known_from: world.clock,
      cause_id: entryId,
      node: effect.to,
    });
  }
}

function applyAddClaim(
  world: World,
  effect: Extract<Effect, { kind: "add_claim" }>,
  entryId: LogId,
): void {
  const { claim: c, holder, source } = effect;
  if (!world.claims[c.id]) {
    world.claims[c.id] = c;
    if (c.derivedFrom !== undefined)
      world.edges.push({
        src: c.derivedFrom,
        dst: c.id,
        kind: "derived",
        valid_from: world.clock,
        valid_to: null,
        known_from: world.clock,
        cause_id: entryId,
      });
  }
  world.edges.push({
    src: holder,
    dst: c.id,
    kind: "believes",
    valid_from: c.when,
    valid_to: null,
    known_from: world.clock,
    cause_id: entryId,
    credence: effect.credence,
    source,
  });
  if (source.kind === "told" || source.kind === "shown")
    world.edges.push({
      src: source.from,
      dst: holder,
      kind: "told",
      valid_from: world.clock,
      valid_to: world.clock,
      known_from: world.clock,
      cause_id: entryId,
      claim: c.id,
    });
}

function applyUpdateCredence(
  world: World,
  effect: Extract<Effect, { kind: "update_credence" }>,
  entryId: LogId,
): void {
  const old = currentEdge(world, effect.holder, "believes", effect.claim);
  if (!old) return;
  old.valid_to = world.clock;
  world.edges.push({ ...old, valid_to: null, cause_id: entryId, credence: effect.credence });
}

function applyAddCommitment(
  world: World,
  effect: Extract<Effect, { kind: "add_commitment" }>,
  entryId: LogId,
): void {
  world.schedules[effect.npc]?.commitments.push({ ...effect.entry, cause: entryId });
}

function applyOverride(
  world: World,
  effect: Extract<Effect, { kind: "apply_override" }>,
  entryId: LogId,
): void {
  for (const npc of effect.group)
    world.schedules[npc]?.overrides.push({ ...effect.entry, cause: entryId });
}

function applyRewriteRoutine(
  world: World,
  effect: Extract<Effect, { kind: "rewrite_routine" }>,
  entryId: LogId,
): void {
  const schedule = world.schedules[effect.npc];
  if (schedule) schedule.role = effect.entries.map((e) => ({ ...e, cause: entryId }));
}

function applyChangeRole(world: World, effect: Extract<Effect, { kind: "change_role" }>): void {
  const a = world.actors[effect.npc];
  if (a) a.role = effect.role;
}

function applyCreateDebt(
  world: World,
  effect: Extract<Effect, { kind: "create_debt" }>,
  entryId: LogId,
): void {
  world.debts[effect.debt.id] = { ...effect.debt, cause: effect.debt.cause ?? entryId };
}

function applySettleDebt(world: World, effect: Extract<Effect, { kind: "settle_debt" }>): void {
  const d = world.debts[effect.id];
  if (d) d.status = effect.status;
}

function applyTransfer(world: World, effect: Extract<Effect, { kind: "transfer" }>): void {
  const item = world.items[effect.item];
  if (item) item.at = effect.to;
}

function applyPay(world: World, effect: Extract<Effect, { kind: "pay" }>): void {
  const from = world.actors[effect.from];
  const to = world.actors[effect.to];
  if (from && to) {
    from.coins -= effect.coins;
    to.coins += effect.coins;
  }
}

function applyDamage(world: World, effect: Extract<Effect, { kind: "damage" }>): void {
  const a = world.actors[effect.target];
  if (a) {
    a.hp = Math.max(0, a.hp - effect.amount);
    if (a.hp === 0 && a.kind === "npc") {
      a.alive = false;
      // The dead hold nothing: what they carried falls where they fell.
      for (const item of Object.values(world.items))
        if ("holder" in item.at && item.at.holder === a.id) item.at = { room: a.room };
      world.conversation.queue = world.conversation.queue.filter(
        (q) => q.speaker !== a.id && q.listener !== a.id,
      );
    }
  }
}

function applyMove(world: World, effect: Extract<Effect, { kind: "move" }>): void {
  const a = world.actors[effect.actor];
  if (a) {
    a.room = effect.to;
    if (effect.activity !== undefined) a.activity = effect.activity;
  }
}

function applyRetire(world: World, effect: Extract<Effect, { kind: "retire" }>): void {
  const a = world.actors[effect.actor];
  if (a) a.present = false;
}

function applyAdvanceClock(world: World, effect: Extract<Effect, { kind: "advance_clock" }>): void {
  world.clock += effect.minutes;
  world.conversation.beat += 1;
}

function applyQueueSpeech(world: World, effect: Extract<Effect, { kind: "queue_speech" }>): void {
  world.conversation.queue.push(effect.intent);
}

function applySay(world: World, effect: Extract<Effect, { kind: "say" }>): void {
  const conv = world.conversation;
  conv.queue = conv.queue.filter((q) => q.id !== effect.intent.id);
  conv.lastSpokeBeat[effect.intent.speaker] = conv.beat;
  conv.lastSpeaker = effect.intent.speaker;
}

function applyDropSpeech(world: World, effect: Extract<Effect, { kind: "drop_speech" }>): void {
  world.conversation.queue = world.conversation.queue.filter((q) => q.id !== effect.id);
}

const appliers: { [K in EffectKind]: Applier<K> } = {
  shift_drive: applyShiftDrive,
  shift_need: applyShiftNeed,
  set_node: applySetNode,
  add_claim: applyAddClaim,
  update_credence: applyUpdateCredence,
  add_commitment: applyAddCommitment,
  apply_override: applyOverride,
  rewrite_routine: applyRewriteRoutine,
  change_role: applyChangeRole,
  create_debt: applyCreateDebt,
  settle_debt: applySettleDebt,
  transfer: applyTransfer,
  pay: applyPay,
  damage: applyDamage,
  move: applyMove,
  retire: applyRetire,
  advance_clock: applyAdvanceClock,
  queue_speech: applyQueueSpeech,
  say: applySay,
  drop_speech: applyDropSpeech,
};

/**
 * Applies a validated effect. `entryId` is the log entry that holds the effect;
 * rows written here carry it as their `cause_id`. Call only through `Store.commit`.
 */
export function applyEffect(world: World, effect: Effect, entryId: LogId): void {
  const apply = appliers[effect.kind] as (world: World, effect: Effect, entryId: LogId) => void;
  apply(world, effect, entryId);
}

function actorInvariants(world: World, problems: string[]): void {
  for (const a of Object.values(world.actors)) {
    if (!world.rooms[a.room]) problems.push(`${a.id} is in a room that does not exist`);
    if (a.hp < 0 || a.hp > a.maxHp) problems.push(`${a.id} has impossible hit points`);
    if (a.coins < 0) problems.push(`${a.id} has negative coins`);
    for (const drive of DRIVES)
      if (a.drives[drive] < 0 || a.drives[drive] > 1)
        problems.push(`${a.id}.${drive} out of range`);
  }
}

function itemInvariants(world: World, problems: string[]): void {
  for (const item of Object.values(world.items)) {
    if ("holder" in item.at && !world.actors[item.at.holder]?.alive)
      problems.push(`${item.id} is held by someone dead or missing`);
  }
}

function edgeInvariants(world: World, problems: string[]): void {
  const open = new Set<string>();
  for (const e of world.edges) {
    if (e.valid_to !== null) continue;
    if (e.kind !== "believes" && e.kind !== "stance") continue;
    const key = `${e.src}|${e.kind}|${e.dst}`;
    if (open.has(key)) problems.push(`two open ${e.kind} rows for ${e.src} -> ${e.dst}`);
    open.add(key);
  }
}

function speechInvariants(world: World, problems: string[]): void {
  for (const q of world.conversation.queue)
    if (!world.actors[q.speaker]?.alive) problems.push(`a dead actor has speech queued`);
}

/** Invariants re-checked after every commit (SPEC.md section 12). */
export function checkInvariants(world: World): string[] {
  const problems: string[] = [];
  actorInvariants(world, problems);
  itemInvariants(world, problems);
  edgeInvariants(world, problems);
  speechInvariants(world, problems);
  return problems;
}
