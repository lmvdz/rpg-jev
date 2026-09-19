/**
 * Acts that need no judge: the right-click menu's rows, built by code from
 * the closed set of processes for what is under the pointer and in reach. An
 * intent is the same answers a judge would give to the request's questions,
 * so a menu row and a typed line take one path into the world.
 *
 * A row of the table knows a process's roles (for heat the instrument is what
 * it is heated with; for soak and coat, what goes onto the patient) and what
 * can be seen of the operands. It knows no thing. Whether the act does
 * anything is the world's to say: an intent that comes to nothing is answered
 * with a note, like any other.
 */
import {
  type ActRequest,
  type Answers,
  BARE_HANDS,
  NONE,
  type Operand,
  PROCESSES,
  UNSEEN,
} from "./act-request.ts";

export interface Intent {
  /** Shown in the menu. It holds operand names, which are generated text: set as text only. */
  label: string;
  answers: Answers;
}

/** An ordinary try (the world's manner 2, 2, 2), for a moment, with some of it. */
const ORDINARY: Answers = {
  process: NONE,
  patient: NONE,
  instrument: NONE,
  effort: "what is at hand",
  aim: NONE,
  care: "ordinarily",
  haste: "ordinarily",
  duration: "a moment",
  amount: "some",
  kind: NONE,
};

/** How many things in reach a row is offered with, nearest first: a menu is not a catalogue. */
const WITH_AT_MOST = 2;

const pours = (operand: Operand) => operand.forms.includes("liquid");
const flows = (operand: Operand) => pours(operand) || operand.forms.includes("gas");
const spreads = (operand: Operand) => pours(operand) || operand.forms.includes("granular");
const heats = (operand: Operand) =>
  (operand.states.burning ?? 0) > 0 || (operand.states.temperature ?? 0) >= 4;

interface Scene {
  target: Operand | null;
  /** What else is in reach, nearest first. */
  others: readonly Operand[];
  sought: readonly string[];
}

const onto = (
  process: string,
  verb: string,
  scene: Scene,
  fits: (operand: Operand) => boolean,
): Intent[] => {
  const { target } = scene;
  if (!target) return [];
  return scene.others
    .filter(fits)
    .slice(0, WITH_AT_MOST)
    .map((tool) => ({
      label: `${verb} ${target.name} with ${tool.name}`,
      answers: { ...ORDINARY, process, patient: target.id, instrument: tool.id },
    }));
};

/** One row per process: the intents it offers for a scene. A process with no row is offered only by typing. */
const OFFERS: Readonly<Record<string, (scene: Scene) => Intent[]>> = {
  X2: (scene) => {
    const { target } = scene;
    if (!target) return [];
    const answers = { ...ORDINARY, process: "X2", patient: target.id, instrument: BARE_HANDS };
    // What flows cannot be swung, and nobody picks up what burns to hit with.
    const solid = (operand: Operand) => !(flows(operand) || heats(operand));
    return [{ label: `strike ${target.name}`, answers }, ...onto("X2", "strike", scene, solid)];
  },
  // Nothing warms in a moment: a menu's heating is held there a while.
  X3: (scene) =>
    onto("X3", "heat", scene, heats).map((intent) => ({
      ...intent,
      answers: { ...intent.answers, duration: "a while" },
    })),
  X4: (scene) => onto("X4", "soak", scene, pours),
  X5: (scene) => onto("X5", "coat", scene, spreads),
  X6: ({ target }) => {
    if (!target) return [];
    const answers = { ...ORDINARY, process: "X6", patient: target.id };
    return [{ label: `eat ${target.name}`, answers }];
  },
  X7: () => [
    { label: "wait a while", answers: { ...ORDINARY, process: "X7", duration: "a while" } },
  ],
  X8: ({ sought }) =>
    sought.map((kind) => ({
      label: `look around for ${kind}`,
      // For a search the effort is the time spent, and a worded duration would override it.
      answers: {
        ...ORDINARY,
        process: "X8",
        patient: UNSEEN,
        kind,
        effort: "a quick look",
        duration: NONE,
      },
    })),
};

/**
 * The intents for a request, for the processes the world can compile today
 * (`matter.COMPILED`), in the vocabulary's order. With no world attached
 * `compiled` is empty and so is the menu.
 */
export function intentsFor(request: ActRequest, compiled: readonly string[]): Intent[] {
  const { inReach } = request.state;
  const kinds = request.questions.find((asked) => asked.field === "kind")?.options ?? [];
  const scene: Scene = {
    target: inReach.find((operand) => operand.isTarget) ?? null,
    others: inReach.filter((operand) => !operand.isTarget),
    sought: kinds.filter((kind) => kind !== NONE),
  };
  const offered = PROCESSES.filter((process) => compiled.includes(process.id)).flatMap(
    (process) => OFFERS[process.id]?.(scene) ?? [],
  );
  // Two stones in reach read the same in a menu: the nearer is kept.
  const labels = new Set<string>();
  return offered.filter((intent) => !labels.has(intent.label) && labels.add(intent.label));
}

/** Whether every answer is one of its question's options: what is sent to the world is never anything else. */
export function answersFit(request: ActRequest, answers: Answers): boolean {
  return request.questions.every((asked) => asked.options.includes(answers[asked.field]));
}
