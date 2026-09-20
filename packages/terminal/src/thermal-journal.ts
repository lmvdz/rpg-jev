/**
 * Participant research metadata, not simulated beliefs, physics or a new action catalog.
 * Snapshots are copied from the actor projection at entry time, never reconstructed later.
 */
import { stableStringify } from "../../core/src/hash.ts";
import type { LogEntry, Store } from "../../core/src/log.ts";
import { view } from "../../core/src/thermal/attempt.ts";
import {
  draftSchema,
  type JournalDraft,
  type JournalRecord,
  type Provenance,
  provenanceSchema,
  recordSchema,
} from "../../core/src/thermal/study-record.ts";
import { quoteText } from "./thermal-surface.ts";

export { type JournalDraft, type JournalRecord, type Provenance, provenanceSchema };
export type JournalResult =
  | { status: "recorded"; record: JournalRecord }
  | { status: "unavailable" | "unsupported" | "retry-conflict" | "stale" };

/** Unlike replay, this validates study metadata; it never evaluates its statement. */
export function studyRecords(log: readonly LogEntry[]): JournalRecord[] {
  return log.flatMap((entry) => {
    if (entry.kind !== "input" || entry.via !== "thermal-study") return [];
    return [recordSchema.parse(entry.action)];
  });
}

export function journal(store: Store, actor: string): JournalRecord[] {
  if (!view(store, actor).available) return [];
  return structuredClone(studyRecords(store.log).filter((record) => record.actor === actor));
}

export function recordReflection(
  store: Store,
  actor: string,
  provenance: Provenance,
  draft: JournalDraft,
): JournalResult {
  const visible = view(store, actor);
  if (!visible.available) return { status: "unavailable" };
  const parsed = draftSchema.safeParse(draft);
  if (!(parsed.success && provenanceSchema.safeParse(provenance).success))
    return { status: "unsupported" };
  const prior = studyRecords(store.log).find(
    (record) => record.actor === actor && record.requestId === draft.requestId,
  );
  if (prior) {
    const { context: _context, schema: _schema, ...original } = prior;
    const requested = { ...parsed.data, actor, provenance };
    return stableStringify(original) === stableStringify(requested)
      ? { status: "recorded", record: structuredClone(prior) }
      : { status: "retry-conflict" };
  }
  if (draft.expectedRevision !== visible.revision) return { status: "stale" };
  const observations =
    visible.history?.flatMap((entry) =>
      entry.kind === "observation"
        ? [
            {
              minute: entry.minute,
              target: entry.target,
              probeKelvin: entry.probeKelvin,
              resolutionKelvin: entry.resolutionKelvin,
            },
          ]
        : [],
    ) ?? [];
  const record = recordSchema.parse({
    ...parsed.data,
    schema: "thermal-study-v1",
    actor,
    provenance,
    context: {
      minute: visible.minute,
      revision: visible.revision,
      columns: visible.columns,
      rows: visible.rows,
      parts: visible.parts,
      probeTarget: visible.probeTarget,
      observations: observations.slice(-32),
      earlierObservationCount: Math.max(0, observations.length - 32),
    },
  });
  store.append({ kind: "input", text: "", via: "thermal-study", action: record }, null);
  return { status: "recorded", record: structuredClone(record) };
}

/** Quotes user text so ANSI/newline text cannot impersonate evidence or a prompt. */
export function renderJournal(records: readonly JournalRecord[]): string {
  if (records.length === 0)
    return "No study notes. Notes record your account, not verified learning.";
  return records
    .map((record, index) => {
      const context = record.context;
      const readings =
        context.observations
          .map(
            (reading) =>
              `${reading.probeKelvin} K on ${quoteText(reading.target ?? "undocked")} at minute ${reading.minute}`,
          )
          .join("; ") || "none";
      const positions = context.parts
        .map((part) => `${quoteText(part.id)}=${part.slot ?? "rack"}`)
        .join(", ");
      return [
        `Note ${index + 1}: ${record.phase} (${record.provenance}; declared, not authenticated)`,
        `Recorded at minute ${context.minute}, revision ${context.revision}.`,
        `Statement: ${quoteText(record.statement)}`,
        `Reason: ${record.reason ? quoteText(record.reason) : "(not stated)"}`,
        `Arrangement then: ${positions}. Probe then: ${quoteText(context.probeTarget ?? "undocked")}.`,
        `Available probe readings then (not necessarily used): ${readings}.`,
        `Earlier readings outside this 32-reading snapshot: ${context.earlierObservationCount}.`,
      ].join("\n");
    })
    .join("\n\n");
}
