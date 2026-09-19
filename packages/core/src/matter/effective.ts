/**
 * Principle 1: the row is a baseline. `effective` answers "what is this thing like right
 * now?" by running the modifier rules M1 to M6 over the element's levels. Every process
 * reads effective levels and never the row, so a wet log, a hot bar of iron, a set pot and
 * an oiled blade need no rule of their own.
 *
 * A modifier is a row in `MODIFIERS`. Adding one is data; no process changes.
 */
import {
  clamp,
  type Element,
  type MatterWorld,
  PROPERTY_KEYS,
  type Properties,
  type Thing,
} from "./types.ts";

export function baseline(element: Element | undefined): Properties {
  const props = {} as Properties;
  for (const key of PROPERTY_KEYS) props[key] = element?.props[key] ?? 0;
  return props;
}

/** The temperature at which P8 says it runs liquid. Level 5 melts on a warm day; 1 only in a furnace. */
export function meltingPoint(meltsAt: number): number {
  return meltsAt <= 0 ? Number.POSITIVE_INFINITY : 6.5 - meltsAt * 0.6;
}

interface Modifier {
  id: string;
  apply: (props: Properties, thing: Thing, world: MatterWorld) => void;
}

/** Surface properties a coat lends to what it covers (M6). */
const SURFACE = ["flammability", "stickiness", "oiliness", "scent", "noxiousness"] as const;

export const MODIFIERS: readonly Modifier[] = [
  {
    // M1: wetness in something absorbent. A thing that has set is past this.
    id: "M1",
    apply: (p, thing, world) => {
      const liquid = baseline(world.elements[thing.state.wetWith ?? ""]);
      // Water softens, swells and quenches. An oily liquid does none of that, and burns.
      const watery = thing.state.wetWith ? 1 - liquid.oiliness / 5 : 1;
      const wet = thing.state.wetness * watery;
      p.flammability = Math.max(
        p.flammability - wet * 0.8,
        (liquid.flammability * thing.state.wetness) / 5,
      );
      p.corrodibility *= watery;
      if (thing.state.set) return;
      const soaked = (wet * p.absorbency) / 5;
      p.mass += soaked * 0.3;
      p.hardness -= soaked * 0.3;
      p.toughness -= soaked * 0.2;
      p.flexibility += soaked * 0.3;
      p.conductivity += soaked * 0.4;
    },
  },
  {
    // M2: near its melting point it softens; cooled fast from hot it is harder and less tough.
    id: "M2",
    apply: (p, thing) => {
      const softensFrom = meltingPoint(p.meltsAt) - 1.5;
      const softness = clamp((thing.state.temperature - softensFrom) / 1.5, 0, 1);
      p.hardness -= softness * 2;
      p.flexibility += softness * 2;
      p.hardness += thing.state.temper;
      p.toughness -= thing.state.temper;
    },
  },
  {
    // M4: living contamination makes it harmful to eat and gives it a smell.
    id: "M4",
    apply: (p, thing) => {
      p.noxiousness += thing.state.contamination * 0.8 + thing.state.taint;
      p.scent += thing.state.contamination * 0.6;
    },
  },
  {
    // M5: once set, harder for good, stiff, and no longer thirsty.
    id: "M5",
    apply: (p, thing) => {
      if (!thing.state.set) return;
      p.hardness += 2;
      p.flexibility = Math.min(p.flexibility, 1);
      p.absorbency -= 2;
    },
  },
  {
    // M6: a coat lends its surface to what it covers, in proportion to coverage.
    id: "M6",
    apply: (p, thing, world) => {
      const coat = thing.state.coating;
      if (!coat) return;
      const lent = baseline(world.elements[coat.element]);
      for (const key of SURFACE) p[key] = Math.max(p[key], lent[key] * coat.coverage);
      // An oily coat sheds water: the thing under it drinks less.
      p.absorbency -= lent.oiliness * coat.coverage;
      p.corrodibility -= lent.oiliness * coat.coverage;
    },
  },
];

/** What the thing is like now. Levels stay within 0 to 5. */
export function effective(world: MatterWorld, thing: Thing): Properties {
  const props = baseline(world.elements[thing.element]);
  for (const modifier of MODIFIERS) modifier.apply(props, thing, world);
  for (const key of PROPERTY_KEYS) props[key] = clamp(props[key]);
  return props;
}

/** S6, read off S1 and P8: what flows freezes, and what is solid melts. */
export function isLiquid(world: MatterWorld, thing: Thing): boolean {
  const element = world.elements[thing.element];
  // Ice-cold water is still water: only at the bottom of the scale is it ice.
  if (element?.forms.includes("liquid")) return thing.state.temperature > 0.25;
  return thing.state.temperature >= meltingPoint(element?.props.meltsAt ?? 0);
}
