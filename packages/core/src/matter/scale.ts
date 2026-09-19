/**
 * One concept, one function. Batch C found two rules reading the same thing and meaning
 * different things by it: a cord was thin to a cut and long to a load, a level of mass was a
 * doubling in one place and nothing in another, and a found thing was born dry where a
 * scattered one was born moist. Whatever more than one rule needs to know lives here, once.
 */
import type { Form, MatterWorld, Thing, ThingState } from "./types.ts";
import { FRESH } from "./types.ts";

/** How much a level of mass stands for. A level is a step of four: a boulder is many pots. */
export function quantity(level: number): number {
  return 4 ** level;
}

/** The level that some quantity stands for: the inverse of `quantity`. */
export function levelOf(amount: number): number {
  return amount > 0 ? Math.log(amount) / Math.log(4) : 0;
}

/** Whether a form is thin everywhere: it is crossed at once by a cut, and bears in tension. */
export function thin(forms: readonly Form[]): boolean {
  return forms.includes("sheet") || forms.includes("cord");
}

/**
 * The dimension that matters to a cut and to a load alike: nothing for a sheet or a cord, the
 * thin way across a plank or a pole, and the whole size of a lump.
 */
export function section(forms: readonly Form[], size: number): number {
  if (thin(forms)) return 0;
  if (forms.includes("long") || forms.includes("flat")) return Math.max(0, size - 2);
  return size;
}

/**
 * The dimension a standing load has to cross. A pole or a plank spans, and bears across its
 * thin way. A slab or a sheet of ice lies on what is under it, and bears by how much of it
 * there is. What is thin everywhere bears in tension, and has no section at all.
 */
export function bearing(forms: readonly Form[], size: number): number {
  if (thin(forms)) return 0;
  return forms.includes("long") ? Math.max(0, size - 2) : size;
}

/** A thing as it is when it comes into being: as wet as its element is moist, and otherwise fresh. */
export function born(
  world: MatterWorld,
  thing: { id: string; element: string; place: string; where?: readonly [number, number] },
  set: Partial<ThingState> = {},
): Thing {
  const moist = world.elements[thing.element]?.moist ?? 0;
  return { ...thing, state: { ...FRESH, wetness: moist, ...set } };
}
