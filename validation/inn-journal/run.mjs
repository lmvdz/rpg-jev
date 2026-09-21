/** Fixed CLI workflow, not a human fun verdict. Never prints or persists credentials. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { parseLog } from "../../packages/core/src/log.ts";
import { Game } from "../../packages/inn/src/game.ts";
import { renderJournal } from "../../packages/inn/src/journal.ts";
import { MODEL, USD_PER_INPUT_TOKEN } from "../../packages/jev/src/judge.ts";

const mode = process.argv[2];
assert(["live", "offline"].includes(mode), "usage: run.mjs <live|offline> <output-directory>");
assert(process.argv[3], "an output directory is required");
if (mode === "live") assert(process.env.TYPESAFE_API_KEY, "supply TYPESAFE_API_KEY in the process");
const root = resolve(import.meta.dirname, "../..");
const output = resolve(process.argv[3]);
// A run is evidence: refuse to overwrite one or race another run into its directory.
mkdirSync(resolve(output, ".."), { recursive: true });
mkdirSync(output);
mkdirSync(join(root, "saves"), { recursive: true });
const directory = mkdtempSync(join(root, "saves", "journal-workflow-"));
const savePath = join(directory, "night.jsonl");
const save = relative(join(root, "saves"), join(directory, "night"));
const inputs = [
  "help",
  "journal",
  "go kitchen",
  "search coat",
  "examine markers",
  "notes",
  "take iron key",
  "go cellar",
  "search barrel",
  "take ledger",
  "examine apron",
  "journal",
  "quit",
];
const forbidden = {
  ask() {
    throw new Error("replay or journal attempted inference");
  },
};

function play(commands, flags) {
  const result = spawnSync(
    process.execPath,
    ["packages/terminal/src/play.ts", "--plain", "--fast", `--save=${save}`, ...flags],
    { cwd: root, input: `${commands.join("\n")}\n`, encoding: "utf8", timeout: 90_000 },
  );
  assert.ifError(result.error);
  assert.equal(result.status, 0, "CLI failed; inspect the local terminal before retrying");
  return result.stdout;
}

function journalChecks(log) {
  const indices = log.flatMap((entry, index) =>
    entry.kind === "input" && entry.action?.verb === "journal" ? [index] : [],
  );
  for (const index of indices) {
    const before = Game.resume(log.slice(0, index), forbidden);
    const after = Game.resume(log.slice(0, index + 1), forbidden);
    assert.deepEqual(after.world, before.world);
    assert.equal(
      log[index + 1]?.kind,
      "input",
      "journal unexpectedly produced a decision or effect",
    );
  }
  return indices.length;
}

try {
  const flags = ["--new", "--seed=1", ...(mode === "offline" ? ["--offline"] : [])];
  const transcript = play(inputs, flags);
  const bytes = readFileSync(savePath, "utf8");
  const log = parseLog(bytes);
  const game = Game.resume(log, forbidden);
  const journal = renderJournal(game.world);
  const resumed = play(["journal", "quit"], ["--offline"]);
  const restored = Game.resume(parseLog(readFileSync(savePath, "utf8")), forbidden);
  assert.deepEqual(restored.world, game.world);
  assert(resumed.includes(journal), "resumed CLI did not display the same journal");
  assert.match(journal, /Odo owes money to river gamblers/);
  assert.match(journal, /You found the ledger/);
  assert.match(journal, /You witnessed this/);
  const decisions = log.filter((entry) => entry.kind === "decision");
  const tokens = decisions.reduce((sum, entry) => sum + entry.inputTokens, 0);
  const summary = {
    mode,
    model: mode === "live" ? MODEL : null,
    node: process.version,
    platform: process.platform,
    inputs,
    journalChecks: journalChecks(log),
    jevDecisions: decisions.filter((entry) => entry.source === "jev").length,
    cachedDecisions: decisions.filter((entry) => entry.source === "cache").length,
    fallbackDecisions: decisions.filter((entry) => entry.source === "fallback").length,
    inputTokens: tokens,
    listPriceUsd: tokens * USD_PER_INPUT_TOKEN,
    journalCalls: 0,
    journalEffects: 0,
    replayAndResumeEqual: true,
    humanPlaytest: false,
  };
  writeFileSync(
    join(output, "transcript.txt"),
    `${transcript}\n--- OFFLINE RESUME ---\n${resumed.trimEnd()}\n`,
  );
  writeFileSync(join(output, "log.jsonl"), bytes);
  writeFileSync(join(output, "journal.txt"), `${journal}\n`);
  writeFileSync(join(output, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, 2));
  assert.equal(summary.journalChecks, 3);
  if (mode === "live") {
    assert(summary.jevDecisions > 0, "no live-provider evidence");
    assert.equal(
      summary.fallbackDecisions,
      0,
      "live run degraded; do not call it a clean live pass",
    );
  }
} finally {
  rmSync(directory, { recursive: true, force: true });
}
