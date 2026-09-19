/**
 * X4, soak, and X5, join (the coating half). Liquid moves onto and into things: it wets
 * them as far as they can drink, puts out what burns if there is enough of it, carries
 * what lives in it, and lifts a coat only if it can get under it. Oily and watery do not
 * mix without something that cleanses (P21, P24).
 */
import { type Grown, grownFor } from "./graph/grown.ts";
import { changesOf, type Env, envOf, Kernel, partyOf, type Ready, ready } from "./graph/kernel.ts";
import type { Said } from "./graph/rules.ts";
import {
  COAT_DERIVED,
  COAT_RULES,
  COAT_SPREADS,
  SOAK_DERIVED,
  SOAK_RULES,
  SOAK_WETS,
} from "./graph/soak-rules.ts";
import type { Change, Manner, MatterWorld } from "./types.ts";
import { ORDINARY } from "./types.ts";

export interface SoakAct {
  process: "soak";
  liquid: string;
  target: string;
  /** How much of the liquid is used, in the liquid's own units. */
  amount: number;
}

export interface CoatAct {
  process: "coat";
  substance: string;
  target: string;
  amount?: number;
  manner?: Manner;
}

const run = (rules: readonly Ready[], env: Env): Change[] =>
  rules.flatMap((rule) => {
    const ran = rule(env);
    return ran ? changesOf(env, ran) : [];
  });

const said = (s: Said) => ({ because: [...s.because], note: s.note });

/** Soak, from the base rows and whatever has grown beside them. */
export function soakFrom(grown: Grown) {
  const SOAK = Kernel.with(SOAK_DERIVED, grown);
  const SOAKS = [...SOAK_RULES, ...grown.rules].map((rule) => ready(SOAK, rule));
  const WETS = SOAK.test(SOAK_WETS.when);

  /** Soak is rows of data (graph/soak-rules.ts): wet, douse, wash, and the liquid used. */
  function soak(world: MatterWorld, act: SoakAct): Change[] {
    const liquid = world.things[act.liquid];
    const target = world.things[act.target];
    const nothing: Change = { kind: "nothing", ...said(SOAK_WETS.otherwise) };
    if (!(liquid && target) || liquid.id === target.id) return [nothing];
    const parties = { tgt: partyOf(world, target), liq: partyOf(world, liquid) };
    const env = envOf(world, parties, 0, { amount: act.amount });
    return WETS(env) ? run(SOAKS, env) : [nothing];
  }

  return soak;
}

/** Coating, from the base rows and whatever has grown beside them. */
export function coatFrom(grown: Grown) {
  const COAT = Kernel.with(COAT_DERIVED, grown);
  const COATS = [...COAT_RULES, ...grown.rules].map((rule) => ready(COAT, rule));
  const SPREADS = COAT.test(COAT_SPREADS.when);

  /** Coating is rows of data too: a substance that spreads becomes a coat (S7). */
  function coat(world: MatterWorld, act: CoatAct): Change[] {
    const substance = world.things[act.substance];
    const target = world.things[act.target];
    if (!(substance && target))
      return [{ kind: "nothing", because: [], note: "there is nothing there to coat" }];
    const manner = act.manner ?? ORDINARY;
    const parties = { tgt: partyOf(world, target), sub: partyOf(world, substance) };
    const numbers = { amount: act.amount ?? 0.2, care: manner.care, haste: manner.haste };
    const env = envOf(world, parties, 0, numbers);
    if (substance.id === target.id || !SPREADS(env))
      return [{ kind: "nothing", ...said(COAT_SPREADS.otherwise) }];
    return run(COATS, env);
  }

  return coat;
}

export const soak = soakFrom(grownFor("soak"));
export const coat = coatFrom(grownFor("coat"));
