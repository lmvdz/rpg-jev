/** Study-record validation only. These records are not effects or simulated knowledge. */
import { z } from "zod";
import { observationSchema } from "./contract.ts";

const identity = z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/);
const phaseSchema = z.enum(["prior", "prediction", "revision", "transfer"]);
export const provenanceSchema = z.enum(["unspecified", "participant", "self-test", "scripted"]);
export type Provenance = z.infer<typeof provenanceSchema>;
export type Phase = z.infer<typeof phaseSchema>;
export const draftSchema = z.strictObject({
  requestId: identity,
  expectedRevision: z.number().int().nonnegative(),
  phase: phaseSchema,
  statement: z.string().trim().min(1).max(1000),
  reason: z.string().max(1000),
});
export type JournalDraft = z.infer<typeof draftSchema>;
export const recordSchema = draftSchema.extend({
  schema: z.literal("thermal-study-v1"),
  actor: identity,
  provenance: provenanceSchema,
  context: z.strictObject({
    minute: z.number().int().nonnegative(),
    revision: z.number().int().nonnegative(),
    columns: z.number().int().min(1).max(3),
    rows: z.number().int().min(1).max(3),
    parts: z
      .array(
        z.strictObject({
          id: z.string(),
          label: z.string(),
          slot: z.number().int().nonnegative().nullable(),
        }),
      )
      .max(9),
    probeTarget: z.string().nullable(),
    observations: z.array(observationSchema).max(32),
    earlierObservationCount: z.number().int().nonnegative(),
  }),
});
export type JournalRecord = z.infer<typeof recordSchema>;
