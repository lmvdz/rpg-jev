/** Deterministic authority probes, not player exercises or a second simulation. */
import { stableStringify } from "../../packages/core/src/hash.ts";
import { parseLog, replay, type Store, serializeLog } from "../../packages/core/src/log.ts";
import { attempt, type Request, view } from "../../packages/core/src/thermal/attempt.ts";
import type { Operation, ThermalSettlement } from "../../packages/core/src/thermal/contract.ts";
import { benchWorld } from "../../packages/core/src/thermal/fixture.ts";
import { resumeBench, startBench } from "../../packages/terminal/src/thermal-session.ts";

interface Report {
  checks: number;
  scenarios: number;
  failures: string[];
}
type Check = (label: string, actual: unknown, expected: unknown) => void;

function probe(report: Report, label: string, run: (check: Check) => void): void {
  report.scenarios++;
  const check: Check = (detail, actual, expected) => {
    report.checks++;
    if (stableStringify(actual) !== stableStringify(expected))
      report.failures.push(
        `${label}: ${detail}: expected ${stableStringify(expected)}, got ${stableStringify(actual)}`,
      );
  };
  try {
    run(check);
  } catch (error) {
    report.failures.push(
      `${label}: threw ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function physics(store: Store) {
  if (!store.world.thermal) throw new Error("missing thermal fixture");
  return store.world.thermal.physics;
}

function part(store: Store, id: string) {
  const found = physics(store).parts.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`missing part ${id}`);
  return found;
}

function act(store: Store, operation: Operation, actor = "ada") {
  return attempt(store, actor, {
    requestId: `step-${store.log.length}`,
    expectedRevision: store.world.thermal?.revision ?? 0,
    operation,
  });
}

function snapshot(store: Store) {
  return { world: structuredClone(store.world), log: serializeLog(store.log) };
}

function restored(store: Store, check: Check): Store {
  const text = serializeLog(store.log);
  const loaded = resumeBench(text);
  check("serialized log roundtrip", serializeLog(loaded.log), text);
  check("exact replay", replay(benchWorld(), parseLog(text)), store.world);
  check("session projection", loaded.world, store.world);
  for (const actor of ["ada", "bo"])
    check(`${actor} persisted view`, view(loaded, actor), view(store, actor));
  return loaded;
}

function retry(store: Store, actor: string, request: Request, receipt: unknown, check: Check) {
  const before = snapshot(store);
  check(`${actor} original retry receipt`, attempt(store, actor, request), receipt);
  check(`${actor} retry has no effects or evidence`, snapshot(store), before);
  check(
    `${actor} changed payload conflicts`,
    attempt(store, actor, {
      ...request,
      operation: { kind: "predict", prediction: "x", reason: "y" },
    }).status,
    "retry-conflict",
  );
  check(`${actor} conflict has no effects or evidence`, snapshot(store), before);
}

const operations = (actor: string): Operation[] => [
  { kind: "seat", part: actor === "ada" ? "D" : "C", slot: 1 },
  { kind: "dock", target: actor === "ada" ? "A" : "B" },
  { kind: "wait" },
  { kind: "read" },
];

function race(
  check: Check,
  firstActor: string,
  firstOperation: Operation,
  secondOperation: Operation,
  sharedId: boolean,
): void {
  let store = startBench();
  const secondActor = firstActor === "ada" ? "bo" : "ada";
  const first = { requestId: "one", expectedRevision: 0, operation: firstOperation };
  const second = {
    requestId: sharedId ? "one" : "two",
    expectedRevision: 0,
    operation: secondOperation,
  };
  const won = attempt(store, firstActor, first);
  const worldAfterWinner = structuredClone(store.world);
  const lost = attempt(store, secondActor, second);
  check("first commits", won.status, "committed");
  check("second is stale, not a cross-actor retry", lost.status, "stale");
  check("stale cannot mutate world", store.world, worldAfterWinner);
  check("stale cannot manufacture observation", lost.observation, undefined);
  check("loser's private history is empty", view(store, secondActor).history, []);
  check(
    "winner evidence count",
    view(store, firstActor).history?.length,
    Number(firstOperation.kind === "read"),
  );
  check("one revision", store.world.thermal?.revision, 1);
  check("clock follows only winner", store.world.clock, Number(firstOperation.kind === "wait"));
  check("one settlement per request", store.log.filter((e) => e.kind === "effect").length, 2);
  store = restored(store, check);
  retry(store, firstActor, first, won, check);
  retry(store, secondActor, second, lost, check);
  const fresh = act(store, secondOperation, secondActor);
  const occupied = firstOperation.kind === "seat" && secondOperation.kind === "seat";
  check(
    "fresh loser follows current feasibility",
    fresh.status,
    occupied ? "infeasible" : "committed",
  );
  restored(store, check);
}

function races(report: Report): void {
  // Full ordered Cartesian product: four operations, both actor orders and ID namespaces.
  for (const actor of ["ada", "bo"]) {
    const other = actor === "ada" ? "bo" : "ada";
    for (const first of operations(actor)) {
      for (const second of operations(other)) {
        for (const shared of [false, true]) {
          probe(report, `race/${actor}/${first.kind}/${second.kind}/shared=${shared}`, (check) =>
            race(check, actor, first, second, shared),
          );
        }
      }
    }
  }
}

function failureRetry(check: Check, actor: string, reload: boolean): void {
  let store = startBench();
  const request = {
    requestId: "blocked",
    expectedRevision: 0,
    operation: { kind: "dock", target: "D" },
  };
  const failed = attempt(store, actor, request);
  check("rack docking fails", failed.status, "infeasible");
  check("failed revision unchanged", store.world.thermal?.revision, 0);
  const other = actor === "ada" ? "bo" : "ada";
  // Same ID with a different actor is an independent request at the same revision.
  check(
    "different actor may use failed ID",
    attempt(store, other, {
      ...request,
      operation: { kind: "seat", part: "D", slot: 1 },
    }).status,
    "committed",
  );
  if (reload) store = restored(store, check);
  retry(store, actor, request, failed, check);
  check(
    "new ID can dock now",
    act(store, { kind: "dock", target: "D" }, actor).status,
    "committed",
  );
  restored(store, check);
}

function histories(check: Check, firstActor: string): void {
  let store = startBench();
  const secondActor = firstActor === "ada" ? "bo" : "ada";
  act(store, { kind: "dock", target: "A" }, firstActor);
  const request = { requestId: "read-once", expectedRevision: 1, operation: { kind: "read" } };
  const reading = attempt(store, firstActor, request);
  act(store, { kind: "wait" }, secondActor);
  const newer = act(store, { kind: "read" }, secondActor);
  check(
    "new reading actually differs",
    newer.observation?.probeKelvin !== reading.observation?.probeKelvin,
    true,
  );
  for (const actor of [firstActor, secondActor])
    act(
      store,
      { kind: "predict", prediction: `${actor}-private`, reason: `${actor}-reason` },
      actor,
    );
  store = restored(store, check);
  retry(store, firstActor, request, reading, check);
  for (const actor of [firstActor, secondActor]) {
    const history = view(store, actor).history;
    check(`${actor} owns exactly two records`, history?.length, 2);
    check(`${actor} owns prediction`, history?.[1], {
      kind: "prediction",
      minute: 1,
      prediction: `${actor}-private`,
      reason: `${actor}-reason`,
    });
    check(
      `${actor} view omits solver energy`,
      JSON.stringify(view(store, actor)).includes("energyJ"),
      false,
    );
  }
  check("first actor retains old evidence", view(store, firstActor).history?.[0], {
    kind: "observation",
    ...reading.observation,
  });
  check("second actor owns new evidence", view(store, secondActor).history?.[0], {
    kind: "observation",
    ...newer.observation,
  });
  check("outsider has no history", view(store, "outsider"), { available: false });
}

function rackMemory(check: Check, gaps: number): void {
  let store = startBench();
  act(store, { kind: "seat", part: "D", slot: 1 });
  act(store, { kind: "wait" });
  check("B warmed before interruption", part(store, "B").energyJ > 20 * 290, true);
  act(store, { kind: "seat", part: "B", slot: null });
  const retained = structuredClone(part(store, "B"));
  store = restored(store, check);
  for (let i = 0; i < gaps; i++) act(store, { kind: "wait" }, i % 2 === 0 ? "bo" : "ada");
  check("rack retains every part quantity", part(store, "B"), retained);
  act(store, { kind: "seat", part: "B", slot: 2 }, "bo");
  check("reinsertion changes only slot", part(store, "B"), { ...retained, slot: 2 });
  act(store, { kind: "wait" });
  check("reinserted part exchanges again", part(store, "B").energyJ > retained.energyJ, true);
  restored(store, check);
}

function probeMemory(check: Check, waits: number): void {
  let store = startBench();
  act(store, { kind: "dock", target: "A" });
  for (let i = 0; i < waits; i++) act(store, { kind: "wait" });
  const warm = structuredClone(physics(store).probe);
  check("probe warmed on A", warm.energyJ > warm.capacityJPerK * 290, true);
  act(store, { kind: "dock", target: "B" }, "bo");
  check("moving probe preserves quantities", physics(store).probe, { ...warm, target: "B" });
  store = restored(store, check);
  const beforeB = part(store, "B").energyJ;
  const beforeProbe = physics(store).probe.energyJ;
  act(store, { kind: "read" }, "bo");
  check("read leaves probe unchanged", physics(store).probe.energyJ, beforeProbe);
  act(store, { kind: "wait" }, "bo");
  const gain = part(store, "B").energyJ - beforeB;
  const loss = beforeProbe - physics(store).probe.energyJ;
  check("warm probe loads cold B", gain > 0 && loss > 0, true);
  check("probe loss equals isolated B gain", Math.abs(gain - loss) < 1e-8, true);
  restored(store, check);
}

function lastSettlement(store: Store): ThermalSettlement {
  const entry = store.log.at(-1);
  if (entry?.kind !== "effect" || entry.effect.kind !== "thermal_settle")
    throw new Error("missing settlement");
  return structuredClone(entry.effect);
}

function directRejection(check: Check, kind: string): void {
  const template = startBench();
  act(template, { kind: "wait" });
  const effect = lastSettlement(template);
  const store = startBench();
  if (kind === "duplicate") {
    check("valid direct settlement", store.tryCommit(structuredClone(effect), null) !== null, true);
    effect.beforeMinute = 1;
    effect.expectedRevision = 1;
    effect.requestedRevision = 1;
    effect.receipt.minute = 2;
    effect.receipt.revision = 2;
    effect.fingerprint = stableStringify({ expectedRevision: 1, operation: { kind: "wait" } });
  }
  if (kind === "fingerprint")
    effect.fingerprint = stableStringify({ expectedRevision: 0, operation: { kind: "read" } });
  const before = structuredClone(store.world);
  const history = view(store, "ada");
  const effects = store.log.filter((entry) => entry.kind === "effect").length;
  const rejected = store.tryCommit(
    kind === "clock" ? { kind: "advance_clock", minutes: 1 } : effect,
    null,
  );
  check("direct bypass rejected", rejected, null);
  check("rejection recorded", store.log.at(-1)?.kind, "rejected");
  check("no projected mutation", store.world, before);
  check("no new evidence", view(store, "ada"), history);
  check(
    "no duplicate effect",
    store.log.filter((entry) => entry.kind === "effect").length,
    effects,
  );
  restored(store, check);
}

export function runSettlementProbes(): { checks: number; scenarios: number; failures: string[] } {
  const report: Report = { checks: 0, scenarios: 0, failures: [] };
  races(report);
  for (const actor of ["ada", "bo"]) {
    for (const reload of [false, true])
      probe(report, `failure-retry/${actor}/reload=${reload}`, (check) =>
        failureRetry(check, actor, reload),
      );
    probe(report, `private-history/${actor}`, (check) => histories(check, actor));
  }
  for (const minutes of [1, 2, 5]) {
    probe(report, `rack-memory/gap=${minutes}`, (check) => rackMemory(check, minutes));
    probe(report, `probe-memory/warm=${minutes}`, (check) => probeMemory(check, minutes));
  }
  for (const kind of ["duplicate", "fingerprint", "clock"])
    probe(report, `direct/${kind}`, (check) => directRejection(check, kind));
  return report;
}
