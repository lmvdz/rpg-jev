/**
 * The loop's surroundings: its switch and limits (`playtests/loop.json`), its local files
 * (`.sdlc/`, ignored), and the three programs it drives: `git`, `gh` and `pnpm`. Programs are
 * run with argument lists, never a command string, so text from an issue cannot become a
 * command.
 */
import { type ExecSyncOptionsWithStringEncoding, execFileSync, execSync } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { ROOT } from "../session.ts";
import {
  AGENT_STAGES,
  type AgentStage,
  type JournalLine,
  lockIsStale,
  lockText,
  parseLock,
} from "./flow.ts";
import type { SandboxConfig } from "./sandbox.ts";

export interface LoopConfig {
  enabled: boolean;
  max_open_pull_requests: number;
  max_snags_per_run: number;
  may_change: string[];
  may_not_change: string[];
  sdlc: {
    base_branch: string;
    worktree_root: string;
    trusted_authors: string[];
    max_build_attempts: number;
    /** Times in a row a stage may come back with nothing before the issue goes to a person. */
    max_unanswered?: number;
    /** Tokens, by the agent CLI's count, after which a pass starts no further stage. */
    max_tokens_per_pass?: number;
    /** The same over the last 24 hours. */
    max_tokens_per_day?: number;
    /** Whose review comments on a loop pull request are answered. Everyone else's wait for a person. */
    trusted_reviewers: string[];
    /** The name of the check run that is this repository's own gate in CI. */
    gate_check: string;
    /**
     * Plan and build give the model tools, and `prime-agent`'s tool is a Python REPL with no
     * sandbox: in those stages it can do whatever the account running the loop can. They stay
     * shut until a person sets this, which is a separate decision from switching the loop on.
     */
    allow_tool_stages: boolean;
    /** Where the tool stages and the gate run. Without it the tool stages stay shut. */
    sandbox?: SandboxConfig;
    agent: {
      provider: string;
      models: Record<AgentStage, string>;
      /** Environment variables the model's CLI needs although they look like credentials. */
      env_keep?: string[];
      build: { max_turns: number; max_tokens: number; timeout_minutes: number };
    };
  };
}

/** A provider or model id goes on a command line, so it may only look like one. */
const SAFE_ID = /^[\w./:@-]+$/;

export function readConfig(): LoopConfig {
  const config = JSON.parse(
    readFileSync(join(ROOT, "playtests", "loop.json"), "utf8"),
  ) as LoopConfig;
  const agent = config.sdlc?.agent;
  if (!agent) throw new Error("playtests/loop.json has no `sdlc.agent` block");
  for (const id of [agent.provider, ...AGENT_STAGES.map((s) => agent.models[s])])
    if (!(id && SAFE_ID.test(id))) throw new Error(`loop.json: not a provider or model id: ${id}`);
  if (config.sdlc.trusted_authors.length === 0)
    throw new Error("loop.json: `sdlc.trusted_authors` is empty, so no issue would be worked on");
  return config;
}

export const LOCAL = join(ROOT, ".sdlc");
export const workDir = (issue: number): string => {
  const dir = join(LOCAL, "work", String(issue));
  mkdirSync(dir, { recursive: true });
  return dir;
};
export const worktreeRoot = (config: LoopConfig): string =>
  resolve(ROOT, config.sdlc.worktree_root);

/** One line per thing the loop did, so a pass can be read back afterwards. */
export function journal(entry: Record<string, unknown>): void {
  mkdirSync(LOCAL, { recursive: true });
  appendFileSync(
    join(LOCAL, "journal.jsonl"),
    `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`,
  );
}

/** What the journal holds, oldest first. A line that does not parse is skipped. */
export function readJournal(): JournalLine[] {
  const file = join(LOCAL, "journal.jsonl");
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split("\n")
    .flatMap((line) => {
      try {
        return line.trim() ? [JSON.parse(line) as JournalLine] : [];
      } catch {
        return [];
      }
    });
}

const alive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // No such process. "Not permitted" means it exists and is someone else's.
    return (error as { code?: string }).code === "EPERM";
  }
};

/** No pass can outlive this: every stage has a time limit, and a pass runs a few stages. */
const LOCK_MAX_AGE_MS = 6 * 60 * 60_000;

/**
 * Two passes at once would build the same issue twice. The lock names who holds it. A lock
 * left by a pass that died (a reboot, a killed terminal) is taken over, and said so in the
 * journal, so that an unattended loop does not stop for ever on a file.
 */
export function withLock<T>(run: () => Promise<T>): Promise<T> {
  const lock = join(LOCAL, "lock");
  mkdirSync(LOCAL, { recursive: true });
  if (existsSync(lock)) {
    const text = readFileSync(lock, "utf8");
    if (!lockIsStale(parseLock(text), { now: Date.now(), alive, maxAgeMs: LOCK_MAX_AGE_MS }))
      throw new Error(`Another pass holds ${lock} (${text}).`);
    journal({ lock: "stale, taken over", was: text });
  }
  writeFileSync(lock, lockText({ pid: process.pid, since: new Date().toISOString() }));
  return run().finally(() => rmSync(lock, { force: true }));
}

export interface Ran {
  ok: boolean;
  out: string;
}

/** Runs a program to the end. Failure is a value, because a failing gate is an outcome. */
export function run(
  program: "git" | "gh" | "pnpm" | "node",
  args: readonly string[],
  options: { cwd?: string; input?: string; timeoutMs?: number } = {},
): Ran {
  // pnpm is a .cmd shim on Windows and needs a shell; its arguments here are all fixed words.
  const viaShell = program === "pnpm" && process.platform === "win32";
  const shared: ExecSyncOptionsWithStringEncoding = {
    cwd: options.cwd ?? ROOT,
    encoding: "utf8",
    timeout: options.timeoutMs ?? 600_000,
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["pipe", "pipe", "pipe"],
    ...(options.input === undefined ? {} : { input: options.input }),
  };
  try {
    const out = viaShell
      ? execSync([program, ...args].join(" "), shared)
      : execFileSync(program === "node" ? process.execPath : program, [...args], shared);
    return { ok: true, out };
  } catch (error) {
    const e = error as { stdout?: string; stderr?: string; message?: string };
    return { ok: false, out: `${e.stdout ?? ""}${e.stderr ?? ""}` || (e.message ?? "failed") };
  }
}

export function must(ran: Ran, what: string): string {
  if (!ran.ok) throw new Error(`${what} failed:\n${ran.out.slice(-2000)}`);
  return ran.out;
}
