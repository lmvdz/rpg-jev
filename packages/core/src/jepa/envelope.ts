/**
 * The envelope (milestone J, P3): for each thing an act or a tick affects, the outcomes that are
 * physically legal, always including "nothing happens". It is the product of what each channel
 * may do, and each channel's rule is a physical precondition, never a prediction: nothing lights
 * without something that burns and a flame or scorching heat, nothing goes out that is not
 * burning, nothing loses a coat it does not have. It must hold whatever the engine does; a
 * property test checks that on the training seeds.
 */
import { containerOf } from "../matter/contain.ts";
import { effective, isLiquid } from "../matter/effective.ts";
import { surfaceTemperature } from "../matter/heat.ts";
import type { MatterWorld, Thing } from "../matter/types.ts";
import { type ActView, type Related, relatedTo } from "./observe.ts";
import { CHANNELS, type Outcome, outcomeId, SAME } from "./outcomes.ts";

/** Which classes each channel may take, as flags in `CHANNELS` order. */
export type Legal = readonly (readonly boolean[])[];

interface Context {
  world: MatterWorld;
  thing: Thing;
  act: ActView;
  party: boolean;
  role: string;
  related: readonly Related[];
  touching: readonly Thing[];
}

const EPS = 0.05;

const hotter = (c: Context) =>
  c.touching.some(
    (t) => t.state.burning || surfaceTemperature(t) > c.thing.state.temperature + EPS,
  );
const colder = (c: Context) =>
  c.touching.some((t) => t.state.temperature < c.thing.state.temperature - EPS);
const place = (c: Context) => c.world.places[c.thing.place];
const acted = (c: Context, ...processes: ActView["process"][]) =>
  c.party && processes.includes(c.act.process);
const time = (c: Context) => c.act.process === "tick";
const flammable = (c: Context) => {
  const p = effective(c.world, c.thing);
  const coat = c.thing.state.coating;
  const coatBurns = (c.world.elements[coat?.element ?? ""]?.props.flammability ?? 0) > 0;
  return (
    p.flammability > 0 ||
    coatBurns ||
    (c.world.elements[c.thing.element]?.props.flammability ?? 0) > 0
  );
};

/** Each channel's classes, as a rule per class. `same` is always legal. */
const RULES: Record<(typeof CHANNELS)[number]["name"], Record<string, (c: Context) => boolean>> = {
  heat: {
    warmer: (c) =>
      !!c.thing.state.burning ||
      hotter(c) ||
      acted(c, "heat", "force", "soak", "coat") ||
      (time(c) &&
        ((place(c)?.temperature ?? 2) > c.thing.state.temperature - EPS ||
          // Inside a container, what warms the container over the stretch warms its inside.
          !!containerOf(c.world, c.thing))),
    cooler: (c) =>
      !!c.thing.state.burning ||
      colder(c) ||
      acted(c, "heat", "soak", "coat") ||
      (time(c) &&
        ((place(c)?.temperature ?? 2) < c.thing.state.temperature + EPS ||
          c.thing.state.wetness > 0 ||
          !!containerOf(c.world, c.thing))),
  },
  wet: {
    wetter: (c) =>
      acted(c, "soak", "coat", "heat") ||
      c.touching.some((t) => isLiquid(c.world, t)) ||
      (time(c) && (place(c)?.moisture ?? 2) > 0),
    drier: (c) => c.thing.state.wetness > 0,
  },
  fire: {
    lit: (c) =>
      !c.thing.state.burning &&
      flammable(c) &&
      (hotter(c) ||
        acted(c, "heat", "force", "coat") ||
        surfaceTemperature(c.thing) >= 3 ||
        time(c)),
    out: (c) => !!c.thing.state.burning,
  },
  whole: {
    damaged: (c) =>
      c.thing.state.integrity > EPS &&
      (acted(c, "force", "load", "heat", "soak", "coat") ||
        !!c.thing.state.burning ||
        hotter(c) ||
        (time(c) &&
          (c.thing.state.contamination > 0 ||
            c.thing.state.corrosion > 0 ||
            c.thing.state.wetness > 0))),
  },
  coat: {
    gained: (c) => acted(c, "coat", "soak") && c.role === "target",
    lost: (c) => !!c.thing.state.coating,
  },
  rot: {
    more: (c) =>
      effective(c.world, c.thing).perishability > 0 ||
      c.thing.state.contamination > 0 ||
      c.touching.some((t) => t.state.contamination > 0) ||
      // What drinks water and stays damp goes musty, and damp air wets it over a stretch.
      c.thing.state.wetness > 0 ||
      (time(c) && (place(c)?.moisture ?? 2) > 2) ||
      acted(c, "soak", "coat"),
    less: (c) => c.thing.state.contamination > 0,
  },
  rust: {
    more: (c) => effective(c.world, c.thing).corrodibility > 0,
  },
  amount: {
    less: (c) => consumable(c) || isLiquid(c.world, c.thing),
    gone: consumable,
  },
};

/** What can be used up: by an act on it, by burning, by rotting, or by catching over a stretch. */
function consumable(c: Context): boolean {
  return (
    !!c.thing.state.burning ||
    c.party ||
    (time(c) && effective(c.world, c.thing).perishability > 0) ||
    (time(c) && !!RULES.fire.lit?.(c))
  );
}

function contextOf(
  world: MatterWorld,
  thing: Thing,
  act: ActView,
  related?: readonly Related[],
): Context {
  const near = related ?? relatedTo(world, thing, act.roles);
  const role = act.roles[thing.id] ?? "bystander";
  return {
    world,
    thing,
    act,
    party: role !== "bystander",
    role,
    related: near,
    touching: near.filter((r) => r.relation !== "near").map((r) => r.thing),
  };
}

/** What each channel of one thing may do under this act, `same` always among it. */
export function legal(
  world: MatterWorld,
  thing: Thing,
  act: ActView,
  related?: readonly Related[],
): Legal {
  const c = contextOf(world, thing, act, related);
  return CHANNELS.map((channel, i) =>
    channel.classes.map((name, k) => k === SAME[i] || !!RULES[channel.name][name]?.(c)),
  );
}

export const isLegal = (legalSet: Legal, outcome: Outcome): boolean =>
  outcome.every((k, i) => !!legalSet[i]?.[k]);

/** The candidates, as outcome ids, in a canonical order (ascending id). */
export function candidates(legalSet: Legal): number[] {
  let outcomes: number[][] = [[]];
  for (const flags of legalSet) {
    const next: number[][] = [];
    for (const prefix of outcomes)
      for (const [k, ok] of flags.entries()) if (ok) next.push([...prefix, k]);
    outcomes = next;
  }
  return outcomes.map(outcomeId).sort((a, b) => a - b);
}

/** A stable hash of a candidate set: what the log records beside the draw. */
export function candidateHash(legalSet: Legal): string {
  return legalSet.map((flags) => flags.map((f) => (f ? "1" : "0")).join("")).join(".");
}
