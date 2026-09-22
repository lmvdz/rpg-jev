/**
 * What the client needs of a world, and nothing more: which processes it can
 * compile, what can be sought where the actor stands, what an element is
 * like, and `act`: answers in, the act's process and its changes out. Behind
 * it sit `matter.compile` and `matter.resolve` (packages/core); the world's
 * state, its bodies and the hands that stand for "bare hands" are its own
 * business. Only code writes world state (rule 1): the client hands over
 * answers chosen from closed sets and draws what comes back.
 */
import type { Aware } from "@rpg-jev/core/world";
import type { BodyView } from "../view/body.ts";
import { type ActRequest, type Answers, REACH } from "./act-request.ts";
import { answersFit } from "./intents.ts";
import type { After, ElementView, WorldChange, WorldLink } from "./world-link.ts";

export type { Aware };

export interface Outcome {
  /** The world's name for the process that was resolved (`force`, `soak`...). */
  process: string;
  changes: readonly WorldChange[];
  /**
   * Every thing a change names, as the world has it after the act, or null if
   * it is no more. The world applied the changes; the client only draws this.
   */
  after: After;
  /**
   * Bodies that went somewhere in the turn, by id, and the tile each is on
   * now: creatures act by their own needs after the actor has.
   */
  moved?: Readonly<Record<string, readonly [number, number]>>;
}

/**
 * What the client still owns and the world needs for an act: where the actor
 * stands (positions are the client's until the world has a move process) and
 * the hour (the sky is the client's until the world has a clock).
 */
export interface Standing {
  where: readonly [number, number];
  hour: number;
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
  act(
    answers: Answers,
    operands: Readonly<Record<string, string>>,
    standing?: Standing,
  ): Outcome | null;
  /** What the actor is aware of now, strongest first: sensed by the world at the end of every act. */
  aware?(): Aware[];
  /**
   * The actor's body as rows for the status display: health and each need,
   * with the words and colours as data. The same object every time, changed
   * in place after an act, so asking every frame allocates nothing.
   */
  body?(): BodyView;
}

export interface Performing {
  actorTile: number;
  targetTile: number;
  now: number;
  standing?: Standing;
}

/** How a channel is said. What is merely seen is just named: by daylight that is most of what is near. */
const CHANNEL_WORDS: Readonly<Record<string, string>> = {
  light: "the light of ",
  smoke: "smoke from ",
  sound: "the sound of ",
  scent: "the smell of ",
  sight: "",
};
const NOTICED_AT_MOST = 3;

/**
 * What the actor notices, as a line for the HUD, or nothing. What gives
 * something off is said before what is merely there to be seen, then the
 * strongest, as the world itself ranks what a body attends to. Names in it are
 * generated text.
 */
export function noticed(aware: readonly Aware[]): string {
  const gives = (one: Aware) => (one.channel === "sight" ? 0 : 1);
  const ranked = [...aware].sort((a, b) => gives(b) - gives(a) || b.strength - a.strength);
  const said = ranked
    .slice(0, NOTICED_AT_MOST)
    .map((one) => `${CHANNEL_WORDS[one.channel] ?? `${one.channel} of `}${one.name}`);
  return said.length > 0 ? `you notice ${said.join(", ")}` : "";
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
  const outcome = port.act(answers, request.things, at.standing);
  if (!outcome) return "That comes to nothing.";
  const shown = {
    process: outcome.process,
    actorTile: at.actorTile,
    tile: at.targetTile,
    level: SHOWN_LEVEL,
    now: at.now,
  };
  return told(link.show(shown, outcome.changes, outcome.after, outcome.moved));
}

/** How many different things the HUD says of one act. Time passing touches everything at once. */
const SAID_AT_MOST = 3;

/** The world's notes as one line: each said once, the first few, and how many more there were. */
export function told(notes: readonly string[]): string {
  const different = [...new Set(notes)];
  if (different.length === 0) return "Nothing seems to change.";
  const more = different.length - SAID_AT_MOST;
  const said = different.slice(0, SAID_AT_MOST).join("; ");
  return more > 0 ? `${said}; and ${more} more` : said;
}
