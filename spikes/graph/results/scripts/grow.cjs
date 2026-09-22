// Writes the rows into graph/grown.ts from the intakes' accepted rows, round after round:
//   node spikes/graph/results/scripts/grow.cjs round-1 round-2
// The rows go in as a JSON string: they are data, and the engine parses them as data.
// Append-only: later rounds add to earlier ones and never edit them.
const fs = require("node:fs");
const root = "H:/rpg-jev.worktrees/sandbox-matter";
const rounds = process.argv.slice(2);
const grown = {};
for (const round of rounds) {
  const file = `${root}/spikes/graph/results/proposals/${round}.grown.json`;
  // A row that passed the checker and the judge and then broke something that passed is
  // rejected by the third gate, and the rejection is kept as data beside the round.
  const gate = `${root}/spikes/graph/results/proposals/${round}.gate.json`;
  const rejected = new Set(fs.existsSync(gate) ? JSON.parse(fs.readFileSync(gate, "utf8")).rejected.map((r) => r.id) : []);
  for (const [name, more] of Object.entries(JSON.parse(fs.readFileSync(file, "utf8")))) {
    const has = (grown[name] ??= { rules: [], derived: {}, factors: {} });
    has.rules.push(...(more.rules ?? []).filter((r) => !rejected.has(r.id)));
    Object.assign(has.derived, more.derived ?? {});
    for (const [q, fs_] of Object.entries(more.factors ?? {})) has.factors[q] = [...(has.factors[q] ?? []), ...fs_];
  }
}
const target = `${root}/packages/core/src/matter/graph/grown.ts`;
const was = fs.readFileSync(target, "utf8");
const line = /^const ROWS =[\s\S]*?;\n/m;
if (!line.test(was)) throw new Error("grown.ts has no ROWS line");
const rows = `const ROWS =\n  ${JSON.stringify(JSON.stringify(grown))};\n`;
fs.writeFileSync(target, was.replace(line, () => rows));
for (const [name, g] of Object.entries(grown))
  console.log(`${name}: ${g.rules.length} rules, ${Object.keys(g.derived).length} derived, ${Object.keys(g.factors).length} factored`);
