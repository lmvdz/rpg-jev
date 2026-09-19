/**
 * What the client needs of a world, and nothing more: which processes it can
 * compile, what can be sought where the actor stands, what an element is
 * like, and `act`: answers in, the act's process and its changes out. Behind
 * it sit `matter.compile` and `matter.resolve` (packages/core); the world's
 * state, its bodies and the hands that stand for "bare hands" are its own
 * business. Only code writes world state (rule 1): the client hands over
 * answers chosen from closed sets and draws what comes back.
 */
import { type ActRequest, type Answers, REACH } from "./act-request.ts";
import { answersFit } from "./intents.ts";
import type { ElementView, WorldChange, WorldLink } from "./world-link.ts";

export interface Outcome {
  /** The world's name for the process that was resolved (`force`, `soak`...). */
  process: string;
  changes: readonly WorldChange[];
}

export interface WorldPort {
  /** The vocabulary ids of the processes the world compiles today. */
  compiled: readonly string[];
  /** Element ids that can be looked for where the actor is: a closed set the world builds. */
  sought(): readonly string[];
  elementOf(id: string): ElementView | null;
  /**
   * Compiles the answers and resolves the act. `operands` maps the request's
   * operand ids to thing ids. Null means the answers name nothing that can be
   * done: an outcome, not an error.
   */
  act(answers: Answers, operands: Readonly<Record<string, string>>): Outcome | null;
}

export interface Performing {
  actorTile: number;
  targetTile: number;
  now: number;
}

/** How hard an act is shown, until the manner's effort is a level the client is told. */
const SHOWN_LEVEL = 3;

/**
 * Takes answers into the world and shows what came of them. Returns what to
 * say on the HUD: the world's notes, which are only ever set as text.
 */
export function perform(
  port: WorldPort | null,
  link: WorldLink,
  request: ActRequest,
  answers: Answers,
  at: Performing,
): string {
  if (!port) return "No world is attached yet to resolve that.";
  // Whoever chose them, the answers are options of the request's own questions or they go nowhere.
  if (!answersFit(request, answers)) return "That is not something that can be asked for here.";
  // Until the world has a move process to say what can be reached, the client's reach stands in.
  const onTarget = request.state.inReach.some((o) => o.isTarget && o.id === answers.patient);
  if (onTarget && request.state.target.distance > REACH) return "That is too far away.";
  const outcome = port.act(answers, request.things);
  if (!outcome) return "That comes to nothing.";
  const shown = {
    process: outcome.process,
    actorTile: at.actorTile,
    tile: at.targetTile,
    level: SHOWN_LEVEL,
    now: at.now,
  };
  const notes = link.show(shown, outcome.changes);
  return notes.length > 0 ? notes.join(" ") : "Nothing seems to change.";
}
