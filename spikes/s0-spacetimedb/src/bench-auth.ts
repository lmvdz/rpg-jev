// Condition 3 of the findings, built: reducers check who calls them. Every claim is tried against
// the local server and the event log is counted around each refused call.
import { connect, saveResult } from "./conn.ts";
import { DATABASE, HTTP_URL } from "./lib/cli.ts";
import { unregisterWorker } from "./lib/credentials.ts";
import { ownerCount, sql } from "./lib/sql.ts";
import { type Summary, summarize } from "./lib/stats.ts";

type Attempt = {
  call: string;
  by: string;
  allowed: boolean;
  error: string;
  eventLogRowsWritten: number;
};

async function logRows(): Promise<number> {
  const result = await sql("SELECT COUNT(*) AS n FROM event_log");
  return Number(result.rows[0]?.[0] ?? 0);
}

async function attempt(call: string, by: string, run: () => Promise<unknown>): Promise<Attempt> {
  const before = await logRows();
  let allowed = true;
  let error = "";
  try {
    await run();
  } catch (caught) {
    allowed = false;
    error = caught instanceof Error ? caught.message : String(caught);
  }
  const result = { call, by, allowed, error, eventLogRowsWritten: (await logRows()) - before };
  console.log(JSON.stringify(result));
  return result;
}

async function requestStatus(tag: string): Promise<string> {
  const result = await sql(`SELECT id, status FROM decision_request WHERE client_tag = '${tag}'`);
  return String(result.rows[0]?.[1] ?? "missing");
}

async function requestId(tag: string): Promise<bigint> {
  const result = await sql(`SELECT id FROM decision_request WHERE client_tag = '${tag}'`);
  return BigInt(result.rows[0]?.[0] as number);
}

/** The same refusal without the SDK: a bare HTTP call with no token at all. */
async function httpCall(
  reducer: string,
  args: unknown[],
): Promise<{ status: number; body: string }> {
  const response = await fetch(`${HTTP_URL}/v1/database/${DATABASE}/call/${reducer}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  return { status: response.status, body: (await response.text()).slice(0, 200) };
}

async function timeCalls(times: number, run: (i: number) => Promise<unknown>): Promise<Summary> {
  const samples: number[] = [];
  for (let i = 0; i < times; i++) {
    const started = performance.now();
    await run(i);
    samples.push(performance.now() - started);
  }
  return summarize(samples);
}

async function main(): Promise<void> {
  const worker = await connect({ as: "bench" });
  const stranger = await connect();
  const actor = 50n;
  const entities = await sql("SELECT COUNT(*) AS n FROM entity");
  if (Number(entities.rows[0]?.[0] ?? 0) === 0) {
    await worker.conn.reducers.seedEntities({ start: 1n, count: 64, side: 1024 });
  }
  const tag = `auth-${Date.now()}`;
  const effect = { kind: "shift_drive", target: actor, amount: 0.05, causeId: 0n };
  const attempts: Attempt[] = [];

  // A stranger may state an intent.
  attempts.push(
    await attempt("request_decision", "unregistered client", () =>
      stranger.conn.reducers.requestDecision({ actor, clientTag: tag }),
    ),
  );
  const id = await requestId(tag);
  const commit = { requestId: id, choice: "greet", judgeMs: 0 };

  // A stranger may not commit a decision or apply an effect.
  attempts.push(
    await attempt("commit_decision", "unregistered client", () =>
      stranger.conn.reducers.commitDecision(commit),
    ),
  );
  attempts.push(
    await attempt("apply_effect", "unregistered client", () =>
      stranger.conn.reducers.applyEffect(effect),
    ),
  );
  const statusAfterRefusal = await requestStatus(tag);
  const httpCommit = await httpCall("commit_decision", [Number(id), "greet", 0]);
  const httpEffect = await httpCall("apply_effect", ["shift_drive", Number(actor), 0.05, 0]);
  const statusAfterHttp = await requestStatus(tag);

  // Nobody but the owner may register a worker: not a stranger, and not a worker either.
  const workersBefore = ownerCount("worker");
  attempts.push(
    await attempt("add_worker (itself)", "unregistered client", () =>
      stranger.conn.reducers.addWorker({ identity: stranger.identity, label: "me" }),
    ),
  );
  attempts.push(
    await attempt("add_worker (the stranger)", "registered worker, not owner", () =>
      worker.conn.reducers.addWorker({ identity: stranger.identity, label: "friend" }),
    ),
  );
  attempts.push(
    await attempt("apply_effect", "unregistered client, after trying to register", () =>
      stranger.conn.reducers.applyEffect(effect),
    ),
  );
  const workersAfter = ownerCount("worker");

  // A registered worker may do both.
  attempts.push(
    await attempt("commit_decision", "registered worker", () =>
      worker.conn.reducers.commitDecision(commit),
    ),
  );
  attempts.push(
    await attempt("apply_effect", "registered worker", () =>
      worker.conn.reducers.applyEffect(effect),
    ),
  );
  const statusAfterWorker = await requestStatus(tag);

  // The stranger's player intents still work.
  attempts.push(
    await attempt("move_entity", "unregistered client", () =>
      stranger.conn.reducers.moveEntity({ id: actor, x: 10, y: 10, sentMs: 0 }),
    ),
  );
  attempts.push(
    await attempt("ping", "unregistered client", () => stranger.conn.reducers.ping({ n: 1 })),
  );

  // What the guard costs: the same effect reducer, called by a worker, against the unguarded ping.
  const guardedMs = await timeCalls(300, () => worker.conn.reducers.applyEffect(effect));
  const openMs = await timeCalls(300, (i) => worker.conn.reducers.ping({ n: i }));
  const refusedMs = await timeCalls(300, () =>
    stranger.conn.reducers.applyEffect(effect).catch(() => undefined),
  );

  // The owner takes the registration away again, and the worker is a stranger.
  unregisterWorker(worker.identity.toHexString());
  attempts.push(
    await attempt("apply_effect", "worker, after the owner removed it", () =>
      worker.conn.reducers.applyEffect(effect),
    ),
  );

  saveResult("auth", {
    at: new Date().toISOString(),
    attempts,
    decisionRequest: { statusAfterRefusal, statusAfterHttp, statusAfterWorker },
    httpWithoutToken: { commit_decision: httpCommit, apply_effect: httpEffect },
    workerRows: { before: workersBefore, afterTwoRefusedRegistrations: workersAfter },
    callRttMs: {
      guardedApplyEffectByWorker: guardedMs,
      openPing: openMs,
      refusedApplyEffectByStranger: refusedMs,
    },
  });
  worker.conn.disconnect();
  stranger.conn.disconnect();
}

await main();
