// Recovers the full request (state + wire questions) behind every logged decision by
// re-driving inputs against recorded answers. No network.
//   node recover.ts            demo nights from demo/recordings.json
//   node recover.ts --night    also try saves/night.jsonl, answering from its own log
import { readFileSync, writeFileSync } from "node:fs";
import { Game } from "file:///H:/rpg-jev/packages/inn/src/index.ts";
import {
  CachingJudge, type Judge, type JudgeRequest, type JudgeResponse, RecordedJudge, type Recordings,
  wireQuestions, estimateTokens,
} from "file:///H:/rpg-jev/packages/jev/src/index.ts";

const ROOT = "H:/rpg-jev";
interface Captured { night: string; input: string; requestId: string; schemaGuess: string; stateTokens: number; questionTokens: number; inputTokens: number; state: unknown; questions: unknown; answers: unknown }
const captured: Captured[] = [];
let current = ""; let nightName = "";

class Tap implements Judge {
  readonly inner: Judge;
  constructor(inner: Judge) { this.inner = inner; }
  async ask(request: JudgeRequest): Promise<JudgeResponse> {
    const response = await this.inner.ask(request);
    const wire = wireQuestions(request.questions);
    const s = request.state as Record<string, unknown>;
    captured.push({
      night: nightName, input: current, requestId: request.id,
      schemaGuess: "player_input" in s ? "parse" : "quest" in s ? "guard" : "scene",
      stateTokens: estimateTokens(request.state), questionTokens: estimateTokens(wire as never),
      inputTokens: response.inputTokens, state: request.state, questions: wire, answers: response.answers,
    });
    return response;
  }
}

async function drive(name: string, seed: number, inputs: string[], recordings: Recordings) {
  nightName = name;
  const rec = new RecordedJudge(recordings);
  const game = Game.start(seed, new CachingJudge(new Tap(rec)));
  let stoppedAt: string | null = null;
  for (const text of inputs) {
    current = text;
    try { await game.turn(text); } catch { stoppedAt = text; break; }
  }
  console.log(`${name}: ${rec.hits} hits, ${rec.misses.length} misses${stoppedAt ? `, first miss at "${stoppedAt}"` : ""}`);
}

const demo = JSON.parse(readFileSync(`${ROOT}/demo/recordings.json`, "utf8")) as { nights: { seed: number; inputs: string[] }[]; recordings: Recordings };
for (const [i, n] of demo.nights.entries()) await drive(`demo-${i}`, n.seed, n.inputs, demo.recordings);

if (process.argv.includes("--night")) {
  const log = readFileSync(`${ROOT}/saves/night.jsonl`, "utf8").trim().split("\n").map((l) => JSON.parse(l));
  const recs: Recordings = {};
  for (const e of log) if (e.kind === "decision") recs[e.requestId] = { answers: e.answers, inputTokens: e.inputTokens, latencyMs: e.latencyMs };
  const inputs = log.filter((e) => e.kind === "input").map((e) => e.text as string);
  await drive("night", log[0].seed, inputs, recs);
}
writeFileSync("recovered.json", JSON.stringify(captured, null, 1));
const by: Record<string, { n: number; state: number; q: number; real: number }> = {};
for (const c of captured) { const b = (by[c.schemaGuess] ??= { n: 0, state: 0, q: 0, real: 0 }); b.n++; b.state += c.stateTokens; b.q += c.questionTokens; b.real += c.inputTokens; }
for (const [k, b] of Object.entries(by)) console.log(`${k}: ${b.n} calls, mean est state ${Math.round(b.state / b.n)} tok, est questions ${Math.round(b.q / b.n)} tok, real ${Math.round(b.real / b.n)} tok`);
