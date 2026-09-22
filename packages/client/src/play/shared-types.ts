import type { BodyView } from "../view/body.ts";
import type { ThingView } from "../view/things.ts";
import type { Answers } from "./act-request.ts";
import type { ElementView } from "./world-link.ts";
import type { Aware } from "./world-port.ts";

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

/** Promises settle only after the accepted projection arrives, or reject visibly. */
export interface SharedConnection {
  move(to: readonly [number, number]): Promise<void>;
  act(answers: Answers, operands: Readonly<Record<string, string>>): Promise<void>;
  close(): void;
}
