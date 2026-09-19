/**
 * What feeds whom. A food's row says what fare it is; an eater's row says how well each fare
 * feeds it, 0 to 5. What this eater gets from that food is the one function here, and everything
 * that asks whether something is food (eating, what is offered, what is attended to, what the
 * judge is told, what counts as provided) asks it. Nothing built before diet changes: a food of
 * no fare feeds anyone, and an eater whose row says nothing eats anything.
 *
 * What lives is food too, to what eats its fare: prey is a body whose row would feed the eater.
 */
import type { Need } from "../types.ts";
import { bound } from "./bonds.ts";
import { able } from "./living.ts";
import type { Body, MatterWorld } from "./types.ts";

/** How well this eater takes that element, 0 to 1. */
export function relish(world: MatterWorld, eater: Body, element: string): number {
  const fare = world.elements[element]?.fare;
  const eats = world.elements[eater.element ?? ""]?.body?.eats;
  if (!(fare && eats)) return 1;
  return Math.min(1, Math.max(0, (eats[fare] ?? 0) / 5));
}

/** What this eater gets from one measure of that element: never more than the row gives. */
export function feeds(
  world: MatterWorld,
  eater: Body,
  element: string,
): Partial<Record<Need, number>> {
  const serves = world.elements[element]?.serves ?? {};
  const taken = relish(world, eater, element);
  const out: Partial<Record<Need, number>> = {};
  for (const [need, gives] of Object.entries(serves) as [Need, number][])
    out[need] = gives > 0 ? gives * taken : gives;
  return out;
}

/**
 * How much that body would feed this one, as quarry: what would feed it, is not of its own
 * kind nor bound to it, and is not much the stronger. Nothing, otherwise.
 */
export function preyTo(world: MatterWorld, eater: Body, other: Body): number {
  if (eater.element === other.element || bound(world, eater.id, other.id)) return 0;
  if (able(world, other).strength - able(world, eater).strength >= 1) return 0;
  return Math.max(0, feeds(world, eater, other.element ?? "").hunger ?? 0);
}
