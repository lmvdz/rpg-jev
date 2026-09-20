import assert from "node:assert/strict";
import test from "node:test";
import { runSettlementProbes } from "../../../validation/thermal-learning/settlement-probes.ts";

test("bounded settlement authority and persistence probes pass", () => {
  const report = runSettlementProbes();
  assert.equal(report.scenarios, 79);
  assert.ok(Number.isSafeInteger(report.checks) && report.checks >= 2010);
  assert.deepEqual(report.failures, []);
});

test("settlement probe reports repeat deterministically with fresh fixtures", () => {
  assert.deepEqual(runSettlementProbes(), runSettlementProbes());
});
