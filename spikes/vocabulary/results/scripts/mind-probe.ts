// Throwaway, not linted. Can the judge weigh many factors at once, if the state carries them?
// The state here is written by hand on purpose: this separates "can Jev use these factors" from
// "can the engine build them", which is the real work. Every line below is a line the engine
// would have to be able to produce from structures: needs, bonds and the wards' needs, a home
// place, another body's deeds and what it could do, what this body can still do, a trait.
import { writeFileSync } from "node:fs";
import { buildRequest, LiveJudge, pickAction, type Variant } from "@rpg-jev/jev";

const OPTIONS = [
  { id: "go_to_kill", description: "Go to the meat and eat" },
  { id: "carry_food_home", description: "Take meat back to the den" },
  { id: "guard_den", description: "Stay between the intruder and the den" },
  { id: "threaten", description: { what: "Warn the intruder off: bared teeth, a rush that stops short", not_for: "Biting" } },
  { id: "attack", description: "Go for the intruder and bite" },
  { id: "flee", description: "Get well away from here" },
  { id: "rest", description: "Stay where it is and rest" },
];

interface Case { id: string; who: string; circumstances: string[]; bonds: string[]; notices: string[]; situation: string }

const kill = "smells fresh meat a short way off, in the open";
const stoneThrower = "a lone person, smaller than it, twenty paces from the den, has thrown two stones at it and is shouting";
const cases: Case[] = [
  { id: "lone male, starving, nobody about", who: "a lone male wolf", circumstances: ["has not eaten for days and is weak with hunger"], bonds: [], notices: [kill], situation: "The wolf smells meat." },
  { id: "lone male, starving, provoked", who: "a lone male wolf", circumstances: ["has not eaten for days and is weak with hunger", "has no den here and nothing to keep it in this place"], bonds: [], notices: [kill, stoneThrower.replace(" from the den", " away")], situation: "A person is throwing stones at the wolf." },
  { id: "mother, starving, pups hungry, nobody about", who: "a she-wolf with four pups", circumstances: ["has not eaten for days and is weak with hunger", "is nursing, which takes more out of her every day", "her den is close by, under a fallen tree"], bonds: ["four pups in the den, three weeks old, who cannot leave it or feed themselves", "the pups have not fed since yesterday and are crying"], notices: [kill], situation: "The she-wolf smells meat." },
  { id: "mother, starving, provoked at the den", who: "a she-wolf with four pups", circumstances: ["has not eaten for days and is weak with hunger", "is nursing, which takes more out of her every day", "her den is close by, under a fallen tree"], bonds: ["four pups in the den, three weeks old, who cannot leave it or feed themselves", "the pups have not fed since yesterday and are crying"], notices: [kill, stoneThrower], situation: "A person near the den is throwing stones at the she-wolf." },
  { id: "mother, fed, provoked at the den", who: "a she-wolf with four pups", circumstances: ["ate well this morning", "her den is close by, under a fallen tree"], bonds: ["four pups in the den, three weeks old, who cannot leave it or feed themselves", "the pups fed an hour ago and are asleep"], notices: [stoneThrower], situation: "A person near the den is throwing stones at the she-wolf." },
  { id: "mother, badly hurt, provoked at the den, by three armed people", who: "a she-wolf with four pups", circumstances: ["has a deep wound in her shoulder and can barely run", "her den is close by, under a fallen tree"], bonds: ["four pups in the den, three weeks old, who cannot leave it or feed themselves"], notices: ["three people with spears, twenty paces from the den, are coming on slowly"], situation: "Armed people are closing on the den." },
];

const judge = new LiveJudge({ timeoutMs: 8000 });
const out: unknown[] = [];
for (const c of cases) {
  const state = {
    place: { time: "dusk", where: "a wood" },
    creatures: { wolf: { name: c.who, traits: ["wary of people", "patient"], wants: ["to eat", "to stay unhurt", ...(c.bonds.length ? ["to keep her pups alive"] : [])], circumstances: [...c.circumstances, ...c.bonds], knows: c.notices, situation: c.situation } },
  };
  const row: Record<string, unknown> = { case: c.id };
  for (const v of [0, 1] as Variant[]) {
    const res = await judge.ask(buildRequest(state, `mind-${c.id}-${v}`, { act: pickAction("creatures.wolf", OPTIONS, "rest", v) }));
    const a = res.answers.act;
    if (a?.type === "choice")
      row[`v${v}`] = Object.fromEntries(Object.entries(a.probabilities).filter(([, p]) => p >= 0.03).sort((x, y) => y[1] - x[1]).map(([k, p]) => [k, Math.round(p * 100) / 100]));
    row.tokens = res.inputTokens;
  }
  out.push(row);
  console.log(JSON.stringify(row));
}
writeFileSync("H:/rpg-jev.worktrees/sandbox-matter/spikes/vocabulary/results/mind-probe.json", `${JSON.stringify(out, null, 1)}\n`);
