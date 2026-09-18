/**
 * Structured data to words. The judge never sees a number (SPEC.md rule 3) and
 * the player never sees a table, so both read what this file writes. One
 * function renders a claim; `voice` picks who is reading it.
 */
import {
  type Actor,
  type Belief,
  type BeliefSource,
  type Claim,
  type Drive,
  lineage,
  type Minute,
  type World,
} from "@rpg-jev/core";
import { DUSK, PLAYER, SOMEONE } from "./content.ts";

/** Who is reading: the judge (third person throughout) or a listener being spoken to. */
export interface Voice {
  speaker?: string;
  listener?: string;
}

type Ladder = readonly [string, string, string];
const same = (s: string): Ladder => [s, s, s];

/** Severity ladders. `exaggerate_severity` moves a claim one rung to the right. */
const PHRASES: Record<string, Ladder> = {
  was_near: ["{be} hanging about {place}", "went into {place}", "broke into {place}"],
  took: ["borrowed {obj}", "took {obj}", "stole {obj}"],
  hid: [
    "put {obj} away in {place}",
    "hid {obj} in {place}",
    "buried {obj} in {place} to be rid of it",
  ],
  carried_bundle_to: [
    "carried something wrapped in oilcloth down to {place}",
    "sneaked a bundle down to {place}",
    "smuggled stolen goods down to {place}",
  ],
  gambles: [
    "plays at dice now and then",
    "owes money to river gamblers",
    "has been ruined by gambling debts",
  ],
  searched: ["poked about in {obj}", "went through {obj}", "ransacked {obj}"],
  attacked: ["shoved {to}", "struck {to}", "tried to kill {to}"],
  forced: ["was fooling with {obj}", "went at {obj} like a madman", "tried to wreck {obj}"],
  insulted: [
    "spoke sharply to {to}",
    "insulted {to}",
    "heaped filth on {to} in front of the house",
  ],
  threatened: ["leaned on {to}", "threatened {to}", "threatened to kill {to}"],
  forced_latch: same("forced the office window latch with a thin blade and left flour on the sill"),
  found: same("found {obj} in {place}"),
  apron_is_odos: same(
    "is the owner of the floury apron the ledger came wrapped in: {their} initials are stitched in the hem",
  ),
  handed_over: same("handed {obj} over to {to}"),
  showed: same("showed {obj} to {to}"),
  denied_taking: same("swore {they} never touched {obj}"),
  accused: [
    "hinted that {to} took {obj}",
    "accused {to} of taking {obj}",
    "swore that {to} stole {obj}",
  ],
  burned: same("burned {obj}"),
  had_in_pack: same("had {obj} in {their} pack when it was searched"),
  pack_was_clean: same("had nothing of the inn's in {their} pack when it was searched"),
  fled: same("fled the inn into the rain"),
  owes: [
    "owes {to} a little money",
    "owes {to} a season's wages",
    "has run ruinously into debt with {to}",
  ],
  paid_debt: same("paid off what {to} owed"),
  is_in: same("{be} in {place}"),
  slipped: same(
    // Two hops (he knew it was gone, so he knew where it had been) are one too many for
    // the judge, so the event states the second hop. Code does the chaining.
    "came to {to} insisting the stranger had the ledger and must be searched. Nobody had told {them} it had been found, so {they} could only have known it was gone by looking in the place where it was hidden",
  ),
  dodged: same(
    "would not say what {they} carried down to the cellar when {to} asked, and blamed the stranger instead",
  ),
  in_plain_view: same("{be} sitting in {place} in plain view of everyone"),
};

const MOTIVES: Record<string, string> = {
  was_asked: "because Mara asked {them} to",
  struck_first: "after being struck first",
  with_the_key: "letting {themselves} in with the key",
};

/** The world bible states these. The stranger is whoever the player is. */
const THEY = ["they", "their", "them", "themselves"] as const;
const PRONOUNS: Record<string, readonly [string, string, string, string]> = {
  mara: ["she", "her", "her", "herself"],
  tobin: ["he", "his", "him", "himself"],
  odo: ["he", "his", "him", "himself"],
};

export const theirOf = (id: string): string => (PRONOUNS[id] ?? THEY)[1];

/** Standing facts have no "when": nobody "owes a season's wages this afternoon". */
const TIMELESS = ["owes", "gambles", "apron_is_odos"];
export const isTimeless = (claim: Claim) => TIMELESS.includes(claim.predicate);

/** The time phrase for a claim, with its leading space, or nothing for a standing fact. */
export function whenFor(claim: Claim, now: Minute): string {
  return isTimeless(claim) ? "" : ` ${whenWords(claim.when, now)}`;
}

function person(id: string, voice: Voice): "first" | "second" | "third" {
  if (voice.speaker === id) return "first";
  if (voice.listener === id) return "second";
  return "third";
}

export function nameOf(world: World, id: string, voice: Voice = {}): string {
  const who = person(id, voice);
  if (who === "first") return "I";
  if (who === "second") return "you";
  if (id === SOMEONE) return "someone";
  return world.actors[id]?.name ?? id;
}

const OWNED: Record<string, { by: string; noun: string }> = {
  coat: { by: "odo", noun: "coat" },
  markers: { by: "odo", noun: "markers" },
  ledger: { by: "mara", noun: "ledger" },
};

function objectName(world: World, id: string | undefined, voice: Voice): string {
  if (id === undefined) return "it";
  if (world.actors[id]) {
    const who = person(id, voice);
    return who === "first" ? "me" : who === "second" ? "you" : nameOf(world, id);
  }
  // Odo does not say "Odo's coat". Only spoken lines carry a voice, so judge text is unchanged.
  const owner = OWNED[id];
  if (owner && voice.speaker === owner.by) return `my ${owner.noun}`;
  if (owner && voice.listener === owner.by) return `your ${owner.noun}`;
  return world.items[id]?.name ?? id;
}

/** The verb phrase of a claim, without its subject. */
export function verbPhrase(world: World, claim: Claim, voice: Voice = {}): string {
  const ladder = PHRASES[claim.predicate] ?? same(claim.predicate.replaceAll("_", " "));
  const who = person(claim.subject, voice);
  const [they, their, them, themselves] = PRONOUNS[claim.subject] ?? THEY;
  const fill = (text: string) =>
    text
      .replace("{be}", who === "second" ? "were" : "was")
      .replace("{they}", who === "third" ? they : who === "first" ? "I" : "you")
      .replace("{their}", who === "third" ? their : who === "first" ? "my" : "your")
      .replace("{them}", who === "third" ? them : who === "first" ? "me" : "you")
      .replace(
        "{themselves}",
        who === "third" ? themselves : who === "first" ? "myself" : "yourself",
      )
      .replace("{obj}", objectName(world, claim.object, voice))
      .replace("{to}", objectName(world, claim.to, voice))
      .replace("{place}", claim.place ? (world.rooms[claim.place]?.name ?? claim.place) : "there");
  const motive = claim.motive ? ` ${fill(MOTIVES[claim.motive] ?? "")}` : "";
  return `${fill(ladder[claim.severity - 1] ?? ladder[0])}${motive}`;
}

/** "Odo carried something ... down to the cellar", in the given voice. */
export function claimClause(world: World, claim: Claim, voice: Voice = {}): string {
  return `${nameOf(world, claim.subject, voice)} ${verbPhrase(world, claim, voice)}`;
}

export function whenWords(when: Minute, now: Minute): string {
  if (when <= DUSK - 60) return "this afternoon";
  if (when <= DUSK + 15) return "at dusk";
  const ago = now - when;
  if (ago < 8) return "just now";
  if (ago < 40) return "a short while ago";
  if (ago < 100) return "an hour or so ago";
  return "earlier this evening";
}

export function credenceWords(credence: number): string {
  if (credence >= 0.9) return "is certain of it";
  if (credence >= 0.65) return "thinks it likely";
  if (credence >= 0.4) return "half believes it";
  if (credence >= 0.15) return "doubts it";
  return "does not believe it";
}

export function sourceWords(world: World, source: BeliefSource | undefined): string {
  if (!source || source.kind === "inferred") return "own account, not seen by anyone else";
  if (source.kind === "witnessed") return "saw it first hand";
  const from = source.from === PLAYER ? "the stranger" : nameOf(world, source.from);
  return source.kind === "shown" ? `${from} showed the proof` : `${from} said so`;
}

/** A belief as one line of judge state. */
export function beliefLine(world: World, belief: Belief): string {
  const { claim, edge } = belief;
  const tail = `${sourceWords(world, edge.source)}; ${credenceWords(belief.credence)}`;
  return `${cap(claimClause(world, claim))}${whenFor(claim, world.clock)} (${tail})`;
}

const STANCE: Record<string, string> = {
  hostile: "hostile; wants the stranger gone",
  wary: "wary; does not trust the stranger",
  curious: "open; willing to hear the stranger out",
  indebted: "grateful; feels they owe the stranger",
  loyal: "trusting; on the stranger's side",
};

const level = (n: number) => (n >= 0.7 ? "high" : n >= 0.4 ? "some" : "little");

export function feelingWords(actor: Actor, stance: string | undefined): string {
  const drives: Drive[] = ["trust", "fear", "suspicion"];
  const detail = drives.map((d) => `${level(actor.drives[d])} ${d}`).join(", ");
  return `${STANCE[stance ?? "wary"] ?? stance} (${detail})`;
}

export const ACTIVITY: Record<string, string> = {
  idle: "doing nothing in particular",
  tending_bar: "tending the bar",
  checking_kitchen: "looking in on the kitchen",
  cooking: "cooking at the hearth",
  serving_stew: "carrying bowls of stew round the tables",
  clearing_tables: "clearing the tables",
  tending_horses: "seeing to the horses",
  bringing_firewood: "bringing in firewood",
  eating: "eating supper",
  searching_pack: "come to search the stranger's pack",
  testifying: "come to say something to Mara",
  confronting: "come to have words with Odo",
  searching_cellar: "going through the cellar with a lantern",
  checking_cellar: "fetching something from the cellar",
  burning: "feeding the kitchen fire",
  reporting: "come to tell Mara something",
  keeping_clear: "keeping well clear of the stranger",
  answering_call: "come running at the shout",
};

export function timeOfNight(now: Minute): string {
  if (now < 20 * 60) return "early evening";
  if (now < 22 * 60) return "mid-evening";
  if (now < 23 * 60 + 30) return "late evening";
  return "close to midnight";
}

export function clockWords(now: Minute): string {
  const h = Math.floor(now / 60) % 24;
  const m = now % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

/** How a claim changed on its way here, for `why` and for tests. */
export function driftWords(world: World, claim: Claim): string[] {
  const chain = lineage(world, claim.id);
  return chain.slice(1).map((c) => (c.distortion ?? "retold").replaceAll("_", " "));
}

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
