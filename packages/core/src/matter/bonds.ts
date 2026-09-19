/**
 * What bears on a choice and is not the chooser's own body: whom it holds dear, where it
 * keeps, how the ground lies, what is done here and who is watching. Each is a structure the
 * world keeps, and what follows from it is derived here. None of it names a kind of creature:
 * a mother is a body with bonds of some weight to bodies that cannot fend for themselves, and
 * everything a mother does differently follows from that.
 */
import type { Need } from "../types.ts";
import { able } from "./living.ts";
import type { Body, Bond, MatterWorld } from "./types.ts";

export const apart = (
  a: readonly [number, number] | undefined,
  b: readonly [number, number] | undefined,
) => (a && b ? Math.hypot(a[0] - b[0], a[1] - b[1]) : 0);

/** Whom this body holds dear, strongest first. */
export function bondsOf(world: MatterWorld, id: string): Bond[] {
  return (world.bonds ?? []).filter((b) => b.from === id).sort((a, b) => b.weight - a.weight);
}

/** How dear `to` is to `from`, 0 to 5. Nothing, to a stranger. */
export function bondTo(world: MatterWorld, from: string, to: string): number {
  return Math.max(0, ...bondsOf(world, from).map((b) => (b.to === to ? b.weight : 0)));
}

/** Bound either way: neither is a stranger to the other. */
export const bound = (world: MatterWorld, a: string, b: string) =>
  bondTo(world, a, b) > 0 || bondTo(world, b, a) > 0;

/** It cannot go and get what it needs: too slow or too weak, by its row and its state. */
export function cannotCome(world: MatterWorld, body: Body): boolean {
  const can = able(world, body);
  return can.speed <= 1 || can.strength <= 0;
}

export interface Felt {
  need: Need;
  /** Whose need it is: its own id, or a ward's. */
  whose: string;
  urgency: number;
}

/**
 * The needs that move this body, most urgent first: its own, and those of whom it holds dear,
 * by the weight of the bond. A bond never carries more than the ward's own need.
 */
export function feltNeeds(world: MatterWorld, body: Body): Felt[] {
  const felt: Felt[] = [];
  for (const [need, level] of Object.entries(body.needs) as [Need, number][])
    if (level > 0) felt.push({ need, whose: body.id, urgency: level });
  for (const bond of bondsOf(world, body.id)) {
    const ward = world.bodies[bond.to];
    if (!ward) continue;
    for (const [need, level] of Object.entries(ward.needs) as [Need, number][]) {
      const urgency = level * Math.min(1, bond.weight / 5);
      if (urgency > 0) felt.push({ need, whose: ward.id, urgency });
    }
  }
  return felt.sort((a, b) => b.urgency - a.urgency || a.whose.localeCompare(b.whose));
}

/** No way out: the ground is a row of the place. */
export const cornered = (world: MatterWorld, body: Body) =>
  (world.places[body.place]?.exits ?? 5) <= 0;

/** How far it is from the place it keeps. Nothing, for one that keeps no place. */
export function fromHome(body: Body): number | null {
  if (!body.home || body.home.place !== body.place) return null;
  return apart(body.where, body.home.where);
}

/** Custom gives `a` the first turn over `b` here: both have a standing, and they are bound. */
export function precedes(world: MatterWorld, a: Body, b: Body, over: "food" | "place" | "word") {
  const customs = world.places[a.place]?.customs ?? [];
  if (!customs.some((c) => c.over === over && c.first === "rank")) return false;
  if (a.rank === undefined || b.rank === undefined || !bound(world, a.id, b.id)) return false;
  return a.rank > b.rank;
}

/** Who could see what this body does now: those who have noticed it. Derived from sensing. */
export function witnesses(world: MatterWorld, body: Body): string[] {
  return Object.values(world.bodies)
    .filter((b) => b.id !== body.id && body.id in (b.aware ?? {}))
    .map((b) => b.id)
    .sort();
}
