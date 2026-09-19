/** Sketch of a paired (counterfactual) probe. Nothing here is imported by the repo. */
import type { Effect } from "@rpg-jev/core";
import type { Asked, Family, JsonObject, Variant } from "@rpg-jev/jev";

/**
 * How to get the base request. Rebuilding beats storing: a stored state goes stale when a
 * renderer changes, which is exactly the change a representation probe has to survive.
 */
export type Recipe =
  /**
   * Play these inputs from a seed; the probe is the LAST request that asks `question`.
   * `answers` scripts the judge on the way there (parse results, earlier choices), by question id.
   */
  | { kind: "play"; seed: number; inputs: string[]; answers: Record<string, string | number> }
  /** A request captured from a real night (needs slices in the log, or a night that still replays). */
  | { kind: "captured"; night: string; requestId: string; state: JsonObject };

/**
 * The counterfactual. World edits go through the game's own write path just before the last
 * input, so every renderer (owing(), feelingWords, beliefLine, the option builders) reacts as
 * it would in play.
 */
export type Edit =
  | { kind: "effects"; effects: Effect[] }
  | {
      kind: "learn";
      holder: string;
      claim: { subject: string; predicate: string; object?: string; to?: string; severity: number };
      credence: number;
      source: "witnessed" | "told" | "shown";
    }
  /** Representation edits: same world, different slice. "Does this field earn its tokens?" */
  | { kind: "drop_path"; path: string }
  /** Needs a path -> claim-id side map from compileSlice; today only a substring match is possible. */
  | { kind: "drop_line"; path: string; provenance: string }
  /** Swap one code renderer (eventLine, standing, ...) for a candidate. */
  | { kind: "renderer"; name: string; variant: string };

/**
 * What should move. Options are matched by pattern because an edit can rename them: the debt
 * twin turns `confide:c_ef9a...` into `tell:c_ef9a...`.
 */
export interface Expect {
  question: string;
  /** Noul: "yes". Choice: a RegExp source over option ids; the masses of all matches are summed. */
  mass: string;
  direction: "up" | "down" | "same";
  /** Smallest shift that counts ("same": largest allowed). Must exceed the repeat-noise floor. */
  by: number;
  /** Must hold in both wordings to pass; the paraphrase shift is reported beside it. */
  bothWordings: boolean;
}

export interface PairedProbe {
  id: string;
  family: Family;
  /** The finding or playtest this encodes. */
  why: string;
  base: Recipe;
  edit: Edit;
  expect: Expect[];
  /** Rebuilds the questions in wording `v` from the base request's option set. */
  questions?: (v: Variant, base: Record<string, Asked>) => Record<string, Asked>;
}

export interface ProbeScore {
  probe: string;
  met: boolean;
  /** Per wording, signed, on Expect.mass. */
  shift: number[];
  /** Total variation between the two wordings, base request. */
  paraphrase: number;
  /** Total variation between two asks of the identical base request. */
  noise: number;
  tokens: { base: number; twin: number };
}

// --- Instances (see live.ts for the run) ----------------------------------------------------

export const PROBES: PairedProbe[] = [
  {
    id: "tobin-debt-paid",
    family: "pick_speech_act",
    why: "slices.ts owing(): Tobin speaks freely or not at all depending on the debt line (m2-families FINDINGS)",
    base: {
      kind: "play",
      seed: 1,
      inputs: ["go yard", "ask tobin what he saw at dusk"],
      answers: { mode: "in_story", verb: "ask", target: "tobin", asks_about: "about:tonight" },
    },
    edit: {
      kind: "learn",
      holder: "tobin",
      claim: { subject: "player", predicate: "paid_debt", to: "tobin", severity: 2 },
      credence: 1,
      source: "witnessed",
    },
    expect: [{ question: "reply", mass: ":c_ef9aa3b936$", direction: "up", by: 0.3, bothWordings: true }],
  },
  {
    id: "tobin-owing-line-only",
    family: "pick_speech_act",
    why: "isolates the one circumstance line from the feeling and knows lines that the world edit also moves",
    base: {
      kind: "play",
      seed: 1,
      inputs: ["go yard", "ask tobin what he saw at dusk"],
      answers: { mode: "in_story", verb: "ask", target: "tobin", asks_about: "about:tonight" },
    },
    edit: { kind: "drop_line", path: "npcs.tobin.circumstances", provenance: "c_tobin_owes" },
    expect: [{ question: "reply", mass: ":c_ef9aa3b936$", direction: "up", by: 0.1, bothWordings: true }],
  },
  {
    id: "parse-lean-scene",
    family: "parse_intent",
    why: "scene.people/things/exits repeat the target and item criteria; are they dead weight?",
    base: { kind: "captured", night: "demo-0", requestId: "(4 demo parses)", state: {} },
    edit: { kind: "drop_path", path: "scene.{people,things,exits}" },
    expect: ["mode", "verb", "target", "item", "states", "asks_about", "request"].map((question) => ({
      question,
      mass: "(top option of base)",
      direction: "same" as const,
      by: 0.05,
      bothWordings: false,
    })),
  },
  {
    id: "guard-apron-proof",
    family: "quest_guard",
    why: "real decision 'show apron to mara' (culprit 0.56/0.61): the proof line should be what carries it",
    base: { kind: "captured", night: "demo-0", requestId: "guard@show apron to mara", state: {} },
    edit: { kind: "drop_line", path: "npcs.mara.recent_events", provenance: "c_apron" },
    expect: [
      { question: "culprit_a", mass: "yes", direction: "down", by: 0.15, bothWordings: true },
      { question: "culprit_b", mass: "yes", direction: "down", by: 0.15, bothWordings: true },
    ],
  },
];
