// Starts the local standalone server: loopback only, data under the git-ignored `.stdb/`.
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { HOST, spacetimeCli } from "./lib/cli.ts";

const dataDir = join(import.meta.dirname, "..", ".stdb", "data");
mkdirSync(dataDir, { recursive: true });
const args = ["start", "--listen-addr", HOST, "--data-dir", dataDir, "--non-interactive"];
const child = spawn(spacetimeCli(), args, { stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 0));
