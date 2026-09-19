/**
 * Load as it was when it was functions, kept word for word as the oracle for the rows that
 * replaced it (soak-rules.test.ts). Nothing in the engine reads this. When a rule is changed on
 * purpose, change the row and this together, or retire both.
 */
import {
  bearing,
  type Change,
  effective,
  levelOf,
  type MatterWorld,
  quantity,
  type Thing,
  thin,
} from "../../../src/matter/index.ts";

interface LoadActWas {
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
export function strengthOracle(world: MatterWorld, support: Thing): number {
  const p = effective(world, support);
  const sound = support.state.integrity / 5;
  const forms = world.elements[support.element]?.forms ?? [];
  // A cord or a sheet bears in tension, by its toughness and nothing else: not by its length.
  // Everything else bears by hardness and by the section a load has to cross (scale.ts).
  // Only what is thin and gives bears in tension: a sheet of ice is a slab, not a cloth.
  const raw =
    thin(forms) && p.flexibility >= 3
      ? (p.toughness * 0.9 + 0.5) * sound
      : (p.hardness * 0.5 +
          p.toughness * 0.3 +
          (thin(forms) ? p.size : bearing(forms, p.size)) * 0.7 +
          0.5) *
        sound;
  return Math.max(0, raw - support.state.flaw - support.state.corrosion * 0.5);
}

/** Weights add as quantities and are read back as a level, so amount counts (scale.ts). */
function weight(world: MatterWorld, ids: readonly string[]): number {
  const total = ids.reduce((sum, id) => {
    const thing = world.things[id];
    if (thing) return sum + quantity(effective(world, thing).mass) * thing.state.amount;
    const body = world.bodies[id];
    return body ? sum + quantity(world.elements[body.element ?? ""]?.props.mass ?? 3) : sum;
  }, 0);
  return levelOf(total);
}

export function loadOracle(world: MatterWorld, act: LoadActWas): Change[] {
  const support = world.things[act.support];
  if (!support)
    return [{ kind: "nothing", because: [], note: "there is nothing there to bear it" }];
  const borne = weight(world, act.bearing);
  if (borne <= strengthOracle(world, support))
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
      source: support.id,
      strength: 4,
      because: ["X2", "E9"],
      note: "a crack as it goes",
    },
    // What it held comes down with it, and a body that falls is hurt by its own weight.
    ...act.bearing.flatMap((id): Change[] => {
      const body = world.bodies[id];
      if (!body) return [];
      const heavy = world.elements[body.element ?? ""]?.props.mass ?? 3;
      const depth = Math.min(5, heavy * 0.5);
      return [
        {
          kind: "wound",
          body: id,
          wound: { depth, bleeding: depth * 0.3, burned: 0 },
          because: ["R3", "X1", "X2", "P1", "B3"],
          note: "it falls, and is hurt",
        },
      ];
    }),
  ];
}
