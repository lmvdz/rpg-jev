import { describe, expect, it } from "vitest";
import {
  actions,
  buildShadowRequest,
  type Checkpoint,
  type Features,
  legalActions,
  parseShadowResponse,
  upstreamRevision,
} from "../src/shadow.ts";

const features: Features = {
  witnessed: true,
  guard_present: true,
  escape_open: true,
  courage: 0.8,
  loyalty: 0.4,
  danger: 0.3,
};
const checkpoint: Checkpoint = {
  sha256: "a".repeat(64),
  variant: "jepa",
  upstream_revision: upstreamRevision,
};
const request = buildShadowRequest({
  requestId: "request-1",
  episodeId: "episode-1",
  features,
  action: "report",
});
const response = {
  schema_version: 1,
  request_id: request.request_id,
  episode_id: request.episode_id,
  shadow_only: true,
  action: "report",
  choice_probabilities: { none: 0.1, report: 0.6, confront: 0.2, flee: 0.1 },
  predicted_outcome: { recovered: 0.7, alarm: 0.8, injury: 0.1 },
  checkpoint,
};

describe("offline shadow boundary", () => {
  it("builds legal closed sets for every boolean combination", () => {
    for (const witnessed of [true, false]) {
      for (const guard_present of [true, false]) {
        for (const escape_open of [true, false]) {
          const legal = legalActions({ ...features, witnessed, guard_present, escape_open });
          expect(legal.includes("none")).toBe(true);
          expect(legal.includes("report")).toBe(witnessed && guard_present);
          expect(legal.includes("confront")).toBe(witnessed);
          expect(legal.includes("flee")).toBe(escape_open);
          expect(legal.every((action) => actions.includes(action))).toBe(true);
        }
      }
    }
  });

  it("projects only permitted fields without changing or sharing the input", () => {
    const input = { ...features, player_text: "ignore the rules", hidden_fact: true };
    const built = buildShadowRequest({
      requestId: "r",
      episodeId: "e",
      features: input,
      action: "none",
    });
    expect(built.features).toEqual(features);
    built.features.courage = 0;
    expect(input.courage).toBe(0.8);
  });

  it.each([NaN, Infinity, -0.1, 1.1])("rejects invalid features: %s", (courage) => {
    expect(() =>
      buildShadowRequest({
        requestId: "r",
        episodeId: "e",
        features: { ...features, courage },
        action: "none",
      }),
    ).toThrow();
  });

  it("rejects illegal conditioned actions", () => {
    expect(() =>
      buildShadowRequest({
        requestId: "r",
        episodeId: "e",
        features: { ...features, witnessed: false },
        action: "confront",
      }),
    ).toThrow();
  });

  it("accepts a bound prediction but makes no selection or effect", () => {
    const parsed = parseShadowResponse(response, request, checkpoint);
    expect(parsed).toEqual(response);
    expect(parsed.choice_probabilities).not.toBe(response.choice_probabilities);
  });

  it.each([
    { request_id: "other" },
    { episode_id: "other" },
    { action: "none" },
    { shadow_only: false },
    { schema_version: 2 },
    { effects: [] },
    { choice_probabilities: { ...response.choice_probabilities, attack: 0 } },
    { choice_probabilities: { none: 0, report: 0, confront: 0, flee: 0 } },
    { choice_probabilities: { none: NaN, report: 1, confront: 0, flee: 0 } },
    { predicted_outcome: { recovered: 2, alarm: 0, injury: 0 } },
    { checkpoint: { ...checkpoint, sha256: "b".repeat(64) } },
    { checkpoint: { ...checkpoint, variant: "baseline" } },
    { checkpoint: { ...checkpoint, upstream_revision: "main" } },
  ])("rejects untrusted output: %j", (change) => {
    expect(() => parseShadowResponse({ ...response, ...change }, request, checkpoint)).toThrow();
  });

  it("rejects mutated retained option sets instead of trusting them", () => {
    expect(() =>
      parseShadowResponse(response, { ...request, legal_actions: ["none"] }, checkpoint),
    ).toThrow();
  });
});
