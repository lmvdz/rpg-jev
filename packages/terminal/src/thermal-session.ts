/** Offline bench session; the existing core log is the save, not a second engine. */
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { parseLog, replay, Store, serializeLog } from "../../core/src/log.ts";
import { attempt, type Request, view } from "../../core/src/thermal/attempt.ts";
import { benchWorld, CONTENT } from "../../core/src/thermal/fixture.ts";
import { studyRecords } from "./thermal-journal.ts";

export function startBench(): Store {
  const store = new Store(benchWorld());
  store.append({ kind: "init", seed: 1, content: CONTENT }, null);
  return store;
}

export function resumeBench(text: string): Store {
  const log = parseLog(text);
  const init = log[0];
  if (init?.kind !== "init" || init.content !== CONTENT || init.seed !== 1)
    throw new Error("unsupported thermal initial content");
  studyRecords(log);
  return new Store(replay(benchWorld(), log), log);
}

export function loadBench(path: string): Store {
  return resumeBench(readFileSync(path, "utf8"));
}

export function saveBench(store: Store, path: string): void {
  // The host holds the session lock. A failed write must not truncate the last save.
  const pending = `${path}.pending`;
  writeFileSync(pending, `${serializeLog(store.log)}\n`, { mode: 0o600, flag: "wx" });
  renameSync(pending, path);
}

export function interact(store: Store, actor: string, request: Request) {
  return { receipt: attempt(store, actor, request), view: view(store, actor) };
}
