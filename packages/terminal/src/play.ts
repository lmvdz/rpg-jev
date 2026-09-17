/**
 * pnpm play            resume the last night, or start one
 * pnpm play --new      start over
 * pnpm play --seed=7   a different night (with --new)
 * pnpm play --offline  play with the judge unreachable, to see the fallbacks
 * pnpm play --cost     show calls, tokens and latency after each action
 */
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { clockWords } from "@rpg-jev/inn";
import { flag, openSession, option, ROOT } from "./session.ts";

const session = openSession({
  seed: Number(option("seed") ?? 1),
  savePath: join(ROOT, "saves", `${option("save") ?? "night"}.jsonl`),
  fresh: flag("new"),
  offline: flag("offline"),
  record: false,
});
const { game, meter } = session;

const print = (lines: string[]) => console.log(`\n${lines.join("\n")}\n`);

if (!session.live)
  console.log(
    "\n(The judge is unreachable: no TYPESAFE_API_KEY, or --offline. The inn runs on its routines.)",
  );
if (session.resumed) {
  print([
    `(Resumed from the log at ${clockWords(game.world.clock)}. No model was asked anything.)`,
  ]);
  print(await game.turn("look"));
} else print(game.intro());

const rl = createInterface({ input: process.stdin, output: process.stdout });
rl.on("close", () => {
  session.save();
  process.exit(0);
});

while (!game.over) {
  const text = (await rl.question("> ")).trim();
  if (text === "") continue;
  meter.begin(text);
  const lines = await game.turn(text);
  session.save();
  if (/^(q|quit|exit)$/i.test(text)) break;
  print(lines);
  if (flag("cost")) {
    const c = meter.current;
    const note = c.fallbacks > 0 ? `, ${c.fallbacks} fallback` : "";
    console.log(
      `  [${c.calls} calls, ${c.inputTokens} tokens, ${c.latencyMs} ms, $${c.usd.toFixed(5)}${note}]`,
    );
  }
  if (session.resilient.down && session.live)
    console.log("  (The judge did not answer. Falling back to routines for a while.)");
}
console.log("Saved. The log is the save: pnpm play resumes it.\n");
rl.close();
