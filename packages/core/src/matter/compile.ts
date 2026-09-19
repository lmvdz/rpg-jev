/**
 * The act compiler: the step between what the parse answered and what the rules take. The
 * answers are the chosen options of closed questions (the client builds them in
 * `packages/client/src/play/act-request.ts`; a judge, or the right-click menu, picks one of
 * each). Nothing here reads the player's line. Words become levels, minutes and amounts in
 * code (SPEC.md rule 3), and an answer that names no act compiles to nothing, never an error.
 *
 * A process is a row in `COMPILERS`, so admitting one does not grow the interface.
 */
import type { Act } from "./resolve.ts";
import type { Manner, MatterWorld } from "./types.ts";

/** One chosen option per question, exactly as the request offered it. */
export interface Answers {
  process: string;
  patient: string;
  instrument: string;
  effort: string;
  aim: string;
  care: string;
  haste: string;
  duration: string;
  amount: string;
  /** Which kind of thing is sought, when the patient is not in sight. An element id, or none. */
  kind?: string;
}

export interface Compiling {
  answers: Answers;
  /** The request's operand ids (t1, t2...) to the ids of things in the world. */
  operands: Record<string, string>;
  /** The body that acts, and the thing that stands for its bare hands. */
  actor: string;
  hands: string;
  /** Where the actor is. */
  place: string;
  /** A draw in [0, 1) that the caller made and logged; only a search uses it. */
  draw: number;
}

export const NONE = "none";
export const GROUND = "the ground at the target";
export const UNSEEN = "something not in sight";
export const BARE_HANDS = "bare hands";

const EFFORT: Record<string, number> = {
  "what is at hand": 1,
  "a quick look": 2,
  "a thorough search": 4,
};
const CARE: Record<string, number> = { carelessly: 0, ordinarily: 2, "with care": 4 };
const HASTE: Record<string, number> = { unhurried: 0, ordinarily: 2, "in a rush": 4 };
const AIM: Record<string, "through" | "along" | "surface"> = {
  "through it": "through",
  "along the grain": "along",
  "on the surface": "surface",
};
/** How long each step of duration is, by what is being done. */
const MINUTES: Record<string, Record<string, number>> = {
  heat: { "a moment": 0.2, "a while": 5, "until it is done": 30 },
  drift: { "a moment": 1, "a while": 30, "until it is done": 240 },
  search: { "a moment": 1, "a while": 10, "until it is done": 60 },
};
const SECONDS: Record<string, number> = { "a moment": 0.3, "a while": 3, "until it is done": 10 };
const SHARE: Record<string, number> = { "a little": 0.1, some: 0.5, "all of it": 1 };

interface Ctx extends Compiling {
  world: MatterWorld;
  manner: Manner;
  /** The thing ids the answers point at, or null when they point at no thing. */
  patient: string | null;
  instrument: string | null;
}

function operand(c: Compiling, world: MatterWorld, option: string): string | null {
  if (option === BARE_HANDS) return c.hands in world.things ? c.hands : null;
  const id = c.operands[option];
  return id !== undefined && id in world.things ? id : null;
}

const minutes = (process: string, c: Ctx, fallback: number) =>
  MINUTES[process]?.[c.answers.duration] ?? fallback;

/** A share of what there is of a thing, as the answer worded it. */
function share(c: Ctx, thing: string | null, fallback: number): number {
  const amount = c.world.things[thing ?? ""]?.state.amount ?? 1;
  return amount * (SHARE[c.answers.amount] ?? fallback);
}

type Compiler = (c: Ctx) => Act | null;

export const COMPILERS: Record<string, Compiler> = {
  // X1 move, X9 give and X10 tell have no process in matter yet.
  X2: (c) => {
    const instrument = c.instrument ?? (c.hands in c.world.things ? c.hands : null);
    const patient = c.patient ?? (c.answers.patient in c.world.bodies ? c.answers.patient : null);
    if (!(instrument && patient)) return null;
    const aim = AIM[c.answers.aim];
    const seconds = SECONDS[c.answers.duration] ?? 0.3;
    const act: Act = { process: "force", instrument, patient, manner: c.manner, seconds };
    return aim ? { ...act, aim } : act;
  },
  // What it is heated with is the instrument: "put the sword in the fire".
  X3: (c) =>
    c.instrument && c.patient
      ? {
          process: "heat",
          source: c.instrument,
          target: c.patient,
          minutes: minutes("heat", c, 2),
          // A hurried hand does not hold it close for long.
          contact: c.manner.haste >= 4 ? 0.6 : 1,
        }
      : null,
  X4: (c) =>
    c.instrument && c.patient
      ? {
          process: "soak",
          liquid: c.instrument,
          target: c.patient,
          amount: share(c, c.instrument, 0.5),
        }
      : null,
  X5: (c) =>
    c.instrument && c.patient
      ? {
          process: "coat",
          substance: c.instrument,
          target: c.patient,
          amount: share(c, c.instrument, 0.2),
          manner: c.manner,
        }
      : null,
  X6: (c) =>
    c.patient && c.actor in c.world.bodies
      ? { process: "ingest", body: c.actor, thing: c.patient, amount: share(c, c.patient, 1) }
      : null,
  X7: (c) => ({ process: "drift", minutes: minutes("drift", c, 30) }),
  // Looking for what is not in sight. What is in sight needs no search.
  X8: (c) => {
    const kind = c.answers.kind;
    if (c.answers.patient !== UNSEEN || !kind || kind === NONE) return null;
    if (!(kind in c.world.elements)) return null;
    // Effort is time when searching; a worded duration overrides it.
    const byEffort = [1, 1, 10, 30, 60, 120][c.manner.effort] ?? 10;
    const spent = MINUTES.search?.[c.answers.duration] ?? byEffort;
    return { process: "search", place: c.place, element: kind, minutes: spent, draw: c.draw };
  },
};

/** The answers, as an act the rules can resolve; null when they name nothing that can be done. */
export function compile(world: MatterWorld, c: Compiling): Act | null {
  const compiler = COMPILERS[c.answers.process];
  if (!compiler) return null;
  const manner: Manner = {
    effort: EFFORT[c.answers.effort] ?? 2,
    care: CARE[c.answers.care] ?? 2,
    haste: HASTE[c.answers.haste] ?? 2,
  };
  return compiler({
    ...c,
    world,
    manner,
    patient: operand(c, world, c.answers.patient),
    instrument: operand(c, world, c.answers.instrument),
  });
}

/** Which processes have a compiler, for building the menu of what can be tried on a thing. */
export const COMPILED = Object.keys(COMPILERS);
