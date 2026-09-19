// node spikes/minds/results/scripts/count.mjs a     counts batch A only (the batch intents are derived from)
// Throwaway, not linted. Frequency tables of the free-text verbs and factor kinds.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, "..", "scenarios");
const batch = process.argv[2] ?? "a";
const files = readdirSync(dir).filter((f) => f.startsWith(`${batch}-`) && f.endsWith(".json"));

const bump = (map, key, id) => {
  const k = String(key ?? "").trim().toLowerCase();
  if (!k) return;
  const at = map.get(k) ?? { n: 0, ids: [] };
  at.n += 1;
  if (at.ids.length < 3) at.ids.push(id);
  map.set(k, at);
};
const head = (verb) => String(verb ?? "").trim().toLowerCase().split(/\s+/).slice(0, 2).join(" ");

const does = new Map(), doesHead = new Map(), also = new Map(), wouldNot = new Map(), kinds = new Map(), turns = new Map();
let n = 0, factors = 0;
for (const file of files)
  for (const s of JSON.parse(readFileSync(join(dir, file), "utf8"))) {
    n += 1;
    bump(does, s.does?.verb, s.id);
    bump(doesHead, head(s.does?.verb), s.id);
    for (const c of s.could_also ?? []) { bump(also, c.verb, s.id); bump(doesHead, head(c.verb), s.id); }
    for (const c of s.would_not ?? []) { bump(wouldNot, c.verb, s.id); bump(doesHead, head(c.verb), s.id); }
    for (const f of s.factors ?? []) { factors += 1; bump(kinds, f.kind, s.id); }
    bump(turns, s.turns_on, s.id);
  }

const table = (map, min = 1) =>
  [...map.entries()].filter(([, v]) => v.n >= min).sort((a, b) => b[1].n - a[1].n || a[0].localeCompare(b[0]))
    .map(([k, v]) => `${String(v.n).padStart(4)}  ${k}  [${v.ids.join(", ")}]`);

const out = [
  `batch ${batch}: ${files.length} files, ${n} scenarios, ${factors} factors`,
  `distinct: ${does.size} chosen verbs, ${also.size} alternative verbs, ${wouldNot.size} refused verbs, ${kinds.size} factor kinds`,
  "", "== FACTOR KINDS ==", ...table(kinds),
  "", "== VERB HEADS (chosen, alternative and refused together; first two words) ==", ...table(doesHead),
  "", "== CHOSEN VERBS ==", ...table(does),
  "", "== ALTERNATIVE VERBS ==", ...table(also),
  "", "== REFUSED VERBS ==", ...table(wouldNot),
  "", "== TURNS ON ==", ...table(turns),
];
writeFileSync(join(here, "..", `counts-${batch}.txt`), `${out.join("\n")}\n`);
console.log(out.slice(0, 2).join("\n"));
