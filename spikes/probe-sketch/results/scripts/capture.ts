// Drives scripted games (no network) and keeps each request. The twin applies a STRUCTURED
// world edit (Tobin learns his debt was paid) through the game's own write path, then the same input.
import { writeFileSync } from "node:fs";
import { Game, PLAYER } from "file:///H:/rpg-jev/packages/inn/src/index.ts";
import { type JudgeRequest, ScriptedJudge, wireQuestions } from "file:///H:/rpg-jev/packages/jev/src/index.ts";

const PARSE: Record<string, string> = { mode: "in_story", verb: "ask", target: "tobin", asks_about: "about:tonight" };
function script(id: string, request: JudgeRequest) {
  const want = PARSE[id]; const q = request.questions[id]?.question;
  if (!want || q?.type !== "choice") return undefined;
  const labels = Object.keys(q.criteria);
  return { type: "choice" as const, choice: want, confidence: 1, probabilities: Object.fromEntries(labels.map((l) => [l, l === want ? 1 : 0])) };
}
type Edit = (g: Game) => void;
async function run(inputs: string[], edit: Edit | null) {
  const judge = new ScriptedJudge(script);
  const game = Game.start(1, judge);
  const out: string[] = [];
  for (const [i, text] of inputs.entries()) {
    if (i === inputs.length - 1 && edit) edit(game);
    out.push(`> ${text}`, ...(await game.turn(text)));
  }
  return { out, requests: judge.requests.map((r) => ({ ids: Object.keys(r.questions), state: r.state, questions: wireQuestions(r.questions) })) };
}
const debtPaid: Edit = (g) => {
  const cause = g.store.append({ kind: "stimulus", what: "probe_edit", data: {} }, null);
  const deed = g.happened({ subject: PLAYER, predicate: "paid_debt", to: "tobin", severity: 2 }, cause);
  g.learn("tobin", deed, 1, { kind: "witnessed" }, cause);
};
const inputs = ["go yard", "ask tobin what he saw at dusk"];
const base = await run(inputs, null);
const twin = await run(inputs, debtPaid);
for (const [n, r] of [["base", base], ["twin", twin]] as const) {
  console.log(`== ${n}: ${r.requests.map((q) => q.ids.join(",")).join(" | ")}`);
  const last = r.requests.at(-1);
  console.log(JSON.stringify((last?.state as { npcs: Record<string, unknown> }).npcs, null, 1));
  console.log(Object.keys((last?.questions as Record<string, { criteria: object }>)[last?.ids[0] ?? ""]?.criteria ?? {}));
}
writeFileSync("captured-tobin.json", JSON.stringify({ base, twin }, null, 1));
