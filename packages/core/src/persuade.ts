/**
 * Persuadability is a code-owned value built from drives (SPEC.md section 6).
 * M0 found the judge's spread only moderately human-like, so the spread is one
 * input here and not the mechanism.
 */
import type { Actor, Drive } from "./types.ts";

export type Lever = "reason" | "payment" | "threat" | "appeal";

/** Base openness per lever, drawn from the NPC's drives. */
const LEVER_BASE: Record<Lever, (d: Record<Drive, number>) => number> = {
  payment: (d) => 0.25 + 0.5 * d.greed + 0.15 * d.obligation - 0.2 * d.suspicion,
  threat: (d) => 0.15 + 0.6 * d.fear - 0.2 * d.trust,
  appeal: (d) => 0.2 + 0.4 * d.obligation + 0.3 * d.trust - 0.2 * d.fear,
  reason: (d) => 0.2 + 0.5 * d.trust - 0.3 * d.suspicion,
};

/**
 * How open this NPC is to being moved by this lever, from 0 to 1.
 * `noul` is the judge's probability that they agree; a value near one half
 * means the judge is torn, which makes them a little easier to move.
 */
export function persuadability(actor: Actor, lever: Lever, noul: number): number {
  const base = LEVER_BASE[lever](actor.drives);
  const torn = 1 - Math.abs(noul - 0.5) * 2;
  return Math.min(1, Math.max(0, base + 0.2 * torn));
}

export type Resolve = "agrees" | "wavers" | "refuses";

/**
 * Turns a sampled yes or no into what the player sees. A no from someone
 * persuadable is a waver that a better offer can reopen; a no from someone
 * who is not persuadable closes the matter for the night.
 */
export function resolve(accepted: boolean, openness: number): Resolve {
  if (accepted) return "agrees";
  return openness >= 0.45 ? "wavers" : "refuses";
}

/** Sampling rule shared by every Noul: below 0.10 is a no, above 0.90 is a yes. */
export function sampleNoul(noul: number, draw: number): boolean {
  if (noul < 0.1) return false;
  if (noul > 0.9) return true;
  return draw < noul;
}

/** Drops options under 0.10 before sampling (SPEC.md section 6). Never sharpens. */
export function pruneUnlikely(
  probabilities: Readonly<Record<string, number>>,
): Record<string, number> {
  const kept = Object.fromEntries(Object.entries(probabilities).filter(([, p]) => p >= 0.1));
  return Object.keys(kept).length > 0 ? kept : { ...probabilities };
}
