import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A ratchet on the shape the world-design skill forbids: engine code that names a
 * character. The counts below are the debt as of 2026-09-18 (SPEC.md section 17). A change
 * may lower a number, never raise it. Lower it here when you pay some of it off.
 */
const DEBT: Record<string, number> = {
  "game.ts": 2,
  "talk.ts": 11,
  "agenda.ts": 13,
  "actions.ts": 9,
  "attempts.ts": 0,
  "reactions.ts": 0,
  "repertoire.ts": 0,
};

describe("the engine does not learn new names", () => {
  for (const [file, allowed] of Object.entries(DEBT))
    it(`${file} names a character at most ${allowed} times`, () => {
      const source = readFileSync(join(import.meta.dirname, "..", "src", file), "utf8");
      const names = source.match(/\b(MARA|ODO|TOBIN)\b/g) ?? [];
      expect(
        names.length,
        `${file}: ${names.length} uses; a role or a predicate would name nobody`,
      ).toBeLessThanOrEqual(allowed);
    });
});
