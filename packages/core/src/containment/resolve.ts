import { applyContainment } from "./apply.ts";
import { attemptSchema, decodeContainmentState } from "./decode.ts";
import type {
  Action,
  Actor,
  Attempt,
  Context,
  Effect,
  Holder,
  Outcome,
  Reason,
  State,
} from "./types.ts";

export function nearby(
  a: { x: number; z: number },
  b: { x: number; z: number },
  radius = 1,
): boolean {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z)) <= radius;
}
export function accessible(actor: Actor, holder: Pick<Holder, "placement">): boolean {
  return holder.placement.kind === "held"
    ? holder.placement.actor === actor.id
    : nearby(actor, holder.placement);
}
export function touched(action: Action): string[] {
  if ("holder" in action) return [action.holder];
  if (action.kind === "transfer") return [action.source, action.destination];
  return [];
}
function outcome(reason: Reason, status: Outcome["status"] = "rejected"): Outcome {
  return { effects: [], reason, status };
}
function update(holder: Holder, patch: Partial<Holder>): Effect {
  return {
    kind: "holder_updated",
    beforeVersion: holder.version,
    after: { ...holder, ...patch, version: holder.version + 1 },
  };
}
function applied(effects: Effect[]): Outcome {
  return { effects, status: "applied", reason: "applied" };
}

interface Input {
  state: State;
  actor: Actor;
  holders: Holder[];
  context: Context;
}
type Handler<K extends Action["kind"]> = (
  input: Input,
  action: Extract<Action, { kind: K }>,
) => Outcome;

const opening: Handler<"opening"> = ({ holders }, action) => {
  const holder = holders[0];
  if (!holder) return outcome("access");
  if (holder.open === action.open) return outcome("unchanged", "noop");
  return applied([update(holder, { open: action.open })]);
};
const take: Handler<"take"> = ({ state, actor, holders }) => {
  const holder = holders[0];
  if (!holder) return outcome("access");
  if (holder.placement.kind === "held") return outcome("unchanged", "noop");
  if (!holder.portable) return outcome("not_portable");
  const count = state.holders.filter(
    (h) => h.placement.kind === "held" && h.placement.actor === actor.id,
  ).length;
  if (count >= actor.carrySlots) return outcome("carry_full");
  return applied([update(holder, { placement: { kind: "held", actor: actor.id } })]);
};
const place: Handler<"place"> = ({ actor, holders, context }, action) => {
  const holder = holders[0];
  if (!holder) return outcome("access");
  if (holder.placement.kind !== "held") return outcome("not_held");
  if (!nearby(actor, action)) return outcome("access");
  if (!context.canPlace) return outcome("terrain_required", "unsupported");
  if (context.canPlace && !context.canPlace({ ...actor }, action.x, action.z))
    return outcome("blocked");
  return applied([update(holder, { placement: { kind: "ground", x: action.x, z: action.z } })]);
};
const transfer: Handler<"transfer"> = ({ holders }, action) => {
  const [source, destination] = holders;
  if (!(source && destination && source.open && destination.open)) return outcome("access");
  if (source.id === destination.id) return outcome("same_holder");
  const contents = source.contents;
  if (!contents || contents.quantityMl < action.quantityMl) return outcome("insufficient");
  if (destination.contents && destination.contents.material !== contents.material)
    return outcome("mixture", "unsupported");
  const amount = (destination.contents?.quantityMl ?? 0) + action.quantityMl;
  if (amount > destination.capacityMl) return outcome("capacity");
  const remaining = contents.quantityMl - action.quantityMl;
  return applied([
    update(source, { contents: remaining === 0 ? null : { ...contents, quantityMl: remaining } }),
    update(destination, { contents: { material: contents.material, quantityMl: amount } }),
  ]);
};
const move: Handler<"move"> = ({ actor, context }, action) => {
  if (Math.max(Math.abs(actor.x - action.x), Math.abs(actor.z - action.z)) !== 1)
    return outcome("invalid_step");
  if (!context.canStep) return outcome("terrain_required", "unsupported");
  if (!context.canStep({ ...actor }, action.x, action.z)) return outcome("blocked");
  return applied([
    {
      kind: "actor_updated",
      beforeVersion: actor.version,
      after: { ...actor, x: action.x, z: action.z, version: actor.version + 1 },
    },
  ]);
};
const handlers: { [K in Action["kind"]]: Handler<K> } = {
  none: () => outcome("none", "noop"),
  opening,
  take,
  place,
  transfer,
  move,
};

/** Read-only mechanism. Caller binds actor identity and commits effects atomically. */
export function resolveContainment(state: State, attempt: Attempt, context: Context = {}): Outcome {
  const parsed = attemptSchema.safeParse(attempt);
  if (!parsed.success) return outcome("invalid_attempt");
  const snapshot = decodeContainmentState(state);
  const { action, versions } = parsed.data;
  const actor = snapshot.actors.find((a) => a.id === parsed.data.actor);
  if (!actor) return outcome("access");
  const holders: Holder[] = [];
  for (const id of touched(action)) {
    const holder = snapshot.holders.find((h) => h.id === id);
    if (!(holder && accessible(actor, holder))) return outcome("access");
    holders.push(holder);
  }
  for (const row of [actor, ...holders]) {
    if (
      !Object.hasOwn(versions, row.id) ||
      versions[row.id] !== row.version ||
      row.version === Number.MAX_SAFE_INTEGER
    )
      return outcome("stale");
  }
  const handler = handlers[action.kind] as Handler<typeof action.kind>;
  const result = handler({ state: snapshot, actor, holders, context }, action);
  if (result.status === "applied") applyContainment(snapshot, result.effects);
  return result;
}
