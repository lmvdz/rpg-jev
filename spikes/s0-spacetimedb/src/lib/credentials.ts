// Local credentials for named clients. A token here is one the local standalone server minted
// for an anonymous connection; it only means anything to that server. Tokens live under the
// git-ignored `.stdb/`, never in the repo.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DATABASE, HTTP_URL, spacetime } from "./cli.ts";

const TOKEN_DIR = join(import.meta.dirname, "..", "..", ".stdb", "tokens");

const tokenPath = (name: string): string => join(TOKEN_DIR, `${name}.token`);

export function loadToken(name: string): string | undefined {
  try {
    return readFileSync(tokenPath(name), "utf8").trim() || undefined;
  } catch {
    return undefined;
  }
}

export function saveToken(name: string, token: string): void {
  mkdirSync(TOKEN_DIR, { recursive: true });
  writeFileSync(tokenPath(name), token);
}

export function forgetToken(name: string): void {
  rmSync(tokenPath(name), { force: true });
}

const hex = (identity: string): string => (identity.startsWith("0x") ? identity : `0x${identity}`);

/**
 * Registers an identity as a worker. Goes through the CLI, which carries the local identity that
 * published the module: the owner is the only one the module lets do this.
 */
export function registerWorker(identity: string, label: string): void {
  const args = [
    "call",
    DATABASE,
    "add_worker",
    JSON.stringify(hex(identity)),
    JSON.stringify(label),
  ];
  spacetime([...args, "--server", HTTP_URL]);
}

export function unregisterWorker(identity: string): void {
  const args = ["call", DATABASE, "remove_worker", JSON.stringify(hex(identity))];
  spacetime([...args, "--server", HTTP_URL]);
}
