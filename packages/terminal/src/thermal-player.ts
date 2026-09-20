/** Human command orchestration. Physics still has exactly the existing attempt path. */
import type { Store } from "../../core/src/log.ts";
import { attempt, type Request, view } from "../../core/src/thermal/attempt.ts";
import { recordSchema } from "../../core/src/thermal/study-record.ts";
import {
  type JournalDraft,
  journal,
  type Provenance,
  recordReflection,
  renderJournal,
} from "./thermal-journal.ts";
import {
  HELP,
  INTRO,
  parseBenchCommand,
  renderBench,
  renderHistory,
  renderReceipt,
} from "./thermal-surface.ts";

type Previous = { kind: "action"; request: Request } | { kind: "note"; draft: JournalDraft };

function previousRequest(store: Store, actor: string): Previous | undefined {
  for (const entry of [...store.log].reverse()) {
    if (entry.kind === "input" && entry.via === "thermal-study") {
      const record = recordSchema.parse(entry.action);
      if (record.actor !== actor) continue;
      const { requestId, expectedRevision, phase, statement, reason } = record;
      return { kind: "note", draft: { requestId, expectedRevision, phase, statement, reason } };
    }
    if (entry.kind !== "effect" || entry.effect.kind !== "thermal_settle") continue;
    const effect = entry.effect;
    if (effect.actor === actor)
      return {
        kind: "action",
        request: { requestId: effect.requestId, ...JSON.parse(effect.fingerprint) },
      };
  }
  return undefined;
}

export class BenchPlayer {
  private readonly store: Store;
  private readonly actor: string;
  private readonly provenance: Provenance;
  private visible: ReturnType<typeof view>;
  private previous: Previous | undefined;

  constructor(store: Store, actor: string, provenance: Provenance) {
    this.store = store;
    this.actor = actor;
    this.provenance = provenance;
    this.visible = view(store, actor);
    this.previous = previousRequest(store, actor);
  }

  intro(): string {
    return `${INTRO}\nStudy provenance: ${this.provenance} (declared).\n${this.look()}`;
  }

  private look(): string {
    this.visible = view(this.store, this.actor);
    return renderBench(this.visible);
  }

  private submit(previous: Previous): string {
    if (previous.kind === "action") {
      const receipt = attempt(this.store, this.actor, previous.request);
      return `${renderReceipt(receipt)}\n${this.look()}`;
    }
    const result = recordReflection(this.store, this.actor, this.provenance, previous.draft);
    if (result.status === "recorded")
      return `Study note recorded; this is your account, not a verified conclusion.\n${renderJournal([result.record])}`;
    return `Study note ${result.status}. No note recorded.\n${this.look()}`;
  }

  turn(text: string): { text: string; quit: boolean } {
    const command = parseBenchCommand(text, this.visible);
    if (command.kind === "quit") return { text: "Leaving the bench.", quit: true };
    const respond = (text: string) => ({ text, quit: false });
    if (command.kind === "invalid") return respond(command.message);
    if (command.kind === "help") return respond(HELP);
    if (command.kind === "look") return respond(this.look());
    if (command.kind === "history") return respond(renderHistory(view(this.store, this.actor)));
    if (command.kind === "journal") return respond(renderJournal(journal(this.store, this.actor)));
    if (command.kind === "retry")
      return respond(
        this.previous ? this.submit(this.previous) : "No command to retry in this session.",
      );
    const requestId = `player-${this.store.log.length}`;
    const expectedRevision = this.visible.revision ?? 0;
    if (command.kind === "action") {
      this.previous = {
        kind: "action",
        request: {
          requestId,
          expectedRevision,
          operation: command.operation,
        },
      };
    } else if (command.kind === "note") {
      this.previous = {
        kind: "note",
        draft: {
          requestId,
          expectedRevision,
          phase: command.phase,
          statement: command.statement,
          reason: command.reason,
        },
      };
    } else return respond("Unsupported command. Type help.");
    return respond(this.submit(this.previous));
  }
}
