import { DATABASE, HTTP_URL, spacetime } from "./cli.ts";

export type SqlResult = {
  rows: unknown[][];
  serverMicros: number;
  clientMs: number;
  bytes: number;
};

type SqlStatement = { rows: unknown[][]; total_duration_micros: number };

/** One-off SQL over HTTP as an anonymous identity: public tables only, reads only. */
export async function sql(query: string): Promise<SqlResult> {
  const started = performance.now();
  const response = await fetch(`${HTTP_URL}/v1/database/${DATABASE}/sql`, {
    method: "POST",
    body: query,
  });
  const text = await response.text();
  const clientMs = performance.now() - started;
  if (!response.ok) throw new Error(`sql failed (${response.status}): ${text}`);
  const statements = JSON.parse(text) as SqlStatement[];
  const first = statements[0];
  if (!first) throw new Error("sql returned no statement result");
  return {
    rows: first.rows,
    serverMicros: first.total_duration_micros,
    clientMs,
    bytes: text.length,
  };
}

/** SQL through the CLI, which carries the owner's local identity and so can read private tables. */
export function ownerCount(table: string): number {
  const out = spacetime([
    "sql",
    DATABASE,
    "--server",
    HTTP_URL,
    `SELECT COUNT(*) AS n FROM ${table}`,
  ]);
  const match = out.match(/^\s*(\d+)\s*$/m);
  if (!match?.[1]) throw new Error(`could not read a count from: ${out}`);
  return Number(match[1]);
}
