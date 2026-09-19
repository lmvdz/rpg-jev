// node count.mjs a        counts batch A only (the batch the vocabulary is derived from)
// node count.mjs b        counts batch B (only after VOCABULARY.md is frozen)
// Throwaway: reads results/scenarios/<batch>-*.json and prints frequency tables of the
// free-text properties, processes and effects, so synonyms can be merged by hand.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, "..", "scenarios");
const batch = process.argv[2] ?? "a";
const files = readdirSync(dir).filter((f) => f.startsWith(`${batch}-`) && f.endsWith(".json"));

const bump = (map, key, id) => {
  const k = key.trim().toLowerCase();
  if (!k) return;
  const at = map.get(k) ?? { n: 0, ids: new Set() };
  at.n += 1;
  at.ids.add(id);
  map.set(k, at);
};

const props = new Map();
const processes = new Map();
const effectHeads = new Map();
const effectObjects = new Map();
const numbers = [];
const malformed = [];
let scenarios = 0;
let steps = 0;

const EFFECT =
  /^(?:(creates|consumes|moves|transfers)\s+(.*)|(.+?)\s+(gains|loses|learns)\s+(.*)|(.+?)\s+(.+?)\s+(up|down))$/i;

for (const file of files) {
  const list = JSON.parse(readFileSync(join(dir, file), "utf8"));
  for (const s of list) {
    scenarios += 1;
    for (const step of s.steps ?? []) {
      steps += 1;
      bump(processes, step.process ?? "", s.id);
      for (const b of step.because ?? []) {
        const m = /^(.+?)\s+(?:is|are|has|have)\s+(.*)$/i.exec(b);
        if (m) bump(props, m[2].replace(/^(a|an|the)\s+/i, ""), s.id);
        else malformed.push(`${s.id} because: ${b}`);
      }
      for (const e of step.effects ?? []) {
        const m = EFFECT.exec(e.trim());
        if (!m) {
          malformed.push(`${s.id} effect: ${e}`);
          continue;
        }
        if (m[1]) {
          bump(effectHeads, m[1], s.id);
          bump(effectObjects, `${m[1]} ${m[2]}`, s.id);
        } else if (m[4]) {
          bump(effectHeads, m[4], s.id);
          bump(effectObjects, `${m[4]} ${m[5]}`, s.id);
        } else {
          bump(effectHeads, m[8], s.id);
          bump(effectObjects, `${m[7]} ${m[8]}`, s.id);
        }
      }
      for (const n of step.numbers ?? []) numbers.push(`${s.id}: ${n}`);
    }
  }
}

const table = (map) =>
  [...map.entries()]
    .sort((a, b) => b[1].n - a[1].n || a[0].localeCompare(b[0]))
    .map(([k, v]) => `${String(v.n).padStart(4)}  ${k}  [${[...v.ids].slice(0, 4).join(", ")}]`);

const out = [
  `batch ${batch}: ${files.length} files, ${scenarios} scenarios, ${steps} steps`,
  `distinct: ${props.size} properties, ${processes.size} processes, ${effectObjects.size} effects`,
  "",
  "== PROCESSES ==",
  ...table(processes),
  "",
  "== PROPERTIES ==",
  ...table(props),
  "",
  "== EFFECT HEADS ==",
  ...table(effectHeads),
  "",
  "== EFFECTS ==",
  ...table(effectObjects),
  "",
  "== NUMBERS ==",
  ...numbers,
  "",
  `== MALFORMED (${malformed.length}) ==`,
  ...malformed,
];
writeFileSync(join(here, "..", `counts-${batch}.txt`), `${out.join("\n")}\n`);
console.log(out.slice(0, 2).join("\n"));
console.log(`malformed: ${malformed.length}`);
