// The Jev worker of SPEC section 4, with a fake judge. A SpacetimeDB client like any other:
// it sees pending `decision_request` rows through a subscription, "calls Jev" outside the
// database, and commits through a reducer that re-checks the preconditions in code.
// It never calls TypeSafe and reads no key.
import { connect, subscribe } from "./conn.ts";
import { fakeJudge, seeded } from "./lib/judge.ts";

const instant = process.argv.includes("--instant");
const rng = seeded(20260918);
const { conn } = await connect({ as: "jev-worker" });

let handled = 0;
conn.db.decisionRequest.onInsert((_ctx, request) => {
  if (request.status !== "pending") return;
  const judged = instant ? Promise.resolve({ choice: "greet", judgeMs: 0 }) : fakeJudge(rng);
  judged
    .then(({ choice, judgeMs }) =>
      conn.reducers.commitDecision({ requestId: request.id, choice, judgeMs }),
    )
    .then(() => {
      handled++;
    })
    .catch((error: unknown) => console.error("commit failed", error));
});

await subscribe(conn, ["SELECT * FROM decision_request WHERE status = 'pending'"]);
console.log("worker ready");

process.on("SIGTERM", () => {
  console.log(`worker handled ${handled}`);
  conn.disconnect();
  process.exit(0);
});
