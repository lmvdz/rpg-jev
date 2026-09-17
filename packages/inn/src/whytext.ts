/**
 * `why <name>`: the cause debugger as text (SPEC.md section 13). Each line of
 * a chain is a log entry; reading downward goes back in time to the root.
 */
import type { LogEntry, WhyReport, World } from "@rpg-jev/core";
import {
  ACTIVITY,
  claimClause,
  clockWords,
  credenceWords,
  driftWords,
  nameOf,
  sourceWords,
} from "./words.ts";

/** Draws by the decision that caused them: the judge gives odds, the dice decide. */
type Dice = Map<number, string>;

function diceOf(log: readonly LogEntry[]): Dice {
  const dice: Dice = new Map();
  for (const e of log)
    if (e.kind === "draw" && e.cause !== null) {
      const rolled = `${e.purpose} rolled ${e.value.toFixed(2)}`;
      dice.set(e.cause, [dice.get(e.cause), rolled].filter(Boolean).join(", "));
    }
  return dice;
}

function entryLine(world: World, e: LogEntry, dice: Dice): string {
  const at = `#${e.id} ${clockWords(e.t)}`;
  switch (e.kind) {
    case "input":
      return `${at} you typed "${e.text}"`;
    case "init":
      return `${at} the night began`;
    case "stimulus":
      return `${at} stimulus: ${e.what.replaceAll("_", " ")}`;
    case "draw":
      return `${at} draw for "${e.purpose}": ${e.value.toFixed(3)}`;
    case "decision": {
      const parts = Object.entries(e.answers).map(([id, a]) =>
        a.type === "noul"
          ? `${id} yes ${a.noul.toFixed(2)}`
          : `${id} -> ${a.choice} ${(a.probabilities[a.choice] ?? 0).toFixed(2)}`,
      );
      const by =
        e.source === "fallback" ? "code fallback, judge unreachable" : `judge (${e.source})`;
      const rolled = dice.get(e.id) ? ` [${dice.get(e.id)}]` : "";
      return `${at} ${by}: ${parts.join("; ")}${rolled}`;
    }
    case "effect": {
      const f = e.effect;
      if (f.kind === "add_claim")
        return `${at} ${nameOf(world, f.holder)} took in: ${claimClause(world, f.claim)}`;
      if (f.kind === "say")
        return `${at} ${nameOf(world, f.intent.speaker)} spoke (${f.intent.act})`;
      if (f.kind === "move") return `${at} ${nameOf(world, f.actor)} went to ${f.to}`;
      if (f.kind === "create_debt") return `${at} a debt was created: ${f.debt.kind}`;
      return `${at} effect ${f.kind}`;
    }
    default:
      return `${at} ${e.kind}`;
  }
}

/** The nearest causes and always the root: a chain that stops short explains nothing. */
function chainText(world: World, chain: LogEntry[], dice: Dice, nearest = 5): string[] {
  if (chain.length === 0) return ["      (so since before tonight)"];
  const line = (e: LogEntry) => `      <- ${entryLine(world, e, dice)}`;
  if (chain.length <= nearest + 1) return chain.map(line);
  const skipped = chain.length - nearest - 1;
  const root = chain[chain.length - 1] as LogEntry;
  return [...chain.slice(0, nearest).map(line), `      <- ... ${skipped} more ...`, line(root)];
}

export function renderWhy(world: World, report: WhyReport, log: readonly LogEntry[]): string {
  const dice = diceOf(log);
  const name = nameOf(world, report.npc);
  const lines: string[] = [`WHY ${name.toUpperCase()}`];

  const w = report.whereabouts;
  lines.push(
    `  Is in ${world.rooms[w.room]?.name ?? w.room}, ${ACTIVITY[w.activity] ?? w.activity} (schedule layer: ${w.layer}).`,
    ...(w.layer === "home" || w.layer === "role" ? [] : chainText(world, w.chain, dice)),
  );
  if (report.stance) {
    lines.push(`  Stance toward you: ${report.stance.node}.`);
    lines.push(...chainText(world, report.stance.chain, dice));
  }
  const beliefs = report.beliefs.filter((b) => b.claim.predicate !== "is_in" && b.credence > 0);
  lines.push(`  Believes (${beliefs.length}):`);
  for (const b of beliefs.slice(0, 8)) {
    const drift = driftWords(world, b.claim);
    lines.push(
      `    - ${claimClause(world, b.claim)}: ${credenceWords(b.credence)} (${sourceWords(world, b.source)})`,
    );
    if (drift.length > 0) {
      const first = b.lineage[0];
      lines.push(
        `      garbled on the way (${drift.join(", then ")}). It began as: ${first ? claimClause(world, first) : "?"}`,
      );
    }
    lines.push(...chainText(world, b.chain, dice));
  }
  if (report.debts.length > 0) {
    lines.push("  Still means to:");
    for (const { debt, chain } of report.debts) {
      lines.push(`    - ${debt.kind.replaceAll("_", " ")} (due ${clockWords(debt.fuse.due)})`);
      if (chain.length > 0) lines.push(...chainText(world, chain, dice, 3));
    }
  }
  return lines.join("\n");
}
