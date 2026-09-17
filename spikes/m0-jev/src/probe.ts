import type { JsonValue, Questions } from "@typesafe-ai/sdk";

export type State = { [key: string]: JsonValue };

export type ProbeMeta =
  | {
      /** A scenario whose answer is compared with the reference panel (test 1). */
      test: "judgment";
      family: string;
      /** Our own prior from run one. Kept for continuity; the verdict no longer uses it. */
      label: "contested" | "obvious" | "mixed";
      question: string;
    }
  | { test: "scale"; npcs: number }
  | { test: "sensitivity"; base: string; role: "base"; question: string }
  | {
      test: "sensitivity";
      base: string;
      role: "directional";
      question: string;
      change: string;
      target: string;
      direction: "up" | "down";
    }
  | { test: "sensitivity"; base: string; role: "control"; question: string; change: string }
  | { test: "paraphrase"; family: string; question: string }
  | {
      test: "isolation";
      caseId: string;
      variant: "leak" | "clean" | "solo";
      /** Question about the NPC who must NOT know the secret. */
      question: string;
      /** Option (or "yes" for a Noul) whose probability a leak would move. */
      leakOption: string;
      leakDirection: "up" | "down";
      /** Question about the NPC who DOES know; proves the secret is legible. */
      control: string | null;
      controlOption: string;
    }
  | { test: "intent"; expected: { verb: string; target: string } }
  | { test: "determinism"; question: string };

export type TestName = ProbeMeta["test"];

export interface Probe {
  id: string;
  repeats: number;
  /** False sends byte-identical requests; true adds a fresh `_run` field per call. */
  nonce: boolean;
  state: State;
  questions: Questions;
  meta: ProbeMeta;
}

export type AnswerJson =
  | { type: "noul"; noul: number }
  | { type: "choice"; choice: string; confidence: number; probabilities: Record<string, number> }
  | {
      type: "score";
      score: number;
      confidence: number;
      probabilities: Record<string, number>;
    };

export interface CallRecord {
  probeId: string;
  rep: number;
  ok: boolean;
  latencyMs: number;
  retries: number;
  requestId: string | null;
  model: string | null;
  inputTokens: number | null;
  answers: Record<string, AnswerJson> | null;
  error: string | null;
}

export interface RunFile {
  startedAt: string;
  finishedAt: string;
  requestedModel: string;
  sdkVersion: string;
  /** The pass criteria in force when the run was made. */
  criteria: Record<string, number>;
  probes: Probe[];
  calls: CallRecord[];
}

export interface LabelItem {
  probeId: string;
  question: string;
  samples: { model: string; probabilities: Record<string, number> }[];
  mean: Record<string, number>;
  /** Mean pairwise distance between the labellers: the noise floor of the reference. */
  panelDisagreement: number;
}

export interface LabelFile {
  createdAt: string;
  panel: { model: string; samples: number }[];
  system: string;
  items: LabelItem[];
}
