import { HTTP_URL } from "./cli.ts";

/** The server's Prometheus text, reduced to `name{labels} -> value`. */
export async function scrape(): Promise<Map<string, number>> {
  const response = await fetch(`${HTTP_URL}/v1/metrics`);
  const values = new Map<string, number>();
  for (const line of (await response.text()).split("\n")) {
    if (line.startsWith("#")) continue;
    const space = line.lastIndexOf(" ");
    if (space > 0) values.set(line.slice(0, space), Number(line.slice(space + 1)));
  }
  return values;
}

function find(values: Map<string, number>, name: string, label: string): number {
  for (const [key, value] of values) {
    if (key.startsWith(`${name}{`) && key.includes(label)) return value;
  }
  return 0;
}

export type ReducerTime = { calls: number; seconds: number };

/** Cumulative server-side time of one reducer, including evaluating its subscription queries. */
export function reducerTime(values: Map<string, number>, reducer: string): ReducerTime {
  const label = `reducer="${reducer}"`;
  return {
    calls: find(values, "spacetime_reducer_plus_query_duration_sec_count", label),
    seconds: find(values, "spacetime_reducer_plus_query_duration_sec_sum", label),
  };
}

/** Mean server-side milliseconds per call between two scrapes. */
export function meanMsBetween(before: ReducerTime, after: ReducerTime): number {
  const calls = after.calls - before.calls;
  if (calls <= 0) return Number.NaN;
  return Math.round(((after.seconds - before.seconds) / calls) * 1e6) / 1e3;
}

export type TableSize = { rows: number; rowBytes: number; indexKeyBytes: number };

/** What the server itself accounts to a table: row pages and index keys. */
export function tableSize(values: Map<string, number>, table: string): TableSize {
  const label = `table_name="${table}"`;
  return {
    rows: find(values, "spacetime_data_size_table_num_rows", label),
    rowBytes: find(values, "spacetime_data_size_bytes_used_by_rows", label),
    indexKeyBytes: find(values, "spacetime_data_size_table_bytes_used_by_index_keys", label),
  };
}
