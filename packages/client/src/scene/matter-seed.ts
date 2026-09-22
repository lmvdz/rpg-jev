/**
 * Moved to `packages/core/src/world/matter-seed.ts` so the host seeds the
 * same initial matter as the client's local adapter, without depending on
 * the client package. This re-export shim keeps existing imports working.
 */
export {
  CLEARING_PLACE,
  INITIAL_HANDS,
  INITIAL_HERO,
  seedMatterWorld,
} from "@rpg-jev/core/world";
