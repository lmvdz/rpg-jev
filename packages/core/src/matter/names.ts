/**
 * What a body calls what it has noticed, in words the judge can read: the row's name, and
 * "another" and "a third" when there are several alike. Ids never reach the judge as names.
 */
import type { Body, MatterWorld } from "./types.ts";

const FURTHER = ["another", "a third", "a fourth", "a fifth", "a sixth", "yet another"];

const bare = (name: string) => name.replace(/^(a|an|the) /, "");

export function nameOf(world: MatterWorld, id: string): string {
  const thing = world.things[id];
  if (thing) return world.elements[thing.element]?.name ?? "something";
  return world.elements[world.bodies[id]?.element ?? ""]?.name ?? "someone";
}

/** A word for everything this body has noticed, and for those it is bound to. */
export function handles(world: MatterWorld, body: Body): Record<string, string> {
  const bonded = (world.bonds ?? []).filter((b) => b.from === body.id).map((b) => b.to);
  const ids = [...new Set([...Object.keys(body.aware ?? {}), ...bonded])].sort();
  const seen = new Map<string, number>();
  const out: Record<string, string> = {};
  for (const id of ids) {
    const name = nameOf(world, id);
    const n = seen.get(name) ?? 0;
    seen.set(name, n + 1);
    const further = FURTHER[Math.min(n, FURTHER.length) - 1];
    out[id] = further ? `${further} ${bare(name)}` : name;
  }
  return out;
}
