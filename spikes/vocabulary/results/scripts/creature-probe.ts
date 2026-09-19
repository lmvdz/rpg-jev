// node --env-file=H:/rpg-jev/.env spikes/vocabulary/results/scripts/creature-probe.ts
// Throwaway, not linted. The first time Jev meets matter: code builds a wolf's closed options
// from what it notices (optionsFor), code puts its needs and percepts into words, and the
// pick_action family chooses. Paired twins, direction known beforehand (SPEC section 20).
import { writeFileSync } from "node:fs";
import { matter } from "@rpg-jev/core";
import { buildRequest, LiveJudge, pickAction, type Variant } from "@rpg-jev/jev";

const ROWS: matter.Element[] = [
  { id: "wolf", name: "a wolf", kind: "creature", forms: [], props: { mass: 3, size: 3, hardness: 1, toughness: 3 }, body: { strength: 3, speed: 4, sight: 3, hearing: 4, smell: 5 } },
  { id: "meat", name: "meat", kind: "material", forms: [], props: { mass: 1, size: 1, toughness: 2, perishability: 5, scent: 3 }, moist: 3, serves: { hunger: 3 } },
];

function scene(hunger: number, fireAt: number | null): matter.MatterWorld {
  const empty = matter.worldOf([...matter.POOL, ...ROWS], [matter.placeOf("wood", { light: 1, noise: 1 })]);
  const kill: matter.Thing = { id: "kill", element: "meat", place: "wood", where: [8, 0], state: { ...matter.FRESH, wetness: 3, amount: 5 } };
  const pile: matter.Thing = { id: "campfire", element: "branch", place: "wood", where: [fireAt ?? 0, 0], state: { ...matter.FRESH, amount: 10 } };
  const things: Record<string, matter.Thing> = { kill };
  const made = { ...empty, things };
  if (fireAt !== null) things.campfire = matter.alight(made, pile);
  const wolf: matter.Body = { id: "wolf", element: "wolf", place: "wood", where: [0, 0], needs: { hunger, rest: 1, warmth: 0 }, health: 5, wounds: [], sickness: 0, sickensIn: 0 };
  const w = { ...made, bodies: { wolf } };
  return matter.resolve(w, { process: "drift", minutes: 0 }).world;
}

// Every number becomes words here, in code (rule 3).
const hungerWords = (n: number) => (n >= 4 ? "has not eaten for days and is weak with hunger" : n >= 2 ? "is hungry" : "has eaten well today and is not hungry");
const strengthWords = (n: number) => (n >= 2.5 ? "strongly, close by" : n >= 1 ? "clearly" : "faintly, far off");
const NOTICED: Record<string, string> = { light: "sees the light of a fire", smoke: "sees smoke", sound: "hears something", scent: "smells meat" };

function state(w: matter.MatterWorld) {
  const wolf = w.bodies.wolf!;
  const notices = Object.entries(wolf.aware ?? {}).map(([, p]) => `${NOTICED[p.channel]}, ${strengthWords(p.strength)}`);
  return {
    place: { time: "night", where: "a wood, no people in sight" },
    creatures: {
      wolf: {
        name: "a lone wolf",
        traits: ["wary of fire and of people", "patient"],
        wants: ["to eat", "to stay unhurt"],
        circumstances: [hungerWords(wolf.needs.hunger ?? 0)],
        knows: notices,
        situation: notices.length ? `The wolf ${notices.join(", and ")}.` : "Nothing stirs.",
      },
    },
  };
}

const DESCRIBE: Record<string, string> = { approach: "Go toward the smell of meat", flee: "Get well away from the fire", eat: "Eat what is here", rest: "Stay where it is and rest", none: "" };

const cases = [
  { id: "starving, no fire", hunger: 5, fire: null },
  { id: "fed, no fire", hunger: 0, fire: null },
  { id: "starving, fire far (40)", hunger: 5, fire: 40 },
  { id: "starving, fire by the kill (9)", hunger: 5, fire: 9 },
  { id: "fed, fire by the kill (9)", hunger: 0, fire: 9 },
];

const judge = new LiveJudge({ timeoutMs: 8000 });
const out: unknown[] = [];
for (const c of cases) {
  const w = scene(c.hunger, c.fire);
  const options = matter.optionsFor(w, w.bodies.wolf!).filter((o) => o.id !== "none");
  const s = state(w);
  const row: Record<string, unknown> = { case: c.id, options: options.map((o) => o.id), knows: s.creatures.wolf.knows };
  for (const v of [0, 1] as Variant[]) {
    const asked = pickAction("creatures.wolf", options.map((o) => ({ id: o.id.replace(":", "_"), description: DESCRIBE[o.id.split(":")[0]!] ?? o.description })), "rest", v);
    const res = await judge.ask(buildRequest(s, `probe-${c.id}-${v}`, { act: asked }));
    const a = res.answers.act;
    row[`v${v}`] = a?.type === "choice" ? Object.fromEntries(Object.entries(a.probabilities).map(([k, p]) => [k, Math.round(p * 100) / 100])) : a;
    row[`tokens${v}`] = res.inputTokens;
  }
  out.push(row);
  console.log(JSON.stringify(row));
}
writeFileSync(new URL("../creature-probe.json", import.meta.url), `${JSON.stringify(out, null, 1)}\n`);
