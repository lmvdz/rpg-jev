// node tally.mjs      reads results/coverage/*.json and prints coverage per batch, what is
// missing (grouped), which vocabulary ids are used and which never are, and the reactions.
// Throwaway, like count.mjs.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, "..", "coverage");
const files = readdirSync(dir).filter((f) => f.endsWith(".json"));

const batches = {};
const missing = [];
const reactions = [];
const named = [];
const lost = [];
const used = new Map();
const ID = /\b([PSBRXE]\d{1,2})\b/g;

for (const file of files) {
  const batch = file[0];
  const at = (batches[batch] ??= { full: 0, partial: 0, fail: 0, n: 0, steps: 0 });
  for (const s of JSON.parse(readFileSync(join(dir, file), "utf8"))) {
    at.n += 1;
    at[s.verdict] = (at[s.verdict] ?? 0) + 1;
    for (const step of s.steps ?? []) {
      at.steps += 1;
      for (const text of [step.process, ...(step.uses ?? []), ...(step.effects ?? [])])
        for (const m of String(text).matchAll(ID)) used.set(m[1], (used.get(m[1]) ?? 0) + 1);
    }
    for (const m of s.missing ?? []) missing.push(`${batch} ${s.id} [${s.verdict}] ${m.kind}: ${m.what} — ${m.why}`);
    for (const r of s.reactions ?? []) reactions.push(`${batch} ${s.id}: ${r}`);
    if (s.named_rule) named.push(`${batch} ${s.id}: ${s.named_rule}`);
    if (s.lost) lost.push(`${batch} ${s.id}: ${s.lost}`);
  }
}

const all = [
  ...Array.from({ length: 20 }, (_, i) => `P${i + 1}`),
  ...Array.from({ length: 14 }, (_, i) => `S${i + 1}`),
  ...Array.from({ length: 7 }, (_, i) => `B${i + 1}`),
  ...Array.from({ length: 9 }, (_, i) => `R${i + 1}`),
  ...Array.from({ length: 10 }, (_, i) => `X${i + 1}`),
  ...Array.from({ length: 12 }, (_, i) => `E${i + 1}`),
];
const out = [];
for (const [b, c] of Object.entries(batches))
  out.push(
    `batch ${b}: ${c.n} scenarios, ${c.steps} steps: full ${c.full} (${Math.round((100 * c.full) / c.n)}%), partial ${c.partial}, fail ${c.fail}`,
  );
out.push("", "== ID USE ==", all.map((id) => `${id}:${used.get(id) ?? 0}`).join("  "));
out.push("", `never used: ${all.filter((id) => !used.has(id)).join(", ") || "none"}`);
out.push("", `== MISSING (${missing.length}) ==`, ...missing.sort());
out.push("", `== NAMED RULES (${named.length}) ==`, ...named);
out.push("", `== LOST (${lost.length}) ==`, ...lost);
out.push("", `== REACTIONS (${reactions.length}) ==`, ...reactions);
writeFileSync(join(here, "..", "tally.txt"), `${out.join("\n")}\n`);
console.log(out.slice(0, Object.keys(batches).length).join("\n"));
console.log(`missing ${missing.length}, named rules ${named.length}, reactions ${reactions.length}`);
