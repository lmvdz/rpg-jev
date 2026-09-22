/**
 * Generative calls go through the Claude CLI on the subscription login (CLAUDE.md: no Anthropic
 * API key). One prompt in, the reply's text out, or null when the CLI fails.
 */
import { spawnSync } from "node:child_process";
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
