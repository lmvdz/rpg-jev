/**
 * Milestone J, set (c): label acts the engine declines to model. Claude proposes one class per
 * channel per thing from the envelope's legal classes, code validates by committing it, and Jev
 * checks each claim through the admitted `believe_claim` family, with eight controls first.
 *
 *   --dev N     label N gap scenes from a development seed range and print them (a dry run).
 *   (default)   label --count scenes drawn from the sealed gap pool and write sealed/c and
 *               sealed/c-claude, printing counts only.
 *
 * Needs TYPESAFE_API_KEY (node --env-file=<.env>). Spend is metered into --ledger.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as jepa from "@rpg-jev/core/jepa";
import * as matter from "@rpg-jev/core/matter";
import { LiveJudge } from "@rpg-jev/jev";
import { type Belief, believe } from "../src/believe.ts";
import { askClaude } from "../src/claude.ts";
import { encodeScene } from "../src/encode.ts";
import {
  CONTROLS,
  claimFor,
  type Proposable,
  parseProposal,
  proposable,
  proposalPrompt,
  validates,
} from "../src/label.ts";
import { addScene, chunkFiles, emptyChunk, FILES, sha256File } from "../src/shards.ts";

const RATIFY = 0.6;

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? fallback) : fallback;
}

function devSeeds(count: number): number[] {
  const seeds: number[] = [];
  for (let seed = 3_950_000_000; seeds.length < count; seed++) {
    const s = jepa.scenario(seed);
    if (jepa.isGap(s.world, s.act, matter.resolve(s.world, s.act).changes)) seeds.push(seed);
  }
  return seeds;
}

/** Seeds of the sealed gap pool (inputs only), ordered by a hash so the choice is unbiased. */
function sealedSeeds(data: string, count: number): number[] {
  const meta = new Uint32Array(
    readFileSync(join(data, "sealed", "gap", "meta.u32")).buffer.slice(0),
  );
  const seeds = new Set<number>();
  for (let i = 1; i < meta.length; i += 2) seeds.add(meta[i] as number);
  const key = (s: number) => createHash("sha256").update(`c:${s}`).digest("hex");
  return [...seeds].sort((a, b) => (key(a) < key(b) ? -1 : 1)).slice(0, count);
}

type Labelled = { p: Proposable; outcomes: Map<string, jepa.Outcome> };

function propose(all: Proposable[], batchSize: number): Labelled[] {
  const out: Labelled[] = [];
  for (let i = 0; i < all.length; i += batchSize) {
    let pending = all.slice(i, i + batchSize);
    for (let attempt = 0; attempt < 3 && pending.length > 0; attempt++) {
      const reply = askClaude(proposalPrompt(pending));
      const parsed = reply ? parseProposal(reply, pending) : new Map();
      for (const p of pending) {
        const outcomes = parsed.get(p.seed);
        if (outcomes && validates(p, outcomes)) out.push({ p, outcomes });
      }
      pending = pending.filter((p) => !out.some((l) => l.p.seed === p.seed));
    }
    console.log(
      `proposed ${Math.min(i + batchSize, all.length)}/${all.length}, kept ${out.length}`,
    );
  }
  return out;
}

async function controlsPass(judge: LiveJudge, ledger: string): Promise<boolean> {
  const beliefs = await believe(
    judge,
    CONTROLS.map(([c]) => c),
    ledger,
    "controls",
  );
  const right = beliefs.map((b, i) => (CONTROLS[i]?.[1] ? b.mean > 0.5 : b.mean < 0.5));
  console.log(
    "controls:",
    right.filter(Boolean).length,
    "of",
    CONTROLS.length,
    "on the right side",
  );
  console.log(
    "control beliefs (true, then false):",
    beliefs.map((b) => b.mean.toFixed(2)).join(" "),
  );
  return right.every(Boolean);
}

interface Record_ {
  seed: number;
  thing: string;
  outcome: number;
  belief: Belief;
  ratified: boolean;
}

async function main(): Promise<void> {
  const dev = process.argv.includes("--dev");
  const data = arg("data", "H:/rpg-jev.worktrees/jepa-data/v1");
  const ledger = arg("ledger", "validation/jepa-proof/jev-spend.json");
  const count = Number(dev ? arg("dev", "10") : arg("count", "300"));
  const seeds = dev ? devSeeds(count) : sealedSeeds(data, count);
  const labelled = propose(
    seeds.map((s) => proposable(jepa.scenario(s))),
    Number(arg("batch", "10")),
  );
  const judge = new LiveJudge({ timeoutMs: 30_000 });
  const trusted = await controlsPass(judge, ledger);
  const claims = labelled.flatMap((l) => [...l.outcomes].map(([thing, o]) => ({ l, thing, o })));
  const beliefs = await believe(
    judge,
    claims.map((c) => claimFor(c.l.p, c.thing, c.o)),
    ledger,
    dev ? "dev" : "c",
  );
  const records: Record_[] = claims.map((c, i) => {
    const belief = beliefs[i] as Belief;
    return {
      seed: c.l.p.seed,
      thing: c.thing,
      outcome: jepa.outcomeId(c.o),
      belief,
      ratified: trusted && belief.mean >= RATIFY,
    };
  });
  const ratified = records.filter((r) => r.ratified).length;
  console.log(
    `scenes ${seeds.length}, proposed and validated ${labelled.length}, claims ${records.length}, ratified ${ratified}, controls ${trusted ? "passed" : "FAILED"}`,
  );
  if (dev) {
    for (const r of records.slice(0, 40))
      console.log(
        r.belief.mean.toFixed(2),
        r.ratified ? "yes" : "no ",
        jepa.describeOutcome(jepa.outcomeOf(r.outcome)),
        "|",
        r.belief.claim.slice(0, 220),
      );
    return;
  }
  writeSealed(data, labelled, records, trusted);
}

function writeSealed(
  data: string,
  labelled: Labelled[],
  records: Record_[],
  trusted: boolean,
): void {
  const manifestPath = join(data, "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  for (const [split, keep] of [
    ["c", (r: Record_) => r.ratified],
    ["c-claude", () => true],
  ] as const) {
    const chunk = emptyChunk();
    for (const l of labelled) {
      const encoded = encodeScene(l.p.scenario);
      const ids = Object.keys(l.p.scenario.world.things).sort();
      const mine = records.filter((r) => r.seed === l.p.seed);
      // A scene enters the split only if every one of its things has a kept label.
      if (!mine.every(keep)) continue;
      addScene(
        chunk,
        l.p.seed,
        encoded,
        ids.map((id) => [...(l.outcomes.get(id) ?? jepa.NONE)]),
      );
    }
    const dir = join(data, "sealed", split);
    mkdirSync(dir, { recursive: true });
    const files = chunkFiles(chunk);
    for (const f of FILES) writeFileSync(join(dir, f), files[f]);
    writeFileSync(
      join(dir, "labels.json"),
      JSON.stringify({ trusted, records: records.filter(keep) }),
    );
    const hashes = Object.fromEntries(
      [...FILES, "labels.json"].map((f) => [f, sha256File(join(dir, f))]),
    );
    manifest.splits[split] = {
      dir,
      sealed: true,
      scenes: chunk.scenes,
      rows: chunk.rowCount,
      samples: chunk.samples,
      files: hashes,
    };
    console.log(split, chunk.scenes, "scenes", chunk.samples, "samples (sealed)");
  }
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

await main();
