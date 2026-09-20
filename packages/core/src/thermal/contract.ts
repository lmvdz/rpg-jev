/** Versioned admission, not an adapter for ordinal matter. */
import { z } from "zod";
import type { ThermalPhysics } from "./physics.ts";

export const MECHANICS = "solid-contact-v1";
const name = z.string().min(1).max(80);
const whole = z.number().int().min(0);
const finite = z.number().finite();
const part = z.strictObject({
  id: name,
  label: name,
  massKg: finite,
  specificHeatJPerKgK: finite,
  conductivityWPerMK: finite,
  energyJ: finite,
  slot: whole.nullable(),
});
export const physicsSchema = z.strictObject({
  parts: z.array(part).min(1).max(9),
  probe: z.strictObject({
    energyJ: finite,
    capacityJPerK: finite,
    conductanceWPerK: finite,
    target: name.nullable(),
  }),
  columns: whole,
  rows: whole,
});

export const operationSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("seat"), part: name, slot: whole.nullable() }),
  z.strictObject({ kind: z.literal("dock"), target: name.nullable() }),
  z.strictObject({ kind: z.literal("wait") }),
  z.strictObject({ kind: z.literal("read") }),
  z.strictObject({
    kind: z.literal("predict"),
    prediction: z.string().min(1).max(1000),
    reason: z.string().min(1).max(1000),
  }),
]);
export type Operation = z.infer<typeof operationSchema>;
export const observationSchema = z.strictObject({
  minute: whole,
  target: name.nullable(),
  probeKelvin: whole,
  resolutionKelvin: z.literal(1),
});
export type Observation = z.infer<typeof observationSchema>;
export const receiptSchema = z.strictObject({
  status: z.enum([
    "committed",
    "stale",
    "infeasible",
    "unsupported",
    "unavailable",
    "retry-conflict",
  ]),
  revision: whole,
  minute: whole,
  observation: observationSchema.optional(),
});
export type Receipt = z.infer<typeof receiptSchema>;

export interface ThermalState {
  mechanics: typeof MECHANICS;
  room: string;
  revision: number;
  physics: ThermalPhysics;
}

/** Input and receipt are history; only physics/revision/clock are projected. */
export const settlementSchema = z.strictObject({
  kind: z.literal("thermal_settle"),
  mechanics: z.literal(MECHANICS),
  actor: name,
  requestId: name,
  fingerprint: z.string().max(4096),
  expectedRevision: whole,
  requestedRevision: whole,
  beforeMinute: whole,
  operation: operationSchema.nullable(),
  receipt: receiptSchema,
  physics: physicsSchema,
});
export type ThermalSettlement = z.infer<typeof settlementSchema>;
