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
import { AGENT_STAGES, type AgentStage } from "./flow.ts";

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
    /**
     * Plan and build give the model tools, and `prime-agent`'s tool is a Python REPL with no
     * sandbox: in those stages it can do whatever the account running the loop can. They stay
     * shut until a person sets this, which is a separate decision from switching the loop on.
     */
    allow_tool_stages: boolean;
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

/** Two passes at once would build the same issue twice. The lock names who holds it. */
export function withLock<T>(run: () => Promise<T>): Promise<T> {
  const lock = join(LOCAL, "lock");
  mkdirSync(LOCAL, { recursive: true });
  if (existsSync(lock))
    throw new Error(
      `Another pass holds ${lock} (${readFileSync(lock, "utf8")}). Delete it if that pass is dead.`,
    );
  writeFileSync(lock, `pid ${process.pid}, since ${new Date().toISOString()}`);
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
