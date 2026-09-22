/**
 * A player's earned knowledge, not the cause debugger. Never follow a claim's
 * lineage or consult another actor's beliefs, schedule, location or intentions.
 */
import { type Belief, type BeliefSource, beliefsOf, type World } from "@rpg-jev/core";
import { PLAYER } from "./content.ts";
import { cap, claimClause, clockWords, credenceWords, isTimeless, nameOf } from "./words.ts";

/**
 * Stable, player-local references in first-acquisition order. Closed belief rows
 * reserve their number: changing confidence or learning something new must not
 * make a previously displayed note refer to a different claim.
 * This local save retains edge history; a future archive must preserve this mapping.
 */
export function journalEntries(world: World): (Belief & { note: number })[] {
  const numbers = new Map<string, number>();
  for (const edge of world.edges) {
    if (edge.kind === "believes" && edge.src === PLAYER && !numbers.has(edge.dst))
      numbers.set(edge.dst, numbers.size + 1);
  }
  return beliefsOf(world, PLAYER)
    .flatMap((belief) => {
      const note = numbers.get(belief.claim.id);
      return note === undefined ? [] : [{ ...belief, note }];
    })
    .sort((a, b) => a.note - b.note);
}

function sourceText(world: World, source: BeliefSource | undefined): string {
  if (!source) return "Source not recorded";
  if (source.kind === "witnessed") return "You witnessed this";
  if (source.kind === "inferred") return "Your own inference, not an observation";
  const from = nameOf(world, source.from);
  return source.kind === "shown" ? `${from} showed you evidence` : `${from} told you`;
}

export function renderJournal(world: World): string {
  const beliefs = journalEntries(world);
  const lines = [
    `YOUR JOURNAL — ${clockWords(world.clock)}`,
    "Your character's knowledge, not a verdict on what really happened.",
  ];
  if (beliefs.length === 0)
    lines.push("No clues recorded yet. Examine things and listen to people to learn more.");
  for (const { claim, edge, credence, note } of beliefs) {
    const location = claim.predicate === "is_in";
    const label = location ? "Whereabouts account: " : "";
    const when = isTimeless(claim) ? "" : ` (account of ${clockWords(claim.when)})`;
    lines.push(
      `- [note ${note}] ${label}${cap(claimClause(world, claim, { listener: PLAYER }))}${when}.`,
      `  ${sourceText(world, edge.source)}; your character ${credenceWords(credence)}.`,
    );
    if (location) lines.push("  They may have moved since; this is not live tracking.");
  }
  lines.push(
    "Compare accounts, examine evidence, then show what you carry or discuss what you learned.",
    "With someone present: tell <name> about note <number>, or ask <name> about note <number>.",
    "Note numbers stay the same as you learn more; discussing an account does not prove it true.",
    "Reading your journal takes no game time.",
  );
  return lines.join("\n");
}
