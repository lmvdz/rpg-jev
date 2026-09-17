/**
 * The combat stub (SPEC.md section 5). Code resolves every number. The judge
 * only picks an NPC's response from this closed list.
 */
export const COMBAT_RESPONSES = ["strike", "shove", "flee", "call_for_help", "do_nothing"] as const;
export type CombatResponse = (typeof COMBAT_RESPONSES)[number];

export interface Blow {
  hit: boolean;
  damage: number;
}

/** One blow from two logged draws: the first decides a hit, the second the damage. */
export function resolveBlow(hitDraw: number, damageDraw: number, armed: boolean): Blow {
  const hit = hitDraw < (armed ? 0.75 : 0.6);
  if (!hit) return { hit, damage: 0 };
  const damage = 1 + Math.floor(damageDraw * (armed ? 4 : 2));
  return { hit, damage };
}

/** How hurt someone looks, in words, because the judge never sees a number. */
export function woundWords(hp: number, maxHp: number): string {
  if (hp <= 0) return "down and not moving";
  const share = hp / maxHp;
  if (share >= 1) return "unhurt";
  if (share > 0.6) return "bruised";
  if (share > 0.3) return "bleeding and unsteady";
  return "badly hurt";
}
