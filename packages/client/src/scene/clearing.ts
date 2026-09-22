/**
 * The grown clearing moved to `packages/core/src/world/clearing.ts` (SPEC.md
 * section 19, docs/sandbox-direction.md) so the host and the renderer grow
 * the exact same map from the exact same seed. This re-export shim keeps
 * existing imports working.
 */
export { buildClearing, CLEARING_SIZE, type Clearing } from "@rpg-jev/core/world";
