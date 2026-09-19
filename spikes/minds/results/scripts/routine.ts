// Step 5: is the routine's choice one the judge would make? Throwaway, not linted.
// Run from packages/terminal (copy it there as routine.tmp.ts):
//   node --env-file=H:/rpg-jev/.env routine.tmp.ts [scenes]
//
// Scenes are made by a seeded generator out of engine structures only. For each, code builds
// the slice (slice.ts) and the handful of offers (intents.ts). Three calls, kept apart:
//   1. handful, wording 0: which of the offered does it do? or none.
//   2. handful, wording 1: the same, reworded, for the paraphrase shift.
//   3. the whole list of 34 intents, no targets: is what the judge wants among what code offered?
// The offers are shuffled before they are shown, so their order cannot leak the routine's ranking.
import { readFileSync, writeFileSync } from "node:fs";
import { matter, Rng } from "@rpg-jev/core";
import { type Asked, buildRequest, choiceFallback, type Json, LiveJudge } from "@rpg-jev/jev";

const ROOT = "H:/rpg-jev.worktrees/sandbox-matter/spikes/minds";
const N = Number(process.argv[2] ?? 60);
const BASE = Number(process.argv[4] ?? 1000);
const NONE = "none_of_these";
type W = matter.MatterWorld;

const ROWS: matter.Element[] = [
  { id: "wolf", name: "a wolf", kind: "creature", forms: [], props: { mass: 3, size: 3, hardness: 1, toughness: 3 }, body: { strength: 3, speed: 4, sight: 3, hearing: 4, smell: 5, eats: { flesh: 5, fruit: 1 } }, fare: "flesh", serves: { hunger: 3 } },
  { id: "pup", name: "a wolf pup", kind: "creature", forms: [], props: { mass: 1, size: 1, hardness: 0, toughness: 1 }, body: { strength: 0, speed: 1, sight: 1, hearing: 2, smell: 2, eats: { flesh: 5 } }, fare: "flesh", serves: { hunger: 1 } },
  { id: "fawn", name: "a fawn", kind: "creature", forms: [], props: { mass: 1, size: 1, hardness: 0, toughness: 1 }, body: { strength: 0, speed: 1, sight: 2, hearing: 3, smell: 2, eats: { leaf: 5, fruit: 3 } }, fare: "flesh", serves: { hunger: 2 } },
  { id: "cub", name: "a bear cub", kind: "creature", forms: [], props: { mass: 2, size: 1, hardness: 0, toughness: 2 }, body: { strength: 0, speed: 1, sight: 1, hearing: 2, smell: 3, eats: { flesh: 4, fruit: 5 } }, fare: "flesh", serves: { hunger: 2 } },
  { id: "hind", name: "a red deer hind", kind: "creature", forms: [], props: { mass: 4, size: 4, hardness: 1, toughness: 2 }, body: { strength: 2, speed: 5, sight: 3, hearing: 5, smell: 4, eats: { leaf: 5, fruit: 3, seed: 3 } }, fare: "flesh", serves: { hunger: 3 } },
  { id: "hare", name: "a hare", kind: "creature", forms: [], props: { mass: 1, size: 1, hardness: 0, toughness: 1 }, body: { strength: 1, speed: 5, sight: 3, hearing: 5, smell: 3, eats: { leaf: 5, seed: 2 } }, fare: "flesh", serves: { hunger: 2 } },
  { id: "bear", name: "a bear", kind: "creature", forms: [], props: { mass: 5, size: 4, hardness: 1, toughness: 4 }, body: { strength: 5, speed: 3, sight: 2, hearing: 3, smell: 5, eats: { flesh: 4, fruit: 5, seed: 3, leaf: 2 } }, fare: "flesh", serves: { hunger: 4 } },
  { id: "person", name: "a person", kind: "person", forms: [], props: { mass: 3, size: 3, hardness: 1, toughness: 2 }, body: { strength: 2, speed: 2, sight: 3, hearing: 3, smell: 1, eats: { flesh: 4, fruit: 5, seed: 5, leaf: 1 } }, fare: "flesh", serves: { hunger: 3 } },
  { id: "infant", name: "an infant", kind: "person", forms: [], props: { mass: 1, size: 1, hardness: 0, toughness: 1 }, body: { strength: 0, speed: 0, sight: 2, hearing: 2, smell: 1, eats: { flesh: 2, fruit: 4, seed: 4 } }, fare: "flesh", serves: { hunger: 1 } },
  { id: "meat", name: "meat", kind: "material", forms: [], props: { mass: 1, size: 1, toughness: 2, perishability: 5, scent: 3 }, moist: 3, serves: { hunger: 3 }, fare: "flesh" },
  { id: "haws", name: "a spray of haws", kind: "plant", forms: [], props: { mass: 0, size: 1, toughness: 1, scent: 1 }, serves: { hunger: 2 }, fare: "fruit" },
  { id: "browse", name: "green browse", kind: "plant", forms: [], props: { mass: 1, size: 2, toughness: 2 }, serves: { hunger: 2 }, fare: "leaf" },
];
const YOUNG: Record<string, string> = { wolf: "pup", person: "infant", hind: "fawn", bear: "cub" };

function scene(seed: number): W {
  const r = Rng.fromSeed(seed);
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(r.next() * xs.length)] as T;
  const level = (max: number) => Math.floor(r.next() * (max + 1));
  const body = (id: string, element: string, where: [number, number], set: Partial<matter.Body> = {}): matter.Body => ({ id, element, place: "wood", where, needs: { hunger: level(5), rest: level(3), warmth: 0 }, health: 5, wounds: [], sickness: 0, sickensIn: 0, ...set });
  const what = pick(["wolf", "wolf", "person", "hind", "bear"]);
  const bodies: matter.Body[] = [];
  const things: matter.Thing[] = [];
  const bonds: matter.Bond[] = [];
  const self = body("self", what, [0, 0]);
  if (r.next() < 0.3) self.wounds = [{ depth: 1 + level(2), bleeding: r.next() < 0.5 ? 1 : 0, burned: 0 }];
  if (r.next() < 0.15) self.doing = pick(["work_on", "eat_drink", "go_to"]);
  if (r.next() < 0.45) {
    const den: [number, number] = pick([[1, 1], [6, 0], [60, 0]]);
    self.home = { place: "wood", where: den };
    for (let i = 0; i <= level(1); i++) {
      bodies.push(body(`young${"ab"[i]}`, YOUNG[what] ?? "pup", den, { needs: { hunger: level(5) } }));
      bonds.push({ from: "self", to: `young${"ab"[i]}`, kind: "young", weight: 4 + level(1) });
    }
  }
  if (r.next() < 0.75) {
    const other = pick(["person", "wolf", "bear", "hind", "hare", what]);
    const gap = pick([2, 4, 8, 15, 30]);
    const o = body("other", other, [gap, 1]);
    if (r.next() < 0.3) o.wounds = [{ depth: 2 + level(2), bleeding: 1, burned: 0 }];
    if (other === "person" && r.next() < 0.6) {
      things.push({ id: "stone", element: "stone", place: "wood", where: [gap, 1], state: { ...matter.FRESH } });
      o.holds = ["stone"];
    }
    if (other === what && r.next() < 0.5) {
      bonds.push({ from: "self", to: "other", kind: "pack", weight: 3 }, { from: "other", to: "self", kind: "pack", weight: 3 });
      self.rank = level(4);
      o.rank = level(4);
    } else if (r.next() < 0.6) self.feels = { other: { fear: level(4), anger: level(3), trust: 0 } };
    bodies.push(o);
  }
  // What the food is, is drawn without regard to who is there: diet decides what it is to them.
  if (r.next() < 0.7) things.push({ id: "food", element: pick(["meat", "meat", "haws", "browse"]), place: "wood", where: [pick([1, 5, 12, 25]), -1], state: { ...matter.FRESH, amount: 5, wetness: 3 } });
  bodies.push(self);
  const place = matter.placeOf("wood", { light: pick([1, 4, 4]), noise: 1, cover: pick([0, 0, 3]), exits: pick([0, 2, 5, 5]), ...(self.rank === undefined ? {} : { customs: [{ over: "food" as const, first: "rank" as const }] }) });
  const empty = matter.worldOf([...matter.POOL, ...ROWS], [place]);
  const made: W = { ...empty, things: Object.fromEntries(things.map((t) => [t.id, t])), bodies: Object.fromEntries(bodies.map((b) => [b.id, b])), bonds };
  return matter.resolve(made, { process: "drift", minutes: 0 }).world;
}

const intents: { id: string; what: string; not_for?: string; examples?: string[] }[] = JSON.parse(readFileSync(`${ROOT}/intents.json`, "utf8")).intents;
const WORDINGS = [
  "What does `creature` do now, given its condition, `its_own`, what is `present` and the `ground`? Judge how this particular one would act, not how an ideal one should.",
  "With `its_own` as they are, `present` around it and the `ground` as it lies, which of these does `creature` choose? Judge this particular one, not an ideal one.",
];
const ask = (wording: number, criteria: { [l: string]: Json }): Asked => ({
  family: "pick_action",
  question: { type: "choice", instructions: WORDINGS[wording] as string, criteria: { ...criteria, [NONE]: "It does something that fits none of the others" } },
  fallback: choiceFallback(NONE, [...Object.keys(criteria), NONE]),
});
const probs = (a: unknown) => ((a as { probabilities?: Record<string, number> })?.probabilities ?? {}) as Record<string, number>;
const ranked = (p: Record<string, number>) => Object.entries(p).sort((x, y) => y[1] - x[1]).map(([k]) => k);
const round = (x: number) => Math.round(x * 100) / 100;

const judge = new LiveJudge({ timeoutMs: 20000 });
let tokens = 0;

async function measure(seed: number) {
  const w = scene(seed);
  const self = w.bodies.self as matter.Body;
  const offered = matter.offers(w, self).filter((o) => o.id !== "none");
  const slice = matter.sliceFor(w, self);
  if (offered.length < 2) return { seed, skipped: `only ${offered.length} offered`, offered: offered.map((o) => o.id) };
  // Shuffled by the seed, and labelled by letter: the order says nothing.
  const r = Rng.fromSeed(seed + 7919);
  const shown = offered.map((o) => ({ o, k: r.next() })).sort((a, b) => a.k - b.k).map((x, i) => ({ label: `option_${"abcdefgh"[i]}`, offer: x.o }));
  const criteria = Object.fromEntries(shown.map((s) => [s.label, s.offer.description]));
  const full = Object.fromEntries(intents.map((i) => [i.id, { what: i.what, ...(i.not_for ? { not_for: i.not_for } : {}) }]));
  const [a, b, c] = await Promise.all([
    judge.ask(buildRequest(slice as unknown as Json, `routine0-${seed}`, { act: ask(0, criteria) })),
    judge.ask(buildRequest(slice as unknown as Json, `routine1-${seed}`, { act: ask(1, criteria) })),
    judge.ask(buildRequest(slice as unknown as Json, `routineF-${seed}`, { act: ask(0, full) })),
  ]);
  tokens += a.inputTokens + b.inputTokens + c.inputTokens;
  const [p0, p1, pf] = [probs(a.answers.act), probs(b.answers.act), probs(c.answers.act)];
  const byLabel = Object.fromEntries(shown.map((s) => [s.label, s.offer.id]));
  const order = ranked(p0).map((l) => byLabel[l] ?? l);
  const routine = offered[0]?.id ?? "none";
  const shift = round(Object.keys({ ...p0, ...p1 }).reduce((sum, l) => sum + Math.abs((p0[l] ?? 0) - (p1[l] ?? 0)), 0) / 2);
  const wants = ranked(pf)[0] ?? NONE;
  return {
    seed, what: slice.creature.what, n: offered.length, routine, jev: order.slice(0, 3), p: round(Math.max(...Object.values(p0))), none: round(p0[NONE] ?? 0),
    top1: order[0] === routine, top2: order.slice(0, 2).includes(routine), shift,
    wants, wants_p: round(pf[wants] ?? 0), wanted_offered: offered.some((o) => o.intent === wants), waits: matter.INTENT_ROWS[wants]?.waitsOn ?? null,
    offered: offered.map((o) => `${o.id} ${o.salience}`), slice,
  };
}

const rows: any[] = [];
for (let i = 0; i < N; i += 6) {
  rows.push(...(await Promise.all(Array.from({ length: Math.min(6, N - i) }, (_, k) => measure(BASE + i + k).catch((e) => ({ seed: BASE + i + k, error: String(e) }))))));
  console.log(`${Math.min(i + 6, N)}/${N}`);
}
const ok = rows.filter((r) => !r.error && !r.skipped);
const pct = (f: (r: any) => boolean) => Math.round((ok.filter(f).length / Math.max(1, ok.length)) * 100);
const missing: Record<string, number> = {};
for (const r of ok) if (!r.wanted_offered) missing[r.wants] = (missing[r.wants] ?? 0) + 1;
const summary = {
  scenes: rows.length, measured: ok.length, skipped: rows.filter((r) => r.skipped).length, errors: rows.filter((r) => r.error).length, tokens, usd: Math.round((tokens * 0.042) / 1e6 * 10000) / 10000,
  routine_is_jev_top1_pct: pct((r) => r.top1), routine_in_jev_top2_pct: pct((r) => r.top2),
  chance_top1_pct: Math.round((ok.reduce((s, r) => s + 1 / (r.n + 1), 0) / Math.max(1, ok.length)) * 100),
  chance_top2_pct: Math.round((ok.reduce((s, r) => s + Math.min(1, 2 / (r.n + 1)), 0) / Math.max(1, ok.length)) * 100),
  jev_none_over_handful_pct: pct((r) => r.jev[0] === NONE),
  median_shift: ok.map((r) => r.shift).sort((x, y) => x - y)[Math.floor(ok.length / 2)] ?? 0,
  wanted_intent_was_offered_pct: pct((r) => r.wanted_offered),
  // Going to the food is the first step of eating it: the same want, one act earlier.
  wanted_or_its_first_step_offered_pct: pct((r) => r.wanted_offered || (r.wants === "eat_drink" && r.offered.some((o: string) => o.startsWith("go_to:")))),
  wanted_but_not_offered: missing,
};
writeFileSync(`${ROOT}/results/routine-${process.argv[3] ?? "v0"}.json`, `${JSON.stringify({ summary, rows }, null, 1)}\n`);
console.log(JSON.stringify(summary, null, 1));
