/**
 * What a stretch of time did, said once. Drift walks many short steps over every thing in a
 * place, and a caller wants neither a change per step nor a change for what did not change.
 * So the walk is reported as the difference between the world before and the world after:
 * what came into being, one change for each thing that is different now, saying how, and
 * what is gone. Applying the report to the world before gives the world after, exactly.
 */
import type { Body, Change, MatterWorld, Thing, ThingState } from "./types.ts";

/** What a change of state looks like to someone standing there. Below these, it does not. */
const SEEN: readonly { note: string; did: (a: ThingState, b: ThingState) => boolean }[] = [
  { note: "it burns out", did: (a, b) => a.burning !== null && b.burning === null },
  { note: "it burns down", did: (a, b) => a.burning !== null && b.burning !== null },
  { note: "it dries", did: (a, b) => b.wetness < a.wetness - 0.2 },
  { note: "it grows wetter", did: (a, b) => b.wetness > a.wetness + 0.2 },
  { note: "it warms", did: (a, b) => b.temperature > a.temperature + 0.3 },
  { note: "it cools", did: (a, b) => b.temperature < a.temperature - 0.3 },
  { note: "it turns", did: (a, b) => b.contamination > a.contamination + 0.3 },
  { note: "it rusts", did: (a, b) => b.corrosion > a.corrosion + 0.2 },
  { note: "it sets hard", did: (a, b) => b.set && !a.set },
];

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function thingChange(before: Thing, after: Thing, because: readonly string[]): Change[] {
  if (same(before.state, after.state)) return [];
  const notes = SEEN.filter((s) => s.did(before.state, after.state)).map((s) => s.note);
  return [
    {
      kind: "state",
      thing: after.id,
      set: after.state,
      because: [...because],
      note: notes.slice(0, 2).join(", ") || "time passes over it",
      // Nothing a person would notice: apply it, and say nothing.
      ...(notes.length === 0 ? { quiet: true as const } : {}),
    },
  ];
}

/** What the hours did to a body, in the words of whoever stands there. */
function bodyNote(onset: boolean, cold: number): string {
  if (onset) return "the sickness comes on";
  return cold >= 1 ? "the cold gets in" : "time tells on the body";
}

function bodyChanges(before: Body, after: Body): Change[] {
  const changes: Change[] = [];
  after.wounds.forEach((w, index) => {
    const was = before.wounds[index];
    if (was && was.bleeding !== w.bleeding)
      changes.push({
        kind: "treat",
        body: after.id,
        index,
        set: { bleeding: w.bleeding },
        because: ["B3", "X7"],
        note: w.bleeding > 0 ? "the bleeding slows" : "the bleeding stops",
      });
  });
  const { health, sickensIn, needs, wetness, feels } = after;
  const moved =
    health !== before.health ||
    !same(feels, before.feels) ||
    sickensIn !== before.sickensIn ||
    wetness !== before.wetness ||
    !same(needs, before.needs);
  if (moved) {
    const cold = (needs.warmth ?? 0) - (before.needs.warmth ?? 0);
    const onset = before.sickensIn > 0 && sickensIn === 0;
    const told = onset || cold >= 1 || before.health - health >= 0.1;
    changes.push({
      kind: "body",
      body: after.id,
      set: {
        health,
        sickensIn,
        needs,
        ...(wetness === undefined ? {} : { wetness }),
        ...(feels === undefined ? {} : { feels }),
      },
      because: ["B1", "B2", "B3", "B4", "X7"],
      note: bodyNote(onset, cold),
      ...(told ? {} : { quiet: true as const }),
    });
  }
  return changes;
}

/** The difference between two worlds, as changes that turn the first into the second. */
export function report(
  before: MatterWorld,
  after: MatterWorld,
  because: ReadonlyMap<string, ReadonlySet<string>>,
): Change[] {
  const born: Change[] = [];
  const changed: Change[] = [];
  const gone: Change[] = [];
  for (const thing of Object.values(after.things)) {
    const was = before.things[thing.id];
    const why = [...(because.get(thing.id) ?? [])];
    if (was) changed.push(...thingChange(was, thing, why));
    else born.push({ kind: "create", thing, because: ["S3", "E3"], note: "what is left of it" });
  }
  for (const was of Object.values(before.things))
    if (!(was.id in after.things))
      gone.push({
        kind: "consume",
        thing: was.id,
        amount: was.state.amount,
        because: ["S3", "E4"],
        note: "it has burned away",
      });
  const bodies = Object.values(after.bodies).flatMap((b) => {
    const was = before.bodies[b.id];
    return was ? bodyChanges(was, b) : [];
  });
  return [...born, ...changed, ...gone, ...bodies];
}
