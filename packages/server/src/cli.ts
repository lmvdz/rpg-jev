import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { localTarget } from "./target.ts";

/** This workflow is deliberately local, regardless of CLI default configuration. */
const target = localTarget(process.env);
export const HOST = target.host;
export const HTTP_URL = target.http;
export const WS_URL = target.ws;
export const DATABASE = target.database;
export const SERVER_DIR = resolve(import.meta.dirname, "..");
export const DATA_DIR = join(SERVER_DIR, ...target.dataPath);
export const RUNTIME_DIR = join(SERVER_DIR, ...target.dataPath.slice(0, -1));

/** Validation credentials never cross endpoint/database boundaries. */
export function protocolTokenPath(label: string): string {
  if (!/^[AB]$/.test(label)) throw new Error("Unknown validation identity");
  const legacy = HOST === "127.0.0.1:3057" && DATABASE === "rpg-open-world";
  const name = legacy ? `protocol-${label}.token` : `protocol-${DATABASE}-${label}.token`;
  return join(RUNTIME_DIR, name);
}

export function spacetimeCli(): string {
  if (process.env.SPACETIME_CLI) return process.env.SPACETIME_CLI;
  if (process.env.LOCALAPPDATA) {
    const installed = join(process.env.LOCALAPPDATA, "SpacetimeDB", "spacetime.exe");
    if (existsSync(installed)) return installed;
  }
  return "spacetime";
}

/** Never propagate captured CLI output: errors can contain authentication material. */
export function spacetime(args: readonly string[]): void {
  try {
    execFileSync(spacetimeCli(), [...args], {
      cwd: SERVER_DIR,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    throw new Error(`Local SpacetimeDB ${args[0]} failed; CLI output withheld.`);
  }
}

export function isMain(url: string): boolean {
  return process.argv[1] !== undefined && pathToFileURL(resolve(process.argv[1])).href === url;
}
