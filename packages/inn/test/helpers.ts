import type { JudgeAnswer } from "@rpg-jev/core";
import { type Judge, type JudgeRequest, ScriptedJudge } from "@rpg-jev/jev";
import { Game } from "../src/index.ts";

export const yes: JudgeAnswer = { type: "noul", noul: 0.97 };
export const no: JudgeAnswer = { type: "noul", noul: 0.03 };

/** All the mass on the first of `wanted` that the question actually offers. */
export function choose(
  request: JudgeRequest,
  id: string,
  wanted: string[],
): JudgeAnswer | undefined {
  const question = request.questions[id]?.question;
  if (question?.type !== "choice") return undefined;
  const labels = Object.keys(question.criteria);
  const hit = wanted
    .map((w) => labels.find((l) => l === w || l.startsWith(`${w}:`)))
    .find((l) => l !== undefined);
  if (!hit) return undefined;
  return {
    type: "choice",
    choice: hit,
    confidence: 1,
    probabilities: Object.fromEntries(labels.map((l) => [l, l === hit ? 1 : 0])),
  };
}

export type Script = (id: string, request: JudgeRequest) => JudgeAnswer | undefined;

/** A game whose judge answers from `script`; anything unscripted gets code's fallback answer. */
export function scripted(script: Script, seed = 1): { game: Game; judge: ScriptedJudge } {
  const judge = new ScriptedJudge(script);
  return { game: Game.start(seed, judge), judge };
}

export async function play(game: Game, inputs: string[]): Promise<string> {
  const out: string[] = [];
  for (const text of inputs) out.push(`> ${text}`, ...(await game.turn(text)));
  return out.join("\n");
}

export class CountingJudge implements Judge {
  calls = 0;
  readonly #inner: Judge;
  constructor(inner: Judge) {
    this.#inner = inner;
  }
  ask(request: JudgeRequest) {
    this.calls += 1;
    return this.#inner.ask(request);
  }
}
