/**
 * One scenario as training rows (milestone J, P4). A scene's things become rows of features,
 * before and after, and each thing becomes a sample that points at rows: itself, and up to eight
 * related things before and after. Python rebuilds each observation from these pieces exactly as
 * `observe` builds it (`assemble` below is that rebuild, and a test holds the two equal), so the
 * data is a few hundred bytes a sample rather than the full 720-wide vector twice.
 */
import * as jepa from "@rpg-jev/core/jepa";
import * as matter from "@rpg-jev/core/matter";

type Thing = matter.Thing;
type MatterWorld = matter.MatterWorld;

/** The view of a state on its own: no act, no roles, no time. The JEPA target is seen through it. */
export const AT_REST: jepa.ActView = { process: "tick", roles: {}, minutes: 0 };

export const THING_WIDTH = jepa.THING_FEATURES.length;
/** A row: the thing before, the thing after, and whether it is gone after. */
export const ROW_WIDTH = 2 * THING_WIDTH + 1;
export const N = jepa.NEIGHBOURS;
export const PLACE_WIDTH = jepa.PLACE_FEATURES.length;
export const ACT_WIDTH = jepa.ACT_FEATURES.length;

export const FAMILY_CODES = { none: 0, B1: 1, B2: 2, B3: 3 } as const;

export interface Sample {
  self: number;
  neighbours: number[];
  postNeighbours: number[];
  relation: number[];
  role: number[];
  postRelation: number[];
  distance: number[];
  postDistance: number[];
  place: number[];
  postPlace: number[];
  act: number[];
  label: number[];
  legal: number;
  process: number;
  selfRole: number;
}

export interface Encoded {
  seed: number;
  family: number;
  gap: boolean;
  rows: Float64Array[];
  samples: Sample[];
  /** Samples whose engine outcome the envelope did not hold: must be zero. */
  uncovered: number;
}

const byId = (a: Thing, b: Thing) => (a.id < b.id ? -1 : 1);

export function legalMask(set: jepa.Legal): number {
  let mask = 0;
  jepa.CHANNELS.forEach((channel, i) => {
    channel.classes.forEach((_, k) => {
      if (set[i]?.[k]) mask |= 1 << ((jepa.CLASS_OFFSETS[i] ?? 0) + k);
    });
  });
  return mask >>> 0;
}

function rowOf(before: MatterWorld, after: MatterWorld, thing: Thing): Float64Array {
  const row = new Float64Array(ROW_WIDTH);
  row.set(jepa.thingFeatures(before, thing), 0);
  const post = after.things[thing.id];
  if (post) row.set(jepa.thingFeatures(after, post), THING_WIDTH);
  else row[ROW_WIDTH - 1] = 1;
  return row;
}

/** What is related to a thing after the act, among the things that were there before. */
export function postRelated(after: MatterWorld, thing: Thing, before: MatterWorld) {
  const known = Object.values(after.things).filter((t) => before.things[t.id]);
  return jepa.relatedTo(after, thing, {}, known);
}

interface Pieces {
  index: ReadonlyMap<string, number>;
  related: readonly jepa.Related[];
  roles: Readonly<Record<string, jepa.Role>>;
}

function neighbourColumns({ index, related, roles }: Pieces) {
  const rows: number[] = [];
  const relation: number[] = [];
  const role: number[] = [];
  const distance: number[] = [];
  for (let i = 0; i < N; i++) {
    const r = related[i];
    rows.push(r ? (index.get(r.thing.id) ?? -1) : -1);
    relation.push(r ? jepa.RELATIONS.indexOf(r.relation) : 0);
    role.push(r ? jepa.ROLES.indexOf(roles[r.thing.id] ?? "bystander") : 0);
    distance.push(r ? Math.min(1, r.distance / jepa.NEAR) : 0);
  }
  return { rows, relation, role, distance };
}

function sampleOf(
  s: jepa.Scenario,
  after: MatterWorld,
  thing: Thing,
  index: ReadonlyMap<string, number>,
): { sample: Sample; covered: boolean } {
  const related = jepa.relatedTo(s.world, thing, s.view.roles);
  const legal = jepa.legal(s.world, thing, s.view, related);
  const label = jepa.classify(thing, after.things[thing.id]);
  const pre = neighbourColumns({ index, related, roles: s.view.roles });
  const postThing = after.things[thing.id];
  const post = postThing
    ? neighbourColumns({ index, related: postRelated(after, postThing, s.world), roles: {} })
    : neighbourColumns({ index, related: [], roles: {} });
  const role = s.view.roles[thing.id] ?? "bystander";
  return {
    covered: jepa.isLegal(legal, label),
    sample: {
      self: index.get(thing.id) ?? -1,
      neighbours: pre.rows,
      postNeighbours: post.rows,
      relation: pre.relation,
      role: pre.role,
      postRelation: post.relation,
      distance: pre.distance,
      postDistance: post.distance,
      place: jepa.placeFeatures(s.world, thing),
      postPlace: postThing ? jepa.placeFeatures(after, postThing) : new Array(PLACE_WIDTH).fill(0),
      act: jepa.actFeatures(s.view, role),
      label: [...label],
      legal: legalMask(legal),
      process: jepa.PROCESSES.indexOf(s.view.process),
      selfRole: jepa.ROLES.indexOf(role),
    },
  };
}

/** Encode one scenario on the engine. Gap scenes are encoded too: their labels are not used. */
export function encodeScene(s: jepa.Scenario): Encoded {
  const outcome = matter.resolve(s.world, s.act);
  const things = Object.values(s.world.things).sort(byId);
  const index = new Map(things.map((t, i) => [t.id, i] as const));
  const family = jepa.familyOf(s.world, s.act);
  let uncovered = 0;
  const samples = things.map((thing) => {
    const { sample, covered } = sampleOf(s, outcome.world, thing, index);
    if (!covered) uncovered++;
    return sample;
  });
  return {
    seed: s.seed,
    family: family ? FAMILY_CODES[family] : 0,
    gap: jepa.isGap(s.world, s.act, outcome.changes),
    rows: things.map((t) => rowOf(s.world, outcome.world, t)),
    samples,
    uncovered,
  };
}

const oneHot = (n: number, k: number) => Array.from({ length: n }, (_, i) => (i === k ? 1 : 0));

/**
 * The observation rebuilt from the pieces, as the trainer rebuilds it: the before view when
 * `post` is false, the after view (at rest) when it is true.
 */
export function assemble(rows: readonly Float64Array[], s: Sample, post = false): Float64Array {
  const out: number[] = [];
  const part = (row: Float64Array | undefined) =>
    row ? [...row.subarray(post ? THING_WIDTH : 0, post ? 2 * THING_WIDTH : THING_WIDTH)] : [];
  out.push(...part(rows[s.self]));
  out.push(...(post ? s.postPlace : s.place));
  out.push(...(post ? jepa.actFeatures(AT_REST, "bystander") : s.act));
  const nb = post ? s.postNeighbours : s.neighbours;
  for (let i = 0; i < N; i++) {
    const r = nb[i] ?? -1;
    if (r < 0) {
      out.push(...new Array(jepa.NEIGHBOUR_FEATURES.length).fill(0));
      continue;
    }
    out.push(1);
    out.push(...oneHot(jepa.RELATIONS.length, (post ? s.postRelation : s.relation)[i] ?? 0));
    out.push((post ? s.postDistance : s.distance)[i] ?? 0);
    out.push(...oneHot(jepa.ROLES.length, post ? 0 : (s.role[i] ?? 0)));
    out.push(...part(rows[r]));
  }
  return Float64Array.from(out);
}
