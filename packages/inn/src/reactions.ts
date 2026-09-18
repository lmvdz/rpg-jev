/**
 * From a belief, or an intention held for the night, to something done about it (SPEC.md
 * section 9).
 *
 * Content declares dispositions: whose habit, what sets it off, and the closed set of
 * reactions they would choose among. This module is the pipeline. When someone comes to
 * believe something, `considerReacting` checks their dispositions and leaves a `react` debt
 * with a short fuse; content may also seed such debts for a fixed hour. When the debt comes
 * due, `react` builds the option set from the reactions that are possible at that moment
 * (`repertoire.ts`), asks the judge only if there is a choice to make, and carries the
 * reaction out. Nothing here names a person, a room or a thing.
 */
import {
  type Belief,
  type BeliefSource,
  beliefIn,
  type Claim,
  type Debt,
  type LogId,
} from "@rpg-jev/core";
import { compileSlice, type Option, pickAction } from "@rpg-jev/jev";
import { DISPOSITIONS, type Disposition, PLAYER } from "./content.ts";
import type { Game } from "./game.ts";
import { holdsHabit, REACTIONS, type Scene, STILL_HELD } from "./repertoire.ts";
import { sceneSlice, trustIn } from "./slices.ts";
import { claimClause, nameOf, whenFor } from "./words.ts";

export { goTo, REACTIONS } from "./repertoire.ts";

/** A belief held at least this firmly is acted on; below it, only a trusted word is. */
const BELIEVED = 0.6;
const TRUSTED = 0.8;
/** How long someone keeps meaning to do it, and how soon they try again if they cannot yet. */
const KEEPS_FOR = 120;
const TRIES_AGAIN_IN = 3;

/** Ask one NPC to choose among feasible acts. `none_of_these` and outages fall to `fallback`. */
async function choose(
  g: Game,
  npc: string,
  situation: string,
  options: Option[],
  fallback: string,
  cause: LogId,
): Promise<{ choice: string | null; id: LogId }> {
  const slice = compileSlice(sceneSlice, {
    world: g.world,
    parts: [{ npc, extra: { situation } }],
  });
  const decision = await g.decide(
    slice,
    { act: pickAction(`npcs.${npc}`, options, fallback) },
    [{ kind: "alive", actor: npc }],
    cause,
  );
  if (!decision) return { choice: null, id: cause };
  const choice = g.sampleChoice(decision.answers.act, `${npc} acts`, decision.id);
  return { choice: options.some((o) => o.id === choice) ? choice : fallback, id: decision.id };
}

// --- From a belief to a debt ----------------------------------------------------

function setsOff(g: Game, holder: string, d: Disposition, claim: Claim): boolean {
  const { when } = d;
  if (!when?.predicates.includes(claim.predicate)) return false;
  const about = { stranger: claim.subject === PLAYER, oneself: claim.subject === holder };
  if (when.about === "another" ? about.stranger || about.oneself : !about[when.about]) return false;
  if (when.placed && !(claim.place && g.world.rooms[claim.place])) return false;
  const them = g.world.actors[claim.subject];
  return !(when.inTheHouse && !(them?.kind === "npc" && them.present));
}

const keyFor = (d: Disposition, claim: Claim): string => {
  if (d.once === "claim") return claim.id;
  if (d.once === "ever") return "ever";
  return d.once === "place" ? (claim.place ?? claim.subject) : claim.subject;
};

function owe(
  g: Game,
  npc: string,
  id: string,
  d: Disposition,
  data: Record<string, string>,
  minutes: number,
  cause: LogId,
): void {
  if (g.world.debts[id]) return;
  const due = g.world.clock + minutes;
  const debt: Debt = {
    id,
    cause,
    stakeholder: npc,
    kind: "react",
    magnitude: 3,
    fuse: { due, expires: due + KEEPS_FOR },
    status: "pending",
    data: { disposition: d.id, ...data },
  };
  g.commit({ kind: "create_debt", debt }, cause);
}

const aboutClaim = (claim: Claim): Record<string, string> => ({
  subject: claim.subject,
  claim: claim.id,
  ...(claim.place ? { place: claim.place } : {}),
  ...(claim.object ? { thing: claim.object } : {}),
});

/** Someone has just taken a claim in. If it is the kind of thing they do something about, they now mean to. */
export function considerReacting(
  g: Game,
  holder: string,
  claim: Claim,
  credence: number,
  source: BeliefSource,
  cause: LogId,
): void {
  if (g.world.actors[holder]?.kind !== "npc") return;
  const believed = credence >= BELIEVED;
  const trustedWord = source.kind === "told" && trustIn(g.world, holder, source.from) >= TRUSTED;
  for (const d of DISPOSITIONS) {
    if (!(believed || (d.when?.onTrustedWord && trustedWord))) continue;
    if (!(holdsHabit(g, holder, d) && setsOff(g, holder, d, claim))) continue;
    const minutes = source.kind === "witnessed" ? (d.after?.seen ?? 0) : (d.after?.heard ?? 0);
    owe(g, holder, `${d.id}_${holder}_${keyFor(d, claim)}`, d, aboutClaim(claim), minutes, cause);
  }
}

const habitWith = (g: Game, npc: string, reaction: string): Disposition | undefined =>
  DISPOSITIONS.find((d) => holdsHabit(g, npc, d) && d.reactions.includes(reaction));

/** Is this something this person does? Used to decide whether they may promise it. */
export const canReact = (g: Game, npc: string, reaction: string): boolean =>
  habitWith(g, npc, reaction) !== undefined;

/** Said aloud, it is owed: a promised reaction is the same debt the belief would have left. */
export function promiseReaction(
  g: Game,
  npc: string,
  reaction: string,
  subject: string,
  minutes: number,
  cause: LogId,
): void {
  const d = habitWith(g, npc, reaction);
  if (d) owe(g, npc, `${d.id}_${npc}_${subject}`, d, { subject, only: reaction }, minutes, cause);
}

/** Pressed by someone else: what they were going to do about this person anyway, they now do sooner. */
function urge(
  g: Game,
  by: string,
  whom: string,
  press: { reaction: string; subject: string; minutes: number },
  cause: LogId,
): void {
  const d = habitWith(g, whom, press.reaction);
  if (!d) return;
  let carried: Record<string, string> = {};
  for (const debt of Object.values(g.world.debts)) {
    const same = debt.kind === "react" && debt.stakeholder === whom && debt.status === "pending";
    if (!(same && debt.data.disposition === d.id && debt.data.subject === press.subject)) continue;
    carried = debt.data;
    g.commit({ kind: "settle_debt", id: debt.id, status: "cancelled" }, cause);
  }
  const data = { ...carried, subject: press.subject, urged_by: by };
  owe(g, whom, `${d.id}_${whom}_${press.subject}_urged_${cause}`, d, data, press.minutes, cause);
}

/** A belief let go of takes with it whatever was still owed on it. */
export function lapse(g: Game, holder: string, claimId: string, cause: LogId): void {
  for (const debt of Object.values(g.world.debts))
    if (
      debt.kind === "react" &&
      debt.status === "pending" &&
      debt.stakeholder === holder &&
      debt.data.claim === claimId
    )
      g.commit({ kind: "settle_debt", id: debt.id, status: "cancelled" }, cause);
}

// --- When the debt comes due ------------------------------------------------------

/** Who would see it done: a social constraint only counts if it is a stated fact (SPEC.md section 14). */
function onlookers(s: Scene): string {
  const { g, npc } = s;
  const rooms = [g.world.actors[npc]?.room, s.place].filter((r): r is string => Boolean(r));
  const seen = [...new Set(rooms)].flatMap((room) => [
    ...g.npcsIn(room),
    ...(g.playerRoom === room ? [PLAYER] : []),
  ]);
  const others = [...new Set(seen)].filter((id) => id !== npc).map((id) => nameOf(g.world, id));
  if (others.length === 0) return "Nobody else is near.";
  return `${others.join(" and ")} ${others.length > 1 ? "are" : "is"} close by and would see what is done.`;
}

function situationFor(s: Scene, urgedBy: string | undefined): string {
  const { g, npc, disposition, belief } = s;
  const name = nameOf(g.world, npc);
  const parts: string[] = [];
  if (belief) {
    const how = belief.edge.source?.kind === "witnessed" ? "has seen" : "has come to believe";
    const clause = `${claimClause(g.world, belief.claim)}${whenFor(belief.claim, g.world.clock)}`;
    parts.push(`${name} ${how} that ${clause}.`);
  }
  parts.push(disposition.because);
  if (urgedBy) parts.push(`${nameOf(g.world, urgedBy)} has just urged ${name} to act at once.`);
  const where = g.world.rooms[g.world.actors[s.subject]?.room ?? ""]?.name;
  if (where && s.subject !== npc) parts.push(`${nameOf(g.world, s.subject)} is in ${where}.`);
  parts.push(onlookers(s));
  return parts.join(" ");
}

/** Whether what the disposition hangs on still holds: the belief, and the state of the story. */
function stillStands(g: Game, d: Disposition, belief: Belief | null): boolean {
  if (belief && belief.credence < STILL_HELD && !d.when?.onTrustedWord) return false;
  const node = d.while ? g.world.machines[d.while.machine]?.node : undefined;
  return !(d.while && !(node && d.while.nodes.includes(node)));
}

/** What is possible now, and which of it is done: asked of the judge only if there is a choice. */
async function decide(
  s: Scene,
  debt: Debt,
  cause: LogId,
): Promise<{ chosen: string | null; at: LogId } | null> {
  const wanted = debt.data.only ? [debt.data.only] : s.disposition.reactions;
  const options: Option[] = wanted.flatMap((id) => {
    const description = REACTIONS[id]?.offer(s);
    return description ? [{ id, description }] : [];
  });
  const only = options[0];
  if (!only) return null;
  if (options.length === 1) return { chosen: only.id, at: cause };
  const fallback = options.some((o) => o.id === s.disposition.fallback)
    ? s.disposition.fallback
    : only.id;
  const situation = situationFor(s, debt.data.urged_by);
  const { choice, id } = await choose(s.g, s.npc, situation, options, fallback, cause);
  return { chosen: choice, at: id };
}

/** The debt handler for `react`: build what is possible, ask only if there is a choice, do it. */
export async function react(g: Game, debt: Debt, cause: LogId): Promise<void> {
  const settle = (status: "fired" | "cancelled", at: LogId) =>
    g.commit({ kind: "settle_debt", id: debt.id, status }, at);
  const disposition = DISPOSITIONS.find((d) => d.id === debt.data.disposition);
  const npc = debt.stakeholder;
  const belief = debt.data.claim ? (beliefIn(g.world, npc, debt.data.claim) ?? null) : null;
  if (!(disposition && stillStands(g, disposition, belief))) {
    settle("cancelled", cause);
    return;
  }
  const scene: Scene = {
    g,
    npc,
    disposition,
    subject: debt.data.subject ?? npc,
    belief,
    place: debt.data.place ?? null,
    thing: debt.data.thing ?? null,
    urge: (whom, press, at) => urge(g, npc, whom, press, at),
  };
  const decided = await decide(scene, debt, cause);
  if (!decided) {
    settle("cancelled", cause);
    return;
  }
  const { chosen, at } = decided;
  settle("fired", at);
  const reaction = chosen ? REACTIONS[chosen] : undefined;
  if (!(chosen && reaction)) return;
  // Could not get there yet: what was decided is kept, and tried again shortly.
  if ((await reaction.perform(scene, at)) === "not_yet" && g.world.clock < (debt.fuse.expires ?? 0))
    g.commit(
      {
        kind: "create_debt",
        debt: {
          ...debt,
          id: `${debt.id}+`,
          cause: at,
          status: "pending",
          fuse: { ...debt.fuse, due: g.world.clock + TRIES_AGAIN_IN },
          data: { ...debt.data, only: chosen },
        },
      },
      at,
    );
}
