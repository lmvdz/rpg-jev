import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { constants } from "node:os";
import { DATA_DIR, HOST, isMain, spacetimeCli } from "./cli.ts";

export function startLocal(): void {
  const dataDir = DATA_DIR;
  mkdirSync(dataDir, { recursive: true });
  const child = spawn(
    spacetimeCli(),
    ["start", "--listen-addr", HOST, "--data-dir", dataDir, "--non-interactive"],
    { stdio: "inherit" },
  );
  // Wait for the child to finish its own shutdown; never force an exit on a timer.
  const interrupt = () => child.kill("SIGINT");
  const terminate = () => child.kill("SIGTERM");
  process.on("SIGINT", interrupt);
  process.on("SIGTERM", terminate);
  const cleanup = () => {
    process.off("SIGINT", interrupt);
    process.off("SIGTERM", terminate);
  };
  child.once("error", () => {
    cleanup();
    console.error("Could not start the local SpacetimeDB executable.");
    process.exitCode = 1;
  });
  child.once("exit", (code, signal) => {
    cleanup();
    process.exitCode = code ?? (signal ? 128 + constants.signals[signal] : 1);
  });
}

if (isMain(import.meta.url)) startLocal();
