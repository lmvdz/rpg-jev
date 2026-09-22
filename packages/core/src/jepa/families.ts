/**
 * Families of interaction, by code predicate (SPEC section 16, milestone J). The withheld
 * families (b) are never trained on; the gap (c) is where the engine's own domain gate declines
 * an act it admits. Both are decided from the world before the act and the act itself, plus,
 * for the gap, which gate the engine reports; never from a label.
 */
import { containerOf, contentsOf } from "../matter/contain.ts";
import { isLiquid } from "../matter/effective.ts";
import { COAT_SPREADS, SOAK_WETS } from "../matter/graph/soak-rules.ts";
import type { Act } from "../matter/resolve.ts";
import type { Change, MatterWorld, Thing } from "../matter/types.ts";

export const FAMILIES = ["B1", "B2", "B3"] as const;
export type Family = (typeof FAMILIES)[number];

const flows = (world: MatterWorld, id: string | undefined): boolean => {
  const thing = id === undefined ? undefined : world.things[id];
  if (!thing) return false;
  return isLiquid(world, thing) || !!world.elements[thing.element]?.forms.includes("gas");
};

const burning = (world: MatterWorld, id: string | undefined): boolean =>
  !!(id !== undefined && world.things[id]?.state.burning);

/** B2: a burning thing is in a container, or a container holding something burns. */
function fireContained(world: MatterWorld): boolean {
  return Object.values(world.things).some(
    (t: Thing) =>
      !!t.state.burning && (!!containerOf(world, t) || contentsOf(world, t.id).length > 0),
  );
}

const PREDICATES: Record<Family, (world: MatterWorld, act: Act) => boolean> = {
  /** Heat × liquid: a heat act whose source or target is a liquid. */
  B1: (w, a) => a.process === "heat" && (flows(w, a.source) || flows(w, a.target)),
  /** Containment × fire: fire in or around a container, or put into or taken out of one. */
  B2: (w, a) =>
    fireContained(w) ||
    (a.process === "contain" && (burning(w, a.container) || burning(w, a.thing))),
  /** Force × fire: a strike whose instrument or patient is burning. */
  B3: (w, a) => a.process === "force" && (burning(w, a.instrument) || burning(w, a.patient)),
};

/** The withheld family of a transition, the first that matches, or null. */
export function familyOf(world: MatterWorld, act: Act): Family | null {
  return FAMILIES.find((f) => PREDICATES[f](world, act)) ?? null;
}

const declined = (changes: readonly Change[], note: string) =>
  changes.some((c) => c.kind === "nothing" && c.note === note);

/**
 * The gap (c): an act the engine admits and its domain gate declines. A strike where either
 * party flows, a soak whose liquid does not wet, a coat whose substance does not spread; the
 * parties are present and distinct and the exposure is not zero.
 */
export function isGap(world: MatterWorld, act: Act, changes: readonly Change[]): boolean {
  if (act.process === "force") {
    const present = !!world.things[act.instrument] && !!world.things[act.patient];
    return (
      present &&
      act.instrument !== act.patient &&
      (flows(world, act.instrument) || flows(world, act.patient)) &&
      declined(changes, "nothing comes of it")
    );
  }
  if (act.process === "soak")
    return (
      !!world.things[act.liquid] &&
      !!world.things[act.target] &&
      act.liquid !== act.target &&
      act.amount > 0 &&
      declined(changes, SOAK_WETS.otherwise.note)
    );
  if (act.process === "coat")
    return (
      !!world.things[act.substance] &&
      !!world.things[act.target] &&
      act.substance !== act.target &&
      (act.amount ?? 1) > 0 &&
      declined(changes, COAT_SPREADS.otherwise.note)
    );
  return false;
}
