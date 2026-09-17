/**
 * One-shot, tool-free call to the Claude CLI on the subscription login.
 * No Anthropic API key is used (CLAUDE.md). The prompt goes in on stdin and the
 * answer comes back as schema-validated JSON.
 */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface ClaudeCall {
  model: string;
  system: string;
  prompt: string;
  schema: object;
  timeoutMs?: number;
}

export interface ClaudeResult<T> {
  output: T;
  durationMs: number;
  model: string;
}

export function askClaude<T>(call: ClaudeCall): Promise<ClaudeResult<T>> {
  // An empty working directory keeps project files and CLAUDE.md out of the labeller's context.
  const cwd = mkdtempSync(join(tmpdir(), "m0-labeller-"));
  const args = [
    "-p",
    "--model",
    call.model,
    "--tools",
    "",
    "--strict-mcp-config",
    "--no-session-persistence",
    "--system-prompt",
    call.system,
    "--output-format",
    "json",
    "--json-schema",
    JSON.stringify(call.schema),
  ];

  return new Promise((resolve, reject) => {
    const child = spawn("claude", args, { cwd, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => child.kill(), call.timeoutMs ?? 180_000);
    child.stdout.on("data", (d) => {
      stdout += d;
    });
    child.stderr.on("data", (d) => {
      stderr += d;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      clearTimeout(timer);
      rmSync(cwd, { recursive: true, force: true });
      try {
        const parsed = JSON.parse(stdout) as {
          is_error: boolean;
          structured_output?: T;
          result?: string;
          duration_ms: number;
        };
        if (parsed.is_error || parsed.structured_output === undefined) {
          reject(new Error(`claude returned no structured output: ${parsed.result ?? stderr}`));
          return;
        }
        resolve({
          output: parsed.structured_output,
          durationMs: parsed.duration_ms,
          model: call.model,
        });
      } catch {
        reject(new Error(`claude exited ${code}: ${stderr || stdout.slice(0, 300)}`));
      }
    });
    child.stdin.end(call.prompt);
  });
}
