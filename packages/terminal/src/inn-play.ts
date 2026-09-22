/**
 * pnpm play            resume the last night, or start one
 * pnpm play --new      start over
 * pnpm play --seed=7   a different night (with --new)
 * pnpm play --offline  play with the judge unreachable, to see the fallbacks
 * pnpm play --cost     show calls, tokens and latency after each action
 * pnpm play --fast     no pauses before people speak
 * pnpm play --plain    no live status line either: each turn prints as one block
 * pnpm play --handwritten --new  the checked-in supper proposals, in a versioned night
 */
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { clockWords } from "@rpg-jev/inn";
import { flag, openSession, option, ROOT } from "./session.ts";
import { Stage } from "./stage.ts";

const session = openSession({
  seed: Number(option("seed") ?? 1),
  savePath: join(ROOT, "saves", `${option("save") ?? "night"}.jsonl`),
  fresh: flag("new"),
  offline: flag("offline"),
  record: false,
  handwritten: flag("handwritten"),
});
const { game, meter } = session;

const print = (lines: string[]) => console.log(`\n${lines.join("\n")}\n`);

// On a terminal the turn is shown as it happens; piped, it prints as one block as before.
const live = (Boolean(process.stdout.isTTY) || flag("live")) && !flag("plain");
const stage = new Stage({ live, paced: !flag("fast") });
if (live) {
  game.onLine = (line, speaker) => stage.line(line, speaker);
  game.onThinking = (thinking) => stage.thinking(thinking);
}
async function turn(text: string): Promise<void> {
  if (!live) return print(await game.turn(text));
  console.log("");
  await game.turn(text);
  await stage.settle();
  console.log("");
}

if (!session.live)
  console.log(
    "\n(The judge is unreachable: no TYPESAFE_API_KEY, or --offline. The inn runs on its routines.)",
  );
if (!session.resumed && flag("handwritten"))
  print([
    "(Handwritten supper night: the staff are about to set out food and drink. You are hungry.)",
  ]);
if (session.resumed) {
  print([
    `(Resumed from the log at ${clockWords(game.world.clock)}. No model was asked anything.)`,
  ]);
  await turn("look");
} else print(game.intro());

// Lines are read as a stream, so a typed session and a piped script behave the same.
const rl = createInterface({ input: process.stdin, output: process.stdout, prompt: "> " });
// A piped script reaches end of input while a turn is still being judged.
let open = true;
rl.on("close", () => {
  open = false;
});
const prompt = () => {
  if (open) rl.prompt();
};
prompt();
for await (const line of rl) {
  const text = line.trim();
  if (text === "") {
    prompt();
    continue;
  }
  if (!process.stdin.isTTY) console.log(text);
  meter.begin(text);
  await turn(text);
  session.save();
  if (/^(q|quit|exit)$/i.test(text) || game.over) break;
  if (flag("cost")) {
    const c = meter.current;
    const note = c.fallbacks > 0 ? `, ${c.fallbacks} fallback` : "";
    console.log(
      `  [${c.calls} calls, ${c.inputTokens} tokens, ${c.latencyMs} ms, $${c.usd.toFixed(5)}${note}]`,
    );
  }
  if (session.resilient.down && session.live)
    console.log("  (The judge did not answer. Falling back to routines for a while.)");
  prompt();
}
session.save();
console.log("\nSaved. The log is the save: pnpm play resumes it.\n");
rl.close();
process.exit(0);
