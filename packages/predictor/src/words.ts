/**
 * A scene in plain words, rendered by code from levels (SPEC rule 6): what each thing is made
 * of, what state it is in, where it is, and what is done. Element names are never used; a thing
 * is its id and its description, so nothing a model wrote reaches a labeller or the judge.
 */
import type * as jepa from "@rpg-jev/core/jepa";
import * as matter from "@rpg-jev/core/matter";

type Thing = matter.Thing;
type MatterWorld = matter.MatterWorld;

const DEGREE = ["not at all", "barely", "a little", "fairly", "very", "extremely"] as const;
const degree = (v: number) => DEGREE[Math.max(0, Math.min(5, Math.round(v)))] as string;

const PROPERTY_WORDS: Partial<Record<matter.PropertyKey, string>> = {
  mass: "heavy",
  size: "big",
  hardness: "hard",
  toughness: "tough",
  flexibility: "bendy",
  flammability: "flammable",
  conductivity: "heat-conducting",
  absorbency: "absorbent",
  porosity: "porous",
  perishability: "perishable",
  corrodibility: "prone to rust or corrosion",
  oiliness: "oily",
  stickiness: "sticky",
  solubility: "soluble",
};

const TEMPERATURE = ["frozen", "cold", "mild", "warm", "hot", "scorching"];
const WET = ["dry", "slightly damp", "damp", "wet", "very wet", "soaked"];

function stateWords(world: MatterWorld, thing: Thing): string[] {
  const s = thing.state;
  const out = [TEMPERATURE[Math.round(s.temperature)] ?? "mild"];
  if (s.wetness > 0.5)
    out.push(`${WET[Math.round(s.wetness)] ?? "wet"}${s.wetWith ? " with oil" : ""}`);
  if (s.burning) out.push(s.burning.of === "coating" ? "its coating is on fire" : "on fire");
  if (s.integrity < 4.5) out.push(s.integrity < 2 ? "badly broken" : "cracked");
  if (s.coating) out.push(`coated with ${materialWords(world, s.coating.element)}`);
  if (s.contamination > 0.5) out.push(`${degree(s.contamination)} rotten or mouldy`);
  if (s.corrosion > 0.5) out.push(`${degree(s.corrosion)} rusted`);
  out.push(s.amount > 1.5 ? `about ${Math.round(s.amount)} portions of it` : "one portion");
  return out;
}

function materialWords(world: MatterWorld, element: string): string {
  const e = world.elements[element];
  if (!e) return "something";
  const forms = e.forms.length > 0 ? e.forms.join(", ") : "solid";
  const props = Object.entries(PROPERTY_WORDS)
    .filter(([k]) => (e.props[k as matter.PropertyKey] ?? 0) >= 3)
    .map(([k, w]) => `${degree(e.props[k as matter.PropertyKey] ?? 0)} ${w}`);
  const not = (e.props.flammability ?? 0) === 0 ? ["does not burn"] : [];
  return `a ${e.kind} (${forms}${props.length > 0 ? `; ${props.join(", ")}` : ""}${not.length > 0 ? `; ${not.join(", ")}` : ""})`;
}

/** One thing: what it is made of and what state it is in. */
export function thingWords(world: MatterWorld, thing: Thing): string {
  const liquid = matter.isLiquid(world, thing) ? "liquid right now; " : "";
  return `${materialWords(world, thing.element)}, ${liquid}${stateWords(world, thing).join(", ")}`;
}

function whereWords(world: MatterWorld, thing: Thing): string {
  const container = matter.containerOf(world, thing);
  if (!container) return "out in the open";
  const sealed = matter.sealed(world, container.id);
  return `inside ${container.id}${sealed ? ", which is sealed shut" : ", which is open"}`;
}

const MANNER = (m?: matter.Manner) =>
  m ? `with ${degree(m.effort)} effort, ${degree(m.care)} care, ${degree(m.haste)} haste` : "";

const ACT_WORDS: Record<string, (a: matter.Act) => string> = {
  drift: (a) => (a.process === "drift" ? `Nobody does anything; ${a.minutes} minutes pass.` : ""),
  heat: (a) =>
    a.process === "heat"
      ? `Someone holds ${a.target} to ${a.source} for ${a.minutes} minutes (contact ${degree((a.contact ?? 1) * 5)} close).`
      : "",
  soak: (a) =>
    a.process === "soak"
      ? `Someone pours ${a.liquid} over ${a.target} (${a.amount} portions).`
      : "",
  coat: (a) =>
    a.process === "coat"
      ? `Someone spreads ${a.substance} over ${a.target} ${MANNER(a.manner)}.`
      : "",
  force: (a) =>
    a.process === "force"
      ? `Someone strikes ${a.patient} with ${a.instrument} ${MANNER(a.manner)}, aimed ${a.aim ?? "through"} it.`
      : "",
  contain: (a) =>
    a.process === "contain"
      ? `Someone does "${a.how}" with container ${a.container}${a.thing ? ` and ${a.thing}` : ""}.`
      : "",
  load: (a) =>
    a.process === "load" ? `Someone rests ${a.bearing.join(", ")} on ${a.support}.` : "",
};

export function actWords(act: matter.Act): string {
  return ACT_WORDS[act.process]?.(act) ?? `Someone does ${act.process}.`;
}

export interface SceneWords {
  place: string;
  things: Record<string, { is: string; where: string }>;
  act: string;
}

export function sceneWords(s: jepa.Scenario): SceneWords {
  const place = s.world.places.site;
  const things = Object.fromEntries(
    Object.values(s.world.things)
      .sort((a, b) => (a.id < b.id ? -1 : 1))
      .map((t) => [t.id, { is: thingWords(s.world, t), where: whereWords(s.world, t) }]),
  );
  return {
    place: place
      ? `${TEMPERATURE[Math.round(place.temperature)]} air, ${degree(place.moisture)} humid, wind ${degree(place.wind)}${place.air <= 0 ? ", no fresh air at all" : ""}`
      : "an ordinary place",
    things,
    act: actWords(s.act),
  };
}
