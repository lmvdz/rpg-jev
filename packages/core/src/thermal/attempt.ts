/** One synchronous choice frontier through the existing authoritative Store. */
import { stableStringify } from "../hash.ts";
import type { Store } from "../log.ts";
import {
  MECHANICS,
  type Observation,
  operationSchema,
  type Receipt,
  type ThermalSettlement,
} from "./contract.ts";
import { perform } from "./execution.ts";
import { probeTemperature } from "./physics.ts";
import { thermalAccess } from "./settlement.ts";

export interface Request {
  requestId: string;
  expectedRevision: number;
  operation: unknown;
}

type HistoryRecord =
  | (Observation & { kind: "observation" })
  | { kind: "prediction"; minute: number; prediction: string; reason: string };

function original(store: Store, actor: string, requestId: string): ThermalSettlement | undefined {
  for (const entry of store.log) {
    if (entry.kind !== "effect" || entry.effect.kind !== "thermal_settle") continue;
    if (entry.effect.actor === actor && entry.effect.requestId === requestId) return entry.effect;
  }
  return undefined;
}

function settle(store: Store, actor: string, request: Request, fingerprint: string): Receipt {
  const thermal = store.world.thermal;
  if (!thermal) throw new Error("thermal state unavailable");
  const parsed = operationSchema.safeParse(request.operation);
  const operation = parsed.success ? parsed.data : null;
  let status: Receipt["status"] = "unsupported";
  let physics = structuredClone(thermal.physics);
  if (request.expectedRevision !== thermal.revision) status = "stale";
  else if (operation) {
    const next = perform(physics, operation);
    status = next ? "committed" : "infeasible";
    if (next) physics = next;
  }
  const committed = status === "committed";
  const receipt: Receipt = {
    status,
    revision: thermal.revision + Number(committed),
    minute: store.world.clock + Number(committed && operation?.kind === "wait"),
  };
  if (committed && operation?.kind === "read") {
    receipt.observation = {
      minute: receipt.minute,
      target: physics.probe.target,
      probeKelvin: Math.round(probeTemperature(physics.probe)),
      resolutionKelvin: 1,
    };
  }
  const cause = store.append(
    {
      kind: "input",
      text: "",
      via: "thermal",
      action: {
        actor,
        requestId: request.requestId,
        expectedRevision: request.expectedRevision,
        untrustedInput: structuredClone(request.operation),
      },
    },
    null,
  );
  store.commit(
    {
      kind: "thermal_settle",
      mechanics: MECHANICS,
      actor,
      requestId: request.requestId,
      fingerprint,
      expectedRevision: thermal.revision,
      requestedRevision: request.expectedRevision,
      beforeMinute: store.world.clock,
      operation,
      receipt,
      physics,
    },
    cause,
  );
  return structuredClone(receipt);
}

/** `actor` is a trusted authenticated identity supplied by the host, never by the operation. */
export function attempt(store: Store, actor: string, request: Request): Receipt {
  const frontier = { revision: store.world.thermal?.revision ?? 0, minute: store.world.clock };
  if (!thermalAccess(store.world, actor)) return { status: "unavailable", revision: 0, minute: 0 };
  if (
    !(
      typeof request.requestId === "string" &&
      /^[a-zA-Z0-9_-]{1,80}$/.test(request.requestId) &&
      Number.isSafeInteger(request.expectedRevision)
    ) ||
    request.expectedRevision < 0
  )
    return { status: "unsupported", ...frontier };
  const fingerprint = stableStringify({
    expectedRevision: request.expectedRevision,
    operation: request.operation,
  });
  if (fingerprint.length > 4096) return { status: "unsupported", ...frontier };
  const prior = original(store, actor, request.requestId);
  if (prior)
    return prior.fingerprint === fingerprint
      ? structuredClone(prior.receipt)
      : { status: "retry-conflict", ...frontier };
  return settle(store, actor, request, fingerprint);
}

/** Only public structure and this actor's already-acquired records. Never solver truth. */
export function view(store: Store, actor: string) {
  if (!(thermalAccess(store.world, actor) && store.world.thermal)) return { available: false };
  const thermal = store.world.thermal;
  const history = store.log.flatMap<HistoryRecord>((entry) => {
    if (entry.kind !== "effect" || entry.effect.kind !== "thermal_settle") return [];
    const effect = entry.effect;
    if (effect.actor !== actor || effect.receipt.status !== "committed") return [];
    if (effect.receipt.observation) return [{ kind: "observation", ...effect.receipt.observation }];
    if (effect.operation?.kind === "predict")
      return [
        {
          kind: "prediction",
          minute: effect.receipt.minute,
          prediction: effect.operation.prediction,
          reason: effect.operation.reason,
        },
      ];
    return [];
  });
  return {
    available: true,
    revision: thermal.revision,
    minute: store.world.clock,
    columns: thermal.physics.columns,
    rows: thermal.physics.rows,
    parts: thermal.physics.parts.map(({ id, label, slot }) => ({ id, label, slot })),
    probeTarget: thermal.physics.probe.target,
    history,
    operations: ["seat", "dock", "wait", "read", "predict"],
  };
}
