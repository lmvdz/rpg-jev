import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { extname, join } from "node:path";
import { DATABASE, HTTP_URL, isMain, SERVER_DIR, spacetime } from "./cli.ts";

/** Only extensionless relative module specifiers are rewritten. Safe to run twice. */
export function nodeImports(source: string): string {
  return source.replace(
    /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)(["'])(\.{1,2}\/[^"']+)\2/g,
    (match: string, prefix: string, quote: string, specifier: string) =>
      extname(specifier) ? match : `${prefix}${quote}${specifier}.ts${quote}`,
  );
}

function installBindings(source: string, destination: string): void {
  mkdirSync(destination, { recursive: true });
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    const from = join(source, entry.name);
    const to = join(destination, entry.name);
    if (entry.isDirectory()) installBindings(from, to);
    else if (entry.name.endsWith(".ts")) {
      writeFileSync(to, nodeImports(readFileSync(from, "utf8")));
    } else copyFileSync(from, to);
  }
}

export function publishLocal(): void {
  const modulePath = join(SERVER_DIR, "module");
  spacetime([
    "publish",
    DATABASE,
    "--server",
    HTTP_URL,
    "--module-path",
    modulePath,
    "--no-config",
    "--yes=skip-login,migrate,break-clients",
  ]);
  // Generate into a fresh ignored directory so the generator cannot delete old files.
  const stagingRoot = join(SERVER_DIR, ".stdb", "generated");
  mkdirSync(stagingRoot, { recursive: true });
  const staging = mkdtempSync(join(stagingRoot, "bindings-"));
  // `generate` reads the local module; CLI 2.10.1 has no --server option for it.
  spacetime([
    "generate",
    "--lang",
    "typescript",
    "--module-path",
    modulePath,
    "--out-dir",
    staging,
    "--no-config",
    "--yes",
  ]);
  installBindings(staging, join(SERVER_DIR, "..", "client", "src", "shared_bindings"));
  // The server's own tools (the archive worker) read its bindings from the server package.
  installBindings(staging, join(SERVER_DIR, "bindings"));
  console.log("Published locally without deleting data; shared TypeScript bindings updated.");
}

if (isMain(import.meta.url)) {
  try {
    publishLocal();
  } catch {
    console.error(
      "Local publication or binding generation failed; no data deletion was requested.",
    );
    process.exitCode = 1;
  }
}
