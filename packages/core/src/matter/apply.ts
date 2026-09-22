/**
 * Only code writes world state (SPEC.md rule 1). Processes return changes; `apply` is the
 * one place a matter world is rewritten. It never mutates: a new world comes back. A kind
 * of change is a row in `APPLIERS`, not an arm of a switch.
 */
import type { Change, MatterWorld } from "./types.ts";

type Table = "things" | "bodies" | "places";

/** One invocation owns its copies; records within them remain immutable. */
class Draft {
  world: MatterWorld;
  readonly original: MatterWorld;

  constructor(world: MatterWorld) {
    this.world = world;
    this.original = world;
  }

  table<K extends Table>(key: K): MatterWorld[K] {
    if (this.world === this.original) this.world = { ...this.world };
    if (this.world[key] === this.original[key]) {
      this.world[key] = { ...this.world[key] };
    }
    return this.world[key];
  }

  put<K extends Table>(table: K, id: string, value: MatterWorld[K][string]): void {
    // Like a computed spread property, this also treats "__proto__" as an id.
    Object.defineProperty(this.table(table), id, {
      value,
      enumerable: true,
      configurable: true,
      writable: true,
    });
  }
}

type Applier<K extends Change["kind"]> = (
  draft: Draft,
  change: Extract<Change, { kind: K }>,
) => void;

const APPLIERS: { [K in Change["kind"]]: Applier<K> } = {
  state: (draft, c) => {
    const thing = draft.world.things[c.thing];
    if (!thing) return;
    const next = { ...thing, state: { ...thing.state, ...c.set } };
    draft.put("things", c.thing, next);
  },
  body: (draft, c) => {
    const body = draft.world.bodies[c.body];
    if (!body) return;
    draft.put("bodies", c.body, { ...body, ...c.set });
  },
  wound: (draft, c) => {
    const body = draft.world.bodies[c.body];
    if (!body) return;
    const next = { ...body, wounds: [...body.wounds, c.wound] };
    draft.put("bodies", c.body, next);
  },
  treat: (draft, c) => {
    const body = draft.world.bodies[c.body];
    if (!body) return;
    const wounds = body.wounds.map((w, i) => (i === c.index ? { ...w, ...c.set } : w));
    draft.put("bodies", c.body, { ...body, wounds });
  },
  // A born thing takes its id from the world's counter, so it can never overwrite another.
  create: (draft, c) => {
    const world = draft.world;
    const id = c.thing.id in world.things ? `${c.thing.id}.${world.next}` : c.thing.id;
    draft.put("things", id, { ...c.thing, id });
    draft.world.next = world.next + 1;
  },
  consume: (draft, c) => {
    const thing = draft.world.things[c.thing];
    if (!(thing && Number.isFinite(c.amount)) || c.amount <= 0) return;
    const left = thing.state.amount - c.amount;
    if (left > 0) {
      const next = { ...thing, state: { ...thing.state, amount: left } };
      draft.put("things", c.thing, next);
      return;
    }
    delete draft.table("things")[c.thing];
    // Deletion historically copies bodies even if nobody held the thing.
    for (const [id, body] of Object.entries(draft.table("bodies"))) {
      if ((body.holds ?? []).includes(c.thing)) {
        draft.put("bodies", id, {
          ...body,
          holds: body.holds?.filter((held) => held !== c.thing) ?? [],
        });
      }
    }
  },
  // What is held goes where its holder goes.
  carried: (draft, c) => {
    const thing = draft.world.things[c.thing];
    if (!thing) return;
    draft.put("things", c.thing, { ...thing, where: c.where });
  },
  // A signal is heard or not by whoever is sensing; it leaves no state of its own here.
  signal: () => undefined,
  // Sensing writes what a body is aware of, and nothing else.
  percept: (draft, c) => {
    const body = draft.world.bodies[c.body];
    if (!body) return;
    draft.put("bodies", c.body, { ...body, aware: c.aware });
  },
  settle: (draft, c) => {
    const place = draft.world.places[c.place];
    if (!place) return;
    const before = place.searched[c.element] ?? { minutes: 0, found: 0 };
    const searched = {
      ...place.searched,
      [c.element]: { minutes: before.minutes + c.minutes, found: before.found + c.found },
    };
    draft.put("places", c.place, { ...place, searched });
  },
  nothing: () => undefined,
};

export function apply(world: MatterWorld, changes: readonly Change[]): MatterWorld {
  const draft = new Draft(world);
  for (const change of changes) {
    const applier = APPLIERS[change.kind] as Applier<typeof change.kind>;
    applier(draft, change);
  }
  return draft.world;
}
