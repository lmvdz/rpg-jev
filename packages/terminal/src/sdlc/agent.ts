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
import { agentModels, type Box, HOME, type SandboxConfig } from "./sandbox.ts";

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

/** The assistant messages an event carries: all of them at the end of a run, one at the end of a turn. */
function spokenIn(line: string): AgentMessage[] {
  if (!/^\{"type":"(agent_end|turn_end|message_end)"/.test(line)) return [];
  try {
    const event = JSON.parse(line) as { messages?: AgentMessage[]; message?: AgentMessage };
    const all = event.messages ?? (event.message ? [event.message] : []);
    return all.filter((m) => m.role === "assistant");
  } catch {
    // A last line cut short by the process exiting is not an event.
    return [];
  }
}

/**
 * The final assistant text and the tokens spent, from `--mode json` output. The run's last
 * event, `agent_end`, holds everything, but it does not always arrive: a first real pass ended
 * at `turn_end` with the answer in it. So the reader takes the last event that carries an
 * assistant message, whichever kind it is.
 */
export function readReply(stdout: string): { text: string; tokens: number } {
  const lines = stdout.split("\n").reverse();
  const spoken = lines.map(spokenIn).find((found) => found.length > 0);
  if (!spoken) return { text: "", tokens: 0 };
  const text = (spoken.at(-1)?.content ?? [])
    .filter((part) => part.type === "text")
    .map((part) => part.text ?? "")
    .join("\n");
  return { text, tokens: spoken.reduce((sum, m) => sum + (m.usage?.totalTokens ?? 0), 0) };
}

const quoted = (path: string): string => `"${path.replaceAll('"', "")}"`;

export interface Ask {
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
}

/** How often a model that said nothing at all is asked again, within one call. */
const ASKED_AGAIN = 2;

/**
 * One stage's question, put to the model. A reply with no text in it (the router sometimes
 * ends a stream with nothing but an empty thought) is not an answer and not a refusal, so it
 * is asked again, a bounded number of times, before the stage reports that nothing came back.
 */
export function askAgent(o: Ask): Reply {
  let reply = askOnce(o);
  for (let again = 0; again < ASKED_AGAIN && reply.text.length === 0; again++) reply = askOnce(o);
  return reply;
}

function askOnce(o: Ask): Reply {
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
  write(`${config}/models.json`, agentModels(sandbox, provider, model));
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
