/**
 * A player's earned knowledge, not the cause debugger. Never follow a claim's
 * lineage or consult another actor's beliefs, schedule, location or intentions.
 */
import { type BeliefSource, beliefsOf, type World } from "@rpg-jev/core";
import { PLAYER } from "./content.ts";
import { cap, claimClause, clockWords, credenceWords, isTimeless, nameOf } from "./words.ts";

function sourceText(world: World, source: BeliefSource | undefined): string {
  if (!source) return "Source not recorded";
  if (source.kind === "witnessed") return "You witnessed this";
  if (source.kind === "inferred") return "Your own inference, not an observation";
  const from = nameOf(world, source.from);
  return source.kind === "shown" ? `${from} showed you evidence` : `${from} told you`;
}

export function renderJournal(world: World): string {
  const beliefs = beliefsOf(world, PLAYER);
  const lines = [
    `YOUR JOURNAL — ${clockWords(world.clock)}`,
    "Your character's knowledge, not a verdict on what really happened.",
  ];
  if (beliefs.length === 0)
    lines.push("No clues recorded yet. Examine things and listen to people to learn more.");
  for (const { claim, edge, credence } of beliefs) {
    const location = claim.predicate === "is_in";
    const label = location ? "Whereabouts account: " : "";
    const when = isTimeless(claim) ? "" : ` (account of ${clockWords(claim.when)})`;
    lines.push(
      `- ${label}${cap(claimClause(world, claim, { listener: PLAYER }))}${when}.`,
      `  ${sourceText(world, edge.source)}; your character ${credenceWords(credence)}.`,
    );
    if (location) lines.push("  They may have moved since; this is not live tracking.");
  }
  lines.push(
    "Compare accounts, examine evidence, then show what you carry or discuss what you learned.",
    "Reading your journal takes no game time.",
  );
  return lines.join("\n");
}
