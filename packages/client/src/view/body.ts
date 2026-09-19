/**
 * What the status display is handed about a body: meters and counts, as rows.
 * The client knows no need by name. Which needs a body has is the world's
 * business (spikes/vocabulary, B1 needs and B2 health), and a new one is one
 * more row, shown with no change here.
 */
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

export interface BodyView {
  meters: Meter[];
  counts: Count[];
}

/** Below this a meter is shown as urgent. */
export const LOW = 0.25;

/** The whole-percent width a level is drawn at, so the page is only touched when that changes. */
export function percentOf(level: number): number {
  return Math.round(Math.min(Math.max(level, 0), 1) * 100);
}
