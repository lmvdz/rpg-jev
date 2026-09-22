/** Publication leases are not admission, character lifetime or simulation time. */
export const VIEW_LEASE_MICROS = 15_000_000n;
export const OBSERVE_INTERVAL_MS = 5_000;

export function observesUntil(now: bigint): bigint {
  return now + VIEW_LEASE_MICROS;
}

export function isObserving(until: bigint, now: bigint): boolean {
  return until > now;
}
