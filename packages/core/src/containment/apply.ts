import { z } from "zod";
import { actorSchema, decodeContainmentState, holderSchema } from "./decode.ts";
import type { Effect, State } from "./types.ts";

const effectSchema = z
  .array(
    z.discriminatedUnion("kind", [
      z.strictObject({
        kind: z.literal("holder_updated"),
        beforeVersion: z.number().int().nonnegative(),
        after: holderSchema,
      }),
      z.strictObject({
        kind: z.literal("actor_updated"),
        beforeVersion: z.number().int().nonnegative(),
        after: actorSchema,
      }),
    ]),
  )
  .max(320);

function totals(state: State): Map<string, number> {
  const result = new Map<string, number>();
  for (const holder of state.holders) {
    const contents = holder.contents;
    if (contents)
      result.set(contents.material, (result.get(contents.material) ?? 0) + contents.quantityMl);
  }
  return result;
}

/** Atomic, detached projection for the authoritative reducer and replay, not a writer. */
export function applyContainment(state: State, effects: readonly Effect[]): State {
  const next = decodeContainmentState(state);
  const seen = new Set<string>();
  for (const effect of effectSchema.parse(effects)) {
    const rows = effect.kind === "holder_updated" ? next.holders : next.actors;
    const row = rows.find((row) => row.id === effect.after.id);
    if (
      !row ||
      seen.has(row.id) ||
      row.version !== effect.beforeVersion ||
      effect.after.version !== row.version + 1
    )
      throw new Error("Invalid effect version");
    seen.add(row.id);
    if (effect.kind === "holder_updated") {
      next.holders = next.holders.map((row) => (row.id === effect.after.id ? effect.after : row));
    } else {
      next.actors = next.actors.map((row) => (row.id === effect.after.id ? effect.after : row));
    }
  }
  const valid = decodeContainmentState(next);
  const before = totals(state);
  const after = totals(valid);
  for (const material of state.materials) {
    if ((before.get(material.id) ?? 0) !== (after.get(material.id) ?? 0)) {
      throw new Error("Material quantity is not conserved");
    }
  }
  return valid;
}
