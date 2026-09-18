import { execFileSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

export type ServerMemory = { workingSetMb: number; privateMb: number };

const MB = 1024 * 1024;

/** Memory of the standalone server process, as Windows reports it. */
export function serverMemory(): ServerMemory {
  const script =
    'Get-Process spacetimedb-standalone | ForEach-Object { "$($_.WorkingSet64) $($_.PrivateMemorySize64)" }';
  const out = execFileSync("powershell", ["-NoProfile", "-Command", script], { encoding: "utf8" });
  let workingSet = 0;
  let privateBytes = 0;
  for (const line of out.trim().split(/\r?\n/)) {
    const [ws, pm] = line.trim().split(" ").map(Number);
    workingSet += ws ?? 0;
    privateBytes += pm ?? 0;
  }
  return { workingSetMb: Math.round(workingSet / MB), privateMb: Math.round(privateBytes / MB) };
}

export function directoryMb(dir: string): number {
  let bytes = 0;
  const walk = (path: string): void => {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const child = join(path, entry.name);
      if (entry.isDirectory()) walk(child);
      else bytes += statSync(child).size;
    }
  };
  walk(dir);
  return Math.round(bytes / MB);
}
