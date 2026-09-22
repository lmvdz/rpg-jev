/**
 * Generative calls go through the Claude CLI on the subscription login (CLAUDE.md: no Anthropic
 * API key). One prompt in, the reply's text out, or null when the CLI fails.
 */
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export function askClaude(prompt: string, timeoutMs = 600_000): string | null {
  // An empty working directory: the labeller sees the prompt and nothing of the repository.
  const cwd = mkdtempSync(join(tmpdir(), "jepa-label-"));
  const run = spawnSync("claude", ["-p", "--output-format", "json", "--tools", ""], {
    cwd,
    input: prompt,
    encoding: "utf8",
    timeout: timeoutMs,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (run.status !== 0 || !run.stdout) return null;
  try {
    const reply = JSON.parse(run.stdout) as { result?: unknown; is_error?: boolean };
    return !reply.is_error && typeof reply.result === "string" ? reply.result : null;
  } catch {
    return null;
  }
}

/** As `askClaude`, without blocking, so a few labelling calls can run side by side. */
export function askClaudeAsync(prompt: string, timeoutMs = 900_000): Promise<string | null> {
  const cwd = mkdtempSync(join(tmpdir(), "jepa-label-"));
  return new Promise((resolve) => {
    const child = spawn("claude", ["-p", "--output-format", "json", "--tools", ""], { cwd });
    let out = "";
    const timer = setTimeout(() => child.kill(), timeoutMs);
    child.stdout.on("data", (chunk: Buffer) => {
      out += chunk.toString("utf8");
    });
    child.on("error", () => resolve(null));
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) return resolve(null);
      try {
        const reply = JSON.parse(out) as { result?: unknown; is_error?: boolean };
        resolve(!reply.is_error && typeof reply.result === "string" ? reply.result : null);
      } catch {
        resolve(null);
      }
    });
    child.stdin.end(prompt);
  });
}
