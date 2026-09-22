/**
 * Milestone J in the shared world (P6): a `Settle` that lets a world rank physical outcomes with
 * the model, behind a per-world mode.
 *
 * - `off`: the code engine, exactly as before.
 * - `shadow`: the model ranks and its draw is logged beside the engine's outcome, but the engine's
 *   world is committed and the world's RNG is not advanced (a shadow must not fork the world).
 * - `live`: the ranked outcome is committed, drawn from the world's RNG with every draw logged.
 *   A late or absent model, or a broken invariant, commits the engine's outcome and says so.
 */
import { type Act, resolve } from "../matter/resolve.ts";
import type { Settle } from "../matter/shared.ts";
import type { MatterWorld } from "../matter/types.ts";
import { Rng } from "../rng.ts";
import { type CommitRecord, commit, type Scorer } from "./commit.ts";
import { viewOf } from "./scenario.ts";

export const MODES = ["off", "shadow", "live"] as const;
export type Mode = (typeof MODES)[number];

export interface RankedNote {
  version: "jepa-note-v1";
  mode: Exclude<Mode, "off">;
  process: string;
  record: CommitRecord;
  /** How many things the model's draw put in the engine's own class. */
  agreed: number;
  things: number;
}

function agreement(record: CommitRecord): number {
  return record.choices.filter((c) => c.chosen === c.engine).length;
}

export function rankedSettle(mode: Mode, scorer: Scorer | null, checkpoint: string): Settle {
  return (world: MatterWorld, act: Act, rngState) => {
    const view = viewOf(act);
    if (mode === "off" || !view) return { outcome: resolve(world, act), rng: rngState, draws: [] };
    const rng = Rng.fromState(rngState);
    const done = commit(world, act, view, scorer, rng, checkpoint);
    const note: RankedNote = {
      version: "jepa-note-v1",
      mode,
      process: act.process,
      record: done.record,
      agreed: agreement(done.record),
      things: done.record.choices.length,
    };
    if (mode === "shadow") return { outcome: done.engine, rng: rngState, draws: [], note };
    // Live: every draw is the world's; a fallback still spent its draws, so they are logged.
    const draws = done.record.choices.map((c) => c.draw);
    return {
      outcome: { world: done.world, changes: done.changes },
      rng: draws.length > 0 ? rng.state : rngState,
      draws,
      note,
    };
  };
}
