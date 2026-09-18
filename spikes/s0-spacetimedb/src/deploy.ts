// Publishes the module to the local standalone server and regenerates the client bindings.
// `--delete-data` wipes the database, so every bench starts from the same empty state.
import { readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DATABASE, HTTP_URL, spacetime } from "./lib/cli.ts";

const BINDINGS = join(import.meta.dirname, "module_bindings");
const MODULE = join(import.meta.dirname, "..", "module");

/** Node runs TypeScript by stripping types and needs real file names; the generator omits them. */
function addTsExtensions(dir: string): number {
  let patched = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      patched += addTsExtensions(path);
    } else if (entry.name.endsWith(".ts")) {
      const before = readFileSync(path, "utf8");
      const after = before.replace(/from "(\.{1,2}\/[^"]+?)(?<!\.ts)"/g, 'from "$1.ts"');
      if (after !== before) {
        writeFileSync(path, after);
        patched++;
      }
    }
  }
  return patched;
}

const keepData = process.argv.includes("--keep-data");
const consent = keepData
  ? ["--yes=skip-login,migrate,break-clients"]
  : ["--yes=all", "--delete-data=always"];
const target = ["--server", HTTP_URL, "--module-path", MODULE, "--no-config"];
const publishArgs = ["publish", DATABASE, ...target, ...consent];
console.log(spacetime(publishArgs).trim());

rmSync(BINDINGS, { recursive: true, force: true });
const generateArgs = ["generate", "--lang", "typescript", "--out-dir", BINDINGS];
generateArgs.push("--module-path", MODULE, "--no-config", "--yes");
spacetime(generateArgs);
console.log(
  `bindings regenerated, ${addTsExtensions(BINDINGS)} files patched with .ts import extensions`,
);
