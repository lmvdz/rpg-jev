/**
 * Load is a check, not a process: whatever bears weight against its strength. Strength is
 * read off effective levels, so a soaked plank, a rusted chain, a cracked beam and one with
 * a hidden flaw are all the same rule. What fails becomes force on itself.
 */
import { effective } from "./effective.ts";
import type { Change, MatterWorld, Thing } from "./types.ts";

export interface LoadAct {
  process: "load";
  support: string;
  /** Things whose mass it is asked to bear. */
  bearing: string[];
}

/**
 * What it can bear, on the same scale as mass. A steady load is borne by hardness and by how
 * much material there is; toughness counts for less here than it does against a blow. A
 * sound thing bears itself with room to spare.
 */
export function strength(world: MatterWorld, support: Thing): number {
  const p = effective(world, support);
  const sound = support.state.integrity / 5;
  // A long thing bears across its thin dimension: a pole is not as strong as it is long.
  const long = world.elements[support.element]?.forms.includes("long") ?? false;
  const section = long ? Math.max(0, p.size - 2) : p.size;
  const raw = (p.hardness * 0.5 + p.toughness * 0.3 + section * 0.7 + 0.5) * sound;
  return Math.max(0, raw - support.state.flaw - support.state.corrosion * 0.5);
}

/** Levels are steps of doubling, so weights add as powers of two and amount counts. */
export function weight(world: MatterWorld, ids: readonly string[]): number {
  const total = ids.reduce((sum, id) => {
    const thing = world.things[id];
    return thing ? sum + 2 ** effective(world, thing).mass * thing.state.amount : sum;
  }, 0);
  return total > 0 ? Math.log2(total) : 0;
}

export function load(world: MatterWorld, act: LoadAct): Change[] {
  const support = world.things[act.support];
  if (!support)
    return [{ kind: "nothing", because: [], note: "there is nothing there to bear it" }];
  const borne = weight(world, act.bearing);
  if (borne <= strength(world, support))
    return [{ kind: "nothing", because: ["R3", "P4", "P1"], note: "it holds" }];
  return [
    {
      kind: "state",
      thing: support.id,
      set: { integrity: Math.min(support.state.integrity, 1) },
      because: ["R3", "P4", "P1", "S4", "S15", "S10", "M1"],
      note: "it gives way under the load",
    },
    {
      kind: "signal",
      place: support.place,
      channel: "sound",
      strength: 4,
      because: ["X2", "E9"],
      note: "a crack as it goes",
    },
  ];
}
