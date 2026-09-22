/**
 * Labels for what the engine declines to model (milestone J, set (c) and the gap signals of
 * J3): Claude proposes, code validates, Jev checks (SPEC section 16). Claude only picks a class
 * per channel from the envelope's legal classes; code renders every word the judge reads, and
 * the judge is asked through the admitted `believe_claim` family exactly as it is built, with a
 * code-built practical listener hearing the claim from a traveller.
 */
import * as jepa from "@rpg-jev/core/jepa";
import { Rng } from "@rpg-jev/core/rng";
import { type SceneWords, sceneWords, thingWords } from "./words.ts";

export interface Proposable {
  seed: number;
  scenario: jepa.Scenario;
  words: SceneWords;
  /** Per thing id, per channel, the classes that are legal. */
  allowed: Record<string, Record<string, string[]>>;
}

export function proposable(scenario: jepa.Scenario): Proposable {
  const allowed: Proposable["allowed"] = {};
  for (const thing of Object.values(scenario.world.things)) {
    const legal = jepa.legal(scenario.world, thing, scenario.view);
    allowed[thing.id] = Object.fromEntries(
      jepa.CHANNELS.map((c, i) => [c.name, c.classes.filter((_, k) => legal[i]?.[k])]),
    );
  }
  return { seed: scenario.seed, scenario, words: sceneWords(scenario), allowed };
}

export function proposalPrompt(batch: readonly Proposable[]): string {
  const scenes = batch.map((p) => ({ scene: p.seed, ...p.words, allowed: p.allowed }));
  return [
    "You are labelling everyday physics for a simulation. For each scene below, decide what",
    "ordinarily happens to EACH thing in the scene as a result of the act (or the time passing),",
    "as one class per channel. Use only the classes listed under `allowed` for that thing and",
    "channel. Choose `same` when a channel does not change. Judge from the described materials",
    "and states only; ids are labels, not meanings. Magnitudes do not matter, only direction.",
    "",
    "Reply with JSON only, no prose, in exactly this shape:",
    '{"scenes":[{"scene":<number>,"things":{"<id>":{"heat":"...","wet":"...","fire":"...","whole":"...","coat":"...","rot":"...","rust":"...","amount":"..."}}}]}',
    "",
    "Scenes:",
    JSON.stringify(scenes),
  ].join("\n");
}

/** Claude's reply, checked against each thing's legal classes. Anything else is dropped. */
export function parseProposal(
  text: string,
  batch: readonly Proposable[],
): Map<number, Map<string, jepa.Outcome>> {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  const out = new Map<number, Map<string, jepa.Outcome>>();
  if (start < 0 || end <= start) return out;
  let parsed: { scenes?: { scene?: unknown; things?: Record<string, Record<string, unknown>> }[] };
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return out;
  }
  for (const entry of parsed.scenes ?? []) {
    const p = batch.find((b) => b.seed === entry.scene);
    if (!(p && entry.things)) continue;
    const things = new Map<string, jepa.Outcome>();
    for (const [id, allowed] of Object.entries(p.allowed)) {
      const picked = entry.things[id];
      if (!picked) break;
      const outcome = jepa.CHANNELS.map((c) => {
        const name = picked[c.name];
        return typeof name === "string" && allowed[c.name]?.includes(name)
          ? (c.classes as readonly string[]).indexOf(name)
          : -1;
      });
      if (outcome.some((k) => k < 0)) break;
      things.set(id, outcome);
    }
    if (things.size === Object.keys(p.allowed).length) out.set(p.seed, things);
  }
  return out;
}

/** Code validation: the proposal commits cleanly (envelope, invariants) with no fallback. */
export function validates(p: Proposable, outcomes: ReadonlyMap<string, jepa.Outcome>): boolean {
  const ids = Object.keys(p.scenario.world.things).sort();
  const scorer: jepa.Scorer = (observations) =>
    observations.map((_, i) => {
      const scores = new Float64Array(jepa.CLASS_NAMES.length);
      const o = outcomes.get(ids[i] as string);
      o?.forEach((k, ch) => {
        scores[(jepa.CLASS_OFFSETS[ch] ?? 0) + k] = 1;
      });
      return scores;
    });
  const { world, act, view } = p.scenario;
  const done = jepa.commit(world, act, view, scorer, Rng.fromSeed(p.seed), "label");
  return done.record.fallback === "none";
}

/** The claim the judge hears: the act, the thing, and what is said to happen to it, in words. */
export function claimFor(p: Proposable, thing: string, outcome: jepa.Outcome): string {
  const t = p.scenario.world.things[thing];
  const what = t ? thingWords(p.scenario.world, t) : "something";
  return `${p.words.act} As a result, ${thing} (${what}): ${jepa.describeOutcome(outcome)}.`;
}

/**
 * The judge's listener: an ordinary practical person, identical for every claim. The claim comes
 * from a friend they trust who watched it happen (the family's own example of a true case), so
 * what is left to doubt is whether it could happen at all, not whether the teller is honest.
 */
export function listener(claim: string) {
  return {
    name: "the listener",
    hears: { claim, from: "a friend they trust, who watched it happen" },
    knows: [
      "a lifetime of everyday work with fire, water, food, cloth, wood, stone and metal tools",
    ],
    traits: ["practical", "level-headed", "neither gullible nor contrary"],
    feeling_toward_stranger: "neutral",
  };
}

/** Eight control claims, four true and four false, rendered the same way. */
export const CONTROLS: readonly [string, boolean][] = [
  [
    "Someone holds a handful of dry grass in a campfire flame for a minute. As a result, the grass catches fire.",
    true,
  ],
  [
    "Someone pours a bucket of cold water over a small burning pile of twigs. As a result, its fire goes out.",
    true,
  ],
  [
    "Nobody does anything; a day passes. As a result, a wet iron nail left in damp air rusts.",
    true,
  ],
  [
    "Someone strikes a thin clay pot hard with a heavy stone. As a result, the pot is damaged.",
    true,
  ],
  ["Someone pours a cup of water over a dry cloth. As a result, the cloth catches fire.", false],
  [
    "Nobody does anything; an hour passes. As a result, a cold stone in cold air gets warmer by itself.",
    false,
  ],
  [
    "Someone holds an iron poker in a flame for a minute. As a result, the poker gets wetter.",
    false,
  ],
  ["Someone strikes a pool of water with a stick. As a result, the water catches fire.", false],
];
