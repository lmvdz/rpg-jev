/**
 * The finite, public surface the host permits this viewer to see. Moved to
 * `packages/core/src/world/shared-view.ts` so the host's projection builds
 * and validates the same shape without depending on the client package. What
 * stays here is the client's own transport contract.
 */
import { type SharedView, sharedThings } from "@rpg-jev/core/world";
import type { Answers } from "./act-request.ts";

export { type SharedView, sharedThings };

/** Promises settle only after the accepted projection arrives, or reject visibly. */
export interface SharedConnection {
  move(to: readonly [number, number]): Promise<void>;
  act(answers: Answers, operands: Readonly<Record<string, string>>): Promise<void>;
  close(): void;
}
