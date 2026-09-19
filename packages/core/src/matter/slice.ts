/**
 * The one way a mind's situation reaches the judge. Everything the judge reads about a
 * creature is compiled here from the structures the world keeps, in words: a level becomes
 * the word for that level, a distance the word for that distance, and an id the name the
 * creature would know the thing by. No number reaches the judge (SPEC.md rule 3), and nothing
 * is written by hand per scene. The slice is kept small: the few things that bear most.
 *
 * It says only what this body could know: what it has noticed, whom it is bound to, what it
 * feels, how the ground lies. It does not say what it is offered; the offers are the question.
 */
import { apart, bondsOf, cornered, fromHome, witnesses } from "./bonds.ts";
import { feeds, preyTo } from "./diet.ts";
import { able } from "./living.ts";
import { handles, nameOf } from "./names.ts";
import type { Body, Feeling, MatterWorld } from "./types.ts";

type Words = readonly [string, string, string, string, string, string];

const word = (scale: Words, level: number) =>
  scale[Math.max(0, Math.min(5, Math.round(level)))] ?? scale[0];

const NEED_WORDS: Record<string, Words> = {
  hunger: ["fed", "a little hungry", "hungry", "very hungry", "starving", "starving and weak"],
  rest: ["rested", "fresh enough", "tiring", "tired", "exhausted", "ready to drop"],
  warmth: ["warm", "a little chilled", "cold", "very cold", "frozen through", "dying of cold"],
};
const LEVEL: Words = ["not at all", "slightly", "somewhat", "strongly", "very strongly", "wholly"];
const HEALTH: Words = ["dying", "gravely hurt", "badly hurt", "hurt", "a little hurt", "sound"];
const LIGHT: Words = ["pitch dark", "dark", "dim", "overcast", "daylight", "bright noon"];
const COVER: Words = ["open ground", "sparse cover", "some cover", "brush", "thick brush", "dense"];
const EXITS: Words = [
  "cornered, with no way out",
  "one narrow way out",
  "few ways out",
  "several ways out",
  "open on most sides",
  "open country",
];
const RANK: Words = ["the lowest", "low", "middling", "well up", "high", "the first"];
const MIGHT: Words = ["helpless", "feeble", "weak", "able", "strong", "very strong"];

const FAR: readonly [number, string][] = [
  [1.5, "right here"],
  [6, "a few steps away"],
  [15, "close"],
  [40, "some way off"],
];
const howFar = (gap: number) => FAR.find(([within]) => gap <= within)?.[1] ?? "far off";

/** Needs worth saying: hunger always (fed is a fact too), the rest when above nothing. */
function needsOf(body: Body): string[] {
  return Object.entries({ hunger: 0, ...body.needs })
    .filter(([need, level]) => (level >= 1 || need === "hunger") && need in NEED_WORDS)
    .map(([need, level]) => word(NEED_WORDS[need] ?? LEVEL, level));
}

function feelingOf(f: Feeling | undefined): string[] {
  if (!f) return [];
  const out: string[] = [];
  if (f.fear >= 0.5) out.push(`${word(LEVEL, f.fear)} afraid of it`);
  if (f.anger >= 0.5) out.push(`${word(LEVEL, f.anger)} angry at it`);
  if (f.trust >= 0.5) out.push(`${word(LEVEL, f.trust)} trusting of it`);
  if (f.trust <= -0.5) out.push(`${word(LEVEL, -f.trust)} wary of it`);
  return out;
}

function condition(world: MatterWorld, body: Body): string[] {
  const out = [word(HEALTH, body.health), ...needsOf(body)];
  const bleeding = body.wounds.some((w) => w.bleeding > 0.2);
  if (body.wounds.length > 0) out.push(bleeding ? "wounded and bleeding" : "wounded");
  if ((body.wetness ?? 0) >= 3) out.push("soaked");
  out.push(`${word(MIGHT, able(world, body).strength)} now`);
  return out;
}

const BOND_WORDS: Record<string, string> = {
  young: "its young",
  mate: "its mate",
  kin: "its kin",
  pack: "one of its own",
  keeper: "its keeper",
};

/** How much one thing present bears on the choice: what is dear, feared, or wanted, first. */
function bearing(world: MatterWorld, body: Body, id: string): number {
  const f = body.feels?.[id];
  const dear = bondsOf(world, body.id).find((b) => b.to === id)?.weight ?? 0;
  const fed = feeds(world, body, world.things[id]?.element ?? "").hunger ?? 0;
  const lives = id in world.bodies ? 2 : 0;
  const wanted = fed > 0 ? (body.needs.hunger ?? 0) : 0;
  return dear + (f ? f.fear + f.anger : 0) + lives + wanted + (body.aware?.[id]?.strength ?? 0) / 5;
}

const NOTICED = {
  light: "seen as a light",
  smoke: "seen as smoke",
  sound: "heard",
  scent: "smelled",
  sight: "seen",
};

function presentOf(world: MatterWorld, body: Body, names: Record<string, string>, id: string) {
  const other = world.bodies[id];
  const thing = world.things[id];
  const percept = body.aware?.[id];
  const held = (other?.holds ?? []).map((h) => nameOf(world, h));
  // What it is to this one: food, or prey, or one that would make food of it.
  const food = thing ? (feeds(world, body, thing.element).hunger ?? 0) > 0 : false;
  const prey = other ? preyTo(world, body, other) > 0 : false;
  const hunter = other ? preyTo(world, other, body) > 0 : false;
  const notes = [
    ...(food || prey ? ["would feed it"] : []),
    ...(hunter ? ["would make a meal of it"] : []),
    ...(other ? [`looks ${word(MIGHT, able(world, other).strength)}`, ...woundsSeen(other)] : []),
    ...(held.length > 0 ? [`holding ${held.join(" and ")}`] : []),
    ...(thing?.state.burning ? ["burning"] : []),
    ...((body.holds ?? []).includes(id) ? ["held by it"] : []),
    ...feelingOf(body.feels?.[id]),
  ];
  return {
    what: names[id] ?? "something",
    where: howFar(apart(body.where, (other ?? thing)?.where)),
    noticed: percept ? NOTICED[percept.channel] : "known",
    ...(notes.length > 0 ? { notes } : {}),
  };
}

const woundsSeen = (other: Body) => (other.wounds.length > 0 ? ["wounded"] : []);

/** How many things present are said. */
const SAID = 6;

export function sliceFor(world: MatterWorld, body: Body) {
  const names = handles(world, body);
  const place = world.places[body.place];
  const bonds = bondsOf(world, body.id).flatMap((b) => {
    const ward = world.bodies[b.to];
    if (!ward) return [];
    return [
      {
        who: names[b.to] ?? "one of its own",
        is: BOND_WORDS[b.kind] ?? "its own",
        dear: word(LEVEL, b.weight),
        where: ward.place === body.place ? howFar(apart(body.where, ward.where)) : "elsewhere",
        condition: condition(world, ward),
      },
    ];
  });
  const bonded = new Set(bondsOf(world, body.id).map((b) => b.to));
  const present = Object.keys(body.aware ?? {})
    .filter((id) => !bonded.has(id))
    .sort((a, b) => bearing(world, body, b) - bearing(world, body, a) || a.localeCompare(b))
    .slice(0, SAID)
    .map((id) => presentOf(world, body, names, id));
  const home = fromHome(body);
  const watched = witnesses(world, body).filter((id) => !bonded.has(id));
  return {
    creature: {
      what: nameOf(world, body.id),
      condition: condition(world, body),
      ...(body.doing ? { was_doing: body.doing.replace(/_/g, " ") } : {}),
      ...(home === null ? {} : { the_place_it_keeps: howFar(home) }),
      ...(body.rank === undefined ? {} : { standing_among_its_own: word(RANK, body.rank) }),
    },
    ...(bonds.length > 0 ? { its_own: bonds.slice(0, 4) } : {}),
    present,
    ground: {
      light: word(LIGHT, place?.light ?? 3),
      cover: word(COVER, place?.cover ?? 0),
      ways_out: cornered(world, body) ? EXITS[0] : word(EXITS, place?.exits ?? 5),
      ...((place?.customs ?? []).length > 0
        ? {
            custom_here: (place?.customs ?? []).map((c) => `over ${c.over}, ${c.first} goes first`),
          }
        : {}),
      watched_by: watched.length > 0 ? watched.map((id) => names[id] ?? "someone") : ["nobody"],
    },
  };
}
