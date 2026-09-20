/** Admission for the bounded command-step slice, not validation for every Matter process. */
import { z } from "zod";
import { NEEDS } from "../types.ts";
import type { MatterSession } from "./session.ts";
import { containsTile, openTile } from "./session-terrain.ts";
import { BOND_KINDS, FARES, FORMS, PROPERTY_KEYS } from "./types.ts";

const level = z.number().min(0).max(5);
const nonnegative = z.number().min(0).max(Number.MAX_SAFE_INTEGER);
const id = z
  .string()
  .min(1)
  .refine((value) => !Object.hasOwn(Object.prototype, value));
const tile = z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()]);
const needs = z.partialRecord(z.enum(NEEDS), level);
const bodyRow = z.object({
  strength: level,
  speed: level,
  sight: level,
  hearing: level,
  smell: level,
  eats: z.partialRecord(z.enum(FARES), level).optional(),
});
const element = z.object({
  id,
  name: z.string(),
  kind: z.enum(["material", "thing", "plant", "creature", "person", "place"]),
  forms: z.array(z.enum(FORMS)),
  props: z.partialRecord(z.enum(PROPERTY_KEYS), level),
  serves: z.partialRecord(z.enum(NEEDS), z.number().min(-3).max(3)).optional(),
  moist: level.optional(),
  fare: z.enum(FARES).optional(),
  body: bodyRow.optional(),
});
const body = z.object({
  id,
  place: id,
  where: tile,
  element: id.optional(),
  attention: z.enum(["alert", "distracted", "asleep"]).optional(),
  aware: z
    .record(
      id,
      z.object({
        channel: z.enum(["light", "sound", "scent", "smoke", "sight"]),
        strength: nonnegative,
      }),
    )
    .optional(),
  wetness: level.optional(),
  wears: z.array(id).optional(),
  holds: z.array(id).optional(),
  needs,
  health: level,
  wounds: z.array(z.object({ depth: level, bleeding: level, burned: level })),
  sickness: level,
  sickensIn: nonnegative,
  tolerates: level.optional(),
  home: z.object({ place: id, where: tile.optional() }).optional(),
  feels: z.record(id, z.object({ fear: level, anger: level, trust: level })).optional(),
  rank: level.optional(),
  doing: z.string().optional(),
});
const state = z.object({
  temperature: level,
  wetness: level,
  wetWith: id.nullable(),
  surfaceAbove: level,
  burning: z.object({ of: z.enum(["self", "coating"]), fuel: nonnegative }).nullable(),
  integrity: level,
  edge: level,
  coating: z
    .object({
      element: id,
      amount: nonnegative,
      coverage: z.number().min(0).max(1),
      bond: level,
    })
    .nullable(),
  contamination: level,
  corrosion: level,
  taint: level,
  amount: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  flaw: level,
  temper: level,
  set: z.boolean(),
});
const place = z.object({
  id,
  temperature: level,
  moisture: level,
  wind: level,
  air: level,
  abundance: z.record(id, level),
  searched: z.record(id, z.object({ minutes: nonnegative, found: nonnegative })),
  light: level.optional(),
  noise: level.optional(),
  cover: level.optional(),
  extent: z.number().positive().max(Number.MAX_SAFE_INTEGER).optional(),
  exits: level.optional(),
  customs: z
    .array(z.object({ over: z.enum(["food", "place", "word"]), first: z.literal("rank") }))
    .optional(),
});
const snapshot = z.object({
  version: z.literal(1),
  tick: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  controlled: z.array(id).min(1).max(64),
  autonomous: z.array(id).max(64),
  terrain: z.object({
    place: id,
    width: z.number().int().min(1).max(65536),
    height: z.number().int().min(1).max(65536),
    walkable: z.array(z.boolean()).max(65536),
  }),
  world: z.object({
    elements: z.record(id, element),
    bodies: z.record(id, body),
    things: z.record(id, z.object({ id, element: id, place: id, where: tile, state })),
    places: z.record(id, place),
    bonds: z
      .array(z.object({ from: id, to: id, kind: z.enum(BOND_KINDS), weight: level }))
      .optional(),
    next: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  }),
});

function requireValid(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(`Invalid session: ${message}`);
}

function assertReferences({ world, terrain }: MatterSession): void {
  for (const table of [world.elements, world.places, world.bodies, world.things])
    for (const [key, entity] of Object.entries(table))
      requireValid(key === entity.id, "entity identity");
  for (const thing of Object.values(world.things)) {
    requireValid(world.elements[thing.element], "thing element");
    if (thing.state.wetWith) requireValid(world.elements[thing.state.wetWith], "wetting element");
    if (thing.state.coating)
      requireValid(world.elements[thing.state.coating.element], "coating element");
  }
  for (const body of Object.values(world.bodies)) {
    if (body.element) requireValid(world.elements[body.element], "body element");
    if (body.home)
      requireValid(
        body.home.place === terrain.place &&
          (!body.home.where || containsTile(terrain, body.home.where)),
        "home",
      );
    // Core tolerates missing worn things after depletion; this slice cannot equip them.
    for (const other of Object.keys(body.feels ?? {}))
      requireValid(world.bodies[other], "feeling target");
    requireValid(!world.things[body.id], "ambiguous source identity");
  }
  for (const bond of world.bonds ?? [])
    requireValid(world.bodies[bond.from] && world.bodies[bond.to], "bond endpoints");
}

function assertPossession({ world }: MatterSession): void {
  const held = new Set<string>();
  for (const body of Object.values(world.bodies))
    for (const id of body.holds ?? []) {
      const thing = world.things[id];
      requireValid(thing && !held.has(id) && `${thing.where}` === `${body.where}`, "possession");
      held.add(id);
    }
}

/** Validate before any simulation reads; preserve non-simulation presentation metadata. */
export function assertSession(value: unknown): asserts value is MatterSession {
  snapshot.parse(value);
  const session = value as MatterSession;
  const { world, terrain, controlled, autonomous } = session;
  requireValid(
    terrain.width * terrain.height <= 65536 &&
      terrain.walkable.length === terrain.width * terrain.height &&
      world.places[terrain.place],
    "terrain",
  );
  const actors = [...controlled, ...autonomous];
  requireValid(
    actors.length <= 64 &&
      new Set(actors).size === actors.length &&
      actors.every((actor) => Object.hasOwn(world.bodies, actor)),
    "actors",
  );
  const bodies = Object.values(world.bodies);
  const things = Object.values(world.things);
  requireValid(bodies.length <= 64 && things.length <= 256, "capacity");
  for (const entity of [...bodies, ...things])
    requireValid(
      entity.place === terrain.place && containsTile(terrain, entity.where),
      "entity tile",
    );
  for (const body of bodies) requireValid(openTile(terrain, body.where), "body tile");
  assertReferences(session);
  assertPossession(session);
}
