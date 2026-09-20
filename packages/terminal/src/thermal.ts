/**
 * Human bench by default; --json retains the trusted two-actor driver.
 * One process/Store. Operator saves are privileged; stdout uses projections only.
 */
import { closeSync, existsSync, mkdirSync, openSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";
import { view } from "../../core/src/thermal/attempt.ts";
import { provenanceSchema } from "./thermal-journal.ts";
import { BenchPlayer } from "./thermal-player.ts";
import { interact, loadBench, saveBench, startBench } from "./thermal-session.ts";

const json = process.argv.includes("--json");
const ephemeral = process.argv.includes("--ephemeral");
const defaultPath =
  json || ephemeral
    ? undefined
    : join(import.meta.dirname, "..", "..", "..", "saves", "thermal-bench.jsonl");
const path = process.argv.find((arg) => arg.startsWith("--save="))?.slice(7) ?? defaultPath;
if (path === "" || (ephemeral && path)) throw new Error("Choose a save path or --ephemeral.");
const actor = process.argv.find((arg) => arg.startsWith("--actor="))?.slice(8) ?? "ada";
const provenance = provenanceSchema.parse(
  process.argv.find((arg) => arg.startsWith("--provenance="))?.slice(13) ?? "unspecified",
);
const lock = path ? `${path}.lock` : undefined;
if (path) mkdirSync(dirname(path), { recursive: true });
// Do not let two local hosts silently fork and overwrite the same authority.
const lockFd = lock ? openSync(lock, "wx", 0o600) : undefined;
try {
  const store = path && existsSync(path) ? loadBench(path) : startBench();
  if (!view(store, actor).available) throw new Error("Unknown or unavailable local actor.");
  const player = new BenchPlayer(store, actor, provenance);
  if (path) saveBench(store, path);
  console.log(json ? JSON.stringify({ actor, view: view(store, actor) }) : player.intro());
  if (!json)
    console.log(
      path
        ? "Session saves after each change."
        : "Ephemeral session: use --save=<path> to retain it.",
    );
  const lines = createInterface({
    input: process.stdin,
    output: process.stdout,
    crlfDelay: Infinity,
    terminal: !json && Boolean(process.stdin.isTTY),
  });
  const prompt = () => {
    if (!json && process.stdin.isTTY) lines.prompt();
  };
  lines.setPrompt("bench> ");
  prompt();
  for await (const line of lines) {
    if (json && line === "quit") break;
    if (!json) {
      const response = player.turn(line);
      if (path) saveBench(store, path);
      console.log(response.text);
      if (response.quit) break;
      prompt();
      continue;
    }
    let input: {
      actor: string;
      view?: boolean;
      requestId: string;
      expectedRevision: number;
      operation: unknown;
    };
    try {
      if (line.length > 4096) throw new Error("input too long");
      input = JSON.parse(line);
      if (input.actor !== "ada" && input.actor !== "bo") throw new Error("unknown local actor");
    } catch {
      console.log(
        JSON.stringify({ status: "unsupported", message: "Use a bounded JSON request." }),
      );
      continue;
    }
    const result =
      input.view === true
        ? { view: view(store, input.actor) }
        : interact(store, input.actor, {
            requestId: input.requestId,
            expectedRevision: input.expectedRevision,
            operation: input.operation,
          });
    // Internal/IO failure ends this host. Never label a committed-but-unsaved action unsupported.
    if (path) saveBench(store, path);
    console.log(JSON.stringify(result));
  }
} finally {
  if (lockFd !== undefined && lock) {
    closeSync(lockFd);
    unlinkSync(lock);
  }
}
