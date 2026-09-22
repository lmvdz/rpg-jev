import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

/** This workflow is deliberately local, regardless of CLI default configuration. */
export const HOST = "127.0.0.1:3057";
export const HTTP_URL = `http://${HOST}`;
export const WS_URL = `ws://${HOST}`;
export const DATABASE = "rpg-open-world";
export const SERVER_DIR = resolve(import.meta.dirname, "..");

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
