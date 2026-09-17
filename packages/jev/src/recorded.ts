/**
 * The fake judge for tests (SPEC.md section 13): answers recorded from live
 * Jev, replayed by request id, offline and deterministic. A request that was
 * never recorded is an error, so a changed slice or question shows up as a
 * failing test and not as silently different behaviour.
 */
import type { JudgeAnswer } from "@rpg-jev/core";
import { type Judge, type JudgeRequest, type JudgeResponse, JudgeUnavailable } from "./judge.ts";

export interface Recording {
  answers: Record<string, JudgeAnswer>;
  inputTokens: number;
  latencyMs: number;
}

export type Recordings = Record<string, Recording>;

export class RecordingMiss extends JudgeUnavailable {
  readonly requestId: string;
  constructor(requestId: string, questionIds: string[]) {
    super(`no recorded answer for request ${requestId} (${questionIds.join(", ")})`);
    this.requestId = requestId;
  }
}

export class RecordedJudge implements Judge {
  readonly #recordings: Recordings;
  readonly misses: string[] = [];
  hits = 0;

  constructor(recordings: Recordings) {
    this.#recordings = recordings;
  }

  ask(request: JudgeRequest): Promise<JudgeResponse> {
    const hit = this.#recordings[request.id];
    if (!hit) {
      this.misses.push(request.id);
      return Promise.reject(new RecordingMiss(request.id, Object.keys(request.questions)));
    }
    this.hits += 1;
    return Promise.resolve({ ...hit, source: "jev" });
  }
}

/** Wraps a judge and keeps what it answered, to be written out as a recording file. */
export class Recorder implements Judge {
  readonly #inner: Judge;
  readonly recordings: Recordings = {};

  constructor(inner: Judge) {
    this.#inner = inner;
  }

  async ask(request: JudgeRequest): Promise<JudgeResponse> {
    const response = await this.#inner.ask(request);
    if (response.source === "jev")
      this.recordings[request.id] = {
        answers: response.answers,
        inputTokens: response.inputTokens,
        latencyMs: response.latencyMs,
      };
    return response;
  }
}

/** A judge driven by a function, for unit tests that need particular answers. */
export class ScriptedJudge implements Judge {
  readonly #answer: (id: string, request: JudgeRequest) => JudgeAnswer | undefined;
  readonly requests: JudgeRequest[] = [];

  constructor(answer: (id: string, request: JudgeRequest) => JudgeAnswer | undefined) {
    this.#answer = answer;
  }

  ask(request: JudgeRequest): Promise<JudgeResponse> {
    this.requests.push(request);
    const answers: Record<string, JudgeAnswer> = {};
    for (const [id, asked] of Object.entries(request.questions))
      answers[id] = this.#answer(id, request) ?? asked.fallback;
    return Promise.resolve({ answers, source: "jev", inputTokens: 0, latencyMs: 0 });
  }
}
