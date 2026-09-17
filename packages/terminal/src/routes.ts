/**
 * Plays each quest route against live Jev across several seeds and reports how
 * often Mara stops believing it. The engine has no route flags, so this is the
 * evidence for "at least three routes work in practice".
 *
 *   node src/routes.ts                      all routes, seeds 1 to 5
 *   node src/routes.ts --only=witness       one route
 *   node src/routes.ts --seeds=8            more seeds
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { clockWords, ROUTES } from "@rpg-jev/inn";
import { openSession, option, ROOT } from "./session.ts";

const only = option("only");
const seeds = Number(option("seeds") ?? 5);
const names = Object.keys(ROUTES).filter((n) => !only || only.split(",").includes(n));

interface Run {
  route: string;
  seed: number;
  quest: string;
  clearedAt: string | null;
  calls: number;
  tokens: number;
  usd: number;
  guard: number[];
  /** Times an NPC told the player, to their face, a claim that was changed on its way. */
  garbledToFace: number;
  /** Garbled claims about the player that Mara held at the end. */
  garbledHeld: number;
}

const runs: Run[] = [];
for (const route of names)
  for (let seed = 1; seed <= seeds; seed++) {
    const session = openSession({
      seed,
      savePath: null,
      fresh: true,
      offline: false,
      record: false,
    });
    const { game, meter } = session;
    let clearedAt: string | null = null;
    for (const text of ROUTES[route] ?? []) {
      if (game.over) break;
      meter.begin(text);
      await game.turn(text);
      const node = game.world.machines.quest?.node;
      if (clearedAt === null && (node === "cleared" || node === "resolved"))
        clearedAt = `${clockWords(game.world.clock)} after "${text}"`;
    }
    // Either guard opens the quest (knowing the culprit entails the first), so report the
    // better of the two, each taken as the lower of its two wordings.
    const noul = (a: unknown) => (a as { noul?: number } | undefined)?.noul ?? 0;
    const guard = game.log.flatMap((e) =>
      e.kind === "decision" && e.answers.guard_a
        ? [
            Math.max(
              Math.min(noul(e.answers.guard_a), noul(e.answers.guard_b)),
              Math.min(noul(e.answers.culprit_a), noul(e.answers.culprit_b)),
            ),
          ]
        : [],
    );
    const claims = game.world.claims;
    const garbledToFace = game.log.filter((e) => {
      if (e.kind !== "effect" || e.effect.kind !== "say") return false;
      const { intent } = e.effect;
      if (intent.listener !== "player" || intent.topic.kind !== "claim") return false;
      return claims[intent.topic.id]?.distortion !== undefined;
    }).length;
    const garbledHeld = game.world.edges.filter(
      (e) =>
        e.kind === "believes" &&
        e.src === "mara" &&
        e.valid_to === null &&
        claims[e.dst]?.subject === "player" &&
        claims[e.dst]?.distortion !== undefined,
    ).length;
    const total = meter.totals();
    const run: Run = {
      route,
      seed,
      quest: game.world.machines.quest?.node ?? "?",
      clearedAt,
      calls: total.calls,
      tokens: total.inputTokens,
      usd: total.usd,
      guard,
      garbledToFace,
      garbledHeld,
    };
    runs.push(run);
    console.log(
      `${route.padEnd(9)} seed ${seed}  ${run.quest.padEnd(10)} guard ${guard.map((g) => g.toFixed(2)).join(" ") || "-"}  ${clearedAt ?? ""}`,
    );
  }

const lines = [
  "# Quest routes across seeds",
  "",
  `Live \`jev-1.13.0\`, seeds 1 to ${seeds}. The quest opens when both wordings of either guard reach 0.65: Mara no longer believes it was the stranger, or she is satisfied it was Odo, which entails the first. "Guard" is the better of the two each time they were asked. Nothing in the engine knows these routes exist.`,
  "",
  "| Route | Cleared or resolved | Outcomes | Highest guard value per run | An NPC said a garbled claim to the player's face | Garbled claims Mara held at the end |",
  "| --- | --- | --- | --- | --- | --- |",
];
for (const route of names) {
  const mine = runs.filter((r) => r.route === route);
  const won = mine.filter((r) => r.quest === "cleared" || r.quest === "resolved").length;
  const outcomes = mine.map((r) => r.quest).join(", ");
  const peaks = mine.map((r) => (r.guard.length ? Math.max(...r.guard).toFixed(2) : "not asked"));
  const faced = mine.filter((r) => r.garbledToFace > 0).length;
  const held = mine.map((r) => r.garbledHeld).join(", ");
  lines.push(
    `| ${route} | ${won} of ${mine.length} | ${outcomes} | ${peaks.join(", ")} | ${faced} of ${mine.length} runs | ${held} |`,
  );
}
const usd = runs.reduce((a, r) => a + r.usd, 0);
const calls = runs.reduce((a, r) => a + r.calls, 0);
lines.push("", `${runs.length} runs, ${calls} judge calls, $${usd.toFixed(4)}.`, "");

const out = join(ROOT, "demo");
mkdirSync(out, { recursive: true });
writeFileSync(join(out, "routes.md"), lines.join("\n"));
writeFileSync(join(out, "routes.json"), `${JSON.stringify(runs, null, 1)}\n`);
console.log(`\n${lines.slice(4).join("\n")}`);
