/** Real terminal workflow, including a process exit while proposals remain pending. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { parseLog } from "../../packages/core/src/log.ts";
import { PROPOSAL_DEBT_KIND } from "../../packages/core/src/proposals.ts";
import { Game } from "../../packages/inn/src/game.ts";
import { HANDWRITTEN_CONTENT_VERSION } from "../../packages/inn/src/proposal-content.ts";
import { MODEL, USD_PER_INPUT_TOKEN } from "../../packages/jev/src/judge.ts";

const mode = process.argv[2];
assert(["live", "offline"].includes(mode), "usage: run.mjs <live|offline> <new-output-directory>");
assert(process.argv[3], "an output directory is required");
if (mode === "live") assert(process.env.TYPESAFE_API_KEY, "supply the key in the environment");
const root = resolve(import.meta.dirname, "../..");
const output = resolve(process.argv[3]);
mkdirSync(resolve(output, ".."), { recursive: true });
mkdirSync(output);
mkdirSync(join(root, "saves"), { recursive: true });
const directory = mkdtempSync(join(root, "saves", "proposal-workflow-"));
const savePath = join(directory, "night.jsonl");
const save = relative(join(root, "saves"), join(directory, "night"));
const forbidden = {
  ask() {
    throw new Error("loading a save attempted inference");
  },
};
const load = () => Game.resume(parseLog(readFileSync(savePath, "utf8")), forbidden);

function play(commands, flags) {
  const run = spawnSync(
    process.execPath,
    ["packages/terminal/src/play.ts", "--plain", "--fast", `--save=${save}`, ...flags],
    { cwd: root, input: `${commands.join("\n")}\n`, encoding: "utf8", timeout: 90_000 },
  );
  assert.ifError(run.error);
  assert.equal(run.status, 0, "CLI failed; inspect locally before retrying");
  return run.stdout;
}

function assertConsequences(game) {
  const debts = Object.values(game.world.debts).filter((debt) => debt.kind === PROPOSAL_DEBT_KIND);
  assert.equal(debts.length, 3);
  assert(debts.every((debt) => debt.status === "fired"));
  assert.equal(game.log.filter((entry) => entry.what === "proposal:admitted").length, 3);
  assert.equal(game.log.filter((entry) => entry.what === "proposal:fired").length, 3);
  for (const debt of debts) {
    const fire = game.log.find(
      (entry) => entry.what === "proposal:fired" && entry.data.debtId === debt.id,
    );
    assert(fire);
    assert.equal(fire.t, debt.fuse.due);
    assert.equal(fire.cause, debt.cause);
    assert(game.log.some((entry) => entry.kind === "effect" && entry.cause === fire.id));
  }
  assert.deepEqual(game.world.items.bread.at, { room: "ashes" });
  assert.deepEqual(game.world.items.onion.at, { room: "kitchen" });
  assert.deepEqual(game.world.items.tankard.at, { room: "common_room" });
  assert(game.world.actors.player.needs.hunger < 0.55);
}

try {
  const modeFlag = mode === "offline" ? ["--offline"] : [];
  const first = play(
    ["take bread", "wait 2", "quit"],
    ["--new", "--handwritten", "--seed=1", ...modeFlag],
  );
  assert.match(first, /nothing like that to take/);
  const pending = load();
  assert.equal(pending.log[0].content, HANDWRITTEN_CONTENT_VERSION);
  assert.equal(
    Object.values(pending.world.debts).filter(
      (debt) => debt.kind === PROPOSAL_DEBT_KIND && debt.status === "pending",
    ).length,
    3,
  );
  writeFileSync(join(output, "pending.jsonl"), readFileSync(savePath, "utf8"));
  const second = play(
    ["wait 1", "take bread", "eat bread", "talk to mara", "wait 3", "inventory", "quit"],
    modeFlag,
  );
  assert.match(second, /Mara sets out a heel of bread/);
  assert.doesNotMatch(second, /Odo sets out/);
  const completed = load();
  assertConsequences(completed);
  writeFileSync(join(output, "completed.jsonl"), readFileSync(savePath, "utf8"));
  const last = play(["look", "inventory", "quit"], ["--offline"]);
  assert.doesNotMatch(last, /sets out/);
  assert.deepEqual(load().world, completed.world);
  const decisions = completed.log.filter((entry) => entry.kind === "decision");
  const summary = {
    mode,
    content: HANDWRITTEN_CONTENT_VERSION,
    model: mode === "live" ? MODEL : null,
    platform: process.platform,
    node: process.version,
    pendingAcrossExit: 3,
    firedAtExactDueTimes: 3,
    admissionCountAfterResume: 3,
    consumedServedBread: true,
    hiddenKitchenEventNotRendered: true,
    replayEqual: true,
    jevDecisions: decisions.filter((entry) => entry.source === "jev").length,
    fallbackDecisions: decisions.filter((entry) => entry.source === "fallback").length,
    inputTokens: decisions.reduce((sum, entry) => sum + entry.inputTokens, 0),
    humanPlaytest: false,
  };
  writeFileSync(
    join(output, "transcript.txt"),
    `${first}\n--- RESUME PENDING ---\n${second}\n--- OFFLINE RESUME SETTLED ---\n${last.trimEnd()}\n`,
  );
  writeFileSync(join(output, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(
    JSON.stringify({ ...summary, usd: summary.inputTokens * USD_PER_INPUT_TOKEN }, null, 2),
  );
  if (mode === "live") {
    assert(summary.jevDecisions > 0);
    assert.equal(summary.fallbackDecisions, 0, "degraded live run; do not report a live pass");
  }
} finally {
  rmSync(directory, { recursive: true, force: true });
}
