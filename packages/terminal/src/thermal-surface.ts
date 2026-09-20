/** Evidence-only text surface. Simulation and journal ownership stay with the host. */
import type { view } from "../../core/src/thermal/attempt.ts";
import type { Observation, Operation, Receipt } from "../../core/src/thermal/contract.ts";

export type BenchView = ReturnType<typeof view>;
type Phase = "prior" | "prediction" | "revision" | "transfer";
export type BenchCommand =
  | { kind: "action"; operation: Operation }
  | { kind: "note"; phase: Phase; statement: string; reason: string }
  | { kind: "look" | "help" | "history" | "journal" | "quit" | "retry" }
  | { kind: "invalid"; message: string };

export const INTRO = `This is a tray of equal-sized cubes: seated face-neighbors touch; diagonal neighbors do not.
The tray and each separate rack support are insulating. Use the fixture manipulator, not bare hands.
The contact probe has its own thermal state. Its display is not an instantaneous cube temperature;
docking does not reset it. Readings are rounded to 1 K and retained with their original time and target.
Use prior to record relevant familiarity before experimenting. Inspect the fixture, then record
your own prediction before choosing an intervention. Acquire a probe reading and review its time and target.
Record whether that evidence changed your expectation; uncertainty or no revision is valid.
For an unfamiliar arrangement, record a transfer prediction before intervening.
These are prompts for your notes, not accomplishments or automatic stages.
Use the fixture's insulated manipulator for bounded cube placement; bodily handling is not simulated.
The bench is finite: there is no reset command. Type help for commands.`;

export const HELP = `look — inspect the visible fixture
help — show these commands
history — show your acquired probe readings (and any legacy structured predictions)
journal — show your authored prior, prediction, revision and transfer notes
quit — leave the session
retry — retry the previous request without making a new intervention
seat <visible-id> <integer-socket> — place a cube using the fixture manipulator
rack <visible-id> — place a cube in the rack using the fixture manipulator
dock <visible-id> — attach the probe to a seated cube
undock — detach the probe
read — acquire a probe reading at the current minute
wait — advance shared time by one minute (no duration argument)
prior <statement> [ | <reason>] — author a prior-knowledge note
predict <statement> [ | <reason>] — author a prediction note
revise <statement> [ | <reason>] — author a revision note
transfer <statement> [ | <reason>] — author a prediction for an unfamiliar arrangement
Note phases are labels, not accomplishments. An omitted reason remains unstated.
Use an unambiguous visible ID or label, case-insensitively, without quotes.
Socket indices run left-to-right, then top-to-bottom, starting at 0.
Commands are limited to 4096 characters; each note field to 1000 characters.
Only wait advances time; that time is shared, not private to this actor.`;

/** Quote untrusted text as data; escape terminal and directional controls too. */
export function quoteText(text: string): string {
  return JSON.stringify(text).replace(
    /[\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/g,
    (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
}

function invalid(message: string): BenchCommand {
  return { kind: "invalid", message };
}

const phases: Record<string, Phase | undefined> = {
  prior: "prior",
  predict: "prediction",
  revise: "revision",
  transfer: "transfer",
};

function note(phase: Phase, text: string): BenchCommand {
  const divider = text.indexOf("|");
  const statement = (divider < 0 ? text : text.slice(0, divider)).trim();
  const reason = divider < 0 ? "" : text.slice(divider + 1).trim();
  if (!statement) return invalid("A note needs a nonempty statement.");
  if (statement.length > 1000 || reason.length > 1000)
    return invalid("Each note field must be at most 1000 characters.");
  return { kind: "note", phase, statement, reason };
}

function partCommand(command: string, argument: string, visible: BenchView): BenchCommand {
  if (!(visible.available && visible.parts)) return invalid("The bench is unavailable.");
  let name = argument;
  let slot: number | null = null;
  if (command === "seat") {
    const match = /^(.*?)\s+([+-]?\d+)$/.exec(argument);
    if (!match) return invalid("Use seat <visible-id> <integer-socket>.");
    name = match[1]?.trim() ?? "";
    slot = Number(match[2]);
    const count = (visible.columns ?? 0) * (visible.rows ?? 0);
    if (!Number.isSafeInteger(slot) || slot < 0 || slot >= count)
      return invalid(`Choose a visible socket index from 0 to ${count - 1}.`);
  }
  if (!name) return invalid(`Use ${command} <visible-id>.`);
  const key = name.toLowerCase();
  const matches = visible.parts.filter(
    (part) => part.id.toLowerCase() === key || part.label.toLowerCase() === key,
  );
  if (matches.length === 0)
    return invalid("Unknown cube. Use look to choose an ID or label from the visible list.");
  if (matches.length > 1)
    return invalid(
      `Ambiguous cube. Matching visible IDs: ${matches.map((p) => quoteText(p.id)).join(", ")}.`,
    );
  const part = matches[0];
  if (!part) return invalid("No visible cube selected.");
  const operation: Operation =
    command === "dock" ? { kind: "dock", target: part.id } : { kind: "seat", part: part.id, slot };
  return { kind: "action", operation };
}

export function parseBenchCommand(text: string, visible: BenchView): BenchCommand {
  if (text.length > 4096) return invalid("Commands must be at most 4096 characters.");
  const match = /^(\S+)(?:\s+([\s\S]*))?$/.exec(text.trim());
  const command = match?.[1]?.toLowerCase() ?? "";
  const argument = match?.[2]?.trim() ?? "";
  const phase = Object.hasOwn(phases, command) ? phases[command] : undefined;
  if (phase) return note(phase, argument);
  if (command === "seat" || command === "rack" || command === "dock")
    return partCommand(command, argument, visible);
  if (argument) return invalid("Unexpected arguments. Type help for the supported commands.");
  if (
    command === "look" ||
    command === "help" ||
    command === "history" ||
    command === "journal" ||
    command === "quit" ||
    command === "retry"
  )
    return { kind: command };
  if (command === "undock") return { kind: "action", operation: { kind: "dock", target: null } };
  if (command === "read" || command === "wait")
    return { kind: "action", operation: { kind: command } };
  return invalid("Unknown command. Type help for the supported commands.");
}

function reading(observation: Observation): string {
  const target = observation.target === null ? "undocked" : quoteText(observation.target);
  return `Historical probe reading — minute ${observation.minute}; original target: ${target}; probe: ${observation.probeKelvin} K (resolution ${observation.resolutionKelvin} K).`;
}

export function renderBench(visible: BenchView): string {
  if (!(visible.available && visible.parts && visible.history)) return "Bench unavailable.";
  const lines = [`Bench — shared minute ${visible.minute}`, "Sockets (row-major):"];
  for (let row = 0; row < (visible.rows ?? 0); row++) {
    const cells: string[] = [];
    for (let column = 0; column < (visible.columns ?? 0); column++) {
      const slot = row * (visible.columns ?? 0) + column;
      const part = visible.parts.find((candidate) => candidate.slot === slot);
      cells.push(`${slot}: ${part ? quoteText(part.id) : "empty"}`);
    }
    lines.push(cells.join(" | "));
  }
  const rack = visible.parts.filter((part) => part.slot === null).map((part) => quoteText(part.id));
  lines.push(`Rack: ${rack.length > 0 ? rack.join(", ") : "empty"}`, "Visible cubes (ID: label):");
  for (const part of visible.parts) lines.push(`${quoteText(part.id)}: ${quoteText(part.label)}`);
  lines.push(
    `Probe attachment: ${visible.probeTarget == null ? "undocked" : quoteText(visible.probeTarget)}`,
  );
  const latest = visible.history.findLast((record) => record.kind === "observation");
  lines.push(latest?.kind === "observation" ? reading(latest) : "No measurement acquired.");
  return lines.join("\n");
}

export function renderHistory(visible: BenchView): string {
  if (!(visible.available && visible.history)) return "Bench unavailable.";
  const lines = ["Your acquired history (original times and targets):"];
  if (!visible.history.some((record) => record.kind === "observation"))
    lines.push("No measurement acquired.");
  for (const record of visible.history) {
    if (record.kind === "observation") lines.push(reading(record));
    else
      lines.push(
        `Authored prediction — minute ${record.minute}; statement: ${quoteText(record.prediction)}; reason: ${record.reason ? quoteText(record.reason) : "unstated"}.`,
      );
  }
  return lines.join("\n");
}

const receiptMessages: Record<Receipt["status"], string> = {
  committed: "Committed.",
  stale: "Stale request: not applied. Inspect the current shared view before choosing again.",
  infeasible: "Infeasible request: not applied.",
  unsupported: "Unsupported request: not applied. Type help for supported commands.",
  unavailable: "Bench unavailable: request not applied.",
  "retry-conflict": "Retry conflict: this request identity has a different payload; not applied.",
};

export function renderReceipt(receipt: Receipt): string {
  const lines = [
    receiptMessages[receipt.status],
    `Receipt minute ${receipt.minute}; revision ${receipt.revision}. Time changes are shared, not actor-private.`,
    "A retry returns the original receipt; use look for the current shared minute.",
  ];
  if (receipt.observation) lines.push(reading(receipt.observation));
  return lines.join("\n");
}
