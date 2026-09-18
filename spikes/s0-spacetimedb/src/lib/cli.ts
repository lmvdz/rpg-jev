import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

/** Loopback only. The spike never talks to maincloud, so the host is not configurable. */
export const HOST = "127.0.0.1:3057";
export const HTTP_URL = `http://${HOST}`;
export const WS_URL = `ws://${HOST}`;
export const DATABASE = "s0-world";

export function spacetimeCli(): string {
  const fromEnv = process.env.SPACETIME_CLI;
  if (fromEnv) return fromEnv;
  const local = process.env.LOCALAPPDATA;
  if (local) {
    const installed = join(local, "SpacetimeDB", "spacetime.exe");
    if (existsSync(installed)) return installed;
  }
  return "spacetime";
}

export function spacetime(args: readonly string[]): string {
  return execFileSync(spacetimeCli(), [...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}
