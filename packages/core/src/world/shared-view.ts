/**
 * The finite, public surface the host projects to a viewer (SPEC.md section
 * 19): what the world's `SharedState` looks like to one actor, and nothing
 * it should not see (never another body's needs, memory or intentions). It
 * is pure data, read by the client's renderer and written by the host's
 * projection, so it lives where both can import it without either depending
 * on the other.
 */
import type { ElementView } from "./element-view.ts";
import type { ThingView } from "./scene-thing.ts";

export interface Meter {
  id: string;
  label: string;
  /** 0 empty to 1 full. */
  level: number;
  /** Palette index of the bar. */
  ink: number;
}

export interface Count {
  id: string;
  label: string;
  value: number;
}

/** What the status display is handed about a body: meters and counts, as rows. */
export interface BodyView {
  meters: Meter[];
  counts: Count[];
}

/** One thing the actor is aware of now: what it came from, by which channel, how strongly. */
export interface Aware {
  source: string;
  /** The source's name: generated text, set as text only. */
  name: string;
  channel: string;
  strength: number;
}

/** The finite, public surface the host permits this viewer to see. */
export interface SharedView {
  generation?: string;
  pauseReason?: string | null;
  actor: string;
  revision: number;
  tick: number;
  sequence: number;
  seed: number;
  position: [number, number];
  things: ThingView[];
  elements: Record<string, ElementView>;
  body: BodyView;
  aware: Aware[];
  compiled: string[];
  sought: string[];
}

/** Element presentation is sent once; instance overrides remain authoritative. */
export function sharedThings(view: SharedView): ThingView[] {
  return view.things.map((thing) => {
    const element = view.elements[thing.element];
    if (!element) return thing;
    return {
      ...(element.look ? { look: element.look } : {}),
      ...(element.forms ? { forms: element.forms } : {}),
      ...(element.baseline ? { baseline: element.baseline } : {}),
      ...thing,
    };
  });
}
