/**
 * pnpm demo                 play the fixed script against live Jev; write the transcript and costs
 * pnpm demo --record        also record every judge answer by request id, for the offline tests
 * pnpm demo --script=FILE   one input per line instead of the built-in script (no coda)
 * pnpm demo --out=DIR       where to write (default: demo/)
 * pnpm demo --verbose       print the judge's answers as they arrive
 * pnpm demo --trace=guard   print every slice of that schema and its answers
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { serializeLog } from "@rpg-jev/core";
import { clockWords, DEMO_CODA, DEMO_SCRIPT } from "@rpg-jev/inn";
import { type ActionCost, percentile, type Recordings, USD_PER_INPUT_TOKEN } from "@rpg-jev/jev";
import { flag, openSession, option, ROOT } from "./session.ts";

const scriptFile = option("script");
const seed = Number(option("seed") ?? 1);
const out = option("out") ?? join(ROOT, "demo");
const traced = option("trace");

const fromFile = scriptFile
  ? readFileSync(scriptFile, "utf8")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l !== "" && !l.startsWith("#"))
  : null;
const nights = fromFile
  ? [{ title: "Script", seed, inputs: fromFile }]
  : [
      { title: "The night", seed, inputs: DEMO_SCRIPT },
      { title: "Coda: the combat stub, on a fresh night", seed: seed + 1, inputs: DEMO_CODA },
    ];

const transcript: string[] = ["# Demo transcript", ""];
const actions: ActionCost[] = [];
const callLatencies: number[] = [];
const recordings: Recordings = {};
const logs: string[] = [];
let live = true;
const endings: string[] = [];

for (const night of nights) {
  const session = openSession({
    seed: night.seed,
    savePath: null,
    fresh: true,
    offline: flag("offline"),
    record: true,
  });
  const { game, meter } = session;
  live = session.live;
  if (traced)
    game.trace = (slice, answers) => {
      if (slice.schema !== traced) return;
      console.log(`--- ${slice.schema} slice\n${JSON.stringify(slice.state, null, 1)}`);
      console.log(JSON.stringify(answers));
    };

  transcript.push(
    `## ${night.title}`,
    "",
    `Seed ${night.seed}, ${session.live ? "live `jev-1.13.0`" : "judge offline"}, ${night.inputs.length} scripted inputs.`,
    "",
    "```text",
    ...game.intro(),
    "",
  );
  let seen = 0;
  for (const text of night.inputs) {
    if (game.over) break;
    meter.begin(text);
    const started = performance.now();
    const lines = await game.turn(text);
    const wall = Math.round(performance.now() - started);
    const c = meter.current;
    const cost = `${c.calls} calls, ${c.questions} questions, ${c.inputTokens} tokens, ${c.latencyMs} ms judge, ${wall} ms wall, $${c.usd.toFixed(5)}`;
    transcript.push(`> ${text}`, "", ...lines, "");
    transcript.push(
      `    [${clockWords(game.world.clock)} | ${cost}${c.fallbacks ? `, ${c.fallbacks} fallbacks` : ""}]`,
      "",
    );
    console.log(`> ${text}\n${lines.join("\n")}\n`);
    if (flag("verbose"))
      for (const e of game.log.slice(seen))
        if (e.kind === "decision") console.log(`   ${e.source} ${JSON.stringify(e.answers)}`);
    seen = game.log.length;
  }
  transcript.push("```", "");
  actions.push(...meter.actions);
  callLatencies.push(...meter.callLatencies);
  Object.assign(recordings, session.recorder?.recordings ?? {});
  logs.push(serializeLog(game.log));
  endings.push(`${game.world.machines.quest?.node} at ${clockWords(game.world.clock)}`);
}

const sum = (pick: (a: ActionCost) => number) => actions.reduce((n, a) => n + pick(a), 0);
const total = {
  calls: sum((a) => a.calls),
  questions: sum((a) => a.questions),
  inputTokens: sum((a) => a.inputTokens),
  usd: sum((a) => a.usd),
  fallbacks: sum((a) => a.fallbacks),
  cached: sum((a) => a.cached),
};
const perAction = (n: number) => (actions.length > 0 ? n / actions.length : 0);
const judged = actions.filter((a) => a.calls > 0).map((a) => a.latencyMs);
const metrics = {
  seed,
  live,
  actions: actions.length,
  actionsThatCalledTheJudge: judged.length,
  ...total,
  perAction: {
    calls: perAction(total.calls),
    inputTokens: perAction(total.inputTokens),
    usd: perAction(total.usd),
    judgeLatencyMsMedian: percentile(judged, 50),
    judgeLatencyMsP90: percentile(judged, 90),
    judgeLatencyMsWorst: Math.max(0, ...judged),
  },
  perCall: {
    latencyMsMedian: percentile(callLatencies, 50),
    latencyMsP90: percentile(callLatencies, 90),
    latencyMsP99: percentile(callLatencies, 99),
    inputTokensMean: total.calls > 0 ? total.inputTokens / total.calls : 0,
  },
  /** At one action every ten seconds, which is brisk for a text game. */
  perPlayerHour: {
    actions: 360,
    usd: perAction(total.usd) * 360,
    inputTokens: Math.round(perAction(total.inputTokens) * 360),
  },
  usdPerInputToken: USD_PER_INPUT_TOKEN,
  endings,
  byAction: actions,
};

transcript.push(
  "## Cost",
  "",
  `${actions.length} actions, ${total.calls} judge calls, ${total.inputTokens} input tokens, $${total.usd.toFixed(4)} in all.`,
  `Per action: ${metrics.perAction.calls.toFixed(2)} calls, ${Math.round(metrics.perAction.inputTokens)} tokens, $${metrics.perAction.usd.toFixed(6)}.`,
  `Judge time per action that called it: median ${metrics.perAction.judgeLatencyMsMedian} ms, p90 ${metrics.perAction.judgeLatencyMsP90} ms, worst ${metrics.perAction.judgeLatencyMsWorst} ms.`,
  `Per call: median ${metrics.perCall.latencyMsMedian} ms, p99 ${metrics.perCall.latencyMsP99} ms, ${Math.round(metrics.perCall.inputTokensMean)} tokens.`,
  `At 360 actions an hour: $${metrics.perPlayerHour.usd.toFixed(4)} per player-hour.`,
  "",
);

mkdirSync(out, { recursive: true });
writeFileSync(join(out, "transcript.md"), transcript.join("\n"));
writeFileSync(join(out, "metrics.json"), `${JSON.stringify(metrics, null, 2)}\n`);
writeFileSync(join(out, "log.jsonl"), `${logs.join("\n")}\n`);
if (flag("record")) {
  const file = { nights: nights.map(({ seed: s, inputs }) => ({ seed: s, inputs })), recordings };
  writeFileSync(join(out, "recordings.json"), `${JSON.stringify(file)}\n`);
}
console.log(
  `\n${actions.length} actions, ${total.calls} calls, ${total.inputTokens} tokens, $${total.usd.toFixed(4)}. Endings: ${endings.join("; ")}. Wrote ${out}`,
);
