/**
 * Slice schemas for every state the inn sends to the judge (SPEC.md rule 7 and
 * section 13). A slice holds only what its questions need: code ranks and
 * truncates before the judge sees anything, and a test holds each schema to
 * its token budget with every NPC knowing everything.
 */
import { type Belief, beliefIn, beliefsOf, stanceOf, type World } from "@rpg-jev/core";
import type { JsonObject, SliceSchema } from "@rpg-jev/jev";
import { C_ACCUSATION, IMPLICATES, LEDGER_MATTER, MARA, PLAYER, START, TRUST } from "./content.ts";
import { type Scope, scopeOf } from "./parser.ts";
import {
  ACTIVITY,
  beliefLine,
  cap,
  claimClause,
  feelingWords,
  isTimeless,
  nameOf,
  timeOfNight,
  whenWords,
} from "./words.ts";

export const MAX_KNOWS = 8;
export const MAX_EVENTS = 10;
export const MAX_INPUT_CHARS = 240;

export function placeState(world: World): JsonObject {
  return {
    inn: "The Gilded Carp, a roadside inn cut off by a flooded ford",
    time: timeOfNight(world.clock),
    trouble:
      "The inn's account ledger vanished from the office this afternoon. The crown's assessor comes at first light to read it.",
  };
}

/** Beliefs worth putting in front of the judge, best first. `about` pulls matching claims up. */
export function rankedBeliefs(world: World, holder: string, about?: string): Belief[] {
  const score = (b: Belief) => {
    const c = b.claim;
    const mentions = about !== undefined && [c.subject, c.object, c.to, c.place].includes(about);
    const recency = Math.max(0, 3 - (world.clock - b.edge.known_from) / 60);
    return c.severity * 2 + recency + (mentions ? 6 : 0) + b.credence;
  };
  return beliefsOf(world, holder)
    .filter((b) => b.credence >= 0.15 && b.claim.predicate !== "is_in")
    .sort((a, b) => score(b) - score(a) || a.claim.id.localeCompare(b.claim.id));
}

/**
 * How far `holder` trusts `source` right now. The base is stored data; it falls
 * once the holder believes something that implicates the source. Arithmetic, so code.
 */
export function trustIn(world: World, holder: string, source: string): number {
  const base = TRUST[holder]?.[source] ?? 0.5;
  const implicated = beliefsOf(world, holder).some(
    (b) =>
      b.credence >= 0.6 && b.claim.subject === source && IMPLICATES.includes(b.claim.predicate),
  );
  return implicated ? Math.max(0.1, Math.round((base - 0.4) * 100) / 100) : base;
}

/** The same number in words, for the judge. */
export function standing(world: World, holder: string, source: string): string {
  const trust = trustIn(world, holder, source);
  const who = nameOf(world, holder);
  if (trust >= 0.8) return `whose word ${who} trusts`;
  if (trust >= 0.6) return `whom ${who} has no cause to doubt`;
  if (trust >= 0.4) return `whom ${who} is unsure of`;
  return `whom ${who} now has cause to doubt`;
}

export interface NpcPart {
  npc: string;
  about?: string;
  extra: JsonObject;
}

/**
 * A debt is a circumstance for as long as it is owed. The family probe found that
 * Tobin speaks freely or not at all depending on this one line, so it follows the
 * belief: once the debt is paid and the belief retired, the line is gone.
 */
function owing(world: World, npc: string): string[] {
  return beliefsOf(world, npc)
    .filter((b) => b.claim.predicate === "owes" && b.claim.subject === npc && b.credence > 0)
    .map((b) => {
      const to = nameOf(world, b.claim.to ?? "someone");
      return `owes ${to} more money than can be repaid, and is afraid of crossing ${to}`;
    });
}

export function npcState(world: World, part: NpcPart): JsonObject {
  const actor = world.actors[part.npc];
  if (!actor) return {};
  return {
    name: actor.name,
    role: actor.role,
    traits: actor.traits,
    wants: actor.goals,
    circumstances: [...actor.circumstances, ...actor.motives, ...owing(world, part.npc)],
    doing: ACTIVITY[actor.activity] ?? actor.activity,
    feeling_toward_stranger: feelingWords(actor, stanceOf(world, part.npc, PLAYER)),
    knows: rankedBeliefs(world, part.npc, part.about)
      .slice(0, MAX_KNOWS)
      .map((b) => beliefLine(world, b)),
    ...part.extra,
  };
}

export interface SceneCtx {
  world: World;
  parts: NpcPart[];
}

/** One state for a whole scene; each NPC's questions point only at `npcs.<id>` (SPEC.md section 12). */
export const sceneSlice: SliceSchema<SceneCtx> = {
  id: "scene",
  // Three NPCs, eight beliefs each, plus what each hears. Live scenes ran 500 to 1,300.
  budgetTokens: 2400,
  required: (ctx) => ["place.time", ...ctx.parts.map((p) => `npcs.${p.npc}.knows`)],
  build: (ctx) => ({
    place: placeState(ctx.world),
    npcs: Object.fromEntries(ctx.parts.map((p) => [p.npc, npcState(ctx.world, p)])),
  }),
};

export interface ParseCtx {
  world: World;
  text: string;
}

const describe = (scope: Scope) => ({
  people: scope.people.map((p) => ({ id: p.id, description: p.name })),
  things: [
    ...scope.things.map((t) => ({ id: t.id, description: `${t.name} (within reach)` })),
    ...scope.carried.map((t) => ({ id: t.id, description: `${t.name} (carried)` })),
  ],
  exits: scope.exits.map((e) => ({ id: e.id, description: `the way to ${e.name}` })),
});

/** Player text lives in one labeled field and nowhere else (SPEC.md rule 8). */
export const parseSlice: SliceSchema<ParseCtx> = {
  id: "parse",
  budgetTokens: 900,
  required: () => ["scene.people", "scene.things", "player_input.text"],
  // What can be stated or asked about lives in the questions' criteria; repeating it
  // here doubled the tokens of every parse.
  build: (ctx) => {
    const here = ctx.world.actors[PLAYER]?.room ?? "";
    return {
      scene: { room: ctx.world.rooms[here]?.name ?? here, ...describe(scopeOf(ctx.world)) },
      player_input: { text: ctx.text.slice(0, MAX_INPUT_CHARS) },
    };
  },
};

/** How firmly a belief was taken, for a retelling's closing clause. */
function takenWords(credence: number): string {
  if (credence >= 0.65) return "believed it";
  if (credence >= 0.4) return "is now in two minds about it";
  return "has come to doubt it";
}

/** "Tobin told Mara that Odo ... (Mara thinks it likely)" or "Mara saw it herself: ...". */
export function eventLine(world: World, holder: string, belief: Belief): string {
  const { claim, edge } = belief;
  const name = nameOf(world, holder);
  // Coarse time only: "a short while ago" would change the slice hash as the clock
  // moves, and the guard is re-asked whenever its slice changes.
  const coarse = claim.when >= START ? "tonight" : whenWords(claim.when, world.clock);
  const what = `${claimClause(world, claim)}${isTimeless(claim) ? "" : ` ${coarse}`}`;
  const source = edge.source;
  if (!source || source.kind === "witnessed") return `${name} saw it first hand: ${what}`;
  if (source.kind === "inferred") return `${name} concluded that ${what}`;
  // The probe that cleared the witness route said who the teller is to her, that he
  // saw it himself, and that she believed him. Without those the judge sees hearsay.
  const known = source.from === PLAYER ? "" : `, ${standing(world, holder, source.from)},`;
  const from = source.from === PLAYER ? "The stranger" : cap(nameOf(world, source.from));
  const firstHand = beliefIn(world, source.from, claim.id)?.edge.source?.kind === "witnessed";
  const verb =
    source.kind === "shown"
      ? `showed ${name} proof that`
      : `told ${name}${firstHand ? ", as something seen first hand," : ""} that`;
  return `${from}${known} ${verb} ${what}. ${name} ${takenWords(belief.credence)}.`;
}

/**
 * The quest guard's slice. It deliberately leaves out Mara's standing feeling
 * toward the stranger and the accusation itself: the family probe showed that
 * a line restating the accusation is read literally as the answer.
 */
export const guardSlice: SliceSchema<{ world: World }> = {
  id: "guard",
  budgetTokens: 900,
  required: () => ["quest.accusation", "npcs.mara.recent_events", "npcs.mara.knows"],
  build: ({ world }) => {
    const mara = world.actors[MARA];
    const relevant = beliefsOf(world, MARA)
      .filter((b) => b.claim.id !== C_ACCUSATION.id && LEDGER_MATTER.includes(b.claim.predicate))
      .sort(
        (a, b) => a.edge.known_from - b.edge.known_from || a.claim.id.localeCompare(b.claim.id),
      );
    // What her suspicion rested on before tonight stays in view even once she has come
    // to doubt it: without it the judge cannot see that the ground has gone from under
    // the accusation. Tonight's hearsay is different: only what she believes counts. A
    // live run showed that a list of tales she had rejected ("... (Mara doubts it)") was
    // read as Mara doubting the case against the stranger, and cleared them on it.
    const before = relevant.filter((b) => b.edge.known_from < START && b.credence > 0);
    const tonight = relevant.filter((b) => b.edge.known_from >= START && b.credence >= 0.4);
    return {
      quest: { accusation: "the stranger took the inn's ledger" },
      npcs: {
        mara: {
          name: mara?.name ?? "Mara",
          role: mara?.role ?? "innkeeper",
          traits: mara?.traits ?? [],
          knows: before.map((b) => eventLine(world, MARA, b)),
          recent_events: tonight.slice(-MAX_EVENTS).map((b) => eventLine(world, MARA, b)),
        },
      },
    };
  },
};
