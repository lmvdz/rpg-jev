/** Actual terminal workflow. Scripted actions, not a human fun verdict. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { parseLog } from "../../packages/core/src/log.ts";
import { C_ODO_GAMBLES } from "../../packages/inn/src/content.ts";
import { Game } from "../../packages/inn/src/game.ts";
import { journalEntries, renderJournal } from "../../packages/inn/src/journal.ts";
import { MODEL, USD_PER_INPUT_TOKEN } from "../../packages/jev/src/judge.ts";

const mode = process.argv[2];
assert(["live", "offline"].includes(mode), "usage: run.mjs <live|offline> <new-output-directory>");
assert(process.argv[3], "an output directory is required");
// Optional failed-discovery directory: continue its completed save instead of
// repeating any model decisions from the native shutdown failure.
const recovery = process.argv[4] ? resolve(process.argv[4]) : null;
if (mode === "live") assert(process.env.TYPESAFE_API_KEY, "supply TYPESAFE_API_KEY in the process");
const root = resolve(import.meta.dirname, "../..");
const output = resolve(process.argv[3]);
mkdirSync(resolve(output, ".."), { recursive: true });
mkdirSync(output);
mkdirSync(join(root, "saves"), { recursive: true });
const directory = mkdtempSync(join(root, "saves", "playability-workflow-"));
const savePath = join(directory, "night.jsonl");
const save = relative(join(root, "saves"), join(directory, "night"));
const forbidden = {
  ask() {
    throw new Error("replay attempted inference");
  },
};

function play(commands, flags) {
  const result = spawnSync(
    process.execPath,
    ["packages/terminal/src/play.ts", "--plain", "--fast", `--save=${save}`, ...flags],
    { cwd: root, input: `${commands.join("\n")}\n`, encoding: "utf8", timeout: 90_000 },
  );
  if (result.error || result.status !== 0) {
    writeFileSync(join(output, "failed-stdout.txt"), `${(result.stdout ?? "").trimEnd()}\n`);
    writeFileSync(join(output, "failed-stderr.txt"), result.stderr ?? "");
    const failure = {
      status: result.status,
      signal: result.signal,
      error: result.error?.message,
      commands,
    };
    writeFileSync(join(output, "failure.json"), `${JSON.stringify(failure, null, 2)}\n`);
    if (existsSync(savePath))
      writeFileSync(join(output, "failed-save.jsonl"), readFileSync(savePath));
  }
  assert.ifError(result.error);
  assert.equal(result.status, 0, "CLI failed; do not reroll provider outcomes");
  return result.stdout;
}

function persist(name, transcript) {
  const bytes = readFileSync(savePath, "utf8");
  writeFileSync(join(output, `${name}.jsonl`), bytes);
  writeFileSync(join(output, `${name}.txt`), `${transcript.trimEnd()}\n`);
  const log = parseLog(bytes);
  return { log, game: Game.resume(log, forbidden) };
}

function discover(inputs, flags) {
  if (!recovery)
    return persist("discovery", play(inputs, ["--new", "--handwritten", "--seed=1", ...flags]));
  const bytes = readFileSync(join(recovery, "failed-save.jsonl"), "utf8");
  const log = parseLog(bytes);
  assert.deepEqual(
    log.filter((e) => e.kind === "input").map((e) => e.text),
    inputs,
    "recovery must be the exact completed discovery phase",
  );
  assert.equal(log[0]?.content, "gilded-carp-1+handwritten-1");
  writeFileSync(savePath, bytes);
  return persist("discovery", readFileSync(join(recovery, "failed-stdout.txt"), "utf8"));
}

function inspectSpeech(log, commands, claim) {
  for (const [command, act] of commands) {
    const index = log.findIndex((e) => e.kind === "input" && e.text === command);
    assert(index >= 0, `missing logged input ${command}`);
    assert.equal(log[index].via, "parsed", "note command needed semantic parsing");
    assert.deepEqual(log[index].action, {
      verb: "say",
      act,
      to: "mara",
      topic: { kind: "claim", id: claim },
      item: null,
      request: null,
    });
  }
}

try {
  const flags = mode === "offline" ? ["--offline"] : [];
  const inputs = [
    "help",
    "wait 3",
    "take bread",
    "eat bread",
    "go kitchen",
    "search coat",
    "examine markers",
    "journal",
    "quit",
  ];
  const first = discover(inputs, flags);
  const note = journalEntries(first.game.world).find((e) => e.claim.id === C_ODO_GAMBLES.id);
  assert(note, "exploration did not earn the claim");
  assert.equal(note.edge.source.kind, "witnessed");
  const tell = `tell mara about note ${note.note}`;
  const ask = `ask mara about note ${note.note}`;
  const nextInputs = ["go common room", tell, ask, "journal", "quit"];
  const transcript = play(nextInputs, flags);
  const completed = persist("conversation", transcript);
  inspectSpeech(
    completed.log,
    [
      [tell, "tell"],
      [ask, "ask"],
    ],
    note.claim.id,
  );
  assert.match(transcript, /You tell Mara that Odo owes money to river gamblers/);
  assert.match(transcript, /You ask Mara/);
  const later = journalEntries(completed.game.world).find((e) => e.claim.id === note.claim.id);
  assert.equal(later.note, note.note);
  assert.deepEqual(later.edge.source, note.edge.source);

  const resumed = play(["journal", "quit"], ["--offline"]);
  const restored = persist("resume", resumed);
  assert.deepEqual(restored.game.world, completed.game.world);
  assert(resumed.includes(renderJournal(completed.game.world)));
  const decisions = completed.log.filter((e) => e.kind === "decision");
  const tokens = decisions.reduce((sum, e) => sum + e.inputTokens, 0);
  const summary = {
    mode,
    model: mode === "live" ? MODEL : null,
    node: process.version,
    platform: process.platform,
    recoveredDiscovery: recovery ? relative(root, recovery) : null,
    inputs: [...inputs, ...nextInputs],
    note: note.note,
    claim: note.claim.id,
    jevDecisions: decisions.filter((e) => e.source === "jev").length,
    fallbackDecisions: decisions.filter((e) => e.source === "fallback").length,
    inputTokens: tokens,
    listPriceUsd: tokens * USD_PER_INPUT_TOKEN,
    budget: { maxLiveDecisions: 40, maxCostUsd: 0.01, cliTimeoutMs: 90_000 },
    deterministicNoteActions: 2,
    stableReferencesAcrossResume: true,
    replayAndResumeEqual: true,
    humanPlaytest: false,
  };
  writeFileSync(join(output, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, 2));
  assert(summary.jevDecisions <= 40, "declared live-decision budget exceeded");
  assert(summary.listPriceUsd <= 0.01, "declared cost budget exceeded");
  if (mode === "live") {
    assert(summary.jevDecisions > 0, "no live-provider evidence");
    assert.equal(summary.fallbackDecisions, 0, "live run degraded");
  }
} finally {
  rmSync(directory, { recursive: true, force: true });
}
