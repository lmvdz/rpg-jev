/**
 * The lossless, self-contained wire codec moved to
 * `packages/core/src/world/shared-wire.ts` so the host encodes exactly what
 * the client decodes, without either depending on the other's package.
 */
export { decodeSharedView, encodeSharedView } from "@rpg-jev/core/world";
