// Runs the instantiated probes live. At most 18 calls. node --env-file=H:/rpg-jev/.env live.ts
import { readFileSync, writeFileSync } from "node:fs";
import { hashValue } from "file:///H:/rpg-jev/packages/core/src/index.ts";
import {
  type Asked,
  buildRequest,
  choiceFallback,
  LiveJudge,
  NONE,
  noulFallback,
  pickSpeechAct,
} from "file:///H:/rpg-jev/packages/jev/src/index.ts";

type Wire = { type: "noul" | "choice"; instructions: unknown; criteria: Record<string, unknown> };
type Cap = { state: Record<string, unknown>; questions: Record<string, Wire> };
const BUDGET = 18;
const judge = new LiveJudge({ timeoutMs: 10_000 });
let calls = 0;
const rows: { label: string; tokens: number; ms: number; answers: unknown }[] = [];

const asAsked = (qs: Record<string, Wire>): Record<string, Asked> =>
  Object.fromEntries(
    Object.entries(qs).map(([id, q]) => [
      id,
      {
        family: "pick_action",
        question: q as never,
        fallback: q.type === "noul" ? noulFallback(0) : choiceFallback(NONE, Object.keys(q.criteria)),
      },
    ]),
  );

async function ask(label: string, state: Record<string, unknown>, questions: Record<string, Asked>) {
  if (calls >= BUDGET) throw new Error("live call budget spent");
  calls++;
  const r = await judge.ask(buildRequest(state as never, hashValue(state), questions));
  rows.push({ label, tokens: r.inputTokens, ms: r.latencyMs, answers: r.answers });
  return r;
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const probs = (a: unknown): Record<string, number> => {
  const x = a as { type: string; noul?: number; probabilities?: Record<string, number> };
  return x.type === "noul" ? { yes: x.noul ?? 0 } : (x.probabilities ?? {});
};
const mass = (a: unknown, re: string) =>
  Object.entries(probs(a))
    .filter(([k]) => new RegExp(re).test(k))
    .reduce((s, [, p]) => s + p, 0);
const fmt = (a: unknown) =>
  Object.entries(probs(a))
    .sort((x, y) => y[1] - x[1])
    .map(([k, p]) => `${k} ${p.toFixed(2)}`)
    .join(", ");
const tv = (a: unknown, b: unknown) => {
  const p = probs(a);
  const q = probs(b);
  const keys = [...new Set([...Object.keys(p), ...Object.keys(q)])];
  return keys.reduce((s, k) => s + Math.abs((p[k] ?? 0) - (q[k] ?? 0)), 0) / 2;
};

// --- A. Tobin: debt paid (world edit), and the owing() line alone (slice ablation) -----------
const T = JSON.parse(readFileSync("captured-tobin.json", "utf8")) as {
  base: { requests: Cap[] };
  twin: { requests: Cap[] };
};
const tb = T.base.requests.at(-1) as Cap;
const tt = T.twin.requests.at(-1) as Cap;
const speech = (c: Cap, v: 0 | 1) => {
  const options = Object.entries(c.questions.reply?.criteria ?? {})
    .filter(([k]) => k !== NONE)
    .map(([id, description]) => ({ id, description: description as never }));
  return { reply: pickSpeechAct({ npc: "npcs.tobin", options, fallback: "refuse" }, v) };
};
const ablated = clone(tb);
const tobin = (ablated.state.npcs as Record<string, { circumstances: string[] }>).tobin;
if (tobin) tobin.circumstances = tobin.circumstances.filter((c) => !c.startsWith("owes "));

console.log("A. Tobin asked what he saw. mass = options ending :c_ef9aa3b936 (telling what he saw)");
const SAW = ":c_ef9aa3b936$";
for (const v of [0, 1] as const) {
  const b = await ask(`tobin base v${v}`, tb.state, speech(tb, v));
  const a = await ask(`tobin minus owing line v${v}`, ablated.state, speech(tb, v));
  const w = await ask(`tobin debt paid v${v}`, tt.state, speech(tt, v));
  const m = (r: typeof b) => mass(r.answers.reply, SAW).toFixed(2);
  console.log(
    ` v${v}: base ${m(b)} | owing line dropped ${m(a)} | debt paid (world edit) ${m(w)}   tokens ${b.inputTokens}/${a.inputTokens}/${w.inputTokens}`,
  );
  console.log(`     base: ${fmt(b.answers.reply)}`);
  console.log(`     drop: ${fmt(a.answers.reply)}`);
  console.log(`     paid: ${fmt(w.answers.reply)}`);
}

// --- B. Parse: drop scene.people/things/exits from state --------------------------------------
type Rec = Cap & { schemaGuess: string; input: string; answers: Record<string, unknown>; inputTokens: number };
const R = JSON.parse(readFileSync("recovered.json", "utf8")) as Rec[];
console.log("\nB. Parse with scene lists dropped from state (questions unchanged). TV vs the recorded base.");
for (const c of R.filter((x) => x.schemaGuess === "parse")) {
  const again = await ask(`parse base again: ${c.input.slice(0, 30)}`, c.state, asAsked(c.questions));
  const lean = clone(c.state);
  const scene = lean.scene as Record<string, unknown>;
  delete scene.people;
  delete scene.things;
  delete scene.exits;
  const twin = await ask(`parse lean: ${c.input.slice(0, 30)}`, lean, asAsked(c.questions));
  const ids = Object.keys(c.questions);
  const choice = (a: unknown) => (a as { choice: string }).choice;
  console.log(` "${c.input.slice(0, 44)}" tokens ${c.inputTokens} -> ${twin.inputTokens}`);
  console.log(`   noise  ${ids.map((q) => `${q} ${tv(c.answers[q], again.answers[q]).toFixed(2)}`).join(", ")}`);
  console.log(`   lean   ${ids.map((q) => `${q} ${tv(c.answers[q], twin.answers[q]).toFixed(2)}`).join(", ")}`);
  const flips = ids.filter((q) => choice(c.answers[q]) !== choice(twin.answers[q]));
  console.log(
    `   top choice changed: ${flips.length ? flips.map((q) => `${q}: ${choice(c.answers[q])} -> ${choice(twin.answers[q])}`).join("; ") : "none"}`,
  );
}

// --- C. Guard: remove the proof-of-apron lines from the real "show apron to mara" slice -------
console.log("\nC. Guard on the real 'show apron to mara' slice, apron lines removed (both wordings ride one call).");
const g = R.find((c) => c.schemaGuess === "guard");
if (g) {
  const cut = clone(g.state);
  const mara = (cut.npcs as Record<string, { recent_events: string[] }>).mara;
  if (mara) mara.recent_events = mara.recent_events.filter((l) => !l.includes("apron"));
  const again = await ask("guard base again", g.state, asAsked(g.questions));
  const twin = await ask("guard minus apron", cut, asAsked(g.questions));
  for (const q of Object.keys(g.questions))
    console.log(
      `   ${q}: recorded ${mass(g.answers[q], "yes").toFixed(2)} | again ${mass(again.answers[q], "yes").toFixed(2)} | no apron ${mass(twin.answers[q], "yes").toFixed(2)}`,
    );
}

console.log(`\n${calls} live calls, ${rows.reduce((s, r) => s + r.tokens, 0)} input tokens`);
writeFileSync("live-results.json", JSON.stringify(rows, null, 1));
