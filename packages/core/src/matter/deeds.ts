/**
 * A deed is an act as others take it: who did what to whom, and how grave it was. It is
 * derived from the act and its changes, never declared, and it moves feelings by what was
 * done: in the one it was done to, in whoever saw it done to someone dear (by the weight of
 * the bond), and a little in whoever merely saw. A kind of deed is a row in `DEEDS`. No row
 * knows who anybody is, so a stone thrown at a pup angers its mother without the word mother.
 *
 * Feelings fade by half-lives, in closed form, so the hours may be cut anywhere.
 */
import { apart, bondTo } from "./bonds.ts";
import { feeds } from "./diet.ts";
import type { Act } from "./resolve.ts";
import type { Body, Change, Feeling, MatterWorld } from "./types.ts";
import { clamp } from "./types.ts";

export interface Deed {
  kind: string;
  by: string;
  to: string;
  /** 0 to 5. */
  severity: number;
}

interface DeedRow {
  kind: string;
  /** Whether this act was this deed, and how grave. */
  of: (world: MatterWorld, act: Act, changes: readonly Change[]) => Omit<Deed, "kind"> | null;
  /** What each point of severity moves: in who suffered it, who is bound to them, who saw. */
  suffered: Feeling;
  bound: Feeling;
  seen: Feeling;
  note: string;
}

const NOTHING: Feeling = { fear: 0, anger: 0, trust: 0 };

export const DEEDS: readonly DeedRow[] = [
  {
    kind: "harmed",
    of: (world, act, changes) => {
      if (act.process !== "force" || !act.by || !(act.patient in world.bodies)) return null;
      const depth = changes.reduce((d, c) => (c.kind === "wound" ? d + c.wound.depth : d), 0);
      // To be struck at is a deed, whether or not it told.
      return { by: act.by, to: act.patient, severity: clamp(1 + depth) };
    },
    suffered: { fear: 0.8, anger: 0.6, trust: -1 },
    bound: { fear: 0.3, anger: 1, trust: -1 },
    seen: { fear: 0.3, anger: 0, trust: -0.3 },
    note: "it will not forget who did that",
  },
  {
    kind: "provided",
    of: (world, act) => {
      if (act.process !== "take" || !act.drop) return null;
      const thing = world.things[act.thing];
      // Set down beside someone who needed it: the nearest such is who it was for.
      const near = Object.values(world.bodies)
        .filter((b) => b.id !== act.body && b.place === thing?.place)
        .filter((b) => apart(b.where, thing?.where) <= 2)
        .filter((b) => {
          const gets = Object.entries(feeds(world, b, thing?.element ?? ""));
          return gets.some(([need, gives]) => gives > 0 && needOf(b, need) >= 2);
        })
        .sort((a, b) => a.id.localeCompare(b.id))[0];
      return near ? { by: act.body, to: near.id, severity: 2 } : null;
    },
    suffered: { fear: -0.3, anger: -0.3, trust: 0.6 },
    bound: { fear: 0, anger: -0.2, trust: 0.4 },
    seen: NOTHING,
    note: "it will remember who brought that",
  },
];

const needOf = (body: Body, need: string) => (body.needs as Record<string, number>)[need] ?? 0;

/** The deeds this act was, as anyone would take it. */
export function deedsOf(world: MatterWorld, act: Act, changes: readonly Change[]): Deed[] {
  return DEEDS.flatMap((row) => {
    const deed = row.of(world, act, changes);
    return deed && deed.severity > 0 ? [{ kind: row.kind, ...deed }] : [];
  });
}

/** How much of a deed reaches this body, as the feeling each point of severity moves. */
function taken(world: MatterWorld, row: DeedRow, deed: Deed, body: Body): Feeling | null {
  if (body.id === deed.by) return null;
  if (body.id === deed.to) return row.suffered;
  const aware = body.aware ?? {};
  if (!(deed.by in aware || deed.to in aware)) return null;
  const dear = bondTo(world, body.id, deed.to) / 5;
  const mix = (key: keyof Feeling) => row.seen[key] + row.bound[key] * dear;
  return { fear: mix("fear"), anger: mix("anger"), trust: mix("trust") };
}

function moved(was: Feeling | undefined, by: Feeling, severity: number): Feeling {
  const from = was ?? NOTHING;
  return {
    fear: clamp(from.fear + by.fear * severity),
    anger: clamp(from.anger + by.anger * severity),
    trust: clamp(from.trust + by.trust * severity, -5, 5),
  };
}

/** What an act does to how everyone who took it in feels toward whoever did it. */
export function felt(world: MatterWorld, act: Act, changes: readonly Change[]): Change[] {
  const out: Change[] = [];
  for (const deed of deedsOf(world, act, changes)) {
    const row = DEEDS.find((r) => r.kind === deed.kind);
    if (!row) continue;
    for (const body of Object.values(world.bodies)) {
      const by = taken(world, row, deed, body);
      if (!by) continue;
      const feels = { ...body.feels, [deed.by]: moved(body.feels?.[deed.by], by, deed.severity) };
      out.push({
        kind: "body",
        body: body.id,
        set: { feels },
        because: ["B6", "E8", "E9"],
        note: row.note,
        quiet: true,
      });
    }
  }
  return out;
}

/** Minutes for a feeling to halve: fear outlasts anger, and trust outlasts both. */
const HALF_LIFE: Feeling = { fear: 60 * 24 * 4, anger: 60 * 24 * 2, trust: 60 * 24 * 30 };

/** What is left of what it feels after so many minutes. What has faded to nothing is dropped. */
export function faded(feels: Record<string, Feeling>, minutes: number): Record<string, Feeling> {
  const out: Record<string, Feeling> = {};
  for (const [id, f] of Object.entries(feels)) {
    const left = (key: keyof Feeling) => f[key] * 0.5 ** (minutes / HALF_LIFE[key]);
    const next = { fear: left("fear"), anger: left("anger"), trust: left("trust") };
    if (Math.abs(next.fear) + Math.abs(next.anger) + Math.abs(next.trust) >= 0.05) out[id] = next;
  }
  return out;
}
