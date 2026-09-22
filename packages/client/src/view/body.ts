/**
 * What the status display is handed about a body: meters and counts, as rows.
 * The client knows no need by name. Which needs a body has is the world's
 * business (spikes/vocabulary, B1 needs and B2 health), and a new one is one
 * more row, shown with no change here. The shape moved to
 * `packages/core/src/world/shared-view.ts` so the host's projection can build
 * it without depending on the client package.
 */
import type { BodyView, Count, Meter } from "@rpg-jev/core/world";

export type { BodyView, Count, Meter };

/** Below this a meter is shown as urgent. */
export const LOW = 0.25;

/** The whole-percent width a level is drawn at, so the page is only touched when that changes. */
export function percentOf(level: number): number {
  return Math.round(Math.min(Math.max(level, 0), 1) * 100);
}
