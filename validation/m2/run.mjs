/** Complete nights, with per-night recordings: never pool variable answers across runs. */
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { serializeLog } from "../../packages/core/src/log.ts";
import { ROUTES } from "../../packages/inn/src/demo-script.ts";
import { Game } from "../../packages/inn/src/game.ts";
import { HANDWRITTEN_CONTENT_VERSION } from "../../packages/inn/src/proposal-content.ts";
import {
  CachingJudge,
  LiveJudge,
  Meter,
  MODEL,
  Recorder,
  ResilientJudge,
} from "../../packages/jev/src/index.ts";

assert(process.env.TYPESAFE_API_KEY, "supply the key in the process environment");
assert(process.argv[2], "usage: run.mjs <new-output-directory>");
assert(
  process.argv[3] === undefined || process.argv[3] === "handwritten",
  "the only optional content selector is handwritten",
);
const content = process.argv[3] === "handwritten" ? HANDWRITTEN_CONTENT_VERSION : undefined;
const output = resolve(process.argv[2]);
mkdirSync(resolve(output, ".."), { recursive: true });
mkdirSync(output);
const live = new LiveJudge();
let requests = 0;
const bounded = {
  ask(request) {
    assert(requests < 160, "live request budget exhausted");
    requests += 1;
    return live.ask(request);
  },
};
const summaries = [];
for (const route of ["evidence", "witness", "denial"]) {
  const recorder = new Recorder(bounded);
  const meter = new Meter(recorder);
  const resilient = new ResilientJudge(new CachingJudge(meter));
  const game = Game.start(1, resilient, content);
  const inputs = [];
  const transcript = [...game.intro(), ""];
  const script = [...ROUTES[route], ...Array.from({ length: 8 }, () => "wait 60")];
  for (const text of script) {
    if (game.over) break;
    inputs.push(text);
    meter.begin(text);
    const lines = await game.turn(text);
    transcript.push(`> ${text}`, ...lines, "");
    console.log(`${route}: ${text} → ${game.world.machines.quest?.node} at ${game.world.clock}`);
  }
  const summary = {
    route,
    seed: 1,
    content: game.log[0].content,
    model: MODEL,
    node: process.version,
    platform: process.platform,
    over: game.over,
    quest: game.world.machines.quest?.node,
    clock: game.world.clock,
    ...meter.totals(),
    unparsed: game.log.filter((entry) => entry.kind === "input" && entry.via === "unparsed").length,
    nonemptyTurns: meter.actions.length,
    failures: resilient.failures,
    humanPlaytest: false,
  };
  const dir = join(output, route);
  mkdirSync(dir);
  writeFileSync(join(dir, "transcript.txt"), `${transcript.join("\n").trimEnd()}\n`);
  writeFileSync(join(dir, "log.jsonl"), `${serializeLog(game.log)}\n`);
  writeFileSync(
    join(dir, "recordings.json"),
    `${JSON.stringify({ seed: 1, ...(content ? { content } : {}), inputs, recordings: recorder.recordings })}\n`,
  );
  writeFileSync(join(dir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  summaries.push(summary);
}
writeFileSync(join(output, "summary.json"), `${JSON.stringify(summaries, null, 2)}\n`);
console.log(JSON.stringify(summaries, null, 2));
assert(
  summaries.every((run) => run.over),
  "at least one night did not reach an ending",
);
assert(
  summaries.every((run) => run.failures === 0),
  "provider degradation: inspect recorded evidence",
);
