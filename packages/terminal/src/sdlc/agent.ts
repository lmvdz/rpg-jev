/**
 * One model call for one stage, through the `prime-agent` CLI. The prompt is a file the loop
 * wrote; the answer is text the loop parses. A stage that only has to judge runs with no
 * tools at all, so what it reads cannot make it do anything. Only `plan` and `build` get
 * tools, and they run inside the issue's own worktree.
 */
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { journal, type LoopConfig, workDir } from "./env.ts";
import { type AgentStage, withoutSecrets } from "./flow.ts";
import { agentModels, type Box, HOME, routerKey, type SandboxConfig } from "./sandbox.ts";

export interface Reply {
  ok: boolean;
  text: string;
  tokens: number;
}

interface AgentMessage {
  role?: string;
  content?: { type?: string; text?: string }[];
  usage?: { totalTokens?: number };
}

/** The final assistant text and the tokens spent, from `--mode json` output. */
export function readReply(stdout: string): { text: string; tokens: number } {
  const end = stdout
    .split("\n")
    .reverse()
    .find((line) => line.startsWith('{"type":"agent_end"'));
  if (!end) return { text: stdout, tokens: 0 };
  const messages = (JSON.parse(end) as { messages?: AgentMessage[] }).messages ?? [];
  const spoken = messages.filter((m) => m.role === "assistant");
  const text = (spoken.at(-1)?.content ?? [])
    .filter((part) => part.type === "text")
    .map((part) => part.text ?? "")
    .join("\n");
  return { text, tokens: spoken.reduce((sum, m) => sum + (m.usage?.totalTokens ?? 0), 0) };
}

const quoted = (path: string): string => `"${path.replaceAll('"', "")}"`;

export function askAgent(o: {
  config: LoopConfig;
  issue: number;
  stage: AgentStage;
  prompt: string;
  cwd: string;
  tools: boolean;
  /** A command that must pass before an autonomous run may call itself done. */
  gate?: string;
  /** Where a stage with tools runs. Without it the agent runs on the host, in `cwd`. */
  box?: { open: Box; sandbox: SandboxConfig };
}): Reply {
  const { agent } = o.config.sdlc;
  const promptFile = join(workDir(o.issue), `${o.stage}.prompt.md`);
  writeFileSync(promptFile, o.prompt);
  const args = ["-p", "--mode", "json", "--no-session", "-ns", "-ne", "-np"];
  args.push("--provider", agent.provider, "--model", agent.models[o.stage]);
  // A judging stage gets everything it needs in its prompt: no tools, no discovered context.
  if (!o.tools) args.push("-nt", "-nc");
  if (o.gate) {
    args.push("--autonomous", "--autonomous-gate", quoted(o.gate));
    args.push("--autonomous-max-turns", String(agent.build.max_turns));
    args.push("--autonomous-max-tokens", String(agent.build.max_tokens));
    args.push("--autonomous-timeout-ms", String(agent.build.timeout_minutes * 60_000));
  }
  const started = Date.now();
  if (o.box) {
    const ran = inBox(o.box.open, o.box.sandbox, agent.provider, agent.models[o.stage], args, o);
    return record(o, ran.out, ran.ok, started);
  }
  args.push(`@${quoted(promptFile)}`, quoted("Carry out the attached instructions."));

  // The CLI is a shell shim on every platform. Each word above is fixed, a number, an id that
  // `readConfig` has checked, or a path quoted here, so the line is safe to hand to a shell.
  const ran = spawnSync(["prime-agent", ...args].join(" "), {
    cwd: o.cwd,
    env: withoutSecrets(process.env, agent.env_keep ?? []),
    encoding: "utf8",
    shell: true,
    timeout: (agent.build.timeout_minutes + 5) * 60_000,
    maxBuffer: 256 * 1024 * 1024,
  });
  return record(o, ran.stdout ?? "", ran.status === 0, started, ran.stderr ?? "");
}

/**
 * The same call, inside a box. Arguments go as a list, so nothing is quoted for a shell. The
 * box is told of one provider and one model, at the relay's address, and the prompt is
 * written into it over stdin. Tool discovery stays off: the box holds the tree and nothing
 * the agent should pick instructions up from.
 */
function inBox(
  box: Box,
  sandbox: SandboxConfig,
  provider: string,
  model: string,
  args: readonly string[],
  o: { prompt: string },
): { ok: boolean; out: string } {
  const config = `${HOME}/.prime/agent`;
  const write = (file: string, text: string) =>
    box.exec(["sh", "-c", `mkdir -p "$(dirname "${file}")" && cat > "${file}"`], text);
  write(`${config}/models.json`, agentModels(sandbox, provider, model, routerKey(provider)));
  write("/tmp/prompt.md", o.prompt);
  // The gate argument was quoted for the host's shell; here it is one list element.
  const unquoted = args.map((a) => a.replace(/^"(.*)"$/, "$1"));
  return box.exec([
    "prime-agent",
    ...unquoted,
    "--offline",
    "@/tmp/prompt.md",
    "Carry out the attached instructions.",
  ]);
}

function record(
  o: { config: LoopConfig; issue: number; stage: AgentStage; box?: unknown },
  stdout: string,
  exited: boolean,
  started: number,
  stderr = "",
): Reply {
  const { agent } = o.config.sdlc;
  const { text, tokens } = readReply(stdout);
  const ok = exited && text.length > 0;
  writeFileSync(join(workDir(o.issue), `${o.stage}.reply.md`), text || stderr);
  journal({
    issue: o.issue,
    stage: o.stage,
    model: `${agent.provider}/${agent.models[o.stage]}`,
    where: o.box ? "box" : "host",
    tokens,
    ms: Date.now() - started,
    ok,
  });
  return { ok, text, tokens };
}
