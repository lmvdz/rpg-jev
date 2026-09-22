import { z } from "zod";
import type { State } from "./types.ts";

const text = z
  .string()
  .min(1)
  .max(96)
  .refine((s) => s.trim() === s && !/\p{C}/u.test(s));
export const coordinate = z.number().int().min(-1_000_000_000).max(1_000_000_000);
const version = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const quantity = z.number().int().min(1).max(1_000_000);
export const actorSchema = z.strictObject({
  id: text,
  x: coordinate,
  z: coordinate,
  version,
  carrySlots: z.number().int().min(1).max(4),
});
export const holderSchema = z.strictObject({
  id: text,
  label: text,
  look: z.strictObject({
    glyph: z.number().int().min(0).max(105),
    ink: z.number().int().min(0).max(15),
    scale: z.number().int().min(1).max(255).optional(),
  }),
  capacityMl: quantity,
  portable: z.boolean(),
  open: z.boolean(),
  placement: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("ground"), x: coordinate, z: coordinate }),
    z.strictObject({ kind: z.literal("held"), actor: text }),
  ]),
  contents: z.strictObject({ material: text, quantityMl: quantity }).nullable(),
  version,
});
const stateSchema = z.strictObject({
  actors: z.array(actorSchema).max(64),
  holders: z.array(holderSchema).max(256),
  materials: z.array(z.strictObject({ id: text, label: text })).max(32),
});
export const actionSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("none") }),
  z.strictObject({ kind: z.literal("opening"), holder: text, open: z.boolean() }),
  z.strictObject({ kind: z.literal("take"), holder: text }),
  z.strictObject({ kind: z.literal("place"), holder: text, x: coordinate, z: coordinate }),
  z.strictObject({
    kind: z.literal("transfer"),
    source: text,
    destination: text,
    quantityMl: quantity,
  }),
  z.strictObject({ kind: z.literal("move"), x: coordinate, z: coordinate }),
]);
export const attemptSchema = z.strictObject({
  actor: text,
  versions: z.record(text, version).refine((v) => Object.keys(v).length <= 320),
  action: actionSchema,
});

function unique(ids: string[]): void {
  if (new Set(ids).size !== ids.length) throw new Error("Duplicate containment id");
}

/** Throws on invalid input; the returned tree shares no objects with the input. */
export function decodeContainmentState(input: unknown): State {
  const state = stateSchema.parse(input);
  unique([...state.actors, ...state.holders].map((row) => row.id));
  unique(state.materials.map((row) => row.id));
  const actors = new Map(state.actors.map((actor) => [actor.id, actor]));
  const materials = new Set(state.materials.map((material) => material.id));
  const carried = new Map<string, number>();
  for (const holder of state.holders) {
    if (
      holder.contents &&
      (!materials.has(holder.contents.material) || holder.contents.quantityMl > holder.capacityMl)
    )
      throw new Error("Invalid contents");
    if (holder.placement.kind !== "held") continue;
    const actor = actors.get(holder.placement.actor);
    if (!(actor && holder.portable)) throw new Error("Invalid possession");
    const count = (carried.get(actor.id) ?? 0) + 1;
    if (count > actor.carrySlots) throw new Error("Carry capacity exceeded");
    carried.set(actor.id, count);
  }
  return state;
}
