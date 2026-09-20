import assert from "node:assert/strict";
import test from "node:test";
import { serializeLog } from "../../core/src/log.ts";
import { attempt } from "../../core/src/thermal/attempt.ts";
import {
  type JournalDraft,
  journal,
  recordReflection,
  renderJournal,
} from "../src/thermal-journal.ts";
import { resumeBench, startBench } from "../src/thermal-session.ts";

function draft(expectedRevision: number, requestId = "note-1"): JournalDraft {
  return {
    requestId,
    expectedRevision,
    phase: "prediction",
    statement: "I am uncertain.",
    reason: "",
  };
}

test("research note changes no world state; retry/load preserves its original evidence", () => {
  const store = startBench();
  attempt(store, "ada", { requestId: "read", expectedRevision: 0, operation: { kind: "read" } });
  const before = structuredClone(store.world);
  const result = recordReflection(store, "ada", "self-test", draft(1));
  assert.equal(result.status, "recorded");
  assert.deepEqual(store.world, before);
  const notes = journal(store, "ada");
  assert.equal(notes[0]?.provenance, "self-test");
  assert.equal(notes[0]?.context.observations.length, 1);
  assert.equal(notes[0]?.reason, "");
  assert.deepEqual(journal(store, "bo"), []);
  attempt(store, "ada", { requestId: "wait", expectedRevision: 1, operation: { kind: "wait" } });
  attempt(store, "ada", { requestId: "later", expectedRevision: 2, operation: { kind: "read" } });
  const loaded = resumeBench(serializeLog(store.log));
  const count = loaded.log.length;
  assert.deepEqual(recordReflection(loaded, "ada", "self-test", draft(1)), result);
  assert.equal(loaded.log.length, count);
  assert.equal(loaded.world.clock, 1);
  assert.deepEqual(journal(loaded, "ada"), notes);
  assert.equal(journal(loaded, "ada")[0]?.context.minute, 0);
});

test("snapshots use only authorized evidence and never enrich hidden-state twins", () => {
  const a = startBench();
  const b = startBench();
  assert.ok(b.world.thermal?.physics.parts[0]);
  b.world.thermal.physics.parts[0].energyJ -= 100;
  assert.deepEqual(
    recordReflection(a, "ada", "scripted", draft(0)),
    recordReflection(b, "ada", "scripted", draft(0)),
  );
  attempt(a, "bo", { requestId: "private", expectedRevision: 0, operation: { kind: "read" } });
  const next = recordReflection(a, "ada", "scripted", draft(1, "note-2"));
  assert.equal(next.status, "recorded");
  assert.equal(journal(a, "ada")[1]?.context.observations.length, 0);
  assert.deepEqual(journal(a, "outsider"), []);
  assert.equal(recordReflection(a, "outsider", "scripted", draft(1)).status, "unavailable");
});

test("stale views and changed retry payload/provenance cannot silently record different notes", () => {
  const store = startBench();
  attempt(store, "bo", { requestId: "other", expectedRevision: 0, operation: { kind: "wait" } });
  assert.equal(recordReflection(store, "ada", "participant", draft(0)).status, "stale");
  assert.equal(journal(store, "ada").length, 0);
  recordReflection(store, "ada", "self-test", draft(1));
  assert.equal(recordReflection(store, "ada", "participant", draft(1)).status, "retry-conflict");
  assert.equal(
    recordReflection(store, "ada", "self-test", {
      ...draft(1),
      statement: "A changed account.",
    }).status,
    "retry-conflict",
  );
  assert.equal(journal(store, "ada").length, 1);
});

test("phase is not an accomplishment, text is data, and snapshots are immutable", () => {
  const store = startBench();
  const input = {
    ...draft(0),
    phase: "transfer" as const,
    statement: "\u001b[2J\n\u009b2J\u202eI have learned it.",
  };
  const result = recordReflection(store, "ada", "unspecified", input);
  assert.equal(result.status, "recorded");
  if (result.status !== "recorded") return;
  result.record.statement = "mutated";
  result.record.context.parts.length = 0;
  const retained = journal(store, "ada");
  assert.equal(retained[0]?.statement, input.statement);
  assert.equal(retained[0]?.context.parts.length, 4);
  const rendered = renderJournal(retained);
  assert.ok(!rendered.includes("\u001b"));
  assert.ok(!rendered.includes("\u009b"));
  assert.ok(!rendered.includes("\u202e"));
  assert.ok(rendered.includes("not authenticated"));
  assert.ok(rendered.includes("(not stated)"));
});

test("bounded snapshots disclose omissions and unknown study versions are refused on load", () => {
  const store = startBench();
  for (let i = 0; i < 33; i++)
    attempt(store, "ada", { requestId: `r${i}`, expectedRevision: i, operation: { kind: "read" } });
  recordReflection(store, "ada", "scripted", draft(33));
  const context = journal(store, "ada")[0]?.context;
  assert.equal(context?.observations.length, 32);
  assert.equal(context?.earlierObservationCount, 1);
  assert.throws(() =>
    resumeBench(serializeLog(store.log).replace("thermal-study-v1", "thermal-study-v2")),
  );
});

test("old unsupported physical requests stay unsupported after the study metadata addition", () => {
  const store = startBench();
  const request = { requestId: "old", expectedRevision: 0, operation: { kind: "journal" } };
  const result = attempt(store, "ada", request);
  assert.equal(result.status, "unsupported");
  recordReflection(store, "ada", "scripted", draft(0));
  const loaded = resumeBench(serializeLog(store.log));
  assert.deepEqual(attempt(loaded, "ada", request), result);
  assert.deepEqual(loaded.world, store.world);
});
