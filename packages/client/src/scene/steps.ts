/**
 * The stepping rule moved to `packages/core/src/world/steps.ts` (SPEC.md
 * section 19) so the host's `terrainAllows` uses the same rule as the keys,
 * a clicked path and the path finder. This re-export shim keeps the
 * renderer's existing imports working.
 */
export {
  type Blocked,
  canStep,
  NEIGHBOURS,
  NOTHING_BLOCKS,
  standable,
} from "@rpg-jev/core/world";
