/**
 * Offline boundary for the witnessed-theft experiment, not a live decision engine.
 * No I/O, effects, sampling, or access to world state. Callers supply an NPC-local
 * snapshot and retain the request with the response for later analysis.
 */
export const upstreamRevision = "c6e6c88f3ef75a4ce7acd660d6fa5779d995512c";
export const actions = ["none", "report", "confront", "flee"] as const;
export type Action = (typeof actions)[number];

export interface Features {
  witnessed: boolean;
  guard_present: boolean;
  escape_open: boolean;
  courage: number;
  loyalty: number;
  danger: number;
}

export interface ShadowRequest {
  schema_version: 1;
  request_id: string;
  episode_id: string;
  features: Features;
  legal_actions: Action[];
  action: Action;
}

export interface Checkpoint {
  sha256: string;
  variant: "baseline" | "jepa";
  upstream_revision: string;
}

export interface ShadowResponse {
  schema_version: 1;
  request_id: string;
  episode_id: string;
  shadow_only: true;
  action: Action;
  choice_probabilities: Partial<Record<Action, number>>;
  predicted_outcome: { recovered: number; alarm: number; injury: number };
  checkpoint: Checkpoint;
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("expected an object");
  }
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): void {
  const actual = Object.keys(value);
  if (actual.length !== keys.length || actual.some((key) => !keys.includes(key))) {
    throw new Error("unexpected or missing fields");
  }
}

function identifier(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 256) {
    throw new Error("expected a nonempty identifier of at most 256 characters");
  }
  return value;
}

function probability(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error("expected a finite number in [0, 1]");
  }
  return value;
}

function boolean(value: unknown): boolean {
  if (typeof value !== "boolean") throw new Error("expected a boolean");
  return value;
}

/** Explicit projection drops extra fields, including free text and hidden facts. */
function featuresFrom(value: unknown): Features {
  const source = record(value);
  return {
    witnessed: boolean(source.witnessed),
    guard_present: boolean(source.guard_present),
    escape_open: boolean(source.escape_open),
    courage: probability(source.courage),
    loyalty: probability(source.loyalty),
    danger: probability(source.danger),
  };
}

export function legalActions(features: Features): Action[] {
  const result: Action[] = ["none"];
  if (features.witnessed && features.guard_present) result.push("report");
  if (features.witnessed) result.push("confront");
  if (features.escape_open) result.push("flee");
  return result;
}

export function buildShadowRequest(input: {
  requestId: string;
  episodeId: string;
  features: Features;
  action: Action;
}): ShadowRequest {
  const features = featuresFrom(input.features);
  const legal = legalActions(features);
  if (!legal.includes(input.action)) throw new Error("illegal conditioned action");
  return {
    schema_version: 1,
    request_id: identifier(input.requestId),
    episode_id: identifier(input.episodeId),
    features,
    legal_actions: legal,
    action: input.action,
  };
}

function checkpointFrom(value: unknown): Checkpoint {
  const source = record(value);
  exactKeys(source, ["sha256", "variant", "upstream_revision"]);
  if (typeof source.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(source.sha256)) {
    throw new Error("invalid checkpoint digest");
  }
  if (source.variant !== "baseline" && source.variant !== "jepa") {
    throw new Error("unknown model variant");
  }
  if (source.upstream_revision !== upstreamRevision) {
    throw new Error("unexpected upstream revision");
  }
  return {
    sha256: source.sha256,
    variant: source.variant,
    upstream_revision: source.upstream_revision,
  };
}

/**
 * Treat Python output as untrusted. Bind it to the retained request and an
 * independently expected checkpoint, not provenance asserted by the response.
 * Returned numbers are predictions only; nothing here commits or selects them.
 */
export function parseShadowResponse(
  value: unknown,
  request: ShadowRequest,
  expectedCheckpoint: Checkpoint,
): ShadowResponse {
  const checkedRequest = buildShadowRequest({
    requestId: request.request_id,
    episodeId: request.episode_id,
    features: request.features,
    action: request.action,
  });
  if (
    request.schema_version !== 1 ||
    JSON.stringify(request.legal_actions) !== JSON.stringify(checkedRequest.legal_actions)
  ) {
    throw new Error("invalid retained request");
  }
  const source = record(value);
  exactKeys(source, [
    "schema_version",
    "request_id",
    "episode_id",
    "shadow_only",
    "action",
    "choice_probabilities",
    "predicted_outcome",
    "checkpoint",
  ]);
  if (
    source.schema_version !== 1 ||
    source.shadow_only !== true ||
    source.request_id !== request.request_id ||
    source.episode_id !== request.episode_id ||
    source.action !== request.action
  ) {
    throw new Error("response does not match the shadow request");
  }
  const checkpoint = checkpointFrom(source.checkpoint);
  const expected = checkpointFrom(expectedCheckpoint);
  if (checkpoint.sha256 !== expected.sha256 || checkpoint.variant !== expected.variant) {
    throw new Error("response does not match the expected checkpoint");
  }
  const distribution = record(source.choice_probabilities);
  exactKeys(distribution, checkedRequest.legal_actions);
  const probabilities: Partial<Record<Action, number>> = {};
  let total = 0;
  for (const action of checkedRequest.legal_actions) {
    const p = probability(distribution[action]);
    probabilities[action] = p;
    total += p;
  }
  if (Math.abs(total - 1) > 1e-5) throw new Error("probabilities must sum to one");
  const outcome = record(source.predicted_outcome);
  exactKeys(outcome, ["recovered", "alarm", "injury"]);
  return {
    schema_version: 1,
    request_id: request.request_id,
    episode_id: request.episode_id,
    shadow_only: true,
    action: request.action,
    choice_probabilities: probabilities,
    predicted_outcome: {
      recovered: probability(outcome.recovered),
      alarm: probability(outcome.alarm),
      injury: probability(outcome.injury),
    },
    checkpoint,
  };
}
