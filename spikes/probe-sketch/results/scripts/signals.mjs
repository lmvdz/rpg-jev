// Offline signal check over night logs. No model. node signals.mjs FILE...
import { readFileSync, writeFileSync } from "node:fs";
const files = process.argv.slice(2);
const stats = {}; // qid-kind -> counters
const examples = [];
const guardDiffs = [];
let fallback = 0, dropped = 0, decisions = 0, cached = 0;
const kindOf = (id) => id.replace(/_(odo|mara|tobin)$/, "_<npc>");
for (const f of files) {
  const log = readFileSync(f, "utf8").trim().split("\n").map((l) => JSON.parse(l));
  // A free-text read is logged before its input entry; others after. Map decision -> input text.
  const byId = new Map(log.map((e) => [e.id, e]));
  const rootInput = (e) => { let at = e; for (let i = 0; at && i < 50; i++) { if (at.kind === "input") return at.text; at = byId.get(at.cause); } return null; };
  let lastInput = "";
  for (let i = 0; i < log.length; i++) {
    const e = log[i];
    if (e.kind === "input") lastInput = e.text;
    if (e.kind === "dropped") dropped++;
    if (e.kind !== "decision") continue;
    decisions++;
    if (e.source === "fallback") fallback++;
    if (e.source === "cache") cached++;
    let input = rootInput(e);
    if (!input && "verb" in e.answers) input = log.slice(i).find((x) => x.kind === "input")?.text ?? null;
    input ??= `(after) ${lastInput}`;
    for (const [qid, a] of Object.entries(e.answers)) {
      const k = kindOf(qid);
      const s = (stats[k] ??= { type: a.type, n: 0, none: 0, close: 0, mid: 0 });
      s.n++;
      if (a.type === "choice") {
        const sorted = Object.entries(a.probabilities).sort((x, y) => y[1] - x[1]);
        const [top, second] = sorted;
        const noneWins = top[0] === "none_of_these" || top[0] === "keep_quiet";
        if (top[0] === "none_of_these") s.none++;
        const close = second && top[1] - second[1] <= 0.15;
        if (close) s.close++;
        if ((noneWins && ["verb","states","asks_about","reply","act","respond","mode"].includes(k)) || (close && !["item","request","states","asks_about"].includes(k)))
          examples.push({ file: f, t: e.t, input, q: qid, top: sorted.slice(0, 3).map(([o, p]) => `${o} ${p.toFixed(2)}`).join(", "), tag: noneWins ? "none" : "close" });
      } else if (a.type === "noul") {
        if (a.noul >= 0.35 && a.noul <= 0.65) { s.mid++; examples.push({ file: f, t: e.t, input, q: qid, top: `noul ${a.noul.toFixed(2)}`, tag: "mid-noul" }); }
      }
    }
    const n = (x) => e.answers[x]?.noul;
    if (n("guard_a") !== undefined)
      guardDiffs.push({ file: f, t: e.t, input, guard_a: n("guard_a"), guard_b: n("guard_b"), dGuard: Math.abs(n("guard_a") - n("guard_b")), culprit_a: n("culprit_a"), culprit_b: n("culprit_b"), dCulprit: Math.abs(n("culprit_a") - n("culprit_b")) });
  }
}
const out = { files, decisions, fallback, cached, dropped, stats, guardDiffs, examples };
writeFileSync("signals.json", JSON.stringify(out, null, 1));
console.log(`decisions ${decisions}, fallback ${fallback}, cache ${cached}, dropped ${dropped}`);
console.table(Object.fromEntries(Object.entries(stats).map(([k, s]) => [k, s])));
console.table(guardDiffs.map((g) => ({ in: g.input.slice(0, 40), a: g.guard_a.toFixed(2), b: g.guard_b.toFixed(2), d: g.dGuard.toFixed(2), ca: g.culprit_a?.toFixed(2), cb: g.culprit_b?.toFixed(2), dc: g.dCulprit?.toFixed(2) })));
for (const tag of ["none", "close", "mid-noul"]) { console.log(`\n== ${tag}`); for (const x of examples.filter((e) => e.tag === tag).slice(0, 14)) console.log(`${x.file.split("/").pop()} t${x.t} "${x.input}" ${x.q}: ${x.top}`); }
