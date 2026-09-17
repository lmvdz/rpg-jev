/**
 * Wires a Game to a judge and a save file. The save is the event log, one
 * JSON entry per line (SPEC.md section 13); resuming replays it and calls no
 * model.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseLog, serializeLog } from "@rpg-jev/core";
import { Game } from "@rpg-jev/inn";
import {
  CachingJudge,
  type Judge,
  LiveJudge,
  Meter,
  OfflineJudge,
  Recorder,
  ResilientJudge,
} from "@rpg-jev/jev";

export const ROOT = join(import.meta.dirname, "..", "..", "..");

export interface Session {
  game: Game;
  meter: Meter;
  resilient: ResilientJudge;
  recorder: Recorder | null;
  resumed: boolean;
  live: boolean;
  save: () => void;
}

export interface SessionOptions {
  seed: number;
  savePath: string | null;
  fresh: boolean;
  offline: boolean;
  record: boolean;
}

export function openSession(options: SessionOptions): Session {
  let inner: Judge;
  let live = false;
  try {
    inner = options.offline ? new OfflineJudge() : new LiveJudge();
    live = !options.offline;
  } catch {
    // No key in the environment: the game still runs, on code's fallbacks.
    inner = new OfflineJudge();
  }
  const recorder = options.record ? new Recorder(inner) : null;
  const meter = new Meter(recorder ?? inner);
  const resilient = new ResilientJudge(new CachingJudge(meter));

  const path = options.savePath;
  const resumed = Boolean(path && !options.fresh && existsSync(path));
  const game =
    resumed && path
      ? Game.resume(parseLog(readFileSync(path, "utf8")), resilient)
      : Game.start(options.seed, resilient);
  const save = () => {
    if (!path) return;
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${serializeLog(game.log)}\n`);
  };
  return { game, meter, resilient, recorder, resumed, live, save };
}

export function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

export function option(name: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
}
