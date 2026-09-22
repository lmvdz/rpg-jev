/**
 * The server hosts the world; it must not depend on the renderer to do it
 * (SPEC.md section 19: world generation and the shared wire live in
 * `packages/core/src/world`, not `packages/client`). This scans every source
 * file under the server package for an import specifier that reaches into
 * `packages/client`, so a stray import cannot creep back in unnoticed.
 *
 * `spacetime generate` writes the module's row bindings into both packages
 * (`packages/server/src/publish.ts`); the server's own tools read the copy in
 * `packages/server/bindings`, so there is no exception.
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = join(HERE, "..");
const ROOTS = ["module/src", "src", "test"];
const IMPORT_SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(\s*)["']([^"']+)["']/g;

function tsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...tsFiles(full));
    else if (entry.name.endsWith(".ts")) out.push(full);
  }
  return out;
}

function clientImports(file: string): string[] {
  const source = readFileSync(file, "utf8");
  const specifiers: string[] = [];
  for (const match of source.matchAll(IMPORT_SPECIFIER)) {
    const specifier = match[1] ?? "";
    if (specifier.includes("/client/")) specifiers.push(specifier);
  }
  return specifiers;
}

describe("the server never imports the renderer", () => {
  it("has no import specifier that reaches into packages/client", () => {
    const offenders: string[] = [];
    for (const root of ROOTS) {
      for (const file of tsFiles(join(SERVER_DIR, root))) {
        for (const specifier of clientImports(file)) {
          offenders.push(`${relative(SERVER_DIR, file)}: ${specifier}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
