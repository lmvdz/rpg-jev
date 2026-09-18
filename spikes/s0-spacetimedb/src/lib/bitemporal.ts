// The bitemporal predicate, in one place. The module's `queryBelief` reducer and the SQL
// the benches send are this predicate in two other notations; the test pins its meaning.

export type EdgeTimes = { validFrom: bigint; validTo: bigint; knownFrom: bigint };

/** `valid_to` of an open edge. */
export const OPEN = 9_223_372_036_854_775_807n;

/** True when the edge was valid at `at` and the holder had learned it by `knownAt`. */
export function heldAt(edge: EdgeTimes, at: bigint, knownAt: bigint): boolean {
  return edge.validFrom <= at && at < edge.validTo && edge.knownFrom <= knownAt;
}

export function beliefSql(src: bigint, at: bigint, knownAt: bigint): string {
  return (
    `SELECT * FROM edge WHERE src = ${src} AND kind = 'believes' ` +
    `AND valid_from <= ${at} AND valid_to > ${at} AND known_from <= ${knownAt}`
  );
}
