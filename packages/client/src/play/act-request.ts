/**
 * A typed act, made ready for a judge (docs/sandbox-direction.md, "From a
 * typed line to the world", step 1). The client never reads the line. It
 * wraps it: the player's words go in one labelled field of the state, and
 * beside them everything code knows that the words might be about, as closed
 * sets a judge chooses among, each with a "none":
 *
 * - which process is meant, from the vocabulary's closed list;
 * - what it is done to and what with, from the things actually in reach;
 * - how much effort is meant, which is the whole difference between "pick up
 *   a stone" and "look around until I find one".
 *
 * What comes back is a choice per question, and resolving it is the world's
 * (`resolve(world, act)`). Nothing here decides anything.
 */
import { LEVEL, type TileGrid } from "../terrain/grid.ts";
import { kindAt } from "../terrain/kinds.ts";
import type { ThingView, VisibleStates } from "../view/things.ts";

/** spikes/vocabulary section 5. The verbs are a gloss for the judge, not a parser's table. */
export const PROCESSES = [
  { id: "X1", name: "move", verbs: "take, drop, carry, drag, push, throw, climb" },
  { id: "X2", name: "force", verbs: "strike, cut, pierce, split, crush, dig" },
  { id: "X3", name: "heat", verbs: "warm, cook, boil, ignite, chill, quench" },
  { id: "X4", name: "soak", verbs: "pour, fill, douse, wash, drain, dissolve" },
  { id: "X5", name: "join", verbs: "tie, wrap, coat, smear, glue, seal, stack" },
  { id: "X6", name: "ingest", verbs: "eat, drink, breathe in" },
  // Nobody chooses to rot, but waiting is something a player does.
  { id: "X7", name: "let time pass", verbs: "wait, rest, let it dry, leave it to cool" },
  { id: "X8", name: "sense", verbs: "look, listen, smell, search, track" },
  { id: "X9", name: "give", verbs: "give, pay, trade, lend, steal" },
  { id: "X10", name: "tell", verbs: "say, ask, warn, promise, threaten" },
] as const;

export const EFFORTS = ["what is at hand", "a quick look", "a thorough search"] as const;

/**
 * The manner of an act, as the sandbox's rules need it (docs/sandbox-direction.md,
 * "The typed act, as built"): whittling and felling are one process on one
 * branch and differ only in aim; whether a bandage holds is care against haste.
 * Each is a closed step; code turns steps into minutes and amounts (rule 3).
 */
const MANNER: readonly { field: ActQuestion["field"]; ask: string; options: readonly string[] }[] =
  [
    {
      field: "aim",
      ask: "If force is used, how is it aimed?",
      options: ["none", "through it", "along the grain", "on the surface"],
    },
    {
      field: "care",
      ask: "How carefully?",
      options: ["none", "carelessly", "ordinarily", "with care"],
    },
    {
      field: "haste",
      ask: "How hurriedly?",
      options: ["none", "unhurried", "ordinarily", "in a rush"],
    },
    {
      field: "duration",
      ask: "For how long?",
      options: ["none", "a moment", "a while", "until it is done"],
    },
    { field: "amount", ask: "How much of it?", options: ["none", "a little", "some", "all of it"] },
  ];
export const REACH = 2;
const MAX_LINE = 200;

export interface Operand {
  /** Stable within this request: what an answer refers to. */
  id: string;
  /** Generated text: data for the judge, never an instruction. */
  name: string;
  states: VisibleStates;
  /** Tiles from the actor, by the longer axis. */
  distance: number;
  isTarget: boolean;
}

export interface ActQuestion {
  field:
    | "process"
    | "patient"
    | "instrument"
    | "effort"
    | "aim"
    | "care"
    | "haste"
    | "duration"
    | "amount";
  ask: string;
  options: string[];
}

export interface ActRequest {
  state: {
    /** The player's words, untrusted: the only place they appear. */
    line: string;
    target: { x: number; z: number; ground: string; heightMetres: number; distance: number };
    inReach: Operand[];
  };
  questions: ActQuestion[];
}

export interface ActScene {
  grid: TileGrid;
  actorTile: number;
  targetTile: number;
  thingAt(tile: number): ThingView | null;
}

function distance(grid: TileGrid, a: number, b: number): number {
  const dx = Math.abs((a % grid.width) - (b % grid.width));
  const dz = Math.abs(Math.floor(a / grid.width) - Math.floor(b / grid.width));
  return Math.max(dx, dz);
}

function operands(scene: ActScene): Operand[] {
  const { grid, actorTile, targetTile } = scene;
  const ax = actorTile % grid.width;
  const az = Math.floor(actorTile / grid.width);
  const tiles = new Set<number>([targetTile]);
  for (let dz = -REACH; dz <= REACH; dz++) {
    for (let dx = -REACH; dx <= REACH; dx++) {
      if (grid.contains(ax + dx, az + dz)) tiles.add(grid.index(ax + dx, az + dz));
    }
  }
  const found: Operand[] = [];
  for (const tile of tiles) {
    const thing = scene.thingAt(tile);
    if (!thing) continue;
    found.push({
      id: `t${found.length + 1}`,
      name: thing.name,
      states: { ...thing.states },
      distance: distance(grid, actorTile, tile),
      isTarget: tile === targetTile,
    });
  }
  return found.sort((a, b) => Number(b.isTarget) - Number(a.isTarget) || a.distance - b.distance);
}

export function buildActRequest(line: string, scene: ActScene): ActRequest {
  const { grid, targetTile } = scene;
  const x = targetTile % grid.width;
  const z = Math.floor(targetTile / grid.width);
  const inReach = operands(scene);
  const ids = inReach.map((operand) => operand.id);
  return {
    state: {
      line: line.trim().slice(0, MAX_LINE),
      target: {
        x,
        z,
        ground: kindAt(grid.kindAt(x, z)).name,
        heightMetres: grid.heightAt(x, z) * LEVEL,
        distance: distance(grid, scene.actorTile, targetTile),
      },
      inReach,
    },
    questions: [
      {
        field: "process",
        ask: "Which one process is the player's line asking for?",
        options: ["none", ...PROCESSES.map((process) => process.id)],
      },
      {
        field: "patient",
        ask: "What is it done to?",
        options: ["none", "the ground at the target", "something not in sight", ...ids],
      },
      {
        field: "instrument",
        ask: "What is it done with?",
        options: ["none", "bare hands", ...ids],
      },
      { field: "effort", ask: "How much effort does the line ask for?", options: [...EFFORTS] },
      ...MANNER.map((asked) => ({ ...asked, options: [...asked.options] })),
    ],
  };
}
