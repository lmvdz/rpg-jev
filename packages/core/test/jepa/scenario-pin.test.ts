/**
 * `scenario()` is the teacher generator every sealed JEPA dataset was built from (SPEC section
 * 16, `docs/jepa-proof/GOAL.md`). Adding `scenarioV3` (`scenario-v3.ts`, `docs/physics-coverage.md`)
 * must never change one bit of what `scenario()` itself returns for a seed it already answered:
 * this pins its output, over a seed from every named range in SPEC section 16 plus the coverage
 * spike's own 6,000,000,000 range, to a hash recorded before `scenario-v3.ts` existed.
 */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { scenario } from "../../src/jepa/scenario.ts";

const SEEDS = [
  ...Array.from({ length: 20 }, (_, i) => i),
  ...Array.from({ length: 20 }, (_, i) => 1_000_000_000 + i),
  ...Array.from({ length: 20 }, (_, i) => 3_000_000_000 + i),
  ...Array.from({ length: 20 }, (_, i) => 4_000_000_000 + i),
  ...Array.from({ length: 20 }, (_, i) => 5_000_000_000 + i),
  ...Array.from({ length: 20 }, (_, i) => 6_000_000_000 + i),
];

/** Recorded on `feat/physics-coverage` before `scenario-v3.ts` was added. Never re-record to make
 *  a change pass; a mismatch here means `scenario()` itself changed, which breaks sealed data. */
const PINNED_HASH = "5599e0e53567c8407fad53a290cc09470f6a5117641e963b2af64e60041747c4";

describe("scenario", () => {
  it("is byte-identical to what it was before scenarioV3 existed, over every named seed range", () => {
    const hash = createHash("sha256");
    for (const seed of SEEDS) hash.update(JSON.stringify(scenario(seed)));
    expect(hash.digest("hex")).toBe(PINNED_HASH);
  });
});
