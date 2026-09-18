/**
 * pnpm sdlc status              where every managed issue stands, and whether the loop may run
 * pnpm sdlc init                create the labels on GitHub (safe to repeat)
 * pnpm sdlc intake              file an issue for each new snag in the nights handed in
 * pnpm sdlc tick [--dry-run]    one pass: move a few issues one stage forward, then end
 * pnpm sdlc run [--every=15]    a pass every so many minutes, until stopped or switched off
 * pnpm sdlc clean               remove the worktrees of issues that are closed
 * pnpm sdlc sandbox-build       build the container image the tool stages and the gate run in
 *
 * The development loop (docs/sdlc.md). Code owns the workflow: the stage of an issue is a
 * label, the next stage is a table, the gate is run by this program, and only this program
 * commits, pushes and opens pull requests. A model fills in one stage at a time through the
 * `prime-agent` CLI. One pass keeps no memory of its own: GitHub holds the state, `.sdlc/`
 * holds the working files, and each issue is built in a worktree of its own. It never merges.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  journal,
  type LoopConfig,
  must,
  readConfig,
  readJournal,
  run,
  withLock,
  worktreeRoot,
} from "./sdlc/env.ts";
import {
  AGENT_STAGES,
  type AgentStage,
  budgetLeft,
  type Cluster,
  clusterSnags,
  issueBody,
  keyIn,
  MANAGED,
  parseFriction,
  stageLabel,
  stageOf,
} from "./sdlc/flow.ts";
import { createIssue, ensureLabels, type Issue, listIssues, reopen } from "./sdlc/github.ts";
import { sandboxReady, sweep } from "./sdlc/sandbox.ts";
import { buildSandbox } from "./sdlc/sandbox-build.ts";
import { advance, stuck } from "./sdlc/stages.ts";
import { ROOT } from "./session.ts";

const flags = process.argv.slice(3);
const has = (flag: string): boolean => flags.includes(flag);
const numberFlag = (flag: string, fallback: number): number =>
  Number(flags.find((f) => f.startsWith(`${flag}=`))?.split("=")[1] ?? fallback);

/** Anyone can open an issue on a public repository. Only these people's issues are worked on. */
const trusted = (config: LoopConfig, issue: Issue): boolean =>
  config.sdlc.trusted_authors.includes(issue.author);

// --- intake -------------------------------------------------------------------------

const INBOX = join(ROOT, "playtests", "inbox");

/** Only nights handed in are filed: an issue quotes what the player typed, in public. */
function handedIn(): string[] {
  if (!existsSync(INBOX)) return [];
  return readdirSync(INBOX)
    .filter((f) => f.endsWith(".jsonl"))
    .map((f) => join(INBOX, f));
}

function happenedSince(cluster: Cluster, closedAt: string | null): string | null {
  const closed = closedAt ? Date.parse(closedAt) : 0;
  const night = cluster.rows.find((r) => {
    const file = join(INBOX, `${r.night}.jsonl`);
    return existsSync(file) && statSync(file).mtimeMs > closed;
  });
  return night?.night ?? null;
}

function intake(dryRun: boolean): void {
  const nights = handedIn();
  if (nights.length === 0) {
    console.log("No nights in playtests/inbox. Hand one in with `pnpm friction --submit`.");
    return;
  }
  must(run("node", [join(import.meta.dirname, "friction.ts"), ...nights]), "friction report");
  const clusters = clusterSnags(
    parseFriction(readFileSync(join(ROOT, "playtests", "friction.md"), "utf8")),
  );
  const known = new Map(listIssues("snag", "all").map((i) => [keyIn(i.body), i] as const));
  for (const cluster of clusters) {
    const issue = known.get(cluster.key);
    const title = `${cluster.kind}: "${cluster.input.slice(0, 60)}"`;
    if (!issue) {
      console.log(`new       ${title}`);
      if (!dryRun) createIssue(title, issueBody(cluster), [MANAGED, "snag", stageLabel("triage")]);
      continue;
    }
    // Closed as not planned is a person's no, for good. Closed as done may come back.
    const again = issue.state === "CLOSED" && issue.stateReason === "COMPLETED";
    const night = again ? happenedSince(cluster, issue.closedAt) : null;
    console.log(`${night ? "again    " : "known    "} #${issue.number} ${title}`);
    if (night && !dryRun)
      reopen(issue.number, `Seen again on night ${night}, after this was closed.`);
  }
}

// --- tick ---------------------------------------------------------------------------

/** Finish what is furthest along before starting anything new. */
const ORDER: readonly AgentStage[] = ["pr", "review", "build", "plan", "triage"];

function queue(config: LoopConfig): { issue: Issue; stage: AgentStage }[] {
  const open = listIssues(MANAGED, "open").filter((i) => trusted(config, i));
  return ORDER.flatMap((stage) =>
    open.filter((i) => stageOf(i.labels) === stage).map((issue) => ({ issue, stage })),
  ).slice(0, config.max_snags_per_run);
}

function tick(dryRun: boolean): Promise<void> {
  const config = readConfig();
  if (!(config.enabled || dryRun)) {
    console.log(
      "playtests/loop.json says the loop is off. Nothing done. (`--dry-run` still looks.)",
    );
    return Promise.resolve();
  }
  const passStarted = Date.now();
  if (!dryRun) prepare(config);
  intake(dryRun);
  const work = queue(config);
  if (work.length === 0) console.log("Nothing is waiting on the loop.");
  for (const { issue, stage } of work) {
    if (dryRun) {
      console.log(`would run ${stage.padEnd(7)} #${issue.number} ${issue.title}`);
      continue;
    }
    const budget = budgetLeft(readJournal(), {
      now: Date.now(),
      passStarted,
      perPass: config.sdlc.max_tokens_per_pass ?? 4_000_000,
      perDay: config.sdlc.max_tokens_per_day ?? 20_000_000,
    });
    if (!budget.ok) {
      journal({ stopped: "budget", why: budget.why });
      console.log(`Stopping this pass: ${budget.why}.`);
      break;
    }
    try {
      const next = advance(config, issue, stage);
      console.log(`${stage.padEnd(7)} #${issue.number} -> ${next}`);
    } catch (error) {
      // One issue failing must not stop the pass, must not be lost, and must not repeat for ever.
      const message = error instanceof Error ? error.message : String(error);
      journal({ issue: issue.number, stage, error: message });
      console.error(`${stage.padEnd(7)} #${issue.number} failed: ${message.split("\n")[0]}`);
      stuck(config, issue, stage, message);
    }
  }
  return Promise.resolve();
}

/**
 * What a pass does before any work, under the lock: clear away what a pass that died left in
 * the container engine, and find out whether the engine answers at all. If it does not, the
 * tool stages are held for this pass and the reason is said once, not once per issue.
 */
function prepare(config: LoopConfig): void {
  const sandbox = config.sdlc.sandbox;
  if (sandbox?.kind !== "podman" || config.sdlc.allow_tool_stages !== true) return;
  if (!sandboxReady(sandbox)) {
    config.sdlc.allow_tool_stages = false;
    journal({ held: "tool stages", why: "podman does not answer" });
    console.log(
      "Podman does not answer (is its machine started?). Tool stages are held this pass.",
    );
    return;
  }
  const swept = sweep(sandbox);
  if (swept.length > 0) journal({ swept });
}

async function runForever(minutes: number): Promise<void> {
  for (;;) {
    // The switch is read on every pass, so turning it off stops the loop at the next one.
    if (!readConfig().enabled) {
      console.log("The loop is switched off. Stopping.");
      return;
    }
    try {
      await withLock(() => tick(false));
    } catch (error) {
      // A pass that cannot run (another holds the lock, GitHub is down) is skipped, not fatal:
      // the loop is still there for the next one.
      const message = error instanceof Error ? error.message : String(error);
      const why = message.split("\n")[0] ?? message;
      journal({ pass: "skipped", why });
      console.error(`Pass skipped: ${why}`);
    }
    await new Promise((resolve) => setTimeout(resolve, minutes * 60_000));
  }
}

// --- status and clean -----------------------------------------------------------------

function status(): void {
  const config = readConfig();
  const { agent } = config.sdlc;
  console.log(
    `Loop: ${config.enabled ? "ON" : "off"}   base: ${config.sdlc.base_branch}   agent: ${agent.provider}`,
  );
  for (const stage of AGENT_STAGES) console.log(`  ${stage.padEnd(7)} ${agent.models[stage]}`);
  const issues = listIssues(MANAGED, "open");
  if (issues.length === 0) console.log("No managed issues are open.");
  for (const issue of issues) {
    const who = trusted(config, issue)
      ? ""
      : `  (ignored: ${issue.author} is not a trusted author)`;
    console.log(`  ${stageOf(issue.labels).padEnd(7)} #${issue.number} ${issue.title}${who}`);
  }
}

function clean(): void {
  const config = readConfig();
  const root = worktreeRoot(config);
  if (!existsSync(root)) return;
  const open = new Set(listIssues(MANAGED, "open").map((i) => `issue-${i.number}`));
  for (const dir of readdirSync(root).filter((d) => d.startsWith("issue-") && !open.has(d))) {
    const removed = run("git", ["worktree", "remove", join(root, dir)]);
    console.log(`${removed.ok ? "removed" : "kept (has changes)"} ${dir}`);
  }
}

const COMMANDS: Record<string, () => Promise<void> | void> = {
  status,
  init: ensureLabels,
  intake: () => intake(has("--dry-run")),
  tick: () => (has("--dry-run") ? tick(true) : withLock(() => tick(false))),
  run: () => runForever(numberFlag("--every", 15)),
  clean,
  "sandbox-build": () => buildSandbox(readConfig()),
};

const command = COMMANDS[process.argv[2] ?? "status"];
if (!command) {
  console.error(`Unknown command. One of: ${Object.keys(COMMANDS).join(", ")}`);
  process.exit(2);
}
await command();
