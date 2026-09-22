/**
 * What the world shows of an element and of a thing's hidden state, as public
 * data only (SPEC.md section 19, docs/sandbox-direction.md). It knows no
 * thing and no element by name: what a state of the world shows as is one
 * rule per state, written once here, so both the renderer and the host's
 * projection agree on what "shown" means.
 */
import type { ElementLook, VisibleStates } from "./scene-thing.ts";

/** What the client is told of an element: the row's name, look and what births are decided from. */
export interface ElementView {
  name: string;
  kind?: string;
  forms?: readonly string[];
  baseline?: Readonly<Record<string, number>>;
  look?: ElementLook;
  solid?: boolean;
}

/** The part of the world's `ThingState` that can be seen. A hidden flaw, temper and taint are not here. */
export interface SeenState {
  temperature: number;
  /** How far the surface runs above the bulk: what glows before it is hot through. */
  surfaceAbove: number;
  wetness: number;
  wetWith: string | null;
  integrity: number;
  amount: number;
  corrosion: number;
  contamination: number;
}

/** A thing as it is after an act: what the world's adapter reads off `outcome.world`. */
export interface Seen {
  element: string;
  state: Partial<SeenState>;
  /**
   * How hard it burns, 0 when it does not, else up to 5 (`matter.blaze`): the
   * world derives it from what is burning, how much of the thing that covers
   * and whether it is near its end. Fuel is how long it lasts, not how hard.
   */
  blaze: number;
}

/** Below this, rot gives no sign anyone would notice (it smells from about here up). */
const NOTICED = 1.5;

const level = (n: number) => Math.min(Math.max(Math.round(n), 0), 5);

/** One rule per state of the world: what it shows as. */
const SHOWN: readonly ((seen: Seen, out: VisibleStates) => void)[] = [
  (seen, out) => {
    // What burns at all shows as burning, however low.
    out.burning = seen.blaze > 0 ? Math.max(level(seen.blaze), 1) : 0;
  },
  ({ state }, out) => {
    if (state.temperature === undefined && state.surfaceAbove === undefined) return;
    // The surface is what is seen and felt first.
    out.temperature = level((state.temperature ?? 2) + (state.surfaceAbove ?? 0));
  },
  ({ state }, out) => {
    if (state.wetness !== undefined) out.wetness = level(state.wetness);
  },
  ({ state }, out) => {
    if (state.integrity !== undefined) out.integrity = level(state.integrity);
  },
  ({ state }, out) => {
    if (state.amount !== undefined) out.amount = level(state.amount);
  },
  ({ state }, out) => {
    if (state.corrosion !== undefined) out.corrosion = level(state.corrosion);
  },
  ({ state }, out) => {
    if (state.contamination === undefined) return;
    out.contamination = state.contamination >= NOTICED ? level(state.contamination) : 0;
  },
];

/** What a thing shows as, laid over what it showed before (growth is not the world's yet). */
export function shownOf(seen: Seen, before: VisibleStates = {}): VisibleStates {
  const out = { ...before };
  for (const rule of SHOWN) rule(seen, out);
  // What does not burn has no such state to show: a thing is not a fire that happens to be out.
  const { burning, ...rest } = out;
  return burning ? { ...rest, burning } : rest;
}
