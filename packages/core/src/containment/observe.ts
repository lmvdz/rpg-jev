import { decodeContainmentState } from "./decode.ts";
import { accessible, nearby, touched } from "./resolve.ts";
import type { Action, Option, State, View, VisibleHolder } from "./types.ts";

function byId(a: { id: string }, b: { id: string }): number {
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}

/** Throws for an unknown observer. No catalogue or other actors' possessions escapes. */
export function observableContainment(state: State, actorId: string): View {
  const snapshot = decodeContainmentState(state);
  const actor = snapshot.actors.find((a) => a.id === actorId);
  if (!actor) throw new Error("Unknown containment observer");
  const holders: VisibleHolder[] = [];
  for (const holder of snapshot.holders) {
    const visible =
      holder.placement.kind === "held"
        ? holder.placement.actor === actor.id
        : nearby(actor, holder.placement, 6);
    if (!visible) continue;
    const { contents, ...row } = holder;
    if (!holder.open) holders.push(row);
    else if (contents) {
      const material = snapshot.materials.find((m) => m.id === contents.material);
      if (material) holders.push({ ...row, contents: { ...contents, label: material.label } });
    } else holders.push({ ...row, contents: null });
  }
  return { actor, holders: holders.sort(byId) };
}

function transfers(source: VisibleHolder, destination: VisibleHolder): Action[] {
  if (
    source.id === destination.id ||
    !source.open ||
    !destination.open ||
    !source.contents ||
    destination.contents === undefined
  )
    return [];
  if (destination.contents && destination.contents.material !== source.contents.material) return [];
  const maximum = Math.min(
    source.contents.quantityMl,
    destination.capacityMl - (destination.contents?.quantityMl ?? 0),
  );
  return [...new Set([100, 250, 1000, maximum])]
    .filter((quantity) => quantity > 0 && quantity <= maximum)
    .map((quantityMl) => ({
      kind: "transfer",
      source: source.id,
      destination: destination.id,
      quantityMl,
    }));
}

function holderActions(view: View, holder: VisibleHolder): Action[] {
  const actions: Action[] = [{ kind: "opening", holder: holder.id, open: !holder.open }];
  if (holder.placement.kind === "held") {
    for (let x = view.actor.x - 1; x <= view.actor.x + 1; x++) {
      for (let z = view.actor.z - 1; z <= view.actor.z + 1; z++) {
        if (Math.abs(x) <= 1_000_000_000 && Math.abs(z) <= 1_000_000_000) {
          actions.push({ kind: "place", holder: holder.id, x, z });
        }
      }
    }
  } else if (
    holder.portable &&
    view.holders.filter((h) => h.placement.kind === "held").length < view.actor.carrySlots
  ) {
    actions.push({ kind: "take", holder: holder.id });
  }
  return actions;
}

export const MAX_OPTIONS = 1024;

function* offeredActions(view: View): Generator<Action> {
  const holders = view.holders.filter((h) => accessible(view.actor, h)).sort(byId);
  yield { kind: "none" };
  for (const [dx, dz] of [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ] as const) {
    const x = view.actor.x + dx;
    const z = view.actor.z + dz;
    if (Math.abs(x) <= 1_000_000_000 && Math.abs(z) <= 1_000_000_000) yield { kind: "move", x, z };
  }
  for (const holder of holders) yield* holderActions(view, holder);
  for (const source of holders) {
    for (const destination of holders) yield* transfers(source, destination);
  }
}

/**
 * A bounded menu of offered choices, not every legal choice at extreme density.
 * Stable view order, none first, basic actions before transfers; future focus/paging
 * can expose further choices. Stop generating immediately when the menu is full.
 * Movement/placement terrain policies are rechecked on commit, not inferred here.
 */
export function buildContainmentOptions(view: View): Option[] {
  const versions = new Map(view.holders.map((h) => [h.id, h.version]));
  const options: Option[] = [];
  for (const action of offeredActions(view)) {
    const entries: [string, number][] = [[view.actor.id, view.actor.version]];
    for (const id of touched(action)) {
      const version = versions.get(id);
      if (version !== undefined) entries.push([id, version]);
    }
    options.push({ action, versions: Object.fromEntries(entries) });
    if (options.length === MAX_OPTIONS) break;
  }
  return options;
}
