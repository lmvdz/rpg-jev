/**
 * An actor's motion as a kind of born row (`birth.ts`). The subject is a part
 * in an act, in the vocabulary's terms: which process, whether this glyph is
 * the one acting or the one acted on, the manner (effort, care, haste;
 * principle 5) and how heavy the body is. An ability will carry the row that
 * is born for it; until abilities exist, the pair of process and part is what
 * it is born for.
 */
import { asker, type Hints, LEVEL_WEIGHTS, LEVELS, type Question, type RowKind } from "./birth.ts";
import { EASINGS } from "./effects.ts";
import { ACTOR_MOTIONS, checkMotion, type MotionRow } from "./motions.ts";

/** The vocabulary's processes, by id. `play/act-request.ts` holds their names; a test holds the two equal. */
export const PROCESS_IDS = ["X1", "X2", "X3", "X4", "X5", "X6", "X7", "X8", "X9", "X10"] as const;
export const PARTS = ["actor", "patient"] as const;
export const MOTION_LEVELS = ["mass", "effort", "care", "haste"] as const;

export interface MotionSubject {
  /** What the body or the ability is called: generated text, one labelled field, never parsed. */
  name: string;
  process: (typeof PROCESS_IDS)[number];
  part: (typeof PARTS)[number];
  levels: Partial<Record<(typeof MOTION_LEVELS)[number], number>>;
}

const acts = (s: MotionSubject, ...processes: MotionSubject["process"][]) =>
  s.part === "actor" && processes.includes(s.process);
const suffers = (s: MotionSubject, ...processes: MotionSubject["process"][]) =>
  s.part === "patient" && processes.includes(s.process);

const HINTS: readonly Hints<MotionSubject>[] = [
  {
    // Force goes at its target and is over quickly.
    when: (s) => acts(s, "X2"),
    hints: [
      ["motion", "lunge", 5],
      ["easing", "out", 3],
      ["duration", "1", 3],
    ],
  },
  {
    // Joining and giving reach towards the other, gently.
    when: (s) => acts(s, "X5", "X9", "X4"),
    hints: [
      ["motion", "lunge", 3],
      ["strength", "1", 3],
      ["easing", "inOut", 2],
    ],
  },
  {
    when: (s) => acts(s, "X1"),
    hints: [
      ["motion", "hop", 4],
      ["duration", "2", 2],
    ],
  },
  {
    // Sensing, waiting, speaking and eating move the glyph little or not at all.
    when: (s) => acts(s, "X6", "X7", "X8", "X10"),
    hints: [["motion", "none", 4]],
  },
  {
    // What is forced and is heavy shudders where it stands; what is light is thrown back.
    when: (s) => suffers(s, "X2") && (s.levels.mass ?? 3) >= 3,
    hints: [
      ["motion", "shake", 5],
      ["duration", "3", 2],
      ["easing", "linear", 2],
    ],
  },
  {
    when: (s) => suffers(s, "X2") && (s.levels.mass ?? 3) < 3,
    hints: [
      ["motion", "recoil", 5],
      ["easing", "out", 2],
    ],
  },
  {
    when: (s) => s.part === "patient" && s.process !== "X2",
    hints: [["motion", "none", 3]],
  },
  {
    when: (s) => (s.levels.mass ?? 0) >= 4 && s.part === "patient",
    hints: [["strength", "1", 3]],
  },
  // The manner is the act's own, so it outweighs what the process alone suggests.
  {
    when: (s) => (s.levels.effort ?? 2) >= 4,
    hints: [["strength", "4", 6]],
  },
  {
    when: (s) => (s.levels.effort ?? 2) <= 1,
    hints: [["strength", "1", 6]],
  },
  {
    when: (s) => (s.levels.haste ?? 2) >= 4,
    hints: [["duration", "0", 6]],
  },
  {
    when: (s) => (s.levels.haste ?? 2) <= 1,
    hints: [["duration", "4", 6]],
  },
  {
    when: (s) => (s.levels.care ?? 2) >= 4,
    hints: [["easing", "inOut", 6]],
  },
];

export function motionQuestions(s: MotionSubject): Question[] {
  const ask = asker(s, HINTS);
  return [
    ask("motion", "How does its glyph move as this happens?", ["none", ...ACTOR_MOTIONS]),
    ask("easing", "How does the movement build and settle?", EASINGS),
    ask("strength", "How far does it move, 0 barely to 5 a long way?", LEVELS, LEVEL_WEIGHTS),
    ask("duration", "How long does it take, 0 a flick to 5 a full second?", LEVELS, LEVEL_WEIGHTS),
  ];
}

function rowOf(chosen: ReadonlyMap<string, string>): MotionRow | null {
  const motion = chosen.get("motion");
  if (motion === undefined || motion === "none") return null;
  const row: MotionRow = {
    motion: motion as MotionRow["motion"],
    easing: (chosen.get("easing") ?? "linear") as MotionRow["easing"],
    strength: Number(chosen.get("strength") ?? 0),
    duration: Number(chosen.get("duration") ?? 0),
  };
  return checkMotion(row) === null ? row : null;
}

export const MOTION_KIND: RowKind<MotionSubject, MotionRow> = {
  questions: motionQuestions,
  compose: rowOf,
};
