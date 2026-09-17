/**
 * The live judge: `@typesafe-ai/sdk`, pinned to `jev-1.13.0`. The key comes
 * from `TYPESAFE_API_KEY` in the environment and is never written anywhere.
 */
import type { JudgeAnswer } from "@rpg-jev/core";
import { type Questions, TypeSafeClient } from "@typesafe-ai/sdk";
import {
  type Judge,
  type JudgeRequest,
  type JudgeResponse,
  JudgeUnavailable,
  MODEL,
  wireQuestions,
} from "./judge.ts";

export interface LiveOptions {
  /** One attempt, this long. The game falls back; it does not wait. */
  timeoutMs?: number;
  onCall?: (request: JudgeRequest, response: JudgeResponse) => void;
}

export class LiveJudge implements Judge {
  readonly #client: TypeSafeClient;
  readonly #options: LiveOptions;

  constructor(options: LiveOptions = {}) {
    if (!process.env.TYPESAFE_API_KEY) throw new JudgeUnavailable("TYPESAFE_API_KEY is not set");
    this.#options = options;
    this.#client = new TypeSafeClient({
      defaultModel: MODEL,
      retry: { maxRetries: 0 },
      timeout: options.timeoutMs ?? 4000,
      logLevel: "off",
    });
  }

  async ask(request: JudgeRequest): Promise<JudgeResponse> {
    const started = performance.now();
    let data: Awaited<ReturnType<TypeSafeClient["systemOne"]>>;
    try {
      data = await this.#client.systemOne({
        state: request.state,
        questions: wireQuestions(request.questions) as Questions,
        model: MODEL,
      });
    } catch (error) {
      throw new JudgeUnavailable(error instanceof Error ? error.message : String(error));
    }
    const answers: Record<string, JudgeAnswer> = {};
    for (const [id, raw] of Object.entries(data.answers as Record<string, unknown>)) {
      const a = raw as {
        type: string;
        noul?: number;
        choice?: string;
        confidence?: number;
        probabilities?: Record<string, number>;
      };
      if (a.type === "noul" && typeof a.noul === "number")
        answers[id] = { type: "noul", noul: a.noul };
      else if (a.type === "choice" && a.choice !== undefined && a.probabilities)
        answers[id] = {
          type: "choice",
          choice: a.choice,
          confidence: a.confidence ?? 0,
          probabilities: a.probabilities,
        };
      else throw new JudgeUnavailable(`unexpected answer shape for ${id}`);
    }
    for (const id of Object.keys(request.questions))
      if (!answers[id]) throw new JudgeUnavailable(`no answer for ${id}`);

    const response: JudgeResponse = {
      answers,
      source: "jev",
      inputTokens: data.usage.input_tokens,
      latencyMs: Math.round(performance.now() - started),
    };
    this.#options.onCall?.(request, response);
    return response;
  }
}
