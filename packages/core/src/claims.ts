/**
 * Claims travel as structured data and pick up errors in transit (SPEC.md
 * section 9). The judge picks a distortion from a closed list; this file
 * applies it to the structure. No text is involved.
 */
import { hashValue } from "./hash.ts";
import type { ActorId, Claim } from "./types.ts";

export const DISTORTIONS = ["exaggerate_severity", "swap_culprit", "drop_motive"] as const;
export type Distortion = (typeof DISTORTIONS)[number];

type Content = Pick<
  Claim,
  "subject" | "predicate" | "object" | "to" | "place" | "when" | "severity" | "motive"
>;

/** A claim's id is its content, so two tellers who say the same thing share one row. */
export function claimId(content: Content): string {
  const { subject, predicate, object, to, place, when, severity, motive } = content;
  const identity = { subject, predicate, object, to, place, when, severity, motive };
  return `c_${hashValue(identity).slice(0, 10)}`;
}

export function makeClaim(content: Content & Pick<Claim, "origin">): Claim {
  return { ...content, id: claimId(content) };
}

/** Distortions that would actually change this claim. Code prunes the rest (SPEC.md section 5). */
export function feasibleDistortions(claim: Claim, swapTo: ActorId | null): Distortion[] {
  const out: Distortion[] = [];
  if (claim.severity < 3) out.push("exaggerate_severity");
  if (swapTo !== null && swapTo !== claim.subject) out.push("swap_culprit");
  if (claim.motive !== undefined) out.push("drop_motive");
  return out;
}

/** The retold claim: a new row derived from the one the teller held. */
export function distort(claim: Claim, how: Distortion, swapTo: ActorId | null): Claim {
  const { id: _id, derivedFrom: _d, distortion: _k, ...content } = claim;
  const next: Omit<Claim, "id"> = { ...content, derivedFrom: claim.id, distortion: how };
  if (how === "exaggerate_severity") next.severity = Math.min(3, claim.severity + 1) as 1 | 2 | 3;
  if (how === "swap_culprit" && swapTo !== null) next.subject = swapTo;
  if (how === "drop_motive") delete next.motive;
  return { ...next, id: claimId(next) };
}

/** How far a claim has drifted from what was first witnessed. */
export function driftFrom(root: Claim, claim: Claim): string[] {
  const drift: string[] = [];
  if (claim.subject !== root.subject) drift.push("culprit");
  if (claim.severity !== root.severity) drift.push("severity");
  if (claim.motive !== root.motive) drift.push("motive");
  return drift;
}
